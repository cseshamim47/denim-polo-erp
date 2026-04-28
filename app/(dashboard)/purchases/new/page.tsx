"use client";

import { useEffect, useState } from "react";

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
};

type PurchaseItemForm = {
  id: string;
  productId: string;
  size: string;
  color: string;
  qty: number;
  costPerUnit: number;
};

type PurchasePayload = {
  purchaseDate: string;
  supplier: string | null;
  transportCost: number;
  otherCost: number;
  subtotal: number;
  grandTotal: number;
  items: Array<{
    variantId: string;
    productId: string;
    productName: string;
    sku: string;
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

function createItem(): PurchaseItemForm {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
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
    payload.supplier ? `Supplier: ${payload.supplier}` : null,
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

  const weights = items.map((item) => Math.max(Math.round(item.total * 100), 1));
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
  const [products, setProducts] = useState<Product[]>([]);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [purchaseDate, setPurchaseDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [supplier, setSupplier] = useState("");
  const [transportCost, setTransportCost] = useState(0);
  const [otherCost, setOtherCost] = useState(0);
  const [items, setItems] = useState<PurchaseItemForm[]>([createItem()]);
  const [message, setMessage] = useState<string | null>(null);
  const [messageType, setMessageType] = useState<"success" | "error" | null>(
    null,
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  function setSuccess(msg: string) {
    setMessage(msg);
    setMessageType("success");
  }

  function setError(msg: string) {
    setMessage(msg);
    setMessageType("error");
  }

  useEffect(() => {
    async function loadCatalog() {
      try {
        const [productsResponse, variantsResponse] = await Promise.all([
          fetch("/api/products", { cache: "no-store" }),
          fetch("/api/variants", { cache: "no-store" }),
        ]);

        const productsPayload = await readJsonResponse<{
          products?: Product[];
        }>(productsResponse);
        const variantsPayload = await readJsonResponse<{
          variants?: Variant[];
        }>(variantsResponse);

        if (!productsResponse.ok || !variantsResponse.ok) {
          setError("Unable to load purchase catalog right now.");
          return;
        }

        setProducts(productsPayload?.products ?? []);
        setVariants(variantsPayload?.variants ?? []);
      } catch {
        setError("Unable to load purchase catalog right now.");
      }
    }

    void loadCatalog();
  }, []);

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

  function getProductVariants(productId: string) {
    return variants.filter((variant) => variant.productId === productId);
  }

  async function submitPurchase() {
    if (items.length === 0) {
      setError("Add at least one purchase item.");
      return;
    }

    const resolvedItems = [] as PurchasePayload["items"];

    for (const [index, item] of items.entries()) {
      if (!item.productId) {
        setError(`Item ${index + 1}: select a product.`);
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

      if (item.costPerUnit < 0) {
        setError(`Item ${index + 1}: cost cannot be negative.`);
        return;
      }

      const matchedVariant = getMatchingVariant(item);

      if (!matchedVariant) {
        setError(
          `Item ${index + 1}: no variant found for the selected product, size, and color.`,
        );
        return;
      }

      resolvedItems.push({
        variantId: matchedVariant.id,
        productId: item.productId,
        productName: getProductName(item.productId),
        sku: matchedVariant.sku,
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
      supplier: supplier.trim() || null,
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
    setMessage(null);

    try {
      const batchNote = buildBatchNote(payload);

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
            note: batchNote,
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
      setItems([createItem()]);
      setTransportCost(0);
      setOtherCost(0);
    } catch {
      setError("Purchase save failed. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      {/* Header */}
      <div className="rounded-[1.8rem] bg-white/80 p-6 ring-1 ring-(--stroke-soft)">
        <h1 className="text-2xl font-semibold tracking-tight">New Purchase</h1>
        <p className="mt-1 text-sm text-(--text-secondary)">
          Record inventory received. Transport and other costs are part of this
          purchase, not an expense.
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
          <label className="grid gap-1.5 text-sm font-medium text-foreground">
            <span>
              Supplier{" "}
              <span className="font-normal text-(--text-secondary)">
                (optional)
              </span>
            </span>
            <input
              className="field"
              placeholder="e.g. ABC Textiles"
              value={supplier}
              onChange={(event) => setSupplier(event.target.value)}
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
                          ? [createItem()]
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

                {/* Product */}
                <div className="mt-3">
                  <label className="grid gap-1.5 text-sm font-medium text-foreground">
                    Product
                    <select
                      className="field"
                      value={item.productId}
                      onChange={(event) =>
                        updateItem(item.id, {
                          productId: event.target.value,
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
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <label className="grid gap-1.5 text-sm font-medium text-foreground">
                    Size
                    <input
                      className="field"
                      list={`size-options-${item.id}`}
                      placeholder="e.g. M, 32"
                      value={item.size}
                      onChange={(event) =>
                        updateItem(item.id, {
                          size: event.target.value.toUpperCase(),
                        })
                      }
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
                      onChange={(event) =>
                        updateItem(item.id, {
                          color: event.target.value.toUpperCase(),
                        })
                      }
                    />
                    <datalist id={`color-options-${item.id}`}>
                      {colorOptions.map((color) => (
                        <option key={color} value={color} />
                      ))}
                    </datalist>
                  </label>
                </div>

                {/* Qty + Cost + Row total */}
                <div className="mt-3 grid grid-cols-3 gap-3">
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
          onClick={() => setItems((current) => [...current, createItem()])}
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
                  setTransportCost(
                    Math.max(Number(event.target.value) || 0, 0),
                  )
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
              isSubmitting ||
              products.length === 0 ||
              variants.length === 0
            }
            onClick={() => void submitPurchase()}
            type="button"
          >
            {isSubmitting
              ? "Saving…"
              : `Save ${items.length} ${items.length === 1 ? "item" : "items"}`}
          </button>

          {/* Status message */}
          {message ? (
            <div
              className={`rounded-[1.2rem] p-4 text-sm leading-6 ${
                messageType === "success"
                  ? "bg-white ring-1 ring-(--success)/40 text-(--success)"
                  : "bg-white ring-1 ring-(--danger)/40 text-(--danger)"
              }`}
            >
              {message}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
