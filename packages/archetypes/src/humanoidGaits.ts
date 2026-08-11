import { IAutoMovieGait, IAutoMovieProfile } from "@automovie/interface";

/**
 * The five canonical humanoid gaits, the locomotion the `locomote` verb's
 * `gait` enum names (`walk`/`run`/`sprint`/`sneak`/`march`), as ready
 * {@link IAutoMovieGait} data a host drops into an actor context. Same role as
 * the engine's other canonical humanoid tables (ROM, joint axes): the shapes
 * are fixed, a body is what varies.
 *
 * Every gait is tuned to sit inside the humanoid ROM, which is the whole reason
 * `neutral` exists. Knees (flexion `[0, 150]°`, no hyperextension) swing about
 * a bent center; and the faster gaits carry the hips forward too: a sprint's
 * `±amplitude` swing would cross the hip's `−30°` floor without a forward
 * `neutral`. Slower is calmer: `sneak` crouches (a high knee center) and holds
 * the ground longer (high `duty`); `march` throws the knees high; `sprint` is
 * all reach and little contact (low `duty`).
 *
 * Left/right limbs are a half-cycle out of phase, and each arm leads the
 * opposite leg for contralateral counter-swing. Feet are left to the future
 * ground-IK pass, so these drive hips, knees, and upper arms.
 *
 * `locomote` carries the authored gait as `fullBody`. Layer safety is decided
 * from the root/bones/expression the synthesized clips actually carry after
 * masking, not from the broad region names: this counter-swing can layer with a
 * head-only look, but correctly conflicts with a simultaneous arm gesture.
 *
 * @author Samchon
 * @evidence requirements/motion/procedural-motion-and-gaits.md#motion-gait-table Owns period, phase, duty, amplitude, and limb relationships as declared humanoid gait data.
 * @evidence specifications/performance-motion-and-staging/kinematics-contact-and-interaction.md#performance-kinematics-procedural-gait-rule Supplies the compact deterministic rule data sampled by the motion engine.
 * @evidenceExclude requirements/motion/README.md#동작-요구사항 Static gait tables implement procedural locomotion data, not the complete clip, root, contact, IK, interaction, timing, and validation family.
 * @evidenceExclude requirements/motion/channels-controls-and-drivers.md#motion-channel-contract Gait entries name sampled bone axes but do not define the general channel inventory, control ownership, dependency graph, or driver refusal.
 * @evidenceExclude requirements/motion/channels-controls-and-drivers.md#motion-channel-dependencies Gait entries name sampled bone axes but do not define the general channel inventory, control ownership, dependency graph, or driver refusal.
 * @evidenceExclude requirements/motion/channels-controls-and-drivers.md#motion-channel-control-ownership Gait entries name sampled bone axes but do not define the general channel inventory, control ownership, dependency graph, or driver refusal.
 * @evidenceExclude requirements/motion/channels-controls-and-drivers.md#motion-channel-extensibility Gait entries name sampled bone axes but do not define the general channel inventory, control ownership, dependency graph, or driver refusal.
 * @evidenceExclude requirements/motion/channels-controls-and-drivers.md#motion-channel-driver-refusal Gait entries name sampled bone axes but do not define the general channel inventory, control ownership, dependency graph, or driver refusal.
 * @evidenceExclude requirements/motion/clips-keyframes-and-interpolation.md#motion-key-times Periodic gait rules contain no authored clip, key time, interpolation mode, sparse default, trim, loop, or clip refusal.
 * @evidenceExclude requirements/motion/clips-keyframes-and-interpolation.md#motion-interpolation Periodic gait rules contain no authored clip, key time, interpolation mode, sparse default, trim, loop, or clip refusal.
 * @evidenceExclude requirements/motion/clips-keyframes-and-interpolation.md#motion-sparse-channel-default Periodic gait rules contain no authored clip, key time, interpolation mode, sparse default, trim, loop, or clip refusal.
 * @evidenceExclude requirements/motion/clips-keyframes-and-interpolation.md#motion-loop-trim Periodic gait rules contain no authored clip, key time, interpolation mode, sparse default, trim, loop, or clip refusal.
 * @evidenceExclude requirements/motion/clips-keyframes-and-interpolation.md#motion-clip-refusal Periodic gait rules contain no authored clip, key time, interpolation mode, sparse default, trim, loop, or clip refusal.
 * @evidenceExclude requirements/motion/constraints-and-inverse-kinematics.md#motion-range-of-motion Static amplitudes neither solve IK nor declare joint constraints, reachability, pole targets, solver bounds, or failure results.
 * @evidenceExclude requirements/motion/constraints-and-inverse-kinematics.md#motion-constraint-target-space Static amplitudes neither solve IK nor declare joint constraints, reachability, pole targets, solver bounds, or failure results.
 * @evidenceExclude requirements/motion/constraints-and-inverse-kinematics.md#motion-constraint-solve-order Static amplitudes neither solve IK nor declare joint constraints, reachability, pole targets, solver bounds, or failure results.
 * @evidenceExclude requirements/motion/constraints-and-inverse-kinematics.md#motion-coupled-range-drivers Static amplitudes neither solve IK nor declare joint constraints, reachability, pole targets, solver bounds, or failure results.
 * @evidenceExclude requirements/motion/constraints-and-inverse-kinematics.md#motion-constraint-reachability Static amplitudes neither solve IK nor declare joint constraints, reachability, pole targets, solver bounds, or failure results.
 * @evidenceExclude requirements/motion/constraints-and-inverse-kinematics.md#motion-constraint-solve-failure Static amplitudes neither solve IK nor declare joint constraints, reachability, pole targets, solver bounds, or failure results.
 * @evidenceExclude requirements/motion/contact-weight-and-support.md#motion-contact-phases Limb duty is waveform data, not a world contact identity, support set, weight transfer, moving support, tolerance, or contact refusal.
 * @evidenceExclude requirements/motion/contact-weight-and-support.md#motion-contact-authority-tolerance Limb duty is waveform data, not a world contact identity, support set, weight transfer, moving support, tolerance, or contact refusal.
 * @evidenceExclude requirements/motion/contact-weight-and-support.md#motion-weight-cues Limb duty is waveform data, not a world contact identity, support set, weight transfer, moving support, tolerance, or contact refusal.
 * @evidenceExclude requirements/motion/contact-weight-and-support.md#motion-moving-support Limb duty is waveform data, not a world contact identity, support set, weight transfer, moving support, tolerance, or contact refusal.
 * @evidenceExclude requirements/motion/contact-weight-and-support.md#motion-support-load-transfer Limb duty is waveform data, not a world contact identity, support set, weight transfer, moving support, tolerance, or contact refusal.
 * @evidenceExclude requirements/motion/contact-weight-and-support.md#motion-contact-refusal Limb duty is waveform data, not a world contact identity, support set, weight transfer, moving support, tolerance, or contact refusal.
 * @evidenceExclude requirements/motion/external-motion-inputs.md#motion-external-adoption-mode Shipped tables contain native constants and perform no external clip inspection, adoption choice, provenance, mapping, or replacement.
 * @evidenceExclude requirements/motion/external-motion-inputs.md#motion-external-source-basis Shipped tables contain native constants and perform no external clip inspection, adoption choice, provenance, mapping, or replacement.
 * @evidenceExclude requirements/motion/external-motion-inputs.md#motion-external-compatibility-override Shipped tables contain native constants and perform no external clip inspection, adoption choice, provenance, mapping, or replacement.
 * @evidenceExclude requirements/motion/external-motion-inputs.md#motion-external-adoption-receipt Shipped tables contain native constants and perform no external clip inspection, adoption choice, provenance, mapping, or replacement.
 * @evidenceExclude requirements/motion/external-motion-inputs.md#motion-external-input-refusal Shipped tables contain native constants and perform no external clip inspection, adoption choice, provenance, mapping, or replacement.
 * @evidenceExclude requirements/motion/layers-blends-and-transitions.md#motion-layer-channel-ownership A gait record is one source and owns no layer priority, mask, blend weight, transition window, phase alignment, event composition, or refusal.
 * @evidenceExclude requirements/motion/layers-blends-and-transitions.md#motion-layer-mask-weight A gait record is one source and owns no layer priority, mask, blend weight, transition window, phase alignment, event composition, or refusal.
 * @evidenceExclude requirements/motion/layers-blends-and-transitions.md#motion-transition-window A gait record is one source and owns no layer priority, mask, blend weight, transition window, phase alignment, event composition, or refusal.
 * @evidenceExclude requirements/motion/layers-blends-and-transitions.md#motion-phase-alignment A gait record is one source and owns no layer priority, mask, blend weight, transition window, phase alignment, event composition, or refusal.
 * @evidenceExclude requirements/motion/layers-blends-and-transitions.md#motion-layer-event-composition A gait record is one source and owns no layer priority, mask, blend weight, transition window, phase alignment, event composition, or refusal.
 * @evidenceExclude requirements/motion/layers-blends-and-transitions.md#motion-blend-refusal A gait record is one source and owns no layer priority, mask, blend weight, transition window, phase alignment, event composition, or refusal.
 * @evidenceExclude requirements/motion/object-motion-and-interaction.md#motion-object-authored-vocabulary Body gait data does not move objects, attach or hand off props, coordinate ownership, or validate object interaction state.
 * @evidenceExclude requirements/motion/object-motion-and-interaction.md#motion-object-state-transition Body gait data does not move objects, attach or hand off props, coordinate ownership, or validate object interaction state.
 * @evidenceExclude requirements/motion/object-motion-and-interaction.md#motion-object-handoff Body gait data does not move objects, attach or hand off props, coordinate ownership, or validate object interaction state.
 * @evidenceExclude requirements/motion/object-motion-and-interaction.md#motion-coupled-objects Body gait data does not move objects, attach or hand off props, coordinate ownership, or validate object interaction state.
 * @evidenceExclude requirements/motion/object-motion-and-interaction.md#motion-multi-subject-interaction Body gait data does not move objects, attach or hand off props, coordinate ownership, or validate object interaction state.
 * @evidenceExclude requirements/motion/object-motion-and-interaction.md#motion-interaction-refusal Body gait data does not move objects, attach or hand off props, coordinate ownership, or validate object interaction state.
 * @evidenceExclude requirements/motion/retargeting-and-scale.md#motion-retarget-mapping-selection Profiles are selectable data but calculate no semantic joint map, scale adaptation, root rewrite, contact re-resolution, or retarget receipt.
 * @evidenceExclude requirements/motion/retargeting-and-scale.md#motion-retarget-source-provenance Profiles are selectable data but calculate no semantic joint map, scale adaptation, root rewrite, contact re-resolution, or retarget receipt.
 * @evidenceExclude requirements/motion/retargeting-and-scale.md#motion-retarget-proportion Profiles are selectable data but calculate no semantic joint map, scale adaptation, root rewrite, contact re-resolution, or retarget receipt.
 * @evidenceExclude requirements/motion/retargeting-and-scale.md#motion-retarget-non-humanoid Profiles are selectable data but calculate no semantic joint map, scale adaptation, root rewrite, contact re-resolution, or retarget receipt.
 * @evidenceExclude requirements/motion/retargeting-and-scale.md#motion-retarget-contact-preservation Profiles are selectable data but calculate no semantic joint map, scale adaptation, root rewrite, contact re-resolution, or retarget receipt.
 * @evidenceExclude requirements/motion/retargeting-and-scale.md#motion-retarget-refusal Profiles are selectable data but calculate no semantic joint map, scale adaptation, root rewrite, contact re-resolution, or retarget receipt.
 * @evidenceExclude requirements/motion/root-motion-and-trajectories.md#motion-root-authority-mode Root-bob style data does not define world displacement, trajectory authority, turns, path timing, obstacle response, or root-motion refusal.
 * @evidenceExclude requirements/motion/root-motion-and-trajectories.md#motion-path-timing Root-bob style data does not define world displacement, trajectory authority, turns, path timing, obstacle response, or root-motion refusal.
 * @evidenceExclude requirements/motion/root-motion-and-trajectories.md#motion-path-fit-warp Root-bob style data does not define world displacement, trajectory authority, turns, path timing, obstacle response, or root-motion refusal.
 * @evidenceExclude requirements/motion/root-motion-and-trajectories.md#motion-facing-travel Root-bob style data does not define world displacement, trajectory authority, turns, path timing, obstacle response, or root-motion refusal.
 * @evidenceExclude requirements/motion/root-motion-and-trajectories.md#motion-root-ground-clearance Root-bob style data does not define world displacement, trajectory authority, turns, path timing, obstacle response, or root-motion refusal.
 * @evidenceExclude requirements/motion/root-motion-and-trajectories.md#motion-trajectory-refusal Root-bob style data does not define world displacement, trajectory authority, turns, path timing, obstacle response, or root-motion refusal.
 * @evidenceExclude requirements/motion/scope-and-identity.md#motion-all-objects-all-motion A profile groups reusable gait data but does not establish production motion identity, source lineage, ownership, selection, or lifecycle.
 * @evidenceExclude requirements/motion/scope-and-identity.md#motion-source-kinds A profile groups reusable gait data but does not establish production motion identity, source lineage, ownership, selection, or lifecycle.
 * @evidenceExclude requirements/motion/scope-and-identity.md#motion-variant-selection A profile groups reusable gait data but does not establish production motion identity, source lineage, ownership, selection, or lifecycle.
 * @evidenceExclude requirements/motion/scope-and-identity.md#motion-meaning-technique A profile groups reusable gait data but does not establish production motion identity, source lineage, ownership, selection, or lifecycle.
 * @evidenceExclude requirements/motion/scope-and-identity.md#motion-actor-object-scope A profile groups reusable gait data but does not establish production motion identity, source lineage, ownership, selection, or lifecycle.
 * @evidenceExclude requirements/motion/scope-and-identity.md#motion-missing-refusal A profile groups reusable gait data but does not establish production motion identity, source lineage, ownership, selection, or lifecycle.
 * @evidenceExclude requirements/motion/secondary-motion.md#motion-secondary-author-solver Gait constants contain no secondary-motion domain, solver, moving boundary, cache, bake, or adoption policy.
 * @evidenceExclude requirements/motion/secondary-motion.md#motion-secondary-adoption-choice Gait constants contain no secondary-motion domain, solver, moving boundary, cache, bake, or adoption policy.
 * @evidenceExclude requirements/motion/secondary-motion.md#motion-secondary-moving-boundary Gait constants contain no secondary-motion domain, solver, moving boundary, cache, bake, or adoption policy.
 * @evidenceExclude requirements/motion/secondary-motion.md#motion-secondary-static-compatibility Gait constants contain no secondary-motion domain, solver, moving boundary, cache, bake, or adoption policy.
 * @evidenceExclude requirements/motion/secondary-motion.md#motion-secondary-claim-boundary Gait constants contain no secondary-motion domain, solver, moving boundary, cache, bake, or adoption policy.
 * @evidenceExclude requirements/motion/timing-and-semantic-events.md#motion-event-markers Period supplies a sampling cycle but no production clock, semantic event identity, boundary policy, synchronization, or event receipt.
 * @evidenceExclude requirements/motion/timing-and-semantic-events.md#motion-event-identity-payload Period supplies a sampling cycle but no production clock, semantic event identity, boundary policy, synchronization, or event receipt.
 * @evidenceExclude requirements/motion/timing-and-semantic-events.md#motion-story-film-time Period supplies a sampling cycle but no production clock, semantic event identity, boundary policy, synchronization, or event receipt.
 * @evidenceExclude requirements/motion/timing-and-semantic-events.md#motion-boundary-sampling Period supplies a sampling cycle but no production clock, semantic event identity, boundary policy, synchronization, or event receipt.
 * @evidenceExclude requirements/motion/timing-and-semantic-events.md#motion-retime-event-preservation Period supplies a sampling cycle but no production clock, semantic event identity, boundary policy, synchronization, or event receipt.
 * @evidenceExclude requirements/motion/timing-and-semantic-events.md#motion-timing-refusal Period supplies a sampling cycle but no production clock, semantic event identity, boundary policy, synchronization, or event receipt.
 * @evidenceExclude requirements/motion/validation-and-determinism.md#motion-evaluation-receipt The tables are deterministic inputs but issue no motion validation status, bound proof, replay receipt, or failure location.
 * @evidenceExclude requirements/motion/validation-and-determinism.md#motion-scrambled-seek The tables are deterministic inputs but issue no motion validation status, bound proof, replay receipt, or failure location.
 * @evidenceExclude requirements/motion/validation-and-determinism.md#motion-fixed-step-baked-state The tables are deterministic inputs but issue no motion validation status, bound proof, replay receipt, or failure location.
 * @evidenceExclude requirements/motion/validation-and-determinism.md#motion-interior-sample-validation The tables are deterministic inputs but issue no motion validation status, bound proof, replay receipt, or failure location.
 * @evidenceExclude requirements/motion/validation-and-determinism.md#motion-numeric-stability The tables are deterministic inputs but issue no motion validation status, bound proof, replay receipt, or failure location.
 * @evidenceExclude requirements/motion/validation-and-determinism.md#motion-visual-review The tables are deterministic inputs but issue no motion validation status, bound proof, replay receipt, or failure location.
 * @evidenceExclude requirements/motion/validation-and-determinism.md#motion-validation-status The tables are deterministic inputs but issue no motion validation status, bound proof, replay receipt, or failure location.
 * @evidenceExclude requirements/motion/procedural-motion-and-gaits.md#motion-general-procedural-control These tables describe locomotion gaits only; project-defined machine and object controls use their own profiles.
 * @evidenceExclude requirements/motion/procedural-motion-and-gaits.md#motion-procedural-variation The shipped tables contain fixed values and no seeded subject variation law.
 * @evidenceExclude requirements/motion/procedural-motion-and-gaits.md#motion-terrain-adaptation Gait data has no ground query, slope solve, or terrain-support decision.
 * @evidenceExclude requirements/motion/procedural-motion-and-gaits.md#motion-procedural-bound Finite table entries do not declare solver search, terrain, speed, turn, or population bounds.
 * @evidenceExclude specifications/performance-motion-and-staging/README.md#퍼포먼스-모션과-스테이징-시스템-명세 Gait data is one kinematics input and not the complete performance, formation, or staging system.
 * @evidenceExclude specifications/performance-motion-and-staging/formation-identity-layout-and-terrain.md#performance-formation-hierarchy-membership-command A gait table has no formation hierarchy, membership, slot assignment, terrain route, spacing, variation, or compact group representation.
 * @evidenceExclude specifications/performance-motion-and-staging/formation-identity-layout-and-terrain.md#performance-formation-layout-slot-assignment A gait table has no formation hierarchy, membership, slot assignment, terrain route, spacing, variation, or compact group representation.
 * @evidenceExclude specifications/performance-motion-and-staging/formation-identity-layout-and-terrain.md#performance-formation-static-clearance A gait table supplies periodic limb rules, not member body bounds, resolved slots, or static-clearance measurement.
 * @evidenceExclude specifications/performance-motion-and-staging/formation-identity-layout-and-terrain.md#performance-formation-spacing-overlap-avoidance A gait table has no formation hierarchy, membership, slot assignment, terrain route, spacing, variation, or compact group representation.
 * @evidenceExclude specifications/performance-motion-and-staging/formation-identity-layout-and-terrain.md#performance-formation-hero-variation-group-state A gait table has no formation hierarchy, membership, slot assignment, terrain route, spacing, variation, or compact group representation.
 * @evidenceExclude specifications/performance-motion-and-staging/formation-identity-layout-and-terrain.md#performance-formation-sounding-membership-handoff A gait table has no formation hierarchy, membership, slot assignment, terrain route, spacing, variation, or compact group representation.
 * @evidenceExclude specifications/performance-motion-and-staging/formation-identity-layout-and-terrain.md#performance-formation-compact-representation-compatibility A gait table has no formation hierarchy, membership, slot assignment, terrain route, spacing, variation, or compact group representation.
 * @evidenceExclude specifications/performance-motion-and-staging/formation-motion-resolution-and-budgets.md#performance-formation-member-exception-command-event Static body rules assign no group command, member exception, reform state, display resolution, culling policy, or formation budget.
 * @evidenceExclude specifications/performance-motion-and-staging/formation-motion-resolution-and-budgets.md#performance-formation-bounds-framing-culling-failures Static body rules assign no group command, member exception, reform state, display resolution, culling policy, or formation budget.
 * @evidenceExclude specifications/performance-motion-and-staging/formation-motion-resolution-and-budgets.md#performance-formation-budget-worst-case-cost Static body rules assign no group command, member exception, reform state, display resolution, culling policy, or formation budget.
 * @evidenceExclude specifications/performance-motion-and-staging/formation-motion-resolution-and-budgets.md#performance-formation-geometry-layout-motion-validation Static body rules assign no group command, member exception, reform state, display resolution, culling policy, or formation budget.
 * @evidenceExclude specifications/performance-motion-and-staging/formation-motion-resolution-and-budgets.md#performance-formation-layout-ground-validation Gait tables neither resolve formation slots against terrain nor validate their grounded placement and bounds.
 * @evidenceExclude specifications/performance-motion-and-staging/formation-motion-resolution-and-budgets.md#performance-formation-motion-validation Gait tables name reusable locomotion samples but do not validate authored formation cue identities, intervals, counts, or interior states.
 * @evidenceExclude specifications/performance-motion-and-staging/formation-motion-resolution-and-budgets.md#performance-formation-determinism-status-compatibility Static body rules assign no group command, member exception, reform state, display resolution, culling policy, or formation budget.
 * @evidenceExclude specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-external-adoption-receipt These constants are sampling inputs, not the engine that resolves sources, clips, channels, layers, clocks, events, receipts, or failures.
 * @evidenceExclude specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-clip-keytime-interpolation These constants are sampling inputs, not the engine that resolves sources, clips, channels, layers, clocks, events, receipts, or failures.
 * @evidenceExclude specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-layer-mask-transition-composition These constants are sampling inputs, not the engine that resolves sources, clips, channels, layers, clocks, events, receipts, or failures.
 * @evidenceExclude specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-clock-semantic-event These constants are sampling inputs, not the engine that resolves sources, clips, channels, layers, clocks, events, receipts, or failures.
 * @evidenceExclude specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-deterministic-sampling-validation These constants are sampling inputs, not the engine that resolves sources, clips, channels, layers, clocks, events, receipts, or failures.
 * @evidenceExclude specifications/performance-motion-and-staging/rig-deformation-and-retargeting.md#performance-rig-skin-rigid-morph-deformation A profile names humanoid bone channels but owns no rest or bind contract, deformation, ROM graph, external-rig characterization, or retarget result.
 * @evidenceExclude specifications/performance-motion-and-staging/rig-deformation-and-retargeting.md#performance-rig-semantic-joint-mapping A profile names humanoid bone channels but owns no rest or bind contract, deformation, ROM graph, external-rig characterization, or retarget result.
 * @evidenceExclude specifications/performance-motion-and-staging/rig-deformation-and-retargeting.md#performance-rig-rom-control-driver-graph A profile names humanoid bone channels but owns no rest or bind contract, deformation, ROM graph, external-rig characterization, or retarget result.
 * @evidenceExclude specifications/performance-motion-and-staging/rig-deformation-and-retargeting.md#performance-rig-external-adoption-retarget-characterization A profile names humanoid bone channels but owns no rest or bind contract, deformation, ROM graph, external-rig characterization, or retarget result.
 * @evidenceExclude specifications/performance-motion-and-staging/rig-deformation-and-retargeting.md#performance-rig-retarget-preservation-failure A profile names humanoid bone channels but owns no rest or bind contract, deformation, ROM graph, external-rig characterization, or retarget result.
 * @evidenceExclude specifications/performance-motion-and-staging/rig-deformation-and-retargeting.md#performance-rig-compatibility-fidelity-ceiling A profile names humanoid bone channels but owns no rest or bind contract, deformation, ROM graph, external-rig characterization, or retarget result.
 * @evidenceExclude specifications/performance-motion-and-staging/staging-events-coverage-and-validation.md#performance-staging-event-boundary-sampling-output Gait data produces no fixed-clock event output, shot-contract status, coverage matrix, take continuity, staging budget, or viewer evidence.
 * @evidenceExclude specifications/performance-motion-and-staging/staging-events-coverage-and-validation.md#performance-staging-contract-realization-acceptance-status Gait data produces no fixed-clock event output, shot-contract status, coverage matrix, take continuity, staging budget, or viewer evidence.
 * @evidenceExclude specifications/performance-motion-and-staging/staging-events-coverage-and-validation.md#performance-staging-take-continuity-edit-compatibility Gait data produces no fixed-clock event output, shot-contract status, coverage matrix, take continuity, staging budget, or viewer evidence.
 * @evidenceExclude specifications/performance-motion-and-staging/staging-events-coverage-and-validation.md#performance-staging-deterministic-replay-failure-result Gait data produces no fixed-clock event output, shot-contract status, coverage matrix, take continuity, staging budget, or viewer evidence.
 * @evidenceExclude specifications/performance-motion-and-staging/staging-events-coverage-and-validation.md#performance-staging-viewer-evidence-prototype-ceiling Gait data produces no fixed-clock event output, shot-contract status, coverage matrix, take continuity, staging budget, or viewer evidence.
 * @evidenceExclude specifications/performance-motion-and-staging/staging-space-state-and-choreography.md#performance-staging-mark-surface-zone-membership A periodic limb rule does not place subjects, own spatial state, schedule choreography, coordinate groups, or validate staging.
 * @evidenceExclude specifications/performance-motion-and-staging/staging-space-state-and-choreography.md#performance-staging-interaction-choreography-role A periodic limb rule does not place subjects, own spatial state, schedule choreography, coordinate groups, or validate staging.
 * @evidenceExclude specifications/performance-motion-and-staging/staging-space-state-and-choreography.md#performance-staging-visibility-reveal-readability A periodic limb rule does not place subjects, own spatial state, schedule choreography, coordinate groups, or validate staging.
 * @evidenceExclude specifications/performance-motion-and-staging/staging-space-state-and-choreography.md#performance-staging-compatibility-stale-state A periodic limb rule does not place subjects, own spatial state, schedule choreography, coordinate groups, or validate staging.
 * @evidenceExclude specifications/performance-motion-and-staging/kinematics-contact-and-interaction.md#performance-contact-phase-weight-support Limb duty is a waveform phase, not a world contact identity, support set, load share, or weight solve.
 * @evidenceExclude specifications/performance-motion-and-staging/kinematics-contact-and-interaction.md#performance-kinematics-gaze-expression-attention The gait table drives limbs and does not solve gaze, facial expression, or attention ownership.
 * @evidenceExclude specifications/performance-motion-and-staging/kinematics-contact-and-interaction.md#performance-interaction-attachment-object-handoff Static gait samples do not create attachment, handoff, ownership, or object-interaction events.
 * @evidenceExclude specifications/performance-motion-and-staging/kinematics-contact-and-interaction.md#performance-secondary-motion-boundary-choice The tables contain no secondary-motion domain, moving boundary, solver, or bake policy.
 * @evidenceExclude specifications/performance-motion-and-staging/kinematics-contact-and-interaction.md#performance-kinematics-retarget-scale-contact Profiles are selectable data but do not compute rig mapping, scale retarget, or contact re-resolution.
 * @evidenceExclude specifications/performance-motion-and-staging/kinematics-contact-and-interaction.md#performance-interaction-determinism-compatibility Deterministic interaction receipts and compatibility statuses belong to the sampling and interaction pipeline.
 */
