# Assets Module Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build approved asset tracking with cash-balance impact only, plus a fast shadcn dashboard page.

**Architecture:** Add a dedicated `Asset` model, service layer, route handler, and dashboard page. Reuse existing approval and dashboard patterns from expenses and investments while keeping asset accounting separate from profit.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Mongoose, NextAuth, shadcn UI, Vitest

---

### Task 1: Add failing tests

**Files:**
- Create: `tests/unit/assetApproval.test.ts`
- Modify: `tests/unit/balance.test.ts`
- Create: `tests/integration/assets.test.ts`

- [ ] Write failing tests for asset approval flow
- [ ] Write failing balance test showing approved assets reduce current balance
- [ ] Write failing asset integration tests for create/review/list behavior

### Task 2: Add asset backend

**Files:**
- Create: `models/Asset.ts`
- Create: `lib/domain/asset-approval.ts`
- Create: `lib/services/assets.ts`
- Create: `lib/services/asset-history.ts`
- Create: `app/api/assets/route.ts`
- Modify: `lib/domain/balance.ts`
- Modify: `lib/services/balance.ts`

- [ ] Add model and approval helper
- [ ] Add create/review service
- [ ] Add filtered history service
- [ ] Add route handlers
- [ ] Update balance calculation to subtract approved assets

### Task 3: Add asset UI and routing

**Files:**
- Create: `app/(dashboard)/assets/page.tsx`
- Create: `app/(dashboard)/assets/_components/asset-form.tsx`
- Create: `app/(dashboard)/assets/_components/asset-filters.tsx`
- Create: `app/(dashboard)/assets/_components/asset-history.tsx`
- Create: `app/(dashboard)/assets/_components/asset-note-dialog.tsx`
- Modify: `app/(dashboard)/layout.tsx`
- Modify: `proxy.ts`

- [ ] Add dashboard nav and auth protection
- [ ] Build asset form with shadcn UI
- [ ] Build filters and responsive history view
- [ ] Show summary cards for approved total, pending count, and balance

### Task 4: Verify and deliver

**Files:**
- Modify if needed from failing verification

- [ ] Run focused unit tests
- [ ] Run lint
- [ ] Run production build
- [ ] Commit in logical chunks
- [ ] Push to GitHub

