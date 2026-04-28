# Expenses History And Entry Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade `/expenses` so partners can submit expenses with searchable creatable title/category inputs, mandatory title/category/amount validation, and an investments-style filterable/paginated history view.

**Architecture:** Keep persistence unchanged around the existing `Expense` model and `amount` field, but add a dedicated history service that returns enriched expense records, pagination, partner metadata, and reusable title/category suggestion lists. Move the client-side form rules into a small pure helper so the page can stay focused on rendering and state transitions while still supporting unit tests in the current non-DOM Vitest setup.

**Tech Stack:** Next.js 16 App Router, React 19 client components, TypeScript, Mongoose, Zod, Vitest, ESLint.

---

## Scope Check

This is one subsystem: the partner expenses workflow. The work spans one API route, one page, one new reusable page-local component, and tests for the new query and form behavior.

## File Structure

- `lib/services/expense-history.ts`
  Responsibility: load filtered/paginated expense history, partner names, review eligibility, approval summaries, and distinct title/category suggestion lists.
- `app/api/expenses/route.ts`
  Responsibility: keep POST/PATCH validation intact, parse investments-style GET filters, and delegate history reads to `listExpenseHistory`.
- `app/(dashboard)/expenses/_lib/expense-form.ts`
  Responsibility: pure helpers for required-field validation, suggestion filtering, create-option visibility, and building the history query string.
- `app/(dashboard)/expenses/_components/searchable-creatable-field.tsx`
  Responsibility: reusable typeable dropdown used by both `title` and `category`, opening on focus/click and narrowing suggestions as the user types.
- `app/(dashboard)/expenses/page.tsx`
  Responsibility: use the new API response, render investments-style filters/history/pagination, wire the searchable inputs, and surface inline mandatory-field errors.
- `tests/integration/expenses.test.ts`
  Responsibility: Mongo-backed regression coverage for expense history filtering, pagination metadata, suggestions, and approval visibility.
- `tests/unit/expenseForm.test.ts`
  Responsibility: browserless unit coverage for autocomplete filtering, create-option rules, required validation, and filter query string generation.

### Task 1: Add Expense History Service And API Contract

**Files:**

- Create: `lib/services/expense-history.ts`
- Modify: `app/api/expenses/route.ts:10-109`
- Modify: `tests/integration/expenses.test.ts:9-126`

- [ ] **Step 1: Write the failing integration test**

```ts
it("returns paginated expense history with filters and suggestion lists", async () => {
  const [
    { createExpense, reviewExpense },
    { listExpenseHistory },
    { default: UserModel },
  ] = await Promise.all([
    import("../../lib/services/expenses"),
    import("../../lib/services/expense-history"),
    import("../../models/User"),
  ]);

  const [partnerOne, partnerTwo, partnerThree] = await UserModel.create([
    {
      name: "Partner One",
      email: "partner1@example.com",
      role: "partner",
      authProvider: "credentials",
      isActive: true,
    },
    {
      name: "Partner Two",
      email: "partner2@example.com",
      role: "partner",
      authProvider: "credentials",
      isActive: true,
    },
    {
      name: "Partner Three",
      email: "partner3@example.com",
      role: "partner",
      authProvider: "credentials",
      isActive: true,
    },
  ]);

  const approvedExpense = await createExpense({
    title: "Transport",
    amount: 500,
    category: "Logistics",
    expenseDate: new Date("2026-04-10T00:00:00.000Z"),
    submittedBy: partnerOne._id.toString(),
  });

  const pendingExpense = await createExpense({
    title: "Fuel",
    amount: 350,
    category: "Logistics",
    expenseDate: new Date("2026-05-02T00:00:00.000Z"),
    submittedBy: partnerThree._id.toString(),
  });

  await reviewExpense({
    expenseId: approvedExpense._id.toString(),
    partnerId: partnerTwo._id.toString(),
    decision: "approved",
  });

  await reviewExpense({
    expenseId: approvedExpense._id.toString(),
    partnerId: partnerThree._id.toString(),
    decision: "approved",
  });

  const history = await listExpenseHistory({
    actorId: partnerTwo._id.toString(),
    page: 1,
    pageSize: 10,
    scope: "others",
    owner: "",
    status: "approved",
    from: "2026-04-01",
    to: "2026-04-30",
  });

  expect(history.expenses).toHaveLength(1);
  expect(history.expenses[0]).toMatchObject({
    id: approvedExpense._id.toString(),
    title: "Transport",
    category: "Logistics",
    submittedByName: "Partner One",
    canReview: false,
    approvalCount: 2,
    requiredApprovalCount: 2,
  });
  expect(history.pagination).toMatchObject({
    page: 1,
    pageSize: 10,
    totalCount: 1,
    totalPages: 1,
  });
  expect(history.titleSuggestions).toEqual(["Fuel", "Transport"]);
  expect(history.categorySuggestions).toEqual(["Logistics"]);
  expect(pendingExpense.title).toBe("Fuel");
});
```

