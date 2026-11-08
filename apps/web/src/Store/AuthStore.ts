import type { ApiSession, ApiUser } from "@aurora/api-types";
import { create } from "zustand";
import * as authApi from "../api/auth";
import { setSessionLostHandler } from "../api/http";
import { DATA_SOURCE } from "../config";
import { useFinanceStore } from "./FinanceStore";

type Status = "loading" | "anonymous" | "authenticated";

interface AuthState {
  status: Status;
  user: ApiUser | null;
  /** Ao abrir o app: tenta recuperar a sessão pelo cookie de refresh. */
  bootstrap: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  /** Exclui a conta (pede a senha) e encerra a sessão. */
  deleteAccount: (password: string) => Promise<void>;
}

/**
 * Sessão do usuário. Sem a API (`VITE_DATA_SOURCE=local`) não há login:
 * o app já nasce "authenticated" e esta store não faz nada.
 */
export const useAuthStore = create<AuthState>()((set) => {
  const open = async (session: ApiSession) => {
    // carrega os dados da conta antes de liberar as telas
    await useFinanceStore.getState().hydrate();
    set({ status: "authenticated", user: session.user });
  };

  const close = () => {
    useFinanceStore.getState().reset();
    set({ status: "anonymous", user: null });
  };

  setSessionLostHandler(close);

  return {
    status: DATA_SOURCE === "api" ? "loading" : "authenticated",
    user: null,

    bootstrap: async () => {
      if (DATA_SOURCE !== "api") return;
      try {
        await open(await authApi.refreshSession());
      } catch {
        close();
      }
    },

    login: async (email, password) => open(await authApi.login({ email, password })),

    register: async (name, email, password) => open(await authApi.register({ name, email, password })),

    logout: async () => {
      try {
        await authApi.logout();
      } finally {
        close();
      }
    },

    deleteAccount: async (password) => {
      await authApi.deleteAccount(password);
      close();
    },
  };
});
