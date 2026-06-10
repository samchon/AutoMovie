import { IAutoFilmActionCall, IAutoFilmMotion } from "@autofilm/interface";

import { IAutoFilmPlacement, arrangeMotion } from "../motion/arrange";
import { sequenceMotion } from "../motion/sequence";

/**
 * The **content seam** of the action compiler. Given one action call (and the
 * actor performing it), synthesise the _base_ clip for **one cycle** of that
 * action — local time starting at 0, the clip's own natural duration. Return
 * `null` to skip (the action produces no motion for this actor).
 *
 * This is where rig-specific content enters: a "strike" clip, a "walk" gait, an
 * IK reach are all authored against a particular skeleton, so the host supplies
 * them. The compiler stays generic — it owns the **timeline assembly** (which
 * actor, when, repeated how often, held across gaps), never the keyframes. This
 * is the harness's "thin verb in, dense motion out" split made concrete: the
 * model emits {@link IAutoFilmActionCall}s, this seam fattens each into a clip,
 * and {@link compilePerformance} arranges them into the shot.
 *
 * @author Samchon
 */
export type IAutoFilmActionSynthesizer = (
  action: IAutoFilmActionCall,
  actor: string,
) => IAutoFilmMotion | null;

/**
 * Compile a shot's flat {@link IAutoFilmActionCall} list into **one performance
 * clip per actor**, keyed by node id.
 *
 * The compiler does the orchestration the PERFORMANCE stage needs and the
 * engine primitives do not: it **splits unison actions** (`actor: string[]`)
 * onto each actor's own timeline; **expands `repeat`** by concatenating the
 * synthesised cycle that many times ({@link sequenceMotion}); places every clip
 * at its `start`; and **holds the last pose across gaps**
 * ({@link arrangeMotion}). The per-action keyframes come entirely from
 * `synthesize` (the content seam) — a `null` synthesis is skipped.
 *
 * The camera is an actor too: its `frame` actions route to a `"camera"`-style
 * node exactly like any other, so a caller can compile actor and camera
 * timelines through one pass and split them by node afterwards.
 *
 * @author Samchon
 * @param actions The shot's action calls (any order; arranged by `start`).
 * @param synthesize The content seam — one action → one base clip (or null).
 * @returns Per-actor performance motion, keyed by actor node id.
 */
export const compilePerformance = (
  actions: IAutoFilmActionCall[],
  synthesize: IAutoFilmActionSynthesizer,
): Record<string, IAutoFilmMotion> => {
  // 1. fan each action out to every actor that performs it (unison → per actor)
  const byActor = new Map<string, IAutoFilmPlacement[]>();
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

      const placements = byActor.get(actor) ?? [];
      placements.push({ start: action.start, motion });
      byActor.set(actor, placements);
    }
  }

  // 3. arrange each actor's placements into one performance clip
  const performances: Record<string, IAutoFilmMotion> = {};
  for (const [actor, placements] of byActor)
    performances[actor] = arrangeMotion(`perform:${actor}`, placements);
  return performances;
};
