// src/pages/Sales.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import Card from "../components/Card";
import { db } from "../firebase/config";
import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  addDoc,
  doc,
  getDoc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import { useAuthStore } from "../store/authStore";
import { useLogger } from "../hooks/useLogger";
import { formatNumberDisplay, parseNumberInput } from "../lib/numberFormat";

export default function Sales() {
  const { t } = useTranslation();
  const { user, role } = useAuthStore();
  const { logCreate, logError } = useLogger();

  const [loading, setLoading] = useState(true);
  const [shift, setShift] = useState(null);
  const [openingCash, setOpeningCash] = useState("");
  const [openingShift, setOpeningShift] = useState(false);
  const [err, setErr] = useState("");

  // корзина
  const [cart, setCart] = useState([]); // [{barcode, name, unit, qty, salePrice, batchItemId}]
  const [scanValue, setScanValue] = useState("");
  const [busy, setBusy] = useState(false);
  const scanRef = useRef(null);

  // модалка закрытия смены
  const [closeModal, setCloseModal] = useState(false);
  const [closingCash, setClosingCash] = useState("");
  const [salesList, setSalesList] = useState([]);

  // Загрузка текущей смены продавца
  const loadShift = async () => {
    if (!user?.email) return;
    setLoading(true);
    setErr("");
    try {
      const q = query(
        collection(db, "shifts"),
        where("sellerEmail", "==", user.email),
        where("status", "==", "open"),
        orderBy("openedAt", "desc"),
        limit(1)
      );
      const snap = await getDocs(q);
      setShift(
        snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() }
      );
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadShift();
  }, [user?.email]);

  // Открытие смены
  const handleOpenShift = async (e) => {
    e.preventDefault();
    setErr("");
    if (!user?.email) return;
    setOpeningShift(true);
    try {
      const cash = parseNumberInput(openingCash) || 0;
      const ref = await addDoc(collection(db, "shifts"), {
        sellerEmail: user.email,
        sellerUid: user.uid,
        status: "open",
        openingCash: cash,
        closingCash: null,
        totalSales: 0,
        totalQty: 0,
        salesCount: 0,
        openedAt: serverTimestamp(),
        openedBy: user.email,
        closedAt: null,
        closedBy: null,
      });
      setShift({
        id: ref.id,
        sellerEmail: user.email,
        status: "open",
        openingCash: cash,
      });
      setOpeningCash("");
      await logCreate(
        "transactions",
        `Открыта смена продавца ${user.email}`,
        ref.id,
        {
          openingCash: cash,
        }
      );
    } catch (e) {
      setErr(e.message);
      await logError("transactions", `Ошибка открытия смены: ${e.message}`);
    } finally {
      setOpeningShift(false);
    }
  };

  // Поиск batchItem по штрихкоду
  const findItemByBarcode = async (barcode) => {
    const q = query(
      collection(db, "batchItems"),
      where("barcode", "==", barcode),
      limit(1)
    );
    const snap = await getDocs(q);
    if (snap.empty) return null;
    const d = snap.docs[0];
    return { id: d.id, ...d.data() };
  };

  // Добавление в корзину по штрихкоду
  const addByBarcode = async (e) => {
    e?.preventDefault?.();
    const code = scanValue.trim();
    if (!code) return;
    setErr("");
    setBusy(true);
    try {
      const item = await findItemByBarcode(code);
      if (!item) {
        setErr(t("barcodeNotFound"));
        return;
      }
      const remaining =
        item.remainingQty != null
          ? Number(item.remainingQty)
          : Number(item.qty) || 0;
      if (remaining <= 0) {
        setErr(t("noStock"));
        return;
      }
      setCart((prev) => {
        const idx = prev.findIndex((x) => x.batchItemId === item.id);
        if (idx >= 0) {
          const copy = [...prev];
          const currentQty = copy[idx].qty;
          if (currentQty + 1 > remaining) {
            setErr(t("notEnoughStock"));
            return prev;
          }
          copy[idx] = { ...copy[idx], qty: currentQty + 1 };
          return copy;
        }
        return [
          ...prev,
          {
            batchItemId: item.id,
            barcode: item.barcode,
            name: item.name,
            unit: item.unit,
            salePrice: Number(item.salePrice) || 0,
            qty: 1,
            maxQty: remaining,
          },
        ];
      });
      setScanValue("");
      scanRef.current?.focus();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  // Изменение количества в корзине
  const updateCartQty = (idx, value) => {
    const qty = Math.max(0, Math.floor(Number(value) || 0));
    setCart((prev) => {
      const copy = [...prev];
      if (qty === 0) return copy.filter((_, i) => i !== idx);
      const max = copy[idx].maxQty || Infinity;
      copy[idx].qty = Math.min(qty, max);
      return copy;
    });
  };

  const removeFromCart = (idx) => {
    setCart((prev) => prev.filter((_, i) => i !== idx));
  };

  const cartTotal = useMemo(
    () => cart.reduce((s, x) => s + x.qty * x.salePrice, 0),
    [cart]
  );
  const cartQty = useMemo(() => cart.reduce((s, x) => s + x.qty, 0), [cart]);

  // Завершение продажи
  const handleCheckout = async () => {
    if (cart.length === 0) return;
    if (!shift) return;
    setErr("");
    setBusy(true);
    try {
      const items = cart.map((x) => ({
        batchItemId: x.batchItemId,
        barcode: x.barcode,
        name: x.name,
        unit: x.unit,
        qty: x.qty,
        salePrice: x.salePrice,
        total: x.qty * x.salePrice,
      }));
      const totalAmount = items.reduce((s, x) => s + x.total, 0);
      const totalQty = items.reduce((s, x) => s + x.qty, 0);

      // 1. sales
      const saleRef = await addDoc(collection(db, "sales"), {
        shiftId: shift.id,
        sellerEmail: user.email,
        items,
        totalAmount,
        totalQty,
        createdAt: serverTimestamp(),
        createdAtIso: new Date().toISOString(),
      });

      // 2. batchItems — уменьшаем remainingQty
      for (const it of items) {
        const ref = doc(db, "batchItems", it.batchItemId);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const d = snap.data();
          const cur =
            d.remainingQty != null
              ? Number(d.remainingQty)
              : Number(d.qty) || 0;
          const next = Math.max(0, cur - it.qty);
          await updateDoc(ref, { remainingQty: next });
        }
      }

      // 3. transactions — по строке на каждый товар (type: sale)
      for (const it of items) {
        await addDoc(collection(db, "transactions"), {
          type: "sale",
          shiftId: shift.id,
          saleId: saleRef.id,
          batchItemId: it.batchItemId,
          productName: it.name,
          barcode: it.barcode,
          unit: it.unit,
          qty: it.qty,
          salePrice: it.salePrice,
          total: it.total,
          actorEmail: user.email,
          createdAt: new Date().toISOString(),
        });
      }

      // 4. shift — обновляем суммы
      const shiftRef = doc(db, "shifts", shift.id);
      const shiftSnap = await getDoc(shiftRef);
      const sd = shiftSnap.data() || {};
      await updateDoc(shiftRef, {
        totalSales: (Number(sd.totalSales) || 0) + totalAmount,
        totalQty: (Number(sd.totalQty) || 0) + totalQty,
        salesCount: (Number(sd.salesCount) || 0) + 1,
      });

      // 5. аудит
      await logCreate(
        "transactions",
        `Продажа на ${formatNumberDisplay(totalAmount)} (${totalQty} ед., чек ${
          saleRef.id
        })`,
        saleRef.id,
        { shiftId: shift.id, totalAmount, totalQty, items }
      );

      // сброс корзины и обновление смены
      setCart([]);
      const shiftSnap2 = await getDoc(shiftRef);
      if (shiftSnap2.exists()) {
        setShift({ id: shiftSnap2.id, ...shiftSnap2.data() });
      }
    } catch (e) {
      setErr(e.message);
      await logError("transactions", `Ошибка продажи: ${e.message}`);
    } finally {
      setBusy(false);
    }
  };

  // Открытие модалки закрытия смены
  const openCloseModal = async () => {
    setCloseModal(true);
    setClosingCash("");
    // загрузка списка продаж смены
    try {
      const q = query(
        collection(db, "sales"),
        where("shiftId", "==", shift.id),
        orderBy("createdAt", "desc"),
        limit(100)
      );
      const snap = await getDocs(q);
      setSalesList(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch {
      setSalesList([]);
    }
  };

  // Закрытие смены
  const handleCloseShift = async () => {
    setErr("");
    setBusy(true);
    try {
      const cash = parseNumberInput(closingCash) || 0;
      const ref = doc(db, "shifts", shift.id);
      await updateDoc(ref, {
        status: "closed",
        closingCash: cash,
        closedAt: serverTimestamp(),
        closedBy: user.email,
      });
      await logCreate(
        "transactions",
        `Смена закрыта. Продаж: ${
          shift.salesCount || 0
        }, выручка: ${formatNumberDisplay(
          shift.totalSales || 0
        )}, касса: ${formatNumberDisplay(cash)}`,
        shift.id,
        { closingCash: cash, totalSales: shift.totalSales || 0 }
      );
      setShift(null);
      setCart([]);
      setCloseModal(false);
      setClosingCash("");
    } catch (e) {
      setErr(e.message);
      await logError("transactions", `Ошибка закрытия смены: ${e.message}`);
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <p className="text-gray-500 text-sm">...</p>;

  // Экран открытия смены
  if (!shift) {
    return (
      <div className="space-y-4 max-w-md mx-auto">
        <h2 className="text-2xl font-bold text-center">
          {t("openShiftTitle")}
        </h2>
        <Card>
          <p className="text-sm text-gray-500 mb-3">{t("openShiftHint")}</p>
          <form onSubmit={handleOpenShift} className="space-y-3">
            <div>
              <label className="block text-sm mb-1">{t("openingCash")}</label>
              <input
                type="text"
                inputMode="decimal"
                value={openingCash}
                onChange={(e) => setOpeningCash(e.target.value)}
                className="input-field"
                placeholder="0"
              />
            </div>
            {err && <p className="text-red-500 text-sm">{err}</p>}
            <button
              type="submit"
              disabled={openingShift}
              className="btn-primary w-full disabled:opacity-50"
            >
              {openingShift ? "..." : t("openShift")}
            </button>
          </form>
        </Card>
      </div>
    );
  }

  // Экран продаж
  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold">{t("sales")}</h2>
          <p className="text-sm text-gray-500">
            {t("shiftOpened")} · {t("openingCash")}:{" "}
            {formatNumberDisplay(shift.openingCash || 0)}
          </p>
        </div>
        <button
          onClick={openCloseModal}
          className="px-4 py-2 rounded-lg border border-red-300 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
        >
          {t("closeShift")}
        </button>
      </div>

      {/* Статистика смены */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <p className="text-xs text-gray-500">{t("salesCount")}</p>
          <p className="text-xl font-bold">{shift.salesCount || 0}</p>
        </Card>
        <Card>
          <p className="text-xs text-gray-500">{t("totalQty")}</p>
          <p className="text-xl font-bold">
            {formatNumberDisplay(shift.totalQty || 0)}
          </p>
        </Card>
        <Card>
          <p className="text-xs text-gray-500">{t("totalSales")}</p>
          <p className="text-xl font-bold text-green-600">
            {formatNumberDisplay(shift.totalSales || 0)}
          </p>
        </Card>
        <Card>
          <p className="text-xs text-gray-500">{t("cartTotal")}</p>
          <p className="text-xl font-bold text-primary-600">
            {formatNumberDisplay(cartTotal)}
          </p>
        </Card>
      </div>

      {/* Сканер */}
      <Card>
        <form onSubmit={addByBarcode} className="flex gap-2">
          <input
            ref={scanRef}
            type="text"
            value={scanValue}
            onChange={(e) => setScanValue(e.target.value)}
            placeholder={t("scanOrEnterBarcode")}
            className="input-field flex-1"
            autoFocus
          />
          <button
            type="submit"
            disabled={busy || !scanValue.trim()}
            className="btn-primary disabled:opacity-50"
          >
            {t("add")}
          </button>
        </form>
      </Card>

      {/* Корзина */}
      <Card>
        <h3 className="font-semibold mb-3">
          {t("cart")}{" "}
          <span className="text-xs text-gray-500 font-normal">
            ({cart.length})
          </span>
        </h3>

        {cart.length === 0 ? (
          <p className="text-gray-500 text-sm">{t("cartEmpty")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b border-gray-200 dark:border-gray-800">
                  <th className="py-2 pr-3">{t("name")}</th>
                  <th className="py-2 pr-3">{t("barcode")}</th>
                  <th className="py-2 pr-3 text-right">{t("qty")}</th>
                  <th className="py-2 pr-3 text-right">{t("salePrice")}</th>
                  <th className="py-2 pr-3 text-right">{t("sum")}</th>
                  <th className="py-2 pr-3 text-right"> </th>
                </tr>
              </thead>
              <tbody>
                {cart.map((c, idx) => (
                  <tr
                    key={c.batchItemId}
                    className="border-b border-gray-100 dark:border-gray-800/50"
                  >
                    <td className="py-2 pr-3 font-medium">{c.name}</td>
                    <td className="py-2 pr-3 font-mono text-xs text-gray-500">
                      {c.barcode}
                    </td>
                    <td className="py-2 pr-3 text-right">
                      <input
                        type="number"
                        min="1"
                        max={c.maxQty}
                        value={c.qty}
                        onChange={(e) => updateCartQty(idx, e.target.value)}
                        className="w-16 px-2 py-1 border border-gray-300 dark:border-gray-700 rounded text-right"
                      />
                    </td>
                    <td className="py-2 pr-3 text-right">
                      {formatNumberDisplay(c.salePrice)}
                    </td>
                    <td className="py-2 pr-3 text-right font-semibold">
                      {formatNumberDisplay(c.qty * c.salePrice)}
                    </td>
                    <td className="py-2 pr-3 text-right">
                      <button
                        onClick={() => removeFromCart(idx)}
                        className="text-red-500 hover:text-red-700"
                        title={t("remove")}
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="font-semibold border-t border-gray-300 dark:border-gray-700">
                  <td className="py-2 pr-3" colSpan={2}>
                    {t("totals")}
                  </td>
                  <td className="py-2 pr-3 text-right">
                    {formatNumberDisplay(cartQty)}
                  </td>
                  <td className="py-2 pr-3" />
                  <td className="py-2 pr-3 text-right">
                    {formatNumberDisplay(cartTotal)}
                  </td>
                  <td className="py-2 pr-3" />
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {err && <p className="text-red-500 text-sm mt-2">{err}</p>}

        <div className="flex gap-2 mt-4">
          <button
            onClick={() => setCart([])}
            disabled={cart.length === 0 || busy}
            className="flex-1 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700 disabled:opacity-50"
          >
            {t("clearCart")}
          </button>
          <button
            onClick={handleCheckout}
            disabled={cart.length === 0 || busy}
            className="btn-primary flex-1 disabled:opacity-50"
          >
            {busy
              ? "..."
              : `${t("checkout")} · ${formatNumberDisplay(cartTotal)}`}
          </button>
        </div>
      </Card>

      {/* Модалка закрытия смены */}
      {closeModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-card w-full max-w-md p-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-lg">{t("closeShift")}</h3>
              <button
                onClick={() => setCloseModal(false)}
                className="text-gray-500"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2 text-sm mb-3">
              <div className="flex justify-between">
                <span className="text-gray-500">{t("salesCount")}</span>
                <span className="font-semibold">{shift.salesCount || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">{t("totalQty")}</span>
                <span className="font-semibold">
                  {formatNumberDisplay(shift.totalQty || 0)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">{t("totalSales")}</span>
                <span className="font-semibold text-green-600">
                  {formatNumberDisplay(shift.totalSales || 0)}
                </span>
              </div>
            </div>

            <label className="block text-sm mb-1">{t("closingCash")}</label>
            <input
              type="text"
              inputMode="decimal"
              value={closingCash}
              onChange={(e) => setClosingCash(e.target.value)}
              className="input-field mb-3"
              placeholder="0"
            />

            {salesList.length > 0 && (
              <div className="mb-3">
                <p className="text-xs text-gray-500 mb-1">{t("lastSales")}</p>
                <ul className="max-h-40 overflow-y-auto divide-y divide-gray-200 dark:divide-gray-800">
                  {salesList.map((s) => (
                    <li
                      key={s.id}
                      className="py-1 flex justify-between text-xs"
                    >
                      <span className="text-gray-500">
                        {new Date(
                          s.createdAtIso || Date.now()
                        ).toLocaleTimeString()}
                      </span>
                      <span className="font-semibold">
                        {formatNumberDisplay(s.totalAmount || 0)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {err && <p className="text-red-500 text-sm mb-2">{err}</p>}

            <div className="flex gap-2">
              <button
                onClick={() => setCloseModal(false)}
                className="flex-1 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700"
              >
                {t("cancel")}
              </button>
              <button
                onClick={handleCloseShift}
                disabled={busy}
                className="flex-1 px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
              >
                {busy ? "..." : t("closeShift")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
