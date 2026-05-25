import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.resetModules();
  vi.restoreAllMocks();
  vi.doUnmock("@/lib/auth");
  vi.doUnmock("@/lib/services/perfume-pricing");
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

describe("perfume pricing route contracts", () => {
  it("maps GET filters to the pricing service", async () => {
    const listPerfumePricingRules = vi.fn().mockResolvedValue({
      rules: [],
      perfumes: [],
      bottles: [],
    });

    mockPartnerSession();
    vi.doMock("@/lib/services/perfume-pricing", () => ({
      listPerfumePricingRules,
      createPerfumePricingRule: vi.fn(),
      updatePerfumePricingRule: vi.fn(),
    }));

    const { GET } = await import("@/app/api/perfume-pricing/route");
    const response = await GET(
      new Request(
        "http://localhost:3000/api/perfume-pricing?perfumeVariantId=v1&bottleVariantId=b1",
      ),
    );

    expect(response.status).toBe(200);
    expect(listPerfumePricingRules).toHaveBeenCalledWith({
      perfumeVariantId: "v1",
      bottleVariantId: "b1",
    });
  });

  it("creates pricing rules through POST", async () => {
    const createPerfumePricingRule = vi.fn().mockResolvedValue({
      id: "rule-1",
    });

    mockPartnerSession();
    vi.doMock("@/lib/services/perfume-pricing", () => ({
      listPerfumePricingRules: vi.fn(),
      createPerfumePricingRule,
      updatePerfumePricingRule: vi.fn(),
    }));

    const { POST } = await import("@/app/api/perfume-pricing/route");
    const response = await POST(
      new Request("http://localhost:3000/api/perfume-pricing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          perfumeVariantId: "perfume-1",
          bottleVariantId: "bottle-1",
          fillMl: 15,
          bottleSellingPrice: 100,
        }),
      }),
    );

    expect(response.status).toBe(201);
    expect(createPerfumePricingRule).toHaveBeenCalledWith({
      perfumeVariantId: "perfume-1",
      bottleVariantId: "bottle-1",
      fillMl: 15,
      bottleSellingPrice: 100,
    });
  });

  it("updates pricing rules through PATCH", async () => {
    const updatePerfumePricingRule = vi.fn().mockResolvedValue({
      id: "rule-1",
    });

    mockPartnerSession();
    vi.doMock("@/lib/services/perfume-pricing", () => ({
      listPerfumePricingRules: vi.fn(),
      createPerfumePricingRule: vi.fn(),
      updatePerfumePricingRule,
    }));

    const { PATCH } = await import("@/app/api/perfume-pricing/route");
    const response = await PATCH(
      new Request("http://localhost:3000/api/perfume-pricing", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ruleId: "rule-1",
          fillMl: 30,
          bottleSellingPrice: 130,
          isActive: true,
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(updatePerfumePricingRule).toHaveBeenCalledWith({
      ruleId: "rule-1",
      fillMl: 30,
      bottleSellingPrice: 130,
      isActive: true,
    });
  });
});
