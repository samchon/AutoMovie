import {
  IAutoMovieBeatEndState,
  IAutoMovieReviewNote,
  IAutoMovieScene,
  IAutoMovieScript,
  IAutoMovieSequence,
  IAutoMovieShot,
} from "@automovie/interface";
import fs from "node:fs";
import path from "node:path";

import {
  IAutoMovieMcpProjectSummary,
  IAutoMovieMcpPropSpec,
  IAutoMovieMcpWritableSlate,
} from "../dto";
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
    const existing = readJson<IManifest>(this.manifestPath);
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
      this.manifest = existing;
    }
  }

  /**
   * Open (or initialize) the project at `rootDir`: the directory tree and
   * manifest are created when missing, and missing slice files simply mean an
   * empty slate — a fresh directory is a valid empty project.
   */
  public static open(rootDir: string): AutoMovieProject {
    return new AutoMovieProject(path.resolve(rootDir));
  }

  /** The stored slate assembled from the slice files (film excluded). */
  public storedSlate(): Omit<IAutoMovieMcpWritableSlate, "film"> {
    return {
      script: readJson<IAutoMovieScript>(this.slicePath("script.json")),
      scene: readJson<IAutoMovieScene>(this.slicePath("scene.json")),
      shots: this.readKeyedSlices<IAutoMovieShot>("shots", {
        label: "shot id",
        expected: shotIdOf,
        actual: (shot) => shot.id,
      }),
      beatEnds: this.readKeyedSlices<IAutoMovieBeatEndState>("beatEnds", {
        label: "beat end",
        expected: (beat) => beat,
        actual: (end) => end.beat,
      }),
      notes:
        readJson<IAutoMovieReviewNote[]>(this.slicePath("notes.json")) ?? [],
    };
  }

  /** The full writable slate, including the film slice. */
  public writableSlate(): IAutoMovieMcpWritableSlate {
    return {
      ...this.storedSlate(),
      film: readJson<IAutoMovieSequence>(this.slicePath("film.json")),
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
    return this.readKeyedSlices<IAutoMovieMcpPropSpec>("props", {
      label: "prop node",
      expected: (node) => node,
      actual: (spec) => spec.node,
    });
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
      out.push(value);
    }
    return out;
  }

  private reconcileBeatSlices(
    dir: string,
    byBeat: ReadonlyMap<string, unknown>,
  ): void {
    const base = path.join(this.root, dir);
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
const sliceFilename = (key: string): string =>
  `${encodeURIComponent(key)}.json`;

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

const readJson = <T>(file: string): T | null => {
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as T;
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new AutoMovieProjectJsonError(file, reason);
  }
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

/** Atomic write: temp file in the same directory, then rename over. */
const writeAtomic = (file: string, data: Uint8Array | string): void => {
  const temp = `${file}.tmp`;
  fs.writeFileSync(temp, data);
  fs.renameSync(temp, file);
};

const writeJsonAtomic = (file: string, value: unknown): void =>
  writeAtomic(file, `${JSON.stringify(value, null, 2)}\n`);
