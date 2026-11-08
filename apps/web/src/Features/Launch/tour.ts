import type { TourStep } from "@/components/tour/types";

export const LANCAMENTOS_TOUR: TourStep[] = [
  { target: "rendas", title: "Rendas do mês", text: "Suas fontes de renda. Marcadas como Fixa, repetem todo mês; as Variáveis valem só no mês em que foram lançadas. As fixas ficam abaixo de uma linha divisória, só com nome e valor, para destacar as variáveis. O menu ⋮ edita, fixa ou remove.", placement: ["right", "bottom"] },
  { target: "despesas", title: "Despesas do mês", text: "Despesas variáveis e as despesas extras planejadas que caem neste mês; as fixas ficam abaixo de uma linha divisória, só com nome e valor. Em uma despesa fixa, o menu ⋮ oculta só o mês atual, e dá para restaurar depois.", placement: ["left", "bottom"] },
  { target: "parcelas", title: "Compras parceladas", text: "Cada compra no crédito com parcela neste mês: número da parcela, valor, total da compra, quantas faltam e quando termina. Elas aparecem só aqui, não em Despesas do mês. O total das parcelas do mês fica no rodapé e já está somado no saldo. Funciona também em meses futuros.", placement: ["left", "top"] },
  { target: "anotacoes", title: "Anotações", text: "Escreva o lembrete no campo do topo; as anotações ficam logo abaixo, de 3 em 3 por página, com as fixadas na primeira e com borda colorida. Textos longos são cortados com “ler mais”. Dá para editar, fixar e apagar.", placement: ["right", "top"] },
];
