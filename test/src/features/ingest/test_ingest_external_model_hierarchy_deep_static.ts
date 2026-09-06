import { TestValidator } from "@nestia/e2e";

import {
  createExternalModelHierarchyChain,
  inspectExternalModelHierarchyFixture,
} from "../internal/externalModelHierarchyFixture";
import { throwsError } from "../internal/predicates";

/**
 * Source node depth is graph data, so static admission walks parents without
 * consuming one JavaScript call frame per node.
 *
 * Scenarios:
 *
 * 1. A 16,384-node chain accepts its final root and preserves the node count.
 * 2. Connecting its first node to its last produces a deterministic cycle
 *    diagnostic, including when no scene selects the cyclic component.
 */
export const test_ingest_external_model_hierarchy_deep_static = (): void => {
  const fixture = createExternalModelHierarchyChain(16_384);
  TestValidator.equals(
    "deep static hierarchy inventory",
    inspectExternalModelHierarchyFixture(fixture, "gltf-static-v1").counts
      .nodes,
    16_384,
  );
  fixture.document.nodes[0]!.children = [16_383];
  fixture.document.scenes = undefined;
  TestValidator.predicate(
    "deep static cycle retains its cause",
    throwsError(
      () => inspectExternalModelHierarchyFixture(fixture, "gltf-static-v1"),
      "nodes[0] belongs to a parent cycle.",
    ),
  );
};
