import {
  IAutoMovieAcceptanceScenario,
  IAutoMovieDesignMutationConsequences,
  IAutoMovieDesignMutationOutput,
  IAutoMovieDesignTarget,
  IAutoMovieFormationDesign,
  IAutoMovieGeneratedManifest,
  IAutoMovieModelRecipe,
  IAutoMovieProductionDesign,
  IAutoMovieProductionDesignInventory,
  IAutoMovieProductionManifest,
  IAutoMovieRenderBundleManifest,
  IAutoMovieReviewTarget,
  IAutoMovieShotContract,
  IAutoMovieStoredReview,
  IAutoMovieWorldDesign,
} from "@automovie/interface";
import fs from "node:fs";
import path from "node:path";
import typia, { IValidation } from "typia";

import { acquireCommitLock, releaseCommitLock } from "../project/commitLock";
import {
  canonicalAutoMovieJsonBytes,
  compareCodeUnits,
  digestAutoMovieBytes,
} from "./contentIdentity";
import {
  IAutoMovieProductionDesignGraph,
  validateAutoMovieProductionGraph,
} from "./validateProductionDesign";

/** Summary returned when a production repository is opened. */
export interface IAutoMovieProductionProjectSummary {
  /** Absolute active root. */
  root: string;
  /** Production manifest format. */
  formatVersion: number;
  /** Current monotonic revision. */
  revision: number;
  /** True when this call initialized a fresh production manifest. */
  initialized: boolean;
}

/**
 * Tracked production repository for the coding-agent-first application.
 *
 * `.automovie/design` and `.automovie/reviews` are human-readable tracked
 * contracts. `src` remains coding-agent owned, `generated` compiler owned and
 * `renders` content addressed. Every one-artifact mutation is staged before an
 * optimistic revision check and one short commit lock.
 */
export class AutoMovieProductionProject {
  private readonly rootReal: string;
  private readonly automovieRoot: string;
  private readonly manifestPath: string;
  private readonly revisionPath: string;
  private readonly lockPath: string;
  private readonly initialized_: boolean;
  private manifest_: IAutoMovieProductionManifest & Record<string, unknown>;
  private lastReadRevision_: number;

  private constructor(public readonly root: string) {
    this.rootReal = fs.realpathSync(root);
    this.automovieRoot = path.join(root, ".automovie");
    this.manifestPath = path.join(this.automovieRoot, "manifest.json");
    this.revisionPath = path.join(this.automovieRoot, "revision.json");
    this.lockPath = path.join(this.automovieRoot, "revision.lock");
    this.mkdirOwned(this.automovieRoot);
    for (const directory of DESIGN_DIRECTORIES) {
      const absolute = path.join(this.automovieRoot, directory);
      this.mkdirOwned(absolute);
    }
    for (const directory of REVIEW_DIRECTORIES) {
      const absolute = path.join(this.automovieRoot, directory);
      this.mkdirOwned(absolute);
    }
    const existing = readOwnedJson(this.rootReal, this.manifestPath);
    this.initialized_ = existing === undefined;
    if (existing === undefined) {
      this.manifest_ = {
        formatVersion: 2,
        projectId: projectIdOf(root),
        sourceRoots: ["src"],
        generatedRoot: "generated",
        renderRoot: "renders",
      };
      writeJsonAtomic(this.manifestPath, this.manifest_);
    } else this.manifest_ = validateManifest(existing, this.manifestPath);
    validateOwnershipLayout(this.root, this.manifest_, this.manifestPath);
    for (const directory of [
      ...this.manifest_.sourceRoots,
      this.manifest_.generatedRoot,
      this.manifest_.renderRoot,
    ])
      this.mkdirOwned(this.resolveOwnedDirectory(directory));
    this.lastReadRevision_ = readRevision(this.rootReal, this.revisionPath);
  }

  private mkdirOwned(directory: string): void {
    assertRealAncestorInside(this.rootReal, directory);
    fs.mkdirSync(directory, {
      recursive: true,
    });
    assertRealAncestorInside(this.rootReal, directory);
  }

  /** Open or initialize a production repository. */
  public static open(rootDirectory: string): AutoMovieProductionProject {
    const root = path.resolve(rootDirectory);
    if (fs.existsSync(root) && fs.statSync(root).isDirectory() === false)
      throw new Error(
        `AutoMovie production root "${root}" is not a directory. Choose a project directory in openProject.`,
      );
    fs.mkdirSync(root, { recursive: true });
    return new AutoMovieProductionProject(root);
  }

  /** Current manifest with unknown future fields preserved. */
  public manifest(): IAutoMovieProductionManifest {
    this.refreshRevision();
    return structuredClone(this.manifest_);
  }

  /** Current open summary. */
  public summary(): IAutoMovieProductionProjectSummary {
    this.refreshRevision();
    return {
      root: this.root,
      formatVersion: this.manifest_.formatVersion,
      revision: this.lastReadRevision_,
      initialized: this.initialized_,
    };
  }

