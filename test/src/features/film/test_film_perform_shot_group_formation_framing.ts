import {
  DEFAULT_SUBJECT_HEIGHT,
  performShot,
  productionRuntimeModelId,
  stageScene,
} from "@automovie/engine";
import {
  IAutoMovieActionCall,
  IAutoMovieFormationMotion,
  IAutoMovieModel,
  IAutoMovieVector3,
} from "@automovie/interface";
import { materializeCompiledFormation } from "@automovie/production";
import { TestValidator } from "@nestia/e2e";

import {
  makePerformanceWrite,
  makeScriptWrite,
  makeStagingWrite,
  validSynthesizer,
} from "../internal/filmFixtures";
import { namedFacts, nclose, vclose } from "../internal/predicates";

/** One member's drawn height, and the interval between two of them. */
const MEMBER_HEIGHT = 2;
const INTERVAL = 2;

/** Files in the wide unit, so it reaches `((5 - 1) / 2) * 2 = 4` m either side. */
const FILES = 5;

/** Where the one staged node stands, well behind the lens. */
const NODE_Z = -30;

/** How far the cue carries the wide unit, and over how long. */
const CARRY_METRES = 30;
const DURATION = 2;

/**
 * One member-shaped runtime: a box standing on its own origin.
 *
 * A box tessellates about its centre, so lifting it by half its height puts its
 * floor at zero and its top at {@link MEMBER_HEIGHT}. Every number below is read
 * off that rather than out of the measurement under test.
 */
const memberModel: IAutoMovieModel = {
  id: productionRuntimeModelId("member"),
  name: null,
  origin: "generated",
  parts: [
    {
      id: "body",
      name: null,
      geometry: {
        type: "primitive",
        shape: { type: "box", width: 0.4, height: MEMBER_HEIGHT, depth: 0.4 },
      },
      material: null,
      attachedBone: null,
      transform: {
        translation: { x: 0, y: MEMBER_HEIGHT / 2, z: 0 },
        rotation: { x: 0, y: 0, z: 0, w: 1 },
        scale: { x: 1, y: 1, z: 1 },
      },
    },
  ],
  skeleton: null,
  body: null,
  materials: [],
  asset: null,
};

/** One compiled unit of `count` members in a single rank, on the origin. */
const unit = (id: string, count: number) =>
  materializeCompiledFormation({
    id,
    modelRecipe: "member",
    count,
    layout: {
      kind: "line",
      ranks: 1,
      files: count,
      spacing: { lateral: INTERVAL, depth: 1 },
    },
    anchor: { x: 0, y: 0, z: 0 },
    facingDeg: 0,
    seed: 1,
    capabilities: [],
    heroOverrides: [],
  });

const WIDE_UNIT = unit("wide-unit", FILES);
const LONE_UNIT = unit("lone-unit", 1);

/** The wide unit is carried along +x across the whole of the shot. */
const CARRY: IAutoMovieFormationMotion[] = [
  {
    id: "carry",
    formation: WIDE_UNIT.id,
    action: "advance",
    start: 0,
    end: DURATION,
    from: {
      translation: { x: 0, y: 0, z: 0 },
      facingOffsetDeg: 0,
      spacingScale: { lateral: 1, depth: 1 },
    },
    to: {
      translation: { x: CARRY_METRES, y: 0, z: 0 },
      facingOffsetDeg: 0,
      spacingScale: { lateral: 1, depth: 1 },
    },
    easing: "linear",
  },
];

const script = makeScriptWrite({
  logline: "One camera frames a mass and one figure from the same mark.",
  theme: "what a frame has to hold",
  cast: [{ node: "performer", character: "the performer", modelRef: null }],
  beats: [
    {
      id: "beat-1",
      name: "the framing",
      summary: "the camera frames what stands in front of it",
      durationHint: DURATION,
    },
  ],
});

/**
 * One camera stating a 90 degree vertical field of view, so `tan(fovY / 2) = 1`
 * and every solved distance below is exactly half its visible span. The one
 * staged node stands well behind the lens, so what the camera looks at is never
 * the thing a case has it frame.
 */
