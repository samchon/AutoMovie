import {
  forgeProp,
  validateModel as validateEngineModel,
  validateScriptTree,
} from "@automovie/engine";
import {
  IAutoMovieBeat,
  IAutoMovieBeatEndState,
  IAutoMovieConstraintViolation,
  IAutoMovieModel,
  IAutoMovieReviewNote,
  IAutoMovieScene,
  IAutoMovieScript,
  IAutoMovieScriptNode,
  IAutoMovieSequence,
  IAutoMovieShot,
} from "@automovie/interface";
import fs from "node:fs";
import path from "node:path";

import { toEnginePropSpec } from "../convert";
import {
  IAutoMovieMcpProjectSummary,
  IAutoMovieMcpPropSpec,
  IAutoMovieMcpWritableSlate,
} from "../dto";
import {
  validateSceneArtifact,
  validateSequenceArtifact,
} from "../validators/artifacts";
import {
  appendValidation,
  isRecord,
  pushViolation,
  validateArrayArtifact,
  validateNonEmptyId,
  validateNonEmptyText,
  validateObjectArtifact,
  validateRange,
  validateTransformArtifact,
  validateUniqueBy,
  validateVectorArtifact,
} from "../validators/primitives";
import { beatOf, shotIdOf } from "./shotKey";

/**
 * The resident AutoMovie project — **the project folder itself is the memory**
 * (#614, D012). Unlike AutoBe's hidden `.autobe` JSON mirror, every slice here
 * is a user-visible, human-readable file, and 3D/binary assets are first-class
 * managed artifacts referenced by path, never regenerable throwaways.
 *
 * Layout under the project root:
 *
 * - `automovie.json` — the manifest: format version and the asset index.
 * - `script.json` / `scene.json` / `notes.json` / `film.json` — slate slices.
 * - `shots/<beat>.json`, `beatEnds/<beat>.json` — per-beat slices, filenames
 *   URI-encoded from the beat id (Windows-safe, deterministic).
 * - `props/<node>.json` — forged prop specs (#671), filenames URI-encoded from
 *   the prop node; a resident `forgeProp` success upserts exactly its own
 *   file.
 * - `models/`, `assets/` — reserved for 3D binaries (GLB, textures); the store
 *   tracks and guards these paths, the host's adapters write the bytes (the
 *   render package's adapter discipline).
 * - `renders/` — where a resident `planRender`/`seeFrame` defaults its frame and
 *   encoded-video paths (#678); the host adapter writes the bytes and may track
 *   them with `registerAsset`.
 *
 * A **cleared slice's file is removed** (null script → no `script.json`, an
 * empty notes list → no `notes.json`), so presence in the tree always means
 * content — the invalidation cascade a `commitScript` performs on the slate is
 * mirrored by files disappearing. Writes are atomic (temp file + rename) and
 * pretty-printed; the whole store is synchronous, matching the tool layer.
 *
 * The prerequisite graph (#615) reads {@link summary}; guides (#616) and
 * per-artifact erase (#617) land beside this.
 */
export class AutoMovieProject {
  private manifest: IManifest;

  private constructor(public readonly root: string) {
    for (const dir of RESERVED_DIRS)
      fs.mkdirSync(path.join(root, dir), { recursive: true });
    const existing = readJson<unknown>(this.manifestPath);
    if (existing === null) {
      // A fresh project: create the manifest once.
      this.manifest = { version: 1, assets: [] };
      writeJsonAtomic(this.manifestPath, this.manifest);
    } else {
      // Opening an existing project is a pure read — keep the parsed manifest
      // (unknown host/future fields and all) in memory without rewriting it, so
      // an activation never churns the file's mtime or drops a field. It is
      // re-emitted only when an actual mutation (registerAsset) rewrites it,
      // where the spread preserves those unknown fields.
      this.manifest = validateManifest(this.manifestPath, existing);
    }
  }

  /**
   * Open (or initialize) the project at `rootDir`: the directory tree and
   * manifest are created when missing, and missing slice files simply mean an
   * empty slate — a fresh directory is a valid empty project.
   */
  public static open(rootDir: string): AutoMovieProject {
    const root = path.resolve(rootDir);
    assertProjectRootDirectory(root);
    return new AutoMovieProject(root);
  }

