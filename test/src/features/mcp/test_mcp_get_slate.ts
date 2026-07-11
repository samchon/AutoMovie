import { IAutoMovieScript, IAutoMovieSequence } from "@automovie/interface";
import {
  AutoMovieApplication,
  IAutoMovieMcpWritableSlate,
} from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { throwsError } from "../internal/predicates";

const script: IAutoMovieScript = {
  logline: "a crate stacks",
  theme: "balance",
  cast: [],
  beats: [
    { id: "b1", name: "stack", summary: "crates stack up", durationHint: 3 },
  ],
};

const film: IAutoMovieSequence = {
  id: "seq-1",
  name: null,
  shots: [{ shot: "shot:b1", trim: null, transition: null }],
  fps: 24,
};

/**
 * `getSlate` (#1174) is the whole-slate read the cross-session revision guard
 * (#1133) already told agents to call ("re-read via getSlate") before the tool
 * existed. It returns every slice plus the film in one call.
 *
 * Scenarios:
 *
 * 1. Resident: after a commitScript, `getSlate({})` reads the whole resident slate
 *    — script present, film null (nothing cut yet), other slices empty.
 * 2. Explicit: a passed writable slate (with a film) is echoed back verbatim,
 *    ignoring any resident project.
 * 3. Without an active project, omitting the slate throws the actionable
 *    "openProject first" error rather than returning an empty slate.
 */
export const test_mcp_get_slate = (): void => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "automovie-getslate-"));
  try {
    const app = new AutoMovieApplication();
    app.openProject({ root });
    app.commitScript({ script });

    // 1. resident whole-slate read.
    const resident = app.getSlate({}).slate;
    TestValidator.equals(
      "resident getSlate reads the committed script",
      resident.script,
      script,
    );
    TestValidator.equals("no film until CUT commits", resident.film, null);
    TestValidator.equals(
      "empty slices read as empty, not missing",
      [resident.shots.length, resident.beatEnds.length, resident.notes.length],
      [0, 0, 0],
    );

    // 2. explicit slate is echoed verbatim, resident project ignored.
    const explicit: IAutoMovieMcpWritableSlate = {
      script: { ...script, theme: "explicit" },
      scene: null,
      shots: [],
      beatEnds: [],
      notes: [],
      film,
    };
    TestValidator.equals(
      "explicit getSlate echoes the passed slate",
      app.getSlate({ slate: explicit }).slate,
      explicit,
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }

  // 3. no project + no slate → actionable throw, not a silent empty slate.
  TestValidator.predicate(
    "getSlate without a project throws the openProject prompt",
    throwsError(() => new AutoMovieApplication().getSlate({}), ["openProject"]),
  );
};