const staged = (() => {
  const result = stageScene(
    script,
    makeStagingWrite({
      scene: { id: "scene-mark", name: "the mark" },
      plan: "the camera stands back from the mark; the performer stands behind it.",
      actors: [
        {
          node: "performer",
          position: { x: 0, y: 0, z: NODE_Z },
          facingDeg: 0,
        },
      ],
      cameras: [
        {
          node: "cam",
          position: { x: 0, y: MEMBER_HEIGHT / 2, z: 20 },
          lookAt: { kind: "node", node: "performer" },
          fovDeg: 90,
          near: 0.1,
          far: 1000,
          depthPrecision: { minimumDepthBits: 24, maximumStepMeters: 100 },
        },
      ],
    }),
  );
  if (result.success !== true) throw new Error("staging fixture must succeed");
  return result;
})();

const frame = (props: {
  nodes?: string[];
  formations?: string[];
  move?: "static" | "follow";
}): IAutoMovieActionCall => ({
  verb: "frame",
  actor: "cam",
  start: 0,
  duration: "auto",
  framing: "wide",
  move: props.move ?? "static",
  on: {
    kind: "group",
    nodes: props.nodes ?? [],
    ...(props.formations === undefined ? {} : { formations: props.formations }),
  },
});

const perform = (props: {
  action: IAutoMovieActionCall;
  formations?: readonly ReturnType<typeof unit>[];
  models?: readonly IAutoMovieModel[];
  formationMotions?: readonly IAutoMovieFormationMotion[];
}) =>
  performShot({
    script,
    staged,
    performance: makePerformanceWrite({
      beat: "beat-1",
      draft: [props.action],
      revise: { review: "the frame holds what it has to hold.", final: null },
      duration: DURATION,
    }),
    synthesize: validSynthesizer,
    skeleton: () => null,
    formations: props.formations,
    models: props.models,
    formationMotions: props.formationMotions,
  });

/** Every translation key of a compiled camera clip, as points. */
const keysOf = (performed: ReturnType<typeof perform>): IAutoMovieVector3[] => {
  if (performed.success !== true) return [];
  const values = performed.shot.cameraMotion!.tracks[0]!.values;
  return Array.from({ length: values.length / 3 }, (_unused, k) => ({
    x: values[k * 3]!,
    y: values[k * 3 + 1]!,
    z: values[k * 3 + 2]!,
  }));
};

/** How far the solve stood the camera from the aim point it framed. */
const standoff = (key: IAutoMovieVector3, aim: IAutoMovieVector3): number =>
  Math.hypot(key.x - aim.x, key.y - aim.y, key.z - aim.z);

/** `wide` shows four times the subject, and aims at half its height. */
const SHOWN = 4;
const AIMED = 0.5;

/** How far the framing grammar stands back from a subject of this shape. */
const solved = (height: number, radius: number): number =>
  Math.max((height * SHOWN) / 2, (radius * 2 * SHOWN) / 2);

/** Half the wide unit's own reach, from its layout alone. */
const REACH = ((FILES - 1) / 2) * INTERVAL;

/** The compiled fallback member radius, which no recipe here overrides. */
const PAD = 0.5;

/** Half the horizontal diagonal of each box a case below has the camera hold. */
const WIDE_RADIUS = Math.hypot((REACH + PAD) * 2, PAD * 2) / 2;
const LONE_RADIUS = Math.hypot(PAD * 2, PAD * 2) / 2;
const UNION_RADIUS = Math.hypot((REACH + PAD) * 2, PAD - NODE_Z) / 2;

/** Where each of those boxes is aimed at, given the height above its floor. */
const WIDE_AIM: IAutoMovieVector3 = {
  x: 0,
  y: MEMBER_HEIGHT * AIMED,
  z: 0,
};
const NODE_AIM: IAutoMovieVector3 = {
  x: 0,
  y: DEFAULT_SUBJECT_HEIGHT * AIMED,
  z: NODE_Z,
};
const UNION_AIM: IAutoMovieVector3 = {
  x: 0,
  y: MEMBER_HEIGHT * AIMED,
  z: (NODE_Z + PAD) / 2,
};

