import {
  type IPortraitEyeShape,
  createPortraitEyeComponent,
} from "@automovie/human/components/eyes";
import type { IPortraitUpperLidProfile } from "@automovie/human/components/upperLidSection";
import type { IPortraitComponent } from "@automovie/human/geometry/portraitComponents";
import { TestValidator } from "@nestia/e2e";

import {
  portraitEyeShape,
  portraitEyeSockets,
} from "../../subjects/generated-korean-girl-01/configuration";
import { referenceControlNet } from "../../subjects/generated-korean-girl-01/controlNet";
import { throwsError } from "../internal/predicates";

/**
 * The fitted eye owns its upper profile and uses the same shape for its host
 * attachment and internal shared rings. The test stops before unrelated optics.
 *
 * Scenarios:
 * 1. Paired real sockets acquire new upper attachment positions while lower
 *    targets stay unchanged. Supplied profiles reach each component's attach.
 * 2. Mutating the original crease and attachment cannot alter an existing
 *    component's fit or rows; creating a new component does observe that edit.
 * 3. Empty section input refuses at creation, before any host mutation.
 */
export const test_subject_upper_lid_component = (): void => {
  const profile: IPortraitUpperLidProfile = {
    sections: [0, 1].map((at) => ({
      at,
      section: {
        margin: { offset: 0.15, projection: 0.1 },
        tarsal: { offset: 1.5, projection: 0.2 },
        creaseInner: { offset: 3, projection: -0.2 },
        creaseOuter: { offset: 3.7, projection: -0.1 },
        hood: { offset: 4.8, projection: 0.1 },
        preseptal: { offset: 7, projection: 0 },
        attachment: 9,
      },
    })),
  };
  const shape: IPortraitEyeShape = {
    ...portraitEyeShape,
    upperLidProfile: profile,
  };
  const attach = (component: IPortraitComponent) => {
    const plan = component.fit(referenceControlNet);
    const targets = new Map(plan.constraints.map((c) => [c.vertex, c.target]));
    const positions = referenceControlNet.positions.map((p, id) => [
      ...(targets.get(id) ?? p),
    ]);
    const cage = { positions, indices: [] as number[], groups: [] as number[] };
    plan.attach(cage, positions, () => 1);
    return { positions: cage.positions, constraints: plan.constraints };
  };
  for (const socket of portraitEyeSockets) {
    const basic = attach(
      createPortraitEyeComponent(socket, {
        ...shape,
        upperLidProfile: undefined,
      }),
    );
    const component = createPortraitEyeComponent(socket, shape),
      result = attach(component);
    for (const id of socket.bottom)
      TestValidator.equals(
        "lower attachment stays owned",
        result.constraints.find((c) => c.vertex === id),
        basic.constraints.find((c) => c.vertex === id),
      );
    TestValidator.predicate(
      "upper attachment consumes profile",
      socket.top
        .slice(1, -1)
        .some(
          (id) =>
            JSON.stringify(result.constraints.find((c) => c.vertex === id)) !==
            JSON.stringify(basic.constraints.find((c) => c.vertex === id)),
        ),
    );
    profile.sections[0].section.creaseInner.projection = -1;
    profile.sections[0].section.attachment = 10;
    TestValidator.equals(
      "existing component owns complete sections",
      attach(component),
      result,
    );
    TestValidator.predicate(
      "new component observes authored edit",
      JSON.stringify(attach(createPortraitEyeComponent(socket, shape))) !==
        JSON.stringify(result),
    );
    profile.sections[0].section.creaseInner.projection = -0.2;
    profile.sections[0].section.attachment = 9;
  }
  TestValidator.predicate(
    "invalid profile refuses at creation",
    throwsError(
      () =>
        createPortraitEyeComponent(portraitEyeSockets[0], {
          ...shape,
          upperLidProfile: { sections: [] },
        }),
      "Upper-lid detail",
    ),
  );
};
