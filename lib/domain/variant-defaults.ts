export const DEFAULT_VARIANT_INVENTORY_MODE = "unit" as const;
export const DEFAULT_VARIANT_UNIT_LABEL = "PCS";
export const DEFAULT_VARIANT_ALLOW_DECIMAL_QTY = false;

type RawVariantDefaults = {
  inventoryMode?: "unit" | "volume" | "packaging" | null;
  unitLabel?: string | null;
  allowDecimalQty?: boolean | null;
};

export function normalizeVariantDefaults<T extends RawVariantDefaults>(
  variant: T,
) {
  return {
    ...variant,
    inventoryMode:
      variant.inventoryMode ?? DEFAULT_VARIANT_INVENTORY_MODE,
    unitLabel:
      variant.unitLabel?.trim() || DEFAULT_VARIANT_UNIT_LABEL,
    allowDecimalQty:
      variant.allowDecimalQty ?? DEFAULT_VARIANT_ALLOW_DECIMAL_QTY,
  };
}
