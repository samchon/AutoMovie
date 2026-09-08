import { TestValidator } from "@nestia/e2e";

import {
  portraitNasalSection,
  portraitNoseShape,
  portraitNoseSocket,
} from "../../subjects/generated-korean-girl-01/configuration";
import { createPortraitNoseComponent } from "../../subjects/generated-korean-girl-01/nose";
import { nclose, throwsError } from "../internal/predicates";

/**
 * The nose component applies common projection scaling before rim/body fitting.
 * A hand planar socket makes the target effect and unchanged attachments exact.
 *
 * Scenarios:
 * 1. A half-depth point at (2,2,5) above z=y/2 targets (2,2,3); support stays
 *    fixed. Omitted/one paths agree without requiring support identities.
 * 2. Copied binding input remains owned; missing/nonresident support refuses.
 *    Another complete section/body basis cannot be silently stacked with scale.
 */
export const test_subject_nasal_support_component = (): void => {
  const host = {
    positions: [
      [0, 0, 0],
      [10, 0, 0],
      [0, 10, 5],
      [2, 2, 5],
    ],
    indices: [],
    viewRay: [0, 0, 1],
  };
  const socket = {
    ...portraitNoseSocket,
    surface: [0, 1, 2, 3],
    nostrils: [],
    supportPlane: [0, 1, 2],
  };
  const shape = {
    ...portraitNoseShape,
    depthScale: 0.5,
    section: undefined,
    body: undefined,
  };
  const component = createPortraitNoseComponent(socket, shape),
    plan = component.fit(host);
  TestValidator.equals(
    "support constraints fixed",
    plan.constraints.slice(0, 3).map((c) => c.target),
    host.positions.slice(0, 3),
  );
  TestValidator.predicate(
    "depth scale reaches component target",
    nclose(plan.constraints[3].target[2], 3),
  );
  socket.supportPlane[0] = 3;
  TestValidator.equals(
    "component owns plane binding",
    component.fit(host).constraints,
    plan.constraints,
  );
  const omission = createPortraitNoseComponent(
    { ...socket, supportPlane: undefined },
    { ...shape, depthScale: undefined },
  ).fit(host);
  TestValidator.equals(
    "explicit one identity",
    createPortraitNoseComponent(
      { ...socket, supportPlane: undefined },
      { ...shape, depthScale: 1 },
    ).fit(host).constraints,
    omission.constraints,
  );
  for (const ids of [undefined, [], [-1, 1, 2], [0.5, 1, 2], [20, 1, 2]])
    TestValidator.predicate(
      "required binding refused",
      throwsError(() =>
        createPortraitNoseComponent(
          { ...socket, supportPlane: ids },
          shape,
        ).fit(host),
      ),
    );
  for (const depthScale of [0, -1, NaN, Infinity])
    TestValidator.predicate(
      "scale refused",
      throwsError(() =>
        createPortraitNoseComponent(socket, { ...shape, depthScale }),
      ),
    );
  TestValidator.predicate(
    "section basis conflict",
    throwsError(() =>
      createPortraitNoseComponent(socket, {
        ...shape,
        section: portraitNasalSection,
      }),
    ),
  );
  TestValidator.predicate(
    "body basis conflict",
    throwsError(() =>
      createPortraitNoseComponent(socket, {
        ...shape,
        body: {
          shape: { section: portraitNasalSection },
          joinWidth: 2,
          depthReach: 10,
        },
      }),
    ),
  );
  createPortraitNoseComponent(socket, {
    ...shape,
    depthScale: 1,
    section: portraitNasalSection,
  });
};
