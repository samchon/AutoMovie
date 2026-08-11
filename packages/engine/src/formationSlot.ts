import {
  IAutoMovieFormationMotionState,
  IAutoMovieFormationSlotMotion,
  IAutoMovieFormationSlotState,
  IAutoMovieVector3,
} from "@automovie/interface";

import { easingProgress, lerp, transformFormationPoint } from "./formation";

/**
 * The state a member holds when nothing has happened to it in particular.
 *
 * @evidence requirements/formations/heroes-variation-and-state.md#formation-group-state Defines the neutral sparse-member exception as present, undisplaced, and unturned relative to group state.
 * @evidence specifications/performance-motion-and-staging/formation-motion-resolution-and-budgets.md#performance-formation-member-exception-command-event Provides the identity member channel used when no slot-specific cue applies.
 */
export const IDENTITY_FORMATION_SLOT_STATE: IAutoMovieFormationSlotState = {
  present: true,
  offset: { x: 0, y: 0, z: 0 },
  facingOffsetDeg: 0,
};

/**
 * Sample what one named member of a unit is doing differently at one time.
 *
 * The unit-level sampler answers for the whole crowd at once; this answers for
 * one member of it. The retention law is deliberately the same one: identity
 * before the first cue that names this slot, interpolation inside a cue, and
 * the cue's exact `to` state retained after it ends. That is what lets a member
 * removed once stay removed, and a member that fell stay down, without the
 * author restating either every second of the shot.
 *
 * `present` is not interpolated, because half-drawn is not a state a member can
 * be in. Inside a cue the member holds `from.present`; from the cue's end it
 * holds `to.present`, which the retention above already carries. So a cue whose
 * `from` is present and whose `to` is not takes its member out of the shot at
 * the cue's end, and one absent at both ends takes it out at the cue's start.
 *
 * Cost is the number of cues that name this slot, which is why the channel is
 * sparse: a crowd of a hundred thousand pays for the three exceptions it has.
 *
 * @evidence requirements/formations/heroes-variation-and-state.md#formation-group-state Resolves one slot's sparse presence, offset, and facing exception without expanding the formation into per-member tracks.
 * @evidence specifications/performance-motion-and-staging/formation-motion-resolution-and-budgets.md#performance-formation-member-exception-command-event Retains the latest member exception and interpolates its active cue on the same shot-local clock as group motion.
 */
export const sampleFormationSlotMotion = (
  motions: readonly IAutoMovieFormationSlotMotion[],
  formation: string,
  slot: number,
  time: number,
): IAutoMovieFormationSlotState => {
  const cues = motions
    .filter((cue) => cue.formation === formation && cue.slots.includes(slot))
    .sort(
      (left, right) =>
        left.start - right.start ||
        (left.id < right.id ? -1 : left.id > right.id ? 1 : 0),
    );
  if (cues.length === 0 || time < cues[0]!.start)
    return IDENTITY_FORMATION_SLOT_STATE;
  let retained = cues[0]!.from;
  for (const cue of cues) {
    if (time < cue.start) return retained;
    if (time < cue.end) {
      const progress = easingProgress(
        cue.easing,
        Math.max(0, Math.min(1, (time - cue.start) / (cue.end - cue.start))),
      );
      return {
        present: cue.from.present,
        offset: {
          x: lerp(cue.from.offset.x, cue.to.offset.x, progress),
          y: lerp(cue.from.offset.y, cue.to.offset.y, progress),
          z: lerp(cue.from.offset.z, cue.to.offset.z, progress),
        },
        facingOffsetDeg: lerp(
          cue.from.facingOffsetDeg,
          cue.to.facingOffsetDeg,
          progress,
        ),
      };
    }
    retained = cue.to;
  }
  return retained;
};

/**
 * Turn a unit-local displacement into the frame a unit's members are placed in.
 *
 * A member's offset is authored in its unit's own frame: `+x` is the unit's
 * left-to-right and `+z` its front-to-back, whichever way the unit happens to
 * be pointing. {@link transformFormationPoint} rotates a unit's interior by the
 * same total heading, so an offset joins a placed point only after this turns
 * it, and a member that stepped aside keeps stepping aside once its unit
 * turns.
 *
 * Taken as a heading in degrees rather than as a unit, because the two
 * consumers of this arithmetic hold different halves of it: a gate composing a
 * whole world placement passes the unit's designed heading plus the offset its
 * cue has turned it by, while a renderer whose scene graph already carries the
 * cue's rotation passes only the designed heading.
 *
 * @evidence requirements/formations/layouts-and-slots.md#formation-local-frame Rotates a slot exception from the unit's local lateral-depth axes into the formation's current world heading.
 * @evidence specifications/performance-motion-and-staging/formation-identity-layout-and-terrain.md#performance-formation-layout-slot-assignment Preserves unit-local offset meaning when the formation faces or turns in world space.
 */
