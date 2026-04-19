import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import {
  clearTestDatabase,
  startTestDatabase,
  stopTestDatabase,
} from "../helpers/mongodb";

describe("sales integration", () => {
  beforeAll(async () => {
    await startTestDatabase();
  });

  afterEach(async () => {
    await clearTestDatabase();
  });

  afterAll(async () => {
    await stopTestDatabase();
  });

  it("creates sale, snapshots profit, and deducts stock", async () => {
    const [
      { createSale },
      { default: ProductModel },
      { default: VariantModel },
      { default: SaleModel },
      { default: UserModel },
    ] = await Promise.all([
      import("../../lib/services/sales"),
      import("../../models/Product"),
      import("../../models/Variant"),
      import("../../models/Sale"),
      import("../../models/User"),
    ]);

    const salesman = await UserModel.create({
      name: "Salesman One",
      email: "salesman@example.com",
      passwordHash: "hashed-password",
      role: "salesman",
      authProvider: "credentials",
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
      stockQty: 8,
      avgCost: "125",
      sellingPrice: "180",
      lowStockThreshold: 2,
      isActive: true,
    });

    const sale = await createSale({
      soldBy: salesman._id.toString(),
      paymentMethod: "cash",
      saleDate: new Date("2026-04-17T00:00:00.000Z"),
      items: [
        {
          variantId: variant._id.toString(),
          qty: 3,
        },
      ],
    });

    const refreshedVariant = await VariantModel.findById(variant._id).lean();
    const savedSale = await SaleModel.findById(sale._id).lean();
    const firstLine = savedSale?.items[0];

    expect(refreshedVariant?.stockQty).toBe(5);
    expect(Number(firstLine?.avgCostSnapshot?.toString())).toBe(125);
    expect(Number(firstLine?.sellingPriceSnapshot?.toString())).toBe(180);
    expect(Number(firstLine?.profitPerUnitSnapshot?.toString())).toBe(55);
    expect(Number(savedSale?.grandTotal?.toString())).toBe(540);
  });

  it("blocks sale when requested quantity exceeds stock", async () => {
    const [
      { createSale },
      { default: ProductModel },
      { default: VariantModel },
      { default: UserModel },
    ] = await Promise.all([
      import("../../lib/services/sales"),
      import("../../models/Product"),
      import("../../models/Variant"),
      import("../../models/User"),
    ]);

    const salesman = await UserModel.create({
      name: "Salesman One",
      email: "salesman@example.com",
      passwordHash: "hashed-password",
      role: "salesman",
      authProvider: "credentials",
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
      stockQty: 1,
      avgCost: "125",
      sellingPrice: "180",
      lowStockThreshold: 2,
      isActive: true,
    });

    await expect(
      createSale({
        soldBy: salesman._id.toString(),
        paymentMethod: "cash",
        saleDate: new Date("2026-04-17T00:00:00.000Z"),
        items: [
          {
            variantId: variant._id.toString(),
            qty: 3,
          },
        ],
      }),
    ).rejects.toThrow("sold quantity exceeds stock");
  });
});
