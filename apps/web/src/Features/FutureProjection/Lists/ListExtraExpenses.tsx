import { GoTrash } from "react-icons/go";
import { HiMiniCalendarDateRange } from "react-icons/hi2";

export default function ListExtraExpenses() {
  const dados = [
    { name: "Faculdade", prazo: "janeiro de 27", divisao: 12, valor: 89.9 },
    { name: "Moto", prazo: "março de 27", divisao: 10, valor: 340.9 },
    {
      name: "Plano de saúde",
      prazo: "junho de 27",
      divisao: 8,
      valor: 120.9,
    },
    { name: "Celular", prazo: "fevereiro de 27", divisao: 4, valor: 300.9 },
  ];

  return (
    <>
      <div className="flex flex-col gap-4">
        {dados.map((d, index) => {
          return (
            <div
              key={index}
              className="flex items-center justify-between border border-slate-700 rounded-lg p-3 hover:bg-slate-800 transition"
            >
              {/* LEFT */}
              <section className="flex items-center gap-3">
                <span className=" border rounded-xl p-2">
                  <HiMiniCalendarDateRange className="text-2xl " />
                </span>

                <div>
                  <h1 className="text-lg font-bold text-slate-300">{d.name}</h1>

                  <h2 className="text-sm font-semibold text-slate-400">
                    {d.prazo}
                  </h2>
                </div>
              </section>

              {/* RIGHT */}
              <section className="text-lg flex items-center gap-3">
                <span className="text-white font-bold">
                  - R$ {d.valor}
                </span>
                <button className="text-lg text-white bg-transparent hover:bg-red-600 hover:text-white rounded-lg p-3">
                  <GoTrash className="text-lg font-bold"/>
                </button>
              </section>
            </div>
          );
        })}
      </div>
    </>
  );
}
