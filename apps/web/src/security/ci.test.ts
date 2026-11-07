import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// Regressão do SEC-17: CI com ações fixadas por SHA, permissões mínimas e verificação de vulnerabilidades.
// vitest roda com a pasta apps/web como diretório atual.
const root = (file: string) => readFileSync(resolve(process.cwd(), "../..", file), "utf8").replace(/\r\n/g, "\n");

const ci = root(".github/workflows/ci.yml");
const dependabot = root(".github/dependabot.yml");

describe("CI", () => {
  it("toda ação (uses:) está fixada por SHA de commit de 40 caracteres", () => {
    const uses = [...ci.matchAll(/^\s*-?\s*uses:\s*(\S+)/gm)].map((m) => m[1]);
    expect(uses.length).toBeGreaterThanOrEqual(8);
    for (const u of uses) expect(u, u).toMatch(/^[\w.-]+\/[\w.-]+@[0-9a-f]{40}$/);
  });

  it("cada ação fixada diz a versão num comentário", () => {
    for (const line of ci.split("\n").filter((l) => /uses:\s*\S+@[0-9a-f]{40}/.test(l))) {
      expect(line, line).toMatch(/# v\d+\.\d+\.\d+$/);
    }
  });

  it("o token tem só leitura e nenhum job pede escrita", () => {
    expect(ci).toMatch(/^permissions:\n {2}contents: read$/m);
    expect(ci).not.toMatch(/:\s*write\b/);
  });

  it("imagens de serviço da CI têm digest", () => {
    const images = [...ci.matchAll(/^\s*image:\s*(\S+)/gm)].map((m) => m[1]);
    expect(images.length).toBeGreaterThan(0);
    for (const i of images) expect(i, i).toMatch(/@sha256:[0-9a-f]{64}$/);
  });

  it("roda pnpm audit (alta/crítica) e govulncheck com versão fixa, nunca @latest", () => {
    expect(ci).toMatch(/pnpm audit --audit-level=high/);
    expect(ci).toMatch(/govulncheck@v\d+\.\d+\.\d+/);
    expect(ci).toMatch(/govulncheck \.\/\.\.\./);
    expect(ci).not.toContain("@latest");
  });

  it("a verificação de segurança também roda toda semana, sem precisar de commit", () => {
    expect(ci).toMatch(/schedule:\n\s+- cron: "[^"]+"/);
    // no agendamento só o job de segurança roda
    expect(ci).toMatch(/web:[\s\S]*?if: github\.event_name != 'schedule'/);
    expect(ci).toMatch(/api:[\s\S]*?if: github\.event_name != 'schedule'/);
    const security = ci.slice(ci.indexOf("  security:"));
    expect(security).not.toContain("github.event_name != 'schedule'");
  });
});

describe("Dependabot mantém os SHAs/digests e as dependências atualizados", () => {
  for (const ecosystem of ["github-actions", "docker", "docker-compose", "npm", "gomod"]) {
    it(`cobre ${ecosystem}`, () => {
      expect(dependabot).toContain(`package-ecosystem: ${ecosystem}`);
    });
  }
});
