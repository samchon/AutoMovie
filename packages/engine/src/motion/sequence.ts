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
  for (const part of parts) {
    if (part.skeleton !== skeleton)
      throw new Error("sequence part skeletons must match");
    if (!Number.isFinite(part.duration))
      throw new Error("sequence part duration must be finite and positive");
    if (part.duration <= 0)
      throw new Error("sequence part duration must be finite and positive");
  }

  const keyframes: IAutoMovieKeyframe[] = [];
  let offset = 0;
  for (let p = 0; p < parts.length; ++p) {
    const part = parts[p]!;
    for (const k of part.keyframes) {
      if (p > 0 && k.time === 0) {
        // the kept seam keyframe carries the incoming part's first-segment
        // easing — sampleMotion eases each segment from its start (#1012)
        const seam = keyframes[keyframes.length - 1]!;
        keyframes[keyframes.length - 1] = {
          ...seam,
          easing: k.easing,
          bezier: k.bezier,
        };
        continue;
      }
      keyframes.push({ ...k, time: k.time + offset });
    }
    offset += part.duration;
  }
  // A concatenation keeps a stride clock only when every part carries the
  // SAME cycle and each part spans whole cycles — then the phase runs
  // continuously across the seams (`phase(t) = (phaseAt + t) % period` holds
  // for the whole sequence). Any mismatch or partial cycle breaks the clock,
  // so it is honestly dropped rather than approximated.
  const first = parts[0]!.gaitCycle ?? null;
  const continuous =
    first !== null &&
    parts.every(
      (part) =>
        (part.gaitCycle ?? null) !== null &&
        part.gaitCycle!.period === first.period &&
        part.gaitCycle!.phaseAt === first.phaseAt &&
        Math.abs(
          part.duration / first.period -
            Math.round(part.duration / first.period),
        ) < 1e-9,
    );

  return {
    id,
    skeleton,
    duration: offset,
    loop,
    keyframes,
    gaitCycle: continuous ? first : null,
  };
};
