import { WebSocketServer, WebSocket } from "ws";
import { IncomingMessage } from "http";
import { db } from "./db";
import { getProjectEnv } from "./routes/secrets";
import { logger } from "./lib/logger";

// node-pty types (no @types package)
type IPty = {
  onData: (cb: (data: string) => void) => void;
  onExit: (cb: (e: { exitCode: number }) => void) => void;
  write: (data: string) => void;
  resize: (cols: number, rows: number) => void;
  kill: () => void;
  pid: number;
};

function getProjectPath(projectId: number): string | null {
  const row = db.prepare("SELECT local_path FROM projects WHERE id = ?").get(projectId) as { local_path: string } | undefined;
  return row?.local_path ?? null;
}

export function setupTerminalWs(wss: WebSocketServer) {
  wss.on("connection", async (ws: WebSocket, req: IncomingMessage) => {
    const url = new URL(req.url || "/", "http://localhost");
    const projectId = Number(url.searchParams.get("projectId"));

    if (!projectId) {
      ws.send(JSON.stringify({ type: "error", message: "projectId required" }));
      ws.close();
      return;
    }

    const projectPath = getProjectPath(projectId);
    if (!projectPath) {
      ws.send(JSON.stringify({ type: "error", message: "Project not found" }));
      ws.close();
      return;
    }

    let pty: IPty | null = null;

    try {
      // Dynamically import node-pty to handle potential native module issues
      const nodePty = await import("node-pty");
      const env = { ...process.env, ...getProjectEnv(projectId), TERM: "xterm-256color" };

      pty = nodePty.spawn(process.env.SHELL || "bash", [], {
        name: "xterm-256color",
        cols: 80,
        rows: 24,
        cwd: projectPath,
        env: env as Record<string, string>,
      }) as IPty;

      logger.info({ projectId, pid: pty.pid }, "Terminal spawned");

      pty.onData((data: string) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "output", data }));
        }
      });

      pty.onExit(({ exitCode }) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "exit", exitCode }));
        }
        ws.close();
      });

      ws.on("message", (msg) => {
        try {
          const parsed = JSON.parse(msg.toString());
          if (parsed.type === "input" && pty) {
            pty.write(parsed.data);
          } else if (parsed.type === "resize" && pty) {
            pty.resize(parsed.cols || 80, parsed.rows || 24);
          }
        } catch {
          // Treat raw text as input
          if (pty) pty.write(msg.toString());
        }
      });

      ws.on("close", () => {
        logger.info({ projectId }, "Terminal WebSocket closed");
        pty?.kill();
        pty = null;
      });

      ws.on("error", (err) => {
        logger.error({ err, projectId }, "Terminal WebSocket error");
        pty?.kill();
        pty = null;
      });

    } catch (err) {
      logger.error({ err }, "Failed to spawn terminal");
      ws.send(JSON.stringify({ type: "error", message: `Terminal unavailable: ${(err as Error).message}` }));
      ws.close();
    }
  });
}