  /** Current monotonic revision. */
  public revision(): number {
    this.refreshRevision();
    return this.lastReadRevision_;
  }

  /** Compact deterministic design inventory. */
  public inventory(): IAutoMovieProductionDesignInventory {
    const graph = this.graph();
    return {
      production: graph.production !== null,
      models: [...graph.models.keys()],
      world: graph.world !== null,
      formations: [...graph.formations.keys()],
      shots: [...graph.shots.keys()],
      acceptance: [...graph.acceptance.keys()],
    };
  }

  /** Load every current design artifact and validate its stored shape. */
  public graph(): IAutoMovieProductionDesignGraph {
    this.refreshRevision();
    return this.loadGraph();
  }

  private loadGraph(): IAutoMovieProductionDesignGraph {
    return {
      production: readOwnedTypedJson(
        this.rootReal,
        this.designPath({ kind: "production" }),
        validateProductionDesign,
      ),
      models: this.readKeyedDesigns("design/models", validateModelRecipe),
      world: readOwnedTypedJson(
        this.rootReal,
        this.designPath({ kind: "world" }),
        validateWorldDesign,
      ),
      formations: this.readKeyedDesigns(
        "design/formations",
        validateFormationDesign,
      ),
      shots: this.readKeyedDesigns("design/shots", validateShotContract),
      acceptance: this.readKeyedDesigns(
        "design/acceptance",
        validateAcceptanceScenario,
      ),
    };
  }

  /** Read one exact design artifact, returning null when absent. */
  public design(target: IAutoMovieDesignTarget): unknown {
    const graph = this.graph();
    switch (target.kind) {
      case "production":
        return graph.production;
      case "model":
        return graph.models.get(target.id) ?? null;
      case "world":
        return graph.world;
      case "formation":
        return graph.formations.get(target.id) ?? null;
      case "shot":
        return graph.shots.get(target.id) ?? null;
      case "acceptance":
        return graph.acceptance.get(target.id) ?? null;
    }
  }

  /** Upsert the singleton production design. */
  public setProductionDesign(
    design: IAutoMovieProductionDesign,
  ): IAutoMovieDesignMutationOutput {
    return this.setDesign(
      { kind: "production" },
      design,
      validateProductionDesign(design),
    );
  }

  /** Upsert exactly one model recipe. */
  public setModelRecipe(
    design: IAutoMovieModelRecipe,
  ): IAutoMovieDesignMutationOutput {
    return this.setDesign(
      { kind: "model", id: inputDesignId(design) },
      design,
      validateModelRecipe(design),
    );
  }

  /** Upsert the singleton world design. */
  public setWorldDesign(
    design: IAutoMovieWorldDesign,
  ): IAutoMovieDesignMutationOutput {
    return this.setDesign(
      { kind: "world" },
      design,
      validateWorldDesign(design),
    );
  }

  /** Upsert exactly one formation. */
  public setFormationDesign(
    design: IAutoMovieFormationDesign,
  ): IAutoMovieDesignMutationOutput {
    return this.setDesign(
      { kind: "formation", id: inputDesignId(design) },
      design,
      validateFormationDesign(design),
    );
  }

  /** Upsert exactly one code-bound shot contract. */
  public setShotContract(
    design: IAutoMovieShotContract,
  ): IAutoMovieDesignMutationOutput {
    return this.setDesign(
      { kind: "shot", id: inputDesignId(design) },
      design,
      validateShotContract(design),
    );
  }

  /** Upsert exactly one acceptance scenario. */
  public setAcceptanceScenario(
    design: IAutoMovieAcceptanceScenario,
  ): IAutoMovieDesignMutationOutput {
    return this.setDesign(
      { kind: "acceptance", id: inputDesignId(design) },
      design,
      validateAcceptanceScenario(design),
    );
  }

  /** Remove exactly one unreferenced design artifact. */
  public eraseDesignArtifact(
    target: IAutoMovieDesignTarget,
  ): IAutoMovieDesignMutationOutput {
    const graph = this.loadGraph();
    const current = designFromGraph(graph, target);
    const consequences = consequencesOf(graph, target);
    if (current === null)
      return {
        accepted: false,
        revision: this.lastReadRevision_,
        target,
        fingerprint: null,
        consequences,
        diagnostics: [
          {
            code: "design-missing",
            category: "error",
            phase: "design",
            target: targetKey(target),
            path: relativeToRoot(this.root, this.designPath(target)),
            message: `The addressed design does not exist. Inspect the project and erase a current target.`,
          },
        ],
      };
    const references = referencesTo(graph, target);
    if (references.length !== 0)
      return {
        accepted: false,
        revision: this.lastReadRevision_,
        target,
        fingerprint: digestAutoMovieBytes(canonicalAutoMovieJsonBytes(current)),
        consequences,
        diagnostics: references.map((reference) => ({
          code: "design-reference-active",
          category: "error" as const,
          phase: "design" as const,
          target: targetKey(target),
          path: relativeToRoot(this.root, this.designPath(target)),
          message: `${reference} still references this design. Update that artifact before eraseDesignArtifact.`,
        })),
      };
    const revision = this.commitFiles([
      { path: this.designPath(target), content: null },
    ]);
    return {
      accepted: true,
      revision,
      target,
      fingerprint: null,
      consequences,
      diagnostics: [],
    };
  }

