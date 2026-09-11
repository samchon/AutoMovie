import {
  AutoMovieHumanoidBone,
  IAutoMovieCompiledFormation,
  IAutoMovieCompiledShotSource,
  IAutoMovieDiagnostic,
  IAutoMovieFormationMotion,
  IAutoMovieFormationSlotMotion,
  IAutoMovieModel,
  IAutoMovieScene,
  IAutoMovieShotContract,
  IAutoMovieSpace,
  IAutoMovieVector3,
} from "@automovie/interface";

import { compareCodeUnits } from "../../../production/src/production/contentIdentity";
import {
  type IAutoMovieFormationPlacement,
  autoMovieModelGaits,
  formationSlotPosition,
  heightAt,
  placeFormationSlot,
  sampleFormationMotion,
  sampleFormationSlotMotion,
} from "../index";
import { engineDiagnostic } from "./productionValidationDiagnostics";

/**
 * Metres a member may travel between neighbouring samples inside one cue.
 *
 * Ground is judged in metres, so the resolution is stated in metres too. What
 * it buys is exactly this: no measured member moves further than half a metre
 * between one sample and the next, so a stretch of void wider than that has a
 * sample in it. A narrower one can still be stepped over. Nothing requires an
 * authored surface to be wide, so that is a limit of the gate and not a claim
 * about spaces.
 */
const FORMATION_GROUND_SAMPLE_METRES = 0.5;

/**
 * Directions the outermost member of a formation is asked for.
 *
 * A formation is a set of members, and which of them is furthest out depends on
 * which way you look. Sixteen evenly spaced looks put a measured member within
 * eleven degrees of any direction, so the outermost member in a direction not
 * asked about stands at least `cos(11.25 deg)` of the way out as the one that
 * was. Every measured point is a member, so a coarser reading can only miss; it
 * cannot refuse a formation that was standing on its ground.
 */
const FORMATION_GROUND_SUPPORT_DIRECTIONS = 16;

/**
 * Members already found for one compiled formation.
 *
 * The set is a pure function of the formation, and the builder hands the same
 * compiled formation to every shot that stages it, so a crowd in fifty shots
 * would otherwise regenerate every one of its members fifty times over. Keyed
 * by the formation itself, so nothing outlives the compile that made it.
 */
const formationGroundMemberCache = new WeakMap<
  IAutoMovieFormationPlacement,
  IFormationGroundMember[]
>();

/**
 * One member the ground gate measures, kept with the slot that produced it.
 *
 * The point alone was enough while every member of a unit did the same thing. A
 * member with its own cue does not, so the slot has to travel with the point: a
 * member removed at four seconds must stop being measured, and a member that
 * stepped off its place must be measured where it stepped to.
 */
interface IFormationGroundMember {
  /** Zero-based slot this point belongs to. */
  slot: number;
  /** Designed world-space position of that slot at rest. */
  point: IAutoMovieVector3;
}

/**
 * The members a formation is judged by: its outermost in each asked direction.
 *
 * `bounds` is the axis-aligned box over every slot, and its corners are not
 * members. A full `line` or `column` grid happens to put a slot at each of
 * them; a `wedge`, an `arc` and a `scatter` do not, so judging the corners
 * refuses formations every member of which is carried. This asks the engine
 * where the members are and keeps the outermost ones, which is both sound and
 * the set a floor's edge is met by.
 *
 * One pass over the slots, so the cost is the formation's own size and not the
 * square of it. The same member is usually outermost in several directions; it
 * is measured once.
 */
const formationGroundMembers = (
  formation: IAutoMovieFormationPlacement,
): IFormationGroundMember[] => {
  const remembered = formationGroundMemberCache.get(formation);
  if (remembered !== undefined) return remembered;
  const looks = Array.from(
    { length: FORMATION_GROUND_SUPPORT_DIRECTIONS },
    (_, index) => {
      const radians =
        (2 * Math.PI * index) / FORMATION_GROUND_SUPPORT_DIRECTIONS;
      return { x: Math.cos(radians), z: Math.sin(radians) };
    },
  );
  const furthest = looks.map(() => Number.NEGATIVE_INFINITY);
  const outermost = looks.map((): IFormationGroundMember | null => null);
  // One record per slot rather than per direction, so a formation of a hundred
  // thousand members is asked for each of them once. A member outermost in
  // several directions is the same object in each, which is what the set below
  // dedupes on.
  for (let slot = 0; slot < formation.count; ++slot) {
    const member = { slot, point: formationSlotPosition(formation, slot) };
    for (let index = 0; index < looks.length; ++index) {
      const look = looks[index]!;
      const reach = member.point.x * look.x + member.point.z * look.z;
      if (reach <= furthest[index]!) continue;
      furthest[index] = reach;
      outermost[index] = member;
    }
  }
  // A type predicate rather than a plain test: `filter` does not narrow on
  // its own, so the null the loop starts from would travel into every
  // consumer of a member's slot.
  const members = [
    ...new Set(
      outermost.filter(
        (member): member is IFormationGroundMember => member !== null,
      ),
    ),
  ];
  formationGroundMemberCache.set(formation, members);
  return members;
};

/**
 * Samples one cue may take, however far it carries a unit.
 *
 * A cue's turn and travel are plain unbounded numbers, and holding the
 * resolution over a turn of a thousand revolutions would cost a unit of
 * ordinary size hundreds of thousands of samples. Past this the walk stays
 * bounded and the resolution coarsens in proportion, which is the trade a gate
 * that samples has to make somewhere and had better say out loud.
 */
const FORMATION_GROUND_SAMPLE_LIMIT = 360;

/**
 * One reading as a reader wants it: three decimals, so a metre is stated to the
 * millimetre and a second to the millisecond.
 */
const round = (value: number): number => Math.round(value * 1_000) / 1_000;

