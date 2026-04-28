"use client";

import { useEffect, useState } from "react";

import {
  calculateBreakEvenUnits,
  calculatePricingSuggestion,
} from "@/lib/domain/pricing";

type Product = {
  id: string;
  name: string;
  category: string;
  description?: string | null;
};

type Variant = {
  id: string;
  productId: string;
  sku: string;
  color: string;
  size: string;
  stockQty: number;
  sellingPrice: number;
};

function currency(value: number) {
  return new Intl.NumberFormat("en-BD", {
    style: "currency",
    currency: "BDT",
    maximumFractionDigits: 2,
  }).format(value);
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [productForm, setProductForm] = useState({
    name: "",
    category: "",
    description: "",
  });
  const [variantForm, setVariantForm] = useState({
    productId: "",
    color: "",
    size: "",
    sellingPrice: 0,
    lowStockThreshold: 0,
  });
  const [pricingForm, setPricingForm] = useState({
    costPerUnit: 0,
    fixedExpensesTotal: 0,
    expectedUnitsSold: 1,
    targetMarginPercent: 25,
  });

  let pricingSuggestion: ReturnType<typeof calculatePricingSuggestion> | null =
    null;
  let pricingError: string | null = null;

  try {
    pricingSuggestion = calculatePricingSuggestion(pricingForm);
  } catch (error) {
    pricingError =
      error instanceof Error ? error.message : "Invalid pricing input.";
  }

  let breakEvenUnits: number | null = null;

  if (pricingSuggestion && variantForm.sellingPrice > pricingForm.costPerUnit) {
    breakEvenUnits = calculateBreakEvenUnits({
      sellingPrice: variantForm.sellingPrice,
      costPerUnit: pricingForm.costPerUnit,
      fixedExpensesTotal: pricingForm.fixedExpensesTotal,
    });
  }

  async function loadData() {
    const [productsResponse, variantsResponse] = await Promise.all([
      fetch("/api/products", { cache: "no-store" }),
      fetch("/api/variants?search=", { cache: "no-store" }),
    ]);

    const productsPayload = (await productsResponse.json()) as {
      products?: Product[];
    };
    const variantsPayload = (await variantsResponse.json()) as {
      variants?: Variant[];
    };
    setProducts(productsPayload.products ?? []);
    setVariants(variantsPayload.variants ?? []);
  }

  useEffect(() => {
    void loadData();
  }, []);

  async function submitProduct() {
    const response = await fetch("/api/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(productForm),
    });

    const payload = (await response.json()) as { error?: string };
    setMessage(
      response.ok
        ? "Product created."
        : (payload.error ?? "Product create failed."),
    );

    if (response.ok) {
      setProductForm({ name: "", category: "", description: "" });
      await loadData();
    }
  }

  async function submitVariant() {
    const response = await fetch("/api/variants", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(variantForm),
    });

    const payload = (await response.json()) as { error?: string };
    setMessage(
      response.ok
        ? "Variant created."
        : (payload.error ?? "Variant create failed."),
    );

    if (response.ok) {
      setVariantForm({
        productId: "",
        color: "",
        size: "",
        sellingPrice: 0,
        lowStockThreshold: 0,
      });
      await loadData();
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
      <section className="space-y-6">
        <div className="rounded-[1.8rem] bg-white/80 p-6 ring-1 ring-[var(--stroke-soft)]">
          <h2 className="text-2xl font-semibold tracking-tight">
            Product catalog
          </h2>
          <p className="mt-3 text-sm leading-7 text-[var(--text-secondary)]">
            Create product first, then add color-size variants with independent
            price and stock.
          </p>
        </div>

        <div className="grid gap-4 rounded-[1.8rem] bg-white/80 p-6 ring-1 ring-[var(--stroke-soft)]">
          <input
            className="field"
            placeholder="Product name"
            value={productForm.name}
            onChange={(event) =>
              setProductForm((current) => ({
                ...current,
                name: event.target.value,
              }))
            }
          />
          <input
            className="field"
            placeholder="Category"
            value={productForm.category}
            onChange={(event) =>
              setProductForm((current) => ({
                ...current,
                category: event.target.value,
              }))
            }
          />
          <textarea
            className="field min-h-28"
            placeholder="Description"
            value={productForm.description}
            onChange={(event) =>
              setProductForm((current) => ({
                ...current,
                description: event.target.value,
              }))
            }
          />
          <button
            className="btn-primary w-full sm:w-auto"
            onClick={submitProduct}
            type="button"
          >
            Create product
          </button>
        </div>

        <div className="grid gap-4 rounded-[1.8rem] bg-[var(--surface-accent)] p-6 text-white">
          <select
            className="field text-[var(--text-primary)]"
            value={variantForm.productId}
            onChange={(event) =>
              setVariantForm((current) => ({
                ...current,
                productId: event.target.value,
              }))
            }
          >
            <option value="">Pick product</option>
            {products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.name}
              </option>
            ))}
          </select>
          <div className="grid gap-4 md:grid-cols-2">
            <input
              className="field text-[var(--text-primary)]"
              placeholder="Color"
              value={variantForm.color}
              onChange={(event) =>
                setVariantForm((current) => ({
                  ...current,
                  color: event.target.value,
                }))
              }
            />
            <input
              className="field text-[var(--text-primary)]"
              placeholder="Size"
              value={variantForm.size}
              onChange={(event) =>
                setVariantForm((current) => ({
                  ...current,
                  size: event.target.value,
                }))
              }
            />
            <input
              className="field text-[var(--text-primary)]"
              type="number"
              min={0}
              placeholder="Selling price"
              value={variantForm.sellingPrice}
              onChange={(event) =>
                setVariantForm((current) => ({
                  ...current,
                  sellingPrice: Number(event.target.value) || 0,
                }))
              }
            />
            <input
              className="field text-[var(--text-primary)]"
              type="number"
              min={0}
              placeholder="Low stock threshold"
              value={variantForm.lowStockThreshold}
              onChange={(event) =>
                setVariantForm((current) => ({
                  ...current,
                  lowStockThreshold: Number(event.target.value) || 0,
                }))
              }
            />
          </div>
          <button
            className="btn-secondary w-full sm:w-auto"
            onClick={submitVariant}
            type="button"
          >
            Create variant
          </button>
        </div>
        <div className="grid gap-4 rounded-[1.8rem] bg-white/80 p-6 ring-1 ring-[var(--stroke-soft)]">
          <div>
            <h3 className="text-xl font-semibold tracking-tight text-[var(--text-primary)]">
              Smart pricing helper
            </h3>
            <p className="mt-2 text-sm leading-7 text-[var(--text-secondary)]">
              Spread fixed expenses across expected units, then target a margin
              that still fits the shop floor reality.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <input
              className="field"
              min={0}
              onChange={(event) =>
                setPricingForm((current) => ({
                  ...current,
                  costPerUnit: Number(event.target.value) || 0,
                }))
              }
              placeholder="Cost per unit"
              type="number"
              value={pricingForm.costPerUnit}
            />
            <input
              className="field"
              min={0}
              onChange={(event) =>
                setPricingForm((current) => ({
                  ...current,
                  fixedExpensesTotal: Number(event.target.value) || 0,
                }))
              }
              placeholder="Fixed expenses total"
              type="number"
              value={pricingForm.fixedExpensesTotal}
            />
            <input
              className="field"
              min={1}
              onChange={(event) =>
                setPricingForm((current) => ({
                  ...current,
                  expectedUnitsSold: Number(event.target.value) || 1,
                }))
              }
              placeholder="Expected units sold"
              type="number"
              value={pricingForm.expectedUnitsSold}
            />
            <input
              className="field"
              max={99}
              min={0}
              onChange={(event) =>
                setPricingForm((current) => ({
                  ...current,
                  targetMarginPercent: Number(event.target.value) || 0,
                }))
              }
              placeholder="Target margin %"
              type="number"
              value={pricingForm.targetMarginPercent}
            />
          </div>
          {pricingSuggestion ? (
            <>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-[1.2rem] border border-[var(--stroke-soft)] p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-[var(--text-secondary)]">
                    Break-even / unit
                  </p>
                  <p className="mt-2 font-semibold text-[var(--text-primary)]">
                    {currency(pricingSuggestion.breakEvenPricePerUnit)}
                  </p>
                </div>
                <div className="rounded-[1.2rem] border border-[var(--stroke-soft)] p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-[var(--text-secondary)]">
                    Suggested price
                  </p>
                  <p className="mt-2 font-semibold text-[var(--text-primary)]">
                    {currency(pricingSuggestion.suggestedSellingPrice)}
                  </p>
                </div>
                <div className="rounded-[1.2rem] border border-[var(--stroke-soft)] p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-[var(--text-secondary)]">
                    Profit / unit
                  </p>
                  <p className="mt-2 font-semibold text-[var(--text-primary)]">
                    {currency(pricingSuggestion.expectedProfitPerUnit)}
                  </p>
                </div>
                <div className="rounded-[1.2rem] border border-[var(--stroke-soft)] p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-[var(--text-secondary)]">
                    Profit at target
                  </p>
                  <p className="mt-2 font-semibold text-[var(--text-primary)]">
                    {currency(pricingSuggestion.expectedProfitTotal)}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  className="btn-primary w-full sm:w-auto"
                  onClick={() =>
                    setVariantForm((current) => ({
                      ...current,
                      sellingPrice:
                        pricingSuggestion?.suggestedSellingPrice ?? 0,
                    }))
                  }
                  type="button"
                >
                  Use suggested price in variant form
                </button>
                <p className="text-sm text-[var(--text-secondary)]">
                  {breakEvenUnits !== null
                    ? `At the current selling price, break-even needs ${breakEvenUnits} unit(s).`
                    : "Set a selling price above cost in the variant form to see break-even units."}
                </p>
              </div>
            </>
          ) : (
            <p className="text-sm text-[var(--danger)]">{pricingError}</p>
          )}
        </div>
        {message ? (
          <p className="text-sm text-[var(--text-secondary)]">{message}</p>
        ) : null}
      </section>

      <section className="space-y-4 rounded-[1.8rem] bg-white/80 p-6 ring-1 ring-[var(--stroke-soft)]">
        <h3 className="text-xl font-semibold tracking-tight">Live variants</h3>
        {variants.map((variant) => (
          <div
            key={variant.id}
            className="rounded-[1.3rem] border border-[var(--stroke-soft)] p-4"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-medium text-[var(--text-primary)]">
                  {variant.sku}
                </p>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">
                  {variant.color} · {variant.size}
                </p>
              </div>
              <div className="text-right text-sm text-[var(--text-secondary)]">
                <p>Stock {variant.stockQty}</p>
                <p>Price {variant.sellingPrice}</p>
              </div>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
