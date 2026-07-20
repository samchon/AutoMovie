import {
  IAutoMovieBeatEndState,
  IAutoMovieScript,
  IAutoMovieSequence,
  IAutoMovieShot,
} from "@automovie/interface";
import {
  AutoMovieProject,
  IAutoMovieMcpPropSpec,
  IAutoMovieMcpWritableSlate,
} from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const script: IAutoMovieScript = {
  logline: "a door opens",
  theme: "curiosity",
  cast: [],
  beats: [
    { id: "b1", name: "open", summary: "the door opens", durationHint: 2 },
  ],
};

const shot: IAutoMovieShot = {
  id: "shot:b1",
  name: null,
  scene: "scene-1",
  camera: "cam",
  cameraMotion: null,
  performances: [],
  objectMotions: [],
  duration: 1,
};

const propSpec = (node: string): IAutoMovieMcpPropSpec => ({
  node,
  model: {
    id: node,
    name: node,
    origin: "generated",
    skeleton: null,
    body: null,
    materials: [],
    parts: [
      {
        id: "box",
        name: null,
        geometry: {
          type: "primitive",
          shape: { type: "box", width: 1, height: 1, depth: 1 },
        },
        material: null,
        attachedBone: null,
        transform: null,
      },
    ],
    asset: null,
  },
  articulation: null,
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

const throwsProjectJsonError = (
  task: () => unknown,
  fragments: readonly string[],
): boolean => {
  try {
    task();
    return false;
  } catch (error) {
    return (
      error instanceof Error &&
      error.name !== "SyntaxError" &&
      fragments.every((fragment) => error.message.includes(fragment))
    );
  }
};

const scriptWithTree = (tree: unknown): IAutoMovieScript => ({
  logline: "A duel at dawn.",
  theme: "discipline under pressure",
  cast: [{ node: "hero", character: "Hero", modelRef: null }],
  beats: [
    {
      id: "b1",
      name: "first exchange",
      summary: "The duelists test distance.",
      durationHint: 2,
    },
  ],
  tree: tree as IAutoMovieScript["tree"],
});

const ghostBeatTree = (): NonNullable<IAutoMovieScript["tree"]> => [
  {
    id: "root",
    kind: "intent",
    parent: null,
    temporal: null,
    interactsWith: [],
    payload: {
      logline: "A duel at dawn.",
      theme: "discipline under pressure",
    },
  },
  {
    id: "beat-node",
    kind: "beat",
    parent: "root",
    temporal: null,
    interactsWith: [],
    payload: {
      beat: "ghost",
      direction: "The duelists test distance.",
      dialogue: [],
      caption: null,
    },
  },
];

/**
 * The project folder itself is the memory (#614): opening a fresh directory is
 * a valid empty project, a saved slate becomes visible pretty-printed JSON
 * files, reopening reads the same state back, and reconciliation mirrors the
 * commit tools' invalidation cascade as files disappearing.
 *
 * Scenarios:
 *
 * 1. Opening a fresh temp dir initializes the tree (manifest + reserved dirs) and
 *    reports an empty summary.
 * 2. Saving a slate persists slices as human-readable JSON; a REOPENED project (a
 *    new instance over the same root) reads the identical slate back ,
 *    durability, not in-process caching.
 * 3. The shot slice file is itself valid pretty JSON whose parse equals the
 *    committed shot (the user-visible file IS the state).
 * 4. Re-saving with cleared downstream slices REMOVES their files (null script
 *    file gone, empty notes file gone, shots dir reconciled), presence always
 *    means content.
 * 5. Malformed resident JSON reports a controlled project-state error naming the
 *    file to fix, for manifest, top-level slice, and keyed slice reads.
 * 6. Parseable but structurally invalid non-keyed slices also report project
 *    repair guidance at the resident read boundary.
 * 7. Parseable keyed slices whose filename/internal key matches still validate the
 *    rest of their shape before entering resident state.
 * 8. Resident script trees validate at the read boundary, matching commitScript.
 * 9. Resident prop slices validate at the read boundary, matching forgeProp.
 * 10. A root path blocked by a file reports project repair guidance instead of
 *     leaking raw filesystem errors.
 * 11. Keyed filenames are Windows-safe: a `*` in a beat id and DOS device basenames
 *     (`con`) escape to writable, round-tripping filenames, and
 *     case-only-distinct beat ids refuse before a case-insensitive filesystem
 *     could silently clobber one.
 */
export const test_mcp_project_store = (): void => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "automovie-store-"));
  try {
    const project = AutoMovieProject.open(root);
    TestValidator.equals(
      "fresh project is empty",
      project.summary().script,
      false,
    );
    TestValidator.equals(
      "manifest exists",
      fs.existsSync(path.join(root, "automovie.json")),
      true,
    );
    TestValidator.equals(
      "reserved dirs exist",
      fs.existsSync(path.join(root, "models")) &&
        fs.existsSync(path.join(root, "renders")),
      true,
    );

    project.saveSlate(
      slateWith({
        script,
        shots: [shot],
        notes: [{ beat: "b1", tier: "physical", issue: "x", suggestion: "y" }],
      }),
    );
    const reopened = AutoMovieProject.open(root).writableSlate();
    TestValidator.equals("reopened script survives", reopened.script, script);
    TestValidator.equals("reopened shots survive", reopened.shots, [shot]);
    TestValidator.equals("reopened notes survive", reopened.notes.length, 1);

    const shotFile = path.join(root, "shots", "b1.json");
    TestValidator.equals(
      "shot slice file parse equals the shot",
      JSON.parse(fs.readFileSync(shotFile, "utf8")),
      shot,
    );

    // 11. Windows-safe keyed filenames: `*` and DOS device basenames escape,
    // round-trip, and case-only-distinct beat ids refuse before clobbering.
    AutoMovieProject.open(root).saveSlate(
      slateWith({
        script,
        shots: [
          { ...shot, id: "shot:b*1" },
          { ...shot, id: "shot:con" },
          { ...shot, id: "shot:con.notes" },
        ],
      }),
    );
    TestValidator.equals(
      "a star beat id escapes to a Windows-writable filename",
      fs.existsSync(path.join(root, "shots", "b%2A1.json")),
      true,
    );
    TestValidator.equals(
      "a DOS device beat id escapes its first character",
      fs.existsSync(path.join(root, "shots", "%63on.json")),
      true,
    );
    // Windows reserves the pre-first-dot STEM (`con.notes.json` is refused on
    // Windows 10 like `con.json`), so the dotted key escapes too (#1064)
    TestValidator.equals(
      "a dotted DOS device stem escapes its first character",
      fs.existsSync(path.join(root, "shots", "%63on.notes.json")),
      true,
    );
    TestValidator.equals(
      "escaped keyed slices round-trip on reopen",
      AutoMovieProject.open(root)
        .writableSlate()
        .shots.map((s) => s.id)
        .sort((a, b) => a.localeCompare(b)),
      ["shot:b*1", "shot:con", "shot:con.notes"],
    );
    TestValidator.predicate(
      "case-only-distinct beat ids refuse before clobbering",
      (() => {
        try {
          AutoMovieProject.open(root).saveSlate(
            slateWith({
              script,
              shots: [
                { ...shot, id: "shot:Duel" },
                { ...shot, id: "shot:duel" },
              ],
            }),
          );
          return false;
        } catch (error) {
          const message = String((error as Error).message);
          return (
            message.includes("Duel") &&
            message.includes("duel") &&
            message.includes("case-insensitively")
          );
        }
      })(),
    );

    AutoMovieProject.open(root).saveSlate(slateWith({ script }));
    TestValidator.equals(
      "cleared shots dir reconciled",
      fs.existsSync(shotFile),
      false,
    );
    TestValidator.equals(
      "empty notes file removed",
      fs.existsSync(path.join(root, "notes.json")),
      false,
    );
    TestValidator.equals(
      "script file kept",
      fs.existsSync(path.join(root, "script.json")),
      true,
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }

  const manifestRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), "automovie-bad-manifest-"),
  );
  try {
    fs.writeFileSync(path.join(manifestRoot, "automovie.json"), "{ nope");
    TestValidator.predicate(
      "malformed manifest has project guidance",
      throwsProjectJsonError(
        () => AutoMovieProject.open(manifestRoot),
        ["AutoMovie project file", "automovie.json", "Fix or remove"],
      ),
    );
  } finally {
    fs.rmSync(manifestRoot, { recursive: true, force: true });
  }

  const sliceRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), "automovie-bad-slice-"),
  );
  try {
    AutoMovieProject.open(sliceRoot);
    fs.writeFileSync(path.join(sliceRoot, "script.json"), "{ nope");
    TestValidator.predicate(
      "malformed top-level slice has project guidance",
      throwsProjectJsonError(
        () => AutoMovieProject.open(sliceRoot).writableSlate(),
        ["AutoMovie project file", "script.json", "Fix or remove"],
      ),
    );
  } finally {
    fs.rmSync(sliceRoot, { recursive: true, force: true });
  }

  const invalidShapeCases: {
    label: string;
    file: string;
    value: unknown;
    fragments: string[];
  }[] = [
    {
      label: "invalid script shape has project guidance",
      file: "script.json",
      value: { logline: "x" },
      fragments: ["script.json", "Validation detail", "cast"],
    },
    {
      label: "invalid script tree shape has project guidance",
      file: "script.json",
      value: scriptWithTree({}),
      fragments: ["script.json", "Validation detail", "$input.tree", "array"],
    },
    {
      label: "invalid script tree semantics has project guidance",
      file: "script.json",
      value: scriptWithTree(ghostBeatTree()),
      fragments: ["script.json", "Validation detail", "$input.tree", "ghost"],
    },
    {
      label: "invalid notes shape has project guidance",
      file: "notes.json",
      value: {},
      fragments: ["notes.json", "Validation detail", "array"],
    },
    {
      label: "invalid film shape has project guidance",
      file: "film.json",
      value: { id: "film-1" } satisfies Partial<IAutoMovieSequence>,
      fragments: ["film.json", "Validation detail", "shots"],
    },
  ];
  for (const entry of invalidShapeCases) {
    const invalidRoot = fs.mkdtempSync(
      path.join(os.tmpdir(), "automovie-invalid-slice-shape-"),
    );
    try {
      AutoMovieProject.open(invalidRoot);
      fs.writeFileSync(
        path.join(invalidRoot, entry.file),
        `${JSON.stringify(entry.value, null, 2)}\n`,
      );
      TestValidator.predicate(
        entry.label,
        throwsProjectJsonError(
          () => AutoMovieProject.open(invalidRoot).writableSlate(),
          [
            "AutoMovie project file",
            entry.file,
            "Fix or remove",
            ...entry.fragments,
          ],
        ),
      );
    } finally {
      fs.rmSync(invalidRoot, { recursive: true, force: true });
    }
  }

  const keyedRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), "automovie-bad-keyed-"),
  );
  try {
    AutoMovieProject.open(keyedRoot);
    fs.writeFileSync(path.join(keyedRoot, "shots", "b1.json"), "{ nope");
    TestValidator.predicate(
      "malformed keyed slice has project guidance",
      throwsProjectJsonError(
        () => AutoMovieProject.open(keyedRoot).writableSlate(),
        ["AutoMovie project file", "shots", "b1.json", "Fix or remove"],
      ),
    );
  } finally {
    fs.rmSync(keyedRoot, { recursive: true, force: true });
  }

  const invalidKeyedShapeCases: {
    label: string;
    dir: string;
    file: string;
    value: unknown;
    read: (root: string) => unknown;
    fragments: string[];
  }[] = [
    {
      label: "invalid shot shape has project guidance",
      dir: "shots",
      file: "b1.json",
      value: { id: "shot:b1" } satisfies Partial<IAutoMovieShot>,
      read: (root) => AutoMovieProject.open(root).writableSlate(),
      fragments: ["shots", "b1.json", "Validation detail", "scene"],
    },
    {
      label: "invalid beat-end shape has project guidance",
      dir: "beatEnds",
      file: "b1.json",
      value: { beat: "b1" } satisfies Partial<IAutoMovieBeatEndState>,
      read: (root) => AutoMovieProject.open(root).writableSlate(),
      fragments: ["beatEnds", "b1.json", "Validation detail", "shot"],
    },
    {
      label: "invalid prop shape has project guidance",
      dir: "props",
      file: "door.json",
      value: { node: "door" } satisfies Partial<IAutoMovieMcpPropSpec>,
      read: (root) => AutoMovieProject.open(root).storedProps(),
      fragments: ["props", "door.json", "Validation detail", "model"],
    },
    {
      label: "prop model/node mismatch has project guidance",
      dir: "props",
      file: "door.json",
      value: {
        ...propSpec("door"),
        model: { ...propSpec("door").model, id: "crate" },
      },
      read: (root) => AutoMovieProject.open(root).storedProps(),
      fragments: ["props", "door.json", "Validation detail", "model.id"],
    },
    {
      label: "invalid prop articulation has project guidance",
      dir: "props",
      file: "door.json",
      value: { ...propSpec("door"), articulation: {} },
      read: (root) => AutoMovieProject.open(root).storedProps(),
      fragments: [
        "props",
        "door.json",
        "Validation detail",
        "articulation",
        "forgeProp",
      ],
    },
  ];
  for (const entry of invalidKeyedShapeCases) {
    const invalidRoot = fs.mkdtempSync(
      path.join(os.tmpdir(), "automovie-invalid-keyed-shape-"),
    );
    try {
      AutoMovieProject.open(invalidRoot);
      fs.writeFileSync(
        path.join(invalidRoot, entry.dir, entry.file),
        `${JSON.stringify(entry.value, null, 2)}\n`,
      );
      TestValidator.predicate(
        entry.label,
        throwsProjectJsonError(
          () => entry.read(invalidRoot),
          [
            "AutoMovie project file",
            entry.dir,
            entry.file,
            "Fix or remove",
            ...entry.fragments,
          ],
        ),
      );
    } finally {
      fs.rmSync(invalidRoot, { recursive: true, force: true });
    }
  }

  const blockedParent = fs.mkdtempSync(
    path.join(os.tmpdir(), "automovie-file-root-"),
  );
  try {
    const blockedRoot = path.join(blockedParent, "project");
    fs.writeFileSync(blockedRoot, "not a directory");
    TestValidator.predicate(
      "file-backed root has project guidance",
      throwsProjectJsonError(
        () => AutoMovieProject.open(blockedRoot),
        [
          "AutoMovie project root",
          "Fix or remove",
          "project root must be a directory",
        ],
      ),
    );
  } finally {
    fs.rmSync(blockedParent, { recursive: true, force: true });
  }
};