/**
 * When inside one cue a staged unit is worth measuring against its ground.
 *
 * Reading only the ends of a cue would be enough if ground were convex, because
 * every part of a cue interpolates monotonically and a corner therefore travels
 * a bounded path between two ends. Ground is not convex: a space is a union of
 * authored surfaces, so a unit can stand on one, end on another, and cross what
 * is between them. That is true of a turn, which swings a corner through an arc
 * neither end holds, and just as true of a straight walk between two roads.
 *
 * So the interior is walked, at a resolution stated in the same metres the
 * ground is. How far a corner can travel in one cue is bounded by what the cue
 * does to it: the anchor's own travel, the arc a turn sweeps it through at its
 * radius, and the reach a spacing change adds. The interior is walked in even
 * time steps rather than even distance steps, because the state at a time is
 * the engine's answer and inverting an easing to land on an exact distance
 * would be a second one. Every easing this engine has moves at most twice the
 * average rate, so `n` even steps hold a corner's travel between neighbours
 * below `2 * reach / n`, and the step count is chosen from that bound rather
 * than guessed. The bound holds until {@link FORMATION_GROUND_SAMPLE_LIMIT}
 * clamps the count; a cue that carries a unit far enough to reach it is
 * measured more coarsely, in proportion.
 *
 * This samples; it does not solve. The set of times a unit is off its ground
 * has no closed form — it depends on the authored polygons as much as on the
 * cue — so a resolution is stated instead of a guarantee. Every sampled time is
 * a state the unit really occupies, which is what keeps the gate from ever
 * refusing a shot that was correct.
 *
 * A `step` cue holds its start state until its end, so its interior samples all
 * repeat that one state. They cost a little and answer correctly, which is the
 * trade taken rather than a branch here for the one easing that does not move.
 */
const formationGroundSampleTimes = (
  cue: IAutoMovieFormationMotion,
  radius: number,
  reformReach: number,
): number[] => {
  // How many times its design reach a spacing change ever holds a member out
  // at, so the arc a turn sweeps it through is measured at the radius it really
  // turns on. Read as a magnitude: a negative scale mirrors a unit rather than
  // shrinking it past nothing, and a mirrored member travels just as far.
  const spread = Math.max(
    Math.abs(cue.from.spacingScale.lateral),
    Math.abs(cue.to.spacingScale.lateral),
    Math.abs(cue.from.spacingScale.depth),
    Math.abs(cue.to.spacingScale.depth),
  );
  const reach =
    Math.hypot(
      cue.to.translation.x - cue.from.translation.x,
      cue.to.translation.z - cue.from.translation.z,
    ) +
    ((Math.abs(cue.to.facingOffsetDeg - cue.from.facingOffsetDeg) * Math.PI) /
      180) *
      radius *
      spread +
    Math.max(
      Math.abs(cue.to.spacingScale.lateral - cue.from.spacingScale.lateral),
      Math.abs(cue.to.spacingScale.depth - cue.from.spacingScale.depth),
    ) *
      radius +
    // A re-form moves members without moving the unit, so none of the terms
    // above sees it: a crowd changing shape in place has zero translation,
    // zero turn and unit spacing, and would be sampled at its two ends only.
    // The ground between two arrangements is exactly what an author cannot see
    // from either of them.
    reformReach;
  const steps = Math.min(
    FORMATION_GROUND_SAMPLE_LIMIT,
    Math.ceil((2 * reach) / FORMATION_GROUND_SAMPLE_METRES),
  );
  const span = cue.end - cue.start;
  return [
    cue.start,
    ...Array.from(
      { length: Math.max(0, steps - 1) },
      (_, index) => cue.start + (span * (index + 1)) / steps,
    ),
    cue.end,
  ];
};

/**
 * When inside one member's own cue that member is worth measuring.
 *
 * The same argument as {@link formationGroundSampleTimes} and the same bound: a
 * member's cue displaces it along a straight segment, ground is not convex, and
 * both ends can stand on floor the middle does not. What the member travels is
 * the length of that displacement, so the step count follows from it rather
 * than from a guess, and the same cap keeps a member carried absurdly far
 * measured coarsely instead of endlessly.
 *
 * A turn of the member alone sweeps nothing, because a member is a point to
 * this gate: the ground under it does not move when it faces another way.
 */
const formationSlotGroundSampleTimes = (
  cue: IAutoMovieFormationSlotMotion,
): number[] => {
  const reach = Math.hypot(
    cue.to.offset.x - cue.from.offset.x,
    cue.to.offset.z - cue.from.offset.z,
  );
  const steps = Math.min(
    FORMATION_GROUND_SAMPLE_LIMIT,
    Math.ceil((2 * reach) / FORMATION_GROUND_SAMPLE_METRES),
  );
  const span = cue.end - cue.start;
  return [
    cue.start,
    ...Array.from(
      { length: Math.max(0, steps - 1) },
      (_, index) => cue.start + (span * (index + 1)) / steps,
    ),
    cue.end,
  ];
};

/**
 * How far under a surface a member may read before it is inside the ground.
 *
 * A millimetre, which is what the refusal states its metres to. Terrain height
 * is interpolated — along a ramp axis, across a heightfield cell — and a member
 * placed from one record and judged against another accumulates the last bits
 * of two such interpolations. Refusing at those bits would refuse a unit
 * standing exactly on its ground, and this gate's whole discipline is that it
 * never refuses a shot that was correct.
 */
const FORMATION_GROUND_SINK_TOLERANCE_METRES = 1e-3;

/**
 * Why one placed member is off the ground a shot staged, or `null` when it is
 * not off it at all.
 *
 * Two ways to leave a floor, and the second is as broken as the first: standing
 * where nothing carries you, and standing under what does. `carried` names
 * which — `null` for the void, the surface's own height for the sinking — so
 * the refusal can say what an author has to correct rather than the same
 * sentence twice.
 *
 * Standing _above_ the surface is not refused. `anchor.y` is the height a unit
 * was staged at and always has been, and a shot deliberately holding a unit
 * over the space it staged — a rank on structure the space does not model, a
 * unit whose terrain record and staged space are two readings of one place — is
 * a composition, not a mistake. Under the surface admits no such reading: the
 * member is inside the ground and nothing can see it.
 */
const formationGroundEscape = (
  space: IAutoMovieSpace,
  place: IAutoMovieVector3,
): { carried: number | null } | null => {
  const carried = heightAt(space, place.x, place.z);
  if (carried === null) return { carried: null };
  return place.y < carried - FORMATION_GROUND_SINK_TOLERANCE_METRES
    ? { carried }
    : null;
};