  /** Resolve and read one coding-agent-owned source module. */
  public readSource(relativePath: string): Uint8Array {
    const file = this.resolveSourcePath(relativePath);
    if (fs.existsSync(file) === false)
      throw new Error(
        `Source "${relativePath}" does not exist. Create it under a configured source root before compileProject.`,
      );
    const real = fs.realpathSync(file);
    if (this.isInSourceRoot(real) === false)
      throw new Error(
        `Source "${relativePath}" escapes its configured source root through a symlink. Move it inside a source root.`,
      );
    return fs.readFileSync(real);
  }

  /** Resolve a project-relative source path and enforce source-root ownership. */
  public resolveSourcePath(relativePath: string): string {
    if (path.isAbsolute(relativePath))
      throw new Error(
        `Source path "${relativePath}" is absolute. Use a project-relative module path.`,
      );
    const resolved = resolveInside(this.root, relativePath);
    if (this.isInSourceRoot(resolved) === false)
      throw new Error(
        `Source path "${relativePath}" is outside configured source roots. Move it under ${this.manifest_.sourceRoots.join(", ")}.`,
      );
    if (![".ts", ".tsx", ".mts", ".cts"].includes(path.extname(resolved)))
      throw new Error(
        `Source path "${relativePath}" is not TypeScript. Bind a .ts, .tsx, .mts, or .cts module.`,
      );
    return resolved;
  }

  /** Load the generated ownership manifest if one exists. */
  public generatedManifest(): IAutoMovieGeneratedManifest | null {
    this.refreshRevision();
    return readOwnedTypedJson(
      this.rootReal,
      path.join(this.automovieRoot, "generated-manifest.json"),
      validateGeneratedManifest,
    );
  }

  /** Read one MCP-owned state file without following an escaping link. */
  public readTrackedStateFile(relativePath: string): Uint8Array | null {
    const file = resolveInside(this.automovieRoot, relativePath);
    if (lstatOrNull(file) === null) return null;
    assertOwnedRegularFile(this.rootReal, file);
    return fs.readFileSync(file);
  }

  /** Project-relative path of the generated root. */
  public generatedRoot(): string {
    return this.resolveOwnedDirectory(this.manifest_.generatedRoot);
  }

  /** Read one compiler-owned file without following an escaping link. */
  public readGeneratedFile(relativePath: string): Uint8Array {
    const root = this.generatedRoot();
    const file = resolveInside(root, relativePath);
    const linked = lstatOrNull(file);
    if (linked === null)
      throw new Error(`Generated file "${relativePath}" does not exist.`);
    if (linked.isSymbolicLink())
      throw new Error(
        `Generated file "${relativePath}" is a symlink or junction. Remove that link before compileProject.`,
      );
    const real = fs.realpathSync(file);
    if (isInside(fs.realpathSync(root), real) === false)
      throw new Error(
        `Generated file "${relativePath}" escapes the compiler-owned root through a symlink or junction. Remove that link before compileProject.`,
      );
    if (linked.isFile() === false)
      throw new Error(`Generated path "${relativePath}" is not a file.`);
    return fs.readFileSync(real);
  }

  /** Project-relative path of the render root. */
  public renderRoot(): string {
    return this.resolveOwnedDirectory(this.manifest_.renderRoot);
  }

  /** Atomically write verified files and manifest inside one render bundle. */
  public commitRenderBundle(
    relativeBundle: string,
    files: ReadonlyMap<string, Uint8Array>,
    manifest: IAutoMovieRenderBundleManifest,
  ): number {
    const bundleRoot = resolveInside(this.renderRoot(), relativeBundle);
    const writes: IStagedFile[] = [...files].map(([relativePath, bytes]) => ({
      path: resolveInside(bundleRoot, relativePath),
      content: bytes,
    }));
    writes.push({
      path: path.join(bundleRoot, "manifest.json"),
      content: serializeJson(manifest),
    });
    return this.commitFiles(writes);
  }