export const HUMANOID_GAITS: Record<
  "walk" | "run" | "sprint" | "sneak" | "march",
  IAutoMovieGait
> = {
  walk: {
    name: "walk",
    period: 0.95,
    limbs: [
      { bone: "leftUpperLeg", phase: 0, duty: 0.55, amplitude: 30 },
      { bone: "rightUpperLeg", phase: 0.5, duty: 0.55, amplitude: 30 },
      {
        bone: "leftLowerLeg",
        phase: 0.25,
        duty: 0.5,
        amplitude: 18,
        neutral: 22,
      },
      {
        bone: "rightLowerLeg",
        phase: 0.75,
        duty: 0.5,
        amplitude: 18,
        neutral: 22,
      },
      { bone: "leftUpperArm", phase: 0.5, duty: 0.5, amplitude: 18 },
      { bone: "rightUpperArm", phase: 0, duty: 0.5, amplitude: 18 },
    ],
  },
  run: {
    name: "run",
    period: 0.62,
    limbs: [
      {
        bone: "leftUpperLeg",
        phase: 0,
        duty: 0.42,
        amplitude: 42,
        neutral: 12,
      },
      {
        bone: "rightUpperLeg",
        phase: 0.5,
        duty: 0.42,
        amplitude: 42,
        neutral: 12,
      },
      {
        bone: "leftLowerLeg",
        phase: 0.3,
        duty: 0.5,
        amplitude: 32,
        neutral: 38,
      },
      {
        bone: "rightLowerLeg",
        phase: 0.8,
        duty: 0.5,
        amplitude: 32,
        neutral: 38,
      },
      { bone: "leftUpperArm", phase: 0.5, duty: 0.5, amplitude: 40 },
      { bone: "rightUpperArm", phase: 0, duty: 0.5, amplitude: 40 },
    ],
  },
  sprint: {
    name: "sprint",
    period: 0.48,
    limbs: [
      {
        bone: "leftUpperLeg",
        phase: 0,
        duty: 0.36,
        amplitude: 46,
        neutral: 18,
      },
      {
        bone: "rightUpperLeg",
        phase: 0.5,
        duty: 0.36,
        amplitude: 46,
        neutral: 18,
      },
      {
        bone: "leftLowerLeg",
        phase: 0.32,
        duty: 0.5,
        amplitude: 40,
        neutral: 45,
      },
      {
        bone: "rightLowerLeg",
        phase: 0.82,
        duty: 0.5,
        amplitude: 40,
        neutral: 45,
      },
      { bone: "leftUpperArm", phase: 0.5, duty: 0.5, amplitude: 52 },
      { bone: "rightUpperArm", phase: 0, duty: 0.5, amplitude: 52 },
    ],
  },
  sneak: {
    name: "sneak",
    period: 1.5,
    limbs: [
      { bone: "leftUpperLeg", phase: 0, duty: 0.62, amplitude: 20, neutral: 6 },
      {
        bone: "rightUpperLeg",
        phase: 0.5,
        duty: 0.62,
        amplitude: 20,
        neutral: 6,
      },
      {
        bone: "leftLowerLeg",
        phase: 0.25,
        duty: 0.5,
        amplitude: 15,
        neutral: 38,
      },
      {
        bone: "rightLowerLeg",
        phase: 0.75,
        duty: 0.5,
        amplitude: 15,
        neutral: 38,
      },
      { bone: "leftUpperArm", phase: 0.5, duty: 0.5, amplitude: 8 },
      { bone: "rightUpperArm", phase: 0, duty: 0.5, amplitude: 8 },
    ],
  },
  march: {
    name: "march",
    period: 0.82,
    limbs: [
      { bone: "leftUpperLeg", phase: 0, duty: 0.5, amplitude: 42, neutral: 12 },
      {
        bone: "rightUpperLeg",
        phase: 0.5,
        duty: 0.5,
        amplitude: 42,
        neutral: 12,
      },
      {
        bone: "leftLowerLeg",
        phase: 0.2,
        duty: 0.5,
        amplitude: 38,
        neutral: 42,
      },
      {
        bone: "rightLowerLeg",
        phase: 0.7,
        duty: 0.5,
        amplitude: 38,
        neutral: 42,
      },
      { bone: "leftUpperArm", phase: 0.5, duty: 0.5, amplitude: 30 },
      { bone: "rightUpperArm", phase: 0, duty: 0.5, amplitude: 30 },
    ],
  },
};

/**
 * The canonical humanoid profile fixture: the same locomotion vocabulary as
 * {@link HUMANOID_GAITS}, packaged as reusable profile data so a host can bind
 * it onto any humanoid skeleton without hand-authored TypeScript clips.
 *
 * @author Samchon
 * @evidence requirements/motion/procedural-motion-and-gaits.md#motion-procedural-rule-selection Packages the named table as a host-selectable humanoid profile.
 * @evidence specifications/performance-motion-and-staging/kinematics-contact-and-interaction.md#performance-kinematics-procedural-gait-rule Keeps the reusable rule vocabulary in profile data rather than engine heuristics.
 */
export const HUMANOID_PROFILE: IAutoMovieProfile = {
  id: "humanoid",
  name: "humanoid",
  controls: [],
  drivers: [],
  limits: [],
  gaits: Object.values(HUMANOID_GAITS),
};
