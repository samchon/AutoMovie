/**
 * A fitted 2D similarity (rotation + uniform scale + translation).
 *
 * @evidence requirements/product/scope-and-exclusions.md#product-detailed-likeness-exclusion This frozen compatibility declaration preserves legacy proxy data or helpers without claiming detailed likeness.
 * @evidence specifications/authoring-and-authority/prototype-determinism-and-fidelity.md#spec-authoring-fidelity-failure-choice This frozen compatibility declaration treats unsupported likeness as a fidelity failure, not prototype capability.
 * @evidence requirements/actors/representation-tiers-and-fidelity-boundary.md#actor-direct-authoring-ceiling Produces or describes bounded blocking-proxy face data while keeping directly authored likeness at the declared ceiling.
 * @evidence requirements/actors/representation-tiers-and-fidelity-boundary.md#actor-fidelity-capability-separation Carries appearance geometry or controls without inferring rig, motion, gaze, contact, or interaction capability.
 * @evidence specifications/performance-motion-and-staging/actor-identity-state-and-fidelity.md#performance-actor-representation-fidelity-boundary Carries actual proxy representation geometry or controls without promoting it to a higher-fidelity actor tier.
 * @evidence requirements/asset-authoring/validation.md#asset-geometry-validation Rejects or bounds invalid proxy coordinates and indices before they can silently become usable geometry.
 * @evidence specifications/asset-and-representation/fidelity-and-validation.md#asset-spec-validation-numeric-structure Carries the numeric or structural input and result surface used by the package's explicit bounded checks.
 * @evidence requirements/asset-authoring/geometry.md#asset-composable-geometry-operations Performs a deterministic local geometry derivation that composes with the retained proxy pipeline.
 * @evidence specifications/asset-and-representation/model-geometry-and-surface-facts.md#asset-spec-geometry-operations-topology Preserves explicit coordinate or topology facts across the bounded derivation.
 */
export interface IForgeSimilarity2 {
  /**
   * Uniform scale factor.
   *
   * @evidence requirements/product/scope-and-exclusions.md#product-detailed-likeness-exclusion This frozen compatibility declaration preserves legacy proxy data or helpers without claiming detailed likeness.
   * @evidence specifications/authoring-and-authority/prototype-determinism-and-fidelity.md#spec-authoring-fidelity-failure-choice This frozen compatibility declaration treats unsupported likeness as a fidelity failure, not prototype capability.
   * @evidence requirements/actors/representation-tiers-and-fidelity-boundary.md#actor-direct-authoring-ceiling Produces or describes bounded blocking-proxy face data while keeping directly authored likeness at the declared ceiling.
   * @evidence requirements/actors/representation-tiers-and-fidelity-boundary.md#actor-fidelity-capability-separation Carries appearance geometry or controls without inferring rig, motion, gaze, contact, or interaction capability.
   * @evidence specifications/performance-motion-and-staging/actor-identity-state-and-fidelity.md#performance-actor-representation-fidelity-boundary Carries actual proxy representation geometry or controls without promoting it to a higher-fidelity actor tier.
   * @evidence requirements/asset-authoring/validation.md#asset-geometry-validation Rejects or bounds invalid proxy coordinates and indices before they can silently become usable geometry.
   * @evidence specifications/asset-and-representation/fidelity-and-validation.md#asset-spec-validation-numeric-structure Carries the numeric or structural input and result surface used by the package's explicit bounded checks.
   * @evidence requirements/asset-authoring/geometry.md#asset-composable-geometry-operations Performs a deterministic local geometry derivation that composes with the retained proxy pipeline.
   * @evidence specifications/asset-and-representation/model-geometry-and-surface-facts.md#asset-spec-geometry-operations-topology Preserves explicit coordinate or topology facts across the bounded derivation.
   */
  scale: number;

  /**
   * Rotation about z in radians.
   *
   * @evidence requirements/product/scope-and-exclusions.md#product-detailed-likeness-exclusion This frozen compatibility declaration preserves legacy proxy data or helpers without claiming detailed likeness.
   * @evidence specifications/authoring-and-authority/prototype-determinism-and-fidelity.md#spec-authoring-fidelity-failure-choice This frozen compatibility declaration treats unsupported likeness as a fidelity failure, not prototype capability.
   * @evidence requirements/actors/representation-tiers-and-fidelity-boundary.md#actor-direct-authoring-ceiling Produces or describes bounded blocking-proxy face data while keeping directly authored likeness at the declared ceiling.
   * @evidence requirements/actors/representation-tiers-and-fidelity-boundary.md#actor-fidelity-capability-separation Carries appearance geometry or controls without inferring rig, motion, gaze, contact, or interaction capability.
   * @evidence specifications/performance-motion-and-staging/actor-identity-state-and-fidelity.md#performance-actor-representation-fidelity-boundary Carries actual proxy representation geometry or controls without promoting it to a higher-fidelity actor tier.
   * @evidence requirements/asset-authoring/validation.md#asset-geometry-validation Rejects or bounds invalid proxy coordinates and indices before they can silently become usable geometry.
   * @evidence specifications/asset-and-representation/fidelity-and-validation.md#asset-spec-validation-numeric-structure Carries the numeric or structural input and result surface used by the package's explicit bounded checks.
   * @evidence requirements/asset-authoring/geometry.md#asset-composable-geometry-operations Performs a deterministic local geometry derivation that composes with the retained proxy pipeline.
   * @evidence specifications/asset-and-representation/model-geometry-and-surface-facts.md#asset-spec-geometry-operations-topology Preserves explicit coordinate or topology facts across the bounded derivation.
   */
  rotation: number;

