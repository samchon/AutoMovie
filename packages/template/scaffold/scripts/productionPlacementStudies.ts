import type { IAutoMoviePlacementStudy } from "./buildingInspection";

/**
 * Reference ground height and contact tolerance in metres, keyed by environment
 * id. An empty map requests no support claims; overlap and storage still run.
 */
export const productionPlacementStudies: Readonly<
  Record<string, IAutoMoviePlacementStudy>
> = {};
