import {
  AutoMovieBodyRegion,
  AutoMovieHumanoidBone,
  IAutoMovieActionCall,
  IAutoMovieKeyframe,
  IAutoMovieMotion,
  IAutoMoviePose,
} from "@automovie/interface";

import { IAutoMoviePlacement, arrangeMotion } from "../motion/arrange";
import { sampleMotion } from "../motion/sampleMotion";
import { sequenceMotion } from "../motion/sequence";
import { compareCodeUnits } from "../text/compareCodeUnits";
import { actionRegion } from "./actionRegion";
import { blendPoses } from "./blendPoses";
import { bodyRegionBones } from "./bodyRegionBones";

/**
 * The **content seam** of the action compiler. Given one action call (and the
 * actor performing it), synthesise the _base_ clip for **one cycle** of that
 * action: local time starting at 0, the clip's own natural duration. Return
 * `null` to skip (the action produces no motion for this actor).
 *
 * This is where rig-specific content enters: a "strike" clip, a "walk" gait, an
 * IK reach are all authored against a particular skeleton, so the host supplies
 * them. The compiler stays generic: it owns the **timeline assembly** (which
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

/**
 * Width of the boundary keyframes that pin a clip's envelope onto the union
 * grid (#1060). Larger than the envelope comparison tolerance (1e-9) so the
 * boundary sample itself is excluded, far smaller than any frame interval so
 * the ramp across it is invisible.
 */
const BOUNDARY_EPSILON = 1e-6;

/**
 * What one action's clip lost to its region mask, for the caller that must
 * report it (#1349). The mask is correct and deliberate, but it used to be
 * SILENT: a quadruped gait driving the front legs (the arm chains) under
 * `locomote`'s default `lowerBody` region lost six of its twelve bones and the
 * shot still came back successful with zero violations. The compiler holds both
 * facts (what the synthesizer authored, what the region admits) at the moment
 * it drops one, so it is the only place that can state the difference.
 *
 * Emitted only when something was actually dropped; a clip entirely inside its
 * region produces no record at all.
 *
 * @author Samchon
 */
export interface IAutoMovieMaskedContent {
  /** Index into the action list {@link compilePerformance} was given. */
  action: number;

  /** The actor whose clip lost the content (an action may fan to several). */
  actor: string;

  /** The region whose bone set masked it: the action's own, or its default. */
  region: AutoMovieBodyRegion;

  /**
   * The bones the region excludes, sorted by {@link compareCodeUnits} and
   * deduplicated across keyframes. Empty when only the root or the expression
   * was dropped.
   */
  bones: AutoMovieHumanoidBone[];

  /**
   * Whether a keyframe's root displacement was dropped, which happens when a
   * non-locomotion region layers beside another (only the root-bearing region
   * strides).
   */
  root: boolean;

  /** Whether a keyframe's expression was dropped (every region but `face`). */
  expression: boolean;
}

/**
 * What {@link compilePerformance} produced: the per-actor clips, and the
 * authored content its region masks discarded.
 *
 * @author Samchon
 */
export interface IAutoMovieCompiledPerformance {
  /** Per-actor performance motion, keyed by actor node id. */
  performances: Record<string, IAutoMovieMotion>;

  /**
   * Every piece of authored content a region mask dropped, ordered by action
   * index then actor. Empty when every clip fell inside its own region, which
   * is the ordinary case.
   */
  masked: IAutoMovieMaskedContent[];
}

/** One placed clip, carrying the index of the action that produced it. */
interface IAutoMovieRegionPlacement extends IAutoMoviePlacement {
  /** Index into the action list `compilePerformance` was given. */
  action: number;
}

/**
 * What one mask trimmed, before the action and actor that own it are known.
 * Stated once, off {@link IAutoMovieMaskedContent}, so the three channels cannot
 * be listed differently in the two places that read them.
 */
type IAutoMovieMaskedChannels = Pick<
  IAutoMovieMaskedContent,
  "bones" | "root" | "expression"
>;

/** Whether a mask record carries anything worth reporting. */
const maskedAnything = (masked: IAutoMovieMaskedChannels): boolean =>
  masked.bones.length > 0 || masked.root || masked.expression;

