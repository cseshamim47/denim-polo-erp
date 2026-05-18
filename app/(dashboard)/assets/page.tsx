"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

import { applyReviewUpdates } from "@/lib/domain/approval-client";
import type { ApprovalReviewUpdate } from "@/lib/services/approval-review";
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
  needsReview: false,
};

const initialForm: AssetFormState = {
  title: "",
  category: "",
  amount: "",
  assetDate: new Date().toISOString().slice(0, 10),
  note: "",
};

function buildAssetQuery(filters: AssetFiltersState) {
  const params = new URLSearchParams();
  params.set("page", String(filters.page));
  params.set("pageSize", "10");

  if (filters.scope !== "all") params.set("scope", filters.scope);
  if (filters.owner) params.set("owner", filters.owner);
  if (filters.status) params.set("status", filters.status);
  if (filters.category) params.set("category", filters.category);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  if (filters.needsReview) params.set("needsReview", "true");

  return params.toString();
}

export default function AssetsPage() {
  const [data, setData] = useState<AssetsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isReviewSubmitting, setIsReviewSubmitting] = useState(false);
  const [openField, setOpenField] = useState<string | null>(null);
  const [filters, setFilters] = useState<AssetFiltersState>(initialFilters);
  const [form, setForm] = useState<AssetFormState>(initialForm);
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);
  const [selectedNote, setSelectedNote] = useState<{
    title: string;
    note: string;
  } | null>(null);

  async function load(nextFilters = filters) {
    setIsLoading(true);

    const response = await fetch(`/api/assets?${buildAssetQuery(nextFilters)}`, {
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
    setSelectedAssetIds([]);
    setIsLoading(false);
  }

  useEffect(() => {
    let cancelled = false;

    fetch(`/api/assets?${buildAssetQuery(filters)}`, { cache: "no-store" })
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
          setSelectedAssetIds([]);
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

  function applyAssetReviews(reviews: ApprovalReviewUpdate[]) {
    setData((current) => {
      if (!current || reviews.length === 0) {
        return current;
      }

      const previousById = new Map(current.assets.map((asset) => [asset.id, asset]));
      const patchedAssets = applyReviewUpdates(current.assets, reviews);
      const visibleAssets = filters.needsReview
        ? patchedAssets.filter((asset) => asset.canReview)
        : patchedAssets;
      let approvedAssetTotal = current.summary.approvedAssetTotal;
      let pendingAssetCount = current.summary.pendingAssetCount;
      let currentBalance = current.summary.currentBalance;
      let removedCount = 0;

      for (const review of reviews) {
        const previous = previousById.get(review.id);

        if (!previous || previous.status !== "pending") {
          continue;
        }

        removedCount += filters.needsReview ? 1 : 0;
        pendingAssetCount = Math.max(0, pendingAssetCount - 1);

        if (review.status === "approved") {
          approvedAssetTotal += previous.amount;
          currentBalance -= previous.amount;
        }
      }

      const totalCount = Math.max(0, current.pagination.totalCount - removedCount);

      return {
        ...current,
        assets: visibleAssets,
        summary: {
          currentBalance,
          approvedAssetTotal,
          pendingAssetCount,
        },
        pagination: {
          ...current.pagination,
          totalCount,
          totalPages: Math.max(
            Math.ceil(totalCount / current.pagination.pageSize),
            1,
          ),
        },
      };
    });

    setSelectedAssetIds((current) =>
      current.filter((assetId) => !reviews.some((review) => review.id === assetId)),
    );
  }

  function toggleAssetSelection(assetId: string, checked: boolean) {
    setSelectedAssetIds((current) => {
      if (checked) {
        return current.includes(assetId) ? current : [...current, assetId];
      }

      return current.filter((id) => id !== assetId);
    });
  }

  function toggleAllVisibleAssets() {
    const visibleReviewableIds = (data?.assets ?? [])
      .filter((asset) => asset.canReview)
      .map((asset) => asset.id);

    setSelectedAssetIds((current) => {
      const allSelected =
        visibleReviewableIds.length > 0 &&
        visibleReviewableIds.every((assetId) => current.includes(assetId));

      if (allSelected) {
        return current.filter((id) => !visibleReviewableIds.includes(id));
      }

      return Array.from(new Set([...current, ...visibleReviewableIds]));
    });
  }

  async function submitAssetReview(
    payload:
      | { assetId: string; decision: "approved" | "rejected" }
      | { assetIds: string[]; decision: "approved" },
    successMessage: string,
    loadingMessage: string,
  ) {
    setIsReviewSubmitting(true);
    const loadingToastId = toast.loading(loadingMessage);

    const response = await fetch("/api/assets", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const result = await readJsonResponse<{
      error?: string;
      reviews?: ApprovalReviewUpdate[];
    }>(response);

    toast.dismiss(loadingToastId);
    setIsReviewSubmitting(false);

    if (!response.ok) {
      toast.error(result?.error ?? "Asset review failed.");
      return;
    }

    applyAssetReviews(result?.reviews ?? []);
    toast.success(successMessage);
  }

  async function reviewAsset(
    assetId: string,
    decision: "approved" | "rejected",
  ) {
    await submitAssetReview(
      { assetId, decision },
      `Asset ${decision}.`,
      `${decision === "approved" ? "Approving" : "Rejecting"} asset...`,
    );
  }

  async function approveSelectedAssets() {
    if (selectedAssetIds.length === 0) {
      return;
    }

    await submitAssetReview(
      { assetIds: selectedAssetIds, decision: "approved" },
      `${selectedAssetIds.length} asset(s) approved.`,
      "Approving selected assets...",
    );
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
          onChange={(next) => {
            setFilters(next);
            setSelectedAssetIds([]);
          }}
          data={data}
        />
      </section>

      <AssetHistory
        data={data}
        isLoading={isLoading}
        filters={filters}
        onChangeFilters={(next) => {
          setFilters(next);
          setSelectedAssetIds([]);
        }}
        onReview={reviewAsset}
        onApproveSelected={approveSelectedAssets}
        onToggleSelected={toggleAssetSelection}
        onToggleAllVisible={toggleAllVisibleAssets}
        selectedIds={selectedAssetIds}
        isReviewSubmitting={isReviewSubmitting}
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
