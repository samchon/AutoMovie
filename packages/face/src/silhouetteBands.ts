/**
 * One scanline of a figure silhouette: the y row and its pixel runs.
 *
 * @author Samchon
 * @evidence requirements/product/scope-and-exclusions.md#product-detailed-likeness-exclusion This frozen compatibility declaration preserves legacy proxy data or helpers without claiming detailed likeness.
 * @evidence specifications/authoring-and-authority/prototype-determinism-and-fidelity.md#spec-authoring-fidelity-failure-choice Keeps this frozen compatibility declaration inside the unsupported-likeness boundary instead of presenting it as prototype capability.
 * @evidence requirements/actors/representation-tiers-and-fidelity-boundary.md#actor-direct-authoring-ceiling Produces or describes bounded blocking-proxy face data while keeping directly authored likeness at the declared ceiling.
 * @evidence requirements/actors/representation-tiers-and-fidelity-boundary.md#actor-fidelity-capability-separation Carries appearance geometry, controls, or bounded derivation facts without inferring rig, motion, gaze, contact, or interaction capability.
 * @evidence specifications/performance-motion-and-staging/actor-identity-state-and-fidelity.md#performance-actor-representation-fidelity-boundary Carries proxy representation geometry, controls, or bounded derivation facts without promoting them to a higher-fidelity actor tier.
 * @evidence requirements/asset-authoring/geometry.md#asset-composable-geometry-operations Defines an explicit input, result, or operation in a deterministic local geometry derivation that composes with the retained proxy pipeline.
 * @evidence specifications/asset-and-representation/model-geometry-and-surface-facts.md#asset-spec-geometry-operations-topology Keeps the inputs, parameters, or results of the bounded geometry derivation explicit for deterministic review and composition.
 */
export interface IForgeSilhouetteRow {
  /**
   * Row coordinate (image y).
   *
   * @evidence requirements/product/scope-and-exclusions.md#product-detailed-likeness-exclusion This frozen compatibility declaration preserves legacy proxy data or helpers without claiming detailed likeness.
   * @evidence specifications/authoring-and-authority/prototype-determinism-and-fidelity.md#spec-authoring-fidelity-failure-choice Keeps this frozen compatibility declaration inside the unsupported-likeness boundary instead of presenting it as prototype capability.
   * @evidence requirements/actors/representation-tiers-and-fidelity-boundary.md#actor-direct-authoring-ceiling Produces or describes bounded blocking-proxy face data while keeping directly authored likeness at the declared ceiling.
   * @evidence requirements/actors/representation-tiers-and-fidelity-boundary.md#actor-fidelity-capability-separation Carries appearance geometry, controls, or bounded derivation facts without inferring rig, motion, gaze, contact, or interaction capability.
   * @evidence specifications/performance-motion-and-staging/actor-identity-state-and-fidelity.md#performance-actor-representation-fidelity-boundary Carries proxy representation geometry, controls, or bounded derivation facts without promoting them to a higher-fidelity actor tier.
   * @evidence requirements/asset-authoring/geometry.md#asset-composable-geometry-operations Defines an explicit input, result, or operation in a deterministic local geometry derivation that composes with the retained proxy pipeline.
   * @evidence specifications/asset-and-representation/model-geometry-and-surface-facts.md#asset-spec-geometry-operations-topology Keeps the inputs, parameters, or results of the bounded geometry derivation explicit for deterministic review and composition.
   */
  y: number;

