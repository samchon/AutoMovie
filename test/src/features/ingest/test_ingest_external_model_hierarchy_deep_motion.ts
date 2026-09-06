import { TestValidator } from "@nestia/e2e";

import {
  createExternalModelHierarchyChain,
  inspectExternalModelHierarchyFixture,
} from "../internal/externalModelHierarchyFixture";
import { throwsError } from "../internal/predicates";

/**
 * Motion normalization consumes the common forest's parent map without a
 * recursive walk or a second interpretation of source parentage.
 *
 * Scenarios:
 *
 * 1. A 16,384-node chain returns the source parent of its animated first node
 *    and null for its final root, preserving the complete inventory.
 * 2. One closing edge is refused as a parent cycle before motion is normalized.
 */
export const test_ingest_external_model_hierarchy_deep_motion = (): void => {
  const fixture = createExternalModelHierarchyChain(16_384);
  const inspected = inspectExternalModelHierarchyFixture(
    fixture,
    "gltf-motion-v1",
  );
  TestValidator.equals(
    "deep motion hierarchy inventory",
    inspected.motion?.nodes.length,
    16_384,
  );
  TestValidator.equals(
    "deep motion first parent",
    inspected.motion?.nodes[0]?.parent,
    "node_1",
  );
  TestValidator.equals(
    "deep motion final root",
    inspected.motion?.nodes[16_383]?.parent,
    null,
  );
  fixture.document.nodes[0]!.children = [16_383];
  fixture.document.scenes = undefined;
  TestValidator.predicate(
    "deep motion cycle retains its cause",
    throwsError(
      () => inspectExternalModelHierarchyFixture(fixture, "gltf-motion-v1"),
      "nodes[0] belongs to a parent cycle.",
    ),
  );
};
