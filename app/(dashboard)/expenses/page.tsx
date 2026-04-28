"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

type ExpenseRecord = {
  id: string;
  title: string;
  amount: number;
  note: string | null;
  status: "pending" | "approved" | "rejected";
  submittedById: string;
  submittedByName: string;
  submittedAt: string;
  expenseDate: string;
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
};

type ExpensesResponse = {
  partners: Array<{
    id: string;
    name: string;
    email: string;
  }>;
  expenses: ExpenseRecord[];
  titleSuggestions: string[];
  pagination: {
    page: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
  };
};

type ExpenseFieldErrors = {
  title?: string;
  amount?: string;
  note?: string;
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

export default function ExpensesPage() {
  const [data, setData] = useState<ExpensesResponse | null>(null);
  const [fieldErrors, setFieldErrors] = useState<ExpenseFieldErrors>({});
  const [filters, setFilters] = useState({
    page: 1,
    scope: "all",
    owner: "",
    status: "",
    from: "",
    to: "",
  });
  const [form, setForm] = useState({
    title: "",
    amount: 0,
    note: "",
  });
  const [isTitleDropdownOpen, setIsTitleDropdownOpen] = useState(false);
  const ignoreNextTitleBlurRef = useRef(false);

  const normalizedTitle = form.title.trim().toLocaleLowerCase();
  const filteredTitleSuggestions = (data?.titleSuggestions ?? []).filter(
    (title) => {
      if (!normalizedTitle) {
        return true;
      }

      return title.toLocaleLowerCase().includes(normalizedTitle);
    },
  );
  const canCreateTitle =
    form.title.trim().length > 0 &&
    !(data?.titleSuggestions ?? []).some(
      (title) => title.toLocaleLowerCase() === normalizedTitle,
    );

  function validateExpenseForm(): ExpenseFieldErrors {
    const nextErrors: ExpenseFieldErrors = {};

    if (!form.title.trim()) {
      nextErrors.title = "This field is required.";
    }

    if (form.amount <= 0) {
      nextErrors.amount = "This field is required.";
    }

    if (!form.note.trim()) {
      nextErrors.note = "This field is required.";
    }

    return nextErrors;
  }

  async function load(nextFilters = filters) {
    const params = new URLSearchParams();
    params.set("page", String(nextFilters.page));
    params.set("pageSize", "10");

    if (nextFilters.scope !== "all") params.set("scope", nextFilters.scope);
    if (nextFilters.owner) params.set("owner", nextFilters.owner);
    if (nextFilters.status) params.set("status", nextFilters.status);
    if (nextFilters.from) params.set("from", nextFilters.from);
    if (nextFilters.to) params.set("to", nextFilters.to);

    const response = await fetch(`/api/expenses?${params.toString()}`, {
      cache: "no-store",
    });

    if (!response.ok) {
      toast.error("Unable to load expenses right now.");
      return;
    }

    const payload = await readJsonResponse<ExpensesResponse>(response);

    if (!payload) {
      toast.error("Expenses response was empty.");
      return;
    }

    setData(payload);
  }

  useEffect(() => {
    const params = new URLSearchParams();
    params.set("page", "1");
    params.set("pageSize", "10");

    let cancelled = false;

    fetch(`/api/expenses?${params.toString()}`, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) {
          if (!cancelled) {
            toast.error("Unable to load expenses right now.");
          }
          return;
        }

        const payload = await readJsonResponse<ExpensesResponse>(response);

        if (!payload) {
          if (!cancelled) {
            toast.error("Expenses response was empty.");
          }
          return;
        }

        if (!cancelled) {
          setData(payload);
        }
      })
      .catch(() => {
        if (!cancelled) {
          toast.error("Unable to load expenses right now.");
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  async function submitExpense() {
    const nextFieldErrors = validateExpenseForm();

    setFieldErrors(nextFieldErrors);

    if (Object.keys(nextFieldErrors).length > 0) {
      toast.error("Please fill in the required fields.");
      return;
    }

    const loadingToastId = toast.loading("Saving expense...");

    const response = await fetch("/api/expenses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        title: form.title.trim(),
        note: form.note.trim(),
        expenseDate: new Date().toISOString(),
      }),
    });

    const payload = await readJsonResponse<{
      error?: string;
      expenseId?: string;
    }>(response);

    toast.dismiss(loadingToastId);

    if (!response.ok) {
      toast.error(payload?.error ?? "Expense failed.");
      return;
    }

    setForm({ title: "", amount: 0, note: "" });
    setFieldErrors({});
    toast.success(`Expense sent: ${payload?.expenseId}`);
    await load({ ...filters, page: 1 });
  }

  async function reviewExpense(
    expenseId: string,
    decision: "approved" | "rejected",
  ) {
    const loadingToastId = toast.loading(
      `${decision === "approved" ? "Approving" : "Rejecting"} expense...`,
    );

    const response = await fetch("/api/expenses", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ expenseId, decision }),
    });

    const payload = await readJsonResponse<{ error?: string }>(response);

    toast.dismiss(loadingToastId);

    if (!response.ok) {
      toast.error(payload?.error ?? "Review failed.");
      return;
    }

    toast.success(`Expense ${decision}.`);
    await load(filters);
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[1.8rem] bg-white/80 p-6 ring-1 ring-(--stroke-soft)">
        <h2 className="text-2xl font-semibold tracking-tight">
          Expenses and history
        </h2>
        <p className="mt-3 text-sm leading-7 text-(--text-secondary)">
          Submit an expense once. Other active partners verify it before the
          amount is counted in the running business balance.
        </p>
      </section>

      <section className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-[1.8rem] bg-white/80 p-6 ring-1 ring-(--stroke-soft)">
          <h3 className="text-xl font-semibold tracking-tight">
            Submit expense
          </h3>
          <div className="mt-4 grid gap-4">
            <div className="relative">
              <input
                className="field"
                placeholder="Title"
                value={form.title}
                onBlur={() => {
                  if (ignoreNextTitleBlurRef.current) {
                    ignoreNextTitleBlurRef.current = false;
                    return;
                  }

                  window.setTimeout(() => {
                    setIsTitleDropdownOpen(false);
                  }, 120);
                }}
                onChange={(event) => {
                  setForm((current) => ({
                    ...current,
                    title: event.target.value,
                  }));
                  setFieldErrors((current) => ({
                    ...current,
                    title: undefined,
                  }));
                  setIsTitleDropdownOpen(true);
                }}
                onFocus={() => setIsTitleDropdownOpen(true)}
              />
              {isTitleDropdownOpen &&
              (filteredTitleSuggestions.length > 0 || canCreateTitle) ? (
                <div className="absolute z-10 mt-2 grid w-full gap-1 rounded-[1.2rem] border border-(--stroke-soft) bg-white p-2 shadow-lg">
                  {filteredTitleSuggestions.map((title) => (
                    <button
                      key={title}
                      className="rounded-xl px-3 py-2 text-left text-sm hover:bg-(--surface-accent-soft)"
                      onPointerDown={(event) => {
                        event.preventDefault();
                        ignoreNextTitleBlurRef.current = true;
                        setForm((current) => ({ ...current, title }));
                        setFieldErrors((current) => ({
                          ...current,
                          title: undefined,
                        }));
                        setIsTitleDropdownOpen(false);
                      }}
                      type="button"
                    >
                      {title}
                    </button>
                  ))}
                  {canCreateTitle ? (
                    <button
                      className="rounded-xl px-3 py-2 text-left text-sm font-medium hover:bg-(--surface-accent-soft)"
                      onPointerDown={(event) => {
                        event.preventDefault();
                        ignoreNextTitleBlurRef.current = true;
                        setForm((current) => ({
                          ...current,
                          title: current.title.trim(),
                        }));
                        setFieldErrors((current) => ({
                          ...current,
                          title: undefined,
                        }));
                        setIsTitleDropdownOpen(false);
                      }}
                      type="button"
                    >
                      Create &quot;{form.title.trim()}&quot;
                    </button>
                  ) : null}
                </div>
              ) : null}
              {fieldErrors.title ? (
                <p className="mt-2 text-sm text-red-600">{fieldErrors.title}</p>
              ) : null}
            </div>

            <div>
              <input
                className="field"
                min={0}
                onChange={(event) => {
                  setForm((current) => ({
                    ...current,
                    amount: Number(event.target.value) || 0,
                  }));
                  setFieldErrors((current) => ({
                    ...current,
                    amount: undefined,
                  }));
                }}
                placeholder="Amount"
                type="number"
                value={form.amount}
              />
              {fieldErrors.amount ? (
                <p className="mt-2 text-sm text-red-600">
                  {fieldErrors.amount}
                </p>
              ) : null}
            </div>

            <div>
              <textarea
                className="field min-h-36"
                onChange={(event) => {
                  setForm((current) => ({
                    ...current,
                    note: event.target.value,
                  }));
                  setFieldErrors((current) => ({
                    ...current,
                    note: undefined,
                  }));
                }}
                placeholder="Expense note, reason, receipt reference"
                value={form.note}
              />
              {fieldErrors.note ? (
                <p className="mt-2 text-sm text-red-600">{fieldErrors.note}</p>
              ) : null}
            </div>
          </div>
          <button
            className="btn-primary mt-4 w-full sm:w-auto"
            onClick={submitExpense}
            type="button"
          >
            Submit expense
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
              <option value="all">All expenses</option>
              <option value="mine">My expenses</option>
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
            Expense history
          </h3>
          <p className="text-sm text-(--text-secondary)">
            {data?.pagination.totalCount ?? 0} record(s)
          </p>
        </div>
        <div className="mt-4 grid gap-3">
          {(data?.expenses ?? []).map((expense) => (
            <div
              key={expense.id}
              className="rounded-[1.2rem] border border-(--stroke-soft) p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-foreground">{expense.title}</p>
                  <p className="mt-1 text-sm text-(--text-secondary)">
                    {expense.submittedByName} · Expense date{" "}
                    {new Date(expense.expenseDate).toLocaleDateString("en-BD")}{" "}
                    · Submitted{" "}
                    {new Date(expense.submittedAt).toLocaleDateString("en-BD")}
                  </p>
                  <p className="mt-2 text-sm text-(--text-secondary)">
                    Status {expense.status} · approvals {expense.approvalCount}/
                    {expense.requiredApprovalCount}
                  </p>
                  {expense.note ? (
                    <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-(--text-secondary)">
                      {expense.note}
                    </p>
                  ) : null}
                  {expense.approvals.length > 0 ? (
                    <div className="mt-3 grid gap-2 rounded-2xl bg-(--surface-accent-soft) p-3">
                      {expense.approvals.map((approval) => (
                        <p
                          key={`${expense.id}-${approval.partnerId}`}
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
                    {currency(expense.amount)}
                  </p>
                  {expense.canReview ? (
                    <div className="mt-3 flex gap-2">
                      <button
                        className="btn-primary"
                        onClick={() =>
                          void reviewExpense(expense.id, "approved")
                        }
                        type="button"
                      >
                        Approve
                      </button>
                      <button
                        className="btn-secondary"
                        onClick={() =>
                          void reviewExpense(expense.id, "rejected")
                        }
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
              const next = { ...filters, page: filters.page + 1 };
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
