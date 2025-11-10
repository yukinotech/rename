import { contextBridge, ipcRenderer } from 'electron';

const channel = 'agent:stream';

const agentAPI = {
  run(input: string, opts?: AgentRunOptions) {
    return ipcRenderer.invoke('agent:run', { input, opts });
  },
  cancel(taskId: string) {
    return ipcRenderer.invoke('agent:cancel', { taskId });
  },
  onStream(callback: (payload: AgentStreamChunk) => void) {
    const handler = (_event: Electron.IpcRendererEvent, payload: AgentStreamChunk) => callback(payload);
    ipcRenderer.on(channel, handler);
    return () => ipcRenderer.removeListener(channel, handler);
  }
};

contextBridge.exposeInMainWorld('agent', agentAPI);
