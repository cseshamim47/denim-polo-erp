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
  avgCost: number;
  sellingPrice: number;
  inventoryMode: "unit" | "volume" | "packaging";
  unitLabel: string;
  allowDecimalQty: boolean;
};

type PerfumeRule = {
  id: string;
  perfumeVariantId: string;
  perfumeLabel: string;
  bottleVariantId: string;
  bottleLabel: string;
  fillMl: number;
  bottleSellingPrice: number;
  isActive: boolean;
};

type PerfumePricingPayload = {
  rules: PerfumeRule[];
  perfumes: Array<{
    id: string;
    productId: string;
    productName: string;
    sku: string;
    size: string;
    stockQty: number;
    unitLabel: string;
  }>;
  bottles: Array<{
    id: string;
    productId: string;
    productName: string;
    sku: string;
    size: string;
    stockQty: number;
    unitLabel: string;
    defaultSellingPrice: number;
  }>;
};

type StandardCartLine = {
  mode: "standard";
  variantId: string;
  label: string;
  sku: string;
  qty: number;
  sellingPrice: number;
};

type PerfumeCartLine = {
  mode: "perfume";
  pricingRuleId: string;
  perfumeVariantId: string;
  bottleVariantId: string;
  label: string;
  sku: string;
  soldMl: number;
  bottleLabel: string;
  sellingPrice: number;
};

