import { IAutoMovieScript } from "@automovie/interface";
import { AutoMovieApplication } from "@automovie/mcp";
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

/**
 * Resident queries (#614): once a project is open, `get*` tools omitting their
 * slate read the resident project — so a long production never re-sends its
 * whole state per call — while explicit slates behave exactly as before and a
 * missing project fails with an actionable message.
 *
 * Scenarios:
 *
 * 1. After a resident commitScript, getScript with no slate reads the resident
 *    script; getShot with no slate reads resident shots (none → null).
 * 2. The explicit-slate path is byte-identical to the stateless contract: the same
 *    query against a hand-built slate ignores the resident project.
 * 3. Without an active project, omitting the slate throws the actionable
 *    "openProject first" error instead of a silent empty result.
 */
export const test_mcp_project_resident_query = (): void => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "automovie-query-"));
  try {
    const app = new AutoMovieApplication();
    app.openProject({ root });
    app.commitScript({ script });

    TestValidator.equals(
      "resident getScript reads the project",
      app.getScript({}).script,
      script,
    );
    TestValidator.equals(
      "resident getShot returns null for an unbuilt beat",
      app.getShot({ beat: "b1" }).shot,
      null,
    );

    const other: IAutoMovieScript = { ...script, theme: "explicit" };
    TestValidator.equals(
      "explicit slate wins over the resident project",
      app.getScript({
        slate: {
          script: other,
          scene: null,
          shots: [],
          beatEnds: [],
          notes: [],
        },
      }).script,
      other,
    );

    const bare = new AutoMovieApplication();
    TestValidator.predicate(
      "no project + no slate is an actionable error",
      throwsError(() => bare.getScript({}), "openProject"),
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
};
