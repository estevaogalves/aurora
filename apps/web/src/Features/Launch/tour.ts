import type { TourStep } from "@/components/tour/types";

export const LANCAMENTOS_TOUR: TourStep[] = [
  { target: "rendas", title: "Rendas do mês", text: "Suas fontes de renda. Marcadas como Fixa, repetem todo mês; as Variáveis valem só no mês em que foram lançadas. O menu ⋮ edita, fixa ou remove.", placement: ["right", "bottom"] },
  { target: "despesas", title: "Despesas do mês", text: "Despesas comuns, fixas e as parcelas do crédito que caem neste mês. Em uma despesa fixa, o menu ⋮ oculta só o mês atual, e dá para restaurar depois.", placement: ["left", "bottom"] },
  { target: "anotacoes", title: "Anotações", text: "Lembretes do mês, como um boleto para pagar. Dá para editar, fixar uma anotação e apagar quando não precisar mais.", placement: ["right", "top"] },
];
