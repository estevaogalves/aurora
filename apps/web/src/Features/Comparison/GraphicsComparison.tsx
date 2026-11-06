import { FaChartPie } from "react-icons/fa6";
import { TbActivityHeartbeat } from "react-icons/tb";
import { VscGraph } from "react-icons/vsc";
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from "../../components/ui/tabs";
import BarsGraph from "./Graphics/BarsGraph";
import CategoryGraph from "./Graphics/CategoryGraph";
import RadarChart from "./Graphics/RadarChart";


export default function GraphicsComparison() {
  return (
    <div className="mx-44 mt-6">
      <Tabs defaultValue="bars">
        <TabsList className="flex justify-start gap-3 bg-transparent p-0 h-auto mb-6">
          <TabsTrigger
            value="bars"
            className="gap-2 rounded-lg px-4 py-2 text-md font-semibold bg-slate-900 border border-slate-700 text-slate-400 transition hover:bg-slate-800 hover:text-white data-[state=active]:bg-slate-800 data-[state=active]:text-white data-[state=active]:border-slate-500"
          >
            <VscGraph />
            Barras
          </TabsTrigger>

          <TabsTrigger
            value="radar"
            className="gap-2 rounded-lg px-4 py-2 text-md font-semibold bg-slate-900 border border-slate-700 text-slate-400 transition hover:bg-slate-800 hover:text-white data-[state=active]:bg-slate-800 data-[state=active]:text-white data-[state=active]:border-slate-500"
          >
            <TbActivityHeartbeat />
            Radar
          </TabsTrigger>

          <TabsTrigger
            value="category"
            className="gap-2 rounded-lg px-4 py-2 text-md font-semibold bg-slate-900 border border-slate-700 text-slate-400 transition hover:bg-slate-800 hover:text-white data-[state=active]:bg-slate-800 data-[state=active]:text-white data-[state=active]:border-slate-500"
          >
            <FaChartPie />
            Categoria
          </TabsTrigger>
        </TabsList>

        <TabsContent value="bars">
          <BarsGraph />
        </TabsContent>
        <TabsContent value="radar">
          <RadarChart />
        </TabsContent>
        <TabsContent value="category">
          <CategoryGraph />
        </TabsContent>
      </Tabs>
    </div>
  );
}
