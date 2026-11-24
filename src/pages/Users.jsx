// src/pages/Users.jsx
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import Card from "../components/Card";
import { db, auth } from "../firebase/config";
import {
  collection,
  getDocs,
  query,
  orderBy,
  doc,
  setDoc,
} from "firebase/firestore";
import {
  createUserWithEmailAndPassword,
  signOut,
  signInWithEmailAndPassword,
} from "firebase/auth";
import { useAuthStore } from "../store/authStore";
import { useLogger } from "../hooks/useLogger";

const EMPTY_FORM = {
  email: "",
  password: "",
  lastName: "",
  firstName: "",
  middleName: "",
  birthDate: "",
  passportSeries: "",
  passportNumber: "",
  pinfl: "",
};

export default function Users() {
  const { t } = useTranslation();
  const { role } = useAuthStore();
  const { logCreate, logError } = useLogger();

  const [users, setUsers] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [targetRole, setTargetRole] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  // какие роли доступны текущему пользователю для создания
  const availableRoles =
    role === "superadmin"
      ? [{ value: "admin", label: t("roleAdmin") }]
      : role === "admin"
      ? [
          { value: "storekeeper", label: t("roleStorekeeper") },
          { value: "seller", label: t("roleSeller") },
        ]
      : [];

  // инициализация выбранной роли
  useEffect(() => {
    if (availableRoles.length > 0 && !targetRole) {
      setTargetRole(availableRoles[0].value);
    }
  }, [role]);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, "users"), orderBy("createdAt", "desc"));
      const snap = await getDocs(q);
      setUsers(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const setField = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const handleCreate = async (e) => {
    e.preventDefault();
    setMsg("");
    setErr("");

    if (!targetRole || availableRoles.length === 0) {
      setErr(t("noPermission"));
      return;
    }

    const adminEmail = sessionStorage.getItem("adminEmail");
    const adminPassword = sessionStorage.getItem("adminPassword");

    if (!adminEmail || !adminPassword) {
      setErr(t("errorAdminReauth"));
      return;
    }

    setSaving(true);
    try {
      const emailKey = form.email.trim().toLowerCase();

      const cred = await createUserWithEmailAndPassword(
        auth,
        emailKey,
        form.password
      );
      await signOut(auth);
      await signInWithEmailAndPassword(auth, adminEmail, adminPassword);

      await setDoc(doc(db, "users", emailKey), {
        uid: cred.user.uid,
        email: emailKey,
        role: targetRole, // admin | storekeeper | seller
        lastName: form.lastName.trim(),
        firstName: form.firstName.trim(),
        middleName: form.middleName.trim(),
        birthDate: form.birthDate,
        passportSeries: form.passportSeries.trim().toUpperCase(),
        passportNumber: form.passportNumber.trim(),
        pinfl: form.pinfl.trim(),
        createdBy: adminEmail,
        createdAt: new Date().toISOString(),
      });

      await logCreate(
        "users",
        `Создан пользователь ${emailKey} с ролью ${targetRole}`,
        emailKey,
        {
          email: emailKey,
          role: targetRole,
          fullName: `${form.lastName} ${form.firstName} ${
            form.middleName || ""
          }`.trim(),
          pinfl: form.pinfl,
        }
      );

      setMsg(t("userCreatedHint", { email: emailKey, role: targetRole }));
      setForm(EMPTY_FORM);
      loadUsers();
    } catch (e) {
      let m = e?.message || t("createUserError");
      if (e?.code === "auth/email-already-in-use") m = t("errorEmailInUse");
      else if (e?.code === "auth/weak-password") m = t("errorWeakPassword");
      else if (
        e?.code === "auth/wrong-password" ||
        e?.code === "auth/user-not-found"
      )
        m = t("errorAdminReauth");
      setErr(m);

      await logError(
        "users",
        `Ошибка создания пользователя ${form.email}: ${e?.message || e}`,
        form.email || null,
        { code: e?.code }
      );
    } finally {
      setSaving(false);
    }
  };

  const roleBadge = (r) => {
    const map = {
      superadmin:
        "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
      admin: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
      storekeeper:
        "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
      seller:
        "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
      user: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
    };
    return `px-2 py-0.5 rounded-full text-xs font-medium ${map[r] || ""}`;
  };

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">{t("users")}</h2>

      <Card>
        <h3 className="font-semibold mb-1">{t("createUser")}</h3>
        <p className="text-xs text-gray-500 mb-3">{t("createUserHint")}</p>

        {availableRoles.length === 0 ? (
          <p className="text-sm text-red-500">{t("noPermission")}</p>
        ) : (
          <form
            onSubmit={handleCreate}
            className="grid grid-cols-1 sm:grid-cols-2 gap-3"
          >
            {/* Выбор роли */}
            <div className="sm:col-span-2">
              <label className="block text-sm mb-1">{t("role")} *</label>
              <select
                value={targetRole}
                onChange={(e) => setTargetRole(e.target.value)}
                className="input-field"
                required
              >
                {availableRoles.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-sm mb-1">{t("email")} *</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setField("email", e.target.value)}
                className="input-field"
                required
                autoComplete="off"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-sm mb-1">{t("password")} *</label>
              <input
                type="password"
                value={form.password}
                onChange={(e) => setField("password", e.target.value)}
                className="input-field"
                minLength={6}
                required
                autoComplete="new-password"
              />
            </div>

            <div>
              <label className="block text-sm mb-1">{t("lastName")} *</label>
              <input
                type="text"
                value={form.lastName}
                onChange={(e) => setField("lastName", e.target.value)}
                className="input-field"
                required
              />
            </div>
            <div>
              <label className="block text-sm mb-1">{t("firstName")} *</label>
              <input
                type="text"
                value={form.firstName}
                onChange={(e) => setField("firstName", e.target.value)}
                className="input-field"
                required
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-sm mb-1">{t("middleName")}</label>
              <input
                type="text"
                value={form.middleName}
                onChange={(e) => setField("middleName", e.target.value)}
                className="input-field"
              />
            </div>

            <div>
              <label className="block text-sm mb-1">{t("birthDate")} *</label>
              <input
                type="date"
                value={form.birthDate}
                onChange={(e) => setField("birthDate", e.target.value)}
                className="input-field"
                required
              />
            </div>

            <div>
              <label className="block text-sm mb-1">
                {t("passportSeries")} *
              </label>
              <input
                type="text"
                value={form.passportSeries}
                onChange={(e) =>
                  setField("passportSeries", e.target.value.toUpperCase())
                }
                className="input-field"
                placeholder="AA"
                maxLength={2}
                required
              />
            </div>

            <div>
              <label className="block text-sm mb-1">
                {t("passportNumber")} *
              </label>
              <input
                type="text"
                value={form.passportNumber}
                onChange={(e) =>
                  setField("passportNumber", e.target.value.replace(/\D/g, ""))
                }
                className="input-field"
                placeholder="1234567"
                maxLength={7}
                required
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-sm mb-1">{t("pinfl")} *</label>
              <input
                type="text"
                value={form.pinfl}
                onChange={(e) =>
                  setField("pinfl", e.target.value.replace(/\D/g, ""))
                }
                className="input-field"
                placeholder="14 цифр"
                maxLength={14}
                required
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
        )}

        {msg && <p className="text-sm text-green-600 mt-2">{msg}</p>}
        {err && <p className="text-sm text-red-500 mt-2">{err}</p>}
      </Card>

      <Card>
        <h3 className="font-semibold mb-3">{t("userList")}</h3>
        {loading ? (
          <p className="text-gray-500 text-sm">...</p>
        ) : users.length === 0 ? (
          <p className="text-gray-500 text-sm">{t("noUsers")}</p>
        ) : (
          <ul className="divide-y divide-gray-200 dark:divide-gray-800">
            {users.map((u) => (
              <li
                key={u.id}
                className="py-2 flex items-center justify-between gap-2"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">
                    {u.lastName} {u.firstName} {u.middleName || ""}
                  </p>
                  <p className="text-xs text-gray-500 truncate">{u.email}</p>
                  <p className="text-xs text-gray-400">
                    {t("createdBy")}: {u.createdBy || "—"}
                  </p>
                </div>
                <span className={roleBadge(u.role)}>
                  {u.role === "storekeeper"
                    ? t("roleStorekeeper")
                    : u.role === "seller"
                    ? t("roleSeller")
                    : u.role === "admin"
                    ? t("roleAdmin")
                    : u.role === "superadmin"
                    ? t("roleSuperadmin")
                    : u.role}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