  /**
   * Figure runs on the row as `[start, end]` pixel intervals, left to right.
   *
   * @evidence requirements/product/scope-and-exclusions.md#product-detailed-likeness-exclusion This frozen compatibility declaration preserves legacy proxy data or helpers without claiming detailed likeness.
   * @evidence specifications/authoring-and-authority/prototype-determinism-and-fidelity.md#spec-authoring-fidelity-failure-choice Keeps this frozen compatibility declaration inside the unsupported-likeness boundary instead of presenting it as prototype capability.
   * @evidence requirements/actors/representation-tiers-and-fidelity-boundary.md#actor-direct-authoring-ceiling Produces or describes bounded blocking-proxy face data while keeping directly authored likeness at the declared ceiling.
   * @evidence requirements/actors/representation-tiers-and-fidelity-boundary.md#actor-fidelity-capability-separation Carries appearance geometry, controls, or bounded derivation facts without inferring rig, motion, gaze, contact, or interaction capability.
   * @evidence specifications/performance-motion-and-staging/actor-identity-state-and-fidelity.md#performance-actor-representation-fidelity-boundary Carries proxy representation geometry, controls, or bounded derivation facts without promoting them to a higher-fidelity actor tier.
   * @evidence requirements/asset-authoring/geometry.md#asset-composable-geometry-operations Defines an explicit input, result, or operation in a deterministic local geometry derivation that composes with the retained proxy pipeline.
   * @evidence specifications/asset-and-representation/model-geometry-and-surface-facts.md#asset-spec-geometry-operations-topology Keeps the inputs, parameters, or results of the bounded geometry derivation explicit for deterministic review and composition.
   */
  runs: [number, number][];
}

/**
 * One scanline of a tracked band: the run chosen as the subject's body.
 *
 * @author Samchon
 * @evidence requirements/product/scope-and-exclusions.md#product-detailed-likeness-exclusion This frozen compatibility declaration preserves legacy proxy data or helpers without claiming detailed likeness.
 * @evidence specifications/authoring-and-authority/prototype-determinism-and-fidelity.md#spec-authoring-fidelity-failure-choice Keeps this frozen compatibility declaration inside the unsupported-likeness boundary instead of presenting it as prototype capability.
 * @evidence requirements/actors/representation-tiers-and-fidelity-boundary.md#actor-direct-authoring-ceiling Produces or describes bounded blocking-proxy face data while keeping directly authored likeness at the declared ceiling.
 * @evidence requirements/actors/representation-tiers-and-fidelity-boundary.md#actor-fidelity-capability-separation Carries appearance geometry, controls, or bounded derivation facts without inferring rig, motion, gaze, contact, or interaction capability.
 * @evidence specifications/performance-motion-and-staging/actor-identity-state-and-fidelity.md#performance-actor-representation-fidelity-boundary Carries proxy representation geometry, controls, or bounded derivation facts without promoting them to a higher-fidelity actor tier.
 * @evidence requirements/asset-authoring/geometry.md#asset-composable-geometry-operations Defines an explicit input, result, or operation in a deterministic local geometry derivation that composes with the retained proxy pipeline.
 * @evidence specifications/asset-and-representation/model-geometry-and-surface-facts.md#asset-spec-geometry-operations-topology Keeps the inputs, parameters, or results of the bounded geometry derivation explicit for deterministic review and composition.
 */
export interface IForgeSilhouetteBand {
  /**
   * Row coordinate (image y).
   *
   * @evidence requirements/product/scope-and-exclusions.md#product-detailed-likeness-exclusion This frozen compatibility declaration preserves legacy proxy data or helpers without claiming detailed likeness.
   * @evidence specifications/authoring-and-authority/prototype-determinism-and-fidelity.md#spec-authoring-fidelity-failure-choice Keeps this frozen compatibility declaration inside the unsupported-likeness boundary instead of presenting it as prototype capability.
   * @evidence requirements/actors/representation-tiers-and-fidelity-boundary.md#actor-direct-authoring-ceiling Produces or describes bounded blocking-proxy face data while keeping directly authored likeness at the declared ceiling.
   * @evidence requirements/actors/representation-tiers-and-fidelity-boundary.md#actor-fidelity-capability-separation Carries appearance geometry, controls, or bounded derivation facts without inferring rig, motion, gaze, contact, or interaction capability.
   * @evidence specifications/performance-motion-and-staging/actor-identity-state-and-fidelity.md#performance-actor-representation-fidelity-boundary Carries proxy representation geometry, controls, or bounded derivation facts without promoting them to a higher-fidelity actor tier.
   * @evidence requirements/asset-authoring/geometry.md#asset-composable-geometry-operations Defines an explicit input, result, or operation in a deterministic local geometry derivation that composes with the retained proxy pipeline.
   * @evidence specifications/asset-and-representation/model-geometry-and-surface-facts.md#asset-spec-geometry-operations-topology Keeps the inputs, parameters, or results of the bounded geometry derivation explicit for deterministic review and composition.
   */
  y: number;

