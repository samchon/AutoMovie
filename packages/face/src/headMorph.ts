/**
 * One sparse vertex delta of a morph: `[localIndex, dx, dy, dz]`.
 *
 * @evidence requirements/product/scope-and-exclusions.md#product-detailed-likeness-exclusion This frozen compatibility declaration preserves legacy proxy data or helpers without claiming detailed likeness.
 * @evidence specifications/authoring-and-authority/prototype-determinism-and-fidelity.md#spec-authoring-fidelity-failure-choice This frozen compatibility declaration treats unsupported likeness as a fidelity failure, not prototype capability.
 * @evidence requirements/actors/representation-tiers-and-fidelity-boundary.md#actor-direct-authoring-ceiling Produces or describes bounded blocking-proxy face data while keeping directly authored likeness at the declared ceiling.
 * @evidence requirements/actors/representation-tiers-and-fidelity-boundary.md#actor-fidelity-capability-separation Carries appearance geometry or controls without inferring rig, motion, gaze, contact, or interaction capability.
 * @evidence specifications/performance-motion-and-staging/actor-identity-state-and-fidelity.md#performance-actor-representation-fidelity-boundary Carries actual proxy representation geometry or controls without promoting it to a higher-fidelity actor tier.
 * @evidence requirements/asset-authoring/validation.md#asset-geometry-validation Rejects or bounds invalid proxy coordinates and indices before they can silently become usable geometry.
 * @evidence specifications/asset-and-representation/fidelity-and-validation.md#asset-spec-validation-numeric-structure Carries the numeric or structural input and result surface used by the package's explicit bounded checks.
 * @evidence requirements/actors/pose-expression-and-gaze.md#actor-expression-channels Provides bounded named morph channels usable as coarse proxy facial cues without reconstructing detail or inferring expression.
 * @evidence specifications/performance-motion-and-staging/actor-identity-state-and-fidelity.md#performance-actor-pose-gaze-expression-state Carries the morph-channel part of proxy facial state while pose, gaze, timing, and authority remain caller-owned.
 * @evidence requirements/asset-authoring/rig-and-state.md#asset-deformable-surface Defines or applies morph deltas against explicit base geometry without changing its topology.
 * @evidence specifications/asset-and-representation/rig-deformation-and-state.md#asset-spec-skin-morph-facts Carries named base-relative morph facts and bounded application over matching proxy geometry.
 * @evidence specifications/performance-motion-and-staging/rig-deformation-and-retargeting.md#performance-rig-skin-rigid-morph-deformation Provides the morph deformation mode only; no skeleton, skinning, retargeting, or hidden fidelity is introduced.
 * @evidence requirements/asset-authoring/geometry.md#asset-composable-geometry-operations Performs a deterministic local geometry derivation that composes with the retained proxy pipeline.
 * @evidence specifications/asset-and-representation/model-geometry-and-surface-facts.md#asset-spec-geometry-operations-topology Preserves explicit coordinate or topology facts across the bounded derivation.
 * @evidenceExclude requirements/actors/README.md#actor-요구사항 A retained face module implements only bounded proxy appearance and morph slices, not the complete actor requirement family.
 * @evidenceExclude requirements/actors/representation-tiers-and-fidelity-boundary.md#actor-external-representation These procedural proxy helpers neither ingest nor select an external actor representation.
 * @evidenceExclude requirements/actors/representation-tiers-and-fidelity-boundary.md#actor-shot-tier-selection The package exposes one frozen proxy representation and owns no shot-level tier decision.
 * @evidenceExclude requirements/actors/representation-tiers-and-fidelity-boundary.md#actor-tier-compatibility These helpers carry no actor identity or state handoff for switching representations.
 * @evidenceExclude requirements/actors/representation-tiers-and-fidelity-boundary.md#actor-quality-claim-boundary Proxy geometry and morph results contain no review verdict or likeness approval.
 * @evidenceExclude requirements/actors/pose-expression-and-gaze.md#actor-pose-motion-distinction Static morph math has no sampled pose or motion clock.
 * @evidenceExclude requirements/actors/pose-expression-and-gaze.md#actor-pose-space-authority Morph deltas do not resolve pose space or competing authoring authority.
 * @evidenceExclude requirements/actors/pose-expression-and-gaze.md#actor-gaze-attention The frozen morph basis contains no gaze target, attention state, or gaze solve.
 * @evidenceExclude requirements/actors/pose-expression-and-gaze.md#actor-pose-validation These helpers do not return whole-pose range, balance, contact, or gaze findings.
 * @evidenceExclude specifications/performance-motion-and-staging/README.md#퍼포먼스-모션과-스테이징-시스템-명세 A package slice is not the whole performance, motion, formation, and staging specification.
 * @evidenceExclude specifications/performance-motion-and-staging/actor-identity-state-and-fidelity.md#performance-actor-story-performance-state Proxy face geometry does not plan story action or sampled performance time.
 * @evidenceExclude specifications/performance-motion-and-staging/actor-identity-state-and-fidelity.md#performance-actor-state-continuity-ledger The package stores no actor state ledger or scene continuity.
 * @evidenceExclude specifications/performance-motion-and-staging/actor-identity-state-and-fidelity.md#performance-actor-appearance-costume-attachment Head morphs carry no costume, hair, or attachment state.
 * @evidenceExclude specifications/performance-motion-and-staging/actor-identity-state-and-fidelity.md#performance-actor-voice-utterance-expression Morph geometry has no voice bytes, utterance timing, alignment, or viseme receipt.
 * @evidenceExclude specifications/performance-motion-and-staging/actor-identity-state-and-fidelity.md#performance-actor-population-double-variation The package creates no actor population, double, or population budget decision.
 * @evidenceExclude specifications/performance-motion-and-staging/actor-identity-state-and-fidelity.md#performance-actor-validation-output-compatibility Face helpers return data and fits, not actor compatibility or validation status.
 * @evidenceExclude requirements/asset-authoring/README.md#자산-저작-요구사항 The retained face package implements geometry and morph slices, not the complete asset-authoring family.
 * @evidenceExclude requirements/asset-authoring/geometry.md#asset-degenerate-geometry-refusal These focused helpers do not expose a complete geometry validation or diagnostic result.
 * @evidenceExclude requirements/asset-authoring/validation.md#asset-rig-validation Local face checks do not validate a joint hierarchy, skin binding, motion consumer, or named state.
 * @evidenceExclude requirements/asset-authoring/validation.md#asset-surface-validation The package does not validate material assignment, texture channels, color space, or thickness.
 * @evidenceExclude requirements/asset-authoring/validation.md#asset-purpose-validation Face helpers accept no shot purpose or purpose-specific acceptance threshold.
 * @evidenceExclude requirements/asset-authoring/validation.md#asset-representation-bounds-validation No representation-selection, LOD, or stale-bounds verdict is produced here.
 * @evidenceExclude requirements/asset-authoring/validation.md#asset-external-generated-validation Procedural local data has no external bytes, license, resource closure, or provider result to validate.
 * @evidenceExclude requirements/asset-authoring/validation.md#asset-validation-gap These value helpers throw or return bounded results rather than a validation-status record with preserved unknown gaps.
 * @evidenceExclude specifications/asset-and-representation/README.md#자산과-표현-시스템-사양 The face package implements bounded geometry and morph slices, not the complete asset specification.
 * @evidenceExclude specifications/asset-and-representation/model-geometry-and-surface-facts.md#asset-spec-era-style-inputs Frozen proxy geometry accepts no era, style, or reference-role input.
 * @evidenceExclude specifications/asset-and-representation/model-geometry-and-surface-facts.md#asset-spec-material-texture-relations Geometry helpers neither define materials nor bind texture resources.
 * @evidenceExclude specifications/asset-and-representation/model-geometry-and-surface-facts.md#asset-spec-surface-states-substitution The package carries no material state or surface substitution contract.
 * @evidenceExclude specifications/asset-and-representation/model-geometry-and-surface-facts.md#asset-spec-procedural-pattern-inputs Local face geometry operations define no repeat pattern, seed, or element identity.
 * @evidenceExclude specifications/asset-and-representation/model-geometry-and-surface-facts.md#asset-spec-surface-resource-closure Procedural numeric geometry has no external resource closure or provenance ledger.
 * @evidenceExclude specifications/asset-and-representation/model-geometry-and-surface-facts.md#asset-spec-model-output-failures The helpers do not return the model-wide validation output described by this section.
 * @evidenceExclude specifications/asset-and-representation/fidelity-and-validation.md#asset-spec-validation-purpose-inputs These helpers accept no asset purpose, shot scale, or acceptance threshold.
 * @evidenceExclude specifications/asset-and-representation/fidelity-and-validation.md#asset-spec-validation-surface-visual Numeric proxy operations do not perform multi-angle frame or material-surface review.
 * @evidenceExclude specifications/asset-and-representation/fidelity-and-validation.md#asset-spec-validation-motion-transitions Static geometry helpers do not validate motion, contact, state handoff, or representation transition.
 * @evidenceExclude specifications/asset-and-representation/fidelity-and-validation.md#asset-spec-validation-current-evidence The package stores no prior approval, frame identity, digest comparison, or stale review output.
 * @evidenceExclude specifications/asset-and-representation/fidelity-and-validation.md#asset-spec-validation-status-failures Local throws and bounded values are not the specification's full validation-status vocabulary.
 * @evidenceExclude specifications/asset-and-representation/fidelity-and-validation.md#asset-spec-validation-compatibility-ceiling The package returns no compatibility decision or user-approved representation alternative.
 * @evidenceExclude requirements/asset-authoring/rig-and-state.md#asset-general-joint-relations Morph deltas contain no joint hierarchy or general articulated relation.
 * @evidenceExclude requirements/asset-authoring/rig-and-state.md#asset-rig-basis-controls The morph surface defines no rig root, axis, range, dependency, or control identity registry.
 * @evidenceExclude requirements/asset-authoring/rig-and-state.md#asset-motion-retargeting This package neither maps motion between rigs nor records retarget loss.
 * @evidenceExclude requirements/asset-authoring/rig-and-state.md#asset-state-motion-distinction Applying a static morph value does not own named asset state or its motion transition.
 * @evidenceExclude requirements/asset-authoring/rig-and-state.md#asset-derived-deformation-basis These compatibility helpers accept a base array but carry no revision identity or stale-state ledger.
 * @evidenceExclude requirements/asset-authoring/rig-and-state.md#asset-invalid-rig-refusal The package owns no full rig graph on which to report rig refusal.
 * @evidenceExclude specifications/asset-and-representation/rig-deformation-and-state.md#asset-spec-rig-inputs Morph deltas expose no root, joint hierarchy, rest transform, or bind transform record.
 * @evidenceExclude specifications/asset-and-representation/rig-deformation-and-state.md#asset-spec-joint-control-invariants The package evaluates no joint or control dependency graph.
 * @evidenceExclude specifications/asset-and-representation/rig-deformation-and-state.md#asset-spec-state-motion-separation Static morph application does not materialize named state or a timed transition.
 * @evidenceExclude specifications/asset-and-representation/rig-deformation-and-state.md#asset-spec-retarget-compatibility Face morph math produces no retarget mapping or compatibility report.
 * @evidenceExclude specifications/asset-and-representation/rig-deformation-and-state.md#asset-spec-derived-deformation-staleness The retained API has no geometry or rig revision identity with which to mark a basis stale.
 * @evidenceExclude specifications/asset-and-representation/rig-deformation-and-state.md#asset-spec-rig-output-failures Local bounds checks are not a complete rig validation result.
 * @evidenceExclude specifications/performance-motion-and-staging/rig-deformation-and-retargeting.md#performance-rig-semantic-joint-mapping Morph names are not a semantic joint mapping or performer profile.
 * @evidenceExclude specifications/performance-motion-and-staging/rig-deformation-and-retargeting.md#performance-rig-rom-control-driver-graph The package defines no ROM, constraint, driver dependency, or multi-writer resolution.
 * @evidenceExclude specifications/performance-motion-and-staging/rig-deformation-and-retargeting.md#performance-rig-external-adoption-retarget-characterization These helpers neither adopt external rigs nor characterize a retarget mapping.
 * @evidenceExclude specifications/performance-motion-and-staging/rig-deformation-and-retargeting.md#performance-rig-retarget-preservation-failure No retarget solve or contact-preservation result is produced here.
 * @evidenceExclude specifications/performance-motion-and-staging/rig-deformation-and-retargeting.md#performance-rig-compatibility-fidelity-ceiling The package returns no rig compatibility verdict; its fidelity ceiling is documented by the dedicated proxy edges.
 */
