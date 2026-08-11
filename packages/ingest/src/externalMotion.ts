import type {
  AutoMovieContentDigest,
  AutoMovieHumanoidBone,
  IAutoMovieClip,
  IAutoMovieSkeleton,
} from "@automovie/interface";

import type { IAutoMovieExternalModelInspection } from "./inspectExternalModelBytes";

/**
 * Manifest-owned identity of the exact external motion bytes selected by the
 * author.
 *
 * @author Samchon
 * @evidence requirements/motion/external-motion-inputs.md#motion-external-adoption-receipt The record retains the selected byte identity instead of overwriting the source.
 * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-external-adoption-receipt The receipt binds the selected source facts to the adopted take.
 */
export interface IAutoMovieExternalMotionSource {
  /**
   * Exact manifest path inspected by ingest.
   *
   * @evidence requirements/motion/external-motion-inputs.md#motion-external-source-basis The path identifies the exact inspected source container.
   * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-external-adoption-receipt The receipt keeps the source path as part of its input basis.
   */
  path: string;
  /**
   * Lowercase SHA-256 digest pinned by the production manifest.
   *
   * @evidence requirements/motion/external-motion-inputs.md#motion-external-adoption-receipt The digest pins the immutable source byte revision.
   * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-external-adoption-receipt The receipt carries the exact source digest into compilation.
   */
  digest: AutoMovieContentDigest;
  /**
   * Resident byte count cross-checked against the inspection.
   *
   * @evidence requirements/motion/external-motion-inputs.md#motion-external-source-basis The byte length cross-checks the selected source basis.
   * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-external-adoption-receipt The receipt rejects a source whose resident length differs from inspection.
   */
  byteLength: number;
}

/**
 * Author-selected node-to-humanoid correspondence for one source rig.
 *
 * @author Samchon
 * @evidence requirements/motion/external-motion-inputs.md#motion-external-compatibility-override The correspondence is supplied explicitly instead of inferred from names.
 * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-external-adoption-receipt The selected mapping becomes part of the adoption record.
 */
export interface IAutoMovieExternalMotionBoneMapping {
  /**
   * Stable node identity emitted by the byte inspector.
   *
   * @evidence requirements/motion/external-motion-inputs.md#motion-external-compatibility-override The node is selected from inspected identities, never guessed.
   * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-external-adoption-receipt The node identity is retained in the canonical mapping.
   */
  node: string;
  /**
   * Explicit semantic role on the declared source rig.
   *
   * @evidence requirements/motion/external-motion-inputs.md#motion-external-compatibility-override The semantic bone is an author-supplied compatibility choice.
   * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-external-adoption-receipt The bone choice is preserved beside its source node.
   */
  bone: AutoMovieHumanoidBone;
}

/**
 * Deliberate use mode for one selected external take.
 *
 * @evidence requirements/motion/external-motion-inputs.md#motion-external-adoption-mode The union requires an explicit native or retarget decision.
 * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-external-adoption-receipt The chosen mode is preserved in the returned receipt.
 */
export type AutoMovieExternalMotionAdoptionDecision =
  | IAutoMovieExternalMotionNativeDecision
  | IAutoMovieExternalMotionRetargetDecision;

/**
 * Native use keeps the inspected node tracks and performs no rig inference.
 *
 * @author Samchon
 * @evidence requirements/motion/external-motion-inputs.md#motion-external-adoption-mode Native use is an explicit choice that preserves source channels.
 * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-external-adoption-receipt The native decision is retained as receipt input.
 */
export interface IAutoMovieExternalMotionNativeDecision {
  /**
   * Explicit mode discriminator.
   *
   * @evidence requirements/motion/external-motion-inputs.md#motion-external-adoption-mode The discriminator prevents ingest from changing adoption mode.
   * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-external-adoption-receipt The native mode is recorded unchanged.
   */
  mode: "native";
  /**
   * Stable inspected take id selected by the author.
   *
   * @evidence requirements/motion/external-motion-inputs.md#motion-external-inputs-adoption The author identifies the exact take to adopt.
   * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-external-adoption-receipt The selected take id is part of the decision basis.
   */
  take: string;
  /**
   * Normalized source skeleton whose rest basis the caller selected.
   *
   * @evidence requirements/motion/external-motion-inputs.md#motion-external-source-basis Native semantic conversion uses the explicitly declared source rest basis.
   * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-external-adoption-receipt The source rig is retained as native receipt input.
   */
  sourceRig: IAutoMovieSkeleton;
  /**
   * Explicit track-node to source-bone mapping; ingest never name-matches it.
   *
   * @evidence requirements/motion/external-motion-inputs.md#motion-external-compatibility-override Native conversion uses the author's semantic correspondence.
   * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-external-adoption-receipt The exact mapping is retained in canonical order.
   */
  mapping: IAutoMovieExternalMotionBoneMapping[];
}

/**
 * Retarget use supplies the source rig, semantic mapping, and target identity
 * without guessing any of them inside ingest.
 *
 * @author Samchon
 * @evidence requirements/motion/external-motion-inputs.md#motion-external-compatibility-override Retargeting proceeds only from the author's explicit compatibility inputs.
 * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-external-adoption-receipt The decision records mapping, source rig, and target identity.
 */
export interface IAutoMovieExternalMotionRetargetDecision {
  /**
   * Explicit mode discriminator.
   *
   * @evidence requirements/motion/external-motion-inputs.md#motion-external-adoption-mode The discriminator selects retargeting rather than direct playback.
   * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-external-adoption-receipt The retarget mode remains explicit in the receipt.
   */
  mode: "retarget";
  /**
   * Stable inspected take id selected by the author.
   *
   * @evidence requirements/motion/external-motion-inputs.md#motion-external-inputs-adoption The author identifies the exact take to retarget.
   * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-external-adoption-receipt The selected take id remains part of the retarget decision.
   */
  take: string;
  /**
   * Normalized source skeleton whose rest basis the caller selected.
   *
   * @evidence requirements/motion/external-motion-inputs.md#motion-external-source-basis The declared source rig fixes the rest and hierarchy basis.
   * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-external-adoption-receipt The source rig is retained as retarget receipt input.
   */
  sourceRig: IAutoMovieSkeleton;
  /**
   * Explicit track-node to source-bone mapping; ingest never name-matches it.
   *
   * @evidence requirements/motion/external-motion-inputs.md#motion-external-compatibility-override Mapping is an explicit author decision and never name-inferred.
   * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-external-adoption-receipt The exact mapping is retained in canonical order.
   */
  mapping: IAutoMovieExternalMotionBoneMapping[];
  /**
   * Explicit multiplier for source root translation during retargeting.
   *
   * @evidence requirements/motion/retargeting-and-scale.md#motion-retarget-proportion The author fixes root translation scale instead of delegating a guess to ingest.
   * @evidence specifications/performance-motion-and-staging/rig-deformation-and-retargeting.md#performance-rig-retarget-preservation-failure The handoff retains the chosen scale for downstream retarget diagnostics.
   * @evidence specifications/performance-motion-and-staging/kinematics-contact-and-interaction.md#performance-kinematics-retarget-scale-contact Supplies the explicit root scale consumed by the retarget scale stage.
   */
  translationScale: number;
  /**
   * Stable target rig or actor identity to resolve after ingest.
   *
   * @evidence requirements/motion/retargeting-and-scale.md#motion-retarget-mapping-selection The author chooses the target identity before the engine resolves it.
   * @evidence specifications/performance-motion-and-staging/rig-deformation-and-retargeting.md#performance-rig-retarget-preservation-failure The target identity is retained for field-located downstream failure.
   * @evidence specifications/performance-motion-and-staging/kinematics-contact-and-interaction.md#performance-kinematics-retarget-scale-contact Supplies the explicit target selected for the retarget scale stage.
   */
  target: string;
}

