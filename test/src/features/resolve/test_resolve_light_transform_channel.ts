import { Quaternion, resolveShotLighting } from "@automovie/engine";
import {
  AutoMovieChannelValueType,
  IAutoMovieChannel,
  IAutoMovieClip,
  IAutoMovieLight,
  IAutoMovieQuaternion,
  IAutoMovieVector3,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { IDENTITY_TRANSFORM } from "../internal/fixtures";
import {
  namedFacts,
  nclose,
  throwsError,
  vclose,
} from "../internal/predicates";

/**
 * A lamp standing away from the origin, so a move is visible as a move.
 *
 * Staged facing `+Z` — half a turn about Y — and scaled unevenly, neither of
 * which any clip below ever writes and neither of which is the identity. A pass
 * that addressed one axis and quietly rebuilt the rest would answer with the
 * identity instead of with what the light was staged with, and an identity
 * fixture could not tell those two apart.
 */
const lamp: IAutoMovieLight = {
  id: "lamp",
  type: "spot",
  transform: {
    translation: { x: 2, y: 4, z: 0 },
    rotation: { x: 0, y: 1, z: 0, w: 0 },
    scale: { x: 1.5, y: 0.5, z: 2 },
  },
  color: { r: 1, g: 1, b: 1, a: null, hex: null },
  intensity: 2,
  range: 10,
  coneAngle: 40,
};

const sun: IAutoMovieLight = {
  id: "sun",
  type: "directional",
  transform: IDENTITY_TRANSFORM,
  color: { r: 1, g: 1, b: 1, a: null, hex: null },
  intensity: 3,
};

const bulb: IAutoMovieLight = {
  id: "bulb",
  type: "point",
  transform: IDENTITY_TRANSFORM,
  color: { r: 1, g: 1, b: 1, a: null, hex: null },
  intensity: 1,
  range: 5,
};

const LIGHTS: IAutoMovieLight[] = [lamp, sun, bulb];

const pointer = (
  target: string,
  valueType: AutoMovieChannelValueType,
): IAutoMovieChannel => ({ kind: "pointer", pointer: target, valueType });

/** A one-track light clip on a four-second beat. */
const clip = (
  id: string,
  channel: IAutoMovieChannel,
  times: number[],
  values: number[],
  interpolation: "step" | "linear" = "linear",
): IAutoMovieClip => ({
  id,
  name: null,
  duration: 4,
  loop: false,
  tracks: [{ channel, times, values, interpolation }],
});

/** A quaternion as the flat `[x, y, z, w]` a keyframe stores. */
const keyed = (q: IAutoMovieQuaternion): number[] => [q.x, q.y, q.z, q.w];

/** Rotation of `deg` about world Y, the axis a light swings across a sky on. */
const aboutY = (deg: number): IAutoMovieQuaternion =>
  Quaternion.fromAxisAngle({ x: 0, y: 1, z: 0 }, deg);

/** The direction a light shines: its local −Z, carried by its rotation. */
const directionOf = (light: IAutoMovieLight): IAutoMovieVector3 =>
  Quaternion.rotateVector(light.transform.rotation, { x: 0, y: 0, z: -1 });

/** Angle in degrees between two unit vectors. */
const angleBetween = (a: IAutoMovieVector3, b: IAutoMovieVector3): number => {
  const dot = a.x * b.x + a.y * b.y + a.z * b.z;
  return (Math.acos(Math.min(1, Math.max(-1, dot))) * 180) / Math.PI;
};

/** One light of a resolved set, by id. */
const lightOf = (lights: IAutoMovieLight[], id: string): IAutoMovieLight =>
  lights.find((light) => light.id === id)!;

/** The lamp resolved at `seconds` under `clips`. */
const lampAt = (clips: IAutoMovieClip[], seconds: number): IAutoMovieLight =>
  lightOf(resolveShotLighting({ lights: LIGHTS, clips, seconds }), "lamp");

/** A lamp turning a quarter turn about Y across the beat. */
const SWING = clip(
  "lampSwings",
  pointer("/lights/lamp/rotation", "quaternion"),
  [0, 4],
  [...keyed(aboutY(0)), ...keyed(aboutY(90))],
);

/**
 * A light's PLACEMENT is an animatable channel, so its direction and position
 * move like any other keyed value.
 *
 * Before this, `LIGHT_CHANNEL_PROPERTIES` carried intensity, colour, range and
 * cone, and a light was not a scene node, so there was no channel of any kind
 * that could reach where a light stood or which way it faced. A light's
 * direction was fixed for the whole film. That is not a small omission on a
 * long production: light travelling across a stretch of time is how a
 * production of any subject shows that the stretch passed at all.
 *
 * Placement resolves through the SAME path as the four value axes rather than a
 * parallel one — the same table, the same pointer grammar, the same sampler,
 * the same per-light accumulation, the same fold — which is what makes an
 * animated light and a staged one impossible to disagree about.
 *
 * Expected values are geometry, computed by hand and not read off the pass. A
 * quarter turn about world Y carries the light's local −Z from `(0, 0, -1)` to
 * `(-1, 0, 0)`, an exactly 90° change; the `quaternion` value type makes LINEAR
 * interpolation a SLERP, which sweeps at constant angular velocity, so the
 * beat's midpoint is exactly 45° along and lands on `(-sin45°, 0, -cos45°)`.
 * That constant rate is the whole reason the axis is a `quaternion` and not a
 * plain `vec4`: a component-wise lerp would reach the same two ends while
 * moving at a different speed in between, and the same declaration would then
 * aim differently depending only on how far apart its keys were placed.
 *
 * Scenarios:
 *
 * 1. The declared amount, at two times. A lamp keyed from 0° to 90° about Y faces
 *    `(0, 0, -1)` at the start and `(-1, 0, 0)` at the end — 90° apart, the
 *    amount declared — and passes through exactly 45° at the midpoint.
 * 2. Position travels, and everything the track did not address is left alone: the
 *    lamp keeps the scale it was staged with (a punctual light has no extent,
 *    so scale is deliberately not an axis) and keeps its staged rotation, while
 *    a light whose intensity alone is keyed keeps its staged transform BY
 *    IDENTITY, so nothing downstream can read a re-boxed copy as a move.
 * 3. Position and rotation accumulate onto one light together with the older axes,
 *    since they are entries in the same table and not a second pass.
 * 4. The kind split, refused loudly in both directions: a directional light is
 *    infinitely distant and carries no `position`, a point light radiates every
 *    way and carries no `rotation`. Each throws rather than resolving to
 *    something plausible.
 */
export const test_resolve_light_transform_channel = (): void => {
  // 1. the declared amount, at two times.
  const start = directionOf(lampAt([SWING], 0));
  const middle = directionOf(lampAt([SWING], 2));
  const end = directionOf(lampAt([SWING], 4));
  TestValidator.equals(
    "a keyed light faces where it was keyed to, and turns by the declared amount",
    namedFacts([
      ["startsFacingMinusZ", () => vclose(start, { x: 0, y: 0, z: -1 })],
      [
        "sweepsHalfwayAtTheMidpoint",
        () =>
          vclose(middle, {
            x: -Math.SQRT1_2,
            y: 0,
            z: -Math.SQRT1_2,
          }),
      ],
      ["endsFacingMinusX", () => vclose(end, { x: -1, y: 0, z: 0 })],
      ["turnsNinetyDegreesInAll", () => nclose(angleBetween(start, end), 90)],
      [
        "turnsFortyFiveByTheMidpoint",
        () => nclose(angleBetween(start, middle), 45),
      ],
    ]),
    {
      startsFacingMinusZ: true,
      sweepsHalfwayAtTheMidpoint: true,
      endsFacingMinusX: true,
      turnsNinetyDegreesInAll: true,
      turnsFortyFiveByTheMidpoint: true,
    },
  );

  // 2. position travels; everything unaddressed is untouched.
  const walked = lampAt(
    [
      clip(
        "lampWalks",
        pointer("/lights/lamp/position", "vec3"),
        [0, 4],
        [2, 4, 0, 6, 4, -8],
      ),
    ],
    2,
  );
  const dimmed = lampAt(
    [
      clip(
        "lampDims",
        pointer("/lights/lamp/intensity", "scalar"),
        [0, 4],
        [2, 0.5],
      ),
    ],
    4,
  );
  TestValidator.equals(
    "a moved light travels, keeps its staged rotation and scale, and an unmoved one keeps its transform by identity",
    namedFacts([
      [
        "travelsToTheMidpoint",
        () => vclose(walked.transform.translation, { x: 4, y: 4, z: -4 }),
      ],
      [
        "keepsStagedRotation",
        () => vclose(directionOf(walked), { x: 0, y: 0, z: 1 }),
      ],
      [
        "keepsStagedScale",
        () => vclose(walked.transform.scale, { x: 1.5, y: 0.5, z: 2 }),
      ],
      ["dimmedIsANewLight", () => dimmed !== lamp],
      [
        "dimmedKeepsTransformByIdentity",
        () => dimmed.transform === lamp.transform,
      ],
    ]),
    {
      travelsToTheMidpoint: true,
      keepsStagedRotation: true,
      keepsStagedScale: true,
      dimmedIsANewLight: true,
      dimmedKeepsTransformByIdentity: true,
    },
  );

  // 3. placement accumulates beside the older axes, on one light.
  const both = lampAt(
    [
      SWING,
      clip(
        "lampWalks",
        pointer("/lights/lamp/position", "vec3"),
        [0, 4],
        [2, 4, 0, 6, 4, -8],
      ),
      clip(
        "lampOpens",
        pointer("/lights/lamp/coneAngle", "scalar"),
        [0, 4],
        [40, 70],
      ),
    ],
    4,
  );
  TestValidator.equals(
    "rotation, position and cone all land on the same light",
    namedFacts([
      ["turned", () => vclose(directionOf(both), { x: -1, y: 0, z: 0 })],
      [
        "travelled",
        () => vclose(both.transform.translation, { x: 6, y: 4, z: -8 }),
      ],
      ["opened", () => both.type === "spot" && nclose(both.coneAngle, 70)],
    ]),
    { turned: true, travelled: true, opened: true },
  );

  // 4. the kind split, in both directions.
  const throwsOn = (clips: IAutoMovieClip[], fragment: string): boolean =>
    throwsError(
      () => resolveShotLighting({ lights: LIGHTS, clips, seconds: 1 }),
      [fragment],
    );
  TestValidator.equals(
    "a directional light has no position and a point light has no rotation",
    namedFacts([
      [
        "throwsOnSunPosition",
        () =>
          throwsOn(
            [
              clip(
                "sunWalks",
                pointer("/lights/sun/position", "vec3"),
                [0, 4],
                [0, 0, 0, 1, 1, 1],
              ),
            ],
            "which a directional light does not carry",
          ),
      ],
      [
        "throwsOnBulbRotation",
        () =>
          throwsOn(
            [
              clip(
                "bulbTurns",
                pointer("/lights/bulb/rotation", "quaternion"),
                [0, 4],
                [...keyed(aboutY(0)), ...keyed(aboutY(90))],
              ),
            ],
            "which a point light does not carry",
          ),
      ],
    ]),
    { throwsOnSunPosition: true, throwsOnBulbRotation: true },
  );
};
