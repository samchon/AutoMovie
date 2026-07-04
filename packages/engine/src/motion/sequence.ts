import { IAutoMovieKeyframe, IAutoMovieMotion } from "@automovie/interface";

/**
 * Concatenate several clips end-to-end into one timeline — the smallest step
 * toward a _performance_ (a shot stitched from beats: walk, then leap, then
 * sit). Each part's keyframes are shifted by the running offset so part `n`
 * starts where part `n−1` ended; the boundary keyframe (a later part's `time:
 * 0`) is dropped so the merged times stay strictly increasing, leaving the
 * engine to interpolate across the seam.
 *
 * The result is an ordinary {@link IAutoMovieMotion} the player samples like any
 * other (so a sequence can itself be sequenced). All parts must target the same
 * skeleton; the first part's skeleton id is used.
 *
 * @author Samchon
 */
export const sequenceMotion = (
  id: string,
  parts: IAutoMovieMotion[],
  loop = false,
): IAutoMovieMotion => {
  if (parts.length === 0) throw new Error("sequence parts must not be empty");

  const skeleton = parts[0]!.skeleton;
  for (const part of parts)
    if (part.skeleton !== skeleton)
      throw new Error("sequence part skeletons must match");

  const keyframes: IAutoMovieKeyframe[] = [];
  let offset = 0;
  for (let p = 0; p < parts.length; ++p) {
    const part = parts[p]!;
    for (const k of part.keyframes) {
      if (p > 0 && k.time === 0) continue; // drop the duplicate seam keyframe
      keyframes.push({ ...k, time: k.time + offset });
    }
    offset += part.duration;
  }
  return {
    id,
    skeleton,
    duration: offset,
    loop,
    keyframes,
  };
};
