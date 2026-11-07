import { useEffect, useRef, useState } from "react";
import "./App.css";
import { onAuthStateChanged } from "firebase/auth";
import { auth, login, logout, authHeaders } from "./firebase";

const API = import.meta.env.VITE_API_URL;

function getUserId() {
  let id = localStorage.getItem("userId");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("userId", id);
  }
  return id;
}
const MCP_ON = import.meta.env.VITE_MCP_ENABLED === "true";

function App() {
  // Track the signed-in user, and load files once they're known:
  const [user, setUser] = useState(undefined); // undefined = still checking
  const [files, setFiles] = useState([]);
  const [status, setStatus] = useState("");
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const stopRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [mcpKey, setMcpKey] = useState("");

  useEffect(
    () =>
      onAuthStateChanged(auth, (u) => {
        setUser(u);

        setFiles([]);
        setMessages([]);
        setInput([]);
        setBusy(false);
        setStatus("");

        if (u) loadFiles();
      }),
    [],
  );

  async function createMcpKey() {
    try {
      const res = await fetch(`${API}/api/mcp-key`, {
        method: "POST",
        headers: await authHeaders(),
      });
      setMcpKey((await res.json()).key);
    } catch (error) {}
  }

  async function loadFiles() {
    try {
      const res = await fetch(`${API}/api/files`, {
        headers: await authHeaders(),
      });
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
    try {
      setStatus("Uploading and indexing...");
      const res = await fetch(`${API}/api/upload`, {
        method: "POST",
        headers: await authHeaders(),
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
    } catch (error) {
      setStatus(error.message);
    }
  }

  async function deleteAll() {
    await fetch(`${API}/api/files`, {
      method: "DELETE",
      headers: await authHeaders(),
    });
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
        headers: {
          ...(await authHeaders()),
          "Content-Type": "application/json",
        },
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

  if (user === undefined)
    return (
      <div className="auth">
        <p className="loading">Loading...</p>
      </div>
    );
  if (!user)
    return (
      <div className="auth">
        <div className="card auth-card">
          <h1>Ask My Notes</h1>
          <p>Upload your notes and chat with them.</p>
          <button className="btn" onClick={login}>
            Sign in with Google
          </button>
        </div>
      </div>
    );
  return (
    <div className="app">
      <header className="header">
        <h2>Ask My Notes</h2>
        <div className="user">
          <span className="user-email">Signed in as {user.email}</span>
          <button className="btn-secondary" onClick={logout}>
            Sign out
          </button>
          {MCP_ON && user && (
            <button className="btn-secondary" onClick={createMcpKey}>
              Get MCP key
            </button>
          )}
          {mcpKey && (
            <p>
              Your MCP key, copy it now (it is shown only once):{" "}
              <code>{mcpKey}</code>
            </p>
          )}
        </div>
      </header>
      <section className="card">
        <h3 className="card-title">Your notes</h3>
        <input
          className="file"
          type="file"
          multiple
          accept=".txt,.md,.docx"
          onChange={onUpload}
        />
        <p className="hint">
          ⓘ Up to 5 files at a time · max 10 MB each · .txt, .md, .docx
        </p>
        <p className="status">{status}</p>
        <ul className="file-list">
          {files?.map((f) => (
            <li key={f.file}>
              {f.file} <span>{f.chunks} chunks</span>
            </li>
          ))}
        </ul>
        {files?.length > 0 && (
          <button className="btn-danger" onClick={deleteAll}>
            Delete all my notes
          </button>
        )}
      </section>

      <section className="chat">
        <div className="messages">
          {messages?.map((m, i) => (
            <p key={i} className={`msg ${m.role}`}>
              <b>{m.role === "user" ? "You" : "Assistant"}</b>
              {m.content}
            </p>
          ))}
        </div>
        {loading && <div className="loading">Loading...</div>}
        <div className="composer">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder={
              files?.length ? "Ask about your notes..." : "Upload a note first"
            }
            rows="5"
          />
          <div className="actions">
            {busy && (
              <button
                className="btn-secondary"
                onClick={() => stopRef.current?.abort()}
              >
                Stop
              </button>
            )}
            <button className="btn" onClick={send} disabled={busy}>
              Send
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

export default App;
