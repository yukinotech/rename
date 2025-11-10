# Electron Agent Client

Minimal-yet-production-ready Electron + React desktop shell that streams tokens from local (Ollama) or cloud (OpenAI) LLM backends via a secure IPC bridge. Built with electron-vite + TypeScript and ready for LangChain / LangGraph integration.

## Prerequisites
- Node.js 18+
- pnpm (recommended) or npm
- Electron runtime downloaded automatically
- Optional: [Ollama](https://ollama.com/) running locally for the Ollama provider

## Environment
Create `.env` based on `.env.example`:
```
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini
OLLAMA_BASE=http://127.0.0.1:11434
OLLAMA_MODEL=qwen3:8b
```
OpenAI keys are loaded only inside the Electron main process.

## Scripts
```
pnpm install         # install deps
pnpm dev             # run electron-vite dev server with HMR
pnpm build           # production build (main, preload, renderer)
pnpm lint            # ESLint (flat config)
pnpm typecheck       # strict TypeScript validation
```

## Architecture
```
+--------------------------+        +------------------+        +-----------------------+
| React Renderer (Vite)    |<--IPC--| Preload Bridge   |<--IPC--| Electron Main Process |
| - Prompt UI              |        | - contextBridge   |        | - Task map + Aborters |
| - Stream display         |        | - Secure API      |        | - Env + agent runtime |
+--------------------------+        +------------------+        +-----------+-----------+
                                                                               |
                                                                               v
                                                             +-------------------------+
                                                             | Agent Runtime Modules   |
                                                             | - Chains / Graph hooks  |
                                                             | - LLM streaming (HTTP)  |
                                                             +-------------------------+
```
Token streams travel Ollama/OpenAI → agent runtime → main process → renderer via `agent:stream`, with cancelation handled by `AbortController` per `taskId`.

## IPC Contract
- `agent:run` (invoke) → `{ taskId }`
- `agent:cancel` (invoke) → `{ ok }`
- `agent:stream` (send) → `{ taskId, chunk, done?, event? }`

Preload exposes:
```ts
window.agent.run(input, opts)
window.agent.cancel(taskId)
window.agent.onStream(cb)
```

## Agent Runtime Extension Points
- `src/agent/chains.ts`: preprocess prompts via LangChain chains, tools, or memory.
- `src/agent/graph.ts`: orchestrate LangGraph workflows and emit intermediate node events.
- `src/agent/llm.ts`: shared streaming helpers for OpenAI SSE and Ollama JSONL responses.

## Security Checklist
- `contextIsolation: true`, `nodeIntegration: false`.
- Only a narrow `window.agent` API is exposed; no raw `ipcRenderer` access.
- Secrets live in the main process via `dotenv`; renderer never sees API keys.
- Renderer enforces a CSP in `index.html` and uses React for UI logic.
- IPC payloads include `taskId` to guard against stale stream updates.

## Switching Providers / Models
Use the UI dropdown or pass overrides when calling `window.agent.run`. Defaults come from `.env`:
- Ollama: `OLLAMA_BASE`, `OLLAMA_MODEL`
- OpenAI: `OPENAI_MODEL`, `OPENAI_API_KEY`

## Build Output
`pnpm build` produces production bundles under `dist/{main,preload,renderer}` ready for packaging via your preferred Electron builder.