  /**
   * Left edge of the tracked run.
   *
   * @evidence requirements/product/scope-and-exclusions.md#product-detailed-likeness-exclusion This frozen compatibility declaration preserves legacy proxy data or helpers without claiming detailed likeness.
   * @evidence specifications/authoring-and-authority/prototype-determinism-and-fidelity.md#spec-authoring-fidelity-failure-choice Keeps this frozen compatibility declaration inside the unsupported-likeness boundary instead of presenting it as prototype capability.
   * @evidence requirements/actors/representation-tiers-and-fidelity-boundary.md#actor-direct-authoring-ceiling Produces or describes bounded blocking-proxy face data while keeping directly authored likeness at the declared ceiling.
   * @evidence requirements/actors/representation-tiers-and-fidelity-boundary.md#actor-fidelity-capability-separation Carries appearance geometry, controls, or bounded derivation facts without inferring rig, motion, gaze, contact, or interaction capability.
   * @evidence specifications/performance-motion-and-staging/actor-identity-state-and-fidelity.md#performance-actor-representation-fidelity-boundary Carries proxy representation geometry, controls, or bounded derivation facts without promoting them to a higher-fidelity actor tier.
   * @evidence requirements/asset-authoring/geometry.md#asset-composable-geometry-operations Defines an explicit input, result, or operation in a deterministic local geometry derivation that composes with the retained proxy pipeline.
   * @evidence specifications/asset-and-representation/model-geometry-and-surface-facts.md#asset-spec-geometry-operations-topology Keeps the inputs, parameters, or results of the bounded geometry derivation explicit for deterministic review and composition.
   */
  min: number;

  /**
   * Right edge of the tracked run.
   *
   * @evidence requirements/product/scope-and-exclusions.md#product-detailed-likeness-exclusion This frozen compatibility declaration preserves legacy proxy data or helpers without claiming detailed likeness.
   * @evidence specifications/authoring-and-authority/prototype-determinism-and-fidelity.md#spec-authoring-fidelity-failure-choice Keeps this frozen compatibility declaration inside the unsupported-likeness boundary instead of presenting it as prototype capability.
   * @evidence requirements/actors/representation-tiers-and-fidelity-boundary.md#actor-direct-authoring-ceiling Produces or describes bounded blocking-proxy face data while keeping directly authored likeness at the declared ceiling.
   * @evidence requirements/actors/representation-tiers-and-fidelity-boundary.md#actor-fidelity-capability-separation Carries appearance geometry, controls, or bounded derivation facts without inferring rig, motion, gaze, contact, or interaction capability.
   * @evidence specifications/performance-motion-and-staging/actor-identity-state-and-fidelity.md#performance-actor-representation-fidelity-boundary Carries proxy representation geometry, controls, or bounded derivation facts without promoting them to a higher-fidelity actor tier.
   * @evidence requirements/asset-authoring/geometry.md#asset-composable-geometry-operations Defines an explicit input, result, or operation in a deterministic local geometry derivation that composes with the retained proxy pipeline.
   * @evidence specifications/asset-and-representation/model-geometry-and-surface-facts.md#asset-spec-geometry-operations-topology Keeps the inputs, parameters, or results of the bounded geometry derivation explicit for deterministic review and composition.
   */
  max: number;
}

