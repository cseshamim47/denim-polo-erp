"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

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

  useEffect(() => {
    async function loadSales() {
      try {
        const response = await fetch("/api/sales", { cache: "no-store" });
        const payload = (await response.json()) as {
          sales?: Sale[];
          error?: string;
        };

        if (!response.ok) {
          toast.error(payload.error ?? "Unable to load sales right now.");
          return;
        }

        setSales(payload.sales ?? []);
      } catch {
        toast.error("Unable to load sales right now.");
      }
    }

    void loadSales();
  }, []);

  const selectedSale = sales.find((sale) => sale.id === selectedSaleId);
  const selectedLine = selectedSale?.items.find(
    (item) => item.id === selectedLineId,
  );

  async function submitReturn() {
    const loadingToastId = toast.loading("Saving return...");
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

    toast.dismiss(loadingToastId);

    if (!response.ok) {
      toast.error(payload.error ?? "Return failed.");
      return;
    }

    toast.success(`Return saved: ${payload.returnId}`);
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
      <Card className="gap-4 rounded-[1.8rem] border-(--stroke-soft) bg-white/80 py-6 shadow-none">
        <CardHeader>
          <CardTitle className="text-2xl tracking-tight">
            Process return
          </CardTitle>
          <CardDescription>
            Pick a sale, choose the affected line, then record whether the unit
            returns to stock or becomes damaged inventory.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
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
          {selectedSale ? (
            <Card className="gap-3 rounded-[1.2rem] border-(--stroke-soft) bg-(--surface-accent-soft) py-4 shadow-none">
              <CardHeader className="px-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-base">
                      {selectedSale.saleNumber}
                    </CardTitle>
                    <CardDescription>
                      Sold on{" "}
                      {new Date(selectedSale.saleDate).toLocaleDateString(
                        "en-BD",
                      )}
                    </CardDescription>
                  </div>
                  <Badge variant="outline">
                    {selectedSale.items.length} lines
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="grid gap-2 px-4">
                {selectedSale.items.map((item) => (
                  <button
                    key={item.id}
                    className={`rounded-xl border px-3 py-3 text-left transition-colors ${selectedLineId === item.id ? "border-primary bg-white" : "border-(--stroke-soft) bg-white/70"}`}
                    onClick={() => setSelectedLineId(item.id)}
                    type="button"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-foreground">
                          {item.skuSnapshot}
                        </p>
                        <p className="mt-1 text-xs text-(--text-secondary)">
                          {item.productSnapshot} · {item.colorSnapshot} /{" "}
                          {item.sizeSnapshot}
                        </p>
                      </div>
                      <Badge variant="outline">qty {item.qty}</Badge>
                    </div>
                    <p className="mt-2 text-xs text-(--text-secondary)">
                      Already resolved {item.returnedQty + item.damagedQty}
                    </p>
                  </button>
                ))}
              </CardContent>
            </Card>
          ) : null}
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
                setReturnType(
                  event.target.value as "customer_return" | "damaged",
                )
              }
            >
              <option value="customer_return">Customer return</option>
              <option value="damaged">Damaged</option>
            </select>
          </div>
          {selectedLine ? (
            <div className="rounded-[1.2rem] border border-(--stroke-soft) bg-(--surface-accent-soft) p-4 text-sm text-foreground">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-medium">Selected line</p>
                  <p className="mt-1 text-xs text-(--text-secondary)">
                    {selectedLine.skuSnapshot} · {selectedLine.productSnapshot}
                  </p>
                </div>
                <Badge variant="outline">
                  resolved {selectedLine.returnedQty + selectedLine.damagedQty}/
                  {selectedLine.qty}
                </Badge>
              </div>
            </div>
          ) : null}
          <Button
            className="w-full sm:w-auto"
            onClick={submitReturn}
            type="button"
          >
            Save return
          </Button>
        </CardContent>
      </Card>
      <Card className="gap-4 rounded-[1.8rem] border-(--stroke-soft) bg-(--surface-accent-soft) py-6 shadow-none">
        <CardHeader>
          <CardTitle className="text-xl tracking-tight">Return rules</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm leading-7 text-foreground">
          <p>Customer return adds stock back. Damaged records the loss.</p>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            <div className="rounded-[1.2rem] bg-white/70 p-4 ring-1 ring-(--stroke-soft)">
              <p className="font-medium">Customer return</p>
              <p className="mt-1 text-xs text-(--text-secondary)">
                Use when the buyer returns an item in resellable condition.
              </p>
            </div>
            <div className="rounded-[1.2rem] bg-white/70 p-4 ring-1 ring-(--stroke-soft)">
              <p className="font-medium">Damaged</p>
              <p className="mt-1 text-xs text-(--text-secondary)">
                Use when the piece cannot go back to sellable stock.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