  /** Atomically commit a generated manifest and its already staged files. */
  public commitGenerated(
    files: ReadonlyMap<string, Uint8Array>,
    manifest: IAutoMovieGeneratedManifest,
  ): number {
    const writes: IStagedFile[] = [];
    const previous = this.generatedManifest();
    const nextPaths = new Set(files.keys());
    for (const entry of previous?.files ?? [])
      if (nextPaths.has(entry.path) === false)
        writes.push({
          path: resolveInside(this.generatedRoot(), entry.path),
          content: null,
        });
    for (const [relativePath, bytes] of files) {
      const absolute = resolveInside(this.generatedRoot(), relativePath);
      const content = Buffer.from(bytes);
      if (
        fs.existsSync(absolute) === false ||
        Buffer.from(this.readGeneratedFile(relativePath)).equals(content) ===
          false
      )
        writes.push({ path: absolute, content });
    }
    const manifestPath = path.join(
      this.automovieRoot,
      "generated-manifest.json",
    );
    const serializedManifest = serializeJson(manifest);
    if (
      fs.existsSync(manifestPath) === false ||
      fs.readFileSync(manifestPath, "utf8") !== serializedManifest
    )
      writes.push({
        path: manifestPath,
        content: serializedManifest,
      });
    if (writes.length === 0) return this.revision();
    return this.commitFiles(writes);
  }

  /** Read one stored review record. */
  public review(target: IAutoMovieReviewTarget): IAutoMovieStoredReview | null {
    this.refreshRevision();
    return readOwnedTypedJson(
      this.rootReal,
      this.reviewPath(target),
      validateStoredReview,
    );
  }

  /** Store one already validated review record. */
  public commitReview(review: IAutoMovieStoredReview): number {
    return this.commitFiles([
      {
        path: this.reviewPath(review.target),
        content: serializeJson(review),
      },
    ]);
  }

  /** Absolute path for a current review target. */
  public reviewPath(target: IAutoMovieReviewTarget): string {
    switch (target.kind) {
      case "design": {
        const design = target.design;
        if (design.kind === "production")
          return path.join(
            this.automovieRoot,
            "reviews/design/production.json",
          );
        if (design.kind === "world")
          return path.join(this.automovieRoot, "reviews/design/world.json");
        return path.join(
          this.automovieRoot,
          `reviews/design/${design.kind}s`,
          `${encodeId(design.id)}.json`,
        );
      }
      case "source":
        return path.join(
          this.automovieRoot,
          "reviews/source",
          `${encodeId(target.path)}.json`,
        );
      case "shot":
        return path.join(
          this.automovieRoot,
          "reviews/shots",
          `${encodeId(target.id)}.json`,
        );
      case "film":
        return path.join(
          this.automovieRoot,
          "reviews/film",
          `${encodeId(target.id)}.json`,
        );
    }
  }

  private setDesign(
    target: IAutoMovieDesignTarget,
    value: unknown,
    validation: IValidation<unknown>,
  ): IAutoMovieDesignMutationOutput {
    const graph = this.loadGraph();
    const consequences = consequencesOf(graph, target);
    const previousDiagnostics = new Set(
      validateAutoMovieProductionGraph(graph).map(diagnosticIdentity),
    );
    if (validation.success === false)
      return {
        accepted: false,
        revision: this.lastReadRevision_,
        target,
        fingerprint: null,
        consequences,
        diagnostics: validation.errors.map((error) => ({
          code: "design-schema-invalid",
          category: "error",
          phase: "design",
          target: targetKey(target),
          path: relativeToRoot(this.root, this.designPath(target)),
          message: `${error.path} expects ${error.expected}. Fix that field in the design setter.`,
        })),
      };
    const next = replaceDesign(graph, target, value);
    const nextDiagnostics = validateAutoMovieProductionGraph(next);
    const diagnostics = nextDiagnostics.filter(
      (diagnostic) => diagnostic.target === targetKey(target),
    );
    if (diagnostics.some((diagnostic) => diagnostic.category === "error"))
      return {
        accepted: false,
        revision: this.lastReadRevision_,
        target,
        fingerprint: null,
        consequences,
        diagnostics,
      };
    const downstreamDiagnostics = nextDiagnostics
      .filter(
        (diagnostic) =>
          diagnostic.category === "error" &&
          diagnostic.target !== targetKey(target) &&
          previousDiagnostics.has(diagnosticIdentity(diagnostic)) === false,
      )
      .map((diagnostic) => ({
        ...diagnostic,
        code: "design-downstream-invalidated",
        category: "warning" as const,
        message: `${diagnostic.message} This staged mutation was accepted so the dependent artifact can be updated next; compileProject remains blocked until it is corrected.`,
      }));
    const content = serializeJson(value);
    const revision = this.commitFiles([
      { path: this.designPath(target), content },
    ]);
    return {
      accepted: true,
      revision,
      target,
      fingerprint: digestAutoMovieBytes(Buffer.from(content, "utf8")),
      consequences,
      diagnostics: downstreamDiagnostics,
    };
  }

  private designPath(target: IAutoMovieDesignTarget): string {
    switch (target.kind) {
      case "production":
        return path.join(this.automovieRoot, "design/production.json");
      case "world":
        return path.join(this.automovieRoot, "design/world.json");
      case "acceptance":
        return path.join(
          this.automovieRoot,
          "design/acceptance",
          `${encodeId(target.id)}.json`,
        );
      case "formation":
      case "model":
      case "shot":
        return path.join(
          this.automovieRoot,
          `design/${target.kind}s`,
          `${encodeId(target.id)}.json`,
        );
    }
  }