/**
 * Refuse a staged unit the ground it was staged on does not carry.
 *
 * A shot's space is what the scene keeps and what the viewer turns into real
 * meshes, so a formation reaching past it is a unit standing over a void. That
 * is not caught by the world design: a world surface is authored terrain and is
 * a different record from the space a shot stages, which is how a field
 * corrected in one went on drawing a floor a third the size of its unit in the
 * other.
 *
 * The bounds are the builder's own and both the placement and the containment
 * question go to the engine that owns them, so this compares answers that
 * already exist rather than deriving a third that could disagree with both.
 *
 * What is measured is members, chosen by {@link formationGroundMembers}: the
 * outermost slot in each of a stated set of directions, carried through a cue
 * as points. Every measured point is somewhere a member really stands, so a
 * refusal is always sound; a member not asked about is the honest gap, stated
 * the same way the time resolution is.
 *
 * Each measured member is judged in height as well as in plan, by
 * {@link formationGroundEscape}: standing under the surface that carries you is
 * as broken as standing where nothing does, and a gate that refused only the
 * second would pass a whole unit buried in the hill it was staged on. The same
 * measured set answers both questions, so the height reading inherits its
 * honest gap: a member not asked about in plan is not asked about in height.
 *
 * A shot that stages no space is not measured. The engine then falls back to
 * the scalar ground plane it assumed before spaces existed, and there is no
 * authored extent for a unit to leave.
 *
 * A unit is measured where it stands and along every cue that moves it, at the
 * times {@link formationGroundSampleTimes} picks: the ends always, and the
 * interior at a resolution stated in metres. The interior is walked because
 * ground is not convex — two ends a unit stands on say nothing about what lies
 * between them. Every sampled time is a state the unit really occupies, so the
 * gate never refuses a shot that was correct, and it samples rather than solves
 * because where a unit leaves authored ground has no closed form.
 *
 * A member with its own cue is measured too, and measured as itself. Every slot
 * a per-member cue names is added to the set above — the channel is sparse, so
 * that costs the exceptions and not the crowd — and each measured member is
 * carried through its own cue as well as its unit's. A member the shot has
 * removed is not measured at all while it is absent: refusing a shot because
 * something nobody can see stands over a void is exactly the false refusal this
 * gate is built never to make.
 *
 * @author Samchon
 */
export const validateAutoMovieFormationGround = (
  contract: Pick<IAutoMovieShotContract, "id">,
  value: {
    scene: Pick<IAutoMovieScene, "space">;
    formations: readonly IAutoMovieFormationPlacement[];
    formationMotions?: readonly IAutoMovieFormationMotion[];
    formationSlotMotions?: readonly IAutoMovieFormationSlotMotion[];
  },
): IAutoMovieDiagnostic[] => {
  const space = value.scene.space;
  if (space === undefined || space === null) return [];
  const cues = value.formationMotions ?? [];
  const slotCues = value.formationSlotMotions ?? [];
  const diagnostics: IAutoMovieDiagnostic[] = [];
  for (const formation of value.formations) {
    const own = cues.filter((cue) => cue.formation === formation.id);
    const ownSlots = slotCues.filter((cue) => cue.formation === formation.id);
    // The outermost members, carried as points through the same transform the
    // runtime places them with, plus every member a cue singles out. The
    // outermost set is keyed by slot so a member that is both is measured once,
    // and measured with its own cue rather than without it.
    const members = new Map(
      formationGroundMembers(formation).map((member) => [member.slot, member]),
    );
    for (const cue of ownSlots)
      for (const slot of cue.slots) {
        if (
          members.has(slot) ||
          Number.isSafeInteger(slot) === false ||
          slot < 0 ||
          slot >= formation.count
        )
          continue;
        members.set(slot, {
          slot,
          point: formationSlotPosition(formation, slot),
        });
      }
    // How far out the furthest measured member sits, which is what turns an
    // angle a cue sweeps into the metres that member travels.
    const radius = Math.max(
      0,
      ...[...members.values()].map((member) =>
        Math.hypot(
          member.point.x - formation.anchor.x,
          member.point.z - formation.anchor.z,
        ),
      ),
    );
    const times = [
      ...new Set([
        ...own.flatMap((cue) =>
          formationGroundSampleTimes(
            cue,
            radius,
            // How far the furthest member this gate measures travels between
            // the two arrangements. Read off the members it walks rather than
            // bounded by the layouts' radii, so the sampling density is the
            // density of what is actually being asked.
            cue.layout === undefined
              ? 0
              : Math.max(
                  0,
                  ...[...members.values()].map((member) => {
                    const target = formationSlotPosition(
                      formation,
                      member.slot,
                      { layout: cue.layout!, progress: 1 },
                    );
                    return Math.hypot(
                      target.x - member.point.x,
                      target.z - member.point.z,
                    );
                  }),
                ),
          ),
        ),
        ...ownSlots.flatMap(formationSlotGroundSampleTimes),
      ]),
    ].sort((left, right) => left - right);
    // Where it was staged is measured only when the unit is ever there: with no
    // cue it never moves, and with a cue starting after zero it stands still
    // until then. A cue starting at zero means the unit begins somewhere its
    // design bounds never describe, and measuring those would refuse a shot for
    // a position it never holds.
    //
    // Asked of the earliest sampled time itself. A unit with no cue has none,
    // which is the same answer as a cue that starts later, and reading it once
    // spares a fallback for a `times` that cannot be empty when `own` is not:
    // a branch nothing can reach is a branch nothing can test.
    const first = times[0];
    const resting = first === undefined || first > 0;
    // Walked rather than collected, and stopped at the first escape. A cue is
    // sampled up to the cap, so gathering every member at every sampled time
    // before taking the first would measure a unit hundreds of times over to
    // report the moment it already found.
    let escape: {
      time: number | null;
      place: IAutoMovieVector3;
      carried: number | null;
    } | null = null;
    for (const time of [...(resting ? [null] : []), ...times]) {
      // The rest pass is its own loop rather than a branch inside the moving
      // one. At rest no cue of either kind has begun, so the member is exactly
      // where its design put it and is read as the designed point rather than
      // through an identity transform that would only round it -- and asking
      // the question here is what tells the sampler below that it has a time.
      if (time === null) {
        for (const member of members.values()) {
          const off = formationGroundEscape(space, member.point);
          if (off === null) continue;
          escape = { time, place: member.point, ...off };
          break;
        }
        if (escape !== null) break;
        continue;
      }
      const motion = sampleFormationMotion(own, formation.id, time);
      for (const member of members.values()) {
        // Re-read where the design puts this member when a cue is re-forming
        // the unit: the arrangement itself is moving, so the point the cached
        // sweep found is where the member stood before the re-form began. Read
        // once per member per sampled time, and only when a re-form is under
        // way -- a unit that keeps its arrangement pays nothing.
        const designed =
          motion.reform === null
            ? member.point
            : formationSlotPosition(formation, member.slot, motion.reform);
        const placed = placeFormationSlot({
          position: designed,
          facingDeg: formation.facingDeg,
          anchor: formation.anchor,
          baseFacingDeg: formation.facingDeg,
          unit: motion,
          member: sampleFormationSlotMotion(
            ownSlots,
            formation.id,
            member.slot,
            time,
          ),
        });
        // A member the shot has taken out is standing nowhere, so no surface
        // has to carry it. Refusing a shot for a member nobody can see is the
        // false refusal this gate exists never to make.
        if (placed.present === false) continue;
        const off = formationGroundEscape(space, placed.position);
        if (off === null) continue;
        escape = { time, place: placed.position, ...off };
        break;
      }
      if (escape !== null) break;
    }
    if (escape === null) continue;
    diagnostics.push(
      engineDiagnostic(
        contract.id,
        `formation:${formation.id}`,
        // Reported to the millimetre and the millisecond. A sampled interior
        // time and a turned member are both long fractions, and a diagnostic an
        // author reads to find a place on a field gains nothing from the digits
        // below that. Only the reading is rounded; the comparison above is not.
        `must stand on the space this shot staged, but ${
          escape.time === null
            ? "a member of it stands at"
            : `at ${round(escape.time)}s its cue takes a member of it to`
        } (${round(escape.place.x)}, ${round(escape.place.z)}) ${
          escape.carried === null
            ? "where no walkable surface carries it"
            : `at ${round(escape.place.y)}m, below the ${round(escape.carried)}m the surface there stands at`
        }`,
      ),
    );
  }
  return diagnostics;
};

