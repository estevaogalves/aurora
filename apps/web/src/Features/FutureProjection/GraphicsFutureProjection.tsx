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
            value="line"
            className="gap-2 rounded-lg px-4 py-2 text-md font-semibold bg-slate-900 border border-slate-700 text-slate-400 transition hover:bg-slate-800 hover:text-white data-[state=active]:bg-slate-800 data-[state=active]:text-white data-[state=active]:border-slate-500"
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
