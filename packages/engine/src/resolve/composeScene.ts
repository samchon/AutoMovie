import { IAutoMovieNode, IAutoMovieTransform } from "@automovie/interface";

import { Matrix4 } from "../math/Matrix4";

const indexNodes = (
  nodes: readonly IAutoMovieNode[],
): Map<string, { node: IAutoMovieNode; index: number }> => {
  const byId = new Map<string, { node: IAutoMovieNode; index: number }>();
  nodes.forEach((node, index) => {
    const existing = byId.get(node.id);
    if (existing !== undefined)
      throw new Error(
        `node id "${node.id}" is duplicated at nodes[${index}].id; first declared at nodes[${existing.index}].id`,
      );
    byId.set(node.id, { node, index });
  });
  nodes.forEach((node, index) => {
    if (node.parent !== null && !byId.has(node.parent))
      throw new Error(
        `node "${node.id}" references missing parent "${node.parent}" at nodes[${index}].parent`,
      );
  });
  return byId;
};

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
  const byId = indexNodes(nodes);
  const world = new Map<string, number[]>();
  const resolving = new Set<string>();

  const resolve = (id: string): number[] => {
    const cached = world.get(id);
    if (cached !== undefined) return cached;
    if (resolving.has(id))
      throw new Error(`node parent cycle includes "${id}"`);
    resolving.add(id);
    const node = byId.get(id)!.node;
    const t = localOverrides?.get(id) ?? node.transform;
    const local = Matrix4.compose(t.translation, t.rotation, t.scale);
    const m =
      node.parent === null
        ? local
        : Matrix4.multiply(resolve(node.parent), local);
    world.set(id, m);
    resolving.delete(id);
    return m;
  };

  for (const node of nodes) resolve(node.id);
  return world;
};