- [ ] **Step 2: Run the targeted test to verify it fails**

Run: `npx vitest run tests/integration/expenses.test.ts`
Expected: FAIL with `Cannot find module '../../lib/services/expense-history'` or with missing `listExpenseHistory` exports / shape assertions.

- [ ] **Step 3: Write the minimal implementation**

```ts
// lib/services/expense-history.ts
import { Types } from "mongoose";

import { connectToDatabase } from "@/lib/db";
import { decimalToNumber } from "@/lib/money";
import ExpenseModel from "@/models/Expense";
import UserModel from "@/models/User";

type ExpenseHistoryInput = {
  actorId: string;
  page: number;
  pageSize: number;
  scope: "all" | "mine" | "others";
  owner?: string;
  status?: string;
  from?: string;
  to?: string;
};

export async function listExpenseHistory(input: ExpenseHistoryInput) {
  await connectToDatabase();

  const query: Record<string, unknown> = {};

  if (input.scope === "mine") {
    query.submittedBy = new Types.ObjectId(input.actorId);
  } else if (input.scope === "others") {
    query.submittedBy = { $ne: new Types.ObjectId(input.actorId) };
  } else if (input.owner) {
    query.submittedBy = new Types.ObjectId(input.owner);
  }

  if (
    input.status &&
    ["pending", "approved", "rejected"].includes(input.status)
  ) {
    query.status = input.status;
  }

  if (input.from || input.to) {
    query.expenseDate = {};

    if (input.from) {
      query.expenseDate = {
        ...(query.expenseDate as Record<string, unknown>),
        $gte: new Date(input.from),
      };
    }

    if (input.to) {
      const endDate = new Date(input.to);
      endDate.setHours(23, 59, 59, 999);
      query.expenseDate = {
        ...(query.expenseDate as Record<string, unknown>),
        $lte: endDate,
      };
    }
  }

  const [
    partners,
    totalCount,
    expenses,
    titleSuggestions,
    categorySuggestions,
  ] = await Promise.all([
    UserModel.find({ role: "partner", isActive: true })
      .sort({ name: 1 })
      .lean(),
    ExpenseModel.countDocuments(query),
    ExpenseModel.find(query)
      .sort({ expenseDate: -1, createdAt: -1 })
      .skip((input.page - 1) * input.pageSize)
      .limit(input.pageSize)
      .lean(),
    ExpenseModel.distinct("title"),
    ExpenseModel.distinct("category"),
  ]);

  const partnerNameById = new Map(
    partners.map((partner) => [partner._id.toString(), partner.name]),
  );

  return {
    partners: partners.map((partner) => ({
      id: partner._id.toString(),
      name: partner.name,
      email: partner.email,
    })),
    titleSuggestions: [...titleSuggestions].sort((left, right) =>
      left.localeCompare(right),
    ),
    categorySuggestions: [...categorySuggestions].sort((left, right) =>
      left.localeCompare(right),
    ),
    expenses: expenses.map((expense) => ({
      id: expense._id.toString(),
      title: expense.title,
      amount: decimalToNumber(expense.amount),
      category: expense.category,
      note: expense.note ?? null,
      status: expense.status,
      submittedAt: expense.submittedAt.toISOString(),
      expenseDate: expense.expenseDate.toISOString(),
      submittedById: expense.submittedBy.toString(),
      submittedByName:
        partnerNameById.get(expense.submittedBy.toString()) ??
        "Unknown partner",
      requiredApprovalCount: expense.requiredApprovalCountSnapshot,
      approvalCount: expense.approvals.length,
      canReview:
        expense.submittedBy.toString() !== input.actorId &&
        expense.status === "pending" &&
        !expense.approvals.some(
          (approval) => approval.partnerId.toString() === input.actorId,
        ),
      approvals: expense.approvals.map((approval) => ({
        partnerId: approval.partnerId.toString(),
        partnerName:
          partnerNameById.get(approval.partnerId.toString()) ??
          "Unknown partner",
        decision: approval.decision,
        comment: approval.comment ?? null,
        decidedAt: approval.decidedAt.toISOString(),
      })),
    })),
    pagination: {
      page: input.page,
      pageSize: input.pageSize,
      totalCount,
      totalPages: Math.max(Math.ceil(totalCount / input.pageSize), 1),
    },
  };
}

// app/api/expenses/route.ts
import { listExpenseHistory } from "@/lib/services/expense-history";

export async function GET(request: Request) {
  const session = await getRequiredSession(["partner"]);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const history = await listExpenseHistory({
    actorId: session.user.id,
    page: Math.max(Number(searchParams.get("page") ?? "1") || 1, 1),
    pageSize: Math.min(
      Math.max(Number(searchParams.get("pageSize") ?? "10") || 10, 1),
      50,
    ),
    scope:
      (searchParams.get("scope")?.trim() as "all" | "mine" | "others") || "all",
    owner: searchParams.get("owner")?.trim() ?? "",
    status: searchParams.get("status")?.trim() ?? "",
    from: searchParams.get("from") ?? "",
    to: searchParams.get("to") ?? "",
  });

  return NextResponse.json(history);
}
```

