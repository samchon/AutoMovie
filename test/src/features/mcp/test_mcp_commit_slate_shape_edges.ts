import {
  IAutoMovieBeatEndState,
  IAutoMovieReviewNote,
  IAutoMovieScene,
  IAutoMovieScript,
  IAutoMovieSequence,
  IAutoMovieShot,
} from "@automovie/interface";
import {
  AutoMovieApplication,
  IAutoMovieMcpWritableSlate,
} from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { IDENTITY_TRANSFORM } from "../internal/fixtures";
import { hasViolation } from "../internal/predicates";

const app = new AutoMovieApplication();

const script: IAutoMovieScript = {
  logline: "a committed slate with malformed sibling slices",
  theme: "defensive shaping",
  cast: [{ node: "actor", character: "the actor", modelRef: null }],
  beats: [
    { id: "beat-1", name: "the beat", summary: "one beat", durationHint: 1 },
  ],
};

const scene: IAutoMovieScene = {
  id: "scene-1",
  name: null,
  nodes: [
    {
      id: "actor",
      model: "actor-model",
      transform: IDENTITY_TRANSFORM,
      motion: null,
      pose: null,
    },
  ],
  cameras: [
    {
      id: "camera",
      transform: IDENTITY_TRANSFORM,
      fovY: 45,
      near: 0.1,
      far: 100,
    },
  ],
  lights: [],
};

const shot: IAutoMovieShot = {
  id: "shot:beat-1",
  name: null,
  scene: scene.id,
  camera: "camera",
  cameraMotion: null,
  performances: [],
  objectMotions: [],
  duration: 1,
};

const film: IAutoMovieSequence = {
  id: "seq-1",
  name: null,
  fps: 24,
  shots: [{ shot: "shot:beat-1", trim: null, transition: null }],
};

const note: IAutoMovieReviewNote = {
  beat: "beat-1",
  tier: "structural",
  issue: "the beat needs work",
  suggestion: "revise the beat",
};

const slate = (
  over: Partial<IAutoMovieMcpWritableSlate>,
): IAutoMovieMcpWritableSlate => ({
  script,
  scene,
  shots: [shot],
  beatEnds: [],
  notes: [],
  film: null,
  ...over,
});

/**
 * CommitService slate/artifact shape guards the resident happy path never
 * reaches (#1040 coverage): every commit tolerates a malformed sibling slice by
 * degrading it to an empty set and locating the fault, rather than
 * dereferencing a non-array or a null entry; a successful upstream commit
 * reports the film it cleared in the digest.
 *
 * Scenarios:
 *
 * 1. `commitShot` degrades a non-array `slate.shots` to empty and locates the
 *    slice; a `slate.shots` with a null entry rejects at that index.
 * 2. `commitShot` locates a non-object `slate.scene` and a non-string shot id.
 * 3. `commitBeatEnd` degrades a non-array `slate.beatEnds` and a null entry, and
 *    rejects a beat absent from the committed script and a null actor entry.
 * 4. `commitNotes` and `commitFilm` degrade a non-array `slate.shots` to empty and
 *    locate the slice.
 * 5. `commitScript` over a slate that carried a film reports "film" among the
 *    cleared slices in its digest.
 * 6. A resident `setActorPerformance` with an empty beat resolves no shot and
 *    refuses.
 */
