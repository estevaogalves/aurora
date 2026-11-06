import { FaWallet } from "react-icons/fa";

export default function Navbar() {
  return (
    <header className="bg-slate-900 border-slate-600 border-b pt-2 shadow-sm shadow-stone-950">
      <div className="flex items-center justify-content mx-44 mt-6 mb-6">
        <div className="bg-green-950 text-emerald-600 border border-emerald-600 px-2 py-2 rounded-lg mr-3">
          <FaWallet className="text-3xl" />
        </div>
        <section>
          <h1 className="text-3xl font-bold text-white">MeuBolso</h1>
          <p className="text-base text-gray-300 font-medium">Controle Financeiro Pessoal</p>
        </section>
      </div>
    </header>
  );
}


// deixou de ser usada quando eu fiz a sidebar