/**
 * A camera frames a formation named as a group subject, at the extent that
 * formation really occupies.
 *
 * A mass is stored as one compact record and never as thousands of scene nodes,
 * so a group naming its members by id cannot name it at all: the ids do not
 * exist until a slot is materialized. Naming the unit is what makes it
 * addressable, and everything downstream of that name has to be the unit's own
 * geometry — the box its slots occupy, padded by a member's radius, raised by a
 * member's own drawn height, and moved by whatever cue is playing at the framed
 * instant.
 *
 * The oracle is the arithmetic. The wide unit is one rank of five at two-metre
 * intervals, so its slots span `[-4, 4]`; the compiled member radius no recipe
 * here overrides is 0.5, so its footprint is `[-4.5, 4.5] x [-0.5, 0.5]`; and
 * the member's own box stands two metres tall, so the whole of it is `[-4.5,
 * 4.5] x [0, 2] x [-0.5, 0.5]`. With `tan(fovY / 2) = 1` the framed distance is
 * half the visible span and `wide` shows four times the subject, so a two-metre
 * figure sits at 4 m and a mass at twice its own half-diagonal times four,
 * whichever of the two stands further back.
 *
 * Scenarios:
 *
 * 1. A group naming only the unit frames the unit: the compiled bounds and member
 *    radius are the ones the layout states, the standoff is the width that
 *    footprint demands, and the solved key is that far back along the staged
 *    bearing from the box's own bottom centre.
 * 2. A group naming only a staged node frames a body, an order of magnitude
 *    closer, so the distance above is the mass and not the framing grammar.
 * 3. A group naming both is framed at the union of both, which reaches from the
 *    node to the far flank of the unit and pulls the camera back past either
 *    answer alone.
 * 4. A unit of one member is narrow enough that the vertical fit decides, and the
 *    height that decides it is the member model's own two metres; supply no
 *    model for it and the documented stand-in decides instead. That pair is the
 *    whole of what reading the member's geometry buys.
 * 5. A cue is the only thing that moves a mass, so a unit carrying one is
 *    followed: the keys begin over the unit at rest and end over where the cue
 *    put it, which is the re-frame a marching mass needs. Without a cue the
 *    same group holds still and keys once, the documented degenerate follow.
 */
