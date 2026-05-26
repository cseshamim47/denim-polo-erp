# History And Product Recreate Design

## Goal

Fix soft-deleted product recreation so a deleted product name/category can be created again, and add a partner-only `/history` page that records every future write action with actor, summary, and before/after field snapshots.

## Problem

### Product recreate bug

Products are soft-deleted by setting `isActive=false`, but the `Product` model still has a hard unique index on `{ category, name }`. That means:

- old deleted rows stay preserved, which is good
- new product creation with the same `name + category` fails, which is bad

### Missing global history

The app currently has approval/request history in some modules, but no single future-proof audit log for:

- create
- update
- delete
- approve
- reject
- sale submission
- return submission
- settings/profile/password changes

The user wants one partner-only `/history` page where all future DB-changing actions appear.

## Constraints

- Keep old data preserved
- No destructive rewrite of existing business data
- History is future-only; no fake backfill
- History must show summary plus before/after snapshot for changed fields
- Reuse existing dashboard patterns and approval patterns
- Keep files small and responsibility-focused

## Approaches Considered

### 1. App-level audit events on every write path

Add one `HistoryEvent` collection and record explicit events from service/route write paths.

Pros:

- clear actor context
- clear business-friendly summaries
- works with approvals and bulk actions
- easiest to filter and render in `/history`

Cons:

- requires touching many write paths

### 2. Mongoose middleware/hooks

Auto-log writes from model hooks.

Pros:

- less call-site code at first

Cons:

- poor access to session actor
- hard to build readable summaries
- bulk updates and approval flows become opaque
- higher risk of missing context or logging wrong data

### 3. Database-level change capture

Use oplog/change-stream style tracking.

Pros:

- very complete low-level log

Cons:

- infrastructure-heavy
- low business clarity
- overkill for current app

## Recommendation

Use approach 1: explicit app-level audit events.

This matches the app's service-oriented business logic and gives the cleanest history output.

## Design

### 1. Product uniqueness fix

Change the product unique index from:

- `{ category: 1, name: 1 }` unique

To:

- `{ category: 1, name: 1 }` unique with partial filter `isActive: true`

Effect:

- one active `SRK + PERFUME` still enforced
- old deleted `SRK + PERFUME` rows remain preserved
- new active `SRK + PERFUME` can be created after old one is deleted

This requires a DB index migration, but not data deletion.

### 2. History event model

Create `HistoryEvent` model with fields like:

- `actorId`
- `actorName`
- `actorRole`
- `entityType`
- `entityId`
- `entityLabel`
- `action`
- `module`
- `summary`
- `before`
- `after`
- `meta`
- `createdAt`

Notes:

- `before` and `after` store only changed or relevant fields, not full raw documents
- password history must never store raw passwords or password hashes
- for password changes, save safe summary and flags only, not sensitive values

### 3. Shared history logger

Create small helper service, for example:

- `recordHistoryEvent()`

Responsibilities:

- normalize payload
- store event
- keep structure consistent
- avoid repeating event-shaping logic across modules

### 4. History coverage

Log future actions for all current write paths:

- products: create, delete request, delete approval, delete rejection
- variants: create, delete request, delete approval, delete rejection, update request, update approval, update rejection
- purchases: create, approval, rejection
- expenses: create, approval, rejection
- investments: create, approval, rejection
- assets: create, approval, rejection
- sales: create
- returns: create
- perfume pricing: create, update, delete
- settings: profile update, password change

If one user action creates multiple business records, record the business action once where possible. Example:

- sale submission logs one sale event, not a noisy stream of internal stock mutations

### 5. Summary and snapshots

Each event should contain:

- human-readable summary line
- important before/after changed fields

Examples:

- `Product created: SRK (PERFUME)`
- `Product delete approved: SRK (PERFUME)`
- `Expense approved: Office rent (৳12,000)`
- `Profile updated: partner name changed`
- `Password changed`

Examples of snapshots:

- product create:
  - before: `null`
  - after: `{ name, category, description, isActive }`
- product delete approval:
  - before: `{ isActive: true, deleteRequestStatus: "pending" }`
  - after: `{ isActive: false, deleteRequestStatus: "approved" }`
- variant update approval:
  - before: `{ sellingPrice: 450 }`
  - after: `{ sellingPrice: 500 }`

### 6. `/history` page

Partner-only dashboard page.

Features:

- list newest first
- search by summary/entity/actor
- filter by module
- filter by action
- filter by actor
- filter by date range
- mobile cards + desktop table
- expandable before/after details

Scope intentionally excludes edit/delete of history entries.

### 7. History API

Add partner-only API endpoint for paginated history retrieval.

Response should include:

- items
- pagination
- filter options data as needed

### 8. Security and privacy

- partners only can view `/history`
- never store raw passwords
- never store password hashes in history snapshots
- keep summaries business-readable, not internal/noisy

## Error Handling

- if action succeeds but history write fails, fail the whole request only when the action is tiny and recoverable
- for core business writes, history should be treated as part of the write contract where practical
- if transaction support is already absent in the app flow, use best-effort consistency and surface real errors

For this codebase, the implementation should prefer logging immediately in the same action path after the primary write succeeds, and fail loudly during development if history payload shaping is broken.

## Testing

Add tests for:

- product recreate after soft delete using active-only uniqueness rules
- history event creation helper
- representative route/service actions recording history
- `/history` API filtering
- password change history redaction

Focus on representative coverage, not duplicating every existing business test.

## File Structure

Likely new files:

- `models/HistoryEvent.ts`
- `lib/services/history.ts`
- `lib/services/history-mappers.ts`
- `app/api/history/route.ts`
- `app/(dashboard)/history/page.tsx`
- small history UI components under `app/(dashboard)/history/_components/`
- targeted unit tests for history service/API

Likely modified files:

- `models/Product.ts`
- product, variant, purchase, expense, investment, asset, sale, return, perfume pricing, and settings write paths
- dashboard navigation and route protection

## Success Criteria

- deleted product name/category can be recreated without losing old deleted row
- `/history` shows future actions only
- every new DB-changing business action creates one useful audit event
- partners can filter and inspect before/after snapshots
- no sensitive password data appears in history