/**
 * Inspection-to-compiler handoff for a requested native node-track conversion.
 * The compiler still decides whether interpolation and channel completeness can
 * be represented as clinical motion.
 *
 * @author Samchon
 * @evidence requirements/motion/external-motion-inputs.md#motion-external-compatibility-override The handoff contains only validated explicit compatibility inputs.
 * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-external-adoption-receipt The handoff preserves the selected mapping and rig identities.
 */
export interface IAutoMovieExternalMotionNativeHandoff {
  /**
   * Explicit mode discriminator.
   *
   * @evidence requirements/motion/external-motion-inputs.md#motion-external-adoption-mode Native conversion remains distinguishable from retargeting.
   * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-external-adoption-receipt The handoff records native mode unchanged.
   */
  mode: "native";
  /**
   * Declared source skeleton, defensively copied for the handoff.
   *
   * @evidence requirements/motion/external-motion-inputs.md#motion-external-source-basis The source rig fixes native quaternion-to-semantic conversion.
   * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-external-adoption-receipt The handoff retains the validated rig revision.
   */
  sourceRig: IAutoMovieSkeleton;
  /**
   * Canonically ordered explicit node-to-bone correspondence.
   *
   * @evidence requirements/motion/external-motion-inputs.md#motion-external-compatibility-override Canonical entries preserve each explicit native mapping choice.
   * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-external-adoption-receipt The receipt records the mapping in deterministic order.
   */
  mapping: IAutoMovieExternalMotionBoneMapping[];
}

/**
 * Inspection-to-compiler handoff for a requested engine-owned retarget
 * operation. Source conversion and source-target compatibility remain explicit
 * downstream validation boundaries.
 *
 * @author Samchon
 * @evidence requirements/motion/external-motion-inputs.md#motion-external-compatibility-override The handoff contains only validated explicit compatibility inputs.
 * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-external-adoption-receipt The handoff preserves the selected mapping and rig identities.
 */
export interface IAutoMovieExternalMotionRetargetHandoff {
  /**
   * Explicit mode discriminator.
   *
   * @evidence requirements/motion/external-motion-inputs.md#motion-external-adoption-mode Retarget conversion remains distinguishable from native use.
   * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-external-adoption-receipt The handoff records retarget mode unchanged.
   */
  mode: "retarget";
  /**
   * Declared source skeleton, defensively copied for the handoff.
   *
   * @evidence requirements/motion/external-motion-inputs.md#motion-external-source-basis The copied source rig fixes the handoff's rest basis.
   * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-external-adoption-receipt The handoff retains the validated rig revision.
   */
  sourceRig: IAutoMovieSkeleton;
  /**
   * Canonically ordered explicit node-to-bone correspondence.
   *
   * @evidence requirements/motion/external-motion-inputs.md#motion-external-compatibility-override Canonical entries preserve each explicit node-to-bone choice.
   * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-external-adoption-receipt The receipt records the mapping in deterministic order.
   */
  mapping: IAutoMovieExternalMotionBoneMapping[];
  /**
   * Validated finite-positive root translation multiplier.
   *
   * @evidence requirements/motion/retargeting-and-scale.md#motion-retarget-proportion Explicit scaling makes proportion correction reproducible.
   * @evidence specifications/performance-motion-and-staging/rig-deformation-and-retargeting.md#performance-rig-retarget-preservation-failure The retarget executor receives the exact requested scale.
   * @evidence specifications/performance-motion-and-staging/kinematics-contact-and-interaction.md#performance-kinematics-retarget-scale-contact Carries the validated scale into the downstream retarget stage.
   */
  translationScale: number;
  /**
   * Target identity selected by the author and resolved by the compiler.
   *
   * @evidence requirements/motion/retargeting-and-scale.md#motion-retarget-mapping-selection The selected target is never replaced by an inferred rig.
   * @evidence specifications/performance-motion-and-staging/rig-deformation-and-retargeting.md#performance-rig-retarget-preservation-failure The downstream retargeter receives the exact target identity for diagnostics.
   * @evidence specifications/performance-motion-and-staging/kinematics-contact-and-interaction.md#performance-kinematics-retarget-scale-contact Carries the selected target into the downstream retarget stage.
   */
  target: string;
}

/**
 * Non-destructive result connecting one byte-pinned take to native playback or
 * a later engine retarget pass.
 *
 * @author Samchon
 * @evidence requirements/motion/external-motion-inputs.md#motion-external-adoption-receipt The result preserves byte, take, mode, mapping, and rig choices.
 * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-external-adoption-receipt The result is the deterministic adoption receipt passed onward.
 */
export interface IAutoMovieExternalMotionAdoption {
  /**
   * Byte identity retained in the adoption receipt.
   *
   * @evidence requirements/motion/external-motion-inputs.md#motion-external-adoption-receipt Source identity remains available for staleness and provenance checks.
   * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-external-adoption-receipt The receipt exposes its immutable input identity.
   */
  source: IAutoMovieExternalMotionSource;
  /**
   * Chosen native or retarget mode.
   *
   * @evidence requirements/motion/external-motion-inputs.md#motion-external-adoption-mode The result states which author-selected mode was used.
   * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-external-adoption-receipt The adopted mode is retained beside the take.
   */
  mode: AutoMovieExternalMotionAdoptionDecision["mode"];
  /**
   * Selected take with source-order tracks and canonical numeric samples.
   *
   * @evidence requirements/motion/external-motion-inputs.md#motion-external-inputs-adoption The result exposes exactly the take selected by the author.
   * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-external-adoption-receipt The selected normalized samples are tied to the receipt.
   */
  take: IAutoMovieClip;
  /**
   * Explicit native-conversion or retarget inputs.
   *
   * @evidence requirements/motion/external-motion-inputs.md#motion-external-adoption-mode The discriminated handoff preserves native or retarget mode.
   * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-external-adoption-receipt The handoff records every semantic-conversion input.
   */
  handoff:
    | IAutoMovieExternalMotionNativeHandoff
    | IAutoMovieExternalMotionRetargetHandoff;
}

