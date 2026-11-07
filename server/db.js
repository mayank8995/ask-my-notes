import "dotenv/config";
import { MongoClient } from "mongodb";

const client = new MongoClient(process.env.MONGODB_URI);
await client.connect();
export const chunks = client.db("askmynotes").collection("chunks");
export const mcpKeys = client.db("askmynotes").collection("mcp_keys"); // { userId, keyHash, createdAt }
