import {
  detectSupportToppling,
  locateOnBeat,
  scriptAncestors,
} from "@automovie/engine";
import { TestValidator } from "@nestia/e2e";

import {
  createScriptTree,
  treeBeats,
} from "../validation/test_validation_script_tree";

/**
 * THE CASCADE PROOF (D013, #620): physics feedback reaches the screenplay. A
 * real physics producer raises a warning while a beat is being worked; located
 * on that beat's graph node, the warning climbs the refinement chain — beat →
 * group → scene → act → intent — so the correction can target any level of the
 * screenplay, not just the offending motion. The screenplay is upstream truth,
 * and the engine's feedback now reaches it.
 *
 * Scenarios:
 *
 * 1. A crate overhanging its support during `beat-1`'s work raises a REAL
 *    `warning` from detectSupportToppling (not a synthetic violation).
 * 2. LocateOnBeat stamps it with the claiming beat node `b1`.
 * 3. ScriptAncestors walks the stamped node up the refinement chain: exactly
 *    `["grp", "scene1", "act1", "root"]` — the scene, the act, and the intent
 *    all become addressable correction targets.
 * 4. The treeless twin: the same warning without a screenplay tree stays unlocated
 *    (no node), and there is no chain to walk — feedback remains motion-local,
 *    exactly the pre-#620 world.
 */
export const test_film_feedback_cascade = (): void => {
  const tree = createScriptTree();
  TestValidator.equals("the fixture beats exist", treeBeats().length, 2);

  // A crate whose center of mass overhangs its small support square: a real
  // physics warning produced "while working beat-1".
  const support = [
    { x: -0.1, y: 0, z: -0.1 },
    { x: 0.1, y: 0, z: -0.1 },
    { x: 0.1, y: 0, z: 0.1 },
    { x: -0.1, y: 0, z: 0.1 },
  ];
  const result = detectSupportToppling({
    node: "crate",
    centerOfMass: { x: 0.5, y: 0.4, z: 0 },
    support,
  });
  const warnings =
    result.validation.success === true
      ? (result.validation.warnings ?? [])
      : [];
  TestValidator.equals("a real physics warning was raised", warnings.length, 1);
  TestValidator.equals(
    "and it is warning severity",
    warnings[0]!.severity,
    "warning",
  );

  const located = locateOnBeat(warnings, tree, "beat-1");
  TestValidator.equals(
    "the warning locates on the beat node",
    located[0]!.node,
    "b1",
  );

  const chain = scriptAncestors(tree, located[0]!.node!);
  TestValidator.equals("the warning cascades up the screenplay", chain, [
    "grp",
    "scene1",
    "act1",
    "root",
  ]);

  const unlocated = locateOnBeat(warnings, null, "beat-1");
  TestValidator.equals(
    "without a tree the feedback stays motion-local",
    unlocated[0]!.node,
    undefined,
  );
};
