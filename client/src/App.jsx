import { useEffect, useRef, useState } from "react";
import "./App.css";

const API = import.meta.env.VITE_API_URL;

function getUserId() {
  let id = localStorage.getItem("userId");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("userId", id);
  }
  return id;
}

function App() {
  const [files, setFiles] = useState([]);
  const [status, setStatus] = useState("");
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const stopRef = useRef(null);
  const headers = { "x-user-id": getUserId() };
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadFiles();
  }, []);

  async function loadFiles() {
    try {
      const res = await fetch(`${API}/api/files`, { headers });
      if (!res.ok) {
        throw new Error(`${response.status}`);
      }
      const data = await res.json();
      setFiles(data);
    } catch (error) {}
  }

  async function onUpload(e) {
    const form = new FormData();
    for (const f of e?.target?.files) {
      form.append("files", f);
    }
    setStatus("Uploading and indexing...");
    const res = await fetch(`${API}/api/upload`, {
      method: "POST",
      headers,
      body: form,
    });
    const data = await res.json();
    setStatus(
      res.ok
        ? `Added: ${data.summary.map((s) => `${s.file} (${s.chunks} chunks)`).join(", ")}`
        : data.error,
    );
    e.target.value = "";
    loadFiles();
  }

  async function deleteAll() {
    await fetch(`${API}/api/files`, { method: "DELETE", headers });
    setStatus("All notes deleted");
    loadFiles();
  }

  async function send() {
    if (!input.trim() || busy) return;
    const history = [...messages, { role: "user", content: input }];
    setMessages([...history, { role: "assistant", content: "" }]);
    setInput("");
    setBusy(true);
    const controller = new AbortController();
    stopRef.current = controller;
    let answer = "";
    try {
      setLoading(true);
      const res = await fetch(`${API}/api/chat`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history }),
        signal: controller.signal,
      });
      if (!res.ok) throw new Error((await res.json()).error);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        answer += decoder.decode(value, { stream: true });
        setMessages([...history, { role: "assistant", content: answer }]);
      }
    } catch (err) {
      if (err.name !== "AbortError") {
        setMessages([
          ...history,
          { role: "assistant", content: `Error: ${err.message}` },
        ]);
      }
    } finally {
      setBusy(false);
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        maxWidth: 720,
        margin: "32px auto",
        padding: 16,
        fontFamily: "sans-serif",
      }}
    >
      <h2>Ask My Notes</h2>

      <section
        style={{ border: "1px solid #ccc", borderRadius: 8, padding: 12 }}
      >
        <input
          type="file"
          multiple
          accept=".txt,.md,.docx"
          onChange={onUpload}
        />
        <p>{status}</p>
        <ul>
          {files?.map((f) => (
            <li key={f.file}>
              {f.file} ({f.chunks} chunks)
            </li>
          ))}
        </ul>
        {files?.length > 0 && (
          <button onClick={deleteAll}>Delete all my notes</button>
        )}
      </section>

      <section style={{ marginTop: 16 }}>
        {messages?.map((m, i) => (
          <p key={i} style={{ whiteSpace: "pre-wrap" }}>
            <b>{m.role === "user" ? "You" : "Assistant"}:</b> {m.content}
          </p>
        ))}
        <>
          {loading && "Loading..."}
          <br />
        </>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder={
            files?.length ? "Ask about your notes..." : "Upload a note first"
          }
          style={{ width: "70%" }}
          rows="10"
          cols="60"
        />
        <br />
        <button onClick={send} disabled={busy}>
          Send
        </button>
        {busy && <button onClick={() => stopRef.current?.abort()}>Stop</button>}
      </section>
    </div>
  );
}

export default App;
