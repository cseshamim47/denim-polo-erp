import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

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
    vi.resetModules();
    vi.restoreAllMocks();
    vi.doUnmock("@/lib/auth");
    vi.doUnmock("@/lib/services/expense-history");
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

  it("returns filtered paginated expense history with suggestions", async () => {
    const [
      { listExpenseHistory },
      { createExpense, reviewExpense },
      { default: UserModel },
    ] = await Promise.all([
      import("../../lib/services/expense-history"),
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

    const approvedExpense = await createExpense({
      title: "Fuel",
      amount: 900,
      expenseDate: new Date("2026-04-30T20:45:00.000Z"),
      submittedBy: partnerOne._id.toString(),
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

    await createExpense({
      title: "Transport",
      amount: 400,
      expenseDate: new Date("2026-04-12T10:00:00.000Z"),
      submittedBy: partnerThree._id.toString(),
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
      title: "Fuel",
      status: "approved",
      submittedByName: "Partner One",
      canReview: false,
      approvalCount: 2,
      requiredApprovalCount: 2,
    });
    expect(history.pagination).toEqual({
      page: 1,
      pageSize: 10,
      totalCount: 1,
      totalPages: 1,
    });
    expect(history.titleSuggestions).toEqual(["Fuel", "Transport"]);

    const ownerScopedHistory = await listExpenseHistory({
      actorId: partnerTwo._id.toString(),
      page: 1,
      pageSize: 10,
      scope: "others",
      owner: partnerOne._id.toString(),
      status: "approved",
      from: "2026-04-01",
      to: "2026-04-30",
    });

    expect(ownerScopedHistory.expenses).toHaveLength(1);
    expect(ownerScopedHistory.expenses[0]?.submittedById).toBe(
      partnerOne._id.toString(),
    );
  });

  it("maps GET query params to expense history filters", async () => {
    const listExpenseHistory = vi.fn().mockResolvedValue({
      partners: [],
      titleSuggestions: [],
      expenses: [],
      pagination: { page: 2, pageSize: 10, totalCount: 0, totalPages: 1 },
    });

    vi.doMock("@/lib/auth", () => ({
      getRequiredSession: vi.fn().mockResolvedValue({
        user: { id: "507f1f77bcf86cd799439011", role: "partner" },
      }),
    }));
    vi.doMock("@/lib/services/expense-history", () => ({
      listExpenseHistory,
    }));

    const { GET } = await import("../../app/api/expenses/route");
    const response = await GET(
      new Request(
        "http://localhost:3000/api/expenses?page=2&pageSize=10&scope=others&owner=507f1f77bcf86cd799439012&status=approved&from=2026-04-01&to=2026-04-30",
      ),
    );

    expect(response.status).toBe(200);
    expect(listExpenseHistory).toHaveBeenCalledWith({
      actorId: "507f1f77bcf86cd799439011",
      page: 2,
      pageSize: 10,
      scope: "others",
      owner: "507f1f77bcf86cd799439012",
      status: "approved",
      from: "2026-04-01",
      to: "2026-04-30",
    });
  });

  it("returns 400 for an invalid owner filter on GET", async () => {
    vi.doMock("@/lib/auth", () => ({
      getRequiredSession: vi.fn().mockResolvedValue({
        user: { id: "507f1f77bcf86cd799439011", role: "partner" },
      }),
    }));

    const { GET } = await import("../../app/api/expenses/route");
    const response = await GET(
      new Request("http://localhost:3000/api/expenses?owner=bad-owner"),
    );
    const payload = (await response.json()) as { error?: string };

    expect(response.status).toBe(400);
    expect(payload.error).toBe("Invalid owner filter");
  });
});
