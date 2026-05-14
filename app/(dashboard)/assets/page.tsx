"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Spinner } from "@/components/ui/spinner";
import { AssetFilters } from "./_components/asset-filters";
import { AssetForm } from "./_components/asset-form";
import { AssetHistory } from "./_components/asset-history";
import { AssetNoteDialog } from "./_components/asset-note-dialog";
import {
  currency,
  readJsonResponse,
  type AssetFiltersState,
  type AssetFormState,
  type AssetsResponse,
} from "./asset-types";

const initialFilters: AssetFiltersState = {
  page: 1,
  scope: "all",
  owner: "",
  status: "",
  category: "",
  from: "",
  to: "",
};

const initialForm: AssetFormState = {
  title: "",
  category: "",
  amount: "",
  assetDate: new Date().toISOString().slice(0, 10),
  note: "",
};

export default function AssetsPage() {
  const [data, setData] = useState<AssetsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [openField, setOpenField] = useState<string | null>(null);
  const [filters, setFilters] = useState<AssetFiltersState>(initialFilters);
  const [form, setForm] = useState<AssetFormState>(initialForm);
  const [selectedNote, setSelectedNote] = useState<{
    title: string;
    note: string;
  } | null>(null);

  async function load(nextFilters = filters) {
    setIsLoading(true);

    const params = new URLSearchParams();
    params.set("page", String(nextFilters.page));
    params.set("pageSize", "10");

    if (nextFilters.scope !== "all") params.set("scope", nextFilters.scope);
    if (nextFilters.owner) params.set("owner", nextFilters.owner);
    if (nextFilters.status) params.set("status", nextFilters.status);
    if (nextFilters.category) params.set("category", nextFilters.category);
    if (nextFilters.from) params.set("from", nextFilters.from);
    if (nextFilters.to) params.set("to", nextFilters.to);

    const response = await fetch(`/api/assets?${params.toString()}`, {
      cache: "no-store",
    });

    if (!response.ok) {
      setIsLoading(false);
      toast.error("Unable to load assets right now.");
      return;
    }

    const payload = await readJsonResponse<AssetsResponse>(response);

    if (!payload) {
      setIsLoading(false);
      toast.error("Assets response was empty.");
      return;
    }

    setData(payload);
    setIsLoading(false);
  }

  useEffect(() => {
    let cancelled = false;

    const params = new URLSearchParams();
    params.set("page", String(filters.page));
    params.set("pageSize", "10");

    if (filters.scope !== "all") params.set("scope", filters.scope);
    if (filters.owner) params.set("owner", filters.owner);
    if (filters.status) params.set("status", filters.status);
    if (filters.category) params.set("category", filters.category);
    if (filters.from) params.set("from", filters.from);
    if (filters.to) params.set("to", filters.to);

    fetch(`/api/assets?${params.toString()}`, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) {
          if (!cancelled) {
            setIsLoading(false);
            toast.error("Unable to load assets right now.");
          }
          return;
        }

        const payload = await readJsonResponse<AssetsResponse>(response);

        if (!payload) {
          if (!cancelled) {
            setIsLoading(false);
            toast.error("Assets response was empty.");
          }
          return;
        }

        if (!cancelled) {
          setData(payload);
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setIsLoading(false);
          toast.error("Unable to load assets right now.");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [filters]);

  async function reviewAsset(
    assetId: string,
    decision: "approved" | "rejected",
  ) {
    const loadingToastId = toast.loading(
      `${decision === "approved" ? "Approving" : "Rejecting"} asset...`,
    );

    const response = await fetch("/api/assets", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assetId, decision }),
    });

    const payload = await readJsonResponse<{ error?: string }>(response);

    toast.dismiss(loadingToastId);

    if (!response.ok) {
      toast.error(payload?.error ?? "Asset review failed.");
      return;
    }

    toast.success(`Asset ${decision}.`);
    await load();
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[1.8rem] bg-white/80 p-6 ring-1 ring-(--stroke-soft)">
        <h2 className="text-2xl font-semibold tracking-tight">
          Assets and approval history
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-(--text-secondary)">
          Track shop-owned assets separately from expenses. Approved assets reduce
          cash balance only and keep profit untouched.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, index) => (
            <div
              key={`asset-summary-loading-${index}`}
              className="rounded-[1.7rem] bg-white/80 p-5 ring-1 ring-(--stroke-soft)"
            >
              <Spinner className="min-h-18" label="Loading summary..." />
            </div>
          ))
        ) : (
          <>
            <div className="rounded-[1.7rem] bg-white/80 p-5 ring-1 ring-(--stroke-soft)">
              <p className="text-sm text-(--text-secondary)">Approved assets</p>
              <p className="mt-4 text-3xl font-semibold tracking-tight text-(--text-primary)">
                {currency(data?.summary.approvedAssetTotal ?? 0)}
              </p>
            </div>
            <div className="rounded-[1.7rem] bg-white/80 p-5 ring-1 ring-(--stroke-soft)">
              <p className="text-sm text-(--text-secondary)">Pending requests</p>
              <p className="mt-4 text-3xl font-semibold tracking-tight text-(--text-primary)">
                {data?.summary.pendingAssetCount ?? 0}
              </p>
            </div>
            <div className="rounded-[1.7rem] bg-white/80 p-5 ring-1 ring-(--stroke-soft)">
              <p className="text-sm text-(--text-secondary)">Balance in hand</p>
              <p className="mt-4 text-3xl font-semibold tracking-tight text-(--text-primary)">
                {currency(data?.summary.currentBalance ?? 0)}
              </p>
            </div>
          </>
        )}
      </section>

      <section className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <AssetForm
          categorySuggestions={data?.categorySuggestions ?? []}
          form={form}
          onChange={setForm}
          onSubmitted={async () => {
            await load({ ...filters, page: 1 });
          }}
        />
        <AssetFilters
          openField={openField}
          setOpenField={setOpenField}
          filters={filters}
          onChange={setFilters}
          data={data}
        />
      </section>

      <AssetHistory
        data={data}
        isLoading={isLoading}
        filters={filters}
        onChangeFilters={setFilters}
        onReview={reviewAsset}
        onOpenNote={setSelectedNote}
      />

      <AssetNoteDialog
        selectedNote={selectedNote}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedNote(null);
          }
        }}
      />
    </div>
  );
}