  /**
   * Map one source point (xyz triple) into the destination frame.
   *
   * @evidence requirements/product/scope-and-exclusions.md#product-detailed-likeness-exclusion This frozen compatibility declaration preserves legacy proxy data or helpers without claiming detailed likeness.
   * @evidence specifications/authoring-and-authority/prototype-determinism-and-fidelity.md#spec-authoring-fidelity-failure-choice This frozen compatibility declaration treats unsupported likeness as a fidelity failure, not prototype capability.
   * @evidence requirements/actors/representation-tiers-and-fidelity-boundary.md#actor-direct-authoring-ceiling Produces or describes bounded blocking-proxy face data while keeping directly authored likeness at the declared ceiling.
   * @evidence requirements/actors/representation-tiers-and-fidelity-boundary.md#actor-fidelity-capability-separation Carries appearance geometry or controls without inferring rig, motion, gaze, contact, or interaction capability.
   * @evidence specifications/performance-motion-and-staging/actor-identity-state-and-fidelity.md#performance-actor-representation-fidelity-boundary Carries actual proxy representation geometry or controls without promoting it to a higher-fidelity actor tier.
   * @evidence requirements/asset-authoring/validation.md#asset-geometry-validation Rejects or bounds invalid proxy coordinates and indices before they can silently become usable geometry.
   * @evidence specifications/asset-and-representation/fidelity-and-validation.md#asset-spec-validation-numeric-structure Carries the numeric or structural input and result surface used by the package's explicit bounded checks.
   * @evidence requirements/asset-authoring/geometry.md#asset-composable-geometry-operations Performs a deterministic local geometry derivation that composes with the retained proxy pipeline.
   * @evidence specifications/asset-and-representation/model-geometry-and-surface-facts.md#asset-spec-geometry-operations-topology Preserves explicit coordinate or topology facts across the bounded derivation.
   */
  apply: (point: [number, number, number]) => [number, number, number];
}

/**
 * Fit the least-squares 2D similarity mapping `src` onto `dst`: the alignment
 * step that drops detected landmarks (image px, near-frontal) onto the
 * canonical face frame.
 *
 * Closed form on x/y via the complex-number formulation; z rides along with the
 * same uniform scale and a translation (a 2D fit cannot reflect, so the caller
 * flips image-y up before fitting). Points are flat xyz triples and the arrays
 * must pair up index by index.
 *
 * @author Samchon
 * @throws When the source points are all coincident (no scale is defined)
 * @evidence requirements/product/scope-and-exclusions.md#product-detailed-likeness-exclusion This frozen compatibility declaration preserves legacy proxy data or helpers without claiming detailed likeness.
 * @evidence specifications/authoring-and-authority/prototype-determinism-and-fidelity.md#spec-authoring-fidelity-failure-choice This frozen compatibility declaration treats unsupported likeness as a fidelity failure, not prototype capability.
 * @evidence requirements/actors/representation-tiers-and-fidelity-boundary.md#actor-direct-authoring-ceiling Produces or describes bounded blocking-proxy face data while keeping directly authored likeness at the declared ceiling.
 * @evidence requirements/actors/representation-tiers-and-fidelity-boundary.md#actor-fidelity-capability-separation Carries appearance geometry or controls without inferring rig, motion, gaze, contact, or interaction capability.
 * @evidence specifications/performance-motion-and-staging/actor-identity-state-and-fidelity.md#performance-actor-representation-fidelity-boundary Carries actual proxy representation geometry or controls without promoting it to a higher-fidelity actor tier.
 * @evidence requirements/asset-authoring/validation.md#asset-geometry-validation Rejects or bounds invalid proxy coordinates and indices before they can silently become usable geometry.
 * @evidence specifications/asset-and-representation/fidelity-and-validation.md#asset-spec-validation-numeric-structure Carries the numeric or structural input and result surface used by the package's explicit bounded checks.
 * @evidence requirements/asset-authoring/geometry.md#asset-composable-geometry-operations Performs a deterministic local geometry derivation that composes with the retained proxy pipeline.
 * @evidence specifications/asset-and-representation/model-geometry-and-surface-facts.md#asset-spec-geometry-operations-topology Preserves explicit coordinate or topology facts across the bounded derivation.
 */
export const fitSimilarity2 = (
  src: number[],
  dst: number[],
): IForgeSimilarity2 => {
  const n = src.length / 3;
  let cx = 0,
    cy = 0,
    cz = 0,
    bx = 0,
    by = 0,
    bz = 0;
  for (let i = 0; i < n; i++) {
    cx += src[i * 3]! / n;
    cy += src[i * 3 + 1]! / n;
    cz += src[i * 3 + 2]! / n;
    bx += dst[i * 3]! / n;
    by += dst[i * 3 + 1]! / n;
    bz += dst[i * 3 + 2]! / n;
  }
  let mr = 0,
    mi = 0,
    den = 0;
  for (let i = 0; i < n; i++) {
    const sx = src[i * 3]! - cx;
    const sy = src[i * 3 + 1]! - cy;
    const dx = dst[i * 3]! - bx;
    const dy = dst[i * 3 + 1]! - by;
    mr += sx * dx + sy * dy;
    mi += sx * dy - sy * dx;
    den += sx * sx + sy * sy;
  }
  if (den === 0) throw new Error("degenerate source: all points coincide");
  const ar = mr / den;
  const ai = mi / den;
  const scale = Math.hypot(ar, ai);
  return {
    scale,
    rotation: Math.atan2(ai, ar),
    apply: ([x, y, z]) => {
      const sx = x - cx;
      const sy = y - cy;
      return [
        ar * sx - ai * sy + bx,
        ai * sx + ar * sy + by,
        scale * (z - cz) + bz,
      ];
    },
  };
};
