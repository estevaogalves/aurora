import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// vitest roda com a pasta apps/web como diretório atual
const nginx = readFileSync(resolve(process.cwd(), "nginx.conf"), "utf8");
const dockerfile = readFileSync(resolve(process.cwd(), "Dockerfile"), "utf8");

const apiBlock = nginx.split(/\n\s*location /).find((b) => b.startsWith("/api/"))!;

describe("nginx entrega à API um IP de cliente que o cliente não controla (SEC-04)", () => {
  it("sobrescreve X-Real-IP e X-Forwarded-For com $remote_addr", () => {
    expect(apiBlock).toContain("proxy_set_header X-Real-IP $remote_addr;");
    expect(apiBlock).toContain("proxy_set_header X-Forwarded-For $remote_addr;");
  });

  it("não acrescenta ao X-Forwarded-For enviado pelo cliente", () => {
    // $proxy_add_x_forwarded_for preserva o valor forjado pelo cliente
    expect(nginx).not.toContain("$proxy_add_x_forwarded_for");
  });

  it("descarta True-Client-IP e Forwarded (a API/chi também os lê)", () => {
    expect(apiBlock).toContain('proxy_set_header True-Client-IP "";');
    expect(apiBlock).toContain('proxy_set_header Forwarded "";');
  });

  it("inclui real-ip.conf no servidor, antes do proxy, e o Dockerfile o copia", () => {
    const inc = nginx.indexOf("include /etc/nginx/snippets/real-ip.conf;");
    expect(inc).toBeGreaterThan(-1);
    expect(inc).toBeLessThan(nginx.indexOf("location /api/"));
    expect(dockerfile).toContain("COPY apps/web/real-ip.conf /etc/nginx/snippets/real-ip.conf");
  });

  it("real-ip.conf não vem com nenhum set_real_ip_from ativo (não confia em ninguém por padrão)", () => {
    const conf = readFileSync(resolve(process.cwd(), "real-ip.conf"), "utf8");
    const active = conf.split("\n").filter((l) => l.trim() && !l.trim().startsWith("#"));
    expect(active).toEqual([]);
  });
});
