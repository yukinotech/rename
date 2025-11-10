import { useEffect, useMemo, useRef, useState } from "react";

const DEFAULT_OPENAI_MODEL = "gpt-4o-mini";
const DEFAULT_OLLAMA_MODEL = "qwen3:8b.1";
const DEFAULT_OLLAMA_BASE = "http://127.0.0.1:11434";

type Provider = "openai" | "ollama";

function parseChunk(
  chunk: string | Record<string, unknown> | undefined
): string {
  if (!chunk) return "";
  if (typeof chunk === "string") return chunk;
  if (typeof chunk.text === "string") return chunk.text;
  if (typeof chunk.message === "string") return chunk.message;
  return JSON.stringify(chunk);
}

export default function App() {
  const [prompt, setPrompt] = useState("Ask me anything...");
  const [provider, setProvider] = useState<Provider>("ollama");
  const [model, setModel] = useState(DEFAULT_OLLAMA_MODEL);
  const [base, setBase] = useState(DEFAULT_OLLAMA_BASE);
  const [output, setOutput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [status, setStatus] = useState<"idle" | "running" | "error" | "done">(
    "idle"
  );
  const taskRef = useRef<string | null>(null);
  const outputRef = useRef<HTMLPreElement>(null);

  useEffect(() => {
    const unsubscribe = window?.agent?.onStream?.((payload) => {
      if (taskRef.current && payload.taskId !== taskRef.current) return;
      const text = parseChunk(payload.chunk);
      if (text) {
        setOutput((prev) => prev + text);
      }
      if (payload.event === "error") {
        setStatus("error");
      }
      if (payload.done) {
        setIsStreaming(false);
        setStatus(payload.event === "error" ? "error" : "done");
        taskRef.current = null;
      }
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!isStreaming && taskRef.current) {
      taskRef.current = null;
    }
  }, [isStreaming]);

  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [output]);

  const currentModelPlaceholder = useMemo(
    () => (provider === "openai" ? DEFAULT_OPENAI_MODEL : DEFAULT_OLLAMA_MODEL),
    [provider]
  );

  const run = async () => {
    if (!prompt.trim()) return;
    setOutput("");
    setIsStreaming(true);
    setStatus("running");
    try {
      const response = await window.agent.run(prompt, {
        provider,
        model,
        base: provider === "ollama" ? base : undefined,
      });
      taskRef.current = response.taskId;
    } catch (error) {
      setStatus("error");
      setIsStreaming(false);
      setOutput(String(error));
    }
  };

  const cancel = async () => {
    if (!taskRef.current) return;
    await window.agent.cancel(taskRef.current);
    setIsStreaming(false);
    setStatus("idle");
  };

  const handleProviderChange = (value: Provider) => {
    setProvider(value);
    if (value === "openai") {
      setModel((prev) =>
        prev === DEFAULT_OLLAMA_MODEL ? DEFAULT_OPENAI_MODEL : prev
      );
    } else {
      setModel((prev) =>
        prev === DEFAULT_OPENAI_MODEL ? DEFAULT_OLLAMA_MODEL : prev
      );
    }
  };

  return (
    <div className="app-shell">
      <h1>Desktop Agent Client</h1>
      <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} />
      <div className="controls">
        <label>
          Provider
          <select
            value={provider}
            onChange={(e) => handleProviderChange(e.target.value as Provider)}
          >
            <option value="ollama">Ollama (local)</option>
            <option value="openai">OpenAI</option>
          </select>
        </label>
        <label>
          Model
          <input
            value={model}
            placeholder={currentModelPlaceholder}
            onChange={(e) => setModel(e.target.value)}
          />
        </label>
        {provider === "ollama" && (
          <label>
            Base URL
            <input
              value={base}
              placeholder={DEFAULT_OLLAMA_BASE}
              onChange={(e) => setBase(e.target.value)}
            />
          </label>
        )}
        <div className="controls">
          <button onClick={run} disabled={isStreaming}>
            Run
          </button>
          <button onClick={cancel} disabled={!isStreaming}>
            Cancel
          </button>
        </div>
      </div>
      <div>Status: {status}</div>
      <pre className="output" ref={outputRef}>
        {output || "Awaiting output..."}
      </pre>
    </div>
  );
}
