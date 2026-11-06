import { Cell, Pie, PieChart } from "recharts";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../../components/ui/card";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "../../../components/ui/chart";
import { categoryColors } from "../../../Utils/categoryColors";

export type Category =
  | "Moradia"
  | "Transporte"
  | "Alimentação"
  | "Saúde"
  | "Educação"
  | "Lazer"
  | "Serviços"
  | "Outros"
  | "Renda"
  | "Crédito/Parcelado";

// 🔹 MOCK (mesmo estilo que você já usa)
const data: { name: Category; value: number }[] = [
  { name: "Moradia", value: 1200 },
  { name: "Transporte", value: 500 },
  { name: "Alimentação", value: 800 },
  { name: "Saúde", value: 300 },
  { name: "Educação", value: 400 },
  { name: "Lazer", value: 250 },
  { name: "Serviços", value: 600 },
  { name: "Outros", value: 150 },
];

// 🔹 padronização ChartConfig (igual seu outro gráfico)
const chartConfig = {
  value: {
    label: "Gastos por categoria",
  },
} satisfies ChartConfig;

export default function CategoryPieChart() {
  const sortedData = data.slice().sort((a, b) => b.value - a.value);

  return (
    <Card className="bg-slate-900 border-slate-600">
      <CardHeader>
        <CardTitle className="text-xl font-bold text-white">
          Total de Gastos por Categoria
        </CardTitle>
      </CardHeader>

      <CardContent>
        <div className="h-[500px] flex items-center">
          <ChartContainer
            config={chartConfig}
            className="mx-auto w-[600px] h-[600px]"
          >
            <PieChart width={600} height={600}>
              <ChartTooltip content={<ChartTooltipContent hideLabel />} />

              <Pie
                data={sortedData}
                dataKey="value"
                nameKey="name"
                outerRadius={160}
                innerRadius={60}
                paddingAngle={2}
                label={({
                  cx,
                  cy,
                  midAngle,
                  outerRadius,
                  percent,
                  name,
                }: any) => {
                  const RADIAN = Math.PI / 180;
                  const radius = outerRadius + 25;

                  const x = cx + radius * Math.cos(-midAngle * RADIAN);
                  const y = cy + radius * Math.sin(-midAngle * RADIAN);

                  return (
                    <text
                      x={x}
                      y={y}
                      textAnchor={x > cx ? "start" : "end"}
                      dominantBaseline="central"
                    >
                      {/* NOME */}
                      <tspan
                        x={x}
                        dy={-6}
                        fill="#e2e8f0"
                        fontSize={16}
                        fontWeight={700}
                      >
                        {name}
                      </tspan>

                      {/* % */}
                      <tspan
                        x={x}
                        dy={18}
                        fill="#94a3b8"
                        fontSize={14}
                        fontWeight={500}
                      >
                        {`${((percent ?? 0) * 100).toFixed(0)}%`}
                      </tspan>
                    </text>
                  );
                }}
              >
                {sortedData.map((entry) => (
                  <Cell key={entry.name} fill={categoryColors[entry.name]} />
                ))}
              </Pie>
            </PieChart>
          </ChartContainer>
        </div>
      </CardContent>
    </Card>
  );
}
