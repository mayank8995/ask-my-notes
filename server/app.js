import express from "express";
import ollama from "ollama";
import cors from "cors";
import { retrieve } from "./rag.js";

const app = express();
app.use(cors());
app.use(express.json());

app.post("/api/chat", async (req, res) => {
  const { messages } = req.body;
  const question = messages.at(-1).content;
  console.log("question>>", question);
  const hits = await retrieve(question);
  console.log("hits>>>>>", hits);
  const context = hits.map((h) => `[${h.source}] ${h.text}`).join("\n---\n");
  const system = {
    role: "system",
    content: `Answer ONLY from the context below. If it is not there, say "I don't know". Cite the [source].\n\nContext:\n${context}`,
  };
  // const stream = await ollama.chat({ model: 'llama3.2', messages: [system, ...messages], stream: true });
  const stream = await ollama.chat({
    model: "llama3.2:1b",
    messages: [system, ...messages],
    stream: true,
    options: { temperature: 0.2 },
  });
  for await (let chunk of stream) {
    res.write(chunk.message.content);
  }
  res.end();
});

app.listen(3001, () => {
  console.log("API on http://localhost:3001");
});
