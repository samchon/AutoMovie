import {
  IAutoMovieActionCall,
  IAutoMovieKeyframe,
  IAutoMovieMotion,
  IAutoMoviePose,
  IAutoMovieVector3,
} from "@automovie/interface";

import { aimYawPitch } from "../kinematics/aimYawPitch";
import { reachPose } from "../kinematics/reachPose";
import { Vector3 } from "../math/Vector3";
import { holdMotion } from "../motion/arrange";
import { gaitMotion } from "../motion/gait";
import { gestureMotion } from "../motion/gesture";
import { locomoteMotion } from "../motion/locomote";
import { reactMotion } from "../motion/react";
import { IAutoMovieActorContext } from "./IAutoMovieActorContext";
import { IAutoMovieActionSynthesizer } from "./compilePerformance";
import { resolveTargetPoint } from "./resolveTargetPoint";

/** Keyframes per gait cycle the reference synthesiser bakes. */
const GAIT_SAMPLES = 8;

/** Peak flinch deflection (degrees) a full-force (1.0) blow drives. */
const REACT_MAX_DEFLECTION = 32;

/** An unbalancing blow flinches this much harder (a floored reaction). */
const REACT_UNBALANCE_GAIN = 1.5;

/** The chain a torso/head blow ripples down: head whips most, hips least. */
const REACT_CHAIN = ["head", "neck", "chest", "spine"] as const;

const assertUniqueActorGaits = (
  actor: string,
  gaits: IAutoMovieActorContext["gaits"],
): void => {
  const seen = new Set<string>();
  for (const gait of gaits) {
    if (seen.has(gait.name))
      throw new Error(`duplicate actor gait name ${actor}.${gait.name}`);
    seen.add(gait.name);
  }
};

/** Drop a world point into an actor's model space (undo its placement). */
const toModelSpace = (
  world: IAutoMovieVector3,
  position: IAutoMovieVector3,
  facingDeg: number,
): IAutoMovieVector3 => {
  const f = (facingDeg * Math.PI) / 180;
  const cos = Math.cos(f);
  const sin = Math.sin(f);
  const dx = world.x - position.x;
  const dz = world.z - position.z;
  return {
    x: dx * cos - dz * sin,
    y: world.y - position.y,
    z: dx * sin + dz * cos,
  };
};

/**
 * The placement table lifted to **aim** points: every id an actor context knows
 * is raised by that actor's `eyeHeight`, every other id keeps its placement.
 *
 * A placement is where a thing stands, which for a humanoid is the floor under
 * it; an aim point is where another actor's gaze meets it. `eyeHeight` is
 * already defined as "where a `lookAt` aims from", so using it as where a
 * `lookAt` aims TO is the symmetric read (eyes meet eyes) and invents no
 * number. Ids with no context keep their placement on purpose: a prop's origin
 * is wherever staging put it rather than a floor convention, and a camera's
 * translation is already its optical point.
 *
 * The key set is identical to the placement table's, so the perform gate (which
 * asks only whether a target resolves) and this synthesizer can never disagree
 * about which ids are legal. Routing the lift through the table rather than
 * through the verb is what makes a `group` target average EYE points instead of
 * ground points without a second code path.
 */
const aimPointsOf = (
  contexts: ReadonlyMap<string, IAutoMovieActorContext>,
  nodes: ReadonlyMap<string, IAutoMovieVector3>,
): Map<string, IAutoMovieVector3> =>
  new Map(
    [...nodes].map(([id, point]) => {
      const eyeHeight = contexts.get(id)?.eyeHeight;
      return [
        id,
        eyeHeight === undefined
          ? point
          : { x: point.x, y: point.y + eyeHeight, z: point.z },
      ] as const;
    }),
  );

/** A rest → hold-pose → hold clip: ease into `pose` over half the span, hold. */
const extendHoldClip = (
  id: string,
  skeleton: string,
  pose: IAutoMoviePose,
  duration: number,
): IAutoMovieMotion => {
  const rest: IAutoMoviePose = { skeleton, root: null, joints: [] };
  const key = (time: number, p: IAutoMoviePose): IAutoMovieKeyframe => ({
    time,
    pose: p,
    expression: null,
    easing: "easeInOut",
    bezier: null,
  });
  return {
    id,
    skeleton,
    duration,
    loop: false,
    keyframes: [key(0, rest), key(duration * 0.5, pose), key(duration, pose)],
  };
};

