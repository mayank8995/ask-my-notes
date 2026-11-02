import { useState } from "react";
import "./App.css";
import { useRef } from "react";

function App() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const stopRef = useRef(null);
  async function send() {
    const controller = new AbortController();
    stopRef.current = controller;
    const history = [...messages, { role: "user", content: input }];
    setMessages([...history, { role: "assistant", content: "" }]);
    setInput("");

    const res = await fetch("http://localhost:3001/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: history }),
      signal: controller.signal,
    });
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let answer = "";
    try {
      while (true) {
        if (stopRef.current.aborted) {
          break;
        }
        const { done, value } = await reader.read();
        if (done || stopRef.current.aborted) break;
        answer += decoder.decode(value, { stream: true });
        setMessages([...history, { role: "assistant", content: answer }]);
      }
    } catch (error) {}
  }

  return (
    <>
      <button
        onClick={() => {
          if (stopRef.current) {
            console.log("DSSSSSSSSSSSSSSSSSSSSSSSSSSS");
            stopRef.current.abort();
          }
        }}
      >
        Stop
      </button>

      <div
        style={{ maxWidth: 640, margin: "40px auto", fontFamily: "sans-serif" }}
      >
        {messages.map((m, i) => (
          <p key={i}>
            <b>{m.role}:</b> {m.content}
          </p>
        ))}
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          style={{ width: "80%" }}
        />
        <button onClick={send}>Send</button>
      </div>
    </>
  );
}

export default App;
