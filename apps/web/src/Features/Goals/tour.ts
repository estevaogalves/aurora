import type { TourStep } from "@/components/tour/types";

export const METAS_TOUR: TourStep[] = [
  { target: "ativas", title: "Metas ativas", text: "Quantas metas ainda estão em andamento e quantas já passaram de 80%.", placement: ["bottom"] },
  { target: "guardado", title: "Já guardado", text: "A soma do que você já juntou em todas as metas, comparada com o total que quer alcançar.", placement: ["bottom"] },
  { target: "aporte", title: "Aporte mensal", text: "Quanto você pretende guardar por mês, somando as metas ativas.", placement: ["bottom", "left"] },
  { target: "vazio", title: "Crie sua primeira meta", text: "Ainda não há metas. Use Lançar → Meta para criar uma, como a reserva de emergência, e acompanhe o progresso aqui.", placement: ["top", "bottom"] },
  { target: "meta", title: "Cartão da meta", text: "Mostra a porcentagem, quanto já foi guardado, os rendimentos e a previsão. Com prazo, o cartão recomenda quanto juntar por mês para chegar a tempo e avisa se o seu aporte não basta. O selo indica o prazo e avisa quando ele está chegando.", placement: ["right", "bottom"] },
  { target: "meta-acoes", title: "Aportar, editar e excluir", text: "Aportar registra o valor guardado e, se quiser, o rendimento do período. Editar muda nome, valor, aporte mensal e prazo.", placement: ["top", "bottom"] },
  { target: "porquinhos", title: "Porquinhos", text: "Guardados sem valor de meta, criados em Lançar → Meta → Porquinho. Mostram o que já tem, o aporte mensal, os rendimentos e, com prazo, quanto você terá até lá. Ficam sempre abaixo das metas principais e não entram nos totais do topo.", placement: ["top", "bottom"] },
];
