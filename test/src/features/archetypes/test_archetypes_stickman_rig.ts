import { STICKMAN_ARCHETYPE } from "@automovie/archetypes";
import {
  IAutoMovieModel,
  IAutoMovieModelPart,
  IAutoMovieVector3,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { namedFacts, nclose, vclose } from "../internal/predicates";

/** The figure every case below reads, and the three numbers that shape it. */
const HEIGHT = 2;
const HEAD_RADIUS = 0.2;
const LIMB_RADIUS = 0.1;

const built = (parameters: {
  height: number;
  headRadius: number;
  limbRadius: number;
}) =>
  STICKMAN_ARCHETYPE.build({
    recipe: "figure",
    parameters,
    material: "body",
    skeleton: "figure-rig",
  });

const figure = built({
  height: HEIGHT,
  headRadius: HEAD_RADIUS,
  limbRadius: LIMB_RADIUS,
});

const skeleton = figure.skeleton as NonNullable<IAutoMovieModel["skeleton"]>;

const boneOf = (name: string) =>
  skeleton.bones.find((entry) => entry.bone === name);

const partOf = (id: string): IAutoMovieModelPart | undefined =>
  figure.parts.find((part) => part.id === id);

/** One part's primitive shape, or null when it draws something else. */
const shapeOf = (
  id: string,
): Extract<IAutoMovieModelPart["geometry"], { type: "primitive" }>["shape"] => {
  const part = partOf(id)!;
  if (part.geometry.type !== "primitive")
    throw new Error(`stickman part "${id}" is not a primitive`);
  return part.geometry.shape;
};

/** Where one bone rests relative to its parent. */
const restOf = (name: string): IAutoMovieVector3 =>
  boneOf(name)!.rest.translation;

/**
 * Every bone's parent, in the order the builder lists them.
 *
 * The parentage is the whole of what makes this a figure rather than thirteen
 * loose transforms: an arm that hung off the hips instead of the spine would
 * still have thirteen bones and still measure the same total height.
 */
const PARENTAGE: ReadonlyArray<readonly [string, string | null]> = [
  ["hips", null],
  ["spine", "hips"],
  ["head", "spine"],
  ["leftUpperArm", "spine"],
  ["leftLowerArm", "leftUpperArm"],
  ["leftHand", "leftLowerArm"],
  ["rightUpperArm", "spine"],
  ["rightLowerArm", "rightUpperArm"],
  ["rightHand", "rightLowerArm"],
  ["leftUpperLeg", "hips"],
  ["leftLowerLeg", "leftUpperLeg"],
  ["rightUpperLeg", "hips"],
  ["rightLowerLeg", "rightUpperLeg"],
];

/** Every part the builder emits, in the order it emits them. */
const PART_IDS: readonly string[] = [
  "pelvis",
  "torso",
  "head",
  "left-upper-arm",
  "left-lower-arm",
  "left-hand",
  "left-thigh",
  "left-shin",
  "right-upper-arm",
  "right-lower-arm",
  "right-hand",
  "right-thigh",
  "right-shin",
];

/** Which bone each of those parts rides. */
const PART_BONES: ReadonlyArray<readonly [string, string]> = [
  ["pelvis", "hips"],
  ["torso", "spine"],
  ["head", "head"],
  ["left-upper-arm", "leftUpperArm"],
  ["left-lower-arm", "leftLowerArm"],
  ["left-hand", "leftHand"],
  ["left-thigh", "leftUpperLeg"],
  ["left-shin", "leftLowerLeg"],
  ["right-upper-arm", "rightUpperArm"],
  ["right-lower-arm", "rightLowerArm"],
  ["right-hand", "rightHand"],
  ["right-thigh", "rightUpperLeg"],
  ["right-shin", "rightLowerLeg"],
];

/** The derived spans, written out as the proportions the builder states. */
const TORSO_HEIGHT = Math.max(HEAD_RADIUS * 2, HEIGHT * 0.3);
const UPPER_LIMB = Math.max(LIMB_RADIUS * 2, HEIGHT * 0.15);
const LOWER_LIMB = Math.max(LIMB_RADIUS * 2, HEIGHT * 0.14);

/**
 * The articulated archetype builds one exact figure, not merely thirteen parts.
 *
 * Counting parts is the assertion that cannot fail: a builder that hung every
 * limb off the hips, mirrored the wrong side, exchanged a capsule's radius for
 * its height, or lost the ninety-degree turn that lays an arm across the body
 * would emit thirteen parts and thirteen bones every time. What makes a figure
 * a figure is the parentage, the proportions and the local placements, and each
 * of those is a number the builder derives from `height` alone.
 *
 * Every expectation below is that derivation written out. A two-metre figure
 * puts its hips at 1 m, its spine 0.36 m above them and its head 0.48 m above
 * that; its arms leave the spine 0.25 m to either side; and its capsules take a
 * radius and a length that are different numbers, so exchanging them shows.
 *
 * Scenarios:
 *
 * 1. The skeleton is the thirteen bones the archetype declares, in that order,
 *    each on the parent that makes the chain a body.
 * 2. Every rest offset is the stated fraction of `height`, and the two sides
 *    mirror across `x` exactly rather than approximately.
 * 3. The parts are the thirteen the builder emits, in order, each riding its own
 *    bone and carrying the compiler's material.
 * 4. Each part's geometry is the shape and the dimensions its proportion states: a
 *    box that is wider than it is deep, a head of its own radius, capsules
 *    whose radius and length differ, and a hand slightly wider than the arm it
 *    ends.
 * 5. An arm is laid across the body rather than hanging from it: each upper and
 *    lower arm is offset along its own side and turned a quarter circle about
 *    `z`, in opposite senses left and right.
 * 6. A figure small enough that its head or its limbs are large in proportion
 *    takes the floors the builder states instead of the proportions, which is
 *    the arm of each `max` an ordinary figure never reaches.
 * 7. The compact projection bound is half the figure's own height.
 */
export const test_archetypes_stickman_rig = (): void => {
  TestValidator.equals(
    "the skeleton is the declared thirteen bones on the parents that make a body",
    namedFacts([
      ["declared", () => STICKMAN_ARCHETYPE.bones.length === PARENTAGE.length],
      [
        "declaredOrder",
        () =>
          STICKMAN_ARCHETYPE.bones.join(",") ===
          PARENTAGE.map(([name]) => name).join(","),
      ],
      ["id", () => skeleton.id === "figure-rig"],
      [
        "builtOrder",
        () =>
          skeleton.bones.map((entry) => entry.bone).join(",") ===
          PARENTAGE.map(([name]) => name).join(","),
      ],
      [
        "parentage",
        () =>
          PARENTAGE.every(([name, parent]) => boneOf(name)?.parent === parent),
      ],
      [
        "unconstrained",
        () => skeleton.bones.every((entry) => entry.constraint === null),
      ],
    ]),
    {
      declared: true,
      declaredOrder: true,
      id: true,
      builtOrder: true,
      parentage: true,
      unconstrained: true,
    },
  );

  TestValidator.equals(
    "every rest offset is the stated fraction of the figure's own height",
    namedFacts([
      ["hips", () => vclose(restOf("hips"), { x: 0, y: HEIGHT * 0.5, z: 0 })],
      [
        "spine",
        () => vclose(restOf("spine"), { x: 0, y: HEIGHT * 0.18, z: 0 }),
      ],
      ["head", () => vclose(restOf("head"), { x: 0, y: HEIGHT * 0.24, z: 0 })],
      [
        "upperArm",
        () =>
          vclose(restOf("leftUpperArm"), {
            x: HEIGHT * 0.125,
            y: HEIGHT * 0.15,
            z: 0,
          }),
      ],
      [
        "lowerArm",
        () => vclose(restOf("leftLowerArm"), { x: HEIGHT * 0.17, y: 0, z: 0 }),
      ],
      [
        "hand",
        () => vclose(restOf("leftHand"), { x: HEIGHT * 0.16, y: 0, z: 0 }),
      ],
      [
        "upperLeg",
        () =>
          vclose(restOf("leftUpperLeg"), {
            x: HEIGHT * 0.07,
            y: -HEIGHT * 0.04,
            z: 0,
          }),
      ],
      [
        "lowerLeg",
        () => vclose(restOf("leftLowerLeg"), { x: 0, y: -HEIGHT * 0.22, z: 0 }),
      ],
      // The right side is the left side reflected, which is what makes a
      // mirrored sign a visible defect rather than a second plausible figure.
      [
        "mirrored",
        () =>
          (
            [
              ["leftUpperArm", "rightUpperArm"],
              ["leftLowerArm", "rightLowerArm"],
              ["leftHand", "rightHand"],
              ["leftUpperLeg", "rightUpperLeg"],
              ["leftLowerLeg", "rightLowerLeg"],
            ] as const
          ).every(([left, right]) =>
            vclose(restOf(right), {
              x: -restOf(left).x,
              y: restOf(left).y,
              z: restOf(left).z,
            }),
          ),
      ],
      // And the arms really do leave the axis, or the mirror above would hold
      // of a figure whose limbs all stood on the centre line.
      ["armsLeaveTheAxis", () => restOf("leftUpperArm").x > 0],
    ]),
    {
      hips: true,
      spine: true,
      head: true,
      upperArm: true,
      lowerArm: true,
      hand: true,
      upperLeg: true,
      lowerLeg: true,
      mirrored: true,
      armsLeaveTheAxis: true,
    },
  );

  TestValidator.equals(
    "the parts are the thirteen the builder emits, each on its own bone",
    namedFacts([
      ["count", () => figure.parts.length === PART_IDS.length],
      [
        "order",
        () =>
          figure.parts.map((part) => part.id).join(",") === PART_IDS.join(","),
      ],
      [
        "bones",
        () =>
          PART_BONES.every(([id, bone]) => partOf(id)?.attachedBone === bone),
      ],
      [
        "material",
        () => figure.parts.every((part) => part.material === "body"),
      ],
    ]),
    { count: true, order: true, bones: true, material: true },
  );

  const pelvis = shapeOf("pelvis");
  const torso = shapeOf("torso");
  const head = shapeOf("head");
  const upperArm = shapeOf("left-upper-arm");
  const lowerArm = shapeOf("left-lower-arm");
  const hand = shapeOf("left-hand");
  const thigh = shapeOf("left-thigh");
  const shin = shapeOf("left-shin");
  TestValidator.equals(
    "each part draws the shape and the dimensions its proportion states",
    namedFacts([
      [
        "pelvis",
        () =>
          pelvis.type === "box" &&
          nclose(pelvis.width, HEIGHT * 0.19) &&
          nclose(pelvis.height, HEIGHT * 0.12) &&
          nclose(pelvis.depth, HEIGHT * 0.11),
      ],
      [
        "torso",
        () =>
          torso.type === "box" &&
          nclose(torso.width, HEIGHT * 0.25) &&
          nclose(torso.height, TORSO_HEIGHT) &&
          nclose(torso.depth, HEIGHT * 0.12),
      ],
      // A box wider than it is deep, so exchanging the two would show.
      [
        "wideNotDeep",
        () =>
          pelvis.type === "box" &&
          torso.type === "box" &&
          pelvis.width > pelvis.depth &&
          torso.width > torso.depth,
      ],
      [
        "head",
        () => head.type === "sphere" && nclose(head.radius, HEAD_RADIUS),
      ],
      [
        "upperArm",
        () =>
          upperArm.type === "capsule" &&
          nclose(upperArm.radius, LIMB_RADIUS) &&
          nclose(upperArm.height, UPPER_LIMB),
      ],
      [
        "lowerArm",
        () =>
          lowerArm.type === "capsule" &&
          nclose(lowerArm.radius, LIMB_RADIUS * 0.85) &&
          nclose(lowerArm.height, LOWER_LIMB),
      ],
      [
        "hand",
        () => hand.type === "sphere" && nclose(hand.radius, LIMB_RADIUS * 1.05),
      ],
      [
        "thigh",
        () =>
          thigh.type === "capsule" &&
          nclose(thigh.radius, LIMB_RADIUS * 1.15) &&
          nclose(thigh.height, HEIGHT * 0.19),
      ],
      [
        "shin",
        () =>
          shin.type === "capsule" &&
          nclose(shin.radius, LIMB_RADIUS) &&
          nclose(shin.height, HEIGHT * 0.19),
      ],
      // The forearm is thinner than the upper arm and the hand is wider than
      // either, so the four limb radii are four different numbers.
      [
        "fourRadii",
        () =>
          new Set([
            LIMB_RADIUS,
            LIMB_RADIUS * 0.85,
            LIMB_RADIUS * 1.05,
            LIMB_RADIUS * 1.15,
          ]).size === 4,
      ],
    ]),
    {
      pelvis: true,
      torso: true,
      wideNotDeep: true,
      head: true,
      upperArm: true,
      lowerArm: true,
      hand: true,
      thigh: true,
      shin: true,
      fourRadii: true,
    },
  );

  TestValidator.equals(
    "an arm is laid across the body, in opposite senses on the two sides",
    namedFacts([
      // A quarter turn about `z` is `(0, 0, sin(±45), cos(45))`, written out
      // rather than rebuilt through the same helper the builder used.
      [
        "leftTurned",
        () =>
          nclose(
            partOf("left-upper-arm")!.transform!.rotation.z,
            -Math.SQRT1_2,
          ) &&
          nclose(partOf("left-upper-arm")!.transform!.rotation.w, Math.SQRT1_2),
      ],
      [
        "rightTurned",
        () =>
          nclose(
            partOf("right-upper-arm")!.transform!.rotation.z,
            Math.SQRT1_2,
          ) &&
          nclose(
            partOf("right-upper-arm")!.transform!.rotation.w,
            Math.SQRT1_2,
          ),
      ],
      [
        "leftOffset",
        () =>
          vclose(partOf("left-upper-arm")!.transform!.translation, {
            x: UPPER_LIMB * 0.55,
            y: 0,
            z: 0,
          }),
      ],
      [
        "rightOffset",
        () =>
          vclose(partOf("right-upper-arm")!.transform!.translation, {
            x: -UPPER_LIMB * 0.55,
            y: 0,
            z: 0,
          }),
      ],
      [
        "forearmOffset",
        () =>
          vclose(partOf("left-lower-arm")!.transform!.translation, {
            x: LOWER_LIMB * 0.55,
            y: 0,
            z: 0,
          }),
      ],
      // The torso is lifted off its own bone and the legs hang below theirs,
      // while the head and the hands ride their bones exactly.
      [
        "torsoLifted",
        () =>
          vclose(partOf("torso")!.transform!.translation, {
            x: 0,
            y: TORSO_HEIGHT * 0.22,
            z: 0,
          }),
      ],
      [
        "legsHang",
        () =>
          vclose(partOf("left-thigh")!.transform!.translation, {
            x: 0,
            y: -HEIGHT * 0.105,
            z: 0,
          }) &&
          vclose(partOf("left-shin")!.transform!.translation, {
            x: 0,
            y: -HEIGHT * 0.105,
            z: 0,
          }),
      ],
      [
        "headAndHandsRideTheirBones",
        () =>
          partOf("head")!.transform === null &&
          partOf("left-hand")!.transform === null &&
          partOf("right-hand")!.transform === null,
      ],
    ]),
    {
      leftTurned: true,
      rightTurned: true,
      leftOffset: true,
      rightOffset: true,
      forearmOffset: true,
      torsoLifted: true,
      legsHang: true,
      headAndHandsRideTheirBones: true,
    },
  );

  // A figure whose head and limbs are large in proportion to it takes the
  // builder's own floors instead of its proportions.
  const SMALL = { height: 0.6, headRadius: 0.5, limbRadius: 0.25 };
  const small = built(SMALL);
  const smallShape = (
    id: string,
  ): Extract<
    IAutoMovieModelPart["geometry"],
    { type: "primitive" }
  >["shape"] => {
    const part = small.parts.find((entry) => entry.id === id)!;
    if (part.geometry.type !== "primitive")
      throw new Error(`stickman part "${id}" is not a primitive`);
    return part.geometry.shape;
  };
  const smallTorso = smallShape("torso");
  const smallUpper = smallShape("left-upper-arm");
  const smallLower = smallShape("left-lower-arm");
  TestValidator.equals(
    "a figure large in its own proportions takes the floors the builder states",
    namedFacts([
      // The proportion would give 0.18, 0.09 and 0.084; the floors give twice
      // the head and limb radii instead.
      [
        "torsoFloor",
        () =>
          smallTorso.type === "box" &&
          nclose(smallTorso.height, SMALL.headRadius * 2) &&
          SMALL.headRadius * 2 > SMALL.height * 0.3,
      ],
      [
        "upperFloor",
        () =>
          smallUpper.type === "capsule" &&
          nclose(smallUpper.height, SMALL.limbRadius * 2) &&
          SMALL.limbRadius * 2 > SMALL.height * 0.15,
      ],
      [
        "lowerFloor",
        () =>
          smallLower.type === "capsule" &&
          nclose(smallLower.height, SMALL.limbRadius * 2) &&
          SMALL.limbRadius * 2 > SMALL.height * 0.14,
      ],
      // And the ordinary figure above took the proportions, so both arms of
      // each choice are read.
      [
        "theOrdinaryFigureTookTheProportion",
        () =>
          nclose(TORSO_HEIGHT, HEIGHT * 0.3) &&
          nclose(UPPER_LIMB, HEIGHT * 0.15) &&
          nclose(LOWER_LIMB, HEIGHT * 0.14),
      ],
    ]),
    {
      torsoFloor: true,
      upperFloor: true,
      lowerFloor: true,
      theOrdinaryFigureTookTheProportion: true,
    },
  );

  TestValidator.equals(
    "the compact projection bound is half the figure's own height",
    namedFacts([
      [
        "half",
        () =>
          nclose(
            STICKMAN_ARCHETYPE.projectionRadius({
              height: HEIGHT,
              headRadius: HEAD_RADIUS,
              limbRadius: LIMB_RADIUS,
            }),
            HEIGHT / 2,
          ),
      ],
      [
        "unreadableHeightMeasuresZero",
        () =>
          STICKMAN_ARCHETYPE.projectionRadius({
            height: "tall",
            headRadius: HEAD_RADIUS,
            limbRadius: LIMB_RADIUS,
          }) === 0,
      ],
      ["signals", () => STICKMAN_ARCHETYPE.capabilities.join(",") === "signal"],
    ]),
    { half: true, unreadableHeightMeasuresZero: true, signals: true },
  );
};