const maskMotionToRegion = (
  motion: IAutoMovieMotion,
  region: AutoMovieBodyRegion,
  keepRoot: boolean,
): IAutoMovieMaskedChannels & { motion: IAutoMovieMotion } => {
  const bones = new Set(bodyRegionBones(region));
  // Expression is FACE content: joints are made disjoint by the bone filter
  // below, but a synthesizer authoring an expression on a non-face clip (a
  // grimace on a fullBody stagger) used to ride through and overlap an emote
  // ungated. Layering resolves expressions last-envelope-wins, so one
  // silently ate the other (#1101). Stripping it here makes the fullBody↔face
  // exemption's disjointness claim true by construction: only the face
  // region's owner speaks for the face.
  const keepExpression = region === "face";
  const dropped = new Set<AutoMovieHumanoidBone>();
  let droppedRoot = false;
  let droppedExpression = false;
  const keyframes = motion.keyframes.map((keyframe) => {
    if (!keepRoot && keyframe.pose.root !== null) droppedRoot = true;
    if (!keepExpression && keyframe.expression !== null)
      droppedExpression = true;
    return {
      ...keyframe,
      expression: keepExpression ? keyframe.expression : null,
      pose: {
        ...keyframe.pose,
        root: keepRoot ? keyframe.pose.root : null,
        joints: keyframe.pose.joints.filter((joint) => {
          if (bones.has(joint.bone)) return true;
          dropped.add(joint.bone);
          return false;
        }),
      },
    };
  });
  return {
    motion: { ...motion, keyframes },
    // Sorted so the reported list is stable whatever order the keyframes
    // happened to name the bones in (the engine is deterministic, and its
    // diagnostics are part of that).
    bones: [...dropped].sort(compareCodeUnits),
    root: droppedRoot,
    expression: droppedExpression,
  };
};

/**
 * Layer several per-region clips into one by **sampling and blending**: at
 * every keyframe time across the clips, sample each and {@link blendPoses} the
 * result (equal weight: the regions are disjoint here, so the additive blend
 * equals a union), so disjoint regions play _concurrently_ (legs walk while
 * arms wave while the head tracks). A face clip's expression rides along.
 *
 * A region claims its bones only from its first keyframe onward (#1003):
 * clamp-sampling before that would replay a late lookAt's aim (or a react's
 * explicit-zero rest) backward over the whole shot, breaking causality. PAST
 * its last keyframe a region keeps only its ROOT (a walk's destination
 * persists) while joint and expression claims release, so a finished flinch or
 * emote stops diluting whatever other regions do next.
 *
 * The envelope must hold BETWEEN union keyframes too (#1060): the composite is
 * later interpolated by {@link sampleMotion}, so gating only at union times
 * would ramp a late clip's content backward across the entire preceding segment
 * (a lookAt at 4s visibly turning the head from t=0), and expressions, which
 * interpolation carries at full strength from either segment end, would leak
 * all the way back. Boundary keyframes at `first − ε` / `last + ε` pin each
 * envelope edge onto the grid, so every interpolated segment lies entirely
 * inside or entirely outside the envelope.
 */
