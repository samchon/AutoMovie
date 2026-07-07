import { validateScriptTree } from "@automovie/engine";
import { IAutoMovieScriptNode } from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { hasViolation } from "../internal/predicates";
import { createScriptTree, treeBeats } from "./test_validation_script_tree";

const gate = (
  mutate: (tree: IAutoMovieScriptNode[]) => IAutoMovieScriptNode[],
): ReturnType<typeof validateScriptTree> =>
  validateScriptTree({ tree: mutate(createScriptTree()), beats: treeBeats() });

/**
 * Every structural rule of the refinement tree has a negative twin: the gate
 * names the exact node and edge that breaks the graph, so one correction round
 * can fix the tree instead of guessing.
 *
 * Scenarios:
 *
 * 1. An empty node id violates.
 * 2. A duplicated node id violates at the duplicate's path.
 * 3. No root (the intent re-parented) violates the exactly-one-root rule.
 * 4. A second root violates the same rule.
 * 5. A non-intent root violates on its kind.
 * 6. A non-root intent (an intent refining another node) violates.
 * 7. A dangling parent violates.
 * 8. A refinement cycle violates.
 * 9. An illegal parent-kind (an act refining a scene) violates.
 * 10. A self/dangling temporal edge violates.
 * 11. A self/dangling interactsWith edge violates.
 * 12. A beat node naming a ghost beat violates.
 * 13. Two nodes claiming one beat violate at the second claim.
 * 14. A beat with no node violates (the tree must refine every beat).
 * 15. A negative or non-finite dialogue anchor violates.
 */
export const test_validation_script_tree_gates = (): void => {
  TestValidator.predicate(
    "empty node id",
    hasViolation(
      gate((t) => t.map((n, i) => (i === 3 ? { ...n, id: " " } : n))),
      "type",
      "[3].id",
    ),
  );

  TestValidator.predicate(
    "duplicate node id",
    hasViolation(
      gate((t) => t.map((n, i) => (i === 3 ? { ...n, id: "act1" } : n))),
      "type",
      "[3].id",
    ),
  );

  const noRoot = gate((t) =>
    t.map((n) => (n.kind === "intent" ? { ...n, parent: "act1" } : n)),
  );
  TestValidator.predicate(
    "no root violates",
    hasViolation(noRoot, "type", "$input.tree"),
  );
  TestValidator.predicate(
    "a non-root intent violates",
    hasViolation(noRoot, "type", "[0].parent"),
  );

  TestValidator.predicate(
    "two roots violate",
    hasViolation(
      gate((t) => t.map((n) => (n.id === "act1" ? { ...n, parent: null } : n))),
      "type",
      "$input.tree",
    ),
  );

  TestValidator.predicate(
    "a non-intent root violates on kind",
    hasViolation(
      gate((t) =>
        t
          .filter((n) => n.kind !== "intent")
          .map((n) => (n.id === "act1" ? { ...n, parent: null } : n))
          .map((n) => (n.id === "scene1" ? { ...n, parent: "act1" } : n)),
      ),
      "type",
      ".kind",
    ),
  );

  TestValidator.predicate(
    "dangling parent",
    hasViolation(
      gate((t) =>
        t.map((n) => (n.id === "grp" ? { ...n, parent: "ghost" } : n)),
      ),
      "type",
      ".parent",
    ),
  );

  TestValidator.predicate(
    "refinement cycle",
    hasViolation(
      gate((t) =>
        t.map((n) =>
          n.id === "act1"
            ? { ...n, parent: "grp" }
            : n.kind === "intent"
              ? n
              : n,
        ),
      ),
      "type",
      ".parent",
    ),
  );

  TestValidator.predicate(
    "illegal parent-kind (act under scene)",
    hasViolation(
      gate((t) =>
        t.map((n) => (n.id === "act1" ? { ...n, parent: "scene1" } : n)),
      ),
      "type",
      ".parent",
    ),
  );

  const badTemporal = gate((t) =>
    t.map((n) =>
      n.id === "b1"
        ? { ...n, temporal: "b1" }
        : n.id === "b2"
          ? { ...n, temporal: "ghost" }
          : n,
    ),
  );
  TestValidator.predicate(
    "self temporal",
    hasViolation(badTemporal, "type", "[4].temporal"),
  );
  TestValidator.predicate(
    "dangling temporal",
    hasViolation(badTemporal, "type", "[5].temporal"),
  );

  const badInteract = gate((t) =>
    t.map((n) =>
      n.id === "b1" ? { ...n, interactsWith: ["b1", "ghost"] } : n,
    ),
  );
  TestValidator.predicate(
    "self interactsWith",
    hasViolation(badInteract, "type", "interactsWith[0]"),
  );
  TestValidator.predicate(
    "dangling interactsWith",
    hasViolation(badInteract, "type", "interactsWith[1]"),
  );

  TestValidator.predicate(
    "ghost beat",
    hasViolation(
      gate((t) =>
        t.map((n) =>
          n.kind === "beat" && n.id === "b1"
            ? { ...n, payload: { ...n.payload, beat: "ghost" } }
            : n,
        ),
      ),
      "type",
      ".payload.beat",
    ),
  );

  const doubleClaim = gate((t) =>
    t.map((n) =>
      n.kind === "beat" && n.id === "b2"
        ? { ...n, payload: { ...n.payload, beat: "beat-1" } }
        : n,
    ),
  );
  TestValidator.predicate(
    "double beat claim",
    hasViolation(doubleClaim, "type", "[5].payload.beat"),
  );
  TestValidator.predicate(
    "the unclaimed beat is also reported",
    hasViolation(doubleClaim, "type", "$input.tree"),
  );

  TestValidator.predicate(
    "unclaimed beat (beat node removed)",
    hasViolation(
      gate((t) => t.filter((n) => n.id !== "b2")),
      "type",
      "$input.tree",
    ),
  );

  const badAnchor = gate((t) =>
    t.map((n) =>
      n.kind === "beat" && n.id === "b1"
        ? {
            ...n,
            payload: {
              ...n.payload,
              dialogue: [
                { speaker: "A", text: "x", anchor: -1 },
                { speaker: "B", text: "y", anchor: Number.NaN },
              ],
            },
          }
        : n,
    ),
  );
  TestValidator.predicate(
    "negative anchor",
    hasViolation(badAnchor, "range", "dialogue[0].anchor"),
  );
  TestValidator.predicate(
    "non-finite anchor",
    hasViolation(badAnchor, "range", "dialogue[1].anchor"),
  );
};
