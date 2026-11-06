import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../../components/ui/card";

import { CustomTooltip } from "../../../Custom/CustomToolTip";

export default function LineGraph() {
  const data = [
    { name: "Jan", income: 3200, expense: 2100 },
    { name: "Fev", income: 2800, expense: 1900 },
    { name: "Mar", income: 3500, expense: 2200 },
    { name: "Abr", income: 3000, expense: 2500 },
    { name: "Mai", income: 4000, expense: 2700 },
  ].map((item) => ({
    ...item,
    balance: item.income - item.expense,
  }));

  return (
    <Card className="bg-slate-900 border-slate-600 rounded-xl w-[1440px]">
      {/* HEADER */}
      <CardHeader>
        <CardTitle className="text-xl text-white font-bold">
          Visão da Projeção
        </CardTitle>
        <CardDescription className="text-base text-slate-300">
          Acompanhe o desempenho passado e as estimativas dos próximos meses.
        </CardDescription>
      </CardHeader>

      {/* CONTEÚDO */}
      <CardContent>
        <div className="w-full h-[500px]">
          <ResponsiveContainer>
            <LineChart
              data={data}
              margin={{ top: 5, right: 0, left: 0, bottom: 5 }}
            >
              {/* GRID */}
              <CartesianGrid
                stroke="#1e293b"
                strokeDasharray="3 3"
                vertical={false}
              />
              {/* EIXOS */}
               <XAxis
                dataKey="name"
                stroke="#64748b" // cor da linha do eixo
                tick={{ fill: "#cbd5f5", fontSize: 16, fontWeight: 600 }}
              />
              <YAxis stroke="#94a3b8" />
              {/* TOOLTIP */}
              <Tooltip content={<CustomTooltip showBalance={true}/>} />
              {/* LEGENDA */}
              <Legend
                formatter={(value) => {
                  const label =
                    value === "income"
                      ? "Renda"
                      : value === "expense"
                        ? "Despesas"
                        : "Saldo";

                  return (
                    <span style={{ color: "#cbd5f5", fontWeight: 600 }}>
                      {label}
                    </span>
                  );
                }}
              />
              
              {/* LINHAS */}
              <Line
                type="monotone"
                dataKey="income"
                stroke="#16a34a"
                strokeWidth={3}
                dot={{ r: 4 }}
                activeDot={{ r: 7 }}
              />
              <Line
                type="monotone"
                dataKey="expense"
                stroke="#dc2626"
                strokeWidth={3}
                dot={{ r: 4 }}
                activeDot={{ r: 7 }}
              />
              <Line
                type="monotone"
                dataKey="balance"
                stroke="#3b82f6"
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={{ r: 3 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
