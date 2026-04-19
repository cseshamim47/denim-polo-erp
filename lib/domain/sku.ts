function normalizeSkuPart(value: string) {
  return value.trim().replace(/\s+/g, "-").toUpperCase();
}

export function generateVariantSku(input: {
  category: string;
  color: string;
  size: string;
}) {
  const category = normalizeSkuPart(input.category);
  const color = normalizeSkuPart(input.color);
  const size = normalizeSkuPart(input.size);

  if (!category || !color || !size) {
    throw new Error("sku parts are required");
  }

  return `DP-${category}-${color}-${size}`;
}