/**
 * Track the subject's own silhouette run down the scanlines.
 *
 * A multi-view sheet's figure mask has several runs per row: the head plus
 * detached spurs (twin tails, ribbons, loose strands). The head is followed by
 * continuity: the first row takes its widest run, every later row takes the run
 * overlapping the previous row's choice the most, and a row whose runs all miss
 * the previous run (or that has no runs at all) keeps the previous band so a
 * one-row gap cannot derail the track.
 *
 * @author Samchon
 * @throws When the first row has no runs (there is nothing to start from)
 * @evidence requirements/asset-authoring/validation.md#asset-geometry-validation Refuses an initial silhouette row without any surface interval instead of inventing a band.
 * @evidence specifications/asset-and-representation/fidelity-and-validation.md#asset-spec-validation-numeric-structure Reports the row whose structural silhouette input cannot seed a bounded track.
 * @evidence requirements/product/scope-and-exclusions.md#product-detailed-likeness-exclusion This frozen compatibility declaration preserves legacy proxy data or helpers without claiming detailed likeness.
 * @evidence specifications/authoring-and-authority/prototype-determinism-and-fidelity.md#spec-authoring-fidelity-failure-choice Keeps this frozen compatibility declaration inside the unsupported-likeness boundary instead of presenting it as prototype capability.
 * @evidence requirements/actors/representation-tiers-and-fidelity-boundary.md#actor-direct-authoring-ceiling Produces or describes bounded blocking-proxy face data while keeping directly authored likeness at the declared ceiling.
 * @evidence requirements/actors/representation-tiers-and-fidelity-boundary.md#actor-fidelity-capability-separation Carries appearance geometry, controls, or bounded derivation facts without inferring rig, motion, gaze, contact, or interaction capability.
 * @evidence specifications/performance-motion-and-staging/actor-identity-state-and-fidelity.md#performance-actor-representation-fidelity-boundary Carries proxy representation geometry, controls, or bounded derivation facts without promoting them to a higher-fidelity actor tier.
 * @evidence requirements/asset-authoring/geometry.md#asset-composable-geometry-operations Defines an explicit input, result, or operation in a deterministic local geometry derivation that composes with the retained proxy pipeline.
 * @evidence specifications/asset-and-representation/model-geometry-and-surface-facts.md#asset-spec-geometry-operations-topology Keeps the inputs, parameters, or results of the bounded geometry derivation explicit for deterministic review and composition.
 */
export const trackSilhouetteBands = (
  rows: IForgeSilhouetteRow[],
): IForgeSilhouetteBand[] => {
  const out: IForgeSilhouetteBand[] = [];
  let prev: [number, number] | null = null;
  for (const { y, runs } of rows) {
    let best: [number, number] | null = null;
    let bestScore = -1;
    for (const run of runs) {
      const score =
        prev === null
          ? run[1] - run[0]
          : Math.min(run[1], prev[1]) - Math.max(run[0], prev[0]);
      if (score > bestScore) {
        bestScore = score;
        best = run;
      }
    }
    if (prev !== null && bestScore < 0) best = prev;
    if (best === null) throw new Error(`row ${y} has no runs to track from`);
    out.push({ y, min: best[0], max: best[1] });
    prev = best;
  }
  return out;
};

/**
 * Options of {@link cleanSilhouetteBands}.
 *
 * @author Samchon
 * @evidence requirements/product/scope-and-exclusions.md#product-detailed-likeness-exclusion This frozen compatibility declaration preserves legacy proxy data or helpers without claiming detailed likeness.
 * @evidence specifications/authoring-and-authority/prototype-determinism-and-fidelity.md#spec-authoring-fidelity-failure-choice Keeps this frozen compatibility declaration inside the unsupported-likeness boundary instead of presenting it as prototype capability.
 * @evidence requirements/actors/representation-tiers-and-fidelity-boundary.md#actor-direct-authoring-ceiling Produces or describes bounded blocking-proxy face data while keeping directly authored likeness at the declared ceiling.
 * @evidence requirements/actors/representation-tiers-and-fidelity-boundary.md#actor-fidelity-capability-separation Carries appearance geometry, controls, or bounded derivation facts without inferring rig, motion, gaze, contact, or interaction capability.
 * @evidence specifications/performance-motion-and-staging/actor-identity-state-and-fidelity.md#performance-actor-representation-fidelity-boundary Carries proxy representation geometry, controls, or bounded derivation facts without promoting them to a higher-fidelity actor tier.
 * @evidence requirements/asset-authoring/geometry.md#asset-composable-geometry-operations Defines an explicit input, result, or operation in a deterministic local geometry derivation that composes with the retained proxy pipeline.
 * @evidence specifications/asset-and-representation/model-geometry-and-surface-facts.md#asset-spec-geometry-operations-topology Keeps the inputs, parameters, or results of the bounded geometry derivation explicit for deterministic review and composition.
 */
