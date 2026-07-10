import {
  AutoMovieBodyRegion,
  IAutoMovieActionCall,
  IAutoMovieKeyframe,
  IAutoMovieMotion,
  IAutoMoviePose,
} from "@automovie/interface";

import { IAutoMoviePlacement, arrangeMotion } from "../motion/arrange";
import { sampleMotion } from "../motion/sampleMotion";
import { sequenceMotion } from "../motion/sequence";
import { actionRegion } from "./actionRegion";
import { blendPoses } from "./blendPoses";
import { bodyRegionBones } from "./bodyRegionBones";

/**
 * The **content seam** of the action compiler. Given one action call (and the
 * actor performing it), synthesise the _base_ clip for **one cycle** of that
 * action — local time starting at 0, the clip's own natural duration. Return
 * `null` to skip (the action produces no motion for this actor).
 *
 * This is where rig-specific content enters: a "strike" clip, a "walk" gait, an
 * IK reach are all authored against a particular skeleton, so the host supplies
 * them. The compiler stays generic — it owns the **timeline assembly** (which
 * actor, when, repeated how often, held across gaps, layered by region), never
 * the keyframes. This is the harness's "thin verb in, dense motion out" split
 * made concrete: the model emits {@link IAutoMovieActionCall}s, this seam
 * fattens each into a clip, and {@link compilePerformance} composes them into
 * the shot.
 *
 * @author Samchon
 */
export type IAutoMovieActionSynthesizer = (
  action: IAutoMovieActionCall,
  actor: string,
) => IAutoMovieMotion | null;

const ROOT_REGIONS = new Set<AutoMovieBodyRegion>(["lowerBody", "fullBody"]);

const maskMotionToRegion = (
  motion: IAutoMovieMotion,
  region: AutoMovieBodyRegion,
  keepRoot: boolean,
): IAutoMovieMotion => {
  const bones = new Set(bodyRegionBones(region));
  return {
    ...motion,
    keyframes: motion.keyframes.map((keyframe) => ({
      ...keyframe,
      pose: {
        ...keyframe.pose,
        root: keepRoot ? keyframe.pose.root : null,
        joints: keyframe.pose.joints.filter((joint) => bones.has(joint.bone)),
      },
    })),
  };
};

/**
 * Layer several per-region clips into one by **sampling and blending**: at
 * every keyframe time across the clips, sample each and {@link blendPoses} the
 * result (equal weight — the regions are disjoint here, so the additive blend
 * equals a union), so disjoint regions play _concurrently_ (legs walk while
 * arms wave while the head tracks). A face clip's expression rides along.
 *
 * A region claims its bones only from its first keyframe onward (#1003):
 * clamp-sampling before that would replay a late lookAt's aim (or a react's
 * explicit-zero rest) backward over the whole shot, breaking causality. PAST
 * its last keyframe a region keeps only its ROOT — a walk's destination
 * persists — while joint and expression claims release, so a finished flinch or
 * emote stops diluting whatever other regions do next.
 */
const layerClips = (
  id: string,
  clips: IAutoMovieMotion[],
): IAutoMovieMotion => {
  const times = [
    ...new Set(clips.flatMap((c) => c.keyframes.map((k) => k.time))),
  ].sort((a, b) => a - b);
  const envelopes = clips.map((clip) => ({
    clip,
    first: clip.keyframes[0]!.time,
    last: clip.keyframes[clip.keyframes.length - 1]!.time,
  }));
  const keyframes: IAutoMovieKeyframe[] = times.map((time) => {
    // Every union time belongs to some clip's own keyframes, so at least one
    // envelope always contributes a full sample here.
    const samples: { pose: IAutoMoviePose; weight: number }[] = [];
    let expression = null;
    for (const { clip, first, last } of envelopes) {
      if (time < first - 1e-9) continue; // not started — no claim yet
      const s = sampleMotion(clip, time);
      if (time > last + 1e-9) {
        if (s.pose.root !== null)
          samples.push({
            pose: { skeleton: clip.skeleton, root: s.pose.root, joints: [] },
            weight: 1,
          });
        continue; // ended — the root persists, the joints release
      }
      samples.push({ pose: s.pose, weight: 1 });
      if (s.expression !== null) expression = s.expression;
    }
    return {
      time,
      pose: blendPoses(samples),
      expression,
      easing: "linear",
      bezier: null,
    };
  });
  // Disjoint regions mean at most ONE clip strides (the root-bearing
  // locomotion region); its cycle is the layered composite's cycle. Two
  // striding regions would be ambiguous, so the clock is honestly dropped.
  const cycles = clips
    .map((clip) => clip.gaitCycle ?? null)
    .filter((cycle) => cycle !== null);

  return {
    id,
    skeleton: clips[0]!.skeleton,
    duration: times[times.length - 1]!,
    loop: false,
    keyframes,
    gaitCycle: cycles.length === 1 ? cycles[0]! : null,
  };
};

