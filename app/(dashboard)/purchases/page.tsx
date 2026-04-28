"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

type Product = {
  id: string;
  name: string;
  category: string;
};

type Variant = {
  id: string;
  productId: string;
  sku: string;
  color: string;
  size: string;
  stockQty: number;
  avgCost: number;
  sellingPrice: number;
};

type PurchaseItemForm = {
  id: string;
  sku: string;
  supplier: string;
  productId: string;
  size: string;
  color: string;
  qty: number;
  costPerUnit: number;
};

type PurchaseHistoryRecord = {
  id: string;
  purchaseDate: string;
  sku: string;
  productName: string;
  size: string;
  color: string;
  qty: number;
  costPerUnit: number;
  additionalCost: number;
  totalCost: number;
  cashOutTotal: number;
  note: string | null;
};

type PurchasePayload = {
  purchaseDate: string;
  transportCost: number;
  otherCost: number;
  subtotal: number;
  grandTotal: number;
  items: Array<{
    variantId: string;
    productId: string;
    productName: string;
    sku: string;
    supplier: string;
    size: string;
    color: string;
    qty: number;
    costPerUnit: number;
    additionalCost: number;
    total: number;
  }>;
};

function currency(value: number) {
  return new Intl.NumberFormat("en-BD", {
    style: "currency",
    currency: "BDT",
    maximumFractionDigits: 2,
  }).format(value);
}

function createItem(id: string): PurchaseItemForm {
  return {
    id,
    sku: "",
    supplier: "",
    productId: "",
    size: "",
    color: "",
    qty: 1,
    costPerUnit: 0,
  };
}

async function readJsonResponse<T>(response: Response) {
  const body = await response.text();

  if (!body) {
    return null as T | null;
  }

  return JSON.parse(body) as T;
}

function getErrorMessage(error: unknown) {
  if (typeof error === "string" && error.trim()) {
    return error;
  }

  if (
    error &&
    typeof error === "object" &&
    ("formErrors" in error || "fieldErrors" in error)
  ) {
    const details = error as {
      formErrors?: string[];
      fieldErrors?: Record<string, string[] | undefined>;
    };
    const formErrors = details.formErrors ?? [];
    const fieldErrors = Object.values(details.fieldErrors ?? {}).flat();
    const joined = [...formErrors, ...fieldErrors].filter(Boolean).join(" ");

    if (joined) {
      return joined;
    }
  }

  return "Purchase failed.";
}

function buildBatchNote(payload: PurchasePayload) {
  const lines = [
    `Batch subtotal: ${payload.subtotal.toFixed(2)}`,
    `Transport cost: ${payload.transportCost.toFixed(2)}`,
    `Other cost: ${payload.otherCost.toFixed(2)}`,
    `Batch grand total: ${payload.grandTotal.toFixed(2)}`,
  ].filter(Boolean);

  return lines.join("\n");
}

function allocateAdditionalCosts(
  items: PurchasePayload["items"],
  totalExtraCost: number,
) {
  const totalExtraCostInPaisa = Math.round(totalExtraCost * 100);

  if (items.length === 0 || totalExtraCostInPaisa === 0) {
    return items.map(() => 0);
  }

  const weights = items.map((item) =>
    Math.max(Math.round(item.total * 100), 1),
  );
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);

  let allocated = 0;

  return items.map((_, index) => {
    if (index === items.length - 1) {
      return (totalExtraCostInPaisa - allocated) / 100;
    }

    const share = Math.floor(
      (totalExtraCostInPaisa * weights[index]) / totalWeight,
    );
    allocated += share;
    return share / 100;
  });
}

