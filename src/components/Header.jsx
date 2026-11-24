import { useAuthStore } from "../store/authStore";
import { useThemeStore } from "../store/themeStore";
import { useLangStore } from "../store/langStore";
import { useUIStore } from "../store/uiStore";
import { useTranslation } from "react-i18next";

export default function Header() {
  const { t } = useTranslation();
  const { user, logout } = useAuthStore();
  const { theme, toggle } = useThemeStore();
  const { lang, setLang } = useLangStore();
  const { toggleSidebar } = useUIStore();

  return (
    <header className="sticky top-0 z-20 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-4 py-3 flex items-center justify-between transition-colors">
      <div className="flex items-center gap-3">
        <button
          onClick={toggleSidebar}
          className="md:hidden text-xl text-gray-700 dark:text-gray-300"
          aria-label="Open sidebar"
        >
          ☰
        </button>
        <h1 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
          {t("appName")}
        </h1>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        <select
          value={lang}
          onChange={(e) => setLang(e.target.value)}
          className="text-sm bg-transparent border border-gray-300 dark:border-gray-700 rounded-lg px-2 py-1"
        >
          <option value="en">EN</option>
          <option value="ru">RU</option>
          <option value="uz">UZ</option>
        </select>
        <button
          onClick={toggle}
          className="text-sm px-3 py-1 rounded-lg border border-gray-300 dark:border-gray-700"
        >
          {theme === "dark" ? "☀️" : "🌙"}
        </button>
        <span className="text-sm text-gray-500 hidden sm:inline">
          {user?.email}
        </span>
        <button
          onClick={logout}
          className="text-sm text-red-500 hover:text-red-600"
        >
          {t("logout")}
        </button>
      </div>
    </header>
  );
}
