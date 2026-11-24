import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import Card from "../components/Card";
import { db } from "../firebase/config";
import { collection, getDocs, doc, setDoc } from "firebase/firestore";

export default function AdminManagement() {
  const { t } = useTranslation();
  const [admins, setAdmins] = useState([]);
  const [newEmail, setNewEmail] = useState("");
  const [msg, setMsg] = useState("");

  const loadAdmins = async () => {
    const snap = await getDocs(collection(db, "admins"));
    setAdmins(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  };

  useEffect(() => {
    loadAdmins();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    setMsg("");
    if (!newEmail.trim()) return;
    try {
      await setDoc(doc(db, "admins", newEmail.trim()), {
        email: newEmail.trim(),
        createdAt: new Date().toISOString(),
        createdBy: "superadmin",
      });
      setNewEmail("");
      setMsg("Admin whitelisted. Use Firebase Console to create auth account.");
      loadAdmins();
    } catch (err) {
      setMsg(err.message);
    }
  };

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">{t("adminManagement")}</h2>
      <Card>
        <h3 className="font-semibold mb-3">{t("createAdmin")}</h3>
        <form
          onSubmit={handleCreate}
          className="flex flex-col sm:flex-row gap-2"
        >
          <input
            type="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            placeholder="admin@example.com"
            className="input-field flex-1"
            required
          />
          <button type="submit" className="btn-primary">
            {t("createAdmin")}
          </button>
        </form>
        {msg && <p className="text-sm text-green-600 mt-2">{msg}</p>}
      </Card>
      <Card>
        <h3 className="font-semibold mb-3">Admin list</h3>
        {admins.length === 0 ? (
          <p className="text-gray-500 text-sm">No admins yet.</p>
        ) : (
          <ul className="divide-y divide-gray-200 dark:divide-gray-800">
            {admins.map((a) => (
              <li key={a.id} className="py-2 text-sm">
                {a.email}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
