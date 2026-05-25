# Perfume Module Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add perfume liquid and bottle inventory support, perfume pricing rules, and perfume sale lines that preserve correct cash flow, cost snapshots, and profit inside the current ERP.

**Architecture:** Extend `Variant` to represent standard items, perfume liquid, and bottle packaging with explicit inventory metadata. Add a focused `PerfumePricingRule` model plus routes/UI for managing bottle add-on prices per perfume. Extend sale creation and `/sales/new` so perfume lines consume both liquid stock and bottle stock while snapshotting full cost and pricing details.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Mongoose, NextAuth, shadcn UI, Vitest

---

### Task 1: Add failing perfume calculation and route tests

**Files:**
- Create: `tests/unit/perfume-pricing.test.ts`
- Create: `tests/unit/perfume-routes.test.ts`

- [ ] Add failing unit tests for perfume price/cost/profit helpers
- [ ] Add failing route tests for perfume pricing rule CRUD payloads
- [ ] Run focused tests and confirm red

### Task 2: Extend inventory model for perfume and packaging variants

**Files:**
- Modify: `models/Variant.ts`
- Modify: `app/api/variants/route.ts`
- Modify: `app/(dashboard)/products/page.tsx`

- [ ] Add `inventoryMode`, `unitLabel`, and `allowDecimalQty` to `Variant`
- [ ] Expose the new fields through variants GET responses
- [ ] Accept the new fields on variant creation
- [ ] Update product/variant UI so partners can create perfume liquid and bottle variants cleanly

### Task 3: Add perfume pricing rule model and APIs

**Files:**
- Create: `models/PerfumePricingRule.ts`
- Create: `app/api/perfume-pricing/route.ts`
- Create: `lib/services/perfume-pricing.ts`

- [ ] Add pricing rule schema linking perfume variant, bottle variant, fill ml, and bottle selling price
- [ ] Add list/create/update APIs for pricing rules
- [ ] Keep route handlers small by moving query/mutation logic into a service
- [ ] Re-run focused pricing rule tests and confirm green

### Task 4: Extend sale schema and sale creation flow for perfume lines

**Files:**
- Modify: `models/Sale.ts`
- Create: `lib/domain/perfume-pricing.ts`
- Modify: `lib/services/sales.ts`
- Modify: `app/api/sales/route.ts`

- [ ] Add focused perfume sale snapshot fields to `SaleLine`
- [ ] Add pure helper(s) to calculate perfume liquid cost, selling price, bottle cost, and profit
- [ ] Extend sale POST schema to accept `standard` and `perfume` line modes
- [ ] Teach sale creation to reduce perfume liquid stock and bottle stock atomically enough for current service style
- [ ] Keep standard item sales working unchanged

### Task 5: Build perfume pricing management page

**Files:**
- Create: `app/(dashboard)/perfumes/page.tsx`
- Create: `app/(dashboard)/perfumes/_components/perfume-rule-form.tsx`
- Create: `app/(dashboard)/perfumes/_components/perfume-rule-list.tsx`
- Modify: `app/(dashboard)/layout.tsx`
- Modify: `proxy.ts`

- [ ] Add dashboard route/nav for perfume pricing management
- [ ] Build a small mobile-friendly page to manage perfume pricing rules
- [ ] Surface perfume liquid variants and bottle variants as filtered selectors
- [ ] Keep page server-light and client-simple

### Task 6: Upgrade `/sales/new` with perfume line mode

**Files:**
- Modify: `app/(dashboard)/sales/new/page.tsx`
- Create helper files beside the page if needed to keep file size reasonable

- [ ] Add perfume line mode with preset-pack and custom-ml flows
- [ ] Show live calculation preview from the formula
- [ ] Allow selecting bottle size and perfume pricing rule
- [ ] Include perfume details in cart line summaries
- [ ] Keep standard sale path intact and mobile-friendly

### Task 7: Verify, commit, and push

**Files:**
- Modify touched files if verification finds issues

- [ ] Run focused perfume tests
- [ ] Run broader auth/sales tests affected by schema changes
- [ ] Run `npm run lint`
- [ ] Run `npm run build`
- [ ] Commit in clean logical chunks
- [ ] Push to GitHub
