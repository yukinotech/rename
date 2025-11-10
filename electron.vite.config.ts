import { resolve } from "node:path";
import { defineConfig, externalizeDepsPlugin } from "electron-vite";

const cjsOutput = {
  format: "cjs",
  entryFileNames: "[name].cjs",
};

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: "dist/main",
      rollupOptions: {
        output: cjsOutput,
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: "dist/preload",
      rollupOptions: {
        output: cjsOutput,
      },
    },
  },
  renderer: {
    root: resolve(__dirname, "src/renderer"),
    build: {
      outDir: "dist/renderer",
    },
    server: {
      host: "127.0.0.1",
      port: 5173,
      strictPort: true,
    },
  },
});
