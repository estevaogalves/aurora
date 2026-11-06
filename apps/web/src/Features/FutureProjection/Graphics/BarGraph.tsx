import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
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

export default function BarGraph() {
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
          Visão da Projecão
        </CardTitle>
        <CardDescription className="text-base font-medium text-slate-300">
          Acompanhe o desempenho passado e as estimativas dos próximos meses.
        </CardDescription>
      </CardHeader>

      {/* CONTEÚDO */}
      <CardContent>
        <div className="w-s h-[500px]">
          <ResponsiveContainer>
            <BarChart
              data={data}
              margin={{ top: 5, right: 0, left: 0, bottom: 5 }}
              barSize={35}
            >
              <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
              <XAxis
                dataKey="name"
                stroke="#64748b" // cor da linha do eixo
                tick={{ fill: "#cbd5f5", fontSize: 16, fontWeight: 600 }}
              />
              <YAxis />
              <Tooltip content={<CustomTooltip showBalance={false} />} />
              <Legend
                formatter={(value) => (
                  <span style={{ color: "#cbd5f5", fontWeight: 600 }}>
                    {value}
                  </span>
                )}
              />

              <Bar dataKey="income" fill="#16a34a" radius={[5, 5, 0, 0]} />
              <Bar dataKey="expense" fill="#dc2626" radius={[5, 5, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
