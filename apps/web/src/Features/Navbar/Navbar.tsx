import { FaWallet } from "react-icons/fa";

export default function Navbar() {
  return (
    <header className="bg-card border-border border-b pt-2 shadow-sm shadow-stone-950">
      <div className="flex items-center justify-content mx-44 mt-6 mb-6">
        <div className="bg-primary/10 text-primary border border-primary px-2 py-2 rounded-lg mr-3">
          <FaWallet className="text-3xl" />
        </div>
        <section>
          <h1 className="text-3xl font-bold text-foreground">Aurora</h1>
          <p className="text-base text-foreground/80 font-medium">Controle Financeiro Pessoal</p>
        </section>
      </div>
    </header>
  );
}


// deixou de ser usada quando eu fiz a sidebar