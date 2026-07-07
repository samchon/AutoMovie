import { readSlateContext } from "@automovie/engine";
import {
  IAutoMovieBeatEndState,
  IAutoMovieReviewNote,
  IAutoMovieScene,
  IAutoMovieShot,
  IAutoMovieSlate,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { makeScriptWrite } from "../internal/filmFixtures";
import { IDENTITY_TRANSFORM } from "../internal/fixtures";
import { throwsError } from "../internal/predicates";

const scene: IAutoMovieScene = {
  id: "scene",
  name: null,
  nodes: [],
  cameras: [],
  lights: [],
};

const shot: IAutoMovieShot = {
  id: "shot:beat-1",
  name: null,
  scene: "scene",
  camera: "cam",
  cameraMotion: null,
  performances: [],
  objectMotions: [],
  duration: 1,
};

const noteA: IAutoMovieReviewNote = {
  beat: "beat-1",
  tier: "physical",
  issue: "foot slide",
  suggestion: "pin the plant",
};

const noteB: IAutoMovieReviewNote = {
  beat: "beat-2",
  tier: "visual",
  issue: "camera misses the hit",
  suggestion: "reframe tighter",
};

const beatEnd: IAutoMovieBeatEndState = {
  beat: "beat-1",
  shot: "shot:beat-1",
  actors: [
    {
      node: "hero",
      transform: IDENTITY_TRANSFORM,
      facing: { x: 0, y: 0, z: 1 },
      pose: null,
      motion: null,
      localTime: 1,
      gaitPhase: null,
      rootVelocity: null,
      footPlants: null,
      mount: null,
    },
  ],
};

const script = makeScriptWrite();

const slate: IAutoMovieSlate = {
  brief: "make a duel",
  script,
  scene,
  shots: [shot],
  beatEnds: [beatEnd],
  notes: [noteA, noteB],
  film: null,
};

/**
 * Stored context requests should be plain slate lookups: no model invention, no
 * geometry solving. Missing singleton slices return `null`; note filters return
 * an array, empty when nothing matches.
 */
export const test_film_slate_context = (): void => {
  TestValidator.equals(
    "script request reads the script",
    readSlateContext(slate, { type: "getScript" }),
    script,
  );
  TestValidator.equals(
    "scene request reads the staged scene",
    readSlateContext(slate, { type: "getScene" }),
    scene,
  );
  TestValidator.equals(
    "shot request reads by beat id",
    readSlateContext(slate, { type: "getShot", beat: "beat-1" }),
    shot,
  );
  TestValidator.equals(
    "missing shot returns null",
    readSlateContext(slate, { type: "getShot", beat: "beat-404" }),
    null,
  );
  TestValidator.equals(
    "notes request without beat returns all notes",
    readSlateContext(slate, { type: "getNotes" }),
    [noteA, noteB],
  );
  TestValidator.equals(
    "notes request filters by beat",
    readSlateContext(slate, { type: "getNotes", beat: "beat-1" }),
    [noteA],
  );
  TestValidator.equals(
    "missing note filter returns empty array",
    readSlateContext(slate, { type: "getNotes", beat: "beat-404" }),
    [],
  );
  TestValidator.equals(
    "beat-end request reads by beat id",
    readSlateContext(slate, { type: "getBeatEnd", beat: "beat-1" }),
    beatEnd,
  );
  TestValidator.equals(
    "missing beat-end returns null",
    readSlateContext(slate, { type: "getBeatEnd", beat: "beat-404" }),
    null,
  );
  TestValidator.equals(
    "absent script remains null",
    readSlateContext({ ...slate, script: null }, { type: "getScript" }),
    null,
  );
  TestValidator.predicate(
    "duplicate shot lookup rejects ambiguous beat",
    throwsError(
      () =>
        readSlateContext(
          { ...slate, shots: [shot, { ...shot, duration: 2 }] },
          { type: "getShot", beat: "beat-1" },
        ),
      ['shot id "shot:beat-1"', "slate.shots[1].id"],
    ),
  );
  TestValidator.predicate(
    "duplicate beat-end lookup rejects ambiguous beat",
    throwsError(
      () =>
        readSlateContext(
          { ...slate, beatEnds: [beatEnd, { ...beatEnd, actors: [] }] },
          { type: "getBeatEnd", beat: "beat-1" },
        ),
      ['beat end "beat-1"', "slate.beatEnds[1].beat"],
    ),
  );
};