/**
 * Select one inspected take and validate the author's native-use or retarget
 * decision without fetching bytes, choosing a provider, or inferring a rig.
 *
 * @evidence requirements/asset-authoring/README.md#자산-저작-요구사항 Exposes external motion adoption as a reusable asset-pipeline capability.
 * @evidence requirements/external-inputs/README.md#외부-입력-요구사항 Applies the shared external-input boundary to selected motion bytes.
 * @evidence requirements/motion/README.md#동작-요구사항 Makes imported node-track motion available to the production motion pipeline.
 * @evidence specifications/asset-and-representation/README.md#자산과-표현-시스템-사양 Carries source and rig identities across the external-asset boundary.
 * @evidence specifications/interchange-and-adoption/README.md#interchange와-adoption-시스템-계약 Implements an inspection-to-adoption handoff under the interchange contract.
 * @evidence specifications/performance-motion-and-staging/README.md#퍼포먼스-모션과-스테이징-시스템-명세 Supplies selected motion facts to the downstream performance pipeline.
 * @evidence requirements/external-inputs/conversion-receipts-and-determinism.md#external-conversion-receipt-inputs The handoff retains digest, byte length, take, mode, mapping, source rig, target, and translation scale.
 * @evidence requirements/external-inputs/conversion-receipts-and-determinism.md#external-conversion-receipt-mapping Canonically ordered node-to-bone entries preserve the explicit source-result correspondence.
 * @evidence requirements/external-inputs/identity-coordinates-and-units.md#external-identity-source-revision Path, lowercase SHA-256 digest, and resident byte length identify the immutable selected revision.
 * @evidence specifications/asset-and-representation/identity-resources-and-lifecycle.md#asset-spec-source-revision-content The adoption source keeps locator and content digest distinct and byte-pinned.
 * @evidence specifications/asset-and-representation/identity-resources-and-lifecycle.md#asset-spec-adoption-output The result exposes the selected motion mode, source, take, and explicit semantic-conversion handoff.
 * @evidence specifications/interchange-and-adoption/identity-coordinates-and-units.md#interchange-source-revision-identity The handoff carries the caller-pinned source path, digest, and byte count without retrieval.
 * @evidenceExclude requirements/motion/channels-controls-and-drivers.md#motion-channel-dependencies Ingest preserves imported tracks but does not define general control ownership, driver dependencies, additive channel registration, or driver evaluation.
 * @evidenceExclude requirements/motion/channels-controls-and-drivers.md#motion-channel-control-ownership Ingest preserves imported tracks but does not define general control ownership, driver dependencies, additive channel registration, or driver evaluation.
 * @evidenceExclude requirements/motion/channels-controls-and-drivers.md#motion-channel-extensibility Ingest preserves imported tracks but does not define general control ownership, driver dependencies, additive channel registration, or driver evaluation.
 * @evidenceExclude requirements/motion/channels-controls-and-drivers.md#motion-channel-driver-refusal Ingest preserves imported tracks but does not define general control ownership, driver dependencies, additive channel registration, or driver evaluation.
 * @evidenceExclude requirements/motion/constraints-and-inverse-kinematics.md#motion-range-of-motion Ingest does not execute ROM, target-space constraint, solve-order, coupled-driver, reachability, or bounded IK decisions.
 * @evidenceExclude requirements/motion/constraints-and-inverse-kinematics.md#motion-constraint-target-space Ingest does not execute ROM, target-space constraint, solve-order, coupled-driver, reachability, or bounded IK decisions.
 * @evidenceExclude requirements/motion/constraints-and-inverse-kinematics.md#motion-constraint-solve-order Ingest does not execute ROM, target-space constraint, solve-order, coupled-driver, reachability, or bounded IK decisions.
 * @evidenceExclude requirements/motion/constraints-and-inverse-kinematics.md#motion-coupled-range-drivers Ingest does not execute ROM, target-space constraint, solve-order, coupled-driver, reachability, or bounded IK decisions.
 * @evidenceExclude requirements/motion/constraints-and-inverse-kinematics.md#motion-constraint-reachability Ingest does not execute ROM, target-space constraint, solve-order, coupled-driver, reachability, or bounded IK decisions.
 * @evidenceExclude requirements/motion/constraints-and-inverse-kinematics.md#motion-constraint-solve-failure Ingest does not execute ROM, target-space constraint, solve-order, coupled-driver, reachability, or bounded IK decisions.
 * @evidenceExclude requirements/motion/contact-weight-and-support.md#motion-contact-phases Ingest carries no contact phase, authority, weight cue, moving-support solve, load-transfer, or contact finding.
 * @evidenceExclude requirements/motion/contact-weight-and-support.md#motion-contact-authority-tolerance Ingest carries no contact phase, authority, weight cue, moving-support solve, load-transfer, or contact finding.
 * @evidenceExclude requirements/motion/contact-weight-and-support.md#motion-weight-cues Ingest carries no contact phase, authority, weight cue, moving-support solve, load-transfer, or contact finding.
 * @evidenceExclude requirements/motion/contact-weight-and-support.md#motion-moving-support Ingest carries no contact phase, authority, weight cue, moving-support solve, load-transfer, or contact finding.
 * @evidenceExclude requirements/motion/contact-weight-and-support.md#motion-support-load-transfer Ingest carries no contact phase, authority, weight cue, moving-support solve, load-transfer, or contact finding.
 * @evidenceExclude requirements/motion/contact-weight-and-support.md#motion-contact-refusal Ingest carries no contact phase, authority, weight cue, moving-support solve, load-transfer, or contact finding.
 * @evidenceExclude requirements/motion/layers-blends-and-transitions.md#motion-layer-channel-ownership Ingest selects one source take and performs no layer ownership, masking, blending, phase alignment, event composition, or transition validation.
 * @evidenceExclude requirements/motion/layers-blends-and-transitions.md#motion-layer-mask-weight Ingest selects one source take and performs no layer ownership, masking, blending, phase alignment, event composition, or transition validation.
 * @evidenceExclude requirements/motion/layers-blends-and-transitions.md#motion-transition-window Ingest selects one source take and performs no layer ownership, masking, blending, phase alignment, event composition, or transition validation.
 * @evidenceExclude requirements/motion/layers-blends-and-transitions.md#motion-phase-alignment Ingest selects one source take and performs no layer ownership, masking, blending, phase alignment, event composition, or transition validation.
 * @evidenceExclude requirements/motion/layers-blends-and-transitions.md#motion-layer-event-composition Ingest selects one source take and performs no layer ownership, masking, blending, phase alignment, event composition, or transition validation.
 * @evidenceExclude requirements/motion/layers-blends-and-transitions.md#motion-blend-refusal Ingest selects one source take and performs no layer ownership, masking, blending, phase alignment, event composition, or transition validation.
 * @evidenceExclude requirements/motion/object-motion-and-interaction.md#motion-object-authored-vocabulary Ingest preserves generic node tracks but authors no object vocabulary, state transition, handoff, coupling, participant interaction, or interaction finding.
 * @evidenceExclude requirements/motion/object-motion-and-interaction.md#motion-object-state-transition Ingest preserves generic node tracks but authors no object vocabulary, state transition, handoff, coupling, participant interaction, or interaction finding.
 * @evidenceExclude requirements/motion/object-motion-and-interaction.md#motion-object-handoff Ingest preserves generic node tracks but authors no object vocabulary, state transition, handoff, coupling, participant interaction, or interaction finding.
 * @evidenceExclude requirements/motion/object-motion-and-interaction.md#motion-coupled-objects Ingest preserves generic node tracks but authors no object vocabulary, state transition, handoff, coupling, participant interaction, or interaction finding.
 * @evidenceExclude requirements/motion/object-motion-and-interaction.md#motion-multi-subject-interaction Ingest preserves generic node tracks but authors no object vocabulary, state transition, handoff, coupling, participant interaction, or interaction finding.
 * @evidenceExclude requirements/motion/object-motion-and-interaction.md#motion-interaction-refusal Ingest preserves generic node tracks but authors no object vocabulary, state transition, handoff, coupling, participant interaction, or interaction finding.
 * @evidenceExclude requirements/motion/procedural-motion-and-gaits.md#motion-procedural-rule-selection Ingest adopts fixed source samples and performs no procedural rule choice, gait generation, seeded variation, terrain adaptation, or solver budgeting.
 * @evidenceExclude requirements/motion/procedural-motion-and-gaits.md#motion-gait-table Ingest adopts fixed source samples and performs no procedural rule choice, gait generation, seeded variation, terrain adaptation, or solver budgeting.
 * @evidenceExclude requirements/motion/procedural-motion-and-gaits.md#motion-general-procedural-control Ingest adopts fixed source samples and performs no procedural rule choice, gait generation, seeded variation, terrain adaptation, or solver budgeting.
 * @evidenceExclude requirements/motion/procedural-motion-and-gaits.md#motion-procedural-variation Ingest adopts fixed source samples and performs no procedural rule choice, gait generation, seeded variation, terrain adaptation, or solver budgeting.
 * @evidenceExclude requirements/motion/procedural-motion-and-gaits.md#motion-terrain-adaptation Ingest adopts fixed source samples and performs no procedural rule choice, gait generation, seeded variation, terrain adaptation, or solver budgeting.
 * @evidenceExclude requirements/motion/procedural-motion-and-gaits.md#motion-procedural-bound Ingest adopts fixed source samples and performs no procedural rule choice, gait generation, seeded variation, terrain adaptation, or solver budgeting.
 * @evidenceExclude requirements/motion/root-motion-and-trajectories.md#motion-root-authority-mode Ingest preserves source translation tracks but chooses no root authority, trajectory, warp, facing, clearance, or path refusal policy.
 * @evidenceExclude requirements/motion/root-motion-and-trajectories.md#motion-path-timing Ingest preserves source translation tracks but chooses no root authority, trajectory, warp, facing, clearance, or path refusal policy.
 * @evidenceExclude requirements/motion/root-motion-and-trajectories.md#motion-path-fit-warp Ingest preserves source translation tracks but chooses no root authority, trajectory, warp, facing, clearance, or path refusal policy.
 * @evidenceExclude requirements/motion/root-motion-and-trajectories.md#motion-facing-travel Ingest preserves source translation tracks but chooses no root authority, trajectory, warp, facing, clearance, or path refusal policy.
 * @evidenceExclude requirements/motion/root-motion-and-trajectories.md#motion-root-ground-clearance Ingest preserves source translation tracks but chooses no root authority, trajectory, warp, facing, clearance, or path refusal policy.
 * @evidenceExclude requirements/motion/root-motion-and-trajectories.md#motion-trajectory-refusal Ingest preserves source translation tracks but chooses no root authority, trajectory, warp, facing, clearance, or path refusal policy.
 * @evidence requirements/motion/scope-and-identity.md#motion-source-kinds The glTF motion profile and byte-pinned source distinguish an imported clip from authored or procedural motion.
 * @evidence requirements/motion/scope-and-identity.md#motion-variant-selection The caller explicitly selects one immutable take and native or retarget decision without overwriting alternatives.
 * @evidenceExclude requirements/motion/scope-and-identity.md#motion-meaning-technique Ingest exposes imported source facts but does not own the complete production motion identity, semantic action, performer state, or final-source resolution.
 * @evidence requirements/motion/scope-and-identity.md#motion-missing-refusal Missing takes, targets, mappings, and source facts fail instead of producing a default clip.
 * @evidenceExclude requirements/motion/secondary-motion.md#motion-secondary-author-solver Ingest performs no secondary-motion authoring, solver selection, moving-boundary sampling, compatibility execution, or simulation claim.
 * @evidenceExclude requirements/motion/secondary-motion.md#motion-secondary-adoption-choice Ingest performs no secondary-motion authoring, solver selection, moving-boundary sampling, compatibility execution, or simulation claim.
 * @evidenceExclude requirements/motion/secondary-motion.md#motion-secondary-moving-boundary Ingest performs no secondary-motion authoring, solver selection, moving-boundary sampling, compatibility execution, or simulation claim.
 * @evidenceExclude requirements/motion/secondary-motion.md#motion-secondary-static-compatibility Ingest performs no secondary-motion authoring, solver selection, moving-boundary sampling, compatibility execution, or simulation claim.
 * @evidenceExclude requirements/motion/secondary-motion.md#motion-secondary-claim-boundary Ingest performs no secondary-motion authoring, solver selection, moving-boundary sampling, compatibility execution, or simulation claim.
 * @evidenceExclude requirements/motion/timing-and-semantic-events.md#motion-event-markers Ingest preserves key times but owns no story/film clock mapping, semantic event identity, retiming, boundary event sampling, or timing finding.
 * @evidenceExclude requirements/motion/timing-and-semantic-events.md#motion-event-identity-payload Ingest preserves key times but owns no story/film clock mapping, semantic event identity, retiming, boundary event sampling, or timing finding.
 * @evidenceExclude requirements/motion/timing-and-semantic-events.md#motion-story-film-time Ingest preserves key times but owns no story/film clock mapping, semantic event identity, retiming, boundary event sampling, or timing finding.
 * @evidenceExclude requirements/motion/timing-and-semantic-events.md#motion-boundary-sampling Ingest preserves key times but owns no story/film clock mapping, semantic event identity, retiming, boundary event sampling, or timing finding.
 * @evidenceExclude requirements/motion/timing-and-semantic-events.md#motion-retime-event-preservation Ingest preserves key times but owns no story/film clock mapping, semantic event identity, retiming, boundary event sampling, or timing finding.
 * @evidenceExclude requirements/motion/timing-and-semantic-events.md#motion-timing-refusal Ingest preserves key times but owns no story/film clock mapping, semantic event identity, retiming, boundary event sampling, or timing finding.
 * @evidenceExclude specifications/performance-motion-and-staging/actor-identity-state-and-fidelity.md#performance-actor-story-performance-state Ingest normalizes asset and motion facts but owns no actor story identity, continuity, appearance, voice, gaze, population, fidelity, or actor validation result.
 * @evidenceExclude specifications/performance-motion-and-staging/actor-identity-state-and-fidelity.md#performance-actor-state-continuity-ledger Ingest normalizes asset and motion facts but owns no actor story identity, continuity, appearance, voice, gaze, population, fidelity, or actor validation result.
 * @evidenceExclude specifications/performance-motion-and-staging/actor-identity-state-and-fidelity.md#performance-actor-appearance-costume-attachment Ingest normalizes asset and motion facts but owns no actor story identity, continuity, appearance, voice, gaze, population, fidelity, or actor validation result.
 * @evidenceExclude specifications/performance-motion-and-staging/actor-identity-state-and-fidelity.md#performance-actor-voice-utterance-expression Ingest normalizes asset and motion facts but owns no actor story identity, continuity, appearance, voice, gaze, population, fidelity, or actor validation result.
 * @evidenceExclude specifications/performance-motion-and-staging/actor-identity-state-and-fidelity.md#performance-actor-pose-gaze-expression-state Ingest normalizes asset and motion facts but owns no actor story identity, continuity, appearance, voice, gaze, population, fidelity, or actor validation result.
 * @evidenceExclude specifications/performance-motion-and-staging/actor-identity-state-and-fidelity.md#performance-actor-representation-fidelity-boundary Ingest normalizes asset and motion facts but owns no actor story identity, continuity, appearance, voice, gaze, population, fidelity, or actor validation result.
 * @evidenceExclude specifications/performance-motion-and-staging/actor-identity-state-and-fidelity.md#performance-actor-population-double-variation Ingest normalizes asset and motion facts but owns no actor story identity, continuity, appearance, voice, gaze, population, fidelity, or actor validation result.
 * @evidenceExclude specifications/performance-motion-and-staging/actor-identity-state-and-fidelity.md#performance-actor-validation-output-compatibility Ingest normalizes asset and motion facts but owns no actor story identity, continuity, appearance, voice, gaze, population, fidelity, or actor validation result.
 * @evidenceExclude specifications/performance-motion-and-staging/formation-identity-layout-and-terrain.md#performance-formation-hierarchy-membership-command Ingest creates no formation membership, layout, spacing, variation, terrain, sounding, or compact-population representation.
 * @evidenceExclude specifications/performance-motion-and-staging/formation-identity-layout-and-terrain.md#performance-formation-layout-slot-assignment Ingest creates no formation membership, layout, spacing, variation, terrain, sounding, or compact-population representation.
 * @evidenceExclude specifications/performance-motion-and-staging/formation-identity-layout-and-terrain.md#performance-formation-spacing-overlap-avoidance Ingest creates no formation membership, layout, spacing, variation, terrain, sounding, or compact-population representation.
 * @evidenceExclude specifications/performance-motion-and-staging/formation-identity-layout-and-terrain.md#performance-formation-hero-variation-group-state Ingest creates no formation membership, layout, spacing, variation, terrain, sounding, or compact-population representation.
 * @evidenceExclude specifications/performance-motion-and-staging/formation-identity-layout-and-terrain.md#performance-formation-sounding-membership-handoff Ingest creates no formation membership, layout, spacing, variation, terrain, sounding, or compact-population representation.
 * @evidenceExclude specifications/performance-motion-and-staging/formation-identity-layout-and-terrain.md#performance-formation-compact-representation-compatibility Ingest creates no formation membership, layout, spacing, variation, terrain, sounding, or compact-population representation.
 * @evidenceExclude specifications/performance-motion-and-staging/formation-motion-resolution-and-budgets.md#performance-formation-member-exception-command-event Ingest performs no formation exception resolution, framing/culling bounds, population motion validation, budget, status, or replay decision.
 * @evidenceExclude specifications/performance-motion-and-staging/formation-motion-resolution-and-budgets.md#performance-formation-bounds-framing-culling-failures Ingest performs no formation exception resolution, framing/culling bounds, population motion validation, budget, status, or replay decision.
 * @evidenceExclude specifications/performance-motion-and-staging/formation-motion-resolution-and-budgets.md#performance-formation-geometry-layout-motion-validation Ingest performs no formation exception resolution, framing/culling bounds, population motion validation, budget, status, or replay decision.
 * @evidenceExclude specifications/performance-motion-and-staging/formation-motion-resolution-and-budgets.md#performance-formation-determinism-status-compatibility Ingest performs no formation exception resolution, framing/culling bounds, population motion validation, budget, status, or replay decision.
 * @evidenceExclude specifications/performance-motion-and-staging/kinematics-contact-and-interaction.md#performance-kinematics-procedural-gait-rule Ingest does not execute gait, contact, gaze, interaction, secondary simulation, retarget solve, or deterministic kinematics validation.
 * @evidenceExclude specifications/performance-motion-and-staging/kinematics-contact-and-interaction.md#performance-contact-phase-weight-support Ingest does not execute gait, contact, gaze, interaction, secondary simulation, retarget solve, or deterministic kinematics validation.
 * @evidenceExclude specifications/performance-motion-and-staging/kinematics-contact-and-interaction.md#performance-kinematics-gaze-expression-attention Ingest does not execute gait, contact, gaze, interaction, secondary simulation, retarget solve, or deterministic kinematics validation.
 * @evidenceExclude specifications/performance-motion-and-staging/kinematics-contact-and-interaction.md#performance-interaction-attachment-object-handoff Ingest does not execute gait, contact, gaze, interaction, secondary simulation, retarget solve, or deterministic kinematics validation.
 * @evidenceExclude specifications/performance-motion-and-staging/kinematics-contact-and-interaction.md#performance-secondary-motion-boundary-choice Ingest does not execute gait, contact, gaze, interaction, secondary simulation, retarget solve, or deterministic kinematics validation.
 * @evidence specifications/performance-motion-and-staging/kinematics-contact-and-interaction.md#performance-kinematics-retarget-scale-contact Validates and carries the explicit source mapping, target identity, and translation scale consumed by the downstream retarget stage.
 * @evidenceExclude specifications/performance-motion-and-staging/kinematics-contact-and-interaction.md#performance-interaction-determinism-compatibility Ingest does not execute gait, contact, gaze, interaction, secondary simulation, retarget solve, or deterministic kinematics validation.
 * @evidenceExclude specifications/performance-motion-and-staging/staging-events-coverage-and-validation.md#performance-staging-event-boundary-sampling-output Ingest emits no staging events, contract coverage, continuity assessment, replay result, or viewer evidence.
 * @evidenceExclude specifications/performance-motion-and-staging/staging-events-coverage-and-validation.md#performance-staging-contract-realization-acceptance-status Ingest emits no staging events, contract coverage, continuity assessment, replay result, or viewer evidence.
 * @evidenceExclude specifications/performance-motion-and-staging/staging-events-coverage-and-validation.md#performance-staging-take-continuity-edit-compatibility Ingest emits no staging events, contract coverage, continuity assessment, replay result, or viewer evidence.
 * @evidenceExclude specifications/performance-motion-and-staging/staging-events-coverage-and-validation.md#performance-staging-deterministic-replay-failure-result Ingest emits no staging events, contract coverage, continuity assessment, replay result, or viewer evidence.
 * @evidenceExclude specifications/performance-motion-and-staging/staging-events-coverage-and-validation.md#performance-staging-viewer-evidence-prototype-ceiling Ingest emits no staging events, contract coverage, continuity assessment, replay result, or viewer evidence.
 * @evidenceExclude specifications/performance-motion-and-staging/staging-space-state-and-choreography.md#performance-staging-mark-surface-zone-membership Ingest owns no stage mark, zone, surface, choreography, visibility, reveal, readability, or staging-state freshness decision.
 * @evidenceExclude specifications/performance-motion-and-staging/staging-space-state-and-choreography.md#performance-staging-interaction-choreography-role Ingest owns no stage mark, zone, surface, choreography, visibility, reveal, readability, or staging-state freshness decision.
 * @evidenceExclude specifications/performance-motion-and-staging/staging-space-state-and-choreography.md#performance-staging-visibility-reveal-readability Ingest owns no stage mark, zone, surface, choreography, visibility, reveal, readability, or staging-state freshness decision.
 * @evidenceExclude specifications/performance-motion-and-staging/staging-space-state-and-choreography.md#performance-staging-compatibility-stale-state Ingest owns no stage mark, zone, surface, choreography, visibility, reveal, readability, or staging-state freshness decision.
 * @evidence requirements/asset-authoring/external-assets.md#asset-external-adoption-mode The returned receipt preserves the caller's native or retarget choice.
 * @evidenceExclude requirements/asset-authoring/external-assets.md#asset-external-group-composition Group membership and placement belong to the production composition layer.
 * @evidence requirements/asset-authoring/external-assets.md#asset-external-conversion-receipt The handoff records source identity, take, mode, mapping, rig, target, and scale.
 * @evidence requirements/asset-authoring/external-assets.md#asset-external-provenance-digest The source receipt carries the manifest-pinned digest and byte length.
 * @evidenceExclude requirements/asset-authoring/external-assets.md#asset-bounded-decoder Byte decoding and expansion bounds are enforced by the preceding inspector.
 * @evidenceExclude requirements/asset-authoring/external-assets.md#asset-external-resource-closure Sidecar closure is proved by inspection before this pure adoption step.
 * @evidence requirements/asset-authoring/external-assets.md#asset-semantic-enrichment The explicit node-to-bone map is a separate author-supplied semantic layer.
 * @evidenceExclude requirements/asset-authoring/external-assets.md#asset-external-replacement This function creates no asset replacement or dependent-revision ledger.
 * @evidence requirements/asset-authoring/external-assets.md#asset-external-secret-boundary Its API accepts no credential, provider, or network authority.
 * @evidenceExclude requirements/external-inputs/adoption-modes-and-composition.md#external-adoption-direct-placement The supported native motion result is not a direct-placement scene graph.
 * @evidence requirements/external-inputs/adoption-modes-and-composition.md#external-adoption-native-reinterpretation Native mode deterministically rewrites selected source facts into project node tracks.
 * @evidenceExclude requirements/external-inputs/adoption-modes-and-composition.md#external-adoption-group-composition This handoff does not create group membership or placement relations.
 * @evidence requirements/external-inputs/adoption-modes-and-composition.md#external-adoption-selection-overrides The caller names one take, mode, mapping, source rig, target, and scale explicitly.
 * @evidenceExclude requirements/external-inputs/adoption-modes-and-composition.md#external-adoption-intent-persistence Persistence and relink replay belong to the compiler-owned adoption record store.
 * @evidence requirements/motion/clips-keyframes-and-interpolation.md#motion-key-times Preserves the inspector-validated ordered key times.
 * @evidence requirements/motion/clips-keyframes-and-interpolation.md#motion-interpolation Preserves the declared glTF interpolation mode for every track.
 * @evidenceExclude requirements/motion/clips-keyframes-and-interpolation.md#motion-sparse-channel-default Sparse-channel playback defaults are an engine sampling concern.
 * @evidenceExclude requirements/motion/clips-keyframes-and-interpolation.md#motion-loop-trim No trim or loop override is accepted by this adoption handoff.
 * @evidence requirements/motion/clips-keyframes-and-interpolation.md#motion-clip-refusal Rejects missing takes, unmapped targets, and unsupported retarget channels explicitly.
 * @evidence requirements/motion/retargeting-and-scale.md#motion-retarget-source-provenance Retains source bytes, selected take, source rig, mapping, and target identity.
 * @evidence requirements/motion/retargeting-and-scale.md#motion-retarget-proportion Requires an explicit finite-positive root translation scale.
 * @evidenceExclude requirements/motion/retargeting-and-scale.md#motion-retarget-non-humanoid The handoff deliberately supports normalized humanoid bone roles only.
 * @evidenceExclude requirements/motion/retargeting-and-scale.md#motion-retarget-contact-preservation Contact re-solving is performed by the downstream engine retargeter.
 * @evidence requirements/motion/retargeting-and-scale.md#motion-retarget-refusal Rejects ambiguous maps, absent hips, and unsupported scale or weight tracks.
 * @evidenceExclude requirements/motion/validation-and-determinism.md#motion-evaluation-receipt This adoption receipt supplies evaluator inputs but does not issue a motion-evaluation receipt.
 * @evidenceExclude requirements/motion/validation-and-determinism.md#motion-scrambled-seek This pre-sampling handoff has no playback or seek state.
 * @evidenceExclude requirements/motion/validation-and-determinism.md#motion-fixed-step-baked-state Stateful solvers and baked caches are downstream engine responsibilities.
 * @evidenceExclude requirements/motion/validation-and-determinism.md#motion-interior-sample-validation Interior pose evaluation occurs after the clip is retargeted and sampled.
 * @evidenceExclude requirements/motion/validation-and-determinism.md#motion-numeric-stability Local input checks do not implement the downstream sampler's long-duration numeric-stability contract.
 * @evidenceExclude requirements/motion/validation-and-determinism.md#motion-visual-review This pure ingest handoff neither renders nor issues a visual-review verdict.
 * @evidenceExclude requirements/motion/validation-and-determinism.md#motion-validation-status Structured pipeline validation status is emitted by compiler and engine layers.
 * @evidenceExclude specifications/asset-and-representation/alternatives-instances-and-groups.md#asset-spec-variant-inheritance A selected motion take defines no asset variant inheritance.
 * @evidenceExclude specifications/asset-and-representation/alternatives-instances-and-groups.md#asset-spec-prototype-instance No prototype or instance graph is created by motion adoption.
 * @evidenceExclude specifications/asset-and-representation/alternatives-instances-and-groups.md#asset-spec-instance-override-resolution Motion mapping is not an instance transform or material override.
 * @evidenceExclude specifications/asset-and-representation/alternatives-instances-and-groups.md#asset-spec-group-individuality No group members are synthesized or collapsed here.
 * @evidenceExclude specifications/asset-and-representation/alternatives-instances-and-groups.md#asset-spec-deterministic-instance-generation This function performs no population or instance generation.
 * @evidence specifications/asset-and-representation/alternatives-instances-and-groups.md#asset-spec-external-adoption-alternatives Native and retarget remain explicit alternatives with distinct receipts.
 * @evidence specifications/asset-and-representation/alternatives-instances-and-groups.md#asset-spec-alternative-selection-output The result states the selected take, mode, and retarget inputs.
 * @evidence specifications/asset-and-representation/alternatives-instances-and-groups.md#asset-spec-alternative-failure-compatibility Locally invalid mappings and channel kinds fail here; compiler and engine retain conversion-compatibility authority.
 * @evidenceExclude specifications/interchange-and-adoption/adoption-decisions-and-composition.md#interchange-direct-placement-boundary Native node-track conversion is not immutable direct scene placement.
 * @evidence specifications/interchange-and-adoption/adoption-decisions-and-composition.md#interchange-native-reinterpretation-boundary The selected take becomes a project-native clip while retaining source identity.
 * @evidenceExclude specifications/interchange-and-adoption/adoption-decisions-and-composition.md#interchange-group-composition-boundary This function owns no group relation graph.
 * @evidence specifications/interchange-and-adoption/adoption-decisions-and-composition.md#interchange-selection-override-resolution Selection resolves exact take and mapping identities without inference.
 * @evidenceExclude specifications/interchange-and-adoption/adoption-decisions-and-composition.md#interchange-adoption-intent-replay Relink and refresh replay are compiler persistence concerns.
 * @evidence specifications/interchange-and-adoption/conversion-receipts-and-determinism.md#interchange-receipt-input-basis The result retains digest, take, mode, mapping, rig, target, and scale inputs.
 * @evidence specifications/interchange-and-adoption/conversion-receipts-and-determinism.md#interchange-receipt-element-mapping Canonical node-to-bone entries preserve the source-element correspondence.
 * @evidenceExclude specifications/interchange-and-adoption/conversion-receipts-and-determinism.md#interchange-receipt-loss-ledger This validation-only stage applies no lossy conversion requiring a loss ledger.
 * @evidenceExclude specifications/interchange-and-adoption/conversion-receipts-and-determinism.md#interchange-canonical-receipt-result Result digest sealing belongs to the compiler after retarget execution.
 * @evidenceExclude specifications/interchange-and-adoption/conversion-receipts-and-determinism.md#interchange-nondeterministic-generation-boundary No generator, seed, platform-dependent codec, or network operation is invoked.
 * @evidenceExclude specifications/interchange-and-adoption/conversion-receipts-and-determinism.md#interchange-receipt-freshness-diff Staleness comparison belongs to the production revision store.
 * @evidenceExclude specifications/interchange-and-adoption/media-inspection-boundaries.md#interchange-image-video-inspection No raster or video input is accepted by this API.
 * @evidenceExclude specifications/interchange-and-adoption/media-inspection-boundaries.md#interchange-audio-inspection No audio input is accepted by this API.
 * @evidence specifications/interchange-and-adoption/media-inspection-boundaries.md#interchange-motion-inspection Consumes normalized take, node, time, interpolation, and channel facts.
 * @evidenceExclude specifications/interchange-and-adoption/media-inspection-boundaries.md#interchange-spatial-data-inspection No map, survey, raster, or vector spatial data is accepted.
 * @evidenceExclude specifications/interchange-and-adoption/media-inspection-boundaries.md#interchange-text-metadata-inspection No text document or instruction-bearing metadata is interpreted.
 * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-clip-keytime-interpolation The returned clip retains validated ordered samples and interpolation.
 * @evidenceExclude specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-layer-mask-transition-composition No layer, mask, blend, or transition is composed during adoption.
 * @evidenceExclude specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-clock-semantic-event The glTF subset exposes no semantic event or story-clock mapping here.
 * @evidenceExclude specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-deterministic-sampling-validation Runtime sampling and validation receipts are emitted downstream.
 * @evidence specifications/performance-motion-and-staging/rig-deformation-and-retargeting.md#performance-rig-semantic-joint-mapping Requires an explicit one-to-one node-to-humanoid-bone map.
 * @evidenceExclude specifications/performance-motion-and-staging/rig-deformation-and-retargeting.md#performance-rig-rom-control-driver-graph ROM and driver evaluation occur in the engine retarget pass.
 * @evidence specifications/performance-motion-and-staging/rig-deformation-and-retargeting.md#performance-rig-external-adoption-retarget-characterization Preserves source rig, target identity, semantic mapping, and root scale.
 * @evidence specifications/performance-motion-and-staging/rig-deformation-and-retargeting.md#performance-rig-retarget-preservation-failure Rejects incomplete local characterization before engine retargeting.
 * @evidence specifications/asset-and-representation/generated-assets-and-repaint-handoff.md#asset-spec-generation-credential-boundary Keeps provider credentials and network authority outside this pure adoption call.
 * @evidenceExclude specifications/performance-motion-and-staging/rig-deformation-and-retargeting.md#performance-rig-compatibility-fidelity-ceiling This data handoff makes no visual-fidelity or deformation-quality claim.
 * @evidence requirements/motion/external-motion-inputs.md#motion-external-inputs-adoption The function selects only the author-named take from inspected bytes.
 * @evidence requirements/motion/external-motion-inputs.md#motion-external-input-refusal Invalid source facts, mappings, rigs, and channels fail explicitly.
 * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-external-adoption-receipt The pure handoff preserves the selected source and adoption decision.
 */
