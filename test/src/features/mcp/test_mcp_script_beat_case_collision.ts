import { IAutoMovieScript } from "@automovie/interface";
import { AutoMovieApplication } from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { hasViolation } from "../internal/predicates";

const makeScript = (beatIds: [string, string]): IAutoMovieScript => ({
  logline: "two beats one letter apart",
  theme: "identity",
  cast: [],
  beats: beatIds.map((id, i) => ({
    id,
    name: `beat ${i + 1}`,
    summary: `the ${i === 0 ? "first" : "second"} beat`,
    durationHint: 1,
  })),
});

/**
 * Beat ids become per-beat slice FILENAMES (`shots/<beat>.json`,
 * `beatEnds/<beat>.json`), so ids differing only by case collide on a
 * case-insensitive filesystem. Before #1096 the collision passed `commitScript`
 * and `commitShot`'s validation, then surfaced as the store's RAW mid-save
 * throw at the second beat's `commitShot` — after the non-keyed slices were
 * already rewritten — leaving that beat permanently uncommittable while
 * `nextSteps` kept prescribing it. The gate now refuses at the source.
 *
 * Scenarios:
 *
 * 1. `commitScript` with beats "Beat" and "beat" refuses with a type violation at
 *    the SECOND beat's id, naming both ids; nothing is persisted.
 * 2. Negative twin: ids one character apart ("beat-a", "beat-b") commit fine.
 * 3. Exact duplicates keep their existing dedicated violation (the case gate does
 *    not double-report them).
 */
export const test_mcp_script_beat_case_collision = (): void => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "automovie-beatcase-"));
  try {
    const app = new AutoMovieApplication();
    app.openProject({ root });

    // 1. the case-variant pair refuses at the source
    const collided = app.commitScript({ script: makeScript(["Beat", "beat"]) });
    TestValidator.equals(
      "case-variant beat ids refuse to commit",
      collided.committed,
      false,
    );
    TestValidator.predicate(
      "the collision is located at the second beat's id and names both",
      hasViolation(collided.validation, "type", "$input.script.beats[1].id") &&
        collided.validation.success === false &&
        collided.validation.violations.some(
          (v) => v.expected.includes('"Beat"') && v.expected.includes('"beat"'),
        ),
    );
    TestValidator.equals(
      "a refused script persists nothing",
      fs.existsSync(path.join(root, "script.json")),
      false,
    );

    // 2. negative twin: genuinely distinct ids commit
    const fine = app.commitScript({ script: makeScript(["beat-a", "beat-b"]) });
    TestValidator.equals("distinct beat ids commit", fine.committed, true);

    // 3. exact duplicates stay the dedicated duplicate violation
    const exact = app.commitScript({ script: makeScript(["beat", "beat"]) });
    TestValidator.equals("exact duplicates refuse", exact.committed, false);
    TestValidator.predicate(
      "exact duplicates report the duplicate rule, not the case rule",
      exact.validation.success === false &&
        exact.validation.violations.some(
          (v) =>
            v.path === "$input.script.beats[1].id" &&
            !v.expected.includes("case-insensitively"),
        ),
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
};
