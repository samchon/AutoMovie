import { IAutoMovieClip, IAutoMovieTransform } from "@automovie/interface";

import { sampleClip, sampleClipSequence } from "../resolve/sampleClip";

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
 * Resolve a node's baked world transform from every object-motion authority at
 * one shot-local instant. Translation and rotation are selected independently,
 * so disjoint producer clips compose while later duplicate channels hand off.
 */
export const bakedTransformFromClipsAt = (
  clips: readonly IAutoMovieClip[],
  node: string,
  t: number,
): IAutoMovieTransform | null => {
  const sampled = sampleClipSequence(clips, t);
  const translation = sampled.get(`node:${node}:translation`)?.value;
  const rotation = sampled.get(`node:${node}:rotation`)?.value;
  if (translation === undefined || rotation === undefined) return null;
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
 * When one of the coupling pass's baked clips starts speaking for `node`.
 * `followClipOf` only receives entries kept under that same child id by
 * `coupleObjects`; `compileAttach` and the mount baker always emit a non-empty
 * translation/rotation pair for it. Keep that producer invariant explicit
 * instead of carrying unreachable malformed-clip branches in this internal
 * selector.
 */
const drivingStart = (clip: IAutoMovieClip, node: string): number =>
  clip.tracks.find(
    (track) =>
      track.channel.kind === "node" &&
      track.channel.node === node &&
      track.channel.path === "translation",
  )!.times[0]!;

/**
 * The baked clip that supplies a chained coupling's parent transform for
 * `node`, or `null` when none does.
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
 * The latest clip to start wins. This selector is used by a chained coupling's
 * parent path, which composes one parent clip across every keyframe rather than
 * resolving a single instant. Ties go to the later entry, the order the bakers
 * append in.
 *
 * @author Samchon
 */
export const followClipOf = (
  objectMotions: readonly IAutoMovieClip[],
  node: string,
): IAutoMovieClip | null => {
  let best: IAutoMovieClip | null = null;
  let bestStart = -Infinity;
  for (const clip of objectMotions) {
    const start = drivingStart(clip, node);
    if (start >= bestStart) {
      best = clip;
      bestStart = start;
    }
  }
  return best;
};
