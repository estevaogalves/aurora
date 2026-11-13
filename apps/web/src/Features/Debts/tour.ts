import type { TourStep } from "@/components/tour/types";

export const DIVIDAS_TOUR: TourStep[] = [
    { target: "div-novo", title: "Nova dívida ou consórcio", text: "Escolha a aba Dívida ou Consórcio (linear, com parcelas iguais, ou progressivo, em que a parcela cresce sempre pelo mesmo acréscimo). Informe o valor, o total de parcelas, quantas já pagou e o mês da próxima. Não precisa cadastrar despesa fixa: as parcelas aparecem sozinhas em Lançamentos, com o selo Dívida ou Consórcio.", placement: ["bottom", "left"] },
  { target: "div-resumo", title: "O resumo", text: "Quanto você paga por mês em parcelas, o saldo que falta pagar (soma das parcelas restantes, sem juros nem correção) e quando a última parcela vence.", placement: ["bottom"] },
    { target: "div-card", title: "Cada dívida", text: "Parcelas pagas e restantes, total já pago, saldo estimado e o mês da quitação. “Registrar parcela paga” (ou marcar a parcela como paga em Lançamentos) avança a próxima parcela em um mês: as duas formas são a mesma coisa. Quando todas as parcelas são pagas, fica como Quitado e some das despesas dos meses seguintes.", placement: ["top", "right"] },
  { target: "div-simular", title: "Simular quitação antecipada", text: "Informe o desconto que o banco ou a administradora deu e veja quanto pagaria hoje para quitar tudo. É só uma simulação: nada é registrado.", placement: ["top", "right"] },
];