  /** The stored slate assembled from the slice files (film excluded). */
  public storedSlate(): Omit<IAutoMovieMcpWritableSlate, "film"> {
    const script = readValidatedJson<IAutoMovieScript>(
      this.slicePath("script.json"),
      validateScriptSlice,
    );
    const scene = readValidatedJson<IAutoMovieScene>(
      this.slicePath("scene.json"),
      validateSceneSlice,
    );
    const shots = this.readKeyedSlices<IAutoMovieShot>(
      "shots",
      {
        label: "shot id",
        expected: shotIdOf,
        actual: (shot) => shot.id,
      },
      (file, shot) => validateProjectValue(file, shot, validateShotSlice),
    );
    return {
      script,
      scene,
      shots,
      beatEnds: this.readKeyedSlices<IAutoMovieBeatEndState>(
        "beatEnds",
        {
          label: "beat end",
          expected: (beat) => beat,
          actual: (end) => end.beat,
        },
        (file, beatEnd) =>
          validateProjectValue(file, beatEnd, validateBeatEndSlice),
      ),
      notes:
        readValidatedJson<IAutoMovieReviewNote[]>(
          this.slicePath("notes.json"),
          validateNotesSlice,
        ) ?? [],
    };
  }

  /** The full writable slate, including the film slice. */
  public writableSlate(): IAutoMovieMcpWritableSlate {
    const stored = this.storedSlate();
    return {
      ...stored,
      film: readValidatedJson<IAutoMovieSequence>(
        this.slicePath("film.json"),
        (value, violations) =>
          appendValidation(
            violations,
            validateSequenceArtifact(value as IAutoMovieSequence, stored.shots),
          ),
      ),
    };
  }

  /**
   * Reorder a slate's per-beat arrays into the canonical stored order — the
   * filename-lexicographic order {@link readKeyedSlices} reads them back in — so
   * a resident commit returns the arrays exactly as the next resident read
   * would (#716). A `commitShot`/`commitBeatEnd` upsert appends a new beat at
   * the array end, diverging from the filename order a later read produces;
   * sorting by the same `${encodeURIComponent(beat)}.json` filename the store
   * writes closes that cross-mode gap without a second disk read. Non-keyed
   * slices (script/scene/notes/film) are untouched.
   */
  public orderResidentSlate(
    slate: IAutoMovieMcpWritableSlate,
  ): IAutoMovieMcpWritableSlate {
    return {
      ...slate,
      shots: orderByFilename(slate.shots, (shot) => beatOf(shot.id) ?? shot.id),
      beatEnds: orderByFilename(slate.beatEnds, (end) => end.beat),
    };
  }

  /**
   * Persist a whole slate into the tree, reconciling every slice: null slices
   * and empty lists remove their files, per-beat slices add/replace/remove by
   * presence — exactly the invalidation cascade the commit tools perform on the
   * slate, made visible as files.
   */
  public saveSlate(slate: IAutoMovieMcpWritableSlate): void {
    this.writeOrRemove("script.json", slate.script);
    this.writeOrRemove("scene.json", slate.scene);
    this.writeOrRemove("film.json", slate.film);
    this.writeOrRemove(
      "notes.json",
      slate.notes.length === 0 ? null : slate.notes,
    );
    this.reconcileBeatSlices(
      "shots",
      new Map(slate.shots.map((shot) => [beatOf(shot.id) ?? shot.id, shot])),
    );
    this.reconcileBeatSlices(
      "beatEnds",
      new Map(slate.beatEnds.map((end) => [end.beat, end])),
    );
  }

  /** The stored prop specs, one per `props/<node>.json`, in filename order. */
  public storedProps(): IAutoMovieMcpPropSpec[] {
    return this.readKeyedSlices<IAutoMovieMcpPropSpec>(
      "props",
      {
        label: "prop node",
        expected: (node) => node,
        actual: (spec) => spec.node,
      },
      (file, spec) => validateProjectValue(file, spec, validatePropSlice),
    );
  }

  /**
   * Upsert ONE forged prop spec as `props/<node>.json` (#671, the #617 upsert
   * rule below the slate): re-forging a prop replaces exactly its own file,
   * leaving sibling props byte-identical.
   */
  public saveProp(spec: IAutoMovieMcpPropSpec): void {
    writeJsonAtomic(
      path.join(this.root, "props", sliceFilename(spec.node)),
      spec,
    );
  }

  /** Remove ONE stored prop spec's file; the caller checks existence first. */
  public removeProp(node: string): void {
    const file = path.join(this.root, "props", sliceFilename(node));
    if (fs.existsSync(file)) fs.rmSync(file);
  }

