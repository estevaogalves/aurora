import type { TourStep } from "@/components/tour/types";

export const DIVIDAS_TOUR: TourStep[] = [
  { target: "div-novo", title: "Nova dívida ou consórcio", text: "Cadastre uma dívida ou consórcio em parcelas fixas: valor da parcela, total de parcelas, quantas já pagou e o mês da próxima. É só um acompanhamento (o Aurora não cria nem muda despesas).", placement: ["bottom", "left"] },
  { target: "div-resumo", title: "O resumo", text: "Quanto você paga por mês em parcelas, o saldo que falta pagar (parcelas restantes × valor, sem juros nem correção) e quando a última parcela vence.", placement: ["bottom"] },
  { target: "div-card", title: "Cada dívida", text: "Parcelas pagas e restantes, total já pago, saldo estimado e o mês da quitação. “Registrar parcela paga” avança a próxima parcela em um mês. Vincule a dívida a uma despesa fixa que já traz a parcela: assim ela não é somada duas vezes, e a Projeção mostra quando essa despesa fixa cai. Com o vínculo, “Antecipar parcelas” paga uma parcela distante com desconto: o valor vira um lançamento avulso já pago e o mês dela passa a valer R$ 0 na despesa fixa, sem contar duas vezes.", placement: ["top", "right"] },
  { target: "div-simular", title: "Simular quitação antecipada", text: "Informe o desconto que o banco ou a administradora deu e veja quanto pagaria hoje para quitar tudo. É só uma simulação: nada é registrado.", placement: ["top", "right"] },
];
