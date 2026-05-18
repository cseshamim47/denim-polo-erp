"use client";

import { useEffect, useState } from "react";
import type { SetStateAction, WheelEvent } from "react";
import { ChevronsUpDownIcon } from "lucide-react";
import { toast } from "sonner";
import { ApprovalSelectionBar } from "@/components/approval/approval-selection-bar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Spinner } from "@/components/ui/spinner";
import { applyReviewUpdates } from "@/lib/domain/approval-client";
import type { ApprovalReviewUpdate } from "@/lib/services/approval-review";

type InvestmentsResponse = {
  balance: {
    currentBalance: number;
    breakdown: {
      approvedInvestmentTotal: number;
      completedSalesTotal: number;
      customerRefundTotal: number;
      purchaseTotal: number;
      approvedExpenseTotal: number;
    };
  };
  partners: Array<{
    id: string;
    name: string;
    email: string;
  }>;
  approvedTotals: Array<{
    partnerId: string;
    partnerName: string;
    totalApprovedInvestment: number;
  }>;
  investments: Array<{
    id: string;
    partnerId: string;
    partnerName: string;
    amount: number;
    note: string | null;
    status: "pending" | "approved" | "rejected";
    submittedAt: string;
    investedAt: string;
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
  }>;
  pagination: {
    page: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
  };
};

function currency(value: number) {
  return new Intl.NumberFormat("en-BD", {
    style: "currency",
    currency: "BDT",
    maximumFractionDigits: 2,
  }).format(value);
}

const scopeOptions = [
  { value: "all", label: "All investments" },
  { value: "mine", label: "My investments" },
  { value: "others", label: "Other partners" },
] as const;

const statusOptions = [
  { value: "", label: "All statuses" },
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
] as const;

function preventNumberScroll(event: WheelEvent<HTMLInputElement>) {
  event.currentTarget.blur();
}

async function readJsonResponse<T>(response: Response) {
  const body = await response.text();

  if (!body) {
    return null as T | null;
  }

  return JSON.parse(body) as T;
}

function getInvestmentStatusClassName(
  status: InvestmentsResponse["investments"][number]["status"],
) {
  if (status === "approved") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (status === "rejected") {
    return "border-red-200 bg-red-50 text-red-700";
  }

  return "border-amber-200 bg-amber-50 text-amber-800";
}

function buildInvestmentQuery(filters: {
  page: number;
  scope: string;
  owner: string;
  status: string;
  from: string;
  to: string;
  needsReview: boolean;
}) {
  const params = new URLSearchParams();
  params.set("page", String(filters.page));
  params.set("pageSize", "10");

  if (filters.scope !== "all") params.set("scope", filters.scope);
  if (filters.owner) params.set("owner", filters.owner);
  if (filters.status) params.set("status", filters.status);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  if (filters.needsReview) params.set("needsReview", "true");

  return params.toString();
}

