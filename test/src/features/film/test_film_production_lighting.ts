import { Quaternion, inheritProductionLighting } from "@automovie/engine";
import {
  AutoMovieChannelValueType,
  IAutoMovieChannel,
  IAutoMovieClip,
  IAutoMovieLight,
  IAutoMovieProductionLighting,
  IAutoMovieQuaternion,
  IAutoMovieVector3,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { IDENTITY_TRANSFORM } from "../internal/fixtures";
import { namedFacts, nclose, vclose } from "../internal/predicates";

/** Half an hour of story time, in seconds: the span the film runs across. */
const SPAN = 1800;

const pointer = (
  target: string,
  valueType: AutoMovieChannelValueType,
): IAutoMovieChannel => ({ kind: "pointer", pointer: target, valueType });

/** A one-track clip on the STORY clock, which is as long as the span it covers. */
const storyClip = (
  id: string,
  channel: IAutoMovieChannel,
  times: number[],
  values: number[],
): IAutoMovieClip => ({
  id,
  name: null,
  duration: SPAN,
  loop: false,
  tracks: [{ channel, times, values, interpolation: "linear" }],
});

const keyed = (q: IAutoMovieQuaternion): number[] => [q.x, q.y, q.z, q.w];

const aboutY = (deg: number): IAutoMovieQuaternion =>
  Quaternion.fromAxisAngle({ x: 0, y: 1, z: 0 }, deg);

const directionOf = (light: IAutoMovieLight): IAutoMovieVector3 =>
  Quaternion.rotateVector(light.transform.rotation, { x: 0, y: 0, z: -1 });

/**
 * The production's one source: a directional light that turns a quarter turn
 * and fades over the whole span. Nothing about it names a subject; it is the
 * shape any production takes when its length is part of what it is about.
 */
const daylight: IAutoMovieLight = {
  id: "daylight",
  type: "directional",
  transform: IDENTITY_TRANSFORM,
  color: { r: 1, g: 1, b: 1, a: null, hex: null },
  intensity: 3,
};

const moon: IAutoMovieLight = {
  id: "moon",
  type: "directional",
  transform: IDENTITY_TRANSFORM,
  color: { r: 0.6, g: 0.7, b: 1, a: null, hex: null },
  intensity: 0.2,
};

const lighting = (
  overrides: Partial<IAutoMovieProductionLighting> = {},
): IAutoMovieProductionLighting => ({
  id: "production-light",
  name: null,
  lights: [daylight],
  motions: [
    storyClip("daylightTurns", pointer("/lights/daylight/rotation", "quaternion"), [0, SPAN], [
      ...keyed(aboutY(0)),
      ...keyed(aboutY(90)),
    ]),
    storyClip(
      "daylightFades",
      pointer("/lights/daylight/intensity", "scalar"),
      [0, SPAN],
      [3, 0.5],
    ),
  ],
  ...overrides,
});

/** A scene light of the shot's own, which the production never addresses. */
const practical: IAutoMovieLight = {
  id: "practical",
  type: "point",
  transform: IDENTITY_TRANSFORM,
  color: { r: 1, g: 0.8, b: 0.5, a: null, hex: null },
  intensity: 1.4,
  range: 4,
};

/** A scene's own copy of the production source: a reference, not a restaging. */
const stagedDaylight: IAutoMovieLight = {
  id: "daylight",
  type: "directional",
  transform: IDENTITY_TRANSFORM,
  color: { r: 1, g: 1, b: 1, a: null, hex: null },
  intensity: 3,
};

const lightOf = (lights: IAutoMovieLight[], id: string): IAutoMovieLight =>
  lights.find((light) => light.id === id)!;

/**
 * A production states ONE moving source and every shot inherits its state at
 * that shot's own story moment, instead of each shot restaging the light.
 *
 * The gap this closes is a scale gap. A shot's `lightMotions` runs on the
 * shot's clock, which is seconds long, so the longest statement a film could
 * make about its light was a few seconds long too. A production running a
 * stretch of story could not say the light crossed it, and every shot restaged
 * its own lighting with nothing at all relating the first shot's light to the
 * last's — consistency was whatever the author happened to retype.
 *
 * The clock is not invented here. `IAutoMovieShotStoryTime` — the pin a shot
 * already carries — is the affine map from shot-local seconds to story seconds,
 * so this pass is only ever "map the second, ask the one source". The edit is
 * not consulted at all: shots cut far apart may sit adjacent in the story, and
 * that is the fact a cut list cannot express and a pin can.
 *
 * Expected values are hand geometry and hand arithmetic. The source turns a
 * quarter turn about Y across the span, carrying its local −Z from `(0, 0, -1)`
 * to `(-1, 0, 0)`; the `quaternion` type makes that a SLERP, so the halfway
 * story moment is exactly 45° along. Intensity ramps linearly from 3 to 0.5, so
 * its halfway value is 1.75.
 *
 * Scenarios:
 *
 * 1. Two shots at different story times inherit DIFFERENT states from one
 *    source: shots pinned at the start, the middle and the end of the span read
 *    0°/3, 45°/1.75 and 90°/0.5. One declaration, three lightings, and nothing
 *    in any shot restating it.
 * 2. A shot's `rate` carries the same source at the shot's own pace: a two
 *    second shot pinned at 900 story seconds per shot second covers the whole
 *    span from within, so a film may run a long stretch of story inside a short
 *    take and the light crosses it correctly.
 * 3. The additivity promise, in both of its forms. A production that declares
 *    no lighting leaves the staged lights untouched, ELEMENT BY ELEMENT, and so
 *    does a shot carrying no story pin — an unpinned shot claims no story
 *    moment, so there is none at which to read a story-clock source, and
 *    assuming one would put every unpinned shot under the same light and call
 *    it a fact.
 * 4. The merge, by id and in a fixed order: a staged light the production names
 *    is replaced in place by the inherited state, a staged light it does not
 *    name comes back by identity, and a source the scene never staged is
 *    appended after them in declaration order.
 */
export const test_film_production_lighting = (): void => {
  const staged: IAutoMovieLight[] = [practical, stagedDaylight];
  const at = (originSeconds: number, seconds = 0): IAutoMovieLight =>
    lightOf(
      inheritProductionLighting({
        lighting: lighting(),
        lights: staged,
        pin: { originSeconds },
        seconds,
      }),
      "daylight",
    );

  // 1. one source, three story moments, three lightings.
  const opening = at(0);
  const midday = at(SPAN / 2);
  const closing = at(SPAN);
  TestValidator.equals(
    "shots pinned at different story times inherit different states from one source",
    namedFacts([
      ["opensFacingMinusZ", () => vclose(directionOf(opening), { x: 0, y: 0, z: -1 })],
      ["opensAtFullIntensity", () => nclose(opening.intensity, 3)],
      [
        "turnsHalfwayByMidSpan",
        () =>
          vclose(directionOf(midday), {
            x: -Math.SQRT1_2,
            y: 0,
            z: -Math.SQRT1_2,
          }),
      ],
      ["fadesHalfwayByMidSpan", () => nclose(midday.intensity, 1.75)],
      ["endsFacingMinusX", () => vclose(directionOf(closing), { x: -1, y: 0, z: 0 })],
      ["endsDim", () => nclose(closing.intensity, 0.5)],
    ]),
    {
      opensFacingMinusZ: true,
      opensAtFullIntensity: true,
      turnsHalfwayByMidSpan: true,
      fadesHalfwayByMidSpan: true,
      endsFacingMinusX: true,
      endsDim: true,
    },
  );

  // 2. a compressed shot crosses the whole span from inside two seconds.
  const compressed = (seconds: number): IAutoMovieLight =>
    lightOf(
      inheritProductionLighting({
        lighting: lighting(),
        lights: staged,
        pin: { originSeconds: 0, rate: SPAN / 2 },
        seconds,
      }),
      "daylight",
    );
  TestValidator.equals(
    "a shot that compresses story time carries the source at its own rate",
    namedFacts([
      [
        "reachesMidSpanAtOneSecond",
        () => nclose(compressed(1).intensity, 1.75),
      ],
      [
        "reachesSpanEndAtTwoSeconds",
        () => vclose(directionOf(compressed(2)), { x: -1, y: 0, z: 0 }),
      ],
    ]),
    { reachesMidSpanAtOneSecond: true, reachesSpanEndAtTwoSeconds: true },
  );

  // 3. nothing declared, or nothing pinned: unchanged, element by element.
  const undeclared = inheritProductionLighting({
    lighting: null,
    lights: staged,
    pin: { originSeconds: SPAN },
    seconds: 0,
  });
  const unpinned = inheritProductionLighting({
    lighting: lighting(),
    lights: staged,
    pin: null,
    seconds: 0,
  });
  TestValidator.equals(
    "a production declaring no lighting, and an unpinned shot, are unchanged from today",
    namedFacts([
      [
        "undeclaredIsTheStagedList",
        () => undeclared.every((light, i) => light === staged[i]),
      ],
      ["undeclaredAddsNothing", () => undeclared.length === staged.length],
      [
        "unpinnedIsTheStagedList",
        () => unpinned.every((light, i) => light === staged[i]),
      ],
      ["unpinnedAddsNothing", () => unpinned.length === staged.length],
    ]),
    {
      undeclaredIsTheStagedList: true,
      undeclaredAddsNothing: true,
      unpinnedIsTheStagedList: true,
      unpinnedAddsNothing: true,
    },
  );

  // 4. replace by id in place, keep the rest by identity, append the unstaged.
  const merged = inheritProductionLighting({
    lighting: lighting({ lights: [daylight, moon] }),
    lights: staged,
    pin: { originSeconds: SPAN },
    seconds: 0,
  });
  TestValidator.equals(
    "the merge replaces by id in staging order and appends an unstaged source last",
    merged.map((light) => light.id),
    ["practical", "daylight", "moon"],
  );
  TestValidator.equals(
    "an unnamed staged light and an untouched source both come back by identity",
    namedFacts([
      ["practicalByIdentity", () => merged[0] === practical],
      ["daylightIsInherited", () => merged[1] !== stagedDaylight],
      ["daylightCarriesStoryState", () => nclose(merged[1]!.intensity, 0.5)],
      ["moonByIdentity", () => merged[2] === moon],
    ]),
    {
      practicalByIdentity: true,
      daylightIsInherited: true,
      daylightCarriesStoryState: true,
      moonByIdentity: true,
    },
  );
};
