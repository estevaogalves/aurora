type Props = {
  active?: boolean;
  payload?: any[];
  label?: string;
};

export const CustomCategoryToolTip = ({ active, payload }: Props) => {
  if (!active || !payload?.length) return null;

  const data = payload[0];

  return (
    <div className="bg-card border border-border rounded-xl p-4 shadow-lg min-w-[200px]">
      {/* Categoria */}
      <p className="text-foreground font-bold text-lg mb-3">
        {data.name || data.payload?.category}
      </p>

      {/* Valor */}
      <div className="flex justify-between text-sm">
        <section className="flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full shrink-0"
            style={{ backgroundColor: data.payload?.fill }}
          />
          <span className="text-muted-foreground font-medium">Valor</span>
        </section>

        <span className="text-foreground font-bold">
          R$ {Number(data.value || 0).toLocaleString("pt-BR")}
        </span>
      </div>
    </div>
  );
};