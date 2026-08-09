import { Router, type IRouter } from "express";
import { db } from "../db";
import { encrypt, decrypt } from "../lib/crypto";
import { logger } from "../lib/logger";

const router: IRouter = Router();

type ProviderRow = {
  id: number;
  name: string;
  provider_type: string;
  encrypted_api_key: string | null;
  base_url: string | null;
  model: string | null;
  is_default: number;
  created_at: string;
};

type ConversationRow = {
  id: number;
  project_id: number;
  title: string;
  created_at: string;
  last_message_at: string | null;
};

type MessageRow = {
  id: number;
  conversation_id: number;
  role: string;
  content: string;
  tool_calls: string | null;
  created_at: string;
};

function rowToProvider(row: ProviderRow) {
  return {
    id: row.id,
    name: row.name,
    providerType: row.provider_type,
    baseUrl: row.base_url,
    model: row.model,
    isDefault: !!row.is_default,
    createdAt: row.created_at,
  };
}

function rowToConversation(row: ConversationRow & { message_count?: number }) {
  return {
    id: row.id,
    projectId: row.project_id,
    title: row.title,
    messageCount: row.message_count || 0,
    lastMessageAt: row.last_message_at,
    createdAt: row.created_at,
  };
}

function rowToMessage(row: MessageRow) {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    role: row.role as "user" | "assistant" | "system",
    content: row.content,
    toolCalls: row.tool_calls,
    createdAt: row.created_at,
  };
}

// AI Providers
router.get("/ai/providers", (_req, res): void => {
  const rows = db.prepare("SELECT * FROM ai_providers ORDER BY is_default DESC, created_at").all() as ProviderRow[];
  res.json(rows.map(rowToProvider));
});