/**
 * Hold rest before a late-starting composite (#1003). A shot samples its
 * performance from t=0 with clamping, which would otherwise replay the first
 * keyframe's pose backward over the pre-action span (a lookAt at 3s aimed from
 * frame 0). The `step` easing holds the rest pose across the whole lead-in
 * segment, so the action still begins exactly at its authored start.
 */
const padRestLeadIn = (motion: IAutoMovieMotion): IAutoMovieMotion => {
  if (motion.keyframes[0]!.time <= 1e-9) return motion;
  return {
    ...motion,
    keyframes: [
      {
        time: 0,
        pose: { skeleton: motion.skeleton, root: null, joints: [] },
        expression: null,
        easing: "step",
        bezier: null,
      },
      ...motion.keyframes,
    ],
  };
};

/**
 * Compile a shot's flat {@link IAutoMovieActionCall} list into **one performance
 * clip per actor**, keyed by node id.
 *
 * The compiler does the orchestration the PERFORMANCE stage needs and the
 * engine primitives do not: it **splits unison actions** (`actor: string[]`)
 * onto each actor's timeline; **expands `repeat`** by concatenating the
 * synthesised cycle ({@link sequenceMotion}); and groups each actor's actions by
 * **body region**. Actions sharing a region are placed on one timeline and
 * **held across gaps** ({@link arrangeMotion}) — they take turns. Actions on
 * **disjoint** regions are **layered** ({@link layerClips}) — a walk
 * (`lowerBody`) plays at the same time as a wave (`upperBody`) and a look-at
 * (`head`). An actor touching only one region keeps the simple arranged
 * timeline, padded to hold rest before a late start. The per-action keyframes
 * come entirely from `synthesize` — a `null` synthesis is skipped.
 *
 * @author Samchon
 * @param actions The shot's action calls (any order; arranged by `start`).
 * @param synthesize The content seam — one action → one base clip (or null).
 * @returns Per-actor performance motion, keyed by actor node id.
 */
export const compilePerformance = (
  actions: IAutoMovieActionCall[],
  synthesize: IAutoMovieActionSynthesizer,
): Record<string, IAutoMovieMotion> => {
  // 1. fan each action to every actor that performs it, grouped by body region
  const byActor = new Map<
    string,
    Map<AutoMovieBodyRegion, IAutoMoviePlacement[]>
  >();
  for (const action of actions) {
    const actors =
      typeof action.actor === "string" ? [action.actor] : action.actor;
    for (const actor of actors) {
      const base = synthesize(action, actor);
      if (base === null) continue; // no motion for this actor — skip

      // 2. repeat: concatenate the base cycle N times within the action's span
      const cycles =
        action.repeat !== undefined && action.repeat > 1 ? action.repeat : 1;
      const motion =
        cycles > 1
          ? sequenceMotion(
              `${base.id}:x${cycles}`,
              Array.from({ length: cycles }, () => base),
            )
          : base;

      const region = actionRegion(action);
      const regions =
        byActor.get(actor) ??
        new Map<AutoMovieBodyRegion, IAutoMoviePlacement[]>();
      const placements = regions.get(region) ?? [];
      placements.push({ start: action.start, motion });
      regions.set(region, placements);
      byActor.set(actor, regions);
    }
  }

  // 3. per actor: arrange each region, then layer the regions (or pass one through)
  const performances: Record<string, IAutoMovieMotion> = {};
  for (const [actor, regions] of byActor) {
    const layered = regions.size > 1;
    const regionClips = [...regions.entries()].map(([region, placements]) => {
      const keepRoot = !layered || ROOT_REGIONS.has(region);
      return arrangeMotion(
        `perform:${actor}:${region}`,
        placements.map((placement) => ({
          start: placement.start,
          motion: maskMotionToRegion(placement.motion, region, keepRoot),
        })),
      );
    });
    performances[actor] = padRestLeadIn(
      regionClips.length === 1
        ? { ...regionClips[0]!, id: `perform:${actor}` }
        : layerClips(`perform:${actor}`, regionClips),
    );
  }
  return performances;
};
