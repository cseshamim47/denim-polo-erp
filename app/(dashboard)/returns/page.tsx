"use client";

import { useEffect, useState } from "react";

type Sale = {
  id: string;
  saleNumber: string;
  saleDate: string;
  items: Array<{
    id: string;
    productSnapshot: string;
    skuSnapshot: string;
    colorSnapshot: string;
    sizeSnapshot: string;
    qty: number;
    returnedQty: number;
    damagedQty: number;
  }>;
};

export default function ReturnsPage() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [selectedSaleId, setSelectedSaleId] = useState("");
  const [selectedLineId, setSelectedLineId] = useState("");
  const [qty, setQty] = useState(1);
  const [returnType, setReturnType] = useState<"customer_return" | "damaged">(
    "customer_return",
  );
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    async function loadSales() {
      const response = await fetch("/api/sales", { cache: "no-store" });
      const payload = (await response.json()) as { sales?: Sale[] };
      setSales(payload.sales ?? []);
    }

    void loadSales();
  }, []);

  const selectedSale = sales.find((sale) => sale.id === selectedSaleId);

  async function submitReturn() {
    const response = await fetch("/api/returns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        saleId: selectedSaleId,
        saleLineId: selectedLineId,
        qty,
        returnType,
        returnDate: new Date().toISOString(),
      }),
    });

    const payload = (await response.json()) as {
      error?: string;
      returnId?: string;
    };
    setMessage(
      response.ok
        ? `Return saved: ${payload.returnId}`
        : (payload.error ?? "Return failed."),
    );
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
      <section className="space-y-4 rounded-[1.8rem] bg-white/80 p-6 ring-1 ring-[var(--stroke-soft)]">
        <h2 className="text-2xl font-semibold tracking-tight">
          Process return
        </h2>
        <select
          className="field"
          value={selectedSaleId}
          onChange={(event) => {
            setSelectedSaleId(event.target.value);
            setSelectedLineId("");
          }}
        >
          <option value="">Select sale</option>
          {sales.map((sale) => (
            <option key={sale.id} value={sale.id}>
              {sale.saleNumber} · {sale.saleDate.slice(0, 10)}
            </option>
          ))}
        </select>
        <select
          className="field"
          value={selectedLineId}
          onChange={(event) => setSelectedLineId(event.target.value)}
        >
          <option value="">Select sale line</option>
          {selectedSale?.items.map((item) => (
            <option key={item.id} value={item.id}>
              {item.skuSnapshot} · qty {item.qty} · resolved{" "}
              {item.returnedQty + item.damagedQty}
            </option>
          ))}
        </select>
        <div className="grid gap-4 md:grid-cols-2">
          <input
            className="field"
            type="number"
            min={1}
            value={qty}
            onChange={(event) => setQty(Number(event.target.value) || 1)}
          />
          <select
            className="field"
            value={returnType}
            onChange={(event) =>
              setReturnType(event.target.value as "customer_return" | "damaged")
            }
          >
            <option value="customer_return">Customer return</option>
            <option value="damaged">Damaged</option>
          </select>
        </div>
        <button
          className="btn-primary w-full sm:w-auto"
          onClick={submitReturn}
          type="button"
        >
          Save return
        </button>
        {message ? (
          <p className="text-sm text-[var(--text-secondary)]">{message}</p>
        ) : null}
      </section>
      <section className="space-y-4 rounded-[1.8rem] bg-[var(--surface-accent-soft)] p-6 ring-1 ring-[var(--stroke-soft)]">
        <p className="text-sm leading-7 text-[var(--text-primary)]">
          Customer return adds stock back. Damaged keeps stock unchanged and
          records loss on average cost basis.
        </p>
      </section>
    </div>
  );
}
