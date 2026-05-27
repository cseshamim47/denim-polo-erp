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
      soldByName: salesman.name,
      soldByRole: salesman.role,
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
        soldByName: salesman.name,
        soldByRole: salesman.role,
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

  it("creates perfume sale, deducts ml and bottle stock, and snapshots formula profit", async () => {
    const [
      { createSale },
      { default: ProductModel },
      { default: VariantModel },
      { default: SaleModel },
      { default: UserModel },
      { default: PerfumePricingRuleModel },
    ] = await Promise.all([
      import("../../lib/services/sales"),
      import("../../models/Product"),
      import("../../models/Variant"),
      import("../../models/Sale"),
      import("../../models/User"),
      import("../../models/PerfumePricingRule"),
    ]);

    const salesman = await UserModel.create({
      name: "Salesman One",
      email: "salesman@example.com",
      passwordHash: "hashed-password",
      role: "salesman",
      authProvider: "credentials",
      isActive: true,
    });

    const perfumeProduct = await ProductModel.create({
      name: "Dior Sauvage",
      category: "PERFUME",
      isActive: true,
    });
    const bottleProduct = await ProductModel.create({
      name: "Perfume Bottle",
      category: "PACKAGING",
      isActive: true,
    });

    const perfumeVariant = await VariantModel.create({
      productId: perfumeProduct._id,
      color: "",
      size: "100ML STOCK",
      sku: "PERFUME-SAUVAGE-100ML",
      inventoryMode: "volume",
      unitLabel: "ML",
      allowDecimalQty: false,
      stockQty: 100,
      avgCost: "5",
      sellingPrice: "0",
      lowStockThreshold: 10,
      isActive: true,
    });

    const bottleVariant = await VariantModel.create({
      productId: bottleProduct._id,
      color: "",
      size: "15ML",
      sku: "BOTTLE-15ML",
      inventoryMode: "packaging",
      unitLabel: "PCS",
      allowDecimalQty: false,
      stockQty: 8,
      avgCost: "12",
      sellingPrice: "100",
      lowStockThreshold: 2,
      isActive: true,
    });

    const pricingRule = await PerfumePricingRuleModel.create({
      perfumeVariantId: perfumeVariant._id,
      bottleVariantId: bottleVariant._id,
      fillMl: 15,
      bottleSellingPrice: "100",
      isActive: true,
    });

    const sale = await createSale({
      soldBy: salesman._id.toString(),
      soldByName: salesman.name,
      soldByRole: salesman.role,
      paymentMethod: "cash",
      saleDate: new Date("2026-05-25T00:00:00.000Z"),
      items: [
        {
          mode: "perfume",
          pricingRuleId: pricingRule._id.toString(),
          soldMl: 15,
        },
      ],
    });

    const refreshedPerfumeVariant = await VariantModel.findById(
      perfumeVariant._id,
    ).lean();
    const refreshedBottleVariant = await VariantModel.findById(
      bottleVariant._id,
    ).lean();
    const savedSale = await SaleModel.findById(sale._id).lean();
    const firstLine = savedSale?.items[0];

    expect(refreshedPerfumeVariant?.stockQty).toBe(85);
    expect(refreshedBottleVariant?.stockQty).toBe(7);
    expect(firstLine?.saleMode).toBe("perfume");
    expect(firstLine?.perfumeFillMl).toBe(15);
    expect(firstLine?.packagingSkuSnapshot).toBe("BOTTLE-15ML");
    expect(Number(firstLine?.liquidCostSnapshot?.toString())).toBe(75);
    expect(Number(firstLine?.packagingCostSnapshot?.toString())).toBe(12);
    expect(Number(firstLine?.packagingSellingPriceSnapshot?.toString())).toBe(
      100,
    );
    expect(Number(firstLine?.sellingPriceSnapshot?.toString())).toBe(250);
    expect(Number(firstLine?.profitPerUnitSnapshot?.toString())).toBe(163);
    expect(Number(savedSale?.grandTotal?.toString())).toBe(250);
  });

  it("creates custom perfume sale without preset rule using bottle variant add-on", async () => {
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

    const perfumeProduct = await ProductModel.create({
      name: "SRK",
      category: "PERFUME",
      isActive: true,
    });
    const bottleProduct = await ProductModel.create({
      name: "Perfume Bottle",
      category: "PACKAGING",
      isActive: true,
    });

    const perfumeVariant = await VariantModel.create({
      productId: perfumeProduct._id,
      color: "",
      size: "100ML STOCK",
      sku: "PERFUME-SRK-100ML",
      inventoryMode: "volume",
      unitLabel: "ML",
      allowDecimalQty: false,
      stockQty: 100,
      avgCost: "12",
      sellingPrice: "0",
      lowStockThreshold: 10,
      isActive: true,
    });

    const bottleVariant = await VariantModel.create({
      productId: bottleProduct._id,
      color: "",
      size: "5ML",
      sku: "BOTTLE-5ML",
      inventoryMode: "packaging",
      unitLabel: "PCS",
      allowDecimalQty: false,
      stockQty: 10,
      avgCost: "8",
      sellingPrice: "80",
      lowStockThreshold: 2,
      isActive: true,
    });

    const sale = await createSale({
      soldBy: salesman._id.toString(),
      soldByName: salesman.name,
      soldByRole: salesman.role,
      paymentMethod: "cash",
      saleDate: new Date("2026-05-27T00:00:00.000Z"),
      items: [
        {
          mode: "perfume",
          perfumeVariantId: perfumeVariant._id.toString(),
          bottleVariantId: bottleVariant._id.toString(),
          bottleSellingPrice: 80,
          soldMl: 5,
        },
      ],
    });

    const refreshedPerfumeVariant = await VariantModel.findById(
      perfumeVariant._id,
    ).lean();
    const refreshedBottleVariant = await VariantModel.findById(
      bottleVariant._id,
    ).lean();
    const savedSale = await SaleModel.findById(sale._id).lean();
    const firstLine = savedSale?.items[0];

    expect(refreshedPerfumeVariant?.stockQty).toBe(95);
    expect(refreshedBottleVariant?.stockQty).toBe(9);
    expect(firstLine?.saleMode).toBe("perfume");
    expect(firstLine?.perfumeFillMl).toBe(5);
    expect(firstLine?.packagingSkuSnapshot).toBe("BOTTLE-5ML");
    expect(Number(firstLine?.liquidCostSnapshot?.toString())).toBe(60);
    expect(Number(firstLine?.packagingCostSnapshot?.toString())).toBe(8);
    expect(Number(firstLine?.packagingSellingPriceSnapshot?.toString())).toBe(
      80,
    );
    expect(Number(firstLine?.sellingPriceSnapshot?.toString())).toBe(200);
    expect(Number(firstLine?.profitPerUnitSnapshot?.toString())).toBe(132);
    expect(Number(savedSale?.grandTotal?.toString())).toBe(200);
  });
});
