# Approval Workflow Design

## Goal

Improve approval-heavy flows for `purchases`, `expenses`, `investments`, and `assets` so partners can approve faster without full-page list reloads. Add dedicated `/approvals` queue for items current partner still needs to review.

## Problems

- single approve action reloads whole list, which feels slow on mobile and desktop
- no fast way to isolate items current partner still needs to approve
- no batch approval flow for visible selected items
- no unified approval inbox across modules

## Scope

In scope:

- `purchases`
- `expenses`
- `investments`
- `assets`
- new `/approvals` page
- bulk approve API support for those four modules
- local state row/card updates after single or bulk approval

Out of scope:

- product delete approvals
- variant delete approvals
- variant update approvals
- destructive data migrations

## Product Rules

- no full list reload after approve or reject
- multi-select replaces separate `approve all` button
- approve-selected works on each module page and on `/approvals`
- pages must expose fast "needs my approval" filtering
- assets continue reducing cash balance only, not profit
- approval actions preserve existing history and append decisions only

## UX Design

### Shared module behavior

For `purchases`, `expenses`, `investments`, and `assets`:

- add `Needs my approval` view/filter
- show selection checkboxes only for reviewable rows/cards
- add sticky/lightweight action bar when one or more items are selected
- approve selected updates only affected rows/cards in local state
- single approve/reject also updates only affected row/card in local state
- clear selection for items that become non-reviewable after update

### Dedicated approvals page

Route: `/approvals`

Show mixed queue of pending items current partner can review across:

- purchases
- expenses
- investments
- assets

Page should include:

- summary cards by module and total pending count
- module filter
- owner filter
- search
- newest-first / oldest-first sorting
- multi-select approve selected
- single approve and reject
- responsive table on desktop and cards on mobile

## API Design

### Module APIs

Each of these routes keeps current GET/POST behavior and extends PATCH:

- `/api/purchases`
- `/api/expenses`
- `/api/investments`
- `/api/assets`

New PATCH shapes:

- single review: existing `{ itemId, decision, comment? }`
- bulk review: `{ itemIds: string[], decision, comment? }`

PATCH response should return compact review updates for local UI patching:

- item id
- next status
- actor decision
- actor id
- actor name
- decided timestamp

GET routes gain review-queue filtering support with `needsReview=true`.

### Unified approvals API

New `/api/approvals` route:

- `GET`: combined review queue for current partner
- `PATCH`: approve/reject mixed selected items grouped by module

Combined approval item shape should normalize:

- `id`
- `kind`
- `title`
- `ownerId`
- `ownerName`
- `amount`
- `status`
- `submittedAt`
- `effectiveDate`
- `approvalCount`
- `requiredApprovalCount`
- module-specific meta used for display

## Data Flow

1. page loads filtered records with `needsReview` optional
2. user selects reviewable rows/cards
3. user approves selected
4. page sends bulk PATCH to module API or unified approvals API
5. server reviews only requested records for current partner
6. server returns compact updates
7. client patches matching local rows/cards and clears finished selections
8. queue page removes or updates no-longer-reviewable items without full refetch

## Architecture

- keep approval rules in service layer
- add small reusable client helpers for selection and local review patching
- move investment history/query logic out of route handler into service for reuse by `/api/approvals`
- keep new UI split into focused components for approvals page and shared action bar pieces

## Error Handling

- if one review fails in bulk request, return per-item results instead of hiding partial success
- keep already-successful approvals saved
- show skipped/failed item count in toast
- reject selecting non-reviewable items on client and server

## Testing

- route tests for new GET filter and bulk PATCH payload mapping
- unit tests for local review patch helpers and approvals aggregation helpers
- service/integration tests for `needsReview` filtering and bulk review behavior where practical
- verify lint and production build after changes
