# Electron Agent Client（中文说明）

一个基于 Electron + React + TypeScript 的桌面 Agent 客户端脚手架，内置安全 IPC、流式 LLM（Ollama / OpenAI）支持，并预留 LangChain / LangGraph 扩展接口。

## 目录结构

```
.
├── electron.vite.config.ts   # electron-vite 配置（主进程 / 预加载 / 渲染）
├── src
│   ├── main                  # Electron 主进程代码
│   │   └── index.ts          # 创建窗口、IPC、任务调度
│   ├── preload               # 预加载脚本，暴露 window.agent API
│   │   └── index.ts
│   ├── renderer              # React 前端（Vite）
│   │   ├── App.tsx           # UI：提示输入、流式输出、provider 切换
│   │   ├── main.tsx          # React 入口
│   │   ├── index.html        # 渲染器模板 + CSP
│   │   └── styles.css        # 简单样式
│   └── agent                 # Agent 运行时模块
│       ├── index.ts          # runAgentStream，管理 provider/流转
│       ├── llm.ts            # OpenAI SSE & Ollama JSONL 流式实现
│       ├── chains.ts         # LangChain 预处理占位
│       └── graph.ts          # LangGraph 事件占位
├── types/global.d.ts         # window.agent 类型声明
├── README.md                 # 英文说明
├── README.zh-CN.md           # 中文说明（本文）
├── .env.example              # 环境变量模板
├── package.json              # 脚本 & 依赖声明
├── tsconfig*.json            # TS 配置
└── eslint.config.js          # ESLint (Flat Config)
```

## 模块拆分逻辑

- **主进程 (`src/main`)**：加载 `.env`，维护 `taskId -> AbortController` 映射，处理 `agent:run / agent:cancel` IPC，串流事件到渲染进程。
- **预加载 (`src/preload`)**：在 `contextIsolation: true` 下通过 `contextBridge` 暴露安全 API，统一订阅 `agent:stream`。
- **Agent 运行时 (`src/agent`)**：
  - `llm.ts`：封装 OpenAI SSE / Ollama JSONL 流式迭代器，支持 `AbortSignal`。
  - `index.ts`：选择 provider、调用 LLM 流、发送 chunk；预留 LangChain (`chains.ts`) 和 LangGraph (`graph.ts`) hooks。
- **渲染器 (`src/renderer`)**：React UI 负责输入、provider 配置、运行 / 取消控制，以及实时输出展示（自动滚动）。
- **配置 (`electron.vite.config.ts`、`tsconfig*.json`、`eslint.config.js`)**：统一打包、类型校验、Lint。

## 环境变量

在 `.env` 中配置：

```
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o-mini
OLLAMA_BASE=http://127.0.0.1:11434
OLLAMA_MODEL=qwen3:8b.1
```

> OpenAI Key 仅在主进程读取，渲染端无法直接访问。

## 常用脚本（pnpm）

```
pnpm install    # 安装依赖
pnpm dev        # electron-vite 热更新开发
pnpm build      # 生产构建（main / preload / renderer）
pnpm lint       # ESLint
pnpm typecheck  # TypeScript --noEmit
```

## 运行时数据流

```
Ollama / OpenAI HTTP Streaming
           ↓
    src/agent/llm.ts
           ↓ tokens
    runAgentStream (taskId + Abort)
           ↓ IPC (agent:stream)
     Electron Main → Preload → Renderer
```

- `agent:run`：返回 `taskId`
- `agent:cancel`：取消对应任务
- `agent:stream`：持续推送 `{ taskId, chunk, done?, event? }`

## 安全要点

1. `contextIsolation: true`、`nodeIntegration: false`，仅暴露受控 `window.agent`。
2. 主进程集中管理 API Key，并通过 `AbortController` 控制流式任务。
3. `index.html` 设置 CSP，阻止任意远程脚本。
4. Renderer 仅处理纯文本 chunk，避免将敏感数据写入 DOM。

## 扩展 LangChain / LangGraph

- 在 `chains.ts` 中构建预处理链（提示模板、工具、记忆等）。
- 在 `graph.ts` 中实现节点图，使用 `emit` 推送事件到前端。
- `runAgentStream` 预留 TODO：可在调用 LLM 前/后插入上述逻辑，实现多步骤 Agent 行为。

## 打包

`pnpm build` 会生成 `dist/{main,preload,renderer}`。可结合 electron-builder、forge 等工具继续封装安装包。
