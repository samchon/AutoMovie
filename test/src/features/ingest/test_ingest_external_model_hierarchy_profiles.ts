import { AutoMovieExternalModelIngestProfile } from "@automovie/ingest";
import { TestValidator } from "@nestia/e2e";

import {
  createExternalModelHierarchyFixture,
  inspectExternalModelHierarchyFixture,
} from "../internal/externalModelHierarchyFixture";
import { throwsError } from "../internal/predicates";

/**
 * All model profiles admit a node forest before reporting model or motion facts.
 * Each refusal changes the same resident, otherwise accepted model declaration.
 *
 * Scenarios:
 *
 * 1. Static, glTF humanoid, motion, and VRM accept independent scene roots and
 *    a legal parent-child edge while preserving weighted hips and motion facts.
 * 2. A self-cycle, two-node cycle, repeated child, or second parent fails with
 *    its structural diagnostic under every profile, including unselected nodes.
 * 3. Child indices at the inventory length, below zero, fractional, or non-safe
 *    fail before parent traversal; index zero remains a legal child.
 */
export const test_ingest_external_model_hierarchy_profiles = (): void => {
  const profiles: AutoMovieExternalModelIngestProfile[] = [
    "gltf-static-v1",
    "gltf-humanoid-v1",
    "gltf-motion-v1",
    "vrm-humanoid-v1",
  ];
  for (const profile of profiles) {
    const fixture = createExternalModelHierarchyFixture();
    const baseline = inspectExternalModelHierarchyFixture(fixture, profile);
    TestValidator.equals(
      `${profile}: baseline profile`,
      baseline.profile,
      profile,
    );
    TestValidator.equals(
      `${profile}: distinct roots`,
      baseline.counts.nodes,
      2,
    );
    if (profile === "gltf-humanoid-v1" || profile === "vrm-humanoid-v1")
      TestValidator.equals(
        `${profile}: weighted hips`,
        baseline.humanoidBones,
        [{ bone: "hips", node: 1, weighted: true }],
      );
    if (profile === "gltf-motion-v1")
      TestValidator.equals(
        `${profile}: animated node`,
        baseline.motion?.nodeIds,
        ["node_0", "node_1"],
      );

    fixture.document.nodes[1]!.children = [0];
    fixture.document.scenes = [{ nodes: [1] }];
    const parented = inspectExternalModelHierarchyFixture(fixture, profile);
    TestValidator.equals(
      `${profile}: child zero is valid`,
      parented.counts.nodes,
      2,
    );
    if (profile === "gltf-motion-v1")
      TestValidator.equals(
        `${profile}: validated parent map reaches normalization`,
        parented.motion?.nodes.map((node) => node.parent),
        ["node_1", null],
      );

    for (const invalid of [
      {
        children: [[0], undefined],
        message: "nodes[0] belongs to a parent cycle.",
      },
      { children: [[1], [0]], message: "nodes[0] belongs to a parent cycle." },
      {
        children: [[1, 1], undefined],
        message: "nodes[0].children repeats node 1.",
      },
      {
        children: [[2], [2], undefined],
        message: "nodes[2] has multiple parents 0 and 1.",
      },
    ]) {
      const candidate = createExternalModelHierarchyFixture();
      candidate.document.nodes = invalid.children.map((children, index) => ({
        ...candidate.document.nodes[index],
        children,
      }));
      candidate.document.scenes = undefined;
      TestValidator.equals(
        `${profile}: arranged malformed edges`,
        candidate.document.nodes.map((node) => node.children),
        invalid.children,
      );
      TestValidator.predicate(
        `${profile}: ${invalid.message}`,
        throwsError(
          () => inspectExternalModelHierarchyFixture(candidate, profile),
          invalid.message,
        ),
      );
    }

    for (const index of [2, -1, 0.5, Number.MAX_SAFE_INTEGER + 1]) {
      const candidate = createExternalModelHierarchyFixture();
      candidate.document.nodes[0]!.children = [index];
      TestValidator.predicate(
        `${profile}: invalid child index ${index}`,
        throwsError(
          () => inspectExternalModelHierarchyFixture(candidate, profile),
          "nodes[0].children[0] does not resolve inside its declared inventory.",
        ),
      );
    }
  }
};
