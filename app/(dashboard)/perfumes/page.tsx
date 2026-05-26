"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

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

type PerfumeVariantOption = {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  size: string;
  stockQty: number;
  unitLabel: string;
};

type BottleVariantOption = {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  size: string;
  stockQty: number;
  unitLabel: string;
  defaultSellingPrice: number;
};

type PerfumePricingPayload = {
  rules: PerfumeRule[];
  perfumes: PerfumeVariantOption[];
  bottles: BottleVariantOption[];
};

function isPerfumePricingPayload(
  payload: PerfumePricingPayload | { error?: string } | null,
): payload is PerfumePricingPayload {
  return Boolean(
    payload &&
      "rules" in payload &&
      "perfumes" in payload &&
      "bottles" in payload,
  );
}

const initialForm = {
  perfumeVariantId: "",
  bottleVariantId: "",
  fillMl: 5,
  bottleSellingPrice: 0,
};

export default function PerfumesPage() {
  const [data, setData] = useState<PerfumePricingPayload>({
    rules: [],
    perfumes: [],
    bottles: [],
  });
  const [form, setForm] = useState(initialForm);
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  async function loadPerfumePricing() {
    setIsLoading(true);

    try {
      const response = await fetch("/api/perfume-pricing", {
        cache: "no-store",
      });
      const payload = (await response.json().catch(() => null)) as
        | PerfumePricingPayload
        | { error?: string }
        | null;

      if (!response.ok || !isPerfumePricingPayload(payload)) {
        toast.error("Unable to load perfume pricing.");
        return;
      }

      setData(payload);
      setHasLoadedOnce(true);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    let isActive = true;

    fetch("/api/perfume-pricing", { cache: "no-store" })
      .then(async (response) => {
        const payload = (await response.json().catch(() => null)) as
          | PerfumePricingPayload
          | { error?: string }
          | null;

        if (!isActive) {
          return;
        }

        if (!response.ok || !payload) {
          toast.error("Unable to load perfume pricing.");
          setIsLoading(false);
          return;
        }

        if (!isPerfumePricingPayload(payload)) {
          toast.error(payload.error ?? "Unable to load perfume pricing.");
          setIsLoading(false);
          return;
        }

        setData(payload);
        setHasLoadedOnce(true);
        setIsLoading(false);
      })
      .catch(() => {
        if (!isActive) {
          return;
        }

        toast.error("Unable to load perfume pricing.");
        setIsLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, []);

  const selectedBottle = useMemo(
    () => data.bottles.find((bottle) => bottle.id === form.bottleVariantId),
    [data.bottles, form.bottleVariantId],
  );
  const showInitialLoading = isLoading && !hasLoadedOnce;

  async function createRule() {
    if (!form.perfumeVariantId || !form.bottleVariantId) {
      toast.error("Pick a perfume and bottle first.");
      return;
    }

    setIsSaving(true);
    const loadingToastId = toast.loading("Saving perfume pricing rule...");

    try {
      const response = await fetch("/api/perfume-pricing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const payload = (await response.json().catch(() => null)) as
        | { error?: string; id?: string }
        | null;

      toast.dismiss(loadingToastId);

      if (!response.ok) {
        toast.error(payload?.error ?? "Rule save failed.");
        return;
      }

      toast.success("Perfume pricing rule created.");
      setForm(initialForm);
      await loadPerfumePricing();
    } finally {
      toast.dismiss(loadingToastId);
      setIsSaving(false);
    }
  }

  async function toggleRule(rule: PerfumeRule) {
    const response = await fetch("/api/perfume-pricing", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ruleId: rule.id,
        isActive: !rule.isActive,
      }),
    });
    const payload = (await response.json().catch(() => null)) as
      | { error?: string }
      | null;

    if (!response.ok) {
      toast.error(payload?.error ?? "Rule update failed.");
      return;
    }

    toast.success(rule.isActive ? "Rule disabled." : "Rule enabled.");
    await loadPerfumePricing();
  }

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.32em] text-(--text-secondary)">
          Perfume pricing
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          Liquid, bottle, and pack rules
        </h1>
        <p className="max-w-3xl text-sm leading-6 text-(--text-secondary)">
          Track perfume liquid in ml, bottles in pieces, and define bottle
          selling add-on rules per perfume for preset and custom ml sales.
        </p>
      </section>

      <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <Card className="rounded-[1.8rem] border-(--stroke-soft) bg-white/80 shadow-none">
          <CardHeader className="px-5 sm:px-6">
            <CardTitle className="text-xl tracking-tight">Create rule</CardTitle>
            <CardDescription>
              Pick one perfume liquid variant, one bottle size, and the bottle
              selling add-on used by your perfume formula.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 px-5 sm:px-6">
            <label className="grid gap-2 text-sm text-(--text-secondary)">
              Perfume liquid
              <select
                className="field h-11 rounded-2xl px-4"
                value={form.perfumeVariantId}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    perfumeVariantId: event.target.value,
                  }))
                }
              >
                <option value="">Select perfume liquid</option>
                {data.perfumes.map((perfume) => (
                  <option key={perfume.id} value={perfume.id}>
                    {perfume.productName} · {perfume.sku} · stock {perfume.stockQty}{" "}
                    {perfume.unitLabel}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-2 text-sm text-(--text-secondary)">
              Bottle size
              <select
                className="field h-11 rounded-2xl px-4"
                value={form.bottleVariantId}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    bottleVariantId: event.target.value,
                    bottleSellingPrice:
                      data.bottles.find(
                        (bottle) => bottle.id === event.target.value,
                      )?.defaultSellingPrice ?? current.bottleSellingPrice,
                  }))
                }
              >
                <option value="">Select bottle</option>
                {data.bottles.map((bottle) => (
                  <option key={bottle.id} value={bottle.id}>
                    {bottle.productName} · {bottle.size} · stock {bottle.stockQty}{" "}
                    {bottle.unitLabel}
                  </option>
                ))}
              </select>
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2 text-sm text-(--text-secondary)">
                Fill ml
                <Input
                  className="h-11 rounded-2xl px-4"
                  min={1}
                  type="number"
                  value={form.fillMl}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      fillMl: Number(event.target.value) || 1,
                    }))
                  }
                />
              </label>

              <label className="grid gap-2 text-sm text-(--text-secondary)">
                Bottle selling price
                <Input
                  className="h-11 rounded-2xl px-4"
                  min={0}
                  type="number"
                  value={form.bottleSellingPrice}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      bottleSellingPrice: Number(event.target.value) || 0,
                    }))
                  }
                />
              </label>
            </div>

            <div className="rounded-[1.3rem] border border-(--stroke-soft) bg-white/70 px-4 py-3 text-sm leading-6 text-(--text-secondary)">
              Selected bottle default add-on:{" "}
              <span className="font-semibold text-foreground">
                {selectedBottle?.defaultSellingPrice ?? 0} tk
              </span>
            </div>

            <div className="flex justify-end">
              <Button
                className="w-full rounded-full sm:w-auto"
                disabled={isSaving}
                onClick={() => void createRule()}
                type="button"
              >
                {isSaving ? "Saving..." : "Create pricing rule"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[1.8rem] border-(--stroke-soft) bg-white/80 shadow-none">
          <CardHeader className="px-5 sm:px-6">
            <CardTitle className="text-xl tracking-tight">Active rules</CardTitle>
            <CardDescription>
              These rules drive preset perfume packs and bottle add-on prices in
              the sales screen.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-5 sm:px-6">
            {showInitialLoading ? (
              <p className="text-sm text-(--text-secondary)">Loading rules...</p>
            ) : data.rules.length > 0 ? (
              <div className="grid gap-3">
                {data.rules.map((rule) => (
                  <article
                    key={rule.id}
                    className="rounded-[1.3rem] border border-(--stroke-soft) bg-white/70 p-4"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-sm font-semibold text-foreground">
                          {rule.perfumeLabel}
                        </p>
                        <p className="mt-1 text-sm text-(--text-secondary)">
                          {rule.bottleLabel}
                        </p>
                        <p className="mt-2 text-xs uppercase tracking-[0.2em] text-(--text-secondary)">
                          {rule.fillMl} ml · bottle add-on {rule.bottleSellingPrice} tk
                        </p>
                      </div>
                      <Button
                        className="rounded-full"
                        variant={rule.isActive ? "outline" : "default"}
                        onClick={() => void toggleRule(rule)}
                        type="button"
                      >
                        {rule.isActive ? "Disable" : "Enable"}
                      </Button>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <p className="rounded-[1.3rem] border border-dashed border-(--stroke-soft) p-4 text-sm text-(--text-secondary)">
                No perfume pricing rules yet.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
