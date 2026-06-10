import { IAutoFilmMotion, IAutoFilmVector3 } from "@autofilm/interface";

import { Vector3 } from "../math/Vector3";
import { travelMotion } from "./travel";

/**
 * Synthesise the **locomote** action: carry a looping gait clip across a
 * `distance` at `speed` in a `direction`. The engine sizes the travel — it
 * picks how many gait cycles cover the distance and bakes the matching forward
 * velocity via `travelMotion` — so the harness `locomote` verb ("walk to the
 * door") becomes real traveling motion without the model computing cycles or
 * m/s. At least one cycle always plays.
 *
 * @author Samchon
 */
export const locomoteMotion = (
  id: string,
  gait: IAutoFilmMotion,
  distance: number,
  speed: number,
  direction: IAutoFilmVector3,
): IAutoFilmMotion => {
  const cycles = Math.max(1, Math.round(distance / (speed * gait.duration)));
  const velocity = Vector3.scale(Vector3.normalize(direction), speed);
  return travelMotion(id, gait, cycles, velocity);
};