/**
 * Members of one unit the overlap gate measures.
 *
 * Every measured member is a point placed into a grid at every sampled time,
 * and a unit may be a hundred thousand of them. Past this many the walk stays
 * bounded and what is measured is the unit's first slots, which is the trade a
 * gate that samples has to make somewhere and had better say out loud. Below it
 * — where nearly every authored unit sits — every member is measured, so every
 * pair standing inside its own bodies is found.
 */
const FORMATION_OVERLAP_MEMBER_LIMIT = 4096;

/**
 * Times inside one shot the overlap gate places its units at.
 *
 * Zero and both ends of every cue are always among them, because those are
 * states the shot certainly holds; whatever budget is left fills the gaps
 * between them evenly. The interior is what catches two units standing clear at
 * both ends of a cue and walking through one another in between, and a cue that
 * closes a gap for less than one such interval is the honest limit this number
 * states rather than hides.
 */
const FORMATION_OVERLAP_SAMPLE_LIMIT = 16;

/**
 * One vertical column a runtime model certainly fills, about its own axis.
 *
 * Not the extent of the model but a disc inside it: the largest circle that
 * fits in one part's own horizontal cross-section, centred on the axis the
 * member stands on, over the height that part covers. Two members standing
 * closer than the sum of two such radii, at heights whose intervals meet, are
 * two bodies in one place, and that is what lets a refusal be sound. Everything
 * the measure leaves out — an arm reaching outside the column, a part hung off
 * the axis — costs the gate an overlap it does not find, and can never make it
 * invent one.
 *
 * This is the model as it rests, which is the shape a unit is staged in and the
 * shape a crowd holds. What one member's own performance does to one of its
 * parts is not read here, in either direction: a gate that tried to would be
 * measuring a solver's output rather than a design's arrangement.
 *
 * @author Samchon
 */
export interface IAutoMovieModelColumn {
  /**
   * Radius of the disc the model fills, in metres.
   */
  radius: number;
  /**
   * Bottom of the column, in metres above where the model stands.
   */
  bottom: number;
  /**
   * Top of the column, in metres above where the model stands.
   */
  top: number;
}

/**
 * The columns one runtime model fills, read from the geometry it already is.
 *
 * A member's size is not a field an author states beside the model and then
 * contradicts: it is derived from the parts the builder materialized, so a
 * recipe that grows grows here too and there is nothing to keep in step by
 * hand. One reading answers for a figure assembled from primitives, for a
 * single-primitive object, and for the proxy an imported appearance is bound
 * through, because all three are parts with stated dimensions.
 *
 * Only parts standing on the model's own vertical axis are read. A part hung
 * off the axis sits somewhere different for every heading its member holds, and
 * this answer has to hold whichever way a member faces; a disc about the axis
 * does. A part turned about anything but the vertical is left out for the same
 * reason, its column no longer being vertical, and so is a scaled one, whose
 * real dimensions are no longer the ones its shape states.
 *
 * @author Samchon
 */
export const autoMovieModelColumns = (
  model: Pick<IAutoMovieModel, "parts" | "skeleton">,
): IAutoMovieModelColumn[] => {
  const heights = axialBoneHeights(model.skeleton);
  return model.parts.flatMap((part) => {
    const column = axialPartColumn(part, heights);
    return column === null ? [] : [column];
  });
};

/**
 * Where each bone rests on the model's own vertical axis, above its origin.
 *
 * A bone is on that axis when it and every bone above it rest with no sideways
 * displacement and no turn out of the vertical, which is exactly when adding up
 * the chain's heights gives the bone's real resting height. A bone that fails
 * either test, or whose parent does, is simply absent: the parts riding it are
 * then not measured, which costs the gate a column and never gives it a wrong
 * one.
 *
 * Resolved by repeated passes rather than by walking parents, because bones are
 * not required to be listed above their children, and a chain that never
 * resolves — a parent that is missing, off the axis, or its own ancestor —
 * simply stops adding heights instead of needing a cycle guard of its own.
 */
const axialBoneHeights = (
  skeleton: IAutoMovieModel["skeleton"],
): Map<AutoMovieHumanoidBone, number> => {
  const heights = new Map<AutoMovieHumanoidBone, number>();
  const axial = (skeleton?.bones ?? []).filter(
    (bone) =>
      bone.rest.translation.x === 0 &&
      bone.rest.translation.z === 0 &&
      bone.rest.rotation.x === 0 &&
      bone.rest.rotation.z === 0,
  );
  let settled = true;
  while (settled) {
    settled = false;
    for (const bone of axial) {
      if (heights.has(bone.bone)) continue;
      const above = bone.parent === null ? 0 : heights.get(bone.parent);
      if (above === undefined) continue;
      heights.set(bone.bone, above + bone.rest.translation.y);
      settled = true;
    }
  }
  return heights;
};

/**
 * The column one part fills on its model's axis, or `null` when it fills none.
 *
 * A part's own scale is applied rather than refused, because a scaled part is
 * still a solid: each horizontal reach is stretched by its own factor and the
 * disc inside the result is the narrower of the two, while a mirrored part
 * occupies exactly what its unmirrored twin did. That is also what makes one
 * reading at the end enough — a dimension that was never real, and a scale that
 * erases one, both arrive here as a column with nothing inside it.
 */
