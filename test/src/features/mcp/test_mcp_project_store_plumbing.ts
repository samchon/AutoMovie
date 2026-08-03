import {
  IAutoMovieBeatEndState,
  IAutoMovieScript,
  IAutoMovieSequence,
  IAutoMovieShot,
} from "@automovie/interface";
import { AutoMovieProject, IAutoMovieMcpWritableSlate } from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { throwsError } from "../internal/predicates";

interface IProjectStorePlumbingFixtureFailure {
  error: unknown;
}

class ProjectStorePlumbingFixtureCleanupError extends AggregateError {}

/** Remove one plumbing root without replacing its primary failure. */
export const preserveProjectStorePlumbingFixtureCleanup = (
  failure: IProjectStorePlumbingFixtureFailure | undefined,
  cleanup: () => unknown,
  resource: string,
): void => {
  try {
    cleanup();
  } catch (cleanupFailure) {
    if (failure === undefined) throw cleanupFailure;
    throw new ProjectStorePlumbingFixtureCleanupError(
      [failure.error, cleanupFailure],
      `Project-store ${resource} fixture cleanup failed after the test failed.`,
    );
  }
};

const shotOf = (id: string): IAutoMovieShot => ({
  id,
  name: null,
  scene: "scene-1",
  camera: "cam",
  cameraMotion: null,
  performances: [],
  objectMotions: [],
  duration: 1,
});

const beatEndOf = (beat: string): IAutoMovieBeatEndState => ({
  beat,
  shot: `shot:${beat}`,
  actors: [],
});

const slateWith = (
  partial: Partial<IAutoMovieMcpWritableSlate>,
): IAutoMovieMcpWritableSlate => ({
  script: null,
  scenes: [],
  shots: [],
  beatEnds: [],
  notes: [],
  film: null,
  ...partial,
});

const script: IAutoMovieScript = {
  logline: "a door opens",
  theme: "curiosity",
  cast: [],
  beats: [
    { id: "b1", name: "open", summary: "the door opens", durationHint: 2 },
  ],
};

const film: IAutoMovieSequence = {
  id: "film",
  name: null,
  fps: 24,
  shots: [{ shot: "shot:b1", trim: null, transition: null }],
};

/**
 * The resident store's non-validation plumbing (#614, #716, #1133): opening a
 * not-yet-existing root creates it, opening under a file reports repair
 * guidance, {@link AutoMovieProject.orderResidentSlate} reproduces the
 * filename-lexicographic read order (including the `beatOf(id) ?? id` fallback
 * for a non-`shot:` id), a saved non-`shot:` id keys by the raw id, a keyed
 * slice file holding `null` is skipped, and the commit lock refuses both old
 * and fresh foreign owners until explicitly recovered.
 *
 * Scenarios:
 *
 * 1. Opening a not-yet-existing nested root initializes it as an empty project;
 *    opening a path under a plain file reports project repair guidance.
 * 2. `orderResidentSlate` reorders shots/beatEnds handed in reverse into filename
 *    order, and a non-`shot:` shot id falls back to its own id as the filename
 *    key.
 * 3. Saving a slate whose shot id is not `shot:<beat>` keys the slice by the raw
 *    id.
 * 4. A keyed slice file holding literal `null` is skipped on read.
 * 5. A stale (>10s) commit lock is never stolen: the save is refused, the lock
 *    stays byte-identical, and an explicit removal permits the retry. A live
 *    lock is likewise refused; a non-EEXIST lock-open failure (root removed
 *    mid-flight) propagates unchanged.
 * 6. Reading many keyed slices and a stale-render ledger over many strays both
 *    round-trip through the filename sort.
 */
