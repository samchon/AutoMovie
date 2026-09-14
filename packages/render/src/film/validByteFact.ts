import { validDigest } from "./validDigest";

/**
 * Recognize one positive byte count paired with a current digest.
 *
 * This is an intentional copy of production's predicate of the same name, not an
 * oversight. Both the moved planner and the receipts production kept need it, and
 * one shared home would reintroduce the render-to-production edge this change
 * removes. Whether the two should be consolidated into a shared primitive, and
 * where that primitive would live, is C4/#2479's judgment rather than this
 * change's.
 */
export const validByteFact = (fact: {
  digest: string;
  bytes: number;
}): boolean =>
  Number.isSafeInteger(fact.bytes) &&
  fact.bytes > 0 &&
  validDigest(fact.digest);
