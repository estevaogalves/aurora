/** Cores em hex (tema claro) para quem não entende variáveis CSS, como o gerador de PDF. */
const BUILTIN_HEX: Record<string, string> = {
  Moradia: "#5B48E8",
  Transporte: "#0F8AA0",
  Alimentação: "#D69A12",
  Saúde: "#D6335A",
  Educação: "#0E8F73",
  Lazer: "#E0732A",
  Serviços: "#3D74E8",
  Outros: "#8189A3",
  Renda: "#0E8F73",
  "Crédito/Parcelado": "#B24BC4",
};

const FALLBACK = "#8189A3";

export function categoryHex(category: string, custom: { name: string; color: string }[] = []): string {
  return custom.find((c) => c.name === category)?.color ?? BUILTIN_HEX[category] ?? FALLBACK;
}

/** "#5B48E8" -> [91, 72, 232] */
export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
