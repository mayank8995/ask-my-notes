import ollama from "ollama";
import { retrieve } from "./old__rag.js";

// function to be called tthorugh tool calling
const functions = {
  searchNotes: async ({ query }) =>
    (await retrieve(query)).map((h) => h.text).join(`\n---\n`),
  getTime: async () => new Date().toString(),
};

// functions description

const tools = [
  {
    type: "function",
    function: {
      name: "searchNotes",
      description: "Search the user's personal notes",
      parameters: {
        type: "object",
        properties: { query: { type: "string" } },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "getTime",
      description: "Get the current date and time",
      parameters: { type: "object", properties: {} },
    },
  },
];

const messages = [{ role: "user", content: process.argv[2] }];

for (let step = 0; step < 5; step++) {
  // hard cap so it can never loop forever
  const res = await ollama.chat({ model: "llama3.2:1b", messages, tools });
  messages.push(res.message);
  if (!res.message.tool_calls?.length) {
    // console.log("\nANSWER:", res.message.content);
    break;
  }

  for (const call of res.message.tool_calls) {
    const { name, arguments: args } = call.function;
    // console.log("MODEL WANTS:", name, args);
    const result = await functions[name](args);
    messages.push({ role: "tool", content: String(result) });
  }
}
