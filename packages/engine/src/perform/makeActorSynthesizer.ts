import {
  IAutoFilmActionCall,
  IAutoFilmKeyframe,
  IAutoFilmMotion,
  IAutoFilmPose,
  IAutoFilmVector3,
} from "@autofilm/interface";

import { aimYawPitch } from "../kinematics/aimYawPitch";
import { Vector3 } from "../math/Vector3";
import { holdMotion } from "../motion/arrange";
import { gaitMotion } from "../motion/gait";
import { locomoteMotion } from "../motion/locomote";
import { reactMotion } from "../motion/react";
import { IAutoFilmActorContext } from "./IAutoFilmActorContext";
import { IAutoFilmActionSynthesizer } from "./compilePerformance";
import { resolveTargetPoint } from "./resolveTargetPoint";

/** Keyframes per gait cycle the reference synthesiser bakes. */
const GAIT_SAMPLES = 8;

/** Peak flinch deflection (degrees) a full-force (1.0) blow drives. */
const REACT_MAX_DEFLECTION = 32;

/** An unbalancing blow flinches this much harder (a floored reaction). */
const REACT_UNBALANCE_GAIN = 1.5;

/** The chain a torso/head blow ripples down — head whips most, hips least. */
const REACT_CHAIN = ["head", "neck", "chest", "spine"] as const;

/**
 * Build a reference {@link IAutoFilmActionSynthesizer} — the content seam
 * {@link compilePerformance} injects — for the verbs the engine can fatten
 * **deterministically** from an actor's context:
 *
 * - `locomote` → the actor's matching {@link IAutoFilmGait}; if its target
 *   resolves to a world point ({@link resolveTargetPoint}, against `nodes`), the
 *   gait is carried that far at the actor's speed ({@link locomoteMotion}),
 *   otherwise it steps in place (a relative target — "off to the left" — has no
 *   positional point yet);
 * - `hold` → the actor's rest pose held for the duration ({@link holdMotion});
 * - `lookAt` → the head turned to aim at a resolved target;
 * - `emote` → a face-region expression clip;
 * - `react` → a ROM-clamped flinch away from the blow ({@link reactMotion}),
 *   decomposed into the actor's frame so a front hit snaps the torso back and a
 *   side hit leans it; needs the context's `rig` (the flinch is bounded by
 *   joint ROM), so a rig-less context synthesises nothing for it.
 *
 * Every other verb returns `null` (the host supplies its rig-specific content,
 * or a richer synthesiser does), and an unknown actor returns `null`. This is
 * the bridge that makes the action compiler actually produce motion from the
 * declarative gait/profile data — the thin verb in, dense motion out.
 *
 * @author Samchon
 */
export const makeActorSynthesizer = (
  contexts: Map<string, IAutoFilmActorContext>,
  nodes: Map<string, IAutoFilmVector3>,
): IAutoFilmActionSynthesizer => {
  return (
    action: IAutoFilmActionCall,
    actor: string,
  ): IAutoFilmMotion | null => {
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
      );
      const dest = resolveTargetPoint(action.to, nodes);
      if (dest === null) return cycle; // relative/unresolved → step in place
      const dx = dest.x - ctx.position.x;
      const dz = dest.z - ctx.position.z;
      const distance = Math.hypot(dx, dz);
      if (distance < 1e-6) return cycle; // already there → step in place
      return locomoteMotion(
        `${actor}:${action.gait}:travel`,
        cycle,
        distance,
        ctx.speed,
        { x: dx, y: 0, z: dz },
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
      const target = resolveTargetPoint(action.to, nodes);
      if (target === null) return null; // relative target — no aim point yet
      const eye = {
        x: ctx.position.x,
        y: ctx.position.y + ctx.eyeHeight,
        z: ctx.position.z,
      };
      const { yawDeg, pitchDeg } = aimYawPitch(eye, target, ctx.facingDeg);
      const duration = action.duration === "auto" ? 1 : action.duration;
      // turn the head: twist toward the target, flexion to tilt (up = extension)
      const headPose: IAutoFilmPose = {
        skeleton: ctx.skeleton,
        root: null,
        joints: [
          { bone: "head", flexion: -pitchDeg, abduction: null, twist: yawDeg },
        ],
      };
      const frame = (time: number): IAutoFilmKeyframe => ({
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
      const frame = (time: number): IAutoFilmKeyframe => ({
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
      const right = { x: Math.cos(facing), y: 0, z: -Math.sin(facing) };
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
