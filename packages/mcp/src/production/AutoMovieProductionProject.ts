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
  IAutoMovieProductionRenderManifest,
  IAutoMovieProductionRenderReceipt,
  IAutoMovieRenderBundleManifest,
  IAutoMovieReviewTarget,
  IAutoMovieShotContract,
  IAutoMovieStoredReview,
  IAutoMovieWorldDesign,
} from "@automovie/interface";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import typia, { IValidation } from "typia";

import { acquireCommitLock, releaseCommitLock } from "../project/commitLock";
import { parseAutoMovieCaptureRuntimeIdentity } from "./captureRuntimeIdentity";
import {
  canonicalAutoMovieJsonBytes,
  compareCodeUnits,
  digestAutoMovieBytes,
  encodeAutoMoviePathSegment,
} from "./contentIdentity";
import { probeProductionMedia } from "./probeProductionMedia";
import {
  IAutoMovieProductionRootNamespaceLease,
  acquireOrCreateProductionRootNamespace,
  acquireProductionRootNamespace,
  assertProductionRootNamespaceLease,
  releaseProductionRootNamespace,
} from "./rootNamespaceLock";
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

/** One declared coding-agent input whose bytes enter compile identity. */
export interface IAutoMovieProductionContentInput {
  /** Project-relative normalized path. */
  path: string;
  /**
   * Whether the file belongs to a coding-agent source root. Source text uses
   * the same BOM/EOL normalization as a bound shot module before
   * fingerprinting.
   */
  source: boolean;
  /**
   * Whether the file was explicitly declared through `contentRoots` or
   * `contentFiles` as a renderer/configuration/asset input. One path may be
   * both source and render content when declarations overlap.
   */
  render: boolean;
  /** Exact bytes, or null for one declared optional file that is absent. */
  bytes: Uint8Array | null;
}

/** A guarded production commit no longer matches its input snapshot. */
export class AutoMovieProductionInputRaceError extends Error {}

/** Structured source-read failure used by the compiler diagnostic boundary. */
export class AutoMovieProductionSourcePathError extends Error {
  public constructor(
    public readonly reason: "missing" | "outside-root",
    message: string,
  ) {
    super(message);
  }
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
  private readonly rootDevice: string;
  private readonly rootInode: string;
  private readonly automovieRoot: string;
  private readonly incarnationPath: string;
  private readonly manifestPath: string;
  private readonly revisionPath: string;
  private readonly lockPath: string;
  private readonly initialized_: boolean;
  private readonly incarnation_: string;
  private manifest_: IAutoMovieProductionManifest & Record<string, unknown>;
  private lastReadRevision_: number;

