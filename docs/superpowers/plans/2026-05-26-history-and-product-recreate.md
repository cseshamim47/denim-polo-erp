# History And Product Recreate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow recreating a soft-deleted product with the same active `name + category`, and add a partner-only `/history` audit trail for all future database-changing actions.

**Architecture:** Keep product data soft-deleted and preserved by moving product uniqueness to an active-only constraint. Add a new `HistoryEvent` audit collection plus a shared history service, then call that service from each existing write path so `/history` can render one consistent stream of business actions with safe before/after snapshots.

**Tech Stack:** Next.js App Router, TypeScript, Mongoose, NextAuth session helpers, Vitest, Tailwind/shadcn UI.

---

### Task 1: Product Recreate And Index Safety

**Files:**
- Modify: `D:\Others\w\dpe\models\Product.ts`
- Modify: `D:\Others\w\dpe\app\api\products\route.ts`
- Create: `D:\Others\w\dpe\lib\services\product-indexes.ts`
- Test: `D:\Others\w\dpe\tests\unit\product-indexes.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it, vi } from "vitest";

describe("ensureProductActiveUniqueIndex", () => {
  it("drops the legacy hard unique index and recreates an active-only one", async () => {
    const dropIndex = vi.fn().mockResolvedValue(undefined);
    const createIndex = vi.fn().mockResolvedValue("category_1_name_1");

    vi.doMock("@/models/Product", () => ({
      default: {
        collection: { dropIndex, createIndex },
      },
    }));

    const { ensureProductActiveUniqueIndex } = await import("@/lib/services/product-indexes");

    await ensureProductActiveUniqueIndex();

    expect(dropIndex).toHaveBeenCalledWith("category_1_name_1");
    expect(createIndex).toHaveBeenCalledWith(
      { category: 1, name: 1 },
      {
        unique: true,
        partialFilterExpression: { isActive: true },
        name: "category_1_name_1",
      },
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/unit/product-indexes.test.ts`
Expected: FAIL because `ensureProductActiveUniqueIndex` does not exist yet.

- [ ] **Step 3: Write minimal implementation**

```ts
import ProductModel from "@/models/Product";

let hasEnsuredProductIndex = false;

export async function ensureProductActiveUniqueIndex() {
  if (hasEnsuredProductIndex) {
    return;
  }

  try {
    await ProductModel.collection.dropIndex("category_1_name_1");
  } catch (error) {
    if (
      !(error instanceof Error) ||
      !/index not found/i.test(error.message)
    ) {
      throw error;
    }
  }

  await ProductModel.collection.createIndex(
    { category: 1, name: 1 },
    {
      unique: true,
      partialFilterExpression: { isActive: true },
      name: "category_1_name_1",
    },
  );

  hasEnsuredProductIndex = true;
}
```

In `models/Product.ts`, change:

```ts
productSchema.index({ category: 1, name: 1 }, { unique: true });
```

to:

```ts
productSchema.index(
  { category: 1, name: 1 },
  {
    unique: true,
    partialFilterExpression: { isActive: true },
  },
);
```

Call `await ensureProductActiveUniqueIndex();` in `app/api/products/route.ts` before product creation.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/unit/product-indexes.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tests/unit/product-indexes.test.ts lib/services/product-indexes.ts models/Product.ts app/api/products/route.ts
git commit -m "fix(products): allow recreating deleted names"
```

### Task 2: History Event Model And Shared Logger

**Files:**
- Create: `D:\Others\w\dpe\models\HistoryEvent.ts`
- Create: `D:\Others\w\dpe\lib\services/history.ts`
- Create: `D:\Others\w\dpe\lib\domain/history.ts`
- Test: `D:\Others\w\dpe\tests\unit\history.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";

import { pickChangedFields } from "@/lib/domain/history";

