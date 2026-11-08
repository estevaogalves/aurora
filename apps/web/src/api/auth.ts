import type { ApiLoginRequest, ApiRegisterRequest, ApiSession } from "@aurora/api-types";
import { api, refreshSession, setAccessToken } from "./http";

export { refreshSession };

export async function login(input: ApiLoginRequest): Promise<ApiSession> {
  const session = await api.post<ApiSession>("/auth/login", input, { auth: false });
  setAccessToken(session.accessToken);
  return session;
}

export async function register(input: ApiRegisterRequest): Promise<ApiSession> {
  const session = await api.post<ApiSession>("/auth/register", input, { auth: false });
  setAccessToken(session.accessToken);
  return session;
}

export async function logout(): Promise<void> {
  try {
    await api.post("/auth/logout", undefined, { auth: false, bearer: true });
  } finally {
    setAccessToken(null);
  }
}

/** Baixa todos os dados da conta (direito de acesso/portabilidade, LGPD). */
export const exportMyData = () => api.get<unknown>("/me/export");

/** Exclui a conta e todos os dados, depois de confirmar a senha. */
export async function deleteAccount(password: string): Promise<void> {
  await api.delete("/me", { password });
  setAccessToken(null);
}