- [ ] **Step 4: Run the focused regression checks**

Run: `npx vitest run tests/integration/expenses.test.ts`
Expected: PASS with the new history test plus the two existing approval tests.

Run: `npx eslint "app/api/expenses/route.ts" "lib/services/expense-history.ts" "tests/integration/expenses.test.ts"`
Expected: PASS with `0 problems`.

- [ ] **Step 5: Commit**

```bash
git add app/api/expenses/route.ts lib/services/expense-history.ts tests/integration/expenses.test.ts
git commit -m "feat(expenses): add history filters api"
```

### Task 2: Add Searchable Creatable Expense Field Helpers

**Files:**

- Create: `app/(dashboard)/expenses/_lib/expense-form.ts`
- Create: `app/(dashboard)/expenses/_components/searchable-creatable-field.tsx`
- Create: `tests/unit/expenseForm.test.ts`

- [ ] **Step 1: Write the failing helper tests**

```ts
import { describe, expect, it } from "vitest";

import {
  buildExpenseHistoryParams,
  filterExpenseSuggestions,
  getExpenseDraftErrors,
  shouldOfferCreateOption,
} from "../../app/(dashboard)/expenses/_lib/expense-form";

describe("expense form helpers", () => {
  it("filters suggestions like search instead of showing the full list", () => {
    expect(
      filterExpenseSuggestions(
        ["Transport", "Fuel", "Office Rent", "Utilities"],
        "tr",
      ),
    ).toEqual(["Transport"]);
  });

  it("offers create only when the typed value is not already present", () => {
    expect(shouldOfferCreateOption(["Transport", "Fuel"], "Transport")).toBe(
      false,
    );
    expect(shouldOfferCreateOption(["Transport", "Fuel"], "Taxi")).toBe(true);
  });

  it("marks title, category, and amount as mandatory", () => {
    expect(
      getExpenseDraftErrors({
        title: " ",
        category: "",
        amount: 0,
        note: "",
      }),
    ).toEqual({
      title: "Title is required.",
      category: "Category is required.",
      amount: "Balance is required.",
    });
  });

  it("builds the same filter query contract as the investments page", () => {
    expect(
      buildExpenseHistoryParams({
        page: 2,
        scope: "others",
        owner: "partner-2",
        status: "pending",
        from: "2026-04-01",
        to: "2026-04-30",
      }).toString(),
    ).toBe(
      "page=2&pageSize=10&scope=others&owner=partner-2&status=pending&from=2026-04-01&to=2026-04-30",
    );
  });
});
```

