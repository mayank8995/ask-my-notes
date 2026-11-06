import "dotenv/config";
import { GoogleGenAI } from "@google/genai";
import Groq from "groq-sdk";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export async function embed(texts, taskType = "RETRIEVAL_DOCUMENT") {
  const res = await ai.models.embedContent({
    model: "gemini-embedding-001",
    contents: texts,
    config: { outputDimensionality: 768, taskType },
  });
  return res.embeddings.map((e) => e.values);
}

export async function* geminiChatStream(system, messages) {
  //   const stream = await ai.models.generateContentStream({
  //     model: process.env.GEMINI_MODEL || "gemini-3.8-flash",
  //     contents: messages.map((m) => ({
  //       role: m.role === "assistant" ? "model" : "user",
  //       // gemini calling the assistant model
  //       parts: [{ text: m.content }],
  //     })),
  //     config: { systemInstruction: system },
  //   });

  //   for await (const chunk of stream) {
  //     if (chunk.text) yield chunk.text;
  //   }
  const stream = await ai.models.generateContentStream({
    model: process.env.GEMINI_MODEL || "gemini-3.8-flash",
    contents: messages.map((m) => ({
      role: m.role === "assistant" ? "model" : "user", // Gemini calls the assistant "model"
      parts: [{ text: m.content }],
    })),
    config: { systemInstruction: system },
  });
  for await (const chunk of stream) {
    if (chunk.text) yield chunk.text;
  }
}

async function* groqChatStream(system, messages) {
  const stream = await groq.chat.completions.create({
    model: process.env.GROQ_INHERENT_MODEL || "llama-3.1-8b-instant", // check console.groq.com/docs/models for current names
    messages: [{ role: "system", content: system }, ...messages], // same OpenAI-style roles you already use
    stream: true,
  });
  for await (const chunk of stream) {
    const text = chunk.choices[0]?.delta?.content;
    if (text) yield text;
  }
}

export const chatStream =
  process.env.CHAT_PROVIDER === "groq" ? groqChatStream : geminiChatStream;
