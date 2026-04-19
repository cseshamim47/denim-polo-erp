export function toDecimal128(value: number | string) {
  return typeof value === "number" ? value.toFixed(4) : value;
}

export function decimalToNumber(value: unknown) {
  if (!value) {
    return 0;
  }

  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    return Number(value);
  }

  if (typeof value === "object" && "toString" in value) {
    return Number(value.toString());
  }

  return 0;
}