export const adoptAutoMovieExternalMotion = (props: {
  inspection: IAutoMovieExternalModelInspection;
  source: IAutoMovieExternalMotionSource;
  decision: AutoMovieExternalMotionAdoptionDecision;
}): IAutoMovieExternalMotionAdoption => {
  if (props.inspection.profile !== "gltf-motion-v1")
    throw new Error(
      'External motion adoption requires the "gltf-motion-v1" inspection profile.',
    );
  const motion = props.inspection.motion;
  if (motion === undefined)
    throw new Error("External source has no inspected motion takes.");
  if (props.source.path.trim().length === 0)
    throw new Error("External motion source path must be non-blank.");
  if (props.source.path !== motion.path)
    throw new Error(
      `External motion source path "${props.source.path}" does not match inspected path "${motion.path}".`,
    );
  if (
    Number.isSafeInteger(props.source.byteLength) === false ||
    props.source.byteLength <= 0 ||
    props.source.byteLength !== motion.byteLength
  )
    throw new Error(
      `External motion source byteLength ${props.source.byteLength} does not match inspected byteLength ${motion.byteLength}.`,
    );
  if (DIGEST_PATTERN.test(props.source.digest) === false)
    throw new Error(
      `External motion source digest "${props.source.digest}" must be a lowercase SHA-256 digest.`,
    );
  const selected = motion.takes.find((take) => take.id === props.decision.take);
  if (selected === undefined)
    throw new Error(
      `External motion take "${props.decision.take}" is not present in the inspected source.`,
    );
  const source = { ...props.source };
  const take = cloneClip(selected);
  if (props.decision.mode !== "native" && props.decision.mode !== "retarget")
    throw new Error(
      `Unsupported external motion adoption mode "${String((props.decision as { mode: unknown }).mode)}".`,
    );
  const binding = validateMotionBinding({
    decision: props.decision,
    take,
    nodeIds: motion.nodeIds,
  });
  if (props.decision.mode === "native")
    return {
      source,
      mode: "native",
      take,
      handoff: { mode: "native", ...binding },
    };
  const retarget = validateRetargetDecision(props.decision);
  return {
    source,
    mode: "retarget",
    take,
    handoff: { mode: "retarget", ...binding, ...retarget },
  };
};

