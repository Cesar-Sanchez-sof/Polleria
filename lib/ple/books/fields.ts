import type { FieldDef, FieldKind } from "../types";

/** Compact FieldDef factory used by the book definitions. */
export function field(
  index: number,
  key: string,
  label: string,
  kind: FieldKind,
  maxLength: number,
  required = false
): FieldDef {
  return { index, key, label, kind, maxLength, required };
}
