import {
  AutoMovieBodyRegion,
  IAutoMovieActionCall,
} from "@automovie/interface";

/** The body region a verb drives by default, when an action sets none. */
const REGION_BY_VERB: Partial<
  Record<IAutoMovieActionCall["verb"], AutoMovieBodyRegion>
> = {
  locomote: "lowerBody",
  gesture: "upperBody",
  reach: "upperBody",
  lookAt: "head",
  emote: "face",
};

/** Which region an action owns: its explicit `region`, else the verb default. */
export const actionRegion = (
  action: IAutoMovieActionCall,
): AutoMovieBodyRegion =>
  action.region ?? REGION_BY_VERB[action.verb] ?? "fullBody";
