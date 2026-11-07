// ARQUIVO QUE MOSTRA OS CARDS (PIXXA E BARRA)
import { Bar, BarChart, Cell, Pie, PieChart, XAxis, YAxis } from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "../../components/ui/chart";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../../components/ui/tabs";
import { formatBRL, toCents, toReais } from "../../lib/money";
import {
  useCategoryTotals,
  useMonthCredit,
  useMonthSummary,
  useMonthTransactions,
} from "../../Store/selectors";
import { categoryColors } from "../../Utils/categoryColors";

export default function GraphicsExpenses() {
  const { totalExpense } = useMonthSummary();
  const categoryTotals = useCategoryTotals();

  const expensesCount =
    useMonthTransactions().filter((t) => t.type === "expense").length +
    useMonthCredit().length;

  // `value` em reais só serve de escala para os gráficos; os textos usam centavos
  const chartData = categoryTotals.map(({ category, value }) => ({
    category,
    cents: value,
    value: toReais(value),
    fill: categoryColors[category],
  }));

  const money = (reais: number) => formatBRL(toCents(reais));

  const chartConfig = {
    value: {
      label: "Valor",
    },
  } satisfies ChartConfig;

  return (
    <div className="mt-6">
      <Card className="bg-card border-border ">
        <CardHeader>
          <CardTitle className="text-xl font-bold font-sans text-foreground">
            Visão geral dos gastos
          </CardTitle>
          <CardDescription className="text-base font-sans font-medium text-foreground/80">
            Total: {formatBRL(totalExpense)} em {expensesCount}{" "}
            {expensesCount === 1 ? "despesa" : "despesas"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="category" className="w-full">
            {/* Tabs */}
            <TabsList className="border p-1 rounded-lg w-full h-[45px] bg-card border-border">
              <TabsTrigger
                value="category"
                className="flex-1 rounded-md text-lg font-semibold"
              >
                Por Categoria
              </TabsTrigger>

              <TabsTrigger
                value="expense"
                className="flex-1 rounded-md text-lg font-semibold"
              >
                Por Despesa
              </TabsTrigger>
            </TabsList>
            <TabsContent
              value="category"
              className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center mt-6"
            >
              {(() => {
                // cria uma cópia e ordena do maior para o menor
                const sortedChartData = chartData
                  .slice()
                  .sort((a, b) => b.value - a.value);
                const total = sortedChartData.reduce(
                  (acc, curr) => acc + curr.value,
                  0,
                );

                return (
                  <>
                    <ChartContainer
                      config={chartConfig}
                      className="mx-auto aspect-square w-full max-w-[350px]"
                    >
                      <PieChart>
                        <ChartTooltip
                          cursor={false}
                          content={<ChartTooltipContent hideLabel />}
                        />
                        <Pie
                          data={sortedChartData}
                          dataKey="value"
                          nameKey="category"
                          innerRadius={30}
                          outerRadius={120}
                          paddingAngle={1}
                          label={({ percent }) =>
                            `${(percent * 100).toFixed(0)}%`
                          }
                        >
                          {sortedChartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.fill} />
                          ))}
                        </Pie>
                      </PieChart>
                    </ChartContainer>

                    <div className="flex flex-col gap-3 w-full">
                      {sortedChartData.map((item, index) => {
                        const percentage = ((item.value / total) * 100).toFixed(
                          1,
                        );
                        return (
                          <div key={index} className="flex flex-wrap items-center gap-x-3 gap-y-1">
                            <span
                              className="h-4 w-4 rounded-full"
                              style={{ backgroundColor: item.fill }}
                            />
                            <span className="flex-1 text-lg text-foreground/80 font-medium">
                              {item.category}
                            </span>
                            <span className="font-mono text-lg text-foreground">
                              {formatBRL(item.cents)}
                            </span>
                            <span className="w-14 text-right font-mono font-medium text-foreground/80 text-base text-muted-foreground">
                              {percentage}%
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </>
                );
              })()}
            </TabsContent>

            <TabsContent value="expense" className="w-full mt-6">
              {/* cria uma cópia do chartData e ordena do maior para o menor */}
              {(() => {
                const sortedChartData = chartData
                  .slice()
                  .sort((a, b) => b.value - a.value);
                return (
                  <ChartContainer
                    config={chartConfig}
                    className="h-[400px] w-full"
                  >
                    <BarChart
                      data={sortedChartData}
                      layout="vertical"
                      barCategoryGap={17}
                      margin={{ left: 20, right: 20 }}
                    >
                      <YAxis
                        dataKey="category"
                        type="category"
                        tickLine={false}
                        axisLine={false}
                        tick={{ fill: "#ffffff", fontSize: 12 }}
                        style={{ fill: "#fff" }}
                      />
                      <XAxis
                        type="number"
                        tick={{ fill: "#ffffff", fontSize: 12 }}
                        style={{ fill: "#fff" }}
                        axisLine={{ stroke: "#ffffff" }}
                        tickLine={{ stroke: "#ffffff" }}
                        tickFormatter={(value: number) => money(value)}
                      />
                      <ChartTooltip
                        cursor={false}
                        content={({ active, payload }) => {
                          if (!active || !payload?.length) return null;

                          const data = payload[0].payload;

                          return (
                            <div className="bg-foreground border rounded-md p-2 shadow-sm text-sm">
                              <p className="font-medium">{data.category}</p>
                              <p className="font-mono">
                                {formatBRL(data.cents)}
                              </p>
                            </div>
                          );
                        }}
                      />
                      <Bar
                        dataKey="value"
                        layout="vertical"
                        radius={5}
                        barSize={30}
                      >
                        {sortedChartData.map((entry, index) => (
                          <Cell key={index} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ChartContainer>
                );
              })()}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