- [ ] **Step 2: Run the new unit test to verify it fails**

Run: `npx vitest run tests/unit/expenseForm.test.ts`
Expected: FAIL with `Cannot find module '../../app/(dashboard)/expenses/_lib/expense-form'`.

- [ ] **Step 3: Write the minimal implementation**

```ts
// app/(dashboard)/expenses/_lib/expense-form.ts
export type ExpenseDraft = {
  title: string;
  amount: number;
  category: string;
  note: string;
};

export type ExpenseHistoryFilters = {
  page: number;
  scope: "all" | "mine" | "others";
  owner: string;
  status: string;
  from: string;
  to: string;
};

export function filterExpenseSuggestions(options: string[], query: string) {
  const normalized = query.trim().toLocaleLowerCase();

  if (!normalized) {
    return [...options].sort((left, right) => left.localeCompare(right)).slice(0, 8);
  }

  return [...options]
    .filter((option) => option.toLocaleLowerCase().includes(normalized))
    .sort((left, right) => left.localeCompare(right))
    .slice(0, 8);
}

export function shouldOfferCreateOption(options: string[], value: string) {
  const normalized = value.trim().toLocaleLowerCase();

  if (!normalized) {
    return false;
  }

  return !options.some(
    (option) => option.trim().toLocaleLowerCase() === normalized,
  );
}

export function getExpenseDraftErrors(draft: ExpenseDraft) {
  const errors: Partial<Record<keyof ExpenseDraft, string>> = {};

  if (!draft.title.trim()) {
    errors.title = "Title is required.";
  }

  if (!draft.category.trim()) {
    errors.category = "Category is required.";
  }

  if (!(draft.amount > 0)) {
    errors.amount = "Balance is required.";
  }

  return errors;
}

export function buildExpenseHistoryParams(filters: ExpenseHistoryFilters) {
  const params = new URLSearchParams();
  params.set("page", String(filters.page));
  params.set("pageSize", "10");

  if (filters.scope !== "all") params.set("scope", filters.scope);
  if (filters.owner) params.set("owner", filters.owner);
  if (filters.status) params.set("status", filters.status);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);

  return params;
}

// app/(dashboard)/expenses/_components/searchable-creatable-field.tsx
"use client";

import { useMemo, useState } from "react";

import {
  filterExpenseSuggestions,
  shouldOfferCreateOption,
} from "../_lib/expense-form";

type SearchableCreatableFieldProps = {
  label: string;
  value: string;
  options: string[];
  error?: string;
  placeholder: string;
  onChange: (value: string) => void;
};

export function SearchableCreatableField({
  label,
  value,
  options,
  error,
  placeholder,
  onChange,
}: SearchableCreatableFieldProps) {
  const [isOpen, setIsOpen] = useState(false);
  const suggestions = useMemo(
    () => filterExpenseSuggestions(options, value),
    [options, value],
  );
  const canCreate = shouldOfferCreateOption(options, value);

  return (
    <div className="relative space-y-2">
      <label className="text-sm font-medium text-foreground">{label}</label>
      <input
        aria-expanded={isOpen}
        aria-invalid={Boolean(error)}
        className="field"
        onBlur={() => window.setTimeout(() => setIsOpen(false), 120)}
        onChange={(event) => {
          onChange(event.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        placeholder={placeholder}
        value={value}
      />
      {isOpen ? (
        <div className="absolute z-10 mt-1 grid w-full gap-1 rounded-2xl border border-(--stroke-soft) bg-white p-2 shadow-lg">
          {suggestions.map((option) => (
            <button
              key={option}
              className="rounded-xl px-3 py-2 text-left text-sm hover:bg-(--surface-accent-soft)"
              onMouseDown={() => {
                onChange(option);
                setIsOpen(false);
              }}
              type="button"
            >
              {option}
            </button>
          ))}
          {canCreate ? (
            <button
              className="rounded-xl px-3 py-2 text-left text-sm font-medium hover:bg-(--surface-accent-soft)"
              onMouseDown={() => {
                onChange(value.trim());
                setIsOpen(false);
              }}
              type="button"
            >
              Create “{value.trim()}”
            </button>
          ) : null}
        </div>
      ) : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
```

