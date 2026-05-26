function normalizeForCompare(value: unknown) {
  if (value instanceof Date) {
    return value.toISOString();
  }

  return value;
}

export function pickChangedFields(
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null,
) {
  const keys = new Set([
    ...Object.keys(before ?? {}),
    ...Object.keys(after ?? {}),
  ]);

  const changedBefore: Record<string, unknown> = {};
  const changedAfter: Record<string, unknown> = {};

  for (const key of keys) {
    const left = normalizeForCompare(before?.[key]);
    const right = normalizeForCompare(after?.[key]);

    if (JSON.stringify(left) === JSON.stringify(right)) {
      continue;
    }

    if (before && key in before) {
      changedBefore[key] = before[key];
    }

    if (after && key in after) {
      changedAfter[key] = after[key];
    }
  }

  return {
    before: Object.keys(changedBefore).length > 0 ? changedBefore : null,
    after: Object.keys(changedAfter).length > 0 ? changedAfter : null,
  };
}
