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
    <div className="bg-slate-900 border border-slate-700 rounded-xl p-4 shadow-lg min-w-[200px]">
      
      {/* Mês */}
      <p className="text-white font-bold text-lg mb-2">{label}</p>

      {/* Renda */}
      <div className="flex justify-between text-sm">
        <section className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-green-700 shrink-0" />
          <span className="text-slate-400 font-medium">Renda</span>
        </section>
        <span className="text-white font-bold">
          R$ {income.toLocaleString()}
        </span>
      </div>

      {/* Despesa */}
      <div className="flex justify-between text-sm">
        <section className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-red-700 shrink-0" />
          <span className="text-slate-400 font-medium">Despesa</span>
        </section>
        <span className="text-white font-bold">
          R$ {expense.toLocaleString()}
        </span>
      </div>

      {/* Saldo opcional */}
      {showBalance && (
        <>
          <div className="border-t border-slate-700 my-2" />

          <div className="flex justify-between text-sm">
            <span className="text-slate-400 font-medium">
              Saldo previsto
            </span>
            <span
              className={
                balance < 0
                  ? "text-red-500 font-bold"
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