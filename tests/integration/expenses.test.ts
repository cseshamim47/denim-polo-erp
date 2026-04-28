import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import {
  clearTestDatabase,
  startTestDatabase,
  stopTestDatabase,
} from "../helpers/mongodb";

describe("expense integration", () => {
  beforeAll(async () => {
    await startTestDatabase();
  });

  afterEach(async () => {
    await clearTestDatabase();
  });

  afterAll(async () => {
    await stopTestDatabase();
  });

  it("requires approvals from all active non-submitter partners", async () => {
    const [
      { createExpense, reviewExpense },
      { default: ExpenseModel },
      { default: UserModel },
    ] = await Promise.all([
      import("../../lib/services/expenses"),
      import("../../models/Expense"),
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

    const expense = await createExpense({
      title: "Transport",
      amount: 500,
      category: "Logistics",
      expenseDate: new Date("2026-04-19T00:00:00.000Z"),
      submittedBy: partnerOne._id.toString(),
    });

    expect(expense.status).toBe("pending");
    expect(expense.requiredApprovalCountSnapshot).toBe(2);

    const afterFirstApproval = await reviewExpense({
      expenseId: expense._id.toString(),
      partnerId: partnerTwo._id.toString(),
      decision: "approved",
    });

    expect(afterFirstApproval.status).toBe("pending");

    const afterSecondApproval = await reviewExpense({
      expenseId: expense._id.toString(),
      partnerId: partnerThree._id.toString(),
      decision: "approved",
    });

    expect(afterSecondApproval.status).toBe("approved");

    const savedExpense = await ExpenseModel.findById(expense._id).lean();
    expect(savedExpense?.approvals).toHaveLength(2);
  });

  it("rejects expense when any required partner rejects", async () => {
    const [{ createExpense, reviewExpense }, { default: UserModel }] =
      await Promise.all([
        import("../../lib/services/expenses"),
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

    const expense = await createExpense({
      title: "Snacks",
      amount: 250,
      category: "Office",
      expenseDate: new Date("2026-04-19T00:00:00.000Z"),
      submittedBy: partnerOne._id.toString(),
    });

    const reviewedExpense = await reviewExpense({
      expenseId: expense._id.toString(),
      partnerId: partnerTwo._id.toString(),
      decision: "rejected",
      comment: "Not approved",
    });

    expect(reviewedExpense.status).toBe("rejected");

    await expect(
      reviewExpense({
        expenseId: expense._id.toString(),
        partnerId: partnerOne._id.toString(),
        decision: "approved",
      }),
    ).rejects.toThrow("submitter cannot approve own expense");

    await expect(
      reviewExpense({
        expenseId: expense._id.toString(),
        partnerId: partnerTwo._id.toString(),
        decision: "approved",
      }),
    ).rejects.toThrow("partner already reviewed expense");

    expect(partnerThree.email).toBe("partner3@example.com");
  });
});
