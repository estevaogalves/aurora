import { useMemo, useState } from "react";
import Icon from "@/components/Icon";
import { Field, inputClass } from "@/components/shared/FormFields";
import { btnClass } from "@/components/shared/styles";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  IMPORT_MAX_BYTES,
  IMPORT_TEMPLATES,
  IMPORT_MAX_ROWS,
  buildImportRows,
  decodeCsvBytes,
  formatPaymentDate,
  guessMapping,
  markDuplicates,
  parseCsv,
  sensitiveColumns,
  suggestCategory,
  type ColumnMapping,
  type ImportRow,
  type SignMode,
} from "@/domain";
import { formatBRL } from "@/lib/money";
import { useImportPrefs } from "@/lib/importPrefs";
import { uuid } from "@/lib/uuid";
import { downloadText } from "@/Services/download";
import { useFinanceStore } from "@/Store/FinanceStore";
import { useUiStore } from "@/Store/UiStore";
import { EXPENSE_CATEGORIES, type Category } from "@/Types/Category";
import { showToast } from "../Warnings/toast";

const plain = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/**
 * Importar extrato ou fatura em CSV: 1) escolher o arquivo e o destino, 2) conferir as colunas, 3) pré-visualizar
 * (categoria sugerida pelas suas regras, duplicados marcados) e só então confirmar. O arquivo é lido na memória do
 * navegador e descartado: nada é enviado nem guardado, e nada vira lançamento antes de "Importar".
 */
export default function ImportDialog() {
  const open = useUiStore((s) => s.importOpen);
  const close = useUiStore((s) => s.closeImport);
  return (
    <Dialog open={open} onOpenChange={(next) => !next && close()}>
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Importar extrato ou fatura (CSV)</DialogTitle>
          <DialogDescription>O arquivo é lido aqui no navegador e descartado. Nada é gravado antes de você confirmar a pré-visualização.</DialogDescription>
        </DialogHeader>
        {open && <Wizard onClose={close} />}
      </DialogContent>
    </Dialog>
  );
}

type Step = "file" | "map" | "preview";