router.post("/ai/providers", (req, res): void => {
  const { name, providerType, apiKey, baseUrl, model, isDefault } = req.body;
  if (!name || !providerType || !apiKey) {
    res.status(400).json({ error: "name, providerType, apiKey required" });
    return;
  }

  if (isDefault) {
    db.prepare("UPDATE ai_providers SET is_default = 0").run();
  }

  const encryptedKey = encrypt(apiKey);
  const result = db.prepare(`
    INSERT INTO ai_providers (name, provider_type, encrypted_api_key, base_url, model, is_default)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(name, providerType, encryptedKey, baseUrl || null, model || null, isDefault ? 1 : 0);

  const row = db.prepare("SELECT * FROM ai_providers WHERE id = ?").get(result.lastInsertRowid) as ProviderRow;
  res.json(rowToProvider(row));
});

router.delete("/ai/providers/:id", (req, res): void => {
  const id = Number(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id);
  db.prepare("DELETE FROM ai_providers WHERE id = ?").run(id);
  res.sendStatus(204);
});

// Conversations
router.get("/ai/conversations", (req, res): void => {
  const projectId = Number(req.query.projectId);
  if (!projectId) { res.status(400).json({ error: "projectId required" }); return; }

  const rows = db.prepare(`
    SELECT c.*, COUNT(m.id) as message_count
    FROM ai_conversations c
    LEFT JOIN ai_messages m ON m.conversation_id = c.id
    WHERE c.project_id = ?
    GROUP BY c.id
    ORDER BY c.last_message_at DESC, c.created_at DESC
    LIMIT 20
  `).all(projectId) as (ConversationRow & { message_count: number })[];

  res.json(rows.map(rowToConversation));
});

router.get("/ai/conversations/:id/messages", (req, res): void => {
  const id = Number(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id);
  const conv = db.prepare("SELECT * FROM ai_conversations WHERE id = ?").get(id);
  if (!conv) { res.status(404).json({ error: "Conversation not found" }); return; }

  const rows = db.prepare("SELECT * FROM ai_messages WHERE conversation_id = ? ORDER BY created_at").all(id) as MessageRow[];
  res.json(rows.map(rowToMessage));
});

// Chat
router.post("/ai/chat", async (req, res): Promise<void> => {
  const { projectId, conversationId, message, mode } = req.body;
  if (!projectId || !message) {
    res.status(400).json({ error: "projectId and message required" });
    return;
  }

  // Get or create conversation
  let convId = conversationId;
  if (!convId) {
    const title = message.length > 50 ? message.substring(0, 50) + "..." : message;
    const result = db.prepare("INSERT INTO ai_conversations (project_id, title) VALUES (?, ?)").run(projectId, title);
    convId = result.lastInsertRowid;
  }

  // Save user message
  db.prepare("INSERT INTO ai_messages (conversation_id, role, content) VALUES (?, 'user', ?)").run(convId, message);
  db.prepare("UPDATE ai_conversations SET last_message_at = datetime('now') WHERE id = ?").run(convId);

  // Get AI provider
  const providerRow = db.prepare("SELECT * FROM ai_providers WHERE is_default = 1 LIMIT 1").get() as ProviderRow | undefined
    || db.prepare("SELECT * FROM ai_providers LIMIT 1").get() as ProviderRow | undefined;

  if (!providerRow) {
    const reply = "No AI provider configured. Please add an API key in Settings.";
    const msgResult = db.prepare("INSERT INTO ai_messages (conversation_id, role, content) VALUES (?, 'assistant', ?)").run(convId, reply);
    const msg = db.prepare("SELECT * FROM ai_messages WHERE id = ?").get(msgResult.lastInsertRowid) as MessageRow;
    res.json(rowToMessage(msg));
    return;
  }

  // Get conversation history
  const history = db.prepare("SELECT role, content FROM ai_messages WHERE conversation_id = ? ORDER BY created_at").all(convId) as { role: string; content: string }[];

  let apiKey = "";
  try {
    apiKey = decrypt(providerRow.encrypted_api_key || "");
  } catch { /* key not set */ }

  // Build OpenAI-compatible request
  const baseUrl = providerRow.base_url || getDefaultBaseUrl(providerRow.provider_type);
  const model = providerRow.model || getDefaultModel(providerRow.provider_type);

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: `You are an expert coding assistant in a personal dev studio. Current mode: ${mode || "build"}. Help the user with their code, debugging, and problem-solving.` },
          ...history.slice(-20), // Last 20 messages for context
        ],
        max_tokens: 4096,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API error ${response.status}: ${errorText.substring(0, 200)}`);
    }

    const data = await response.json() as any;
    const assistantContent = data.choices?.[0]?.message?.content || "No response";

    // Track token usage
    const tokens = data.usage?.total_tokens || 0;
    db.prepare("INSERT INTO token_usage (provider_name, tokens) VALUES (?, ?)").run(providerRow.name, tokens);

    const msgResult = db.prepare("INSERT INTO ai_messages (conversation_id, role, content) VALUES (?, 'assistant', ?)").run(convId, assistantContent);
    db.prepare("UPDATE ai_conversations SET last_message_at = datetime('now') WHERE id = ?").run(convId);
    const msg = db.prepare("SELECT * FROM ai_messages WHERE id = ?").get(msgResult.lastInsertRowid) as MessageRow;
    res.json(rowToMessage(msg));
  } catch (err) {
    logger.error({ err }, "AI API error");
    const errMsg = `Error communicating with AI: ${(err as Error).message}`;
    const msgResult = db.prepare("INSERT INTO ai_messages (conversation_id, role, content) VALUES (?, 'assistant', ?)").run(convId, errMsg);
    const msg = db.prepare("SELECT * FROM ai_messages WHERE id = ?").get(msgResult.lastInsertRowid) as MessageRow;
    res.json(rowToMessage(msg));
  }
});

function getDefaultBaseUrl(providerType: string): string {
  const urls: Record<string, string> = {
    openai: "https://api.openai.com/v1",
    groq: "https://api.groq.com/openai/v1",
    gemini: "https://generativelanguage.googleapis.com/v1beta/openai",
    anthropic: "https://api.anthropic.com/v1",
    ollama: "http://localhost:11434/v1",
  };
  return urls[providerType] || "https://api.openai.com/v1";
}

function getDefaultModel(providerType: string): string {
  const models: Record<string, string> = {
    openai: "gpt-4o-mini",
    groq: "llama-3.3-70b-versatile",
    gemini: "gemini-2.0-flash",
    anthropic: "claude-3-5-haiku-20241022",
    ollama: "llama3.2",
  };
  return models[providerType] || "gpt-4o-mini";
}

export default router;
