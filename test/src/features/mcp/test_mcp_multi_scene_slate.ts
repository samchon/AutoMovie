import {
  IAutoMovieScene,
  IAutoMovieScript,
  IAutoMovieShot,
} from "@automovie/interface";
import {
  AutoMovieApplication,
  IAutoMovieMcpWritableSlate,
} from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";

const app = new AutoMovieApplication();

const script: IAutoMovieScript = {
  logline: "two rooms, one night",
  theme: "pursuit",
  cast: [],
  beats: [
    {
      id: "kitchen",
      name: "the kitchen",
      summary: "a glass breaks",
      durationHint: 2,
    },
    {
      id: "hallway",
      name: "the hallway",
      summary: "footsteps",
      durationHint: 2,
    },
  ],
};

const sceneAt = (id: string): IAutoMovieScene => ({
  id,
  name: id,
  nodes: [],
  cameras: [
    {
      id: `${id}-cam`,
      transform: {
        translation: { x: 0, y: 1.6, z: -3 },
        rotation: { x: 0, y: 0, z: 0, w: 1 },
        scale: { x: 1, y: 1, z: 1 },
      },
      fovY: 45,
      near: 0.1,
      far: 100,
    },
  ],
  lights: [],
  space: null,
});

const shotIn = (beat: string, scene: string): IAutoMovieShot => ({
  id: `shot:${beat}`,
  name: null,
  scene,
  camera: `${scene}-cam`,
  cameraMotion: null,
  performances: [],
  objectMotions: [],
  duration: 1,
});

const base = (over: Partial<IAutoMovieMcpWritableSlate> = {}) =>
  ({
    script,
    scenes: [],
    shots: [],
    beatEnds: [],
    notes: [],
    film: null,
    ...over,
  }) satisfies IAutoMovieMcpWritableSlate;

/**
 * A slate stages several locations, and each one owns its own shots.
 *
 * The production layer used to collapse a film to one set: `commitScene`
 * replaced the staged scene and cleared every shot with it, so a screenplay
 * with an INT kitchen and an EXT hallway had nowhere to put the second (#1171).
 * Staging is an upsert now, and the cascade is scoped by `shot.scene`, which is
 * the field `validateShotArtifact` already enforced.
 *
 * The scoping is the whole claim. Re-staging a location must still throw away
 * that location's shots, because their placements just moved under them; the
 * shots of a location the author did not touch must survive, because nothing
 * about them changed. A cascade that cannot tell the two apart is the collapse
 * with extra steps.
 *
 * Scenarios:
 *
 * 1. Two scenes stage, both are held, and each beat's shot commits against the
 *    location it names.
 * 2. Re-staging one location clears only its own shot and beat end; the other
 *    location's survive untouched.
 * 3. `getScene` reads a named location, answers `null` for one the slate does not
 *    stage, and refuses an unnamed read once several are staged, listing the
 *    ids rather than guessing.
 *
 * `setPlacement` is resident-only, so its multi-scene behaviour is pinned where
 * a resident project already exists, in `test_mcp_set_placement`.
 */
