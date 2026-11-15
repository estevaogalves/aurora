/**
 * Importar OFX (extrato de conta ou fatura de cartão, o formato que os bancos exportam junto do CSV). O OFX vira as
 * mesmas linhas "Data, Descrição, Valor" do CSV, e o resto do importador (pré-visualização, duplicados, máscara de
 * CPF/cartão, categorias) segue igual. Tudo roda no aparelho e o arquivo nunca é guardado.
 */

export interface OfxTx {
  /** AAAA-MM-DD */
  date: string;
  description: string;
  /** Valor do arquivo, com sinal (no padrão OFX, saída de dinheiro é negativa). Texto: o CSV já sabe ler "-12.34" e "-12,34". */
  amount: string;
}

/** Cabeçalho que o importador de CSV reconhece (Data, Descrição, Valor). */
export const OFX_HEADER = ["Data", "Descrição", "Valor"];

/** O texto é um arquivo OFX? (OFX 1.x é SGML com cabeçalho "OFXHEADER"; o 2.x é XML com a tag <OFX>.) */
export function isOfx(text: string): boolean {
  return /<OFX[\s>]/i.test(text) || /^\s*OFXHEADER\s*:/i.test(text);
}

const ENTITIES: Record<string, string> = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&apos;": "'", "&#39;": "'" };
const decodeEntities = (s: string) => s.replace(/&(amp|lt|gt|quot|apos|#39);/g, (m) => ENTITIES[m] ?? m);

/** Valor de uma tag dentro do bloco: vai até o próximo "<" ou quebra de linha (o SGML do OFX 1.x não fecha as tags). */
function tag(block: string, name: string): string {
  const m = block.match(new RegExp(`<${name}>([^<\\r\\n]*)`, "i"));
  return m ? decodeEntities(m[1]).replace(/\s+/g, " ").trim() : "";
}

/** "20261108", "20261108000000" e "20261108120000[-3:BRT]" -> "2026-11-08"; null se inválida. */
function ofxDate(raw: string): string | null {
  const m = raw.match(/^(\d{4})(\d{2})(\d{2})/);
  if (!m) return null;
  const [y, mo, d] = [+m[1], +m[2], +m[3]];
  const date = new Date(Date.UTC(y, mo - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) return null;
  return `${m[1]}-${m[2]}-${m[3]}`;
}

/** Lançamentos (<STMTTRN>) do arquivo, na ordem em que aparecem. Os que não têm data ou valor legíveis são ignorados. */
export function parseOfx(text: string): OfxTx[] {
  const out: OfxTx[] = [];
  // cada bloco vai de um <STMTTRN> até o próximo (ou o fim da lista), com ou sem </STMTTRN>
  const blocks = text.split(/<STMTTRN>/i).slice(1);
  for (const raw of blocks) {
    const block = raw.split(/<\/BANKTRANSLIST>|<\/CCSTMTRS>|<\/STMTRS>/i)[0];
    const date = ofxDate(tag(block, "DTPOSTED"));
    const amount = tag(block, "TRNAMT");
    if (!date || !amount) continue;
    const name = tag(block, "NAME");
    const memo = tag(block, "MEMO");
    // bancos variam: uns põem o texto no NAME, outros no MEMO (ou nos dois, com um truncado)
    const description = name && memo && !memo.toLowerCase().includes(name.toLowerCase()) && !name.toLowerCase().includes(memo.toLowerCase()) ? `${name} ${memo}` : memo.length >= name.length ? memo : name;
    out.push({ date, description, amount });
  }
  return out;
}

const negative = (amount: string) => amount.trim().startsWith("-") || /^\(.*\)$/.test(amount.trim());

/**
 * Na fatura de cartão o importador espera a compra com valor positivo (negativo é pagamento ou estorno), mas o padrão
 * OFX traz a compra negativa. Como numa fatura quase tudo é compra, vale o sinal da maioria das linhas.
 */
export function purchasesAreNegative(txs: OfxTx[]): boolean {
  const neg = txs.filter((t) => negative(t.amount)).length;
  return neg > txs.length - neg;
}

/** Linhas no formato do CSV. `flip` inverte o sinal (fatura de cartão com compras negativas). */
export function ofxToRows(txs: OfxTx[], flip = false): string[][] {
  const rows = txs.map((t) => {
    if (!flip) return [t.date, t.description, t.amount];
    const a = t.amount.trim();
    return [t.date, t.description, negative(a) ? a.replace(/^-|^\((.*)\)$/, "$1") : `-${a.replace(/^\+/, "")}`];
  });
  return [OFX_HEADER, ...rows];
}
