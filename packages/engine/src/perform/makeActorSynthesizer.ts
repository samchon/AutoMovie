import { IAutoFilmActionCall, IAutoFilmMotion } from "@autofilm/interface";

import { holdMotion } from "../motion/arrange";
import { gaitMotion } from "../motion/gait";
import { IAutoFilmActorContext } from "./IAutoFilmActorContext";
import { IAutoFilmActionSynthesizer } from "./compilePerformance";

/** Keyframes per gait cycle the reference synthesiser bakes. */
const GAIT_SAMPLES = 8;

/**
 * Build a reference {@link IAutoFilmActionSynthesizer} — the content seam
 * {@link compilePerformance} injects — for the verbs the engine can fatten
 * **deterministically** from an actor's context, with no world-target
 * resolution:
 *
 * - `locomote` → the actor's matching {@link IAutoFilmGait}, synthesised into a
 *   looping step cycle ({@link gaitMotion}); the compiler repeats it to fill the
 *   action's span.
 * - `hold` → the actor's rest pose held for the duration ({@link holdMotion}).
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
): IAutoFilmActionSynthesizer => {
  return (
    action: IAutoFilmActionCall,
    actor: string,
  ): IAutoFilmMotion | null => {
    const ctx = contexts.get(actor);
    if (ctx === undefined) return null;
    if (action.verb === "locomote") {
      const gait = ctx.gaits.find((g) => g.name === action.gait);
      return gait === undefined
        ? null
        : gaitMotion(
            `${actor}:${action.gait}`,
            ctx.skeleton,
            gait,
            GAIT_SAMPLES,
          );
    }
    if (action.verb === "hold")
      return holdMotion(
        `${actor}:hold`,
        ctx.skeleton,
        ctx.restPose,
        action.duration,
      );
    return null;
  };
};
