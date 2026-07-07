import { beatNodeOf, scriptAncestors } from "@automovie/engine";
import { TestValidator } from "@nestia/e2e";

import { throwsError } from "../internal/predicates";
import { createScriptTree } from "../validation/test_validation_script_tree";

/**
 * The refinement-graph walkers of the feedback cascade (D013): scriptAncestors
 * returns the chain a located violation climbs, and beatNodeOf is the flat-beat
 * → graph-node join a beat-scoped consumer locates itself with. Walkers serve
 * validated trees but refuse silent drops on malformed input (the bindProfile
 * precedent) — a cascade that stopped short would misdirect the correction.
 *
 * Scenarios:
 *
 * 1. A deep chain walks nearest-first to the root, excluding the node itself: beat
 *    `b1` under group/scene/act/intent yields exactly `["grp", "scene1",
 *    "act1", "root"]`.
 * 2. The root itself has no ancestors — an empty chain, not a throw.
 * 3. An unknown node id throws (refusal, not an empty answer).
 * 4. A dangling parent mid-walk throws.
 * 5. A cyclic parent chain throws instead of looping forever.
 * 6. BeatNodeOf finds the claiming beat node, and returns null for an unclaimed
 *    beat, a null tree, and an undefined tree alike.
 */
export const test_film_script_graph = (): void => {
  const tree = createScriptTree();
  TestValidator.equals(
    "deep chain walks nearest-first to the root",
    scriptAncestors(tree, "b1"),
    ["grp", "scene1", "act1", "root"],
  );
  TestValidator.equals(
    "the root has no ancestors",
    scriptAncestors(tree, "root"),
    [],
  );
  TestValidator.predicate(
    "unknown node id throws",
    throwsError(() => scriptAncestors(tree, "ghost"), "is not in the"),
  );
  TestValidator.predicate(
    "dangling parent mid-walk throws",
    throwsError(
      () =>
        scriptAncestors(
          tree.map((node) =>
            node.id === "scene1" ? { ...node, parent: "ghost" } : node,
          ),
          "b1",
        ),
      'parent "ghost" is not in the',
    ),
  );
  TestValidator.predicate(
    "cyclic parent chain throws",
    throwsError(
      () =>
        scriptAncestors(
          tree.map((node) =>
            node.id === "root" ? { ...node, parent: "grp" } : node,
          ),
          "b1",
        ),
      "cyclic",
    ),
  );

  TestValidator.equals(
    "beatNodeOf finds the claiming node",
    beatNodeOf(tree, "beat-2"),
    "b2",
  );
  TestValidator.equals(
    "unclaimed beat yields null",
    beatNodeOf(tree, "beat-99"),
    null,
  );
  TestValidator.equals(
    "null tree yields null",
    beatNodeOf(null, "beat-1"),
    null,
  );
  TestValidator.equals(
    "undefined tree yields null",
    beatNodeOf(undefined, "beat-1"),
    null,
  );
};
