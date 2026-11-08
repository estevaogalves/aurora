import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// vitest roda com a pasta apps/web como diretório atual
const read = (file: string) => readFileSync(resolve(process.cwd(), file), "utf8");

const headers = read("security-headers.conf");
const nginx = read("nginx.conf");
const html = read("index.html");

describe("cabeçalhos de segurança do nginx", () => {
  it("a CSP libera exatamente os scripts inline de index.html (hash sha256)", () => {
    // O navegador normaliza CRLF/CR para LF ao ler o HTML (spec do HTML), então o hash da CSP vale para o
    // texto com LF. Sem isto, um checkout com CRLF (Windows, autocrlf) daria um hash diferente.
    const inline = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1].replace(/\r\n?/g, "\n"));
    expect(inline.length).toBeGreaterThan(0);
    for (const code of inline) {
      const hash = `'sha256-${createHash("sha256").update(code).digest("base64")}'`;
      expect(headers, "o script inline do tema mudou: atualize o hash em security-headers.conf").toContain(hash);
    }
  });

  it("a CSP está em modo enforce e não permite script inline genérico", () => {
    expect(headers).toMatch(/add_header Content-Security-Policy "/);
    expect(headers).not.toContain("Report-Only");
    const csp = headers.match(/Content-Security-Policy "([^"]+)"/)![1];
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    const scriptSrc = csp.split(";").find((d) => d.trim().startsWith("script-src"))!;
    expect(scriptSrc).not.toContain("unsafe-inline");
    expect(scriptSrc).not.toContain("unsafe-eval");
  });

  it("define os cabeçalhos aplicados de verdade", () => {
    for (const h of ["X-Content-Type-Options", "X-Frame-Options", "Referrer-Policy", "Permissions-Policy", "Strict-Transport-Security"]) {
      expect(headers).toMatch(new RegExp(`add_header ${h} "[^"]+" always;`));
    }
  });

  it("todo bloco do nginx com add_header repete os cabeçalhos de segurança", () => {
    // o nginx não herda add_header do servidor para blocos que declaram os seus
    const blocks = nginx.split(/\n\s*location /).slice(1);
    for (const block of blocks) {
      if (block.includes("add_header")) {
        expect(block, `location ${block.split("{")[0].trim()}`).toContain("include /etc/nginx/snippets/security-headers.conf;");
      }
    }
    expect(nginx).toContain("include /etc/nginx/snippets/security-headers.conf;");
    expect(nginx).toContain("server_tokens off;");
  });
});
