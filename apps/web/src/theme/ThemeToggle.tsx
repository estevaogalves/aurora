import { LuMoon, LuSun } from "react-icons/lu";
import { useThemeStore } from "./theme";

export default function ThemeToggle({ showLabel = true }: { showLabel?: boolean }) {
  const { theme, toggleTheme } = useThemeStore();
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? "Ativar modo claro" : "Ativar modo escuro"}
      className={`flex items-center gap-2 rounded-lg text-sm font-medium text-foreground transition-colors hover:bg-secondary ${showLabel ? "w-full px-4 py-2" : "h-9 w-9 justify-center border border-border bg-card"}`}
    >
      {isDark ? <LuSun className="text-base" /> : <LuMoon className="text-base" />}
      {showLabel && <span>{isDark ? "Modo claro" : "Modo escuro"}</span>}
    </button>
  );
}