export const test_mcp_project_store_plumbing = (): void => {
  // 1. a not-yet-existing nested root is created; a file-blocked root is refused
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), "automovie-root-"));
  let parentFailure: IProjectStorePlumbingFixtureFailure | undefined;
  try {
    const nested = path.join(parent, "does", "not", "exist");
    const created = AutoMovieProject.open(nested);
    TestValidator.equals(
      "a not-yet-existing nested root opens empty",
      created.summary().script,
      false,
    );
    TestValidator.equals(
      "the nested root was created on disk",
      fs.existsSync(nested),
      true,
    );

    const filePath = path.join(parent, "afile");
    fs.writeFileSync(filePath, "not a directory");
    TestValidator.predicate(
      "a root under a plain file reports repair guidance",
      throwsError(
        () => AutoMovieProject.open(path.join(filePath, "sub")),
        ["AutoMovie project root", "Fix or remove"],
      ),
    );
  } catch (error) {
    parentFailure = { error };
    throw error;
  } finally {
    preserveProjectStorePlumbingFixtureCleanup(
      parentFailure,
      () => fs.rmSync(parent, { recursive: true, force: true }),
      "nested-root",
    );
  }

  // 2. orderResidentSlate reproduces the filename sort and the id fallback
  const orderRoot = fs.mkdtempSync(path.join(os.tmpdir(), "automovie-order-"));
  let orderFailure: IProjectStorePlumbingFixtureFailure | undefined;
  try {
    const project = AutoMovieProject.open(orderRoot);
    const ordered = project.orderResidentSlate(
      slateWith({
        // A scrambled filename order driving every comparator arm: the leading
        // "shot:a" and "a" both encode to "a.json" (equal → 0), then
        // "plainshot.json" (a>b) then "b.json" (a<b). "shot:a"/"shot:b" key by
        // their beat (beatOf), while the non-shot ids fall back to their own id.
        shots: [
          shotOf("shot:a"),
          shotOf("a"),
          shotOf("plainshot"),
          shotOf("shot:b"),
        ],
        beatEnds: [beatEndOf("a-end"), beatEndOf("c-end"), beatEndOf("b-end")],
      }),
    );
    TestValidator.equals(
      "shots reorder into filename order with the non-shot id kept",
      ordered.shots.map((shot) => shot.id),
      ["shot:a", "a", "shot:b", "plainshot"],
    );
    TestValidator.equals(
      "beatEnds reorder into filename order",
      ordered.beatEnds.map((end) => end.beat),
      ["a-end", "b-end", "c-end"],
    );
  } catch (error) {
    orderFailure = { error };
    throw error;
  } finally {
    preserveProjectStorePlumbingFixtureCleanup(
      orderFailure,
      () => fs.rmSync(orderRoot, { recursive: true, force: true }),
      "ordering",
    );
  }

  // 3. a non-shot: shot id keys its slice by the raw id
  const rawRoot = fs.mkdtempSync(path.join(os.tmpdir(), "automovie-raw-"));
  let rawFailure: IProjectStorePlumbingFixtureFailure | undefined;
  try {
    AutoMovieProject.open(rawRoot).saveSlate(
      slateWith({ shots: [shotOf("plainshot"), shotOf("shot:b1")] }),
    );
    TestValidator.equals(
      "a non-shot: id keys its slice by the raw id",
      fs.existsSync(path.join(rawRoot, "shots", "plainshot.json")),
      true,
    );
  } catch (error) {
    rawFailure = { error };
    throw error;
  } finally {
    preserveProjectStorePlumbingFixtureCleanup(
      rawFailure,
      () => fs.rmSync(rawRoot, { recursive: true, force: true }),
      "raw-shot",
    );
  }

  // 4. a keyed slice holding literal null is skipped
  const nullRoot = fs.mkdtempSync(path.join(os.tmpdir(), "automovie-null-"));
  let nullFailure: IProjectStorePlumbingFixtureFailure | undefined;
  try {
    AutoMovieProject.open(nullRoot);
    fs.writeFileSync(path.join(nullRoot, "shots", "gap.json"), "null\n");
    TestValidator.equals(
      "a keyed slice holding null is skipped on read",
      AutoMovieProject.open(nullRoot).writableSlate().shots.length,
      0,
    );
  } catch (error) {
    nullFailure = { error };
    throw error;
  } finally {
    preserveProjectStorePlumbingFixtureCleanup(
      nullFailure,
      () => fs.rmSync(nullRoot, { recursive: true, force: true }),
      "null-slice",
    );
  }

  // 5. old and fresh foreign locks are both fail-closed
  const staleRoot = fs.mkdtempSync(path.join(os.tmpdir(), "automovie-stale-"));
  let staleFailure: IProjectStorePlumbingFixtureFailure | undefined;
  try {
    const project = AutoMovieProject.open(staleRoot);
    const lockPath = path.join(staleRoot, "revision.lock");
    fs.writeFileSync(lockPath, "crashed-owner-token");
    const stale = new Date(Date.now() - 20_000);
    fs.utimesSync(lockPath, stale, stale);
    TestValidator.predicate(
      "an old commit lock is refused with explicit recovery guidance",
      throwsError(
        () => project.saveSlate(slateWith({ script })),
        ["commit lock is held", "verify", "remove", "manually"],
      ),
    );
    TestValidator.equals(
      "an old commit lock blocks every staged write",
      fs.existsSync(path.join(staleRoot, "script.json")),
      false,
    );
    TestValidator.equals(
      "an old commit lock stays byte-identical",
      fs.readFileSync(lockPath, "utf8"),
      "crashed-owner-token",
    );
    fs.rmSync(lockPath);
    project.saveSlate(slateWith({ script }));
    TestValidator.equals(
      "an explicit recovery allows the save retry",
      fs.existsSync(path.join(staleRoot, "script.json")),
      true,
    );
  } catch (error) {
    staleFailure = { error };
    throw error;
  } finally {
    preserveProjectStorePlumbingFixtureCleanup(
      staleFailure,
      () => fs.rmSync(staleRoot, { recursive: true, force: true }),
      "stale-lock",
    );
  }

  const heldRoot = fs.mkdtempSync(path.join(os.tmpdir(), "automovie-held-"));
  let heldFailure: IProjectStorePlumbingFixtureFailure | undefined;
  try {
    const project = AutoMovieProject.open(heldRoot);
    const lockPath = path.join(heldRoot, "revision.lock");
    fs.closeSync(fs.openSync(lockPath, "w")); // fresh mtime → a live holder
    TestValidator.predicate(
      "a live commit lock is refused with the retry prompt",
      throwsError(
        () => project.saveSlate(slateWith({ script })),
        ["commit lock is held by another session", "retry"],
      ),
    );
  } catch (error) {
    heldFailure = { error };
    throw error;
  } finally {
    preserveProjectStorePlumbingFixtureCleanup(
      heldFailure,
      () => fs.rmSync(heldRoot, { recursive: true, force: true }),
      "held-lock",
    );
  }

  // 5b. a live handle rejects its missing physical root before lock creation
  const goneRoot = fs.mkdtempSync(path.join(os.tmpdir(), "automovie-gone-"));
  let goneFailure: IProjectStorePlumbingFixtureFailure | undefined;
  try {
    const project = AutoMovieProject.open(goneRoot);
    fs.rmSync(goneRoot, { recursive: true, force: true });
    TestValidator.predicate(
      "a missing project root is rejected by the namespace fence",
      throwsError(
        () => project.saveSlate(slateWith({ script })),
        ["project root", "not a physical directory"],
      ),
    );
  } catch (error) {
    goneFailure = { error };
    throw error;
  } finally {
    preserveProjectStorePlumbingFixtureCleanup(
      goneFailure,
      () => fs.rmSync(goneRoot, { recursive: true, force: true }),
      "removed-root",
    );
  }

  // 6. many keyed slices and many render strays round-trip through the sort
  const sortRoot = fs.mkdtempSync(path.join(os.tmpdir(), "automovie-sort-"));
  let sortFailure: IProjectStorePlumbingFixtureFailure | undefined;
  try {
    const project = AutoMovieProject.open(sortRoot);
    const beats = ["b3", "b1", "b4", "b2"];
    project.saveSlate(
      slateWith({
        script: {
          ...script,
          beats: beats.map((id) => ({
            id,
            name: id,
            summary: id,
            durationHint: 1,
          })),
        },
        shots: beats.map((id) => shotOf(`shot:${id}`)),
        film,
      }),
    );
    TestValidator.equals(
      "keyed slices read back in filename order",
      AutoMovieProject.open(sortRoot)
        .writableSlate()
        .shots.map((shot) => shot.id),
      beats
        .map((id) => `shot:${id}`)
        .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)),
    );
    // Strays created in reverse so an unsorted readdir must reorder them.
    for (const name of ["z-stray", "m-stray", "a-stray"])
      fs.mkdirSync(path.join(sortRoot, "renders", name), { recursive: true });
    TestValidator.equals(
      "the stale-render ledger lists strays in filename order",
      AutoMovieProject.open(sortRoot).summary().staleRenders,
      ["renders/a-stray", "renders/m-stray", "renders/z-stray"],
    );
  } catch (error) {
    sortFailure = { error };
    throw error;
  } finally {
    preserveProjectStorePlumbingFixtureCleanup(
      sortFailure,
      () => fs.rmSync(sortRoot, { recursive: true, force: true }),
      "filename-sort",
    );
  }
};