/** A rest → strike → rest jab: snap out to `pose` early, then retract. */
const jabClip = (
  id: string,
  skeleton: string,
  pose: IAutoMoviePose,
  duration: number,
): IAutoMovieMotion => {
  const rest: IAutoMoviePose = { skeleton, root: null, joints: [] };
  const key = (
    time: number,
    p: IAutoMoviePose,
    easing: IAutoMovieKeyframe["easing"],
  ): IAutoMovieKeyframe => ({
    time,
    pose: p,
    expression: null,
    easing,
    bezier: null,
  });
  return {
    id,
    skeleton,
    duration,
    loop: false,
    keyframes: [
      key(0, rest, "easeIn"),
      key(duration * 0.4, pose, "easeOut"),
      key(duration, rest, "easeInOut"),
    ],
  };
};

/**
 * Build a reference {@link IAutoMovieActionSynthesizer} (the content seam
 * {@link compilePerformance} injects) for the verbs the engine can fatten
 * **deterministically** from an actor's context:
 *
 * - `locomote` → the actor's matching {@link IAutoMovieGait}; if its target
 *   resolves to a world point ({@link resolveTargetPoint}, against `nodes`), the
 *   gait is carried that far at the actor's speed ({@link locomoteMotion}),
 *   otherwise it steps in place (a relative target, "off to the left", has no
 *   positional point yet);
 * - `hold` → the actor's rest pose held for the duration ({@link holdMotion});
 * - `lookAt` → the head turned to aim at a resolved target, resolved against the
 *   **aim points** rather than the raw placements (see below);
 * - `emote` → a face-region expression clip;
 * - `gesture` → the postural/whole-body gestures (bow/nod/shake/crouch/kick/
 *   stagger/wave/celebrate/jump) via {@link gestureMotion}, plus the reachPose
 *   arm gestures: `point` (arm extended toward `at`, held) and `strike` (a jab
 *   thrown at `at`, then retracted); the remaining combat kinds return null;
 * - `reach` → analytic two-bone arm IK to a resolved target ({@link reachPose}),
 *   the target dropped into the actor's model space; needs the context's `rig`
 *   and is left unclamped so an impossible reach fails the shot's ROM gate;
 * - `react` → a ROM-clamped flinch away from the blow ({@link reactMotion}),
 *   decomposed into the actor's frame so a front hit snaps the torso back and a
 *   side hit leans it; needs the context's `rig` (the flinch is bounded by
 *   joint ROM), so a rig-less context synthesises nothing for it.
 *
 * Every other verb returns `null` (the host supplies its rig-specific content,
 * or a richer synthesiser does), and an unknown actor returns `null`. This is
 * the bridge that makes the action compiler actually produce motion from the
 * declarative gait/profile data: the thin verb in, dense motion out.
 *
 * `lookAt` resolves against {@link aimPointsOf} instead of `nodes` because a
 * placement is a **ground** point: staging writes an actor's position straight
 * into its node transform, and a humanoid rig's origin sits between its feet,
 * so "look at him" aimed the head at the floor and two actors at conversational
 * range could not regard each other at all (1.6 m of eye height over 0.7 m of
 * separation is 66.37 degrees of flexion against a 45 degree head limit). The
 * camera solve met the same wall and answered it with a measured aim fraction
 * of the subject's height; this is the aim verbs' half of that answer, using
 * the one datum the context already carries for exactly this purpose.
 *
 * @author Samchon
 */