type CartLine = StandardCartLine | PerfumeCartLine;

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
  const [perfumeVariantId, setPerfumeVariantId] = useState("");
  const [perfumeRuleId, setPerfumeRuleId] = useState("");
  const [perfumeMode, setPerfumeMode] = useState<"preset" | "custom">("preset");
  const [customPerfumeMl, setCustomPerfumeMl] = useState(5);
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
  const [perfumePricing, setPerfumePricing] = useState<PerfumePricingPayload>({
    rules: [],
    perfumes: [],
    bottles: [],
  });
  const ignoreNextSkuBlurRef = useRef(false);
  const deferredSearch = useDeferredValue(search);
  const deferredHistorySearch = useDeferredValue(historySearch);

  useEffect(() => {
    async function loadProducts() {
      const [productsResponse, variantsResponse] = await Promise.all([
        fetch("/api/products?forOptions=1", { cache: "no-store" }),
        fetch("/api/variants?forOptions=1", { cache: "no-store" }),
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
    async function loadPerfumePricing() {
      const response = await fetch("/api/perfume-pricing", {
        cache: "no-store",
      });
      const payload = (await response.json()) as
        | PerfumePricingPayload
        | { error?: string };

      if (response.ok && "rules" in payload) {
        setPerfumePricing(payload);
      }
    }

    void loadPerfumePricing();
  }, []);

  useEffect(() => {
    async function loadVariants() {
      const params = new URLSearchParams({ inventoryMode: "unit" });

      if (deferredSearch) {
        params.set("search", deferredSearch);
      } else if (productId) {
        params.set("productId", productId);
      }

      if (!deferredSearch && !productId) {
        setVariants([]);
        return;
      }

      const response = await fetch(`/api/variants?${params.toString()}`, {
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
    new Set(
      products
        .filter((product) =>
          allVariants.some(
            (variant) =>
              variant.productId === product.id &&
              variant.inventoryMode === "unit",
          ),
        )
        .map((product) => product.category),
    ),
  );
  const filteredProducts = category
    ? products.filter((product) => product.category === category)
    : products;
  const selectedVariant = variants.find((variant) => variant.id === variantId);
  const skuOptions = skuInput
    ? allVariants
        .filter(
          (variant) =>
            variant.inventoryMode === "unit" &&
          variant.sku
            .toLocaleLowerCase()
            .includes(skuInput.toLocaleLowerCase()),
        )
        .slice(0, 40)
    : allVariants.filter((variant) => variant.inventoryMode === "unit").slice(0, 40);
  const total = cart.reduce(
    (sum, line) =>
      sum +
      (line.mode === "standard"
        ? line.qty * line.sellingPrice
        : line.sellingPrice),
    0,
  );
  const maxReduceAmount = Math.min(50, total * 0.05);
  const appliedReduceAmount = Math.min(
    Math.max(reduceAmount, 0),
    maxReduceAmount,
  );
  const payableTotal = Math.max(total - appliedReduceAmount, 0);
  const perfumeRulesForSelectedPerfume = perfumePricing.rules.filter(
    (rule) =>
      rule.isActive &&
      (!perfumeVariantId || rule.perfumeVariantId === perfumeVariantId),
  );
  const selectedPerfumeRule =
    perfumePricing.rules.find((rule) => rule.id === perfumeRuleId) ?? null;
  const selectedPerfumeVariant =
    allVariants.find((variant) => variant.id === perfumeVariantId) ?? null;
  const selectedBottleVariant = selectedPerfumeRule
    ? allVariants.find(
        (variant) => variant.id === selectedPerfumeRule.bottleVariantId,
      ) ?? null
    : null;
  const perfumeSoldMl =
    perfumeMode === "preset"
      ? selectedPerfumeRule?.fillMl ?? 0
      : customPerfumeMl;
  const perfumePreviewLiquidCost =
    selectedPerfumeVariant && perfumeSoldMl > 0
      ? selectedPerfumeVariant.avgCost * perfumeSoldMl
      : 0;
  const perfumePreviewSellingPrice =
    selectedPerfumeRule && perfumeSoldMl > 0
      ? perfumePreviewLiquidCost * 2 + selectedPerfumeRule.bottleSellingPrice
      : 0;
  const perfumePreviewBottleCost = selectedBottleVariant?.avgCost ?? 0;
  const perfumePreviewProfit =
    perfumePreviewSellingPrice -
    perfumePreviewLiquidCost -
    perfumePreviewBottleCost;

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
        (line) =>
          line.mode === "standard" && line.variantId === selectedVariant.id,
      );

      if (existingLine) {
        return currentCart.map((line) =>
          line.mode === "standard" && line.variantId === selectedVariant.id
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
          mode: "standard",
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

  function addPerfumeLine() {
    if (!selectedPerfumeVariant || !selectedPerfumeRule || perfumeSoldMl <= 0) {
      setStatus("Pick perfume, bottle rule, and ml first.");
      return;
    }

    if (selectedPerfumeVariant.stockQty < perfumeSoldMl) {
      setStatus("Not enough perfume liquid stock.");
      return;
    }

    if (!selectedBottleVariant || selectedBottleVariant.stockQty < 1) {
      setStatus("Selected bottle is out of stock.");
      return;
    }

    setCart((currentCart) => [
      ...currentCart,
      {
        mode: "perfume",
        pricingRuleId: selectedPerfumeRule.id,
        perfumeVariantId: selectedPerfumeVariant.id,
        bottleVariantId: selectedPerfumeRule.bottleVariantId,
        label: selectedPerfumeRule.perfumeLabel,
        sku: selectedPerfumeVariant.sku,
        soldMl: perfumeSoldMl,
        bottleLabel: selectedPerfumeRule.bottleLabel,
        sellingPrice: perfumePreviewSellingPrice,
      },
    ]);

    setPerfumeRuleId("");
    setCustomPerfumeMl(5);
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
      setStatus(`Reduced amount exceeds limit (${currency(maxReduceAmount)}).`);
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
          ...(line.mode === "standard"
            ? {
                variantId: line.variantId,
                qty: line.qty,
                sellingPrice: line.sellingPrice,
              }
            : {
                mode: "perfume" as const,
                pricingRuleId: line.pricingRuleId,
                soldMl: line.soldMl,
              }),
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
              Create a sale in a few taps.
            </h2>
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
                        {getProductNameById(variant.productId)} ·{" "}
                        {variant.color} · {variant.size}
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

          <div className="flex flex-wrap gap-3">
            <button
              className="btn-primary w-full sm:w-auto"
              onClick={addLine}
              type="button"
            >
              Add standard line
            </button>
          </div>

          <div className="grid gap-4 rounded-[1.8rem] bg-white/80 p-6 ring-1 ring-(--stroke-soft)">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-(--text-secondary)">
                Perfume sale
              </p>
              <h3 className="mt-2 text-2xl font-semibold tracking-tight">
                Sell perfume by ml
              </h3>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2 text-sm text-(--text-secondary)">
                Perfume liquid
                <select
                  className="field"
                  value={perfumeVariantId}
                  onChange={(event) => {
                    setPerfumeVariantId(event.target.value);
                    setPerfumeRuleId("");
                  }}
                >
                  <option value="">Select perfume</option>
                  {perfumePricing.perfumes.map((perfume) => (
                    <option key={perfume.id} value={perfume.id}>
                      {perfume.productName} · {perfume.sku} · stock {perfume.stockQty}{" "}
                      {perfume.unitLabel}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-2 text-sm text-(--text-secondary)">
                Price rule / bottle
                <select
                  className="field"
                  value={perfumeRuleId}
                  onChange={(event) => setPerfumeRuleId(event.target.value)}
                >
                  <option value="">Select bottle rule</option>
                  {perfumeRulesForSelectedPerfume.map((rule: PerfumeRule) => (
                    <option key={rule.id} value={rule.id}>
                      {rule.bottleLabel} · default {rule.fillMl}ml · add-on{" "}
                      {currency(rule.bottleSellingPrice)}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="inline-flex rounded-2xl bg-(--surface-accent-soft) p-1">
              <button
                className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
                  perfumeMode === "preset"
                    ? "bg-(--surface-accent) text-white"
                    : "text-(--text-secondary)"
                }`}
                onClick={() => setPerfumeMode("preset")}
                type="button"
              >
                Preset pack
              </button>
              <button
                className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
                  perfumeMode === "custom"
                    ? "bg-(--surface-accent) text-white"
                    : "text-(--text-secondary)"
                }`}
                onClick={() => setPerfumeMode("custom")}
                type="button"
              >
                Custom ml
              </button>
            </div>

            {perfumeMode === "custom" ? (
              <label className="space-y-2 text-sm text-(--text-secondary)">
                Custom ml
                <input
                  className="field"
                  min={1}
                  type="number"
                  value={customPerfumeMl}
                  onChange={(event) =>
                    setCustomPerfumeMl(Number(event.target.value) || 1)
                  }
                />
              </label>
            ) : null}

            <div className="grid gap-2 rounded-[1.4rem] border border-(--stroke-soft) bg-(--surface-panel-strong) p-4 text-sm text-(--text-secondary) md:grid-cols-2">
              <p>
                Sold ml:{" "}
                <span className="font-semibold text-foreground">
                  {perfumeSoldMl || 0}
                </span>
              </p>
              <p>
                Liquid cost:{" "}
                <span className="font-semibold text-foreground">
                  {currency(perfumePreviewLiquidCost)}
                </span>
              </p>
              <p>
                Bottle buy cost:{" "}
                <span className="font-semibold text-foreground">
                  {currency(perfumePreviewBottleCost)}
                </span>
              </p>
              <p>
                Bottle add-on:{" "}
                <span className="font-semibold text-foreground">
                  {currency(selectedPerfumeRule?.bottleSellingPrice ?? 0)}
                </span>
              </p>
              <p>
                Selling price:{" "}
                <span className="font-semibold text-foreground">
                  {currency(perfumePreviewSellingPrice)}
                </span>
              </p>
              <p>
                Profit:{" "}
                <span className="font-semibold text-foreground">
                  {currency(perfumePreviewProfit)}
                </span>
              </p>
            </div>

            <button
              className="btn-secondary w-full sm:w-auto"
              onClick={addPerfumeLine}
              type="button"
            >
              Add perfume line
            </button>
          </div>
        </section>

        <aside className="space-y-4 rounded-[1.8rem] bg-(--surface-accent) p-6 text-(--text-inverse)">
          <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
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
            <button
              className="btn-secondary w-full sm:w-auto"
              onClick={submitSale}
              type="button"
            >
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
                  step="1"
                  type="number"
                  value={reduceAmount === 0 ? "" : reduceAmount}
                  onChange={(event) =>
                    updateReduceAmount(Number(event.target.value) || 0)
                  }
                  placeholder="0"
                />
                <p className="text-xs text-white/70">
                  Max allowed: {currency(maxReduceAmount)} (lower of Tk 50 or 5%
                  of subtotal)
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
              cart.map((line, index) => (
                <div
                  key={`${line.mode}-${index}`}
                  className="rounded-[1.4rem] bg-white/10 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-white">{line.label}</p>
                      <p className="mt-1 text-xs uppercase tracking-[0.2em] text-white/60">
                        {line.mode === "standard"
                          ? line.sku
                          : `${line.sku} · ${line.soldMl}ML · ${line.bottleLabel}`}
                      </p>
                    </div>
                    <button
                      className="text-sm text-white/70"
                      onClick={() =>
                        setCart((currentCart) =>
                          currentCart.filter((_, cartIndex) => cartIndex !== index),
                        )
                      }
                      type="button"
                    >
                      Remove
                    </button>
                  </div>
                  {line.mode === "standard" ? (
                    <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                      <label className="space-y-2 text-white/70">
                        Qty
                        <input
                          className="field text-foreground"
                          type="number"
                          min={1}
                          value={line.qty}
                          onChange={(event) =>
                            setCart((currentCart) =>
                              currentCart.map((item, cartIndex) =>
                                cartIndex === index && item.mode === "standard"
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
                              currentCart.map((item, cartIndex) =>
                                cartIndex === index && item.mode === "standard"
                                  ? {
                                      ...item,
                                      sellingPrice:
                                        Number(event.target.value) || 0,
                                    }
                                  : item,
                              ),
                            )
                          }
                        />
                      </label>
                    </div>
                  ) : (
                    <div className="mt-4 rounded-[1.2rem] bg-white/8 p-3 text-sm text-white/80">
                      Formula sale. Remove and re-add if you want another ml or
                      bottle rule.
                    </div>
                  )}
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

        <div className="mt-4 grid gap-3 md:hidden">
          {salesHistory.map((sale) => (
            <article
              key={sale.id}
              className="rounded-[1.2rem] border border-(--stroke-soft) p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-(--text-primary)">
                    {sale.saleNumber}
                  </p>
                  <p className="mt-1 text-sm text-(--text-secondary)">
                    {formatSaleDate(sale.saleDate)} · {sale.paymentMethod}
                  </p>
                </div>
                <span className="rounded-full bg-(--surface-accent-soft) px-2 py-1 text-xs capitalize text-(--text-secondary)">
                  {sale.status}
                </span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-sm text-(--text-secondary)">
                <p>Subtotal: {currency(sale.subtotal)}</p>
                <p className="text-right">
                  Discount: {currency(sale.discountTotal)}
                </p>
                <p className="col-span-2 font-semibold text-(--text-primary)">
                  Grand total: {currency(sale.grandTotal)}
                </p>
              </div>
              <p className="mt-3 text-xs leading-6 text-(--text-secondary)">
                {sale.items
                  .slice(0, 3)
                  .map((item) => `${item.skuSnapshot} x${item.qty}`)
                  .join(" | ") || "-"}
              </p>
              {sale.note ? (
                <p className="mt-2 text-xs leading-6 text-(--text-secondary)">
                  {sale.note}
                </p>
              ) : null}
            </article>
          ))}
          {!historyLoading && !historyError && salesHistory.length === 0 ? (
            <p className="rounded-[1.2rem] border border-(--stroke-soft) p-4 text-sm text-(--text-secondary)">
              No sales matched your filters.
            </p>
          ) : null}
          {historyLoading ? (
            <p className="rounded-[1.2rem] border border-(--stroke-soft) p-4 text-sm text-(--text-secondary)">
              Loading sales history...
            </p>
          ) : null}
          {historyError ? (
            <p className="rounded-[1.2rem] border border-(--stroke-soft) p-4 text-sm text-red-600">
              {historyError}
            </p>
          ) : null}
        </div>

        <div className="mt-4 hidden overflow-x-auto rounded-[1.2rem] border border-(--stroke-soft) md:block">
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