export type ForgeHeadDelta = [number, number, number, number];

/**
 * A bipolar parameter morph on the parametric head: the sculpt for the `+1`
 * direction and the (independent) sculpt for the `-1` direction.
 *
 * The two are NOT negatives of each other: "wider nose" and "narrower nose" are
 * separately authored shapes, so each direction carries its own deltas.
 *
 * @author Samchon
 * @evidence requirements/product/scope-and-exclusions.md#product-detailed-likeness-exclusion This frozen compatibility declaration preserves legacy proxy data or helpers without claiming detailed likeness.
 * @evidence specifications/authoring-and-authority/prototype-determinism-and-fidelity.md#spec-authoring-fidelity-failure-choice This frozen compatibility declaration treats unsupported likeness as a fidelity failure, not prototype capability.
 * @evidence requirements/actors/representation-tiers-and-fidelity-boundary.md#actor-direct-authoring-ceiling Produces or describes bounded blocking-proxy face data while keeping directly authored likeness at the declared ceiling.
 * @evidence requirements/actors/representation-tiers-and-fidelity-boundary.md#actor-fidelity-capability-separation Carries appearance geometry or controls without inferring rig, motion, gaze, contact, or interaction capability.
 * @evidence specifications/performance-motion-and-staging/actor-identity-state-and-fidelity.md#performance-actor-representation-fidelity-boundary Carries actual proxy representation geometry or controls without promoting it to a higher-fidelity actor tier.
 * @evidence requirements/asset-authoring/validation.md#asset-geometry-validation Rejects or bounds invalid proxy coordinates and indices before they can silently become usable geometry.
 * @evidence specifications/asset-and-representation/fidelity-and-validation.md#asset-spec-validation-numeric-structure Carries the numeric or structural input and result surface used by the package's explicit bounded checks.
 * @evidence requirements/actors/pose-expression-and-gaze.md#actor-expression-channels Provides bounded named morph channels usable as coarse proxy facial cues without reconstructing detail or inferring expression.
 * @evidence specifications/performance-motion-and-staging/actor-identity-state-and-fidelity.md#performance-actor-pose-gaze-expression-state Carries the morph-channel part of proxy facial state while pose, gaze, timing, and authority remain caller-owned.
 * @evidence requirements/asset-authoring/rig-and-state.md#asset-deformable-surface Defines or applies morph deltas against explicit base geometry without changing its topology.
 * @evidence specifications/asset-and-representation/rig-deformation-and-state.md#asset-spec-skin-morph-facts Carries named base-relative morph facts and bounded application over matching proxy geometry.
 * @evidence specifications/performance-motion-and-staging/rig-deformation-and-retargeting.md#performance-rig-skin-rigid-morph-deformation Provides the morph deformation mode only; no skeleton, skinning, retargeting, or hidden fidelity is introduced.
 * @evidence requirements/asset-authoring/geometry.md#asset-composable-geometry-operations Performs a deterministic local geometry derivation that composes with the retained proxy pipeline.
 * @evidence specifications/asset-and-representation/model-geometry-and-surface-facts.md#asset-spec-geometry-operations-topology Preserves explicit coordinate or topology facts across the bounded derivation.
 */
