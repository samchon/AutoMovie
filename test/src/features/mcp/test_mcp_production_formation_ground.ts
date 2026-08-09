import type { IAutoMovieFormationPlacement } from "@automovie/engine";
import type {
  IAutoMovieDiagnostic,
  IAutoMovieFormationMotion,
  IAutoMovieSpace,
} from "@automovie/interface";
import { validateAutoMovieFormationGround } from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";

import { namedFacts } from "../internal/predicates";

/** One square floor centred on the origin, walkable everywhere. */
const field = (half: number): IAutoMovieSpace => ({
  id: "field",
  surfaces: [
    {
      id: "ground",
      kind: "floor",
      polygon: [
        { x: -half, y: 0, z: -half },
        { x: half, y: 0, z: -half },
        { x: half, y: 0, z: half },
        { x: -half, y: 0, z: half },
      ],
      anchor: { x: 0, y: 0, z: 0 },
      rampTo: null,
    },
  ],
  walkable: ["ground"],
});

type IUnit = IAutoMovieFormationPlacement;

/**
 * One unit of four members, squared off a stated reach from its anchor.
 *
 * Members rather than a box: a formation extends forward from its anchor, and
 * what the gate measures is where a slot really stands.
 */
const unit = (reach: number, id = "army"): IUnit => ({
  id,
  count: 4,
  layout: {
    kind: "line",
    files: 2,
    ranks: 2,
    spacing: { lateral: 2 * reach, depth: reach },
  },
  anchor: { x: 0, y: 0, z: 0 },
  facingDeg: 0,
  seed: 0,
});

/** One cue carrying a unit a stated distance along +z between two times. */
const march = (
  metres: number,
  formation = "army",
): IAutoMovieFormationMotion => ({
  id: `${formation}-advance`,
  formation,
  action: "advance",
  start: 1,
  end: 3,
  from: {
    translation: { x: 0, y: 0, z: 0 },
    facingOffsetDeg: 0,
    spacingScale: { lateral: 1, depth: 1 },
  },
  to: {
    translation: { x: 0, y: 0, z: metres },
    facingOffsetDeg: 0,
    spacingScale: { lateral: 1, depth: 1 },
  },
  easing: "easeInOut",
});

/**
 * One cue that turns a unit through a stated angle and moves it nowhere.
 *
 * A long thin unit sweeps a circle of its own half-length, so a box that fits a
 * floor lengthwise leaves it while turning and fits again once square to it.
 */
const turn = (
  degrees: number,
  formation = "army",
): IAutoMovieFormationMotion => ({
  ...march(0, formation),
  to: {
    translation: { x: 0, y: 0, z: 0 },
    facingOffsetDeg: degrees,
    spacingScale: { lateral: 1, depth: 1 },
  },
});

/**
 * One cue carrying a unit from one stated place to another, turning nowhere.
 *
 * A cue's translation interpolates linearly, so the unit walks the straight
 * segment between the two. Both ends may stand on ground the middle does not.
 */
const carry = (
  from: { x: number; z: number },
  to: { x: number; z: number },
): IAutoMovieFormationMotion => ({
  ...march(0),
  from: {
    translation: { x: from.x, y: 0, z: from.z },
    facingOffsetDeg: 0,
    spacingScale: { lateral: 1, depth: 1 },
  },
  to: {
    translation: { x: to.x, y: 0, z: to.z },
    facingOffsetDeg: 0,
    spacingScale: { lateral: 1, depth: 1 },
  },
});

/** One unit far longer than it is wide, so a turn sweeps its far rank. */
const lance = (length: number, halfWidth: number): IUnit => ({
  id: "army",
  count: 4,
  layout: {
    kind: "line",
    files: 2,
    ranks: 2,
    spacing: { lateral: 2 * halfWidth, depth: length },
  },
  anchor: { x: 0, y: 0, z: 0 },
  facingDeg: 0,
  seed: 0,
});

/**
 * One unit scattered over a disc, so its box corners hold nobody.
 *
 * Every member is inside `radius` of the anchor; the corners of the box around
 * them are at `radius * sqrt(2)`, where nobody stands.
 */
