/**
 * Retorna o mês atual no formato YYYY-MM
 */
export function getCurrentMonth() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Formata um mês no formato YYYY-MM para "mês de ano" (ex: "março de 2026")
 */
export function formatMonth(month: string) {
  const [year, m] = month.split("-").map(Number);
  const date = new Date(year, m - 1, 1);
  
  return date.toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });
}

/**
 * Altera um mês adicionando/subtraindo meses
 */
export function changeMonth(month: string, offset: number) {
  const [year, m] = month.split("-").map(Number);
  const date = new Date(year, m - 1, 1);
  date.setMonth(date.getMonth() + offset);
  
  const newYear = date.getFullYear();
  const newMonth = String(date.getMonth() + 1).padStart(2, "0");
  
  return `${newYear}-${newMonth}`;
}

/**
 * Retorna a data atual formatada como DD/MM
 */
export function getToday() {
  const today = new Date();
  return today.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit"
  });
}

/**
 * Verifica se o mês fornecido é o mês atual
 */
export function isCurrentMonth(month: string) {
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth() + 1;
  const [year, m] = month.split("-").map(Number);
  
  return year === currentYear && m === currentMonth;
}

// ========== NOVAS FUNÇÕES ÚTEIS ==========

/**
 * 🟢 Formata um mês no formato YYYY-MM para exibição curta (ex: "Mar/26")
 */
export function formatMonthShort(month: string) {
  const [year, m] = month.split("-").map(Number);
  const date = new Date(year, m - 1, 1);
  
  return date.toLocaleDateString("pt-BR", {
    month: "short",
    year: "2-digit"
  }).replace(".", ""); // Remove o ponto da abreviação
}

/**
 * 🟢 Retorna o nome do mês (ex: "Janeiro")
 */
export function getMonthName(month: string) {
  const [year, m] = month.split("-").map(Number);
  const date = new Date(year, m - 1, 1);
  
  return date.toLocaleDateString("pt-BR", { month: "long" });
}

/**
 * 🟢 Retorna o ano (ex: 2026)
 */
export function getYearFromMonth(month: string) {
  return month.split("-")[0];
}

/**
 * 🟢 Gera uma lista dos últimos N meses (para selects)
 */
export function getLastMonths(monthsCount: number = 12) {
  const result = [];
  const today = new Date();
  
  for (let i = 0; i < monthsCount; i++) {
    const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    result.push(`${year}-${month}`);
  }
  
  return result;
}

/**
 * 🟢 Compara dois meses (retorna -1, 0, 1)
 */
export function compareMonths(monthA: string, monthB: string) {
  const [yearA, monthA_num] = monthA.split("-").map(Number);
  const [yearB, monthB_num] = monthB.split("-").map(Number);
  
  if (yearA !== yearB) return yearA - yearB;
  return monthA_num - monthB_num;
}

/**
 * 🟢 Verifica se monthA é anterior a monthB
 */
export function isBefore(monthA: string, monthB: string) {
  return compareMonths(monthA, monthB) < 0;
}

/**
 * 🟢 Verifica se monthA é posterior a monthB
 */
export function isAfter(monthA: string, monthB: string) {
  return compareMonths(monthA, monthB) > 0;
}

/**
 * 🟢 Retorna a diferença em meses entre duas datas
 */
export function monthsDifference(monthA: string, monthB: string) {
  const [yearA, monthA_num] = monthA.split("-").map(Number);
  const [yearB, monthB_num] = monthB.split("-").map(Number);
  
  return (yearA - yearB) * 12 + (monthA_num - monthB_num);
}

/**
 * 🟢 Gera um array com todos os meses entre duas datas (inclusive)
 */
export function getMonthsBetween(startMonth: string, endMonth: string) {
  const result = [];
  let current = startMonth;
  
  while (compareMonths(current, endMonth) <= 0) {
    result.push(current);
    current = changeMonth(current, 1);
  }
  
  return result;
}

/**
 * 🟢 Formata um mês para exibição em gráficos (ex: "Mar/26")
 */
export function formatMonthForChart(month: string) {
  return formatMonthShort(month);
}

/**
 * 🟢 Retorna o mês anterior
 */
export function getPreviousMonth(month: string) {
  return changeMonth(month, -1);
}

/**
 * 🟢 Retorna o próximo mês
 */
export function getNextMonth(month: string) {
  return changeMonth(month, 1);
}

/**
 * 🟢 Verifica se um mês é válido
 */
export function isValidMonth(month: string) {
  const regex = /^\d{4}-(0[1-9]|1[0-2])$/;
  return regex.test(month);
}