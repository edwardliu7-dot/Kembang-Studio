import { Router, type IRouter } from "express";
import path from "path";
import fs from "fs";
import simpleGit from "simple-git";
import { db, getProjectsDir } from "../db";
import { logger } from "../lib/logger";

const router: IRouter = Router();

type ProjectRow = {
  id: number;
  name: string;
  local_path: string;
  github_url: string | null;
  active_branch: string | null;
  preview_port: number | null;
  start_command: string | null;
  build_command: string | null;
  status: string;
  is_active: number;
  last_opened_at: string | null;
  created_at: string;
};

function rowToProject(row: ProjectRow) {
  return {
    id: row.id,
    name: row.name,
    localPath: row.local_path,
    githubUrl: row.github_url,
    activeBranch: row.active_branch,
    previewPort: row.preview_port,
    startCommand: row.start_command,
    buildCommand: row.build_command,
    status: row.status,
    isActive: !!row.is_active,
    lastOpenedAt: row.last_opened_at,
    createdAt: row.created_at,
  };
}

router.get("/projects", (_req, res): void => {
  const rows = db.prepare("SELECT * FROM projects ORDER BY last_opened_at DESC, created_at DESC").all() as ProjectRow[];
  res.json(rows.map(rowToProject));
});

router.get("/projects/active", (_req, res): void => {
  const row = db.prepare("SELECT * FROM projects WHERE is_active = 1 LIMIT 1").get() as ProjectRow | undefined;
  if (!row) {
    res.json({ hasActive: false });
    return;
  }
  res.json({ hasActive: true, project: rowToProject(row) });
});

router.get("/projects/:id", (req, res): void => {
  const id = Number(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id);
  const row = db.prepare("SELECT * FROM projects WHERE id = ?").get(id) as ProjectRow | undefined;
  if (!row) {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  res.json(rowToProject(row));
});

router.post("/projects", async (req, res): Promise<void> => {
  const { name, localPath, githubUrl, startCommand, buildCommand, previewPort } = req.body;

  if (!name) {
    res.status(400).json({ error: "name is required" });
    return;
  }

  let projectPath = localPath;

  // Clone from GitHub if URL provided and no local path
  if (githubUrl && !localPath) {
    const repoName = githubUrl.split("/").pop()?.replace(".git", "") || name;
    projectPath = path.join(getProjectsDir(), repoName);

    if (!fs.existsSync(projectPath)) {
      try {
        fs.mkdirSync(projectPath, { recursive: true });
        const git = simpleGit();
        await git.clone(githubUrl, projectPath);
        req.log?.info({ projectPath }, "Cloned repository");
      } catch (err) {
        fs.rmSync(projectPath, { recursive: true, force: true });
        res.status(400).json({ error: `Clone failed: ${(err as Error).message}` });
        return;
      }
    }
  } else if (!projectPath) {
    res.status(400).json({ error: "Either localPath or githubUrl is required" });
    return;
  }

  // Detect branch
  let activeBranch = "main";
  try {
    const git = simpleGit(projectPath);
    const summary = await git.branchLocal();
    activeBranch = summary.current || "main";
  } catch { /* not a git repo, that's fine */ }

  const result = db.prepare(`
    INSERT INTO projects (name, local_path, github_url, active_branch, preview_port, start_command, build_command)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    name,
    projectPath,
    githubUrl || null,
    activeBranch,
    previewPort || 3100,
    startCommand || "npm run dev",
    buildCommand || "npm run build"
  );

  const row = db.prepare("SELECT * FROM projects WHERE id = ?").get(result.lastInsertRowid) as ProjectRow;
  res.status(201).json(rowToProject(row));
});

router.patch("/projects/:id", (req, res): void => {
  const id = Number(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id);
  const row = db.prepare("SELECT * FROM projects WHERE id = ?").get(id) as ProjectRow | undefined;
  if (!row) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  const { name, startCommand, buildCommand, previewPort, activeBranch } = req.body;
  db.prepare(`
    UPDATE projects SET
      name = COALESCE(?, name),
      start_command = COALESCE(?, start_command),
      build_command = COALESCE(?, build_command),
      preview_port = COALESCE(?, preview_port),
      active_branch = COALESCE(?, active_branch)
    WHERE id = ?
  `).run(name ?? null, startCommand ?? null, buildCommand ?? null, previewPort ?? null, activeBranch ?? null, id);

  const updated = db.prepare("SELECT * FROM projects WHERE id = ?").get(id) as ProjectRow;
  res.json(rowToProject(updated));
});

router.delete("/projects/:id", (req, res): void => {
  const id = Number(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id);
  db.prepare("DELETE FROM projects WHERE id = ?").run(id);
  res.sendStatus(204);
});

router.post("/projects/:id/open", (req, res): void => {
  const id = Number(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id);
  const row = db.prepare("SELECT * FROM projects WHERE id = ?").get(id) as ProjectRow | undefined;
  if (!row) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  // Deactivate all, then activate this one
  db.prepare("UPDATE projects SET is_active = 0").run();
  db.prepare("UPDATE projects SET is_active = 1, last_opened_at = datetime('now') WHERE id = ?").run(id);

  const updated = db.prepare("SELECT * FROM projects WHERE id = ?").get(id) as ProjectRow;
  res.json(rowToProject(updated));
});

export default router;
