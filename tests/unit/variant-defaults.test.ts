import { describe, expect, it } from "vitest";

import { normalizeVariantDefaults } from "@/lib/domain/variant-defaults";

describe("normalizeVariantDefaults", () => {
  it("fills legacy variants with unit defaults", () => {
    expect(
      normalizeVariantDefaults({
        inventoryMode: undefined,
        unitLabel: undefined,
        allowDecimalQty: undefined,
      }),
    ).toEqual({
      inventoryMode: "unit",
      unitLabel: "PCS",
      allowDecimalQty: false,
    });
  });

  it("keeps provided perfume settings", () => {
    expect(
      normalizeVariantDefaults({
        inventoryMode: "volume",
        unitLabel: "ML",
        allowDecimalQty: true,
      }),
    ).toEqual({
      inventoryMode: "volume",
      unitLabel: "ML",
      allowDecimalQty: true,
    });
  });
});
