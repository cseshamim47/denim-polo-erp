"use client";

import { useDeferredValue, useEffect, useState } from "react";

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

function currency(value: number) {
  return new Intl.NumberFormat("en-BD", {
    style: "currency",
    currency: "BDT",
    maximumFractionDigits: 0,
  }).format(value);
}

export default function NewSalePage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [category, setCategory] = useState("");
  const [productId, setProductId] = useState("");
  const [variantId, setVariantId] = useState("");
  const [qty, setQty] = useState(1);
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const deferredSearch = useDeferredValue(search);

  useEffect(() => {
    async function loadProducts() {
      const response = await fetch("/api/products", { cache: "no-store" });
      const payload = (await response.json()) as {
        products?: Product[];
        error?: string;
      };

      if (response.ok && payload.products) {
        setProducts(payload.products);
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

  const categories = Array.from(
    new Set(products.map((product) => product.category)),
  );
  const filteredProducts = category
    ? products.filter((product) => product.category === category)
    : products;
  const selectedVariant = variants.find((variant) => variant.id === variantId);
  const total = cart.reduce(
    (sum, line) => sum + line.qty * line.sellingPrice,
    0,
  );

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
    setVariantId("");
    setStatus(null);
  }

  async function submitSale() {
    if (!cart.length) {
      setStatus("Add at least one line before confirming sale.");
      return;
    }

    setStatus("Saving sale...");

    const response = await fetch("/api/sales", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        paymentMethod,
        saleDate: new Date().toISOString(),
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
    setStatus(`Sale saved: ${payload.saleId}`);
  }

  return (
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
            Search SKU / color / size
            <input
              className="field"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="DP-JEANS-BLK-32"
            />
          </label>
          <label className="space-y-2 text-sm text-(--text-secondary)">
            Product
            <select
              className="field"
              value={productId}
              onChange={(event) => {
                setProductId(event.target.value);
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
              onChange={(event) => setVariantId(event.target.value)}
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
              {currency(total)}
            </h3>
          </div>
          <button className="btn-secondary" onClick={submitSale} type="button">
            Confirm sale
          </button>
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
  );
}
