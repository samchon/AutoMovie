import { IAutoMovieNode, IAutoMovieTransform } from "@automovie/interface";

import { Matrix4 } from "../math/Matrix4";

/**
 * The COMPOSE pass: turn a flat list of nodes — each with a parent-local TRS —
 * into a world matrix per node, walking parent-before-child.
 *
 * `localOverrides` carries the transforms the sample/constrain passes produced
 * for animated nodes; a node absent from the map keeps its rest-pose
 * {@link IAutoMovieNode} transform. Resolution is memoized and parent-driven, so
 * the input list may be in any order — a child seen before its parent pulls the
 * parent in on demand.
 *
 * Composition is a real matrix product (via {@link Matrix4}) rather than TRS
 * concatenation, so a non-uniformly scaled parent rotating a child shears
 * correctly instead of approximately.
 *
 * @author Samchon
 */
export const composeScene = (
  nodes: IAutoMovieNode[],
  localOverrides?: Map<string, IAutoMovieTransform>,
): Map<string, number[]> => {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const world = new Map<string, number[]>();

  const resolve = (id: string): number[] => {
    const cached = world.get(id);
    if (cached !== undefined) return cached;
    const node = byId.get(id)!;
    const t = localOverrides?.get(id) ?? node.transform;
    const local = Matrix4.compose(t.translation, t.rotation, t.scale);
    const m =
      node.parent === null
        ? local
        : Matrix4.multiply(resolve(node.parent), local);
    world.set(id, m);
    return m;
  };

  for (const node of nodes) resolve(node.id);
  return world;
};
