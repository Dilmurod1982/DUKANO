// src/pages/BatchDetails.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useParams, useNavigate } from "react-router-dom";
import Card from "../components/Card";
import { db } from "../firebase/config";
import {
  collection,
  getDocs,
  query,
  orderBy,
  where,
  addDoc,
  doc,
  getDoc,
  updateDoc,
} from "firebase/firestore";
import { useAuthStore } from "../store/authStore";
import { useLogger } from "../hooks/useLogger";
import {
  formatNumberInput,
  parseNumberInput,
  formatNumberDisplay,
} from "../lib/numberFormat";
import { generateEAN13 } from "../lib/barcode";
import { printBarcodeLabels } from "../lib/printBarcode";

const UNITS = [
  { value: "kg", labelKey: "unitKg" },
  { value: "pcs", labelKey: "unitPcs" },
  { value: "m", labelKey: "unitM" },
  { value: "l", labelKey: "unitL" },
];

const EMPTY_ITEM = {
  name: "",
  categoryId: "",
  unit: "",
  qty: "",
  purchasePrice: "",
  salePrice: "",
};

const MAX_LABELS = 100;
const EDIT_WINDOW_MS = 6 * 60 * 60 * 1000;

function parseCreatedAt(b) {
  if (!b) return null;
  if (b.createdAt?.toDate) return b.createdAt.toDate();
  if (typeof b.createdAt === "string") {
    const d = new Date(b.createdAt);
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof b.createdAt === "number") return new Date(b.createdAt);
  return null;
}