export const rotateFormationLocalOffset = (
  offset: IAutoMovieVector3,
  headingDeg: number,
): IAutoMovieVector3 => {
  const radians = (headingDeg * Math.PI) / 180;
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  return {
    x: offset.x * cosine + offset.z * sine,
    y: offset.y,
    z: -offset.x * sine + offset.z * cosine,
  };
};

/**
 * Where one member of a unit really stands, and whether it is there at all.
 *
 * @evidence requirements/formations/heroes-variation-and-state.md#formation-group-state Carries the resolved presence and world transform after group state and one sparse member exception are composed.
 * @evidence specifications/performance-motion-and-staging/formation-motion-resolution-and-budgets.md#performance-formation-member-exception-command-event Defines the placement result shared by rendering, measurement, and validation for one exception slot.
 */
export interface IAutoMovieFormationSlotPlacement {
  /**
   * Whether this member is drawn, measured and counted at this time.
   *
   * @evidence requirements/formations/heroes-variation-and-state.md#formation-group-state Applies the member exception's retained presence state to drawing, measurement, and quantity.
   * @evidence specifications/performance-motion-and-staging/formation-motion-resolution-and-budgets.md#performance-formation-member-exception-command-event Exposes removal and return as an explicit sparse-member outcome.
   */
  present: boolean;
  /**
   * World-space position in meters.
   *
   * @evidence requirements/formations/layouts-and-slots.md#formation-local-frame Reports the world position obtained after rotating the member's local exception with the unit.
   * @evidence specifications/performance-motion-and-staging/formation-identity-layout-and-terrain.md#performance-formation-layout-slot-assignment Preserves the slot's local-frame assignment through group and member motion composition.
   */
  position: IAutoMovieVector3;
  /**
   * World-space heading in degrees.
   *
   * @evidence requirements/formations/heroes-variation-and-state.md#formation-group-state Combines designed facing, group turn, and the member's retained facing exception.
   * @evidence specifications/performance-motion-and-staging/formation-motion-resolution-and-budgets.md#performance-formation-member-exception-command-event Reports the resolved orientation of the sparse member channel.
   */
  facingDeg: number;
}

/**
 * Compose a unit's cue and one member's own cue into that member's placement.
 *
 * One owner for the whole composition, because four consumers ask this question
 * and a private copy in any of them is how a review frame comes to disagree
 * with the gate that passed it. The unit's cue places the member exactly as it
 * always did; the member's own cue then displaces and turns it inside the
 * unit.
 *
 * @evidence requirements/formations/heroes-variation-and-state.md#formation-group-state Composes group placement with one member's sparse presence, offset, and facing exception into the authoritative slot result.
 * @evidence specifications/performance-motion-and-staging/formation-motion-resolution-and-budgets.md#performance-formation-member-exception-command-event Gives renderer, oracle, measurement, and validation one shared member-exception composition.
 */
export const placeFormationSlot = (props: {
  /** Designed world-space position of this member at rest. */
  position: IAutoMovieVector3;
  /** Designed world-space heading of this member at rest, in degrees. */
  facingDeg: number;
  /** The unit's world-space origin. */
  anchor: IAutoMovieVector3;
  /** The unit's designed world-space heading in degrees. */
  baseFacingDeg: number;
  /** Sampled unit-level state. */
  unit: IAutoMovieFormationMotionState;
  /** Sampled member-level state. */
  member: IAutoMovieFormationSlotState;
}): IAutoMovieFormationSlotPlacement => {
  const placed = transformFormationPoint(
    props.position,
    props.anchor,
    props.unit,
    props.baseFacingDeg,
  );
  const offset = rotateFormationLocalOffset(
    props.member.offset,
    props.baseFacingDeg + props.unit.facingOffsetDeg,
  );
  return {
    present: props.member.present,
    position: {
      x: placed.x + offset.x,
      y: placed.y + offset.y,
      z: placed.z + offset.z,
    },
    facingDeg:
      props.facingDeg +
      props.unit.facingOffsetDeg +
      props.member.facingOffsetDeg,
  };
};