  private readKeyedDesigns<T extends { id: string }>(
    directory: string,
    validate: (input: unknown) => IValidation<T>,
  ): ReadonlyMap<string, T> {
    const absolute = path.join(this.automovieRoot, directory);
    const output = new Map<string, T>();
    for (const entry of fs
      .readdirSync(absolute, { withFileTypes: true })
      .filter(
        (item) =>
          (item.isFile() || item.isSymbolicLink()) &&
          item.name.endsWith(".json"),
      )
      .sort((left, right) => compareCodeUnits(left.name, right.name))) {
      const id = decodeId(entry.name.slice(0, -5));
      const value = readOwnedTypedJson(
        this.rootReal,
        path.join(absolute, entry.name),
        validate,
      );
      if (value === null)
        throw new Error(
          `Design file "${entry.name}" disappeared while reading.`,
        );
      if (output.has(id))
        throw new Error(
          `Design id "${id}" collides with another encoded filename. Rename one design artifact.`,
        );
      const folded = [...output.keys()].find(
        (other) =>
          other.toLocaleLowerCase("en-US") === id.toLocaleLowerCase("en-US"),
      );
      if (folded !== undefined)
        throw new Error(
          `Design ids "${folded}" and "${id}" collide by case. Rename one design artifact.`,
        );
      output.set(id, value);
    }
    return output;
  }

  private isInSourceRoot(candidate: string): boolean {
    return this.manifest_.sourceRoots.some((root) => {
      const directory = this.resolveOwnedDirectory(root);
      return isInside(fs.realpathSync(directory), candidate);
    });
  }

  private resolveOwnedDirectory(relativePath: string): string {
    const resolved = resolveInside(this.root, relativePath);
    assertRealAncestorInside(this.rootReal, resolved);
    return resolved;
  }

  private refreshRevision(): void {
    this.lastReadRevision_ = readRevision(this.rootReal, this.revisionPath);
  }

  private commitFiles(files: readonly IStagedFile[]): number {
    const staged = files.map((file) => ({
      path: file.path,
      content:
        file.content === null
          ? null
          : typeof file.content === "string"
            ? Buffer.from(file.content, "utf8")
            : Buffer.from(file.content),
      previous: (() => {
        resolveInside(this.root, file.path);
        assertRealAncestorInside(this.rootReal, path.dirname(file.path));
        const linked = lstatOrNull(file.path);
        if (linked?.isSymbolicLink())
          throw new Error(
            `Owned target "${relativeToRoot(this.root, file.path)}" is a symlink or junction. Remove it before retrying the mutation.`,
          );
        return linked === null ? null : fs.readFileSync(file.path);
      })(),
    }));
    const token = acquireCommitLock(this.lockPath);
    try {
      const current = readRevision(this.rootReal, this.revisionPath);
      if (current !== this.lastReadRevision_)
        throw new Error(
          `Production revision changed from ${this.lastReadRevision_} to ${current}. Inspect the project again before retrying the mutation.`,
        );
      let applied = 0;
      try {
        for (const file of staged) {
          if (file.content === null) fs.rmSync(file.path, { force: true });
          else writeAtomic(file.path, file.content);
          ++applied;
        }
        const nextRevision = current + 1;
        writeJsonAtomic(this.revisionPath, {
          revision: nextRevision,
        });
        this.lastReadRevision_ = nextRevision;
        return nextRevision;
      } catch (error) {
        const rollbackErrors: unknown[] = [];
        for (const file of staged.slice(0, applied).reverse())
          try {
            if (file.previous === null) fs.rmSync(file.path, { force: true });
            else writeAtomic(file.path, file.previous);
          } catch (rollbackError) {
            rollbackErrors.push(rollbackError);
          }
        if (rollbackErrors.length !== 0)
          throw new AggregateError(
            [error, ...rollbackErrors],
            "Production mutation failed and rollback was incomplete. Restore the listed owned files before retrying.",
          );
        throw error;
      }
    } finally {
      releaseCommitLock(this.lockPath, token);
    }
  }
}

interface IStagedFile {
  path: string;
  content: string | Uint8Array | null;
}

const DESIGN_DIRECTORIES = [
  "design/models",
  "design/formations",
  "design/shots",
  "design/acceptance",
] as const;

const REVIEW_DIRECTORIES = [
  "reviews/design/models",
  "reviews/design/formations",
  "reviews/design/shots",
  "reviews/design/acceptances",
  "reviews/source",
  "reviews/shots",
  "reviews/film",
] as const;

const validateProductionDesign = (
  input: unknown,
): IValidation<IAutoMovieProductionDesign> =>
  typia.validateEquals<IAutoMovieProductionDesign>(input);
