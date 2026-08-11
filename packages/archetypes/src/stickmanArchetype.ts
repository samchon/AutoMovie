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
 * @author Samchon
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
 * @evidenceExclude requirements/actors/body-scale-and-landmarks.md#actor-left-right-asymmetry The shipped proxy has paired left and right bones but no authored asymmetry parameter.
 * @evidenceExclude requirements/actors/representation-tiers-and-fidelity-boundary.md#actor-external-representation This native primitive builder does not import or adopt glTF, GLB, or VRM actors.
 * @evidenceExclude requirements/actors/representation-tiers-and-fidelity-boundary.md#actor-shot-tier-selection The archetype provides one explicit stick tier and does not choose a tier for a shot.
 * @evidenceExclude requirements/actors/representation-tiers-and-fidelity-boundary.md#actor-tier-compatibility Representation replacement and compatibility reporting occur outside this fixed proxy builder.
 * @evidenceExclude specifications/asset-and-representation/README.md#자산과-표현-시스템-사양 The stick proxy implements one model representation rather than the whole asset specification family.
 * @evidenceExclude specifications/performance-motion-and-staging/README.md#퍼포먼스-모션과-스테이징-시스템-명세 A neutral stick proxy is not the complete performance, motion, formation, and staging system.
 * @evidenceExclude specifications/asset-and-representation/fidelity-and-validation.md#asset-spec-validation-surface-visual The builder has no render capture, multi-angle inspection, or surface-quality finding.
 * @evidenceExclude specifications/asset-and-representation/fidelity-and-validation.md#asset-spec-validation-motion-transitions It builds a neutral rig and does not validate motion or representation transitions.
 * @evidenceExclude specifications/asset-and-representation/fidelity-and-validation.md#asset-spec-validation-current-evidence The archetype stores no validation receipt, frame identity, or prior approved comparison.
 * @evidenceExclude specifications/asset-and-representation/fidelity-and-validation.md#asset-spec-validation-status-failures Parameter bounds are validation inputs; this constant does not issue the full validation status vocabulary.
 * @evidenceExclude specifications/asset-and-representation/fidelity-and-validation.md#asset-spec-validation-compatibility-ceiling The crude form states a ceiling but does not produce a per-purpose compatibility approval result.
 * @evidenceExclude specifications/performance-motion-and-staging/actor-identity-state-and-fidelity.md#performance-actor-story-performance-state A model archetype does not schedule story actions, clocks, events, or ending state.
 * @evidenceExclude specifications/performance-motion-and-staging/actor-identity-state-and-fidelity.md#performance-actor-state-continuity-ledger The builder emits no scene-spanning actor state ledger.
 * @evidenceExclude specifications/performance-motion-and-staging/actor-identity-state-and-fidelity.md#performance-actor-appearance-costume-attachment The proxy has one material and no costume layer, attachment, or external appearance composition.
 * @evidenceExclude specifications/performance-motion-and-staging/actor-identity-state-and-fidelity.md#performance-actor-voice-utterance-expression This geometry builder has no voice binding, utterance clock, or facial channel.
 * @evidenceExclude specifications/performance-motion-and-staging/actor-identity-state-and-fidelity.md#performance-actor-pose-gaze-expression-state A neutral skeleton is not a pose, gaze, expression, or attention-state solver.
 * @evidenceExclude specifications/performance-motion-and-staging/actor-identity-state-and-fidelity.md#performance-actor-population-double-variation This archetype builds one requested proxy and does not allocate doubles or population budgets.
 * @evidenceExclude specifications/performance-motion-and-staging/actor-identity-state-and-fidelity.md#performance-actor-validation-output-compatibility The builder returns geometry, not an actor validation or replacement-compatibility receipt.
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
