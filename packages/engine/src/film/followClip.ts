import { IAutoMovieClip, IAutoMovieTransform } from "@automovie/interface";

import { sampleClip } from "../resolve/sampleClip";

/**
 * The world transform a baked follow clip writes onto `node` at `t`. A coupled
 * child's world root comes from here (the exact clip {@link performShot} baked
 * through `compileAttach`), so beat-end, per-frame render, and a chained
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
 * When a clip starts speaking for `node`'s world transform: the first time of
 * its translation track, or `null` when it does not drive that node.
 *
 * A clip qualifies only if it carries BOTH channels {@link bakedTransformAt}
 * reads, which is the honest predicate for "can answer this node's transform":
 * a translation-only clip would select and then fail on the rotation lookup.
 *
 * The times are non-empty by the time any clip reaches here:
 * `validateClipArtifact` refuses an empty keyframe list before a shot is
 * committed, and the engine's own bakers (`compileAttach`, `projectileMotion`)
 * always emit at least one frame.
 */
const drivingStart = (clip: IAutoMovieClip, node: string): number | null => {
  const trackFor = (path: "translation" | "rotation") =>
    clip.tracks.find(
      (track) =>
        track.channel.kind === "node" &&
        track.channel.node === node &&
        track.channel.path === path,
    );
  const translation = trackFor("translation");
  if (translation === undefined || trackFor("rotation") === undefined)
    return null;
  return translation.times[0]!;
};

/**
 * The baked clip driving `node`'s world transform at `at`, or `null` when none
 * does.
 *
 * Selected by what a clip CARRIES rather than by how its id is spelled (#1361).
 * The prefix match this used to do (`attach:<node>`, plus the `:2`, `:3`
 * handoff suffixes #989 bakes in start order) knew only the ids `compileAttach`
 * writes, so the `trajectory:<node>` clip the launch pass bakes for the SAME
 * node was invisible: a thrown stone's beat end read the attach clip that ends
 * at release and reported the stone still in the hand, contradicting the
 * committed shot it was resolved from. Two of the engine's own outputs, one
 * unable to see the other because of a naming convention only the producer
 * knew.
 *
 * The latest clip to have STARTED by `at` wins, which is what "the one in
 * effect" means for a node whose authority changes hands mid-shot: held,
 * released, flying, landed. That subsumes the suffix ranking it replaces, since
 * a handoff's later coupling also starts later, and it extends to any future
 * baker without teaching this function another id. Ties (two clips claiming the
 * node from the same instant) go to the later entry, the order the bakers
 * append in.
 *
 * Omit `at` to ask for the latest authority in the shot regardless of time,
 * which is what a chained coupling's parent path wants: it composes one parent
 * clip across every keyframe rather than resolving a single instant.
 *
 * @author Samchon
 */
export const followClipOf = (
  objectMotions: readonly IAutoMovieClip[],
  node: string,
  at?: number,
): IAutoMovieClip | null => {
  let best: IAutoMovieClip | null = null;
  let bestStart = -Infinity;
  for (const clip of objectMotions) {
    const start = drivingStart(clip, node);
    if (start === null) continue;
    if (at !== undefined && start > at + 1e-9) continue;
    if (start >= bestStart) {
      best = clip;
      bestStart = start;
    }
  }
  return best;
};