const validateModelRecipe = (
  input: unknown,
): IValidation<IAutoMovieModelRecipe> =>
  typia.validateEquals<IAutoMovieModelRecipe>(input);
const validateWorldDesign = (
  input: unknown,
): IValidation<IAutoMovieWorldDesign> =>
  typia.validateEquals<IAutoMovieWorldDesign>(input);
const validateFormationDesign = (
  input: unknown,
): IValidation<IAutoMovieFormationDesign> =>
  typia.validateEquals<IAutoMovieFormationDesign>(input);
const validateShotContract = (
  input: unknown,
): IValidation<IAutoMovieShotContract> =>
  typia.validateEquals<IAutoMovieShotContract>(input);
const validateAcceptanceScenario = (
  input: unknown,
): IValidation<IAutoMovieAcceptanceScenario> =>
  typia.validateEquals<IAutoMovieAcceptanceScenario>(input);
const validateGeneratedManifest = (
  input: unknown,
): IValidation<IAutoMovieGeneratedManifest> =>
  typia.validateEquals<IAutoMovieGeneratedManifest>(input);
const validateStoredReview = (
  input: unknown,
): IValidation<IAutoMovieStoredReview> =>
  typia.validateEquals<IAutoMovieStoredReview>(input);

const readTypedJson = <T>(
  file: string,
  validate: (input: unknown) => IValidation<T>,
): T | null => {
  const value = readJson(file);
  if (value === undefined) return null;
  const result = validate(value);
  if (result.success) return result.data;
  throw new Error(
    `Invalid AutoMovie file "${file}": ${result.errors
      .map((error) => `${error.path} expects ${error.expected}`)
      .join("; ")}. Correct the owning file before continuing.`,
  );
};

const readOwnedTypedJson = <T>(
  rootReal: string,
  file: string,
  validate: (input: unknown) => IValidation<T>,
): T | null => {
  assertOwnedRegularFile(rootReal, file);
  return readTypedJson(file, validate);
};

const readOwnedJson = (rootReal: string, file: string): unknown => {
  assertOwnedRegularFile(rootReal, file);
  return readJson(file);
};

const readJson = (file: string): unknown => {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as unknown;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    /* c8 ignore next 3 -- Node JSON and filesystem failures are Error objects. */
    throw new Error(
      `Invalid AutoMovie JSON "${file}": ${
        error instanceof Error ? error.message : String(error)
      }. Correct the file before continuing.`,
    );
  }
};

const validateManifest = (
  value: unknown,
  file: string,
): IAutoMovieProductionManifest & Record<string, unknown> => {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    (value as { formatVersion?: unknown }).formatVersion !== 2
  )
    throw new Error(
      `Unsupported production manifest "${file}". Set formatVersion to 2 or run the legacy importer.`,
    );
  const record = value as Record<string, unknown>;
  if (
    typeof record.projectId !== "string" ||
    record.projectId.trim().length === 0 ||
    Array.isArray(record.sourceRoots) === false ||
    record.sourceRoots.length === 0 ||
    record.sourceRoots.some(
      (entry) => typeof entry !== "string" || entry.trim().length === 0,
    ) ||
    typeof record.generatedRoot !== "string" ||
    record.generatedRoot.trim().length === 0 ||
    typeof record.renderRoot !== "string" ||
    record.renderRoot.trim().length === 0
  )
    throw new Error(
      `Invalid production manifest "${file}". Provide projectId, sourceRoots, generatedRoot and renderRoot.`,
    );
  return record as IAutoMovieProductionManifest & Record<string, unknown>;
};

const validateOwnershipLayout = (
  root: string,
  manifest: IAutoMovieProductionManifest,
  file: string,
): void => {
  const entries = [
    ...manifest.sourceRoots.map((relative, index) => ({
      owner: `sourceRoots[${index}]`,
      relative,
    })),
    { owner: "generatedRoot", relative: manifest.generatedRoot },
    { owner: "renderRoot", relative: manifest.renderRoot },
  ].map((entry) => ({
    ...entry,
    absolute: resolveInside(root, entry.relative),
  }));
  const reserved = path.join(root, ".automovie");
  for (const entry of entries)
    if (entry.absolute === root || pathsOverlap(entry.absolute, reserved))
      throw new Error(
        `Invalid production manifest "${file}": ${entry.owner} "${entry.relative}" overlaps the project root or reserved .automovie state. Choose one dedicated directory.`,
      );
  for (let left = 0; left < entries.length; ++left)
    for (let right = left + 1; right < entries.length; ++right)
      if (pathsOverlap(entries[left]!.absolute, entries[right]!.absolute))
        throw new Error(
          `Invalid production manifest "${file}": ${entries[left]!.owner} "${entries[left]!.relative}" overlaps ${entries[right]!.owner} "${entries[right]!.relative}". Source, generated and render ownership roots must be disjoint.`,
        );
};

