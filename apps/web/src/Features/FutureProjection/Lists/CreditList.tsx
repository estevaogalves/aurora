import { CardDescription, CardTitle } from "../../../components/ui/card";

export default function CreditList() {
  const dados = [
    { name: "Faculdade", prazo: "termina em jan/27", divisao: 12, valor: 89.9 },
    { name: "Moto", prazo: "termina em mar/27", divisao: 10, valor: 340.9 },
    {
      name: "Plano de saúde",
      prazo: "termina em jun/27",
      divisao: 8,
      valor: 120.9,
    },
    { name: "Celular", prazo: "termina em fev/27", divisao: 4, valor: 300.9 },
  ];

  return (
    <>
      <div className="grid grid-cols-2 gap-4">
        {dados.map((d, index) => {
          return (
            <div
              key={index}
              className="flex items-center justify-between border border-slate-700 rounded-lg p-3 hover:bg-slate-800 transition"
            >
              {/* LEFT */}
              <section className="flex items-center gap-3">
                <span className="w-3 h-3 rounded-full bg-white" />

                <div>
                  <CardTitle className="text-lg font-bold text-slate-300">
                    {d.name}
                  </CardTitle>

                  <CardDescription className="text-sm font-semibold text-slate-400">
                    {d.prazo}
                  </CardDescription>
                </div>
              </section>

              {/* RIGHT */}
              <section className="text-lg">
                <span className="text-slate-300">
                  {d.divisao}x{" "}
                  <strong className="text-white">
                    R$ {d.valor.toFixed(2)}
                  </strong>
                </span>
              </section>
            </div>
          );
        })}
      </div>
    </>
  );
}
