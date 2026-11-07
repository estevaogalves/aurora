type Props = {
  active?: boolean;
  payload?: any[];
  label?: string;
};

export const CustomRadarTooltip = ({
  active,
  payload,
  label,
}: Props) => {
  if (!active || !payload?.length) return null;

  return (
    <div className="bg-card border border-border rounded-xl p-4 shadow-lg min-w-[180px]">
      {/* Categoria */}
      <p className="text-foreground font-bold text-lg mb-2">{label}</p>

      {/* Séries */}
      <div className="space-y-2">
        {payload.map((item, index) => {
          const name = item.name; // jan / fev
          const value = item.value ?? 0;

          const color =
            name === "jan" ? "bg-primary" : "bg-blue-700";

          const labelName =
            name === "jan" ? "Janeiro" : name === "fev" ? "Fevereiro" : name;

          return (
            <div key={index} className="flex justify-between text-sm">
              <section className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${color} shrink-0`} />
                <span className="text-muted-foreground font-medium">
                  {labelName}
                </span>
              </section>

              <span className="text-foreground font-bold">
                R$ {Number(value).toLocaleString()}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};