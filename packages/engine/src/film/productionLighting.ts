import {
  IAutoMovieLight,
  IAutoMovieProductionLighting,
  IAutoMovieShotStoryTime,
} from "@automovie/interface";

import { resolveShotLighting } from "../resolve/resolveShotLighting";
import { autoMovieStoryTime } from "./storyClock";

/**
 * The production-level lighting pass: a film states one moving source and every
 * shot reads its state at the shot's own story moment.
 *
 * The engine already had light-over-time, but only ever over a SHOT's clock, so
 * the longest thing a film could say about its light was a few seconds long. A
 * production that runs across a stretch of story — however long, whatever the
 * subject — could not state that the light travelled over it, and each shot
 * restaged its lighting independently with nothing relating one to the next.
 *
 * Two clocks meet here and neither is invented for the occasion.
 * {@link IAutoMovieProductionLighting} states the source on the STORY clock, and
 * {@link IAutoMovieShotStoryTime} — the pin a shot already carries — maps a
 * shot-local second onto that clock. So the whole of this pass is: turn the
 * shot's second into a story second, ask the ONE source what it is then.
 *
 * @author Samchon
 */

/**
 * The production's lights at one STORY-clock instant.
 *
 * Deliberately {@link resolveShotLighting} rather than a resolver of its own: a
 * production source is an ordinary light addressed by an ordinary pointer
 * track, so it is sampled, bounds-checked, accumulated per light and folded
 * back by exactly the code a shot's `lightMotions` runs through. A second
 * implementation is a second set of rounding, a second clamp policy at the ends
 * of a clip, and eventually a second answer to the same question — the split
 * the light-channel table exists to prevent. A source no clip touches comes
 * back by identity, inherited straight through.
 */
export const resolveProductionLighting = (props: {
  /** The production's declared sources and their story-clock motion. */
  lighting: IAutoMovieProductionLighting;

  /** The instant to evaluate, in story-clock seconds. */
  storySeconds: number;
}): IAutoMovieLight[] =>
  resolveShotLighting({
    lights: props.lighting.lights,
    clips: props.lighting.motions,
    seconds: props.storySeconds,
  });

/**
 * One shot's lights at one shot-local instant, with the production's sources
 * inherited at the story moment the shot's pin places that instant at.
 *
 * The staged lights come back UNCHANGED, element by element, whenever there is
 * nothing to inherit: no production lighting, or a shot carrying no story pin.
 * That is the additivity promise made whole — a film that says nothing about
 * production light renders precisely the frames it rendered before this pass
 * existed, and an unpinned shot is not quietly assigned a story moment it never
 * claimed.
 *
 * The merge is by ID and its order is fixed:
 *
 * - A staged light whose id a production source shares is REPLACED, in place. The
 *   production owns that source; the scene declaring it says which of the
 *   production's lights this scene stands under, and the values it declares are
 *   the ones the production overrides. That is precisely "inherit rather than
 *   restage".
 * - A production source no staged light names is APPENDED, in declaration order,
 *   so a film states its source once instead of every scene re-declaring it.
 *
 * Appending moves one downstream index and it is worth naming: the viewer adds
 * lights as top-level scene children between the nodes and the space group, and
 * the segmentation mask palette is keyed by top-level child index. Node colours
 * are unaffected (they precede every light), while the space group's colour
 * shifts by the number of appended sources. It remains a pure function of the
 * artifacts, which is the property the palette actually needs; a mask consumer
 * comparing two productions was never comparing colours across scenes anyway.
 *
 * This composes with, rather than replaces, a shot's own `lightMotions`: hand
 * the result to the applier that plays those clips and the shot's local
 * statement (a lamp switched on inside this beat) lands on top of the inherited
 * state (the light the production is under at this moment). Both are the same
 * pointer grammar over the same table, so the composition needs no rules of its
 * own.
 */
export const inheritProductionLighting = (props: {
  /** The production's declared sources, or `null` when it declares none. */
  lighting: IAutoMovieProductionLighting | null;

  /** The shot's scene lights, in staging order. */
  lights: readonly IAutoMovieLight[];

  /** Where the shot sits on the story clock, or `null` when it is unpinned. */
  pin: IAutoMovieShotStoryTime | null;

  /** The instant to evaluate, in shot-local seconds. */
  seconds: number;
}): IAutoMovieLight[] => {
  const { lighting, pin } = props;
  if (lighting === null || pin === null) return [...props.lights];

  const resolved = resolveProductionLighting({
    lighting,
    storySeconds: autoMovieStoryTime(pin, props.seconds),
  });
  const inherited = new Map(resolved.map((light) => [light.id, light]));
  const staged = new Set(props.lights.map((light) => light.id));
  return [
    ...props.lights.map((light) => inherited.get(light.id) ?? light),
    ...resolved.filter((light) => !staged.has(light.id)),
  ];
};
