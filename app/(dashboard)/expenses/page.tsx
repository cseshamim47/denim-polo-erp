"use client";

import { useEffect, useState } from "react";
import { ChevronsUpDownIcon } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
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
import {
  buildExpenseRequest,
  formatDateInputValue,
} from "@/lib/domain/expense-form";

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

function getExpenseStatusClassName(status: ExpenseRecord["status"]) {
  if (status === "approved") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (status === "rejected") {
    return "border-red-200 bg-red-50 text-red-700";
  }

  return "border-amber-200 bg-amber-50 text-amber-800";
}

export default function ExpensesPage() {
  const [data, setData] = useState<ExpensesResponse | null>(null);
  const [fieldErrors, setFieldErrors] = useState<ExpenseFieldErrors>({});
  const [openField, setOpenField] = useState<string | null>(null);
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
    expenseDate: formatDateInputValue(new Date()),
    note: "",
  });
  const [titleSearch, setTitleSearch] = useState("");
  const [selectedNote, setSelectedNote] = useState<{
    title: string;
    note: string;
  } | null>(null);

  const scopeOptions = [
    { value: "all", label: "All expenses" },
    { value: "mine", label: "My expenses" },
    { value: "others", label: "Other partners" },
  ] as const;

  const statusOptions = [
    { value: "", label: "All statuses" },
    { value: "pending", label: "Pending" },
    { value: "approved", label: "Approved" },
    { value: "rejected", label: "Rejected" },
  ] as const;

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
      body: JSON.stringify(buildExpenseRequest(form)),
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

    setForm({
      title: "",
      amount: 0,
      expenseDate: formatDateInputValue(new Date()),
      note: "",
    });
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
      </section>

      <section className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-[1.8rem] bg-white/80 p-6 ring-1 ring-(--stroke-soft)">
          <h3 className="text-xl font-semibold tracking-tight">
            Submit expense
          </h3>
          <div className="mt-4 grid gap-4">
            <div>
              <Popover
                open={openField === "title"}
                onOpenChange={(open) => {
                  setOpenField(open ? "title" : null);
                  if (open) {
                    setTitleSearch("");
                  }
                }}
              >
                <PopoverTrigger asChild>
                  <button
                    className="field flex items-center justify-between"
                    type="button"
                  >
                    <span>{form.title.trim() || "Title"}</span>
                    <ChevronsUpDownIcon className="ml-2 size-4 shrink-0 opacity-50" />
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  className="w-[--radix-popover-trigger-width] p-0"
                  align="start"
                >
                  <Command>
                    <CommandInput
                      placeholder="Search or enter title..."
                      value={titleSearch}
                      onValueChange={(value) => setTitleSearch(value)}
                    />
                    <CommandList>
                      <CommandEmpty>
                        Type a new title or pick one below.
                      </CommandEmpty>
                      <CommandGroup>
                        {titleSearch.trim() &&
                        !(data?.titleSuggestions ?? []).some(
                          (title) =>
                            title.toLocaleLowerCase() ===
                            titleSearch.trim().toLocaleLowerCase(),
                        ) ? (
                          <CommandItem
                            value={titleSearch}
                            onSelect={() => {
                              setForm((current) => ({
                                ...current,
                                title: titleSearch.trim(),
                              }));
                              setFieldErrors((current) => ({
                                ...current,
                                title: undefined,
                              }));
                              setOpenField(null);
                            }}
                          >
                            Use &quot;{titleSearch.trim()}&quot;
                          </CommandItem>
                        ) : null}
                        {(data?.titleSuggestions ?? []).map((title) => (
                          <CommandItem
                            key={title}
                            value={title}
                            data-checked={
                              form.title === title ? "true" : undefined
                            }
                            onSelect={() => {
                              setForm((current) => ({ ...current, title }));
                              setFieldErrors((current) => ({
                                ...current,
                                title: undefined,
                              }));
                              setOpenField(null);
                            }}
                          >
                            {title}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
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
              <input
                className="field"
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    expenseDate: event.target.value,
                  }))
                }
                type="date"
                value={form.expenseDate}
              />
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
            <Popover
              open={openField === "filter-scope"}
              onOpenChange={(open) =>
                setOpenField(open ? "filter-scope" : null)
              }
            >
              <PopoverTrigger asChild>
                <button
                  className="field flex items-center justify-between"
                  type="button"
                >
                  <span>
                    {scopeOptions.find(
                      (option) => option.value === filters.scope,
                    )?.label ?? "All expenses"}
                  </span>
                  <ChevronsUpDownIcon className="ml-2 size-4 shrink-0 opacity-50" />
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
                            setFilters((current) => ({
                              ...current,
                              scope: option.value,
                              page: 1,
                            }));
                            setOpenField(null);
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
              open={openField === "filter-owner"}
              onOpenChange={(open) =>
                setOpenField(open ? "filter-owner" : null)
              }
            >
              <PopoverTrigger asChild>
                <button
                  className="field flex items-center justify-between"
                  type="button"
                >
                  <span>
                    {filters.owner
                      ? (data?.partners.find(
                          (partner) => partner.id === filters.owner,
                        )?.name ?? "All partners")
                      : "All partners"}
                  </span>
                  <ChevronsUpDownIcon className="ml-2 size-4 shrink-0 opacity-50" />
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
                          setFilters((current) => ({
                            ...current,
                            owner: "",
                            page: 1,
                          }));
                          setOpenField(null);
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
                            setFilters((current) => ({
                              ...current,
                              owner: partner.id,
                              page: 1,
                            }));
                            setOpenField(null);
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
              open={openField === "filter-status"}
              onOpenChange={(open) =>
                setOpenField(open ? "filter-status" : null)
              }
            >
              <PopoverTrigger asChild>
                <button
                  className="field flex items-center justify-between"
                  type="button"
                >
                  <span>
                    {statusOptions.find(
                      (option) => option.value === filters.status,
                    )?.label ?? "All statuses"}
                  </span>
                  <ChevronsUpDownIcon className="ml-2 size-4 shrink-0 opacity-50" />
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
                            setFilters((current) => ({
                              ...current,
                              status: option.value,
                              page: 1,
                            }));
                            setOpenField(null);
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
        <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
          <h3 className="text-xl font-semibold tracking-tight">
            Expense history
          </h3>
          <p className="text-sm text-(--text-secondary)">
            {data?.pagination.totalCount ?? 0} record(s)
          </p>
        </div>
        <div className="mt-4 grid gap-4 md:hidden">
          {(data?.expenses ?? []).length > 0 ? (
            (data?.expenses ?? []).map((expense) => (
              <Card
                key={expense.id}
                className="gap-4 rounded-[1.2rem] border-(--stroke-soft) bg-white/90 py-4 shadow-none"
              >
                <CardHeader className="px-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <CardTitle className="text-base">
                        {expense.title}
                      </CardTitle>
                      <CardDescription>
                        {expense.submittedByName} ·{" "}
                        {new Date(expense.expenseDate).toLocaleDateString(
                          "en-BD",
                        )}
                      </CardDescription>
                    </div>
                    <Badge
                      variant="outline"
                      className={getExpenseStatusClassName(expense.status)}
                    >
                      {expense.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="grid gap-4 px-4">
                  <div className="grid grid-cols-2 gap-3 rounded-xl bg-(--surface-accent-soft) p-3 text-sm">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-(--text-secondary)">
                        Amount
                      </p>
                      <p className="mt-1 font-semibold text-foreground">
                        {currency(expense.amount)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-(--text-secondary)">
                        Submitted
                      </p>
                      <p className="mt-1 font-medium text-foreground">
                        {new Date(expense.submittedAt).toLocaleDateString(
                          "en-BD",
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs uppercase tracking-wide text-(--text-secondary)">
                      Approval progress
                    </p>
                    <p className="text-sm font-medium text-foreground">
                      {expense.approvalCount}/{expense.requiredApprovalCount}
                    </p>
                    <div className="grid gap-1.5 text-xs text-(--text-secondary)">
                      {expense.approvals.length > 0 ? (
                        expense.approvals.map((approval) => (
                          <span key={`${expense.id}-${approval.partnerId}`}>
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
                        {expense.note?.trim() ? "Available" : "No note"}
                      </p>
                    </div>
                    {expense.note?.trim() ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setSelectedNote({
                            title: expense.title,
                            note: expense.note ?? "",
                          })
                        }
                      >
                        View note
                      </Button>
                    ) : null}
                  </div>
                </CardContent>
                <CardFooter className="flex-col gap-2 px-4">
                  {expense.canReview ? (
                    <div className="grid w-full grid-cols-2 gap-2">
                      <Button
                        size="sm"
                        className="w-full"
                        onClick={() =>
                          void reviewExpense(expense.id, "approved")
                        }
                      >
                        Approve
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        className="w-full"
                        onClick={() =>
                          void reviewExpense(expense.id, "rejected")
                        }
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
                No expenses found for the selected filters.
              </CardContent>
            </Card>
          )}
        </div>
        <div className="mt-4 hidden overflow-x-auto rounded-[1.2rem] ring-1 ring-(--stroke-soft) md:block">
          <table className="w-full min-w-240 text-sm">
            <thead className="bg-(--surface-accent-soft)">
              <tr>
                <th className="px-3 py-2 text-left font-semibold">Title</th>
                <th className="px-3 py-2 text-left font-semibold">Owner</th>
                <th className="px-3 py-2 text-left font-semibold">
                  Expense Date
                </th>
                <th className="px-3 py-2 text-left font-semibold">Submitted</th>
                <th className="px-3 py-2 text-right font-semibold">Amount</th>
                <th className="px-3 py-2 text-left font-semibold">Status</th>
                <th className="px-3 py-2 text-left font-semibold">Approvals</th>
                <th className="px-3 py-2 text-center font-semibold">Note</th>
                <th className="px-3 py-2 text-center font-semibold">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-(--stroke-soft) bg-white/70">
              {(data?.expenses ?? []).map((expense) => (
                <tr key={expense.id} className="align-top">
                  <td className="px-3 py-3 font-medium text-foreground">
                    {expense.title}
                  </td>
                  <td className="px-3 py-3 text-(--text-secondary)">
                    {expense.submittedByName}
                  </td>
                  <td className="px-3 py-3 text-(--text-secondary)">
                    {new Date(expense.expenseDate).toLocaleDateString("en-BD")}
                  </td>
                  <td className="px-3 py-3 text-(--text-secondary)">
                    {new Date(expense.submittedAt).toLocaleDateString("en-BD")}
                  </td>
                  <td className="px-3 py-3 text-right font-semibold text-foreground">
                    {currency(expense.amount)}
                  </td>
                  <td className="px-3 py-3">
                    <span className="inline-flex rounded-full bg-(--surface-accent-soft) px-2.5 py-1 text-xs font-semibold uppercase tracking-widest text-(--text-secondary)">
                      {expense.status}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-(--text-secondary)">
                    <div className="grid gap-1">
                      <span className="text-xs font-medium">
                        {expense.approvalCount}/{expense.requiredApprovalCount}
                      </span>
                      {expense.approvals.length > 0 ? (
                        expense.approvals.map((approval) => (
                          <span
                            key={`${expense.id}-${approval.partnerId}`}
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
                    {expense.note?.trim() ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setSelectedNote({
                            title: expense.title,
                            note: expense.note ?? "",
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
                    {expense.canReview ? (
                      <div className="flex justify-center gap-2">
                        <Button
                          size="sm"
                          onClick={() =>
                            void reviewExpense(expense.id, "approved")
                          }
                        >
                          Approve
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() =>
                            void reviewExpense(expense.id, "rejected")
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
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
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

      <Dialog
        open={Boolean(selectedNote)}
        onOpenChange={(open) => !open && setSelectedNote(null)}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{selectedNote?.title ?? "Note"}</DialogTitle>
            <DialogDescription>Expense note details</DialogDescription>
          </DialogHeader>
          <div className="whitespace-pre-wrap text-sm leading-7 text-(--text-secondary)">
            {selectedNote?.note ?? ""}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
