import { useTranslation } from "react-i18next";
import Card from "../components/Card";

export default function Products() {
  const { t } = useTranslation();
  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">{t("products")}</h2>
      <Card>
        <p className="text-gray-500 text-sm">Coming soon.</p>
      </Card>
    </div>
  );
}
