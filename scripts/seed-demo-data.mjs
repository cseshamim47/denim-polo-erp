import bcrypt from "bcryptjs";
import mongoose from "mongoose";

const required = {
  MONGODB_URI: process.env.MONGODB_URI,
  SALESMAN_EMAIL: process.env.SALESMAN_EMAIL,
  SALESMAN_PASSWORD: process.env.SALESMAN_PASSWORD,
};

const missing = Object.entries(required)
  .filter(([, value]) => !value)
  .map(([key]) => key);

if (missing.length > 0) {
  console.error(`Missing env: ${missing.join(", ")}`);
  process.exit(1);
}

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: { type: String, default: null },
    image: { type: String, default: null },
    role: { type: String, enum: ["partner", "salesman"], required: true },
    authProvider: {
      type: String,
      enum: ["google", "credentials"],
      required: true,
    },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    category: { type: String, required: true, trim: true, uppercase: true },
    description: { type: String, default: null },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

const variantSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      index: true,
    },
    color: { type: String, required: true, trim: true, uppercase: true },
    size: { type: String, required: true, trim: true, uppercase: true },
    sku: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
    },
    barcode: { type: String, default: null },
    stockQty: { type: Number, required: true, min: 0, default: 0, index: true },
    avgCost: { type: mongoose.Schema.Types.Decimal128, required: true },
    sellingPrice: { type: mongoose.Schema.Types.Decimal128, required: true },
    lowStockThreshold: { type: Number, required: true, min: 0, default: 0 },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true },
);

const purchaseApprovalSchema = new mongoose.Schema(
  {
    partnerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    decision: { type: String, enum: ["approved", "rejected"], required: true },
    decidedAt: { type: Date, required: true },
    comment: { type: String, default: null },
  },
  { _id: false },
);

const purchaseSchema = new mongoose.Schema(
  {
    variantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Variant",
      required: true,
    },
    qty: { type: Number, required: true, min: 1 },
    costPerUnit: { type: mongoose.Schema.Types.Decimal128, required: true },
    landedCostPerUnit: {
      type: mongoose.Schema.Types.Decimal128,
      required: true,
    },
    totalCost: { type: mongoose.Schema.Types.Decimal128, required: true },
    additionalCost: {
      type: mongoose.Schema.Types.Decimal128,
      required: true,
      default: () => mongoose.Types.Decimal128.fromString("0"),
    },
    cashOutTotal: { type: mongoose.Schema.Types.Decimal128, required: true },
    billImageUrl: { type: String, default: null },
    purchaseDate: { type: Date, required: true },
    note: { type: String, default: null },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      required: true,
      default: "pending",
    },
    approvals: {
      type: [purchaseApprovalSchema],
      default: [],
    },
    requiredApproverIdsSnapshot: [
      { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    ],
    requiredApprovalCountSnapshot: { type: Number, required: true, min: 1 },
  },
  { timestamps: true },
);

const saleLineSchema = new mongoose.Schema(
  {
    variantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Variant",
      required: true,
    },
    productSnapshot: { type: String, required: true, trim: true },
    skuSnapshot: { type: String, required: true, trim: true, uppercase: true },
    colorSnapshot: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    sizeSnapshot: { type: String, required: true, trim: true, uppercase: true },
    qty: { type: Number, required: true, min: 1 },
    sellingPriceSnapshot: {
      type: mongoose.Schema.Types.Decimal128,
      required: true,
    },
    avgCostSnapshot: { type: mongoose.Schema.Types.Decimal128, required: true },
    profitPerUnitSnapshot: {
      type: mongoose.Schema.Types.Decimal128,
      required: true,
    },
    lineSubtotal: { type: mongoose.Schema.Types.Decimal128, required: true },
    lineDiscount: { type: mongoose.Schema.Types.Decimal128, required: true },
    lineTotal: { type: mongoose.Schema.Types.Decimal128, required: true },
    returnedQty: { type: Number, required: true, min: 0, default: 0 },
    damagedQty: { type: Number, required: true, min: 0, default: 0 },
  },
  { _id: true },
);

const saleSchema = new mongoose.Schema(
  {
    saleNumber: { type: String, required: true, unique: true, trim: true },
    items: { type: [saleLineSchema], required: true },
    subtotal: { type: mongoose.Schema.Types.Decimal128, required: true },
    discountTotal: { type: mongoose.Schema.Types.Decimal128, required: true },
    grandTotal: { type: mongoose.Schema.Types.Decimal128, required: true },
    paymentMethod: { type: String, required: true, trim: true },
    soldBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    saleDate: { type: Date, required: true },
    status: {
      type: String,
      enum: ["completed", "voided"],
      required: true,
      default: "completed",
    },
    voidedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    voidedAt: { type: Date, default: null },
    voidReason: { type: String, default: null },
  },
  { timestamps: true },
);