const axialPartColumn = (
  part: IAutoMovieModel["parts"][number],
  heights: ReadonlyMap<AutoMovieHumanoidBone, number>,
): IAutoMovieModelColumn | null => {
  const solid = columnOfShape(part.geometry);
  if (solid === null) return null;
  const base = axialPartHeight(part, heights);
  if (base === null) return null;
  const scale = part.transform === null ? UNIT_SCALE : part.transform.scale;
  const radius = Math.min(
    solid.across * Math.abs(scale.x),
    solid.deep * Math.abs(scale.z),
  );
  const centre = base + solid.centre * scale.y;
  const half = solid.half * Math.abs(scale.y);
  return finitePositive(radius) && finitePositive(half)
    ? { radius, bottom: centre - half, top: centre + half }
    : null;
};

/** The scale a part with no transform of its own is drawn at. */
const UNIT_SCALE: IAutoMovieVector3 = { x: 1, y: 1, z: 1 };

/**
 * Height above the model's origin at which one part rides, or `null` off-axis.
 *
 * A part rides a bone, or the model's origin when it rides no bone at all, and
 * then its own transform moves it again. Either step can take it off the axis
 * this gate measures about, and a part it cannot place is a part it does not
 * measure.
 */
const axialPartHeight = (
  part: IAutoMovieModel["parts"][number],
  heights: ReadonlyMap<AutoMovieHumanoidBone, number>,
): number | null => {
  const bone = part.attachedBone === null ? 0 : heights.get(part.attachedBone);
  if (bone === undefined) return null;
  const local = part.transform;
  if (local === null) return bone;
  return vertical(local.translation) && vertical(local.rotation)
    ? bone + local.translation.y
    : null;
};

/**
 * True when one displacement or turn leaves the model's vertical axis alone.
 *
 * A quaternion with no `x` and no `z` part turns about the vertical and nothing
 * else, which is exactly the turn a column of circular section does not notice.
 * A displacement with neither is a move straight up or down the axis it already
 * stood on.
 */
const vertical = (value: { x: number; z: number }): boolean =>
  value.x === 0 && value.z === 0;

/**
 * The solid one primitive shape certainly holds, as half-extents about its own
 * centre.
 *
 * Read as two horizontal reaches and a height rather than as a finished disc,
 * because the part's scale stretches the two reaches by different factors and
 * the disc inside the result is the narrower of them. A cone tapers, so what it
 * certainly holds is half its base reach over its wider half; a plane has no
 * thickness, so nothing is ever inside one; a mesh states no dimensions here
 * and is left to the parts that do.
 */
const columnOfShape = (
  geometry: IAutoMovieModel["parts"][number]["geometry"],
): { across: number; deep: number; centre: number; half: number } | null => {
  if (geometry.type !== "primitive") return null;
  const shape = geometry.shape;
  if (shape.type === "sphere")
    return {
      across: shape.radius,
      deep: shape.radius,
      centre: 0,
      half: shape.radius,
    };
  if (shape.type === "capsule" || shape.type === "cylinder")
    return {
      across: shape.radius,
      deep: shape.radius,
      centre: 0,
      half: shape.height / 2,
    };
  if (shape.type === "cone")
    return {
      across: shape.radius / 2,
      deep: shape.radius / 2,
      centre: shape.height / 4,
      half: shape.height / 4,
    };
  if (shape.type === "box")
    return {
      across: shape.width / 2,
      deep: shape.depth / 2,
      centre: 0,
      half: shape.height / 2,
    };
  return null;
};

const finitePositive = (value: number): boolean =>
  Number.isFinite(value) && value > 0;

/** One unit the overlap gate measures, with everything it is measured by. */
interface IFormationOverlapUnit {
  /** Position in the shot's own order, which is the order refusals come in. */
  index: number;
  /** The staged unit itself. */
  formation: IAutoMovieFormationPlacement & {
    lod: ReadonlyArray<{ model: string }>;
  };
  /** Where each measured member stands at rest, with the slot it is. */
  members: ReadonlyArray<{ slot: number; point: IAutoMovieVector3 }>;
  /** Columns of every runtime one of its members may be drawn as. */
  tiers: ReadonlyArray<readonly IAutoMovieModelColumn[]>;
}

/** One measured member, placed where the sampled time really puts it. */
interface IFormationOverlapPlacement {
  /** Unit this member stands in. */
  unit: IFormationOverlapUnit;
  /** Zero-based slot it is. */
  slot: number;
  /** Where it stands at the sampled time. */
  point: IAutoMovieVector3;
}

/**
 * The members one unit is measured by, found once and remembered.
 *
 * The set is a pure function of the unit, and the builder hands the same
 * compiled unit to every shot that stages it, so a crowd in fifty shots would
 * otherwise be regenerated fifty times over. Keyed by the unit itself, so
 * nothing outlives the compile that made it.
 */
const formationOverlapMemberCache = new WeakMap<
  IAutoMovieFormationPlacement,
  ReadonlyArray<{ slot: number; point: IAutoMovieVector3 }>
>();

const formationOverlapMembers = (
  formation: IAutoMovieFormationPlacement,
): ReadonlyArray<{ slot: number; point: IAutoMovieVector3 }> => {
  const remembered = formationOverlapMemberCache.get(formation);
  if (remembered !== undefined) return remembered;
  const members = Array.from(
    { length: Math.min(formation.count, FORMATION_OVERLAP_MEMBER_LIMIT) },
    (_, slot) => ({ slot, point: formationSlotPosition(formation, slot) }),
  );
  formationOverlapMemberCache.set(formation, members);
  return members;
};

/**
 * When one shot is worth placing its units at.
 *
 * Ends first, because the ends of a cue are states the shot certainly holds and
 * zero is where a unit that has no cue at all stands. Then the gaps between
 * them, filled evenly with whatever budget is left, because two units clear at
 * both ends of a cue can walk straight through one another in between and a
 * spacing that closes and reopens inside one cue never shows at either end.
 *
 * This samples; it does not solve. Whether two members are ever inside one
 * another has no closed form — it depends on the layouts, the easings and the
 * cues together — so a resolution is stated instead of a guarantee. Every
 * sampled time is a state the shot really holds, which is what keeps the gate
 * from refusing a production that was correct.
 */
const formationOverlapSampleTimes = (
  cues: readonly IAutoMovieFormationMotion[],
  slotCues: readonly IAutoMovieFormationSlotMotion[],
): number[] => {
  const ends = [
    ...new Set([
      0,
      ...cues.flatMap((cue) => [cue.start, cue.end]),
      ...slotCues.flatMap((cue) => [cue.start, cue.end]),
    ]),
  ].sort((left, right) => left - right);
  const gaps = Math.max(1, ends.length - 1);
  const inside = Math.max(
    0,
    Math.floor((FORMATION_OVERLAP_SAMPLE_LIMIT - ends.length) / gaps),
  );
  return [
    ...new Set(
      ends.flatMap((time, index) => {
        const next = ends[index + 1];
        return next === undefined
          ? [time]
          : [
              time,
              ...Array.from(
                { length: inside },
                (_, step) => time + ((next - time) * (step + 1)) / (inside + 1),
              ),
            ];
      }),
    ),
  ];
};