const validateMotionBinding = (props: {
  decision:
    | IAutoMovieExternalMotionNativeDecision
    | IAutoMovieExternalMotionRetargetDecision;
  take: IAutoMovieClip;
  nodeIds: string[];
}): Pick<IAutoMovieExternalMotionNativeHandoff, "sourceRig" | "mapping"> => {
  if (props.decision.sourceRig.id.trim().length === 0)
    throw new Error("External motion source rig id must be non-blank.");
  if (props.decision.sourceRig.bones.length === 0)
    throw new Error("External motion source rig has no bones.");

  const sourceBones = new Set<AutoMovieHumanoidBone>();
  for (const bone of props.decision.sourceRig.bones) {
    if (sourceBones.has(bone.bone))
      throw new Error(
        `External motion source rig duplicates bone "${bone.bone}".`,
      );
    sourceBones.add(bone.bone);
  }
  if (sourceBones.has("hips") === false)
    throw new Error(
      'External motion source rig is missing required bone "hips".',
    );

  if (props.decision.mapping.length === 0)
    throw new Error("External motion semantic mapping must not be empty.");
  const availableNodes = new Set(props.nodeIds);
  const nodeToBone = new Map<string, AutoMovieHumanoidBone>();
  const mappedBones = new Set<AutoMovieHumanoidBone>();
  for (const mapping of props.decision.mapping) {
    if (availableNodes.has(mapping.node) === false)
      throw new Error(
        `External motion mapping node "${mapping.node}" is not present in the inspected source.`,
      );
    if (sourceBones.has(mapping.bone) === false)
      throw new Error(
        `External motion mapping bone "${mapping.bone}" is absent from source rig "${props.decision.sourceRig.id}".`,
      );
    if (nodeToBone.has(mapping.node))
      throw new Error(
        `External motion mapping duplicates node "${mapping.node}".`,
      );
    if (mappedBones.has(mapping.bone))
      throw new Error(
        `External motion mapping duplicates bone "${mapping.bone}".`,
      );
    nodeToBone.set(mapping.node, mapping.bone);
    mappedBones.add(mapping.bone);
  }

  for (const track of props.take.tracks) {
    if (track.channel.kind !== "node")
      throw new Error(
        "External motion semantic conversion supports only node tracks.",
      );
    const bone = nodeToBone.get(track.channel.node);
    if (bone === undefined)
      throw new Error(
        `External motion track node "${track.channel.node}" has no explicit semantic mapping.`,
      );
    if (track.channel.path === "translation" && bone !== "hips")
      throw new Error(
        `External motion translation for node "${track.channel.node}" must map to hips.`,
      );
    if (track.channel.path === "scale" || track.channel.path === "weights")
      throw new Error(
        `External motion ${track.channel.path} channel for node "${track.channel.node}" is unsupported by humanoid motion conversion.`,
      );
  }
  return {
    sourceRig: cloneSkeleton(props.decision.sourceRig),
    mapping: props.decision.mapping
      .map((entry) => ({ ...entry }))
      .sort((left, right) => compareCodeUnits(left.node, right.node)),
  };
};

