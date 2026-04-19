"use client";

import { useEffect, useState } from "react";

type Expense = {
  id: string;
  title: string;
  amount: number;
  category: string;
  status: "pending" | "approved" | "rejected";
  requiredApprovalCount: number;
  approvalCount: number;
  note?: string | null;
};

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: "",
    amount: 0,
    category: "",
    note: "",
  });

  async function loadExpenses() {
    const response = await fetch("/api/expenses", { cache: "no-store" });
    const payload = (await response.json()) as { expenses?: Expense[] };
    setExpenses(payload.expenses ?? []);
  }

  useEffect(() => {
    void loadExpenses();
  }, []);

  async function submitExpense() {
    const response = await fetch("/api/expenses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, expenseDate: new Date().toISOString() }),
    });

    const payload = (await response.json()) as {
      error?: string;
      expenseId?: string;
    };
    setMessage(
      response.ok
        ? `Expense sent: ${payload.expenseId}`
        : (payload.error ?? "Expense failed."),
    );

    if (response.ok) {
      setForm({ title: "", amount: 0, category: "", note: "" });
      await loadExpenses();
    }
  }

  async function reviewExpense(
    expenseId: string,
    decision: "approved" | "rejected",
  ) {
    const response = await fetch("/api/expenses", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ expenseId, decision }),
    });

    const payload = (await response.json()) as { error?: string };
    setMessage(
      response.ok
        ? `Expense ${decision}.`
        : (payload.error ?? "Review failed."),
    );
    await loadExpenses();
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
      <section className="space-y-4 rounded-[1.8rem] bg-white/80 p-6 ring-1 ring-[var(--stroke-soft)]">
        <h2 className="text-2xl font-semibold tracking-tight">
          Expense workflow
        </h2>
        <p className="text-sm leading-7 text-[var(--text-secondary)]">
          Submit once. Every active non-submitter partner must approve. Any one
          rejection stops it.
        </p>
        <input
          className="field"
          placeholder="Title"
          value={form.title}
          onChange={(event) =>
            setForm((current) => ({ ...current, title: event.target.value }))
          }
        />
        <div className="grid gap-4 md:grid-cols-2">
          <input
            className="field"
            type="number"
            min={0}
            placeholder="Amount"
            value={form.amount}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                amount: Number(event.target.value) || 0,
              }))
            }
          />
          <input
            className="field"
            placeholder="Category"
            value={form.category}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                category: event.target.value,
              }))
            }
          />
        </div>
        <textarea
          className="field min-h-28"
          placeholder="Note"
          value={form.note}
          onChange={(event) =>
            setForm((current) => ({ ...current, note: event.target.value }))
          }
        />
        <button
          className="btn-primary w-full sm:w-auto"
          onClick={submitExpense}
          type="button"
        >
          Submit expense
        </button>
        {message ? (
          <p className="text-sm text-[var(--text-secondary)]">{message}</p>
        ) : null}
      </section>
      <section className="space-y-4 rounded-[1.8rem] bg-white/80 p-6 ring-1 ring-[var(--stroke-soft)]">
        {expenses.map((expense) => (
          <div
            key={expense.id}
            className="rounded-[1.3rem] border border-[var(--stroke-soft)] p-4"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-medium">{expense.title}</p>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">
                  {expense.category} · {expense.amount}
                </p>
                <p className="mt-1 text-xs uppercase tracking-[0.2em] text-[var(--text-secondary)]">
                  {expense.status} · approvals {expense.approvalCount}/
                  {expense.requiredApprovalCount}
                </p>
              </div>
              {expense.status === "pending" ? (
                <div className="flex gap-2">
                  <button
                    className="btn-secondary"
                    onClick={() => reviewExpense(expense.id, "approved")}
                    type="button"
                  >
                    Approve
                  </button>
                  <button
                    className="btn-secondary"
                    onClick={() => reviewExpense(expense.id, "rejected")}
                    type="button"
                  >
                    Reject
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
