export {}; // ensures this file is treated as a module

declare global {
  interface AgentRunOptions {
    provider?: 'openai' | 'ollama';
    model?: string;
    base?: string;
  }

  interface AgentStreamChunk {
    taskId: string;
    chunk: string | Record<string, unknown>;
    done?: boolean;
    event?: string;
  }

  interface Window {
    agent: {
      run(input: string, opts?: AgentRunOptions): Promise<{ taskId: string }>;
      cancel(taskId: string): Promise<{ ok: boolean }>;
      onStream(callback: (payload: AgentStreamChunk) => void): () => void;
    };
  }
}