  /**
   * Register a path-referenced binary asset (a GLB under `models/`, a texture
   * under `assets/`, a rendered frame under `renders/`). The store validates
   * and tracks the path and keeps the manifest's asset index consistent; when
   * `bytes` are given it also writes them atomically — but it **never silently
   * overwrites**: an already-registered path, or bytes aimed at an existing
   * file, throw. Registering without bytes tracks a file the host's adapter
   * writes (or wrote) itself.
   */
  public registerAsset(relativePath: string, bytes?: Uint8Array): string {
    const normalized = normalizeAssetPath(relativePath);
    if (this.manifest.assets.includes(normalized))
      throw new Error(
        `asset "${normalized}" is already registered; assets are never silently replaced`,
      );
    const absolute = path.join(this.root, ...normalized.split("/"));
    if (bytes !== undefined) {
      if (fs.existsSync(absolute))
        throw new Error(
          `asset file "${normalized}" already exists; refusing to overwrite it`,
        );
      fs.mkdirSync(path.dirname(absolute), { recursive: true });
      writeAtomic(absolute, bytes);
    }
    this.manifest = {
      ...this.manifest,
      assets: [...this.manifest.assets, normalized],
    };
    writeJsonAtomic(this.manifestPath, this.manifest);
    return normalized;
  }

  /** Tracked asset paths, project-relative, in registration order. */
  public get assets(): string[] {
    return [...this.manifest.assets];
  }

  /** What the project holds: which slices exist, and the tracked assets. */
  public summary(): IAutoMovieMcpProjectSummary {
    const slate = this.writableSlate();
    return {
      root: this.root,
      script: slate.script !== null,
      scene: slate.scene !== null,
      shots: slate.shots.map((shot) => shot.id),
      beatEnds: slate.beatEnds.map((end) => end.beat),
      notes: slate.notes.length,
      film: slate.film !== null,
      props: this.storedProps().map((spec) => spec.node),
      assets: this.assets,
    };
  }

  private get manifestPath(): string {
    return path.join(this.root, "automovie.json");
  }

  private slicePath(name: string): string {
    return path.join(this.root, name);
  }

  private readKeyedSlices<T>(
    dir: string,
    key: {
      label: string;
      expected: (fileKey: string) => string;
      actual: (value: T) => string | null | undefined;
    },
    validate?: (file: string, value: T) => void,
  ): T[] {
    const base = path.join(this.root, dir);
    const out: T[] = [];
    for (const name of fs
      .readdirSync(base)
      .filter((name) => name.endsWith(".json"))
      .sort()) {
      const file = path.join(base, name);
      const value = readJson<T>(file);
      if (value === null) continue;
      const fileKey = sliceKeyFromFilename(file, name);
      const expected = key.expected(fileKey);
      const actual = key.actual(value);
      if (actual !== expected)
        throw new AutoMovieProjectKeyError(file, key.label, expected, actual);
      validate?.(file, value);
      out.push(value);
    }
    return out;
  }

  private reconcileBeatSlices(
    dir: string,
    byBeat: ReadonlyMap<string, unknown>,
  ): void {
    const base = path.join(this.root, dir);
    // Keys whose filenames differ only by case would silently clobber each
    // other on a case-insensitive filesystem and then wedge the next read
    // with a filename/internal-key mismatch (#1011) — refuse before touching
    // the directory.
    const byLowerName = new Map<string, string>();
    for (const key of byBeat.keys()) {
      const lower = sliceFilename(key).toLowerCase();
      const prior = byLowerName.get(lower);
      if (prior !== undefined)
        throw new Error(
          `${dir} ids "${prior}" and "${key}" collide case-insensitively as "${sliceFilename(key)}"; case-insensitive filesystems would silently clobber one — rename one id`,
        );
      byLowerName.set(lower, key);
    }
    const wanted = new Set([...byBeat.keys()].map(sliceFilename));
    for (const name of fs.readdirSync(base))
      if (name.endsWith(".json") && !wanted.has(name))
        fs.rmSync(path.join(base, name));
    for (const [beat, value] of byBeat)
      writeJsonAtomic(path.join(base, sliceFilename(beat)), value);
  }

  private writeOrRemove(name: string, value: unknown | null): void {
    const file = this.slicePath(name);
    if (value === null) {
      if (fs.existsSync(file)) fs.rmSync(file);
      return;
    }
    writeJsonAtomic(file, value);
  }
}

/** Manifest shape persisted as `automovie.json`. */
interface IManifest {
  /** Project format version. */
  version: number;

  /** Tracked binary asset paths, project-relative, in registration order. */
  assets: string[];
}

const RESERVED_DIRS = [
  "shots",
  "beatEnds",
  "props",
  "models",
  "assets",
  "renders",
] as const;

