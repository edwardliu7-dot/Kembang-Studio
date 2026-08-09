import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { db } from "../db";
import { logger } from "../lib/logger";

const router: IRouter = Router();

function getPasswordHash(): string | null {
  const row = db.prepare("SELECT value FROM settings WHERE key = 'password_hash'").get() as { value: string } | undefined;
  return row?.value ?? null;
}

export function initDefaultPassword() {
  const existing = getPasswordHash();
  if (!existing) {
    const defaultPass = process.env.STUDIO_PASSWORD || "Nasywa7D";
    // Use synchronous hash so it's ready before first request
    const hash = bcrypt.hashSync(defaultPass, 10);
    db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('password_hash', ?)").run(hash);
    logger.info("Default password set");
  }
}

router.post("/auth/login", async (req, res): Promise<void> => {
  const { password } = req.body;
  if (!password) {
    res.status(400).json({ error: "Password required" });
    return;
  }

  const hash = getPasswordHash();
  if (!hash) {
    res.status(500).json({ error: "Server not initialized" });
    return;
  }

  const valid = await bcrypt.compare(password, hash);
  if (!valid) {
    res.status(401).json({ error: "Invalid password" });
    return;
  }

  (req.session as any).authenticated = true;
  res.json({ authenticated: true });
});

router.post("/auth/logout", (req, res): void => {
  req.session.destroy(() => {});
  res.json({ authenticated: false });
});

router.get("/auth/me", (req, res): void => {
  const authenticated = !!(req.session as any).authenticated;
  res.json({ authenticated });
});

export default router;
