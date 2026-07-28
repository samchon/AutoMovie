import {
  AutoMovieContentDigest,
  IAutoMovieDiagnostic,
  IAutoMovieLegacyImportApplyOutput,
  IAutoMovieLegacyImportInventoryEntry,
  IAutoMovieLegacyImportPlan,
  IAutoMovieLegacyImportRollbackOutput,
  IAutoMovieLegacySourceTodo,
  IAutoMovieProductionDesign,
  IAutoMovieProductionManifest,
  IAutoMovieShotContract,
} from "@automovie/interface";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { AutoMovieProject, checkAssetPath } from "../project/AutoMovieProject";
import {
  canonicalAutoMovieJsonBytes,
  compareCodeUnits,
  digestAutoMovieBytes,
  encodeAutoMoviePathSegment,
} from "./contentIdentity";

const LEGACY_IMPORT_PROTOCOL = "automovie.legacy-import.v1";
const IMPORT_PLAN_PATH = "imports/legacy-v1/plan.json";
const IMPORT_STATE_PATH = "imports/legacy-v1/state.json";
const PROJECT_FILES = [
  "automovie.json",
  "script.json",
  "scene.json",
  "notes.json",
  "film.json",
  "revision.json",
] as const;
const PROJECT_DIRECTORIES = [
  "scenes",
  "shots",
  "beatEnds",
  "props",
  "actors",
] as const;
const PRODUCTION_STATE_DIRECTORIES = [
  "design/models",
  "design/formations",
  "design/shots",
  "design/acceptance",
  "reviews/design/models",
  "reviews/design/formations",
  "reviews/design/shots",
  "reviews/design/acceptances",
  "reviews/source",
  "reviews/shots",
  "reviews/film",
  "render-receipts",
  "imports/legacy-v1",
] as const;

interface ILegacyManifest {
  version: 1;
  assets: string[];
}

interface ILegacySnapshot {
  root: string;
  revision: number;
  assets: string[];
  files: ReadonlyMap<string, Uint8Array | null>;
}

interface IAppliedImportState {
  version: 1;
  fingerprint: AutoMovieContentDigest;
  absentOwnedDirectories: string[];
  fileDigests: Record<string, AutoMovieContentDigest>;
}

/**
 * Non-destructive bridge from the resident v1 project into production v2.
 *
 * Planning copies the captured legacy bytes to an operating-system temporary
 * directory before opening the v1 store, so validation cannot initialize or
 * normalize the user's tree. Applying adds one atomic `.automovie` state root
 * containing provenance and drafts; every pre-existing legacy byte remains
 * untouched. Rollback is allowed only while that imported state is exact and
 * any production-owned directories created by a later open remain empty.
 */
export class AutoMovieLegacyImporter {
  public constructor(private readonly rootDirectory: string) {}

  /** Inspect and validate a legacy project without mutating its directory. */
  public plan(): IAutoMovieLegacyImportPlan {
    const snapshot = readLegacySnapshot(this.rootDirectory);
    return withLegacyProject(snapshot, (legacy) =>
      createPlan(snapshot, {
        slate: legacy.writableSlate(),
        props: legacy.storedProps().length,
        actors: legacy.storedActors().length,
      }),
    );
  }

