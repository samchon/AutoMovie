/**
 * A face template in render-ready flat-array form: the geometry side of the
 * face editor that an {@link IAutoMovieFace} morphs.
 *
 * `positions` is the template's resting face (the canonical neutral, or a
 * character with its `identity` morph already baked in), and `targets` maps
 * each morph-target name to per-vertex xyz deltas of the same length. This
 * matches what a glTF face asset carries (POSITION plus named morph targets),
 * so `ingest` fills it straight from the file and the engine's `morphFace`
 * consumes it without further shaping.
 *
 * @evidence requirements/actors/representation-tiers-and-fidelity-boundary.md#actor-direct-authoring-ceiling Keeps `IAutoMovieFaceTemplate` inside the bounded direct-authoring proxy surface instead of claiming realistic likeness.
 * @evidence specifications/performance-motion-and-staging/actor-identity-state-and-fidelity.md#performance-actor-representation-fidelity-boundary Types `IAutoMovieFaceTemplate` as a coarse proxy parameter under the representation-fidelity ceiling.
 * @author Samchon
 */
export interface IAutoMovieFaceTemplate {
  /**
   * Resting vertex positions, xyz triples.
   *
   * @evidence requirements/actors/representation-tiers-and-fidelity-boundary.md#actor-direct-authoring-ceiling Keeps `positions` inside the bounded direct-authoring proxy surface instead of claiming realistic likeness.
   * @evidence specifications/performance-motion-and-staging/actor-identity-state-and-fidelity.md#performance-actor-representation-fidelity-boundary Types `positions` as a coarse proxy parameter under the representation-fidelity ceiling.
   */
  positions: number[];

  /**
   * Morph-target deltas by parameter name, each `positions.length` long.
   *
   * @evidence requirements/actors/representation-tiers-and-fidelity-boundary.md#actor-direct-authoring-ceiling Keeps `targets` inside the bounded direct-authoring proxy surface instead of claiming realistic likeness.
   * @evidence specifications/performance-motion-and-staging/actor-identity-state-and-fidelity.md#performance-actor-representation-fidelity-boundary Types `targets` as a coarse proxy parameter under the representation-fidelity ceiling.
   */
  targets: Record<string, number[]>;
}
