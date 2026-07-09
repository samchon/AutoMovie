import {
  IAutoMovieBeatEndState,
  IAutoMovieReviewNote,
  IAutoMovieShot,
} from "@automovie/interface";
import { AutoMovieApplication, IAutoMovieMcpStoredSlate } from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";

import { makeScriptWrite, makeStagingWrite } from "../internal/filmFixtures";
import { IDENTITY_TRANSFORM } from "../internal/fixtures";
import { throwsError } from "../internal/predicates";

const app = new AutoMovieApplication();
const script = makeScriptWrite();
const staged = app.stage({ script, staging: makeStagingWrite() }).staged;
if (staged.success !== true) throw new Error("staging fixture must succeed");

const shot: IAutoMovieShot = {
  id: "shot:beat-1",
  name: null,
  scene: staged.scene.id,
  camera: "cam-main",
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
  shot: shot.id,
  actors: [
    {
      node: "knightA",
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

const slate: IAutoMovieMcpStoredSlate = {
  script,
  scene: staged.scene,
  shots: [shot],
  beatEnds: [beatEnd],
  notes: [noteA, noteB],
};

/**
 * MCP query tools expose slate reads as named tools, not as hidden pipeline
 * assumptions.
 *
 * Scenarios:
 *
 * 1. Stored script, scene, shot, notes, and beat-end slices are returned in
 *    single-object MCP outputs.
 * 2. Missing singleton slices remain `null`, while filtered notes return an empty
 *    array.
 * 3. Ambiguous duplicate slate entries reject before an agent can commit work
 *    against the wrong context.
 * 4. Malformed explicit stored-slate collections reject with path-bearing errors
 *    before raw array iteration reaches the engine helper.
 * 5. Malformed explicit stored-slate roots reject before query helpers dereference
 *    slice fields.
 * 6. Malformed request roots reject before query helpers dereference request
 *    fields.
 */
export const test_mcp_query_tools = (): void => {
  TestValidator.equals("getScript", app.getScript({ slate }).script, script);
  TestValidator.equals("getScene", app.getScene({ slate }).scene, staged.scene);
  TestValidator.equals(
    "getShot",
    app.getShot({ slate, beat: "beat-1" }).shot,
    shot,
  );
  TestValidator.equals(
    "missing shot",
    app.getShot({ slate, beat: "missing" }).shot,
    null,
  );
  TestValidator.equals("getNotes all", app.getNotes({ slate }).notes, [
    noteA,
    noteB,
  ]);
  TestValidator.equals(
    "getNotes beat",
    app.getNotes({ slate, beat: "beat-1" }).notes,
    [noteA],
  );
  TestValidator.equals(
    "getNotes missing beat",
    app.getNotes({ slate, beat: "missing" }).notes,
    [],
  );
  TestValidator.equals(
    "getBeatEnd",
    app.getBeatEnd({ slate, beat: "beat-1" }).beatEnd,
    beatEnd,
  );
  TestValidator.equals(
    "missing beat end",
    app.getBeatEnd({ slate, beat: "missing" }).beatEnd,
    null,
  );
  TestValidator.equals(
    "absent scene",
    app.getScene({ slate: { ...slate, scene: null } }).scene,
    null,
  );
  TestValidator.predicate(
    "duplicate shot rejects",
    throwsError(
      () =>
        app.getShot({
          slate: { ...slate, shots: [shot, { ...shot, duration: 2 }] },
          beat: "beat-1",
        }),
      ['shot id "shot:beat-1"', "slate.shots[1].id"],
    ),
  );
  TestValidator.predicate(
    "duplicate beat end rejects",
    throwsError(
      () =>
        app.getBeatEnd({
          slate: { ...slate, beatEnds: [beatEnd, { ...beatEnd, actors: [] }] },
          beat: "beat-1",
        }),
      ['beat end "beat-1"', "slate.beatEnds[1].beat"],
    ),
  );
  TestValidator.predicate(
    "malformed shot collection rejects",
    throwsError(
      () =>
        app.getShot({
          slate: {
            ...slate,
            shots: null as unknown as IAutoMovieShot[],
          },
          beat: "beat-1",
        }),
      ["slate.shots", "array"],
    ),
  );
  TestValidator.predicate(
    "malformed notes collection rejects",
    throwsError(
      () =>
        app.getNotes({
          slate: {
            ...slate,
            notes: null as unknown as IAutoMovieReviewNote[],
          },
          beat: "beat-1",
        }),
      ["slate.notes", "array"],
    ),
  );
  TestValidator.predicate(
    "malformed beat end collection rejects",
    throwsError(
      () =>
        app.getBeatEnd({
          slate: {
            ...slate,
            beatEnds: null as unknown as IAutoMovieBeatEndState[],
          },
          beat: "beat-1",
        }),
      ["slate.beatEnds", "array"],
    ),
  );
  TestValidator.predicate(
    "malformed shot collection entry rejects",
    throwsError(
      () =>
        app.getShot({
          slate: {
            ...slate,
            shots: [null as unknown as IAutoMovieShot],
          },
          beat: "beat-1",
        }),
      ["slate.shots[0]", "JSON object"],
    ),
  );

  for (const [label, query] of [
    ["getScript", () => app.getScript({ slate: null as never })],
    ["getScene", () => app.getScene({ slate: null as never })],
    ["getShot", () => app.getShot({ slate: null as never, beat: "beat-1" })],
    ["getNotes", () => app.getNotes({ slate: null as never, beat: "beat-1" })],
    [
      "getBeatEnd",
      () => app.getBeatEnd({ slate: null as never, beat: "beat-1" }),
    ],
  ] as const)
    TestValidator.predicate(
      `${label} malformed slate root rejects`,
      throwsError(query, ["slate", "JSON object"]),
    );

  for (const [label, query] of [
    ["getScript", () => app.getScript(null as never)],
    ["getScene", () => app.getScene(null as never)],
    ["getShot", () => app.getShot(null as never)],
    ["getNotes", () => app.getNotes(null as never)],
    ["getBeatEnd", () => app.getBeatEnd(null as never)],
  ] as const)
    TestValidator.predicate(
      `${label} malformed request root rejects`,
      throwsError(query, ["$input", "JSON object"]),
    );
};
