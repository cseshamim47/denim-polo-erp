"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

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

async function readJsonResponse<T>(response: Response) {
  const body = await response.text();

  if (!body) {
    return null as T | null;
  }

  return JSON.parse(body) as T;
}

export default function InvestmentsPage() {
  const [data, setData] = useState<InvestmentsResponse | null>(null);
  const [filters, setFilters] = useState({
    page: 1,
    scope: "all",
    owner: "",
    status: "",
    from: "",
    to: "",
  });
  const [investmentForm, setInvestmentForm] = useState({
    amount: 0,
    investedAt: new Date().toISOString().slice(0, 10),
    note: "",
  });

  async function load(nextFilters = filters) {
    const params = new URLSearchParams();
    params.set("page", String(nextFilters.page));
    params.set("pageSize", "10");

    if (nextFilters.scope !== "all") params.set("scope", nextFilters.scope);
    if (nextFilters.owner) params.set("owner", nextFilters.owner);
    if (nextFilters.status) params.set("status", nextFilters.status);
    if (nextFilters.from) params.set("from", nextFilters.from);
    if (nextFilters.to) params.set("to", nextFilters.to);

    const response = await fetch(`/api/investments?${params.toString()}`, {
      cache: "no-store",
    });

    if (!response.ok) {
      toast.error("Unable to load investments right now.");
      return;
    }

    const payload = await readJsonResponse<InvestmentsResponse>(response);

    if (!payload) {
      toast.error("Investments response was empty.");
      return;
    }

    setData(payload);
  }

  useEffect(() => {
    const params = new URLSearchParams();
    params.set("page", "1");
    params.set("pageSize", "10");

    let cancelled = false;

    fetch(`/api/investments?${params.toString()}`, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) {
          if (!cancelled) {
            toast.error("Unable to load investments right now.");
          }
          return;
        }

        const payload = await readJsonResponse<InvestmentsResponse>(response);

        if (!payload) {
          if (!cancelled) {
            toast.error("Investments response was empty.");
          }
          return;
        }

        if (!cancelled) {
          setData(payload);
        }
      })
      .catch(() => {
        if (!cancelled) {
          toast.error("Unable to load investments right now.");
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  async function submitInvestment() {
    const loadingToastId = toast.loading("Saving investment...");

    const response = await fetch("/api/investments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(investmentForm),
    });
    const payload = await readJsonResponse<{ error?: string }>(response);

    toast.dismiss(loadingToastId);

    if (!response.ok) {
      toast.error(payload?.error ?? "Investment save failed.");
      return;
    }

    setInvestmentForm({
      amount: 0,
      investedAt: new Date().toISOString().slice(0, 10),
      note: "",
    });
    toast.success("Investment submitted for partner verification.");
    await load({ ...filters, page: 1 });
  }

  async function review(id: string, decision: "approved" | "rejected") {
    const loadingToastId = toast.loading(
      `${decision === "approved" ? "Approving" : "Rejecting"} investment...`,
    );

    const response = await fetch("/api/investments", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ investmentId: id, decision }),
    });
    const payload = await readJsonResponse<{ error?: string }>(response);

    toast.dismiss(loadingToastId);

    if (!response.ok) {
      toast.error(payload?.error ?? "Investment review failed.");
      return;
    }

    toast.success(`Investment ${decision}.`);
    await load();
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[1.8rem] bg-white/80 p-6 ring-1 ring-(--stroke-soft)">
        <h2 className="text-2xl font-semibold tracking-tight">
          Investments and history
        </h2>
        <p className="mt-3 text-sm leading-7 text-(--text-secondary)">
          Partner submits own investment. Other active partners verify. Only
          approved capital counts in profit-share math.
        </p>
      </section>

      <section className="rounded-[1.8rem] bg-white/80 p-6 ring-1 ring-(--stroke-soft)">
        <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <h3 className="text-xl font-semibold tracking-tight">
              Approved capital by partner
            </h3>
            <p className="mt-2 text-sm leading-7 text-(--text-secondary)">
              Running total of approved investments for each active partner.
            </p>
          </div>
          <div className="rounded-[1.2rem] bg-(--surface-accent-soft) p-4">
            <p className="text-sm text-(--text-secondary)">Balance in hand</p>
            <p className="mt-2 text-3xl font-semibold tracking-tight text-foreground">
              {currency(data?.balance.currentBalance ?? 0)}
            </p>
            <p className="mt-2 text-sm leading-7 text-(--text-secondary)">
              Approved investments + completed sales - customer refunds - purchases - approved expenses.
            </p>
          </div>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {(data?.approvedTotals ?? []).map((partner) => (
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
            <input
              className="field"
              min={0}
              onChange={(event) =>
                setInvestmentForm((current) => ({
                  ...current,
                  amount: Number(event.target.value) || 0,
                }))
              }
              placeholder="Amount"
              type="number"
              value={investmentForm.amount}
            />
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
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <select
              className="field"
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  scope: event.target.value,
                  page: 1,
                }))
              }
              value={filters.scope}
            >
              <option value="all">All investments</option>
              <option value="mine">My investments</option>
              <option value="others">Other partners</option>
            </select>
            <select
              className="field"
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  owner: event.target.value,
                  page: 1,
                }))
              }
              value={filters.owner}
            >
              <option value="">All partners</option>
              {(data?.partners ?? []).map((partner) => (
                <option key={partner.id} value={partner.id}>
                  {partner.name}
                </option>
              ))}
            </select>
            <select
              className="field"
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  status: event.target.value,
                  page: 1,
                }))
              }
              value={filters.status}
            >
              <option value="">All statuses</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
            <input
              className="field"
              onChange={(event) =>
                setFilters((current) => ({
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
                setFilters((current) => ({
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
              onClick={() => void load(filters)}
              type="button"
            >
              Apply filters
            </button>
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
                };
                setFilters(reset);
                void load(reset);
              }}
              type="button"
            >
              Reset
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-[1.8rem] bg-white/80 p-6 ring-1 ring-(--stroke-soft)">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-xl font-semibold tracking-tight">
            Investment history
          </h3>
          <p className="text-sm text-(--text-secondary)">
            {data?.pagination.totalCount ?? 0} record(s)
          </p>
        </div>
        <div className="mt-4 grid gap-3">
          {(data?.investments ?? []).map((investment) => (
            <div
              key={investment.id}
              className="rounded-[1.2rem] border border-(--stroke-soft) p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-foreground">
                    {investment.partnerName}
                  </p>
                  <p className="mt-1 text-sm text-(--text-secondary)">
                    Invested{" "}
                    {new Date(investment.investedAt).toLocaleDateString(
                      "en-BD",
                    )}{" "}
                    · Submitted{" "}
                    {new Date(investment.submittedAt).toLocaleDateString(
                      "en-BD",
                    )}
                  </p>
                  <p className="mt-2 text-sm text-(--text-secondary)">
                    Status {investment.status} · approvals{" "}
                    {investment.approvalCount}/
                    {investment.requiredApprovalCount}
                  </p>
                  {investment.note ? (
                    <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-(--text-secondary)">
                      {investment.note}
                    </p>
                  ) : null}
                  {investment.approvals.length > 0 ? (
                    <div className="mt-3 grid gap-2 rounded-2xl bg-(--surface-accent-soft) p-3">
                      {investment.approvals.map((approval) => (
                        <p
                          key={`${investment.id}-${approval.partnerId}`}
                          className="text-sm text-(--text-secondary)"
                        >
                          {approval.partnerName} {approval.decision} on{" "}
                          {new Date(approval.decidedAt).toLocaleDateString(
                            "en-BD",
                          )}
                          {approval.comment ? ` · ${approval.comment}` : ""}
                        </p>
                      ))}
                    </div>
                  ) : null}
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-foreground">
                    {currency(investment.amount)}
                  </p>
                  {investment.canReview ? (
                    <div className="mt-3 flex gap-2">
                      <button
                        className="btn-primary"
                        onClick={() => void review(investment.id, "approved")}
                        type="button"
                      >
                        Approve
                      </button>
                      <button
                        className="btn-secondary"
                        onClick={() => void review(investment.id, "rejected")}
                        type="button"
                      >
                        Reject
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 flex items-center justify-between gap-3">
          <button
            className="btn-secondary"
            disabled={(data?.pagination.page ?? 1) <= 1}
            onClick={() => {
              const next = { ...filters, page: Math.max(filters.page - 1, 1) };
              setFilters(next);
              void load(next);
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
              setFilters(next);
              void load(next);
            }}
            type="button"
          >
            Next
          </button>
        </div>
      </section>
    </div>
  );
}