/**
 * Check a project-relative asset path: forward slashes, no absolute paths, no
 * `..` escapes, no empty segments. Returns the normalized path, or the fault
 * describing the escape — the non-throwing core shared by the store (which
 * throws on fault) and the MCP tool surface (which reports it as a violation).
 */
export const checkAssetPath = (
  relativePath: string,
): { path: string } | { fault: string } => {
  const forward = relativePath.replace(/\\/g, "/");
  if (forward.trim().length === 0)
    return {
      fault: `asset path must be non-empty text, but was "${relativePath}"`,
    };
  if (
    path.isAbsolute(relativePath) ||
    /^[A-Za-z]:/.test(relativePath) ||
    forward.startsWith("/")
  )
    return {
      fault: `asset path must be project-relative, but was "${relativePath}"`,
    };
  const segments = forward.split("/");
  if (segments.some((segment) => segment === "" || segment === ".."))
    return {
      fault: `asset path must not contain empty or ".." segments, but was "${relativePath}"`,
    };
  return { path: segments.join("/") };
};

/** The throwing wrapper the store's own contract keeps. */
const normalizeAssetPath = (relativePath: string): string => {
  const checked = checkAssetPath(relativePath);
  if ("fault" in checked) throw new Error(checked.fault);
  return checked.path;
};

/**
 * The per-beat slice filename for a key — the single source of the
 * `${encodeURIComponent(key)}.json` convention the store reads, writes, and
 * orders by. Ordering a slate array by this exact string (not the bare encoded
 * key) reproduces {@link readKeyedSlices}' readdir+sort order precisely: the
 * `.json` suffix injects a `.` separator that shifts prefix-boundary
 * comparisons (`"a"` vs `"a-"` sorts opposite to `"a.json"` vs `"a-.json"`).
 */
/** DOS device basenames Windows refuses regardless of extension. */
const WINDOWS_DEVICE_NAMES = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;

const sliceFilename = (key: string): string => {
  // encodeURIComponent leaves `*` (invalid on Windows — EINVAL at write) and
  // DOS device basenames (`con`, `nul`, ...) intact (#1011). Escape both with
  // ordinary percent-encoding so `decodeURIComponent` still round-trips the
  // key; existing stores are unaffected (such files could never be written).
  // Windows reserves the segment BEFORE THE FIRST DOT (`con.notes.json` is
  // refused on Windows 10 and earlier just like `con.json`), and dots survive
  // encoding — so the device test runs on the stem, not the whole key (#1064).
  let encoded = encodeURIComponent(key).replace(/\*/g, "%2A");
  const stem = encoded.split(".", 1)[0]!;
  if (WINDOWS_DEVICE_NAMES.test(stem))
    encoded = `%${encoded
      .charCodeAt(0)
      .toString(16)
      .toUpperCase()
      .padStart(2, "0")}${encoded.slice(1)}`;
  return `${encoded}.json`;
};

/** Order per-beat slices by their stored filename (readKeyedSlices' order). */
const orderByFilename = <T>(items: T[], keyOf: (item: T) => string): T[] => {
  const named = items.map((item) => ({
    item,
    name: sliceFilename(keyOf(item)),
  }));
  named.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  return named.map((entry) => entry.item);
};

class AutoMovieProjectJsonError extends Error {
  public constructor(file: string, reason: string) {
    super(
      `AutoMovie project file "${file}" contains malformed JSON. ` +
        `Fix or remove this file, then call openProject again. ` +
        `Parser detail: ${reason}`,
    );
    this.name = "AutoMovieProjectJsonError";
  }
}

class AutoMovieProjectKeyError extends Error {
  public constructor(
    file: string,
    label: string,
    expected: string,
    actual: string | null | undefined,
  ) {
    super(
      `AutoMovie project file "${file}" has a keyed-slice mismatch. ` +
        `Fix or remove this file, then call openProject again. ` +
        `The filename expected ${label} "${expected}", but found ${formatKey(actual)}.`,
    );
    this.name = "AutoMovieProjectKeyError";
  }
}

class AutoMovieProjectShapeError extends Error {
  public constructor(file: string, detail: string) {
    super(
      `AutoMovie project file "${file}" is semantically invalid. ` +
        `Fix or remove this file, then call openProject again. ` +
        `Validation detail: ${detail}`,
    );
    this.name = "AutoMovieProjectShapeError";
  }
}

class AutoMovieProjectRootError extends Error {
  public constructor(root: string, detail: string) {
    super(
      `AutoMovie project root "${root}" is not a usable directory. ` +
        `Fix or remove this path, then call openProject again. ` +
        `Detail: ${detail}`,
    );
    this.name = "AutoMovieProjectRootError";
  }
}