export default function BatchDetails() {
  const { t } = useTranslation();
  const { batchId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { logCreate, logError } = useLogger();

  const [batch, setBatch] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [search, setSearch] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_ITEM);
  const [saving, setSaving] = useState(false);
  const [formErr, setFormErr] = useState("");

  const [catalog, setCatalog] = useState([]); // products[]
  const [categories, setCategories] = useState([]); // categories[]
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggest, setShowSuggest] = useState(false);
  const [highlighted, setHighlighted] = useState(-1);
  const nameWrapperRef = useRef(null);

  const [now, setNow] = useState(Date.now());

  // Загрузка партии и товаров
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const batchRef = doc(db, "batches", batchId);
        const batchSnap = await getDoc(batchRef);
        if (!batchSnap.exists()) {
          setErr(t("batchNotFound"));
          return;
        }
        setBatch({ id: batchSnap.id, ...batchSnap.data() });

        const q = query(
          collection(db, "batchItems"),
          where("batchId", "==", batchId),
          orderBy("createdAt", "desc")
        );
        const snap = await getDocs(q);
        setItems(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch (e) {
        setErr(e.message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [batchId]);

  // Тик каждую секунду
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const createdAtDate = useMemo(() => parseCreatedAt(batch), [batch]);
  const deadline = createdAtDate
    ? createdAtDate.getTime() + EDIT_WINDOW_MS
    : null;
  const remainingMs = deadline ? Math.max(0, deadline - now) : 0;
  const isEditable = remainingMs > 0;

  const remainingLabel = useMemo(() => {
    if (!deadline) return "";
    if (remainingMs <= 0) return "00:00:00";
    const total = Math.floor(remainingMs / 1000);
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    const pad = (n) => String(n).padStart(2, "0");
    return `${pad(h)}:${pad(m)}:${pad(s)}`;
  }, [deadline, remainingMs]);

  // При открытии модалки — каталог товаров и категории
  useEffect(() => {
    if (!modalOpen) return;
    const loadData = async () => {
      try {
        const [prodSnap, catSnap] = await Promise.all([
          getDocs(query(collection(db, "products"), orderBy("name", "asc"))),
          getDocs(query(collection(db, "categories"), orderBy("name", "asc"))),
        ]);
        setCatalog(prodSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setCategories(catSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch {
        // не критично
      }
    };
    loadData();
  }, [modalOpen]);

  // Закрытие подсказок
  useEffect(() => {
    const onClick = (e) => {
      if (
        nameWrapperRef.current &&
        !nameWrapperRef.current.contains(e.target)
      ) {
        setShowSuggest(false);
        setHighlighted(-1);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const filteredItems = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return items;
    return items.filter(
      (i) =>
        i.name?.toLowerCase().includes(s) ||
        i.barcode?.toLowerCase().includes(s)
    );
  }, [items, search]);

  const totals = useMemo(() => {
    let pTotal = 0;
    let sTotal = 0;
    let qty = 0;
    filteredItems.forEach((i) => {
      pTotal += Number(i.purchaseTotal) || 0;
      sTotal += Number(i.saleTotal) || 0;
      qty += Number(i.qty) || 0;
    });
    return { pTotal, sTotal, qty };
  }, [filteredItems]);

  const qtyNum = parseNumberInput(form.qty);
  const pPriceNum = parseNumberInput(form.purchasePrice);
  const sPriceNum = parseNumberInput(form.salePrice);
  const purchaseTotal =
    !isNaN(qtyNum) && !isNaN(pPriceNum) ? qtyNum * pPriceNum : 0;
  const saleTotal =
    !isNaN(qtyNum) && !isNaN(sPriceNum) ? qtyNum * sPriceNum : 0;

  const canSave =
    isEditable &&
    form.name.trim() !== "" &&
    form.categoryId !== "" &&
    form.unit !== "" &&
    form.qty !== "" &&
    !isNaN(qtyNum) &&
    qtyNum > 0 &&
    form.purchasePrice !== "" &&
    !isNaN(pPriceNum) &&
    pPriceNum >= 0 &&
    form.salePrice !== "" &&
    !isNaN(sPriceNum) &&
    sPriceNum >= 0 &&
    !saving;

  const handleNameChange = (value) => {
    setForm((p) => ({ ...p, name: value }));
    const s = value.trim().toLowerCase();
    if (!s) {
      setSuggestions([]);
      setShowSuggest(false);
      return;
    }
    const matches = catalog
      .filter((c) => c.name?.toLowerCase().includes(s))
      .slice(0, 8);
    setSuggestions(matches);
    setShowSuggest(matches.length > 0);
    setHighlighted(matches.length > 0 ? 0 : -1);
  };

  const pickSuggestion = (product) => {
    setForm((p) => ({ ...p, name: product.name }));
    setShowSuggest(false);
    setSuggestions([]);
    setHighlighted(-1);
  };

  const onNameKeyDown = (e) => {
    if (!showSuggest || suggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlighted((h) => (h + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlighted((h) => (h <= 0 ? suggestions.length - 1 : h - 1));
    } else if (e.key === "Enter") {
      if (highlighted >= 0) {
        e.preventDefault();
        pickSuggestion(suggestions[highlighted]);
      }
    } else if (e.key === "Escape") {
      setShowSuggest(false);
    }
  };

  const handleNumberChange = (field) => (e) => {
    const formatted = formatNumberInput(e.target.value);
    setForm((p) => ({ ...p, [field]: formatted }));
  };

  const openModal = () => {
    if (!isEditable) return;
    setForm(EMPTY_ITEM);
    setFormErr("");
    setSuggestions([]);
    setShowSuggest(false);
    setHighlighted(-1);
    setModalOpen(true);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!isEditable) {
      setFormErr(t("editWindowExpired"));
      return;
    }
    setFormErr("");
    if (!form.name.trim()) return setFormErr(t("fillAllFields"));
    if (!form.categoryId) return setFormErr(t("selectCategoryRequired"));
    if (!form.unit) return setFormErr(t("fillAllFields"));
    if (isNaN(qtyNum) || qtyNum <= 0) return setFormErr(t("qtyMustBePositive"));
    if (isNaN(pPriceNum) || pPriceNum < 0)
      return setFormErr(t("fillAllFields"));
    if (isNaN(sPriceNum) || sPriceNum < 0)
      return setFormErr(t("fillAllFields"));

    setSaving(true);
    try {
      const qty = qtyNum;
      const pPrice = pPriceNum;
      const sPrice = sPriceNum;
      const pTotal = qty * pPrice;
      const sTotal = qty * sPrice;

      const barcode = generateEAN13();
      const selectedCategory = categories.find((c) => c.id === form.categoryId);
      const categoryName = selectedCategory?.name || "";

      const itemRef = await addDoc(collection(db, "batchItems"), {
        batchId,
        name: form.name.trim(),
        categoryId: form.categoryId,
        category: categoryName,
        unit: form.unit,
        qty,
        purchasePrice: pPrice,
        salePrice: sPrice,
        purchaseTotal: pTotal,
        saleTotal: sTotal,
        barcode,
        createdBy: user?.email || "unknown",
        createdAt: new Date().toISOString(),
      });

      const productQ = query(
        collection(db, "products"),
        where("name", "==", form.name.trim())
      );
      const productSnap = await getDocs(productQ);
      if (productSnap.empty) {
        await addDoc(collection(db, "products"), {
          name: form.name.trim(),
          categoryId: form.categoryId,
          category: categoryName,
          unit: form.unit,
          lastPurchasePrice: pPrice,
          lastSalePrice: sPrice,
          lastBarcode: barcode,
          createdAt: new Date().toISOString(),
        });
      } else {
        const pDoc = productSnap.docs[0];
        await updateDoc(doc(db, "products", pDoc.id), {
          categoryId: form.categoryId,
          category: categoryName,
          unit: form.unit,
          lastPurchasePrice: pPrice,
          lastSalePrice: sPrice,
          lastBarcode: barcode,
          updatedAt: new Date().toISOString(),
        });
      }

      const batchRef = doc(db, "batches", batchId);
      const batchSnap = await getDoc(batchRef);
      const bData = batchSnap.data() || {};
      await updateDoc(batchRef, {
        totalQty: (Number(bData.totalQty) || 0) + qty,
        remainingQty: (Number(bData.remainingQty) || 0) + qty,
      });

      await addDoc(collection(db, "transactions"), {
        type: "in",
        batchId,
        itemId: itemRef.id,
        productName: form.name.trim(),
        category: categoryName,
        unit: form.unit,
        qty,
        purchasePrice: pPrice,
        salePrice: sPrice,
        barcode,
        actorEmail: user?.email || "unknown",
        createdAt: new Date().toISOString(),
      });

      await logCreate(
        "products",
        `В партию добавлен товар «${form.name.trim()}» (${qty} ${
          form.unit
        }, категория: ${categoryName}, штрихкод ${barcode})`,
        itemRef.id,
        {
          batchId,
          qty,
          purchasePrice: pPrice,
          salePrice: sPrice,
          barcode,
          category: categoryName,
        }
      );

      setItems((prev) => [
        {
          id: itemRef.id,
          batchId,
          name: form.name.trim(),
          categoryId: form.categoryId,
          category: categoryName,
          unit: form.unit,
          qty,
          purchasePrice: pPrice,
          salePrice: sPrice,
          purchaseTotal: pTotal,
          saleTotal: sTotal,
          barcode,
          createdBy: user?.email || "unknown",
          createdAt: new Date().toISOString(),
        },
        ...prev,
      ]);
      setBatch((b) => ({
        ...b,
        totalQty: (Number(b?.totalQty) || 0) + qty,
        remainingQty: (Number(b?.remainingQty) || 0) + qty,
      }));
      setModalOpen(false);
      setForm(EMPTY_ITEM);
    } catch (e) {
      setFormErr(e.message);
      await logError(
        "products",
        `Ошибка добавления товара в партию: ${e.message}`
      );
    } finally {
      setSaving(false);
    }
  };

  const unitLabel = (u) => {
    const found = UNITS.find((x) => x.value === u);
    return found ? t(found.labelKey) : u;
  };

  const handlePrint = (item) => {
    if (!item.barcode) return;
    const labelsCount = Math.min(Number(item.qty) || 1, MAX_LABELS);
    printBarcodeLabels(
      {
        name: item.name,
        barcode: item.barcode,
        qty: item.qty,
        salePrice: item.salePrice,
      },
      { labelsCount }
    );
  };

  if (loading) return <p className="text-gray-500 text-sm">...</p>;
  if (err) return <p className="text-red-500 text-sm">{err}</p>;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <button
            onClick={() => navigate("/batches")}
            className="text-sm text-primary-600 hover:underline mb-1"
          >
            ← {t("batches")}
          </button>
          <h2 className="text-2xl font-bold">
            {batch?.name}{" "}
            <span className="text-gray-400">#{batch?.number}</span>
          </h2>
          <p className="text-sm text-gray-500">
            {t("batchDate")}: {batch?.date || "—"}
          </p>
        </div>

        <div className="flex flex-col items-stretch sm:items-end gap-2">
          {deadline && (
            <div className="text-sm font-mono">
              {isEditable ? (
                <span className="text-red-600 dark:text-red-400 font-semibold">
                  {t("editWindowLeft")}: {remainingLabel}
                </span>
              ) : (
                <span className="text-red-600 dark:text-red-400 font-semibold">
                  {t("editWindowExpired")}
                </span>
              )}
            </div>
          )}

          <button
            onClick={openModal}
            disabled={!isEditable}
            className="btn-primary inline-flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
            title={!isEditable ? t("editWindowExpired") : undefined}
          >
            + {t("newProduct")}
          </button>
        </div>
      </div>

      <Card>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("searchProducts")}
          className="input-field"
        />
      </Card>

      <Card>
        <h3 className="font-semibold mb-3">
          {t("productsInBatch")}{" "}
          <span className="text-xs text-gray-500 font-normal">
            ({filteredItems.length})
          </span>
        </h3>

        {filteredItems.length === 0 ? (
          <p className="text-gray-500 text-sm">{t("noProductsInBatch")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b border-gray-200 dark:border-gray-800">
                  <th className="py-2 pr-3">{t("name")}</th>
                  <th className="py-2 pr-3">{t("category")}</th>
                  <th className="py-2 pr-3">{t("barcode")}</th>
                  <th className="py-2 pr-3">{t("unit")}</th>
                  <th className="py-2 pr-3 text-right">{t("qty")}</th>
                  <th className="py-2 pr-3 text-right">{t("purchasePrice")}</th>
                  <th className="py-2 pr-3 text-right">{t("purchaseTotal")}</th>
                  <th className="py-2 pr-3 text-right">{t("salePrice")}</th>
                  <th className="py-2 pr-3 text-right">{t("saleTotal")}</th>
                  <th className="py-2 pr-3 text-right"> </th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((i) => (
                  <tr
                    key={i.id}
                    className="border-b border-gray-100 dark:border-gray-800/50"
                  >
                    <td className="py-2 pr-3 font-medium">{i.name}</td>
                    <td className="py-2 pr-3 text-gray-600 dark:text-gray-400">
                      {i.category || "—"}
                    </td>
                    <td className="py-2 pr-3 font-mono text-xs text-gray-600 dark:text-gray-400">
                      {i.barcode || "—"}
                    </td>
                    <td className="py-2 pr-3">{unitLabel(i.unit)}</td>
                    <td className="py-2 pr-3 text-right">
                      {formatNumberDisplay(i.qty)}
                    </td>
                    <td className="py-2 pr-3 text-right">
                      {formatNumberDisplay(i.purchasePrice)}
                    </td>
                    <td className="py-2 pr-3 text-right">
                      {formatNumberDisplay(i.purchaseTotal)}
                    </td>
                    <td className="py-2 pr-3 text-right">
                      {formatNumberDisplay(i.salePrice)}
                    </td>
                    <td className="py-2 pr-3 text-right">
                      {formatNumberDisplay(i.saleTotal)}
                    </td>
                    <td className="py-2 pr-3 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => handlePrint(i)}
                        disabled={!i.barcode}
                        className="text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-700
                                   hover:bg-gray-100 dark:hover:bg-gray-800
                                   disabled:opacity-40 disabled:cursor-not-allowed"
                        title={t("printBarcode")}
                      >
                        🖨 {t("print")}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="font-semibold border-t border-gray-300 dark:border-gray-700">
                  <td className="py-2 pr-3" colSpan={4}>
                    {t("totals")}
                  </td>
                  <td className="py-2 pr-3 text-right">
                    {formatNumberDisplay(totals.qty)}
                  </td>
                  <td className="py-2 pr-3" />
                  <td className="py-2 pr-3 text-right">
                    {formatNumberDisplay(totals.pTotal)}
                  </td>
                  <td className="py-2 pr-3" />
                  <td className="py-2 pr-3 text-right">
                    {formatNumberDisplay(totals.sTotal)}
                  </td>
                  <td className="py-2 pr-3" />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Card>

      {/* Модалка «Новый товар» */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-card w-full max-w-lg p-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-lg">{t("newProduct")}</h3>
              <button
                onClick={() => setModalOpen(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-3">
              {/* Название */}
              <div className="relative" ref={nameWrapperRef}>
                <label className="block text-sm mb-1">{t("name")} *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  onKeyDown={onNameKeyDown}
                  onFocus={() => {
                    if (suggestions.length > 0) setShowSuggest(true);
                  }}
                  className="input-field"
                  autoComplete="off"
                  required
                />
                {showSuggest && suggestions.length > 0 && (
                  <ul className="absolute z-50 left-0 right-0 mt-1 max-h-56 overflow-y-auto bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg">
                    {suggestions.map((s, idx) => (
                      <li
                        key={s.id}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          pickSuggestion(s);
                        }}
                        className={`px-3 py-2 cursor-pointer text-sm ${
                          idx === highlighted
                            ? "bg-primary-100 dark:bg-primary-900/40"
                            : "hover:bg-gray-100 dark:hover:bg-gray-700"
                        }`}
                      >
                        {s.name}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Категория */}
              <div>
                <label className="block text-sm mb-1">{t("category")} *</label>
                <select
                  value={form.categoryId}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, categoryId: e.target.value }))
                  }
                  className="input-field"
                  required
                >
                  <option value="">{t("selectCategory")}</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                {categories.length === 0 && (
                  <p className="text-xs text-amber-600 mt-1">
                    {t("noCategoriesHint")}
                  </p>
                )}
              </div>

              {/* Мера */}
              <div>
                <label className="block text-sm mb-1">{t("unit")} *</label>
                <select
                  value={form.unit}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, unit: e.target.value }))
                  }
                  className="input-field"
                  required
                >
                  <option value="">{t("selectUnit")}</option>
                  {UNITS.map((u) => (
                    <option key={u.value} value={u.value}>
                      {t(u.labelKey)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Количество */}
              <div>
                <label className="block text-sm mb-1">{t("qty")} *</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={form.qty}
                  onChange={handleNumberChange("qty")}
                  className="input-field"
                  placeholder="0"
                  required
                />
              </div>

              {/* Покупная цена */}
              <div>
                <label className="block text-sm mb-1">
                  {t("purchasePrice")} *
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={form.purchasePrice}
                  onChange={handleNumberChange("purchasePrice")}
                  className="input-field"
                  placeholder="0"
                  required
                />
              </div>

              {/* Итоговая покупная */}
              <div>
                <label className="block text-sm mb-1">
                  {t("purchaseTotal")}
                </label>
                <input
                  type="text"
                  value={formatNumberDisplay(purchaseTotal)}
                  readOnly
                  className="input-field bg-gray-100 dark:bg-gray-800"
                />
              </div>

              {/* Продажная цена */}
              <div>
                <label className="block text-sm mb-1">{t("salePrice")} *</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={form.salePrice}
                  onChange={handleNumberChange("salePrice")}
                  className="input-field"
                  placeholder="0"
                  required
                />
              </div>

              {/* Итоговая продажная */}
              <div>
                <label className="block text-sm mb-1">{t("saleTotal")}</label>
                <input
                  type="text"
                  value={formatNumberDisplay(saleTotal)}
                  readOnly
                  className="input-field bg-gray-100 dark:bg-gray-800"
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
                  disabled={!canSave}
                  className="btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
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
