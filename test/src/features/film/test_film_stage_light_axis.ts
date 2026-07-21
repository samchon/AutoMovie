import { stageScene } from "@automovie/engine";
import {
  IAutoMovieLight,
  IAutoMovieStagingApplication,
  IAutoMovieValidation,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { makeScriptWrite, makeStagingWrite } from "../internal/filmFixtures";
import { hasViolation, qclose, vclose } from "../internal/predicates";

const script = makeScriptWrite();

/** Stage the duel with `lights` replaced, everything else untouched. */
const stageLights = (lights: IAutoMovieStagingApplication.ILightPlacement[]) =>
  stageScene(script, makeStagingWrite({ lights }));

/** The staged scene's lights, or `[]` when staging refused. */
const lightsOf = (staged: ReturnType<typeof stageScene>): IAutoMovieLight[] =>
  staged.success ? staged.scene.lights : [];

/** Staging violations as a validation envelope, for `hasViolation`. */
const failure = (
  staged: ReturnType<typeof stageScene>,
): IAutoMovieValidation =>
  staged.success
    ? { success: true }
    : { success: false, violations: staged.violations };

const WARM = { r: 1, g: 0.72, b: 0.36, a: null, hex: null };

/**
 * `stage` must be able to author every light the scene type can hold (#1341).
 *
 * It used to accept `{node, role, direction, intensity}` and lower every entry
 * to a white directional light, so a candle, a sunset, a neon sign, and a
 * window shaft were the same frame; an author who wanted a warm lamp had to
 * hand-patch `scene.lights` between `stage` and `commitScene`, losing the
 * referential integrity `stage` exists to provide. `role` was the other half:
 * required, five-valued, and read nowhere.
 *
 * The placement now spans the same three kinds `IAutoMovieLight` models, and
 * each kind's parameter set is exact rather than advisory. A parameter the
 * chosen kind cannot use is refused rather than dropped, which is the same
 * false-green rule the pointer-channel gate applies.
 *
 * Scenarios:
 *
 * 1. Compatibility: the pre-existing `{node, role, direction, intensity}` shape
 *    still stages, and still lowers to exactly the white directional light at
 *    the origin it lowered to before, so no committed scene changes meaning.
 * 2. `role` is no longer required: dropping it stages identically, byte for byte,
 *    which is what "the lowering does not read it" means operationally.
 * 3. A warm point light lowers to `type: "point"` at its `position`, in its color,
 *    with its `range`; a spot lowers with `range` AND `coneAngle`, aimed by
 *    `direction`.
 * 4. Defaults: an omitted `type` is directional, an omitted `color` is neutral
 *    white with `a: null` (the light-slot convention), an omitted `range` is
 *    `0` (infinite), an omitted `coneAngle` is `45`.
 * 5. Negative twins per kind, each one property away from a staging that works: a
 *    directional light with a `position`, a point light with a `direction`, a
 *    point light with a `coneAngle`, a directional light with a `range`. Each
 *    is refused at its own field rather than ignored.
 * 6. Missing required-per-kind parameters: a directional or spot light with no
 *    `direction`, and a point or spot light with no `position`.
 * 7. Boundaries: `intensity: 0` stages (a light that is off is a legitimate
 *    light); a zero-length `direction` is still refused; `coneAngle` at both
 *    ends of `(0, 90]`, just past each end, and non-finite; `range: 0` means
 *    infinite while a negative range is refused; a non-finite `position` is a
 *    range fault rather than a missing-parameter one; a color component outside
 *    `[0, 1]` is refused.
 */
export const test_film_stage_light_axis = (): void => {
  // 1. COMPATIBILITY: the legacy four-field shape is unchanged
  const legacy = stageLights([
    {
      node: "sun",
      role: "sun",
      direction: { x: -1, y: -1, z: 0 },
      intensity: 1,
    },
  ]);
  const legacyLight = lightsOf(legacy)[0];
  TestValidator.equals("the legacy shape still stages", legacy.success, true);
  TestValidator.equals(
    "and still lowers to a directional light",
    legacyLight?.type,
    "directional",
  );
  TestValidator.predicate(
    "at the origin, in neutral white, as before",
    legacyLight !== undefined &&
      vclose(legacyLight.transform.translation, { x: 0, y: 0, z: 0 }) &&
      legacyLight.color.r === 1 &&
      legacyLight.color.g === 1 &&
      legacyLight.color.b === 1 &&
      legacyLight.color.a === null &&
      legacyLight.intensity === 1,
  );

  // 2. `role` is annotation: removing it changes nothing
  const roleless = lightsOf(
    stageLights([
      { node: "sun", direction: { x: -1, y: -1, z: 0 }, intensity: 1 },
    ]),
  )[0];
  TestValidator.equals(
    "dropping role lowers to the identical light",
    roleless,
    legacyLight,
  );

  // 3. the axis the scene type always had
  const point = lightsOf(
    stageLights([
      {
        node: "flame",
        type: "point",
        position: { x: 0.2, y: 0.9, z: 0.35 },
        color: WARM,
        intensity: 1.4,
        range: 3,
      },
    ]),
  )[0];
  TestValidator.predicate(
    "a warm point light lowers with its place, color, and range",
    point !== undefined &&
      point.type === "point" &&
      point.range === 3 &&
      point.intensity === 1.4 &&
      vclose(point.transform.translation, { x: 0.2, y: 0.9, z: 0.35 }) &&
      point.color.r === WARM.r &&
      point.color.g === WARM.g &&
      point.color.b === WARM.b &&
      // a point light radiates every way, so it takes no turn
      qclose(point.transform.rotation, { x: 0, y: 0, z: 0, w: 1 }),
  );
  const spot = lightsOf(
    stageLights([
      {
        node: "practical",
        type: "spot",
        position: { x: 0, y: 2.4, z: 0 },
        direction: { x: 0, y: -1, z: 0 },
        intensity: 2,
        range: 6,
        coneAngle: 25,
      },
    ]),
  )[0];
  TestValidator.predicate(
    "a spot lowers with its cone, its range, and its aim",
    spot !== undefined &&
      spot.type === "spot" &&
      spot.range === 6 &&
      spot.coneAngle === 25 &&
      vclose(spot.transform.translation, { x: 0, y: 2.4, z: 0 }),
  );

  // 4. DEFAULTS
  const defaults = lightsOf(
    stageLights([
      {
        node: "bulb",
        type: "point",
        position: { x: 1, y: 1, z: 1 },
        intensity: 1,
      },
      {
        node: "lamp",
        type: "spot",
        position: { x: 2, y: 2, z: 2 },
        direction: { x: 0, y: -1, z: 0 },
        intensity: 1,
      },
    ]),
  );
  TestValidator.predicate(
    "an omitted range is infinite and an omitted cone is 45 degrees",
    defaults.length === 2 &&
      defaults[0]!.type === "point" &&
      defaults[0]!.range === 0 &&
      defaults[1]!.type === "spot" &&
      defaults[1]!.range === 0 &&
      defaults[1]!.coneAngle === 45,
  );

  // 5. NEGATIVE TWINS: a parameter the kind cannot use is refused, not dropped
  TestValidator.predicate(
    "a directional light takes no position",
    hasViolation(
      failure(
        stageLights([
          {
            node: "sun",
            direction: { x: -1, y: -1, z: 0 },
            position: { x: 0, y: 5, z: 0 },
            intensity: 1,
          },
        ]),
      ),
      "type",
      "$input.lights[0].position",
    ),
  );
  TestValidator.predicate(
    "a point light takes no direction",
    hasViolation(
      failure(
        stageLights([
          {
            node: "flame",
            type: "point",
            position: { x: 0, y: 1, z: 0 },
            direction: { x: 0, y: -1, z: 0 },
            intensity: 1,
          },
        ]),
      ),
      "type",
      "$input.lights[0].direction",
    ),
  );
  TestValidator.predicate(
    "a point light takes no cone",
    hasViolation(
      failure(
        stageLights([
          {
            node: "flame",
            type: "point",
            position: { x: 0, y: 1, z: 0 },
            intensity: 1,
            coneAngle: 30,
          },
        ]),
      ),
      "type",
      "$input.lights[0].coneAngle",
    ),
  );
  TestValidator.predicate(
    "a directional light takes no range",
    hasViolation(
      failure(
        stageLights([
          {
            node: "sun",
            direction: { x: -1, y: -1, z: 0 },
            intensity: 1,
            range: 10,
          },
        ]),
      ),
      "type",
      "$input.lights[0].range",
    ),
  );

  // 6. the parameters each kind REQUIRES
  TestValidator.predicate(
    "an aimed light without a direction is refused",
    hasViolation(
      failure(stageLights([{ node: "sun", intensity: 1 }])),
      "type",
      "$input.lights[0].direction",
    ) &&
      hasViolation(
        failure(
          stageLights([
            {
              node: "lamp",
              type: "spot",
              position: { x: 0, y: 2, z: 0 },
              intensity: 1,
            },
          ]),
        ),
        "type",
        "$input.lights[0].direction",
      ),
  );
  TestValidator.predicate(
    "a positioned light without a position is refused",
    hasViolation(
      failure(stageLights([{ node: "flame", type: "point", intensity: 1 }])),
      "type",
      "$input.lights[0].position",
    ) &&
      hasViolation(
        failure(
          stageLights([
            {
              node: "lamp",
              type: "spot",
              direction: { x: 0, y: -1, z: 0 },
              intensity: 1,
            },
          ]),
        ),
        "type",
        "$input.lights[0].position",
      ),
  );

  // 7. BOUNDARIES
  TestValidator.equals(
    "a light that is off is still a light",
    stageLights([
      { node: "sun", direction: { x: -1, y: -1, z: 0 }, intensity: 0 },
    ]).success,
    true,
  );
  TestValidator.predicate(
    "a zero-length direction is still refused",
    hasViolation(
      failure(
        stageLights([
          { node: "sun", direction: { x: 0, y: 0, z: 0 }, intensity: 1 },
        ]),
      ),
      "range",
      "$input.lights[0].direction",
    ),
  );
  const spotAt = (coneAngle: number) =>
    stageLights([
      {
        node: "lamp",
        type: "spot",
        position: { x: 0, y: 2, z: 0 },
        direction: { x: 0, y: -1, z: 0 },
        intensity: 1,
        coneAngle,
      },
    ]);
  TestValidator.equals(
    "the cone's open end (90) is legal",
    spotAt(90).success,
    true,
  );
  TestValidator.predicate(
    "and both sides just past it are not",
    hasViolation(failure(spotAt(90.0001)), "range", "coneAngle") &&
      hasViolation(failure(spotAt(0)), "range", "coneAngle") &&
      hasViolation(failure(spotAt(Number.NaN)), "range", "coneAngle"),
  );
  TestValidator.predicate(
    "range 0 is infinite while a negative range is refused",
    stageLights([
      {
        node: "flame",
        type: "point",
        position: { x: 0, y: 1, z: 0 },
        intensity: 1,
        range: 0,
      },
    ]).success === true &&
      hasViolation(
        failure(
          stageLights([
            {
              node: "flame",
              type: "point",
              position: { x: 0, y: 1, z: 0 },
              intensity: 1,
              range: -1,
            },
          ]),
        ),
        "range",
        "$input.lights[0].range",
      ),
  );
  TestValidator.predicate(
    "a non-finite position is refused as a range fault, not a missing one",
    hasViolation(
      failure(
        stageLights([
          {
            node: "flame",
            type: "point",
            position: { x: 0, y: Number.POSITIVE_INFINITY, z: 0 },
            intensity: 1,
          },
        ]),
      ),
      "range",
      "$input.lights[0].position",
    ),
  );
  TestValidator.predicate(
    "a color component outside [0, 1] is refused at its own component",
    hasViolation(
      failure(
        stageLights([
          {
            node: "sun",
            direction: { x: -1, y: -1, z: 0 },
            intensity: 1,
            color: { r: 1.5, g: 0.5, b: 0.5, a: null, hex: null },
          },
        ]),
      ),
      "range",
      "$input.lights[0].color.r",
    ),
  );
};
