const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

/**
 * Clamp preset scalars to `[0, 1]`; invalid numbers fall back to the zero end.
 *
 * @evidence requirements/product/scope-and-exclusions.md#product-detailed-likeness-exclusion This frozen compatibility declaration preserves legacy proxy data or helpers without claiming detailed likeness.
 * @evidence specifications/authoring-and-authority/prototype-determinism-and-fidelity.md#spec-authoring-fidelity-failure-choice This frozen compatibility declaration treats unsupported likeness as a fidelity failure, not prototype capability.
 */
export const clampUnitParameter = (value: number | undefined): number =>
  clamp(Number.isFinite(value) ? (value as number) : 0, 0, 1);

/**
 * Clamp signed preset offsets to `[-1, 1]`; invalid numbers fall back neutral.
 *
 * @evidence requirements/product/scope-and-exclusions.md#product-detailed-likeness-exclusion This frozen compatibility declaration preserves legacy proxy data or helpers without claiming detailed likeness.
 * @evidence specifications/authoring-and-authority/prototype-determinism-and-fidelity.md#spec-authoring-fidelity-failure-choice This frozen compatibility declaration treats unsupported likeness as a fidelity failure, not prototype capability.
 */
export const clampSignedParameter = (value: number | undefined): number =>
  clamp(Number.isFinite(value) ? (value as number) : 0, -1, 1);
