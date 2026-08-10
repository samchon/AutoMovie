import { stageScene } from "@automovie/engine";
import { IAutoMovieStageLight } from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { makeScriptWrite, makeStagingWrite } from "../internal/filmFixtures";
import { hasViolation, namedFacts, qclose } from "../internal/predicates";

/** A staged window panel; `width`/`height` ride the placement as authored. */
const WINDOW = {
  node: "north-window",
  role: "fill",
  type: "area",
  direction: { x: -1, y: 0, z: 0 },
  position: { x: 4, y: 2.2, z: 0 },
  intensity: 12,
  width: 2.4,
  height: 1.8,
} as unknown as IAutoMovieStageLight;

const stagedWith = (light: unknown) =>
  stageScene(makeScriptWrite(), {
    ...makeStagingWrite(),
    lights: [light as IAutoMovieStageLight],
  });

const refusedAt = (
  patch: Record<string, unknown>,
  kind: "type" | "range",
  path: string,
): boolean => hasViolation(stagedWith({ ...WINDOW, ...patch }), kind, path);

/**
 * A rectangular area light is staged with the exact parameters it can act on.
 *
 * Scenarios:
 *
 * 1. A complete panel lowers to an `area` scene light keeping its extent, its aim
 *    as a rotation of local −Z, and its position.
 * 2. Extent is required exactly on an area light and refused on every other kind,
 *    and each axis is held to a finite value greater than zero.
 * 3. The parameters a panel cannot act on are refused rather than dropped: a
 *    distance `range`, a spot `coneAngle`, and a shadow map `three.js` never
 *    renders for an analytically integrated source.
 */
export const test_film_stage_area_light = (): void => {
  const staged = stagedWith(WINDOW);
  const light = staged.success === true ? staged.scene.lights[0] : undefined;
  TestValidator.equals(
    "a complete panel lowers whole",
    namedFacts([
      ["staged", () => staged.success === true],
      ["kind", () => light?.type === "area"],
      [
        "extent",
        () =>
          light?.type === "area" && light.width === 2.4 && light.height === 1.8,
      ],
      [
        "aim",
        () =>
          light !== undefined &&
          qclose(light.transform.rotation, {
            x: 0,
            y: Math.SQRT1_2,
            z: 0,
            w: Math.SQRT1_2,
          }),
      ],
      [
        "position",
        () =>
          light?.transform.translation.x === 4 &&
          light.transform.translation.y === 2.2,
      ],
      ["noRange", () => light !== undefined && !("range" in light)],
    ]),
    {
      staged: true,
      kind: true,
      extent: true,
      aim: true,
      position: true,
      noRange: true,
    },
  );

  TestValidator.equals(
    "extent belongs to the panel alone and is held to a real size",
    namedFacts([
      [
        "missingWidth",
        () => refusedAt({ width: undefined }, "type", "$input.lights[0].width"),
      ],
      [
        "missingHeight",
        () =>
          refusedAt({ height: undefined }, "type", "$input.lights[0].height"),
      ],
      ["zeroWidth", () => refusedAt({ width: 0 }, "range", ".width")],
      [
        "infiniteHeight",
        () => refusedAt({ height: Infinity }, "range", ".height"),
      ],
      [
        "nonNumericWidth",
        () => refusedAt({ width: "wide" }, "range", ".width"),
      ],
      [
        "extentOnSpot",
        () =>
          hasViolation(
            stagedWith({
              node: "key",
              type: "spot",
              direction: { x: 0, y: -1, z: 0 },
              position: { x: 0, y: 3, z: 0 },
              intensity: 5,
              width: 1,
            }),
            "type",
            "$input.lights[0].width",
          ),
      ],
      [
        "extentOnDirectional",
        () =>
          hasViolation(
            stagedWith({
              node: "sun",
              direction: { x: -1, y: -1, z: 0 },
              intensity: 1,
              height: 2,
            }),
            "type",
            "$input.lights[0].height",
          ),
      ],
    ]),
    {
      missingWidth: true,
      missingHeight: true,
      zeroWidth: true,
      infiniteHeight: true,
      nonNumericWidth: true,
      extentOnSpot: true,
      extentOnDirectional: true,
    },
  );

  TestValidator.equals(
    "a panel refuses every parameter it could not act on",
    namedFacts([
      [
        "range",
        () => refusedAt({ range: 8 }, "type", "$input.lights[0].range"),
      ],
      [
        "coneAngle",
        () =>
          refusedAt({ coneAngle: 30 }, "type", "$input.lights[0].coneAngle"),
      ],
      [
        "castShadow",
        () =>
          refusedAt(
            {
              castShadow: true,
              shadow: {
                mapSize: 512,
                bias: 0,
                normalBias: 0,
                near: 0.1,
                far: 50,
              },
            },
            "type",
            "$input.lights[0].castShadow",
          ),
      ],
      [
        "castShadowIsNotAskedForSettings",
        () =>
          hasViolation(
            stagedWith({ ...WINDOW, castShadow: true }),
            "type",
            "$input.lights[0].castShadow",
          ) &&
          !hasViolation(
            stagedWith({ ...WINDOW, castShadow: true }),
            "type",
            "$input.lights[0].shadow",
          ),
      ],
      [
        "punctualShadowStillRequired",
        () =>
          hasViolation(
            stagedWith({
              node: "key",
              type: "spot",
              direction: { x: 0, y: -1, z: 0 },
              position: { x: 0, y: 3, z: 0 },
              intensity: 5,
              castShadow: true,
            }),
            "type",
            "$input.lights[0].shadow",
          ),
      ],
    ]),
    {
      range: true,
      coneAngle: true,
      castShadow: true,
      castShadowIsNotAskedForSettings: true,
      punctualShadowStillRequired: true,
    },
  );
};