const layerClips = (
  id: string,
  clips: IAutoMovieMotion[],
): IAutoMovieMotion => {
  const envelopes = clips.map((clip) => ({
    clip,
    first: clip.keyframes[0]!.time,
    last: clip.keyframes[clip.keyframes.length - 1]!.time,
  }));
  const timeSet = new Set(clips.flatMap((c) => c.keyframes.map((k) => k.time)));
  const earliest = Math.min(...envelopes.map((e) => e.first));
  const latest = Math.max(...envelopes.map((e) => e.last));
  for (const { first, last } of envelopes) {
    if (first - earliest > BOUNDARY_EPSILON)
      timeSet.add(first - BOUNDARY_EPSILON);
    if (latest - last > BOUNDARY_EPSILON) timeSet.add(last + BOUNDARY_EPSILON);
  }
  const times = [...timeSet].sort((a, b) => a - b);
  const keyframes: IAutoMovieKeyframe[] = times.map((time) => {
    // An inserted boundary time may fall where NO envelope contributes (all
    // clips rootless and out of span). That instant is honestly rest.
    const samples: { pose: IAutoMoviePose; weight: number }[] = [];
    let expression = null;
    for (const { clip, first, last } of envelopes) {
      if (time < first - 1e-9) continue; // not started: no claim yet
      const s = sampleMotion(clip, time);
      if (time > last + 1e-9) {
        if (s.pose.root !== null)
          samples.push({
            pose: { skeleton: clip.skeleton, root: s.pose.root, joints: [] },
            weight: 1,
          });
        continue; // ended: the root persists, the joints release
      }
      samples.push({ pose: s.pose, weight: 1 });
      if (s.expression !== null) expression = s.expression;
    }
    return {
      time,
      pose:
        samples.length === 0
          ? { skeleton: clips[0]!.skeleton, root: null, joints: [] }
          : blendPoses(samples),
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
 *
 * A second rest keyframe at `first − ε` closes the expression hole (#1060):
 * expression interpolation ignores easing and carries a segment-end expression
 * at full strength from either endpoint, so the step pad alone held the POSE
 * but let a late emote's face leak back to t=0. With rest at both ends the
 * lead-in segment is null-expression throughout.
 */
const padRestLeadIn = (motion: IAutoMovieMotion): IAutoMovieMotion => {
  const first = motion.keyframes[0]!.time;
  if (first <= 1e-9) return motion;
  const rest = (
    time: number,
    easing: IAutoMovieKeyframe["easing"],
  ): IAutoMovieKeyframe => ({
    time,
    pose: { skeleton: motion.skeleton, root: null, joints: [] },
    expression: null,
    easing,
    bezier: null,
  });
  return {
    ...motion,
    keyframes: [
      rest(0, "step"),
      ...(first > BOUNDARY_EPSILON
        ? [rest(first - BOUNDARY_EPSILON, "linear")]
        : []),
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
 * **held across gaps** ({@link arrangeMotion}): they take turns. Actions on
 * **disjoint** regions are **layered** ({@link layerClips}): a walk
 * (`lowerBody`) plays at the same time as a wave (`upperBody`) and a look-at
 * (`head`). An actor touching only one region keeps the simple arranged
 * timeline, padded to hold rest before a late start. The per-action keyframes
 * come entirely from `synthesize`. A `null` synthesis is skipped.
 *
 * The compiler also **states what it did not apply**: every clip the region
 * mask trimmed rides back on `masked` (#1349), so the caller that owns the
 * success envelope can refuse or report it instead of returning a clip that
 * silently omits half of what the author asked for.
 *
 * @author Samchon
 * @param actions The shot's action calls (any order; arranged by `start`).
 * @param synthesize The content seam: one action → one base clip (or null).
 * @returns Per-actor performance motion keyed by actor node id, plus every
 *   piece of authored content the region mask discarded.
 */
export const compilePerformance = (
  actions: IAutoMovieActionCall[],
  synthesize: IAutoMovieActionSynthesizer,
): IAutoMovieCompiledPerformance => {
  // 1. fan each action to every actor that performs it, grouped by body region
  const byActor = new Map<
    string,
    Map<AutoMovieBodyRegion, IAutoMovieRegionPlacement[]>
  >();
  actions.forEach((action, index) => {
    const actors =
      typeof action.actor === "string" ? [action.actor] : action.actor;
    for (const actor of actors) {
      const base = synthesize(action, actor);
      if (base === null) continue; // no motion for this actor, skip

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
        new Map<AutoMovieBodyRegion, IAutoMovieRegionPlacement[]>();
      const placements = regions.get(region) ?? [];
      placements.push({ start: action.start, motion, action: index });
      regions.set(region, placements);
      byActor.set(actor, regions);
    }
  });

  // 3. per actor: arrange each region, then layer the regions (or pass one through)
  const performances: Record<string, IAutoMovieMotion> = {};
  const masked: IAutoMovieMaskedContent[] = [];
  for (const [actor, regions] of byActor) {
    const layered = regions.size > 1;
    const regionClips = [...regions.entries()].map(([region, placements]) => {
      const keepRoot = !layered || ROOT_REGIONS.has(region);
      const arranged: IAutoMoviePlacement[] = placements.map((placement) => {
        const trimmed = maskMotionToRegion(placement.motion, region, keepRoot);
        if (maskedAnything(trimmed))
          masked.push({
            action: placement.action,
            actor,
            region,
            bones: trimmed.bones,
            root: trimmed.root,
            expression: trimmed.expression,
          });
        return { start: placement.start, motion: trimmed.motion };
      });
      return arrangeMotion(`perform:${actor}:${region}`, arranged);
    });
    performances[actor] = padRestLeadIn(
      regionClips.length === 1
        ? { ...regionClips[0]!, id: `perform:${actor}` }
        : layerClips(`perform:${actor}`, regionClips),
    );
  }
  // Action order first, then actor, so the report reads in the order the author
  // wrote the shot rather than in Map-insertion order.
  masked.sort(
    (a, b) => a.action - b.action || compareCodeUnits(a.actor, b.actor),
  );
  return { performances, masked };
};
