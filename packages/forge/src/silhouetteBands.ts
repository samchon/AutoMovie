/** One scanline of a figure silhouette: the y row and its pixel runs. */
export interface IForgeSilhouetteRow {
  /** Row coordinate (image y). */
  y: number;

  /** Figure runs on the row as `[start, end]` pixel intervals, left to right. */
  runs: [number, number][];
}

/** One scanline of a tracked band: the run chosen as the subject's body. */
export interface IForgeSilhouetteBand {
  /** Row coordinate (image y). */
  y: number;

  /** Left edge of the tracked run. */
  min: number;

  /** Right edge of the tracked run. */
  max: number;
}

/**
 * Track the subject's own silhouette run down the scanlines.
 *
 * A multi-view sheet's figure mask has several runs per row — the head plus
 * detached spurs (twin tails, ribbons, loose strands). The head is followed by
 * continuity: the first row takes its widest run, every later row takes the run
 * overlapping the previous row's choice the most, and a row whose runs all miss
 * the previous run (or that has no runs at all) keeps the previous band so a
 * one-row gap cannot derail the track.
 *
 * @author Samchon
 * @throws When the first row has no runs (there is nothing to start from)
 */
export const trackSilhouetteBands = (
  rows: IForgeSilhouetteRow[],
): IForgeSilhouetteBand[] => {
  const out: IForgeSilhouetteBand[] = [];
  let prev: [number, number] | null = null;
  for (const { y, runs } of rows) {
    let best: [number, number] | null = null;
    let bestScore = -1;
    for (const run of runs) {
      const score =
        prev === null
          ? run[1] - run[0]
          : Math.min(run[1], prev[1]) - Math.max(run[0], prev[0]);
      if (score > bestScore) {
        bestScore = score;
        best = run;
      }
    }
    if (prev !== null && bestScore < 0) best = prev;
    if (best === null) throw new Error(`row ${y} has no runs to track from`);
    out.push({ y, min: best[0], max: best[1] });
    prev = best;
  }
  return out;
};

/** Options of {@link cleanSilhouetteBands}. */
export interface IForgeBandCleaning {
  /**
   * Clamp the min side monotonically non-decreasing after its extremum row (the
   * skull's widest point) — spurs can shrink the band but never widen it again
   * below the head.
   */
  monoMin?: boolean;

  /** The max-side twin of `monoMin`. */
  monoMax?: boolean;

  /**
   * Rows at or above this y are the only candidates for each side's extremum
   * anchor, so low spurs (ribbons at mouth level) cannot claim it. Default:
   * every row competes.
   */
  extremumAbove?: number;

  /** Median prefilter radius in rows; `0` disables. Default `3`. */
  medianRadius?: number;

  /**
   * Triangular smoothing radius in rows, applied twice; `0` disables. Default
   * `12` — clay shading exposes every per-row jiggle a texture hides.
   */
  smoothRadius?: number;
}

/**
 * Clean a tracked band curve for carving: median prefilter against one-off
 * tracking glitches, extremum-anchored monotone clamps against spurs (ribbons,
 * tails) ballooning a slice, then a wide double triangular kernel because the
 * band drives a lofted clay surface where row jitter reads as ring banding.
 * Each side's clamp starts only AT its own extremum row — above it the head
 * must stay free to bulge outward.
 *
 * @author Samchon
 */
export const cleanSilhouetteBands = (
  bands: IForgeSilhouetteBand[],
  options: IForgeBandCleaning = {},
): IForgeSilhouetteBand[] => {
  const {
    monoMin = false,
    monoMax = false,
    extremumAbove = Number.POSITIVE_INFINITY,
    medianRadius = 3,
    smoothRadius = 12,
  } = options;

  const median = (arr: number[]): number[] => {
    if (medianRadius === 0) return arr;
    return arr.map((_, i) => {
      const lo = Math.max(0, i - medianRadius);
      const hi = Math.min(arr.length - 1, i + medianRadius);
      const win = arr.slice(lo, hi + 1).sort((a, b) => a - b);
      return win[(win.length / 2) | 0]!;
    });
  };
  let mins = median(bands.map((b) => b.min));
  let maxs = median(bands.map((b) => b.max));

  let iMin = 0;
  let iMax = 0;
  bands.forEach(({ y }, i) => {
    if (y <= extremumAbove && mins[i]! < mins[iMin]!) iMin = i;
    if (y <= extremumAbove && maxs[i]! > maxs[iMax]!) iMax = i;
  });
  let runMin = Number.NEGATIVE_INFINITY;
  let runMax = Number.POSITIVE_INFINITY;
  bands.forEach((_, i) => {
    if (monoMin && i >= iMin) {
      runMin = Math.max(mins[i]!, runMin);
      mins[i] = runMin;
    }
    if (monoMax && i >= iMax) {
      runMax = Math.min(maxs[i]!, runMax);
      maxs[i] = runMax;
    }
  });

  const smooth = (arr: number[]): number[] => {
    if (smoothRadius === 0) return arr;
    const pass = (a: number[]): number[] =>
      a.map((_, i) => {
        let acc = 0;
        let wAcc = 0;
        for (let d = -smoothRadius; d <= smoothRadius; d++) {
          const j = Math.max(0, Math.min(a.length - 1, i + d));
          const w = smoothRadius + 1 - Math.abs(d);
          acc += a[j]! * w;
          wAcc += w;
        }
        return acc / wAcc;
      });
    return pass(pass(arr));
  };
  mins = smooth(mins);
  maxs = smooth(maxs);

  return bands.map(({ y }, i) => ({ y, min: mins[i]!, max: maxs[i]! }));
};
