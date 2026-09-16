import { createPortraitEyeComponent } from "@automovie/human/components/eyes";
import type { IPortraitComponent } from "@automovie/human/geometry/portraitComponents";
import { TestValidator } from "@nestia/e2e";

import {
  portraitEyeShape,
  portraitEyeSockets,
} from "../../subjects/generated-korean-girl-01/configuration";
import { referenceControlNet } from "../../subjects/generated-korean-girl-01/controlNet";
import { nclose } from "../internal/predicates";
import { upperLidFoldFixture } from "../internal/upperLidFoldFixture";

/**
 * The real eye component consumes closure-dependent folds on the shared cage.
 * This isolates fitting and ring attachment from unrelated optical tessellation.
 *
 * Scenarios:
 * 1. Fully closed folded profiles produce the same rows as their explicitly
 *    authored unfolded target under the same aperture performance, on both sides.
 * 2. The observed fold differs from its unfolded target while their shared
 *    attachment constraints remain exact. Caller mutation cannot alter it.
 */
export const test_subject_upper_lid_fold_component = (): void => {
  const attach = (component: IPortraitComponent) => {
    const plan = component.fit(referenceControlNet),
      targets = new Map(plan.constraints.map((c) => [c.vertex, c.target])),
      positions = referenceControlNet.positions.map((p, id) => [
        ...(targets.get(id) ?? p),
      ]),
      cage = { positions, indices: [] as number[], groups: [] as number[] };
    plan.attach(cage, positions, () => 1);
    return { cage, constraints: plan.constraints };
  };
  for (const socket of portraitEyeSockets) {
    const profile = upperLidFoldFixture(),
      shape = { ...portraitEyeShape, upperLidProfile: profile },
      performance = { blink: 1, observedBlink: 0, yaw: 0, pitch: 0 },
      folded = attach(createPortraitEyeComponent(socket, shape, performance)),
      target = attach(
        createPortraitEyeComponent(
          socket,
          { ...shape, upperLidProfile: { sections: profile.closedSections! } },
          performance,
        ),
      );
    TestValidator.equals(
      "closed ring topology",
      folded.cage.indices,
      target.cage.indices,
    );
    TestValidator.predicate(
      "closed rows reach authored target",
      folded.cage.positions.every((p, i) =>
        p.every((v, axis) => nclose(v, target.cage.positions[i][axis])),
      ),
    );
    const component = createPortraitEyeComponent(socket, shape),
      observed = attach(component),
      unfolded = attach(
        createPortraitEyeComponent(socket, {
          ...shape,
          upperLidProfile: { sections: profile.closedSections! },
        }),
      );
    TestValidator.equals(
      "fold does not move outer seam",
      observed.constraints,
      unfolded.constraints,
    );
    TestValidator.predicate(
      "actual attached fold changes skin",
      observed.cage.positions.some((p, i) =>
        p.some((v, axis) => !nclose(v, unfolded.cage.positions[i][axis])),
      ),
    );
    profile.sections[0].section.hood.projection = 10;
    profile.closedSections![1].section.hood.offset = 100;
    TestValidator.equals(
      "component owns both section populations",
      attach(component),
      observed,
    );
  }
};