const assertProjectRootDirectory = (root: string): void => {
  try {
    if (fs.existsSync(root)) {
      if (!fs.statSync(root).isDirectory())
        throw new AutoMovieProjectRootError(
          root,
          "project root must be a directory",
        );
      return;
    }
    fs.mkdirSync(root, { recursive: true });
  } catch (error) {
    if (error instanceof AutoMovieProjectRootError) throw error;
    const detail = error instanceof Error ? error.message : String(error);
    throw new AutoMovieProjectRootError(root, detail);
  }
};

const validateManifest = (file: string, value: unknown): IManifest => {
  if (!isRecord(value))
    throw new AutoMovieProjectShapeError(
      file,
      "manifest must be a JSON object",
    );
  if (value.version !== 1)
    throw new AutoMovieProjectShapeError(
      file,
      `manifest version must be 1, but was ${String(value.version)}`,
    );
  if (
    !Array.isArray(value.assets) ||
    value.assets.some((asset) => typeof asset !== "string")
  )
    throw new AutoMovieProjectShapeError(
      file,
      "manifest assets must be an array of strings",
    );
  const seenAssets = new Set<string>();
  const assets = value.assets.map((asset, index) => {
    const checked = checkAssetPath(asset);
    if ("fault" in checked)
      throw new AutoMovieProjectShapeError(
        file,
        `manifest assets[${index}] invalid: ${checked.fault}`,
      );
    if (seenAssets.has(checked.path))
      throw new AutoMovieProjectShapeError(
        file,
        `manifest assets[${index}] duplicates "${checked.path}"`,
      );
    seenAssets.add(checked.path);
    return checked.path;
  });
  return { ...value, assets } as unknown as IManifest;
};

const validateScriptSlice = (
  value: unknown,
  violations: IAutoMovieConstraintViolation[],
): void => {
  if (!validateObjectArtifact(value, "$input", "script", violations)) return;
  validateNonEmptyText(value.logline, "$input.logline", "logline", violations);
  validateNonEmptyText(value.theme, "$input.theme", "theme", violations);
  validateArrayArtifact(value.cast, "$input.cast", "script cast", violations);
  validateUniqueBy(
    asArray(value.cast).map((member, index) => ({
      id: isRecord(member) ? member.node : undefined,
      path: `$input.cast[${index}].node`,
    })),
    "cast node",
    violations,
  );
  asArray(value.cast).forEach((member, index) => {
    const path = `$input.cast[${index}]`;
    if (!validateObjectArtifact(member, path, "cast member", violations))
      return;
    validateNonEmptyId(member.node, `${path}.node`, "cast node", violations);
    validateNonEmptyText(
      member.character,
      `${path}.character`,
      "cast character",
      violations,
    );
    if (member.modelRef !== null && member.modelRef !== undefined)
      validateNonEmptyText(
        member.modelRef,
        `${path}.modelRef`,
        "cast modelRef",
        violations,
      );
  });

  validateArrayArtifact(
    value.beats,
    "$input.beats",
    "script beats",
    violations,
  );
  validateUniqueBy(
    asArray(value.beats).map((beat, index) => ({
      id: isRecord(beat) ? beat.id : undefined,
      path: `$input.beats[${index}].id`,
    })),
    "beat id",
    violations,
  );
  if (Array.isArray(value.beats) && value.beats.length === 0)
    pushViolation(
      violations,
      "type",
      "$input.beats",
      "script must contain at least one beat",
      value.beats,
    );
  asArray(value.beats).forEach((beat, index) => {
    const path = `$input.beats[${index}]`;
    if (!validateObjectArtifact(beat, path, "script beat", violations)) return;
    validateNonEmptyId(beat.id, `${path}.id`, "beat id", violations);
    validateNonEmptyText(beat.name, `${path}.name`, "beat name", violations);
    validateNonEmptyText(
      beat.summary,
      `${path}.summary`,
      "beat summary",
      violations,
    );
    validateRange(
      beat.durationHint,
      `${path}.durationHint`,
      0,
      Infinity,
      "beat durationHint",
      violations,
      false,
    );
  });
  validateScriptTreeSlice(value.tree, value.beats, violations);
};

