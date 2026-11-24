// src/components/Sidebar.jsx
import { NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "../store/authStore";
import { useUIStore } from "../store/uiStore";

const navItemBase =
  "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors";

export default function Sidebar() {
  const { t } = useTranslation();
  const { role } = useAuthStore();
  const { sidebarOpen, sidebarCollapsed, closeSidebar, toggleCollapse } =
    useUIStore();

  const linkClass = ({ isActive }) =>
    `${navItemBase} ${
      isActive
        ? "bg-primary-600 text-white"
        : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
    }`;

  const isSuper = role === "superadmin";
  const isAdmin = role === "admin";
  const isStorekeeper = role === "storekeeper";
  const isSeller = role === "seller";

  const canManageUsers = isSuper || isAdmin;
  const canSeeAudit = isSuper || isAdmin;
  const canSeeCategories = isSuper || isAdmin || isStorekeeper;
  const canSeeStockIn = isSuper || isAdmin || isStorekeeper;
  const canSeeSales = isSuper || isAdmin || isSeller;

  const items = [
    // общий дашборд
    { to: "/", label: t("dashboard"), icon: "📊", end: true, show: true },

    // товары и движения — видны всем
    { to: "/products", label: t("products"), icon: "📦", show: true },
    { to: "/transactions", label: t("transactions"), icon: "🔄", show: true },

    // категории — super / admin / storekeeper
    {
      to: "/categories",
      label: t("categories"),
      icon: "🏷️",
      show: canSeeCategories,
    },

    // приход товаров — super / admin / storekeeper
    {
      to: "/stock-in",
      label: t("stockIn"),
      icon: "📥",
      show: canSeeStockIn,
    },

    // продажи — super / admin / seller
    {
      to: "/sales",
      label: t("sales"),
      icon: "🛒",
      show: canSeeSales,
    },

    // пользователи — super / admin
    {
      to: "/users",
      label: t("users"),
      icon: "👥",
      show: canManageUsers,
    },

    // управление админами — только super
    {
      to: "/admins",
      label: t("adminManagement"),
      icon: "👤",
      show: isSuper,
    },

    // журнал — super / admin
    {
      to: "/audit-logs",
      label: t("auditLogs"),
      icon: "📝",
      show: canSeeAudit,
    },
  ].filter((i) => i.show);

  return (
    <>
      {/* Оверлей для мобильных */}
      <div
        onClick={closeSidebar}
        className={`fixed inset-0 bg-black/40 z-30 md:hidden transition-opacity ${
          sidebarOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      />

      <aside
        className={`
          fixed top-0 left-0 z-40 h-full
          bg-white dark:bg-gray-900
          border-r border-gray-200 dark:border-gray-800
          transform transition-all duration-300
          md:static md:translate-x-0
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
          ${sidebarCollapsed ? "md:w-16" : "md:w-64"}
          w-64
        `}
      >
        {/* Шапка */}
        <div className="h-16 flex items-center px-3 border-b border-gray-200 dark:border-gray-800">
          <span
            className={`text-xl font-bold text-primary-600 transition-opacity ${
              sidebarCollapsed ? "md:opacity-0 md:w-0 overflow-hidden" : ""
            }`}
          >
            DUKANO
          </span>

          {/* Свернуть (десктоп) */}
          <button
            onClick={toggleCollapse}
            className="ml-auto hidden md:inline text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            aria-label="Toggle sidebar"
          >
            {sidebarCollapsed ? "»" : "«"}
          </button>

          {/* Закрыть (мобилка) */}
          <button
            onClick={closeSidebar}
            className="ml-auto md:hidden text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
          >
            ✕
          </button>
        </div>

        {/* Меню */}
        <nav className="p-2 space-y-1">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={linkClass}
              onClick={closeSidebar}
              title={sidebarCollapsed ? item.label : undefined}
            >
              <span className="text-lg w-6 text-center shrink-0">
                {item.icon}
              </span>
              <span
                className={`whitespace-nowrap transition-opacity ${
                  sidebarCollapsed ? "md:opacity-0 md:w-0 overflow-hidden" : ""
                }`}
              >
                {item.label}
              </span>
            </NavLink>
          ))}
        </nav>
      </aside>
    </>
  );
}