const expenseApprovalSchema = new mongoose.Schema(
  {
    partnerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    decision: { type: String, enum: ["approved", "rejected"], required: true },
    decidedAt: { type: Date, required: true },
    comment: { type: String, default: null },
  },
  { _id: false },
);

const expenseSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    amount: { type: mongoose.Schema.Types.Decimal128, required: true },
    category: { type: String, required: true, trim: true },
    note: { type: String, default: null },
    submittedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    submittedAt: { type: Date, required: true },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      required: true,
    },
    approvals: { type: [expenseApprovalSchema], default: [] },
    requiredApproverIdsSnapshot: [
      { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    ],
    requiredApprovalCountSnapshot: { type: Number, required: true, min: 1 },
    expenseDate: { type: Date, required: true },
  },
  { timestamps: true },
);

const returnSchema = new mongoose.Schema(
  {
    saleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Sale",
      required: true,
    },
    saleLineId: { type: mongoose.Schema.Types.ObjectId, required: true },
    variantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Variant",
      required: true,
    },
    qty: { type: Number, required: true, min: 1 },
    returnType: {
      type: String,
      enum: ["customer_return", "damaged"],
      required: true,
    },
    lossAmount: { type: mongoose.Schema.Types.Decimal128, required: true },
    note: { type: String, default: null },
    processedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    returnDate: { type: Date, required: true },
  },
  { timestamps: true },
);

const investmentSchema = new mongoose.Schema(
  {
    partnerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    amount: { type: mongoose.Schema.Types.Decimal128, required: true },
    note: { type: String, default: null },
    submittedAt: { type: Date, required: true },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      required: true,
      default: "pending",
    },
    approvals: {
      type: [
        new mongoose.Schema(
          {
            partnerId: {
              type: mongoose.Schema.Types.ObjectId,
              ref: "User",
              required: true,
            },
            decision: {
              type: String,
              enum: ["approved", "rejected"],
              required: true,
            },
            decidedAt: { type: Date, required: true },
            comment: { type: String, default: null },
          },
          { _id: false },
        ),
      ],
      default: [],
    },
    requiredApproverIdsSnapshot: [
      { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    ],
    requiredApprovalCountSnapshot: { type: Number, required: true, min: 1 },
    investedAt: { type: Date, required: true },
  },
  { timestamps: true },
);

const User = mongoose.models.User || mongoose.model("User", userSchema);
const Product =
  mongoose.models.Product || mongoose.model("Product", productSchema);
const Variant =
  mongoose.models.Variant || mongoose.model("Variant", variantSchema);
const Purchase =
  mongoose.models.Purchase || mongoose.model("Purchase", purchaseSchema);
const Sale = mongoose.models.Sale || mongoose.model("Sale", saleSchema);
const Expense =
  mongoose.models.Expense || mongoose.model("Expense", expenseSchema);
const ReturnRecord =
  mongoose.models.Return || mongoose.model("Return", returnSchema);
const Investment =
  mongoose.models.Investment || mongoose.model("Investment", investmentSchema);

function toDecimal128(value) {
  return mongoose.Types.Decimal128.fromString(Number(value).toFixed(4));
}

function normalizeSkuPart(value) {
  return value.trim().replace(/\s+/g, "-").toUpperCase();
}

function generateSku(category, color, size) {
  return `DP-${normalizeSkuPart(category)}-${normalizeSkuPart(color)}-${normalizeSkuPart(size)}`;
}

function applyPurchase({ oldStock, oldAvgCost, purchaseQty, costPerUnit }) {
  const newStock = oldStock + purchaseQty;
  const newAvgCost =
    (oldStock * oldAvgCost + purchaseQty * costPerUnit) / newStock;

  return { newStock, newAvgCost: Number(newAvgCost.toFixed(2)) };
}

function buildSaleSnapshot({ stockQty, soldQty, sellingPrice, avgCost }) {
  if (soldQty > stockQty) {
    throw new Error("sold quantity exceeds stock");
  }

  return {
    remainingStock: stockQty - soldQty,
    profitPerItem: Number((sellingPrice - avgCost).toFixed(2)),
  };
}