export default function NewPurchasePage() {
  const nextItemIdRef = useRef(2);
  const [products, setProducts] = useState<Product[]>([]);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [purchaseDate, setPurchaseDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [transportCost, setTransportCost] = useState(0);
  const [otherCost, setOtherCost] = useState(0);
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<PurchaseItemForm[]>([
    createItem("item-1"),
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [historySearch, setHistorySearch] = useState("");
  const [historyFromDate, setHistoryFromDate] = useState("");
  const [historyToDate, setHistoryToDate] = useState("");
  const [purchaseHistory, setPurchaseHistory] = useState<
    PurchaseHistoryRecord[]
  >([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);

  function createNextItem() {
    const nextId = `item-${nextItemIdRef.current}`;
    nextItemIdRef.current += 1;
    return createItem(nextId);
  }

  function setSuccess(msg: string) {
    toast.success(msg);
  }

  function setError(msg: string) {
    toast.error(msg);
  }

  useEffect(() => {
    async function loadCatalog() {
      try {
        const [productsResponse, variantsResponse, purchasesResponse] =
          await Promise.all([
            fetch("/api/products", { cache: "no-store" }),
            fetch("/api/variants", { cache: "no-store" }),
            fetch("/api/purchases", { cache: "no-store" }),
          ]);

        const productsPayload = await readJsonResponse<{
          products?: Product[];
        }>(productsResponse);
        const variantsPayload = await readJsonResponse<{
          variants?: Variant[];
        }>(variantsResponse);
        const purchasesPayload = await readJsonResponse<{
          purchases?: PurchaseHistoryRecord[];
        }>(purchasesResponse);

        if (
          !productsResponse.ok ||
          !variantsResponse.ok ||
          !purchasesResponse.ok
        ) {
          setError("Unable to load purchase catalog right now.");
          return;
        }

        setProducts(productsPayload?.products ?? []);
        setVariants(variantsPayload?.variants ?? []);
        setPurchaseHistory(purchasesPayload?.purchases ?? []);
      } catch {
        setError("Unable to load purchase catalog right now.");
      }
    }

    void loadCatalog();
  }, []);

  async function loadHistory(filters?: {
    search?: string;
    from?: string;
    to?: string;
  }) {
    setIsHistoryLoading(true);

    try {
      const params = new URLSearchParams();
      const activeSearch = filters?.search ?? historySearch;
      const activeFrom = filters?.from ?? historyFromDate;
      const activeTo = filters?.to ?? historyToDate;

      if (activeSearch.trim()) {
        params.set("search", activeSearch.trim());
      }
      if (activeFrom) {
        params.set("from", activeFrom);
      }
      if (activeTo) {
        params.set("to", activeTo);
      }

      const response = await fetch(`/api/purchases?${params.toString()}`, {
        cache: "no-store",
      });
      const payload = await readJsonResponse<{
        purchases?: PurchaseHistoryRecord[];
      }>(response);

      if (!response.ok) {
        setError("Unable to load purchase history right now.");
        return;
      }

      setPurchaseHistory(payload?.purchases ?? []);
    } catch {
      setError("Unable to load purchase history right now.");
    } finally {
      setIsHistoryLoading(false);
    }
  }

  const subtotal = items.reduce(
    (total, item) => total + item.qty * item.costPerUnit,
    0,
  );
  const grandTotal = subtotal + transportCost + otherCost;

  function updateItem(id: string, patch: Partial<PurchaseItemForm>) {
    setItems((current) =>
      current.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );
  }

  function getProductName(productId: string) {
    return products.find((product) => product.id === productId)?.name ?? "";
  }

  function getMatchingVariant(item: PurchaseItemForm) {
    return variants.find(
      (variant) =>
        variant.productId === item.productId &&
        variant.size === item.size.trim().toUpperCase() &&
        variant.color === item.color.trim().toUpperCase(),
    );
  }

  function findVariantBySku(sku: string) {
    const normalizedSku = sku.trim().toUpperCase();

    if (!normalizedSku) {
      return null;
    }

    return variants.find((variant) => variant.sku === normalizedSku) ?? null;
  }

  function getProductVariants(productId: string) {
    return variants.filter((variant) => variant.productId === productId);
  }

  function updateItemSku(id: string, skuValue: string) {
    const normalizedSku = skuValue.toUpperCase();
    const matchedVariant = findVariantBySku(normalizedSku);

    if (!matchedVariant) {
      updateItem(id, { sku: normalizedSku });
      return;
    }

    updateItem(id, {
      sku: matchedVariant.sku,
      productId: matchedVariant.productId,
      size: matchedVariant.size,
      color: matchedVariant.color,
    });
  }

  async function submitPurchase() {
    if (!purchaseDate) {
      setError("Purchase date is required.");
      return;
    }

    if (items.length === 0) {
      setError("Add at least one purchase item.");
      return;
    }

    const resolvedItems = [] as PurchasePayload["items"];

    for (const [index, item] of items.entries()) {
      if (!item.sku.trim()) {
        setError(`Item ${index + 1}: enter or select an SKU.`);
        return;
      }

      if (!item.productId) {
        setError(`Item ${index + 1}: select a product.`);
        return;
      }

      if (!item.supplier.trim()) {
        setError(`Item ${index + 1}: supplier is required.`);
        return;
      }

      if (!item.size.trim()) {
        setError(`Item ${index + 1}: enter a size.`);
        return;
      }

      if (!item.color.trim()) {
        setError(`Item ${index + 1}: enter a color.`);
        return;
      }

      if (item.qty <= 0) {
        setError(`Item ${index + 1}: quantity must be at least 1.`);
        return;
      }

      if (item.costPerUnit <= 0) {
        setError(`Item ${index + 1}: cost per unit is required.`);
        return;
      }

      const matchedVariant = getMatchingVariant(item);

      if (!matchedVariant) {
        setError(
          `Item ${index + 1}: no variant found for the selected product, size, and color.`,
        );
        return;
      }

      if (item.costPerUnit > matchedVariant.sellingPrice) {
        setError(
          `Item ${index + 1}: cost (${currency(item.costPerUnit)}) cannot be more than selling price (${currency(matchedVariant.sellingPrice)}).`,
        );
        return;
      }

      resolvedItems.push({
        variantId: matchedVariant.id,
        productId: item.productId,
        productName: getProductName(item.productId),
        sku: matchedVariant.sku,
        supplier: item.supplier.trim(),
        size: matchedVariant.size,
        color: matchedVariant.color,
        qty: item.qty,
        costPerUnit: item.costPerUnit,
        total: item.qty * item.costPerUnit,
      });
    }

    const additionalCosts = allocateAdditionalCosts(
      resolvedItems.map((item) => ({ ...item, additionalCost: 0 })),
      transportCost + otherCost,
    );

    const payload: PurchasePayload = {
      purchaseDate,
      transportCost,
      otherCost,
      subtotal,
      grandTotal,
      items: resolvedItems.map((item, index) => ({
        ...item,
        additionalCost: additionalCosts[index] ?? 0,
      })),
    };

    setIsSubmitting(true);

    try {
      const batchNote = [
        buildBatchNote(payload),
        notes.trim() ? `Notes: ${notes.trim()}` : null,
      ]
        .filter(Boolean)
        .join("\n");

      for (const [index, item] of payload.items.entries()) {
        const response = await fetch("/api/purchases", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            variantId: item.variantId,
            qty: item.qty,
            costPerUnit: item.costPerUnit,
            additionalCost: item.additionalCost,
            purchaseDate,
            note: [`Supplier: ${item.supplier}`, batchNote]
              .filter(Boolean)
              .join("\n"),
          }),
        });

        const result = await readJsonResponse<{ error?: unknown }>(response);

        if (!response.ok) {
          setError(`Item ${index + 1}: ${getErrorMessage(result?.error)}`);
          setIsSubmitting(false);
          return;
        }
      }

      setSuccess(
        `Saved ${payload.items.length} item${payload.items.length === 1 ? "" : "s"} — grand total ${currency(payload.grandTotal)}.`,
      );
      nextItemIdRef.current = 2;
      setItems([createItem("item-1")]);
      setTransportCost(0);
      setOtherCost(0);
      setNotes("");
      await loadHistory();
    } catch {
      setError("Purchase save failed. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      {/* Header */}
      <div className="rounded-[1.8rem] bg-white/80 p-6 ring-1 ring-(--stroke-soft)">
        <h1 className="text-2xl font-semibold tracking-tight">New Purchase</h1>
        <p className="mt-1 text-sm text-(--text-secondary)">
          Record inventory received.
        </p>
      </div>

      {/* Step 1 — Purchase info */}
      <div className="rounded-[1.8rem] bg-white/80 p-6 ring-1 ring-(--stroke-soft)">
        <div className="flex items-center gap-3">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-(--surface-accent) text-xs font-bold text-(--text-inverse)">
            1
          </span>
          <h2 className="text-lg font-semibold tracking-tight">
            Purchase info
          </h2>
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1.5 text-sm font-medium text-foreground">
            Date
            <input
              className="field"
              type="date"
              value={purchaseDate}
              onChange={(event) => setPurchaseDate(event.target.value)}
            />
          </label>
        </div>
      </div>

      {/* Step 2 — Items */}
      <div className="rounded-[1.8rem] bg-white/80 p-6 ring-1 ring-(--stroke-soft)">
        <div className="flex items-center gap-3">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-(--surface-accent) text-xs font-bold text-(--text-inverse)">
            2
          </span>
          <h2 className="text-lg font-semibold tracking-tight">Items</h2>
          <span className="ml-auto text-sm text-(--text-secondary)">
            {items.length} {items.length === 1 ? "item" : "items"}
          </span>
        </div>

        <div className="mt-5 space-y-3">
          {items.map((item, index) => {
            const matchedVariant = getMatchingVariant(item);
            const rowVariants = getProductVariants(item.productId);
            const skuOptions = Array.from(
              new Set(variants.map((variant) => variant.sku)),
            ).sort((left, right) => left.localeCompare(right));
            const sizeOptions = Array.from(
              new Set(rowVariants.map((variant) => variant.size)),
            );
            const colorOptions = Array.from(
              new Set(rowVariants.map((variant) => variant.color)),
            );
            const rowTotal = item.qty * item.costPerUnit;

            return (
              <div
                key={item.id}
                className="rounded-[1.3rem] bg-(--surface-accent-soft) p-4 ring-1 ring-(--stroke-soft)"
              >
                {/* Item header */}
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-foreground">
                    Item {index + 1}
                  </p>
                  <button
                    className="rounded-full px-3 py-1 text-xs font-medium text-(--danger) ring-1 ring-(--danger)/30 transition-colors hover:bg-(--danger)/8"
                    onClick={() =>
                      setItems((current) =>
                        current.length === 1
                          ? [createItem("item-1")]
                          : current.filter(
                              (currentItem) => currentItem.id !== item.id,
                            ),
                      )
                    }
                    type="button"
                  >
                    Remove
                  </button>
                </div>

                {/* SKU + Product */}
                <div className="mt-3">
                  <label className="grid gap-1.5 text-sm font-medium text-foreground">
                    SKU
                    <input
                      className="field"
                      list={`sku-options-${item.id}`}
                      placeholder="Type or pick an SKU"
                      value={item.sku}
                      onChange={(event) =>
                        updateItemSku(item.id, event.target.value)
                      }
                    />
                    <datalist id={`sku-options-${item.id}`}>
                      {skuOptions.map((sku) => (
                        <option key={sku} value={sku} />
                      ))}
                    </datalist>
                  </label>
                </div>

                <div className="mt-3">
                  <label className="grid gap-1.5 text-sm font-medium text-foreground">
                    Supplier
                    <input
                      className="field"
                      placeholder="Supplier name"
                      value={item.supplier}
                      onChange={(event) =>
                        updateItem(item.id, {
                          supplier: event.target.value,
                        })
                      }
                    />
                  </label>
                </div>

                <div className="mt-3">
                  <label className="grid gap-1.5 text-sm font-medium text-foreground">
                    Product
                    <select
                      className="field"
                      value={item.productId}
                      onChange={(event) =>
                        updateItem(item.id, {
                          productId: event.target.value,
                          sku: "",
                          size: "",
                          color: "",
                        })
                      }
                    >
                      <option value="">Select a product…</option>
                      {products.map((product) => (
                        <option key={product.id} value={product.id}>
                          {product.name} · {product.category}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                {/* Size + Color */}
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <label className="grid gap-1.5 text-sm font-medium text-foreground">
                    Size
                    <input
                      className="field"
                      list={`size-options-${item.id}`}
                      placeholder="e.g. M, 32"
                      value={item.size}
                      onChange={(event) => {
                        const nextSize = event.target.value.toUpperCase();
                        const nextVariant = variants.find(
                          (variant) =>
                            variant.productId === item.productId &&
                            variant.size === nextSize &&
                            variant.color === item.color.trim().toUpperCase(),
                        );

                        updateItem(item.id, {
                          size: nextSize,
                          sku: nextVariant?.sku ?? item.sku,
                        });
                      }}
                    />
                    <datalist id={`size-options-${item.id}`}>
                      {sizeOptions.map((size) => (
                        <option key={size} value={size} />
                      ))}
                    </datalist>
                  </label>
                  <label className="grid gap-1.5 text-sm font-medium text-foreground">
                    Color
                    <input
                      className="field"
                      list={`color-options-${item.id}`}
                      placeholder="e.g. BLK, RED"
                      value={item.color}
                      onChange={(event) => {
                        const nextColor = event.target.value.toUpperCase();
                        const nextVariant = variants.find(
                          (variant) =>
                            variant.productId === item.productId &&
                            variant.size === item.size.trim().toUpperCase() &&
                            variant.color === nextColor,
                        );

                        updateItem(item.id, {
                          color: nextColor,
                          sku: nextVariant?.sku ?? item.sku,
                        });
                      }}
                    />
                    <datalist id={`color-options-${item.id}`}>
                      {colorOptions.map((color) => (
                        <option key={color} value={color} />
                      ))}
                    </datalist>
                  </label>
                </div>

                {/* Qty + Cost + Row total */}
                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  <label className="grid gap-1.5 text-sm font-medium text-foreground">
                    Qty
                    <input
                      className="field"
                      min={1}
                      type="number"
                      value={item.qty}
                      onChange={(event) =>
                        updateItem(item.id, {
                          qty: Math.max(Number(event.target.value) || 0, 0),
                        })
                      }
                    />
                  </label>
                  <label className="grid gap-1.5 text-sm font-medium text-foreground">
                    Cost / unit
                    <input
                      className="field"
                      min={0}
                      placeholder="0"
                      step="0.01"
                      type="number"
                      value={item.costPerUnit === 0 ? "" : item.costPerUnit}
                      onChange={(event) =>
                        updateItem(item.id, {
                          costPerUnit: Math.max(
                            Number(event.target.value) || 0,
                            0,
                          ),
                        })
                      }
                    />
                  </label>
                  <div className="grid gap-1.5">
                    <p className="text-sm font-medium text-foreground">Total</p>
                    <div className="flex min-h-12 items-center rounded-2xl bg-white px-4 text-sm font-semibold text-foreground ring-1 ring-(--stroke-soft)">
                      {currency(rowTotal)}
                    </div>
                  </div>
                </div>

                {/* Variant match status */}
                <div className="mt-3">
                  {item.productId &&
                    (matchedVariant ? (
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl bg-white/70 px-3 py-2 ring-1 ring-(--success)/25">
                          <span className="text-xs font-semibold text-(--success)">
                            ✓ Variant matched
                          </span>
                          <span className="text-xs text-(--text-secondary)">
                            SKU: {matchedVariant.sku}
                          </span>
                          <span className="text-xs text-(--text-secondary)">
                            In stock: {matchedVariant.stockQty}
                          </span>
                          <span className="text-xs text-(--text-secondary)">
                            Avg cost: {currency(matchedVariant.avgCost)}
                          </span>
                          <span className="text-xs text-(--text-secondary)">
                            Selling: {currency(matchedVariant.sellingPrice)}
                          </span>
                        </div>
                        {item.costPerUnit > 0 &&
                        item.costPerUnit > matchedVariant.sellingPrice ? (
                          <div className="rounded-xl bg-white/70 px-3 py-2 ring-1 ring-(--danger)/25">
                            <span className="text-xs text-(--danger)">
                              Cost per unit cannot be more than selling price.
                            </span>
                          </div>
                        ) : null}
                      </div>
                    ) : (
                      <div className="rounded-xl bg-white/70 px-3 py-2 ring-1 ring-(--warning)/25">
                        <span className="text-xs text-(--warning)">
                          ⚠ Select size and color to match a variant
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            );
          })}
        </div>

        <button
          className="btn-secondary mt-4 w-full"
          onClick={() => setItems((current) => [...current, createNextItem()])}
          type="button"
        >
          + Add another item
        </button>
      </div>

      {/* Step 3 — Costs & Submit */}
      <div className="rounded-[1.8rem] bg-white/80 p-6 ring-1 ring-(--stroke-soft)">
        <div className="flex items-center gap-3">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-(--surface-accent) text-xs font-bold text-(--text-inverse)">
            3
          </span>
          <h2 className="text-lg font-semibold tracking-tight">
            Costs &amp; submit
          </h2>
        </div>

        <div className="mt-5 space-y-4">
          {/* Subtotal row */}
          <div className="flex items-center justify-between rounded-[1.2rem] bg-(--surface-accent-soft) px-4 py-3 text-sm">
            <span className="text-(--text-secondary)">
              Items subtotal ({items.length}{" "}
              {items.length === 1 ? "item" : "items"})
            </span>
            <span className="font-semibold text-foreground">
              {currency(subtotal)}
            </span>
          </div>

          {/* Additional costs */}
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1.5 text-sm font-medium text-foreground">
              Transport cost
              <input
                className="field"
                min={0}
                placeholder="0"
                step="0.01"
                type="number"
                value={transportCost === 0 ? "" : transportCost}
                onChange={(event) =>
                  setTransportCost(Math.max(Number(event.target.value) || 0, 0))
                }
              />
            </label>
            <label className="grid gap-1.5 text-sm font-medium text-foreground">
              Other cost
              <input
                className="field"
                min={0}
                placeholder="0"
                step="0.01"
                type="number"
                value={otherCost === 0 ? "" : otherCost}
                onChange={(event) =>
                  setOtherCost(Math.max(Number(event.target.value) || 0, 0))
                }
              />
            </label>
          </div>

          <label className="grid gap-1.5 text-sm font-medium text-foreground">
            <span>
              Notes{" "}
              <span className="font-normal text-(--text-secondary)">
                (optional)
              </span>
            </span>
            <textarea
              className="field min-h-24"
              placeholder="Any context for this purchase batch"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </label>

          {/* Grand total */}
          <div className="flex items-center justify-between rounded-[1.4rem] bg-(--surface-accent) px-5 py-4">
            <span className="font-semibold text-(--text-inverse)">
              Grand total
            </span>
            <span className="text-2xl font-bold text-(--text-inverse)">
              {currency(grandTotal)}
            </span>
          </div>

          {/* Submit button */}
          <button
            className="btn-primary w-full py-4 text-base"
            disabled={
              isSubmitting || products.length === 0 || variants.length === 0
            }
            onClick={() => void submitPurchase()}
            type="button"
          >
            {isSubmitting
              ? "Saving…"
              : `Save ${items.length} ${items.length === 1 ? "item" : "items"}`}
          </button>
        </div>
      </div>

      {/* Step 4 — Purchase history */}
      <div className="rounded-[1.8rem] bg-white/80 p-6 ring-1 ring-(--stroke-soft)">
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-(--surface-accent) text-xs font-bold text-(--text-inverse)">
            4
          </span>
          <h2 className="text-lg font-semibold tracking-tight">
            Purchase history
          </h2>
          <button
            className="btn-secondary ml-auto"
            onClick={() => void loadHistory()}
            type="button"
          >
            Refresh
          </button>
        </div>

        <div className="mt-5 grid gap-3 rounded-[1.2rem] bg-(--surface-accent-soft) p-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className="grid gap-1.5 text-sm font-medium text-foreground sm:col-span-2 lg:col-span-1">
            Search
            <input
              className="field"
              placeholder="SKU, product, size, color, note"
              value={historySearch}
              onChange={(event) => setHistorySearch(event.target.value)}
            />
          </label>
          <label className="grid gap-1.5 text-sm font-medium text-foreground">
            From date
            <input
              className="field"
              type="date"
              value={historyFromDate}
              onChange={(event) => setHistoryFromDate(event.target.value)}
            />
          </label>
          <label className="grid gap-1.5 text-sm font-medium text-foreground">
            To date
            <input
              className="field"
              type="date"
              value={historyToDate}
              onChange={(event) => setHistoryToDate(event.target.value)}
            />
          </label>
          <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-1">
            <button
              className="btn-primary w-full"
              onClick={() => void loadHistory()}
              type="button"
            >
              Apply filter
            </button>
            <button
              className="btn-secondary"
              onClick={() => {
                setHistorySearch("");
                setHistoryFromDate("");
                setHistoryToDate("");
                void loadHistory({ search: "", from: "", to: "" });
              }}
              type="button"
            >
              Reset
            </button>
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:hidden">
          {isHistoryLoading ? (
            <p className="rounded-[1.2rem] border border-(--stroke-soft) bg-white p-4 text-sm text-(--text-secondary)">
              Loading purchase history...
            </p>
          ) : purchaseHistory.length === 0 ? (
            <p className="rounded-[1.2rem] border border-(--stroke-soft) bg-white p-4 text-sm text-(--text-secondary)">
              No purchases found for the selected filters.
            </p>
          ) : (
            purchaseHistory.map((record) => (
              <article
                key={record.id}
                className="rounded-[1.2rem] border border-(--stroke-soft) bg-white p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-foreground">
                      {record.sku}
                    </p>
                    <p className="mt-1 text-sm text-(--text-secondary)">
                      {record.productName} · {record.size} / {record.color}
                    </p>
                  </div>
                  <p className="text-sm font-semibold text-foreground">
                    {currency(record.cashOutTotal)}
                  </p>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-sm text-(--text-secondary)">
                  <p>
                    Date:{" "}
                    {new Date(record.purchaseDate).toLocaleDateString("en-BD")}
                  </p>
                  <p className="text-right">Qty: {record.qty}</p>
                  <p>Cost: {currency(record.costPerUnit)}</p>
                  <p className="text-right">
                    Extra: {currency(record.additionalCost)}
                  </p>
                </div>
                {(record.note ?? "").trim() ? (
                  <p className="mt-3 text-xs leading-6 text-(--text-secondary)">
                    {record.note}
                  </p>
                ) : null}
              </article>
            ))
          )}
        </div>

        <div className="mt-4 hidden overflow-x-auto rounded-[1.2rem] ring-1 ring-(--stroke-soft) md:block">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="bg-(--surface-accent-soft)">
              <tr>
                <th className="px-3 py-2 text-left font-semibold">Date</th>
                <th className="px-3 py-2 text-left font-semibold">SKU</th>
                <th className="px-3 py-2 text-left font-semibold">Product</th>
                <th className="px-3 py-2 text-left font-semibold">
                  Size/Color
                </th>
                <th className="px-3 py-2 text-right font-semibold">Qty</th>
                <th className="px-3 py-2 text-right font-semibold">Cost</th>
                <th className="px-3 py-2 text-right font-semibold">Extra</th>
                <th className="px-3 py-2 text-right font-semibold">Cash out</th>
                <th className="px-3 py-2 text-left font-semibold">Note</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-(--stroke-soft) bg-white">
              {isHistoryLoading ? (
                <tr>
                  <td
                    className="px-3 py-5 text-center text-(--text-secondary)"
                    colSpan={9}
                  >
                    Loading purchase history...
                  </td>
                </tr>
              ) : purchaseHistory.length === 0 ? (
                <tr>
                  <td
                    className="px-3 py-5 text-center text-(--text-secondary)"
                    colSpan={9}
                  >
                    No purchases found for the selected filters.
                  </td>
                </tr>
              ) : (
                purchaseHistory.map((record) => (
                  <tr
                    key={record.id}
                    className="hover:bg-(--surface-accent-soft)/50"
                  >
                    <td className="px-3 py-2">
                      {new Date(record.purchaseDate).toLocaleDateString(
                        "en-BD",
                      )}
                    </td>
                    <td className="px-3 py-2">{record.sku}</td>
                    <td className="px-3 py-2">{record.productName}</td>
                    <td className="px-3 py-2">
                      {record.size} / {record.color}
                    </td>
                    <td className="px-3 py-2 text-right">{record.qty}</td>
                    <td className="px-3 py-2 text-right">
                      {currency(record.costPerUnit)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {currency(record.additionalCost)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {currency(record.cashOutTotal)}
                    </td>
                    <td className="px-3 py-2 text-xs text-(--text-secondary)">
                      {(record.note ?? "").trim() || "-"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
