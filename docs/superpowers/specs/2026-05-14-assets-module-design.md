# Assets Module Design

## Goal

Add an `assets` module for shop-owned non-stock purchases. Approved assets reduce cash balance only. They do not reduce profit.

## Why Separate Module

- `expenses` reduce profit today, so they do not match asset accounting.
- `purchases` are for inventory and stock movement, so they do not match non-stock owned assets.
- assets need their own approval history, filters, and reporting semantics.

## Core Rules

- asset requests follow partner approval flow like expenses, investments, and purchases
- only `approved` assets affect money calculations
- approved assets reduce `currentBalance`
- approved assets do **not** reduce `todayProfit`, `monthProfit`, or trend profit
- asset records are history-preserving and never overwrite prior financial records

## Data Model

Asset fields:

- `title`
- `category`
- `amount`
- `note`
- `submittedBy`
- `submittedAt`
- `assetDate`
- `status`
- `approvals`
- `requiredApproverIdsSnapshot`
- `requiredApprovalCountSnapshot`

## API

`/api/assets`

- `GET`: paginated history with filters for scope, owner, status, category, from, to
- `POST`: create pending asset request
- `PATCH`: approve or reject request

## UI

Route: `/assets`

Page style should match current dashboard pages and use shadcn UI primitives already in repo.

Key UX:

- submit form with title, category, amount, date, note
- fast filters with searchable owner/category/status controls
- mobile cards
- desktop table
- approval progress
- note viewer dialog
- summary cards for approved asset total, pending asset count, and current balance snapshot

## Integration Points

- add nav link in dashboard shell
- protect route in `proxy.ts`
- subtract approved asset total in balance service
- keep dashboard profit logic unchanged

