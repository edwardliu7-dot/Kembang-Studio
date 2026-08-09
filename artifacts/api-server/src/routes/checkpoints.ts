import { Router, type IRouter } from "express";
import simpleGit from "simple-git";
import { db } from "../db";

const router: IRouter = Router();

type CheckpointRow = {
  id: number;
  project_id: number;
  label: string;
  summary: string | null;
  commit_hash: string;
  files_changed: number | null;
  build_passed: number | null;
  created_at: string;
};

function rowToCheckpoint(row: CheckpointRow) {
  return {
    id: row.id,
    projectId: row.project_id,
    label: row.label,
    summary: row.summary,
    commitHash: row.commit_hash,
    filesChanged: row.files_changed,
    buildPassed: row.build_passed != null ? !!row.build_passed : null,
    createdAt: row.created_at,
  };
}

function getProjectPath(projectId: number): string | null {
  const row = db.prepare("SELECT local_path FROM projects WHERE id = ?").get(projectId) as { local_path: string } | undefined;
  return row?.local_path ?? null;
}

router.get("/checkpoints", (req, res): void => {
  const projectId = Number(req.query.projectId);
  if (!projectId) { res.status(400).json({ error: "projectId required" }); return; }

  const rows = db.prepare("SELECT * FROM checkpoints WHERE project_id = ? ORDER BY created_at DESC").all(projectId) as CheckpointRow[];
  res.json(rows.map(rowToCheckpoint));
});

router.post("/checkpoints", async (req, res): Promise<void> => {
  const { projectId, label, summary } = req.body;
  if (!projectId || !label) { res.status(400).json({ error: "projectId and label required" }); return; }

  const projectPath = getProjectPath(projectId);
  if (!projectPath) { res.status(400).json({ error: "Project not found" }); return; }

  try {
    const git = simpleGit(projectPath);
    await git.add("-A");
    const msg = `[checkpoint] ${label}`;
    const result = await git.commit(msg, { "--allow-empty": null });
    const hash = result.commit || "unknown";

    // Count changed files
    let filesChanged: number | null = null;
    try {
      const diff = await git.diff(["HEAD~1", "HEAD", "--name-only"]);
      filesChanged = diff.trim().split("\n").filter(Boolean).length;
    } catch { /* first commit case */ }

    const row = db.prepare(`
      INSERT INTO checkpoints (project_id, label, summary, commit_hash, files_changed)
      VALUES (?, ?, ?, ?, ?)
    `).run(projectId, label, summary || null, hash.substring(0, 8), filesChanged).lastInsertRowid;

    const created = db.prepare("SELECT * FROM checkpoints WHERE id = ?").get(row) as CheckpointRow;
    res.status(201).json(rowToCheckpoint(created));
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

router.post("/checkpoints/:id/rollback", async (req, res): Promise<void> => {
  const id = Number(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id);
  const cp = db.prepare("SELECT * FROM checkpoints WHERE id = ?").get(id) as CheckpointRow | undefined;

  if (!cp) { res.status(404).json({ error: "Checkpoint not found" }); return; }

  const projectPath = getProjectPath(cp.project_id);
  if (!projectPath) { res.status(400).json({ error: "Project not found" }); return; }

  try {
    const git = simpleGit(projectPath);
    await git.reset(["--hard", cp.commit_hash]);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

export default router;
