// src/pages/Sales.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import Card from "../components/Card";
import BarcodeScannerModal from "../components/BarcodeScannerModal";
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
import {
  formatNumberDisplay,
  parseNumberInput,
  formatNumberInput,
} from "../lib/numberFormat";

export default function Sales() {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const { logCreate, logError } = useLogger();

  const [loading, setLoading] = useState(true);
  const [shift, setShift] = useState(null);
  const [openingShift, setOpeningShift] = useState(false);
  const [err, setErr] = useState("");

  // корзина
  const [cart, setCart] = useState([]);
  const [scanValue, setScanValue] = useState("");
  const [busy, setBusy] = useState(false);
  const scanRef = useRef(null);

  // камера
  const [scannerOpen, setScannerOpen] = useState(false);

  // поиск товаров
  const [searchName, setSearchName] = useState("");
  const [searchPrice, setSearchPrice] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const searchWrapperRef = useRef(null);

  // модалка закрытия смены
  const [closeModal, setCloseModal] = useState(false);
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

  // Закрытие выпадающего списка поиска по клику вне
  useEffect(() => {
    const onClick = (e) => {
      if (
        searchWrapperRef.current &&
        !searchWrapperRef.current.contains(e.target)
      ) {
        setShowResults(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  // Открытие смены
  const handleOpenShift = async (e) => {
    e?.preventDefault?.();
    setErr("");
    if (!user?.email) return;
    setOpeningShift(true);
    try {
      const ref = await addDoc(collection(db, "shifts"), {
        sellerEmail: user.email,
        sellerUid: user.uid,
        status: "open",
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
        totalSales: 0,
        totalQty: 0,
        salesCount: 0,
        openedAt: { toDate: () => new Date() },
      });
      await logCreate(
        "transactions",
        `Открыта смена продавца ${user.email}`,
        ref.id,
        {}
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

  const pushToCart = (item) => {
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
  };

  // Обработка кода из поля ввода или камеры
  const handleAddByCode = async (code) => {
    const trimmed = String(code || "").trim();
    if (!trimmed) return;
    setErr("");
    setBusy(true);
    try {
      const item = await findItemByBarcode(trimmed);
      if (!item) {
        setErr(t("barcodeNotFound"));
        return;
      }
      pushToCart(item);
      setScanValue("");
      scanRef.current?.focus();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  const addByBarcode = async (e) => {
    e?.preventDefault?.();
    await handleAddByCode(scanValue);
  };

  const onScannerResult = async (code) => {
    setScannerOpen(false);
    setScanValue(code);
    await handleAddByCode(code);
  };

  const performSearch = async () => {
    setErr("");
    const nameQ = searchName.trim().toLowerCase();
    const priceQ = parseNumberInput(searchPrice);
    if (!nameQ && (searchPrice === "" || isNaN(priceQ))) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }

    setSearching(true);
    try {
      const q = query(collection(db, "batchItems"), limit(500));
      const snap = await getDocs(q);
      const all = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const filtered = all.filter((it) => {
        const remaining =
          it.remainingQty != null
            ? Number(it.remainingQty)
            : Number(it.qty) || 0;
        if (remaining <= 0) return false;
        if (nameQ) {
          const inName = it.name?.toLowerCase().includes(nameQ);
          const inBarcode = it.barcode?.toLowerCase().includes(nameQ);
          if (!inName && !inBarcode) return false;
        }
        if (searchPrice !== "" && !isNaN(priceQ)) {
          const price = Number(it.salePrice) || 0;
          if (Math.abs(price - priceQ) > 0.01) return false;
        }
        return true;
      });
      setSearchResults(filtered.slice(0, 20));
      setShowResults(true);
    } catch (e) {
      setErr(e.message);
    } finally {
      setSearching(false);
    }
  };

  const onSearchEnter = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      performSearch();
    }
  };

  const pickSearchResult = (item) => {
    pushToCart(item);
    setShowResults(false);
    setSearchResults([]);
    setSearchName("");
    setSearchPrice("");
  };

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

      const saleRef = await addDoc(collection(db, "sales"), {
        shiftId: shift.id,
        sellerEmail: user.email,
        items,
        totalAmount,
        totalQty,
        createdAt: serverTimestamp(),
        createdAtIso: new Date().toISOString(),
      });

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

      const shiftRef = doc(db, "shifts", shift.id);
      const shiftSnap = await getDoc(shiftRef);
      const sd = shiftSnap.data() || {};
      await updateDoc(shiftRef, {
        totalSales: (Number(sd.totalSales) || 0) + totalAmount,
        totalQty: (Number(sd.totalQty) || 0) + totalQty,
        salesCount: (Number(sd.salesCount) || 0) + 1,
      });

      await logCreate(
        "transactions",
        `Продажа на ${formatNumberDisplay(totalAmount)} (${totalQty} ед., чек ${
          saleRef.id
        })`,
        saleRef.id,
        { shiftId: shift.id, totalAmount, totalQty, items }
      );

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

  const openCloseModal = async () => {
    setCloseModal(true);
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

  const handleCloseShift = async () => {
    setErr("");
    setBusy(true);
    try {
      const ref = doc(db, "shifts", shift.id);
      await updateDoc(ref, {
        status: "closed",
        closedAt: serverTimestamp(),
        closedBy: user.email,
      });
      await logCreate(
        "transactions",
        `Смена закрыта. Продаж: ${
          shift.salesCount || 0
        }, выручка: ${formatNumberDisplay(shift.totalSales || 0)}`,
        shift.id,
        { totalSales: shift.totalSales || 0 }
      );
      setShift(null);
      setCart([]);
      setCloseModal(false);
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
          {err && <p className="text-red-500 text-sm mb-2">{err}</p>}
          <button
            onClick={handleOpenShift}
            disabled={openingShift}
            className="btn-primary w-full disabled:opacity-50"
          >
            {openingShift ? "..." : t("openShift")}
          </button>
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
            {t("shiftOpened")} ·{" "}
            {shift.openedAt?.toDate
              ? shift.openedAt.toDate().toLocaleString()
              : new Date().toLocaleString()}
          </p>
        </div>
        <button
          onClick={openCloseModal}
          className="px-4 py-2 rounded-lg border border-red-300 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
        >
          {t("closeShift")}
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
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
      </div>

      {/* Сканер по штрихкоду + камера */}
      <Card>
        <form onSubmit={addByBarcode} className="flex gap-2">
          <input
            ref={scanRef}
            type="text"
            value={scanValue}
            onChange={(e) => setScanValue(e.target.value)}
            placeholder={t("scanOrEnterBarcode")}
            className="input-field flex-1"
          />
          <button
            type="button"
            onClick={() => setScannerOpen(true)}
            className="px-4 py-2 rounded-lg bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600"
            title={t("scanWithCamera")}
          >
            📷
          </button>
          <button
            type="submit"
            disabled={busy || !scanValue.trim()}
            className="btn-primary disabled:opacity-50"
          >
            {t("add")}
          </button>
        </form>
      </Card>

      {/* Поиск по названию/штрихкоду и по цене */}
      <Card>
        <h3 className="font-semibold mb-3 text-sm">
          {t("searchProductsTitle")}
        </h3>
        <div className="relative" ref={searchWrapperRef}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <input
              type="text"
              value={searchName}
              onChange={(e) => setSearchName(e.target.value)}
              onKeyDown={onSearchEnter}
              placeholder={t("searchByNameOrBarcode")}
              className="input-field"
            />
            <input
              type="text"
              inputMode="decimal"
              value={searchPrice}
              onChange={(e) =>
                setSearchPrice(formatNumberInput(e.target.value))
              }
              onKeyDown={onSearchEnter}
              placeholder={t("searchByPrice")}
              className="input-field"
            />
          </div>
          <div className="flex gap-2 mt-2">
            <button
              type="button"
              onClick={performSearch}
              disabled={searching}
              className="btn-primary flex-1 disabled:opacity-50"
            >
              {searching ? "..." : t("search")}
            </button>
            <button
              type="button"
              onClick={() => {
                setSearchName("");
                setSearchPrice("");
                setSearchResults([]);
                setShowResults(false);
              }}
              className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700"
            >
              {t("clear")}
            </button>
          </div>

          {showResults && (
            <ul className="absolute z-40 left-0 right-0 mt-1 max-h-72 overflow-y-auto bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg">
              {searchResults.length === 0 ? (
                <li className="px-3 py-2 text-sm text-gray-500">
                  {t("noProductsFound")}
                </li>
              ) : (
                searchResults.map((r) => (
                  <li
                    key={r.id}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      pickSearchResult(r);
                    }}
                    className="px-3 py-2 cursor-pointer text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    <div className="flex justify-between gap-2">
                      <div>
                        <div className="font-medium">{r.name}</div>
                        <div className="text-xs text-gray-500 font-mono">
                          {r.barcode || "—"}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold">
                          {formatNumberDisplay(r.salePrice)}
                        </div>
                        <div className="text-xs text-gray-500">{r.unit}</div>
                      </div>
                    </div>
                  </li>
                ))
              )}
            </ul>
          )}
        </div>
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

      {/* Модалка сканера камеры */}
      {scannerOpen && (
        <BarcodeScannerModal
          onClose={() => setScannerOpen(false)}
          onScan={onScannerResult}
        />
      )}
    </div>
  );
}
