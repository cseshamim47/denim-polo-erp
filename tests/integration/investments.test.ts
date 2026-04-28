import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import {
  clearTestDatabase,
  startTestDatabase,
  stopTestDatabase,
} from "../helpers/mongodb";

describe("investment integration", () => {
  beforeAll(async () => {
    await startTestDatabase();
  });

  afterEach(async () => {
    await clearTestDatabase();
  });

  afterAll(async () => {
    await stopTestDatabase();
  });

  it("requires approval from the other active partners", async () => {
    const [
      { createInvestment, reviewInvestment },
      { default: InvestmentModel },
      { default: UserModel },
    ] = await Promise.all([
      import("../../lib/services/investments"),
      import("../../models/Investment"),
      import("../../models/User"),
    ]);

    const [partnerOne, partnerTwo, partnerThree] = await UserModel.create([
      {
        name: "Partner One",
        email: "partner1@example.com",
        role: "partner",
        authProvider: "google",
        isActive: true,
      },
      {
        name: "Partner Two",
        email: "partner2@example.com",
        role: "partner",
        authProvider: "google",
        isActive: true,
      },
      {
        name: "Partner Three",
        email: "partner3@example.com",
        role: "partner",
        authProvider: "google",
        isActive: true,
      },
    ]);

    const investment = await createInvestment({
      amount: 25000,
      investedAt: new Date("2026-04-20T00:00:00.000Z"),
      note: "Seasonal inventory top-up",
      submittedBy: partnerOne._id.toString(),
    });

    expect(investment.status).toBe("pending");
    expect(investment.requiredApprovalCountSnapshot).toBe(2);
    expect(investment.partnerId.toString()).toBe(partnerOne._id.toString());

    const afterFirstApproval = await reviewInvestment({
      investmentId: investment._id.toString(),
      partnerId: partnerTwo._id.toString(),
      decision: "approved",
    });

    expect(afterFirstApproval.status).toBe("pending");

    const afterSecondApproval = await reviewInvestment({
      investmentId: investment._id.toString(),
      partnerId: partnerThree._id.toString(),
      decision: "approved",
    });

    expect(afterSecondApproval.status).toBe("approved");

    const savedInvestment = await InvestmentModel.findById(
      investment._id,
    ).lean();
    expect(savedInvestment?.approvals).toHaveLength(2);
  });

  it("does not let the submitter verify their own investment and rejects on first rejection", async () => {
    const [{ createInvestment, reviewInvestment }, { default: UserModel }] =
      await Promise.all([
        import("../../lib/services/investments"),
        import("../../models/User"),
      ]);

    const [partnerOne, partnerTwo, partnerThree] = await UserModel.create([
      {
        name: "Partner One",
        email: "partner1@example.com",
        role: "partner",
        authProvider: "google",
        isActive: true,
      },
      {
        name: "Partner Two",
        email: "partner2@example.com",
        role: "partner",
        authProvider: "google",
        isActive: true,
      },
      {
        name: "Partner Three",
        email: "partner3@example.com",
        role: "partner",
        authProvider: "google",
        isActive: true,
      },
    ]);

    const investment = await createInvestment({
      amount: 18000,
      investedAt: new Date("2026-04-20T00:00:00.000Z"),
      note: "Cash drawer support",
      submittedBy: partnerOne._id.toString(),
    });

    await expect(
      reviewInvestment({
        investmentId: investment._id.toString(),
        partnerId: partnerOne._id.toString(),
        decision: "approved",
      }),
    ).rejects.toThrow("submitter cannot approve own investment");

    const rejected = await reviewInvestment({
      investmentId: investment._id.toString(),
      partnerId: partnerTwo._id.toString(),
      decision: "rejected",
      comment: "Need supporting evidence first",
    });

    expect(rejected.status).toBe("rejected");

    await expect(
      reviewInvestment({
        investmentId: investment._id.toString(),
        partnerId: partnerTwo._id.toString(),
        decision: "approved",
      }),
    ).rejects.toThrow("partner already reviewed investment");

    expect(partnerThree.email).toBe("partner3@example.com");
  });
});
