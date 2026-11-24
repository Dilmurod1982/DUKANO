import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import Card from "../components/Card";
import { db } from "../firebase/config";
import {
  collection,
  getDocs,
  query,
  orderBy,
  limit,
  where,
} from "firebase/firestore";

const PAGE_SIZE = 100;

const actionColor = {
  login: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  logout: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  create:
    "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  update:
    "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300",
  delete: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  error: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  view: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300",
};

export default function AuditLogs() {
  const { t } = useTranslation();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [search, setSearch] = useState("");
  const [filterAction, setFilterAction] = useState("");
  const [filterModule, setFilterModule] = useState("");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const q = query(
          collection(db, "auditLogs"),
          orderBy("createdAtTs", "desc"),
          limit(PAGE_SIZE)
        );
        const snap = await getDocs(q);
        setLogs(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch (e) {
        setErr(e.message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const filtered = useMemo(() => {
    const s = search.toLowerCase().trim();
    return logs.filter((l) => {
      if (filterAction && l.action !== filterAction) return false;
      if (filterModule && l.module !== filterModule) return false;
      if (!s) return true;
      return (
        l.actorEmail?.toLowerCase().includes(s) ||
        l.description?.toLowerCase().includes(s) ||
        l.targetId?.toLowerCase().includes(s)
      );
    });
  }, [logs, search, filterAction, filterModule]);

  const formatDate = (log) => {
    if (log.createdAtTs?.toDate)
      return log.createdAtTs.toDate().toLocaleString();
    if (log.createdAt) return new Date(log.createdAt).toLocaleString();
    return "—";
  };

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">{t("auditLogs")}</h2>

      <Card>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("search")}
            className="input-field"
          />
          <select
            value={filterAction}
            onChange={(e) => setFilterAction(e.target.value)}
            className="input-field"
          >
            <option value="">{t("allActions")}</option>
            <option value="login">login</option>
            <option value="logout">logout</option>
            <option value="create">create</option>
            <option value="update">update</option>
            <option value="delete">delete</option>
            <option value="error">error</option>
            <option value="view">view</option>
          </select>
          <select
            value={filterModule}
            onChange={(e) => setFilterModule(e.target.value)}
            className="input-field"
          >
            <option value="">{t("allModules")}</option>
            <option value="auth">auth</option>
            <option value="users">users</option>
            <option value="products">products</option>
            <option value="inventory">inventory</option>
            <option value="transactions">transactions</option>
          </select>
        </div>
      </Card>

      <Card>
        {loading ? (
          <p className="text-gray-500 text-sm">...</p>
        ) : err ? (
          <p className="text-red-500 text-sm">{err}</p>
        ) : filtered.length === 0 ? (
          <p className="text-gray-500 text-sm">{t("noLogs")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b border-gray-200 dark:border-gray-800">
                  <th className="py-2 pr-3">{t("time")}</th>
                  <th className="py-2 pr-3">{t("user")}</th>
                  <th className="py-2 pr-3">{t("module")}</th>
                  <th className="py-2 pr-3">{t("action")}</th>
                  <th className="py-2 pr-3">{t("description")}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((l) => (
                  <tr
                    key={l.id}
                    className="border-b border-gray-100 dark:border-gray-800/50 align-top"
                  >
                    <td className="py-2 pr-3 whitespace-nowrap text-gray-500">
                      {formatDate(l)}
                    </td>
                    <td className="py-2 pr-3">
                      <div className="text-gray-800 dark:text-gray-200">
                        {l.actorEmail}
                      </div>
                      <div className="text-xs text-gray-500">{l.actorRole}</div>
                    </td>
                    <td className="py-2 pr-3">
                      <span className="px-2 py-0.5 rounded text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                        {l.module}
                      </span>
                    </td>
                    <td className="py-2 pr-3">
                      <span
                        className={`px-2 py-0.5 rounded text-xs ${
                          actionColor[l.action] || actionColor.view
                        }`}
                      >
                        {l.action}
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-gray-700 dark:text-gray-300">
                      {l.description}
                      {l.status === "error" && (
                        <span className="ml-2 text-xs text-red-500">error</span>
                      )}
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
