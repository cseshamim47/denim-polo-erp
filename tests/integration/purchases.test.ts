import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import {
  clearTestDatabase,
  startTestDatabase,
  stopTestDatabase,
} from "../helpers/mongodb";

describe("purchase integration", () => {
  beforeAll(async () => {
    await startTestDatabase();
  });

  afterEach(async () => {
    await clearTestDatabase();
  });

  afterAll(async () => {
    await stopTestDatabase();
  });

  it("keeps purchase pending until all other active partners approve and then updates stock", async () => {
    const [
      { createPurchase, reviewPurchase },
      { default: ProductModel },
      { default: VariantModel },
      { default: PurchaseModel },
      { default: UserModel },
    ] = await Promise.all([
      import("../../lib/services/purchases"),
      import("../../models/Product"),
      import("../../models/Variant"),
      import("../../models/Purchase"),
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

    const product = await ProductModel.create({
      name: "Classic Jeans",
      category: "JEANS",
      isActive: true,
    });

    const variant = await VariantModel.create({
      productId: product._id,
      color: "BLK",
      size: "32",
      sku: "DP-JEANS-BLK-32",
      stockQty: 10,
      avgCost: "100",
      sellingPrice: "180",
      lowStockThreshold: 2,
      isActive: true,
    });

    const purchase = await createPurchase({
      variantId: variant._id.toString(),
      qty: 5,
      costPerUnit: 130,
      purchaseDate: new Date("2026-04-17T00:00:00.000Z"),
      createdBy: partnerOne._id.toString(),
      billImageUrl: "https://files.example.com/bills/purchase-1.jpg",
    });

    const variantBeforeApproval = await VariantModel.findById(variant._id).lean();
    const savedPurchase = await PurchaseModel.findById(purchase._id).lean();

    expect(variantBeforeApproval?.stockQty).toBe(10);
    expect(Number(variantBeforeApproval?.avgCost?.toString())).toBe(100);
    expect(savedPurchase?.status).toBe("pending");
    expect(savedPurchase?.requiredApprovalCountSnapshot).toBe(2);
    expect(Number(savedPurchase?.totalCost?.toString())).toBe(650);
    expect(savedPurchase?.billImageUrl).toBe(
      "https://files.example.com/bills/purchase-1.jpg",
    );

    const afterFirstApproval = await reviewPurchase({
      purchaseId: purchase._id.toString(),
      partnerId: partnerTwo._id.toString(),
      decision: "approved",
    });

    expect(afterFirstApproval.status).toBe("pending");

    const afterSecondApproval = await reviewPurchase({
      purchaseId: purchase._id.toString(),
      partnerId: partnerThree._id.toString(),
      decision: "approved",
    });

    expect(afterSecondApproval.status).toBe("approved");

    const refreshedVariant = await VariantModel.findById(variant._id).lean();

    expect(refreshedVariant?.stockQty).toBe(15);
    expect(Number(refreshedVariant?.avgCost?.toString())).toBe(110);
  });

  it("rejects purchase on first rejection and leaves stock unchanged", async () => {
    const [
      { createPurchase, reviewPurchase },
      { default: ProductModel },
      { default: VariantModel },
      { default: PurchaseModel },
      { default: UserModel },
    ] = await Promise.all([
      import("../../lib/services/purchases"),
      import("../../models/Product"),
      import("../../models/Variant"),
      import("../../models/Purchase"),
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

    const product = await ProductModel.create({
      name: "Classic Jeans",
      category: "JEANS",
      isActive: true,
    });

    const variant = await VariantModel.create({
      productId: product._id,
      color: "BLK",
      size: "32",
      sku: "DP-JEANS-BLK-32",
      stockQty: 10,
      avgCost: "100",
      sellingPrice: "180",
      lowStockThreshold: 2,
      isActive: true,
    });

    const purchase = await createPurchase({
      variantId: variant._id.toString(),
      qty: 5,
      costPerUnit: 130,
      additionalCost: 50,
      purchaseDate: new Date("2026-04-17T00:00:00.000Z"),
      createdBy: partnerOne._id.toString(),
    });

    await expect(
      reviewPurchase({
        purchaseId: purchase._id.toString(),
        partnerId: partnerOne._id.toString(),
        decision: "approved",
      }),
    ).rejects.toThrow("submitter cannot approve own purchase");

    const rejectedPurchase = await reviewPurchase({
      purchaseId: purchase._id.toString(),
      partnerId: partnerTwo._id.toString(),
      decision: "rejected",
      comment: "Need supplier confirmation",
    });

    expect(rejectedPurchase.status).toBe("rejected");

    await expect(
      reviewPurchase({
        purchaseId: purchase._id.toString(),
        partnerId: partnerTwo._id.toString(),
        decision: "approved",
      }),
    ).rejects.toThrow("partner already reviewed purchase");

    expect(partnerThree.email).toBe("partner3@example.com");

    const refreshedVariant = await VariantModel.findById(variant._id).lean();
    const savedPurchase = await PurchaseModel.findById(purchase._id).lean();

    expect(refreshedVariant?.stockQty).toBe(10);
    expect(Number(refreshedVariant?.avgCost?.toString())).toBe(100);
    expect(Number(savedPurchase?.totalCost?.toString())).toBe(650);
    expect(Number(savedPurchase?.additionalCost?.toString())).toBe(50);
    expect(Number(savedPurchase?.cashOutTotal?.toString())).toBe(700);
    expect(Number(savedPurchase?.landedCostPerUnit?.toString())).toBe(140);
    expect(savedPurchase?.status).toBe("rejected");
  });
});