- [ ] **Step 4: Run the focused helper validation**

Run: `npx vitest run tests/unit/expenseForm.test.ts`
Expected: PASS.

Run: `npx eslint "app/(dashboard)/expenses/_lib/expense-form.ts" "app/(dashboard)/expenses/_components/searchable-creatable-field.tsx" "tests/unit/expenseForm.test.ts"`
Expected: PASS with `0 problems`.

- [ ] **Step 5: Commit**

```bash
git add app/(dashboard)/expenses/_lib/expense-form.ts app/(dashboard)/expenses/_components/searchable-creatable-field.tsx tests/unit/expenseForm.test.ts
git commit -m "feat(expenses): add searchable expense fields"
```

### Task 3: Rebuild The Expenses Page Around History, Filters, And Inline Validation

**Files:**

- Modify: `app/(dashboard)/expenses/page.tsx:5-167`
- Test: `tests/integration/expenses.test.ts`
- Test: `tests/unit/expenseForm.test.ts`

- [ ] **Step 1: Replace the page state with the new response and filter model**

```tsx
type ExpensesResponse = {
  partners: Array<{
    id: string;
    name: string;
    email: string;
  }>;
  titleSuggestions: string[];
  categorySuggestions: string[];
  expenses: Array<{
    id: string;
    title: string;
    amount: number;
    category: string;
    note: string | null;
    status: "pending" | "approved" | "rejected";
    submittedAt: string;
    expenseDate: string;
    submittedById: string;
    submittedByName: string;
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

const [data, setData] = useState<ExpensesResponse | null>(null);
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
  category: "",
  note: "",
});
const [formErrors, setFormErrors] = useState<
  Partial<Record<"title" | "amount" | "category" | "note", string>>
>({});
```

- [ ] **Step 2: Wire loading, submit validation, and investments-style filters**

```tsx
async function load(nextFilters = filters) {
  const params = buildExpenseHistoryParams(nextFilters);
  const response = await fetch(`/api/expenses?${params.toString()}`, {
    cache: "no-store",
  });

  if (!response.ok) {
    setMessage("Unable to load expenses right now.");
    return;
  }

  const payload = (await response.json()) as ExpensesResponse;
  setData(payload);
  setMessage(null);
}

async function submitExpense() {
  const nextErrors = getExpenseDraftErrors(form);

  if (Object.keys(nextErrors).length > 0) {
    setFormErrors(nextErrors);
    setMessage("Title, category, and balance are mandatory.");
    return;
  }

  setFormErrors({});

  const response = await fetch("/api/expenses", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...form,
      expenseDate: new Date().toISOString(),
    }),
  });

  const payload = (await response.json()) as {
    error?:
      | string
      | {
          formErrors?: string[];
          fieldErrors?: Record<string, string[] | undefined>;
        };
    expenseId?: string;
  };

  if (!response.ok) {
    setMessage(
      typeof payload.error === "string"
        ? payload.error
        : "Please complete the required expense fields.",
    );
    return;
  }

  setForm({ title: "", amount: 0, category: "", note: "" });
  setMessage(`Expense sent: ${payload.expenseId}`);
  await load({ ...filters, page: 1 });
}
```