const validateScriptTreeSlice = (
  tree: unknown,
  beats: unknown,
  violations: IAutoMovieConstraintViolation[],
): void => {
  if (tree === undefined || tree === null) return;
  const before = violations.length;
  if (!validateArrayArtifact(tree, "$input.tree", "script tree", violations))
    return;
  tree.forEach((node, index) => {
    const path = `$input.tree[${index}]`;
    if (!validateObjectArtifact(node, path, "script tree node", violations))
      return;
    validateNonEmptyId(
      node.id,
      `${path}.id`,
      "script tree node id",
      violations,
    );
    if (
      node.kind !== "intent" &&
      node.kind !== "act" &&
      node.kind !== "scene" &&
      node.kind !== "group" &&
      node.kind !== "beat"
    )
      pushViolation(
        violations,
        "type",
        `${path}.kind`,
        'script tree node kind must be one of "intent", "act", "scene", "group", or "beat"',
        node.kind,
      );
    validateNullableId(
      node.parent,
      `${path}.parent`,
      "script tree node parent",
      violations,
    );
    validateNullableId(
      node.temporal,
      `${path}.temporal`,
      "script tree node temporal predecessor",
      violations,
    );
    if (
      validateArrayArtifact(
        node.interactsWith,
        `${path}.interactsWith`,
        "script tree interactions",
        violations,
      )
    )
      node.interactsWith.forEach((other, otherIndex) =>
        validateNonEmptyId(
          other,
          `${path}.interactsWith[${otherIndex}]`,
          "script tree interaction target",
          violations,
        ),
      );
    if (
      !validateObjectArtifact(
        node.payload,
        `${path}.payload`,
        "script tree payload",
        violations,
      )
    )
      return;
    validateScriptTreePayload(node, path, violations);
  });
  if (violations.length !== before || !Array.isArray(beats)) return;
  appendValidation(
    violations,
    validateScriptTree({
      tree: tree as IAutoMovieScriptNode[],
      beats: beats as IAutoMovieBeat[],
    }),
  );
};

const validateNullableId = (
  value: unknown,
  path: string,
  label: string,
  violations: IAutoMovieConstraintViolation[],
): void => {
  if (value === null) return;
  validateNonEmptyId(value, path, label, violations);
};

const validateScriptTreePayload = (
  node: Record<string, unknown>,
  path: string,
  violations: IAutoMovieConstraintViolation[],
): void => {
  const payload = node.payload;
  if (!isRecord(payload)) return;
  switch (node.kind) {
    case "intent":
      validateNonEmptyText(
        payload.logline,
        `${path}.payload.logline`,
        "intent logline",
        violations,
      );
      validateNonEmptyText(
        payload.theme,
        `${path}.payload.theme`,
        "intent theme",
        violations,
      );
      break;
    case "act":
      validateNonEmptyText(
        payload.purpose,
        `${path}.payload.purpose`,
        "act purpose",
        violations,
      );
      break;
    case "scene":
      if (
        payload.interiorExterior !== "INT" &&
        payload.interiorExterior !== "EXT"
      )
        pushViolation(
          violations,
          "type",
          `${path}.payload.interiorExterior`,
          'scene interiorExterior must be "INT" or "EXT"',
          payload.interiorExterior,
        );
      validateNonEmptyText(
        payload.location,
        `${path}.payload.location`,
        "scene location",
        violations,
      );
      validateNonEmptyText(
        payload.timeOfDay,
        `${path}.payload.timeOfDay`,
        "scene timeOfDay",
        violations,
      );
      if (payload.description !== null)
        validateNonEmptyText(
          payload.description,
          `${path}.payload.description`,
          "scene description",
          violations,
        );
      break;
    case "group":
      validateNonEmptyText(
        payload.rationale,
        `${path}.payload.rationale`,
        "group rationale",
        violations,
      );
      break;
    case "beat":
      validateNonEmptyId(
        payload.beat,
        `${path}.payload.beat`,
        "tree beat id",
        violations,
      );
      validateNonEmptyText(
        payload.direction,
        `${path}.payload.direction`,
        "beat direction",
        violations,
      );
      if (
        validateArrayArtifact(
          payload.dialogue,
          `${path}.payload.dialogue`,
          "beat dialogue",
          violations,
        )
      )
        payload.dialogue.forEach((line, index) => {
          const linePath = `${path}.payload.dialogue[${index}]`;
          if (
            !validateObjectArtifact(
              line,
              linePath,
              "beat dialogue line",
              violations,
            )
          )
            return;
          validateNonEmptyText(
            line.speaker,
            `${linePath}.speaker`,
            "dialogue speaker",
            violations,
          );
          validateNonEmptyText(
            line.text,
            `${linePath}.text`,
            "dialogue text",
            violations,
          );
          if (line.anchor !== null)
            validateRange(
              line.anchor,
              `${linePath}.anchor`,
              0,
              Infinity,
              "dialogue anchor",
              violations,
            );
        });
      if (payload.caption !== null)
        validateNonEmptyText(
          payload.caption,
          `${path}.payload.caption`,
          "beat caption",
          violations,
        );
      break;
  }
};

