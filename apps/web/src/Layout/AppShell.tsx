import { useEffect, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import Icon from "../components/Icon";
import { btnClass } from "../components/shared/styles";
import TransactionForm from "../Features/Launch/TransactionForm";
import { ToastContainer } from "../Features/Warnings/ToastContainer";
import { useUiStore } from "../Store/UiStore";
import Logo from "../theme/Logo";
import { APP_NAME } from "../theme/theme";
import ThemeToggle from "../theme/ThemeToggle";
import GoalBell from "./GoalBell";
import ImportBanner from "./ImportBanner";
import MonthSelector from "./MonthSelector";
import { NAV_ITEMS } from "./navigation";
import UserMenu from "./UserMenu";

export const CONTAINER = "mx-auto w-[calc(100%-2rem)] max-w-[1240px]";

/** Abas no topo (pílulas), seletor de mês, tema e a ação única "Lançar". */
export default function AppShell() {
  const openLaunch = useUiStore((s) => s.openLaunch);
  const [scrolled, setScrolled] = useState(false);

  // no topo o cabeçalho é transparente (sem caixa atrás dos botões); ao rolar ganha fundo
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="min-h-screen">
      <header className={`z-20 transition-colors min-[700px]:sticky min-[700px]:top-0 ${scrolled ? "border-b border-border bg-background/85 backdrop-blur-[14px]" : "border-b border-transparent"}`}>
        <div className={`${CONTAINER} flex flex-wrap items-center gap-x-3 gap-y-2 py-3.5`}>
          <NavLink to="/painel" aria-label={APP_NAME} className="flex items-center gap-2.5 font-display text-lg font-semibold tracking-[-0.02em]">
            <Logo />
            {APP_NAME}
          </NavLink>

          <nav
            aria-label="Principal"
            className="flex max-w-full gap-1 overflow-x-auto rounded-full border border-border bg-card p-1 [scrollbar-width:none] min-[701px]:max-[1259px]:order-3 min-[701px]:max-[1259px]:w-full"
          >
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  `flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-2 text-[13px] font-semibold ${
                    isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                  }`
                }
              >
                <Icon name={item.icon} size={16} />
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2 min-[701px]:max-[1259px]:order-2 max-[700px]:ml-0 max-[700px]:w-full max-[700px]:flex-wrap max-[700px]:justify-between">
            <MonthSelector />
            <div className="flex items-center gap-2">
              <GoalBell />
              <ThemeToggle />
              <UserMenu />
              <button type="button" onClick={() => openLaunch()} className={btnClass.primary}>
                <Icon name="plus" size={16} />
                Lançar
              </button>
            </div>
          </div>
        </div>
      </header>

      <ImportBanner />
      <ToastContainer />
      <TransactionForm />

      <main className={`${CONTAINER} pb-[70px] pt-[26px] max-[700px]:pt-3.5`}>
        <Outlet />
      </main>
    </div>
  );
}
