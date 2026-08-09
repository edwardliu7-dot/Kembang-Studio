import { Router, type IRouter } from "express";
import { db } from "../db";

const router: IRouter = Router();

router.get("/studio/stats", (_req, res): void => {
  const totalProjects = (db.prepare("SELECT COUNT(*) as c FROM projects").get() as { c: number }).c;
  const totalCheckpoints = (db.prepare("SELECT COUNT(*) as c FROM checkpoints").get() as { c: number }).c;
  const totalSecrets = (db.prepare("SELECT COUNT(*) as c FROM secrets").get() as { c: number }).c;

  const activeProjectRow = db.prepare("SELECT * FROM projects WHERE is_active = 1 LIMIT 1").get() as any;
  const recentProjectRows = db.prepare("SELECT * FROM projects ORDER BY last_opened_at DESC, created_at DESC LIMIT 5").all() as any[];

  const usage = db.prepare("SELECT SUM(tokens) as t, COUNT(*) as r FROM token_usage").get() as { t: number | null; r: number };
  const byProvider = db.prepare("SELECT provider_name, SUM(tokens) as tokens, COUNT(*) as requests FROM token_usage GROUP BY provider_name").all() as any[];

  function mapProject(row: any) {
    if (!row) return undefined;
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

  res.json({
    totalProjects,
    totalCheckpoints,
    totalSecrets,
    activeProject: mapProject(activeProjectRow),
    recentProjects: recentProjectRows.map(mapProject),
    tokenUsage: {
      totalTokens: usage.t || 0,
      totalRequests: usage.r || 0,
      byProvider: byProvider.map(p => ({
        providerName: p.provider_name,
        tokens: p.tokens || 0,
        requests: p.requests || 0,
      })),
    },
  });
});

export default router;
