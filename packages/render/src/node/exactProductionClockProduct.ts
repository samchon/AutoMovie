/**
 * Multiply two MP4 clock terms exactly, refusing anything but positive safe
 * integers.
 *
 * Two tracks are compared by cross-multiplying duration and timescale, which is
 * the only way to decide equality without dividing, and a term outside the safe
 * range would make that product silently wrong. The mux proves its two byte
 * sources share a runtime and the feature probe proves the delivered tracks do;
 * both need the identical arithmetic, so it is written once and each caller
 * keeps its own refusal text for the comparison it failed.
 */
export const exactProductionClockProduct = (
  left: number,
  right: number,
): bigint => {
  if (
    Number.isSafeInteger(left) === false ||
    left <= 0 ||
    Number.isSafeInteger(right) === false ||
    right <= 0
  )
    throw new Error("MP4 presentation clocks must be positive safe integers.");
  return BigInt(left) * BigInt(right);
};
