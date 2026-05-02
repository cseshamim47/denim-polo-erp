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
  const products = await Product.insertMany([
    {
      name: "Heritage Denim Jeans",
      category: "JEANS",
      description: "Daily best-seller with stretch denim fit.",
      isActive: true,
    },
    {
      name: "Classic Polo Shirt",
      category: "POLO",
      description: "Core polo line for shop walk-in customers.",
      isActive: true,
    },
    {
      name: "Festive Panjabi",
      category: "PANJABI",
      description: "Seasonal premium panjabi collection.",
      isActive: true,
    },
  ]);

  const [jeans, polo, panjabi] = products;

  const variants = await Variant.insertMany([
    {
      productId: jeans._id,
      color: "BLK",
      size: "32",
      sku: generateSku(jeans.category, "BLK", "32"),
      barcode: null,
      stockQty: 0,
      avgCost: toDecimal128(0),
      sellingPrice: toDecimal128(950),
      lowStockThreshold: 3,
      isActive: true,
    },
    {
      productId: jeans._id,
      color: "BLU",
      size: "34",
      sku: generateSku(jeans.category, "BLU", "34"),
      barcode: null,
      stockQty: 0,
      avgCost: toDecimal128(0),
      sellingPrice: toDecimal128(990),
      lowStockThreshold: 4,
      isActive: true,
    },
    {
      productId: polo._id,
      color: "WHT",
      size: "M",
      sku: generateSku(polo.category, "WHT", "M"),
      barcode: null,
      stockQty: 0,
      avgCost: toDecimal128(0),
      sellingPrice: toDecimal128(650),
      lowStockThreshold: 5,
      isActive: true,
    },
    {
      productId: polo._id,
      color: "GRN",
      size: "L",
      sku: generateSku(polo.category, "GRN", "L"),
      barcode: null,
      stockQty: 0,
      avgCost: toDecimal128(0),
      sellingPrice: toDecimal128(690),
      lowStockThreshold: 2,
      isActive: true,
    },
    {
      productId: panjabi._id,
      color: "CRM",
      size: "42",
      sku: generateSku(panjabi.category, "CRM", "42"),
      barcode: null,
      stockQty: 0,
      avgCost: toDecimal128(0),
      sellingPrice: toDecimal128(1450),
      lowStockThreshold: 2,
      isActive: true,
    },
  ]);

  return { products, variants };
}