- [ ] **Step 3: Render the searchable fields and investments-style history block**

```tsx
<section className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
  <div className="rounded-[1.8rem] bg-white/80 p-6 ring-1 ring-(--stroke-soft)">
    <h3 className="text-xl font-semibold tracking-tight">Submit expense</h3>
    <div className="mt-4 grid gap-4">
      <SearchableCreatableField
        error={formErrors.title}
        label="Title"
        onChange={(title) => setForm((current) => ({ ...current, title }))}
        options={data?.titleSuggestions ?? []}
        placeholder="Expense title"
        value={form.title}
      />
      <input
        aria-invalid={Boolean(formErrors.amount)}
        className="field"
        min={0}
        onChange={(event) =>
          setForm((current) => ({
            ...current,
            amount: Number(event.target.value) || 0,
          }))
        }
        placeholder="Balance"
        type="number"
        value={form.amount}
      />
      {formErrors.amount ? (
        <p className="text-sm text-red-600">{formErrors.amount}</p>
      ) : null}
      <SearchableCreatableField
        error={formErrors.category}
        label="Category"
        onChange={(category) =>
          setForm((current) => ({ ...current, category }))
        }
        options={data?.categorySuggestions ?? []}
        placeholder="Expense category"
        value={form.category}
      />
      <textarea
        className="field min-h-28"
        onChange={(event) =>
          setForm((current) => ({ ...current, note: event.target.value }))
        }
        placeholder="Note"
        value={form.note}
      />
    </div>
    <button className="btn-primary mt-4 w-full sm:w-auto" onClick={submitExpense} type="button">
      Submit expense
    </button>
  </div>

  <div className="rounded-[1.8rem] bg-white/80 p-6 ring-1 ring-(--stroke-soft)">
    <h3 className="text-xl font-semibold tracking-tight">Filters</h3>
    <div className="mt-4 grid gap-4 md:grid-cols-2">
      <select className="field" value={filters.scope} onChange={(event) => setFilters((current) => ({ ...current, scope: event.target.value as "all" | "mine" | "others", page: 1 }))}>
        <option value="all">All expenses</option>
        <option value="mine">My expenses</option>
        <option value="others">Other partners</option>
      </select>
      <select className="field" value={filters.owner} onChange={(event) => setFilters((current) => ({ ...current, owner: event.target.value, page: 1 }))}>
        <option value="">All partners</option>
        {(data?.partners ?? []).map((partner) => (
          <option key={partner.id} value={partner.id}>{partner.name}</option>
        ))}
      </select>
      <select className="field" value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value, page: 1 }))}>
        <option value="">All statuses</option>
        <option value="pending">Pending</option>
        <option value="approved">Approved</option>
        <option value="rejected">Rejected</option>
      </select>
      <input className="field" type="date" value={filters.from} onChange={(event) => setFilters((current) => ({ ...current, from: event.target.value, page: 1 }))} />
      <input className="field" type="date" value={filters.to} onChange={(event) => setFilters((current) => ({ ...current, to: event.target.value, page: 1 }))} />
    </div>
    <div className="mt-4 flex flex-wrap gap-3">
      <button className="btn-secondary w-full sm:w-auto" onClick={() => void load(filters)} type="button">Apply filters</button>
      <button
        className="btn-secondary w-full sm:w-auto"
        onClick={() => {
          const reset = { page: 1, scope: "all" as const, owner: "", status: "", from: "", to: "" };
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
    <h3 className="text-xl font-semibold tracking-tight">Expense history</h3>
    <p className="text-sm text-(--text-secondary)">
      {data?.pagination.totalCount ?? 0} record(s)
    </p>
  </div>
  <div className="mt-4 grid gap-3">
    {(data?.expenses ?? []).map((expense) => (
      <div key={expense.id} className="rounded-[1.2rem] border border-(--stroke-soft) p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-medium text-foreground">{expense.title}</p>
            <p className="mt-1 text-sm text-(--text-secondary)">
              {expense.submittedByName} · {expense.category} · {new Date(expense.expenseDate).toLocaleDateString("en-BD")}
            </p>
            <p className="mt-2 text-sm text-(--text-secondary)">
              Status {expense.status} · approvals {expense.approvalCount}/{expense.requiredApprovalCount}
            </p>
            {expense.note ? (
              <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-(--text-secondary)">{expense.note}</p>
            ) : null}
            {expense.approvals.length > 0 ? (
              <div className="mt-3 grid gap-2 rounded-2xl bg-(--surface-accent-soft) p-3">
                {expense.approvals.map((approval) => (
                  <p key={`${expense.id}-${approval.partnerId}`} className="text-sm text-(--text-secondary)">
                    {approval.partnerName} {approval.decision} on {new Date(approval.decidedAt).toLocaleDateString("en-BD")}
                    {approval.comment ? ` · ${approval.comment}` : ""}
                  </p>
                ))}
              </div>
            ) : null}
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold text-foreground">{currency(expense.amount)}</p>
            {expense.canReview ? (
              <div className="mt-3 flex gap-2">
                <button className="btn-primary" onClick={() => void reviewExpense(expense.id, "approved")} type="button">Approve</button>
                <button className="btn-secondary" onClick={() => void reviewExpense(expense.id, "rejected")} type="button">Reject</button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    ))}
  </div>
</section>
```

