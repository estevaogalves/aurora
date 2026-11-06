import { useState } from "react";
import { CiCalendar } from "react-icons/ci";
import { FaArrowTrendUp, FaWallet } from "react-icons/fa6";
import { IoMdCheckmarkCircleOutline } from "react-icons/io";
import {
  MdOutlineKeyboardArrowLeft,
  MdOutlineKeyboardArrowRight,
} from "react-icons/md";
import { Card, CardHeader, CardTitle } from "../../components/ui/card";

export default function DashboardFutureProjection() {
  const [meses, setMeses] = useState(6);

  return (
    <div className="mx-44 mt-6">
      {/* HEADER */}
      <div className="flex items-center justify-between">
        <section>
          <h1 className="text-3xl font-bold text-white">Projeção Futura</h1>
          <p className="text-xl font-medium text-gray-300">
            Visualize seus próximos meses com base nas rendas e despesas fixas
          </p>
        </section>
      </div>

      {/* CARDS */}
      <div className="grid grid-cols-4 gap-6 mt-6 w-[1440px]">
        {/* renda fixa */}
        <Card className="rounded-xl bg-slate-900 border-slate-600">
          <CardHeader>
            <CardTitle className="mt-4">
              <div className="flex items-center gap-6">
                <div className="border rounded-xl p-3 bg-green-900 text-green-300 border-green-600">
                  <FaWallet className="text-2xl" />
                </div>
                <section>
                  <h1 className="text-base text-slate-400 font-medium">
                    Renda fixa mensal
                  </h1>
                  <p className="text-2xl text-white font-bold">R$ 0,00</p>
                </section>
              </div>
            </CardTitle>
          </CardHeader>
        </Card>

        {/* despesas */}
        <Card className="rounded-xl bg-slate-900 border-slate-600">
          <CardHeader>
            <CardTitle className="mt-4">
              <div className="flex items-center gap-6">
                <div className="border rounded-xl p-3 bg-red-900 text-red-100 border-red-600">
                  <FaArrowTrendUp className="text-xl" />
                </div>
                <section>
                  <h1 className="text-base text-slate-400 font-medium">
                    Despesas fixas
                  </h1>
                  <p className="text-2xl text-white font-bold">R$: 0,00</p>
                </section>
              </div>
            </CardTitle>
          </CardHeader>
        </Card>

        {/* saldo */}
        <Card className="rounded-xl bg-slate-900 border-slate-600">
          <CardHeader>
            <CardTitle className="mt-4">
              <div className="flex items-center gap-6">
                <div className="border rounded-xl p-3 bg-green-900 text-green-100 border-green-600">
                  <IoMdCheckmarkCircleOutline className="text-xl" />
                </div>
                <section>
                  <h1 className="text-base text-slate-400 font-medium">
                    Saldo projetado total
                  </h1>
                  <p className="text-2xl text-white font-bold">R$: 0,00</p>
                </section>
              </div>
            </CardTitle>
          </CardHeader>
        </Card>

        {/* meses */}
        <Card className="rounded-xl bg-slate-900 border-slate-600">
          <CardHeader>
            <CardTitle className="mt-4">
              <div className="flex items-center gap-6">
                <div className="border rounded-xl p-3 bg-blue-900 text-blue-100 border-blue-600">
                  <CiCalendar className="text-xl" />
                </div>
                <section>
                  <h1 className="text-base text-slate-400 font-medium">
                    Meses projetados
                  </h1>
                  <p className="text-xl text-white font-bold">{meses} meses</p>
                </section>
              </div>
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* CONTROLE DE MESES */}
      <Card className="rounded-xl bg-slate-900 border-slate-600 w-[1440px] mt-6">
        <CardHeader>
          <div className="flex items-center justify-between mt-10">
            <CardTitle className="text-slate-400 text-lg">
              Projetar para os proximos:
            </CardTitle>
            <div className="text-slate-400 flex items-center gap-4">
              <button
                onClick={() => setMeses((m) => Math.max(1, m - 1))}
                className="border rounded-md p-2"
              >
                <MdOutlineKeyboardArrowLeft />
              </button>
              <h1 className="text-slate-400 font-bold text-xl">
                {meses} meses
              </h1>
              <button
                onClick={() => setMeses((m) => Math.min(24, m + 1))}
                className="border rounded-md p-2"
              >
                <MdOutlineKeyboardArrowRight />
              </button>
            </div>
          </div>
        </CardHeader>
      </Card>
    </div>
  );
}
