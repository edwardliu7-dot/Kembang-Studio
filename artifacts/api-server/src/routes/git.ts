import { Router, type IRouter } from "express";
import simpleGit from "simple-git";
import { db } from "../db";

const router: IRouter = Router();

function getProjectPath(projectId: number): string | null {
  const row = db.prepare("SELECT local_path FROM projects WHERE id = ?").get(projectId) as { local_path: string } | undefined;
  return row?.local_path ?? null;
}

function git(projectId: number) {
  const p = getProjectPath(projectId);
  if (!p) throw new Error("Project not found");
  return simpleGit(p);
}

router.get("/git/status", async (req, res): Promise<void> => {
  const projectId = Number(req.query.projectId);
  if (!projectId) { res.status(400).json({ error: "projectId required" }); return; }

  try {
    const g = git(projectId);
    const status = await g.status();
    res.json({
      branch: status.current || "HEAD",
      isClean: status.isClean(),
      ahead: status.ahead,
      behind: status.behind,
      files: status.files.map(f => ({
        path: f.path,
        index: f.index || " ",
        working: f.working_dir || " ",
      })),
    });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

router.get("/git/diff", async (req, res): Promise<void> => {
  const projectId = Number(req.query.projectId);
  const file = req.query.file as string | undefined;
  if (!projectId) { res.status(400).json({ error: "projectId required" }); return; }

  try {
    const g = git(projectId);
    const args = file ? ["HEAD", "--", file] : ["HEAD"];
    const diff = await g.diff(args);
    const files: string[] = [];
    const lines = diff.split("\n");
    for (const line of lines) {
      if (line.startsWith("diff --git")) {
        const match = line.match(/b\/(.+)$/);
        if (match) files.push(match[1]);
      }
    }
    res.json({ diff, files });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

router.get("/git/log", async (req, res): Promise<void> => {
  const projectId = Number(req.query.projectId);
  const limit = Number(req.query.limit) || 20;
  if (!projectId) { res.status(400).json({ error: "projectId required" }); return; }

  try {
    const g = git(projectId);
    const log = await g.log({ maxCount: limit });
    res.json(log.all.map(c => ({
      hash: c.hash.substring(0, 8),
      message: c.message,
      author: c.author_name,
      date: c.date,
    })));
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

router.get("/git/branches", async (req, res): Promise<void> => {
  const projectId = Number(req.query.projectId);
  if (!projectId) { res.status(400).json({ error: "projectId required" }); return; }

  try {
    const g = git(projectId);
    const branches = await g.branchLocal();
    res.json({ current: branches.current, all: branches.all });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

router.post("/git/branch", async (req, res): Promise<void> => {
  const { projectId, name } = req.body;
  if (!projectId || !name) { res.status(400).json({ error: "projectId and name required" }); return; }

  try {
    const g = git(projectId);
    await g.checkoutLocalBranch(name);
    // Update active branch in DB
    db.prepare("UPDATE projects SET active_branch = ? WHERE id = ?").run(name, projectId);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

router.post("/git/checkout", async (req, res): Promise<void> => {
  const { projectId, branch } = req.body;
  if (!projectId || !branch) { res.status(400).json({ error: "projectId and branch required" }); return; }

  try {
    const g = git(projectId);
    await g.checkout(branch);
    db.prepare("UPDATE projects SET active_branch = ? WHERE id = ?").run(branch, projectId);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

router.post("/git/commit", async (req, res): Promise<void> => {
  const { projectId, message, stageAll } = req.body;
  if (!projectId || !message) { res.status(400).json({ error: "projectId and message required" }); return; }

  try {
    const g = git(projectId);
    if (stageAll !== false) await g.add("-A");
    const result = await g.commit(message);
    res.json({ hash: result.commit?.substring(0, 8) || "", message });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

router.post("/git/pull", async (req, res): Promise<void> => {
  const { projectId } = req.body;
  if (!projectId) { res.status(400).json({ error: "projectId required" }); return; }

  try {
    const g = git(projectId);
    await g.pull();
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

router.post("/git/push", async (req, res): Promise<void> => {
  const { projectId, approved, remote, branch } = req.body;
  if (!projectId) { res.status(400).json({ error: "projectId required" }); return; }
  if (!approved) { res.status(400).json({ error: "Push requires explicit approval" }); return; }

  try {
    const g = git(projectId);
    await g.push(remote || "origin", branch || undefined);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

export default router;
