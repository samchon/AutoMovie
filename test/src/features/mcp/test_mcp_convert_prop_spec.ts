import {
  IAutoMovieMcpPropSpec,
  IAutoMovieMcpTransform,
  toEnginePropSpec,
  toEngineTransform,
} from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";

import { namedFacts, nclose } from "../internal/predicates";

const driven = (overrides: Record<string, unknown>): unknown => ({
  id: "lid",
  type: "driven",
  source: "hinge",
  target: "lid.rotation.x",
  ...overrides,
});

const spec = (articulation: unknown): IAutoMovieMcpPropSpec =>
  ({
    node: "chest",
    model: "chest",
    articulation,
  }) as unknown as IAutoMovieMcpPropSpec;

/**
 * Lowering an MCP prop spec and transform onto their engine forms.
 *
 * These two conversions are the boundary between what a host may write over MCP
 * and what the engine consumes, and each carries a rule that only shows up in
 * its negative form: a driven driver must not carry a dead range, and a
 * transform with no rotation must arrive as the identity rather than as
 * `undefined` reaching the sampler. Both were exercised only along the path
 * where every field happened to be present.
 *
 * Scenarios:
 *
 * 1. A prop with no articulation lowers to a null articulation.
 * 2. A driven driver carrying both named ranges lowers them to engine tuples.
 * 3. A curve-driven driver carrying neither range lowers WITHOUT either key, so it
 *    cannot carry a dead range (#724).
 * 4. A driver that is not driven passes through untouched, ranges and all.
 * 5. A transform lowers an absent, a null, and a present rotation: the first two
 *    become the identity quaternion, the third the rotation it names.
 */
export const test_mcp_convert_prop_spec = (): void => {
  const profile = (drivers: unknown[]): unknown => ({
    id: "chest",
    name: "Chest",
    controls: [],
    drivers,
    limits: [],
  });
  const lowered = (drivers: unknown[]): Record<string, unknown> =>
    toEnginePropSpec(
      spec({ nodes: ["lid"], profile: profile(drivers), binding: null }),
    ).articulation!.profile.drivers[0] as unknown as Record<string, unknown>;

  TestValidator.equals(
    "a prop spec lowers onto its engine form without inventing fields",
    namedFacts([
      [
        "absentArticulation",
        () => toEnginePropSpec(spec(null)).articulation === null,
      ],
      [
        "bothRangesBecomeTuples",
        () => {
          const driver = lowered([
            driven({
              inRange: { from: 0, to: 1 },
              outRange: { from: -90, to: 90 },
            }),
          ]);
          return (
            JSON.stringify(driver.inRange) === "[0,1]" &&
            JSON.stringify(driver.outRange) === "[-90,90]"
          );
        },
      ],
      [
        "absentRangesStayAbsent",
        () => {
          const driver = lowered([driven({ curve: [] })]);
          return (
            "inRange" in driver === false && "outRange" in driver === false
          );
        },
      ],
      [
        "oneRangeLowersAlone",
        () => {
          const driver = lowered([driven({ inRange: { from: 2, to: 3 } })]);
          return (
            JSON.stringify(driver.inRange) === "[2,3]" &&
            "outRange" in driver === false
          );
        },
      ],
      [
        "aNonDrivenDriverPassesThrough",
        () => {
          const source = { id: "spin", type: "expression", value: "t" };
          return JSON.stringify(lowered([source])) === JSON.stringify(source);
        },
      ],
    ]),
    {
      absentArticulation: true,
      bothRangesBecomeTuples: true,
      absentRangesStayAbsent: true,
      oneRangeLowersAlone: true,
      aNonDrivenDriverPassesThrough: true,
    },
  );

  const transform = (rotation: unknown): IAutoMovieMcpTransform =>
    ({
      translation: { x: 1, y: 2, z: 3 },
      rotation,
      scale: { x: 1, y: 1, z: 1 },
    }) as unknown as IAutoMovieMcpTransform;
  TestValidator.equals(
    "a transform with no rotation lowers to the identity, never to undefined",
    namedFacts([
      [
        "absentRotationIsIdentity",
        () => {
          const lowered = toEngineTransform(transform(undefined)).rotation;
          return (
            nclose(lowered.x, 0) &&
            nclose(lowered.y, 0) &&
            nclose(lowered.z, 0) &&
            nclose(lowered.w, 1)
          );
        },
      ],
      [
        "nullRotationIsIdentity",
        () => {
          const lowered = toEngineTransform(transform(null)).rotation;
          return nclose(lowered.w, 1) && nclose(lowered.x, 0);
        },
      ],
      [
        "namedRotationIsLowered",
        () => {
          // `fromAxisAngle` takes degrees, and `fromEuler` requires the order
          // the host chose: a half-turn about Y is 180 with an explicit order.
          const lowered = toEngineTransform(
            transform({ x: 0, y: 180, z: 0, order: "XYZ" }),
          ).rotation;
          return nclose(Math.abs(lowered.y), 1) && nclose(lowered.w, 0);
        },
      ],
    ]),
    {
      absentRotationIsIdentity: true,
      nullRotationIsIdentity: true,
      namedRotationIsLowered: true,
    },
  );
};
