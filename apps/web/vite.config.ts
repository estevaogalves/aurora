import { defineConfig } from "vitest/config"
import react from "@vitejs/plugin-react"
import path from "path"

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    host: true,
    allowedHosts: true,
    // com VITE_DATA_SOURCE=api, /api vai para o backend (mesmo endereço do front: sem CORS)
    proxy: {
      "/api": process.env.VITE_DEV_API_PROXY ?? "http://127.0.0.1:8081",
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
})