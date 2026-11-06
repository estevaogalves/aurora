import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle
} from "../../../components/ui/card";

import { CustomTooltip } from "../../../Custom/CustomToolTip";

export default function BarGraph() {
  const data = [
    { name: "Jan", income: 3200, expense: 2100 },
    { name: "Fev", income: 2800, expense: 3100 }, // 👈 negativo
    { name: "Mar", income: 3500, expense: 2200 },
    { name: "Abr", income: 3000, expense: 3500 }, // 👈 negativo
    { name: "Mai", income: 4000, expense: 2700 },
  ].map((item) => ({
    ...item,
    balance: item.income - item.expense,
  }));

  return (
    <Card className="bg-slate-900 border-slate-600 rounded-xl">
      {/* HEADER */}
      <CardHeader>
        <CardTitle className="text-xl text-white font-bold">
          Comparaçã: Renda vs Despesas
        </CardTitle>
      </CardHeader>

      {/* CONTEÚDO */}
      <CardContent>
        <div className="w-full h-[500px]">
          <ResponsiveContainer>
            <BarChart
              data={data}
              margin={{ top: 5, right: 0, left: 0, bottom: 5 }}
              barSize={30}
            >
              {/* GRID */}
              <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />

              {/* EIXO X */}
              <XAxis
                dataKey="name"
                stroke="#64748b"
                tick={{ fill: "#cbd5f5", fontSize: 14, fontWeight: 600 }}
                tickLine={false}
                axisLine={false}
              />

              {/* EIXO Y */}
              <YAxis
                stroke="#64748b"
                tick={{ fill: "#94a3b8" }}
                tickLine={false}
                axisLine={false}
              />

              {/* LINHA DO ZERO */}
              <ReferenceLine y={0} stroke="#475569" strokeWidth={2} />

              {/* TOOLTIP */}
              <Tooltip content={<CustomTooltip showBalance />} />

              {/* LEGENDA */}
              <Legend
                formatter={(value) => {
                  const config = {
                    income: "Renda",
                    expense: "Despesas",
                    balance: "Saldo",
                  };

                  return (
                    <span style={{ color: "#cbd5f5", fontWeight: 600 }}>
                      {config[value as keyof typeof config]}
                    </span>
                  );
                }}
              />

              {/* BARRAS */}
              <Bar dataKey="income" fill="#16a34a" radius={[5, 5, 0, 0]} />

              <Bar dataKey="expense" fill="#dc2626" radius={[5, 5, 0, 0]} />

              {/* SALDO (pode descer 👇) */}
              <Bar dataKey="balance" fill="#3b82f6" radius={[5, 5, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
