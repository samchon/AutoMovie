import {
  automovieBodyRegion,
  IautomovieActionCall,
  IautomovieKeyframe,
  IautomovieMotion,
} from "@automovie/interface";

import { IautomoviePlacement, arrangeMotion } from "../motion/arrange";
import { sampleMotion } from "../motion/sampleMotion";
import { sequenceMotion } from "../motion/sequence";
import { mergePoses } from "./MergePoses";

/**
 * The **content seam** of the action compiler. Given one action call (and the
 * actor performing it), synthesise the _base_ clip for **one cycle** of that
 * action ??local time starting at 0, the clip's own natural duration. Return
 * `null` to skip (the action produces no motion for this actor).
 *
 * This is where rig-specific content enters: a "strike" clip, a "walk" gait, an
 * IK reach are all authored against a particular skeleton, so the host supplies
 * them. The compiler stays generic ??it owns the **timeline assembly** (which
 * actor, when, repeated how often, held across gaps, layered by region), never
 * the keyframes. This is the harness's "thin verb in, dense motion out" split
 * made concrete: the model emits {@link IautomovieActionCall}s, this seam fattens
 * each into a clip, and {@link compilePerformance} composes them into the shot.
 *
 * @author Samchon
 */
export type IautomovieActionSynthesizer = (
  action: IautomovieActionCall,
  actor: string,
) => IautomovieMotion | null;

/** The body region a verb drives by default, when an action sets none. */
const REGION_BY_VERB: Partial<
  Record<IautomovieActionCall["verb"], automovieBodyRegion>
> = {
  locomote: "lowerBody",
  gesture: "upperBody",
  reach: "upperBody",
  lookAt: "head",
  emote: "face",
};

/** Which region an action owns ??its explicit `region`, else the verb default. */
const regionOf = (action: IautomovieActionCall): automovieBodyRegion =>
  action.region ?? REGION_BY_VERB[action.verb] ?? "fullBody";

/**
 * Layer several per-region clips into one by **sampling and merging**: at every
 * keyframe time across the clips, sample each and {@link mergePoses} the result,
 * so disjoint regions play _concurrently_ (legs walk while arms wave while the
 * head tracks). A face clip's expression rides along.
 */
const layerClips = (id: string, clips: IautomovieMotion[]): IautomovieMotion => {
  const times = [
    ...new Set(clips.flatMap((c) => c.keyframes.map((k) => k.time))),
  ].sort((a, b) => a - b);
  const keyframes: IautomovieKeyframe[] = times.map((time) => {
    const samples = clips.map((c) => sampleMotion(c, time));
    let expression = null;
    for (const s of samples)
      if (s.expression !== null) expression = s.expression;
    return {
      time,
      pose: mergePoses(samples.map((s) => s.pose)),
      expression,
      easing: "linear",
      bezier: null,
    };
  });
  return {
    id,
    skeleton: clips[0]!.skeleton,
    duration: times[times.length - 1]!,
    loop: false,
    keyframes,
  };
};

/**
 * Compile a shot's flat {@link IautomovieActionCall} list into **one performance
 * clip per actor**, keyed by node id.
 *
 * The compiler does the orchestration the PERFORMANCE stage needs and the
 * engine primitives do not: it **splits unison actions** (`actor: string[]`)
 * onto each actor's timeline; **expands `repeat`** by concatenating the
 * synthesised cycle ({@link sequenceMotion}); and groups each actor's actions by
 * **body region**. Actions sharing a region are placed on one timeline and
 * **held across gaps** ({@link arrangeMotion}) ??they take turns. Actions on
 * **disjoint** regions are **layered** ({@link layerClips}) ??a walk
 * (`lowerBody`) plays at the same time as a wave (`upperBody`) and a look-at
 * (`head`). An actor touching only one region keeps the simple arranged
 * timeline. The per-action keyframes come entirely from `synthesize` ??a `null`
 * synthesis is skipped.
 *
 * @author Samchon
 * @param actions The shot's action calls (any order; arranged by `start`).
 * @param synthesize The content seam ??one action ??one base clip (or null).
 * @returns Per-actor performance motion, keyed by actor node id.
 */
export const compilePerformance = (
  actions: IautomovieActionCall[],
  synthesize: IautomovieActionSynthesizer,
): Record<string, IautomovieMotion> => {
  // 1. fan each action to every actor that performs it, grouped by body region
  const byActor = new Map<
    string,
    Map<automovieBodyRegion, IautomoviePlacement[]>
  >();
  for (const action of actions) {
    const actors =
      typeof action.actor === "string" ? [action.actor] : action.actor;
    for (const actor of actors) {
      const base = synthesize(action, actor);
      if (base === null) continue; // no motion for this actor ??skip

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

      const region = regionOf(action);
      const regions =
        byActor.get(actor) ??
        new Map<automovieBodyRegion, IautomoviePlacement[]>();
      const placements = regions.get(region) ?? [];
      placements.push({ start: action.start, motion });
      regions.set(region, placements);
      byActor.set(actor, regions);
    }
  }

  // 3. per actor: arrange each region, then layer the regions (or pass one through)
  const performances: Record<string, IautomovieMotion> = {};
  for (const [actor, regions] of byActor) {
    const regionClips = [...regions.entries()].map(([region, placements]) =>
      arrangeMotion(`perform:${actor}:${region}`, placements),
    );
    performances[actor] =
      regionClips.length === 1
        ? { ...regionClips[0]!, id: `perform:${actor}` }
        : layerClips(`perform:${actor}`, regionClips);
  }
  return performances;
};