describe("pickChangedFields", () => {
  it("returns only changed fields for before and after snapshots", () => {
    const result = pickChangedFields(
      { title: "Old", amount: 100, status: "pending" },
      { title: "Old", amount: 120, status: "approved" },
    );

    expect(result).toEqual({
      before: { amount: 100, status: "pending" },
      after: { amount: 120, status: "approved" },
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/unit/history.test.ts`
Expected: FAIL because history helpers do not exist yet.

- [ ] **Step 3: Write minimal implementation**

`models/HistoryEvent.ts`

```ts
import { model, models, Schema } from "mongoose";

const historyEventSchema = new Schema(
  {
    actorId: { type: String, required: true, index: true },
    actorName: { type: String, required: true },
    actorRole: { type: String, required: true },
    module: { type: String, required: true, index: true },
    entityType: { type: String, required: true, index: true },
    entityId: { type: String, required: true, index: true },
    entityLabel: { type: String, required: true },
    action: { type: String, required: true, index: true },
    summary: { type: String, required: true },
    before: { type: Schema.Types.Mixed, default: null },
    after: { type: Schema.Types.Mixed, default: null },
    meta: { type: Schema.Types.Mixed, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

historyEventSchema.index({ createdAt: -1 });

const HistoryEventModel =
  models.HistoryEvent || model("HistoryEvent", historyEventSchema);

export default HistoryEventModel;
```

`lib/domain/history.ts`

```ts
export function pickChangedFields(
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null,
) {
  const keys = new Set([
    ...Object.keys(before ?? {}),
    ...Object.keys(after ?? {}),
  ]);

  const changedBefore: Record<string, unknown> = {};
  const changedAfter: Record<string, unknown> = {};

  for (const key of keys) {
    const left = before?.[key];
    const right = after?.[key];

    if (JSON.stringify(left) === JSON.stringify(right)) {
      continue;
    }

    if (left !== undefined) changedBefore[key] = left;
    if (right !== undefined) changedAfter[key] = right;
  }

  return {
    before: Object.keys(changedBefore).length > 0 ? changedBefore : null,
    after: Object.keys(changedAfter).length > 0 ? changedAfter : null,
  };
}
```

`lib/services/history.ts`

```ts
import { connectToDatabase } from "@/lib/db";
import HistoryEventModel from "@/models/HistoryEvent";

export async function recordHistoryEvent(input: {
  actorId: string;
  actorName: string;
  actorRole: string;
  module: string;
  entityType: string;
  entityId: string;
  entityLabel: string;
  action: string;
  summary: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  meta?: Record<string, unknown> | null;
}) {
  await connectToDatabase();

  await HistoryEventModel.create({
    ...input,
    before: input.before ?? null,
    after: input.after ?? null,
    meta: input.meta ?? null,
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/unit/history.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tests/unit/history.test.ts models/HistoryEvent.ts lib/domain/history.ts lib/services/history.ts
git commit -m "feat(history): add audit event foundation"
```

### Task 3: History API And Partner-Only History Page

**Files:**
- Create: `D:\Others\w\dpe\app\api\history\route.ts`
- Create: `D:\Others\w\dpe\app\(dashboard)\history\page.tsx`
- Create: `D:\Others\w\dpe\app\(dashboard)\history\history-types.ts`
- Create: `D:\Others\w\dpe\app\(dashboard)\history\_components\history-filters.tsx`
- Create: `D:\Others\w\dpe\app\(dashboard)\history\_components\history-list.tsx`
- Create: `D:\Others\w\dpe\app\(dashboard)\history\_components\history-summary.tsx`
- Modify: `D:\Others\w\dpe\app\(dashboard)\layout.tsx`
- Modify: `D:\Others\w\dpe\proxy.ts`
- Modify: `D:\Others\w\dpe\lib/services/history.ts`
- Test: `D:\Others\w\dpe\tests\unit\history-routes.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.resetModules();
  vi.restoreAllMocks();
});

describe("history route", () => {
  it("loads partner-only history with filters", async () => {
    vi.doMock("@/lib/auth", () => ({
      getRequiredSession: vi.fn().mockResolvedValue({
        user: { id: "partner-1", name: "Partner One", role: "partner" },
      }),
    }));
    const listHistoryEvents = vi.fn().mockResolvedValue({
      items: [],
      pagination: { total: 0, page: 1, pageSize: 20, totalPages: 1 },
      actors: [],
    });
    vi.doMock("@/lib/services/history", () => ({ listHistoryEvents }));

    const { GET } = await import("../../app/api/history/route");
    const response = await GET(
      new Request("http://localhost:3000/api/history?module=products&action=create"),
    );

    expect(response.status).toBe(200);
    expect(listHistoryEvents).toHaveBeenCalledWith({
      actorId: "partner-1",
      module: "products",
      action: "create",
      actor: null,
      search: null,
      from: null,
      to: null,
      page: 1,
      pageSize: 20,
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/unit/history-routes.test.ts`
Expected: FAIL because route/listing code does not exist yet.

- [ ] **Step 3: Write minimal implementation**

Extend `lib/services/history.ts` with:

```ts
export async function listHistoryEvents(input: {
  actorId: string;
  module: string | null;
  action: string | null;
  actor: string | null;
  search: string | null;
  from: string | null;
  to: string | null;
  page: number;
  pageSize: number;
}) {
  // Build query, sort newest first, return pagination + actor options
}
```

Add `app/api/history/route.ts` that requires `partner` session and maps URL filters to `listHistoryEvents`.

Build mobile-first `/history` page with:
- summary counts
- filters
- list/table
- expandable before/after snapshots

Update dashboard nav and proxy route access for `/history`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/unit/history-routes.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/api/history/route.ts app/(dashboard)/history app/(dashboard)/layout.tsx proxy.ts lib/services/history.ts tests/unit/history-routes.test.ts
git commit -m "feat(history): add partner audit page"
```

### Task 4: Product And Variant History Coverage

**Files:**
- Modify: `D:\Others\w\dpe\app\api\products\route.ts`
- Modify: `D:\Others\w\dpe\app\api\variants\route.ts`
- Test: `D:\Others\w\dpe\tests\unit\product-history.test.ts`
- Test: `D:\Others\w\dpe\tests\unit\variant-history.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
it("records product creation history", async () => {
  const recordHistoryEvent = vi.fn().mockResolvedValue(undefined);
  vi.doMock("@/lib/services/history", () => ({ recordHistoryEvent }));
  // mock auth/db/model create
  // call POST /api/products
  expect(recordHistoryEvent).toHaveBeenCalledWith(
    expect.objectContaining({
      module: "products",
      action: "create",
      summary: expect.stringContaining("Product created"),
    }),
  );
});
```

```ts
it("records variant update approval history with changed selling price", async () => {
  const recordHistoryEvent = vi.fn().mockResolvedValue(undefined);
  vi.doMock("@/lib/services/history", () => ({ recordHistoryEvent }));
  // mock variant pending approval flow
  expect(recordHistoryEvent).toHaveBeenCalledWith(
    expect.objectContaining({
      module: "variants",
      action: "approve_update",
      before: { sellingPrice: 450 },
      after: { sellingPrice: 500 },
    }),
  );
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:
- `npm test -- tests/unit/product-history.test.ts`
- `npm test -- tests/unit/variant-history.test.ts`

Expected: FAIL because history hooks are missing.

- [ ] **Step 3: Write minimal implementation**

In products route, add `recordHistoryEvent()` for:
- create
- delete request submitted
- delete approved
- delete rejected

In variants route, add `recordHistoryEvent()` for:
- create
- delete request submitted
- delete approved
- delete rejected
- update request submitted
- update approved
- update rejected

Use concise `before`/`after` snapshots only for changed fields.

- [ ] **Step 4: Run tests to verify they pass**

Run:
- `npm test -- tests/unit/product-history.test.ts`
- `npm test -- tests/unit/variant-history.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/api/products/route.ts app/api/variants/route.ts tests/unit/product-history.test.ts tests/unit/variant-history.test.ts
git commit -m "feat(history): audit product and variant actions"
```

### Task 5: Financial Module History Coverage

**Files:**
- Modify: `D:\Others\w\dpe\lib\services\purchases.ts`
- Modify: `D:\Others\w\dpe\lib\services\expenses.ts`
- Modify: `D:\Others\w\dpe\lib\services\investments.ts`
- Modify: `D:\Others\w\dpe\lib\services\assets.ts`
- Test: `D:\Others\w\dpe\tests\unit\purchase-history.test.ts`
- Test: `D:\Others\w\dpe\tests\unit\expense-history-recording.test.ts`
- Test: `D:\Others\w\dpe\tests\unit\investment-history-recording.test.ts`
- Test: `D:\Others\w\dpe\tests\unit\asset-history-recording.test.ts`

- [ ] **Step 1: Write failing tests**

For each module, write one create test and one review test pattern like:

```ts
expect(recordHistoryEvent).toHaveBeenCalledWith(
  expect.objectContaining({
    module: "expenses",
    action: "create",
    summary: expect.stringContaining("Expense created"),
  }),
);
```

```ts
expect(recordHistoryEvent).toHaveBeenCalledWith(
  expect.objectContaining({
    module: "investments",
    action: "approve",
    after: expect.objectContaining({ status: "approved" }),
  }),
);
```

- [ ] **Step 2: Run tests to verify they fail**

Run:
- `npm test -- tests/unit/purchase-history.test.ts`
- `npm test -- tests/unit/expense-history-recording.test.ts`
- `npm test -- tests/unit/investment-history-recording.test.ts`
- `npm test -- tests/unit/asset-history-recording.test.ts`

Expected: FAIL.

- [ ] **Step 3: Write minimal implementation**

Add `recordHistoryEvent()` inside service functions:
- `createPurchase`, `reviewPurchases`
- `createExpense`, `reviewExpenses`
- `createInvestment`, `reviewInvestments`
- `createAsset`, `reviewAssets`

Use business summaries and snapshots around:
- amount
- owner/requester
- status changes
- effective dates

- [ ] **Step 4: Run tests to verify they pass**

Run the same four test commands.
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/services/purchases.ts lib/services/expenses.ts lib/services/investments.ts lib/services/assets.ts tests/unit/purchase-history.test.ts tests/unit/expense-history-recording.test.ts tests/unit/investment-history-recording.test.ts tests/unit/asset-history-recording.test.ts
git commit -m "feat(history): audit financial workflows"
```

### Task 6: Sales, Returns, Perfume Pricing, And Settings History Coverage

**Files:**
- Modify: `D:\Others\w\dpe\lib\services\sales.ts`
- Modify: `D:\Others\w\dpe\lib\services\returns.ts`
- Modify: `D:\Others\w\dpe\lib\services\perfume-pricing.ts`
- Modify: `D:\Others\w\dpe\lib\services\user-settings.ts`
- Modify: `D:\Others\w\dpe\app\api\settings\profile\route.ts`
- Modify: `D:\Others\w\dpe\app\api\settings\password\route.ts`
- Test: `D:\Others\w\dpe\tests\unit\sales-history.test.ts`
- Test: `D:\Others\w\dpe\tests\unit\returns-history.test.ts`
- Test: `D:\Others\w\dpe\tests\unit\perfume-history.test.ts`
- Test: `D:\Others\w\dpe\tests\unit\user-settings-history.test.ts`

- [ ] **Step 1: Write failing tests**

Examples:

```ts
expect(recordHistoryEvent).toHaveBeenCalledWith(
  expect.objectContaining({
    module: "sales",
    action: "create",
    summary: expect.stringContaining("Sale created"),
  }),
);
```

```ts
expect(recordHistoryEvent).toHaveBeenCalledWith(
  expect.objectContaining({
    module: "settings",
    action: "change_password",
    before: null,
    after: { passwordChanged: true },
  }),
);
```

- [ ] **Step 2: Run tests to verify they fail**

Run:
- `npm test -- tests/unit/sales-history.test.ts`
- `npm test -- tests/unit/returns-history.test.ts`
- `npm test -- tests/unit/perfume-history.test.ts`
- `npm test -- tests/unit/user-settings-history.test.ts`

Expected: FAIL.

- [ ] **Step 3: Write minimal implementation**

Add history records for:
- sale creation
- return creation
- perfume pricing create/update/deactivate
- profile name change
- password change with safe redaction

Password history rule:

```ts
after: { passwordChanged: true }
```

Never include:
- raw password
- password hash
- current/new password strings

- [ ] **Step 4: Run tests to verify they pass**

Run the same four test commands.
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/services/sales.ts lib/services/returns.ts lib/services/perfume-pricing.ts lib/services/user-settings.ts app/api/settings/profile/route.ts app/api/settings/password/route.ts tests/unit/sales-history.test.ts tests/unit/returns-history.test.ts tests/unit/perfume-history.test.ts tests/unit/user-settings-history.test.ts
git commit -m "feat(history): audit sales and settings changes"
```

### Task 7: Full Verification And Final Integration

**Files:**
- Verify only

- [ ] **Step 1: Run focused audit/history suite**

Run:

```bash
npm test -- tests/unit/product-indexes.test.ts tests/unit/history.test.ts tests/unit/history-routes.test.ts tests/unit/product-history.test.ts tests/unit/variant-history.test.ts tests/unit/purchase-history.test.ts tests/unit/expense-history-recording.test.ts tests/unit/investment-history-recording.test.ts tests/unit/asset-history-recording.test.ts tests/unit/sales-history.test.ts tests/unit/returns-history.test.ts tests/unit/perfume-history.test.ts tests/unit/user-settings-history.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run lint**

Run: `npm run lint`
Expected: PASS, with at most the same pre-existing seed warnings only.

- [ ] **Step 3: Run production build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 4: Commit final integration**

```bash
git add .
git commit -m "feat(history): add global audit trail"
```
