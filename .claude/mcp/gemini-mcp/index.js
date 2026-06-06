#!/usr/bin/env node
/*
 * gemini-mcp — a tiny local MCP server that exposes Google Gemini to the
 * Claude desktop chat app, by shelling out to the local Antigravity CLI (`agy`)
 * authenticated with your Gemini Ultra account. Free under Ultra; no API key.
 *
 * Zero dependencies — Node stdlib only. Speaks MCP over stdio
 * (newline-delimited JSON-RPC 2.0). Configure it in claude_desktop_config.json
 * (see README.md).
 */
"use strict";

const { execFile } = require("node:child_process");
const readline = require("node:readline");

// Task → model mapping. `deep` is the accuracy-first default.
const MODES = {
  deep: { model: "Gemini 3.1 Pro (High)", extra: [] },
  quick: { model: "Gemini 3.5 Flash (Low)", extra: [] },
};

function askGemini({ prompt, mode }) {
  const cfg = MODES[mode] || MODES.deep;
  const args = ["--model", cfg.model, ...cfg.extra, "-p", String(prompt || "")];
  return new Promise((resolve) => {
    execFile(
      "agy",
      args,
      { timeout: 120000, maxBuffer: 10 * 1024 * 1024 },
      (err, stdout, stderr) => {
        if (err) {
          resolve({
            isError: true,
            text:
              `agy call failed: ${err.message}\nstderr: ${stderr || "(none)"}\n\n` +
              "If a flag is wrong, run `agy models` to see exact model names and " +
              "update MODES in index.js.",
          });
        } else {
          resolve({ isError: false, text: (stdout || "").trim() || "(empty response from Gemini)" });
        }
      }
    );
  });
}

const TOOLS = [
  {
    name: "ask_gemini",
    description:
      "Ask Google Gemini for an independent answer or second opinion, via the " +
      "local Antigravity CLI (Ultra account). mode='deep' uses Gemini 3.1 Pro " +
      "with deep thinking (default, for hard/high-stakes questions); mode='quick' " +
      "uses 3.5 Flash for fast sanity checks.",
    inputSchema: {
      type: "object",
      properties: {
        prompt: { type: "string", description: "The question or text to send to Gemini." },
        mode: {
          type: "string",
          enum: ["deep", "quick"],
          description: "deep = 3.1 Pro deep-thinking (default); quick = 3.5 Flash",
        },
      },
      required: ["prompt"],
    },
  },
];

function send(msg) {
  process.stdout.write(JSON.stringify(msg) + "\n");
}

async function handle(msg) {
  const { id, method, params } = msg;

  if (method === "initialize") {
    send({
      jsonrpc: "2.0",
      id,
      result: {
        protocolVersion: (params && params.protocolVersion) || "2025-06-18",
        capabilities: { tools: {} },
        serverInfo: { name: "gemini", version: "1.0.0" },
      },
    });
  } else if (method === "tools/list") {
    send({ jsonrpc: "2.0", id, result: { tools: TOOLS } });
  } else if (method === "tools/call") {
    const name = params && params.name;
    if (name !== "ask_gemini") {
      send({ jsonrpc: "2.0", id, error: { code: -32602, message: `Unknown tool: ${name}` } });
      return;
    }
    const out = await askGemini((params && params.arguments) || {});
    send({
      jsonrpc: "2.0",
      id,
      result: { content: [{ type: "text", text: out.text }], isError: out.isError },
    });
  } else if (method === "ping") {
    send({ jsonrpc: "2.0", id, result: {} });
  } else if (id !== undefined && method) {
    // Unknown *request* (has id) → method not found. Notifications (no id) are ignored.
    send({ jsonrpc: "2.0", id, error: { code: -32601, message: `Method not found: ${method}` } });
  }
}

const rl = readline.createInterface({ input: process.stdin });
rl.on("line", (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;
  let msg;
  try {
    msg = JSON.parse(trimmed);
  } catch {
    return; // ignore non-JSON noise
  }
  handle(msg).catch(() => {});
});
