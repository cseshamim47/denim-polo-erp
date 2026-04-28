import { describe, expect, it } from "vitest";

import { generateVariantSku } from "../../lib/domain/sku";

describe("sku generation", () => {
  it("builds sku in required format", () => {
    const result = generateVariantSku({
      category: "jeans",
      productName: "Heritage Denim Jeans",
      color: "blk",
      size: "32",
    });

    expect(result).toBe("DP-JEANS-HERITAGE-DENIM-JEANS-BLK-32");
  });

  it("normalizes spaces and casing", () => {
    const result = generateVariantSku({
      category: " polo shirt ",
      productName: " core polo ",
      color: " nvy ",
      size: " xl ",
    });

    expect(result).toBe("DP-POLO-SHIRT-CORE-POLO-NVY-XL");
  });

  it("creates different SKUs for different products", () => {
    const first = generateVariantSku({
      category: "jeans",
      productName: "Heritage Denim Jeans",
      color: "blue",
      size: "34",
    });
    const second = generateVariantSku({
      category: "jeans",
      productName: "American Eagle",
      color: "blue",
      size: "34",
    });

    expect(first).not.toBe(second);
  });

  it("rejects missing values", () => {
    expect(() =>
      generateVariantSku({
        category: "jeans",
        productName: "Heritage Denim Jeans",
        color: "",
        size: "32",
      }),
    ).toThrow("sku parts are required");
  });
});
