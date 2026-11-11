/** Data "AAAA-MM-DD" válida (formato; o campo de data do navegador já garante o resto). */
export const isISODate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v);
