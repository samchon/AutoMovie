import { IAutoMovieScene } from "@automovie/interface";

/** The slate shape these resolvers need: the staged scenes, nothing else. */
export interface IAutoMovieStagedScenes {
  /** Committed staged scenes, keyed by their own `id`. */
  scenes: IAutoMovieScene[];
}

/**
 * The staged scene with this id, or `null` when the slate does not hold it.
 *
 * This is the resolution every shot-bound reader wants: a shot names its scene
 * in `shot.scene`, and `validateShotArtifact` refuses one that disagrees, so
 * the scene a reader needs is the one the shot points at rather than whichever
 * the slate happens to carry (#1171).
 */
/**
 * The staged scenes, degraded to none when the field is not an array.
 *
 * These resolvers read slates that arrive over the wire, where a host may send
 * a payload written before the slate held several scenes, or no field at all.
 * The commit surface degrades a malformed slice rather than throwing on it, so
 * this does the same: an absent `scenes` reads as nothing staged.
 */
const staged = (slate: IAutoMovieStagedScenes): IAutoMovieScene[] =>
  Array.isArray(slate.scenes) ? slate.scenes : [];

export const sceneById = (
  slate: IAutoMovieStagedScenes,
  id: string,
): IAutoMovieScene | null =>
  staged(slate).find((scene) => scene.id === id) ?? null;

/**
 * The one staged scene, or `null` when the slate holds none or several.
 *
 * The ladder's un-addressed reads (`stage` then `block` before any shot names a
 * location) have exactly one scene to mean, and this returns it. It returns
 * `null` rather than a first element once several exist, because guessing which
 * location an unaddressed read meant is the collapse #1171 removes: callers
 * refuse and name the ids instead.
 */
export const soleScene = (
  slate: IAutoMovieStagedScenes,
): IAutoMovieScene | null =>
  staged(slate).length === 1 ? staged(slate)[0]! : null;