export const makeActorSynthesizer = (
  contexts: Map<string, IAutoMovieActorContext>,
  nodes: Map<string, IAutoMovieVector3>,
): IAutoMovieActionSynthesizer => {
  for (const [actor, ctx] of contexts) assertUniqueActorGaits(actor, ctx.gaits);
  const aimPoints = aimPointsOf(contexts, nodes);
  return (
    action: IAutoMovieActionCall,
    actor: string,
  ): IAutoMovieMotion | null => {
    const ctx = contexts.get(actor);
    if (ctx === undefined) return null;
    if (action.verb === "locomote") {
      const gait = ctx.gaits.find((g) => g.name === action.gait);
      if (gait === undefined) return null;
      const cycle = gaitMotion(
        `${actor}:${action.gait}`,
        ctx.skeleton,
        gait,
        GAIT_SAMPLES,
        ctx.gaitPhase ?? 0,
      );
      const dest = resolveTargetPoint(action.to, nodes);
      if (dest === null) return cycle; // relative/unresolved → step in place
      // Travel is baked onto the pose root, which the renderer applies in the
      // actor's model frame (under its staged facing). So aim it in model space
      // (undo the facing) and the composed render carries it to the world
      // destination; a turned actor would otherwise walk off its heading.
      const local = toModelSpace(dest, ctx.position, ctx.facingDeg);
      const distance = Math.hypot(local.x, local.z);
      if (distance < 1e-6) return cycle; // already there → step in place
      return locomoteMotion(
        `${actor}:${action.gait}:travel`,
        cycle,
        distance,
        ctx.speed,
        { x: local.x, y: 0, z: local.z },
        action.faceTravel === true,
      );
    }
    if (action.verb === "hold")
      return holdMotion(
        `${actor}:hold`,
        ctx.skeleton,
        ctx.restPose,
        action.duration,
      );
    if (action.verb === "lookAt") {
      // The AIM table, not the placement table: a look meets the subject's
      // eyes, not the ground its feet stand on (see the aim-point note above).
      const target = resolveTargetPoint(action.to, aimPoints);
      if (target === null) return null; // relative target: no aim point yet
      const eye = {
        x: ctx.position.x,
        y: ctx.position.y + ctx.eyeHeight,
        z: ctx.position.z,
      };
      const { yawDeg, pitchDeg } = aimYawPitch(eye, target, ctx.facingDeg);
      const duration = action.duration === "auto" ? 1 : action.duration;
      // turn the head: twist toward the target, flexion to tilt (up = extension)
      const headPose: IAutoMoviePose = {
        skeleton: ctx.skeleton,
        root: null,
        joints: [
          { bone: "head", flexion: -pitchDeg, abduction: null, twist: yawDeg },
        ],
      };
      const frame = (time: number): IAutoMovieKeyframe => ({
        time,
        pose: headPose,
        expression: null,
        easing: "linear",
        bezier: null,
      });
      return {
        id: `${actor}:lookAt`,
        skeleton: ctx.skeleton,
        duration,
        loop: false,
        keyframes: [frame(0), frame(duration)],
      };
    }
    if (action.verb === "emote") {
      // a face-region clip: only the expression, no body joints to merge
      const duration = action.duration === "auto" ? 1 : action.duration;
      const expression = {
        preset: action.preset,
        intensity: action.intensity,
        blendshapes: null,
      };
      const frame = (time: number): IAutoMovieKeyframe => ({
        time,
        pose: { skeleton: ctx.skeleton, root: null, joints: [] },
        expression,
        easing: "linear",
        bezier: null,
      });
      return {
        id: `${actor}:emote`,
        skeleton: ctx.skeleton,
        duration,
        loop: false,
        keyframes: [frame(0), frame(duration)],
      };
    }
    if (action.verb === "gesture") {
      const duration = action.duration === "auto" ? 1 : action.duration;
      // `point` rides reachPose (an arm extended toward `at`; reachPose
      // clamps a far target onto the reach shell, which is exactly a pointing
      // arm). Left unclamped like `reach`, so an impossible point fails the
      // shot's ROM gate. Needs the rig and a resolvable target.
      if (action.kind === "point" && ctx.rig !== undefined) {
        const world =
          action.at === undefined ? null : resolveTargetPoint(action.at, nodes);
        if (world === null) return null;
        const pose = reachPose(
          ctx.rig,
          "right",
          toModelSpace(world, ctx.position, ctx.facingDeg),
          ctx.restFrames,
        );
        return pose === null
          ? null
          : extendHoldClip(`${actor}:point`, ctx.skeleton, pose, duration);
      }
      // `strike` (a jab) also rides reachPose (the fist thrown toward the
      // target), but snaps out and retracts (jabClip) instead of holding, so it
      // reads as a punch. Same rig + resolvable-target requirement as point.
      if (action.kind === "strike" && ctx.rig !== undefined) {
        const world =
          action.at === undefined ? null : resolveTargetPoint(action.at, nodes);
        if (world === null) return null;
        const pose = reachPose(
          ctx.rig,
          "right",
          toModelSpace(world, ctx.position, ctx.facingDeg),
          ctx.restFrames,
        );
        return pose === null
          ? null
          : jabClip(`${actor}:strike`, ctx.skeleton, pose, duration);
      }
      // The postural gestures (bow/nod/shake/crouch) are engine-authored; the
      // remaining arm/combat kinds return null (rig-specific or reach-dependent).
      return gestureMotion(
        `${actor}:${action.kind}`,
        ctx.skeleton,
        action.kind,
        duration,
      );
    }
    if (action.verb === "reach") {
      // An IK verb: needs the rig geometry (arm lengths, rest FK). Resolve the
      // target to a world point, drop it into the actor's model space (undo the
      // placement), and solve the arm. reachPose does not clamp to ROM, so a
      // reach to an impossible spot yields an out-of-ROM pose the shot's ROM
      // gate rejects. The model must reposition, not the engine hide it.
      if (ctx.rig === undefined) return null;
      const world = resolveTargetPoint(action.to, nodes);
      if (world === null) return null; // relative target: no point to reach
      const reach = reachPose(
        ctx.rig,
        action.hand,
        toModelSpace(world, ctx.position, ctx.facingDeg),
        ctx.restFrames,
      );
      if (reach === null) return null;
      const duration = action.duration === "auto" ? 0.6 : action.duration;
      return extendHoldClip(`${actor}:reach`, ctx.skeleton, reach, duration);
    }
    if (action.verb === "react") {
      // A physics verb: the flinch is clamped to each joint's ROM, so it needs
      // the rig geometry. Without it (a context built only for gait/hold), the
      // reference synthesiser produces nothing.
      if (ctx.rig === undefined) return null;
      const duration = action.duration === "auto" ? 0.5 : action.duration;
      const magnitude =
        REACT_MAX_DEFLECTION *
        Math.max(0, Math.min(1, action.force)) *
        (action.unbalance === true ? REACT_UNBALANCE_GAIN : 1);

      // Decompose the blow into the actor's own frame so a front hit snaps the
      // torso back (extension, −flexion) and a side hit leans it (abduction).
      // `from` is where the blow comes from; the body recoils away from it.
      const source = resolveTargetPoint(action.from, nodes);
      const facing = (ctx.facingDeg * Math.PI) / 180;
      const forward = { x: Math.sin(facing), y: 0, z: Math.cos(facing) };
      // Anatomical right: facing 0 looks down +Z and the actor's LEFT is +X
      // (aimYawPitch's +90° yaw), so right is −X there. Positive spine
      // abduction tilts toward −X, so dot(away, right) leans AWAY from the
      // blow. The previous +X "right" leaned the body into it.
      const right = { x: -Math.cos(facing), y: 0, z: Math.sin(facing) };
      let push;
      if (source === null)
        push = { flexion: -magnitude }; // unknown → snap back
      else {
        const away = {
          x: ctx.position.x - source.x,
          y: 0,
          z: ctx.position.z - source.z,
        };
        const dir =
          Vector3.length(away) < 1e-6 ? forward : Vector3.normalize(away);
        push = {
          flexion: Vector3.dot(dir, forward) * magnitude,
          abduction: Vector3.dot(dir, right) * magnitude,
        };
      }
      return reactMotion(
        `${actor}:react`,
        ctx.rig,
        push,
        [...REACT_CHAIN],
        duration,
      );
    }
    return null;
  };
};
