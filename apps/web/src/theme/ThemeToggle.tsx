import Icon from "../components/Icon";
import { btnClass } from "../components/shared/styles";
import { useThemeStore } from "./theme";

export default function ThemeToggle() {
  const { theme, toggleTheme } = useThemeStore();
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? "Ativar modo claro" : "Ativar modo escuro"}
      className={btnClass.base}
    >
      <Icon name={isDark ? "sun" : "moon"} size={16} />
    </button>
  );
}
