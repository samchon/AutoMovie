/**
 * A coarse body-region **mask** — which part of the rig a motion drives. The
 * compiler composes motions that own **disjoint** regions _concurrently_
 * (locomote the legs while the arms gesture and the head tracks a target)
 * instead of forcing them to take turns; motions that **share** a region must
 * sequence. This is the layered-blend-per-bone discipline: a base layer plus
 * region-scoped overrides that don't collide.
 *
 * A closed set (not a free description) is deliberate — across many parallel
 * generations a fixed partition converges where prose ("the upper body", "arms
 * and chest") would drift. The regions are chosen disjoint-and-covering so any
 * pair is unambiguously either composable or conflicting:
 *
 * - `lowerBody` — hips/root + both legs (locomotion, stance, kicks).
 * - `upperBody` — spine + both arms + hands (gestures, reaches, punches).
 * - `head` — neck + head (look-at, nods, shakes).
 * - `face` — expression/morph channels (emotes).
 * - `fullBody` — the whole rig; cannot co-occur with any other region (jumps,
 *   knockdowns, whole-body staggers).
 *
 * (A finer split — `leftArm` / `rightArm` so a one-armed wave and a carry
 * compose — is a later additive when a scene needs it; `upperBody` covers the
 * common case for now.)
 *
 * @author Samchon
 */
export type AutoMovieBodyRegion =
  | "lowerBody"
  | "upperBody"
  | "head"
  | "face"
  | "fullBody";
