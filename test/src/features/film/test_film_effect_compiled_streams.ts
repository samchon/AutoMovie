import { materializeCompiledEffects } from "@automovie/engine";
import type {
  IAutoMovieShotContract,
  IAutoMovieShotEffectCue,
  IAutoMovieWorldDesign,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import {
  filmEffectRecipe,
  filmEffectWorld,
  filmEffectZone,
  nodeCanonicalDigest,
} from "./filmEffectRuntimeFixtures";

/**
 * Effect cues become streams whose seed and digest depend only on identity.
 *
 * A shot contract and a production and film pair derive seeds under different
 * protocols, so the same cue under two owners is two streams. Expected seeds
 * and digests are recomputed through `node:crypto` from the documented seed
 * protocols, which also pins that the engine's pure digest leaves every
 * previously persisted stream identity unchanged.
 *
 * Scenarios:
 *
 * 1. Without a world nothing is materialized.
 * 2. Under a shot contract, cues are ordered by code unit, cues on a missing
 *    zone or on a zone whose recipe is missing are dropped, an authored event
 *    is carried and an absent one is omitted, the step follows `fps`, and the
 *    seed and digest are the shot stream protocol through `node:crypto`.
 * 3. The emitted bounds, recipe and intensity are copies of the authored data.
 * 4. Under a production and film owner the seed follows the film seed
 *    protocol, an explicit fixed step wins over `fps`, and with neither the
 *    step is one twenty-fourth of a second.
 * 5. The same cue under the shot owner and the film owner receives different
 *    seeds.
 */
export const test_film_effect_compiled_streams = (): void => {
  const contract = { id: "shot-1" } as IAutoMovieShotContract;
  const world: IAutoMovieWorldDesign = {
    ...filmEffectWorld(),
    effectZones: [
      filmEffectZone("yard"),
      filmEffectZone("gate", "fog-recipe", 5),
      filmEffectZone("ruin", "missing-recipe", 9),
    ],
  };
  const cues: IAutoMovieShotEffectCue[] = [
    { id: "b", zone: "gate", start: 1, end: 2, intensity: { from: 0, to: 1 } },
    {
      id: "a",
      zone: "yard",
      start: 0,
      end: 1,
      intensity: { from: 1, to: 0.5 },
      event: "door-opens",
    },
    {
      id: "lost",
      zone: "moat",
      start: 0,
      end: 1,
      intensity: { from: 1, to: 1 },
    },
    {
      id: "orphan",
      zone: "ruin",
      start: 0,
      end: 1,
      intensity: { from: 1, to: 1 },
    },
  ];

  TestValidator.equals(
    "no world materializes nothing",
    materializeCompiledEffects({ contract, cues }),
    [],
  );

  const shot = materializeCompiledEffects({ world, contract, fps: 30, cues });
  TestValidator.equals(
    "shot streams are ordered, filtered, and carry their event",
    shot.map((stream) => ({
      id: stream.id,
      zone: stream.zone,
      kind: stream.kind,
      event: "event" in stream ? stream.event : null,
      window: [stream.start, stream.end],
      step: stream.fixedStepSeconds,
    })),
    [
      {
        id: "a",
        zone: "yard",
        kind: "fog" as const,
        event: "door-opens",
        window: [0, 1],
        step: 1 / 30,
      },
      {
        id: "b",
        zone: "gate",
        kind: "fog" as const,
        event: null,
        window: [1, 2],
        step: 1 / 30,
      },
    ],
  );
  const zoneSeed = (id: string) =>
    world.effectZones.find((zone) => zone.id === id)!.seed;
  TestValidator.equals(
    "shot seeds and digests follow the shot stream protocol",
    shot.map((stream) => [stream.seed, stream.digest]),
    shot.map((stream) => [
      Number.parseInt(
        nodeCanonicalDigest({
          protocol: "automovie.effect-stream.v1",
          shot: "shot-1",
          cue: stream.id,
          recipeSeed: 7,
          zoneSeed: zoneSeed(stream.zone),
        }).slice(7, 20),
        16,
      ),
      nodeCanonicalDigest({ ...stream, digest: undefined }),
    ]),
  );
  shot[0]!.bounds.min.x = 99;
  shot[0]!.recipe.seed = 99;
  shot[0]!.intensity.from = 99;
  TestValidator.equals(
    "emitted data does not alias the authored world or cue",
    [
      world.effectZones[0]!.bounds.min.x,
      world.effectRecipes[0]!.seed,
      cues[1]!.intensity.from,
    ],
    [-1, 7, 1],
  );

  const owner = { production: "p", film: "f" };
  const film = materializeCompiledEffects({
    world,
    seedOwner: owner,
    fps: 30,
    fixedStepSeconds: 0.125,
    cues: [cues[1]!],
  })[0]!;
  TestValidator.equals(
    "film streams follow the film seed protocol and the explicit step",
    [film.seed, film.fixedStepSeconds, film.digest],
    [
      Number.parseInt(
        nodeCanonicalDigest({
          protocol: "automovie.film-effect-seed.v1",
          owner,
          cue: "a",
          recipe: filmEffectRecipe(),
          zone: filmEffectZone("yard"),
        }).slice(7, 20),
        16,
      ),
      0.125,
      nodeCanonicalDigest({ ...film, digest: undefined }),
    ],
  );
  TestValidator.equals(
    "the default step is one twenty-fourth and owners separate seeds",
    [
      materializeCompiledEffects({
        world,
        seedOwner: owner,
        cues: [cues[1]!],
      })[0]!.fixedStepSeconds,
      film.seed === shot[0]!.seed,
    ],
    [1 / 24, false],
  );
};
