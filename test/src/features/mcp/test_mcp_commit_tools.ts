import {
  IAutoMovieBeatEndState,
  IAutoMovieReviewNote,
  IAutoMovieScript,
  IAutoMovieSequence,
  IAutoMovieShot,
  IAutoMovieValidation,
} from "@automovie/interface";
import {
  AutoMovieApplication,
  IAutoMovieMcpWritableSlate,
} from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";

import { makeScriptWrite, makeStagingWrite } from "../internal/filmFixtures";
import { IDENTITY_TRANSFORM } from "../internal/fixtures";

const app = new AutoMovieApplication();
const scriptWrite = makeScriptWrite();
const script: IAutoMovieScript = {
  logline: scriptWrite.logline,
  theme: scriptWrite.theme,
  cast: scriptWrite.cast,
  beats: scriptWrite.beats,
};
const staged = app.stage({
  script: scriptWrite,
  staging: makeStagingWrite(),
}).staged;
if (staged.success !== true) throw new Error("staging fixture must succeed");

const models = [...new Set(staged.scene.nodes.map((node) => node.model))].map(
  (id) => ({ id, skeleton: null }),
);

const emptySlate: IAutoMovieMcpWritableSlate = {
  script: null,
  scene: null,
  shots: [],
  beatEnds: [],
  notes: [],
  film: null,
};

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

const note: IAutoMovieReviewNote = {
  beat: "beat-1",
  tier: "physical",
  issue: "foot slide",
  suggestion: "pin the plant foot",
};

const film: IAutoMovieSequence = {
  id: "seq-duel",
  name: "duel",
  fps: 24,
  shots: [{ shot: shot.id, trim: null, transition: null }],
};

const hasPath = (validation: IAutoMovieValidation, path: string): boolean =>
  validation.success === false &&
  validation.violations.some((violation) => violation.path.includes(path));

const expectRefused = (
  title: string,
  output: ReturnType<AutoMovieApplication["commitScript"]>,
  path: string,
  slate: IAutoMovieMcpWritableSlate,
): void => {
  TestValidator.equals(`${title} not committed`, output.committed, false);
  TestValidator.equals(`${title} slate unchanged`, output.slate, slate);
  TestValidator.predicate(`${title} path`, hasPath(output.validation, path));
};

/**
 * MCP commit tools keep slate writes ordered and atomic.
 *
 * Scenarios:
 *
 * 1. A scene, shot, beat end, note backlog, and film cannot commit before their
 *    upstream slices exist.
 * 2. Invalid artifacts return field-located diagnostics and leave the input slate
 *    unchanged.
 * 3. Successful commits return a new slate and clear downstream slices that would
 *    otherwise become stale.
 */