export interface IForgeHeadMorph {
  /**
   * Sparse vertex deltas applied when the parameter value is positive.
   *
   * @evidence requirements/product/scope-and-exclusions.md#product-detailed-likeness-exclusion This frozen compatibility declaration preserves legacy proxy data or helpers without claiming detailed likeness.
   * @evidence specifications/authoring-and-authority/prototype-determinism-and-fidelity.md#spec-authoring-fidelity-failure-choice This frozen compatibility declaration treats unsupported likeness as a fidelity failure, not prototype capability.
   * @evidence requirements/actors/representation-tiers-and-fidelity-boundary.md#actor-direct-authoring-ceiling Produces or describes bounded blocking-proxy face data while keeping directly authored likeness at the declared ceiling.
   * @evidence requirements/actors/representation-tiers-and-fidelity-boundary.md#actor-fidelity-capability-separation Carries appearance geometry or controls without inferring rig, motion, gaze, contact, or interaction capability.
   * @evidence specifications/performance-motion-and-staging/actor-identity-state-and-fidelity.md#performance-actor-representation-fidelity-boundary Carries actual proxy representation geometry or controls without promoting it to a higher-fidelity actor tier.
   * @evidence requirements/asset-authoring/validation.md#asset-geometry-validation Rejects or bounds invalid proxy coordinates and indices before they can silently become usable geometry.
   * @evidence specifications/asset-and-representation/fidelity-and-validation.md#asset-spec-validation-numeric-structure Carries the numeric or structural input and result surface used by the package's explicit bounded checks.
   * @evidence requirements/actors/pose-expression-and-gaze.md#actor-expression-channels Provides bounded named morph channels usable as coarse proxy facial cues without reconstructing detail or inferring expression.
   * @evidence specifications/performance-motion-and-staging/actor-identity-state-and-fidelity.md#performance-actor-pose-gaze-expression-state Carries the morph-channel part of proxy facial state while pose, gaze, timing, and authority remain caller-owned.
   * @evidence requirements/asset-authoring/rig-and-state.md#asset-deformable-surface Defines or applies morph deltas against explicit base geometry without changing its topology.
   * @evidence specifications/asset-and-representation/rig-deformation-and-state.md#asset-spec-skin-morph-facts Carries named base-relative morph facts and bounded application over matching proxy geometry.
   * @evidence specifications/performance-motion-and-staging/rig-deformation-and-retargeting.md#performance-rig-skin-rigid-morph-deformation Provides the morph deformation mode only; no skeleton, skinning, retargeting, or hidden fidelity is introduced.
   * @evidence requirements/asset-authoring/geometry.md#asset-composable-geometry-operations Performs a deterministic local geometry derivation that composes with the retained proxy pipeline.
   * @evidence specifications/asset-and-representation/model-geometry-and-surface-facts.md#asset-spec-geometry-operations-topology Preserves explicit coordinate or topology facts across the bounded derivation.
   */
  plus: ForgeHeadDelta[];