  /** Persist one immutable import plan and v2 provenance atomically. */
  public apply(): IAutoMovieLegacyImportApplyOutput {
    const plan = this.plan();
    const root = path.resolve(this.rootDirectory);
    const stateRoot = path.join(root, ".automovie");
    const existing = lstatOrNull(stateRoot);
    if (existing !== null) {
      if (existing.isSymbolicLink() || existing.isDirectory() === false)
        throw new Error(
          `Production state root "${stateRoot}" is not a physical directory. Remove the collision before applying the legacy import.`,
        );
      const prior = readJson<IAutoMovieLegacyImportPlan>(
        path.join(stateRoot, IMPORT_PLAN_PATH),
      );
      if (prior?.fingerprint === plan.fingerprint) {
        const state = validateImportState(
          readJson<unknown>(path.join(stateRoot, IMPORT_STATE_PATH)),
          stateRoot,
        );
        if (state.fingerprint === plan.fingerprint)
          return { status: "unchanged", plan: prior };
      }
      throw new Error(
        `Production state root "${stateRoot}" already exists with a different or incomplete import. Preserve it and choose a clean legacy project root.`,
      );
    }

    const manifest: IAutoMovieProductionManifest = {
      formatVersion: 2,
      projectId: projectIdOf(root),
      sourceRoots: ["src"],
      generatedRoot: "generated",
      renderRoot: "renders",
      importedLegacy: {
        revision: plan.legacyRevision,
        sourceRoot: ".",
      },
    };
    const absentOwnedDirectories = ["src", "generated", "renders"].filter(
      (directory) => fs.existsSync(path.join(root, directory)) === false,
    );
    const manifestBytes = serializeJson(manifest);
    const revisionBytes = serializeJson({ revision: 0 });
    const planBytes = serializeJson(plan);
    const state: IAppliedImportState = {
      version: 1,
      fingerprint: plan.fingerprint,
      absentOwnedDirectories,
      fileDigests: {
        "manifest.json": digestAutoMovieBytes(manifestBytes),
        "revision.json": digestAutoMovieBytes(revisionBytes),
        [IMPORT_PLAN_PATH]: digestAutoMovieBytes(planBytes),
      },
    };
    const staging = fs.mkdtempSync(path.join(root, ".automovie-import-"));
    try {
      for (const directory of PRODUCTION_STATE_DIRECTORIES)
        fs.mkdirSync(path.join(staging, directory), { recursive: true });
      fs.writeFileSync(path.join(staging, "manifest.json"), manifestBytes);
      fs.writeFileSync(path.join(staging, "revision.json"), revisionBytes);
      fs.writeFileSync(path.join(staging, IMPORT_PLAN_PATH), planBytes);
      fs.writeFileSync(
        path.join(staging, IMPORT_STATE_PATH),
        serializeJson(state),
      );
      fs.renameSync(staging, stateRoot);
    } finally {
      if (fs.existsSync(staging))
        fs.rmSync(staging, { force: true, recursive: true });
    }
    return { status: "applied", plan };
  }

  /** Remove one still-untouched applied import, preserving all legacy bytes. */
  public rollback(): IAutoMovieLegacyImportRollbackOutput {
    const root = path.resolve(this.rootDirectory);
    const stateRoot = path.join(root, ".automovie");
    const linked = lstatOrNull(stateRoot);
    if (
      linked === null ||
      linked.isSymbolicLink() ||
      linked.isDirectory() === false
    )
      throw new Error(
        `No physical applied legacy import exists at "${stateRoot}". Nothing was rolled back.`,
      );
    const state = validateImportState(
      readJson<unknown>(path.join(stateRoot, IMPORT_STATE_PATH)),
      stateRoot,
    );
    const plan = readJson<IAutoMovieLegacyImportPlan>(
      path.join(stateRoot, IMPORT_PLAN_PATH),
    );
    if (plan?.fingerprint !== state.fingerprint)
      throw changedImportError(stateRoot, IMPORT_PLAN_PATH);
    for (const [relative, digest] of Object.entries(state.fileDigests)) {
      const file = path.join(stateRoot, relative);
      const status = lstatOrNull(file);
      if (
        status === null ||
        status.isSymbolicLink() ||
        status.isFile() === false ||
        digestAutoMovieBytes(fs.readFileSync(file)) !== digest
      )
        throw changedImportError(stateRoot, relative);
    }
    const allowed = new Set([
      "manifest.json",
      "revision.json",
      IMPORT_PLAN_PATH,
      IMPORT_STATE_PATH,
    ]);
    for (const relative of collectFiles(stateRoot))
      if (allowed.has(relative) === false)
        throw changedImportError(stateRoot, relative);
    for (const relative of state.absentOwnedDirectories) {
      const directory = path.join(root, relative);
      const status = lstatOrNull(directory);
      if (status === null) continue;
      if (
        status.isSymbolicLink() ||
        status.isDirectory() === false ||
        fs.readdirSync(directory).length !== 0
      )
        throw new Error(
          `Production-owned directory "${directory}" contains work created after import. Preserve it; rollback refused.`,
        );
    }
    fs.rmSync(stateRoot, { recursive: true });
    for (const relative of state.absentOwnedDirectories) {
      const directory = path.join(root, relative);
      if (fs.existsSync(directory)) fs.rmdirSync(directory);
    }
    return { status: "rolled-back", fingerprint: state.fingerprint };
  }
}

