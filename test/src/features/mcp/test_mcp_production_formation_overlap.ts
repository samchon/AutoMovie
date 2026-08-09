import type { IAutoMovieFormationPlacement } from "@automovie/engine";
import type {
  AutoMovieHumanoidBone,
  IAutoMovieDiagnostic,
  IAutoMovieFormationMotion,
  IAutoMovieFormationSlotMotion,
  IAutoMovieModel,
  IAutoMovieTransform,
  IAutoMovieVector3,
} from "@automovie/interface";
import {
  autoMovieModelColumns,
  validateAutoMovieFormationOverlap,
} from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";

import { namedFacts, nclose } from "../internal/predicates";

/** One staged unit as the overlap gate reads it: a placement and its tiers. */
type IUnit = IAutoMovieFormationPlacement & {
  lod: ReadonlyArray<{ model: string }>;
};

/** A transform with a stated translation and nothing else changed. */
const at = (x: number, y: number, z: number): IAutoMovieTransform => ({
  translation: { x, y, z },
  rotation: { x: 0, y: 0, z: 0, w: 1 },
  scale: { x: 1, y: 1, z: 1 },
});

/**
 * One member-shaped runtime: a plain upright post two metres tall.
 *
 * A cylinder on the model's own origin, so its column is exactly its radius and
 * exactly its height, and every number a case asserts can be read off the
 * geometry rather than out of the gate.
 */
const post = (props: {
  id: string;
  radius: number;
  height?: number;
  lift?: number;
}): IAutoMovieModel => ({
  id: props.id,
  name: null,
  origin: "generated",
  parts: [
    {
      id: "body",
      name: null,
      geometry: {
        type: "primitive",
        shape: {
          type: "cylinder",
          radius: props.radius,
          height: props.height ?? 2,
        },
      },
      material: null,
      attachedBone: null,
      transform: props.lift === undefined ? null : at(0, props.lift, 0),
    },
  ],
  skeleton: null,
  body: null,
  materials: [],
  asset: null,
});

/** One row of members, evenly spaced across a stated interval. */
const row = (props: {
  id?: string;
  count?: number;
  spacing: number;
  model?: string;
  anchor?: IAutoMovieVector3;
}): IUnit => {
  const count = props.count ?? 4;
  return {
    id: props.id ?? "crowd",
    count,
    layout: {
      kind: "line",
      ranks: 1,
      files: count,
      spacing: { lateral: props.spacing, depth: props.spacing },
    },
    anchor: props.anchor ?? { x: 0, y: 0, z: 0 },
    facingDeg: 0,
    seed: 0,
    lod: [{ model: props.model ?? "post" }],
  };
};

/** One cue carrying a unit from one place to another along `x`. */
const carry = (props: {
  formation: string;
  from: number;
  to: number;
}): IAutoMovieFormationMotion => ({
  id: `${props.formation}-carry`,
  formation: props.formation,
  action: "advance",
  start: 1,
  end: 3,
  from: {
    translation: { x: props.from, y: 0, z: 0 },
    facingOffsetDeg: 0,
    spacingScale: { lateral: 1, depth: 1 },
  },
  to: {
    translation: { x: props.to, y: 0, z: 0 },
    facingOffsetDeg: 0,
    spacingScale: { lateral: 1, depth: 1 },
  },
  easing: "linear",
});

/** One cue closing a unit's own intervals to a stated fraction of themselves. */
const close = (props: {
  formation: string;
  scale: number;
}): IAutoMovieFormationMotion => ({
  ...carry({ formation: props.formation, from: 0, to: 0 }),
  to: {
    translation: { x: 0, y: 0, z: 0 },
    facingOffsetDeg: 0,
    spacingScale: { lateral: props.scale, depth: props.scale },
  },
});

