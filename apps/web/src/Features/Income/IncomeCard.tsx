import { useRef } from "react";
import { FaTrash } from "react-icons/fa";
import { PiPushPinDuotone } from "react-icons/pi";
import { Card } from "../../components/ui/card";
import { centsToInput, formatBRL, parseBRL, sanitizeAmountInput } from "../../lib/money";

export default function IncomeCard({
  income,
  editingName,
  tempName,
  setEditingName,
  setTempName,
  handleUpdateName,

  editingAmount,
  tempAmount,
  setEditingAmount,
  setTempAmount,
  handleUpdateAmount,

  handleToggleFixed,

  setIncomeToDelete,
  setShowWarning,
}: any) {
  // Esc cancela: o blur que vem junto não pode salvar o texto descartado
  const cancelled = useRef(false);

  const commitAmount = () => {
    if (cancelled.current) {
      cancelled.current = false;
      return;
    }
    const cents = parseBRL(tempAmount);
    // vazio ou inválido: mantém o valor que já estava
    if (cents !== null && cents !== income.amount) {
      handleUpdateAmount(income.id, cents);
    }
    setEditingAmount(null);
  };

  return (
    <Card
      className="hover:bg-secondary bg-card border-border relative"
    >
      {income.fixed && (
        <div className="absolute -top-4 -right-4 z-10">
          <div className="bg-primary/20 border border-primary rounded-full p-1.5 shadow-md">
            <PiPushPinDuotone className="text-foreground rotate-20" size={16} />
          </div>
        </div>
      )}

      <div className="flex items-center justify-between m-4">
        <section className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full bg-primary" />

          {editingName === income.id ? (
            <input
              type="text"
              value={tempName}
              autoFocus
              onChange={(e) => setTempName(e.target.value)}
              onBlur={() => {
                if (tempName.trim()) {
                  handleUpdateName(income.id, tempName);
                }
                setEditingName(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  if (tempName.trim()) {
                    handleUpdateName(income.id, tempName);
                  }
                  setEditingName(null);
                }
              }}
              className="bg-secondary text-foreground font-bold text-lg px-2 py-1 rounded border border-primary outline-none w-[200px]"
            />
          ) : (
            <h2
              onClick={() => {
                setEditingName(income.id);
                setTempName(income.name);
              }}
              className="font-bold font-sans text-lg text-foreground cursor-pointer hover:text-primary transition-colors duration-300"
            >
              {income.name}
            </h2>
          )}
        </section>

        <section className="flex items-center gap-4 mr-4">
          {/* VALOR */}
          {editingAmount === income.id ? (
            <div className="flex items-center text-foreground border-2 bg-card border-primary rounded-lg px-3 py-2 w-fit">
              <span className="text-base font-bold text-foreground/80 mr-1">
                R$
              </span>
              <input
                type="text"
                inputMode="decimal"
                value={tempAmount}
                autoFocus
                onChange={(e) => setTempAmount(sanitizeAmountInput(e.target.value))}
                onBlur={commitAmount}
                onKeyDown={(e) => {
                  if (e.key === "Enter") e.currentTarget.blur();
                  if (e.key === "Escape") {
                    cancelled.current = true;
                    setEditingAmount(null);
                  }
                }}
                className="bg-transparent outline-none w-24 text-base font-bold"
              />
            </div>
          ) : (
            <span
              onClick={() => {
                setEditingAmount(income.id);
                setTempAmount(centsToInput(income.amount ?? 0));
              }}
              className="font-bold text-lg text-foreground hover:text-primary cursor-pointer transition-all duration-300"
            >
              {formatBRL(income.amount ?? 0)}
            </span>
          )}

          {/* FIXAR */}
          <button
            onClick={() => handleToggleFixed(income.id)}
            className={`p-2 rounded-lg border ${
              income.fixed
                ? "bg-primary/20 border-primary"
                : "hover:bg-primary/20 hover:border-primary"
            }`}
          >
            <PiPushPinDuotone
              className={
                income.fixed
                  ? "text-success"
                  : "text-foreground"
              }
            />
          </button>

          {/* EXCLUIR */}
          <button
            onClick={() => {
              setIncomeToDelete(income.id);
              setShowWarning(true);
            }}
            title={income.fixed ? "Ocultar neste mês" : "Remover"}
            className="p-2 rounded-lg border hover:bg-destructive/90 hover:border-destructive"
          >
            <FaTrash className="text-foreground" />
          </button>
        </section>
      </div>
    </Card>
  );
}