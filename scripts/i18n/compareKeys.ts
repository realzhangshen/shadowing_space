export type KeyDiff = {
  missing: string[];
  extra: string[];
};

export function flattenKeys(
  value: unknown,
  prefix = "",
  acc: Set<string> = new Set(),
): Set<string> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    acc.add(prefix);
    return acc;
  }
  const record = value as Record<string, unknown>;
  const entries = Object.entries(record);
  if (entries.length === 0) {
    acc.add(prefix);
    return acc;
  }
  for (const [key, child] of entries) {
    const nextPrefix = prefix ? `${prefix}.${key}` : key;
    flattenKeys(child, nextPrefix, acc);
  }
  return acc;
}

export function diffKeySets(reference: Set<string>, candidate: Set<string>): KeyDiff {
  const missing: string[] = [];
  const extra: string[] = [];
  for (const key of reference) {
    if (!candidate.has(key)) missing.push(key);
  }
  for (const key of candidate) {
    if (!reference.has(key)) extra.push(key);
  }
  missing.sort();
  extra.sort();
  return { missing, extra };
}
