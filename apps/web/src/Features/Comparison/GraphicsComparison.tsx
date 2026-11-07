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
    <div className=" mt-6">
      <Tabs defaultValue="bars">
        <TabsList className="flex justify-start gap-3 bg-transparent p-0 h-auto mb-6">
          <TabsTrigger
            value="bars"
            className="gap-2 rounded-lg px-4 py-2 text-md font-semibold bg-card border border-border text-muted-foreground transition hover:bg-secondary hover:text-foreground data-[state=active]:bg-secondary data-[state=active]:text-foreground data-[state=active]:border-border"
          >
            <VscGraph />
            Barras
          </TabsTrigger>

          <TabsTrigger
            value="radar"
            className="gap-2 rounded-lg px-4 py-2 text-md font-semibold bg-card border border-border text-muted-foreground transition hover:bg-secondary hover:text-foreground data-[state=active]:bg-secondary data-[state=active]:text-foreground data-[state=active]:border-border"
          >
            <TbActivityHeartbeat />
            Radar
          </TabsTrigger>

          <TabsTrigger
            value="category"
            className="gap-2 rounded-lg px-4 py-2 text-md font-semibold bg-card border border-border text-muted-foreground transition hover:bg-secondary hover:text-foreground data-[state=active]:bg-secondary data-[state=active]:text-foreground data-[state=active]:border-border"
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
