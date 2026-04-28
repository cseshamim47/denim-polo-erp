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

  it("creates purchase and updates variant stock and avg cost", async () => {
    const [
      { createPurchase },
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

    const manager = await UserModel.create({
      name: "Partner One",
      email: "partner1@example.com",
      role: "partner",
      authProvider: "google",
      isActive: true,
    });

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
      createdBy: manager._id.toString(),
      billImageUrl: "https://files.example.com/bills/purchase-1.jpg",
    });

    const refreshedVariant = await VariantModel.findById(variant._id).lean();
    const savedPurchase = await PurchaseModel.findById(purchase._id).lean();

    expect(refreshedVariant?.stockQty).toBe(15);
    expect(Number(refreshedVariant?.avgCost?.toString())).toBe(110);
    expect(Number(savedPurchase?.totalCost?.toString())).toBe(650);
    expect(savedPurchase?.billImageUrl).toBe(
      "https://files.example.com/bills/purchase-1.jpg",
    );
  });

  it("includes extra batch cost in landed cost and cash-out total", async () => {
    const [
      { createPurchase },
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

    const manager = await UserModel.create({
      name: "Partner One",
      email: "partner1@example.com",
      role: "partner",
      authProvider: "google",
      isActive: true,
    });

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
      createdBy: manager._id.toString(),
    });

    const refreshedVariant = await VariantModel.findById(variant._id).lean();
    const savedPurchase = await PurchaseModel.findById(purchase._id).lean();

    expect(Number(savedPurchase?.totalCost?.toString())).toBe(650);
    expect(Number(savedPurchase?.additionalCost?.toString())).toBe(50);
    expect(Number(savedPurchase?.cashOutTotal?.toString())).toBe(700);
    expect(Number(savedPurchase?.landedCostPerUnit?.toString())).toBe(140);
    expect(Number(refreshedVariant?.avgCost?.toString())).toBeCloseTo(
      113.3333,
      4,
    );
  });
});