const disc = (radius: number, count: number): IUnit => ({
  id: "army",
  count,
  layout: { kind: "scatter", radius, seed: 7 },
  anchor: { x: 0, y: 0, z: 0 },
  facingDeg: 0,
  seed: 11,
});

/**
 * One unit bent along an arc, so its box corners hold nobody either.
 *
 * Every member is exactly `radius` from the anchor, which is a circle and not
 * the box a circle fits in.
 */
const bow = (radius: number, count: number): IUnit => ({
  id: "army",
  count,
  layout: { kind: "arc", radius, arcDegrees: 180 },
  anchor: { x: 0, y: 0, z: 0 },
  facingDeg: 0,
  seed: 3,
});

/**
 * One unit in a wedge: row `r` holds columns `-r` through `r` at depth `r`.
 *
 * A triangle, so the box corner at full width and no depth is the emptiest
 * point a formation has.
 */
const wedge = (rows: number, spacing: number): IUnit => ({
  id: "army",
  count: rows * rows,
  layout: {
    kind: "wedge",
    depth: rows,
    spacing: { lateral: spacing, depth: spacing },
  },
  anchor: { x: 0, y: 0, z: 0 },
  facingDeg: 0,
  seed: 5,
});

/** A triangle floor sized to a wedge of a stated reach. */
const slope = (width: number, depth: number): IAutoMovieSpace => ({
  id: "slope",
  surfaces: [
    {
      id: "ground",
      kind: "floor",
      polygon: [
        { x: 0, y: 0, z: 0 },
        { x: width, y: 0, z: depth },
        { x: -width, y: 0, z: depth },
      ],
      anchor: { x: 0, y: 0, z: 0 },
      rampTo: null,
    },
  ],
  walkable: ["ground"],
});

/**
 * Two crossed walkable arms: a corridor along `z` and one along `x`.
 *
 * A long unit lies in one arm, ends the turn lying in the other, and fits in
 * neither on the way; a small one walks corner to corner and crosses the
 * quadrant between the roads. Both are the shape a gate reading only the ends
 * cannot see, and they are why the interior of a cue is sampled at all.
 */
const crossroads = (arm: number, halfWidth: number): IAutoMovieSpace => ({
  id: "crossroads",
  surfaces: [
    {
      id: "north-road",
      kind: "floor",
      polygon: [
        { x: -halfWidth, y: 0, z: -arm },
        { x: halfWidth, y: 0, z: -arm },
        { x: halfWidth, y: 0, z: arm },
        { x: -halfWidth, y: 0, z: arm },
      ],
      anchor: { x: 0, y: 0, z: 0 },
      rampTo: null,
    },
    {
      id: "east-road",
      kind: "floor",
      polygon: [
        { x: -arm, y: 0, z: -halfWidth },
        { x: arm, y: 0, z: -halfWidth },
        { x: arm, y: 0, z: halfWidth },
        { x: -arm, y: 0, z: halfWidth },
      ],
      anchor: { x: 0, y: 0, z: 0 },
      rampTo: null,
    },
  ],
  walkable: ["north-road", "east-road"],
});

/** A square floor turned on its point, so `|x| + |z|` bounds it. */
const diamond = (reach: number): IAutoMovieSpace => ({
  id: "diamond",
  surfaces: [
    {
      id: "ground",
      kind: "floor",
      polygon: [
        { x: -reach, y: 0, z: 0 },
        { x: 0, y: 0, z: -reach },
        { x: reach, y: 0, z: 0 },
        { x: 0, y: 0, z: reach },
      ],
      anchor: { x: 0, y: 0, z: 0 },
      rampTo: null,
    },
  ],
  walkable: ["ground"],
});

const codes = (
  space: IAutoMovieSpace | null,
  formations: readonly IUnit[],
  formationMotions?: readonly IAutoMovieFormationMotion[],
): string[] =>
  validateAutoMovieFormationGround(
    { id: "opening" },
    {
      scene: { space },
      formations,
      formationMotions,
    },
  ).map((diagnostic) => diagnostic.code);

