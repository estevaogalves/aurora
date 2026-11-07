import { TbActivityHeartbeat } from "react-icons/tb";
import { VscGraph } from "react-icons/vsc";
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from "../../components/ui/tabs";
import BarGraph from "./Graphics/BarGraph";
import LineGraph from "./Graphics/LineGraph";

export default function GraphicsFutureProjection() {
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
            value="line"
            className="gap-2 rounded-lg px-4 py-2 text-md font-semibold bg-card border border-border text-muted-foreground transition hover:bg-secondary hover:text-foreground data-[state=active]:bg-secondary data-[state=active]:text-foreground data-[state=active]:border-border"
          >
            <TbActivityHeartbeat />
            Linhas
          </TabsTrigger>
        </TabsList>

        <TabsContent value="bars">
          <BarGraph />
        </TabsContent>
        <TabsContent value="line">
          <LineGraph />
        </TabsContent>
      </Tabs>
    </div>
  );
}
