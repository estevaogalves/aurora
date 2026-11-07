import type { IconName } from "../components/Icon";

export const NAV_ITEMS: { path: string; label: string; icon: IconName }[] = [
  { path: "/painel", label: "Painel", icon: "painel" },
  { path: "/lancamentos", label: "Lançamentos", icon: "lanc" },
  { path: "/projecao", label: "Projeção", icon: "projecao" },
  { path: "/comparacao", label: "Comparação", icon: "comparacao" },
  { path: "/metas", label: "Metas", icon: "metas" },
  { path: "/relatorios", label: "Relatórios", icon: "relatorios" },
];
