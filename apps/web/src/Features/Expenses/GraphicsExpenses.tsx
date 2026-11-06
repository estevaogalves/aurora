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
import { useFinanceStore } from "../../Store/FinanceStore";
import { Category } from "../../Types/Category";
import { categoryColors } from "../../Utils/categoryColors";

export default function GraphicsExpenses() {
  const transactions = useFinanceStore((state) => state.transactions);
  const getTotals = useFinanceStore((state) => state.getTotals);

  const totals = getTotals();
  const totalExpense = totals.totalExpense;

  const creditTransactions = useFinanceStore(
    (state) => state.creditTransactions
  )

  const creditExpenses = creditTransactions.map((credit) => ({
    amount: credit.totalAmount / credit.installments,
    category: "Crédito/Parcelado" as Category
  }))

  const allExpenses = [
    ...transactions.filter((t) => t.type === "expense"),
    ...creditExpenses
  ]

  const chartData = Object.values(
    allExpenses.reduce(
      (acc, expense) => {
        if (!acc[expense.category]) {
          acc[expense.category] = {
            category: expense.category,
            value: 0,
            fill: categoryColors[expense.category],
          };
        }
        console.log(expense.category, categoryColors[expense.category]);
        

        acc[expense.category].value += expense.amount;

        return acc;
      },
      {} as Record<string, { category: string; value: number; fill: string }>,
    ),
  );

  console.log(transactions);

  const chartConfig = {
    value: {
      label: "Valor",
    },
  } satisfies ChartConfig;

  return (
    <div className="mt-6">
      <Card className="bg-slate-900 border-slate-600 ">
        <CardHeader>
          <CardTitle className="text-xl font-bold font-sans text-white">
            Visão geral dos gastos
          </CardTitle>
          <CardDescription className="text-base font-sans font-medium text-gray-300">
            Total: R$ {totalExpense.toLocaleString("pt-BR")} em{" "}
            {allExpenses.length} despesas
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="category" className="w-full">
            {/* Tabs */}
            <TabsList className="border p-1 rounded-lg w-full h-[45px] bg-slate-900 border-slate-600">
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
              className="grid grid-cols-2 gap-8 items-center mt-6"
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
                      className="mx-auto aspect-square w-[350px]"
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
                          <div key={index} className="flex items-center gap-3">
                            <span
                              className="h-4 w-4 rounded-full"
                              style={{ backgroundColor: item.fill }}
                            />
                            <span className="flex-1 text-lg text-gray-300 font-medium">
                              {item.category}
                            </span>
                            <span className="font-mono text-lg text-white">
                              R$ {item.value.toLocaleString("pt-BR")}
                            </span>
                            <span className="w-14 text-right font-mono font-medium text-slate-300 text-base text-muted-foreground">
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
                        tickFormatter={(value: number) =>
                          `R$ ${value.toLocaleString("pt-BR")}`
                        }
                      />
                      <ChartTooltip
                        cursor={false}
                        content={({ active, payload }) => {
                          if (!active || !payload?.length) return null;

                          const data = payload[0].payload;

                          return (
                            <div className="bg-white border rounded-md p-2 shadow-sm text-sm">
                              <p className="font-medium">{data.category}</p>
                              <p className="font-mono">
                                R$ {data.value.toLocaleString("pt-BR")}
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