const replaceDesign = (
  graph: IAutoMovieProductionDesignGraph,
  target: IAutoMovieDesignTarget,
  value: unknown,
): IAutoMovieProductionDesignGraph => {
  switch (target.kind) {
    case "production":
      return { ...graph, production: value as IAutoMovieProductionDesign };
    case "model":
      return {
        ...graph,
        models: replaced(
          graph.models,
          target.id,
          value as IAutoMovieModelRecipe,
        ),
      };
    case "world":
      return { ...graph, world: value as IAutoMovieWorldDesign };
    case "formation":
      return {
        ...graph,
        formations: replaced(
          graph.formations,
          target.id,
          value as IAutoMovieFormationDesign,
        ),
      };
    case "shot":
      return {
        ...graph,
        shots: replaced(
          graph.shots,
          target.id,
          value as IAutoMovieShotContract,
        ),
      };
    case "acceptance":
      return {
        ...graph,
        acceptance: replaced(
          graph.acceptance,
          target.id,
          value as IAutoMovieAcceptanceScenario,
        ),
      };
  }
};

const replaced = <T>(
  source: ReadonlyMap<string, T>,
  id: string,
  value: T,
): ReadonlyMap<string, T> => {
  const output = new Map(source);
  output.set(id, value);
  return new Map(
    [...output].sort(([left], [right]) => compareCodeUnits(left, right)),
  );
};

const designFromGraph = (
  graph: IAutoMovieProductionDesignGraph,
  target: IAutoMovieDesignTarget,
): unknown => {
  switch (target.kind) {
    case "production":
      return graph.production;
    case "model":
      return graph.models.get(target.id) ?? null;
    case "world":
      return graph.world;
    case "formation":
      return graph.formations.get(target.id) ?? null;
    case "shot":
      return graph.shots.get(target.id) ?? null;
    case "acceptance":
      return graph.acceptance.get(target.id) ?? null;
  }
};

const referencesTo = (
  graph: IAutoMovieProductionDesignGraph,
  target: IAutoMovieDesignTarget,
): string[] => {
  const references: string[] = [];
  if (target.kind === "model") {
    for (const [id, model] of graph.models)
      if (id !== target.id && model.lod.some((lod) => lod.recipe === target.id))
        references.push(`model:${id}`);
    for (const [id, formation] of graph.formations)
      if (formation.modelRecipe === target.id)
        references.push(`formation:${id}`);
  } else if (target.kind === "formation") {
    for (const [id, shot] of graph.shots)
      if (
        shot.participants.some(
          (participant) =>
            participant.kind === "formation" && participant.id === target.id,
        )
      )
        references.push(`shot:${id}`);
  } else if (target.kind === "shot") {
    for (const [id, acceptance] of graph.acceptance)
      if (
        (acceptance.target.kind === "shot" &&
          acceptance.target.id === target.id) ||
        ((acceptance.criterion.kind === "frame" ||
          acceptance.criterion.kind === "event") &&
          acceptance.criterion.shot === target.id)
      )
        references.push(`acceptance:${id}`);
  } else if (target.kind === "production") {
    for (const [id, acceptance] of graph.acceptance)
      if (acceptance.target.kind === "film")
        references.push(`acceptance:${id}`);
  }
  return references.sort(compareCodeUnits);
};

const consequencesOf = (
  graph: IAutoMovieProductionDesignGraph,
  target: IAutoMovieDesignTarget,
): IAutoMovieDesignMutationConsequences => {
  const staleReviews: IAutoMovieReviewTarget[] = [
    { kind: "design", design: target },
  ];
  if (target.kind === "model")
    for (const [id, model] of graph.models)
      if (id !== target.id && model.lod.some((lod) => lod.recipe === target.id))
        staleReviews.push({
          kind: "design",
          design: { kind: "model", id },
        });
  if (target.kind === "model")
    for (const [id, formation] of graph.formations)
      if (formation.modelRecipe === target.id)
        staleReviews.push({
          kind: "design",
          design: { kind: "formation", id },
        });
  if (target.kind === "formation")
    for (const [id, shot] of graph.shots)
      if (
        shot.participants.some(
          (participant) =>
            participant.kind === "formation" && participant.id === target.id,
        )
      )
        staleReviews.push({
          kind: "design",
          design: { kind: "shot", id },
        });
  if (target.kind === "shot") {
    const source = graph.shots.get(target.id)?.source.module;
    if (source !== undefined)
      staleReviews.push({ kind: "source", path: source });
    for (const [id, acceptance] of graph.acceptance)
      if (
        (acceptance.target.kind === "shot" &&
          acceptance.target.id === target.id) ||
        ((acceptance.criterion.kind === "frame" ||
          acceptance.criterion.kind === "event") &&
          acceptance.criterion.shot === target.id)
      )
        staleReviews.push({
          kind: "design",
          design: { kind: "acceptance", id },
        });
  }
  if (target.kind === "production")
    for (const [id, acceptance] of graph.acceptance)
      if (acceptance.target.kind === "film")
        staleReviews.push({
          kind: "design",
          design: { kind: "acceptance", id },
        });
  for (const id of graph.shots.keys()) staleReviews.push({ kind: "shot", id });
  staleReviews.push({
    kind: "film",
    id: graph.production?.id ?? "film",
  });
  return {
    staleReviews,
    staleRenders: [...graph.shots.keys()].map((id) => `shot:${id}`),
    removedGenerated: [],
  };
};