export const test_film_perform_shot_group_formation_framing = (): void => {
  // 1. the unit's own extent decides.
  const framed = perform({
    action: frame({ formations: [WIDE_UNIT.id] }),
    formations: [WIDE_UNIT],
    models: [memberModel],
  });
  const framedKeys = keysOf(framed);
  const wideDistance = solved(MEMBER_HEIGHT, WIDE_RADIUS);
  TestValidator.equals(
    "a formation named as a group subject is framed at its own extent",
    namedFacts([
      ["performed", () => framed.success === true],
      ["oneKey", () => framedKeys.length === 1],
      [
        "compiledBounds",
        () =>
          vclose(WIDE_UNIT.bounds.min, { x: -REACH, y: 0, z: 0 }) &&
          vclose(WIDE_UNIT.bounds.max, { x: REACH, y: 0, z: 0 }),
      ],
      ["compiledMemberRadius", () => nclose(WIDE_UNIT.projectionRadius, PAD)],
      // The footprint is what decides here, so a solve reading height alone
      // would stand at 4 m instead of eighteen.
      ["widthDecides", () => wideDistance > (MEMBER_HEIGHT * SHOWN) / 2],
      [
        "standoff",
        () => nclose(standoff(framedKeys[0]!, WIDE_AIM), wideDistance),
      ],
      [
        "onTheStagedBearing",
        () =>
          vclose(framedKeys[0]!, {
            x: WIDE_AIM.x,
            y: WIDE_AIM.y,
            z: WIDE_AIM.z + wideDistance,
          }),
      ],
    ]),
    {
      performed: true,
      oneKey: true,
      compiledBounds: true,
      compiledMemberRadius: true,
      widthDecides: true,
      standoff: true,
      onTheStagedBearing: true,
    },
  );

  // 2. the same grammar on one body, which is what the mass is measured against.
  const body = perform({ action: frame({ nodes: ["performer"] }) });
  const bodyKeys = keysOf(body);
  TestValidator.equals(
    "a group of one staged node is still framed as a body",
    namedFacts([
      ["performed", () => bodyKeys.length === 1],
      // The node carries no model here, so it takes the documented stand-in
      // height and no horizontal extent at all: a placement is a point.
      [
        "standoff",
        () =>
          nclose(
            standoff(bodyKeys[0]!, NODE_AIM),
            solved(DEFAULT_SUBJECT_HEIGHT, 0),
          ),
      ],
      [
        "nearerThanTheUnit",
        () => solved(DEFAULT_SUBJECT_HEIGHT, 0) < wideDistance,
      ],
    ]),
    { performed: true, standoff: true, nearerThanTheUnit: true },
  );

  // 3. a group of both is the union of both.
  const together = perform({
    action: frame({ nodes: ["performer"], formations: [WIDE_UNIT.id] }),
    formations: [WIDE_UNIT],
    models: [memberModel],
  });
  const togetherKeys = keysOf(together);
  const unionDistance = solved(MEMBER_HEIGHT, UNION_RADIUS);
  TestValidator.equals(
    "a group carrying a node and a unit is framed at the union of both",
    namedFacts([
      ["performed", () => togetherKeys.length === 1],
      ["widerThanTheUnitAlone", () => unionDistance > wideDistance],
      [
        "standoff",
        () => nclose(standoff(togetherKeys[0]!, UNION_AIM), unionDistance),
      ],
      [
        "aimedBetweenThem",
        () =>
          vclose(togetherKeys[0]!, {
            x: UNION_AIM.x,
            y: UNION_AIM.y,
            z: UNION_AIM.z + unionDistance,
          }),
      ],
    ]),
    {
      performed: true,
      widerThanTheUnitAlone: true,
      standoff: true,
      aimedBetweenThem: true,
    },
  );

  // 4. a narrow unit is decided by its member's own drawn height.
  const measured = perform({
    action: frame({ formations: [LONE_UNIT.id] }),
    formations: [LONE_UNIT],
    models: [memberModel],
  });
  const unmeasured = perform({
    action: frame({ formations: [LONE_UNIT.id] }),
    formations: [LONE_UNIT],
  });
  const measuredKeys = keysOf(measured);
  const unmeasuredKeys = keysOf(unmeasured);
  TestValidator.equals(
    "a narrow unit is framed by the height its member model really draws",
    namedFacts([
      [
        "performed",
        () => measuredKeys.length === 1 && unmeasuredKeys.length === 1,
      ],
      // The vertical fit has to be the deciding one, or the pair below would be
      // measuring the footprint rather than the member.
      [
        "heightDecides",
        () => (MEMBER_HEIGHT * SHOWN) / 2 > (LONE_RADIUS * 2 * SHOWN) / 2,
      ],
      [
        "measured",
        () =>
          nclose(
            standoff(measuredKeys[0]!, WIDE_AIM),
            solved(MEMBER_HEIGHT, LONE_RADIUS),
          ),
      ],
      // With no runtime supplied the member takes the documented stand-in, and
      // the camera stands where a 1.7 m figure would put it instead.
      [
        "standIn",
        () =>
          nclose(
            standoff(unmeasuredKeys[0]!, {
              x: 0,
              y: DEFAULT_SUBJECT_HEIGHT * AIMED,
              z: 0,
            }),
            solved(DEFAULT_SUBJECT_HEIGHT, LONE_RADIUS),
          ),
      ],
      [
        "theyDiffer",
        () => nclose(measuredKeys[0]!.z, unmeasuredKeys[0]!.z, 1e-6) === false,
      ],
    ]),
    {
      performed: true,
      heightDecides: true,
      measured: true,
      standIn: true,
      theyDiffer: true,
    },
  );

  // 5. a cue re-frames the mass; without one the same group holds still.
  const followed = perform({
    action: frame({ formations: [WIDE_UNIT.id], move: "follow" }),
    formations: [WIDE_UNIT],
    models: [memberModel],
    formationMotions: CARRY,
  });
  const held = perform({
    action: frame({ formations: [WIDE_UNIT.id], move: "follow" }),
    formations: [WIDE_UNIT],
    models: [memberModel],
  });
  const followedKeys = keysOf(followed);
  TestValidator.equals(
    "a cue is what lets a follow track a mass, and its absence is what holds one still",
    namedFacts([
      ["performed", () => followed.success === true && held.success === true],
      ["keyedTheWholeSpan", () => followedKeys.length > 1],
      [
        "beganAtRest",
        () =>
          vclose(followedKeys[0]!, {
            x: WIDE_AIM.x,
            y: WIDE_AIM.y,
            z: WIDE_AIM.z + wideDistance,
          }),
      ],
      [
        "endedWhereTheCuePutIt",
        () =>
          vclose(followedKeys[followedKeys.length - 1]!, {
            x: WIDE_AIM.x + CARRY_METRES,
            y: WIDE_AIM.y,
            z: WIDE_AIM.z + wideDistance,
          }),
      ],
      ["uncuedHoldsStill", () => keysOf(held).length === 1],
    ]),
    {
      performed: true,
      keyedTheWholeSpan: true,
      beganAtRest: true,
      endedWhereTheCuePutIt: true,
      uncuedHoldsStill: true,
    },
  );
};