function Wizard({ onClose }: { onClose: () => void }) {
  const cards = useFinanceStore((s) => s.creditCards);
  const transactions = useFinanceStore((s) => s.transactions);
  const custom = useFinanceStore((s) => s.customCategories);
  const addTransaction = useFinanceStore((s) => s.addTransaction);
  const prefs = useImportPrefs();

  const [step, setStep] = useState<Step>("file");
  const [error, setError] = useState("");
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<string[][]>([]);
  const [destination, setDestination] = useState(""); // "" = conta (despesas e rendas); senão, o id do cartão
  const [mapping, setMapping] = useState<ColumnMapping | null>(null);
  const [bankName, setBankName] = useState("");
  const [saveMapping, setSaveMapping] = useState(true);
  const [preview, setPreview] = useState<ImportRow[]>([]);
  const [skipped, setSkipped] = useState<{ line: number; reason: string }[]>([]);
  const [included, setIncluded] = useState<Set<string>>(new Set());
  const [edited, setEdited] = useState<Set<string>>(new Set());
  const [showDuplicates, setShowDuplicates] = useState(false);
  const [ruleText, setRuleText] = useState("");
  const [ruleCategory, setRuleCategory] = useState<Category>("Outros");

  const categoryNames = useMemo(() => [...EXPENSE_CATEGORIES, ...custom.map((c) => c.name)], [custom]);
  const body = mapping?.hasHeader ? rows.slice(1) : rows;
  const flagged = useMemo(() => sensitiveColumns(body.slice(0, 200)), [body]);
  const width = Math.max(0, ...rows.map((r) => r[0] === undefined ? 0 : r.length));
  const signature = mapping?.hasHeader ? rows[0].map(plain).join("|") : `cols:${width}`;
  const columnLabel = (c: number) => (mapping?.hasHeader && rows[0]?.[c] ? rows[0][c] : `Coluna ${c + 1}`) + (body[0]?.[c] ? ` (ex.: ${body[0][c].slice(0, 18)})` : "");
  const usable = Array.from({ length: width }, (_, c) => c).filter((c) => !flagged.has(c));

  async function pick(file: File | undefined) {
    setError("");
    if (!file) return;
    if (file.size > IMPORT_MAX_BYTES) return setError("O arquivo passa de 2 MB. Divida o extrato em períodos menores.");
    const parsed = parseCsv(decodeCsvBytes(await file.arrayBuffer()));
    if (parsed.length < 2) return setError("Não encontrei linhas neste arquivo. Ele precisa ser um CSV com cabeçalho e lançamentos.");
    if (parsed.length > IMPORT_MAX_ROWS + 1) return setError(`O arquivo tem mais de ${IMPORT_MAX_ROWS} linhas. Divida o extrato em períodos menores.`);
    setFileName(file.name);
    setRows(parsed);

    // mapeamento salvo com o mesmo cabeçalho é reaplicado sozinho; senão, sugere pelo cabeçalho e pelo conteúdo
    const header = parsed[0].map(plain).join("|");
    const saved = prefs.mappings.find((m) => m.mapping.hasHeader && m.signature === header);
    const guessed = saved?.mapping ?? guessMapping(parsed);
    setBankName(saved?.name ?? "");
    setMapping(guessed ?? { date: 0, description: 1, amount: 2, hasHeader: true, signMode: "auto" });
    if (!guessed) setError("Não consegui descobrir sozinho quais colunas são a data, a descrição e o valor. Escolha-as no próximo passo.");
    setStep("map");
  }

  function applySaved(name: string) {
    const saved = prefs.mappings.find((m) => m.name === name);
    if (!saved) return;
    setMapping(saved.mapping);
    setBankName(saved.name);
  }

  function toPreview() {
    if (!mapping) return;
    const m: ColumnMapping = destination ? { ...mapping, signMode: "expense" } : mapping;
    if (new Set([m.date, m.description, m.amount]).size < 3) return setError("Escolha três colunas diferentes para data, descrição e valor.");
    const built = buildImportRows(rows, m, prefs.rules);
    if (built.rows.length === 0) return setError("Nenhuma linha pôde ser lida com essas colunas. Confira a data e o valor.");
    const marked = markDuplicates(built.rows, transactions, new Set(prefs.imported));
    setError("");
    setPreview(marked);
    setSkipped(built.skipped);
    setIncluded(new Set(marked.filter((r) => !r.duplicate).map((r) => r.key)));
    setEdited(new Set());
    if (saveMapping && bankName.trim()) prefs.saveMapping({ name: bankName.trim(), signature, mapping });
    setStep("preview");
  }

  function setRowCategory(key: string, category: Category) {
    setPreview((list) => list.map((r) => (r.key === key ? { ...r, category } : r)));
    setEdited((s) => new Set(s).add(key));
  }

  function addRule() {
    const contains = ruleText.trim();
    if (contains.length < 2) return;
    prefs.addRule({ id: uuid(), contains, category: ruleCategory });
    // reaplica nas linhas que o usuário ainda não mexeu
    const rules = [...useImportPrefs.getState().rules];
    setPreview((list) => list.map((r) => (r.type === "expense" && !edited.has(r.key) ? { ...r, category: suggestCategory(r.description, rules) } : r)));
    setRuleText("");
  }

  function toggle(key: string) {
    setIncluded((s) => {
      const next = new Set(s);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const chosen = preview.filter((r) => included.has(r.key));
  const duplicates = preview.filter((r) => r.duplicate);
  const visible = showDuplicates ? preview : preview.filter((r) => !r.duplicate);
  const totalOut = chosen.filter((r) => r.type === "expense").reduce((s, r) => s + r.amount, 0);
  const totalIn = chosen.filter((r) => r.type === "income").reduce((s, r) => s + r.amount, 0);

  function confirm() {
    if (chosen.length === 0) return;
    for (const r of chosen) {
      addTransaction({
        id: uuid(),
        name: r.description,
        amount: r.amount,
        type: r.type,
        category: r.type === "income" ? "Renda" : r.category,
        notes: "",
        fixed: false,
        month: r.date.slice(0, 7),
        ...(destination && r.type === "expense" && { cardId: destination, purchaseDate: r.date }),
      });
    }
    prefs.addImported(chosen.map((r) => r.key));
    showToast({ type: "success", text: `${chosen.length} ${chosen.length === 1 ? "lançamento importado" : "lançamentos importados"}` });
    onClose();
  }

  const select = (value: number, onChange: (n: number) => void, id: string) => (
    <select id={id} value={value} onChange={(e) => onChange(Number(e.target.value))} className={inputClass}>
      {usable.map((c) => <option key={c} value={c}>{columnLabel(c)}</option>)}
    </select>
  );

  return (
    <div className="flex flex-col gap-4">
      <p className="text-[12.5px] font-semibold text-muted-foreground">
        Passo {step === "file" ? 1 : step === "map" ? 2 : 3} de 3 · {step === "file" ? "Arquivo e destino" : step === "map" ? "Colunas" : "Pré-visualização"}
      </p>
      {error && <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-[13px] font-semibold text-destructive">{error}</p>}

      {step === "file" && (
        <>
          <Field label="Destino" htmlFor="imp-dest" hint="(onde os lançamentos entram)">
            <select id="imp-dest" value={destination} onChange={(e) => setDestination(e.target.value)} className={inputClass}>
              <option value="">Conta: despesas e rendas avulsas (extrato)</option>
              {cards.map((c) => <option key={c.id} value={c.id}>Fatura do cartão {c.name}</option>)}
            </select>
            {destination && <p className="mt-1 text-xs text-muted-foreground">Cada linha vira uma despesa no cartão, com o dia da compra, e entra na fatura certa (fechamento e vencimento do cartão). Todas as linhas são despesas.</p>}
          </Field>
          <Field label="Arquivo CSV" htmlFor="imp-file" hint="(até 2 MB e 1.000 linhas)">
            <input id="imp-file" type="file" accept=".csv,.txt,text/csv" onChange={(e) => void pick(e.target.files?.[0])} className={`${inputClass} py-2`} />
          </Field>
          <p className="rounded-md bg-secondary px-3 py-2 text-[12.5px] text-muted-foreground">
            Baixe o extrato ou a fatura no app do seu banco, em CSV. Números de cartão, CPF e documentos são ignorados e mascarados, e nada do arquivo é guardado.
          </p>
          <section aria-label="Planilhas modelo" className="flex flex-col gap-3 rounded-md border border-border p-3.5">
            <div>
              <h3 className="font-display text-[14px] font-semibold">Baixe uma planilha modelo</h3>
              <p className="mt-0.5 text-[12.5px] text-muted-foreground">Já vem com as colunas prontas (Data, Descrição e Valor) e algumas linhas de exemplo. Troque pelas suas e depois escolha o arquivo acima. Abre no Excel e no Google Planilhas.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {IMPORT_TEMPLATES.map((t) => (
                <div key={t.id} className="flex flex-col items-start gap-1.5">
                  <button type="button" onClick={() => downloadText(t.filename, t.content, "text/csv", true)} className={`${btnClass.base} ${btnClass.sm}`}>
                    <Icon name="down" size={14} />
                    {t.label}
                  </button>
                  <span className="text-[12px] text-muted-foreground">{t.hint}</span>
                </div>
              ))}
            </div>
          </section>
        </>
      )}

      {step === "map" && mapping && (
        <>
          <p className="text-[13px] text-ink2">Arquivo: <b>{fileName}</b> · {body.length} linhas</p>
          {flagged.size > 0 && (
            <p role="note" className="rounded-md border border-border bg-secondary px-3 py-2 text-[12.5px] text-ink2">
              Ignorei {flagged.size === 1 ? "a coluna" : "as colunas"} {[...flagged.keys()].map((c) => `“${rows[0]?.[c] || `Coluna ${c + 1}`}”`).join(", ")}: parece{flagged.size === 1 ? "" : "m"} ter número de cartão ou documento.
            </p>
          )}
          {prefs.mappings.length > 0 && (
            <Field label="Usar um mapeamento salvo" htmlFor="imp-saved">
              <select id="imp-saved" value="" onChange={(e) => applySaved(e.target.value)} className={inputClass}>
                <option value="">Escolher…</option>
                {prefs.mappings.map((m) => <option key={m.name} value={m.name}>{m.name}</option>)}
              </select>
            </Field>
          )}
          <label className="flex items-center gap-2 text-[13px] font-semibold text-ink2">
            <input type="checkbox" checked={mapping.hasHeader} onChange={(e) => setMapping({ ...mapping, hasHeader: e.target.checked })} />
            A primeira linha é o cabeçalho
          </label>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Coluna da data" htmlFor="imp-date">{select(mapping.date, (n) => setMapping({ ...mapping, date: n }), "imp-date")}</Field>
            <Field label="Coluna da descrição" htmlFor="imp-desc">{select(mapping.description, (n) => setMapping({ ...mapping, description: n }), "imp-desc")}</Field>
            <Field label="Coluna do valor" htmlFor="imp-amount">{select(mapping.amount, (n) => setMapping({ ...mapping, amount: n }), "imp-amount")}</Field>
          </div>
          {!destination && (
            <Field label="Sinal dos valores" htmlFor="imp-sign">
              <select id="imp-sign" value={mapping.signMode} onChange={(e) => setMapping({ ...mapping, signMode: e.target.value as SignMode })} className={inputClass}>
                <option value="auto">Negativo é despesa e positivo é renda (extrato)</option>
                <option value="expense">Tudo é despesa (valores positivos)</option>
                <option value="income">Tudo é renda</option>
              </select>
            </Field>
          )}
          <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
            <Field label="Nome deste mapeamento" hint="(ex.: Nubank fatura; reaplicado sozinho da próxima vez)" htmlFor="imp-bank">
              <input id="imp-bank" value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="Opcional" className={inputClass} />
            </Field>
            <label className="flex min-h-10 items-center gap-2 text-[13px] text-ink2">
              <input type="checkbox" checked={saveMapping} onChange={(e) => setSaveMapping(e.target.checked)} />
              Salvar
            </label>
          </div>
          <div className="flex justify-between gap-2 pt-1">
            <Button type="button" variant="secondary" onClick={() => { setStep("file"); setError(""); }}>Voltar</Button>
            <Button type="button" onClick={toPreview}>Pré-visualizar</Button>
          </div>
        </>
      )}

      {step === "preview" && (
        <>
          <p className="text-[13px] text-ink2">
            <b>{chosen.length}</b> de {preview.length} linhas marcadas para importar
            {totalOut > 0 && <> · despesas <b className="num">{formatBRL(totalOut)}</b></>}
            {totalIn > 0 && <> · rendas <b className="num">{formatBRL(totalIn)}</b></>}.
          </p>
          {duplicates.length > 0 && (
            <label className="flex items-center gap-2 text-[13px] text-ink2">
              <input type="checkbox" checked={showDuplicates} onChange={(e) => setShowDuplicates(e.target.checked)} />
              Mostrar as {duplicates.length} que já existem (duplicadas; ficam desmarcadas, e você pode marcar para importar mesmo assim)
            </label>
          )}
          {skipped.length > 0 && (
            <p className="text-[12.5px] text-muted-foreground">
              {skipped.length} {skipped.length === 1 ? "linha foi ignorada" : "linhas foram ignoradas"}: {skipped.slice(0, 4).map((s) => `linha ${s.line} (${s.reason})`).join(", ")}{skipped.length > 4 ? "…" : ""}.
            </p>
          )}

          <ul className="flex max-h-[42vh] flex-col divide-y divide-border overflow-y-auto rounded-md border border-border">
            {visible.map((r) => (
              <li key={r.key} className={`grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-1.5 px-3 py-2 text-[13px] sm:grid-cols-[auto_1fr_auto_170px] ${included.has(r.key) ? "" : "opacity-60"}`}>
                <input type="checkbox" aria-label={`Importar ${r.description}`} checked={included.has(r.key)} onChange={() => toggle(r.key)} />
                <div className="min-w-0">
                  <span className="block break-words font-semibold">{r.description}</span>
                  <span className="text-[12px] text-muted-foreground">
                    {formatPaymentDate(r.date)}
                    {r.duplicate && " · já existe"}
                  </span>
                </div>
                <b className={`num col-start-2 sm:col-start-auto ${r.type === "income" ? "text-success" : ""}`}>{r.type === "income" ? "+" : ""}{formatBRL(r.amount)}</b>
                {r.type === "expense" ? (
                  <select aria-label={`Categoria de ${r.description}`} value={r.category} onChange={(e) => setRowCategory(r.key, e.target.value)} className={`${inputClass} col-start-2 sm:col-start-auto`}>
                    {[...new Set([...categoryNames, r.category])].map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                ) : (
                  <span className="col-start-2 text-[12px] text-muted-foreground sm:col-start-auto">Renda</span>
                )}
              </li>
            ))}
          </ul>

          <details className="rounded-md border border-border">
            <summary className="cursor-pointer select-none px-3 py-2.5 text-[13px] font-semibold text-ink2">Regras de categoria ({prefs.rules.length}) <span className="font-normal text-muted-foreground">(descrição contém → categoria)</span></summary>
            <div className="flex flex-col gap-3 px-3 pb-3">
              {prefs.rules.length > 0 && (
                <ul className="flex flex-col gap-1.5 text-[13px]">
                  {prefs.rules.map((r) => (
                    <li key={r.id} className="flex items-center justify-between gap-2">
                      <span className="min-w-0 break-words">“{r.contains}” → <b>{r.category}</b></span>
                      <button type="button" onClick={() => prefs.removeRule(r.id)} className="text-[12px] font-semibold text-muted-foreground hover:text-destructive hover:underline">Remover</button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="grid gap-2 sm:grid-cols-[1fr_170px_auto] sm:items-end">
                <Field label="Descrição contém" htmlFor="imp-rule">
                  <input id="imp-rule" value={ruleText} onChange={(e) => setRuleText(e.target.value)} placeholder="Ex.: uber" className={inputClass} />
                </Field>
                <Field label="Categoria" htmlFor="imp-rule-cat">
                  <select id="imp-rule-cat" value={ruleCategory} onChange={(e) => setRuleCategory(e.target.value)} className={inputClass}>
                    {categoryNames.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </Field>
                <Button type="button" variant="secondary" onClick={addRule} disabled={ruleText.trim().length < 2}>Adicionar regra</Button>
              </div>
              <p className="text-xs text-muted-foreground">A regra vale daqui para frente e muda a categoria das linhas que você ainda não editou.</p>
            </div>
          </details>

          <div className="flex justify-between gap-2 pt-1">
            <Button type="button" variant="secondary" onClick={() => setStep("map")}>Voltar</Button>
            <Button type="button" onClick={confirm} disabled={chosen.length === 0}>Importar {chosen.length} {chosen.length === 1 ? "lançamento" : "lançamentos"}</Button>
          </div>
        </>
      )}
    </div>
  );
}
