/**
 * The engine's deterministic **sampling clock** — the one frame-boundary
 * contract every sampler steps: motion bakes ({@link motionToClip}'s parity
 * proofs), the physics validators' fixed-clock sweeps, and the ground-IK pass's
 * stance detection all inspect the same instants, so their frame boundaries can
 * never drift apart (an off-by-one grid would silently break the #609
 * frame-atomic chunking rule and the #597 continuity oracles).
 *
 * **The contract.** For a window `[start, end]` at `sampleRate` samples per
 * second: `frames = max(1, ceil((end − start) · sampleRate))` intervals,
 * yielding `frames + 1` instants `start + i / sampleRate` with the last clamped
 * to `end` — an **endpoint-inclusive** grid (the final state is always
 * inspected, and a sub-frame window still yields its two endpoints).
 *
 * **Not the render clock.** `render/plan.ts`'s `frameTimes(fps, duration)` is a
 * different contract: `round(duration · fps)` capture instants `i / fps`,
 * endpoint-**exclusive** and unclamped — video frames are capture instants for
 * an encoder, while this grid is inspection instants for samplers and
 * validators that must see the end state. Document-only relationship; do not
 * unify.
 *
 * @author Samchon
 */

/** The sampling grid over `[start, end]` — see the module contract. */
export const windowSampleTimes = (
  start: number,
  end: number,
  sampleRate: number,
): number[] => {
  const frames = Math.max(1, Math.ceil((end - start) * sampleRate));
  const times = Array.from({ length: frames + 1 }, (_, index) =>
    Math.min(end, start + index / sampleRate),
  );
  // FP can land (end − start) × rate just above an integer; the extra instant
  // clamps onto `end` and duplicates it — a zero-width segment downstream
  // validators would divide by (#1012).
  if (times.length > 1 && times[times.length - 1] === times[times.length - 2])
    times.pop();
  return times;
};

/** The sampling grid over `[0, duration]` — see the module contract. */
export const sampleTimes = (duration: number, sampleRate: number): number[] =>
  windowSampleTimes(0, duration, sampleRate);
