import { Router, type IRouter } from "express";
import path from "path";
import fs from "fs";
import { db } from "../db";

const router: IRouter = Router();

function getProjectPath(projectId: number): string | null {
  const row = db.prepare("SELECT local_path FROM projects WHERE id = ?").get(projectId) as { local_path: string } | undefined;
  return row?.local_path ?? null;
}

function getLanguage(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const map: Record<string, string> = {
    ".ts": "typescript", ".tsx": "typescriptreact",
    ".js": "javascript", ".jsx": "javascriptreact",
    ".json": "json", ".css": "css", ".scss": "scss",
    ".html": "html", ".md": "markdown",
    ".py": "python", ".rb": "ruby", ".go": "go",
    ".rs": "rust", ".java": "java", ".c": "c", ".cpp": "cpp",
    ".sh": "shell", ".yaml": "yaml", ".yml": "yaml",
    ".toml": "toml", ".sql": "sql", ".graphql": "graphql",
    ".env": "plaintext", ".txt": "plaintext",
  };
  return map[ext] || "plaintext";
}

const IGNORED = new Set([
  "node_modules", ".git", "dist", "build", ".next", ".nuxt",
  "__pycache__", ".venv", "venv", ".DS_Store", "*.pyc",
  "coverage", ".turbo", ".cache", "tmp"
]);

function buildTree(dirPath: string, relativePath = ""): any[] {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dirPath, { withFileTypes: true });
  } catch {
    return [];
  }

  return entries
    .filter(e => !IGNORED.has(e.name) && !e.name.startsWith("."))
    .sort((a, b) => {
      // Directories first
      if (a.isDirectory() && !b.isDirectory()) return -1;
      if (!a.isDirectory() && b.isDirectory()) return 1;
      return a.name.localeCompare(b.name);
    })
    .map(e => {
      const rel = relativePath ? `${relativePath}/${e.name}` : e.name;
      const full = path.join(dirPath, e.name);
      if (e.isDirectory()) {
        return {
          name: e.name,
          path: rel,
          type: "directory",
          size: null,
          modified: null,
          children: buildTree(full, rel),
        };
      }
      let stat;
      try { stat = fs.statSync(full); } catch { stat = null; }
      return {
        name: e.name,
        path: rel,
        type: "file",
        size: stat?.size ?? null,
        modified: stat?.mtime?.toISOString() ?? null,
        children: undefined,
      };
    });
}

function resolveSafePath(projectPath: string, filePath: string): string | null {
  const resolved = path.resolve(projectPath, filePath);
  if (!resolved.startsWith(path.resolve(projectPath))) return null;
  return resolved;
}

router.get("/files/tree", (req, res): void => {
  const projectId = Number(req.query.projectId);
  if (!projectId) { res.status(400).json({ error: "projectId required" }); return; }

  const projectPath = getProjectPath(projectId);
  if (!projectPath || !fs.existsSync(projectPath)) {
    res.status(400).json({ error: "Project path not found" });
    return;
  }

  res.json(buildTree(projectPath));
});

router.get("/files/content", (req, res): void => {
  const projectId = Number(req.query.projectId);
  const filePath = req.query.path as string;

  if (!projectId || !filePath) {
    res.status(400).json({ error: "projectId and path required" });
    return;
  }

  const projectPath = getProjectPath(projectId);
  if (!projectPath) { res.status(400).json({ error: "Project not found" }); return; }

  const full = resolveSafePath(projectPath, filePath);
  if (!full) { res.status(400).json({ error: "Invalid path" }); return; }

  if (!fs.existsSync(full)) { res.status(404).json({ error: "File not found" }); return; }

  let content: string;
  try {
    content = fs.readFileSync(full, "utf8");
  } catch (e) {
    res.status(400).json({ error: "Cannot read file (binary?)" });
    return;
  }

  const stat = fs.statSync(full);
  res.json({ path: filePath, content, language: getLanguage(filePath), size: stat.size });
});

router.post("/files/content", (req, res): void => {
  const { projectId, path: filePath, content } = req.body;
  if (!projectId || !filePath || content == null) {
    res.status(400).json({ error: "projectId, path, and content required" });
    return;
  }

  const projectPath = getProjectPath(projectId);
  if (!projectPath) { res.status(400).json({ error: "Project not found" }); return; }

  const full = resolveSafePath(projectPath, filePath);
  if (!full) { res.status(400).json({ error: "Invalid path" }); return; }

  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content, "utf8");

  const stat = fs.statSync(full);
  res.json({ path: filePath, content, language: getLanguage(filePath), size: stat.size });
});

router.post("/files/rename", (req, res): void => {
  const { projectId, oldPath, newPath } = req.body;
  if (!projectId || !oldPath || !newPath) {
    res.status(400).json({ error: "projectId, oldPath, newPath required" });
    return;
  }

  const projectPath = getProjectPath(projectId);
  if (!projectPath) { res.status(400).json({ error: "Project not found" }); return; }

  const fullOld = resolveSafePath(projectPath, oldPath);
  const fullNew = resolveSafePath(projectPath, newPath);
  if (!fullOld || !fullNew) { res.status(400).json({ error: "Invalid path" }); return; }

  fs.mkdirSync(path.dirname(fullNew), { recursive: true });
  fs.renameSync(fullOld, fullNew);
  res.json({ ok: true });
});

router.post("/files/delete", (req, res): void => {
  const { projectId, path: filePath } = req.body;
  if (!projectId || !filePath) {
    res.status(400).json({ error: "projectId and path required" });
    return;
  }

  const projectPath = getProjectPath(projectId);
  if (!projectPath) { res.status(400).json({ error: "Project not found" }); return; }

  const full = resolveSafePath(projectPath, filePath);
  if (!full) { res.status(400).json({ error: "Invalid path" }); return; }

  fs.rmSync(full, { recursive: true, force: true });
  res.json({ ok: true });
});

router.post("/files/mkdir", (req, res): void => {
  const { projectId, path: dirPath } = req.body;
  if (!projectId || !dirPath) {
    res.status(400).json({ error: "projectId and path required" });
    return;
  }

  const projectPath = getProjectPath(projectId);
  if (!projectPath) { res.status(400).json({ error: "Project not found" }); return; }

  const full = resolveSafePath(projectPath, dirPath);
  if (!full) { res.status(400).json({ error: "Invalid path" }); return; }

  fs.mkdirSync(full, { recursive: true });
  res.json({ ok: true });
});

export default router;
