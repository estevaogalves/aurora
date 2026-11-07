import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Cell,
  Tooltip,
} from "recharts";
import { FaArrowTrendUp, FaRegLightbulb } from "react-icons/fa6";
import { IoMdCheckmarkCircleOutline } from "react-icons/io";
import { formatBRL } from "../../lib/money";
import { DISTRIBUTION } from "../../domain";
import { useDistribution, useMonthSummary } from "../../Store/selectors";

export default function CardPositive() {
  const { balance } = useMonthSummary();
  const { emergency, education, invest, costs, leisure } = useDistribution();
  const percentOf = (key: (typeof DISTRIBUTION)[number]["key"]) =>
    DISTRIBUTION.find((d) => d.key === key)!.percent;

  // 🟢 DADOS UNIFICADOS para um único gráfico
  const chartData = [
    {
      category: "Reserva de Emergência",
      value: emergency,
      fill: "#3b82f6",
      percent: percentOf("emergency"),
    },
    { category: "Investimentos", value: invest, fill: "#22c55e", percent: percentOf("invest") },
    {
      category: "Lazer e Bem-estar",
      value: leisure,
      fill: "#a855f7",
      percent: percentOf("leisure"),
    },
    { category: "Educação", value: education, fill: "#eab308", percent: percentOf("education") },
    { category: "Gastos Pessoais", value: costs, fill: "#ef4444", percent: percentOf("costs") },
  ].sort((a, b) => b.value - a.value);

  // 🟢 Tooltip personalizado
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-secondary border border-border rounded-lg p-3 shadow-lg">
          <p className="text-foreground font-medium text-sm mb-1">{data.category}</p>
          <p className="text-success font-bold">
            {formatBRL(data.value)}
          </p>
          <p className="text-muted-foreground text-xs mt-1">
            {data.percent}% do saldo
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div>
      <Card className="bg-card border-border">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="text-2xl border px-1.5 py-1.5 rounded-lg bg-primary/10 text-primary border-primary">
              <FaRegLightbulb />
            </div>
            <section>
              <CardTitle className="text-xl font-sans font-bold text-foreground">
                Dicas para o seu dinheiro
              </CardTitle>
              <CardDescription className="text-md font-sans font-medium text-foreground/80">
                Você tem{" "}
                <span>
                  <strong>{formatBRL(balance)}</strong>
                </span>{" "}
                para distribuir
              </CardDescription>
            </section>
          </div>
        </CardHeader>

        <CardContent>
          <div className="space-y-6 max-w-2xl mx-auto">
            <div className="flex flex-col gap-3">
              <section className="flex items-start gap-2">
                <span className="flex-shrink-0 mt-1 border rounded-lg bg-primary/10 text-primary border-primary p-1">
                  <IoMdCheckmarkCircleOutline className="text-primary" />
                </span>
                <p className="text-base font-medium text-foreground/80 mt-1">
                  Parabéns! Você mantém um bom controle dos gastos fixos.
                  Continue assim!
                </p>
              </section>

              <section className="flex items-start gap-2">
                <span className="flex-shrink-0 mt-1 border rounded-lg bg-primary/10 text-primary border-primary p-1">
                  <IoMdCheckmarkCircleOutline className="text-primary" />
                </span>
                <p className="text-base font-medium text-foreground/80 mt-1">
                  Use a distribuição sugerida abaixo para otimizar cada real do
                  seu saldo restante.
                </p>
              </section>
            </div>

            {/* GRÁFICO ÚNICO COM TODAS AS CATEGORIAS */}
            <div className="mt-6">
              <section className="flex items-center gap-2 mb-4">
                <FaArrowTrendUp className="text-primary text-xl" />
                <h1 className="text-base font-medium text-foreground/80">
                  Distribuição sugerida do saldo
                </h1>
              </section>

              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={chartData}
                    layout="vertical"
                    barCategoryGap={17}
                    margin={{ left: 20, right: 20 }}
                  >
                    <YAxis
                      dataKey="category"
                      type="category"
                      tickLine={false}
                      axisLine={false}
                      tick={{ fill: "#ffffff", fontSize: 10 }}
                      style={{ fill: "#fff" }}
                    />
                    <XAxis
                      type="number"
                      tick={{ fill: "#ffffff", fontSize: 12 }}
                      style={{ fill: "#fff" }}
                      axisLine={{ stroke: "#ffffff" }}
                      tickLine={{ stroke: "#ffffff" }}
                      tickFormatter={(value) => formatBRL(value)}
                    />
                    
                    <Tooltip 
                      content={<CustomTooltip />}
                      cursor={{ fill: 'rgba(255, 255, 255, 0.1)' }}
                    />
                    
                    <Bar
                      dataKey="value"
                      layout="vertical"
                      radius={5}
                      barSize={30}
                      isAnimationActive={true}
                      animationDuration={500}
                    >
                      {chartData.map((entry, index) => (
                        <Cell key={index} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Legenda com valores */}
              <div className="grid grid-cols-2 gap-3 mt-4">
                {chartData.map((item) => (
                  <div key={item.category} className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: item.fill }}
                    />
                    <span className="text-sm text-foreground/80">
                      {item.category}
                    </span>
                    <span className="text-sm text-foreground font-medium ml-auto">
                      {formatBRL(item.value)} ({item.percent}%)
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}