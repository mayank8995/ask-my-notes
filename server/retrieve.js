import { embed } from "./llm.js";
import { chunks } from "./db.js";
async function retrieve(userId, question, k = 6) {
  const [q] = await embed([question], "RETRIEVAL_QUERY");
  return chunks
    .aggregate([
      {
        $vectorSearch: {
          index: "vector_index",
          path: "embedding",
          queryVector: q,
          numCandidates: 100,
          limit: k,
          filter: { userId: { $eq: userId } }, // only this user's chunks
        },
      },
      {
        $project: {
          _id: 0,
          source: 1,
          text: 1,
          score: { $meta: "vectorSearchScore" },
        },
      },
    ])
    .toArray();
}

export default retrieve;
