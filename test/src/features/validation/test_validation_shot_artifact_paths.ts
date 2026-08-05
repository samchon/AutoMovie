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

/** A scene the shot validator cross-references without complaint. */
const scene = (): IAutoMovieScene =>
  ({
    id: "sc",
    nodes: [{ id: "hero", model: "m", transform: transform() }],
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
    ],
  }) as unknown as IAutoMovieScene;

/** A shot the validator accepts, so each case reports only what it broke. */
const shot = (overrides: Record<string, unknown> = {}): IAutoMovieShot =>
  ({
    id: "opening",
    scene: "sc",
    camera: "cam",
    duration: 2,
    performances: [],
    ...overrides,
  }) as unknown as IAutoMovieShot;

/** An event the validator accepts, so a case reports only what it broke. */
const event = (overrides: Record<string, unknown> = {}): unknown => ({
  id: "contact-1",
  kind: "contact",
  source: "collisionSolver",
  time: 1,
  actor: null,
  target: null,
  object: null,
  reaction: null,
  point: null,
  actionIndex: null,
  ...overrides,
});

const pathsOf = (validation: IAutoMovieValidation): string[] =>
  validation.success === true
    ? []
    : validation.violations.map((violation) => violation.path);

interface IShotCase {
  title: string;
  shot: IAutoMovieShot;
  path: string;
}

/**
 * The located violation the engine's shot artifact validator reports for each
 * malformed field.
 *
 * The validator is the one definition of a valid shot, shared by the producer
 * and by every gate that accepts one, and its negative branches carried no
 * test: it sat at 71.73% statements under the repository's coverage gate while
 * every caller only ever handed it valid input. A gate that has never refused
 * anything is a gate nobody has checked.
 *
 * Each case asserts the exact violation path, because a violation whose path is
 * wrong is worse than a missing one: it sends the author to a field that is
 * fine.
 *
 * Scenarios:
 *
 * 1. Identity: a blank id, a scene that is not the scene beside it, and a camera
 *    no scene camera supplies.
 * 2. Duration: a non-positive span.
 * 3. Performances: a non-object entry, a blank node, a node the scene does not
 *    stage, and a motion outside the registry the caller resolved.
 * 4. Coverage and camera intent: a non-object coverage entry, and an intent whose
 *    framing, focal length, or start is out of shape.
 */
export const test_validation_shot_artifact_paths = (): void => {
  const cases: IShotCase[] = [
    {
      title: "a blank shot id",
      shot: shot({ id: "  " }),
      path: "$input.id",
    },
    {
      title: "a shot naming another scene",
      shot: shot({ scene: "other" }),
      path: "$input.scene",
    },
    {
      title: "a shot naming an absent camera",
      shot: shot({ camera: "absent" }),
      path: "$input.camera",
    },
    {
      title: "a non-positive duration",
      shot: shot({ duration: 0 }),
      path: "$input.duration",
    },
    {
      title: "a non-object performance",
      shot: shot({ performances: [7] }),
      path: "$input.performances[0]",
    },
    {
      title: "a performance with a blank node",
      shot: shot({ performances: [{ node: " ", motion: null }] }),
      path: "$input.performances[0].node",
    },
    {
      title: "a performance naming a node the scene does not stage",
      shot: shot({ performances: [{ node: "ghost", motion: null }] }),
      path: "$input.performances[0].node",
    },
    {
      title: "a performance starting after the shot ends",
      shot: shot({
        performances: [{ node: "hero", motion: null, startOffset: 9 }],
      }),
      path: "$input.performances[0].startOffset",
    },
    {
      title: "a performance naming a motion outside the resolved registry",
      shot: shot({
        performances: [{ node: "hero", motion: "sprint", startOffset: 0 }],
      }),
      path: "$input.performances[0].motion",
    },
    {
      title: "an absent cameraMotion, which is not an explicit null",
      shot: shot({ cameraMotion: undefined }),
      path: "$input.cameraMotion",
    },
    {
      title: "duplicate object motion clip ids",
      shot: shot({
        cameraMotion: null,
        objectMotions: [{ id: "twin" }, { id: "twin" }],
      }),
      path: "$input.objectMotions",
    },
    {
      title: "an events field that is not an array",
      shot: shot({ events: 7 }),
      path: "$input.events",
    },
    {
      title: "a non-object event entry",
      shot: shot({ events: [7] }),
      path: "$input.events[0]",
    },
    {
      title: "an event with a blank id",
      shot: shot({ events: [event({ id: " " })] }),
      path: "$input.events[0].id",
    },
    {
      title: "an event whose kind is not one the engine emits",
      shot: shot({ events: [event({ kind: "sneeze" })] }),
      path: "$input.events[0].kind",
    },
    {
      title: "an event whose source is not one the engine emits",
      shot: shot({ events: [event({ source: "vibes" })] }),
      path: "$input.events[0].source",
    },
    {
      title: "an event timed outside the shot's own clock",
      shot: shot({ events: [event({ time: 9 })] }),
      path: "$input.events[0].time",
    },
    {
      title: "an event timed before the shot starts",
      shot: shot({ events: [event({ time: -1 })] }),
      path: "$input.events[0].time",
    },
    {
      title: "an event naming a blank actor",
      shot: shot({ events: [event({ actor: " " })] }),
      path: "$input.events[0].actor",
    },
    {
      title: "an event whose contact point is not a finite vector",
      shot: shot({
        events: [event({ point: { x: Number.NaN, y: 0, z: 0 } })],
      }),
      path: "$input.events[0].point",
    },
    {
      title: "an event whose action index is not a whole number",
      shot: shot({ events: [event({ actionIndex: 1.5 })] }),
      path: "$input.events[0].actionIndex",
    },
  ];
  TestValidator.equals(
    "the shot validator reports the located violation for each malformed field",
    namedFacts(
      cases.map(
        (entry) =>
          [
            entry.title,
            (): boolean => {
              const reported = pathsOf(
                validateShotArtifact(entry.shot, scene(), new Set(["walk"])),
              );
              // A prefix, because a uniqueness violation locates the entry it
              // found second (`$input.objectMotions[1].id`) while the field
              // this case names is the list itself.
              return reported.some((reportedPath) =>
                reportedPath.startsWith(entry.path),
              );
            },
          ] as const,
      ),
    ),
    Object.fromEntries(cases.map((entry) => [entry.title, true])),
  );
  TestValidator.predicate(
    "a shot that is not an object is refused before any field is read",
    validateShotArtifact(null as unknown as IAutoMovieShot, scene(), null)
      .success === false,
  );
};