async function createPurchases({ variants, partners }) {
  requireDemoPartners(partners);

  const submitter = partners[0];
  const approvers = getOtherPartners(partners, submitter._id);
  const purchasePlan = [
    {
      variant: variants[0],
      qty: 18,
      costPerUnit: 540,
      purchaseDate: new Date("2026-04-01T09:30:00.000Z"),
      billImageUrl: "https://utfs.io/f/demo-jeans-black-bill.jpg",
      note: "Opening month denim replenishment",
    },
    {
      variant: variants[1],
      qty: 14,
      costPerUnit: 560,
      purchaseDate: new Date("2026-04-03T10:10:00.000Z"),
      billImageUrl: "https://utfs.io/f/demo-jeans-blue-bill.jpg",
      note: "Blue wash restock",
    },
    {
      variant: variants[2],
      qty: 24,
      costPerUnit: 340,
      purchaseDate: new Date("2026-04-04T11:00:00.000Z"),
      billImageUrl: "https://utfs.io/f/demo-polo-white-bill.jpg",
      note: "Summer polo batch",
    },
    {
      variant: variants[3],
      qty: 8,
      costPerUnit: 355,
      purchaseDate: new Date("2026-04-05T11:20:00.000Z"),
      billImageUrl: "https://utfs.io/f/demo-polo-green-bill.jpg",
      note: "Limited low-stock colorway",
    },
    {
      variant: variants[4],
      qty: 6,
      costPerUnit: 910,
      purchaseDate: new Date("2026-04-07T12:05:00.000Z"),
      billImageUrl: "https://utfs.io/f/demo-panjabi-cream-bill.jpg",
      note: "Festive season pickup",
    },
  ];

  for (const entry of purchasePlan) {
    const currentVariant = await Variant.findById(entry.variant._id);
    const avgCost = Number(currentVariant.avgCost.toString());
    const result = applyPurchase({
      oldStock: currentVariant.stockQty,
      oldAvgCost: avgCost,
      purchaseQty: entry.qty,
      costPerUnit: entry.costPerUnit,
    });

    currentVariant.stockQty = result.newStock;
    currentVariant.avgCost = toDecimal128(result.newAvgCost);
    await currentVariant.save();

    const totalCost = entry.qty * entry.costPerUnit;

    await Purchase.create({
      variantId: currentVariant._id,
      qty: entry.qty,
      costPerUnit: toDecimal128(entry.costPerUnit),
      landedCostPerUnit: toDecimal128(entry.costPerUnit),
      totalCost: toDecimal128(totalCost),
      additionalCost: toDecimal128(0),
      cashOutTotal: toDecimal128(totalCost),
      billImageUrl: entry.billImageUrl,
      purchaseDate: entry.purchaseDate,
      note: entry.note,
      createdBy: submitter._id,
      status: "approved",
      approvals: approvers.map((partner, index) => ({
        partnerId: partner._id,
        decision: "approved",
        decidedAt: new Date(entry.purchaseDate.getTime() + (index + 1) * 3600000),
        comment: index === 0 ? "Stock received and checked" : "Approved",
      })),
      requiredApproverIdsSnapshot: approvers.map((partner) => partner._id),
      requiredApprovalCountSnapshot: approvers.length,
    });
  }
}

