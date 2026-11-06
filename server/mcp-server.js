import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { retrieve } from "./old__rag.js";

const server = new McpServer({ name: "ask-my-notes", version: "1.0.0" });

server.registerTool(
  "searchNotes",
  {
    description:
      "Search the user's personal notes and return the most relevant passages",
    inputSchema: { query: z.string() },
  },
  async ({ query }) => {
    console.error("query>>>>mayank>>", query);
    const hits = await retrieve(query);
    const text = hits.map((h) => `[${h.source}] ${h.text}`).join(`\n---\n`);
    return { content: [{ type: "text", text }] };
  },
);

await server.connect(new StdioServerTransport());
console.error("ask-my-notes MCP server running");