/**
 * How close two members of two units may stand before they are in one place.
 *
 * The least any pair of the runtimes they may be drawn as allows, because which
 * tier a member is drawn at is the camera's decision and a refusal has to hold
 * whichever one it makes. Zero when no pair of their columns ever meets in
 * height, which is two bodies that pass each other at different levels rather
 * than through each other.
 */
const formationOverlapClearance = (
  left: IFormationOverlapUnit,
  right: IFormationOverlapUnit,
  lift: number,
): number => {
  let least = Number.POSITIVE_INFINITY;
  for (const near of left.tiers)
    for (const far of right.tiers) {
      let widest = 0;
      for (const one of near)
        for (const other of far)
          if (
            Math.max(one.bottom, other.bottom + lift) <
              Math.min(one.top, other.top + lift) &&
            one.radius + other.radius > widest
          )
            widest = one.radius + other.radius;
      least = Math.min(least, widest);
    }
  return least;
};

/**
 * Refuse a shot that stands one member of a crowd inside another.
 *
 * Two bodies cannot occupy one place. That is a fact about dancers, animals,
 * vehicles and machines alike, and until this gate existed nothing in the
 * pipeline checked it: a unit could be laid out at a tenth of its members' own
 * width, a cue could pull one to a fifth of its spacing, and two units could be
 * staged on the same ground, and every one of those compiled clean and rendered
 * as figures standing through each other.
 *
 * A member's own size is not asked of the author. It is read from the runtime
 * the builder already built for it by {@link autoMovieModelColumns}, so the
 * measure follows the geometry rather than sitting beside it going stale, and a
 * unit whose runtime this shot does not carry is not measured at all rather
 * than measured against a guess.
 *
 * What is measured is members, at the times {@link formationOverlapSampleTimes}
 * picks and in the places {@link placeFormationSlot} puts them, which is the
 * same answer the renderer places them by. Both units of a pair are placed at
 * one time and compared to each other, which is what the ground gate's
 * per-formation loop structurally cannot see: two crowds each standing
 * perfectly well on the floor, in each other.
 *
 * Sound by construction and incomplete by design, in three stated ways: a
 * column is inscribed in a member and never around it, so a refusal means two
 * bodies really share a place; only the first
 * {@link FORMATION_OVERLAP_MEMBER_LIMIT} slots of an enormous unit are measured;
 * and time is sampled rather than solved. Each of those loses overlaps this
 * gate could have found. None of them can make it refuse a production that was
 * correct, which is the discipline the ground gate beside it is built on and
 * the only one worth having here.
 *
 * A member the shot has taken out is not measured, because nothing can stand
 * inside a body that is not there.
 *
 * @author Samchon
 */
export const validateAutoMovieFormationOverlap = (
  contract: Pick<IAutoMovieShotContract, "id">,
  value: {
    models: readonly IAutoMovieModel[];
    formations: ReadonlyArray<
      IAutoMovieFormationPlacement & {
        lod: ReadonlyArray<{ model: string }>;
      }
    >;
    formationMotions?: readonly IAutoMovieFormationMotion[];
    formationSlotMotions?: readonly IAutoMovieFormationSlotMotion[];
  },
): IAutoMovieDiagnostic[] => {
  const runtimes = new Map(value.models.map((model) => [model.id, model]));
  const units = value.formations.flatMap(
    (formation, index): IFormationOverlapUnit[] => {
      const tiers = formation.lod.map((tier) => {
        const runtime = runtimes.get(tier.model);
        return runtime === undefined ? [] : autoMovieModelColumns(runtime);
      });
      // A unit with a tier this shot does not carry, or one whose geometry fills
      // no column at all, has no size this gate can prove. Measuring it against
      // a stand-in number is how a gate starts refusing productions that were
      // correct, so it is left alone instead.
      return tiers.length === 0 || tiers.some((columns) => columns.length === 0)
        ? []
        : [
            {
              index,
              formation,
              members: formationOverlapMembers(formation),
              tiers,
            },
          ];
    },
  );
  if (units.length === 0) return [];
  const cues = value.formationMotions ?? [];
  const slotCues = value.formationSlotMotions ?? [];
  // One cell wide enough that no pair inside its own clearance can fall outside
  // the ring of cells around either of them. A height difference narrows a
  // clearance and never widens it, so twice the widest column in the shot bounds
  // every clearance there is.
  const cell =
    2 *
    Math.max(
      ...units.flatMap((unit) =>
        unit.tiers.flatMap((columns) => columns.map((column) => column.radius)),
      ),
    );
  const found = new Map<
    string,
    {
      time: number;
      left: IFormationOverlapPlacement;
      right: IFormationOverlapPlacement;
      apart: number;
      clearance: number;
    }
  >();
  for (const time of formationOverlapSampleTimes(cues, slotCues)) {
    const grid = new Map<string, IFormationOverlapPlacement[]>();
    for (const unit of units) {
      const motion = sampleFormationMotion(cues, unit.formation.id, time);
      for (const member of unit.members) {
        // Where the design puts this member NOW: a re-forming unit is moving
        // its own arrangement, so the cached point is where the member stood
        // before the cue began. Members crossing each other mid-re-form is
        // exactly the collision this gate exists to catch.
        const designed =
          motion.reform === null
            ? member.point
            : formationSlotPosition(unit.formation, member.slot, motion.reform);
        const placed = placeFormationSlot({
          position: designed,
          facingDeg: unit.formation.facingDeg,
          anchor: unit.formation.anchor,
          baseFacingDeg: unit.formation.facingDeg,
          unit: motion,
          member: sampleFormationSlotMotion(
            slotCues,
            unit.formation.id,
            member.slot,
            time,
          ),
        });
        if (placed.present === false) continue;
        const here: IFormationOverlapPlacement = {
          unit,
          slot: member.slot,
          point: placed.position,
        };
        const column = Math.floor(placed.position.x / cell);
        const row = Math.floor(placed.position.z / cell);
        for (let across = -1; across <= 1; ++across)
          for (let along = -1; along <= 1; ++along)
            for (const other of grid.get(`${column + across}:${row + along}`) ??
              []) {
              // Ordered by the unit each stands in, and every member already in
              // the grid was placed by a unit no later than this one, so one
              // reading of a pair of units is the whole of what it reports.
              const pair = `${other.unit.index}:${unit.index}`;
              if (found.has(pair)) continue;
              const clearance = formationOverlapClearance(
                other.unit,
                unit,
                here.point.y - other.point.y,
              );
              const apart = Math.hypot(
                here.point.x - other.point.x,
                here.point.z - other.point.z,
              );
              if (apart >= clearance) continue;
              found.set(pair, {
                time,
                left: other,
                right: here,
                apart,
                clearance,
              });
            }
        const key = `${column}:${row}`;
        const neighbours = grid.get(key);
        if (neighbours === undefined) grid.set(key, [here]);
        else neighbours.push(here);
      }
    }
  }
  return [...found.values()].map((overlap) =>
    engineDiagnostic(
      contract.id,
      `formation:${overlap.left.unit.formation.id}`,
      // Reported to the millimetre and the millisecond, the same as every other
      // reading a shot's author reads to find a place on a field. Only the
      // reading is rounded; the comparison above is not.
      `must not stand a member where another body already is, but at ${round(
        overlap.time,
      )}s ${
        overlap.left.unit === overlap.right.unit
          ? `its slots ${overlap.left.slot} and ${overlap.right.slot}`
          : `its slot ${overlap.left.slot} and slot ${overlap.right.slot} of "${overlap.right.unit.formation.id}"`
      } stand ${round(overlap.apart)}m apart at (${round(
        (overlap.left.point.x + overlap.right.point.x) / 2,
      )}, ${round(
        (overlap.left.point.z + overlap.right.point.z) / 2,
      )}), inside the ${round(overlap.clearance)}m their bodies fill`,
    ),
  );
};

