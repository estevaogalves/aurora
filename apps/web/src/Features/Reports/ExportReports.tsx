import { useState } from "react";
import { GrDocumentText } from "react-icons/gr";
import { PiDownloadSimpleBold } from "react-icons/pi";
import { Button } from "../../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";

export default function ExportReports() {
  const [formato, setFormato] = useState("pdf");
  const [mes, setMes] = useState("atual");

  return (
    <div className="mt-8 mx-44 w-[1380px]">
      <Card className="rounded-xl bg-slate-900 border-slate-600">
        <CardHeader>
          <CardTitle className="text-xl text-white font-bold">
            Exportar Dados
          </CardTitle>
          <CardDescription className="text-base font-medium text-slate-300">
            Selecione o formato e os meses para exportar
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Formatos de exportaçao */}
          <h1 className="text-base text-white font-bold mb-3 mt-3">Formato</h1>
          <div className="grid grid-cols-3 gap-6">
            <Button
              onClick={() => setFormato("pdf")}
              className={`h-auto p-6 rounded-xl border ${
                formato === "pdf"
                  ? "bg-emerald-950/60 border-emerald-400 hover:bg-emerald-950/60"
                  : "bg-slate-900 border-slate-600 hover:border-slate-400 hover:bg-transparent"
              }`}
            >
              <div className="flex flex-col items-center gap-1">
                <GrDocumentText className="!w-8 !h-8 shrink-0" />
                <h1 className="text-xl mt-3">PDF</h1>
                <span className="text-base font-medium text-slate-300">
                  Impressão e compartilhamento
                </span>
              </div>
            </Button>
            <Button
              onClick={() => setFormato("csv")}
              className={`h-auto p-6 rounded-xl border ${
                formato === "csv"
                  ? "bg-emerald-950/60 border-emerald-400 hover:bg-emerald-950/60"
                  : "bg-slate-900 border-slate-600 hover:border-slate-400 hover:bg-transparent"
              }`}
            >
              <div className="flex flex-col items-center gap-1">
                <GrDocumentText className="!w-8 !h-8 shrink-0" />
                <h1 className="text-xl mt-3">CSV</h1>
                <span className="text-base font-medium text-slate-300">
                  Para Excel e Planilhas
                </span>
              </div>
            </Button>
            <Button
              onClick={() => setFormato("txt")}
              className={`h-auto p-6 rounded-xl border ${
                formato === "txt"
                  ? "bg-emerald-950/60 border-emerald-400 hover:bg-emerald-950/60"
                  : "bg-slate-900 border-slate-600 hover:border-slate-400 hover:bg-transparent"
              }`}
            >
              <div className="flex flex-col items-center gap-1">
                <GrDocumentText className="!w-8 !h-8 shrink-0" />
                <h1 className="text-xl mt-3">TXT</h1>
                <span className="text-base font-medium text-slate-300">
                  Texto formatado
                </span>
              </div>
            </Button>
          </div>

          {/* Meses escolhidos */}
          <h1 className="text-base text-white font-bold mb-3 mt-6">Meses</h1>
          <div className="grid grid-cols-3 gap-6 mb-8">
            <Button
              onClick={() => setMes("atual")}
              className={`h-auto p-4 rounded-xl border ${
                mes === "atual"
                  ? "bg-emerald-950/60 border-emerald-400 hover:bg-emerald-950/60"
                  : "bg-slate-900 border-slate-600 hover:border-slate-400 hover:bg-transparent"
              }`}
            >
              Mês atual
            </Button>
            <Button
              onClick={() => setMes("selecionar")}
              className={`h-auto p-4 rounded-xl border ${
                mes === "selecionar"
                  ? "bg-emerald-950/60 border-emerald-400 hover:bg-emerald-950/60"
                  : "bg-slate-900 border-slate-600 hover:border-slate-400 hover:bg-transparent"
              }`}
            >
              Selecionar meses
            </Button>
            <Button
              onClick={() => setMes("todos")}
              className={`h-auto p-4 rounded-xl border ${
                mes === "todos"
                  ? "bg-emerald-950/60 border-emerald-400 hover:bg-emerald-950/60"
                  : "bg-slate-900 border-slate-600 hover:border-slate-400 hover:bg-transparent"
              }`}
            >
              Todos os meses (0)
            </Button>
          </div>
          {/* <span className="text-slate-300 text-lg font-medium">
            Selecione os meses (0 selecionados)
          </span> */}
          <Button className="text-lg font-medium py-8 w-full mt-4 bg-green-700 hover:bg-green-800 rounded-xl">
            <PiDownloadSimpleBold className="!w-5 !h-5" />
            Exportar PDF
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
