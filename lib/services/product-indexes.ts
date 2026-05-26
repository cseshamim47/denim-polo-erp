import ProductModel from "@/models/Product";

let hasEnsuredProductActiveUniqueIndex = false;

export async function ensureProductActiveUniqueIndex() {
  if (hasEnsuredProductActiveUniqueIndex) {
    return;
  }

  try {
    await ProductModel.collection.dropIndex("category_1_name_1");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (
      !/index not found/i.test(message) &&
      !/ns not found/i.test(message)
    ) {
      throw error;
    }
  }

  await ProductModel.collection.createIndex(
    { category: 1, name: 1 },
    {
      unique: true,
      partialFilterExpression: { isActive: true },
      name: "category_1_name_1",
    },
  );

  hasEnsuredProductActiveUniqueIndex = true;
}
