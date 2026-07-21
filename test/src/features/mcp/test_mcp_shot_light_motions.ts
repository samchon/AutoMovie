import {
  IAutoMovieClip,
  IAutoMovieScene,
  IAutoMovieShot,
  IAutoMovieValidation,
} from "@automovie/interface";
import { AutoMovieApplication } from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";

import { IDENTITY_TRANSFORM } from "../internal/fixtures";

const app = new AutoMovieApplication();

const scene: IAutoMovieScene = {
  id: "scene-1",
  name: null,
  nodes: [],
  cameras: [
    {
      id: "camera",
      transform: IDENTITY_TRANSFORM,
      fovY: 45,
      near: 0.1,
      far: 100,
    },
  ],
  lights: [
    {
      id: "candleGlow",
      type: "point",
      transform: IDENTITY_TRANSFORM,
      color: { r: 1, g: 0.8, b: 0.5, a: null, hex: null },
      intensity: 1.4,
      range: 4,
    },
    {
      id: "sun",
      type: "directional",
      transform: IDENTITY_TRANSFORM,
      color: { r: 1, g: 1, b: 1, a: null, hex: null },
      intensity: 3,
    },
    {
      id: "lamp",
      type: "spot",
      transform: IDENTITY_TRANSFORM,
      color: { r: 1, g: 1, b: 1, a: null, hex: null },
      intensity: 2,
      range: 10,
      coneAngle: 40,
    },
  ],
  space: null,
};

const bad = <T>(value: unknown): T => value as T;

/** A one-track light clip; `channel` and the payload are the variable. */
const clip = (
  id: string,
  channel: unknown,
  times: number[] = [0, 1.6],
  values: number[] = [1.4, 0.04],
  interpolation = "step",
): IAutoMovieClip =>
  bad({
    id,
    name: null,
    duration: 3,
    loop: false,
    tracks: [{ channel, times, values, interpolation }],
  });

const pointerChannel = (pointer: string, valueType = "scalar"): unknown => ({
  kind: "pointer",
  pointer,
  valueType,
});

const base: IAutoMovieShot = {
  id: "shot:the-beat",
  name: null,
  scene: scene.id,
  camera: "camera",
  cameraMotion: null,
  performances: [],
  objectMotions: [],
  duration: 3,
};

const validate = (over: Record<string, unknown>): IAutoMovieValidation =>
  app.validateShot({ shot: bad({ ...base, ...over }), scene }).validation;

/**
 * `validateShot` re-roots the artifact validator's `$input` under
 * `$input.shot`.
 */
const says = (
  validation: IAutoMovieValidation,
  path: string,
  expected: string,
): boolean =>
  validation.success === false &&
  validation.violations.some(
    (violation) =>
      violation.path === `$input.shot${path}` &&
      violation.expected.includes(expected),
  );

/**
 * A shot's `lightMotions` admits exactly the light channels the engine's
 * lighting pass applies (#1348).
 *
 * The axis is new, and the two ways to get it wrong are both failures this
 * campaign already paid for. Admitting a channel nothing applies is #1339's
 * false green, which is why the accepted property set is read out of
 * `LIGHT_CHANNEL_PROPERTIES`, the very table `resolveShotLighting` writes
 * through. Applying less than what was admitted is #1349, which is why this
 * field refuses a property the staged light's kind does not carry instead of
 * letting the applier meet it at playback.
 *
 * The counter-case matters as much: `cameraMotion`, `objectMotions`, and a
 * coverage take are unchanged, still node-only, because their appliers are
 * unchanged. `test_mcp_pointer_channel_refused` owns that half.
 *
 * Scenarios:
 *
 * 1. Positive: S-03's candle blowout validates clean, and so do the empty-array
 *    and wholly-absent forms — a legacy shot that never heard of the field
 *    stays valid.
 * 2. The channel form: a `node` channel in `lightMotions` is refused at its own
 *    `kind` (the exact mirror of the pointer refusal on a transform clip), and
 *    a pointer that is not a light pointer is refused at `.pointer` naming the
 *    grammar. `/lights/0/intensity` — what the benchmark agent actually wrote —
 *    is refused as a light that is not staged, because lights are addressed by
 *    id.
 * 3. The staged light: an unstaged id is refused, and so is a property the staged
 *    light's KIND does not carry (`range` on the directional `sun`, `coneAngle`
 *    on the point `candleGlow`), while `range` on that same point light passes.
 *    Kind-carrying is a real check, not a name check.
 * 4. The value type: `intensity` resolves to `scalar`, so declaring `vec3` is
 *    refused at `.valueType` before the sampler could throw over the width.
 * 5. Single-valued lighting: two CLIPS driving one light's intensity are refused
 *    at the second track's channel. Within one clip the duplicate-channel rule
 *    already covers it; across clips the artifact would otherwise resolve
 *    last-writer-wins, a deterministic answer to a question it never meant to
 *    ask. Two DIFFERENT properties of one light stay legal, one property away.
 * 6. The list gate is not the element gate: a non-array `lightMotions` stops at
 *    the field, a null clip is refused at its index, and a null track at its
 *    own.
 * 7. Boundary: a malformed scene light (a `null` entry, and a light with a
 *    non-string id) is simply not addressable — the pointer naming it reads as
 *    unstaged rather than crashing the gate.
 * 8. Every keyframe is held to the property's DOCUMENTED range, the same numbers
 *    `validateSceneArtifact` holds the staged light to: a negative intensity, a
 *    colour component past 1, and a zero cone are each refused at the value
 *    that carries them, while the inclusive bounds themselves (a 90 degree
 *    cone, a zero intensity) stay legal. A `cubicspline` track is exempt,
 *    because its stored triplets include tangents, which are derivatives and
 *    not light values. A non-finite keyframe is reported exactly once, by the
 *    clip gate that owns finiteness.
 * 9. The refusal reaches `commitShot`, not only the read-only validator.
 */
