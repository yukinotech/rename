import { app, BrowserWindow, ipcMain } from "electron";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import "dotenv/config";

import { runAgentStream, type AgentRuntimeOptions } from "../agent";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const taskControllers = new Map<string, AbortController>();

function getDefaults() {
  return {
    openAIApiKey: process.env.OPENAI_API_KEY,
    defaultOpenAIModel: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
    defaultOllamaModel: process.env.OLLAMA_MODEL ?? "qwen3:8b.1",
    defaultOllamaBase: process.env.OLLAMA_BASE ?? "http://127.0.0.1:11434",
  } satisfies AgentRuntimeOptions;
}

async function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      preload: join(__dirname, "../preload/index.cjs"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    await mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    await mainWindow.loadFile(join(__dirname, "../renderer/index.html"));
  }
}

app.whenReady().then(() => {
  createWindow().catch(console.error);

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow().catch(console.error);
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

ipcMain.handle(
  "agent:run",
  async (event, args: { input: string; opts?: AgentRuntimeOptions }) => {
    const senderWindow = BrowserWindow.fromWebContents(event.sender);
    if (!senderWindow) {
      throw new Error("No renderer available");
    }

    const input = args?.input ?? "";
    const opts = args?.opts ?? {};
    const taskId = randomUUID();
    const controller = new AbortController();
    taskControllers.set(taskId, controller);

    const mergedOptions: AgentRuntimeOptions = {
      ...getDefaults(),
      ...opts,
    };

    const send = (chunk: string | Record<string, unknown>) => {
      const isObject = typeof chunk === "object" && chunk !== null;
      const payloadChunk = isObject
        ? typeof (chunk as Record<string, unknown>).text === "string"
          ? ((chunk as Record<string, unknown>).text as string)
          : JSON.stringify(chunk)
        : (chunk as string);
      const eventName =
        isObject && typeof (chunk as Record<string, unknown>).event === "string"
          ? ((chunk as Record<string, unknown>).event as string)
          : undefined;
      const doneFlag =
        isObject && "done" in (chunk as Record<string, unknown>)
          ? Boolean((chunk as Record<string, unknown>).done)
          : undefined;

      senderWindow.webContents.send("agent:stream", {
        taskId,
        chunk: payloadChunk,
        event: eventName,
        done: doneFlag,
      });
    };

    (async () => {
      try {
        await runAgentStream(input, mergedOptions, send, controller.signal);
        senderWindow.webContents.send("agent:stream", {
          taskId,
          chunk: "",
          done: true,
          event: "end",
        });
      } catch (error) {
        senderWindow.webContents.send("agent:stream", {
          taskId,
          chunk: {
            message: error instanceof Error ? error.message : String(error),
          },
          done: true,
          event: "error",
        });
      } finally {
        taskControllers.delete(taskId);
      }
    })();

    return { taskId };
  }
);

ipcMain.handle("agent:cancel", async (_event, args: { taskId: string }) => {
  const taskId = args?.taskId;
  const controller = taskControllers.get(taskId);
  if (controller) {
    controller.abort();
    taskControllers.delete(taskId);
    return { ok: true };
  }
  return { ok: false };
});
