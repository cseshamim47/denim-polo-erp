import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import {
  clearTestDatabase,
  startTestDatabase,
  stopTestDatabase,
} from "../helpers/mongodb";

describe("return integration", () => {
  beforeAll(async () => {
    await startTestDatabase();
  });

  afterEach(async () => {
    await clearTestDatabase();
  });

  afterAll(async () => {
    await stopTestDatabase();
  });

  it("adds stock back for customer return and updates sale line counters", async () => {
    const [
      { createSale },
      { createReturn },
      { default: ProductModel },
      { default: ReturnModel },
      { default: SaleModel },
      { default: UserModel },
      { default: VariantModel },
    ] = await Promise.all([
      import("../../lib/services/sales"),
      import("../../lib/services/returns"),
      import("../../models/Product"),
      import("../../models/Return"),
      import("../../models/Sale"),
      import("../../models/User"),
      import("../../models/Variant"),
    ]);

    const [partner, salesman] = await UserModel.create([
      {
        name: "Partner One",
        email: "partner1@example.com",
        role: "partner",
        authProvider: "credentials",
        isActive: true,
      },
      {
        name: "Salesman One",
        email: "salesman@example.com",
        role: "salesman",
        authProvider: "credentials",
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
      stockQty: 8,
      avgCost: "125",
      sellingPrice: "180",
      lowStockThreshold: 2,
      isActive: true,
    });

    const sale = await createSale({
      soldBy: salesman._id.toString(),
      paymentMethod: "cash",
      saleDate: new Date("2026-04-19T00:00:00.000Z"),
      items: [{ variantId: variant._id.toString(), qty: 3 }],
    });

    const createdReturn = await createReturn({
      saleId: sale._id.toString(),
      saleLineId: sale.items[0]._id.toString(),
      qty: 1,
      returnType: "customer_return",
      processedBy: partner._id.toString(),
      returnDate: new Date("2026-04-19T00:00:00.000Z"),
    });

    const refreshedVariant = await VariantModel.findById(variant._id).lean();
    const refreshedSale = await SaleModel.findById(sale._id).lean();
    const savedReturn = await ReturnModel.findById(createdReturn._id).lean();

    expect(refreshedVariant?.stockQty).toBe(6);
    expect(refreshedSale?.items[0].returnedQty).toBe(1);
    expect(savedReturn?.returnType).toBe("customer_return");
    expect(Number(savedReturn?.lossAmount?.toString())).toBe(0);
  });

  it("keeps stock unchanged for damaged return and blocks over-return", async () => {
    const [
      { createSale },
      { createReturn },
      { default: ProductModel },
      { default: SaleModel },
      { default: UserModel },
      { default: VariantModel },
    ] = await Promise.all([
      import("../../lib/services/sales"),
      import("../../lib/services/returns"),
      import("../../models/Product"),
      import("../../models/Sale"),
      import("../../models/User"),
      import("../../models/Variant"),
    ]);

    const [partner, salesman] = await UserModel.create([
      {
        name: "Partner One",
        email: "partner1@example.com",
        role: "partner",
        authProvider: "credentials",
        isActive: true,
      },
      {
        name: "Salesman One",
        email: "salesman@example.com",
        role: "salesman",
        authProvider: "credentials",
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
      stockQty: 6,
      avgCost: "125",
      sellingPrice: "180",
      lowStockThreshold: 2,
      isActive: true,
    });

    const sale = await createSale({
      soldBy: salesman._id.toString(),
      paymentMethod: "cash",
      saleDate: new Date("2026-04-19T00:00:00.000Z"),
      items: [{ variantId: variant._id.toString(), qty: 2 }],
    });

    const damagedReturn = await createReturn({
      saleId: sale._id.toString(),
      saleLineId: sale.items[0]._id.toString(),
      qty: 1,
      returnType: "damaged",
      processedBy: partner._id.toString(),
      returnDate: new Date("2026-04-19T00:00:00.000Z"),
    });

    const refreshedVariant = await VariantModel.findById(variant._id).lean();
    const refreshedSale = await SaleModel.findById(sale._id).lean();

    expect(refreshedVariant?.stockQty).toBe(4);
    expect(refreshedSale?.items[0].damagedQty).toBe(1);
    expect(Number(damagedReturn.lossAmount.toString())).toBe(125);

    await expect(
      createReturn({
        saleId: sale._id.toString(),
        saleLineId: sale.items[0]._id.toString(),
        qty: 2,
        returnType: "customer_return",
        processedBy: partner._id.toString(),
        returnDate: new Date("2026-04-19T00:00:00.000Z"),
      }),
    ).rejects.toThrow("return quantity exceeds remaining sold quantity");
  });
});