/**
 * The time a refusal names, as the refusal itself spells it.
 *
 * Read as text rather than as a number, so a caller can weigh both the instant
 * and the digits it was stated to. An answer that names no time at all reads as
 * the empty string, which no reading of it can mistake for a valid one.
 */
const sampledTime = (diagnostics: readonly IAutoMovieDiagnostic[]): string =>
  /at ([0-9.]+)s/u.exec(diagnostics[0]?.message ?? "")?.[1] ?? "";

/**
 * A shot may not stage a unit on ground it did not stage under it.
 *
 * The space a shot stages is what the scene keeps and what the viewer turns
 * into real meshes, so a unit reaching past it stands over a void. The world
 * design does not answer this: authored terrain and a staged space are separate
 * records, which is how a field corrected in one went on drawing a floor a
 * third the size of its own unit in the other.
 *
 * Both numbers already exist. Where a member stands is the engine's, whether a
 * point is carried is the engine's, and this gate only compares them; deriving
 * a third answer here is the shape of the defect it exists to catch. What it
 * measures is members and not the box around them, because the corners of that
 * box are places a formation often has nobody.
 *
 * Scenarios:
 *
 * 1. A unit inside the staged floor is accepted, so the gate does not refuse the
 *    ordinary case it is meant to leave alone.
 * 2. A unit reaching past the floor is refused once, naming the shot, the unit and
 *    the place the ground does not carry, all read from the one answer rather
 *    than from the same question asked twice.
 * 3. A unit exactly on the boundary is accepted, because the edge of a floor is
 *    still floor and a strict reading would refuse a field sized to its unit.
 * 4. A shot with no staged space is not measured at all, because the engine then
 *    falls back to the scalar ground plane and there is no extent to leave.
 * 5. Every staged unit answers for itself: one contained beside one escaping
 *    reports exactly one refusal and names which unit left, so a passing
 *    sibling cannot hide a failing one and the gate cannot report either.
 * 6. A unit that fits where it stands and marches off the floor is refused at the
 *    moment it leaves and at the member that left, not at the end of its cue
 *    and a place far out over nothing: where a unit went over a void is what an
 *    author needs, and the end of the cue is not it.
 * 7. A unit whose cue keeps it on the floor is accepted, and a cue belonging to
 *    another unit does not move this one.
 * 8. A unit whose cue starts at zero is never where it was designed, so that is
 *    not measured: every sampled time is a position the unit really holds, and
 *    a gate that refused one it never held would be worse than none.
 * 9. A unit that lies along one arm of a crossroads and ends a quarter turn along
 *    the other leaves the ground in between, which reading only the ends cannot
 *    see. The refusal names one time inside the cue's own ends, stated to the
 *    millisecond rather than to the last digit a sample happens to carry, and a
 *    turn that never leaves is still accepted.
 * 10. A unit is judged by its members carried as points, not by a box re-fitted
 *     around them once turned, which a diamond floor separates: the re-fitted
 *     box reaches past ground every member still stands on.
 * 11. The same unit and turn over a floor between the two numbers is refused,
 *     because the member partway through the turn clears neither end's floor.
 *     With the case above it brackets where the unit is really widest, which is
 *     inside the turn and not at either end of it.
 * 12. Ground is not convex, so a straight walk between two places that each carry
 *     the unit is not itself carried. One crossing a crossroads corner to
 *     corner stands on the north road, ends on the east road, and passes over
 *     the quadrant between them, which reading only the ends cannot see any
 *     more for a walk than for a turn.
 * 13. A unit carried the length of a road that does carry it is accepted, so what
 *     the interior walk refuses is a crossing and not a journey.
 * 14. A scattered unit fills a disc, and the corners of the box around it stand at
 *     its radius times root two where nobody does. A floor shaped to the disc
 *     carries every member and not those corners, and is accepted.
 * 15. A unit bent along an arc puts every member exactly its radius out, which is a
 *     circle and not the box a circle fits in; the same floor carries it.
 * 16. A wedge is a triangle whose widest row is its deepest, so the box corner at
 *     full width and no depth is the emptiest point a formation has. A
 *     triangular floor carries every member and not that corner.
 * 17. A member off the floor is still refused whatever its layout, so what the
 *     three cases above buy is not a gate that has stopped looking.
 * 18. The same formation staged by a second shot is measured the same as by the
 *     first, because its members are found once and remembered, and what a
 *     remembered answer may change is nothing.
 * 19. A cue turning far enough to reach the sample cap is walked from a unit that
 *     does stand where it starts, so the walk runs rather than stopping at
 *     rest, and it still reaches an interior sample and names it. What
 *     resolution the cap left is not observed, only that an enormous turn is
 *     measured and answered rather than run away with.
 */