  /**
   * Sparse vertex deltas applied when the parameter value is negative.
   *
   * @evidence requirements/product/scope-and-exclusions.md#product-detailed-likeness-exclusion This frozen compatibility declaration preserves legacy proxy data or helpers without claiming detailed likeness.
   * @evidence specifications/authoring-and-authority/prototype-determinism-and-fidelity.md#spec-authoring-fidelity-failure-choice This frozen compatibility declaration treats unsupported likeness as a fidelity failure, not prototype capability.
   * @evidence requirements/actors/representation-tiers-and-fidelity-boundary.md#actor-direct-authoring-ceiling Produces or describes bounded blocking-proxy face data while keeping directly authored likeness at the declared ceiling.
   * @evidence requirements/actors/representation-tiers-and-fidelity-boundary.md#actor-fidelity-capability-separation Carries appearance geometry or controls without inferring rig, motion, gaze, contact, or interaction capability.
   * @evidence specifications/performance-motion-and-staging/actor-identity-state-and-fidelity.md#performance-actor-representation-fidelity-boundary Carries actual proxy representation geometry or controls without promoting it to a higher-fidelity actor tier.
   * @evidence requirements/asset-authoring/validation.md#asset-geometry-validation Rejects or bounds invalid proxy coordinates and indices before they can silently become usable geometry.
   * @evidence specifications/asset-and-representation/fidelity-and-validation.md#asset-spec-validation-numeric-structure Carries the numeric or structural input and result surface used by the package's explicit bounded checks.
   * @evidence requirements/actors/pose-expression-and-gaze.md#actor-expression-channels Provides bounded named morph channels usable as coarse proxy facial cues without reconstructing detail or inferring expression.
   * @evidence specifications/performance-motion-and-staging/actor-identity-state-and-fidelity.md#performance-actor-pose-gaze-expression-state Carries the morph-channel part of proxy facial state while pose, gaze, timing, and authority remain caller-owned.
   * @evidence requirements/asset-authoring/rig-and-state.md#asset-deformable-surface Defines or applies morph deltas against explicit base geometry without changing its topology.
   * @evidence specifications/asset-and-representation/rig-deformation-and-state.md#asset-spec-skin-morph-facts Carries named base-relative morph facts and bounded application over matching proxy geometry.
   * @evidence specifications/performance-motion-and-staging/rig-deformation-and-retargeting.md#performance-rig-skin-rigid-morph-deformation Provides the morph deformation mode only; no skeleton, skinning, retargeting, or hidden fidelity is introduced.
   * @evidence requirements/asset-authoring/geometry.md#asset-composable-geometry-operations Performs a deterministic local geometry derivation that composes with the retained proxy pipeline.
   * @evidence specifications/asset-and-representation/model-geometry-and-surface-facts.md#asset-spec-geometry-operations-topology Preserves explicit coordinate or topology facts across the bounded derivation.
   */
  minus: ForgeHeadDelta[];
}

