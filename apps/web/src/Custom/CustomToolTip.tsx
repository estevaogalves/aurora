type Props = {
  active?: boolean;
  payload?: any[];
  label?: string;
  showBalance?: boolean;
};

export const CustomTooltip = ({
  active,
  payload,
  label,
  showBalance = true, // default
}: Props) => {
  if (!active || !payload?.length) return null;

  const income =
    payload.find((p) => p.dataKey === "income")?.value || 0;

  const expense =
    payload.find((p) => p.dataKey === "expense")?.value || 0;

  const balance = income - expense;

  return (
    <div className="bg-card border border-border rounded-xl p-4 shadow-lg min-w-[200px]">
      
      {/* Mês */}
      <p className="text-foreground font-bold text-lg mb-2">{label}</p>

      {/* Renda */}
      <div className="flex justify-between text-sm">
        <section className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-primary shrink-0" />
          <span className="text-muted-foreground font-medium">Renda</span>
        </section>
        <span className="text-foreground font-bold">
          R$ {income.toLocaleString()}
        </span>
      </div>

      {/* Despesa */}
      <div className="flex justify-between text-sm">
        <section className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-destructive shrink-0" />
          <span className="text-muted-foreground font-medium">Despesa</span>
        </section>
        <span className="text-foreground font-bold">
          R$ {expense.toLocaleString()}
        </span>
      </div>

      {/* Saldo opcional */}
      {showBalance && (
        <>
          <div className="border-t border-border my-2" />

          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground font-medium">
              Saldo previsto
            </span>
            <span
              className={
                balance < 0
                  ? "text-destructive font-bold"
                  : "text-blue-500 font-bold"
              }
            >
              {balance < 0 ? "- " : ""}R${" "}
              {Math.abs(balance).toLocaleString()}
            </span>
          </div>
        </>
      )}
    </div>
  );
};