const TARGET_SEED_COUNT = 1000;
const PRODUCT_CATEGORIES = ["JEANS", "POLO", "PANJABI", "SHIRT", "TEE"];
const PRODUCT_COLORS = ["BLK", "BLU", "WHT", "GRN", "CRM", "NVY", "RED"];
const PRODUCT_SIZES = ["S", "M", "L", "XL", "28", "30", "32", "34", "36", "40"];
const SALE_PAYMENT_METHODS = ["cash", "bkash", "card", "nagad"];
const EXPENSE_CATEGORIES = ["Rent", "Marketing", "Maintenance", "Utilities", "Logistics"];

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function derivePartnerSeeds() {
  const allowList = (process.env.PARTNER_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

  const fallback = [
    "partner1@denimpolo.local",
    "partner2@denimpolo.local",
    "partner3@denimpolo.local",
  ];

  const emails = allowList.length > 0 ? allowList : fallback;
  const names = ["Shamim", "Ovi", "Anik"];

  return emails.map((email, index) => ({
    name: names[index] ?? `Partner ${index + 1}`,
    email,
    role: "partner",
    authProvider: "google",
    isActive: true,
    passwordHash: null,
    image: null,
  }));
}

async function ensureUsers() {
  const passwordHash = await bcrypt.hash(required.SALESMAN_PASSWORD, 10);
  const partnerSeeds = derivePartnerSeeds();

  const partnerDocs = [];

  for (const partner of partnerSeeds) {
    const doc = await User.findOneAndUpdate(
      { email: partner.email },
      { $set: partner },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true },
    );
    partnerDocs.push(doc);
  }

  const salesman = await User.findOneAndUpdate(
    { email: required.SALESMAN_EMAIL.trim().toLowerCase() },
    {
      $set: {
        name: process.env.SALESMAN_NAME?.trim() || "Default Salesman",
        email: required.SALESMAN_EMAIL.trim().toLowerCase(),
        passwordHash,
        role: "salesman",
        authProvider: "credentials",
        isActive: true,
        image: null,
      },
    },
    { upsert: true, returnDocument: "after", setDefaultsOnInsert: true },
  );

  return { partners: partnerDocs, salesman };
}

async function resetDemoCollections() {
  await Promise.all([
    Investment.deleteMany({}),
    ReturnRecord.deleteMany({}),
    Expense.deleteMany({}),
    Sale.deleteMany({}),
    Purchase.deleteMany({}),
    Variant.deleteMany({}),
    Product.deleteMany({}),
  ]);
}

async function createCatalog() {
  const products = await Product.insertMany(
    Array.from({ length: TARGET_SEED_COUNT }, (_, index) => {
      const sequence = String(index + 1).padStart(4, "0");
      const category = PRODUCT_CATEGORIES[index % PRODUCT_CATEGORIES.length];

      return {
        name: `Demo ${category} Product ${sequence}`,
        category,
        description: `Auto-seeded random product ${sequence}`,
        isActive: true,
      };
    }),
  );

  const variants = await Variant.insertMany(
    products.map((product, index) => {
      const sequence = String(index + 1).padStart(4, "0");
      const color = PRODUCT_COLORS[index % PRODUCT_COLORS.length];
      const size = PRODUCT_SIZES[index % PRODUCT_SIZES.length];

      return {
        productId: product._id,
        color,
        size,
        sku: `DP-${product.category}-${sequence}`,
        barcode: null,
        stockQty: 0,
        avgCost: toDecimal128(0),
        sellingPrice: toDecimal128(randomInt(600, 1800)),
        lowStockThreshold: randomInt(2, 8),
        isActive: true,
      };
    }),
  );

  return { products, variants };
}

async function createPurchases({ variants, partners }) {
  requireDemoPartners(partners);

  const purchases = [];
  const variantUpdates = [];

  for (let index = 0; index < TARGET_SEED_COUNT; index += 1) {
    const submitter = partners[index % partners.length];
    const approvers = getOtherPartners(partners, submitter._id);
    const variant = variants[index % variants.length];
    const qty = randomInt(20, 70);
    const costPerUnit = randomInt(250, 1200);
    const purchaseDate = new Date(Date.UTC(2026, 0, 1 + index, 9, index % 59, 0));
    const totalCost = qty * costPerUnit;

    purchases.push({
      variantId: variant._id,
      qty,
      costPerUnit: toDecimal128(costPerUnit),
      landedCostPerUnit: toDecimal128(costPerUnit),
      totalCost: toDecimal128(totalCost),
      additionalCost: toDecimal128(0),
      cashOutTotal: toDecimal128(totalCost),
      billImageUrl: null,
      purchaseDate,
      note: `Seed purchase ${index + 1}`,
      createdBy: submitter._id,
      status: "approved",
      approvals: approvers.map((partner, approverIndex) => ({
        partnerId: partner._id,
        decision: "approved",
        decidedAt: new Date(purchaseDate.getTime() + (approverIndex + 1) * 3600000),
        comment: approverIndex === 0 ? "Stock received and checked" : "Approved",
      })),
      requiredApproverIdsSnapshot: approvers.map((partner) => partner._id),
      requiredApprovalCountSnapshot: approvers.length,
    });

    variantUpdates.push({
      updateOne: {
        filter: { _id: variant._id },
        update: {
          $set: {
            stockQty: qty,
            avgCost: toDecimal128(costPerUnit),
          },
        },
      },
    });
  }

  await Variant.bulkWrite(variantUpdates);
  await Purchase.insertMany(purchases);
}

