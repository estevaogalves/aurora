import type { Goal } from "@/domain";
import { changeMonth, getCurrentMonth } from "@/Utils/Date";

/**
 * Metas de exemplo, só para o tour mostrar o card quando o usuário ainda não criou nenhuma.
 * Nunca são gravadas nem entram nos totais dele.
 */
export function getDemoGoals(): Goal[] {
  const today = getCurrentMonth();
  return [
    { id: "demo-reserva", name: "Reserva de emergência (exemplo)", target: 1500000, saved: 600000, monthly: 150000, deadline: null, yieldTotal: 8500 },
    { id: "demo-viagem", name: "Viagem (exemplo)", target: 250000, saved: 50000, monthly: 15000, deadline: changeMonth(today, 6) },
  ];
}
