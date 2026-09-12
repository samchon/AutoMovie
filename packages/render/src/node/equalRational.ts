/**
 * Compare two rationals exactly, refusing any term that is not a safe integer.
 *
 * Presentation clocks are compared across timescales, where a float division
 * makes two unequal clocks look equal.
 */
export const equalRational = (
  leftNumerator: number,
  leftDenominator: number,
  rightNumerator: number,
  rightDenominator: number,
): boolean =>
  [leftNumerator, leftDenominator, rightNumerator, rightDenominator].every(
    Number.isSafeInteger,
  ) &&
  BigInt(leftNumerator) * BigInt(rightDenominator) ===
    BigInt(rightNumerator) * BigInt(leftDenominator);