async function createSales({ variants, productsById, salesman }) {
  const sales = [];
  const variantUpdates = [];

  for (let index = 0; index < TARGET_SEED_COUNT; index += 1) {
    const saleNumber = `SALE-DEMO-${String(index + 1).padStart(4, "0")}`;
    const saleDate = new Date(Date.UTC(2026, 1, 1 + index, 13, index % 59, 0));
    const paymentMethod = SALE_PAYMENT_METHODS[index % SALE_PAYMENT_METHODS.length];
    const variant = variants[index % variants.length];
    const sellingPrice = Number(variant.sellingPrice.toString());
    const avgCost = Number(variant.avgCost.toString());
    const stockQty = randomInt(20, 70);
    const soldQty = randomInt(1, 5);
    const snapshot = buildSaleSnapshot({
      stockQty,
      soldQty,
      sellingPrice,
      avgCost,
    });
    const lineSubtotal = Number((sellingPrice * soldQty).toFixed(2));

    variantUpdates.push({
      updateOne: {
        filter: { _id: variant._id },
        update: { $set: { stockQty: snapshot.remainingStock } },
      },
    });

    sales.push({
      saleNumber,
      items: [
        {
          variantId: variant._id,
          productSnapshot: productsById.get(variant.productId.toString()).name,
          skuSnapshot: variant.sku,
          colorSnapshot: variant.color,
          sizeSnapshot: variant.size,
          qty: soldQty,
          sellingPriceSnapshot: toDecimal128(sellingPrice),
          avgCostSnapshot: toDecimal128(avgCost),
          profitPerUnitSnapshot: toDecimal128(snapshot.profitPerItem),
          lineSubtotal: toDecimal128(lineSubtotal),
          lineDiscount: toDecimal128(0),
          lineTotal: toDecimal128(lineSubtotal),
          returnedQty: 0,
          damagedQty: 0,
        },
      ],
      subtotal: toDecimal128(lineSubtotal),
      discountTotal: toDecimal128(0),
      grandTotal: toDecimal128(lineSubtotal),
      paymentMethod,
      soldBy: salesman._id,
      saleDate,
      status: "completed",
    });
  }

  await Variant.bulkWrite(variantUpdates);
  return Sale.insertMany(sales);
}

async function createReturns({ sales, partner }) {
  const customerReturnSale = sales[0];
  const customerReturnLine = customerReturnSale.items[0];
  const customerReturnVariant = await Variant.findById(
    customerReturnLine.variantId,
  );
  customerReturnVariant.stockQty += 1;
  await customerReturnVariant.save();
  customerReturnLine.returnedQty += 1;
  await customerReturnSale.save();

  await ReturnRecord.create({
    saleId: customerReturnSale._id,
    saleLineId: customerReturnLine._id,
    variantId: customerReturnLine.variantId,
    qty: 1,
    returnType: "customer_return",
    lossAmount: toDecimal128(0),
    note: "Size mismatch after delivery",
    processedBy: partner._id,
    returnDate: new Date("2026-04-16T11:00:00.000Z"),
  });

  const damagedReturnSale = sales[1];
  const damagedReturnLine = damagedReturnSale.items[0];
  damagedReturnLine.damagedQty += 1;
  await damagedReturnSale.save();

  await ReturnRecord.create({
    saleId: damagedReturnSale._id,
    saleLineId: damagedReturnLine._id,
    variantId: damagedReturnLine.variantId,
    qty: 1,
    returnType: "damaged",
    lossAmount: toDecimal128(
      Number(damagedReturnLine.avgCostSnapshot.toString()),
    ),
    note: "Fabric torn after delivery",
    processedBy: partner._id,
    returnDate: new Date("2026-04-17T14:00:00.000Z"),
  });
}

function requireDemoPartners(partners) {
  if (partners.length < 2) {
    throw new Error(
      "seed:demo requires at least 2 partner emails in PARTNER_EMAILS",
    );
  }
}