const validateRetargetDecision = (
  decision: IAutoMovieExternalMotionRetargetDecision,
): Pick<
  IAutoMovieExternalMotionRetargetHandoff,
  "target" | "translationScale"
> => {
  if (decision.target.trim().length === 0)
    throw new Error("External motion target identity must be non-blank.");
  if (
    Number.isFinite(decision.translationScale) === false ||
    decision.translationScale <= 0
  )
    throw new Error(
      `External motion translationScale must be finite and positive, but was ${decision.translationScale}.`,
    );
  return {
    target: decision.target,
    translationScale: decision.translationScale,
  };
};

const cloneClip = (clip: IAutoMovieClip): IAutoMovieClip => ({
  ...clip,
  tracks: clip.tracks.map((track) => ({
    ...track,
    channel: { ...track.channel },
    times: [...track.times],
    values: [...track.values],
  })),
});

const cloneSkeleton = (skeleton: IAutoMovieSkeleton): IAutoMovieSkeleton => ({
  id: skeleton.id,
  bones: skeleton.bones.map((bone) => ({
    ...bone,
    rest: {
      translation: { ...bone.rest.translation },
      rotation: { ...bone.rest.rotation },
      scale: { ...bone.rest.scale },
    },
    constraint:
      bone.constraint === null
        ? null
        : {
            ...bone.constraint,
            flexion:
              bone.constraint.flexion === null
                ? null
                : { ...bone.constraint.flexion },
            abduction:
              bone.constraint.abduction === null
                ? null
                : { ...bone.constraint.abduction },
            twist:
              bone.constraint.twist === null
                ? null
                : { ...bone.constraint.twist },
          },
  })),
});

const compareCodeUnits = (left: string, right: string): number =>
  Number(left > right) - Number(left < right);

const DIGEST_PATTERN = /^sha256:[0-9a-f]{64}$/u;
