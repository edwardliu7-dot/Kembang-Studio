import crypto from "crypto";

const ALGO = "aes-256-gcm";
const KEY_FILE = process.env.STUDIO_KEY_FILE || 
  require("path").join(process.env.HOME || "/tmp", "dev-studio", ".key");

function getKey(): Buffer {
  const fs = require("fs");
  const path = require("path");
  
  // Ensure directory exists
  const dir = path.dirname(KEY_FILE);
  fs.mkdirSync(dir, { recursive: true });

  if (fs.existsSync(KEY_FILE)) {
    const keyHex = fs.readFileSync(KEY_FILE, "utf8").trim();
    return Buffer.from(keyHex, "hex");
  }
  
  const key = crypto.randomBytes(32);
  fs.writeFileSync(KEY_FILE, key.toString("hex"), { mode: 0o600 });
  return key;
}

let _key: Buffer | null = null;

function key(): Buffer {
  if (!_key) _key = getKey();
  return _key;
}

export function encrypt(text: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, key(), iv);
  const encrypted = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString("hex"), tag.toString("hex"), encrypted.toString("hex")].join(":");
}

export function decrypt(data: string): string {
  const [ivHex, tagHex, encHex] = data.split(":");
  const iv = Buffer.from(ivHex, "hex");
  const tag = Buffer.from(tagHex, "hex");
  const encrypted = Buffer.from(encHex, "hex");
  const decipher = crypto.createDecipheriv(ALGO, key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}
