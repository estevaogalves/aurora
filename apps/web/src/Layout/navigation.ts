import type { IconName } from "../components/Icon";
import { DATA_SOURCE } from "../config";

export const NAV_ITEMS: { path: string; label: string; icon: IconName }[] = [
  { path: "/painel", label: "Painel", icon: "painel" },
  { path: "/lancamentos", label: "Lançamentos", icon: "lanc" },
  { path: "/projecao", label: "Projeção", icon: "projecao" },
  { path: "/comparacao", label: "Comparação", icon: "comparacao" },
  { path: "/metas", label: "Metas", icon: "metas" },
  { path: "/relatorios", label: "Relatórios", icon: "relatorios" },
  // sem login (modo local) não há menu de conta: os cartões ficam numa página; com a API, ficam no menu do perfil
  ...(DATA_SOURCE === "local" ? [{ path: "/perfil", label: "Cartões", icon: "user" as const }] : []),
];
