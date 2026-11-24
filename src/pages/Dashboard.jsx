import { useTranslation } from "react-i18next";
import Card from "../components/Card";
import { useAuthStore } from "../store/authStore";

export default function Dashboard() {
  const { t } = useTranslation();
  const { role } = useAuthStore();

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">{t("dashboard")}</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card hover>
          <p className="text-sm text-gray-500">{t("welcome")}</p>
          <p className="text-lg font-semibold mt-1">
            {role === "superadmin" ? "Super Admin" : "Admin"}
          </p>
        </Card>
        <Card hover>
          <p className="text-sm text-gray-500">Приход / Kirim</p>
          <p className="text-2xl font-bold text-green-500 mt-1">0</p>
        </Card>
        <Card hover>
          <p className="text-sm text-gray-500">Расход / Chiqim</p>
          <p className="text-2xl font-bold text-red-500 mt-1">0</p>
        </Card>
      </div>
    </div>
  );
}
