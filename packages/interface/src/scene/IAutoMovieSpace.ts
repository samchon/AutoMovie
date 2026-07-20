import { IAutoMovieSurface } from "./IAutoMovieSurface";

/**
 * The space of a scene: the set of standable surfaces plus which of them an
 * actor may walk on: the first-class representation behind what the engine
 * previously assumed as one scalar ground plane.
 *
 * This is the seam the sibling project **interia** (indoor spaces) will refine:
 * interia owns rooms, walls, and full indoor semantics; automovie holds the
 * minimal surface set its motion, support, and contact math need (`heightAt`,
 * support contacts, walkability). Vertical surfaces, collision volumes, and
 * pathfinding over the walkable region are deliberately out of scope here: the
 * space answers "how high is the ground and may I stand there", nothing more.
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
