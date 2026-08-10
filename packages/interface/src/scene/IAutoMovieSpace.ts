import { IAutoMovieSurface } from "./IAutoMovieSurface";

/**
 * The space of a scene: the set of standable surfaces plus which of them an
 * actor may walk on: the first-class representation behind what the engine
 * previously assumed as one scalar ground plane.
 *
 * This low-level record intentionally owns only the surface facts needed by
 * motion, support, and contact math (`heightAt`, support contacts,
 * walkability). Rooms, storeys, boundaries, openings, and traversal connectors
 * live in {@link IAutoMovieBuiltEnvironment}; its lowering produces one or more
 * of these support spaces. A plain outdoor world may still author this type
 * directly. The space answers "how high is the ground and may I stand there",
 * while the higher-level owner answers where the region begins and how it is
 * connected.
 *
 * @author Samchon
 */
export interface IAutoMovieSpace {
  /** Stable id. */
  id: string;

  /** The standable surface patches. */
  surfaces: IAutoMovieSurface[];

  /**
   * Ids of the surfaces an actor may walk on. A surface not listed is a
   * standable-but-forbidden top (a table an actor should not climb): objects
   * may still rest on it, but locomotion treats it as no-go.
   */
  walkable: string[];
}
