// src/pages/Categories.jsx
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import Card from "../components/Card";
import { db } from "../firebase/config";
import {
  collection,
  getDocs,
  query,
  orderBy,
  addDoc,
} from "firebase/firestore";
import { useAuthStore } from "../store/authStore";
import { useLogger } from "../hooks/useLogger";

export default function Categories() {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const { logCreate, logError } = useLogger();

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, "categories"), orderBy("name", "asc"));
      const snap = await getDocs(q);
      setItems(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    setMsg("");
    setErr("");
    const trimmed = name.trim();
    if (!trimmed) return;

    setSaving(true);
    try {
      const docRef = await addDoc(collection(db, "categories"), {
        name: trimmed,
        description: description.trim(),
        createdBy: user?.email || "unknown",
        createdAt: new Date().toISOString(),
      });

      await logCreate("products", `Создана категория «${trimmed}»`, docRef.id, {
        name: trimmed,
      });

      setMsg(t("categoryCreated", { name: trimmed }));
      setName("");
      setDescription("");
      load();
    } catch (e) {
      setErr(e.message);
      await logError("products", `Ошибка создания категории: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold">{t("categories")}</h2>
        <p className="text-sm text-gray-500">{t("categoriesHint")}</p>
      </div>

      <Card>
        <h3 className="font-semibold mb-3">{t("newCategory")}</h3>
        <form
          onSubmit={handleCreate}
          className="grid grid-cols-1 sm:grid-cols-2 gap-3"
        >
          <div>
            <label className="block text-sm mb-1">{t("name")} *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input-field"
              required
            />
          </div>
          <div>
            <label className="block text-sm mb-1">{t("description")}</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="input-field"
            />
          </div>
          <div className="sm:col-span-2">
            <button
              type="submit"
              className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={saving}
            >
              {saving ? "..." : t("create")}
            </button>
          </div>
        </form>
        {msg && <p className="text-sm text-green-600 mt-2">{msg}</p>}
        {err && <p className="text-sm text-red-500 mt-2">{err}</p>}
      </Card>

      <Card>
        <h3 className="font-semibold mb-3">
          {t("categories")}{" "}
          <span className="text-xs text-gray-500 font-normal">
            ({items.length})
          </span>
        </h3>

        {loading ? (
          <p className="text-gray-500 text-sm">...</p>
        ) : items.length === 0 ? (
          <p className="text-gray-500 text-sm">{t("noCategories")}</p>
        ) : (
          <ul className="divide-y divide-gray-200 dark:divide-gray-800">
            {items.map((c) => (
              <li key={c.id} className="py-2">
                <div className="font-medium text-gray-800 dark:text-gray-200">
                  {c.name}
                </div>
                {c.description && (
                  <div className="text-xs text-gray-500">{c.description}</div>
                )}
                <div className="text-xs text-gray-400">
                  {t("createdBy")}: {c.createdBy || "—"}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
