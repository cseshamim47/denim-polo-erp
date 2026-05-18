import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.resetModules();
  vi.restoreAllMocks();
  vi.doUnmock("@/lib/auth");
  vi.doUnmock("@/lib/services/expenses");
  vi.doUnmock("@/lib/services/expense-history");
  vi.doUnmock("@/lib/services/purchases");
  vi.doUnmock("@/lib/services/assets");
  vi.doUnmock("@/lib/services/asset-history");
  vi.doUnmock("@/lib/services/investment-history");
  vi.doUnmock("@/lib/services/investments");
  vi.doUnmock("@/lib/services/approval-queue");
});

function mockPartnerSession() {
  vi.doMock("@/lib/auth", () => ({
    getRequiredSession: vi.fn().mockResolvedValue({
      user: {
        id: "507f1f77bcf86cd799439011",
        name: "Partner One",
        role: "partner",
      },
    }),
  }));
}

describe("approval route contracts", () => {
  it("passes needsReview filter to expenses history service", async () => {
    const listExpenseHistory = vi.fn().mockResolvedValue({
      partners: [],
      titleSuggestions: [],
      expenses: [],
      pagination: { page: 1, pageSize: 10, totalCount: 0, totalPages: 1 },
    });

    mockPartnerSession();
    vi.doMock("@/lib/services/expense-history", () => ({
      listExpenseHistory,
    }));

    const { GET } = await import("../../app/api/expenses/route");
    const response = await GET(
      new Request("http://localhost:3000/api/expenses?needsReview=true"),
    );

    expect(response.status).toBe(200);
    expect(listExpenseHistory).toHaveBeenCalledWith({
      actorId: "507f1f77bcf86cd799439011",
      page: 1,
      pageSize: 10,
      scope: null,
      owner: null,
      status: null,
      from: null,
      to: null,
      needsReview: true,
    });
  });

  it("supports bulk expense approval payloads", async () => {
    const reviewExpenses = vi.fn().mockResolvedValue([
      {
        id: "expense-1",
        status: "approved",
        approval: {
          partnerId: "507f1f77bcf86cd799439011",
          partnerName: "Partner One",
          decision: "approved",
          comment: null,
          decidedAt: "2026-05-18T09:00:00.000Z",
        },
      },
    ]);

    mockPartnerSession();
    vi.doMock("@/lib/services/expenses", () => ({
      createExpense: vi.fn(),
      reviewExpense: vi.fn(),
      reviewExpenses,
    }));

    const { PATCH } = await import("../../app/api/expenses/route");
    const response = await PATCH(
      new Request("http://localhost:3000/api/expenses", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expenseIds: ["expense-1"],
          decision: "approved",
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(reviewExpenses).toHaveBeenCalledWith({
      expenseIds: ["expense-1"],
      partnerId: "507f1f77bcf86cd799439011",
      partnerName: "Partner One",
      decision: "approved",
    });
    await expect(response.json()).resolves.toEqual({
      reviews: [
        {
          id: "expense-1",
          status: "approved",
          approval: {
            partnerId: "507f1f77bcf86cd799439011",
            partnerName: "Partner One",
            decision: "approved",
            comment: null,
            decidedAt: "2026-05-18T09:00:00.000Z",
          },
        },
      ],
    });
  });

  it("supports bulk purchase approval payloads", async () => {
    const reviewPurchases = vi.fn().mockResolvedValue([]);

    mockPartnerSession();
    vi.doMock("@/lib/services/purchases", () => ({
      createPurchase: vi.fn(),
      listPurchases: vi.fn(),
      reviewPurchase: vi.fn(),
      reviewPurchases,
    }));

    const { PATCH } = await import("../../app/api/purchases/route");
    const response = await PATCH(
      new Request("http://localhost:3000/api/purchases", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          purchaseIds: ["purchase-1", "purchase-2"],
          decision: "approved",
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(reviewPurchases).toHaveBeenCalledWith({
      purchaseIds: ["purchase-1", "purchase-2"],
      partnerId: "507f1f77bcf86cd799439011",
      partnerName: "Partner One",
      decision: "approved",
    });
  });

  it("supports bulk investment approval payloads", async () => {
    const reviewInvestments = vi.fn().mockResolvedValue([]);

    mockPartnerSession();
    vi.doMock("@/lib/services/investments", () => ({
      createInvestment: vi.fn(),
      reviewInvestment: vi.fn(),
      reviewInvestments,
    }));
    vi.doMock("@/lib/services/investment-history", () => ({
      listInvestmentHistory: vi.fn().mockResolvedValue({
        balance: {
          currentBalance: 0,
          breakdown: {
            approvedInvestmentTotal: 0,
            completedSalesTotal: 0,
            customerRefundTotal: 0,
            purchaseTotal: 0,
            approvedExpenseTotal: 0,
            approvedAssetTotal: 0,
          },
        },
        partners: [],
        approvedTotals: [],
        investments: [],
        pagination: { page: 1, pageSize: 10, totalCount: 0, totalPages: 1 },
      }),
    }));

    const { PATCH } = await import("../../app/api/investments/route");
    const response = await PATCH(
      new Request("http://localhost:3000/api/investments", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          investmentIds: ["investment-1"],
          decision: "approved",
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(reviewInvestments).toHaveBeenCalledWith({
      investmentIds: ["investment-1"],
      partnerId: "507f1f77bcf86cd799439011",
      partnerName: "Partner One",
      decision: "approved",
    });
  });

  it("supports bulk asset approval payloads", async () => {
    const reviewAssets = vi.fn().mockResolvedValue([]);

    mockPartnerSession();
    vi.doMock("@/lib/services/assets", () => ({
      createAsset: vi.fn(),
      reviewAsset: vi.fn(),
      reviewAssets,
    }));

    const { PATCH } = await import("../../app/api/assets/route");
    const response = await PATCH(
      new Request("http://localhost:3000/api/assets", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assetIds: ["asset-1"],
          decision: "approved",
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(reviewAssets).toHaveBeenCalledWith({
      assetIds: ["asset-1"],
      partnerId: "507f1f77bcf86cd799439011",
      partnerName: "Partner One",
      decision: "approved",
    });
  });

  it("maps approvals queue GET to unified service", async () => {
    const listApprovalQueue = vi.fn().mockResolvedValue({
      summary: {
        total: 0,
        purchases: 0,
        expenses: 0,
        investments: 0,
        assets: 0,
      },
      partners: [],
      items: [],
    });

    mockPartnerSession();
    vi.doMock("@/lib/services/approval-queue", () => ({
      listApprovalQueue,
      reviewApprovalQueueItems: vi.fn(),
    }));

    const { GET } = await import("../../app/api/approvals/route");
    const response = await GET(
      new Request(
        "http://localhost:3000/api/approvals?view=partners&pendingPartner=507f1f77bcf86cd799439013&kind=expenses&owner=507f1f77bcf86cd799439012&search=fuel&sort=oldest",
      ),
    );

    expect(response.status).toBe(200);
    expect(listApprovalQueue).toHaveBeenCalledWith({
      actorId: "507f1f77bcf86cd799439011",
      view: "partners",
      pendingPartner: "507f1f77bcf86cd799439013",
      kind: "expenses",
      owner: "507f1f77bcf86cd799439012",
      search: "fuel",
      sort: "oldest",
    });
  });
});
