import { Quaternion } from "@automovie/engine";
import {
  IAutoMovieModel,
  IAutoMovieModelPart,
  IAutoMovieTransform,
} from "@automovie/interface";

import {
  IAutoMovieArchetypeBuildInput,
  IAutoMovieArchetypeGeometry,
  IAutoMovieModelArchetype,
} from "./IAutoMovieModelArchetype";
import { numberOf, numberParameter } from "./parameterValues";

/**
 * The catalogue's articulated figure: one height-driven primitive rig.
 *
 * Every proportion is derived from `height`, so one number moves the whole
 * runtime and the compiled result stays reproducible. It is one catalogue's
 * idea of an upright figure, registered like any other archetype rather than
 * known to the compiler.
 *
 * @evidence requirements/actors/body-scale-and-landmarks.md#actor-proportion-neutral Derives one explicit neutral skeleton and every segment proportion from metric height inputs.
 * @evidence requirements/actors/body-scale-and-landmarks.md#actor-bounds-shot-scale Reports a conservative height-derived radius before the rigged proxy is built.
 * @evidence requirements/actors/body-scale-and-landmarks.md#actor-scale-validation Bounds height, head radius, and limb radius instead of applying a hidden render scale.
 * @evidence requirements/actors/representation-tiers-and-fidelity-boundary.md#actor-direct-authoring-ceiling Implements an intentionally crude articulated blocking proxy, not a likeness asset.
 * @evidence requirements/actors/representation-tiers-and-fidelity-boundary.md#actor-fidelity-capability-separation Declares the proxy's signal capability separately from its primitive appearance.
 * @evidence requirements/actors/representation-tiers-and-fidelity-boundary.md#actor-quality-claim-boundary Makes the direct representation visibly and structurally a stick proxy.
 * @evidence specifications/asset-and-representation/fidelity-and-validation.md#asset-spec-validation-purpose-inputs Publishes the proxy's parameters, bones, and signal capability as explicit suitability inputs.
 * @evidence specifications/asset-and-representation/fidelity-and-validation.md#asset-spec-validation-numeric-structure Supplies bounded metric inputs and a deterministic hierarchy for structural validation.
 * @evidence specifications/performance-motion-and-staging/actor-identity-state-and-fidelity.md#performance-actor-representation-fidelity-boundary Materializes the coarse proxy representation while keeping performance capability explicit.
 * @evidenceExclude requirements/actors/README.md#actor-요구사항 This file supplies one crude body representation and does not implement the complete actor identity, voice, state, performance, and validation family.
 * @evidenceExclude requirements/actors/appearance-costume-and-attachments.md#actor-costume-layers-variants The proxy receives one material id and defines no appearance layers, costume states, attachment inventory, or wardrobe continuity.
 * @evidenceExclude requirements/actors/appearance-costume-and-attachments.md#actor-attachment-contact The proxy receives one material id and defines no appearance layers, costume states, attachment inventory, or wardrobe continuity.
 * @evidenceExclude requirements/actors/appearance-costume-and-attachments.md#actor-rigid-soft-binding The proxy receives one material id and defines no appearance layers, costume states, attachment inventory, or wardrobe continuity.
 * @evidenceExclude requirements/actors/appearance-costume-and-attachments.md#actor-external-appearance-assets The proxy receives one material id and defines no appearance layers, costume states, attachment inventory, or wardrobe continuity.
 * @evidenceExclude requirements/actors/appearance-costume-and-attachments.md#actor-costume-intersection-refusal The proxy receives one material id and defines no appearance layers, costume states, attachment inventory, or wardrobe continuity.
 * @evidenceExclude requirements/actors/inputs-selection-and-replacement.md#actor-independent-binding-selection This constant builds one requested native proxy and does not ingest actor sources, choose representations for a shot, or record replacement compatibility.
 * @evidenceExclude requirements/actors/inputs-selection-and-replacement.md#actor-external-rig-adoption This constant builds one requested native proxy and does not ingest actor sources, choose representations for a shot, or record replacement compatibility.
 * @evidenceExclude requirements/actors/inputs-selection-and-replacement.md#actor-input-compatibility-preview This constant builds one requested native proxy and does not ingest actor sources, choose representations for a shot, or record replacement compatibility.
 * @evidenceExclude requirements/actors/inputs-selection-and-replacement.md#actor-selection-replacement-receipt This constant builds one requested native proxy and does not ingest actor sources, choose representations for a shot, or record replacement compatibility.
 * @evidenceExclude requirements/actors/performance-and-story-binding.md#actor-performance-precedence Neutral model construction owns no story action, beat timing, rehearsal, performance event, or resulting narrative state.
 * @evidenceExclude requirements/actors/performance-and-story-binding.md#actor-performance-capability-plan Neutral model construction owns no story action, beat timing, rehearsal, performance event, or resulting narrative state.
 * @evidenceExclude requirements/actors/performance-and-story-binding.md#actor-performance-local-clock Neutral model construction owns no story action, beat timing, rehearsal, performance event, or resulting narrative state.
 * @evidenceExclude requirements/actors/performance-and-story-binding.md#actor-performance-events-contacts Neutral model construction owns no story action, beat timing, rehearsal, performance event, or resulting narrative state.
 * @evidenceExclude requirements/actors/performance-and-story-binding.md#actor-performance-gap Neutral model construction owns no story action, beat timing, rehearsal, performance event, or resulting narrative state.
 * @evidenceExclude requirements/actors/populations-and-doubles.md#actor-prototype-variation One requested proxy is not a crowd, double allocation, hero-selection, variation, or population-budget system.
 * @evidenceExclude requirements/actors/populations-and-doubles.md#actor-doubles-replacement One requested proxy is not a crowd, double allocation, hero-selection, variation, or population-budget system.
 * @evidenceExclude requirements/actors/populations-and-doubles.md#actor-population-budget One requested proxy is not a crowd, double allocation, hero-selection, variation, or population-budget system.
 * @evidenceExclude requirements/actors/populations-and-doubles.md#actor-population-refusal One requested proxy is not a crowd, double allocation, hero-selection, variation, or population-budget system.
 * @evidenceExclude requirements/actors/pose-expression-and-gaze.md#actor-pose-motion-distinction A neutral skeleton supplies no authored pose, gaze target, expression channel, attention owner, transition, or contact-aware solve.
 * @evidenceExclude requirements/actors/pose-expression-and-gaze.md#actor-pose-space-authority A neutral skeleton supplies no authored pose, gaze target, expression channel, attention owner, transition, or contact-aware solve.
 * @evidenceExclude requirements/actors/pose-expression-and-gaze.md#actor-gaze-attention A neutral skeleton supplies no authored pose, gaze target, expression channel, attention owner, transition, or contact-aware solve.
 * @evidenceExclude requirements/actors/pose-expression-and-gaze.md#actor-expression-channels A neutral skeleton supplies no authored pose, gaze target, expression channel, attention owner, transition, or contact-aware solve.
 * @evidenceExclude requirements/actors/pose-expression-and-gaze.md#actor-pose-validation A neutral skeleton supplies no authored pose, gaze target, expression channel, attention owner, transition, or contact-aware solve.
 * @evidenceExclude requirements/actors/scope-and-identity.md#actor-character-distinction The archetype id names a reusable model builder, not a story actor, role, cast identity, or scene-spanning subject.
 * @evidenceExclude requirements/actors/scope-and-identity.md#actor-open-performer-kind The archetype id names a reusable model builder, not a story actor, role, cast identity, or scene-spanning subject.
 * @evidenceExclude requirements/actors/scope-and-identity.md#actor-authored-facts The archetype id names a reusable model builder, not a story actor, role, cast identity, or scene-spanning subject.
 * @evidenceExclude requirements/actors/scope-and-identity.md#actor-identity-representation-lifetime The archetype id names a reusable model builder, not a story actor, role, cast identity, or scene-spanning subject.
 * @evidenceExclude requirements/actors/scope-and-identity.md#actor-open-control-vocabulary The archetype id names a reusable model builder, not a story actor, role, cast identity, or scene-spanning subject.
 * @evidenceExclude requirements/actors/scope-and-identity.md#actor-missing-binding The archetype id names a reusable model builder, not a story actor, role, cast identity, or scene-spanning subject.
 * @evidenceExclude requirements/actors/skeleton-rig-and-retargeting.md#actor-rest-bind-deformation The proxy emits one fixed humanoid hierarchy but does not author general rig semantics, ROM, deformation, external-rig adoption, or retargeting.
 * @evidenceExclude requirements/actors/skeleton-rig-and-retargeting.md#actor-humanoid-mapping The proxy emits one fixed humanoid hierarchy but does not author general rig semantics, ROM, deformation, external-rig adoption, or retargeting.
 * @evidenceExclude requirements/actors/skeleton-rig-and-retargeting.md#actor-joint-range-constraints The proxy emits one fixed humanoid hierarchy but does not author general rig semantics, ROM, deformation, external-rig adoption, or retargeting.
 * @evidenceExclude requirements/actors/skeleton-rig-and-retargeting.md#actor-rig-control-drivers The proxy emits one fixed humanoid hierarchy but does not author general rig semantics, ROM, deformation, external-rig adoption, or retargeting.
 * @evidenceExclude requirements/actors/skeleton-rig-and-retargeting.md#actor-motion-retargeting The proxy emits one fixed humanoid hierarchy but does not author general rig semantics, ROM, deformation, external-rig adoption, or retargeting.
 * @evidenceExclude requirements/actors/skeleton-rig-and-retargeting.md#actor-rig-refusal The proxy emits one fixed humanoid hierarchy but does not author general rig semantics, ROM, deformation, external-rig adoption, or retargeting.
 * @evidenceExclude requirements/actors/state-and-continuity.md#actor-state-authority-provenance Model construction is timeless and stores no actor state ledger, continuity transition, wardrobe state, damage state, or reset receipt.
 * @evidenceExclude requirements/actors/state-and-continuity.md#actor-scene-state-handoff Model construction is timeless and stores no actor state ledger, continuity transition, wardrobe state, damage state, or reset receipt.
 * @evidenceExclude requirements/actors/state-and-continuity.md#actor-shot-continuity Model construction is timeless and stores no actor state ledger, continuity transition, wardrobe state, damage state, or reset receipt.
 * @evidenceExclude requirements/actors/state-and-continuity.md#actor-state-alternatives Model construction is timeless and stores no actor state ledger, continuity transition, wardrobe state, damage state, or reset receipt.
 * @evidenceExclude requirements/actors/state-and-continuity.md#actor-state-unknown-not-applicable Model construction is timeless and stores no actor state ledger, continuity transition, wardrobe state, damage state, or reset receipt.
 * @evidenceExclude requirements/actors/state-and-continuity.md#actor-state-reset-refusal Model construction is timeless and stores no actor state ledger, continuity transition, wardrobe state, damage state, or reset receipt.
 * @evidenceExclude requirements/actors/validation.md#actor-numeric-geometry-validation Parameter bounds and declared capability are inputs to validation; this constant produces no actor validation result, evidence capture, or compatibility approval.
 * @evidenceExclude requirements/actors/validation.md#actor-purpose-validation Parameter bounds and declared capability are inputs to validation; this constant produces no actor validation result, evidence capture, or compatibility approval.
 * @evidenceExclude requirements/actors/validation.md#actor-input-binding-validation Parameter bounds and declared capability are inputs to validation; this constant produces no actor validation result, evidence capture, or compatibility approval.
 * @evidenceExclude requirements/actors/validation.md#actor-multi-angle-review Parameter bounds and declared capability are inputs to validation; this constant produces no actor validation result, evidence capture, or compatibility approval.
 * @evidenceExclude requirements/actors/validation.md#actor-current-evidence Parameter bounds and declared capability are inputs to validation; this constant produces no actor validation result, evidence capture, or compatibility approval.
 * @evidenceExclude requirements/actors/validation.md#actor-validation-ceiling Parameter bounds and declared capability are inputs to validation; this constant produces no actor validation result, evidence capture, or compatibility approval.
 * @evidenceExclude requirements/actors/voice-and-utterance-identity.md#actor-voice-casting-selection Geometry construction has no voice source, utterance identity, final audio bytes, timing, viseme join, or lip-sync state.
 * @evidenceExclude requirements/actors/voice-and-utterance-identity.md#actor-voice-continuity Geometry construction has no voice source, utterance identity, final audio bytes, timing, viseme join, or lip-sync state.
 * @evidenceExclude requirements/actors/voice-and-utterance-identity.md#actor-utterance-performance Geometry construction has no voice source, utterance identity, final audio bytes, timing, viseme join, or lip-sync state.
 * @evidenceExclude requirements/actors/voice-and-utterance-identity.md#actor-voice-source-choice Geometry construction has no voice source, utterance identity, final audio bytes, timing, viseme join, or lip-sync state.
 * @evidenceExclude requirements/actors/voice-and-utterance-identity.md#actor-voice-refusal Geometry construction has no voice source, utterance identity, final audio bytes, timing, viseme join, or lip-sync state.
 * @evidenceExclude requirements/actors/body-scale-and-landmarks.md#actor-left-right-asymmetry The shipped proxy has paired left and right bones but no authored asymmetry parameter.
 * @evidenceExclude requirements/actors/representation-tiers-and-fidelity-boundary.md#actor-external-representation This native primitive builder does not import or adopt glTF, GLB, or VRM actors.
 * @evidenceExclude requirements/actors/representation-tiers-and-fidelity-boundary.md#actor-shot-tier-selection The archetype provides one explicit stick tier and does not choose a tier for a shot.
 * @evidenceExclude requirements/actors/representation-tiers-and-fidelity-boundary.md#actor-tier-compatibility Representation replacement and compatibility reporting occur outside this fixed proxy builder.
 * @evidenceExclude specifications/performance-motion-and-staging/actor-identity-state-and-fidelity.md#performance-actor-story-performance-state A model archetype does not schedule story actions, clocks, events, or ending state.
 * @evidenceExclude specifications/performance-motion-and-staging/actor-identity-state-and-fidelity.md#performance-actor-state-continuity-ledger The builder emits no scene-spanning actor state ledger.
 * @evidenceExclude specifications/performance-motion-and-staging/actor-identity-state-and-fidelity.md#performance-actor-appearance-costume-attachment The proxy has one material and no costume layer, attachment, or external appearance composition.
 * @evidenceExclude specifications/performance-motion-and-staging/actor-identity-state-and-fidelity.md#performance-actor-voice-utterance-expression This geometry builder has no voice binding, utterance clock, or facial channel.
 * @evidenceExclude specifications/performance-motion-and-staging/actor-identity-state-and-fidelity.md#performance-actor-pose-gaze-expression-state A neutral skeleton is not a pose, gaze, expression, or attention-state solver.
 * @evidenceExclude specifications/performance-motion-and-staging/actor-identity-state-and-fidelity.md#performance-actor-population-double-variation This archetype builds one requested proxy and does not allocate doubles or population budgets.
 * @evidenceExclude specifications/performance-motion-and-staging/actor-identity-state-and-fidelity.md#performance-actor-validation-output-compatibility The builder returns geometry, not an actor validation or replacement-compatibility receipt.
 * @author Samchon
 */
