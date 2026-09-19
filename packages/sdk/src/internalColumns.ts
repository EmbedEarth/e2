/**
 * Internal snapshot columns that must never reach user-facing responses.
 * `c_id`, `s_id`, `r_id` and `p_id` are region-join helpers and every `h3*`
 * column is an indexing artifact. They stay usable inside SQL `WHERE`
 * clauses but are stripped from every returned feature.
 */
export function isInternalResponseColumn(column: string): boolean {
  if (column === "c_id" || column === "s_id" || column === "r_id" || column === "p_id") return true;
  return column === "h3" || column.startsWith("h3_");
}

function stripFromRecord(value: Record<string, unknown>): Record<string, unknown> {
  const cleaned: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (isInternalResponseColumn(key)) continue;
    cleaned[key] = entry;
  }
  return cleaned;
}

/** Remove internal columns from a top-level row and its nested `properties` object. */
export function stripInternalColumns<T extends Record<string, unknown>>(row: T): T {
  const cleaned = stripFromRecord(row) as Record<string, unknown>;
  const properties = cleaned.properties;
  if (properties && typeof properties === "object" && !Array.isArray(properties)) {
    cleaned.properties = stripFromRecord(properties as Record<string, unknown>);
  }
  return cleaned as T;
}
