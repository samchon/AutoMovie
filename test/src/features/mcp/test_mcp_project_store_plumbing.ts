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
  scene: null,
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
 * slice file holding `null` is skipped, and the commit lock breaks a stale
 * holder while refusing a live one.
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
 * 5. A stale (>10s) commit lock is broken and the save proceeds; a live lock is
 *    refused with the retry prompt; a non-EEXIST lock-open failure (root
 *    removed mid-flight) propagates unchanged.
 * 6. Reading many keyed slices and a stale-render ledger over many strays both
 *    round-trip through the filename sort.
 */
export const test_mcp_project_store_plumbing = (): void => {
  // 1. a not-yet-existing nested root is created; a file-blocked root is refused
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), "automovie-root-"));
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
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }

  // 2. orderResidentSlate reproduces the filename sort and the id fallback
  const orderRoot = fs.mkdtempSync(path.join(os.tmpdir(), "automovie-order-"));
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
  } finally {
    fs.rmSync(orderRoot, { recursive: true, force: true });
  }

  // 3. a non-shot: shot id keys its slice by the raw id
  const rawRoot = fs.mkdtempSync(path.join(os.tmpdir(), "automovie-raw-"));
  try {
    AutoMovieProject.open(rawRoot).saveSlate(
      slateWith({ shots: [shotOf("plainshot"), shotOf("shot:b1")] }),
    );
    TestValidator.equals(
      "a non-shot: id keys its slice by the raw id",
      fs.existsSync(path.join(rawRoot, "shots", "plainshot.json")),
      true,
    );
  } finally {
    fs.rmSync(rawRoot, { recursive: true, force: true });
  }

  // 4. a keyed slice holding literal null is skipped
  const nullRoot = fs.mkdtempSync(path.join(os.tmpdir(), "automovie-null-"));
  try {
    AutoMovieProject.open(nullRoot);
    fs.writeFileSync(path.join(nullRoot, "shots", "gap.json"), "null\n");
    TestValidator.equals(
      "a keyed slice holding null is skipped on read",
      AutoMovieProject.open(nullRoot).writableSlate().shots.length,
      0,
    );
  } finally {
    fs.rmSync(nullRoot, { recursive: true, force: true });
  }

  // 5. stale lock broken; live lock refused
  const staleRoot = fs.mkdtempSync(path.join(os.tmpdir(), "automovie-stale-"));
  try {
    const project = AutoMovieProject.open(staleRoot);
    const lockPath = path.join(staleRoot, "revision.lock");
    fs.closeSync(fs.openSync(lockPath, "w"));
    const stale = new Date(Date.now() - 20_000);
    fs.utimesSync(lockPath, stale, stale);
    project.saveSlate(slateWith({ script }));
    TestValidator.equals(
      "a stale commit lock is broken and the save proceeds",
      fs.existsSync(path.join(staleRoot, "script.json")),
      true,
    );
  } finally {
    fs.rmSync(staleRoot, { recursive: true, force: true });
  }

  const heldRoot = fs.mkdtempSync(path.join(os.tmpdir(), "automovie-held-"));
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
  } finally {
    fs.rmSync(heldRoot, { recursive: true, force: true });
  }

  // 5b. a non-EEXIST failure taking the commit lock propagates unchanged
  const goneRoot = fs.mkdtempSync(path.join(os.tmpdir(), "automovie-gone-"));
  try {
    const project = AutoMovieProject.open(goneRoot);
    fs.rmSync(goneRoot, { recursive: true, force: true });
    TestValidator.predicate(
      "a non-EEXIST lock-open error propagates unchanged",
      throwsError(() => project.saveSlate(slateWith({ script })), ["ENOENT"]),
    );
  } finally {
    fs.rmSync(goneRoot, { recursive: true, force: true });
  }

  // 6. many keyed slices and many render strays round-trip through the sort
  const sortRoot = fs.mkdtempSync(path.join(os.tmpdir(), "automovie-sort-"));
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
  } finally {
    fs.rmSync(sortRoot, { recursive: true, force: true });
  }
};
