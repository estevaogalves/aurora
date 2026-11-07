import { defineConfig } from "vitest/config"
import react from "@vitejs/plugin-react"
import path from "path"
import { parseAllowedHosts } from "./devServer"

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    // Segurança do servidor de desenvolvimento (SEC-18): por padrão só escuta em localhost e só aceita
    // localhost/IPs no cabeçalho Host. Para abrir na rede local (celular): `pnpm dev --host`. Para um túnel
    // (ngrok): DEV_ALLOWED_HOSTS=meu-app.ngrok.app. Nada disso fica ligado sem você pedir.
    allowedHosts: parseAllowedHosts(process.env.DEV_ALLOWED_HOSTS),
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