export const test_mcp_production_formation_ground = (): void => {
  TestValidator.equals(
    "a unit inside the staged floor is accepted",
    codes(field(10), [unit(4)]),
    [],
  );

  const escaped = validateAutoMovieFormationGround(
    { id: "opening" },
    { scene: { space: field(4) }, formations: [unit(10)] },
  );
  TestValidator.equals(
    "a unit reaching past the staged floor is refused, and the refusal says which and where",
    namedFacts([
      ["code", () => escaped[0]?.code === "engine-validation-failed"],
      ["one", () => escaped.length === 1],
      ["target", () => escaped[0]!.target === "shot:opening"],
      ["category", () => escaped[0]!.category === "error"],
      ["formation", () => escaped[0]!.message.startsWith("formation:army ")],
      ["corner", () => escaped[0]!.message.includes("(10, 0)")],
    ]),
    {
      code: true,
      one: true,
      target: true,
      category: true,
      formation: true,
      corner: true,
    },
  );

  TestValidator.equals(
    "a unit standing exactly on the edge is still standing on floor",
    codes(field(6), [unit(6)]),
    [],
  );

  TestValidator.equals(
    "a shot that staged no space is not measured",
    namedFacts([
      ["nullSpace", () => codes(null, [unit(1000)]).length === 0],
      [
        "absentSpace",
        () =>
          validateAutoMovieFormationGround(
            { id: "opening" },
            {
              scene: {},
              formations: [unit(1000)],
            },
          ).length === 0,
      ],
    ]),
    { nullSpace: true, absentSpace: true },
  );

  const sibling = validateAutoMovieFormationGround(
    { id: "opening" },
    { scene: { space: field(5) }, formations: [unit(2), unit(9, "cavalry")] },
  );
  TestValidator.equals(
    "one contained unit does not answer for an escaping one",
    namedFacts([
      ["one", () => sibling.length === 1],
      // Distinct ids, so the refusal has to name which unit left. Two units
      // called the same thing would let the gate report either and pass.
      ["names", () => sibling[0]!.message.startsWith("formation:cavalry ")],
    ]),
    { one: true, names: true },
  );

  const marched = validateAutoMovieFormationGround(
    { id: "opening" },
    {
      scene: { space: field(10) },
      formations: [unit(4)],
      formationMotions: [march(20)],
    },
  );
  const marchedOff = Number(sampledTime(marched));
  TestValidator.equals(
    "a unit that marches off the floor is refused where it left, not where its cue ended",
    namedFacts([
      ["code", () => marched[0]?.code === "engine-validation-failed"],
      ["afterStart", () => marchedOff > 1],
      ["beforeEnd", () => marchedOff < 3],
      // The corner that left is just past the floor's edge, inside the half
      // metre the resolution promises. Reading only the ends would name the
      // cue's own end and a corner fourteen metres out over nothing, which
      // tells an author where the unit finished rather than where it fell.
      ["corner", () => /\(4, 10(\.[0-9]{1,3})?\)/u.test(marched[0]!.message)],
    ]),
    { code: true, afterStart: true, beforeEnd: true, corner: true },
  );

  TestValidator.equals(
    "a unit that marches and stays on the floor is accepted",
    codes(field(20), [unit(4)], [march(10)]),
    [],
  );

  TestValidator.equals(
    "a cue belonging to another unit does not move this one",
    codes(field(10), [unit(4)], [march(20, "cavalry")]),
    [],
  );

  // A cue starting at zero means the unit is never at its design bounds, so
  // measuring them would refuse a shot for a position it never holds. Here the
  // unit begins carried 40 m onto a floor that reaches 60, and only its design
  // box, sitting at the origin, would be off a floor that starts at 30.
  const carried: IAutoMovieFormationMotion = {
    ...march(0),
    start: 0,
    end: 2,
    from: {
      translation: { x: 0, y: 0, z: 40 },
      facingOffsetDeg: 0,
      spacingScale: { lateral: 1, depth: 1 },
    },
    to: {
      translation: { x: 0, y: 0, z: 45 },
      facingOffsetDeg: 0,
      spacingScale: { lateral: 1, depth: 1 },
    },
  };
  const offsetFloor: IAutoMovieSpace = {
    id: "far-field",
    surfaces: [
      {
        id: "ground",
        kind: "floor",
        polygon: [
          { x: -10, y: 0, z: 30 },
          { x: 10, y: 0, z: 30 },
          { x: 10, y: 0, z: 60 },
          { x: -10, y: 0, z: 60 },
        ],
        anchor: { x: 0, y: 0, z: 30 },
        rampTo: null,
      },
    ],
    walkable: ["ground"],
  };
  TestValidator.equals(
    "a unit whose cue starts at zero is not judged where it never stands",
    codes(offsetFloor, [unit(4)], [carried]),
    [],
  );

  // A nine-by-one unit lies along one arm of a crossroads, ends a quarter turn
  // lying along the other, and is diagonal to both in between. Reading only the
  // ends says it never left the road.
  const turned = validateAutoMovieFormationGround(
    { id: "opening" },
    {
      scene: { space: crossroads(10, 1.5) },
      formations: [lance(9, 1)],
      formationMotions: [turn(90)],
    },
  );
  const turnedOff = sampledTime(turned);
  TestValidator.equals(
    "a unit that leaves the ground mid-turn is refused, at a time between the cue's own ends",
    namedFacts([
      ["code", () => turned[0]?.code === "engine-validation-failed"],
      ["one", () => turned.length === 1],
      ["afterStart", () => Number(turnedOff) > 1],
      ["beforeEnd", () => Number(turnedOff) < 3],
      // A sampled interior time is a long fraction, and the reading is stated
      // to the millisecond. Unrounded it would carry a dozen digits an author
      // finding a place on a field has no use for.
      ["rounded", () => /^[0-9]+(\.[0-9]{1,3})?$/u.test(turnedOff)],
      // And so is the place. A corner swung to an angle no author chose lands
      // on an irrational pair, and the reading is the same millimetre.
      [
        "roundedCorner",
        () =>
          /\(-?[0-9]+(\.[0-9]{1,3})?, -?[0-9]+(\.[0-9]{1,3})?\) where/u.test(
            turned[0]?.message ?? "",
          ),
      ],
    ]),
    {
      code: true,
      one: true,
      afterStart: true,
      beforeEnd: true,
      rounded: true,
      roundedCorner: true,
    },
  );

  TestValidator.equals(
    "a unit that turns without leaving its ground is accepted",
    codes(field(10), [lance(9, 1)], [turn(90)]),
    [],
  );

  // A box re-fitted around a turned box is bigger than it, and on a square floor
  // the two agree: the re-fitted half-extents are exactly the widest carried
  // corners in each axis. A diamond separates them, where `|x| + |z|` is what a
  // floor bounds. Through this quarter of a right angle the unit's furthest corner
  // reaches 12.81, at 38.7 degrees rather than at either end, while the box
  // around it reaches 14.14; a floor reaching 13.5 carries the one and not the
  // other. The interior is where the unit is widest, so an end-reading of this
  // case would understate its own margin.
  TestValidator.equals(
    "a unit is judged by its own corners, not the box around them",
    codes(diamond(13.5), [lance(9, 1)], [turn(45)]),
    [],
  );

  // The same unit through the same turn, over a floor between the two numbers.
  // Both ends clear 12.75 and the corner at 38.7 degrees does not, so only a
  // gate that looks inside the turn refuses it. With the case above, the two
  // bracket where this unit is really widest: past 12.75 and short of 13.5.
  TestValidator.equals(
    "a unit widest partway through its turn is refused by a floor its ends clear",
    codes(diamond(12.75), [lance(9, 1)], [turn(45)]),
    ["engine-validation-failed"],
  );

  // Ground is not convex, so a straight walk between two places that carry the
  // unit is not itself carried. This unit crosses a crossroads corner to
  // corner: it stands on the north road, ends on the east road, and passes
  // through the quadrant between them, which is no road at all.
  const crossed = validateAutoMovieFormationGround(
    { id: "opening" },
    {
      scene: { space: crossroads(10, 1.5) },
      formations: [unit(1)],
      formationMotions: [carry({ x: 0, z: -8 }, { x: 8, z: 0 })],
    },
  );
  const crossedOff = sampledTime(crossed);
  TestValidator.equals(
    "a unit carried straight across ground that is not there is refused",
    namedFacts([
      ["code", () => crossed[0]?.code === "engine-validation-failed"],
      ["afterStart", () => Number(crossedOff) > 1],
      ["beforeEnd", () => Number(crossedOff) < 3],
    ]),
    { code: true, afterStart: true, beforeEnd: true },
  );

  TestValidator.equals(
    "a unit carried along ground that does carry it is accepted",
    codes(
      crossroads(10, 1.5),
      [unit(1)],
      [carry({ x: 0, z: -8 }, { x: 0, z: 8 })],
    ),
    [],
  );

  // The gate measures members, not the box around them. These three layouts
  // leave their box corners empty, so a floor shaped to the members carries
  // every one of them and does not carry the corners. A gate reading the box
  // refuses all three, and every formation it refuses is standing on its
  // ground.
  TestValidator.equals(
    "a scattered unit on a floor shaped to its disc is accepted",
    codes(diamond(6 * Math.SQRT2), [disc(6, 200)]),
    [],
  );
  TestValidator.equals(
    "a unit bent along an arc on a floor shaped to its circle is accepted",
    codes(diamond(6 * Math.SQRT2), [bow(6, 41)]),
    [],
  );
  TestValidator.equals(
    "a wedge on a floor shaped to its triangle is accepted",
    codes(slope(40, 40), [wedge(9, 5)]),
    [],
  );
  TestValidator.equals(
    "a member off the floor is still refused, wherever its layout put it",
    codes(diamond(3), [disc(6, 200)]),
    ["engine-validation-failed"],
  );

  // The same formation is staged by every shot that uses it, and the members it
  // is judged by are found once and remembered. Asked twice, it answers the
  // same, which is what remembering an answer is allowed to change and all of
  // what it is allowed to change.
  const staged = disc(6, 200);
  const twice = diamond(6 * Math.SQRT2);
  TestValidator.equals(
    "a unit staged by a second shot is measured the same as by the first",
    namedFacts([
      ["first", () => codes(twice, [staged]).length === 0],
      ["again", () => codes(twice, [staged]).length === 0],
      ["andRefused", () => codes(diamond(3), [staged]).length === 1],
      ["stillRefused", () => codes(diamond(3), [staged]).length === 1],
    ]),
    { first: true, again: true, andRefused: true, stillRefused: true },
  );

  // A cue's turn is a plain unbounded number, and a thousand revolutions of one
  // would be hundreds of thousands of measurements without a cap on the samples
  // one cue may take. This unit stands on the
  // road it starts on, so the walk really runs rather than stopping at rest,
  // and it still reaches an interior sample and reports it. What the cap left
  // that sampling at — coarser, in proportion — is not observed here; only that
  // an enormous turn is measured and answered rather than run away with.
  const capped = validateAutoMovieFormationGround(
    { id: "opening" },
    {
      scene: { space: crossroads(10, 1.5) },
      formations: [lance(9, 1)],
      formationMotions: [turn(360_000)],
    },
  );
  const cappedOff = sampledTime(capped);
  TestValidator.equals(
    "a cue turning far enough to reach the sample cap is still walked to an answer",
    namedFacts([
      ["code", () => capped[0]?.code === "engine-validation-failed"],
      ["afterStart", () => Number(cappedOff) > 1],
      ["beforeEnd", () => Number(cappedOff) < 3],
    ]),
    { code: true, afterStart: true, beforeEnd: true },
  );
};