export interface IForgeBandCleaning {
  /**
   * Clamp the min side monotonically non-decreasing after its extremum row (the
   * skull's widest point): spurs can shrink the band but never widen it again
   * below the head.
   *
   * @evidence requirements/product/scope-and-exclusions.md#product-detailed-likeness-exclusion This frozen compatibility declaration preserves legacy proxy data or helpers without claiming detailed likeness.
   * @evidence specifications/authoring-and-authority/prototype-determinism-and-fidelity.md#spec-authoring-fidelity-failure-choice Keeps this frozen compatibility declaration inside the unsupported-likeness boundary instead of presenting it as prototype capability.
   * @evidence requirements/actors/representation-tiers-and-fidelity-boundary.md#actor-direct-authoring-ceiling Produces or describes bounded blocking-proxy face data while keeping directly authored likeness at the declared ceiling.
   * @evidence requirements/actors/representation-tiers-and-fidelity-boundary.md#actor-fidelity-capability-separation Carries appearance geometry, controls, or bounded derivation facts without inferring rig, motion, gaze, contact, or interaction capability.
   * @evidence specifications/performance-motion-and-staging/actor-identity-state-and-fidelity.md#performance-actor-representation-fidelity-boundary Carries proxy representation geometry, controls, or bounded derivation facts without promoting them to a higher-fidelity actor tier.
   * @evidence requirements/asset-authoring/geometry.md#asset-composable-geometry-operations Defines an explicit input, result, or operation in a deterministic local geometry derivation that composes with the retained proxy pipeline.
   * @evidence specifications/asset-and-representation/model-geometry-and-surface-facts.md#asset-spec-geometry-operations-topology Keeps the inputs, parameters, or results of the bounded geometry derivation explicit for deterministic review and composition.
   */
  monoMin?: boolean;

  /**
   * The max-side twin of `monoMin`.
   *
   * @evidence requirements/product/scope-and-exclusions.md#product-detailed-likeness-exclusion This frozen compatibility declaration preserves legacy proxy data or helpers without claiming detailed likeness.
   * @evidence specifications/authoring-and-authority/prototype-determinism-and-fidelity.md#spec-authoring-fidelity-failure-choice Keeps this frozen compatibility declaration inside the unsupported-likeness boundary instead of presenting it as prototype capability.
   * @evidence requirements/actors/representation-tiers-and-fidelity-boundary.md#actor-direct-authoring-ceiling Produces or describes bounded blocking-proxy face data while keeping directly authored likeness at the declared ceiling.
   * @evidence requirements/actors/representation-tiers-and-fidelity-boundary.md#actor-fidelity-capability-separation Carries appearance geometry, controls, or bounded derivation facts without inferring rig, motion, gaze, contact, or interaction capability.
   * @evidence specifications/performance-motion-and-staging/actor-identity-state-and-fidelity.md#performance-actor-representation-fidelity-boundary Carries proxy representation geometry, controls, or bounded derivation facts without promoting them to a higher-fidelity actor tier.
   * @evidence requirements/asset-authoring/geometry.md#asset-composable-geometry-operations Defines an explicit input, result, or operation in a deterministic local geometry derivation that composes with the retained proxy pipeline.
   * @evidence specifications/asset-and-representation/model-geometry-and-surface-facts.md#asset-spec-geometry-operations-topology Keeps the inputs, parameters, or results of the bounded geometry derivation explicit for deterministic review and composition.
   */
  monoMax?: boolean;

  /**
   * Rows at or above this y are the only candidates for each side's extremum
   * anchor, so low spurs (ribbons at mouth level) cannot claim it. Default:
   * every row competes.
   *
   * @evidence requirements/product/scope-and-exclusions.md#product-detailed-likeness-exclusion This frozen compatibility declaration preserves legacy proxy data or helpers without claiming detailed likeness.
   * @evidence specifications/authoring-and-authority/prototype-determinism-and-fidelity.md#spec-authoring-fidelity-failure-choice Keeps this frozen compatibility declaration inside the unsupported-likeness boundary instead of presenting it as prototype capability.
   * @evidence requirements/actors/representation-tiers-and-fidelity-boundary.md#actor-direct-authoring-ceiling Produces or describes bounded blocking-proxy face data while keeping directly authored likeness at the declared ceiling.
   * @evidence requirements/actors/representation-tiers-and-fidelity-boundary.md#actor-fidelity-capability-separation Carries appearance geometry, controls, or bounded derivation facts without inferring rig, motion, gaze, contact, or interaction capability.
   * @evidence specifications/performance-motion-and-staging/actor-identity-state-and-fidelity.md#performance-actor-representation-fidelity-boundary Carries proxy representation geometry, controls, or bounded derivation facts without promoting them to a higher-fidelity actor tier.
   * @evidence requirements/asset-authoring/geometry.md#asset-composable-geometry-operations Defines an explicit input, result, or operation in a deterministic local geometry derivation that composes with the retained proxy pipeline.
   * @evidence specifications/asset-and-representation/model-geometry-and-surface-facts.md#asset-spec-geometry-operations-topology Keeps the inputs, parameters, or results of the bounded geometry derivation explicit for deterministic review and composition.
   */
  extremumAbove?: number;

