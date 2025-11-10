import { streamFromOllama, streamFromOpenAI, type ParsedChunk } from './llm';
import { preprocessWithChains } from './chains';
import { executeGraph } from './graph';

export interface AgentRuntimeOptions {
  provider?: 'openai' | 'ollama';
  model?: string;
  base?: string;
  openAIApiKey?: string;
  defaultOpenAIModel?: string;
  defaultOllamaModel?: string;
  defaultOllamaBase?: string;
}

type EventSender = (chunk: string | Record<string, unknown>) => void;

export async function runAgentStream(
  input: string,
  options: AgentRuntimeOptions,
  onEvent: EventSender,
  signal: AbortSignal
): Promise<void> {
  if (!input?.trim()) {
    throw new Error('Input prompt is required');
  }

  if (signal.aborted) {
    throw new DOMException('Task aborted before start', 'AbortError');
  }

  // TODO: preprocess via LangChain chains (see chains.ts)
  const prepared = await preprocessWithChains(input);

  // TODO: execute LangGraph graph (see graph.ts) and stream node events
  await executeGraph({ input: prepared, emit: onEvent });

  const provider = options.provider ?? 'ollama';

  if (provider === 'openai') {
    const apiKey = options.openAIApiKey;
    if (!apiKey) throw new Error('OPENAI_API_KEY is not set.');
    const model = options.model ?? options.defaultOpenAIModel ?? 'gpt-4o-mini';
    for await (const chunk of streamFromOpenAI(prepared, apiKey, model, signal)) {
      forwardChunk(chunk, onEvent);
      if (chunk.done) break;
    }
    return;
  }

  const base = options.base ?? options.defaultOllamaBase ?? 'http://127.0.0.1:11434';
  const model = options.model ?? options.defaultOllamaModel ?? 'llama3.1';
  for await (const chunk of streamFromOllama(prepared, base, model, signal)) {
    forwardChunk(chunk, onEvent);
    if (chunk.done) break;
  }
}

function forwardChunk(chunk: ParsedChunk, onEvent: EventSender) {
  const payload: Record<string, unknown> = {
    text: chunk.text
  };

  if (chunk.event) {
    payload.event = chunk.event;
  }

  if (chunk.done) {
    payload.done = true;
  }

  if (chunk.raw) {
    payload.raw = chunk.raw;
  }

  onEvent(payload);
}
