import ollama from "ollama";
import { MongoClient } from "mongodb";

const col = new MongoClient("mongodb://localhost:27017")
  .db("askmynotes")
  .collection("chunks");

const cosine = (a, b) => {
  let dot = 0,
    na = 0,
    nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] ** 2;
    nb += b[i] ** 2;
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
};

export async function retrieve(question, k = 3) {
  // k closest
  const {
    embeddings: [q],
    /**
     * destructuring twice: take the embeddings field,
     * then take its first item and call it q
     */
  } = await ollama.embed({ model: "nomic-embed-text", input: question });
  const all = await col.find().toArray(); // fine for a few hundred chunks
  return all
    .map((d) => ({ ...d, score: cosine(q, d.embedding) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
}
