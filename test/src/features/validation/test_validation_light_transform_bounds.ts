import { validateShotArtifact } from "@automovie/engine";
import {
  IAutoMovieScene,
  IAutoMovieShot,
  IAutoMovieValidation,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { namedFacts } from "../internal/predicates";

const transform = () => ({
  translation: { x: 0, y: 0, z: 0 },
  rotation: { x: 0, y: 0, z: 0, w: 1 },
  scale: { x: 1, y: 1, z: 1 },
});

/** One scene light of each kind, so the placement split has all three cases. */
const scene = (): IAutoMovieScene =>
  ({
    id: "sc",
    nodes: [],
    cameras: [
      { id: "cam", transform: transform(), fovY: 50, near: 0.1, far: 100 },
    ],
    lights: [
      {
        id: "key",
        transform: transform(),
        color: { r: 1, g: 1, b: 1 },
        intensity: 1,
        type: "spot",
        range: 10,
        coneAngle: 30,
      },
      {
        id: "sun",
        transform: transform(),
        color: { r: 1, g: 1, b: 1 },
        intensity: 3,
        type: "directional",
      },
      {
        id: "bulb",
        transform: transform(),
        color: { r: 1, g: 1, b: 1 },
        intensity: 1,
        type: "point",
        range: 5,
      },
    ],
  }) as unknown as IAutoMovieScene;

/** A shot carrying exactly one light-motion track, so a case reports only it. */
const shot = (track: Record<string, unknown>): IAutoMovieShot =>
  ({
    id: "opening",
    scene: "sc",
    camera: "cam",
    duration: 4,
    // Every field the validator dereferences is present and well formed, so a
    // case that expects a CLEAN verdict is reporting on its track and nothing
    // else: an omitted `cameraMotion` or `objectMotions` is itself a violation.
    cameraMotion: null,
    objectMotions: [],
    performances: [],
    lightMotions: [
      {
        id: "placement",
        name: null,
        duration: 4,
        loop: false,
        tracks: [track],
      },
    ],
  }) as unknown as IAutoMovieShot;

const track = (
  pointer: string,
  valueType: string,
  times: unknown[],
  values: unknown[],
  interpolation = "linear",
): Record<string, unknown> => ({
  channel: { kind: "pointer", pointer, valueType },
  times,
  values,
  interpolation,
});

const verdict = (one: Record<string, unknown>): IAutoMovieValidation =>
  validateShotArtifact(shot(one), scene(), null);

/** Whether any violation's path starts with `prefix`. */
const reportsAt = (one: Record<string, unknown>, prefix: string): boolean => {
  const validation = verdict(one);
  return (
    validation.success === false &&
    validation.violations.some((entry) => entry.path.startsWith(prefix))
  );
};

/** Whether any violation's message mentions the joint unit-quaternion rule. */
const reportsNonUnit = (one: Record<string, unknown>): boolean => {
  const validation = verdict(one);
  return (
    validation.success === false &&
    validation.violations.some((entry) =>
      entry.expected.includes("unit quaternion"),
    )
  );
};

const accepts = (one: Record<string, unknown>): boolean =>
  verdict(one).success === true;

/** A quarter turn about Y, the unit quaternion a swinging light is keyed with. */
const QUARTER_TURN = [0, Math.SQRT1_2, 0, Math.SQRT1_2];
const IDENTITY = [0, 0, 0, 1];

/**
 * The artifact gate holds a light's PLACEMENT to the same rules the scene gate
 * holds a staged light's transform to.
 *
 * The table that admits a light channel is the table that applies it, so
 * widening it to `position` and `rotation` widens both halves in one edit. What
 * that widening brings with it is a constraint of a shape the gate had never
 * needed: every axis until now was a scalar or a colour, and every rule about
 * them was a per-component range. A rotation is not like that. Its four
 * components are jointly constrained to unit length, and `(0, 0, 0, 0.5)` has
 * every component inside `[-1, 1]` while describing no rotation at all. A gate
 * that checked only components would let a film state through time exactly what
 * `commitScene` refuses outright, which is the one thing the light bounds exist
 * to prevent.
 *
 * The `cubicspline` asymmetry is deliberate and is the subtle half. A rotation
 * is RENORMALIZED at playback — the sampler puts an interpolated quaternion
 * back on the unit sphere before anything reads it — so the value a film
 * actually plays is unit at every interior instant however wild the tangents
 * are, and refusing that overshoot would refuse a declaration that renders
 * correctly. The keys themselves get no such reprieve: the sampler returns a
 * boundary key verbatim, so a non-unit key really does reach the light.
 *
 * Scenarios:
 *
 * 1. The placement axes are admitted where the kind carries them, and refused
 *    where it does not: a spot has somewhere to stand and somewhere to look, a
 *    directional light is infinitely distant and carries no `position`, a point
 *    light radiates every way and carries no `rotation`.
 * 2. The joint rule refuses a non-unit rotation key on both payload layouts, a
 *    mis-declared value type is caught before any of it, and the per-component
 *    range still reports the component it is about — located at that number's
 *    own index, which is where the joint rule cannot report.
 * 3. A position track is unbounded and a unit rotation track is clean, so the
 *    rules refuse only what they name.
 * 4. The renormalization asymmetry: a `cubicspline` rotation whose tangents send
 *    the Hermite interior far outside `[-1, 1]` is ACCEPTED, while the same
 *    analysis still refuses a scalar axis (an intensity dipping below zero
 *    between two in-range keys), which is the case that would be lost if the
 *    exemption were written one condition too wide.
 * 5. One mistake earns one violation. A rotation key with a non-finite component
 *    and an uneven payload are each reported by the shared track-shape contract
 *    and NOT re-reported as a unit-length fault, and an empty payload is
 *    refused by that same contract: the joint rule judges keyframes, and a
 *    payload that states no keyframe states nothing for it to judge.
 */
export const test_validation_light_transform_bounds = (): void => {
  // 1. the kind split.
  TestValidator.equals(
    "placement is admitted where the kind carries it and refused where it does not",
    namedFacts([
      [
        "spotTakesPosition",
        () =>
          accepts(
            track("/lights/key/position", "vec3", [0, 4], [0, 0, 0, 1, 2, 3]),
          ),
      ],
      [
        "spotTakesRotation",
        () =>
          accepts(
            track(
              "/lights/key/rotation",
              "quaternion",
              [0, 4],
              [...IDENTITY, ...QUARTER_TURN],
            ),
          ),
      ],
      [
        "sunTakesRotation",
        () =>
          accepts(
            track(
              "/lights/sun/rotation",
              "quaternion",
              [0, 4],
              [...IDENTITY, ...QUARTER_TURN],
            ),
          ),
      ],
      [
        "sunRefusesPosition",
        () =>
          reportsAt(
            track("/lights/sun/position", "vec3", [0, 4], [0, 0, 0, 1, 2, 3]),
            "$input.lightMotions[0].tracks[0].channel.pointer",
          ),
      ],
      [
        "bulbTakesPosition",
        () =>
          accepts(
            track("/lights/bulb/position", "vec3", [0, 4], [0, 0, 0, 1, 2, 3]),
          ),
      ],
      [
        "bulbRefusesRotation",
        () =>
          reportsAt(
            track(
              "/lights/bulb/rotation",
              "quaternion",
              [0, 4],
              [...IDENTITY, ...QUARTER_TURN],
            ),
            "$input.lightMotions[0].tracks[0].channel.pointer",
          ),
      ],
    ]),
    {
      spotTakesPosition: true,
      spotTakesRotation: true,
      sunTakesRotation: true,
      sunRefusesPosition: true,
      bulbTakesPosition: true,
      bulbRefusesRotation: true,
    },
  );

  // 2. the joint rule, on both payload layouts, and the value type in front.
  TestValidator.equals(
    "a rotation key that is not unit length is refused on either layout",
    namedFacts([
      [
        "refusesNonUnitLinearKey",
        () =>
          reportsNonUnit(
            track(
              "/lights/key/rotation",
              "quaternion",
              [0, 4],
              [...IDENTITY, 0, 0, 0, 0.5],
            ),
          ),
      ],
      [
        "refusesNonUnitCubicKey",
        () =>
          reportsNonUnit(
            track(
              "/lights/key/rotation",
              "quaternion",
              [0, 4],
              [
                // in-tangent, value, out-tangent per keyframe; only the values
                // carry the rule, and the second one is not a rotation.
                ...[0, 0, 0, 0],
                ...IDENTITY,
                ...[0, 0, 0, 0],
                ...[0, 0, 0, 0],
                ...[0, 0, 0, 0.5],
                ...[0, 0, 0, 0],
              ],
              "cubicspline",
            ),
          ),
      ],
      [
        "refusesMisdeclaredValueType",
        () =>
          reportsAt(
            track(
              "/lights/key/rotation",
              "vec4",
              [0, 4],
              [...IDENTITY, ...QUARTER_TURN],
            ),
            "$input.lightMotions[0].tracks[0].channel.valueType",
          ),
      ],
      // Located at the component, not at the keyframe. A `w` of 2 is out of
      // `[-1, 1]` AND not unit length, and the joint rule reports the whole
      // value at `.values`; only the per-component range can report the eighth
      // number, so naming its index is what says the range rule is still there
      // rather than subsumed by the rule beside it.
      [
        "refusesOutOfRangeComponent",
        () =>
          reportsAt(
            track(
              "/lights/key/rotation",
              "quaternion",
              [0, 4],
              [...IDENTITY, 0, 0, 0, 2],
            ),
            "$input.lightMotions[0].tracks[0].values[7]",
          ),
      ],
    ]),
    {
      refusesNonUnitLinearKey: true,
      refusesNonUnitCubicKey: true,
      refusesMisdeclaredValueType: true,
      refusesOutOfRangeComponent: true,
    },
  );

  // 3. a place in the world has no ceiling.
  TestValidator.predicate(
    "a position track carries a place in the world, with no range to leave",
    accepts(
      track(
        "/lights/key/position",
        "vec3",
        [0, 4],
        [-1e6, -1e6, -1e6, 1e6, 1e6, 1e6],
      ),
    ),
  );

  // 4. renormalization exempts the rotation interior, and only it.
  TestValidator.equals(
    "the cubic interior is exempt where playback renormalizes and refused where it does not",
    namedFacts([
      [
        "acceptsWildRotationTangents",
        () =>
          accepts(
            track(
              "/lights/key/rotation",
              "quaternion",
              [0, 4],
              [
                ...[0, 0, 0, 0],
                ...IDENTITY,
                ...[50, 50, 50, 50],
                ...[-50, -50, -50, -50],
                ...QUARTER_TURN,
                ...[0, 0, 0, 0],
              ],
              "cubicspline",
            ),
          ),
      ],
      [
        "refusesScalarDipBelowZero",
        () =>
          reportsAt(
            // Two in-range keys whose tangents drive the Hermite to -4 halfway
            // between them: an intensity no light can hold.
            track(
              "/lights/key/intensity",
              "scalar",
              [0, 2],
              [0, 1, -10, 10, 1, 0],
              "cubicspline",
            ),
            "$input.lightMotions[0].tracks[0].values",
          ),
      ],
    ]),
    { acceptsWildRotationTangents: true, refusesScalarDipBelowZero: true },
  );

  // 5. one mistake, one violation.
  TestValidator.equals(
    "a payload that states no keyframe is reported once, by the shape contract",
    namedFacts([
      [
        "nonFiniteIsNotAlsoNonUnit",
        () =>
          !reportsNonUnit(
            track(
              "/lights/key/rotation",
              "quaternion",
              [0, 4],
              [...IDENTITY, 0, 0, 0, Number.NaN],
            ),
          ),
      ],
      [
        "nonFiniteStillRefused",
        () =>
          reportsAt(
            track(
              "/lights/key/rotation",
              "quaternion",
              [0, 4],
              [...IDENTITY, 0, 0, 0, Number.NaN],
            ),
            "$input.lightMotions[0].tracks[0].values",
          ),
      ],
      [
        "unevenIsNotAlsoNonUnit",
        () =>
          !reportsNonUnit(
            track(
              "/lights/key/rotation",
              "quaternion",
              [0, 4],
              [...IDENTITY, 0, 0],
            ),
          ),
      ],
      [
        "unevenStillRefused",
        () =>
          reportsAt(
            track(
              "/lights/key/rotation",
              "quaternion",
              [0, 4],
              [...IDENTITY, 0, 0],
            ),
            "$input.lightMotions[0].tracks[0].values",
          ),
      ],
      // A payload of no numbers is not asserted to escape the joint rule: the
      // rule walks keyframes, and an empty payload states none for it to walk,
      // so no reading of it could ever produce one. The uneven payload above is
      // the case that can, since a rule reading its trailing part as a keyframe
      // would report exactly what that fact refuses.
      [
        "emptyStillRefused",
        () =>
          reportsAt(
            track("/lights/key/rotation", "quaternion", [0, 4], []),
            "$input.lightMotions[0].tracks[0].values",
          ),
      ],
    ]),
    {
      nonFiniteIsNotAlsoNonUnit: true,
      nonFiniteStillRefused: true,
      unevenIsNotAlsoNonUnit: true,
      unevenStillRefused: true,
      emptyStillRefused: true,
    },
  );
};
