import { useState } from "react";
import { Field, inputClass } from "@/components/shared/FormFields";
import { MAX_TAGS, MAX_TAG_LENGTH, addTag, allTags } from "@/domain";
import { useFinanceStore } from "@/Store/FinanceStore";

/** Etiquetas livres do lançamento (Enter ou vírgula adiciona): servem para buscar e filtrar em Lançamentos. */
export default function TagsField({ id, value, onChange }: { id: string; value: string[]; onChange: (tags: string[]) => void }) {
  const [text, setText] = useState("");
  const transactions = useFinanceStore((s) => s.transactions);
  const suggestions = allTags(transactions).filter((t) => !value.some((v) => v.toLowerCase() === t.toLowerCase()));

  function commit() {
    if (text.trim()) onChange(addTag(value, text));
    setText("");
  }

  return (
    <Field label="Etiquetas" hint="(opcional)" htmlFor={id}>
      {value.length > 0 && (
        <ul className="mb-1.5 flex flex-wrap gap-1.5">
          {value.map((t) => (
            <li key={t} className="inline-flex items-center gap-1 rounded-full bg-pill px-2.5 py-0.5 text-[12px] font-semibold text-pill-foreground">
              {t}
              <button type="button" aria-label={`Remover a etiqueta ${t}`} onClick={() => onChange(value.filter((x) => x !== t))} className="text-[13px] leading-none opacity-70 hover:opacity-100">×</button>
            </li>
          ))}
        </ul>
      )}
      <input
        id={id}
        value={text}
        list={`${id}-list`}
        maxLength={MAX_TAG_LENGTH}
        disabled={value.length >= MAX_TAGS}
        onChange={(e) => (e.target.value.includes(",") ? (onChange(addTag(value, e.target.value.replace(",", ""))), setText("")) : setText(e.target.value))}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); commit(); } }}
        onBlur={commit}
        placeholder={value.length >= MAX_TAGS ? `No máximo ${MAX_TAGS} etiquetas` : "Ex.: viagem, Heitor (Enter adiciona)"}
        className={inputClass}
      />
      <datalist id={`${id}-list`}>{suggestions.map((t) => <option key={t} value={t} />)}</datalist>
    </Field>
  );
}