const createPlan = (
  snapshot: ILegacySnapshot,
  legacy: {
    slate: ReturnType<AutoMovieProject["writableSlate"]>;
    props: number;
    actors: number;
  },
): IAutoMovieLegacyImportPlan => {
  const fps = legacy.slate.film?.fps ?? 30;
  const rawRuntime = legacy.slate.shots.reduce(
    (sum, shot) => sum + shot.duration,
    0,
  );
  const targetRuntimeSeconds =
    Math.max(1, Math.round(rawRuntime * fps)) / fps;
  const projectId = projectIdOf(snapshot.root);
  const productionDraft: IAutoMovieProductionDesign = {
    id: projectId,
    title: projectId,
    logline:
      legacy.slate.script?.logline.trim() ||
      "Legacy project import awaiting treatment reconstruction.",
    targetRuntimeSeconds,
    frameFormat: {
      width: 1280,
      height: 720,
      fps,
      colorSpace: "srgb",
    },
    artDirection: {
      style: "primitive-3d",
      palette: ["#808080"],
      silhouettePriority:
        "Draft only: reconstruct silhouette priorities from legacy references.",
      scaleGrammar:
        "Draft only: reconstruct scale grammar from legacy scenes and assets.",
    },
    deliverables: [{ id: "legacy-preview", kind: "preview", required: false }],
  };
  const shotContractDrafts = legacy.slate.shots.map((shot) =>
    draftShotContract(shot, fps),
  );
  const sourceTodos: IAutoMovieLegacySourceTodo[] = shotContractDrafts.map(
    (shot) => ({
      shot: shot.id,
      module: shot.source.module,
      export: shot.source.export,
      reason:
        "Legacy storage persisted compiled motion references, not the authoring TypeScript that produced them. Write and review this source before compilation.",
    }),
  );
  const diagnostics: IAutoMovieDiagnostic[] = [
    importWarning(
      "legacy-frame-format-defaulted",
      "production",
      null,
      "Legacy storage has no authoritative raster or color-space contract. Review the 1280x720 sRGB draft before activating it.",
    ),
    importWarning(
      "legacy-art-direction-defaulted",
      "production",
      null,
      "Legacy storage has no structured production art direction. Replace the neutral palette and draft grammar from project evidence.",
    ),
    importWarning(
      "legacy-edit-reconstruction-required",
      "film",
      "film.json",
      "Legacy film cuts remain untouched and are not promoted to a production edit contract. Reconstruct and review the edit timeline.",
    ),
    importWarning(
      "legacy-design-reconstruction-required",
      "legacy-project",
      null,
      `Legacy scenes, ${legacy.props} props, and ${legacy.actors} actor contexts remain evidence only. Author production world, model, formation, and acceptance designs explicitly.`,
    ),
    ...sourceTodos.map((todo) =>
      importWarning(
        "legacy-source-unrecoverable",
        `shot:${todo.shot}`,
        todo.module,
        todo.reason,
      ),
    ),
    ...[...snapshot.files]
      .filter(([, bytes]) => bytes === null)
      .map(([relative]) =>
        importWarning(
          "legacy-asset-missing",
          "legacy-project",
          relative,
          `Registered legacy asset "${relative}" is absent. Restore or unregister it before relying on imported production evidence.`,
        ),
      ),
  ];
  const inventory = [...snapshot.files]
    .map(
      ([relative, bytes]): IAutoMovieLegacyImportInventoryEntry => ({
        path: relative,
        bytes: bytes?.byteLength ?? 0,
        digest: bytes === null ? null : digestAutoMovieBytes(bytes),
        kind: snapshot.assets.includes(relative) ? "asset" : "project",
      }),
    )
    .sort((left, right) => compareCodeUnits(left.path, right.path));
  const content = {
    version: 1 as const,
    legacyRevision: snapshot.revision,
    inventory,
    productionDraft,
    shotContractDrafts,
    sourceTodos,
    diagnostics,
  };
  return {
    ...content,
    fingerprint: digestAutoMovieBytes(
      canonicalAutoMovieJsonBytes({
        protocol: LEGACY_IMPORT_PROTOCOL,
        ...content,
      }),
    ),
  };
};

