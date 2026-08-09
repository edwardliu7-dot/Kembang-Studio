import { Router, type IRouter } from "express";
import { db } from "../db";
import { encrypt, decrypt } from "../lib/crypto";

const router: IRouter = Router();

type SecretRow = {
  id: number;
  project_id: number;
  name: string;
  encrypted_value: string;
  created_at: string;
};

function rowToEntry(row: SecretRow) {
  return {
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    createdAt: row.created_at,
  };
}

router.get("/secrets", (req, res): void => {
  const projectId = Number(req.query.projectId);
  if (!projectId) { res.status(400).json({ error: "projectId required" }); return; }

  const rows = db.prepare("SELECT * FROM secrets WHERE project_id = ? ORDER BY name").all(projectId) as SecretRow[];
  // NEVER return values — only names and metadata
  res.json(rows.map(rowToEntry));
});

router.post("/secrets", (req, res): void => {
  const { projectId, name, value } = req.body;
  if (!projectId || !name || value == null) {
    res.status(400).json({ error: "projectId, name, value required" });
    return;
  }

  const encrypted = encrypt(value);
  try {
    const result = db.prepare(`
      INSERT INTO secrets (project_id, name, encrypted_value)
      VALUES (?, ?, ?)
    `).run(projectId, name.toUpperCase(), encrypted);

    const row = db.prepare("SELECT * FROM secrets WHERE id = ?").get(result.lastInsertRowid) as SecretRow;
    res.status(201).json(rowToEntry(row));
  } catch (err: any) {
    if (err?.message?.includes("UNIQUE")) {
      res.status(400).json({ error: `Secret '${name}' already exists for this project` });
    } else {
      res.status(400).json({ error: err.message });
    }
  }
});

router.patch("/secrets/:id", (req, res): void => {
  const id = Number(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id);
  const { value } = req.body;

  if (value == null) { res.status(400).json({ error: "value required" }); return; }

  const row = db.prepare("SELECT * FROM secrets WHERE id = ?").get(id) as SecretRow | undefined;
  if (!row) { res.status(404).json({ error: "Secret not found" }); return; }

  const encrypted = encrypt(value);
  db.prepare("UPDATE secrets SET encrypted_value = ? WHERE id = ?").run(encrypted, id);

  const updated = db.prepare("SELECT * FROM secrets WHERE id = ?").get(id) as SecretRow;
  res.json(rowToEntry(updated));
});

router.delete("/secrets/:id", (req, res): void => {
  const id = Number(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id);
  db.prepare("DELETE FROM secrets WHERE id = ?").run(id);
  res.sendStatus(204);
});

// Internal helper to get decrypted env vars for a project (used by build runner)
export function getProjectEnv(projectId: number): Record<string, string> {
  const rows = db.prepare("SELECT name, encrypted_value FROM secrets WHERE project_id = ?").all(projectId) as { name: string; encrypted_value: string }[];
  const env: Record<string, string> = {};
  for (const row of rows) {
    try {
      env[row.name] = decrypt(row.encrypted_value);
    } catch { /* skip corrupted secrets */ }
  }
  return env;
}

export default router;