  /**
   * Median prefilter radius in rows; `0` disables. Default `3`.
   *
   * @evidence requirements/product/scope-and-exclusions.md#product-detailed-likeness-exclusion This frozen compatibility declaration preserves legacy proxy data or helpers without claiming detailed likeness.
   * @evidence specifications/authoring-and-authority/prototype-determinism-and-fidelity.md#spec-authoring-fidelity-failure-choice Keeps this frozen compatibility declaration inside the unsupported-likeness boundary instead of presenting it as prototype capability.
   * @evidence requirements/actors/representation-tiers-and-fidelity-boundary.md#actor-direct-authoring-ceiling Produces or describes bounded blocking-proxy face data while keeping directly authored likeness at the declared ceiling.
   * @evidence requirements/actors/representation-tiers-and-fidelity-boundary.md#actor-fidelity-capability-separation Carries appearance geometry, controls, or bounded derivation facts without inferring rig, motion, gaze, contact, or interaction capability.
   * @evidence specifications/performance-motion-and-staging/actor-identity-state-and-fidelity.md#performance-actor-representation-fidelity-boundary Carries proxy representation geometry, controls, or bounded derivation facts without promoting them to a higher-fidelity actor tier.
   * @evidence requirements/asset-authoring/geometry.md#asset-composable-geometry-operations Defines an explicit input, result, or operation in a deterministic local geometry derivation that composes with the retained proxy pipeline.
   * @evidence specifications/asset-and-representation/model-geometry-and-surface-facts.md#asset-spec-geometry-operations-topology Keeps the inputs, parameters, or results of the bounded geometry derivation explicit for deterministic review and composition.
   */
  medianRadius?: number;

  /**
   * Triangular smoothing radius in rows, applied twice; `0` disables. Default
   * `12`, because clay shading exposes every per-row jiggle a texture hides.
   *
   * @evidence requirements/product/scope-and-exclusions.md#product-detailed-likeness-exclusion This frozen compatibility declaration preserves legacy proxy data or helpers without claiming detailed likeness.
   * @evidence specifications/authoring-and-authority/prototype-determinism-and-fidelity.md#spec-authoring-fidelity-failure-choice Keeps this frozen compatibility declaration inside the unsupported-likeness boundary instead of presenting it as prototype capability.
   * @evidence requirements/actors/representation-tiers-and-fidelity-boundary.md#actor-direct-authoring-ceiling Produces or describes bounded blocking-proxy face data while keeping directly authored likeness at the declared ceiling.
   * @evidence requirements/actors/representation-tiers-and-fidelity-boundary.md#actor-fidelity-capability-separation Carries appearance geometry, controls, or bounded derivation facts without inferring rig, motion, gaze, contact, or interaction capability.
   * @evidence specifications/performance-motion-and-staging/actor-identity-state-and-fidelity.md#performance-actor-representation-fidelity-boundary Carries proxy representation geometry, controls, or bounded derivation facts without promoting them to a higher-fidelity actor tier.
   * @evidence requirements/asset-authoring/geometry.md#asset-composable-geometry-operations Defines an explicit input, result, or operation in a deterministic local geometry derivation that composes with the retained proxy pipeline.
   * @evidence specifications/asset-and-representation/model-geometry-and-surface-facts.md#asset-spec-geometry-operations-topology Keeps the inputs, parameters, or results of the bounded geometry derivation explicit for deterministic review and composition.
   */
  smoothRadius?: number;
}