const draftShotContract = (
  shot: ReturnType<AutoMovieProject["writableSlate"]>["shots"][number],
  fps: number,
): IAutoMovieShotContract => {
  const durationSeconds =
    Math.max(1, Math.round(Math.max(shot.duration, 0) * fps)) / fps;
  const actors = [
    ...new Set(shot.performances.map((performance) => performance.node)),
  ];
  return {
    id: shot.id,
    beat: shot.id,
    source: {
      module: `src/shots/${encodeAutoMoviePathSegment(shot.id)}.ts`,
      export: "buildLegacyShot",
    },
    durationSeconds,
    participants: actors.map((id) => ({ kind: "actor", id })),
    opening: [],
    closing: [],
    camera: {
      intent: `Reconstruct legacy camera "${shot.camera}" from scene and shot evidence.`,
      requiredSubjects: actors.length === 0 ? [shot.camera] : actors,
      maxOcclusionRatio: 1,
    },
    events: [],
    reviewFrames: [{ id: "legacy-start", time: 0, passes: ["beauty"] }],
  };
};

const readLegacySnapshot = (rootDirectory: string): ILegacySnapshot => {
  const root = path.resolve(rootDirectory);
  const status = lstatOrNull(root);
  if (
    status === null ||
    status.isSymbolicLink() ||
    status.isDirectory() === false ||
    path.parse(root).root === root
  )
    throw new Error(
      `Legacy project root "${root}" must be one physical, dedicated project directory.`,
    );
  const manifestBytes = readPhysicalFile(root, "automovie.json", true);
  const manifest = validateLegacyManifest(
    parseJson(manifestBytes!, path.join(root, "automovie.json")),
    path.join(root, "automovie.json"),
  );
  const files = new Map<string, Uint8Array | null>([
    ["automovie.json", manifestBytes!],
  ]);
  for (const relative of PROJECT_FILES.slice(1)) {
    const bytes = readPhysicalFile(root, relative, false);
    if (bytes !== null) files.set(relative, bytes);
  }
  for (const relative of PROJECT_DIRECTORIES)
    collectDirectory(root, relative, files);
  const assets = manifest.assets.map((asset) => {
    const checked = checkAssetPath(asset);
    if ("fault" in checked || checked.path !== asset)
      throw new Error(
        `Legacy manifest asset "${asset}" is not one canonical project-relative path. Correct automovie.json before import.`,
      );
    if (files.has(asset) === false)
      files.set(asset, readPhysicalFile(root, asset, false));
    return asset;
  });
  const folded = new Map<string, string>();
  for (const relative of files.keys()) {
    const previous = folded.get(relative.toLowerCase());
    if (previous !== undefined && previous !== relative)
      throw new Error(
        `Legacy paths "${previous}" and "${relative}" collide by case. Rename one before import.`,
      );
    folded.set(relative.toLowerCase(), relative);
  }
  const revisionBytes = files.get("revision.json");
  const revision =
    revisionBytes === undefined
      ? 0
      : validateLegacyRevision(
          parseJson(revisionBytes!, path.join(root, "revision.json")),
          path.join(root, "revision.json"),
        );
  return { root, revision, assets, files };
};

const withLegacyProject = <T>(
  snapshot: ILegacySnapshot,
  task: (project: AutoMovieProject) => T,
): T => {
  const temporary = fs.mkdtempSync(
    path.join(os.tmpdir(), "automovie-legacy-import-"),
  );
  try {
    for (const [relative, bytes] of snapshot.files)
      if (bytes !== null) {
        const file = path.join(temporary, ...relative.split("/"));
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, bytes);
      }
    return task(AutoMovieProject.open(temporary));
  } finally {
    fs.rmSync(temporary, { force: true, recursive: true });
  }
};

const collectDirectory = (
  root: string,
  relative: string,
  files: Map<string, Uint8Array | null>,
): void => {
  const absolute = path.join(root, ...relative.split("/"));
  const status = lstatOrNull(absolute);
  if (status === null) return;
  if (status.isSymbolicLink() || status.isDirectory() === false)
    throw new Error(
      `Legacy inventory directory "${absolute}" must be a physical directory.`,
    );
  for (const entry of fs
    .readdirSync(absolute, { withFileTypes: true })
    .sort((left, right) => compareCodeUnits(left.name, right.name))) {
    const child = `${relative}/${entry.name}`;
    if (entry.isSymbolicLink())
      throw new Error(
        `Legacy inventory path "${child}" is a symlink or junction. Replace it with physical project content before import.`,
      );
    if (entry.isDirectory()) collectDirectory(root, child, files);
    else if (entry.isFile())
      files.set(child, fs.readFileSync(path.join(root, ...child.split("/"))));
    else
      throw new Error(
        `Legacy inventory path "${child}" is not a regular file or directory.`,
      );
  }
};

