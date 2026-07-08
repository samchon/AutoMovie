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
 * - `renders/` — reserved for guide-pass outputs (#607/#608).
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
    this.manifest = readJson<IManifest>(this.manifestPath) ?? {
      version: 1,
      assets: [],
    };
    writeJsonAtomic(this.manifestPath, this.manifest);
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
      shots: this.readKeyedSlices<IAutoMovieShot>("shots"),
      beatEnds: this.readKeyedSlices<IAutoMovieBeatEndState>("beatEnds"),
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
      new Map(slate.shots.map((shot) => [shotBeat(shot.id), shot])),
    );
    this.reconcileBeatSlices(
      "beatEnds",
      new Map(slate.beatEnds.map((end) => [end.beat, end])),
    );
  }

  /** The stored prop specs, one per `props/<node>.json`, in filename order. */
  public storedProps(): IAutoMovieMcpPropSpec[] {
    return this.readKeyedSlices<IAutoMovieMcpPropSpec>("props");
  }

  /**
   * Upsert ONE forged prop spec as `props/<node>.json` (#671, the #617 upsert
   * rule below the slate): re-forging a prop replaces exactly its own file,
   * leaving sibling props byte-identical.
   */
  public saveProp(spec: IAutoMovieMcpPropSpec): void {
    writeJsonAtomic(
      path.join(this.root, "props", `${encodeURIComponent(spec.node)}.json`),
      spec,
    );
  }

  /** Remove ONE stored prop spec's file; the caller checks existence first. */
  public removeProp(node: string): void {
    const file = path.join(
      this.root,
      "props",
      `${encodeURIComponent(node)}.json`,
    );
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

  private readKeyedSlices<T>(dir: string): T[] {
    const base = path.join(this.root, dir);
    return fs
      .readdirSync(base)
      .filter((name) => name.endsWith(".json"))
      .sort()
      .map((name) => readJson<T>(path.join(base, name))!)
      .filter((value) => value !== null);
  }

  private reconcileBeatSlices(
    dir: string,
    byBeat: ReadonlyMap<string, unknown>,
  ): void {
    const base = path.join(this.root, dir);
    const wanted = new Set(
      [...byBeat.keys()].map((beat) => `${encodeURIComponent(beat)}.json`),
    );
    for (const name of fs.readdirSync(base))
      if (name.endsWith(".json") && !wanted.has(name))
        fs.rmSync(path.join(base, name));
    for (const [beat, value] of byBeat)
      writeJsonAtomic(
        path.join(base, `${encodeURIComponent(beat)}.json`),
        value,
      );
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

const shotBeat = (shotId: string): string =>
  shotId.startsWith("shot:") ? shotId.slice("shot:".length) : shotId;

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

const readJson = <T>(file: string): T | null =>
  fs.existsSync(file) ? (JSON.parse(fs.readFileSync(file, "utf8")) as T) : null;

/** Atomic write: temp file in the same directory, then rename over. */
const writeAtomic = (file: string, data: Uint8Array | string): void => {
  const temp = `${file}.tmp`;
  fs.writeFileSync(temp, data);
  fs.renameSync(temp, file);
};

const writeJsonAtomic = (file: string, value: unknown): void =>
  writeAtomic(file, `${JSON.stringify(value, null, 2)}\n`);
