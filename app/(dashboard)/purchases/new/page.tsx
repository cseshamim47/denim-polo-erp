"use client";

import { useEffect, useState } from "react";

type Variant = {
  id: string;
  sku: string;
  color: string;
  size: string;
  stockQty: number;
  avgCost: number;
};

export default function NewPurchasePage() {
  const [variants, setVariants] = useState<Variant[]>([]);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({
    variantId: "",
    qty: 1,
    costPerUnit: 0,
    billImageUrl: "",
    note: "",
  });
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    async function loadVariants() {
      const response = await fetch(
        `/api/variants?search=${encodeURIComponent(search)}`,
        { cache: "no-store" },
      );
      const payload = (await response.json()) as { variants?: Variant[] };
      setVariants(payload.variants ?? []);
    }

    void loadVariants();
  }, [search]);

  async function submitPurchase() {
    const response = await fetch("/api/purchases", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        purchaseDate: new Date().toISOString(),
      }),
    });

    const payload = (await response.json()) as {
      error?: string;
      purchaseId?: string;
    };
    setMessage(
      response.ok
        ? `Purchase saved: ${payload.purchaseId}`
        : (payload.error ?? "Purchase failed."),
    );
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_0.95fr]">
      <section className="space-y-4 rounded-[1.8rem] bg-white/80 p-6 ring-1 ring-[var(--stroke-soft)]">
        <h2 className="text-2xl font-semibold tracking-tight">
          Record purchase
        </h2>
        <p className="text-sm leading-7 text-[var(--text-secondary)]">
          Search variant, set quantity and cost per unit, then average cost
          updates automatically.
        </p>
        <input
          className="field"
          placeholder="Search SKU"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <select
          className="field"
          value={form.variantId}
          onChange={(event) =>
            setForm((current) => ({
              ...current,
              variantId: event.target.value,
            }))
          }
        >
          <option value="">Select variant</option>
          {variants.map((variant) => (
            <option key={variant.id} value={variant.id}>
              {variant.sku} · stock {variant.stockQty} · avg cost{" "}
              {variant.avgCost}
            </option>
          ))}
        </select>
        <div className="grid gap-4 md:grid-cols-2">
          <input
            className="field"
            type="number"
            min={1}
            value={form.qty}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                qty: Number(event.target.value) || 1,
              }))
            }
          />
          <input
            className="field"
            type="number"
            min={0}
            value={form.costPerUnit}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                costPerUnit: Number(event.target.value) || 0,
              }))
            }
          />
        </div>
        <input
          className="field"
          placeholder="Bill image URL (UploadThing later)"
          value={form.billImageUrl}
          onChange={(event) =>
            setForm((current) => ({
              ...current,
              billImageUrl: event.target.value,
            }))
          }
        />
        <textarea
          className="field min-h-28"
          placeholder="Note"
          value={form.note}
          onChange={(event) =>
            setForm((current) => ({ ...current, note: event.target.value }))
          }
        />
        <button
          className="btn-primary w-full sm:w-auto"
          onClick={submitPurchase}
          type="button"
        >
          Save purchase
        </button>
        {message ? (
          <p className="text-sm text-[var(--text-secondary)]">{message}</p>
        ) : null}
      </section>
      <aside className="rounded-[1.8rem] bg-[var(--surface-accent-soft)] p-6 ring-1 ring-[var(--stroke-soft)]">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--text-secondary)]">
          Rule reminder
        </p>
        <p className="mt-3 text-sm leading-7 text-[var(--text-primary)]">
          Purchase increases stock and recalculates weighted average cost. Old
          sales keep their original profit snapshot.
        </p>
      </aside>
    </div>
  );
}
