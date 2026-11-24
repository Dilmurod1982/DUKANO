// src/pages/StockIn.jsx
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import Card from "../components/Card";
import { db } from "../firebase/config";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { formatNumberDisplay } from "../lib/numberFormat";

export default function StockIn() {
  const { t } = useTranslation();

  const [products, setProducts] = useState([]); // справочник products
  const [batchItems, setBatchItems] = useState([]); // все записи партий
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [productsSnap, itemsSnap] = await Promise.all([
          getDocs(query(collection(db, "products"), orderBy("name", "asc"))),
          getDocs(
            query(collection(db, "batchItems"), orderBy("createdAt", "desc"))
          ),
        ]);
        setProducts(productsSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setBatchItems(itemsSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch (e) {
        setErr(e.message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // Агрегируем данные: объединяем products + batchItems по имени
  const rows = useMemo(() => {
    const map = new Map();

    // 1. Сначала справочник products
    products.forEach((p) => {
      if (!p.name) return;
      const key = p.name.trim().toLowerCase();
      if (!map.has(key)) {
        map.set(key, {
          name: p.name.trim(),
          barcode: p.lastBarcode || "",
          unit: p.unit || "",
          category: p.category || "",
          price: p.lastSalePrice ?? null,
          stock: 0,
        });
      }
    });

    // 2. Дополняем/перезаписываем из партий
    // batchItems отсортированы по createdAt desc — первая встреченная запись «свежее»
    batchItems.forEach((it) => {
      if (!it.name) return;
      const key = it.name.trim().toLowerCase();
      const existing = map.get(key) || {
        name: it.name.trim(),
        barcode: "",
        unit: "",
        category: "",
        price: null,
        stock: 0,
      };
      // остаток накапливаем
      existing.stock += Number(it.qty) || 0;
      // берём «последние» значения — первая встреченная в desc-порядке
      if (!existing.barcode && it.barcode) existing.barcode = it.barcode;
      if (!existing.unit && it.unit) existing.unit = it.unit;
      if (existing.price == null && it.salePrice != null) {
        existing.price = Number(it.salePrice);
      }
      map.set(key, existing);
    });

    return Array.from(map.values()).sort((a, b) =>
      a.name.localeCompare(b.name)
    );
  }, [products, batchItems]);

  const categories = useMemo(() => {
    const set = new Set();
    rows.forEach((r) => {
      if (r.category) set.add(r.category);
    });
    return Array.from(set).sort();
  }, [rows]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (category && r.category !== category) return false;
      if (!s) return true;
      return (
        r.name.toLowerCase().includes(s) || r.barcode.toLowerCase().includes(s)
      );
    });
  }, [rows, search, category]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold">{t("stockIn")}</h2>
          <p className="text-sm text-gray-500">{t("stockInHint")}</p>
        </div>
        <Link to="/batches" className="btn-primary inline-flex items-center">
          + {t("newBatch")}
        </Link>
      </div>

      <Card>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("searchByNameOrBarcode")}
            className="input-field"
          />
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="input-field"
          >
            <option value="">{t("allCategories")}</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </Card>

      <Card>
        <h3 className="font-semibold mb-3">
          {t("products")}{" "}
          <span className="text-xs text-gray-500 font-normal">
            ({filtered.length})
          </span>
        </h3>

        {loading ? (
          <p className="text-gray-500 text-sm">...</p>
        ) : err ? (
          <p className="text-red-500 text-sm">{err}</p>
        ) : filtered.length === 0 ? (
          <p className="text-gray-500 text-sm">{t("noProducts")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b border-gray-200 dark:border-gray-800">
                  <th className="py-2 pr-3">{t("name")}</th>
                  <th className="py-2 pr-3">{t("barcode")}</th>
                  <th className="py-2 pr-3 hidden md:table-cell">
                    {t("category")}
                  </th>
                  <th className="py-2 pr-3 text-right">{t("stock")}</th>
                  <th className="py-2 pr-3 text-right hidden sm:table-cell">
                    {t("price")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr
                    key={r.name}
                    className="border-b border-gray-100 dark:border-gray-800/50"
                  >
                    <td className="py-2 pr-3">
                      <div className="font-medium text-gray-800 dark:text-gray-200">
                        {r.name}
                      </div>
                      {r.unit && (
                        <div className="text-xs text-gray-500">{r.unit}</div>
                      )}
                    </td>
                    <td className="py-2 pr-3 font-mono text-xs text-gray-600 dark:text-gray-400">
                      {r.barcode || "—"}
                    </td>
                    <td className="py-2 pr-3 hidden md:table-cell text-gray-600 dark:text-gray-400">
                      {r.category || "—"}
                    </td>
                    <td className="py-2 pr-3 text-right">
                      <span
                        className={
                          r.stock > 0
                            ? "text-green-600 font-medium"
                            : "text-red-500 font-medium"
                        }
                      >
                        {formatNumberDisplay(r.stock)}
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-right hidden sm:table-cell text-gray-700 dark:text-gray-300">
                      {r.price != null ? formatNumberDisplay(r.price) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
