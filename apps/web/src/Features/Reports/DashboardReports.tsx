import { CiCalendar } from "react-icons/ci";
import { GrDocumentText } from "react-icons/gr";
import {
  Card,
  CardHeader,
  CardTitle
} from "../../components/ui/card";


export default function DashboardReports() {
  return (
    <div>
      {/* Título */}
      <div className="mx-44 mt-6 w-[1380px]">
        <h1 className="text-3xl font-bold text-foreground">Relatórios</h1>
        <p className="text-xl font-medium text-foreground/80">
          Exporte seus dados financeiros em diferentes formatos
        </p>
      </div>

      {/* Cards de resumo - 3 cards lado a lado igual ao SummaryCard */}
      <div className="grid grid-cols-3 gap-6 mx-44 mt-6">
        {/* Meses registrados */}
        <Card className="rounded-xl bg-card border-border">
          <CardHeader >
            <CardTitle className="mt-4">
              <div className="flex items-center gap-6">
                <div className="border rounded-xl p-3 bg-primary/20 text-success border-primary">
                  <CiCalendar className="text-2xl" />
                </div>
                <section>
                  <h1 className="text-base text-muted-foreground font-medium mr-16">Meses registrados</h1>
                  <p className="text-2xl text-foreground font-bold">0</p>
                </section>
              </div>
            </CardTitle>
          </CardHeader>
        </Card>

        {/* total da receita */}
       <Card className="rounded-xl bg-card border-border">
          <CardHeader>
            <CardTitle className="mt-4">
              <div className="flex items-center gap-6">
                <div className="border rounded-xl p-3 bg-blue-900 text-blue-300 border-blue-600">
                  <GrDocumentText className="text-xl" />
                </div>
                <section>
                  <h1 className="text-base text-muted-foreground font-medium mr-16">Total de receitas</h1>
                  <p className="text-2xl text-foreground font-bold">R$: 0,00</p>
                </section>
              </div>
            </CardTitle>
          </CardHeader>
        </Card>

        {/* total da despesa */}
        <Card className="rounded-xl bg-card border-border">
          <CardHeader>
            <CardTitle className="mt-4">
              <div className="flex items-center gap-6">
                <div className="border rounded-xl p-3 bg-destructive/20 text-destructive border-destructive">
                  <GrDocumentText className="text-xl" />
                </div>
                <section>
                  <h1 className="text-base text-muted-foreground font-medium mr-16">Total de despesas</h1>
                  <p className="text-2xl text-foreground font-bold">R$: 0,00</p>
                </section>
              </div>
            </CardTitle>
          </CardHeader>
        </Card>
      </div>
    </div>
  );
}
