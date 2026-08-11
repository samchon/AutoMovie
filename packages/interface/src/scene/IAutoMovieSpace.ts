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
 * @evidence requirements/interior/spaces-and-occupancy.md#interior-space-visibility-culling Exposes `IAutoMovieSpace` as the portable data boundary for the interior space visibility culling requirement.
 * @evidence specifications/interior-space/space-level-zone-topology.md#interior-space-occupancy-activity-visibility Types `IAutoMovieSpace` for the interior space occupancy activity visibility system contract.
 * @author Samchon
 */
export interface IAutoMovieSpace {
  /**
   * Stable id.
   *
   * @evidence requirements/interior/spaces-and-occupancy.md#interior-space-visibility-culling Exposes `id` as the portable data boundary for the interior space visibility culling requirement.
   * @evidence specifications/interior-space/space-level-zone-topology.md#interior-space-occupancy-activity-visibility Types `id` for the interior space occupancy activity visibility system contract.
   */
  id: string;

  /**
   * The standable surface patches.
   *
   * @evidence requirements/interior/spaces-and-occupancy.md#interior-space-visibility-culling Exposes `surfaces` as the portable data boundary for the interior space visibility culling requirement.
   * @evidence specifications/interior-space/space-level-zone-topology.md#interior-space-occupancy-activity-visibility Types `surfaces` for the interior space occupancy activity visibility system contract.
   */
  surfaces: IAutoMovieSurface[];

  /**
   * Ids of the surfaces an actor may walk on. A surface not listed is a
   * standable-but-forbidden top (a table an actor should not climb): objects
   * may still rest on it, but locomotion treats it as no-go.
   *
   * @evidence requirements/interior/spaces-and-occupancy.md#interior-space-visibility-culling Exposes `walkable` as the portable data boundary for the interior space visibility culling requirement.
   * @evidence specifications/interior-space/space-level-zone-topology.md#interior-space-occupancy-activity-visibility Types `walkable` for the interior space occupancy activity visibility system contract.
   */
  walkable: string[];
}
