import { IautomovieKeyframe, IautomovieMotion } from "@automovie/interface";

/**
 * Concatenate several clips end-to-end into one timeline ??the smallest step
 * toward a _performance_ (a shot stitched from beats: walk, then leap, then
 * sit). Each part's keyframes are shifted by the running offset so part `n`
 * starts where part `n??` ended; the boundary keyframe (a later part's `time:
 * 0`) is dropped so the merged times stay strictly increasing, leaving the
 * engine to interpolate across the seam.
 *
 * The result is an ordinary {@link IautomovieMotion} the player samples like any
 * other (so a sequence can itself be sequenced). All parts must target the same
 * skeleton; the first part's skeleton id is used.
 *
 * @author Samchon
 */
export const sequenceMotion = (
  id: string,
  parts: IautomovieMotion[],
  loop = false,
): IautomovieMotion => {
  const keyframes: IautomovieKeyframe[] = [];
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
    skeleton: parts[0]!.skeleton,
    duration: offset,
    loop,
    keyframes,
  };
};
