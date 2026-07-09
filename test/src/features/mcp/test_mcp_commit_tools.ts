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
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

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

const expectResidentMalformedRequestRoot = (
  title: string,
  call: (
    app: AutoMovieApplication,
  ) => ReturnType<AutoMovieApplication["commitScript"]>,
): void => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "automovie-commit-root-"));
  try {
    const resident = new AutoMovieApplication();
    resident.openProject({ root });
    const output = call(resident);
    TestValidator.equals(`${title} not committed`, output.committed, false);
    TestValidator.equals(`${title} slate unchanged`, output.slate, emptySlate);
    TestValidator.predicate(
      `${title} path`,
      hasPath(output.validation, "$input"),
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
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
  expectResidentMalformedRequestRoot(
    "commitScript malformed request root",
    (resident) => resident.commitScript(null as never),
  );
  expectResidentMalformedRequestRoot(
    "commitScene malformed request root",
    (resident) => resident.commitScene(null as never),
  );
  expectResidentMalformedRequestRoot(
    "commitShot malformed request root",
    (resident) => resident.commitShot(null as never),
  );
  expectResidentMalformedRequestRoot(
    "commitBeatEnd malformed request root",
    (resident) => resident.commitBeatEnd(null as never),
  );
  expectResidentMalformedRequestRoot(
    "commitNotes malformed request root",
    (resident) => resident.commitNotes(null as never),
  );
  expectResidentMalformedRequestRoot(
    "commitFilm malformed request root",
    (resident) => resident.commitFilm(null as never),
  );

  expectRefused(
    "scene before script",
    app.commitScene({ slate: emptySlate, scene: staged.scene, models }),
    "$slate.script",
    emptySlate,
  );
  expectRefused(
    "empty-beat script",
    app.commitScript({ slate: emptySlate, script: { ...script, beats: [] } }),
    "$input.script.beats",
    emptySlate,
  );
  expectRefused(
    "malformed script root",
    app.commitScript({
      slate: emptySlate,
      script: null as unknown as IAutoMovieScript,
    }),
    "$input.script",
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
    "$input.script.cast",
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
    "$input.script.beats",
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
        hasPath(output.validation, "$input.script.cast[0]") &&
        hasPath(output.validation, "$input.script.beats[0]")
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
    "$input.script.tree",
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
    "$input.script.tree",
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
        hasPath(output.validation, "$input.script.logline") &&
        hasPath(output.validation, "$input.script.theme") &&
        hasPath(output.validation, "$input.script.cast[0].character") &&
        hasPath(output.validation, "$input.script.cast[0].modelRef") &&
        hasPath(output.validation, "$input.script.cast[1].node") &&
        hasPath(output.validation, "$input.script.beats[0].durationHint") &&
        hasPath(output.validation, "$input.script.beats[1].id")
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
    "$input.scene.nodes",
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
    "$input.scene.nodes[0].model",
    scripted.slate,
  );
  expectRefused(
    "scene malformed model registry",
    app.commitScene({
      slate: scripted.slate,
      scene: staged.scene,
      models: [null as unknown as (typeof models)[number]],
    }),
    "$input.models[0]",
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
    "malformed shot root",
    app.commitShot({
      slate: stagedSlate,
      shot: null as unknown as IAutoMovieShot,
    }),
    "$input.shot",
    stagedSlate,
  );
  expectRefused(
    "shot id without beat",
    app.commitShot({ slate: stagedSlate, shot: { ...shot, id: "shot:" } }),
    "$input.shot.id",
    stagedSlate,
  );
  expectRefused(
    "unknown beat shot",
    app.commitShot({
      slate: stagedSlate,
      shot: { ...shot, id: "shot:missing" },
    }),
    "$input.shot.id",
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
        hasPath(output.validation, "$input.shot.camera") &&
        hasPath(output.validation, "$input.shot.performances[0].motion") &&
        hasPath(output.validation, "$input.shot.performances[0].startOffset")
      );
    })(),
  );
  expectRefused(
    "malformed shot motion registry",
    app.commitShot({
      slate: stagedSlate,
      shot,
      motions: null as unknown as Record<string, never>,
    }),
    "$input.motions",
    stagedSlate,
  );
  TestValidator.predicate(
    "resident malformed shot performances returns validation",
    (() => {
      const root = fs.mkdtempSync(
        path.join(os.tmpdir(), "automovie-commit-shot-shape-"),
      );
      const resident = new AutoMovieApplication();
      resident.openProject({ root });
      resident.commitScript({ script });
      resident.commitScene({ scene: staged.scene, models });
      const output = resident.commitShot({
        shot: {
          ...shot,
          performances:
            "NOT_ARRAY" as unknown as IAutoMovieShot["performances"],
        },
      });
      return (
        !output.committed &&
        hasPath(output.validation, "$input.shot.performances")
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
  expectRefused(
    "malformed beat end root",
    app.commitBeatEnd({
      slate: revisedShotSlate,
      beatEnd: null as unknown as IAutoMovieBeatEndState,
    }),
    "$input.beatEnd",
    revisedShotSlate,
  );
  expectRefused(
    "malformed beat end actors array",
    app.commitBeatEnd({
      slate: revisedShotSlate,
      beatEnd: {
        ...beatEnd,
        actors: "NOT_ARRAY" as unknown as IAutoMovieBeatEndState["actors"],
      },
    }),
    "$input.beatEnd.actors",
    revisedShotSlate,
  );
  {
    const malformedShotSlate = {
      ...revisedShotSlate,
      shots: "NOT_ARRAY" as unknown as IAutoMovieMcpWritableSlate["shots"],
    };
    expectRefused(
      "beat end malformed slate shots",
      app.commitBeatEnd({ slate: malformedShotSlate, beatEnd }),
      "$slate.shots",
      malformedShotSlate,
    );
  }
  {
    const malformedShotPerformanceSlate = {
      ...revisedShotSlate,
      shots: [
        {
          ...revisedShot,
          performances:
            "NOT_ARRAY" as unknown as IAutoMovieShot["performances"],
        },
      ],
    };
    expectRefused(
      "beat end malformed committed shot performances",
      app.commitBeatEnd({
        slate: malformedShotPerformanceSlate,
        beatEnd: {
          ...beatEnd,
          actors: [{ ...beatEnd.actors[0]!, motion: "missing-motion" }],
        },
      }),
      "$slate.shots[0].performances",
      malformedShotPerformanceSlate,
    );
  }
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
        hasPath(output.validation, "$input.beatEnd.actors[1].node") &&
        hasPath(output.validation, "$input.beatEnd.actors[0].node") &&
        hasPath(output.validation, "$input.beatEnd.actors[0].motion") &&
        hasPath(output.validation, "$input.beatEnd.actors[0].localTime")
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
  expectRefused(
    "malformed notes array",
    app.commitNotes({
      slate: beatEndSlate,
      notes: "NOT_ARRAY" as unknown as IAutoMovieReviewNote[],
    }),
    "$input.notes",
    beatEndSlate,
  );
  TestValidator.predicate(
    "malformed note entry returns validation",
    (() => {
      const output = app.commitNotes({
        slate: beatEndSlate,
        notes: [null as unknown as IAutoMovieReviewNote],
      });
      return !output.committed && hasPath(output.validation, "$input.notes[0]");
    })(),
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
    "malformed film root",
    app.commitFilm({
      slate: stagedSlate,
      film: null as unknown as IAutoMovieSequence,
    }),
    "$input.film",
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
    "$input.film.shots",
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
