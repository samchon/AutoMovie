import { TestValidator } from "@nestia/e2e";

import { blendPortraitSkin } from "../../subjects/blendPortraitSkin";
import {
  alternatePortraitEye,
  alternatePortraitNose,
  portraitComponentsFor,
  portraitEyeShape,
  portraitNoseShape,
} from "../../subjects/generated-korean-girl-01/configuration";
import { referenceControlNet } from "../../subjects/generated-korean-girl-01/controlNet";
import { buildPortraitHead } from "../../subjects/generated-korean-girl-01/head";

/**
 * Replace one eye and the nose through the same host protocol. The unchanged eye
 * stays pinned, neighbouring skin adapts, and the assembled skin retains exactly
 * its intended two eye openings, mouth opening and lower neck crop.
 *
 * Scenarios:
 * 1. Fit baseline and changed left-eye/nose attachments on the same host.
 *    Both variants retain their exact component constraints before refinement.
 * 2. The right eye stays unchanged, skin adjacent to the edited parts changes,
 *    and the distant chin remains fixed. Replacement keeps the original cut IDs.
 * 3. The assembled replacement cage has two oppositely wound incident faces on each internal
 *    edge and exactly four closed boundary loops, with no new seam openings.
 */
export const test_subject_component_replacement = (): void => {
  const sampling = { eyeColumns: 12, eyeRows: 6, irisColumns: 16, irisRows: 4 };
  const eye = { ...portraitEyeShape, browFibres: 6, upperLashes: 3, sampling };
  const alternate = {
    ...alternatePortraitEye,
    browFibres: 6,
    upperLashes: 3,
    sampling,
  };
  const host = {
    positions: referenceControlNet.positions,
    indices: referenceControlNet.indices,
    viewRay: referenceControlNet.viewRay,
  };
  const baselineParts = portraitComponentsFor(eye, eye, portraitNoseShape);
  const replacementParts = portraitComponentsFor(
    eye,
    alternate,
    alternatePortraitNose,
  );
  const basePlans = baselineParts.map((part) => part.fit(host));
  const replacementPlans = replacementParts.map((part) => part.fit(host));
  TestValidator.equals(
    "stable cut identities",
    replacementPlans.map((plan) => plan.cutFaces),
    basePlans.map((plan) => plan.cutFaces),
  );
  const baseline = {
    source: blendPortraitSkin(
      host.positions,
      host.indices,
      basePlans.flatMap((plan) => plan.constraints),
    ),
  };
  const replacement = {
    source: blendPortraitSkin(
      host.positions,
      host.indices,
      replacementPlans.flatMap((plan) => plan.constraints),
    ),
  };
  for (const constraint of replacementPlans.flatMap((plan) => plan.constraints))
    TestValidator.equals(
      "replacement owns its exact seam",
      replacement.source[constraint.vertex],
      constraint.target,
    );
  for (const constraint of basePlans[0].constraints)
    TestValidator.equals(
      "other eye is independently retained",
      replacement.source[constraint.vertex],
      baseline.source[constraint.vertex],
    );
  const pinned = new Set(
    replacementPlans.flatMap((plan) =>
      plan.constraints.map((constraint) => constraint.vertex),
    ),
  );
  TestValidator.predicate(
    "surrounding skin follows the new parts",
    replacement.source.some(
      (point, id) =>
        !pinned.has(id) &&
        point.some(
          (value, axis) => Math.abs(value - baseline.source[id][axis]) > 0.001,
        ),
    ),
  );
  TestValidator.equals(
    "distant chin is retained",
    replacement.source[152],
    host.positions[152],
  );
  // Inspect the assembled cage's exact seam topology. Loop refinement has its
  // own adjacency/label scenarios and does not create these component joins.
  const head = buildPortraitHead(host, replacementParts, 0);
  {
    const edges = new Map<
      string,
      { a: number; b: number; count: number; direction: number }
    >();
    for (let i = 0; i < head.refined.indices.length; i += 3)
      for (let j = 0; j < 3; j++) {
        const a = head.refined.indices[i + j],
          b = head.refined.indices[i + ((j + 1) % 3)];
        const key = Math.min(a, b) + "/" + Math.max(a, b);
        const edge = edges.get(key) ?? { a, b, count: 0, direction: 0 };
        edge.count++;
        edge.direction += a < b ? 1 : -1;
        edges.set(key, edge);
      }
    TestValidator.predicate(
      "no nonmanifold or inverted seam",
      [...edges.values()].every(
        (edge) =>
          edge.count === 1 || (edge.count === 2 && edge.direction === 0),
      ),
    );
    const boundary = new Map<number, number[]>();
    for (const edge of edges.values())
      if (edge.count === 1) {
        boundary.set(edge.a, [...(boundary.get(edge.a) ?? []), edge.b]);
        boundary.set(edge.b, [...(boundary.get(edge.b) ?? []), edge.a]);
      }
    TestValidator.predicate(
      "every border is a closed loop",
      [...boundary.values()].every((neighbours) => neighbours.length === 2),
    );
    const seen = new Set<number>();
    let loops = 0;
    for (const seed of boundary.keys()) {
      if (seen.has(seed)) continue;
      loops++;
      const pending = [seed];
      while (pending.length !== 0) {
        const at = pending.pop()!;
        if (seen.has(at)) continue;
        seen.add(at);
        pending.push(...boundary.get(at)!);
      }
    }
    TestValidator.equals("only anatomical openings and crop remain", loops, 4);
  }
};
