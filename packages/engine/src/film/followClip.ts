import { IAutoMovieClip, IAutoMovieTransform } from "@automovie/interface";

import { sampleClip } from "../resolve/sampleClip";

/**
 * The world transform a baked follow clip writes onto `node` at `t`. A coupled
 * child's world root comes from here — the exact clip {@link performShot} baked
 * through `compileAttach` — so beat-end, per-frame render, and a chained
 * coupling's parent read (#1140) all share the SAME composition (#674). Scale
 * is not baked (rigid couplings never scale), so it stays identity.
 *
 * @author Samchon
 */
export const bakedTransformAt = (
  clip: IAutoMovieClip,
  node: string,
  t: number,
): IAutoMovieTransform => {
  const sampled = sampleClip(clip, t);
  const translation = sampled.get(`node:${node}:translation`)!.value;
  const rotation = sampled.get(`node:${node}:rotation`)!.value;
  return {
    translation: {
      x: translation[0]!,
      y: translation[1]!,
      z: translation[2]!,
    },
    rotation: {
      x: rotation[0]!,
      y: rotation[1]!,
      z: rotation[2]!,
      w: rotation[3]!,
    },
    scale: { x: 1, y: 1, z: 1 },
  };
};

/**
 * The baked follow clip driving `node`, or `null` when none does. Matched by
 * `compileAttach`'s stable `attach:<node>` id; a handoff bakes later couplings
 * as `attach:<node>:2`, `:3`, … in start order (#989), so the HIGHEST suffix is
 * the latest coupling — the hand the prop actually ends the beat in.
 *
 * @author Samchon
 */
export const followClipOf = (
  objectMotions: readonly IAutoMovieClip[],
  node: string,
): IAutoMovieClip | null => {
  const prefix = `attach:${node}`;
  let best: IAutoMovieClip | null = null;
  let bestRank = 0;
  for (const clip of objectMotions) {
    let rank = 0;
    if (clip.id === prefix) rank = 1;
    else if (clip.id.startsWith(`${prefix}:`)) {
      const suffix = Number(clip.id.slice(prefix.length + 1));
      if (Number.isInteger(suffix) && suffix > 1) rank = suffix;
    }
    if (rank > bestRank) {
      best = clip;
      bestRank = rank;
    }
  }
  return best;
};
