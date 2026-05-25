# Perfume Module Design

## Goal

Add perfume selling to the current ERP in a way that tracks:

- perfume liquid stock in `ml`
- perfume bottle stock in `pieces`
- bottle buying cost separately from bottle selling add-on price
- correct purchase cash-out
- correct sale profit snapshots
- both preset pack sizes and custom `ml` selling

## Scope

This work covers:

- perfume liquid inventory
- perfume bottle inventory
- perfume-specific pricing rules
- perfume sales from the existing sales flow
- correct profit and balance handling using the current accounting model

This work does not cover:

- automated bottle refilling workflows
- manufacturing batches
- expiry tracking
- barcode labeling for filled perfume units
- separate finished-goods stock for every perfume pack size

## Current System Constraints

- Purchases reduce cash only when approved and then update stock/cost in [lib/services/purchases.ts](/D:/Others/w/dpe/lib/services/purchases.ts:1).
- Stock is currently tracked on `Variant.stockQty` with average cost on `Variant.avgCost` in [models/Variant.ts](/D:/Others/w/dpe/models/Variant.ts:1).
- Sales snapshot price and cost into sale lines in [models/Sale.ts](/D:/Others/w/dpe/models/Sale.ts:1).
- Profit is based on saved sale snapshots rather than recalculating from current stock cost.

These rules are good and should stay intact.

## Recommended Design

### Core Pattern

Use **bulk liquid + packaging + recipe sale**.

This means:

- perfume liquid is tracked as a stock item measured in `ml`
- bottles are tracked as stock items measured in `pieces`
- a perfume sale consumes both:
  - `X ml` of perfume liquid
  - `1` bottle item

This is better than storing ready-made `5ml`, `15ml`, `30ml`, `50ml` perfume SKUs because:

- custom `ml` selling stays easy
- stock stays tied to real source materials
- profit stays accurate
- SKU explosion is avoided

## Inventory Design

### Product Layer

Keep perfume inside the existing `Product` model:

- perfume liquid products can use category `PERFUME`
- bottle products can use category `PACKAGING` or `BOTTLE`

This keeps the module integrated with the current product and reporting structure.

### Variant Layer

Extend `Variant` with inventory behavior fields:

- `inventoryMode`
  - `unit` for current standard items
  - `volume` for perfume liquid
  - `packaging` for bottle stock
- `unitLabel`
  - examples: `PCS`, `ML`
- `allowDecimalQty`
  - `false` for current standard items and bottles
  - configurable for perfume liquid if decimal `ml` is needed later

### Perfume Liquid Variants

A perfume liquid variant represents the liquid stock itself.

Example:

- product: `Dior Sauvage`
- variant: `100ML STOCK`
- `inventoryMode = volume`
- `unitLabel = ML`
- `stockQty = 100`
- `avgCost = cost per 1 ml`

### Bottle Variants

A bottle variant represents bottle inventory only.

Examples:

- product: `Perfume Bottle`
- variants:
  - `5ML`
  - `15ML`
  - `30ML`
  - `50ML`
- `inventoryMode = packaging`
- `unitLabel = PCS`
- `stockQty = number of bottles`
- `avgCost = buying cost per bottle`

Important:

- bottle `avgCost` is inventory purchase cost
- bottle selling add-on price should not be stored as the stock cost source

## Pricing Rule Design

Add a dedicated `PerfumePricingRule` collection.

Each rule links:

- one perfume liquid variant
- one bottle variant
- one default fill amount in `ml`
- one bottle selling add-on price

Suggested fields:

- `perfumeVariantId`
- `bottleVariantId`
- `fillMl`
- `bottleSellingPrice`
- `isActive`
- timestamps

Examples:

- `Sauvage + 5ml bottle + 5ml fill + 80 tk`
- `Sauvage + 15ml bottle + 15ml fill + 100 tk`
- `Sauvage + 30ml bottle + 30ml fill + 130 tk`
- `Sauvage + 50ml bottle + 50ml fill + 170 tk`

Reason for separate collection:

- each perfume may have different rules
- one perfume needs many pack sizes
- rules should be editable without overloading the `Variant` model

## Sale Price Formula

User-provided business formula:

`selling price = (per ml cost * 2 * selling ml) + bottle selling price`

System calculation at sale time:

- `liquidCost = perfumeAvgCostPerMl * soldMl`
- `sellingPrice = (liquidCost * 2) + bottleSellingPrice`
- `realCost = liquidCost + bottleBuyingCost`
- `profit = sellingPrice - realCost`

Important distinction:

- `bottleBuyingCost` comes from bottle stock average cost
- `bottleSellingPrice` comes from pricing rules

These two values must remain separate.

## Purchase Flow

Perfume should reuse the current purchase module.

### Perfume Liquid Purchase

When buying perfume liquid:

- purchase is recorded against the perfume liquid variant
- quantity means `ml`
- cost per unit means cost per `1 ml`