export const STICKMAN_ARCHETYPE: IAutoMovieModelArchetype = {
  id: "stickman",
  capabilities: ["signal"],
  bones: [
    "hips",
    "spine",
    "head",
    "leftUpperArm",
    "leftLowerArm",
    "leftHand",
    "rightUpperArm",
    "rightLowerArm",
    "rightHand",
    "leftUpperLeg",
    "leftLowerLeg",
    "rightUpperLeg",
    "rightLowerLeg",
  ],
  parameters: {
    height: { kind: "number", minimum: 0.5, maximum: 3 },
    headRadius: { kind: "number", minimum: 0.05, maximum: 0.5 },
    limbRadius: { kind: "number", minimum: 0.01, maximum: 0.25 },
  },
  plan: () => ({
    required: ["height", "headRadius", "limbRadius"],
    accepted: null,
    refusals: [],
  }),
  projectionRadius: (parameters) => numberOf(parameters, "height") / 2,
  build: (input) => build(input),
};

const build = (
  input: IAutoMovieArchetypeBuildInput,
): IAutoMovieArchetypeGeometry => {
  const height = numberParameter(input.parameters, "height");
  const headRadius = numberParameter(input.parameters, "headRadius");
  const limbRadius = numberParameter(input.parameters, "limbRadius");
  const part = (
    id: string,
    bone: IAutoMovieModelPart["attachedBone"],
    shape: Extract<
      IAutoMovieModelPart["geometry"],
      { type: "primitive" }
    >["shape"],
    local: IAutoMovieModelPart["transform"],
  ): IAutoMovieModelPart => ({
    id,
    name: id,
    geometry: { type: "primitive", shape },
    material: input.material,
    attachedBone: bone,
    transform: local,
  });
  const torsoHeight = Math.max(headRadius * 2, height * 0.3);
  const upperLimb = Math.max(limbRadius * 2, height * 0.15);
  const lowerLimb = Math.max(limbRadius * 2, height * 0.14);
  return {
    skeleton: skeletonOf(input.skeleton, height),
    parts: [
      part(
        "pelvis",
        "hips",
        {
          type: "box",
          width: height * 0.19,
          height: height * 0.12,
          depth: height * 0.11,
        },
        transform(0, 0, 0),
      ),
      part(
        "torso",
        "spine",
        {
          type: "box",
          width: height * 0.25,
          height: torsoHeight,
          depth: height * 0.12,
        },
        transform(0, torsoHeight * 0.22, 0),
      ),
      part("head", "head", { type: "sphere", radius: headRadius }, null),
      ...(["left", "right"] as const).flatMap((side) => {
        const sign = side === "left" ? 1 : -1;
        return [
          part(
            `${side}-upper-arm`,
            `${side}UpperArm`,
            {
              type: "capsule",
              radius: limbRadius,
              height: upperLimb,
            },
            horizontal(sign * upperLimb * 0.55),
          ),
          part(
            `${side}-lower-arm`,
            `${side}LowerArm`,
            {
              type: "capsule",
              radius: limbRadius * 0.85,
              height: lowerLimb,
            },
            horizontal(sign * lowerLimb * 0.55),
          ),
          part(
            `${side}-hand`,
            `${side}Hand`,
            { type: "sphere", radius: limbRadius * 1.05 },
            null,
          ),
          part(
            `${side}-thigh`,
            `${side}UpperLeg`,
            {
              type: "capsule",
              radius: limbRadius * 1.15,
              height: height * 0.19,
            },
            transform(0, -height * 0.105, 0),
          ),
          part(
            `${side}-shin`,
            `${side}LowerLeg`,
            {
              type: "capsule",
              radius: limbRadius,
              height: height * 0.19,
            },
            transform(0, -height * 0.105, 0),
          ),
        ];
      }),
    ],
  };
};

