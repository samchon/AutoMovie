import { forgeProp } from "@automovie/engine";
import { IAutoMoviePropSpec } from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { createSkeleton } from "../internal/fixtures";
import { hasViolation } from "../internal/predicates";
import { createDoorPropSpec } from "./test_film_forge_prop";

const broken = (
  mutate: (spec: IAutoMoviePropSpec) => IAutoMoviePropSpec,
): ReturnType<typeof forgeProp> => forgeProp(mutate(createDoorPropSpec()));

/**
 * ForgeProp's gates report every contract breach with a field-located path for
 * the correction round — and, unlike bindProfile's first-throw, the missing
 * boneMap mappings are reported all at once.
 *
 * Scenarios:
 *
 * 1. An empty prop node id is a `type` violation on `$input.node`.
 * 2. A model id differing from the node breaks the staging join.
 * 3. An imported origin violates the generated-prop contract.
 * 4. A model WITH a skeleton is an actor, not a prop — rejected toward forgeCast.
 * 5. An invalid model (zero-extent part) surfaces validateModel's violation
 *    remapped under `$input.model`.
 * 6. Empty articulation nodes violate.
 * 7. A duplicated joint node id violates at the duplicate's path.
 * 8. An empty joint node id violates.
 * 9. A parent naming an undeclared node violates.
 * 10. A cyclic parent chain violates.
 * 11. A binding targeting a different profile id violates.
 * 12. A boneMap value naming an undeclared node violates; an empty value violates
 *     separately.
 * 13. BOTH unmapped profile keys are listed in one round (pivot and mirror).
 */
export const test_film_forge_prop_gates = (): void => {
  const emptyNode = broken((s) => ({ ...s, node: "  " }));
  TestValidator.predicate(
    "empty node id violates",
    hasViolation(emptyNode, "type", "$input.node"),
  );

  const wrongId = broken((s) => ({
    ...s,
    model: { ...s.model, id: "other" },
  }));
  TestValidator.predicate(
    "model id must equal node",
    hasViolation(wrongId, "type", "$input.model.id"),
  );

  const importedOrigin = broken((s) => ({
    ...s,
    model: { ...s.model, origin: "imported" },
  }));
  TestValidator.predicate(
    "imported origin violates",
    hasViolation(importedOrigin, "type", "$input.model.origin"),
  );

  const withSkeleton = broken((s) => ({
    ...s,
    model: { ...s.model, skeleton: createSkeleton() },
  }));
  TestValidator.predicate(
    "a skeleton makes it an actor, not a prop",
    hasViolation(withSkeleton, "type", "$input.model.skeleton"),
  );

  const badPart = broken((s) => ({
    ...s,
    model: {
      ...s.model,
      parts: s.model.parts.map((p) => ({
        ...p,
        geometry: {
          type: "primitive" as const,
          shape: { type: "box" as const, width: 0, height: 1, depth: 1 },
        },
      })),
    },
  }));
  TestValidator.predicate(
    "validateModel violations remap under $input.model",
    hasViolation(badPart, "range", "$input.model.parts[0]"),
  );

  const noNodes = broken((s) => ({
    ...s,
    articulation: { ...s.articulation!, nodes: [] },
  }));
  TestValidator.predicate(
    "empty articulation nodes violate",
    hasViolation(noNodes, "type", "$input.articulation.nodes"),
  );

  const dupNode = broken((s) => ({
    ...s,
    articulation: {
      ...s.articulation!,
      nodes: [...s.articulation!.nodes, s.articulation!.nodes[1]!],
    },
  }));
  TestValidator.predicate(
    "duplicate joint node id violates",
    hasViolation(dupNode, "type", ".nodes[3].id"),
  );

  const emptyId = broken((s) => ({
    ...s,
    articulation: {
      ...s.articulation!,
      nodes: s.articulation!.nodes.map((n, i) =>
        i === 2 ? { ...n, id: " " } : n,
      ),
      binding: {
        ...s.articulation!.binding,
        boneMap: { pivot: "hinge", mirror: "hinge" },
      },
    },
  }));
  TestValidator.predicate(
    "empty joint node id violates",
    hasViolation(emptyId, "type", ".nodes[2].id"),
  );

  const badParent = broken((s) => ({
    ...s,
    articulation: {
      ...s.articulation!,
      nodes: s.articulation!.nodes.map((n, i) =>
        i === 1 ? { ...n, parent: "ghost" } : n,
      ),
    },
  }));
  TestValidator.predicate(
    "undeclared parent violates",
    hasViolation(badParent, "type", ".nodes[1].parent"),
  );

  const cyclic = broken((s) => ({
    ...s,
    articulation: {
      ...s.articulation!,
      nodes: s.articulation!.nodes.map((n, i) =>
        i === 0 ? { ...n, parent: "hinge" } : n,
      ),
    },
  }));
  TestValidator.predicate(
    "cyclic parent chain violates",
    hasViolation(cyclic, "type", ".parent"),
  );

  const bindingMismatch = broken((s) => ({
    ...s,
    articulation: {
      ...s.articulation!,
      binding: { ...s.articulation!.binding, profile: "other-profile" },
    },
  }));
  TestValidator.predicate(
    "binding profile mismatch violates",
    hasViolation(bindingMismatch, "type", ".binding.profile"),
  );

  const unknownMapped = broken((s) => ({
    ...s,
    articulation: {
      ...s.articulation!,
      binding: {
        ...s.articulation!.binding,
        boneMap: { pivot: "ghost", mirror: "" },
      },
    },
  }));
  TestValidator.predicate(
    "boneMap to an undeclared node violates",
    hasViolation(unknownMapped, "type", 'boneMap["pivot"]'),
  );
  TestValidator.predicate(
    "boneMap to an empty id violates",
    hasViolation(unknownMapped, "type", 'boneMap["mirror"]'),
  );

  const unmapped = broken((s) => ({
    ...s,
    articulation: {
      ...s.articulation!,
      binding: { ...s.articulation!.binding, boneMap: {} },
    },
  }));
  TestValidator.equals(
    "both unmapped profile keys listed at once",
    unmapped.success === false
      ? unmapped.violations.filter((v) =>
          v.expected.includes("does not map it"),
        ).length
      : 0,
    2,
  );
};
