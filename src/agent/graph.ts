interface GraphContext {
  input: string;
  emit: (event: string | Record<string, unknown>) => void;
}

export async function executeGraph(context: GraphContext): Promise<void> {
  // TODO: route through LangGraph flows, calling context.emit() for node events
  context.emit({ event: "graph:start", input: context.input });
  context.emit({ event: "graph:end" });
}
