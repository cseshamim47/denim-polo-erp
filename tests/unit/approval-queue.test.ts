import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.resetModules();
  vi.restoreAllMocks();
  vi.doUnmock("@/models/User");
  vi.doUnmock("@/models/Product");
  vi.doUnmock("@/lib/services/purchases");
  vi.doUnmock("@/lib/services/expense-history");
  vi.doUnmock("@/lib/services/investment-history");
  vi.doUnmock("@/lib/services/asset-history");
  vi.doUnmock("@/lib/services/products");
});

describe("approval queue", () => {
  it("includes pending product delete requests in my approval view", async () => {
    vi.doMock("@/models/User", () => ({
      default: {
        find: vi.fn().mockReturnValue({
          sort: vi.fn().mockReturnValue({
            lean: vi.fn().mockResolvedValue([
              {
                _id: { toString: () => "partner-1" },
                name: "Partner One",
                email: "one@example.com",
                isActive: true,
              },
              {
                _id: { toString: () => "partner-2" },
                name: "Partner Two",
                email: "two@example.com",
                isActive: true,
              },
            ]),
          }),
        }),
      },
    }));

    vi.doMock("@/lib/services/purchases", () => ({
      listPurchases: vi.fn().mockResolvedValue({ items: [] }),
      reviewPurchases: vi.fn(),
    }));
    vi.doMock("@/lib/services/expense-history", () => ({
      listExpenseHistory: vi.fn().mockResolvedValue({ expenses: [] }),
    }));
    vi.doMock("@/lib/services/investment-history", () => ({
      listInvestmentHistory: vi.fn().mockResolvedValue({ investments: [] }),
    }));
    vi.doMock("@/lib/services/asset-history", () => ({
      listAssetHistory: vi.fn().mockResolvedValue({ assets: [] }),
    }));
    vi.doMock("@/lib/services/products", () => ({
      listProductApprovalQueueItems: vi.fn().mockResolvedValue([
        {
          id: "product-1",
          selectionKey: "products:product-1",
          kind: "products",
          title: "Dior Sauvage",
          subtitle: "PERFUME · Product delete request",
          ownerId: "partner-2",
          ownerName: "Partner Two",
          amount: 0,
          status: "pending",
          submittedAt: "2026-05-25T12:00:00.000Z",
          effectiveDate: "2026-05-25T12:00:00.000Z",
          note: null,
          approvalCount: 0,
          requiredApprovalCount: 1,
          canReview: true,
          pendingPartnerIds: ["partner-1"],
          pendingPartnerNames: ["Partner One"],
        },
      ]),
      reviewProducts: vi.fn(),
    }));

    const { listApprovalQueue } = await import("@/lib/services/approval-queue");
    const result = await listApprovalQueue({ actorId: "partner-1", view: "mine" });

    expect(result.summary.products).toBe(1);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      kind: "products",
      title: "Dior Sauvage",
      canReview: true,
    });
  });
});
