import { NavLink, Outlet } from "react-router-dom";
import Icon from "../components/Icon";
import { btnClass } from "../components/shared/styles";
import TransactionForm from "../Features/Launch/TransactionForm";
import { ToastContainer } from "../Features/Warnings/ToastContainer";
import { useUiStore } from "../Store/UiStore";
import Logo from "../theme/Logo";
import { APP_NAME } from "../theme/theme";
import ThemeToggle from "../theme/ThemeToggle";
import MonthSelector from "./MonthSelector";
import { NAV_ITEMS } from "./navigation";

export const CONTAINER = "mx-auto w-[calc(100%-2rem)] max-w-[1240px]";

/** Abas no topo (pílulas), seletor de mês, tema e a ação única "Lançar". */
export default function AppShell() {
  const openLaunch = useUiStore((s) => s.openLaunch);

  return (
    <div className="min-h-screen">
      <div className={CONTAINER}>
        <header className="sticky top-0 z-20 flex flex-wrap items-center gap-[18px] bg-background/80 py-3.5 backdrop-blur-[14px]">
          <NavLink to="/painel" aria-label={APP_NAME} className="flex items-center gap-2.5 font-display text-lg font-semibold tracking-[-0.02em]">
            <Logo />
            {APP_NAME}
          </NavLink>

          <nav
            aria-label="Principal"
            className="flex max-w-full gap-1 overflow-x-auto rounded-full border border-border bg-card p-1 [scrollbar-width:none]"
          >
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  `flex items-center gap-[7px] whitespace-nowrap rounded-full px-3.5 py-2 text-[13px] font-semibold ${
                    isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                  }`
                }
              >
                <Icon name={item.icon} size={16} />
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2.5 max-[700px]:ml-0 max-[700px]:w-full max-[700px]:justify-between">
            <MonthSelector />
            <div className="flex items-center gap-2.5">
              <ThemeToggle />
              <button type="button" onClick={() => openLaunch()} className={btnClass.primary}>
                <Icon name="plus" size={16} />
                Lançar
              </button>
            </div>
          </div>
        </header>
      </div>

      <ToastContainer />
      <TransactionForm />

      <main className={`${CONTAINER} pb-[70px] pt-[26px] max-[700px]:pt-3.5`}>
        <Outlet />
      </main>
    </div>
  );
}