- [ ] **Step 4: Run the page validation**

Run: `npx eslint "app/(dashboard)/expenses/page.tsx"`
Expected: PASS with `0 problems`.

Run: `npx vitest run tests/unit/expenseForm.test.ts tests/integration/expenses.test.ts`
Expected: PASS, confirming the page is wired to the already-tested helper and API contracts.

- [ ] **Step 5: Commit**

```bash
git add app/(dashboard)/expenses/page.tsx
git commit -m "feat(expenses): rebuild expense workflow page"
```

## Self-Review

**Spec coverage:**

- Searchable clickable dropdown for previous titles: covered by Task 2 component and Task 3 page wiring.
- Searchable clickable dropdown for previous categories: covered by Task 2 component and Task 3 page wiring.
- Creating a new title/category when the typed value does not exist: covered by `shouldOfferCreateOption` in Task 2 and the component wiring in Task 3.
- Only relevant suggestions while typing: covered by `filterExpenseSuggestions` in Task 2 and used in Task 3.
- Mandatory title/category/balance fields: covered by `getExpenseDraftErrors` in Task 2 and inline errors/messages in Task 3.
- Expense history like investments history: covered by Task 1 API/history service and Task 3 UI.
- Expense filters like investments filters: covered by Task 1 GET contract and Task 3 filter controls.

**Placeholder scan:**

- No `TODO`, `TBD`, or deferred implementation markers remain.

**Type consistency:**

- Persistence keeps the existing `amount` field; user-facing copy can say `Balance` while API/model code remains `amount`.
- Filter params match the investments page contract: `page`, `pageSize`, `scope`, `owner`, `status`, `from`, `to`.

Plan complete and saved to `docs/superpowers/plans/2026-04-28-expenses-history-and-entry-upgrade.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
