import { describe, expect, it } from "vitest";
import { parseAllowedHosts } from "../../devServer";
import config from "../../vite.config";

// Regressão do SEC-18: o servidor de desenvolvimento não pode ficar exposto na rede nem aceitar qualquer Host.

describe("configuração do servidor de desenvolvimento do Vite", () => {
  const server = config.server ?? {};

  it("não escuta em todas as interfaces por padrão (rede local é opt-in: pnpm dev --host)", () => {
    expect(server.host).not.toBe(true);
    expect(server.host).not.toBe("0.0.0.0");
    expect(server.host).not.toBe("::");
  });

  it("não aceita qualquer Host (DNS rebinding): allowedHosts nunca é `true` nem tem curinga", () => {
    expect(server.allowedHosts).not.toBe(true);
    expect(Array.isArray(server.allowedHosts)).toBe(true);
    for (const h of server.allowedHosts as string[]) expect(h).not.toMatch(/[*]|^true$/i);
  });

  it("mantém o proxy da API (o app em modo api continua funcionando em dev)", () => {
    expect(Object.keys(server.proxy ?? {})).toContain("/api");
  });
});

describe("parseAllowedHosts (DEV_ALLOWED_HOSTS)", () => {
  it("vazio ou ausente: nenhum host extra", () => {
    expect(parseAllowedHosts(undefined)).toEqual([]);
    expect(parseAllowedHosts("")).toEqual([]);
    expect(parseAllowedHosts(" , ,")).toEqual([]);
  });

  it("aceita nomes, ignora espaços e maiúsculas, e permite subdomínios com ponto na frente", () => {
    expect(parseAllowedHosts("Meu-App.ngrok.app, .trycloudflare.com ,celular.local")).toEqual([
      "meu-app.ngrok.app",
      ".trycloudflare.com",
      "celular.local",
    ]);
  });

  it.each(["*", "true", "*.ngrok.app", "evil.com/caminho", "a b", "host:3000", "-x.com", "x..com", "http://x.com"])(
    "recusa %j (liberar tudo é o que o SEC-18 evita)",
    (bad) => {
      expect(() => parseAllowedHosts(bad)).toThrow(/DEV_ALLOWED_HOSTS/);
    },
  );

  it("um valor inválido no meio da lista derruba a lista toda", () => {
    expect(() => parseAllowedHosts("ok.example,*")).toThrow();
  });
});
