import { IAutoMovieClip } from "../core/IAutoMovieTrack";
import { IAutoMovieLight } from "./IAutoMovieLight";

/**
 * A production's own light sources and how they move across its STORY clock.
 *
 * A shot's `lightMotions` states light over the shot's own clock, which is the
 * right unit for a light that belongs to the moment: a lamp switched on, a
 * candle blown out. It is the wrong unit for a light that belongs to the
 * production. A shot is seconds long and the light that crosses a production is
 * not; stating it per shot means every shot restages the same source, and the
 * only thing keeping two shots consistent is that whoever wrote them happened
 * to write the same numbers. Nothing then relates the light in the first shot
 * to the light in the last, so a production whose LENGTH is part of its subject
 * has no way to say so, and that is a gap no particular subject owns: an
 * expedition, a shift, a vigil, a festival, a siege, a crossing all need it and
 * need the same thing from it.
 *
 * So a production declares its sources ONCE, here, and states their motion on
 * the story clock ({@link IAutoMovieStoryClock}) rather than on any shot's. Each
 * shot then inherits the state at ITS story time, which its own
 * {@link IAutoMovieShotStoryTime} pin already fixes. The pin is the whole
 * mapping and this declaration adds no second clock of its own: two shots
 * pinned an hour apart in the story inherit an hour apart, however far apart or
 * close together the edit cuts them, and a shot that stretches story time
 * through its `rate` carries the light along at the same stretch.
 *
 * Entirely optional and purely additive. A production that declares none is
 * unaffected in every respect, and so is any shot that carries no story pin: an
 * unpinned shot asserts nothing about when it happens, so there is no moment at
 * which to read a story-clock source, and inventing one (the epoch, say) would
 * put every unpinned shot under the same light and call it a fact.
 *
 * @evidence requirements/lighting/shape-filters-and-linking.md#lighting-link-resolution Exposes `IAutoMovieProductionLighting` as the portable data boundary for the lighting link resolution requirement.
 * @evidence specifications/camera-light-and-visibility/practical-shaping-and-linking.md#clv-light-link-resolution Types `IAutoMovieProductionLighting` for the clv light link resolution system contract.
 * @author Samchon
 */
export interface IAutoMovieProductionLighting {
  /**
   * Stable id.
   *
   * @evidence requirements/lighting/shape-filters-and-linking.md#lighting-link-resolution Exposes `id` as the portable data boundary for the lighting link resolution requirement.
   * @evidence specifications/camera-light-and-visibility/practical-shaping-and-linking.md#clv-light-link-resolution Types `id` for the clv light link resolution system contract.
   */
  id: string;

  /**
   * Human / LLM readable name. Null if unnamed.
   *
   * @evidence requirements/lighting/shape-filters-and-linking.md#lighting-link-resolution Exposes `name` as the portable data boundary for the lighting link resolution requirement.
   * @evidence specifications/camera-light-and-visibility/practical-shaping-and-linking.md#clv-light-link-resolution Types `name` for the clv light link resolution system contract.
   */
  name: string | null;

  /**
   * The production's light sources, carrying their values at story time zero
   * (the clock's declared `epoch`).
   *
   * These are ordinary scene lights, deliberately: a production-level source is
   * the SAME thing a scene stages, declared in a wider scope, so everything
   * that already reads, validates, renders or exports an {@link IAutoMovieLight}
   * reads this one too, and a source can be promoted from a scene to the
   * production or demoted back without changing shape.
   *
   * @evidence requirements/lighting/shape-filters-and-linking.md#lighting-link-resolution Exposes `lights` as the portable data boundary for the lighting link resolution requirement.
   * @evidence specifications/camera-light-and-visibility/practical-shaping-and-linking.md#clv-light-link-resolution Types `lights` for the clv light link resolution system contract.
   */
  lights: IAutoMovieLight[];

  /**
   * Clips moving those lights across the story clock, in story seconds.
   *
   * Addressed exactly as a shot's `lightMotions` are — one pointer channel per
   * track, `/lights/<light id>/<property>` — and evaluated by the same pass. A
   * production light travels, turns, warms and dims through the same table a
   * shot's candle does; only the clock the keyframe times are read against
   * differs, so there is one grammar to learn and one applier to trust.
   *
   * Empty means the production declares sources that never change, which is
   * still worth stating: every shot then inherits one agreed source instead of
   * restaging its own.
   *
   * @evidence requirements/lighting/shape-filters-and-linking.md#lighting-link-resolution Exposes `motions` as the portable data boundary for the lighting link resolution requirement.
   * @evidence specifications/camera-light-and-visibility/practical-shaping-and-linking.md#clv-light-link-resolution Types `motions` for the clv light link resolution system contract.
   */
  motions: IAutoMovieClip[];
}