/** One cue taking named members out of the shot for the whole of it. */
const remove = (props: {
  formation: string;
  slots: number[];
}): IAutoMovieFormationSlotMotion => ({
  id: `${props.formation}-remove`,
  formation: props.formation,
  slots: props.slots,
  start: 0,
  end: 4,
  from: {
    present: false,
    offset: { x: 0, y: 0, z: 0 },
    facingOffsetDeg: 0,
  },
  to: {
    present: false,
    offset: { x: 0, y: 0, z: 0 },
    facingOffsetDeg: 0,
  },
  easing: "linear",
});

const judge = (props: {
  models: readonly IAutoMovieModel[];
  formations: readonly IUnit[];
  formationMotions?: readonly IAutoMovieFormationMotion[];
  formationSlotMotions?: readonly IAutoMovieFormationSlotMotion[];
}): IAutoMovieDiagnostic[] =>
  validateAutoMovieFormationOverlap({ id: "opening" }, props);

const codes = (props: {
  models: readonly IAutoMovieModel[];
  formations: readonly IUnit[];
  formationMotions?: readonly IAutoMovieFormationMotion[];
  formationSlotMotions?: readonly IAutoMovieFormationSlotMotion[];
}): string[] => judge(props).map((diagnostic) => diagnostic.code);

/** The time a refusal names, as the refusal itself spells it. */
const sampledTime = (diagnostics: readonly IAutoMovieDiagnostic[]): string =>
  /at ([0-9.]+)s/u.exec(diagnostics[0]?.message ?? "")?.[1] ?? "";

/** One bone at a stated place, so a chain can be built out of order. */
const bone = (
  name: AutoMovieHumanoidBone,
  parent: AutoMovieHumanoidBone | null,
  place: IAutoMovieTransform,
): NonNullable<IAutoMovieModel["skeleton"]>["bones"][number] => ({
  bone: name,
  parent,
  rest: place,
  constraint: null,
});

/**
 * A shot may not stand one member of a crowd inside another.
 *
 * Two bodies cannot occupy one place, which is as true of dancers and animals
 * as of vehicles and machines. Nothing in the pipeline checked it: a unit could
 * be laid out at a tenth of its members' own width, a cue could pull one to a
 * fifth of its intervals, and two units could be staged on the same ground, and
 * every one of those compiled clean.
 *
 * A member's size is not asked of the author. It is read from the runtime the
 * compiler already built, as the largest disc that fits inside one of its parts
 * on the axis the member stands on, so the measure follows the geometry instead
 * of sitting beside it going stale. Inscribed and never circumscribed, because
 * a refusal has to mean two bodies really share a place: everything the reading
 * leaves out costs an overlap it does not find and can never make it invent
 * one.
 *
 * Scenarios:
 *
 * 1. Members standing further apart than their bodies reach are accepted, so the
 *    gate leaves alone the ordinary case it exists beside.
 * 2. Members standing closer are refused once, naming the shot, the unit, which
 *    two members, how far apart they stand, where, and the width they were
 *    measured against — all read from the one answer rather than asked twice.
 *    Four members overlap in three pairs and the unit is reported once, because
 *    an author correcting an interval corrects all of them.
 * 3. Members exactly their own width apart are accepted, because touching is not
 *    standing inside, and a strict reading would refuse a crowd dressed to its
 *    own measure.
 * 4. Two units each standing perfectly well are refused when they stand in each
 *    other, which is exactly what a gate looping one unit at a time cannot see.
 *    The refusal names both units and the member of each.
 * 5. Two units clear at both ends of a cue and passing through one another in
 *    between are refused at a time inside the cue's own ends, which reading only
 *    the ends cannot see.
 * 6. A cue closing a unit's intervals below its members' own width is refused,
 *    and one that keeps them above it is accepted: what a unit is laid out at is
 *    not the only arrangement it ever holds.
 * 7. A member the shot has taken out is not measured, because nothing can stand
 *    inside a body that is not there.
 * 8. Two units in one place at different heights are accepted, because bodies
 *    that never meet in height never share a place: the reading is a column and
 *    not a footprint.
 * 9. A unit whose runtime this shot does not carry, whose tier list is empty, or
 *    whose geometry fills no column at all is not measured rather than measured
 *    against a stand-in, and a shot with no measurable unit answers nothing.
 * 10. A unit measured by a second shot answers the same as by the first, because
 *     its members are found once and remembered, and what a remembered answer
 *     may change is nothing.
 * 11. Every primitive states the disc inside it: a sphere its radius, a capsule
 *     and a cylinder theirs over their shaft, a cone half its base over its
 *     wider half, a box its narrower side over its height. A plane has no
 *     thickness and a mesh states no dimensions, so neither holds a column, and
 *     nor does a shape whose dimensions are not real.
 * 12. A part is measured where its bone rests, added up the chain however the
 *     bones are ordered, and left out when the chain leaves the axis, when the
 *     part's own transform does, or when it turns about anything but the
 *     vertical. A part's scale is applied rather than refused, and one that
 *     scales a column away leaves nothing to measure.
 */