export default function InvestmentsPage() {
  const [data, setData] = useState<InvestmentsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [openFilterField, setOpenFilterField] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    page: 1,
    scope: "all",
    owner: "",
    status: "",
    from: "",
    to: "",
    needsReview: false,
  });
  const [investmentForm, setInvestmentForm] = useState({
    amount: "",
    investedAt: new Date().toISOString().slice(0, 10),
    note: "",
  });
  const [selectedInvestmentIds, setSelectedInvestmentIds] = useState<string[]>(
    [],
  );
  const [isReviewSubmitting, setIsReviewSubmitting] = useState(false);
  const [selectedNote, setSelectedNote] = useState<{
    title: string;
    note: string;
  } | null>(null);

  function updateFilters(nextFilters: SetStateAction<typeof filters>) {
    setIsLoading(true);
    setFilters(nextFilters);
  }

  async function load(nextFilters = filters) {
    setIsLoading(true);

    const response = await fetch(
      `/api/investments?${buildInvestmentQuery(nextFilters)}`,
      {
        cache: "no-store",
      },
    );

    if (!response.ok) {
      setIsLoading(false);
      toast.error("Unable to load investments right now.");
      return;
    }

    const payload = await readJsonResponse<InvestmentsResponse>(response);

    if (!payload) {
      setIsLoading(false);
      toast.error("Investments response was empty.");
      return;
    }

    setData(payload);
    setSelectedInvestmentIds([]);
    setIsLoading(false);
  }

  useEffect(() => {
    let cancelled = false;

    fetch(`/api/investments?${buildInvestmentQuery(filters)}`, {
      cache: "no-store",
    })
      .then(async (response) => {
        if (!response.ok) {
          if (!cancelled) {
            setIsLoading(false);
            toast.error("Unable to load investments right now.");
          }
          return;
        }

        const payload = await readJsonResponse<InvestmentsResponse>(response);

        if (!payload) {
          if (!cancelled) {
            setIsLoading(false);
            toast.error("Investments response was empty.");
          }
          return;
        }

        if (!cancelled) {
          setData(payload);
          setSelectedInvestmentIds([]);
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setIsLoading(false);
          toast.error("Unable to load investments right now.");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [filters]);

  function applyInvestmentReviews(reviews: ApprovalReviewUpdate[]) {
    setData((current) => {
      if (!current || reviews.length === 0) {
        return current;
      }

      const previousById = new Map(
        current.investments.map((investment) => [investment.id, investment]),
      );
      const patchedInvestments = applyReviewUpdates(current.investments, reviews);
      const visibleInvestments = filters.needsReview
        ? patchedInvestments.filter((investment) => investment.canReview)
        : patchedInvestments;
      const approvedTotals = current.approvedTotals.map((entry) => ({ ...entry }));
      let currentBalance = current.balance.currentBalance;
      let removedCount = 0;

      for (const review of reviews) {
        const previous = previousById.get(review.id);

        if (!previous || previous.status !== "pending") {
          continue;
        }

        removedCount += filters.needsReview ? 1 : 0;

        if (review.status === "approved") {
          currentBalance += previous.amount;
          const totalEntry = approvedTotals.find(
            (entry) => entry.partnerId === previous.partnerId,
          );

          if (totalEntry) {
            totalEntry.totalApprovedInvestment += previous.amount;
          }
        }
      }

      const totalCount = Math.max(0, current.pagination.totalCount - removedCount);

      return {
        ...current,
        investments: visibleInvestments,
        approvedTotals,
        balance: {
          ...current.balance,
          currentBalance,
          breakdown: {
            ...current.balance.breakdown,
            approvedInvestmentTotal:
              current.balance.breakdown.approvedInvestmentTotal +
              reviews.reduce((sum, review) => {
                const previous = previousById.get(review.id);
                return review.status === "approved" && previous
                  ? sum + previous.amount
                  : sum;
              }, 0),
          },
        },
        pagination: {
          ...current.pagination,
          totalCount,
          totalPages: Math.max(Math.ceil(totalCount / current.pagination.pageSize), 1),
        },
      };
    });

    setSelectedInvestmentIds((current) =>
      current.filter(
        (investmentId) =>
          !reviews.some((review) => review.id === investmentId),
      ),
    );
  }

  function toggleInvestmentSelection(investmentId: string, checked: boolean) {
    setSelectedInvestmentIds((current) => {
      if (checked) {
        return current.includes(investmentId)
          ? current
          : [...current, investmentId];
      }

      return current.filter((id) => id !== investmentId);
    });
  }

  function toggleAllVisibleInvestments() {
    const visibleReviewableIds = (data?.investments ?? [])
      .filter((investment) => investment.canReview)
      .map((investment) => investment.id);

    setSelectedInvestmentIds((current) => {
      const allSelected =
        visibleReviewableIds.length > 0 &&
        visibleReviewableIds.every((investmentId) =>
          current.includes(investmentId),
        );

      if (allSelected) {
        return current.filter((id) => !visibleReviewableIds.includes(id));
      }

      return Array.from(new Set([...current, ...visibleReviewableIds]));
    });
  }

  async function submitInvestmentReview(
    payload:
      | { investmentId: string; decision: "approved" | "rejected" }
      | { investmentIds: string[]; decision: "approved" },
    loadingMessage: string,
    successMessage: string,
  ) {
    setIsReviewSubmitting(true);
    const loadingToastId = toast.loading(loadingMessage);

    const response = await fetch("/api/investments", {
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
      toast.error(result?.error ?? "Investment review failed.");
      return;
    }

    applyInvestmentReviews(result?.reviews ?? []);
    toast.success(successMessage);
  }

  async function submitInvestment() {
    const trimmedAmount = investmentForm.amount.trim();

    if (!trimmedAmount) {
      toast.error("Amount is required.");
      return;
    }

    const numericAmount = Number(trimmedAmount);

    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      toast.error("Enter a valid amount greater than 0.");
      return;
    }

    if (!Number.isInteger(numericAmount)) {
      toast.error("Amount must be a whole number.");
      return;
    }

    const loadingToastId = toast.loading("Saving investment...");

    const response = await fetch("/api/investments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: numericAmount,
        investedAt: investmentForm.investedAt,
        note: investmentForm.note,
      }),
    });
    const payload = await readJsonResponse<{ error?: string }>(response);

    toast.dismiss(loadingToastId);

    if (!response.ok) {
      toast.error(payload?.error ?? "Investment save failed.");
      return;
    }

    setInvestmentForm({
      amount: "",
      investedAt: new Date().toISOString().slice(0, 10),
      note: "",
    });
    toast.success("Investment submitted for partner verification.");
    await load({ ...filters, page: 1 });
  }

  async function review(id: string, decision: "approved" | "rejected") {
    await submitInvestmentReview(
      { investmentId: id, decision },
      `${decision === "approved" ? "Approving" : "Rejecting"} investment...`,
      `Investment ${decision}.`,
    );
  }

  async function approveSelectedInvestments() {
    if (selectedInvestmentIds.length === 0) {
      return;
    }

    await submitInvestmentReview(
      { investmentIds: selectedInvestmentIds, decision: "approved" },
      "Approving selected investments...",
      `${selectedInvestmentIds.length} investment(s) approved.`,
    );
  }

  const reviewableInvestmentIds = (data?.investments ?? [])
    .filter((investment) => investment.canReview)
    .map((investment) => investment.id);
  const allVisibleInvestmentsSelected =
    reviewableInvestmentIds.length > 0 &&
    reviewableInvestmentIds.every((investmentId) =>
      selectedInvestmentIds.includes(investmentId),
    );

  return (
    <div className="space-y-6">
      <section className="rounded-[1.8rem] bg-white/80 p-6 ring-1 ring-(--stroke-soft)">
        <h2 className="text-2xl font-semibold tracking-tight">
          Investments and history
        </h2>
      </section>

      <section className="rounded-[1.8rem] bg-white/80 p-6 ring-1 ring-(--stroke-soft)">
        <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <h3 className="text-xl font-semibold tracking-tight">
              Approved capital by partner
            </h3>
          </div>
          <div className="rounded-[1.2rem] bg-(--surface-accent-soft) p-4">
            <p className="text-sm text-(--text-secondary)">Balance in hand</p>
            {isLoading ? (
              <Spinner
                className="mt-5 justify-start"
                label="Loading balance..."
              />
            ) : (
              <p className="mt-2 text-3xl font-semibold tracking-tight text-foreground">
                {currency(data?.balance.currentBalance ?? 0)}
              </p>
            )}
          </div>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {isLoading
            ? Array.from({ length: 3 }).map((_, index) => (
                <div
                  key={`approved-total-loading-${index}`}
                  className="rounded-[1.2rem] border border-(--stroke-soft) bg-(--surface-accent-soft) p-4"
                >
                  <Spinner
                    className="min-h-18"
                    label="Loading partner totals..."
                  />
                </div>
              ))
            : (data?.approvedTotals ?? []).map((partner) => (
                <div
                  key={partner.partnerId}
                  className="rounded-[1.2rem] border border-(--stroke-soft) bg-(--surface-accent-soft) p-4"
                >
                  <p className="text-sm text-(--text-secondary)">
                    {partner.partnerName}
                  </p>
                  <p className="mt-2 text-xl font-semibold text-foreground">
                    {currency(partner.totalApprovedInvestment)}
                  </p>
                </div>
              ))}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-[1.8rem] bg-white/80 p-6 ring-1 ring-(--stroke-soft)">
          <h3 className="text-xl font-semibold tracking-tight">
            Submit own investment
          </h3>
          <div className="mt-4 grid gap-4">
            <label className="space-y-2 text-sm text-(--text-secondary)">
              Amount <span className="text-red-500">*</span>
              <input
                className="field"
                min={1}
                onChange={(event) =>
                  setInvestmentForm((current) => ({
                    ...current,
                    amount: event.target.value,
                  }))
                }
                onWheel={preventNumberScroll}
                placeholder="Enter amount"
                required
                step="1"
                type="number"
                value={investmentForm.amount}
              />
            </label>
            <input
              className="field"
              onChange={(event) =>
                setInvestmentForm((current) => ({
                  ...current,
                  investedAt: event.target.value,
                }))
              }
              type="date"
              value={investmentForm.investedAt}
            />
            <textarea
              className="field min-h-36"
              onChange={(event) =>
                setInvestmentForm((current) => ({
                  ...current,
                  note: event.target.value,
                }))
              }
              placeholder="Investment note, source, transfer details, reason"
              value={investmentForm.note}
            />
          </div>
          <button
            className="btn-primary mt-4 w-full sm:w-auto"
            onClick={submitInvestment}
            type="button"
          >
            Submit investment
          </button>
        </div>

        <div className="rounded-[1.8rem] bg-white/80 p-6 ring-1 ring-(--stroke-soft)">
          <h3 className="text-xl font-semibold tracking-tight">Filters</h3>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              type="button"
              variant={filters.needsReview ? "outline" : "default"}
              className={
                filters.needsReview
                  ? "border-amber-200 bg-white text-foreground"
                  : "bg-foreground text-white"
              }
              onClick={() =>
                updateFilters((current) => ({
                  ...current,
                  needsReview: false,
                  page: 1,
                }))
              }
            >
              All investments
            </Button>
            <Button
              type="button"
              variant={filters.needsReview ? "default" : "outline"}
              className={
                filters.needsReview
                  ? "bg-amber-500 text-white hover:bg-amber-600"
                  : "border-amber-200 bg-white text-foreground"
              }
              onClick={() =>
                updateFilters((current) => ({
                  ...current,
                  needsReview: true,
                  page: 1,
                }))
              }
            >
              Needs my approval
            </Button>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <Popover
              open={openFilterField === "scope"}
              onOpenChange={(open) => setOpenFilterField(open ? "scope" : null)}
            >
              <PopoverTrigger asChild>
                <button
                  className="field flex items-center justify-between text-left"
                  type="button"
                >
                  <span>
                    {scopeOptions.find(
                      (option) => option.value === filters.scope,
                    )?.label ?? "All investments"}
                  </span>
                  <ChevronsUpDownIcon className="ml-2 size-4 shrink-0 opacity-40" />
                </button>
              </PopoverTrigger>
              <PopoverContent
                className="w-[--radix-popover-trigger-width] p-0"
                align="start"
              >
                <Command>
                  <CommandInput placeholder="Search scope..." />
                  <CommandList>
                    <CommandEmpty>No scope found.</CommandEmpty>
                    <CommandGroup>
                      {scopeOptions.map((option) => (
                        <CommandItem
                          key={option.value}
                          value={option.label}
                          data-checked={
                            filters.scope === option.value ? "true" : undefined
                          }
                          onSelect={() => {
                            updateFilters((current) => ({
                              ...current,
                              scope: option.value,
                              page: 1,
                            }));
                            setOpenFilterField(null);
                          }}
                        >
                          {option.label}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>

            <Popover
              open={openFilterField === "owner"}
              onOpenChange={(open) => setOpenFilterField(open ? "owner" : null)}
            >
              <PopoverTrigger asChild>
                <button
                  className="field flex items-center justify-between text-left"
                  type="button"
                >
                  <span>
                    {filters.owner
                      ? (data?.partners.find(
                          (partner) => partner.id === filters.owner,
                        )?.name ?? "All partners")
                      : "All partners"}
                  </span>
                  <ChevronsUpDownIcon className="ml-2 size-4 shrink-0 opacity-40" />
                </button>
              </PopoverTrigger>
              <PopoverContent
                className="w-[--radix-popover-trigger-width] p-0"
                align="start"
              >
                <Command>
                  <CommandInput placeholder="Search partner..." />
                  <CommandList>
                    <CommandEmpty>No partner found.</CommandEmpty>
                    <CommandGroup>
                      <CommandItem
                        value="All partners"
                        data-checked={filters.owner === "" ? "true" : undefined}
                        onSelect={() => {
                          updateFilters((current) => ({
                            ...current,
                            owner: "",
                            page: 1,
                          }));
                          setOpenFilterField(null);
                        }}
                      >
                        All partners
                      </CommandItem>
                      {(data?.partners ?? []).map((partner) => (
                        <CommandItem
                          key={partner.id}
                          value={`${partner.name} ${partner.email}`}
                          data-checked={
                            filters.owner === partner.id ? "true" : undefined
                          }
                          onSelect={() => {
                            updateFilters((current) => ({
                              ...current,
                              owner: partner.id,
                              page: 1,
                            }));
                            setOpenFilterField(null);
                          }}
                        >
                          {partner.name}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>

            <Popover
              open={openFilterField === "status"}
              onOpenChange={(open) =>
                setOpenFilterField(open ? "status" : null)
              }
            >
              <PopoverTrigger asChild>
                <button
                  className="field flex items-center justify-between text-left"
                  type="button"
                >
                  <span>
                    {statusOptions.find(
                      (option) => option.value === filters.status,
                    )?.label ?? "All statuses"}
                  </span>
                  <ChevronsUpDownIcon className="ml-2 size-4 shrink-0 opacity-40" />
                </button>
              </PopoverTrigger>
              <PopoverContent
                className="w-[--radix-popover-trigger-width] p-0"
                align="start"
              >
                <Command>
                  <CommandInput placeholder="Search status..." />
                  <CommandList>
                    <CommandEmpty>No status found.</CommandEmpty>
                    <CommandGroup>
                      {statusOptions.map((option) => (
                        <CommandItem
                          key={option.label}
                          value={option.label}
                          data-checked={
                            filters.status === option.value ? "true" : undefined
                          }
                          onSelect={() => {
                            updateFilters((current) => ({
                              ...current,
                              status: option.value,
                              page: 1,
                            }));
                            setOpenFilterField(null);
                          }}
                        >
                          {option.label}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>

            <input
              className="field"
              onChange={(event) =>
                updateFilters((current) => ({
                  ...current,
                  from: event.target.value,
                  page: 1,
                }))
              }
              type="date"
              value={filters.from}
            />
            <input
              className="field"
              onChange={(event) =>
                updateFilters((current) => ({
                  ...current,
                  to: event.target.value,
                  page: 1,
                }))
              }
              type="date"
              value={filters.to}
            />
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              className="btn-secondary w-full sm:w-auto"
              onClick={() => {
                const reset = {
                  page: 1,
                  scope: "all",
                  owner: "",
                  status: "",
                  from: "",
                  to: "",
                  needsReview: false,
                };
                updateFilters(reset);
              }}
              type="button"
            >
              Reset
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-[1.8rem] bg-white/80 p-6 ring-1 ring-(--stroke-soft)">
        <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
          <h3 className="text-xl font-semibold tracking-tight">
            Investment history
          </h3>
          <p className="text-sm text-(--text-secondary)">
            {isLoading
              ? "Loading..."
              : `${data?.pagination.totalCount ?? 0} record(s)`}
          </p>
        </div>
        <ApprovalSelectionBar
          selectedCount={selectedInvestmentIds.length}
          selectableCount={reviewableInvestmentIds.length}
          onApproveSelected={() => {
            void approveSelectedInvestments();
          }}
          onToggleAll={toggleAllVisibleInvestments}
          allSelected={allVisibleInvestmentsSelected}
          isBusy={isReviewSubmitting}
          label="investment(s)"
        />
        <div className="mt-4 grid gap-4 md:hidden">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, index) => (
              <Card
                key={`investment-loading-mobile-${index}`}
                className="gap-0 rounded-[1.2rem] border-(--stroke-soft) bg-white/90 py-0 shadow-none"
              >
                <CardContent className="px-4 py-5">
                  <Spinner
                    className="min-h-20"
                    label="Loading investments..."
                  />
                </CardContent>
              </Card>
            ))
          ) : (data?.investments ?? []).length > 0 ? (
            (data?.investments ?? []).map((investment) => (
              <Card
                key={investment.id}
                className="gap-4 rounded-[1.2rem] border-(--stroke-soft) bg-white/90 py-4 shadow-none"
              >
                <CardHeader className="px-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      {investment.canReview ? (
                        <Checkbox
                          checked={selectedInvestmentIds.includes(investment.id)}
                          onCheckedChange={(checked) =>
                            toggleInvestmentSelection(
                              investment.id,
                              checked === true,
                            )
                          }
                          aria-label={`Select ${investment.partnerName}`}
                        />
                      ) : (
                        <div className="size-4 shrink-0" />
                      )}
                      <div>
                        <CardTitle className="text-base">
                          {investment.partnerName}
                        </CardTitle>
                        <p className="mt-1 text-sm text-(--text-secondary)">
                          Invested{" "}
                          {new Date(investment.investedAt).toLocaleDateString(
                            "en-BD",
                          )}
                        </p>
                        <p className="mt-1 text-xs text-(--text-secondary)">
                          Submitted{" "}
                          {new Date(investment.submittedAt).toLocaleDateString(
                            "en-BD",
                          )}
                        </p>
                      </div>
                    </div>
                    <Badge
                      variant="outline"
                      className={getInvestmentStatusClassName(
                        investment.status,
                      )}
                    >
                      {investment.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="grid gap-4 px-4">
                  <div className="rounded-xl bg-(--surface-accent-soft) p-3">
                    <p className="text-xs uppercase tracking-wide text-(--text-secondary)">
                      Amount
                    </p>
                    <p className="mt-1 text-lg font-semibold text-foreground">
                      {currency(investment.amount)}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs uppercase tracking-wide text-(--text-secondary)">
                      Approval progress
                    </p>
                    <p className="text-sm font-medium text-foreground">
                      {investment.approvalCount}/
                      {investment.requiredApprovalCount}
                    </p>
                    <div className="grid gap-1.5 text-xs text-(--text-secondary)">
                      {investment.approvals.length > 0 ? (
                        investment.approvals.map((approval) => (
                          <span key={`${investment.id}-${approval.partnerId}`}>
                            {approval.partnerName} {approval.decision}
                          </span>
                        ))
                      ) : (
                        <span>No review yet</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-3 rounded-xl border border-(--stroke-soft) px-3 py-2.5">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-(--text-secondary)">
                        Note
                      </p>
                      <p className="mt-1 text-sm text-foreground">
                        {investment.note?.trim() ? "Available" : "No note"}
                      </p>
                    </div>
                    {investment.note?.trim() ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setSelectedNote({
                            title: investment.partnerName,
                            note: investment.note ?? "",
                          })
                        }
                      >
                        View note
                      </Button>
                    ) : null}
                  </div>
                </CardContent>
                <CardFooter className="px-4">
                  {investment.canReview ? (
                    <div className="grid w-full grid-cols-2 gap-2">
                      <Button
                        size="sm"
                        className="w-full"
                        disabled={isReviewSubmitting}
                        onClick={() => void review(investment.id, "approved")}
                      >
                        Approve
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        className="w-full"
                        disabled={isReviewSubmitting}
                        onClick={() => void review(investment.id, "rejected")}
                      >
                        Reject
                      </Button>
                    </div>
                  ) : (
                    <div className="w-full rounded-xl bg-(--surface-accent-soft) px-3 py-2 text-center text-xs text-(--text-secondary)">
                      No action
                    </div>
                  )}
                </CardFooter>
              </Card>
            ))
          ) : (
            <Card className="gap-0 rounded-[1.2rem] border-(--stroke-soft) bg-white/90 py-0 shadow-none">
              <CardContent className="px-4 py-5 text-sm text-(--text-secondary)">
                No investments found for the selected filters.
              </CardContent>
            </Card>
          )}
        </div>
        <div className="mt-4 hidden overflow-x-auto rounded-[1.2rem] ring-1 ring-(--stroke-soft) md:block">
          <table className="w-full min-w-240 text-sm">
            <thead className="bg-(--surface-accent-soft)">
              <tr>
                <th className="px-3 py-2 text-center font-semibold">
                  <Checkbox
                    checked={allVisibleInvestmentsSelected}
                    onCheckedChange={() => toggleAllVisibleInvestments()}
                    aria-label="Select all visible investments"
                    disabled={reviewableInvestmentIds.length === 0}
                  />
                </th>
                <th className="px-3 py-2 text-left font-semibold">Partner</th>
                <th className="px-3 py-2 text-left font-semibold">Invested</th>
                <th className="px-3 py-2 text-left font-semibold">Submitted</th>
                <th className="px-3 py-2 text-right font-semibold">Amount</th>
                <th className="px-3 py-2 text-left font-semibold">Status</th>
                <th className="px-3 py-2 text-left font-semibold">Approvals</th>
                <th className="px-3 py-2 text-center font-semibold">Note</th>
                <th className="px-3 py-2 text-center font-semibold">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-(--stroke-soft) bg-white/70">
              {isLoading ? (
                <tr>
                  <td className="px-3 py-8" colSpan={9}>
                    <Spinner label="Loading investment history..." />
                  </td>
                </tr>
              ) : (
                (data?.investments ?? []).map((investment) => (
                  <tr key={investment.id} className="align-top">
                    <td className="px-3 py-3 text-center">
                      {investment.canReview ? (
                        <Checkbox
                          checked={selectedInvestmentIds.includes(investment.id)}
                          onCheckedChange={(checked) =>
                            toggleInvestmentSelection(
                              investment.id,
                              checked === true,
                            )
                          }
                          aria-label={`Select ${investment.partnerName}`}
                        />
                      ) : null}
                    </td>
                    <td className="px-3 py-3 font-medium text-foreground">
                      {investment.partnerName}
                    </td>
                    <td className="px-3 py-3 text-(--text-secondary)">
                      {new Date(investment.investedAt).toLocaleDateString(
                        "en-BD",
                      )}
                    </td>
                    <td className="px-3 py-3 text-(--text-secondary)">
                      {new Date(investment.submittedAt).toLocaleDateString(
                        "en-BD",
                      )}
                    </td>
                    <td className="px-3 py-3 text-right font-semibold text-foreground">
                      {currency(investment.amount)}
                    </td>
                    <td className="px-3 py-3">
                      <span className="inline-flex rounded-full bg-(--surface-accent-soft) px-2.5 py-1 text-xs font-semibold uppercase tracking-widest text-(--text-secondary)">
                        {investment.status}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-(--text-secondary)">
                      <div className="grid gap-1">
                        <span className="text-xs font-medium">
                          {investment.approvalCount}/
                          {investment.requiredApprovalCount}
                        </span>
                        {investment.approvals.length > 0 ? (
                          investment.approvals.map((approval) => (
                            <span
                              key={`${investment.id}-${approval.partnerId}`}
                              className="text-xs leading-5"
                            >
                              {approval.partnerName} {approval.decision}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs">No review yet</span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-center">
                      {investment.note?.trim() ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setSelectedNote({
                              title: investment.partnerName,
                              note: investment.note ?? "",
                            })
                          }
                        >
                          View Note
                        </Button>
                      ) : (
                        <span className="text-xs text-(--text-secondary)">
                          No note
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      {investment.canReview ? (
                        <div className="flex justify-center gap-2">
                          <Button
                            size="sm"
                            disabled={isReviewSubmitting}
                            onClick={() =>
                              void review(investment.id, "approved")
                            }
                          >
                            Approve
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            disabled={isReviewSubmitting}
                            onClick={() =>
                              void review(investment.id, "rejected")
                            }
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
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <button
            className="btn-secondary"
            disabled={(data?.pagination.page ?? 1) <= 1}
            onClick={() => {
              const next = { ...filters, page: Math.max(filters.page - 1, 1) };
              updateFilters(next);
            }}
            type="button"
          >
            Previous
          </button>
          <p className="text-sm text-(--text-secondary)">
            Page {data?.pagination.page ?? 1} /{" "}
            {data?.pagination.totalPages ?? 1}
          </p>
          <button
            className="btn-secondary"
            disabled={
              (data?.pagination.page ?? 1) >= (data?.pagination.totalPages ?? 1)
            }
            onClick={() => {
              const next = {
                ...filters,
                page: Math.min(
                  filters.page + 1,
                  data?.pagination.totalPages ?? filters.page + 1,
                ),
              };
              updateFilters(next);
            }}
            type="button"
          >
            Next
          </button>
        </div>
      </section>

      <Dialog
        open={Boolean(selectedNote)}
        onOpenChange={(open) => !open && setSelectedNote(null)}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{selectedNote?.title ?? "Note"}</DialogTitle>
            <DialogDescription>Investment note details</DialogDescription>
          </DialogHeader>
          <div className="whitespace-pre-wrap text-sm leading-7 text-(--text-secondary)">
            {selectedNote?.note ?? ""}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