/**
 * Clean a tracked band curve for carving: median prefilter against one-off
 * tracking glitches, extremum-anchored monotone clamps against spurs (ribbons,
 * tails) ballooning a slice, then a wide double triangular kernel because the
 * band drives a lofted clay surface where row jitter reads as ring banding.
 * Each side's clamp starts only AT its own extremum row: above it the head must
 * stay free to bulge outward.
 *
 * @author Samchon
 * @evidence requirements/product/scope-and-exclusions.md#product-detailed-likeness-exclusion This frozen compatibility declaration preserves legacy proxy data or helpers without claiming detailed likeness.
 * @evidence specifications/authoring-and-authority/prototype-determinism-and-fidelity.md#spec-authoring-fidelity-failure-choice Keeps this frozen compatibility declaration inside the unsupported-likeness boundary instead of presenting it as prototype capability.
 * @evidence requirements/actors/representation-tiers-and-fidelity-boundary.md#actor-direct-authoring-ceiling Produces or describes bounded blocking-proxy face data while keeping directly authored likeness at the declared ceiling.
 * @evidence requirements/actors/representation-tiers-and-fidelity-boundary.md#actor-fidelity-capability-separation Carries appearance geometry, controls, or bounded derivation facts without inferring rig, motion, gaze, contact, or interaction capability.
 * @evidence specifications/performance-motion-and-staging/actor-identity-state-and-fidelity.md#performance-actor-representation-fidelity-boundary Carries proxy representation geometry, controls, or bounded derivation facts without promoting them to a higher-fidelity actor tier.
 * @evidence requirements/asset-authoring/geometry.md#asset-composable-geometry-operations Defines an explicit input, result, or operation in a deterministic local geometry derivation that composes with the retained proxy pipeline.
 * @evidence specifications/asset-and-representation/model-geometry-and-surface-facts.md#asset-spec-geometry-operations-topology Keeps the inputs, parameters, or results of the bounded geometry derivation explicit for deterministic review and composition.
 */
export const cleanSilhouetteBands = (
  bands: IForgeSilhouetteBand[],
  options: IForgeBandCleaning = {},
): IForgeSilhouetteBand[] => {
  const {
    monoMin = false,
    monoMax = false,
    extremumAbove = Number.POSITIVE_INFINITY,
    medianRadius = 3,
    smoothRadius = 12,
  } = options;

  const median = (arr: number[]): number[] => {
    if (medianRadius === 0) return arr;
    return arr.map((_, i) => {
      const lo = Math.max(0, i - medianRadius);
      const hi = Math.min(arr.length - 1, i + medianRadius);
      const win = arr.slice(lo, hi + 1).sort((a, b) => a - b);
      return win[(win.length / 2) | 0]!;
    });
  };
  let mins = median(bands.map((b) => b.min));
  let maxs = median(bands.map((b) => b.max));

  let iMin = 0;
  let iMax = 0;
  bands.forEach(({ y }, i) => {
    if (y <= extremumAbove && mins[i]! < mins[iMin]!) iMin = i;
    if (y <= extremumAbove && maxs[i]! > maxs[iMax]!) iMax = i;
  });
  let runMin = Number.NEGATIVE_INFINITY;
  let runMax = Number.POSITIVE_INFINITY;
  bands.forEach((_, i) => {
    if (monoMin && i >= iMin) {
      runMin = Math.max(mins[i]!, runMin);
      mins[i] = runMin;
    }
    if (monoMax && i >= iMax) {
      runMax = Math.min(maxs[i]!, runMax);
      maxs[i] = runMax;
    }
  });

  const smooth = (arr: number[]): number[] => {
    if (smoothRadius === 0) return arr;
    const pass = (a: number[]): number[] =>
      a.map((_, i) => {
        let acc = 0;
        let wAcc = 0;
        for (let d = -smoothRadius; d <= smoothRadius; d++) {
          const j = Math.max(0, Math.min(a.length - 1, i + d));
          const w = smoothRadius + 1 - Math.abs(d);
          acc += a[j]! * w;
          wAcc += w;
        }
        return acc / wAcc;
      });
    return pass(pass(arr));
  };
  mins = smooth(mins);
  maxs = smooth(maxs);

  return bands.map(({ y }, i) => ({ y, min: mins[i]!, max: maxs[i]! }));
};
