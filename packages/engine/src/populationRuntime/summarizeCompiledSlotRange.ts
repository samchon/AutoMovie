import {
  IAutoMovieFormationBounds,
  IAutoMovieVector3,
} from "@automovie/interface";

/**
 * Exact bounds and running-mean centroid of one contiguous slot range.
 *
 * Shared by the compiled formation and compiled instance-set kernels, because a
 * chunk summary is one measurement whichever population supplies the points:
 * both visit slots in ascending order and fold the centroid with the same
 * running mean, so their bounds and centroids are the same arithmetic rather
 * than two copies that could drift in the last bit. The fold is the one the
 * builder has always compiled with, so the summaries, and the digests over
 * them, are unchanged by the kernels moving here.
 *
 * Package-private: the engine root does not export it.
 */
export const summarizeCompiledSlotRange = (
  start: number,
  count: number,
  position: (slot: number) => IAutoMovieVector3,
): { bounds: IAutoMovieFormationBounds; centroid: IAutoMovieVector3 } => {
  const min = {
    x: Number.POSITIVE_INFINITY,
    y: Number.POSITIVE_INFINITY,
    z: Number.POSITIVE_INFINITY,
  };
  const max = {
    x: Number.NEGATIVE_INFINITY,
    y: Number.NEGATIVE_INFINITY,
    z: Number.NEGATIVE_INFINITY,
  };
  const centroid = { x: 0, y: 0, z: 0 };
  for (let slot = start; slot < start + count; ++slot) {
    const point = position(slot);
    min.x = Math.min(min.x, point.x);
    min.y = Math.min(min.y, point.y);
    min.z = Math.min(min.z, point.z);
    max.x = Math.max(max.x, point.x);
    max.y = Math.max(max.y, point.y);
    max.z = Math.max(max.z, point.z);
    const seen = slot - start + 1;
    centroid.x = centroid.x * ((seen - 1) / seen) + point.x / seen;
    centroid.y = centroid.y * ((seen - 1) / seen) + point.y / seen;
    centroid.z = centroid.z * ((seen - 1) / seen) + point.z / seen;
  }
  return { bounds: { min, max }, centroid };
};