const validateSceneSlice = (
  value: unknown,
  violations: IAutoMovieConstraintViolation[],
): void => {
  appendValidation(
    violations,
    validateSceneArtifact(
      value as IAutoMovieScene,
      residentSceneModels(value).map((id) => ({ id, skeleton: null })),
    ),
  );
};

const validateNotesSlice = (
  value: unknown,
  violations: IAutoMovieConstraintViolation[],
): void => {
  if (!validateArrayArtifact(value, "$input", "review notes", violations))
    return;
  value.forEach((note, index) => {
    const path = `$input[${index}]`;
    if (!validateObjectArtifact(note, path, "review note", violations)) return;
    validateNonEmptyId(note.beat, `${path}.beat`, "note beat", violations);
    if (
      note.tier !== "structural" &&
      note.tier !== "physical" &&
      note.tier !== "visual"
    )
      pushViolation(
        violations,
        "type",
        `${path}.tier`,
        'note tier must be one of "structural", "physical", or "visual"',
        note.tier,
      );
    validateNonEmptyText(note.issue, `${path}.issue`, "note issue", violations);
    validateNonEmptyText(
      note.suggestion,
      `${path}.suggestion`,
      "note suggestion",
      violations,
    );
  });
};

const validateShotSlice = (
  value: unknown,
  violations: IAutoMovieConstraintViolation[],
): void => {
  if (!validateObjectArtifact(value, "$input", "shot", violations)) return;
  validateNonEmptyId(value.id, "$input.id", "shot id", violations);
  validateNonEmptyId(value.scene, "$input.scene", "shot scene", violations);
  validateNonEmptyId(value.camera, "$input.camera", "shot camera", violations);
  validateRange(
    value.duration,
    "$input.duration",
    0,
    Infinity,
    "shot duration",
    violations,
    false,
  );
  if (value.cameraMotion !== null && value.cameraMotion !== undefined)
    validateObjectArtifact(
      value.cameraMotion,
      "$input.cameraMotion",
      "shot cameraMotion",
      violations,
    );
  else if (value.cameraMotion === undefined)
    pushViolation(
      violations,
      "type",
      "$input.cameraMotion",
      "shot cameraMotion must be null or a clip",
      value.cameraMotion,
    );
  validateArrayArtifact(
    value.performances,
    "$input.performances",
    "shot performances",
    violations,
  );
  validateUniqueBy(
    asArray(value.performances).map((performance, index) => ({
      id: isRecord(performance) ? performance.node : undefined,
      path: `$input.performances[${index}].node`,
    })),
    "shot performance node",
    violations,
  );
  asArray(value.performances).forEach((performance, index) => {
    const path = `$input.performances[${index}]`;
    if (
      !validateObjectArtifact(performance, path, "shot performance", violations)
    )
      return;
    validateNonEmptyId(
      performance.node,
      `${path}.node`,
      "performance node",
      violations,
    );
    validateRange(
      performance.startOffset,
      `${path}.startOffset`,
      0,
      typeof value.duration === "number" ? value.duration : Infinity,
      "performance startOffset",
      violations,
    );
    if (performance.motion !== null && performance.motion !== undefined)
      validateNonEmptyId(
        performance.motion,
        `${path}.motion`,
        "performance motion",
        violations,
      );
  });
  validateArrayArtifact(
    value.objectMotions,
    "$input.objectMotions",
    "shot objectMotions",
    violations,
  );
};