/**
 * Apply bipolar parameter morphs to a base position array.
 *
 * For each named parameter with a non-zero value, the matching direction
 * (`plus` for `v > 0`, `minus` for `v < 0`) is weighted by `|v|` and added onto
 * the base. Unknown names and zero values are skipped (host-facing
 * conveniences), but a delta whose vertex index lies outside the base is a
 * structural defect and throws: writing it would silently extend the array with
 * NaN holes (#1107). The base is not mutated; a new flat `xyz` array is
 * returned.
 *
 * This is the pure deformation primitive behind the parametric head editor, the
 * same additive model MakeHuman's `.target` system uses, kept independent of
 * any geometry source so it can be unit-tested in isolation.
 *
 * @author Samchon
 * @evidence requirements/product/scope-and-exclusions.md#product-detailed-likeness-exclusion This frozen compatibility declaration preserves legacy proxy data or helpers without claiming detailed likeness.
 * @evidence specifications/authoring-and-authority/prototype-determinism-and-fidelity.md#spec-authoring-fidelity-failure-choice This frozen compatibility declaration treats unsupported likeness as a fidelity failure, not prototype capability.
 * @evidence requirements/actors/representation-tiers-and-fidelity-boundary.md#actor-direct-authoring-ceiling Produces or describes bounded blocking-proxy face data while keeping directly authored likeness at the declared ceiling.
 * @evidence requirements/actors/representation-tiers-and-fidelity-boundary.md#actor-fidelity-capability-separation Carries appearance geometry or controls without inferring rig, motion, gaze, contact, or interaction capability.
 * @evidence specifications/performance-motion-and-staging/actor-identity-state-and-fidelity.md#performance-actor-representation-fidelity-boundary Carries actual proxy representation geometry or controls without promoting it to a higher-fidelity actor tier.
 * @evidence requirements/asset-authoring/validation.md#asset-geometry-validation Rejects or bounds invalid proxy coordinates and indices before they can silently become usable geometry.
 * @evidence specifications/asset-and-representation/fidelity-and-validation.md#asset-spec-validation-numeric-structure Carries the numeric or structural input and result surface used by the package's explicit bounded checks.
 * @evidence requirements/actors/pose-expression-and-gaze.md#actor-expression-channels Provides bounded named morph channels usable as coarse proxy facial cues without reconstructing detail or inferring expression.
 * @evidence specifications/performance-motion-and-staging/actor-identity-state-and-fidelity.md#performance-actor-pose-gaze-expression-state Carries the morph-channel part of proxy facial state while pose, gaze, timing, and authority remain caller-owned.
 * @evidence requirements/asset-authoring/rig-and-state.md#asset-deformable-surface Defines or applies morph deltas against explicit base geometry without changing its topology.
 * @evidence specifications/asset-and-representation/rig-deformation-and-state.md#asset-spec-skin-morph-facts Carries named base-relative morph facts and bounded application over matching proxy geometry.
 * @evidence specifications/performance-motion-and-staging/rig-deformation-and-retargeting.md#performance-rig-skin-rigid-morph-deformation Provides the morph deformation mode only; no skeleton, skinning, retargeting, or hidden fidelity is introduced.
 * @evidence requirements/asset-authoring/geometry.md#asset-composable-geometry-operations Performs a deterministic local geometry derivation that composes with the retained proxy pipeline.
 * @evidence specifications/asset-and-representation/model-geometry-and-surface-facts.md#asset-spec-geometry-operations-topology Preserves explicit coordinate or topology facts across the bounded derivation.
 */
export const morphHead = (
  base: number[],
  morphs: Record<string, IForgeHeadMorph>,
  values: Record<string, number>,
): number[] => {
  const out = base.slice();
  const vertexCount = base.length / 3;
  for (const [name, v] of Object.entries(values)) {
    if (!v) continue;
    const morph = morphs[name];
    if (morph === undefined) continue;
    const side = v > 0 ? morph.plus : morph.minus;
    const w = Math.abs(v);
    side.forEach(([li, dx, dy, dz], k) => {
      // An index outside the base reads `undefined`, and JavaScript would
      // silently EXTEND the array with NaN holes: poisoned vertices that
      // vanish or explode the bounds far from the defect, the same silent
      // NaN ride #1043 closed for the amplitude fit. A malformed morph
      // table is a structural defect and throws (#1107).
      if (!Number.isInteger(li) || li < 0 || li >= vertexCount)
        throw new Error(
          `morph "${name}" delta #${k} targets vertex ${li} outside the base's ${vertexCount} vertices`,
        );
      out[li * 3] = out[li * 3]! + dx * w;
      out[li * 3 + 1] = out[li * 3 + 1]! + dy * w;
      out[li * 3 + 2] = out[li * 3 + 2]! + dz * w;
    });
  }
  return out;
};
