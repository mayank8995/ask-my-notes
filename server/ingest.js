import fs from "node:fs/promises";
import path from "node:path";
import ollama from "ollama";
import { MongoClient } from "mongodb";

const NOTES_DIR = "../../direc";
const client = new MongoClient("mongodb://localhost:27017");
const col = client.db("askmynotes").collection("chunks");

function chunk(text, size = 500, overlap = 100) {
  const out = [];
  for (let i = 0; i < text.length; i += size - overlap) {
    out.push(text.slice(i, i + size));
  }
  return out;
}

await col.deleteMany({});

for (const file of await fs.readdir(NOTES_DIR)) {
  const text = await fs.readFile(path.join(NOTES_DIR, file), "utf8");
  const pieces = chunk(text);
  const embeddings = [];
  for (let i = 0; i < pieces.length; i += 32) {
    const batch = pieces.slice(i, i + 32);
    const res = await ollama.embed({ model: "nomic-embed-text", input: batch });
    embeddings.push(...res.embeddings);
  }
  await col.insertMany(
    pieces.map((t, i) => ({ source: file, text: t, embedding: embeddings[i] })),
  );
}

await client.close();