export const test_mcp_commit_tools = (): void => {
  expectRefused(
    "scene before script",
    app.commitScene({ slate: emptySlate, scene: staged.scene, models }),
    "$slate.script",
    emptySlate,
  );
  expectRefused(
    "empty-beat script",
    app.commitScript({ slate: emptySlate, script: { ...script, beats: [] } }),
    "$input.beats",
    emptySlate,
  );
  expectRefused(
    "malformed script root",
    app.commitScript({
      slate: emptySlate,
      script: null as unknown as IAutoMovieScript,
    }),
    "$input",
    emptySlate,
  );
  expectRefused(
    "malformed script cast array",
    app.commitScript({
      slate: emptySlate,
      script: {
        ...script,
        cast: null as unknown as IAutoMovieScript["cast"],
      },
    }),
    "$input.cast",
    emptySlate,
  );
  expectRefused(
    "malformed script beats array",
    app.commitScript({
      slate: emptySlate,
      script: {
        ...script,
        beats: null as unknown as IAutoMovieScript["beats"],
      },
    }),
    "$input.beats",
    emptySlate,
  );
  TestValidator.predicate(
    "malformed script entries return validation",
    (() => {
      const output = app.commitScript({
        slate: emptySlate,
        script: {
          ...script,
          cast: [null as unknown as IAutoMovieScript["cast"][number]],
          beats: [null as unknown as IAutoMovieScript["beats"][number]],
        },
      });
      return (
        !output.committed &&
        hasPath(output.validation, "$input.cast[0]") &&
        hasPath(output.validation, "$input.beats[0]")
      );
    })(),
  );
  expectRefused(
    "malformed script tree array",
    app.commitScript({
      slate: emptySlate,
      script: {
        ...script,
        tree: {} as unknown as NonNullable<IAutoMovieScript["tree"]>,
      },
    }),
    "$input.tree",
    emptySlate,
  );
  expectRefused(
    "malformed script tree entry",
    app.commitScript({
      slate: emptySlate,
      script: {
        ...script,
        tree: [null] as unknown as NonNullable<IAutoMovieScript["tree"]>,
      },
    }),
    "$input.tree",
    emptySlate,
  );
  TestValidator.predicate(
    "invalid script paths",
    (() => {
      const output = app.commitScript({
        slate: emptySlate,
        script: {
          logline: "",
          theme: "",
          cast: [
            { node: "dupe", character: "", modelRef: "" },
            { node: "dupe", character: "valid", modelRef: null },
          ],
          beats: [
            { id: "beat-x", name: "", summary: "", durationHint: 0 },
            { id: "beat-x", name: "again", summary: "again", durationHint: 1 },
          ],
        },
      });
      return (
        !output.committed &&
        hasPath(output.validation, "$input.logline") &&
        hasPath(output.validation, "$input.theme") &&
        hasPath(output.validation, "$input.cast[0].character") &&
        hasPath(output.validation, "$input.cast[0].modelRef") &&
        hasPath(output.validation, "$input.cast[1].node") &&
        hasPath(output.validation, "$input.beats[0].durationHint") &&
        hasPath(output.validation, "$input.beats[1].id")
      );
    })(),
  );

  const dirtySlate: IAutoMovieMcpWritableSlate = {
    script: null,
    scene: staged.scene,
    shots: [shot],
    beatEnds: [beatEnd],
    notes: [note],
    film,
  };
  const scripted = app.commitScript({ slate: dirtySlate, script });
  TestValidator.equals("script committed", scripted.committed, true);
  TestValidator.equals("script cascades stale slices", scripted.slate, {
    script,
    scene: null,
    shots: [],
    beatEnds: [],
    notes: [],
    film: null,
  });

  expectRefused(
    "scene missing cast node",
    app.commitScene({
      slate: scripted.slate,
      scene: {
        ...staged.scene,
        nodes: staged.scene.nodes.filter((node) => node.id !== "knightB"),
      },
      models,
    }),
    "$input.nodes",
    scripted.slate,
  );
  expectRefused(
    "scene missing model",
    app.commitScene({
      slate: scripted.slate,
      scene: {
        ...staged.scene,
        nodes: [{ ...staged.scene.nodes[0]!, model: "missing" }],
      },
      models,
    }),
    "$input.nodes[0].model",
    scripted.slate,
  );

  const stagedSlate = app.commitScene({
    slate: scripted.slate,
    scene: staged.scene,
    models,
  }).slate;
  TestValidator.equals("scene committed", stagedSlate.scene, staged.scene);

  expectRefused(
    "shot before script",
    app.commitShot({ slate: emptySlate, shot: { ...shot, id: "beat-1" } }),
    "$slate.script",
    emptySlate,
  );
  expectRefused(
    "shot before scene",
    app.commitShot({ slate: scripted.slate, shot }),
    "$slate.scene",
    scripted.slate,
  );
  expectRefused(
    "shot id without beat",
    app.commitShot({ slate: stagedSlate, shot: { ...shot, id: "shot:" } }),
    "$input.id",
    stagedSlate,
  );
  expectRefused(
    "unknown beat shot",
    app.commitShot({
      slate: stagedSlate,
      shot: { ...shot, id: "shot:missing" },
    }),
    "$input.id",
    stagedSlate,
  );
  TestValidator.predicate(
    "invalid shot paths",
    (() => {
      const output = app.commitShot({
        slate: stagedSlate,
        shot: {
          ...shot,
          camera: "missing",
          performances: [
            { node: "knightA", motion: "missing-motion", startOffset: 2 },
          ],
        },
        motions: {},
      });
      return (
        !output.committed &&
        hasPath(output.validation, "$input.camera") &&
        hasPath(output.validation, "$input.performances[0].motion") &&
        hasPath(output.validation, "$input.performances[0].startOffset")
      );
    })(),
  );

  const shotSlate = app.commitShot({ slate: stagedSlate, shot }).slate;
  TestValidator.equals("shot inserted", shotSlate.shots, [shot]);
  expectRefused(
    "duplicate committed shot",
    app.commitShot({ slate: { ...shotSlate, shots: [shot, shot] }, shot }),
    "$slate.shots[1].id",
    { ...shotSlate, shots: [shot, shot] },
  );
  const revisedShot = { ...shot, duration: 2 };
  const revisedShotSlate = app.commitShot({
    slate: { ...shotSlate, beatEnds: [beatEnd], film },
    shot: revisedShot,
  }).slate;
  TestValidator.equals("shot replace clears derived state", revisedShotSlate, {
    ...shotSlate,
    shots: [revisedShot],
    beatEnds: [],
    film: null,
  });

  expectRefused(
    "beat end before upstream",
    app.commitBeatEnd({
      slate: emptySlate,
      beatEnd: { ...beatEnd, beat: "ghost", shot: "wrong" },
    }),
    "$slate.script",
    emptySlate,
  );
  TestValidator.predicate(
    "invalid beat end paths",
    (() => {
      const output = app.commitBeatEnd({
        slate: revisedShotSlate,
        beatEnd: {
          ...beatEnd,
          actors: [
            {
              ...beatEnd.actors[0]!,
              node: "ghost",
              motion: "missing-motion",
              localTime: 3,
            },
            { ...beatEnd.actors[0]!, node: "ghost" },
          ],
        },
      });
      return (
        !output.committed &&
        hasPath(output.validation, "$input.actors[1].node") &&
        hasPath(output.validation, "$input.actors[0].node") &&
        hasPath(output.validation, "$input.actors[0].motion") &&
        hasPath(output.validation, "$input.actors[0].localTime")
      );
    })(),
  );
  expectRefused(
    "duplicate committed beat end",
    app.commitBeatEnd({
      slate: { ...revisedShotSlate, beatEnds: [beatEnd, beatEnd] },
      beatEnd,
    }),
    "$slate.beatEnds[1].beat",
    { ...revisedShotSlate, beatEnds: [beatEnd, beatEnd] },
  );
  const beatEndSlate = app.commitBeatEnd({
    slate: revisedShotSlate,
    beatEnd,
  }).slate;
  TestValidator.equals("beat end inserted", beatEndSlate.beatEnds, [beatEnd]);

  expectRefused(
    "notes before script",
    app.commitNotes({ slate: emptySlate, notes: [note] }),
    "$slate.script",
    emptySlate,
  );
  TestValidator.predicate(
    "invalid note paths",
    (() => {
      const output = app.commitNotes({
        slate: beatEndSlate,
        notes: [{ beat: "ghost", tier: "visual", issue: "", suggestion: "" }],
      });
      return (
        !output.committed &&
        hasPath(output.validation, "$input.notes[0].beat") &&
        hasPath(output.validation, "$input.notes[0].issue") &&
        hasPath(output.validation, "$input.notes[0].suggestion") &&
        hasPath(output.validation, "$slate.shots")
      );
    })(),
  );
  const notesSlate = app.commitNotes({
    slate: beatEndSlate,
    notes: [note],
  }).slate;
  TestValidator.equals("notes committed", notesSlate.notes, [note]);

  expectRefused(
    "film before upstream",
    app.commitFilm({ slate: emptySlate, film }),
    "$slate.script",
    emptySlate,
  );
  expectRefused(
    "film missing shot",
    app.commitFilm({ slate: stagedSlate, film: { ...film, shots: [] } }),
    "$slate.shots",
    stagedSlate,
  );
  expectRefused(
    "film malformed sequence shots",
    app.commitFilm({
      slate: stagedSlate,
      film: {
        ...film,
        shots: null as unknown as IAutoMovieSequence["shots"],
      },
    }),
    "$input.shots",
    stagedSlate,
  );
  expectRefused(
    "film with open notes",
    app.commitFilm({ slate: notesSlate, film }),
    "$slate.notes",
    notesSlate,
  );
  expectRefused(
    "film duplicate shots",
    app.commitFilm({
      slate: { ...beatEndSlate, shots: [revisedShot, revisedShot] },
      film,
    }),
    "$slate.shots[1].id",
    { ...beatEndSlate, shots: [revisedShot, revisedShot] },
  );
  expectRefused(
    "film scene mismatch",
    app.commitFilm({
      slate: {
        ...beatEndSlate,
        shots: [{ ...revisedShot, scene: "wrong-scene" }],
      },
      film,
    }),
    "$slate.shots[0].scene",
    { ...beatEndSlate, shots: [{ ...revisedShot, scene: "wrong-scene" }] },
  );

  const clearedNotesSlate = app.commitNotes({
    slate: notesSlate,
    notes: [],
  }).slate;
  const filmSlate = app.commitFilm({ slate: clearedNotesSlate, film }).slate;
  TestValidator.equals("film committed", filmSlate.film, film);
};
