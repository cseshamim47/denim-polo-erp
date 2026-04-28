"use client";

import { useDeferredValue, useEffect, useRef, useState } from "react";

type Product = {
  id: string;
  name: string;
  category: string;
};

type Variant = {
  id: string;
  productId: string;
  color: string;
  size: string;
  sku: string;
  stockQty: number;
  sellingPrice: number;
};

type CartLine = {
  variantId: string;
  label: string;
  sku: string;
  qty: number;
  sellingPrice: number;
};

type SaleHistoryItem = {
  id: string;
  saleNumber: string;
  saleDate: string;
  paymentMethod: string;
  subtotal: number;
  discountTotal: number;
  grandTotal: number;
  note: string | null;
  itemCount: number;
  status: string;
  items: Array<{
    id: string;
    skuSnapshot: string;
    productSnapshot: string;
    colorSnapshot: string;
    sizeSnapshot: string;
    qty: number;
  }>;
};

function currency(value: number) {
  return new Intl.NumberFormat("en-BD", {
    style: "currency",
    currency: "BDT",
    maximumFractionDigits: 0,
  }).format(value);
}

export default function NewSalePage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [allVariants, setAllVariants] = useState<Variant[]>([]);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [category, setCategory] = useState("");
  const [productId, setProductId] = useState("");
  const [variantId, setVariantId] = useState("");
  const [qty, setQty] = useState(1);
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [search, setSearch] = useState("");
  const [skuInput, setSkuInput] = useState("");
  const [isSkuDropdownOpen, setIsSkuDropdownOpen] = useState(false);
  const [showNoteInput, setShowNoteInput] = useState(false);
  const [showReduceInput, setShowReduceInput] = useState(false);
  const [note, setNote] = useState("");
  const [reduceAmount, setReduceAmount] = useState(0);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [salesHistory, setSalesHistory] = useState<SaleHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historySearch, setHistorySearch] = useState("");
  const [historyPaymentMethod, setHistoryPaymentMethod] = useState("all");
  const [historyStatus, setHistoryStatus] = useState("all");
  const [historyFromDate, setHistoryFromDate] = useState("");
  const [historyToDate, setHistoryToDate] = useState("");
  const [historyRefreshToken, setHistoryRefreshToken] = useState(0);
  const ignoreNextSkuBlurRef = useRef(false);
  const deferredSearch = useDeferredValue(search);
  const deferredHistorySearch = useDeferredValue(historySearch);

  useEffect(() => {
    async function loadProducts() {
      const [productsResponse, variantsResponse] = await Promise.all([
        fetch("/api/products", { cache: "no-store" }),
        fetch("/api/variants", { cache: "no-store" }),
      ]);

      const payload = (await productsResponse.json()) as {
        products?: Product[];
        error?: string;
      };
      const variantsPayload = (await variantsResponse.json()) as {
        variants?: Variant[];
      };

      if (productsResponse.ok && payload.products) {
        setProducts(payload.products);
      }

      if (variantsResponse.ok) {
        setAllVariants(variantsPayload.variants ?? []);
      }
    }

    void loadProducts();
  }, []);

  useEffect(() => {
    async function loadVariants() {
      const query = deferredSearch
        ? `?search=${encodeURIComponent(deferredSearch)}`
        : productId
          ? `?productId=${encodeURIComponent(productId)}`
          : "";

      if (!query) {
        setVariants([]);
        return;
      }

      const response = await fetch(`/api/variants${query}`, {
        cache: "no-store",
      });
      const payload = (await response.json()) as { variants?: Variant[] };
      setVariants(payload.variants ?? []);
    }

    void loadVariants();
  }, [deferredSearch, productId]);

  useEffect(() => {
    async function loadSalesHistory() {
      setHistoryLoading(true);
      setHistoryError(null);

      const params = new URLSearchParams();

      if (deferredHistorySearch.trim()) {
        params.set("search", deferredHistorySearch.trim());
      }

      if (historyPaymentMethod !== "all") {
        params.set("paymentMethod", historyPaymentMethod);
      }

      if (historyStatus !== "all") {
        params.set("status", historyStatus);
      }

      if (historyFromDate) {
        params.set("from", historyFromDate);
      }

      if (historyToDate) {
        params.set("to", historyToDate);
      }

      const query = params.toString();
      const response = await fetch(`/api/sales${query ? `?${query}` : ""}`, {
        cache: "no-store",
      });
      const payload = (await response.json()) as {
        sales?: SaleHistoryItem[];
        error?: string;
      };

      if (!response.ok) {
        setHistoryError(payload.error ?? "Unable to load sales history.");
        setHistoryLoading(false);
        return;
      }

      setSalesHistory(payload.sales ?? []);
      setHistoryLoading(false);
    }

    void loadSalesHistory();
  }, [
    deferredHistorySearch,
    historyFromDate,
    historyPaymentMethod,
    historyRefreshToken,
    historyStatus,
    historyToDate,
  ]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setHistoryRefreshToken((current) => current + 1);
    }, 15000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  const categories = Array.from(
    new Set(products.map((product) => product.category)),
  );
  const filteredProducts = category
    ? products.filter((product) => product.category === category)
    : products;
  const selectedVariant = variants.find((variant) => variant.id === variantId);
  const skuOptions = skuInput
    ? allVariants
        .filter((variant) =>
          variant.sku.toLocaleLowerCase().includes(skuInput.toLocaleLowerCase()),
        )
        .slice(0, 40)
    : allVariants.slice(0, 40);
  const total = cart.reduce(
    (sum, line) => sum + line.qty * line.sellingPrice,
    0,
  );
  const maxReduceAmount = Math.min(50, total * 0.05);
  const appliedReduceAmount = Math.min(
    Math.max(reduceAmount, 0),
    maxReduceAmount,
  );
  const payableTotal = Math.max(total - appliedReduceAmount, 0);

  function updateReduceAmount(nextValue: number) {
    const boundedValue = Math.min(Math.max(nextValue, 0), maxReduceAmount);
    setReduceAmount(boundedValue);
  }

  function formatSaleDate(dateValue: string) {
    const parsedDate = new Date(dateValue);

    if (Number.isNaN(parsedDate.getTime())) {
      return "-";
    }

    return parsedDate.toLocaleString("en-BD", {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function getProductNameById(id: string) {
    return products.find((product) => product.id === id)?.name ?? "Unknown";
  }

  function applySkuSelection(nextValue: string) {
    const normalizedSku = nextValue.trim().toUpperCase();
    const matchedVariant = allVariants.find(
      (variant) => variant.sku === normalizedSku,
    );

    setSkuInput(nextValue);
    setSearch(nextValue);

    if (matchedVariant) {
      const matchedProduct = products.find(
        (product) => product.id === matchedVariant.productId,
      );

      if (matchedProduct) {
        setCategory(matchedProduct.category);
      }

      setProductId(matchedVariant.productId);
      setVariantId(matchedVariant.id);
    }
  }

  function addLine() {
    if (!selectedVariant) {
      setStatus("Select variant first.");
      return;
    }

    setCart((currentCart) => {
      const existingLine = currentCart.find(
        (line) => line.variantId === selectedVariant.id,
      );

      if (existingLine) {
        return currentCart.map((line) =>
          line.variantId === selectedVariant.id
            ? { ...line, qty: line.qty + qty }
            : line,
        );
      }

      const productName =
        products.find((product) => product.id === selectedVariant.productId)
          ?.name ?? "Variant";

      return [
        ...currentCart,
        {
          variantId: selectedVariant.id,
          label: `${productName} · ${selectedVariant.color} · ${selectedVariant.size}`,
          sku: selectedVariant.sku,
          qty,
          sellingPrice: selectedVariant.sellingPrice,
        },
      ];
    });

    setQty(1);
    setSkuInput("");
    setSearch("");
    setIsSkuDropdownOpen(false);
    setVariantId("");
    setStatus(null);
  }

  async function submitSale() {
    if (!cart.length) {
      setStatus("Add at least one line before confirming sale.");
      return;
    }

    if (reduceAmount < 0) {
      setStatus("Reduced amount cannot be negative.");
      return;
    }

    if (reduceAmount > maxReduceAmount) {
      setStatus(
        `Reduced amount exceeds limit (${currency(maxReduceAmount)}).`,
      );
      return;
    }

    setStatus("Saving sale...");

    const response = await fetch("/api/sales", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        paymentMethod,
        saleDate: new Date().toISOString(),
        discountAmount: appliedReduceAmount,
        note: note.trim() || undefined,
        items: cart.map((line) => ({
          variantId: line.variantId,
          qty: line.qty,
          sellingPrice: line.sellingPrice,
        })),
      }),
    });

    const payload = (await response.json()) as {
      saleId?: string;
      error?: string;
    };

    if (!response.ok) {
      setStatus(payload.error ?? "Sale failed.");
      return;
    }

    setCart([]);
    setReduceAmount(0);
    setNote("");
    setShowNoteInput(false);
    setStatus(`Sale saved: ${payload.saleId}`);
    setHistoryRefreshToken((current) => current + 1);
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="space-y-6">
        <div className="rounded-[1.8rem] bg-(--surface-panel-strong) p-6 ring-1 ring-(--stroke-soft)">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-(--text-secondary)">
            Fast sales entry
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight">
            Category to confirm in a few taps.
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-(--text-secondary)">
            Default quantity stays at 1. Search works for quick SKU lookup. Same
            variant merges into one line.
          </p>
        </div>

        <div className="grid gap-4 rounded-[1.8rem] bg-white/80 p-6 ring-1 ring-(--stroke-soft) md:grid-cols-2">
          <div className="relative space-y-2 text-sm text-(--text-secondary) md:col-span-2">
            <p>Search SKU / color / size</p>
            <input
              className="field"
              value={skuInput}
              onBlur={() => {
                if (ignoreNextSkuBlurRef.current) {
                  ignoreNextSkuBlurRef.current = false;
                  return;
                }

                window.setTimeout(() => setIsSkuDropdownOpen(false), 120);
              }}
              onChange={(event) => {
                applySkuSelection(event.target.value);
                setIsSkuDropdownOpen(true);
              }}
              onFocus={() => setIsSkuDropdownOpen(true)}
              placeholder="Type SKU to auto-select variant"
            />
            {isSkuDropdownOpen && skuOptions.length > 0 ? (
              <div className="absolute z-10 mt-1 grid max-h-64 w-full gap-1 overflow-y-auto rounded-[1.2rem] border border-(--stroke-soft) bg-white p-2 shadow-lg">
                {skuOptions.map((variant) => (
                  <button
                    key={variant.id}
                    className="rounded-xl px-3 py-2 text-left text-sm text-(--text-primary) hover:bg-(--surface-accent-soft)"
                    onPointerDown={(event) => {
                      event.preventDefault();
                      ignoreNextSkuBlurRef.current = true;
                      applySkuSelection(variant.sku);
                      setIsSkuDropdownOpen(false);
                    }}
                    type="button"
                  >
                    <span className="font-medium">{variant.sku}</span>
                    <span className="ml-2 text-(--text-secondary)">
                      {getProductNameById(variant.productId)} · {variant.color} · {variant.size}
                    </span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          <label className="space-y-2 text-sm text-(--text-secondary)">
            Category
            <select
              className="field"
              value={category}
              onChange={(event) => {
                setCategory(event.target.value);
                setProductId("");
                setVariantId("");
              }}
            >
              <option value="">All categories</option>
              {categories.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-2 text-sm text-(--text-secondary)">
            Product
            <select
              className="field"
              value={productId}
              onChange={(event) => {
                setProductId(event.target.value);
                setSkuInput("");
                setVariantId("");
              }}
            >
              <option value="">Select product</option>
              {filteredProducts.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-2 text-sm text-(--text-secondary)">
            Variant
            <select
              className="field"
              value={variantId}
              onChange={(event) => {
                const nextVariantId = event.target.value;
                setVariantId(nextVariantId);

                const nextVariant = variants.find(
                  (variant) => variant.id === nextVariantId,
                );
                if (nextVariant) {
                  setSkuInput(nextVariant.sku);
                }
              }}
            >
              <option value="">Select variant</option>
              {variants.map((variant) => (
                <option key={variant.id} value={variant.id}>
                  {variant.sku} · {variant.color} · {variant.size} · stock{" "}
                  {variant.stockQty}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-2 text-sm text-(--text-secondary)">
            Quantity
            <input
              className="field"
              min={1}
              type="number"
              value={qty}
              onChange={(event) => setQty(Number(event.target.value) || 1)}
            />
          </label>
          <label className="space-y-2 text-sm text-(--text-secondary)">
            Payment method
            <select
              className="field"
              value={paymentMethod}
              onChange={(event) => setPaymentMethod(event.target.value)}
            >
              <option value="cash">Cash</option>
              <option value="bkash">bKash</option>
              <option value="card">Card</option>
            </select>
          </label>
        </div>

        <button
          className="btn-primary w-full sm:w-auto"
          onClick={addLine}
          type="button"
        >
          Add line
        </button>
        </section>

        <aside className="space-y-4 rounded-[1.8rem] bg-(--surface-accent) p-6 text-(--text-inverse)">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-white/60">
              Current sale
            </p>
            <h3 className="mt-3 text-3xl font-semibold tracking-tight">
              {currency(payableTotal)}
            </h3>
            <p className="mt-1 text-xs text-white/70">
              Subtotal {currency(total)}
              {appliedReduceAmount > 0
                ? ` · Reduced ${currency(appliedReduceAmount)}`
                : ""}
            </p>
          </div>
          <button className="btn-secondary" onClick={submitSale} type="button">
            Confirm sale
          </button>
        </div>

        <div className="rounded-[1.2rem] bg-white/10 p-4">
          <div className="flex flex-wrap gap-2">
            <button
              className="btn-secondary"
              onClick={() => setShowNoteInput((current) => !current)}
              type="button"
            >
              {showNoteInput ? "Hide Note" : "Add Note"}
            </button>
            <button
              className="btn-secondary"
              onClick={() => setShowReduceInput((current) => !current)}
              type="button"
            >
              {showReduceInput ? "Hide Reduce Amount" : "Reduce Amount"}
            </button>
          </div>
          {showReduceInput ? (
            <label className="mt-3 block space-y-2 text-sm text-white/80">
              Reduce amount
              <input
                className="field text-foreground"
                min={0}
                max={maxReduceAmount}
                step="0.01"
                type="number"
                value={reduceAmount === 0 ? "" : reduceAmount}
                onChange={(event) =>
                  updateReduceAmount(Number(event.target.value) || 0)
                }
                placeholder="0"
              />
              <p className="text-xs text-white/70">
                Max allowed: {currency(maxReduceAmount)} (lower of Tk 50 or 5% of subtotal)
              </p>
            </label>
          ) : null}
          {showNoteInput ? (
            <textarea
              className="field mt-3 min-h-24 text-foreground"
              placeholder="Optional note for this sale"
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          ) : null}
        </div>

        <div className="space-y-3">
          {cart.length ? (
            cart.map((line) => (
              <div
                key={line.variantId}
                className="rounded-[1.4rem] bg-white/10 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-white">{line.label}</p>
                    <p className="mt-1 text-xs uppercase tracking-[0.2em] text-white/60">
                      {line.sku}
                    </p>
                  </div>
                  <button
                    className="text-sm text-white/70"
                    onClick={() =>
                      setCart((currentCart) =>
                        currentCart.filter(
                          (item) => item.variantId !== line.variantId,
                        ),
                      )
                    }
                    type="button"
                  >
                    Remove
                  </button>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <label className="space-y-2 text-white/70">
                    Qty
                    <input
                      className="field text-foreground"
                      type="number"
                      min={1}
                      value={line.qty}
                      onChange={(event) =>
                        setCart((currentCart) =>
                          currentCart.map((item) =>
                            item.variantId === line.variantId
                              ? {
                                  ...item,
                                  qty: Number(event.target.value) || 1,
                                }
                              : item,
                          ),
                        )
                      }
                    />
                  </label>
                  <label className="space-y-2 text-white/70">
                    Selling price
                    <input
                      className="field text-foreground"
                      type="number"
                      min={0}
                      value={line.sellingPrice}
                      onChange={(event) =>
                        setCart((currentCart) =>
                          currentCart.map((item) =>
                            item.variantId === line.variantId
                              ? {
                                  ...item,
                                  sellingPrice: Number(event.target.value) || 0,
                                }
                              : item,
                          ),
                        )
                      }
                    />
                  </label>
                </div>
              </div>
            ))
          ) : (
            <p className="rounded-[1.4rem] border border-dashed border-white/20 p-4 text-sm text-white/70">
              Cart empty. Pick product, variant, qty, then add line.
            </p>
          )}
        </div>

        {status ? <p className="text-sm text-white/80">{status}</p> : null}
        </aside>
      </div>

      <section className="rounded-[1.8rem] bg-white/80 p-6 ring-1 ring-(--stroke-soft)">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-(--text-secondary)">
              Sales history
            </p>
            <h3 className="mt-2 text-2xl font-semibold tracking-tight text-(--text-primary)">
              Live sale table
            </h3>
          </div>
          <button
            className="btn-secondary"
            onClick={() => setHistoryRefreshToken((current) => current + 1)}
            type="button"
          >
            Refresh
          </button>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <label className="space-y-2 text-sm text-(--text-secondary) xl:col-span-2">
            Search sale no, SKU, product, note
            <input
              className="field"
              placeholder="Ex: SALE-..., SKU"
              value={historySearch}
              onChange={(event) => setHistorySearch(event.target.value)}
            />
          </label>
          <label className="space-y-2 text-sm text-(--text-secondary)">
            Payment
            <select
              className="field"
              value={historyPaymentMethod}
              onChange={(event) => setHistoryPaymentMethod(event.target.value)}
            >
              <option value="all">All</option>
              <option value="cash">Cash</option>
              <option value="bkash">bKash</option>
              <option value="card">Card</option>
            </select>
          </label>
          <label className="space-y-2 text-sm text-(--text-secondary)">
            Status
            <select
              className="field"
              value={historyStatus}
              onChange={(event) => setHistoryStatus(event.target.value)}
            >
              <option value="all">All</option>
              <option value="completed">Completed</option>
              <option value="voided">Voided</option>
            </select>
          </label>
          <div className="grid gap-3 sm:grid-cols-2 xl:col-span-5">
            <label className="space-y-2 text-sm text-(--text-secondary)">
              From date
              <input
                className="field"
                type="date"
                value={historyFromDate}
                onChange={(event) => setHistoryFromDate(event.target.value)}
              />
            </label>
            <label className="space-y-2 text-sm text-(--text-secondary)">
              To date
              <input
                className="field"
                type="date"
                value={historyToDate}
                onChange={(event) => setHistoryToDate(event.target.value)}
              />
            </label>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto rounded-[1.2rem] border border-(--stroke-soft)">
          <table className="min-w-full text-sm text-(--text-primary)">
            <thead className="bg-(--surface-panel-strong) text-xs uppercase tracking-[0.18em] text-(--text-secondary)">
              <tr>
                <th className="px-4 py-3 text-left">Date</th>
                <th className="px-4 py-3 text-left">Sale no</th>
                <th className="px-4 py-3 text-left">Payment</th>
                <th className="px-4 py-3 text-left">Items</th>
                <th className="px-4 py-3 text-right">Subtotal</th>
                <th className="px-4 py-3 text-right">Discount</th>
                <th className="px-4 py-3 text-right">Grand total</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Note</th>
              </tr>
            </thead>
            <tbody>
              {salesHistory.map((sale) => (
                <tr
                  key={sale.id}
                  className="border-t border-(--stroke-soft) align-top"
                >
                  <td className="whitespace-nowrap px-4 py-3 text-(--text-secondary)">
                    {formatSaleDate(sale.saleDate)}
                  </td>
                  <td className="px-4 py-3 font-medium">{sale.saleNumber}</td>
                  <td className="whitespace-nowrap px-4 py-3 capitalize">
                    {sale.paymentMethod}
                  </td>
                  <td className="px-4 py-3 text-(--text-secondary)">
                    <p>{sale.itemCount} line(s)</p>
                    <p className="mt-1 text-xs">
                      {sale.items
                        .slice(0, 2)
                        .map((item) => `${item.skuSnapshot} x${item.qty}`)
                        .join(" | ") || "-"}
                    </p>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    {currency(sale.subtotal)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    {currency(sale.discountTotal)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right font-semibold">
                    {currency(sale.grandTotal)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 capitalize">
                    {sale.status}
                  </td>
                  <td className="px-4 py-3 text-(--text-secondary)">
                    {sale.note || "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!historyLoading && !historyError && salesHistory.length === 0 ? (
            <p className="p-4 text-sm text-(--text-secondary)">
              No sales matched your filters.
            </p>
          ) : null}
          {historyLoading ? (
            <p className="p-4 text-sm text-(--text-secondary)">
              Loading sales history...
            </p>
          ) : null}
          {historyError ? (
            <p className="p-4 text-sm text-red-600">{historyError}</p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
