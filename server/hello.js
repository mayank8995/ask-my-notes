import ollama from "ollama";

const res = await ollama.chat({
  model: "llama3.2:1b",
  messages: [
    {
      role: "system",
      content: "You are a senior react mentor!",
    },
    {
      role: "user",
      content: "Explain useMemo in 2 lines!",
    },
  ],
  options: { temperature: 1.2 },
});
console.log(res.message.content);
