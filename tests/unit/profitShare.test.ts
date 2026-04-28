import { describe, expect, it } from "vitest";

import { calculatePartnerProfitShares } from "../../lib/domain/profit-share";

describe("partner profit share", () => {
  it("allocates the profit pool by each partner's capital ratio", () => {
    const result = calculatePartnerProfitShares({
      totalProfitPool: 12000,
      partners: [
        { partnerId: "p1", partnerName: "Partner One", totalInvestment: 5000 },
        { partnerId: "p2", partnerName: "Partner Two", totalInvestment: 3000 },
        {
          partnerId: "p3",
          partnerName: "Partner Three",
          totalInvestment: 2000,
        },
      ],
    });

    expect(result).toEqual({
      totalInvested: 10000,
      shares: [
        {
          partnerId: "p1",
          partnerName: "Partner One",
          totalInvestment: 5000,
          profitSharePercent: 50,
          profitShareAmount: 6000,
        },
        {
          partnerId: "p2",
          partnerName: "Partner Two",
          totalInvestment: 3000,
          profitSharePercent: 30,
          profitShareAmount: 3600,
        },
        {
          partnerId: "p3",
          partnerName: "Partner Three",
          totalInvestment: 2000,
          profitSharePercent: 20,
          profitShareAmount: 2400,
        },
      ],
    });
  });

  it("returns zero owed when no partner capital has been recorded", () => {
    const result = calculatePartnerProfitShares({
      totalProfitPool: 8000,
      partners: [
        { partnerId: "p1", partnerName: "Partner One", totalInvestment: 0 },
        { partnerId: "p2", partnerName: "Partner Two", totalInvestment: 0 },
      ],
    });

    expect(result).toEqual({
      totalInvested: 0,
      shares: [
        {
          partnerId: "p1",
          partnerName: "Partner One",
          totalInvestment: 0,
          profitSharePercent: 0,
          profitShareAmount: 0,
        },
        {
          partnerId: "p2",
          partnerName: "Partner Two",
          totalInvestment: 0,
          profitSharePercent: 0,
          profitShareAmount: 0,
        },
      ],
    });
  });
});
