import ollama from "ollama";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const mcp = new Client({ name: "my-chat-app", version: "1.0.0" });

await mcp.connect(
  new StdioClientTransport({
    command: "node",
    args: ["mcp-server.js"],
  }),
);

// disover tools and convert them into model's tool format

const { tools: mcpTools } = await mcp.listTools();

const tools = mcpTools.map((t) => ({
  type: "function",
  function: {
    name: t.name,
    description: t.description,
    parameters: t.inputSchema,
  },
}));

const messages = [
  {
    role: "user",
    content: process.argv[2],
  },
];

for (let step = 0; step < 5; step++) {
  const res = await ollama.chat({ model: "llama3.2", messages, tools });
  messages.push(res.message);
  if (!res.message.tool_calls?.length) {
    console.log("ANSWER:", res.message.content);
    break;
  }
  for (const call of res.message.tool_calls) {
    const result = await mcp.callTool({
      name: call.function.name,
      arguments: call.function.arguments,
    });
    messages.push({
      role: "tool",
      content: result.content.map((c) => c.text).join("\n"),
    });
  }
}

await mcp.close();
