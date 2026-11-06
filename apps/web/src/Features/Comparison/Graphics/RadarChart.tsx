import {
  Legend,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle
} from "../../../components/ui/card";
import { CustomRadarTooltip } from "../../../Custom/CustomRadarToolTip";


export default function RadarGraph() {
  const data = [
    { subject: "Moradia", jan: 1200, fev: 1000 },
    { subject: "Transporte", jan: 400, fev: 600 },
    { subject: "Alimentação", jan: 900, fev: 800 },
    { subject: "Saúde", jan: 300, fev: 200 },
    { subject: "Educação", jan: 500, fev: 450 },
    { subject: "Lazer", jan: 350, fev: 500 },
    { subject: "Serviços", jan: 250, fev: 200 },
    { subject: "Outros", jan: 200, fev: 300 },
  ];

  return (
    <Card className="bg-slate-900 border-slate-600 rounded-xl">
      {/* HEADER */}
      <CardHeader>
        <CardTitle className="text-xl text-white font-bold">
          Comparação por Categoria
        </CardTitle>
      </CardHeader>

      {/* CONTEÚDO */}
      <CardContent>
        <div className="w-full h-[500px]">
          <ResponsiveContainer>
            <RadarChart data={data} outerRadius="70%">
              
              {/* GRID */}
              <PolarGrid stroke="#1e293b" />

              {/* CATEGORIAS */}
              <PolarAngleAxis
                dataKey="subject"
                tick={{ fill: "#cbd5f5", fontSize: 14, fontWeight: 600 }}
              />

              {/* ESCALA */}
              <PolarRadiusAxis
                tick={{ fill: "#94a3b8", fontSize: 12 }}
                axisLine={false}
              />

              {/* TOOLTIP */}
              <Tooltip content={<CustomRadarTooltip />} />

              {/* LEGENDA */}
              <Legend
                formatter={(value) => (
                  <span style={{ color: "#cbd5f5", fontWeight: 600 }}>
                    {value === "jan" ? "Janeiro" : "Fevereiro"}
                  </span>
                )}
              />

              {/* RADAR MÊS 1 */}
              <Radar
                name="jan"
                dataKey="jan"
                stroke="#16a34a"
                fill="#16a34a"
                fillOpacity={0.5}
              />

              {/* RADAR MÊS 2 */}
              <Radar
                name="fev"
                dataKey="fev"
                stroke="#3b82f6"
                fill="#3b82f6"
                fillOpacity={0.4}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}