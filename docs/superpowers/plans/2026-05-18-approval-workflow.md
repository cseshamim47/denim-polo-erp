# Approval Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add fast approval queue UX with local row updates, multi-select approve, and unified `/approvals` inbox for purchases, expenses, investments, and assets.

**Architecture:** Extend existing module services/routes with `needsReview` filtering and bulk review responses, then build shared client helpers that patch local state instead of refetching full lists. Create a new approvals aggregator API/page on top of those module services so mixed pending items can be reviewed from one place.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Mongoose, NextAuth, shadcn UI, Vitest

---

### Task 1: Lock spec and red tests

**Files:**
- Create: `tests/unit/approval-client.test.ts`
- Modify: `tests/integration/expenses.test.ts`
- Modify: `tests/integration/assets.test.ts`
- Modify: `tests/integration/purchases.test.ts`
- Modify: `tests/integration/investments.test.ts`

- [ ] Add failing tests for local review patch helpers
- [ ] Add failing route/service tests for `needsReview=true`
- [ ] Add failing route tests for bulk PATCH payloads on four module APIs
- [ ] Run focused tests and confirm red before implementation
- [ ] Commit red-test checkpoint if useful

### Task 2: Add reusable approval backend helpers

**Files:**
- Create: `lib/services/approval-review.ts`
- Create: `lib/services/investment-history.ts`
- Create: `lib/services/approval-queue.ts`
- Modify: `lib/services/purchases.ts`
- Modify: `lib/services/expense-history.ts`
- Modify: `lib/services/expenses.ts`
- Modify: `lib/services/investments.ts`
- Modify: `lib/services/assets.ts`
- Modify: `lib/services/asset-history.ts`

- [ ] Add shared types for compact review updates and queue items
- [ ] Add `needsReview` filtering to history loaders
- [ ] Add investment history service so route and queue share one path
- [ ] Add bulk review helpers that process selected ids safely
- [ ] Add queue aggregator service for `/approvals`

### Task 3: Extend route handlers

**Files:**
- Create: `app/api/approvals/route.ts`
- Modify: `app/api/purchases/route.ts`
- Modify: `app/api/expenses/route.ts`
- Modify: `app/api/investments/route.ts`
- Modify: `app/api/assets/route.ts`

- [ ] Support `needsReview=true` GET param on four module routes
- [ ] Support single and bulk PATCH payloads on four module routes
- [ ] Return compact review updates for local client patching
- [ ] Add unified `/api/approvals` GET and PATCH
- [ ] Re-run focused route tests and confirm green

### Task 4: Add shared client approval utilities

**Files:**
- Create: `lib/domain/approval-client.ts`
- Create: `components/approval/approval-selection-bar.tsx`
- Create: `components/approval/approval-checkbox.tsx`

- [ ] Add pure helpers to patch reviewed records in local state
- [ ] Add helpers to clear stale selections and count selectable items
- [ ] Build small reusable shadcn-style approval action bar
- [ ] Verify unit tests for helpers pass

### Task 5: Upgrade module pages

**Files:**
- Modify: `app/(dashboard)/purchases/page.tsx`
- Modify: `app/(dashboard)/expenses/page.tsx`
- Modify: `app/(dashboard)/investments/page.tsx`
- Modify: `app/(dashboard)/assets/page.tsx`
- Modify: `app/(dashboard)/assets/_components/asset-history.tsx`
- Modify or create focused helper files beside these pages as needed

- [ ] Add `Needs my approval` filter/view on each page
- [ ] Add multi-select UI for reviewable items
- [ ] Add approve-selected action per page
- [ ] Replace full reload after review with local patch updates
- [ ] Keep mobile cards and desktop tables aligned

### Task 6: Build unified approvals page

**Files:**
- Create: `app/(dashboard)/approvals/page.tsx`
- Create: `app/(dashboard)/approvals/approval-types.ts`
- Create: `app/(dashboard)/approvals/_components/approval-filters.tsx`
- Create: `app/(dashboard)/approvals/_components/approval-summary.tsx`
- Create: `app/(dashboard)/approvals/_components/approval-list.tsx`
- Modify: `app/(dashboard)/layout.tsx`
- Modify: `proxy.ts`

- [ ] Add dashboard nav and route protection
- [ ] Build summary cards and filters
- [ ] Build responsive mixed approval list with single and bulk actions
- [ ] Keep page fast by using normalized queue payload instead of four separate client fetch flows

### Task 7: Verify, commit, push

**Files:**
- Modify any touched files if verification finds issues

- [ ] Run focused tests for approval helpers and route behavior
- [ ] Run broader tests that cover touched approval modules
- [ ] Run `npm run lint`
- [ ] Run `npm run build`
- [ ] Commit in clean logical chunks
- [ ] Push to GitHub