  private constructor(
    public readonly root: string,
    rootIdentity: Pick<
      IAutoMovieProductionRootNamespaceLease,
      "device" | "inode"
    >,
  ) {
    this.rootReal = fs.realpathSync(root);
    this.rootDevice = rootIdentity.device;
    this.rootInode = rootIdentity.inode;
    this.automovieRoot = path.join(root, ".automovie");
    this.incarnationPath = path.join(this.automovieRoot, "incarnation.json");
    this.manifestPath = path.join(this.automovieRoot, "manifest.json");
    this.revisionPath = path.join(this.automovieRoot, "revision.json");
    this.lockPath = path.join(this.automovieRoot, "revision.lock");
    const initialStateRoot = lstatOrNull(this.automovieRoot);
    if (initialStateRoot?.isSymbolicLink())
      throw new Error(
        `Reserved AutoMovie state root "${this.automovieRoot}" is a symlink or junction. Replace it with a physical project directory before opening the project.`,
      );
    this.mkdirOwned(this.automovieRoot);
    for (const directory of DESIGN_DIRECTORIES) {
      const absolute = path.join(this.automovieRoot, directory);
      this.mkdirOwned(absolute);
    }
    for (const directory of REVIEW_DIRECTORIES) {
      const absolute = path.join(this.automovieRoot, directory);
      this.mkdirOwned(absolute);
    }
    this.mkdirOwned(path.join(this.automovieRoot, "render-receipts"));
    const incarnation = readOwnedJson(this.rootReal, this.incarnationPath);
    if (incarnation === undefined) {
      this.incarnation_ = randomUUID();
      this.writeOwnedJsonAtomic(this.incarnationPath, {
        version: 1,
        id: this.incarnation_,
      });
    } else
      this.incarnation_ = validateIncarnation(
        incarnation,
        this.incarnationPath,
      );
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
      this.writeOwnedJsonAtomic(this.manifestPath, this.manifest_);
    } else this.manifest_ = validateManifest(existing, this.manifestPath);
    validateOwnershipLayout(this.root, this.manifest_, this.manifestPath);
    for (const directory of [
      ...this.manifest_.sourceRoots,
      this.manifest_.generatedRoot,
      this.manifest_.renderRoot,
    ])
      this.mkdirOwned(this.resolveOwnedDirectory(directory));
    validateRealOwnershipLayout(
      this.rootReal,
      this.root,
      this.manifest_,
      this.manifestPath,
    );
    this.lastReadRevision_ = readRevision(this.rootReal, this.revisionPath);
  }

  private mkdirOwned(directory: string): void {
    this.assertProjectRootIdentity();
    assertRealAncestorInside(this.rootReal, directory);
    fs.mkdirSync(directory, {
      recursive: true,
    });
    assertRealAncestorInside(this.rootReal, directory);
    this.assertProjectRootIdentity();
  }

  private writeOwnedJsonAtomic(file: string, value: unknown): void {
    this.assertProjectRootIdentity();
    writeJsonAtomic(file, value);
    this.assertProjectRootIdentity();
  }

  /** Open or initialize a production repository. */
  public static open(rootDirectory: string): AutoMovieProductionProject {
    const root = path.resolve(rootDirectory);
    if (path.parse(root).root === root)
      throw new Error(
        `AutoMovie production root "${root}" is a filesystem root. Choose a dedicated project directory in openProject.`,
      );
    const lease = acquireOrCreateProductionRootNamespace(root);
    try {
      assertProductionRootNamespaceLease(lease);
      const project = new AutoMovieProductionProject(lease.root, lease);
      assertProductionRootNamespaceLease(lease);
      return project;
    } finally {
      releaseProductionRootNamespace(lease);
    }
  }

  /** Current manifest with unknown future fields preserved. */
  public manifest(): IAutoMovieProductionManifest {
    this.refreshRevision();
    return structuredClone(this.manifest_);
  }

  /** Enumerate declared source, viewer, script and asset inputs safely. */
  public contentInputs(): IAutoMovieProductionContentInput[] {
    this.assertProjectRootIdentity();
    const inputs = new Map<
      string,
      { bytes: Uint8Array | null; render: boolean; source: boolean }
    >();
    const setInput = (
      inputPath: string,
      bytes: Uint8Array | null,
      source: boolean,
      render: boolean,
    ): void => {
      const retained = inputs.get(inputPath);
      inputs.set(inputPath, {
        bytes,
        render,
        source: source || retained?.source === true,
      });
    };
    const visit = (
      directory: string,
      physicalRoot: string,
      source: boolean,
      render: boolean,
    ): void => {
      const realDirectory = fs.realpathSync(directory);
      if (
        isInside(this.rootReal, realDirectory) === false ||
        isInside(physicalRoot, realDirectory) === false
      )
        throw new Error(
          `Declared content directory "${relativeToRoot(this.root, directory)}" escapes its verified physical project root. Replace the junction with physical project content.`,
        );
      for (const entry of fs
        .readdirSync(directory, { withFileTypes: true })
        .sort((left, right) => compareCodeUnits(left.name, right.name))) {
        const absolute = path.join(directory, entry.name);
        const linked = fs.lstatSync(absolute);
        if (linked.isSymbolicLink())
          throw new Error(
            `Declared content path "${relativeToRoot(this.root, absolute)}" is a symlink or junction. Replace it with physical project content before compileProject.`,
          );
        if (linked.isDirectory()) visit(absolute, physicalRoot, source, render);
        else if (linked.isFile()) {
          const real = fs.realpathSync(absolute);
          if (
            isInside(this.rootReal, real) === false ||
            isInside(physicalRoot, real) === false
          )
            throw new Error(
              `Declared content file "${relativeToRoot(this.root, absolute)}" escapes its verified physical project root. Replace the junction with a physical file.`,
            );
          setInput(
            normalizeSlash(path.relative(this.root, absolute)),
            fs.readFileSync(real),
            source,
            render,
          );
        }
      }
    };
    for (const [relativeRoot, source, render] of [
      ...this.manifest_.sourceRoots.map((root) => [root, true, false] as const),
      ...(this.manifest_.contentRoots ?? []).map(
        (root) => [root, false, true] as const,
      ),
    ]) {
      const absolute = resolveInside(this.root, relativeRoot);
      const linked = lstatOrNull(absolute);
      if (
        linked === null ||
        linked.isSymbolicLink() ||
        linked.isDirectory() === false
      )
        throw new Error(
          `Declared content root "${relativeRoot}" must be a physical project directory before compileProject.`,
        );
      const physicalRoot = fs.realpathSync(absolute);
      if (isInside(this.rootReal, physicalRoot) === false)
        throw new Error(
          `Declared content root "${relativeRoot}" escapes the production project through a directory junction. Move it into a physical project directory before compileProject.`,
        );
      visit(absolute, physicalRoot, source, render);
    }
    for (const relativeFile of this.manifest_.contentFiles ?? []) {
      const absolute = resolveInside(this.root, relativeFile);
      const linked = lstatOrNull(absolute);
      if (linked === null) {
        setInput(normalizeSlash(relativeFile), null, false, true);
        continue;
      }
      if (linked.isSymbolicLink() || linked.isFile() === false)
        throw new Error(
          `Declared content file "${relativeFile}" must be a physical regular file before compileProject.`,
        );
      const real = fs.realpathSync(absolute);
      if (isInside(this.rootReal, real) === false)
        throw new Error(
          `Declared content file "${relativeFile}" escapes the production project through a directory junction. Move it into a physical project directory before compileProject.`,
        );
      setInput(
        normalizeSlash(relativeFile),
        fs.readFileSync(real),
        false,
        true,
      );
    }
    return [...inputs]
      .map(([inputPath, input]) => ({ path: inputPath, ...input }))
      .sort((left, right) => compareCodeUnits(left.path, right.path));
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
    this.assertProjectRootIdentity();
    const stateRootReal = ownedRootReal(this.rootReal, this.automovieRoot);
    return {
      production: readOwnedTypedJson(
        stateRootReal,
        this.designPath({ kind: "production" }),
        validateProductionDesign,
      ),
      models: this.readKeyedDesigns("design/models", validateModelRecipe),
      world: readOwnedTypedJson(
        stateRootReal,
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
    reason = "direct project API erase",
  ): IAutoMovieDesignMutationOutput {
    if (reason.trim().length === 0)
      throw new Error("Design erase audit reason must not be blank.");
    const graph = this.loadGraph();
    const current = designFromGraph(graph, target);
    const consequences = consequencesOf(
      graph,
      target,
      this.loadGeneratedManifest()?.files.map((file) => file.path) ?? [],
    );
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
    const nextRevision = this.lastReadRevision_ + 1;
    const revision = this.commitFiles([
      { path: this.designPath(target), content: null },
      {
        path: path.join(
          this.automovieRoot,
          "audit/design-mutations",
          `${String(nextRevision).padStart(12, "0")}-erase.json`,
        ),
        content: serializeJson({
          version: 1,
          revision: nextRevision,
          operation: "erase-design",
          target,
          reason: reason.trim(),
          previousFingerprint: digestAutoMovieBytes(
            canonicalAutoMovieJsonBytes(current),
          ),
        }),
      },
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
      throw new AutoMovieProductionSourcePathError(
        "missing",
        `Source "${relativePath}" does not exist. Create it under a configured source root before compileProject.`,
      );
    const real = fs.realpathSync(file);
    if (this.isInSourceRoot(real) === false)
      throw new AutoMovieProductionSourcePathError(
        "outside-root",
        `Source "${relativePath}" escapes its configured source root through a symlink. Move it inside a source root.`,
      );
    return fs.readFileSync(real);
  }

  /** Resolve a project-relative source path and enforce source-root ownership. */
  public resolveSourcePath(relativePath: string): string {
    this.assertProjectRootIdentity();
    if (path.isAbsolute(relativePath))
      throw new AutoMovieProductionSourcePathError(
        "outside-root",
        `Source path "${relativePath}" is absolute. Use a project-relative module path.`,
      );
    const resolved = path.resolve(this.root, relativePath);
    if (isInside(this.root, resolved) === false)
      throw new AutoMovieProductionSourcePathError(
        "outside-root",
        `Source path "${relativePath}" escapes project root "${this.root}". Use a project-relative path inside the repository.`,
      );
    if (this.isInSourceRoot(resolved) === false)
      throw new AutoMovieProductionSourcePathError(
        "outside-root",
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
    return this.loadGeneratedManifest();
  }

  private loadGeneratedManifest(): IAutoMovieGeneratedManifest | null {
    this.assertProjectRootIdentity();
    return readOwnedTypedJson(
      ownedRootReal(this.rootReal, this.automovieRoot),
      path.join(this.automovieRoot, "generated-manifest.json"),
      validateGeneratedManifest,
    );
  }

  /** Read one MCP-owned state file without following an escaping link. */
  public readTrackedStateFile(relativePath: string): Uint8Array | null {
    this.assertProjectRootIdentity();
    const file = resolveInside(this.automovieRoot, relativePath);
    if (lstatOrNull(file) === null) return null;
    assertOwnedRegularFile(
      ownedRootReal(this.rootReal, this.automovieRoot),
      file,
    );
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

  /** Read one render-owned regular file without following a link. */
  public readRenderFile(relativePath: string): Uint8Array {
    const root = this.renderRoot();
    const file = resolveInside(root, relativePath);
    const linked = lstatOrNull(file);
    if (linked === null)
      throw new Error(`Render file "${relativePath}" does not exist.`);
    if (linked.isSymbolicLink() || linked.isFile() === false)
      throw new Error(
        `Render file "${relativePath}" is not a regular file. Replace the link or directory with renderer-owned bytes.`,
      );
    const real = fs.realpathSync(file);
    if (isInside(fs.realpathSync(root), real) === false)
      throw new Error(
        `Render file "${relativePath}" escapes the render root. Re-render it inside the owned output root.`,
      );
    return fs.readFileSync(real);
  }

  /**
   * Atomically write verified files and manifest inside one render bundle.
   *
   * A capture caller may supply `inputCurrent`; the commit lock invokes it
   * immediately before and after applying files and rolls back when either
   * observation no longer matches the captured production snapshot.
   */
  public commitRenderBundle(
    relativeBundle: string,
    files: ReadonlyMap<string, Uint8Array>,
    manifest: IAutoMovieRenderBundleManifest,
    inputCurrent?: () => boolean,
  ): number {
    parseAutoMovieCaptureRuntimeIdentity(manifest.rendererIdentity);
    const normalizedBundle = normalizeSlash(relativeBundle);
    const expectedBundle = productionRenderBundleRelativePath(manifest);
    if (normalizedBundle !== expectedBundle)
      throw new Error(
        `Render bundle "${relativeBundle}" is not the content-addressed path "${expectedBundle}". Use the current target-local fingerprint and render spec.`,
      );
    const bundleRoot = resolveInside(this.renderRoot(), relativeBundle);
    const writes: IStagedFile[] = [...files].map(([relativePath, bytes]) => ({
      path: resolveInside(bundleRoot, relativePath),
      content: bytes,
    }));
    const serializedManifest = serializeJson(manifest);
    writes.push({
      path: path.join(bundleRoot, "manifest.json"),
      content: serializedManifest,
    });
    writes.push({
      path: this.renderReceiptPath(normalizedBundle),
      content: serializeJson({
        version: 1,
        bundle: normalizedBundle,
        manifestDigest: digestAutoMovieBytes(
          Buffer.from(serializedManifest, "utf8"),
        ),
      } satisfies IAutoMovieRenderBundleReceipt),
    });
    return this.commitFiles(writes, inputCurrent);
  }

  /**
   * Verify that a render manifest is at its canonical content-addressed path
   * and is byte-bound to a receipt written atomically by commitRenderBundle.
   * Every declared PNG must also remain inside that bundle and match its
   * recorded digest and raster before the manifest is considered current.
   */
  public verifiedRenderManifest(
    manifestPath: string,
  ): IAutoMovieRenderBundleManifest | null {
    try {
      const root = this.renderRoot();
      const linked = lstatOrNull(manifestPath);
      if (
        linked === null ||
        linked.isSymbolicLink() ||
        linked.isFile() === false
      )
        return null;
      const realRoot = fs.realpathSync(root);
      const realManifest = fs.realpathSync(manifestPath);
      if (isInside(realRoot, realManifest) === false) return null;
      const bytes = fs.readFileSync(realManifest);
      const validation = typia.validateEquals<IAutoMovieRenderBundleManifest>(
        JSON.parse(bytes.toString("utf8")),
      );
      if (validation.success === false) return null;
      try {
        parseAutoMovieCaptureRuntimeIdentity(validation.data.rendererIdentity);
      } catch {
        return null;
      }
      const relativeBundle = normalizeSlash(
        path.relative(root, path.dirname(manifestPath)),
      );
      if (
        relativeBundle !== productionRenderBundleRelativePath(validation.data)
      )
        return null;
      const receiptBytes = this.readTrackedStateFile(
        relativeToRoot(
          this.automovieRoot,
          this.renderReceiptPath(relativeBundle),
        ),
      );
      if (receiptBytes === null) return null;
      const receipt = JSON.parse(
        Buffer.from(receiptBytes).toString("utf8"),
      ) as Partial<IAutoMovieRenderBundleReceipt>;
      if (
        receipt.version !== 1 ||
        receipt.bundle !== relativeBundle ||
        receipt.manifestDigest !== digestAutoMovieBytes(bytes)
      )
        return null;
      const framePaths = new Set<string>();
      for (const frame of validation.data.frames) {
        const normalizedFrame = normalizeSlash(frame.path).toLowerCase();
        if (framePaths.has(normalizedFrame)) return null;
        framePaths.add(normalizedFrame);
        const absoluteFrame = resolveInside(
          path.dirname(realManifest),
          frame.path,
        );
        const frameBytes = this.readRenderFile(
          normalizeSlash(path.relative(root, absoluteFrame)),
        );
        if (digestAutoMovieBytes(frameBytes) !== frame.digest) return null;
        const probe = probeProductionMedia({
          kind: "preview",
          mediaType: "image/png",
          bytes: frameBytes,
        }) as Extract<ReturnType<typeof probeProductionMedia>, { kind: "png" }>;
        if (probe.width !== frame.width || probe.height !== frame.height)
          return null;
      }
      return validation.data;
    } catch {
      return null;
    }
  }

  /** Atomically write the exact aggregate production-delivery ledger. */
  public commitProductionRenderManifest(
    manifest: IAutoMovieProductionRenderManifest,
  ): number {
    const validation =
      typia.validateEquals<IAutoMovieProductionRenderManifest>(manifest);
    if (validation.success === false)
      throw new Error(
        `Invalid aggregate render manifest: ${validation.errors
          .map((error) => `${error.path} expects ${error.expected}`)
          .join("; ")}.`,
      );
    const content = serializeJson(validation.data);
    const paths = new Set<string>();
    const receiptFiles: IAutoMovieProductionRenderReceipt["files"] = [];
    for (const deliverable of validation.data.deliverables)
      for (const file of deliverable.files) {
        const portable = normalizeSlash(file.path).toLowerCase();
        if (paths.has(portable))
          throw new Error(
            `Render file "${file.path}" is claimed more than once. Give it one deliverable owner before committing the aggregate manifest.`,
          );
        paths.add(portable);
        const bytes = this.readRenderFile(file.path);
        const digest = digestAutoMovieBytes(bytes);
        if (bytes.length !== file.bytes || digest !== file.digest)
          throw new Error(
            `Render file "${file.path}" does not match its declared byte size and digest. Rebuild the deliverable ledger from current bytes.`,
          );
        let probe: IAutoMovieProductionRenderReceipt["files"][number]["probe"];
        try {
          probe = probeProductionMedia({
            kind: deliverable.kind,
            mediaType: file.mediaType,
            bytes,
          });
        } catch (error) {
          throw new Error(
            `Render file "${file.path}" failed media probing: ${String(error)}`,
          );
        }
        receiptFiles.push({
          deliverable: deliverable.id,
          ...file,
          probe,
        });
      }
    receiptFiles.sort((left, right) => compareCodeUnits(left.path, right.path));
    const receipt: IAutoMovieProductionRenderReceipt = {
      version: 2,
      manifestDigest: digestAutoMovieBytes(Buffer.from(content, "utf8")),
      files: receiptFiles,
    };
    return this.commitFiles([
      {
        path: path.join(this.automovieRoot, "render-manifest.json"),
        content,
      },
      {
        path: path.join(this.automovieRoot, "render-manifest-receipt.json"),
        content: serializeJson(receipt),
      },
    ]);
  }

  /**
   * Atomically write renderer-owned files for one declared deliverable.
   *
   * Returned paths are rooted below `renders/deliverables/<encoded-id>` and can
   * be copied verbatim into the aggregate production render manifest.
   */
  public commitProductionDeliverableFiles(
    deliverableId: string,
    files: ReadonlyMap<string, Uint8Array>,
  ): { revision: number; paths: string[] } {
    if (files.size === 0)
      throw new Error(`Deliverable "${deliverableId}" has no files to commit.`);
    const relativeRoot = `deliverables/${encodeAutoMoviePathSegment(deliverableId)}`;
    const renderRoot = this.renderRoot();
    const deliverableRoot = resolveInside(renderRoot, relativeRoot);
    const portablePaths = new Set<string>();
    const entries = [...files]
      .map(([relativePath, content]) => {
        const absolute = resolveInside(deliverableRoot, relativePath);
        const normalized = normalizeSlash(
          path.relative(deliverableRoot, absolute),
        );
        const portable = normalized.toLowerCase();
        if (portablePaths.has(portable))
          throw new Error(
            `Deliverable "${deliverableId}" maps more than one input to "${normalized}". Use unique canonical file paths.`,
          );
        portablePaths.add(portable);
        return {
          absolute,
          relativePath: normalized,
          content,
        };
      })
      .sort((left, right) =>
        compareCodeUnits(left.relativePath, right.relativePath),
      );
    const revision = this.commitFiles(
      entries.map((entry) => ({
        path: entry.absolute,
        content: entry.content,
      })),
    );
    return {
      revision,
      paths: entries.map((entry) => `${relativeRoot}/${entry.relativePath}`),
    };
  }

  /**
   * Atomically commit generated files while an optional compiler input guard
   * remains current before and after every staged write.
   */
  public commitGenerated(
    files: ReadonlyMap<string, Uint8Array>,
    manifest: IAutoMovieGeneratedManifest,
    inputCurrent?: () => boolean,
    expectedRevision: number = this.lastReadRevision_,
  ): number {
    const serializedManifest = serializeJson(manifest);
    return this.commitFiles(
      () => {
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
            Buffer.from(this.readGeneratedFile(relativePath)).equals(
              content,
            ) === false
          )
            writes.push({ path: absolute, content });
        }
        const manifestPath = path.join(
          this.automovieRoot,
          "generated-manifest.json",
        );
        if (
          fs.existsSync(manifestPath) === false ||
          fs.readFileSync(manifestPath, "utf8") !== serializedManifest
        )
          writes.push({
            path: manifestPath,
            content: serializedManifest,
          });
        return writes;
      },
      inputCurrent,
      expectedRevision,
      () => this.assertGeneratedOutputCurrent(files, serializedManifest),
      false,
    );
  }

  /**
   * Confirm one read-only compiler snapshot under the production commit lock.
   *
   * The guard runs twice so a coding-agent input cannot change while a
   * non-materializing diagnostic, design or lint response is being published.
   * No file or revision is written.
   */
  public confirmCurrentSnapshot(
    inputCurrent: () => boolean,
    expectedRevision: number = this.lastReadRevision_,
  ): number {
    return this.commitFiles(
      () => [],
      inputCurrent,
      expectedRevision,
      undefined,
      false,
    );
  }

  /** Read one stored review record. */
  public review(target: IAutoMovieReviewTarget): IAutoMovieStoredReview | null {
    this.refreshRevision();
    return readOwnedTypedJson(
      ownedRootReal(this.rootReal, this.automovieRoot),
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
    const generatedPaths =
      this.loadGeneratedManifest()?.files.map((file) => file.path) ?? [];
    let consequences = consequencesOf(graph, target, generatedPaths);
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
    const collision = caseCollidingDesignId(graph, target);
    if (collision !== null)
      return {
        accepted: false,
        revision: this.lastReadRevision_,
        target,
        fingerprint: null,
        consequences,
        diagnostics: [
          {
            code: "design-id-collision",
            category: "error",
            phase: "design",
            target: targetKey(target),
            path: relativeToRoot(this.root, this.designPath(target)),
            message: `Design id "${collision.requested}" collides with existing id "${collision.existing}" on a case-insensitive filesystem. Choose a portable distinct id before committing.`,
          },
        ],
      };
    const next = replaceDesign(graph, target, value);
    consequences = consequencesOf(next, target, generatedPaths);
    const nextDiagnostics = validateAutoMovieProductionGraph(next);
    const diagnostics = nextDiagnostics.filter(
      (diagnostic) =>
        diagnostic.target === targetKey(target) ||
        (target.kind === "formation" && diagnostic.target === "formations"),
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

  private renderReceiptPath(relativeBundle: string): string {
    const digest = digestAutoMovieBytes(
      Buffer.from(normalizeSlash(relativeBundle), "utf8"),
    );
    return path.join(
      this.automovieRoot,
      "render-receipts",
      `${digestSegment(digest)}.json`,
    );
  }

  private readKeyedDesigns<T extends { id: string }>(
    directory: string,
    validate: (input: unknown) => IValidation<T>,
  ): ReadonlyMap<string, T> {
    const absolute = path.join(this.automovieRoot, directory);
    const stateRootReal = ownedRootReal(this.rootReal, this.automovieRoot);
    const output = new Map<string, T>();
    for (const entry of fs
      .readdirSync(absolute, { withFileTypes: true })
      .filter(
        (item) =>
          (item.isFile() || item.isSymbolicLink()) &&
          item.name.endsWith(".json"),
      )
      .sort((left, right) => compareCodeUnits(left.name, right.name))) {
      const value = readOwnedTypedJson(
        stateRootReal,
        path.join(absolute, entry.name),
        validate,
      );
      if (value === null)
        throw new Error(
          `Design file "${entry.name}" disappeared while reading.`,
        );
      const id = value.id;
      if (entry.name !== `${encodeId(id)}.json`)
        throw new Error(
          `Design file "${entry.name}" does not match its content id "${id}". Rename it to the canonical portable filename.`,
        );
      const folded = [...output.keys()].find(
        (other) => other.toLowerCase() === id.toLowerCase(),
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
    this.assertProjectRootIdentity();
    const resolved = resolveInside(this.root, relativePath);
    assertRealAncestorInside(this.rootReal, resolved);
    return resolved;
  }

  private refreshRevision(): void {
    this.assertProjectRootIdentity();
    this.assertIncarnation();
    this.lastReadRevision_ = readRevision(this.rootReal, this.revisionPath);
  }

  private assertProjectRootIdentity(): void {
    const linked = lstatOrNull(this.root);
    const current =
      linked === null ||
      linked.isSymbolicLink() ||
      linked.isDirectory() === false
        ? null
        : fs.statSync(this.root, { bigint: true });
    if (
      current === null ||
      current.dev.toString() !== this.rootDevice ||
      current.ino.toString() !== this.rootInode
    )
      throw new AutoMovieProductionInputRaceError(
        "Production project root identity changed. Discard this project handle and open the physical project again before reading or mutating it.",
      );
  }

  private assertIncarnation(): void {
    const current = validateIncarnation(
      readOwnedJson(this.rootReal, this.incarnationPath),
      this.incarnationPath,
    );
    if (current !== this.incarnation_)
      throw new AutoMovieProductionInputRaceError(
        "Production state incarnation changed. Discard this project handle and open the project again before reading or mutating it.",
      );
  }

  private commitFiles(
    files: readonly IStagedFile[] | (() => readonly IStagedFile[]),
    inputCurrent?: () => boolean,
    expectedRevision: number = this.lastReadRevision_,
    outputCurrent?: () => void,
    publishEmptyRevision: boolean = true,
  ): number {
    const stage = (pending: readonly IStagedFile[]) =>
      pending.map((file) => ({
        path: file.path,
        content:
          file.content === null
            ? null
            : typeof file.content === "string"
              ? Buffer.from(file.content, "utf8")
              : Buffer.from(file.content),
        previous: (() => {
          resolveInside(this.root, file.path);
          const ownerRoot = this.ownerRootFor(file.path);
          assertRealAncestorInside(
            ownedRootReal(this.rootReal, ownerRoot),
            path.dirname(file.path),
          );
          const linked = lstatOrNull(file.path);
          if (linked?.isSymbolicLink())
            throw new Error(
              `Owned target "${relativeToRoot(this.root, file.path)}" is a symlink or junction. Remove it before retrying the mutation.`,
            );
          return linked === null ? null : fs.readFileSync(file.path);
        })(),
      }));
    const lazy = typeof files === "function" ? files : null;
    const eager = lazy === null ? (files as readonly IStagedFile[]) : null;
    const rootLease = acquireProductionRootNamespace(this.root);
    try {
      if (
        rootLease.device !== this.rootDevice ||
        rootLease.inode !== this.rootInode
      )
        throw new AutoMovieProductionInputRaceError(
          "Production project root identity changed. Discard this project handle and open the physical project again before mutating it.",
        );
      assertProductionRootNamespaceLease(rootLease);
      const token = acquireCommitLock(this.lockPath);
      try {
        assertProductionRootNamespaceLease(rootLease);
        this.assertIncarnation();
        const current = readRevision(this.rootReal, this.revisionPath);
        if (current !== expectedRevision)
          throw new AutoMovieProductionInputRaceError(
            `Production revision changed from ${expectedRevision} to ${current}. Inspect the project again before retrying the mutation.`,
          );
        if (inputCurrent?.() === false)
          throw new AutoMovieProductionInputRaceError(
            "Production inputs changed before the guarded commit began.",
          );
        const staged = stage(eager ?? lazy!());
        let applied = 0;
        try {
          for (const file of staged) {
            assertProductionRootNamespaceLease(rootLease);
            if (file.content === null) fs.rmSync(file.path, { force: true });
            else writeAtomic(file.path, file.content);
            assertProductionRootNamespaceLease(rootLease);
            ++applied;
          }
          if (inputCurrent?.() === false)
            throw new AutoMovieProductionInputRaceError(
              "Production inputs changed while the guarded commit was being applied.",
            );
          outputCurrent?.();
          if (staged.length === 0 && publishEmptyRevision === false) {
            this.lastReadRevision_ = current;
            return current;
          }
          const nextRevision = current + 1;
          assertProductionRootNamespaceLease(rootLease);
          writeJsonAtomic(this.revisionPath, {
            revision: nextRevision,
          });
          assertProductionRootNamespaceLease(rootLease);
          this.lastReadRevision_ = nextRevision;
          return nextRevision;
        } catch (error) {
          try {
            assertProductionRootNamespaceLease(rootLease);
          } catch (identityError) {
            throw new AggregateError(
              [error, identityError],
              "Production mutation stopped because the physical root or namespace fence changed. No stale-path rollback was attempted in the replacement root.",
            );
          }
          const rollbackErrors: unknown[] = [];
          for (const file of staged.slice(0, applied).reverse())
            try {
              assertProductionRootNamespaceLease(rootLease);
              if (file.previous === null) fs.rmSync(file.path, { force: true });
              else writeAtomic(file.path, file.previous);
              assertProductionRootNamespaceLease(rootLease);
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
        try {
          assertProductionRootNamespaceLease(rootLease);
          releaseCommitLock(this.lockPath, token);
        } catch {
          // Fail closed: never follow a stale revision-lock path into a replacement.
        }
      }
    } finally {
      releaseProductionRootNamespace(rootLease);
    }
  }

  private assertGeneratedOutputCurrent(
    files: ReadonlyMap<string, Uint8Array>,
    serializedManifest: string,
  ): void {
    try {
      const root = this.generatedRoot();
      const actualPaths: string[] = [];
      const visit = (directory: string): void => {
        for (const entry of fs
          .readdirSync(directory, { withFileTypes: true })
          .sort((left, right) => compareCodeUnits(left.name, right.name))) {
          const absolute = path.join(directory, entry.name);
          const status = fs.lstatSync(absolute);
          if (status.isDirectory()) visit(absolute);
          else actualPaths.push(normalizeSlash(path.relative(root, absolute)));
        }
      };
      visit(root);
      const expectedPaths = [...files.keys()].sort(compareCodeUnits);
      if (actualPaths.join("\0") !== expectedPaths.join("\0"))
        throw new AutoMovieProductionInputRaceError(
          "Compiler-owned generated inventory changed while output was being published.",
        );
      for (const [relativePath, expected] of files)
        if (
          Buffer.from(this.readGeneratedFile(relativePath)).equals(
            Buffer.from(expected),
          ) === false
        )
          throw new AutoMovieProductionInputRaceError(
            `Compiler-owned generated file "${relativePath}" changed while output was being published.`,
          );
      if (
        fs.readFileSync(
          path.join(this.automovieRoot, "generated-manifest.json"),
          "utf8",
        ) !== serializedManifest
      )
        throw new AutoMovieProductionInputRaceError(
          "Compiler-owned generated manifest changed while output was being published.",
        );
    } catch (error) {
      if (error instanceof AutoMovieProductionInputRaceError) throw error;
      throw new AutoMovieProductionInputRaceError(
        `Compiler-owned generated output became unreadable while it was being published: ${String(error)}`,
      );
    }
  }

  private ownerRootFor(file: string): string {
    const roots = [this.automovieRoot, this.generatedRoot(), this.renderRoot()];
    return roots.find((root) => isInside(root, file))!;
  }
}

interface IStagedFile {
  path: string;
  content: string | Uint8Array | null;
}

interface IAutoMovieRenderBundleReceipt {
  version: 1;
  bundle: string;
  manifestDigest: `sha256:${string}`;
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
    throw new Error(
      `Invalid AutoMovie JSON "${file}": ${String(error)}. Correct the file before continuing.`,
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
    (record.contentRoots !== undefined &&
      (Array.isArray(record.contentRoots) === false ||
        record.contentRoots.some(
          (entry) => typeof entry !== "string" || entry.trim().length === 0,
        ))) ||
    (record.contentFiles !== undefined &&
      (Array.isArray(record.contentFiles) === false ||
        record.contentFiles.some(
          (entry) => typeof entry !== "string" || entry.trim().length === 0,
        ))) ||
    typeof record.generatedRoot !== "string" ||
    record.generatedRoot.trim().length === 0 ||
    typeof record.renderRoot !== "string" ||
    record.renderRoot.trim().length === 0
  )
    throw new Error(
      `Invalid production manifest "${file}". Provide projectId, sourceRoots, generatedRoot and renderRoot.`,
    );
  const manifest = record as IAutoMovieProductionManifest &
    Record<string, unknown>;
  const pathGroups = [
    ["sourceRoots", manifest.sourceRoots],
    ["contentRoots", manifest.contentRoots ?? []],
    ["contentFiles", manifest.contentFiles ?? []],
    ["generatedRoot", [manifest.generatedRoot]],
    ["renderRoot", [manifest.renderRoot]],
  ] as const;
  const spellings = new Map<string, string>();
  for (const [owner, values] of pathGroups) {
    const local = new Set<string>();
    for (const pathValue of values) {
      if (isCanonicalManifestPath(pathValue) === false)
        throw new Error(
          `Invalid production manifest "${file}": ${owner} entry "${pathValue}" must be one canonical project-relative POSIX path without absolute roots, backslashes, empty segments, "." or "..".`,
        );
      const folded = pathValue.toLowerCase();
      if (local.has(folded))
        throw new Error(
          `Invalid production manifest "${file}": ${owner} repeats portable path "${pathValue}". Keep each entry once with one case spelling.`,
        );
      local.add(folded);
      const prior = spellings.get(folded);
      if (prior !== undefined && prior !== pathValue)
        throw new Error(
          `Invalid production manifest "${file}": path "${pathValue}" collides with "${prior}" on a case-insensitive filesystem. Use one portable spelling.`,
        );
      spellings.set(folded, pathValue);
    }
  }
  return manifest;
};

const isCanonicalManifestPath = (value: string): boolean =>
  path.posix.isAbsolute(value) === false &&
  /^[A-Za-z]:/.test(value) === false &&
  value.includes("\\") === false &&
  value !== "." &&
  path.posix.normalize(value) === value &&
  value.split("/").every((segment) => segment.length > 0 && segment !== "..");

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
  const forbidden = [
    reserved,
    resolveInside(root, manifest.generatedRoot),
    resolveInside(root, manifest.renderRoot),
  ];
  for (const [kind, values] of [
    ["contentRoots", manifest.contentRoots ?? []],
    ["contentFiles", manifest.contentFiles ?? []],
  ] as const)
    for (const relative of values) {
      const absolute = resolveInside(root, relative);
      if (
        absolute === root ||
        forbidden.some((owner) =>
          kind === "contentRoots"
            ? pathsOverlap(absolute, owner)
            : isInside(owner, absolute),
        )
      )
        throw new Error(
          `Invalid production manifest "${file}": ${kind} entry "${relative}" overlaps AutoMovie state, generated, render, or the whole project. Declare only coding-agent-owned inputs.`,
        );
    }
};

const validateRealOwnershipLayout = (
  rootReal: string,
  root: string,
  manifest: IAutoMovieProductionManifest,
  file: string,
): void => {
  assertOwnedRootDirectory(rootReal, path.join(root, ".automovie"), file);
  for (const entry of [
    ...manifest.sourceRoots.map((relative, index) => ({
      owner: `sourceRoots[${index}]`,
      relative,
    })),
    { owner: "generatedRoot", relative: manifest.generatedRoot },
    { owner: "renderRoot", relative: manifest.renderRoot },
  ]) {
    const absolute = resolveInside(root, entry.relative);
    assertOwnedRootDirectory(rootReal, absolute, file);
  }
  for (const [index, relative] of (manifest.contentRoots ?? []).entries()) {
    const absolute = resolveInside(root, relative);
    const linked = lstatOrNull(absolute);
    if (
      linked === null ||
      linked.isSymbolicLink() ||
      linked.isDirectory() === false
    )
      throw new Error(
        `Invalid production manifest "${file}": contentRoots[${index}] "${relative}" must be an existing physical project directory.`,
      );
    const real = fs.realpathSync(absolute);
    if (isInside(rootReal, real) === false)
      throw new Error(
        `Invalid production manifest "${file}": contentRoots[${index}] "${relative}" escapes the project through a directory junction.`,
      );
  }
};

const caseCollidingDesignId = (
  graph: IAutoMovieProductionDesignGraph,
  target: IAutoMovieDesignTarget,
): { requested: string; existing: string } | null => {
  if (target.kind === "production" || target.kind === "world") return null;
  const records =
    target.kind === "model"
      ? graph.models
      : target.kind === "formation"
        ? graph.formations
        : target.kind === "shot"
          ? graph.shots
          : graph.acceptance;
  const folded = target.id.toLowerCase();
  const existing = [...records.keys()].find(
    (id) => id !== target.id && id.toLowerCase() === folded,
  );
  return existing === undefined ? null : { requested: target.id, existing };
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
  if (target.kind === "production") {
    for (const id of graph.shots.keys()) references.push(`shot:${id}`);
    for (const [id, acceptance] of graph.acceptance)
      if (acceptance.target.kind === "film")
        references.push(`acceptance:${id}`);
  } else if (target.kind === "model") {
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
  } else if (target.kind === "world") {
    for (const [id, shot] of graph.shots)
      if (shotUsesLandmark(shot)) references.push(`shot:${id}`);
  }
  return references.sort(compareCodeUnits);
};

const shotUsesLandmark = (shot: IAutoMovieShotContract): boolean =>
  [
    ...shot.opening.flatMap((state) => state.predicates),
    ...shot.closing.flatMap((state) => state.predicates),
    ...shot.events.flatMap((event) => event.predicates),
  ].some((predicate) =>
    predicate.kind === "position"
      ? predicate.subject.kind === "landmark"
      : predicate.kind === "distance" &&
        (predicate.from.kind === "landmark" ||
          predicate.to.kind === "landmark"),
  );

const consequencesOf = (
  graph: IAutoMovieProductionDesignGraph,
  target: IAutoMovieDesignTarget,
  generatedPaths: readonly string[],
): IAutoMovieDesignMutationConsequences => {
  const staleReviews = new Map<string, IAutoMovieReviewTarget>();
  const addReview = (review: IAutoMovieReviewTarget): void => {
    staleReviews.set(reviewConsequenceKey(review), review);
  };
  addReview({ kind: "design", design: target });
  const affectedFormations = new Set<string>();
  const affectedShots = new Set<string>();
  if (target.kind === "model") {
    for (const [id] of graph.models)
      if (modelRecipeDependsOn(graph, id, target.id))
        addReview({
          kind: "design",
          design: { kind: "model", id },
        });
    for (const [id, formation] of graph.formations)
      if (modelRecipeDependsOn(graph, formation.modelRecipe, target.id)) {
        affectedFormations.add(id);
        addReview({
          kind: "design",
          design: { kind: "formation", id },
        });
      }
  }
  if (target.kind === "formation") affectedFormations.add(target.id);
  if (target.kind === "production" || target.kind === "world")
    for (const id of graph.shots.keys()) {
      affectedShots.add(id);
      addReview({
        kind: "design",
        design: { kind: "shot", id },
      });
    }
  for (const [id, shot] of graph.shots)
    if (
      (target.kind === "model" &&
        shot.participants.some(
          (participant) =>
            participant.kind === "actor" &&
            modelRecipeDependsOn(graph, participant.id, target.id),
        )) ||
      shot.participants.some(
        (participant) =>
          participant.kind === "formation" &&
          affectedFormations.has(participant.id),
      )
    ) {
      affectedShots.add(id);
      addReview({
        kind: "design",
        design: { kind: "shot", id },
      });
    }
  if (target.kind === "shot") {
    affectedShots.add(target.id);
    const source = graph.shots.get(target.id)?.source.module;
    if (source !== undefined) addReview({ kind: "source", path: source });
    for (const [id, acceptance] of graph.acceptance)
      if (
        (acceptance.target.kind === "shot" &&
          acceptance.target.id === target.id) ||
        ((acceptance.criterion.kind === "frame" ||
          acceptance.criterion.kind === "event") &&
          acceptance.criterion.shot === target.id)
      )
        addReview({
          kind: "design",
          design: { kind: "acceptance", id },
        });
  }
  if (target.kind === "acceptance") {
    const acceptance = graph.acceptance.get(target.id);
    if (acceptance?.target.kind === "shot")
      affectedShots.add(acceptance.target.id);
    if (
      acceptance !== undefined &&
      (acceptance.criterion.kind === "frame" ||
        acceptance.criterion.kind === "event") &&
      acceptance.criterion.shot !== undefined
    )
      affectedShots.add(acceptance.criterion.shot);
  }
  if (target.kind === "production")
    for (const [id, acceptance] of graph.acceptance)
      if (acceptance.target.kind === "film")
        addReview({
          kind: "design",
          design: { kind: "acceptance", id },
        });
  for (const id of affectedShots) addReview({ kind: "shot", id });
  addReview({
    kind: "film",
    id: graph.production?.id ?? "film",
  });
  const staleRenders =
    target.kind === "acceptance"
      ? []
      : [
          ...[...affectedShots]
            .sort(compareCodeUnits)
            .map((id) => `shot:${id}`),
          ...(affectedShots.size === 0
            ? []
            : [`film:${graph.production?.id ?? "film"}`]),
        ];
  return {
    staleReviews: [...staleReviews.values()].sort((left, right) =>
      compareCodeUnits(reviewConsequenceKey(left), reviewConsequenceKey(right)),
    ),
    staleRenders,
    removedGenerated: [...generatedPaths].sort(compareCodeUnits),
  };
};

const modelRecipeDependsOn = (
  graph: IAutoMovieProductionDesignGraph,
  model: string,
  dependency: string,
  visited: Set<string> = new Set(),
): boolean => {
  if (model === dependency) return true;
  if (visited.has(model)) return false;
  const branch = new Set(visited).add(model);
  return (graph.models.get(model)?.lod ?? []).some(
    (lod) =>
      lod.recipe !== model &&
      modelRecipeDependsOn(graph, lod.recipe, dependency, branch),
  );
};

const reviewConsequenceKey = (target: IAutoMovieReviewTarget): string => {
  if (target.kind === "design") return `design:${targetKey(target.design)}`;
  if (target.kind === "source") return `source:${target.path}`;
  return `${target.kind}:${target.id}`;
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

const validateIncarnation = (value: unknown, file: string): string => {
  const version = (
    value as { version?: unknown; id?: unknown } | null | undefined
  )?.version;
  const id = (value as { version?: unknown; id?: unknown } | null | undefined)
    ?.id;
  if (
    version !== 1 ||
    typeof id !== "string" ||
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u.test(
      id,
    ) === false
  )
    throw new Error(
      `Invalid production state incarnation "${file}". Reopen a complete, physical AutoMovie project state.`,
    );
  return id;
};

const projectIdOf = (root: string): string => path.basename(root).trim();

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
  return encodeAutoMoviePathSegment(id);
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

/** Canonical render-root-relative bundle path for one manifest identity. */
export const productionRenderBundleRelativePath = (
  manifest: Pick<
    IAutoMovieRenderBundleManifest,
    "target" | "rendererIdentity" | "targetFingerprint" | "renderSpec"
  >,
): string => {
  const renderSpecFingerprint = digestAutoMovieBytes(
    canonicalAutoMovieJsonBytes({
      target: manifest.target,
      rendererIdentity: manifest.rendererIdentity,
      renderSpec: manifest.renderSpec,
    }),
  );
  return [
    `${manifest.target.kind}-${encodeAutoMoviePathSegment(manifest.target.id)}`,
    digestSegment(manifest.targetFingerprint),
    digestSegment(renderSpecFingerprint),
  ].join("/");
};

const digestSegment = (digest: `sha256:${string}`): string =>
  digest.slice("sha256:".length);

const normalizeSlash = (value: string): string =>
  value.split(path.sep).join("/");

const assertRealAncestorInside = (
  rootReal: string,
  candidate: string,
): string => {
  let existing = candidate;
  while (fs.existsSync(existing) === false) existing = path.dirname(existing);
  const real = fs.realpathSync(existing);
  if (isInside(rootReal, real) === false)
    throw new Error(
      `Owned path "${candidate}" escapes the production root through "${existing}". Replace the symlink or junction with a project-local directory.`,
    );
  return real;
};

const assertOwnedRootDirectory = (
  projectRootReal: string,
  directory: string,
  manifestPath: string,
): void => {
  const linked = fs.lstatSync(directory);
  if (linked.isSymbolicLink() || linked.isDirectory() === false)
    throw new Error(
      `Invalid production manifest "${manifestPath}": owned root "${relativeToRoot(projectRootReal, directory)}" must be a physical project directory, not a symlink or junction.`,
    );
  assertRealAncestorInside(projectRootReal, directory);
};

const ownedRootReal = (projectRootReal: string, directory: string): string => {
  const linked = fs.lstatSync(directory);
  if (linked.isSymbolicLink() || linked.isDirectory() === false)
    throw new Error(
      `Owned root "${directory}" was replaced by a symlink, junction, or non-directory. Restore its physical project directory.`,
    );
  return assertRealAncestorInside(projectRootReal, directory);
};

const relativeToRoot = (root: string, file: string): string =>
  path.relative(root, file).split(path.sep).join("/");
