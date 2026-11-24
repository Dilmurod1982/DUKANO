// src/pages/Batches.jsx
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
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

const EMPTY = { name: "", number: "", date: "" };

export default function Batches() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { logCreate, logError } = useLogger();

  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [search, setSearch] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [formErr, setFormErr] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, "batches"), orderBy("createdAt", "desc"));
      const snap = await getDocs(q);
      setBatches(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return batches;
    return batches.filter(
      (b) =>
        b.name?.toLowerCase().includes(s) || b.number?.toLowerCase().includes(s)
    );
  }, [batches, search]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setFormErr("");
    if (!form.name.trim() || !form.number.trim() || !form.date) {
      setFormErr(t("fillAllFields"));
      return;
    }
    setSaving(true);
    try {
      const docRef = await addDoc(collection(db, "batches"), {
        name: form.name.trim(),
        number: form.number.trim(),
        date: form.date,
        totalQty: 0,
        remainingQty: 0,
        createdBy: user?.email || "unknown",
        createdAt: new Date().toISOString(),
      });
      await logCreate(
        "products",
        `Создана партия ${form.number} — ${form.name}`,
        docRef.id,
        { name: form.name, number: form.number, date: form.date }
      );
      setForm(EMPTY);
      setModalOpen(false);
      load();
    } catch (e) {
      setFormErr(e.message);
      await logError("products", `Ошибка создания партии: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  const fmtDate = (v) => {
    if (!v) return "—";
    if (v?.toDate) return v.toDate().toLocaleDateString();
    return new Date(v).toLocaleDateString();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold">{t("batches")}</h2>
          <p className="text-sm text-gray-500">{t("batchesHint")}</p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="btn-primary inline-flex items-center"
        >
          + {t("newBatch")}
        </button>
      </div>

      <Card>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("searchBatches")}
          className="input-field"
        />
      </Card>

      <Card>
        <h3 className="font-semibold mb-3">
          {t("batches")}{" "}
          <span className="text-xs text-gray-500 font-normal">
            ({filtered.length})
          </span>
        </h3>

        {loading ? (
          <p className="text-gray-500 text-sm">...</p>
        ) : err ? (
          <p className="text-red-500 text-sm">{err}</p>
        ) : filtered.length === 0 ? (
          <p className="text-gray-500 text-sm">{t("noBatches")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b border-gray-200 dark:border-gray-800">
                  <th className="py-2 pr-3">{t("batchName")}</th>
                  <th className="py-2 pr-3">{t("batchNumber")}</th>
                  <th className="py-2 pr-3">{t("batchDate")}</th>
                  <th className="py-2 pr-3 text-right">{t("totalQty")}</th>
                  <th className="py-2 pr-3 text-right">{t("remainingQty")}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((b) => (
                  <tr
                    key={b.id}
                    onClick={() => navigate(`/batches/${b.id}`)}
                    className="border-b border-gray-100 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800/40 cursor-pointer"
                  >
                    <td className="py-2 pr-3 font-medium">{b.name || "—"}</td>
                    <td className="py-2 pr-3 font-mono text-xs text-gray-600 dark:text-gray-400">
                      {b.number || "—"}
                    </td>
                    <td className="py-2 pr-3 text-gray-600 dark:text-gray-400">
                      {fmtDate(b.date)}
                    </td>
                    <td className="py-2 pr-3 text-right">{b.totalQty ?? 0}</td>
                    <td className="py-2 pr-3 text-right">
                      <span
                        className={
                          (b.remainingQty ?? 0) > 0
                            ? "text-green-600 font-medium"
                            : "text-red-500 font-medium"
                        }
                      >
                        {b.remainingQty ?? 0}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Модалка «Новая партия» */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-card w-full max-w-md p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-lg">{t("newBatch")}</h3>
              <button
                onClick={() => setModalOpen(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label className="block text-sm mb-1">{t("batchName")} *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, name: e.target.value }))
                  }
                  className="input-field"
                  required
                />
              </div>
              <div>
                <label className="block text-sm mb-1">
                  {t("batchNumber")} *
                </label>
                <input
                  type="text"
                  value={form.number}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, number: e.target.value }))
                  }
                  className="input-field"
                  required
                />
              </div>
              <div>
                <label className="block text-sm mb-1">{t("batchDate")} *</label>
                <input
                  type="date"
                  value={form.date}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, date: e.target.value }))
                  }
                  className="input-field"
                  required
                />
              </div>
              {formErr && <p className="text-red-500 text-sm">{formErr}</p>}
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="flex-1 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700"
                >
                  {t("cancel")}
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="btn-primary flex-1 disabled:opacity-50"
                >
                  {saving ? "..." : t("create")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