const targetKey = (target: IAutoMovieDesignTarget): string =>
  target.kind === "production" || target.kind === "world"
    ? target.kind
    : `${target.kind}:${target.id}`;

const diagnosticIdentity = (
  diagnostic: ReturnType<typeof validateAutoMovieProductionGraph>[number],
): string =>
  [
    diagnostic.code,
    diagnostic.target,
    diagnostic.path!,
    diagnostic.message,
  ].join("\0");

const serializeJson = (value: unknown): string =>
  `${JSON.stringify(value, null, 2)}\n`;

let temporaryNonce = 0;
const writeAtomic = (file: string, content: Uint8Array): void => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.tmp.${process.pid}.${temporaryNonce++}`;
  try {
    fs.writeFileSync(temporary, content);
    fs.renameSync(temporary, file);
  } finally {
    fs.rmSync(temporary, { force: true });
  }
};

const writeJsonAtomic = (file: string, value: unknown): void =>
  writeAtomic(file, Buffer.from(serializeJson(value), "utf8"));

const lstatOrNull = (file: string): fs.Stats | null => {
  try {
    return fs.lstatSync(file);
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "ENOENT"
    )
      return null;
    throw error;
  }
};

const assertOwnedRegularFile = (rootReal: string, file: string): void => {
  const linked = lstatOrNull(file);
  if (linked === null) return;
  if (linked.isSymbolicLink())
    throw new Error(
      `Owned file "${file}" is a symlink. Replace it with a project-local regular file.`,
    );
  const real = fs.realpathSync(file);
  if (isInside(rootReal, real) === false)
    throw new Error(
      `Owned file "${file}" escapes the production root. Replace the link with a project-local file.`,
    );
  if (linked.isFile() === false)
    throw new Error(`Owned path "${file}" is not a regular file.`);
};

const readRevision = (rootReal: string, file: string): number => {
  const value = readOwnedJson(rootReal, file);
  if (value === undefined) return 0;
  const revision = (value as { revision?: unknown }).revision;
  if (
    typeof revision !== "number" ||
    Number.isSafeInteger(revision) === false ||
    revision < 0
  )
    throw new Error(
      `Invalid production revision "${file}". Restore a non-negative safe integer revision.`,
    );
  return revision;
};

const projectIdOf = (root: string): string => {
  const basename = path.basename(root).trim();
  /* c8 ignore next -- path.resolve roots have a basename except a volume root. */
  return basename.length === 0 ? "automovie-project" : basename;
};

const inputDesignId = (input: unknown): string => {
  if (
    typeof input === "object" &&
    input !== null &&
    "id" in input &&
    typeof input.id === "string" &&
    input.id.trim().length !== 0
  )
    return input.id;
  return "(invalid)";
};

const encodeId = (id: string): string => {
  if (id.trim().length === 0)
    throw new Error("AutoMovie design and review ids must not be blank.");
  return encodeURIComponent(id);
};

const decodeId = (id: string): string => {
  try {
    return decodeURIComponent(id);
  } catch {
    throw new Error(
      `Encoded AutoMovie filename "${id}" is invalid. Rename or remove the malformed file.`,
    );
  }
};

const resolveInside = (root: string, relative: string): string => {
  const resolved = path.resolve(root, relative);
  if (isInside(root, resolved) === false)
    throw new Error(
      `Path "${relative}" escapes project root "${root}". Use a project-relative path inside the repository.`,
    );
  return resolved;
};

const isInside = (root: string, candidate: string): boolean => {
  const relative = path.relative(root, candidate);
  return (
    relative === "" ||
    (path.isAbsolute(relative) === false &&
      relative !== ".." &&
      relative.startsWith(`..${path.sep}`) === false)
  );
};

const pathsOverlap = (left: string, right: string): boolean =>
  isInside(left, right) || isInside(right, left);

const assertRealAncestorInside = (
  rootReal: string,
  candidate: string,
): void => {
  let existing = candidate;
  while (fs.existsSync(existing) === false) existing = path.dirname(existing);
  const real = fs.realpathSync(existing);
  if (isInside(rootReal, real) === false)
    throw new Error(
      `Owned path "${candidate}" escapes the production root through "${existing}". Replace the symlink or junction with a project-local directory.`,
    );
};

const relativeToRoot = (root: string, file: string): string =>
  path.relative(root, file).split(path.sep).join("/");