async function createSales({ variants, productsById, salesman }) {
  const salePlans = [
    {
      saleNumber: "SALE-DEMO-001",
      saleDate: new Date("2026-04-10T12:00:00.000Z"),
      paymentMethod: "cash",
      items: [
        { variant: variants[0], qty: 2 },
        { variant: variants[2], qty: 3 },
      ],
    },
    {
      saleNumber: "SALE-DEMO-002",
      saleDate: new Date("2026-04-12T15:15:00.000Z"),
      paymentMethod: "bkash",
      items: [
        { variant: variants[1], qty: 1 },
        { variant: variants[3], qty: 2 },
      ],
    },
    {
      saleNumber: "SALE-DEMO-003",
      saleDate: new Date("2026-04-14T18:10:00.000Z"),
      paymentMethod: "cash",
      items: [
        { variant: variants[4], qty: 1 },
        { variant: variants[0], qty: 13 },
      ],
    },
  ];

  const sales = [];

  for (const plan of salePlans) {
    let subtotal = 0;
    const items = [];

    for (const line of plan.items) {
      const variant = await Variant.findById(line.variant._id);
      const sellingPrice = Number(variant.sellingPrice.toString());
      const avgCost = Number(variant.avgCost.toString());
      const snapshot = buildSaleSnapshot({
        stockQty: variant.stockQty,
        soldQty: line.qty,
        sellingPrice,
        avgCost,
      });
      const lineSubtotal = Number((sellingPrice * line.qty).toFixed(2));

      variant.stockQty = snapshot.remainingStock;
      await variant.save();

      subtotal += lineSubtotal;

      items.push({
        variantId: variant._id,
        productSnapshot: productsById.get(variant.productId.toString()).name,
        skuSnapshot: variant.sku,
        colorSnapshot: variant.color,
        sizeSnapshot: variant.size,
        qty: line.qty,
        sellingPriceSnapshot: toDecimal128(sellingPrice),
        avgCostSnapshot: toDecimal128(avgCost),
        profitPerUnitSnapshot: toDecimal128(snapshot.profitPerItem),
        lineSubtotal: toDecimal128(lineSubtotal),
        lineDiscount: toDecimal128(0),
        lineTotal: toDecimal128(lineSubtotal),
        returnedQty: 0,
        damagedQty: 0,
      });
    }

    const sale = await Sale.create({
      saleNumber: plan.saleNumber,
      items,
      subtotal: toDecimal128(subtotal),
      discountTotal: toDecimal128(0),
      grandTotal: toDecimal128(subtotal),
      paymentMethod: plan.paymentMethod,
      soldBy: salesman._id,
      saleDate: plan.saleDate,
      status: "completed",
    });
    sales.push(sale);
  }

  return sales;
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
  const damagedReturnLine = damagedReturnSale.items[1];
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

  const partnerOne = partners[0];
  const partnerTwo = partners[1];
  const partnerThree = partners[2] ?? partners[0];
  const partnerOneApprovers = getOtherPartners(partners, partnerOne._id);
  const partnerTwoApprovers = getOtherPartners(partners, partnerTwo._id);
  const partnerThreeApprovers = getOtherPartners(partners, partnerThree._id);

  await Expense.insertMany([
    {
      title: "Shop rent",
      amount: toDecimal128(12000),
      category: "Rent",
      note: "Monthly showroom rent",
      submittedBy: partnerOne._id,
      submittedAt: new Date("2026-04-05T09:00:00.000Z"),
      status: "approved",
      approvals: partnerOneApprovers.map((partner, index) => ({
        partnerId: partner._id,
        decision: "approved",
        decidedAt: new Date(`2026-04-05T1${index}:00:00.000Z`),
        comment: index === 0 ? "Looks correct" : "Approved",
      })),
      requiredApproverIdsSnapshot: partnerOneApprovers.map(
        (partner) => partner._id,
      ),
      requiredApprovalCountSnapshot: partnerOneApprovers.length,
      expenseDate: new Date("2026-04-05T09:00:00.000Z"),
    },
    {
      title: "Facebook boost",
      amount: toDecimal128(2500),
      category: "Marketing",
      note: "Eid campaign still waiting for final confirmation",
      submittedBy: partnerTwo._id,
      submittedAt: new Date("2026-04-18T09:20:00.000Z"),
      status: "pending",
      approvals: partnerTwoApprovers.slice(0, 1).map((partner) => ({
        partnerId: partner._id,
        decision: "approved",
        decidedAt: new Date("2026-04-18T10:10:00.000Z"),
        comment: "Try for three days",
      })),
      requiredApproverIdsSnapshot: partnerTwoApprovers.map(
        (partner) => partner._id,
      ),
      requiredApprovalCountSnapshot: partnerTwoApprovers.length,
      expenseDate: new Date("2026-04-18T09:20:00.000Z"),
    },
    {
      title: "Store repaint advance",
      amount: toDecimal128(4000),
      category: "Maintenance",
      note: "Rejected until after the festival rush",
      submittedBy: partnerThree._id,
      submittedAt: new Date("2026-04-09T13:00:00.000Z"),
      status: "rejected",
      approvals: partnerThreeApprovers.slice(0, 1).map((partner) => ({
        partnerId: partner._id,
        decision: "rejected",
        decidedAt: new Date("2026-04-09T14:00:00.000Z"),
        comment: "Defer until next month",
      })),
      requiredApproverIdsSnapshot: partnerThreeApprovers.map(
        (partner) => partner._id,
      ),
      requiredApprovalCountSnapshot: partnerThreeApprovers.length,
      expenseDate: new Date("2026-04-09T13:00:00.000Z"),
    },
  ]);
}

