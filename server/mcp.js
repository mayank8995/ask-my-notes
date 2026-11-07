import crypto from "node:crypto";
import rateLimit from "express-rate-limit";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import { chunks, mcpKeys } from "./db.js";
import retrieve from "./retrieve.js";

// never store the key itself, only its hash (same idea as a password)
const hashKey = (key) => crypto.createHash("sha256").update(key).digest("hex");

// Turns "Authorization: Bearer amn_..." into req.userId
async function requireMcpKey(req, res, next) {
  const key = req.get("authorization")?.replace("Bearer ", "");
  const found = key && (await mcpKeys.findOne({ keyHash: hashKey(key) }));
  if (!found) return res.status(401).json({ error: "Invalid MCP key" });
  req.userId = found.userId;
  next();
}

// One small MCP server per request, locked to one user.
// userId comes from the key, never from the AI, so a tool call can't read someone else's notes.
function buildServer(userId) {
  const server = new McpServer({ name: "ask-my-notes", version: "1.0.0" });

  server.registerTool(
    "search_notes",
    {
      title: "Search my notes",
      description:
        "Search the user's uploaded notes. Returns the most relevant passages, each starting with its [file name].",
      inputSchema: {
        query: z
          .string()
          .min(1)
          .max(500)
          .describe("What to look for in the notes"),
      },
    },
    async ({ query }) => {
      const hits = await retrieve(userId, query);
      console.log(
        "MCP search_notes:",
        userId,
        query,
        hits.map((h) => h.score.toFixed(3)),
      );
      const text = hits.length
        ? hits.map((h) => `[${h.source}]\n${h.text}`).join("\n---\n")
        : "No matching notes found.";
      return { content: [{ type: "text", text }] };
    },
  );

  server.registerTool(
    "list_files",
    {
      title: "List my files",
      description: "List the names of the files the user has uploaded.",
      inputSchema: {},
    },
    async () => {
      const files = await chunks.distinct("source", { userId });
      return {
        content: [
          { type: "text", text: files.join("\n") || "No files uploaded yet." },
        ],
      };
    },
  );

  return server;
}

// Stateless Streamable HTTP: each POST is handled on its own, no session to remember.

async function handleMcp(req, res) {
  const server = buildServer(req.userId);
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // stateless
    enableJsonResponse: true,
  });
  res.on("close", () => {
    transport.close();
    server.close();
  });
  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (err) {
    console.error(err);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: { code: -32603, message: "Internal error" },
        id: null,
      });
    }
  }
}

export function mountMcp(app) {
  // Signed-in user creates (or replaces) their MCP key. It is shown once.
  // It sits under /api, so existing requireUser (Firebase) check runs first.
  console.log("inside mcp");
  app.post("/api/mcp-key", async (req, res) => {
    const key = "amn_" + crypto.randomBytes(24).toString("hex");
    await mcpKeys.updateOne(
      { userId: req.userId },
      { $set: { keyHash: hashKey(key), createdAt: new Date() } },
      { upsert: true },
    );
    res.json({ key });
  });
  // The MCP endpoint. Not under /api, so it uses the MCP key instead of the Firebase token.
  app.use("/mcp", rateLimit({ windowMs: 60_000, limit: 30 })); // its own limit, separate from /api
  app.post("/mcp", requireMcpKey, handleMcp);
  app.get("/mcp", (_req, res) => res.status(405).end()); // stateless: no server-to-client stream
  app.delete("/mcp", (_req, res) => res.status(405).end()); // stateless: no session to delete
}