export const test_mcp_production_formation_overlap = (): void => {
  const wide = post({ id: "post", radius: 0.4 });

  TestValidator.equals(
    "members standing further apart than their bodies reach are accepted",
    codes({ models: [wide], formations: [row({ spacing: 1 })] }),
    [],
  );

  const packed = judge({
    models: [wide],
    formations: [row({ spacing: 0.5 })],
  });
  TestValidator.equals(
    "members standing inside one another are refused, and the refusal says which, where and against what",
    namedFacts([
      ["code", () => packed[0]?.code === "engine-validation-failed"],
      ["one", () => packed.length === 1],
      ["target", () => packed[0]!.target === "shot:opening"],
      ["category", () => packed[0]!.category === "error"],
      ["unit", () => packed[0]!.message.startsWith("formation:crowd ")],
      ["members", () => packed[0]!.message.includes("its slots 0 and 1")],
      // The row of four sits at -0.75, -0.25, 0.25 and 0.75, so the first two
      // stand half a metre apart with their midpoint at -0.5.
      ["apart", () => packed[0]!.message.includes("0.5m apart")],
      ["place", () => packed[0]!.message.includes("(-0.5, 0)")],
      // Two posts of 0.4 fill 0.8 m between their axes, which is the number an
      // author has to open the interval past.
      ["width", () => packed[0]!.message.includes("0.8m their bodies fill")],
    ]),
    {
      code: true,
      one: true,
      target: true,
      category: true,
      unit: true,
      members: true,
      apart: true,
      place: true,
      width: true,
    },
  );

  TestValidator.equals(
    "members exactly their own width apart are standing beside one another",
    codes({ models: [wide], formations: [row({ spacing: 0.8 })] }),
    [],
  );

  const crossed = judge({
    models: [wide],
    formations: [
      row({ id: "left", count: 1, spacing: 1 }),
      row({
        id: "right",
        count: 1,
        spacing: 1,
        anchor: { x: 0.3, y: 0, z: 0 },
      }),
    ],
  });
  TestValidator.equals(
    "two units each standing well but standing in each other are refused",
    namedFacts([
      ["one", () => crossed.length === 1],
      ["unit", () => crossed[0]!.message.startsWith("formation:left ")],
      [
        "other",
        () => crossed[0]!.message.includes(`its slot 0 and slot 0 of "right"`),
      ],
      ["apart", () => crossed[0]!.message.includes("0.3m apart")],
      ["place", () => crossed[0]!.message.includes("(0.15, 0)")],
    ]),
    { one: true, unit: true, other: true, apart: true, place: true },
  );

  // One unit stands at the origin; the other is staged five metres out and
  // carried ten metres across it. Both ends of that cue are clear, the place it
  // waits before the cue begins is clear, and the middle is not.
  const passed = judge({
    models: [wide],
    formations: [
      row({ id: "still", count: 1, spacing: 1 }),
      row({
        id: "walker",
        count: 1,
        spacing: 1,
        anchor: { x: -5, y: 0, z: 0 },
      }),
    ],
    formationMotions: [carry({ formation: "walker", from: 0, to: 10 })],
  });
  const passedAt = Number(sampledTime(passed));
  TestValidator.equals(
    "two units passing through one another are refused inside the cue that carries them",
    namedFacts([
      ["code", () => passed[0]?.code === "engine-validation-failed"],
      ["one", () => passed.length === 1],
      ["afterStart", () => passedAt > 1],
      ["beforeEnd", () => passedAt < 3],
    ]),
    { code: true, one: true, afterStart: true, beforeEnd: true },
  );

  TestValidator.equals(
    "a cue that closes a unit's own intervals is judged by what it closes them to",
    namedFacts([
      [
        "closedIsRefused",
        () =>
          codes({
            models: [wide],
            formations: [row({ spacing: 1 })],
            formationMotions: [close({ formation: "crowd", scale: 0.2 })],
          }).length === 1,
      ],
      [
        "heldIsAccepted",
        () =>
          codes({
            models: [wide],
            formations: [row({ spacing: 1 })],
            formationMotions: [close({ formation: "crowd", scale: 0.9 })],
          }).length === 0,
      ],
      [
        "anotherUnitsCueDoesNotClose",
        () =>
          codes({
            models: [wide],
            formations: [row({ spacing: 1 })],
            formationMotions: [close({ formation: "elsewhere", scale: 0.2 })],
          }).length === 0,
      ],
    ]),
    {
      closedIsRefused: true,
      heldIsAccepted: true,
      anotherUnitsCueDoesNotClose: true,
    },
  );

  TestValidator.equals(
    "a member the shot has taken out is not measured",
    codes({
      models: [wide],
      formations: [row({ count: 2, spacing: 0.5 })],
      formationSlotMotions: [remove({ formation: "crowd", slots: [1] })],
    }),
    [],
  );

  TestValidator.equals(
    "units in one place at heights that never meet are accepted",
    codes({
      models: [wide, post({ id: "upper", radius: 0.4, lift: 5 })],
      formations: [
        row({ id: "ground", count: 1, spacing: 1 }),
        row({ id: "sky", count: 1, spacing: 1, model: "upper" }),
      ],
    }),
    [],
  );

  const flat: IAutoMovieModel = {
    ...wide,
    id: "flat",
    parts: [
      {
        id: "sheet",
        name: null,
        geometry: {
          type: "primitive",
          shape: { type: "plane", width: 4, depth: 4 },
        },
        material: null,
        attachedBone: null,
        transform: null,
      },
    ],
  };
  TestValidator.equals(
    "a unit this shot cannot measure is left alone rather than measured against a guess",
    namedFacts([
      [
        "missingRuntime",
        () =>
          codes({
            models: [],
            formations: [row({ spacing: 0.1 })],
          }).length === 0,
      ],
      [
        "noTierAtAll",
        () =>
          codes({
            models: [wide],
            formations: [{ ...row({ spacing: 0.1 }), lod: [] }],
          }).length === 0,
      ],
      [
        "noColumnAtAll",
        () =>
          codes({
            models: [flat],
            formations: [row({ spacing: 0.1, model: "flat" })],
          }).length === 0,
      ],
      [
        "oneMeasurableUnitStillAnswers",
        () =>
          codes({
            models: [wide, flat],
            formations: [
              row({ id: "paper", spacing: 0.1, model: "flat" }),
              row({ id: "crowd", spacing: 0.1 }),
            ],
          }).length === 1,
      ],
    ]),
    {
      missingRuntime: true,
      noTierAtAll: true,
      noColumnAtAll: true,
      oneMeasurableUnitStillAnswers: true,
    },
  );

  // The same unit is staged by every shot that uses it, and the members it is
  // judged by are found once and remembered. Asked twice it answers the same,
  // which is what remembering an answer is allowed to change and all of it.
  const staged = row({ spacing: 0.5 });
  TestValidator.equals(
    "a unit measured by a second shot is measured the same as by the first",
    namedFacts([
      ["first", () => codes({ models: [wide], formations: [staged] }).length === 1],
      ["again", () => codes({ models: [wide], formations: [staged] }).length === 1],
    ]),
    { first: true, again: true },
  );

  const shapes: IAutoMovieModel = {
    ...wide,
    id: "shapes",
    parts: [
      { type: "sphere" as const, radius: 0.5 },
      { type: "capsule" as const, radius: 0.3, height: 2 },
      { type: "cylinder" as const, radius: 0.2, height: 4 },
      { type: "cone" as const, radius: 0.8, height: 4 },
      { type: "box" as const, width: 3, height: 6, depth: 1 },
      { type: "plane" as const, width: 3, depth: 3 },
      { type: "sphere" as const, radius: Number.POSITIVE_INFINITY },
      { type: "box" as const, width: 1, height: 0, depth: 1 },
    ].map((shape, index) => ({
      id: `part-${index}`,
      name: null,
      geometry: { type: "primitive" as const, shape },
      material: null,
      attachedBone: null,
      transform: null,
    })),
  };
  shapes.parts.push({
    id: "imported",
    name: null,
    geometry: {
      type: "mesh",
      mesh: {
        positions: [],
        normals: null,
        uvs: null,
        indices: null,
        skin: null,
      },
    },
    material: null,
    attachedBone: null,
    transform: null,
  });
  const measured = autoMovieModelColumns(shapes);
  TestValidator.equals(
    "every primitive states the disc inside it and nothing states one it has not got",
    namedFacts([
      // Sphere, capsule, cylinder, cone and box; the plane, the mesh, the
      // infinite radius and the flattened box hold no column at all.
      ["five", () => measured.length === 5],
      [
        "sphere",
        () =>
          nclose(measured[0]!.radius, 0.5) &&
          nclose(measured[0]!.bottom, -0.5) &&
          nclose(measured[0]!.top, 0.5),
      ],
      // A capsule's caps taper, so only the shaft between them is certainly
      // inside the disc its radius states.
      [
        "capsule",
        () =>
          nclose(measured[1]!.radius, 0.3) &&
          nclose(measured[1]!.bottom, -1) &&
          nclose(measured[1]!.top, 1),
      ],
      [
        "cylinder",
        () =>
          nclose(measured[2]!.radius, 0.2) &&
          nclose(measured[2]!.bottom, -2) &&
          nclose(measured[2]!.top, 2),
      ],
      // A cone is wide at the top and a point at the bottom, so the disc of
      // half its base radius is filled through its upper half and nowhere else.
      [
        "cone",
        () =>
          nclose(measured[3]!.radius, 0.4) &&
          nclose(measured[3]!.bottom, 0) &&
          nclose(measured[3]!.top, 2),
      ],
      // A box turned to any heading still holds the disc of its narrower side.
      [
        "box",
        () =>
          nclose(measured[4]!.radius, 0.5) &&
          nclose(measured[4]!.bottom, -3) &&
          nclose(measured[4]!.top, 3),
      ],
    ]),
    {
      five: true,
      sphere: true,
      capsule: true,
      cylinder: true,
      cone: true,
      box: true,
    },
  );

  // A chain listed child before parent, one bone off the axis carrying another
  // that is on it, and four parts: one on the root, one up the chain, one on
  // the off-axis branch, and one riding nothing at all.
  const rigged: IAutoMovieModel = {
    ...wide,
    id: "rigged",
    skeleton: {
      id: "rig",
      bones: [
        bone("head", "spine", at(0, 0.4, 0)),
        bone("spine", "hips", at(0, 0.6, 0)),
        bone("hips", null, at(0, 1, 0)),
        bone("leftUpperArm", "spine", at(0.3, 0, 0)),
        bone("leftLowerArm", "leftUpperArm", at(0, -0.2, 0)),
      ],
    },
    parts: [
      {
        id: "pelvis",
        name: null,
        geometry: {
          type: "primitive",
          shape: { type: "box", width: 0.4, height: 0.2, depth: 0.3 },
        },
        material: null,
        attachedBone: "hips",
        transform: at(0, 0, 0),
      },
      {
        id: "crown",
        name: null,
        geometry: { type: "primitive", shape: { type: "sphere", radius: 0.1 } },
        material: null,
        attachedBone: "head",
        transform: null,
      },
      {
        id: "forearm",
        name: null,
        geometry: {
          type: "primitive",
          shape: { type: "capsule", radius: 0.05, height: 0.3 },
        },
        material: null,
        attachedBone: "leftLowerArm",
        transform: null,
      },
      {
        id: "aside",
        name: null,
        geometry: { type: "primitive", shape: { type: "sphere", radius: 0.2 } },
        material: null,
        attachedBone: null,
        transform: at(0.5, 0, 0),
      },
      {
        id: "behind",
        name: null,
        geometry: { type: "primitive", shape: { type: "sphere", radius: 0.2 } },
        material: null,
        attachedBone: null,
        transform: at(0, 0, 0.5),
      },
      {
        id: "tipped",
        name: null,
        geometry: { type: "primitive", shape: { type: "sphere", radius: 0.2 } },
        material: null,
        attachedBone: null,
        transform: {
          ...at(0, 0, 0),
          rotation: { x: 0.7071, y: 0, z: 0, w: 0.7071 },
        },
      },
      {
        id: "rolled",
        name: null,
        geometry: { type: "primitive", shape: { type: "sphere", radius: 0.2 } },
        material: null,
        attachedBone: null,
        transform: {
          ...at(0, 0, 0),
          rotation: { x: 0, y: 0, z: 0.7071, w: 0.7071 },
        },
      },
      {
        id: "shrunk",
        name: null,
        geometry: {
          type: "primitive",
          shape: { type: "box", width: 2, height: 2, depth: 1 },
        },
        material: null,
        attachedBone: null,
        transform: { ...at(0, 1, 0), scale: { x: 3, y: -2, z: 4 } },
      },
      {
        id: "erased",
        name: null,
        geometry: { type: "primitive", shape: { type: "sphere", radius: 0.2 } },
        material: null,
        attachedBone: null,
        transform: { ...at(0, 0, 0), scale: { x: 0, y: 1, z: 1 } },
      },
    ],
  };
  const chained = autoMovieModelColumns(rigged);
  TestValidator.equals(
    "a part is measured up its own chain, and left out wherever that chain leaves the axis",
    namedFacts([
      // The pelvis, the crown and the scaled box. The forearm rides a branch
      // that left the axis, and the four beside it are displaced or tipped off
      // it themselves; the last is scaled to nothing across.
      ["three", () => chained.length === 3],
      [
        "pelvis",
        () =>
          nclose(chained[0]!.radius, 0.15) &&
          nclose(chained[0]!.bottom, 0.9) &&
          nclose(chained[0]!.top, 1.1),
      ],
      // Hips one metre up, spine six tenths above it, head four tenths above
      // that: two metres, whatever order the bones were listed in.
      [
        "crown",
        () =>
          nclose(chained[1]!.radius, 0.1) &&
          nclose(chained[1]!.bottom, 1.9) &&
          nclose(chained[1]!.top, 2.1),
      ],
      // A box 2 m across and 1 m deep, scaled by 3 and 4, is 6 m across and 4 m
      // deep, and the disc inside it is half the narrower of those. Mirrored
      // vertically it fills exactly what its unmirrored twin did, one metre up.
      [
        "scaled",
        () =>
          nclose(chained[2]!.radius, 2) &&
          nclose(chained[2]!.bottom, -1) &&
          nclose(chained[2]!.top, 3),
      ],
    ]),
    { three: true, pelvis: true, crown: true, scaled: true },
  );
};