async function createInvestments({ partners }) {
  requireDemoPartners(partners);

  await Investment.insertMany([
    {
      partnerId: partners[0]._id,
      amount: toDecimal128(70000),
      note: "Initial capital injection",
      submittedAt: new Date("2026-04-01T08:00:00.000Z"),
      status: "approved",
      approvals: getOtherPartners(partners, partners[0]._id).map(
        (partner, index) => ({
          partnerId: partner._id,
          decision: "approved",
          decidedAt: new Date(`2026-04-01T09:${index}0:00.000Z`),
          comment: "Confirmed",
        }),
      ),
      requiredApproverIdsSnapshot: getOtherPartners(
        partners,
        partners[0]._id,
      ).map((partner) => partner._id),
      requiredApprovalCountSnapshot: getOtherPartners(
        partners,
        partners[0]._id,
      ).length,
      investedAt: new Date("2026-04-01T08:00:00.000Z"),
    },
    {
      partnerId: partners[1]._id,
      amount: toDecimal128(50000),
      note: "Inventory capital",
      submittedAt: new Date("2026-04-01T08:10:00.000Z"),
      status: "approved",
      approvals: getOtherPartners(partners, partners[1]._id).map(
        (partner, index) => ({
          partnerId: partner._id,
          decision: "approved",
          decidedAt: new Date(`2026-04-01T09:2${index}:00.000Z`),
          comment: index === 0 ? "Looks good" : "Approved",
        }),
      ),
      requiredApproverIdsSnapshot: getOtherPartners(
        partners,
        partners[1]._id,
      ).map((partner) => partner._id),
      requiredApprovalCountSnapshot: getOtherPartners(
        partners,
        partners[1]._id,
      ).length,
      investedAt: new Date("2026-04-01T08:10:00.000Z"),
    },
    {
      partnerId: partners[0]._id,
      amount: toDecimal128(12000),
      note: "Pending extra stock money for new arrivals.",
      submittedAt: new Date("2026-04-18T10:00:00.000Z"),
      status: "pending",
      approvals: getOtherPartners(partners, partners[0]._id)
        .slice(0, 1)
        .map((partner) => ({
          partnerId: partner._id,
          decision: "approved",
          decidedAt: new Date("2026-04-18T10:30:00.000Z"),
          comment: "Need one more partner confirmation",
        })),
      requiredApproverIdsSnapshot: getOtherPartners(
        partners,
        partners[0]._id,
      ).map((partner) => partner._id),
      requiredApprovalCountSnapshot: getOtherPartners(
        partners,
        partners[0]._id,
      ).length,
      investedAt: new Date("2026-04-18T10:00:00.000Z"),
    },
    {
      partnerId: partners[1]._id,
      amount: toDecimal128(9000),
      note: "Rejected because transfer proof missing.",
      submittedAt: new Date("2026-04-15T13:00:00.000Z"),
      status: "rejected",
      approvals: getOtherPartners(partners, partners[1]._id)
        .slice(0, 1)
        .map((partner) => ({
          partnerId: partner._id,
          decision: "rejected",
          decidedAt: new Date("2026-04-15T14:00:00.000Z"),
          comment: "Upload transfer note first",
        })),
      requiredApproverIdsSnapshot: getOtherPartners(
        partners,
        partners[1]._id,
      ).map((partner) => partner._id),
      requiredApprovalCountSnapshot: getOtherPartners(
        partners,
        partners[1]._id,
      ).length,
      investedAt: new Date("2026-04-15T13:00:00.000Z"),
    },
    ...(partners[2]
      ? [
          {
            partnerId: partners[2]._id,
            amount: toDecimal128(30000),
            note: "Working cash buffer",
            submittedAt: new Date("2026-04-01T08:20:00.000Z"),
            status: "approved",
            approvals: getOtherPartners(partners, partners[2]._id).map(
              (partner) => ({
                partnerId: partner._id,
                decision: "approved",
                decidedAt: new Date("2026-04-01T09:30:00.000Z"),
                comment: "Approved",
              }),
            ),
            requiredApproverIdsSnapshot: getOtherPartners(
              partners,
              partners[2]._id,
            ).map((partner) => partner._id),
            requiredApprovalCountSnapshot: getOtherPartners(
              partners,
              partners[2]._id,
            ).length,
            investedAt: new Date("2026-04-01T08:20:00.000Z"),
          },
        ]
      : []),
  ]);
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