const readPhysicalFile = (
  root: string,
  relative: string,
  required: boolean,
): Uint8Array | null => {
  let current = root;
  for (const segment of relative.split("/")) {
    current = path.join(current, segment);
    const status = lstatOrNull(current);
    if (status === null) {
      if (required)
        throw new Error(`Required legacy project file "${current}" is absent.`);
      return null;
    }
    if (status.isSymbolicLink())
      throw new Error(
        `Legacy project path "${current}" is a symlink or junction. Replace it with physical project content before import.`,
      );
  }
  if (fs.statSync(current).isFile() === false)
    throw new Error(`Legacy project path "${current}" is not a regular file.`);
  return fs.readFileSync(current);
};

const validateLegacyManifest = (
  value: unknown,
  file: string,
): ILegacyManifest => {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    (value as { version?: unknown }).version !== 1 ||
    Array.isArray((value as { assets?: unknown }).assets) === false ||
    (value as { assets: unknown[] }).assets.some(
      (asset) => typeof asset !== "string",
    )
  )
    throw new Error(
      `Legacy manifest "${file}" must contain version 1 and a string asset array.`,
    );
  return value as ILegacyManifest;
};

const validateLegacyRevision = (value: unknown, file: string): number => {
  const revision = (value as { revision?: unknown } | null)?.revision;
  if (
    typeof revision !== "number" ||
    Number.isSafeInteger(revision) === false ||
    revision < 0
  )
    throw new Error(
      `Legacy revision "${file}" must contain one non-negative safe integer.`,
    );
  return revision;
};

const validateImportState = (
  value: unknown,
  stateRoot: string,
): IAppliedImportState => {
  const record = value as Partial<IAppliedImportState> | null;
  if (
    typeof record !== "object" ||
    record === null ||
    Array.isArray(value) ||
    record.version !== 1 ||
    typeof record.fingerprint !== "string" ||
    /^sha256:[0-9a-f]{64}$/.test(record.fingerprint) === false ||
    Array.isArray(record.absentOwnedDirectories) === false ||
    record.absentOwnedDirectories.some(
      (directory) =>
        ["src", "generated", "renders"].includes(directory) === false,
    ) ||
    new Set(record.absentOwnedDirectories).size !==
      record.absentOwnedDirectories.length ||
    typeof record.fileDigests !== "object" ||
    record.fileDigests === null ||
    ["manifest.json", "revision.json", IMPORT_PLAN_PATH].some(
      (file) =>
        /^sha256:[0-9a-f]{64}$/.test(record.fileDigests![file] ?? "") ===
        false,
    )
  )
    throw new Error(
      `Applied import marker under "${stateRoot}" is malformed. Preserve it and repair the import state before rollback.`,
    );
  return record as IAppliedImportState;
};

const collectFiles = (root: string): string[] => {
  const output: string[] = [];
  const visit = (directory: string): void => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, entry.name);
      if (entry.isSymbolicLink())
        throw changedImportError(root, path.relative(root, absolute));
      if (entry.isDirectory()) visit(absolute);
      else if (entry.isFile())
        output.push(path.relative(root, absolute).split(path.sep).join("/"));
      else throw changedImportError(root, path.relative(root, absolute));
    }
  };
  visit(root);
  return output.sort(compareCodeUnits);
};

const changedImportError = (stateRoot: string, relative: string): Error =>
  new Error(
    `Applied legacy import path "${relative}" under "${stateRoot}" changed after import. Preserve current production work; rollback refused.`,
  );

const importWarning = (
  code: string,
  target: string,
  pathValue: string | null,
  message: string,
): IAutoMovieDiagnostic => ({
  code,
  category: "warning",
  phase: "project",
  target,
  path: pathValue,
  message,
});

const projectIdOf = (root: string): string =>
  path.basename(root).trim() || "legacy-project";

const parseJson = (bytes: Uint8Array, file: string): unknown => {
  try {
    return JSON.parse(Buffer.from(bytes).toString("utf8")) as unknown;
  } catch (error) {
    throw new Error(`Invalid JSON "${file}": ${String(error)}`);
  }
};

const readJson = <T>(file: string): T | null => {
  const status = lstatOrNull(file);
  if (status === null) return null;
  if (status.isSymbolicLink() || status.isFile() === false)
    throw new Error(`Import state path "${file}" is not a physical file.`);
  return parseJson(fs.readFileSync(file), file) as T;
};

const serializeJson = (value: unknown): Uint8Array =>
  Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8");

const lstatOrNull = (file: string): fs.Stats | null => {
  try {
    return fs.lstatSync(file);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
};