function getOtherPartners(partners, partnerId) {
  return partners.filter((partner) => partner._id.toString() !== partnerId.toString());
}

async function createExpenses({ partners }) {
  requireDemoPartners(partners);

  const expenses = Array.from({ length: TARGET_SEED_COUNT }, (_, index) => {
    const submitter = partners[index % partners.length];
    const approvers = getOtherPartners(partners, submitter._id);
    const status = index % 6 === 0 ? "pending" : index % 9 === 0 ? "rejected" : "approved";
    const submittedAt = new Date(Date.UTC(2026, 2, 1 + index, 10, index % 59, 0));
    const decisionTime = new Date(submittedAt.getTime() + 3600000);
    let approvals = [];

    if (status === "approved") {
      approvals = approvers.map((partner, approverIndex) => ({
        partnerId: partner._id,
        decision: "approved",
        decidedAt: new Date(decisionTime.getTime() + approverIndex * 1800000),
        comment: "Approved",
      }));
    } else if (status === "pending") {
      approvals = approvers.slice(0, 1).map((partner) => ({
        partnerId: partner._id,
        decision: "approved",
        decidedAt: decisionTime,
        comment: "Waiting for final approval",
      }));
    } else {
      approvals = approvers.slice(0, 1).map((partner) => ({
        partnerId: partner._id,
        decision: "rejected",
        decidedAt: decisionTime,
        comment: "Rejected for incomplete details",
      }));
    }

    return {
      title: `Seed expense ${index + 1}`,
      amount: toDecimal128(randomInt(500, 25000)),
      category: EXPENSE_CATEGORIES[index % EXPENSE_CATEGORIES.length],
      note: `Auto-seeded ${status} expense entry`,
      submittedBy: submitter._id,
      submittedAt,
      status,
      approvals,
      requiredApproverIdsSnapshot: approvers.map((partner) => partner._id),
      requiredApprovalCountSnapshot: approvers.length,
      expenseDate: submittedAt,
    };
  });

  await Expense.insertMany(expenses);
}

async function createInvestments({ partners }) {
  requireDemoPartners(partners);

  const investments = Array.from({ length: TARGET_SEED_COUNT }, (_, index) => {
    const partner = partners[index % partners.length];
    const approvers = getOtherPartners(partners, partner._id);
    const status = index % 7 === 0 ? "pending" : index % 11 === 0 ? "rejected" : "approved";
    const submittedAt = new Date(Date.UTC(2026, 1, 1 + index, 8, index % 59, 0));
    const decisionTime = new Date(submittedAt.getTime() + 3600000);
    let approvals = [];

    if (status === "approved") {
      approvals = approvers.map((approver, approverIndex) => ({
        partnerId: approver._id,
        decision: "approved",
        decidedAt: new Date(decisionTime.getTime() + approverIndex * 1800000),
        comment: "Approved",
      }));
    } else if (status === "pending") {
      approvals = approvers.slice(0, 1).map((approver) => ({
        partnerId: approver._id,
        decision: "approved",
        decidedAt: decisionTime,
        comment: "Waiting for remaining approvals",
      }));
    } else {
      approvals = approvers.slice(0, 1).map((approver) => ({
        partnerId: approver._id,
        decision: "rejected",
        decidedAt: decisionTime,
        comment: "Rejected during review",
      }));
    }

    return {
      partnerId: partner._id,
      amount: toDecimal128(randomInt(5000, 250000)),
      note: `Seed investment ${index + 1}`,
      submittedAt,
      status,
      approvals,
      requiredApproverIdsSnapshot: approvers.map((approver) => approver._id),
      requiredApprovalCountSnapshot: approvers.length,
      investedAt: submittedAt,
    };
  });

  await Investment.insertMany(investments);
}

async function main() {
  await mongoose.connect(required.MONGODB_URI, { bufferCommands: false });

  const { partners, salesman } = await ensureUsers();
  await resetDemoCollections();

  const { products, variants } = await createCatalog();
  const productsById = new Map(
    products.map((product) => [product._id.toString(), product]),
  );

  await createPurchases({ variants, partners });
  const sales = await createSales({ variants, productsById, salesman });
  await createReturns({ sales, partner: partners[0] });
  await createExpenses({ partners });
  await createInvestments({ partners });

  console.log("Demo data ready.");
  console.log(
    `Partners: ${partners.map((partner) => partner.email).join(", ")}`,
  );
  console.log(`Salesman: ${salesman.email}`);
  console.log(
    "Features covered: products, variants, purchases, sales, returns, expenses, investments, dashboard trends.",
  );
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });

