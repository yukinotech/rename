import { createParser } from 'eventsource-parser';

export interface ParsedChunk {
  text: string;
  done?: boolean;
  event?: string;
  raw?: unknown;
}

export function parseOpenAIChunk(data: string): ParsedChunk | null {
  if (!data) {
    return null;
  }

  if (data.trim() === '[DONE]') {
    return { text: '', done: true, event: 'done' };
  }

  const json = JSON.parse(data);
  const delta = json?.choices?.[0]?.delta;
  const text = typeof delta?.content === 'string' ? delta.content : Array.isArray(delta?.content)
    ? delta.content.map((part: { text?: string }) => part?.text ?? '').join('')
    : '';

  return {
    text,
    raw: json
  };
}

export function parseOllamaLine(line: string): ParsedChunk | null {
  if (!line) {
    return null;
  }

  const json = JSON.parse(line);
  return {
    text: json?.response ?? '',
    done: Boolean(json?.done),
    raw: json
  };
}

export async function* streamFromOpenAI(
  prompt: string,
  apiKey: string,
  model: string,
  signal?: AbortSignal
): AsyncGenerator<ParsedChunk> {
  const queue: ParsedChunk[] = [];
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      stream: true,
      messages: [{ role: 'user', content: prompt }]
    }),
    signal
  });

  if (!response.ok || !response.body) {
    const message = await response.text().catch(() => response.statusText);
    throw new Error(`OpenAI request failed: ${response.status} ${message}`);
  }

  const parser = createParser((event) => {
    if (event.type !== 'event') return;
    const parsed = parseOpenAIChunk(event.data);
    if (parsed) {
      queue.push(parsed);
    }
  });

  const decoder = new TextDecoder();

  for await (const chunk of response.body as unknown as AsyncIterable<Uint8Array>) {
    const text = decoder.decode(chunk, { stream: true });
    parser.feed(text);

    while (queue.length) {
      yield queue.shift()!;
    }
  }
}

export async function* streamFromOllama(
  prompt: string,
  base: string,
  model: string,
  signal?: AbortSignal
): AsyncGenerator<ParsedChunk> {
  const response = await fetch(new URL('/api/generate', base).toString(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, prompt, stream: true }),
    signal
  });

  if (!response.ok || !response.body) {
    const message = await response.text().catch(() => response.statusText);
    throw new Error(`Ollama request failed: ${response.status} ${message}`);
  }

  const decoder = new TextDecoder();
  let buffer = '';

  for await (const chunk of response.body as unknown as AsyncIterable<Uint8Array>) {
    buffer += decoder.decode(chunk, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const parsed = parseOllamaLine(trimmed);
      if (parsed) {
        yield parsed;
        if (parsed.done) {
          return;
        }
      }
    }
  }

  // Flush remainder
  const parsed = parseOllamaLine(buffer.trim());
  if (parsed) {
    yield parsed;
  }
}
