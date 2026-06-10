import {
  IAutoFilmActionCall,
  IAutoFilmMotion,
  IAutoFilmVector3,
} from "@autofilm/interface";

import { holdMotion } from "../motion/arrange";
import { gaitMotion } from "../motion/gait";
import { locomoteMotion } from "../motion/locomote";
import { IAutoFilmActorContext } from "./IAutoFilmActorContext";
import { IAutoFilmActionSynthesizer } from "./compilePerformance";
import { resolveTargetPoint } from "./resolveTargetPoint";

/** Keyframes per gait cycle the reference synthesiser bakes. */
const GAIT_SAMPLES = 8;

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
