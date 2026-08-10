import {
  softBodyBudget,
  softBodyTravelNumber,
  validateSoftBodyDomain,
} from "@automovie/engine";
import { TestValidator } from "@nestia/e2e";

import { hasViolation, namedFacts, nclose } from "../internal/predicates";
import { softPanel } from "../internal/softFixtures";

/**
 * The cost of a panel and its stability condition are derived from the record
 * alone, before a single step is integrated.
 *
 * A production must be refusable for an unaffordable curtain without solving
 * it, and the travel condition must be answerable the same way. Every count is
 * a hand computation over the lattice:
 *
 * ```text
 *   structural = (C − 1)·R + C·(R − 1)
 *   shear      = 2·(C − 1)·(R − 1)
 *   bend       = (C − 2)·R + C·(R − 2)
 *   travel     = dt · referenceSpeed / shortestRestLength
 * ```
 *
 * For the 5×4 panel below: `4·4 + 5·3 = 31` structural, `2·4·3 = 24` shear,
 * `3·4 + 5·2 = 22` bend, and `travel = (1/64)·4/0.25 = 0.25`.
 *
 * Scenarios:
 *
 * 1. Every count, the state size and the worst-case gather total match the hand
 *    computation for a 5×4 panel.
 * 2. The travel number is the documented ratio, and the validator accepts a panel
 *    that honours it.
 * 3. A lattice thinner than the second-neighbour reach carries no bend constraint
 *    and no shear constraint at all, rather than a negative count.
 * 4. Quadrupling the step past the shortest constraint pushes the travel number
 *    above one, and the validator refuses it by name with the overshoot
 *    measured rather than merely reported as "unstable".
 * 5. A single-particle lattice has no constraint to cross, so its travel number is
 *    exactly `0`; the same lattice is refused for holding no constraint at all,
 *    which is why that number is a boundary and not a licence.
 * 6. A lattice declaring a billion columns is measured and refused without ever
 *    being walked. The shortest rest edge is read over the declared lattice, so
 *    a record the validator exists to refuse could otherwise cost a billion
 *    iterations inside the validator itself — and inside every budget report
 *    anybody asked for on the way there.
 */
export const test_soft_body_budget_report = (): void => {
  const domain = softPanel({ columns: 5, rows: 4, overrides: { id: "drape" } });
  const budget = softBodyBudget(domain);
  TestValidator.equals(
    "every cost is the hand computation over the lattice",
    {
      domain: budget.domain,
      particles: budget.particles,
      structural: budget.structural,
      shear: budget.shear,
      bend: budget.bend,
      colliders: budget.colliders,
      stateBytes: budget.stateBytes,
      maxSteps: budget.maxSteps,
      worstCaseGathers: budget.worstCaseGathers,
    },
    {
      domain: "drape",
      particles: 20,
      structural: 31,
      shear: 24,
      bend: 22,
      colliders: 0,
      stateBytes: 960,
      maxSteps: 1_000,
      worstCaseGathers: 2 * (31 + 24 + 22) * 2 * 1_000,
    },
  );

  TestValidator.equals(
    "the travel number is the documented ratio and the panel is accepted",
    namedFacts([
      ["travel", () => Object.is(budget.travel, 0.25)],
      ["function", () => Object.is(softBodyTravelNumber(domain), 0.25)],
      ["accepted", () => validateSoftBodyDomain({ domain }).success === true],
    ]),
    { travel: true, function: true, accepted: true },
  );

  const strip = softBodyBudget(
    softPanel({ columns: 2, rows: 1, overrides: { id: "strip" } }),
  );
  TestValidator.equals(
    "a lattice thinner than the reach carries no bend and no shear",
    {
      particles: strip.particles,
      structural: strip.structural,
      shear: strip.shear,
      bend: strip.bend,
    },
    { particles: 2, structural: 1, shear: 0, bend: 0 },
  );

  const hasty = softPanel({
    columns: 5,
    rows: 4,
    overrides: {
      id: "hasty",
      solver: {
        fixedStepSeconds: 0.25,
        gravity: { x: 0, y: -8, z: 0 },
        drag: 0,
        iterations: 2,
        stiffness: { structural: 1, shear: 0.5, bend: 0.25 },
        referenceSpeed: 4,
        maxSteps: 100,
      },
    },
  });
  TestValidator.equals(
    "a step that could cross a constraint is refused by name",
    namedFacts([
      ["travel", () => nclose(softBodyTravelNumber(hasty), 4)],
      [
        "refused",
        () =>
          hasViolation(
            validateSoftBodyDomain({ domain: hasty }),
            "range",
            "solver.fixedStepSeconds",
          ),
      ],
      [
        "overshoot",
        () => {
          const validation = validateSoftBodyDomain({ domain: hasty });
          return (
            validation.success === false &&
            validation.violations.some((item) => nclose(item.overshoot ?? 0, 3))
          );
        },
      ],
    ]),
    { travel: true, refused: true, overshoot: true },
  );

  const absurd = softPanel({
    columns: 2,
    rows: 2,
    overrides: { id: "absurd", lattice: { columns: 1e9, rows: 1e9 } },
  });
  TestValidator.equals(
    "a lattice nobody could walk is measured without walking it",
    namedFacts([
      ["travel", () => Object.is(softBodyTravelNumber(absurd), 0)],
      ["budget", () => Object.is(softBodyBudget(absurd).travel, 0)],
      [
        "refused",
        () =>
          hasViolation(
            validateSoftBodyDomain({ domain: absurd }),
            "range",
            "$input.lattice",
          ),
      ],
      [
        "lengthNamed",
        () =>
          hasViolation(
            validateSoftBodyDomain({ domain: absurd }),
            "type",
            "$input.rest",
          ),
      ],
    ]),
    { travel: true, budget: true, refused: true, lengthNamed: true },
  );

  const lone = softPanel({ columns: 1, rows: 1, overrides: { id: "lone" } });
  TestValidator.equals(
    "a single particle has no constraint to cross, and is refused for it",
    namedFacts([
      ["travel", () => Object.is(softBodyTravelNumber(lone), 0)],
      ["structural", () => softBodyBudget(lone).structural === 0],
      [
        "refused",
        () =>
          hasViolation(
            validateSoftBodyDomain({ domain: lone }),
            "range",
            "lattice",
          ),
      ],
    ]),
    { travel: true, structural: true, refused: true },
  );
};
