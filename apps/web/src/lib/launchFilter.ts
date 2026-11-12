import { create } from "zustand";
import { EMPTY_FILTER, type LaunchFilter } from "@/domain/launchFilter";

/** Filtro atual da tela Lançamentos. Fica só na memória (zera ao recarregar) e só muda o que a lista mostra. */
interface FilterState {
  filter: LaunchFilter;
  open: boolean;
  setFilter: (patch: Partial<LaunchFilter>) => void;
  clear: () => void;
  toggleOpen: () => void;
}

export const useLaunchFilter = create<FilterState>((set) => ({
  filter: EMPTY_FILTER,
  open: false,
  setFilter: (patch) => set((s) => ({ filter: { ...s.filter, ...patch } })),
  clear: () => set({ filter: EMPTY_FILTER }),
  toggleOpen: () => set((s) => ({ open: !s.open })),
}));