const validateBeatEndSlice = (
  value: unknown,
  violations: IAutoMovieConstraintViolation[],
): void => {
  if (!validateObjectArtifact(value, "$input", "beat end", violations)) return;
  validateNonEmptyId(value.beat, "$input.beat", "beat id", violations);
  validateNonEmptyId(value.shot, "$input.shot", "shot id", violations);
  if (
    typeof value.beat === "string" &&
    typeof value.shot === "string" &&
    value.shot !== shotIdOf(value.beat)
  )
    pushViolation(
      violations,
      "type",
      "$input.shot",
      `beat-end shot must equal "${shotIdOf(value.beat)}"`,
      value.shot,
    );
  validateArrayArtifact(
    value.actors,
    "$input.actors",
    "beat-end actors",
    violations,
  );
  validateUniqueBy(
    asArray(value.actors).map((actor, index) => ({
      id: isRecord(actor) ? actor.node : undefined,
      path: `$input.actors[${index}].node`,
    })),
    "beat-end actor",
    violations,
  );
  asArray(value.actors).forEach((actor, index) => {
    const path = `$input.actors[${index}]`;
    if (!validateObjectArtifact(actor, path, "beat-end actor", violations))
      return;
    validateNonEmptyId(actor.node, `${path}.node`, "actor node", violations);
    validateTransformArtifact(
      actor.transform,
      `${path}.transform`,
      "beat-end actor transform",
      violations,
    );
    validateVectorArtifact(
      actor.facing,
      `${path}.facing`,
      "beat-end actor facing",
      violations,
    );
    validateRange(
      actor.localTime,
      `${path}.localTime`,
      0,
      Infinity,
      "beat-end actor localTime",
      violations,
    );
    if (actor.motion !== null && actor.motion !== undefined)
      validateNonEmptyId(
        actor.motion,
        `${path}.motion`,
        "beat-end actor motion",
        violations,
      );
  });
};

const validatePropSlice = (
  value: unknown,
  violations: IAutoMovieConstraintViolation[],
): void => {
  if (!validateObjectArtifact(value, "$input", "prop spec", violations)) return;
  const before = violations.length;
  validateNonEmptyId(value.node, "$input.node", "prop node", violations);
  if (
    validateObjectArtifact(
      value.model,
      "$input.model",
      "prop model",
      violations,
    )
  )
    appendValidation(
      violations,
      validateEngineModel({ model: value.model as unknown as IAutoMovieModel }),
    );
  if (value.articulation !== null && value.articulation !== undefined)
    validateObjectArtifact(
      value.articulation,
      "$input.articulation",
      "prop articulation",
      violations,
    );
  else if (value.articulation === undefined)
    pushViolation(
      violations,
      "type",
      "$input.articulation",
      "prop articulation must be null or a JSON object",
      value.articulation,
    );
  if (violations.length !== before) return;
  try {
    const forged = forgeProp(
      toEnginePropSpec(value as unknown as IAutoMovieMcpPropSpec),
    );
    if (forged.success === false) violations.push(...forged.violations);
  } catch {
    pushViolation(
      violations,
      "type",
      "$input.articulation",
      "prop articulation must match the forgeProp schema",
      value.articulation,
    );
  }
};

const readJson = <T>(file: string): T | null => {
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as T;
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new AutoMovieProjectJsonError(file, reason);
  }
};

const validateProjectValue = <T>(
  file: string,
  value: T,
  validate: (
    value: unknown,
    violations: IAutoMovieConstraintViolation[],
  ) => void,
): void => {
  const violations: IAutoMovieConstraintViolation[] = [];
  validate(value, violations);
  if (violations.length > 0)
    throw new AutoMovieProjectShapeError(file, describeViolations(violations));
};

const readValidatedJson = <T>(
  file: string,
  validate: (
    value: unknown,
    violations: IAutoMovieConstraintViolation[],
  ) => void,
): T | null => {
  const value = readJson<unknown>(file);
  if (value === null) return null;
  validateProjectValue(file, value, validate);
  return value as T;
};

const sliceKeyFromFilename = (file: string, name: string): string => {
  try {
    return decodeURIComponent(name.slice(0, -".json".length));
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new AutoMovieProjectKeyError(
      file,
      "filename key",
      "a URI-encoded key",
      `${name} (${reason})`,
    );
  }
};

const formatKey = (key: string | null | undefined): string =>
  key === null || key === undefined ? "none" : `"${key}"`;

const asArray = (value: unknown): unknown[] =>
  Array.isArray(value) ? value : [];

const residentSceneModels = (value: unknown): string[] => {
  if (!isRecord(value)) return [];
  return [
    ...new Set(
      asArray(value.nodes)
        .filter(isRecord)
        .map((node) => node.model)
        .filter((model): model is string => typeof model === "string"),
    ),
  ];
};

const describeViolations = (
  violations: readonly IAutoMovieConstraintViolation[],
): string =>
  violations
    .slice(0, 5)
    .map((violation) => `${violation.path}: ${violation.expected}`)
    .join("; ");

/** Atomic write: temp file in the same directory, then rename over. */
const writeAtomic = (file: string, data: Uint8Array | string): void => {
  const temp = `${file}.tmp`;
  fs.writeFileSync(temp, data);
  fs.renameSync(temp, file);
};

const writeJsonAtomic = (file: string, value: unknown): void =>
  writeAtomic(file, `${JSON.stringify(value, null, 2)}\n`);
