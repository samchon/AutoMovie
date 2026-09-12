/**
 * Recognize one current SHA-256 content identity.
 *
 * This is an intentional copy of production's predicate of the same name, not an
 * oversight. Both the moved planner and the receipts production kept need it, and
 * one shared home would reintroduce the render-to-production edge this change
 * removes. Whether the two should be consolidated into a shared primitive, and
 * where that primitive would live, is C4/#2479's judgment rather than this
 * change's.
 */
export const validDigest = (value: string): boolean =>
  /^sha256:[0-9a-f]{64}$/.test(value);
