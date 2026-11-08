import type { ApiSession } from "@aurora/api-types";
import { API_URL } from "../config";

/** Erro devolvido pela API (ou falha de rede, com `status` 0). A mensagem já vem pronta para exibir. */
export class ApiError extends Error {
  readonly status: number;
  readonly retryAfter?: number;

  constructor(status: number, message: string, retryAfter?: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.retryAfter = retryAfter;
  }
}

/** Token de acesso só em memória: nunca vai para localStorage. O refresh fica no cookie httpOnly. */
let accessToken: string | null = null;
let onSessionLost: (() => void) | null = null;

export const setAccessToken = (token: string | null) => {
  accessToken = token;
};
export const getAccessToken = () => accessToken;

/** Quem quiser saber quando a sessão caiu de vez (refresh recusado) registra aqui. */
export const setSessionLostHandler = (handler: (() => void) | null) => {
  onSessionLost = handler;
};

interface RequestOptions {
  body?: unknown;
  /** false para login, cadastro, refresh e logout (sem token e sem renovação automática) */
  auth?: boolean;
  /** Envia o token de acesso mesmo com `auth: false` (logout: o servidor revoga o token). */
  bearer?: boolean;
}

async function send(method: string, path: string, { body, auth = true, bearer = false }: RequestOptions): Promise<Response> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if ((auth || bearer) && accessToken) headers.Authorization = `Bearer ${accessToken}`;
  try {
    return await fetch(`${API_URL}${path}`, {
      method,
      headers,
      credentials: "include",
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, "Não foi possível falar com o servidor. Confira sua conexão.");
  }
}

async function toError(res: Response): Promise<ApiError> {
  let message = "Algo deu errado. Tente novamente.";
  try {
    const data = (await res.json()) as { error?: string };
    if (data.error) message = data.error;
  } catch {
    // corpo vazio ou que não é JSON: fica a mensagem padrão
  }
  const retry = Number(res.headers.get("Retry-After"));
  return new ApiError(res.status, message, Number.isFinite(retry) && retry > 0 ? retry : undefined);
}

let refreshing: Promise<ApiSession> | null = null;

/**
 * Troca o cookie de refresh por uma sessão nova. Chamadas simultâneas dividem a mesma requisição
 * (cada refresh token vale uma vez), e entre abas um lock evita gastar o mesmo cookie em paralelo.
 */
export function refreshSession(): Promise<ApiSession> {
  refreshing ??= withTabLock(async () => {
    const res = await send("POST", "/auth/refresh", { auth: false });
    if (!res.ok) throw await toError(res);
    const session = (await res.json()) as ApiSession;
    accessToken = session.accessToken;
    return session;
  }).finally(() => {
    refreshing = null;
  });
  return refreshing;
}

function withTabLock<T>(fn: () => Promise<T>): Promise<T> {
  const locks = typeof navigator === "undefined" ? undefined : navigator.locks;
  return locks ? (locks.request("aurora:refresh", fn) as Promise<T>) : fn();
}

/** Chamada à API. Se o token expirou (401), renova a sessão uma vez e repete. */
export async function request<T>(method: string, path: string, options: RequestOptions = {}): Promise<T> {
  let res = await send(method, path, options);

  if (res.status === 401 && options.auth !== false) {
    try {
      await refreshSession();
    } catch (error) {
      // só encerra a sessão se o servidor recusou; falha de rede não derruba o login
      if (error instanceof ApiError && error.status !== 0) {
        accessToken = null;
        onSessionLost?.();
      }
      throw error instanceof ApiError && error.status === 0 ? error : new ApiError(401, "Sessão expirada. Faça login novamente.");
    }
    res = await send(method, path, options);
  }

  if (!res.ok) throw await toError(res);
  const text = res.status === 204 ? "" : await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export const api = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T = void>(path: string, body?: unknown, options?: Pick<RequestOptions, "auth" | "bearer">) => request<T>("POST", path, { body, ...options }),
  patch: <T = void>(path: string, body: unknown) => request<T>("PATCH", path, { body }),
  put: <T = void>(path: string, body: unknown) => request<T>("PUT", path, { body }),
  delete: (path: string, body?: unknown) => request<void>("DELETE", path, { body }),
};
