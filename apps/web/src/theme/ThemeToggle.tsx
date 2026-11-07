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
      className="flex w-full items-center justify-start gap-2 rounded-lg px-4 py-2 font-medium hover:bg-secondary"
    >
      {isDark ? <LuSun className="text-lg" /> : <LuMoon className="text-lg" />}
      {showLabel && <span>{isDark ? "Modo claro" : "Modo escuro"}</span>}
    </button>
  );
}
