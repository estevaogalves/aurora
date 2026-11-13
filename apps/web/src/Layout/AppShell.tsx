import { useEffect, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import Icon from "../components/Icon";
import MoneyTooltip from "../components/shared/MoneyTooltip";
import { btnClass } from "../components/shared/styles";
import TransactionForm from "../Features/Launch/TransactionForm";
import { ToastContainer } from "../Features/Warnings/ToastContainer";
import { useUiStore } from "../Store/UiStore";
import Logo from "../theme/Logo";
import { APP_NAME } from "../theme/theme";
import PrivacyBanner from "../theme/PrivacyBanner";
import ClosedMonthBanner from "../components/shared/ClosedMonthBanner";
import ReopenMonthDialog from "../components/shared/ReopenMonthDialog";
import { useClosedGuard } from "../Store/closedGuard";
import { usePrivacyShortcut } from "../lib/usePrivacyShortcut";
import ThemeToggle from "../theme/ThemeToggle";
import { usePrivacyStore } from "../lib/privacy";
import { FloatingCalculator } from "../Features/Calculator/Calculator";
import GoalBell from "./GoalBell";
import ImportBanner from "./ImportBanner";
import MonthSelector from "./MonthSelector";
import AppTour from "../components/tour/AppTour";
import CardsDialog from "@/Features/Profile/CardsDialog";
import ImportDialog from "@/Features/Launch/ImportDialog";
import { NAV_ITEMS } from "./navigation";
import UserMenu from "./UserMenu";

export const CONTAINER = "mx-auto w-[calc(100%-2rem)] max-w-[1240px]";

/** Abas no topo (pílulas), seletor de mês, tema e a ação única "Lançar". */
export default function AppShell() {
  const openLaunch = useUiStore((s) => s.openLaunch);
  const calcOpen = useUiStore((s) => s.calcOpen);
  const toggleCalc = useUiStore((s) => s.toggleCalc);
  const [scrolled, setScrolled] = useState(false);
  // os valores são formatados fora do React; ao ligar/desligar a privacidade, a tela é redesenhada
  const privacyHidden = usePrivacyStore((s) => s.hidden);
  usePrivacyShortcut();
  // "Lançar" num mês fechado pede para reabrir o mês antes
  const closedGuard = useClosedGuard();

  // no topo o cabeçalho é transparente (sem caixa atrás dos botões); ao rolar ganha fundo
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="min-h-dvh">
      <header className={`z-20 transition-colors min-[700px]:sticky min-[700px]:top-0 ${scrolled ? "border-b border-border bg-background/85 backdrop-blur-[14px]" : "border-b border-transparent"}`}>
        <div className={`${CONTAINER} flex flex-wrap items-center gap-x-2 gap-y-2 py-3.5`}>
          <NavLink to="/painel" aria-label={APP_NAME} className="flex items-center gap-2.5 font-display text-lg font-semibold tracking-[-0.02em]">
            <Logo />
            {/* em celular estreito só o logo: o nome empurraria os botões para uma segunda linha */}
            <span className="max-[430px]:hidden">{APP_NAME}</span>
          </NavLink>

          <TopTabs />

          <div className="ml-auto flex items-center gap-1.5 min-[701px]:max-[1299px]:order-2 max-[700px]:contents">
            <div className="max-[700px]:order-3 max-[700px]:w-full"><MonthSelector /></div>
            <div className="flex items-center gap-1.5 max-[700px]:ml-auto">
              <GoalBell />
              <button
                type="button"
                data-tour="calculadora"
                onClick={toggleCalc}
                aria-label={calcOpen ? "Fechar calculadora" : "Abrir calculadora"}
                aria-pressed={calcOpen}
                title="Calculadora"
                className={`${btnClass.base} ${btnClass.icon} ${calcOpen ? "!border-primary !text-primary" : ""}`}
              >
                <Icon name="calc" size={16} />
              </button>
              <ThemeToggle />
              <UserMenu />
              <button type="button" data-tour="lancar" onClick={() => closedGuard.run(() => openLaunch())} className={btnClass.primary}>
                <Icon name="plus" size={16} />
                Lançar
              </button>
            </div>
          </div>
        </div>
      </header>
      <BottomTabs />

      <AppTour />
      <ImportBanner />
      <ToastContainer />
      <TransactionForm />
      <CardsDialog />
      <ImportDialog />
      <FloatingCalculator />
      {/* ao manter o mouse sobre um valor, diz quanto é por extenso */}
      <MoneyTooltip />

      <main className={`${CONTAINER} pb-[70px] pt-[26px] max-[700px]:pb-[104px] max-[700px]:pt-3.5`}>
        <PrivacyBanner />
        <ClosedMonthBanner />
        <ReopenMonthDialog open={closedGuard.open} month={closedGuard.month} onConfirm={closedGuard.confirm} onCancel={closedGuard.cancel} />
        <Outlet key={String(privacyHidden)} />
      </main>
    </div>
  );
}

/** Abas em pílulas no topo (telas a partir de 701 px). */
function TopTabs() {
  return (
    <nav
      aria-label="Principal"
      data-tour="abas"
      className="flex max-w-full gap-1 overflow-x-auto rounded-full border border-border bg-card p-1 [scrollbar-width:none] max-[700px]:hidden min-[701px]:max-[1299px]:order-3 min-[701px]:max-[1299px]:w-full"
    >
      {NAV_ITEMS.map((item) => (
        <NavLink
          key={item.path}
          to={item.path}
          className={({ isActive }) =>
            `flex items-center gap-1 whitespace-nowrap rounded-full px-1 py-2 text-[13px] font-semibold min-[701px]:max-[1299px]:flex-auto min-[701px]:max-[1299px]:justify-center ${
              isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            }`
          }
        >
          <Icon name={item.icon} size={16} />
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}

/**
 * Abas fixas no rodapé (celular). Fica fora do <header> de propósito: o header ganha
 * `backdrop-filter` ao rolar, e isso faria o rodapé "seguir" o header em vez da tela.
 */
function BottomTabs() {
  return (
    <nav
      aria-label="Principal"
      data-tour="abas"
      className="fixed inset-x-0 bottom-0 z-30 flex justify-around border-t border-border bg-card/95 px-1 pb-[max(0.25rem,env(safe-area-inset-bottom))] pt-1 backdrop-blur-[14px] min-[701px]:hidden"
    >
      {NAV_ITEMS.map((item) => (
        <NavLink
          key={item.path}
          to={item.path}
          className={({ isActive }) =>
            `flex min-h-[52px] min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-0.5 text-[10px] font-semibold tracking-[-0.01em] max-[400px]:text-[9px] max-[400px]:tracking-[-0.04em] ${
              isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground"
            }`
          }
        >
          <Icon name={item.icon} size={18} />
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}
