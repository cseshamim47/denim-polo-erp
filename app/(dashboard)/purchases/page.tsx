"use client";

import { useEffect, useRef, useState } from "react";
import type { WheelEvent } from "react";
import { toast } from "sonner";
import { ChevronsUpDownIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

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
  status: "pending" | "approved" | "rejected";
  createdById: string;
  createdByName: string;
  requiredApprovalCount: number;
  approvalCount: number;
  canReview: boolean;
  approvals: Array<{
    partnerId: string;
    partnerName: string;
    decision: "approved" | "rejected";
    comment: string | null;
    decidedAt: string;
  }>;
};

type PurchasePayload = {
  purchaseDate: string;
  subtotal: number;
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
  return `Batch subtotal: ${payload.subtotal.toFixed(2)}`;
}

function statusClassName(status: PurchaseHistoryRecord["status"]) {
  if (status === "approved") {
    return "bg-emerald-100 text-emerald-700 ring-emerald-200";
  }

  if (status === "rejected") {
    return "bg-rose-100 text-rose-700 ring-rose-200";
  }

  return "bg-amber-100 text-amber-800 ring-amber-200";
}

function preventNumberScroll(event: WheelEvent<HTMLInputElement>) {
  event.currentTarget.blur();
}

export default function NewPurchasePage() {
  const nextItemIdRef = useRef(2);
  const [openField, setOpenField] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [purchaseDate, setPurchaseDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
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

    const payload: PurchasePayload = {
      purchaseDate,
      subtotal,
      items: resolvedItems,
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
            additionalCost: 0,
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
        `Submitted ${payload.items.length} item${payload.items.length === 1 ? "" : "s"} for approval — subtotal ${currency(payload.subtotal)}.`,
      );
      nextItemIdRef.current = 2;
      setItems([createItem("item-1")]);
      setNotes("");
      await loadHistory();
    } catch {
      setError("Purchase save failed. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function reviewPurchase(
    purchaseId: string,
    decision: "approved" | "rejected",
  ) {
    const response = await fetch("/api/purchases", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ purchaseId, decision }),
    });

    const payload = await readJsonResponse<{ error?: unknown }>(response);

    if (!response.ok) {
      setError(getErrorMessage(payload?.error));
      return;
    }

    setSuccess(`Purchase ${decision}.`);
    await loadHistory();
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

                {/* SKU */}
                <div className="mt-3 grid gap-1.5 text-sm font-medium text-foreground">
                  SKU
                  <Popover
                    open={openField === `sku-${item.id}`}
                    onOpenChange={(open) =>
                      setOpenField(open ? `sku-${item.id}` : null)
                    }
                  >
                    <PopoverTrigger asChild>
                      <button
                        className="field flex items-center justify-between text-left"
                        type="button"
                      >
                        {item.sku ? (
                          <span>{item.sku}</span>
                        ) : (
                          <span className="text-(--text-secondary)">
                            Type or pick an SKU
                          </span>
                        )}
                        <ChevronsUpDownIcon className="ml-2 size-4 shrink-0 opacity-40" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent
                      className="w-[--radix-popover-trigger-width] p-0"
                      align="start"
                    >
                      <Command>
                        <CommandInput placeholder="Search SKU…" />
                        <CommandList>
                          <CommandEmpty>No SKU found.</CommandEmpty>
                          <CommandGroup>
                            {variants.map((variant) => (
                              <CommandItem
                                key={variant.id}
                                value={`${variant.sku} ${getProductName(variant.productId)} ${variant.color} ${variant.size}`}
                                data-checked={
                                  item.sku === variant.sku ? "true" : undefined
                                }
                                onSelect={() => {
                                  updateItemSku(item.id, variant.sku);
                                  setOpenField(null);
                                }}
                              >
                                <span className="font-medium">
                                  {variant.sku}
                                </span>
                                <span className="ml-2 text-(--text-secondary)">
                                  {getProductName(variant.productId)} ·{" "}
                                  {variant.color} · {variant.size}
                                </span>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
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

                <div className="mt-3 grid gap-1.5 text-sm font-medium text-foreground">
                  Product
                  <Popover
                    open={openField === `product-${item.id}`}
                    onOpenChange={(open) =>
                      setOpenField(open ? `product-${item.id}` : null)
                    }
                  >
                    <PopoverTrigger asChild>
                      <button
                        className="field flex items-center justify-between text-left"
                        type="button"
                      >
                        {item.productId ? (
                          <span>
                            {products.find((p) => p.id === item.productId)
                              ?.name ?? ""}{" "}
                            ·{" "}
                            {products.find((p) => p.id === item.productId)
                              ?.category ?? ""}
                          </span>
                        ) : (
                          <span className="text-(--text-secondary)">
                            Select a product…
                          </span>
                        )}
                        <ChevronsUpDownIcon className="ml-2 size-4 shrink-0 opacity-40" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent
                      className="w-[--radix-popover-trigger-width] p-0"
                      align="start"
                    >
                      <Command>
                        <CommandInput placeholder="Search product…" />
                        <CommandList>
                          <CommandEmpty>No product found.</CommandEmpty>
                          <CommandGroup>
                            {products.map((product) => (
                              <CommandItem
                                key={product.id}
                                value={`${product.name} ${product.category}`}
                                data-checked={
                                  item.productId === product.id
                                    ? "true"
                                    : undefined
                                }
                                onSelect={() => {
                                  updateItem(item.id, {
                                    productId: product.id,
                                    sku: "",
                                    size: "",
                                    color: "",
                                  });
                                  setOpenField(null);
                                }}
                              >
                                {product.name} · {product.category}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Size + Color */}
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div className="grid gap-1.5 text-sm font-medium text-foreground">
                    Size
                    <Popover
                      open={openField === `size-${item.id}`}
                      onOpenChange={(open) =>
                        setOpenField(open ? `size-${item.id}` : null)
                      }
                    >
                      <PopoverTrigger asChild>
                        <button
                          className="field flex items-center justify-between text-left"
                          type="button"
                        >
                          {item.size ? (
                            <span>{item.size}</span>
                          ) : (
                            <span className="text-(--text-secondary)">
                              e.g. M, 32
                            </span>
                          )}
                          <ChevronsUpDownIcon className="ml-2 size-4 shrink-0 opacity-40" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent
                        className="w-[--radix-popover-trigger-width] p-0"
                        align="start"
                      >
                        <Command>
                          <CommandInput placeholder="Search size…" />
                          <CommandList>
                            <CommandEmpty>No size found.</CommandEmpty>
                            <CommandGroup>
                              {sizeOptions.map((size) => (
                                <CommandItem
                                  key={size}
                                  value={size}
                                  data-checked={
                                    item.size === size ? "true" : undefined
                                  }
                                  onSelect={() => {
                                    const nextVariant = variants.find(
                                      (v) =>
                                        v.productId === item.productId &&
                                        v.size === size &&
                                        v.color ===
                                          item.color.trim().toUpperCase(),
                                    );
                                    updateItem(item.id, {
                                      size,
                                      sku: nextVariant?.sku ?? item.sku,
                                    });
                                    setOpenField(null);
                                  }}
                                >
                                  {size}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div className="grid gap-1.5 text-sm font-medium text-foreground">
                    Color
                    <Popover
                      open={openField === `color-${item.id}`}
                      onOpenChange={(open) =>
                        setOpenField(open ? `color-${item.id}` : null)
                      }
                    >
                      <PopoverTrigger asChild>
                        <button
                          className="field flex items-center justify-between text-left"
                          type="button"
                        >
                          {item.color ? (
                            <span>{item.color}</span>
                          ) : (
                            <span className="text-(--text-secondary)">
                              e.g. BLK, RED
                            </span>
                          )}
                          <ChevronsUpDownIcon className="ml-2 size-4 shrink-0 opacity-40" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent
                        className="w-[--radix-popover-trigger-width] p-0"
                        align="start"
                      >
                        <Command>
                          <CommandInput placeholder="Search color…" />
                          <CommandList>
                            <CommandEmpty>No color found.</CommandEmpty>
                            <CommandGroup>
                              {colorOptions.map((color) => (
                                <CommandItem
                                  key={color}
                                  value={color}
                                  data-checked={
                                    item.color === color ? "true" : undefined
                                  }
                                  onSelect={() => {
                                    const nextVariant = variants.find(
                                      (v) =>
                                        v.productId === item.productId &&
                                        v.size ===
                                          item.size.trim().toUpperCase() &&
                                        v.color === color,
                                    );
                                    updateItem(item.id, {
                                      color,
                                      sku: nextVariant?.sku ?? item.sku,
                                    });
                                    setOpenField(null);
                                  }}
                                >
                                  {color}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>

                {/* Qty + Cost + Row total */}
                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  <label className="grid gap-1.5 text-sm font-medium text-foreground">
                    Qty
                    <input
                      className="field"
                      min={1}
                      onWheel={preventNumberScroll}
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
                      onWheel={preventNumberScroll}
                      placeholder="0"
                      step="1"
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

      {/* Step 3 — Notes & Submit */}
      <div className="rounded-[1.8rem] bg-white/80 p-6 ring-1 ring-(--stroke-soft)">
        <div className="flex items-center gap-3">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-(--surface-accent) text-xs font-bold text-(--text-inverse)">
            3
          </span>
          <h2 className="text-lg font-semibold tracking-tight">
            Notes &amp; submit
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
            <Card className="gap-0 rounded-[1.2rem] border-(--stroke-soft) bg-white/90 py-0 shadow-none">
              <CardContent className="px-4 py-5 text-sm text-(--text-secondary)">
                Loading purchase history...
              </CardContent>
            </Card>
          ) : purchaseHistory.length === 0 ? (
            <Card className="gap-0 rounded-[1.2rem] border-(--stroke-soft) bg-white/90 py-0 shadow-none">
              <CardContent className="px-4 py-5 text-sm text-(--text-secondary)">
                No purchases found for the selected filters.
              </CardContent>
            </Card>
          ) : (
            purchaseHistory.map((record) => (
              <Card
                key={record.id}
                className="gap-4 rounded-[1.2rem] border-(--stroke-soft) bg-white/90 py-4 shadow-none"
              >
                <CardHeader className="px-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CardTitle className="text-base">{record.sku}</CardTitle>
                      <p className="mt-1 text-sm text-(--text-secondary)">
                        {record.productName} · {record.size} / {record.color}
                      </p>
                      <p className="mt-1 text-xs text-(--text-secondary)">
                        Submitted by {record.createdByName}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-foreground">
                        {currency(record.totalCost)}
                      </p>
                      <Badge
                        variant="outline"
                        className={`mt-2 ${statusClassName(record.status)}`}
                      >
                        {record.status}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="grid gap-4 px-4">
                  <div className="grid grid-cols-2 gap-3 rounded-xl bg-(--surface-accent-soft) p-3 text-sm">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-(--text-secondary)">
                        Date
                      </p>
                      <p className="mt-1 font-medium text-foreground">
                        {new Date(record.purchaseDate).toLocaleDateString(
                          "en-BD",
                        )}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-(--text-secondary)">
                        Qty
                      </p>
                      <p className="mt-1 font-medium text-foreground">
                        {record.qty}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-(--text-secondary)">
                        Cost
                      </p>
                      <p className="mt-1 font-medium text-foreground">
                        {currency(record.costPerUnit)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-(--text-secondary)">
                        Cash out
                      </p>
                      <p className="mt-1 font-medium text-foreground">
                        {currency(record.cashOutTotal)}
                      </p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs uppercase tracking-wide text-(--text-secondary)">
                      Approval progress
                    </p>
                    <p className="text-sm font-medium text-foreground">
                      {record.approvalCount}/{record.requiredApprovalCount}
                    </p>
                    <div className="grid gap-1.5 text-xs text-(--text-secondary)">
                      {record.approvals.length > 0 ? (
                        record.approvals.map((approval) => (
                          <span key={`${record.id}-${approval.partnerId}`}>
                            {approval.partnerName} {approval.decision}
                          </span>
                        ))
                      ) : (
                        <span>No review yet</span>
                      )}
                    </div>
                  </div>
                  {(record.note ?? "").trim() ? (
                    <div className="rounded-xl border border-(--stroke-soft) px-3 py-2.5 text-xs leading-6 text-(--text-secondary)">
                      {record.note}
                    </div>
                  ) : null}
                </CardContent>
                <CardFooter className="px-4">
                  <div className="w-full">
                    {record.canReview ? (
                      <div className="grid w-full grid-cols-2 gap-2">
                        <Button
                          className="w-full"
                          size="sm"
                          onClick={() =>
                            void reviewPurchase(record.id, "approved")
                          }
                          type="button"
                        >
                          Approve
                        </Button>
                        <Button
                          className="w-full"
                          variant="destructive"
                          size="sm"
                          onClick={() =>
                            void reviewPurchase(record.id, "rejected")
                          }
                          type="button"
                        >
                          Reject
                        </Button>
                      </div>
                    ) : (
                      <div className="rounded-xl bg-(--surface-accent-soft) px-3 py-2 text-center text-xs text-(--text-secondary)">
                        No action available
                      </div>
                    )}
                  </div>
                </CardFooter>
              </Card>
            ))
          )}
        </div>

        <div className="mt-4 hidden overflow-x-auto rounded-[1.2rem] ring-1 ring-(--stroke-soft) md:block">
          <table className="w-full min-w-225 text-sm">
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
                <th className="px-3 py-2 text-right font-semibold">Subtotal</th>
                <th className="px-3 py-2 text-left font-semibold">Status</th>
                <th className="px-3 py-2 text-left font-semibold">Approvals</th>
                <th className="px-3 py-2 text-left font-semibold">
                  Submitted by
                </th>
                <th className="px-3 py-2 text-left font-semibold">Note</th>
                <th className="px-3 py-2 text-center font-semibold">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-(--stroke-soft) bg-white">
              {isHistoryLoading ? (
                <tr>
                  <td
                    className="px-3 py-5 text-center text-(--text-secondary)"
                    colSpan={12}
                  >
                    Loading purchase history...
                  </td>
                </tr>
              ) : purchaseHistory.length === 0 ? (
                <tr>
                  <td
                    className="px-3 py-5 text-center text-(--text-secondary)"
                    colSpan={12}
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
                      {currency(record.totalCost)}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ring-1 ${statusClassName(record.status)}`}
                      >
                        {record.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs text-(--text-secondary)">
                      <div className="grid gap-1">
                        <span className="font-medium text-foreground">
                          {record.approvalCount}/{record.requiredApprovalCount}
                        </span>
                        {record.approvals.length > 0 ? (
                          record.approvals.map((approval) => (
                            <span key={`${record.id}-${approval.partnerId}`}>
                              {approval.partnerName} {approval.decision}
                            </span>
                          ))
                        ) : (
                          <span>No review yet</span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-xs text-(--text-secondary)">
                      {record.createdByName}
                    </td>
                    <td className="px-3 py-2 text-xs text-(--text-secondary)">
                      {(record.note ?? "").trim() || "-"}
                    </td>
                    <td className="px-3 py-2">
                      {record.canReview ? (
                        <div className="flex justify-center gap-2">
                          <Button
                            size="sm"
                            onClick={() =>
                              void reviewPurchase(record.id, "approved")
                            }
                            type="button"
                          >
                            Approve
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() =>
                              void reviewPurchase(record.id, "rejected")
                            }
                            type="button"
                          >
                            Reject
                          </Button>
                        </div>
                      ) : (
                        <div className="text-center text-xs text-(--text-secondary)">
                          No action
                        </div>
                      )}
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