const skeletonOf = (
  id: string,
  height: number,
): NonNullable<IAutoMovieModel["skeleton"]> => {
  const bone = (
    name: NonNullable<IAutoMovieModel["skeleton"]>["bones"][number]["bone"],
    parent: NonNullable<IAutoMovieModel["skeleton"]>["bones"][number]["parent"],
    x: number,
    y: number,
    z: number,
  ): NonNullable<IAutoMovieModel["skeleton"]>["bones"][number] => ({
    bone: name,
    parent,
    rest: transform(x, y, z),
    constraint: null,
  });
  return {
    id,
    bones: [
      bone("hips", null, 0, height * 0.5, 0),
      bone("spine", "hips", 0, height * 0.18, 0),
      bone("head", "spine", 0, height * 0.24, 0),
      bone("leftUpperArm", "spine", height * 0.125, height * 0.15, 0),
      bone("leftLowerArm", "leftUpperArm", height * 0.17, 0, 0),
      bone("leftHand", "leftLowerArm", height * 0.16, 0, 0),
      bone("rightUpperArm", "spine", -height * 0.125, height * 0.15, 0),
      bone("rightLowerArm", "rightUpperArm", -height * 0.17, 0, 0),
      bone("rightHand", "rightLowerArm", -height * 0.16, 0, 0),
      bone("leftUpperLeg", "hips", height * 0.07, -height * 0.04, 0),
      bone("leftLowerLeg", "leftUpperLeg", 0, -height * 0.22, 0),
      bone("rightUpperLeg", "hips", -height * 0.07, -height * 0.04, 0),
      bone("rightLowerLeg", "rightUpperLeg", 0, -height * 0.22, 0),
    ],
  };
};

const transform = (
  x: number,
  y: number,
  z: number,
  rotation = { x: 0, y: 0, z: 0, w: 1 },
): IAutoMovieTransform => ({
  translation: { x, y, z },
  rotation,
  scale: { x: 1, y: 1, z: 1 },
});

const horizontal = (x: number): IAutoMovieTransform =>
  rotateZ(x < 0 ? 90 : -90, x, 0, 0);

const rotateZ = (
  degrees: number,
  x: number,
  y: number,
  z: number,
): IAutoMovieTransform =>
  transform(x, y, z, Quaternion.fromAxisAngle({ x: 0, y: 0, z: 1 }, degrees));