/**
 * Validate bounded source-authored formation cues against one compiled shot.
 *
 * @author Samchon
 */
export const validateAutoMovieFormationMotions = (
  contract: IAutoMovieShotContract,
  value: IAutoMovieCompiledShotSource,
): IAutoMovieDiagnostic[] => {
  const diagnostics: IAutoMovieDiagnostic[] = [];
  const fail = (field: string, expectation: string): void => {
    diagnostics.push(engineDiagnostic(contract.id, field, expectation));
  };
  if (value.formationMotions.length > 256)
    fail(
      "formationMotions",
      "must contain at most 256 compact cues rather than per-member curves",
    );
  const ids = new Set<string>();
  const participating = new Set(
    contract.participants.flatMap((participant) =>
      participant.kind === "formation" ? [participant.id] : [],
    ),
  );
  const priorByFormation = new Map<
    string,
    IAutoMovieCompiledShotSource["formationMotions"][number]
  >();
  // What each unit's own tier figures can perform, read through the engine's
  // answer rather than a second one, so a cue this compile accepts is one the
  // viewer's bake accepts too. A unit whose figures declare nothing is a crowd
  // of props and has no repertoire to disagree with, exactly as the bake reads
  // it.
  const runtimeById = new Map(value.models.map((model) => [model.id, model]));
  const repertoire = new Map(
    value.formations.map((formation) => [
      formation.id,
      new Set(
        formation.lod.flatMap((tier) => {
          const model = runtimeById.get(tier.model);
          return model === undefined
            ? []
            : autoMovieModelGaits(model).map((gait) => gait.name);
        }),
      ),
    ]),
  );
  for (const cue of [...value.formationMotions].sort(
    (left, right) =>
      compareCodeUnits(left.formation, right.formation) ||
      left.start - right.start ||
      compareCodeUnits(left.id, right.id),
  )) {
    if (cue.id.trim().length === 0 || ids.has(cue.id))
      fail(
        `formationMotion:${cue.id || "(blank)"}`,
        "must have one non-blank id unique inside the shot",
      );
    ids.add(cue.id);
    if (
      participating.has(cue.formation) === false ||
      value.formations.some((formation) => formation.id === cue.formation) ===
        false
    )
      fail(
        `formationMotion:${cue.id}.formation`,
        `must reference participating compiled formation "${cue.formation}"`,
      );
    // The arrangement a cue re-forms into has to be one this unit can stand
    // in. A lattice narrower than the unit is a member with no place, and a
    // lattice of zero files is a division by zero inside the placement itself
    // -- neither is a picture, and both are the author's to correct here
    // rather than the renderer's to discover.
    const target = cue.layout;
    const unit = value.formations.find(
      (formation) => formation.id === cue.formation,
    );
    if (target !== undefined && unit !== undefined) {
      const lattice =
        target.kind === "line" || target.kind === "column"
          ? { ranks: target.ranks, files: target.files }
          : null;
      if (
        lattice !== null &&
        (Number.isSafeInteger(lattice.ranks) === false ||
          Number.isSafeInteger(lattice.files) === false ||
          lattice.ranks < 1 ||
          lattice.files < 1 ||
          lattice.ranks * lattice.files < unit.count)
      )
        fail(
          `formationMotion:${cue.id}.layout`,
          `must seat all ${unit.count} members in whole ranks and files rather than ${lattice.ranks} x ${lattice.files}`,
        );
    }
    const declared = repertoire.get(cue.formation);
    if (
      cue.gait !== undefined &&
      declared !== undefined &&
      declared.size !== 0 &&
      declared.has(cue.gait) === false
    )
      fail(
        `formationMotion:${cue.id}.gait`,
        `must name one of the gaits this unit's figures declare (${[...declared]
          .sort(compareCodeUnits)
          .join(", ")}) rather than "${cue.gait}"`,
      );
    if (
      Number.isFinite(cue.start) === false ||
      Number.isFinite(cue.end) === false ||
      cue.start < 0 ||
      cue.end <= cue.start ||
      cue.end > contract.durationSeconds
    )
      fail(
        `formationMotion:${cue.id}.time`,
        `must be one positive interval inside 0..${contract.durationSeconds}s`,
      );
    for (const [name, state] of [
      ["from", cue.from],
      ["to", cue.to],
    ] as const) {
      if (
        [state.translation.x, state.translation.y, state.translation.z].some(
          (number) =>
            Number.isFinite(number) === false ||
            Math.abs(number) > 1_000_000_000,
        ) ||
        Number.isFinite(state.facingOffsetDeg) === false ||
        Math.abs(state.facingOffsetDeg) > 360_000
      )
        fail(
          `formationMotion:${cue.id}.${name}`,
          "must keep translation inside +/-1000000000m and facing inside +/-360000 degrees",
        );
      if (
        [state.spacingScale.lateral, state.spacingScale.depth].some(
          (number) =>
            Number.isFinite(number) === false || number < 0.25 || number > 4,
        )
      )
        fail(
          `formationMotion:${cue.id}.${name}.spacingScale`,
          "must stay inside the bounded 0.25..4 envelope",
        );
    }
    const prior = priorByFormation.get(cue.formation);
    if (prior !== undefined && cue.start < prior.end)
      fail(
        `formationMotion:${cue.id}.start`,
        `must not overlap prior cue "${prior.id}" ending at ${prior.end}s`,
      );
    priorByFormation.set(cue.formation, cue);
  }
  return diagnostics;
};

