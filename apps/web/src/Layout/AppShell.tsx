import { NavLink, Outlet } from "react-router-dom";
import { LuPlus } from "react-icons/lu";
import TransactionForm from "../Features/Launch/TransactionForm";
import { useUiStore } from "../Store/UiStore";
import { ToastContainer } from "../Features/Warnings/ToastContainer";
import Logo from "../theme/Logo";
import { APP_NAME } from "../theme/theme";
import ThemeToggle from "../theme/ThemeToggle";
import MonthSelector from "./MonthSelector";
import { NAV_ITEMS } from "./navigation";

export const CONTAINER = "mx-auto w-full max-w-[1240px] px-4 sm:px-6";

/** Estrutura base: cabeçalho com abas no topo e conteúdo num container responsivo. */
export default function AppShell() {
  const openLaunch = useUiStore((s) => s.openLaunch);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur">
        <div className={`${CONTAINER} flex flex-wrap items-center justify-between gap-x-6 gap-y-2 py-3`}>
          <div className="flex items-center gap-2">
            <Logo className="h-9 w-9" />
            <span className="font-display text-lg font-bold">{APP_NAME}</span>
          </div>

          <div className="flex items-center gap-3">
            <MonthSelector />
            <button
              type="button"
              onClick={() => openLaunch()}
              className="flex h-9 items-center gap-1.5 rounded-lg bg-accent px-3 text-sm font-semibold text-accent-foreground transition-opacity hover:opacity-90"
            >
              <LuPlus aria-hidden="true" /> Lançar
            </button>
            <ThemeToggle showLabel={false} />
          </div>

          <nav
            aria-label="Principal"
            className="-mx-1 flex w-full gap-1 overflow-x-auto px-1 pb-1"
          >
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  `whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

      <ToastContainer />
      <TransactionForm />

      <main className={`${CONTAINER} pb-20 pt-6`}>
        <Outlet />
      </main>
    </div>
  );
}
