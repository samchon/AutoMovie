import { IAutoMovieScript } from "@automovie/interface";
import { AutoMovieProject, IAutoMovieMcpWritableSlate } from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { throwsError } from "../internal/predicates";

const scriptOf = (logline: string): IAutoMovieScript => ({
  logline,
  theme: "durability",
  cast: [],
  beats: [
    { id: "beat-1", name: "the beat", summary: "one beat", durationHint: 1 },
  ],
});

const slateOf = (logline: string): IAutoMovieMcpWritableSlate => ({
  script: scriptOf(logline),
  scene: null,
  shots: [],
  beatEnds: [],
  notes: [],
  film: null,
});

/**
 * Resident-project mutations are transactional cycles with cross-session
 * optimistic concurrency (#1133). Two failure shapes used to corrupt the one
 * durable memory: a save that threw mid-sequence persisted a torn subset
 * (script rewritten, shots not yet reconciled), and two live sessions on one
 * directory interleaved at file granularity with the last writer silently
 * winning per file. Saves now stage every serialized slice in memory before the
 * first byte lands, and flush under a commit lock against a monotonic revision
 * counter.
 *
 * Scenarios:
 *
 * 1. A save cycle that throws during staging (a slate carrying an unserializable
 *    value) persists NOTHING — the previously committed script survives
 *    byte-identical and the revision does not move.
 * 2. Two stores on one directory: after session B commits, session A's stale-based
 *    save is REFUSED with the re-read prompt and writes nothing; after A
 *    re-reads, the same save commits (negative twin).
 * 3. Single-session cycles are unaffected: read → save → read round-trips, bumping
 *    the revision once per mutation.
 */
export const test_mcp_project_transactions = (): void => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "automovie-txn-"));
  try {
    const a = AutoMovieProject.open(root);
    a.writableSlate();
    a.saveSlate(slateOf("the committed truth"));
    const scriptFile = path.join(root, "script.json");
    const committed = fs.readFileSync(scriptFile, "utf8");
    const revisionFile = path.join(root, "revision.json");
    const revisionAfterFirst = fs.readFileSync(revisionFile, "utf8");

    // 1. a staging throw persists nothing
    const cyclic = slateOf("never lands");
    // a self-referential SLICE: serialization (the staging step) throws
    (cyclic.script as unknown as { loop?: unknown }).loop = cyclic.script;
    a.writableSlate();
    TestValidator.predicate(
      "an unserializable slate throws during staging",
      throwsError(() => a.saveSlate(cyclic), "circular"),
    );
    TestValidator.equals(
      "the committed script survives byte-identical",
      fs.readFileSync(scriptFile, "utf8"),
      committed,
    );
    TestValidator.equals(
      "the revision does not move on a failed cycle",
      fs.readFileSync(revisionFile, "utf8"),
      revisionAfterFirst,
    );

    // 2. a concurrent session's commit refuses the stale writer
    const b = AutoMovieProject.open(root);
    a.writableSlate(); // A synchronizes at the current revision
    b.writableSlate();
    b.saveSlate(slateOf("session B got here first"));
    TestValidator.predicate(
      "a stale-based save refuses with the re-read prompt",
      throwsError(
        () => a.saveSlate(slateOf("session A, stale")),
        ["another session committed", "re-read", "nothing was written"],
      ),
    );
    TestValidator.predicate(
      "the refused save writes nothing",
      fs.readFileSync(scriptFile, "utf8").includes("session B got here first"),
    );
    // negative twin: after re-reading, the same save commits
    a.writableSlate();
    a.saveSlate(slateOf("session A, rebased"));
    TestValidator.predicate(
      "a rebased save commits",
      fs.readFileSync(scriptFile, "utf8").includes("session A, rebased"),
    );

    // 3. the single-session round trip bumps the revision once per mutation
    const before = JSON.parse(fs.readFileSync(revisionFile, "utf8")) as {
      revision: number;
    };
    a.saveSlate(slateOf("one more cycle"));
    const after = JSON.parse(fs.readFileSync(revisionFile, "utf8")) as {
      revision: number;
    };
    TestValidator.equals(
      "each committed cycle bumps the revision exactly once",
      after.revision,
      before.revision + 1,
    );
    TestValidator.equals(
      "the round trip reads back the committed truth",
      a.writableSlate().script?.logline,
      "one more cycle",
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
};
