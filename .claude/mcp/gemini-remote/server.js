#!/usr/bin/env node
/*
 * gemini-remote — a hosted MCP server (Streamable HTTP) that exposes Google
 * Gemini to the **Claude.ai web app and the Claude iPhone app**, which can only
 * reach external tools through a remote MCP connector.
 *
 * Unlike the local server, a hosted server CANNOT use your Ultra OAuth login, so
 * this one calls the Gemini REST API with an API key (billed per-use by Google).
 * That is the unavoidable cost of the web/phone surfaces — keep this dormant
 * until you choose to deploy it.
 *
 * Zero dependencies — Node stdlib + global fetch (Node 18+).
 *
 * Env:
 *   GEMINI_API_KEY   (required)  Google AI Studio API key.
 *   MCP_AUTH_TOKEN   (optional)  if set, callers must send
 *                                `Authorization: Bearer <token>`. STRONGLY
 *                                recommended so nobody else can spend your key.
 *   PORT             (optional)  default 8080.
 *   DEEP_MODEL       (optional)  default "gemini-3.1-pro".
 *   QUICK_MODEL      (optional)  default "gemini-3.5-flash".
 */
"use strict";

const http = require("node:http");

const PORT = process.env.PORT || 8080;
const API_KEY = process.env.GEMINI_API_KEY || "";
const AUTH_TOKEN = process.env.MCP_AUTH_TOKEN || "";
const DEEP_MODEL = process.env.DEEP_MODEL || "gemini-3.1-pro";
const QUICK_MODEL = process.env.QUICK_MODEL || "gemini-3.5-flash";

const TOOLS = [
  {
    name: "ask_gemini",
    description:
      "Ask Google Gemini for an independent answer or second opinion. " +
      "mode='deep' uses a Pro model with deep thinking (default, for hard " +
      "questions); mode='quick' uses a Flash model for fast checks.",
    inputSchema: {
      type: "object",
      properties: {
        prompt: { type: "string", description: "The question or text to send to Gemini." },
        mode: { type: "string", enum: ["deep", "quick"], description: "deep (default) | quick" },
      },
      required: ["prompt"],
    },
  },
];

async function askGemini({ prompt, mode }) {
  if (!API_KEY) {
    return { isError: true, text: "Server misconfigured: GEMINI_API_KEY is not set." };
  }
  const deep = (mode || "deep") !== "quick";
  const model = deep ? DEEP_MODEL : QUICK_MODEL;
  const body = {
    contents: [{ role: "user", parts: [{ text: String(prompt || "") }] }],
  };
  if (deep) {
    // Ask for a generous thinking budget on the Pro model.
    body.generationConfig = { thinkingConfig: { thinkingBudget: 24576 } };
  }
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": API_KEY },
        body: JSON.stringify(body),
      }
    );
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      return { isError: true, text: `Gemini API ${res.status}: ${detail.slice(0, 500)}` };
    }
    const data = await res.json();
    const parts = data?.candidates?.[0]?.content?.parts || [];
    const text = parts.map((p) => p.text || "").join("").trim();
    return { isError: false, text: text || "(empty response from Gemini)" };
  } catch (e) {
    return { isError: true, text: `Gemini request failed: ${e.message}` };
  }
}

async function dispatch(msg) {
  const { id, method, params } = msg;
  if (method === "initialize") {
    return {
      jsonrpc: "2.0",
      id,
      result: {
        protocolVersion: (params && params.protocolVersion) || "2025-06-18",
        capabilities: { tools: {} },
        serverInfo: { name: "gemini-remote", version: "1.0.0" },
      },
    };
  }
  if (method === "tools/list") return { jsonrpc: "2.0", id, result: { tools: TOOLS } };
  if (method === "ping") return { jsonrpc: "2.0", id, result: {} };
  if (method === "tools/call") {
    const name = params && params.name;
    if (name !== "ask_gemini") {
      return { jsonrpc: "2.0", id, error: { code: -32602, message: `Unknown tool: ${name}` } };
    }
    const out = await askGemini((params && params.arguments) || {});
    return {
      jsonrpc: "2.0",
      id,
      result: { content: [{ type: "text", text: out.text }], isError: out.isError },
    };
  }
  // Notifications (no id) need no response.
  if (id === undefined) return null;
  return { jsonrpc: "2.0", id, error: { code: -32601, message: `Method not found: ${method}` } };
}

function unauthorized(req) {
  if (!AUTH_TOKEN) return false;
  const h = req.headers["authorization"] || "";
  return h !== `Bearer ${AUTH_TOKEN}`;
}

const server = http.createServer((req, res) => {
  if (req.method === "GET") {
    // Health check / SSE not implemented — request/response only.
    res.writeHead(200, { "content-type": "text/plain" });
    res.end("gemini-remote MCP server: POST JSON-RPC to this endpoint.\n");
    return;
  }
  if (req.method !== "POST") {
    res.writeHead(405).end();
    return;
  }
  if (unauthorized(req)) {
    res.writeHead(401, { "content-type": "application/json" });
    res.end(JSON.stringify({ jsonrpc: "2.0", id: null, error: { code: -32001, message: "Unauthorized" } }));
    return;
  }
  let raw = "";
  req.on("data", (c) => {
    raw += c;
    if (raw.length > 5 * 1024 * 1024) req.destroy(); // 5MB guard
  });
  req.on("end", async () => {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      res.writeHead(400, { "content-type": "application/json" });
      res.end(JSON.stringify({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }));
      return;
    }
    // Support a single message or a batch array.
    if (Array.isArray(msg)) {
      const out = (await Promise.all(msg.map(dispatch))).filter(Boolean);
      res.writeHead(out.length ? 200 : 202, { "content-type": "application/json" });
      res.end(out.length ? JSON.stringify(out) : "");
      return;
    }
    const result = await dispatch(msg);
    if (!result) {
      res.writeHead(202).end(); // notification
      return;
    }
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify(result));
  });
});

server.listen(PORT, () => {
  process.stderr.write(`gemini-remote MCP listening on :${PORT}\n`);
});
