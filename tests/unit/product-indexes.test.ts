import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.resetModules();
  vi.restoreAllMocks();
  vi.doUnmock("@/models/Product");
});

describe("ensureProductActiveUniqueIndex", () => {
  it("drops the legacy hard unique index and recreates an active-only one", async () => {
    const dropIndex = vi.fn().mockResolvedValue(undefined);
    const createIndex = vi.fn().mockResolvedValue("category_1_name_1");

    vi.doMock("@/models/Product", () => ({
      default: {
        collection: { dropIndex, createIndex },
      },
    }));

    const { ensureProductActiveUniqueIndex } = await import(
      "@/lib/services/product-indexes"
    );

    await ensureProductActiveUniqueIndex();

    expect(dropIndex).toHaveBeenCalledWith("category_1_name_1");
    expect(createIndex).toHaveBeenCalledWith(
      { category: 1, name: 1 },
      {
        unique: true,
        partialFilterExpression: { isActive: true },
        name: "category_1_name_1",
      },
    );
  });
});
