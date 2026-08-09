import { Router, type IRouter } from "express";
import { spawn, type ChildProcess } from "child_process";
import { db } from "../db";
import { getProjectEnv } from "./secrets";
import { logger } from "../lib/logger";

const router: IRouter = Router();

interface BuildState {
  state: "idle" | "running" | "success" | "failed";
  exitCode: number | null;
  startedAt: string | null;
  finishedAt: string | null;
  process: ChildProcess | null;
  log: string[];
}

interface PreviewState {
  state: "stopped" | "starting" | "running" | "crashed";
  port: number | null;
  pid: number | null;
  url: string | null;
  process: ChildProcess | null;
}

const buildStates = new Map<number, BuildState>();
const previewStates = new Map<number, PreviewState>();

// SSE clients for build logs
const buildLogClients = new Map<number, Set<any>>();

function getBuild(projectId: number): BuildState {
  if (!buildStates.has(projectId)) {
    buildStates.set(projectId, { state: "idle", exitCode: null, startedAt: null, finishedAt: null, process: null, log: [] });
  }
  return buildStates.get(projectId)!;
}

function getPreview(projectId: number): PreviewState {
  if (!previewStates.has(projectId)) {
    previewStates.set(projectId, { state: "stopped", port: null, pid: null, url: null, process: null });
  }
  return previewStates.get(projectId)!;
}

function getProjectInfo(projectId: number) {
  return db.prepare("SELECT * FROM projects WHERE id = ?").get(projectId) as {
    local_path: string;
    build_command: string;
    start_command: string;
    preview_port: number;
  } | undefined;
}

router.post("/build/run", (req, res): void => {
  const { projectId } = req.body;
  if (!projectId) { res.status(400).json({ error: "projectId required" }); return; }

  const project = getProjectInfo(projectId);
  if (!project) { res.status(400).json({ error: "Project not found" }); return; }

  const build = getBuild(projectId);
  if (build.state === "running") {
    res.json({ projectId, state: "running", exitCode: null, startedAt: build.startedAt, finishedAt: null });
    return;
  }

  // Kill previous
  build.process?.kill();
  build.log = [];
  build.state = "running";
  build.startedAt = new Date().toISOString();
  build.finishedAt = null;
  build.exitCode = null;

  const env = { ...process.env, ...getProjectEnv(projectId) };
  const [cmd, ...args] = (project.build_command || "npm run build").split(" ");
  const child = spawn(cmd, args, { cwd: project.local_path, env, shell: true });
  build.process = child;

  const onData = (data: Buffer) => {
    const text = data.toString();
    build.log.push(text);
    // Notify SSE clients
    const clients = buildLogClients.get(projectId);
    if (clients) for (const client of clients) { try { client.write(`data: ${JSON.stringify(text)}\n\n`); } catch {} }
  };

  child.stdout?.on("data", onData);
  child.stderr?.on("data", onData);
  child.on("close", (code) => {
    build.state = code === 0 ? "success" : "failed";
    build.exitCode = code;
    build.finishedAt = new Date().toISOString();
    build.process = null;
    logger.info({ projectId, code }, "Build finished");
  });

  res.json({ projectId, state: "running", exitCode: null, startedAt: build.startedAt, finishedAt: null });
});

router.get("/build/status", (req, res): void => {
  const projectId = Number(req.query.projectId);
  if (!projectId) { res.status(400).json({ error: "projectId required" }); return; }

  const build = getBuild(projectId);
  res.json({ projectId, state: build.state, exitCode: build.exitCode, startedAt: build.startedAt, finishedAt: build.finishedAt });
});

// SSE endpoint for build logs
router.get("/build/log-stream", (req, res): void => {
  const projectId = Number(req.query.projectId);
  if (!projectId) { res.status(400).json({ error: "projectId required" }); return; }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  // Send existing log
  const build = getBuild(projectId);
  for (const line of build.log) {
    res.write(`data: ${JSON.stringify(line)}\n\n`);
  }

  if (!buildLogClients.has(projectId)) buildLogClients.set(projectId, new Set());
  buildLogClients.get(projectId)!.add(res);

  req.on("close", () => {
    buildLogClients.get(projectId)?.delete(res);
  });
});

router.post("/preview/start", (req, res): void => {
  const { projectId } = req.body;
  if (!projectId) { res.status(400).json({ error: "projectId required" }); return; }

  const project = getProjectInfo(projectId);
  if (!project) { res.status(400).json({ error: "Project not found" }); return; }

  const preview = getPreview(projectId);

  // Stop existing
  if (preview.process) {
    preview.process.kill();
    preview.process = null;
  }

  preview.state = "starting";
  preview.port = project.preview_port || 3100;

  const env = {
    ...process.env,
    ...getProjectEnv(projectId),
    PORT: String(preview.port),
  };

  const [cmd, ...args] = (project.start_command || "npm run dev").split(" ");
  const child = spawn(cmd, args, { cwd: project.local_path, env, shell: true });
  preview.process = child;
  preview.pid = child.pid ?? null;

  // Check when server is ready (look for common port binding messages)
  const checkReady = (data: Buffer) => {
    const text = data.toString();
    if (text.includes("localhost") || text.includes("ready") || text.includes("started") || text.includes(`${preview.port}`)) {
      if (preview.state === "starting") {
        preview.state = "running";
        preview.url = `/preview?projectId=${projectId}`;
      }
    }
  };

  child.stdout?.on("data", checkReady);
  child.stderr?.on("data", checkReady);

  // Optimistically set running after 3 seconds
  setTimeout(() => {
    if (preview.state === "starting") preview.state = "running";
  }, 3000);

  child.on("close", (code) => {
    if (code !== 0 && preview.state === "running") preview.state = "crashed";
    else if (preview.state !== "stopped") preview.state = "stopped";
    preview.process = null;
    preview.pid = null;
  });

  res.json({ projectId, state: "starting", port: preview.port, pid: preview.pid, url: null });
});

router.post("/preview/stop", (req, res): void => {
  const { projectId } = req.body;
  if (!projectId) { res.status(400).json({ error: "projectId required" }); return; }

  const preview = getPreview(projectId);
  if (preview.process) {
    preview.process.kill();
    preview.process = null;
  }
  preview.state = "stopped";
  preview.pid = null;

  res.json({ projectId, state: "stopped", port: preview.port, pid: null, url: null });
});

router.get("/preview/status", (req, res): void => {
  const projectId = Number(req.query.projectId);
  if (!projectId) { res.status(400).json({ error: "projectId required" }); return; }

  const preview = getPreview(projectId);
  res.json({
    projectId,
    state: preview.state,
    port: preview.port,
    pid: preview.pid,
    url: preview.state === "running" ? `http://localhost:${preview.port}` : null,
  });
});

export { previewStates };
export default router;
