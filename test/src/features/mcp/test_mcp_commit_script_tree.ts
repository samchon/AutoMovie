import { IAutoMovieScript, IAutoMovieScriptNode } from "@automovie/interface";
import { AutoMovieApplication } from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { makeScriptWrite } from "../internal/filmFixtures";

const base = makeScriptWrite();

/** A minimal intent→beat tree over the film fixture's beats. */
const tree = (): IAutoMovieScriptNode[] => [
  {
    id: "root",
    kind: "intent",
    parent: null,
    temporal: null,
    interactsWith: [],
    payload: { logline: base.logline, theme: base.theme },
  },
  ...base.beats.map(
    (beat, i): IAutoMovieScriptNode => ({
      id: `node-${beat.id}`,
      kind: "beat",
      parent: "root",
      temporal: i === 0 ? null : `node-${base.beats[i - 1]!.id}`,
      interactsWith: [],
      payload: {
        beat: beat.id,
        direction: beat.summary,
        dialogue: [{ speaker: "A", text: "En garde!", anchor: 0.25 }],
        caption: null,
      },
    }),
  ),
];

const script = (withTree: boolean): IAutoMovieScript => ({
  logline: base.logline,
  theme: base.theme,
  cast: base.cast,
  beats: base.beats,
  ...(withTree ? { tree: tree() } : {}),
});

/**
 * The screenplay tree rides the script slice through the whole commit path
 * (slice A of #606/#610/#620): the tree validates at commitScript's gate, the
 * committed slate carries it, getScript returns it intact, and the #614
 * write-through persists it inside `script.json` — the screenplay is a
 * first-class, durable, human-readable production document.
 *
 * Scenarios:
 *
 * 1. An explicit-slate commit with a valid tree succeeds; getScript on the
 *    returned slate hands the tree back intact.
 * 2. A malformed tree (a beat node naming a ghost beat) refuses the commit with a
 *    violation located under `$input.tree`.
 * 3. A treeless script commits exactly as before — byte-compatible legacy path.
 * 4. Resident path: openProject → commitScript with the tree → `script.json` on
 *    disk carries the tree verbatim.
 */
export const test_mcp_commit_script_tree = (): void => {
  const app = new AutoMovieApplication();
  const empty = {
    script: null,
    scene: null,
    shots: [],
    beatEnds: [],
    notes: [],
    film: null,
  };

  const committed = app.commitScript({ slate: empty, script: script(true) });
  TestValidator.equals("valid tree commits", committed.committed, true);
  const read = app.getScript({ slate: committed.slate });
  TestValidator.equals(
    "getScript hands the tree back intact",
    read.script?.tree,
    tree(),
  );

  const ghost: IAutoMovieScript = {
    ...script(true),
    tree: tree().map((n) =>
      n.kind === "beat"
        ? { ...n, payload: { ...n.payload, beat: "ghost" } }
        : n,
    ),
  };
  const refused = app.commitScript({ slate: empty, script: ghost });
  TestValidator.equals("malformed tree refused", refused.committed, false);
  TestValidator.predicate(
    "violation located under $input.tree",
    refused.validation.success === false &&
      refused.validation.violations.some((v) => v.path.includes("$input.tree")),
  );

  const legacy = app.commitScript({ slate: empty, script: script(false) });
  TestValidator.equals(
    "treeless script commits as before",
    legacy.committed,
    true,
  );
  TestValidator.equals(
    "legacy script carries no tree",
    app.getScript({ slate: legacy.slate }).script?.tree,
    undefined,
  );

  const root = fs.mkdtempSync(path.join(os.tmpdir(), "automovie-tree-"));
  try {
    const resident = new AutoMovieApplication();
    resident.openProject({ root });
    const wrote = resident.commitScript({ script: script(true) });
    TestValidator.equals("resident commit succeeds", wrote.committed, true);
    const persisted = JSON.parse(
      fs.readFileSync(path.join(root, "script.json"), "utf8"),
    ) as IAutoMovieScript;
    TestValidator.equals(
      "script.json carries the tree verbatim",
      persisted.tree,
      tree(),
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
};
