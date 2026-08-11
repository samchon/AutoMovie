const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

/**
 * Clamp preset scalars to `[0, 1]`; invalid numbers fall back to the zero end.
 *
 * @evidence requirements/product/scope-and-exclusions.md#product-detailed-likeness-exclusion This frozen compatibility declaration preserves legacy proxy data or helpers without claiming detailed likeness.
 * @evidence specifications/authoring-and-authority/prototype-determinism-and-fidelity.md#spec-authoring-fidelity-failure-choice This frozen compatibility declaration treats unsupported likeness as a fidelity failure, not prototype capability.
 * @evidence requirements/actors/representation-tiers-and-fidelity-boundary.md#actor-direct-authoring-ceiling Produces or describes bounded blocking-proxy face data while keeping directly authored likeness at the declared ceiling.
 * @evidence requirements/actors/representation-tiers-and-fidelity-boundary.md#actor-fidelity-capability-separation Carries appearance geometry or controls without inferring rig, motion, gaze, contact, or interaction capability.
 * @evidence specifications/performance-motion-and-staging/actor-identity-state-and-fidelity.md#performance-actor-representation-fidelity-boundary Carries actual proxy representation geometry or controls without promoting it to a higher-fidelity actor tier.
 * @evidence requirements/asset-authoring/validation.md#asset-geometry-validation Rejects or bounds invalid proxy coordinates and indices before they can silently become usable geometry.
 * @evidence specifications/asset-and-representation/fidelity-and-validation.md#asset-spec-validation-numeric-structure Carries the numeric or structural input and result surface used by the package's explicit bounded checks.
 */
export const clampUnitParameter = (value: number | undefined): number =>
  clamp(Number.isFinite(value) ? (value as number) : 0, 0, 1);

/**
 * Clamp signed preset offsets to `[-1, 1]`; invalid numbers fall back neutral.
 *
 * @evidence requirements/product/scope-and-exclusions.md#product-detailed-likeness-exclusion This frozen compatibility declaration preserves legacy proxy data or helpers without claiming detailed likeness.
 * @evidence specifications/authoring-and-authority/prototype-determinism-and-fidelity.md#spec-authoring-fidelity-failure-choice This frozen compatibility declaration treats unsupported likeness as a fidelity failure, not prototype capability.
 * @evidence requirements/actors/representation-tiers-and-fidelity-boundary.md#actor-direct-authoring-ceiling Produces or describes bounded blocking-proxy face data while keeping directly authored likeness at the declared ceiling.
 * @evidence requirements/actors/representation-tiers-and-fidelity-boundary.md#actor-fidelity-capability-separation Carries appearance geometry or controls without inferring rig, motion, gaze, contact, or interaction capability.
 * @evidence specifications/performance-motion-and-staging/actor-identity-state-and-fidelity.md#performance-actor-representation-fidelity-boundary Carries actual proxy representation geometry or controls without promoting it to a higher-fidelity actor tier.
 * @evidence requirements/asset-authoring/validation.md#asset-geometry-validation Rejects or bounds invalid proxy coordinates and indices before they can silently become usable geometry.
 * @evidence specifications/asset-and-representation/fidelity-and-validation.md#asset-spec-validation-numeric-structure Carries the numeric or structural input and result surface used by the package's explicit bounded checks.
 */
export const clampSignedParameter = (value: number | undefined): number =>
  clamp(Number.isFinite(value) ? (value as number) : 0, -1, 1);
