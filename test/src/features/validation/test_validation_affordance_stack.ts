import {
  affordanceSupportContacts,
  detectSupportToppling,
  resolveAffordanceSeat,
} from "@automovie/engine";
import {
  IAutoMovieAffordance,
  IAutoMovieTransform,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { vclose } from "../internal/predicates";

const IDENTITY = { x: 0, y: 0, z: 0, w: 1 };
const UNIT = { x: 1, y: 1, z: 1 };

/**
 * Stacking is judgeable end-to-end from authored affordances alone: crate A
 * declares a stack-top, `resolveAffordanceSeat` seats crate B's base socket on
 * it, `affordanceSupportContacts` supplies the support face to
 * `detectSupportToppling` (#601), and physics answers — stable inside the face,
 * toppling when the center of mass overhangs it.
 *
 * Scenarios:
 *
 * 1. Crate B (1 m cube, base socket at its bottom face) seated on crate A's top at
 *    world (3, 0, 2): B's root lands at (3, 1, 2) — hand oracle — and its
 *    centered COM projects inside the top's contacts → no warning, no
 *    toppling.
 * 2. The same stack with B's COM shifted 0.7 m along +X (0.2 m past the face edge)
 *    → a physics `warning` with a toppling suggestion falling toward +X.
 */
export const test_validation_affordance_stack = (): void => {
  const top: IAutoMovieAffordance = {
    id: "top",
    kind: "stack-top",
    frame: {
      translation: { x: 0, y: 0.5, z: 0 },
      rotation: IDENTITY,
      scale: UNIT,
    },
    extent: [
      { x: -0.5, y: 0, z: -0.5 },
      { x: 0.5, y: 0, z: -0.5 },
      { x: 0.5, y: 0, z: 0.5 },
      { x: -0.5, y: 0, z: 0.5 },
    ],
  };
  const base: IAutoMovieAffordance = {
    id: "base",
    kind: "socket",
    frame: {
      translation: { x: 0, y: -0.5, z: 0 },
      rotation: IDENTITY,
      scale: UNIT,
    },
    extent: null,
  };
  const crateA: IAutoMovieTransform = {
    translation: { x: 3, y: 0, z: 2 },
    rotation: IDENTITY,
    scale: UNIT,
  };

  const seat = resolveAffordanceSeat({
    parentWorld: crateA,
    parentAffordance: top,
    childAffordance: base,
  });
  TestValidator.predicate(
    "crate B seats one half-height above the top",
    vclose(seat.translation, { x: 3, y: 1, z: 2 }),
  );

  const support = affordanceSupportContacts({
    affordance: top,
    parentWorld: crateA,
  });
  const stable = detectSupportToppling({
    node: "crateB",
    centerOfMass: seat.translation,
    support,
  });
  TestValidator.equals(
    "centered stack is stable",
    stable.validation.success,
    true,
  );
  TestValidator.equals(
    "no warning for a stable stack",
    stable.validation.success === true
      ? (stable.validation.warnings?.length ?? 0)
      : -1,
    0,
  );
  TestValidator.equals("no toppling suggested", stable.toppling, null);

  const overhung = detectSupportToppling({
    node: "crateB",
    centerOfMass: { x: 3.7, y: 1, z: 2 },
    support,
  });
  TestValidator.equals(
    "overhung stack still succeeds (warning-only)",
    overhung.validation.success,
    true,
  );
  TestValidator.equals(
    "overhang raises one physics warning",
    overhung.validation.success === true
      ? (overhung.validation.warnings?.length ?? 0)
      : -1,
    1,
  );
  TestValidator.predicate(
    "toppling falls toward the overhang (+X)",
    overhung.toppling !== null &&
      vclose(overhung.toppling.fallDirection, { x: 1, y: 0, z: 0 }),
  );
};