export const test_mcp_shot_light_motions = (): void => {
  const blowout = clip(
    "candleOut",
    pointerChannel("/lights/candleGlow/intensity"),
  );

  // 1. the positive floor.
  TestValidator.equals(
    "the candle blowout, the empty list, and the absent field all validate",
    [
      validate({ lightMotions: [blowout] }).success,
      validate({ lightMotions: [] }).success,
      app.validateShot({ shot: base, scene }).validation.success,
    ],
    [true, true, true],
  );

  // 2. the channel form.
  TestValidator.predicate(
    "a node channel and a foreign pointer are each refused where they are wrong",
    says(
      validate({
        lightMotions: [
          clip(
            "nodeTrack",
            { kind: "node", node: "candleGlow", path: "translation" },
            [0, 1],
            [0, 0, 0, 1, 0, 0],
          ),
        ],
      }),
      ".lightMotions[0].tracks[0].channel.kind",
      'must be "pointer"',
    ) &&
      says(
        validate({
          lightMotions: [
            clip(
              "materialTrack",
              pointerChannel("/materials/2/baseColor", "vec3"),
              [0, 1],
              [1, 1, 1, 0, 0, 0],
            ),
          ],
        }),
        ".lightMotions[0].tracks[0].channel.pointer",
        "/lights/<light id>/<property>",
      ),
  );
  TestValidator.predicate(
    "the index form the benchmark wrote is refused: lights are addressed by id",
    says(
      validate({
        lightMotions: [clip("byIndex", pointerChannel("/lights/0/intensity"))],
      }),
      ".lightMotions[0].tracks[0].channel.pointer",
      'but "0" is not one',
    ),
  );

  // 3. the staged light and its kind.
  TestValidator.predicate(
    "an unstaged light and an unsupported kind are both refused at the pointer",
    says(
      validate({
        lightMotions: [
          clip("ghost", pointerChannel("/lights/ghost/intensity")),
        ],
      }),
      ".lightMotions[0].tracks[0].channel.pointer",
      "must address a staged scene light",
    ) &&
      says(
        validate({
          lightMotions: [clip("sunRange", pointerChannel("/lights/sun/range"))],
        }),
        ".lightMotions[0].tracks[0].channel.pointer",
        "which a directional light does not carry",
      ) &&
      says(
        validate({
          lightMotions: [
            clip("candleCone", pointerChannel("/lights/candleGlow/coneAngle")),
          ],
        }),
        ".lightMotions[0].tracks[0].channel.pointer",
        "which a point light does not carry",
      ),
  );
  TestValidator.equals(
    "the same property on a kind that carries it passes",
    validate({
      lightMotions: [
        clip("candleReach", pointerChannel("/lights/candleGlow/range")),
      ],
    }).success,
    true,
  );

  // 4. the declared value type.
  TestValidator.predicate(
    "a value type the property does not resolve to is refused",
    says(
      validate({
        lightMotions: [
          clip(
            "wideIntensity",
            pointerChannel("/lights/candleGlow/intensity", "vec3"),
            [0, 1.6],
            [1.4, 1.4, 1.4, 0, 0, 0],
          ),
        ],
      }),
      ".lightMotions[0].tracks[0].channel.valueType",
      "resolves to scalar",
    ),
  );

  // 5. single-valued lighting across clips.
  TestValidator.predicate(
    "two clips driving one light property are refused at the second",
    says(
      validate({
        lightMotions: [
          blowout,
          clip("candleAgain", pointerChannel("/lights/candleGlow/intensity")),
        ],
      }),
      ".lightMotions[1].tracks[0].channel",
      "light motion channel",
    ),
  );
  TestValidator.equals(
    "two different properties of one light stay legal",
    validate({
      lightMotions: [
        blowout,
        clip("candleReach", pointerChannel("/lights/candleGlow/range")),
      ],
    }).success,
    true,
  );

  // 6. the list gate versus the element gate.
  const notAList = validate({ lightMotions: bad("not-a-list") });
  TestValidator.predicate(
    "a non-array stops at the field, and a null clip or track locates itself",
    says(notAList, ".lightMotions", "must be an array") &&
      notAList.success === false &&
      notAList.violations.every(
        (violation) => violation.path !== "$input.shot.lightMotions[0]",
      ) &&
      says(
        validate({ lightMotions: [null] }),
        ".lightMotions[0]",
        "must be a JSON object",
      ) &&
      says(
        validate({
          lightMotions: [bad({ ...blowout, tracks: [null] })],
        }),
        ".lightMotions[0].tracks[0]",
        "must be a JSON object",
      ),
  );

  // 7. a malformed staged light is not addressable, and does not crash the gate.
  const brokenScene: IAutoMovieScene = bad({
    ...scene,
    lights: [null, { ...scene.lights[0]!, id: 7 }],
  });
  TestValidator.predicate(
    "a light with no usable id reads as unstaged rather than throwing",
    (() => {
      const validation = app.validateShot({
        shot: bad({ ...base, lightMotions: [blowout] }),
        scene: brokenScene,
      }).validation;
      return (
        validation.success === false &&
        validation.violations.some((violation) =>
          violation.expected.includes("must address a staged scene light"),
        )
      );
    })(),
  );

  // 8. the property's own bounds, the ones the staged light is held to.
  const boundsOn = (
    pointer: string,
    valueType: string,
    values: number[],
    interpolation = "step",
  ): IAutoMovieValidation =>
    validate({
      lightMotions: [
        clip(
          "bounded",
          pointerChannel(pointer, valueType),
          [0, 1.6],
          values,
          interpolation,
        ),
      ],
    });
  TestValidator.predicate(
    "a keyframe outside the property's documented range is refused",
    says(
      boundsOn("/lights/candleGlow/intensity", "scalar", [1.4, -0.5]),
      ".lightMotions[0].tracks[0].values[1]",
      "light intensity",
    ) &&
      says(
        boundsOn("/lights/candleGlow/color", "vec3", [1, 1, 1, 1.2, 0, 0]),
        ".lightMotions[0].tracks[0].values[3]",
        "light color",
      ) &&
      says(
        boundsOn("/lights/lamp/coneAngle", "scalar", [40, 0]),
        ".lightMotions[0].tracks[0].values[1]",
        "light coneAngle",
      ),
  );
  TestValidator.equals(
    "the inclusive bound itself is legal: a 90 degree cone, a zero intensity",
    [
      boundsOn("/lights/lamp/coneAngle", "scalar", [40, 90]).success,
      boundsOn("/lights/candleGlow/intensity", "scalar", [1.4, 0]).success,
    ],
    [true, true],
  );
  // A cubicspline's stored triplets are in-tangent/value/out-tangent, and a
  // tangent is a derivative rather than a light value: range-checking one would
  // refuse a legal spline, so the bounds rule deliberately stops at the two
  // interpolations whose stored numbers ARE values.
  TestValidator.equals(
    "a cubicspline's negative tangent is not read as a negative intensity",
    boundsOn(
      "/lights/candleGlow/intensity",
      "scalar",
      [0, 1.4, -2, 0, 0.04, 0],
      "cubicspline",
    ).success,
    true,
  );
  // One fault, one violation: finiteness belongs to the clip gate, and the
  // bounds check must not report the same value a second time.
  const notFinite = boundsOn("/lights/candleGlow/intensity", "scalar", [
    1.4,
    NaN,
  ]);
  TestValidator.equals(
    "a non-finite keyframe is reported once, by the gate that owns finiteness",
    notFinite.success === false
      ? notFinite.violations.filter(
          (violation) =>
            violation.path ===
            "$input.shot.lightMotions[0].tracks[0].values[1]",
        ).length
      : -1,
    1,
  );

  // 9. the commit gate carries the same refusal.
  const committed = app.commitShot({
    slate: {
      script: {
        logline: "a candle goes out",
        theme: "the dark after",
        cast: [],
        beats: [
          {
            id: "the-beat",
            name: "the blowout",
            summary: "LI blows the candle out",
            durationHint: 3,
          },
        ],
      },
      scene,
      shots: [],
      beatEnds: [],
      notes: [],
      film: null,
    },
    shot: bad({
      ...base,
      lightMotions: [clip("ghost", pointerChannel("/lights/ghost/intensity"))],
    }),
  });
  TestValidator.equals(
    "commitShot refuses a light clip addressing nothing staged",
    [committed.committed, committed.state.shots.length],
    [false, 0],
  );
};
