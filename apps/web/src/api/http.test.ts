import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, api, setAccessToken, setSessionLostHandler } from "./http";

const json = (status: number, body?: unknown, headers: Record<string, string> = {}) =>
  new Response(body === undefined ? null : JSON.stringify(body), { status, headers });

const session = (token: string) => ({
  accessToken: token,
  expiresAt: "2099-01-01T00:00:00Z",
  user: { id: "u", email: "a@b.c", name: "A", role: "user" },
});

let calls: { url: string; method: string; auth: string | null }[];

function mockFetch(handler: (url: string, init: RequestInit) => Response | Promise<Response>) {
  calls = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit) => {
      const headers = (init.headers ?? {}) as Record<string, string>;
      calls.push({ url, method: init.method ?? "GET", auth: headers.Authorization ?? null });
      return handler(url, init);
    }),
  );
}

beforeEach(() => {
  setAccessToken("velho");
  setSessionLostHandler(null);
});
afterEach(() => vi.unstubAllGlobals());

describe("cliente da API", () => {
  it("envia o token e devolve o JSON", async () => {
    mockFetch(() => json(200, { ok: 1 }));
    expect(await api.get("/data")).toEqual({ ok: 1 });
    expect(calls[0]).toMatchObject({ url: "/api/v1/data", auth: "Bearer velho" });
  });

  it("responde undefined em 204", async () => {
    mockFetch(() => json(204));
    expect(await api.delete("/goals/1")).toBeUndefined();
  });

  it("renova a sessão no 401 e repete a chamada com o token novo", async () => {
    mockFetch((url) => (url.endsWith("/auth/refresh") ? json(200, session("novo")) : calls.filter((c) => c.url.endsWith("/data")).length === 1 ? json(401, { error: "x" }) : json(200, { ok: 1 })));
    expect(await api.get("/data")).toEqual({ ok: 1 });
    expect(calls.map((c) => [c.url, c.auth])).toEqual([
      ["/api/v1/data", "Bearer velho"],
      ["/api/v1/auth/refresh", null],
      ["/api/v1/data", "Bearer novo"],
    ]);
  });

  it("vários 401 ao mesmo tempo gastam um refresh só", async () => {
    mockFetch((url) => {
      if (url.endsWith("/auth/refresh")) return json(200, session("novo"));
      return calls.at(-1)?.auth === "Bearer novo" ? json(200, { ok: 1 }) : json(401, { error: "x" });
    });
    await Promise.all([api.get("/a"), api.get("/b"), api.get("/c")]);
    expect(calls.filter((c) => c.url.endsWith("/auth/refresh"))).toHaveLength(1);
  });

  it("se o refresh é recusado, avisa que a sessão caiu", async () => {
    const lost = vi.fn();
    setSessionLostHandler(lost);
    mockFetch((url) => (url.endsWith("/auth/refresh") ? json(401, { error: "Sessão expirada." }) : json(401, { error: "x" })));
    await expect(api.get("/data")).rejects.toMatchObject({ status: 401 });
    expect(lost).toHaveBeenCalledOnce();
  });

  it("falha de rede no refresh não derruba a sessão", async () => {
    const lost = vi.fn();
    setSessionLostHandler(lost);
    mockFetch((url) => {
      if (url.endsWith("/auth/refresh")) throw new TypeError("offline");
      return json(401, { error: "x" });
    });
    await expect(api.get("/data")).rejects.toMatchObject({ status: 0 });
    expect(lost).not.toHaveBeenCalled();
  });

  it("login errado não tenta renovar e mostra a mensagem do servidor", async () => {
    mockFetch(() => json(401, { error: "E-mail ou senha incorretos." }));
    await expect(api.post("/auth/login", { email: "a", password: "b" }, { auth: false })).rejects.toThrow("E-mail ou senha incorretos.");
    expect(calls).toHaveLength(1);
  });

  it("guarda o Retry-After do 429", async () => {
    mockFetch(() => json(429, { error: "Muitas tentativas." }, { "Retry-After": "42" }));
    const error = await api.post("/auth/login", {}, { auth: false }).catch((e: ApiError) => e);
    expect(error).toMatchObject({ status: 429, retryAfter: 42 });
  });

  it("falha de rede vira ApiError de status 0", async () => {
    mockFetch(() => {
      throw new TypeError("offline");
    });
    await expect(api.get("/data")).rejects.toMatchObject({ name: "ApiError", status: 0 });
  });
});
