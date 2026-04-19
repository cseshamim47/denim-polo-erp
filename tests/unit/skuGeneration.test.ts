import { describe, expect, it } from "vitest";

import { generateVariantSku } from "../../lib/domain/sku";

describe("sku generation", () => {
  it("builds sku in required format", () => {
    const result = generateVariantSku({
      category: "jeans",
      color: "blk",
      size: "32",
    });

    expect(result).toBe("DP-JEANS-BLK-32");
  });

  it("normalizes spaces and casing", () => {
    const result = generateVariantSku({
      category: " polo shirt ",
      color: " nvy ",
      size: " xl ",
    });

    expect(result).toBe("DP-POLO-SHIRT-NVY-XL");
  });

  it("rejects missing values", () => {
    expect(() =>
      generateVariantSku({
        category: "jeans",
        color: "",
        size: "32",
      }),
    ).toThrow("sku parts are required");
  });
});
