import {
  IAutoMovieConstraintViolation,
  IAutoMovieScriptNode,
} from "@automovie/interface";

/**
 * The refinement chain above one screenplay node, nearest-first and excluding
 * the node itself: `["scene-1", "act-1", "intent"]` for a beat under that
 * scene. This is the cascade path of D013: feedback located on a leaf walks
 * this chain so a correction can target the beat, the scene, the act, or the
 * intent (which level to fix is the agent's call, D012).
 *
 * The walker serves already-validated trees (`validateScriptTree`) but refuses
 * silent drops on malformed input, the `bindProfile` precedent: an unknown
 * `nodeId`, a parent reference that does not resolve, or a parent cycle all
 * **throw**. A cascade that silently stopped short would misdirect the
 * correction round.
 */
export const scriptAncestors = (
  tree: readonly IAutoMovieScriptNode[],
  nodeId: string,
): string[] => {
  const byId = new Map(tree.map((node) => [node.id, node]));
  const start = byId.get(nodeId);
  if (start === undefined)
    throw new Error(
      `scriptAncestors node "${nodeId}" is not in the screenplay tree`,
    );

  const chain: string[] = [];
  const visited = new Set<string>([nodeId]);
  let parent = start.parent;
  while (parent !== null) {
    if (visited.has(parent))
      throw new Error(
        `scriptAncestors parent chain of "${nodeId}" is cyclic at "${parent}"`,
      );
    const node = byId.get(parent);
    if (node === undefined)
      throw new Error(
        `scriptAncestors parent "${parent}" is not in the screenplay tree`,
      );
    visited.add(parent);
    chain.push(parent);
    parent = node.parent;
  }
  return chain;
};

/**
 * The beat-kind node claiming one flat {@link IAutoMovieScript.beats} entry, or
 * `null` when there is no tree or no node claims it. This is the join
 * `validateScriptTree` enforces 1:1 on a committed tree, the lookup a
 * beat-scoped consumer uses to locate its feedback on the graph.
 */
export const beatNodeOf = (
  tree: readonly IAutoMovieScriptNode[] | null | undefined,
  beatId: string,
): string | null => {
  if (tree === null || tree === undefined) return null;
  for (const node of tree)
    if (node.kind === "beat" && node.payload.beat === beatId) return node.id;
  return null;
};

/**
 * Stamp beat-scoped feedback onto the screenplay graph: every violation
 * produced while working `beatId` gains `node` = the claiming beat node's id,
 * so `scriptAncestors` can cascade it up the refinement chain.
 *
 * Pure: when the tree is absent or no node claims the beat, the input array is
 * returned as-is (no stamp, nothing mutated); when a claim exists, a new array
 * of stamped copies is returned and the originals stay untouched.
 */
export const locateOnBeat = (
  violations: readonly IAutoMovieConstraintViolation[],
  tree: readonly IAutoMovieScriptNode[] | null | undefined,
  beatId: string,
): IAutoMovieConstraintViolation[] => {
  const node = beatNodeOf(tree, beatId);
  if (node === null) return [...violations];
  return violations.map((violation) => ({ ...violation, node }));
};