/**
 * Members one shot may single out of its crowds, in total.
 *
 * The channel's whole promise is that a crowd of a hundred thousand does not
 * pay for the three members something happens to, and a promise nothing
 * enforces is a comment. Past this the answer is the other mechanism: a member
 * that needs a shot's full attention is promoted to a named actor, which exists
 * and is capped for the same reason. This is the cheaper thing and must not
 * become that.
 */
const FORMATION_SLOT_EXCEPTION_LIMIT = 1_024;

/**
 * Validate sparse per-member exceptions against one compiled shot.
 *
 * Narrowed to what it reads, like the ground gate beside it: the unit's own
 * count and hero inventory decide which slots exist and which already belong to
 * an actor, and nothing else about a compiled shot bears on the question.
 *
 * @author Samchon
 */
export const validateAutoMovieFormationSlotMotions = (
  contract: Pick<
    IAutoMovieShotContract,
    "id" | "participants" | "durationSeconds"
  >,
  value: {
    formations: readonly Pick<
      IAutoMovieCompiledFormation,
      "id" | "count" | "heroes"
    >[];
    formationSlotMotions: readonly IAutoMovieFormationSlotMotion[];
  },
): IAutoMovieDiagnostic[] => {
  const diagnostics: IAutoMovieDiagnostic[] = [];
  const fail = (field: string, expectation: string): void => {
    diagnostics.push(engineDiagnostic(contract.id, field, expectation));
  };
  const cues = value.formationSlotMotions;
  if (cues.length > 256)
    fail(
      "formationSlotMotions",
      "must contain at most 256 sparse per-member cues",
    );
  const named = cues.reduce((sum, cue) => sum + cue.slots.length, 0);
  if (named > FORMATION_SLOT_EXCEPTION_LIMIT)
    fail(
      "formationSlotMotions",
      `must single out at most ${FORMATION_SLOT_EXCEPTION_LIMIT} members in one shot rather than author a curve per member`,
    );
  const ids = new Set<string>();
  const participating = new Set(
    contract.participants.flatMap((participant) =>
      participant.kind === "formation" ? [participant.id] : [],
    ),
  );
  const compiledById = new Map(
    value.formations.map((formation) => [formation.id, formation]),
  );
  // Keyed by formation and then by slot rather than by formation alone, because
  // two members of one crowd doing different things at the same second is the
  // whole point of the channel. One member doing two things at once is not.
  // Nested rather than joined into one string key, because a formation id is
  // author-chosen text and any separator picked to join them is one an id may
  // legitimately contain.
  const priorBySlot = new Map<
    string,
    Map<number, IAutoMovieFormationSlotMotion>
  >();
  for (const cue of [...cues].sort(
    (left, right) =>
      compareCodeUnits(left.formation, right.formation) ||
      left.start - right.start ||
      compareCodeUnits(left.id, right.id),
  )) {
    if (cue.id.trim().length === 0 || ids.has(cue.id))
      fail(
        `formationSlotMotion:${cue.id || "(blank)"}`,
        "must have one non-blank id unique inside the shot",
      );
    ids.add(cue.id);
    const compiled = compiledById.get(cue.formation);
    if (participating.has(cue.formation) === false || compiled === undefined)
      fail(
        `formationSlotMotion:${cue.id}.formation`,
        `must reference participating compiled formation "${cue.formation}"`,
      );
    if (
      Number.isFinite(cue.start) === false ||
      Number.isFinite(cue.end) === false ||
      cue.start < 0 ||
      cue.end <= cue.start ||
      cue.end > contract.durationSeconds
    )
      fail(
        `formationSlotMotion:${cue.id}.time`,
        `must be one positive interval inside 0..${contract.durationSeconds}s`,
      );
    if (
      cue.slots.length === 0 ||
      new Set(cue.slots).size !== cue.slots.length ||
      cue.slots.some(
        (slot) =>
          Number.isSafeInteger(slot) === false ||
          slot < 0 ||
          (compiled !== undefined && slot >= compiled.count),
      )
    )
      fail(
        `formationSlotMotion:${cue.id}.slots`,
        `must name at least one unique slot inside 0..${(compiled?.count ?? 0) - 1}`,
      );
    // A promoted hero is already an explicit scene node with a full authoring
    // surface of its own. Letting this channel move one too would give a member
    // two owners writing the same transform, and the frame would show whichever
    // wrote last.
    const heroes = (compiled?.heroes ?? []).filter((hero) =>
      cue.slots.includes(hero.slot),
    );
    if (heroes.length !== 0)
      fail(
        `formationSlotMotion:${cue.id}.slots`,
        `must not name slots promoted to named actors (${heroes
          .map((hero) => `${hero.slot} is "${hero.actor}"`)
          .join(", ")}); author those on the actor instead`,
      );
    for (const [name, state] of [
      ["from", cue.from],
      ["to", cue.to],
    ] as const) {
      if (
        [state.offset.x, state.offset.y, state.offset.z].some(
          (number) =>
            Number.isFinite(number) === false ||
            Math.abs(number) > 1_000_000_000,
        ) ||
        Number.isFinite(state.facingOffsetDeg) === false ||
        Math.abs(state.facingOffsetDeg) > 360_000
      )
        fail(
          `formationSlotMotion:${cue.id}.${name}`,
          "must keep offset inside +/-1000000000m and facing inside +/-360000 degrees",
        );
    }
    const priorSlots =
      priorBySlot.get(cue.formation) ??
      new Map<number, IAutoMovieFormationSlotMotion>();
    priorBySlot.set(cue.formation, priorSlots);
    for (const slot of cue.slots) {
      const prior = priorSlots.get(slot);
      // Never against itself. A cue naming one member twice is a malformed
      // slot list, already refused as one above; reading the second mention as
      // an overlap would refuse the same mistake a second time and name the
      // cue as its own prior, which is not a sentence an author can act on.
      if (prior !== undefined && prior !== cue && cue.start < prior.end)
        fail(
          `formationSlotMotion:${cue.id}.start`,
          `must not overlap prior cue "${prior.id}" on slot ${slot} ending at ${prior.end}s`,
        );
      priorSlots.set(slot, cue);
    }
  }
  return diagnostics;
};