export const test_mcp_commit_slate_shape_edges = (): void => {
  // 1. commitShot malformed shots slice
  const nonArrayShots = app.commitShot({
    slate: slate({
      shots: "NOT_ARRAY" as unknown as IAutoMovieMcpWritableSlate["shots"],
    }),
    shot,
  });
  TestValidator.predicate(
    "commitShot locates a non-array shots slice",
    nonArrayShots.committed === false &&
      hasViolation(nonArrayShots.validation, "type", "$input.slate.shots"),
  );
  const nullShotEntry = app.commitShot({
    slate: slate({
      shots: [null] as unknown as IAutoMovieMcpWritableSlate["shots"],
    }),
    shot,
  });
  TestValidator.predicate(
    "commitShot rejects a null shots entry at its index",
    nullShotEntry.committed === false &&
      hasViolation(nullShotEntry.validation, "type", "$input.slate.shots[0]"),
  );

  // 2. commitShot malformed scene / shot id
  const nonObjectScene = app.commitShot({
    slate: slate({
      scene: "NOT_OBJECT" as unknown as IAutoMovieScene,
    }),
    shot,
  });
  TestValidator.predicate(
    "commitShot locates a non-object scene slice",
    nonObjectScene.committed === false &&
      hasViolation(nonObjectScene.validation, "type", "$input.slate.scene"),
  );
  const nonStringShotId = app.commitShot({
    slate: slate({}),
    shot: { ...shot, id: 42 as unknown as string },
  });
  TestValidator.predicate(
    "commitShot rejects a non-string shot id",
    nonStringShotId.committed === false &&
      hasViolation(nonStringShotId.validation, "type", "$input.shot.id"),
  );

  // 3. commitBeatEnd malformed beatEnds / dangling beat / null actor
  const nonArrayBeatEnds = app.commitBeatEnd({
    slate: slate({
      beatEnds:
        "NOT_ARRAY" as unknown as IAutoMovieMcpWritableSlate["beatEnds"],
    }),
    beatEnd: { beat: "beat-1", shot: "shot:beat-1", actors: [] },
  });
  TestValidator.predicate(
    "commitBeatEnd locates a non-array beatEnds slice",
    nonArrayBeatEnds.committed === false &&
      hasViolation(
        nonArrayBeatEnds.validation,
        "type",
        "$input.slate.beatEnds",
      ),
  );
  const nullBeatEndEntry = app.commitBeatEnd({
    slate: slate({
      beatEnds: [null] as unknown as IAutoMovieMcpWritableSlate["beatEnds"],
    }),
    beatEnd: { beat: "beat-1", shot: "shot:beat-1", actors: [] },
  });
  TestValidator.predicate(
    "commitBeatEnd rejects a null beatEnds entry at its index",
    nullBeatEndEntry.committed === false &&
      hasViolation(
        nullBeatEndEntry.validation,
        "type",
        "$input.slate.beatEnds[0]",
      ),
  );
  const danglingBeat = app.commitBeatEnd({
    slate: slate({}),
    beatEnd: { beat: "ghost", shot: "shot:ghost", actors: [] },
  });
  TestValidator.predicate(
    "commitBeatEnd rejects a beat absent from the committed script",
    danglingBeat.committed === false &&
      hasViolation(danglingBeat.validation, "type", "$input.beatEnd.beat"),
  );
  const nullActorEntry = app.commitBeatEnd({
    slate: slate({}),
    beatEnd: {
      beat: "beat-1",
      shot: "shot:beat-1",
      actors: [null] as unknown as IAutoMovieBeatEndState["actors"],
    },
  });
  TestValidator.predicate(
    "commitBeatEnd rejects a null actor entry at its index",
    nullActorEntry.committed === false &&
      hasViolation(
        nullActorEntry.validation,
        "type",
        "$input.beatEnd.actors[0]",
      ),
  );

  // 4. commitNotes / commitFilm malformed shots slice
  const notesNonArrayShots = app.commitNotes({
    slate: slate({
      shots: "NOT_ARRAY" as unknown as IAutoMovieMcpWritableSlate["shots"],
    }),
    notes: [note],
  });
  TestValidator.predicate(
    "commitNotes locates a non-array shots slice",
    notesNonArrayShots.committed === false &&
      hasViolation(notesNonArrayShots.validation, "type", "$input.slate.shots"),
  );
  const filmNonArrayShots = app.commitFilm({
    review: "pre-commit self-check of the cut",
    slate: slate({
      shots: "NOT_ARRAY" as unknown as IAutoMovieMcpWritableSlate["shots"],
    }),
    film,
  });
  TestValidator.predicate(
    "commitFilm locates a non-array shots slice",
    filmNonArrayShots.committed === false &&
      hasViolation(filmNonArrayShots.validation, "type", "$input.slate.shots"),
  );

  // 5. a successful commitScript reports the cleared film in the digest
  const clearedFilm = app.commitScript({
    slate: slate({ shots: [], film }),
    script,
  });
  TestValidator.predicate(
    "commitScript clears a carried film and names it in the digest",
    clearedFilm.committed === true &&
      clearedFilm.state.cleared.includes("film"),
  );

  // 5b. re-committing a film over a slate that already carried one keeps the
  //     film present in the digest (the cleared-film check inspects the new
  //     non-null film without reporting it cleared).
  const refilm = app.commitFilm({
    review: "pre-commit self-check of the re-cut",
    slate: slate({ film }),
    film,
  });
  TestValidator.predicate(
    "re-committing a film keeps it present and uncleared",
    refilm.committed === true &&
      refilm.state.film === true &&
      !refilm.state.cleared.includes("film"),
  );

  // 6. a resident setActorPerformance with an empty beat resolves no shot
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "automovie-set-perf-"));
  try {
    const resident = new AutoMovieApplication();
    resident.openProject({ root });
    const updated = resident.setActorPerformance({
      beat: "",
      performance: { node: "actor", motion: null, startOffset: 0 },
      reason: "an empty beat resolves no shot",
    });
    TestValidator.equals(
      "an empty beat cannot resolve a shot to edit",
      updated.updated,
      false,
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
};
