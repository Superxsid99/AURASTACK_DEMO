import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig(({ mode }) => {
  // Load from root monorepo .env first, then local .env overrides
  const rootEnv = loadEnv(mode, path.resolve(__dirname, "../../"), "");
  const localEnv = loadEnv(mode, ".", "");
  const env = { ...rootEnv, ...localEnv };
  return {
    plugins: [react(), tailwindcss()],
    define: {
      "process.env.OPENAI_API_KEY": JSON.stringify(env.OPENAI_API_KEY ?? ""),
      "process.env.API_URL": JSON.stringify(env.VITE_API_URL ?? "http://localhost:8000"),
    },
    server: {
      host: "::",
      port: 8080,
      hmr: { overlay: false },
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