Example:

- buy `100 ml` for `500 tk`
- system stores purchase qty `100`
- system stores cost per unit `5`

### Bottle Purchase

When buying bottles:

- purchase is recorded against the bottle variant
- quantity means number of bottles
- cost per unit means bottle buying cost

Example:

- buy `50` pieces of `15ml bottle`
- cost per bottle `12 tk`

### Accounting Impact

No new accounting formula is needed.

- approved perfume liquid purchase reduces cash like any other purchase
- approved bottle purchase reduces cash like any other purchase
- both update average cost only after approval

## Sales Flow

Perfume should be sold from the existing `/sales/new` workflow, not from a separate sales module.

### Line Modes

Add a second sale-line mode:

- `standard`
- `perfume`

### Perfume Sale Input

For perfume mode:

1. choose perfume liquid
2. choose pricing mode:
   - preset pack
   - custom `ml`
3. choose bottle
4. calculate selling price using the formula
5. save full snapshots

### Preset Pack Mode

User chooses from available rules for that perfume.

System auto-fills:

- `fillMl`
- bottle variant
- bottle selling price
- final price

### Custom ML Mode

User can:

- enter any `ml`
- choose bottle size

System calculates:

- liquid cost
- bottle selling price from selected rule or bottle config
- final selling price
- expected profit

## Sale Snapshot Design

Extend `SaleLine` to support perfume data without breaking standard items.

Suggested new optional fields:

- `saleMode`
  - `standard`
  - `perfume`
- `perfumeFillMl`
- `packagingVariantId`
- `packagingSkuSnapshot`
- `packagingSizeSnapshot`
- `packagingCostSnapshot`
- `packagingSellingPriceSnapshot`
- `liquidCostSnapshot`

Existing fields like:

- `sellingPriceSnapshot`
- `avgCostSnapshot`
- `profitPerUnitSnapshot`
- `lineTotal`

should continue to exist, but perfume sales may need an adjusted meaning:

- either treat perfume line `qty` as `1` and store the real sold `ml` in `perfumeFillMl`
- or expand sale-line calculations to support perfume-specific formulas cleanly

Recommended approach:

- for perfume sale lines, use `qty = 1`
- store actual filled amount in `perfumeFillMl`
- compute line snapshots from the full recipe

This keeps line totals simple while preserving exact perfume details.

## Stock Consumption Rules

On perfume sale completion:

- reduce perfume liquid `stockQty` by sold `ml`
- reduce bottle variant `stockQty` by `1`

Validation rules:

- enough perfume `ml` must exist
- enough bottle stock must exist
- sold `ml` must be greater than zero
- selected rule must match selected perfume when using preset mode

## Reporting And Profit

No new high-level balance formula is needed.

### Profit

Perfume line profit should be saved at sale time:

- `profit = sellingPrice - liquidCost - bottleBuyingCost`

This keeps profit history stable even when later purchase costs change.

### Balance

Balance stays correct because:

- perfume and bottle purchases already reduce purchase cash-out
- perfume sales already increase sales cash-in

### Useful Future Reports

Later, the system can add:

- remaining perfume liquid by `ml`
- remaining bottles by size
- perfume sold by `ml`
- perfume sold by pack size
- profit by perfume
- bottle usage by size

## UI Design

### Products / Variants

User should be able to create:

- perfume liquid variants
- bottle variants

The UI should clearly show:

- inventory mode
- unit label
- whether the stock item is liquid or packaging

### Pricing Rules Page

Add a dedicated pricing management interface for perfume rules.

User should be able to:

- choose perfume
- choose bottle
- choose fill `ml`
- set bottle selling price
- enable/disable rules

### Sales Page

The perfume sale UX should show:

- perfume selector
- bottle selector
- preset pack rules
- custom `ml`
- live formula result
- live profit preview
- low stock warnings

This must remain mobile-friendly and fast.

## What Not To Do

Do not:

- create separate stock variants like `Sauvage 5ml`, `Sauvage 15ml`, `Sauvage 30ml`
- treat bottle selling price as bottle buying cost
- treat bottles as expenses
- recalculate historical perfume profits from future cost values

These patterns would make stock and profit incorrect over time.

## Implementation Order

Recommended phases:

1. extend `Variant` for perfume-capable inventory modes
2. add bottle variants and perfume liquid variants support
3. add `PerfumePricingRule`
4. extend sale-line schema for perfume snapshots
5. add perfume sale UI to `/sales/new`
6. update reporting formatting where needed
7. later add perfume return flow

## Success Criteria

- perfume liquid is tracked in `ml`
- bottles are tracked in `pieces`
- bottle buying cost and bottle selling price are separate
- user can sell preset packs and custom `ml`
- perfume sale reduces both liquid and bottle stock
- purchases and profit remain correct under the current money-flow model
- old records remain untouched and future cost changes do not rewrite history
