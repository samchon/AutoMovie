import { IAutoMovieMotion, IAutoMovieVector3 } from "@automovie/interface";

import { Quaternion } from "../math/Quaternion";
import { Vector3 } from "../math/Vector3";
import { travelMotion } from "./travel";

const assertFiniteVector = (label: string, vector: IAutoMovieVector3): void => {
  if (!Number.isFinite(vector.x)) throw new Error(`${label}.x must be finite`);
  if (!Number.isFinite(vector.y)) throw new Error(`${label}.y must be finite`);
  if (!Number.isFinite(vector.z)) throw new Error(`${label}.z must be finite`);
};

/**
 * Synthesise the **locomote** action: carry a looping gait clip across a
 * `distance` at `speed` in a `direction`. The engine sizes the travel — it
 * picks how many gait cycles cover the distance and bakes the matching forward
 * velocity via `travelMotion` — so the harness `locomote` verb ("walk to the
 * door") becomes real traveling motion without the model computing cycles or
 * m/s. At least one cycle always plays.
 *
 * `faceTravel` turns the body to face where it is going: the root is oriented
 * so the model's forward (`+Z`) points down the travel direction, so a figure
 * sent sideways walks facing its path instead of strafing. Omit it (the
 * default) to keep the rest facing — a strafe or a backpedal.
 *
 * @author Samchon
 */
export const locomoteMotion = (
  id: string,
  gait: IAutoMovieMotion,
  distance: number,
  speed: number,
  direction: IAutoMovieVector3,
  faceTravel = false,
): IAutoMovieMotion => {
  if (!Number.isFinite(distance))
    throw new Error("locomote distance must be finite and positive");
  if (distance <= 0)
    throw new Error("locomote distance must be finite and positive");
  if (!Number.isFinite(speed))
    throw new Error("locomote speed must be finite and positive");
  if (speed <= 0) throw new Error("locomote speed must be finite and positive");
  if (!Number.isFinite(gait.duration))
    throw new Error("locomote gait duration must be finite and positive");
  if (gait.duration <= 0)
    throw new Error("locomote gait duration must be finite and positive");
  assertFiniteVector("locomote direction", direction);
  const directionLength = Vector3.length(direction);
  if (!Number.isFinite(directionLength))
    throw new Error("locomote direction length must be finite");
  if (directionLength === 0)
    throw new Error("locomote direction must be non-zero");

  const cycles = Math.max(1, Math.round(distance / (speed * gait.duration)));
  const heading = Vector3.scale(direction, 1 / directionLength);
  const velocity = Vector3.scale(heading, speed);
  const facing = faceTravel
    ? Quaternion.fromAxisAngle(
        { x: 0, y: 1, z: 0 },
        (Math.atan2(heading.x, heading.z) * 180) / Math.PI,
      )
    : undefined;
  return travelMotion(id, gait, cycles, velocity, facing);
};