export const test_mcp_multi_scene_slate = (): void => {
  // 1. two locations stage, and each shot commits against the one it names
  const kitchen = sceneAt("int-kitchen");
  const hallway = sceneAt("ext-hallway");
  const first = app.commitScene({ slate: base(), scene: kitchen, models: [] });
  TestValidator.equals("the first location stages", first.committed, true);
  const second = app.commitScene({
    slate: { ...base(), scenes: first.slate!.scenes },
    scene: hallway,
    models: [],
  });
  TestValidator.equals(
    "the second location joins it",
    second.slate!.scenes.map((scene) => scene.id),
    ["int-kitchen", "ext-hallway"],
  );

  const staged = base({ scenes: [kitchen, hallway] });
  const withKitchenShot = app.commitShot({
    slate: staged,
    shot: shotIn("kitchen", kitchen.id),
  });
  TestValidator.equals(
    "a shot commits against the location it names",
    withKitchenShot.committed,
    true,
  );
  const both = app.commitShot({
    slate: withKitchenShot.slate!,
    shot: shotIn("hallway", hallway.id),
  });
  TestValidator.equals(
    "each location carries its own shot",
    both.slate!.shots.map((shot) => shot.scene),
    [kitchen.id, hallway.id],
  );

  // 2. re-staging one location clears only what that location owns
  const restaged = app.commitScene({
    slate: both.slate!,
    scene: { ...kitchen, name: "the kitchen, repainted" },
    models: [],
  });
  TestValidator.equals(
    "the untouched location keeps its shot",
    restaged.slate!.shots.map((shot) => shot.id),
    ["shot:hallway"],
  );
  TestValidator.equals(
    "both locations are still staged",
    restaged.slate!.scenes.map((scene) => scene.id),
    ["int-kitchen", "ext-hallway"],
  );

  // 3. reading one location out of several
  TestValidator.equals(
    "a named location reads back",
    app.getScene({ slate: staged, scene: hallway.id }).scene,
    hallway,
  );
  TestValidator.equals(
    "a location the slate does not stage reads null",
    app.getScene({ slate: staged, scene: "int-cellar" }).scene,
    null,
  );
  TestValidator.predicate(
    "an unnamed read refuses once several are staged, listing them",
    (() => {
      try {
        app.getScene({ slate: staged });
        return false;
      } catch (exp) {
        const message = (exp as Error).message;
        return (
          message.includes("int-kitchen") && message.includes("ext-hallway")
        );
      }
    })(),
  );
  TestValidator.predicate(
    "an empty scene id is refused rather than read as absent",
    (() => {
      try {
        app.getScene({ slate: staged, scene: "   " });
        return false;
      } catch (exp) {
        return (exp as Error).message.includes("$input.scene");
      }
    })(),
  );
  TestValidator.equals(
    "one staged location still reads without naming it",
    app.getScene({ slate: base({ scenes: [kitchen] }) }).scene,
    kitchen,
  );

  // 3b. a shot whose scene is not even a string falls back to the staged set
  //     rather than resolving nothing
  const nonString = app.commitShot({
    slate: base({ scenes: [kitchen] }),
    shot: {
      ...shotIn("kitchen", kitchen.id),
      scene: 7 as unknown as string,
    },
  });
  TestValidator.equals(
    "a shot with a non-string scene is refused",
    nonString.committed,
    false,
  );

  // 4. the cast is placed across the film, not repeated in every location
  const withCast: IAutoMovieScript = {
    ...script,
    cast: [
      { node: "cook", character: "the cook", modelRef: null },
      { node: "runner", character: "the runner", modelRef: null },
    ],
  };
  const place = (scene: IAutoMovieScene, node: string): IAutoMovieScene => ({
    ...scene,
    nodes: [
      {
        id: node,
        model: `${node}-model`,
        transform: {
          translation: { x: 0, y: 0, z: 0 },
          rotation: { x: 0, y: 0, z: 0, w: 1 },
          scale: { x: 1, y: 1, z: 1 },
        },
        motion: null,
        pose: null,
      },
    ],
  });
  const cookHome = place(kitchen, "cook");
  const runnerHome = place(hallway, "runner");
  const half = app.commitScene({
    slate: base({ script: withCast, scenes: [runnerHome] }),
    scene: cookHome,
    models: [{ id: "cook-model", skeleton: null }],
  });
  TestValidator.equals(
    "a cast split across two locations stages",
    half.committed,
    true,
  );
  const orphan = app.commitScene({
    slate: base({ script: withCast, scenes: [] }),
    scene: cookHome,
    models: [{ id: "cook-model", skeleton: null }],
  });
  TestValidator.predicate(
    "a cast member no location places is still refused",
    orphan.committed === false &&
      JSON.stringify(orphan.validation).includes("runner"),
  );
};
