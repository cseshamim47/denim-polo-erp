"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

import { ApprovalFilters } from "./_components/approval-filters";
import { ApprovalList } from "./_components/approval-list";
import { ApprovalSummary } from "./_components/approval-summary";
import {
  readJsonResponse,
  type ApprovalFiltersState,
  type ApprovalQueueItem,
  type ApprovalsResponse,
} from "./approval-types";

const initialFilters: ApprovalFiltersState = {
  view: "mine",
  pendingPartner: "",
  kind: "",
  owner: "",
  search: "",
  sort: "newest",
};

function buildApprovalQuery(filters: ApprovalFiltersState) {
  const params = new URLSearchParams();

  params.set("view", filters.view);
  if (filters.pendingPartner) params.set("pendingPartner", filters.pendingPartner);
  if (filters.kind) params.set("kind", filters.kind);
  if (filters.owner) params.set("owner", filters.owner);
  if (filters.search.trim()) params.set("search", filters.search.trim());
  if (filters.sort) params.set("sort", filters.sort);

  return params.toString();
}

export default function ApprovalsPage() {
  const [data, setData] = useState<ApprovalsResponse | null>(null);
  const [filters, setFilters] = useState<ApprovalFiltersState>(initialFilters);
  const [openField, setOpenField] = useState<string | null>(null);
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isReviewSubmitting, setIsReviewSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    fetch(`/api/approvals?${buildApprovalQuery(filters)}`, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) {
          if (!cancelled) {
            setIsLoading(false);
            toast.error("Unable to load approval queue right now.");
          }
          return;
        }

        const payload = await readJsonResponse<ApprovalsResponse>(response);

        if (!payload) {
          if (!cancelled) {
            setIsLoading(false);
            toast.error("Approval queue response was empty.");
          }
          return;
        }

        if (!cancelled) {
          setData(payload);
          setSelectedKeys([]);
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setIsLoading(false);
          toast.error("Unable to load approval queue right now.");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [filters]);

  function toggleSelected(selectionKey: string, checked: boolean) {
    setSelectedKeys((current) => {
      if (checked) {
        return current.includes(selectionKey)
          ? current
          : [...current, selectionKey];
      }

      return current.filter((key) => key !== selectionKey);
    });
  }

  function toggleAllVisible() {
    const visibleKeys = (data?.items ?? []).map((item) => item.selectionKey);

    setSelectedKeys((current) => {
      const allSelected =
        visibleKeys.length > 0 &&
        visibleKeys.every((selectionKey) => current.includes(selectionKey));

      if (allSelected) {
        return current.filter((key) => !visibleKeys.includes(key));
      }

      return Array.from(new Set([...current, ...visibleKeys]));
    });
  }

  function applyQueueReviews(
    reviews: Array<{
      kind: ApprovalQueueItem["kind"];
      id: string;
    }>,
  ) {
    setData((current) => {
      if (!current) {
        return current;
      }

      const reviewedKeys = new Set(
        reviews.map((review) => `${review.kind}:${review.id}`),
      );

      return {
        ...current,
        summary: {
          total: Math.max(0, current.summary.total - reviews.length),
          products: Math.max(
            0,
            current.summary.products -
              reviews.filter((review) => review.kind === "products").length,
          ),
          purchases: Math.max(
            0,
            current.summary.purchases -
              reviews.filter((review) => review.kind === "purchases").length,
          ),
          expenses: Math.max(
            0,
            current.summary.expenses -
              reviews.filter((review) => review.kind === "expenses").length,
          ),
          investments: Math.max(
            0,
            current.summary.investments -
              reviews.filter((review) => review.kind === "investments").length,
          ),
          assets: Math.max(
            0,
            current.summary.assets -
              reviews.filter((review) => review.kind === "assets").length,
          ),
        },
        items: current.items.filter(
          (item) => !reviewedKeys.has(item.selectionKey),
        ),
      };
    });

    setSelectedKeys((current) =>
      current.filter(
        (selectionKey) =>
          !reviews.some(
            (review) => selectionKey === `${review.kind}:${review.id}`,
          ),
      ),
    );
  }

  async function submitQueueReview(
    items: Array<{ kind: ApprovalQueueItem["kind"]; id: string }>,
    decision: "approved" | "rejected",
    loadingMessage: string,
    successMessage: string,
  ) {
    if (items.length === 0) {
      return;
    }

    setIsReviewSubmitting(true);
    const loadingToastId = toast.loading(loadingMessage);

    const response = await fetch("/api/approvals", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items, decision }),
    });

    const result = await readJsonResponse<{
      error?: string;
      reviews?: Array<{ kind: ApprovalQueueItem["kind"]; id: string }>;
    }>(response);

    toast.dismiss(loadingToastId);
    setIsReviewSubmitting(false);

    if (!response.ok) {
      toast.error(result?.error ?? "Approval review failed.");
      return;
    }

    applyQueueReviews(result?.reviews ?? []);
    toast.success(successMessage);
  }

  async function reviewOne(
    item: ApprovalQueueItem,
    decision: "approved" | "rejected",
  ) {
    await submitQueueReview(
      [{ kind: item.kind, id: item.id }],
      decision,
      `${decision === "approved" ? "Approving" : "Rejecting"} item...`,
      `${item.kind} ${decision}.`,
    );
  }

  async function approveSelected() {
    const items = (data?.items ?? [])
      .filter((item) => selectedKeys.includes(item.selectionKey))
      .map((item) => ({ kind: item.kind, id: item.id }));

    await submitQueueReview(
      items,
      "approved",
      "Approving selected items...",
      `${items.length} item(s) approved.`,
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[1.8rem] bg-white/80 p-6 ring-1 ring-(--stroke-soft)">
        <h2 className="text-2xl font-semibold tracking-tight">Approvals inbox</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-(--text-secondary)">
          Review your own pending approvals and track which other partners still
          have pending approval work.
        </p>
      </section>

      <ApprovalSummary data={data} isLoading={isLoading} />

      <ApprovalFilters
        filters={filters}
        onChange={(next) => {
          setFilters(next);
          setSelectedKeys([]);
        }}
        openField={openField}
        setOpenField={setOpenField}
        data={data}
      />

      <ApprovalList
        data={data}
        isLoading={isLoading}
        view={filters.view}
        selectedIds={selectedKeys}
        onToggleSelected={toggleSelected}
        onToggleAllVisible={toggleAllVisible}
        onApproveSelected={approveSelected}
        onReviewOne={reviewOne}
        isReviewSubmitting={isReviewSubmitting}
      />
    </div>
  );
}
