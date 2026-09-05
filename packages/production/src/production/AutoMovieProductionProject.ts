import { resolveProductionFrameRate } from "@automovie/engine";
import {
  AutoMovieContentDigest,
  AutoMovieGuidePass,
  AutoMovieRepaintFailureClass,
  AutoMovieRepaintReferenceRole,
  IAutoMovieAcceptanceScenario,
  IAutoMovieAssetManifest,
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
  IAutoMovieRepaintExecutionPolicy,
  IAutoMovieRepaintReceipt,
  IAutoMovieRepaintRuntimeIdentity,
  IAutoMovieReviewTarget,
  IAutoMovieScreenplayIndex,
  IAutoMovieSemanticMask,
  IAutoMovieShotContract,
  IAutoMovieWorldDesign,
} from "@automovie/interface";
import { randomUUID } from "node:crypto";
import type { BigIntStats, Dirent, Stats } from "node:fs";
import path from "node:path";
import typia, { IValidation } from "typia";

import { acquireCommitLock, releaseCommitLock } from "../project/commitLock";
import { autoMovieFileSystem as fileSystem } from "../project/fileSystem";
import {
  advanceAutoMovieProjectRevision,
  decodeAutoMovieProjectRevision,
} from "../project/projectRevision";
import {
  acceptanceAddressesShot,
  acceptanceCriterionShots,
} from "./acceptanceScope";
import { assetUrlAdmissionRefusal } from "./assetAcquisition";
import { parseAutoMovieCaptureRuntimeIdentity } from "./captureRuntimeIdentity";
import {
  canonicalAutoMovieJsonBytes,
  canonicalizeAutoMovieJson,
  compareCodeUnits,
  digestAutoMovieBytes,
  encodeAutoMoviePathSegment,
} from "./contentIdentity";
import { assertProductionRenditionClipDelivery } from "./muxProductionFeatureMp4";
import {
  probeProductionMedia,
  probeProductionVideoMp4,
} from "./probeProductionMedia";
import {
  AUTOMOVIE_REGISTERED_ARCHETYPES,
  AutoMovieModelArchetypeRegistry,
} from "./productionArchetypes";
import {
  type IProductionPayloadSnapshot,
  captureProductionPayloadSnapshot,
  isProductionPayloadSnapshotCurrent,
} from "./productionPayloadSnapshot";
import {
  type IAutoMovieProductionRenderJobPlan,
  productionRenderLayersForPass,
  readAutoMovieProductionOwnedFile,
} from "./productionRenderJob";
import {
  assertProductionRenderPublicationCurrent,
  isPortableProductionPublicationPath,
} from "./productionRenderPublicationIdentity";
import {
  assertAutoMovieExternalGeneratorTermsAt,
  canonicalAutoMovieRepaintGeneratorProvenance,
  canonicalAutoMovieRepaintRuntimeIdentity,
  productionRepaintActiveReceiptPath,
  productionRepaintOutputPath,
  productionRepaintReceiptPath,
  productionRepaintRequestFingerprint,
  productionRepaintStructuralControls,
  productionSourceRenderFingerprint,
} from "./renditionIdentity";
import {
  AutoMovieRepaintClaimAdmission,
  AutoMovieRepaintClaimSettlement,
  IAutoMovieRepaintAttemptClaim,
  assertAutoMovieRepaintAttemptClaim,
} from "./repaintAttemptClaim";
import {
  IAutoMovieRepaintAttemptRecord,
  assertAutoMovieRepaintExecutionPolicy,
} from "./repaintExecution";
import {
  IAutoMovieRepaintRawOutputPublication,
  IAutoMovieRepaintRawOutputReceipt,
  assertAutoMovieRepaintRawOutput,
  productionRepaintRawOutputReceiptPath,
} from "./repaintRawOutput";
import {
  AutoMovieRepaintRecordInspectionError,
  IAutoMovieRepaintRecordFinding,
  IAutoMovieRepaintRecordInspection,
  inspectAutoMovieRepaintRecords,
} from "./repaintRecordInspection";
import {
  IAutoMovieProductionRootNamespaceLease,
  acquireOrCreateProductionRootNamespace,
  acquireProductionRootNamespace,
  assertProductionRootNamespaceLease,
  releaseProductionRootNamespace,
} from "./rootNamespaceLock";
import { verifyAutoMovieProductionSemanticMaskReceipt } from "./semanticMaskEvidence";
import {
  IAutoMovieProductionDesignGraph,
  validateAutoMovieProductionGraph,
} from "./validateProductionDesign";

/**
 * Summary returned when a production repository is opened.
 */
export interface IAutoMovieProductionProjectSummary {
  /**
   * Absolute active root.
   */
  root: string;
  /**
   * Exact active production inside the project.
   */
  productionId: string;
  /**
   * Every registered production, in portable code-unit order.
   */
  productions: string[];
  /**
   * Production manifest format.
   */
  formatVersion: number;
  /**
   * Current monotonic revision.
   */
  revision: number;
  /**
   * True when this call initialized a fresh production manifest.
   */
  initialized: boolean;
}

/**
 * Current candidate plus the exact immutable selection that activated it.
 *
 * @evidence requirements/repaint/sequence-continuity-and-publication.md#repaint-publication-gate Preserves active selection identity for aggregate observation and final publication.
 * @evidence specifications/asset-and-representation/generated-assets-and-repaint-handoff.md#asset-spec-repaint-output-provenance Joins the verified candidate to its current selection record without receipt inference.
 */
export interface IAutoMovieVerifiedRepaintSelection {
  /** Verified candidate receipt the selection activated. */
  receipt: IAutoMovieRepaintReceipt;
  /** Stable identity of the selection record. */
  selectionId: string;
  /** Digest of the immutable selection record bytes. */
  selectionDigest: AutoMovieContentDigest;
}

/**
 * One declared coding-agent input whose bytes enter compile identity.
 */
export interface IAutoMovieProductionContentInput {
  /**
   * Project-relative normalized path.
   */
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
  /**
   * Exact bytes, or null for one declared optional file that is absent.
   */
  bytes: Uint8Array | null;
}

interface IAutoMovieActiveRepaintReceipt {
  version: 2;
  shot: string;
  selection: string;
  receipt: string;
  output: string;
}

interface IAutoMovieRepaintSelectionRecord {
  version: 1;
  selectionId: string;
  kind: "selection" | "reversal";
  productionId: string;
  shot: string;
  requestId: string;
  attemptId: string;
  selectedAt: string;
  candidateReceipt: string;
  output: string;
  previousSelection: string | null;
  reason: string;
  structuralReview: string;
  continuityReview: {
    baseline: string;
    playbackEvidence: string;
    mixedDeliveryPolicy: string | null;
    flicker: "pass";
    identityDrift: "pass";
    geometryWarp: "pass";
    textureCrawl: "pass";
    transitionMismatch: "pass";
  } | null;
}

interface IAutoMovieStoredRepaintAttemptClaim {
  claim: IAutoMovieRepaintAttemptClaim;
  settlement: AutoMovieRepaintClaimSettlement | null;
}

const REPAINT_RETRYABLE_FAILURE_CLASSES: ReadonlySet<AutoMovieRepaintFailureClass> =
  new Set([
    "timeout",
    "rate-limit",
    "transport",
    "provider-refusal",
    "internal",
  ]);

/**
 * A guarded production commit no longer matches its input snapshot.
 */
export class AutoMovieProductionInputRaceError extends Error {}

/**
 * Structured source-read failure used by the compiler diagnostic boundary.
 */
export class AutoMovieProductionSourcePathError extends Error {
  public constructor(
    /**
     * Stable classification of the failed source-root relation.
     */
    public readonly reason: "missing" | "outside-root",
    message: string,
  ) {
    super(message);
  }
}

interface IRenderFileDescriptorFailure {
  error: unknown;
}

class RenderFileDescriptorCleanupError extends AggregateError {}

/** Close one render-file descriptor without losing earlier failures. */
const closeRenderFileDescriptor = (
  descriptor: number,
  failure: IRenderFileDescriptorFailure | undefined,
  relativePath: string,
): void => {
  try {
    fileSystem.closeSync(descriptor);
  } catch (closeFailure) {
    if (failure === undefined) throw closeFailure;
    throw new RenderFileDescriptorCleanupError(
      [
        ...(failure.error instanceof RenderFileDescriptorCleanupError
          ? failure.error.errors
          : [failure.error]),
        closeFailure,
      ],
      `Render-file descriptor cleanup failed after the read failed: ${relativePath}.`,
    );
  }
};

const REPAINT_REFERENCE_ROLE_COUNT = 7;

/**
 * Tracked production repository for the coding-agent-first application.
 *
 * `automovie/design/<production>` is the human-readable tracked design
 * contract. Project-shared recipes live below `automovie/design/shared`; `src`
 * remains coding-agent owned, while `generated/<production>` is compiler owned
 * and `renders/<production>` is content addressed. Review observations stay in
 * evidence citations and Git rather than a second project ledger. Every
 * one-artifact mutation is staged before an optimistic revision check and one
 * short production-scoped commit lock.
 *
 * @evidence requirements/production-design/continuity-change-and-deliverables.md#production-design-continuity-deliverables Owns the tracked design, revision, derived artifact, and publication records that keep one production's continuity and handoff explicit.
 * @evidence requirements/repaint/providers-models-and-credentials.md#repaint-providers-models-credentials Keeps external repaint execution behind explicit adapter identity and project-owned immutable records rather than hidden provider state.
 * @evidence requirements/repaint/retries-seeds-and-variation.md#repaint-retries-seeds-variation Stores each request and attempt independently, charges retry order, and changes the active pointer only through an accepted lineage.
 * @evidence requirements/repaint/sequence-continuity-and-publication.md#repaint-sequence-continuity-publication Binds accepted rendition selection to current structural, continuity, temporal, and publication evidence.
 * @evidence specifications/asset-and-representation/generated-assets-and-repaint-handoff.md#asset-spec-generation-boundary Persists explicit generator choice, request identity, result provenance, and refusal records without treating external output as deterministic source truth.
 * @evidence specifications/asset-and-representation/generated-assets-and-repaint-handoff.md#asset-spec-repaint-handoff-boundary Owns the source lock, controls, attempts, selection, validation, and publication pointers of the optional repaint handoff.
 * @evidence specifications/narrative-and-intent/budgets-continuity-and-deliverables.md#narrative-intent-design-continuity-ledger Preserves production revisions and immutable identities so design change comparison remains source-derived.
 * @evidence requirements/agent-authoring/partial-work.md#agent-resumable-authoring Reopens a production from its tracked project state and source snapshots alone, without any prior session or agent memory.
 * @evidence specifications/authoring-and-authority/partial-targets-and-atomic-results.md#spec-authoring-partial-resume-compatibility Opens the same project state from its tracked records and snapshots without a prior session, and refuses a stale snapshot instead of mixing it into the current result.
 * @evidence specifications/authoring-and-authority/source-authority-and-derivation.md#spec-authoring-source-resume-compatibility Reopens a production from its tracked ledger and source snapshots so a new tool that honors the same public contract inherits source authority without prior session memory.
 * @evidence specifications/execution-and-recovery/artifacts-and-atomic-publication.md#execution-atomic-current-commit Commits staged writes under one revision compare-and-set so a reader sees either the old or the new generation and never a mixture.
 * @evidence specifications/execution-and-recovery/artifacts-and-atomic-publication.md#execution-publication-conflict-rollback Refuses a commit whose base revision another session advanced, returning the current revision so the caller re-evaluates from that truth.
 */
export class AutoMovieProductionProject {
  /**
   * Active production selected inside the project repository.
   */
  public readonly productionId: string;
  private readonly rootReal: string;
  private readonly rootDevice: string;
  private readonly rootInode: string;
  private readonly automovieRoot: string;
  private readonly automovieIdentity: string;
  private readonly incarnationPath: string;
  private readonly registryPath: string;
  private readonly productionSegment: string;
  private readonly productionStateRoot: string;
  private readonly productionDesignRoot: string;
  private readonly sharedDesignRoot: string;
  private readonly revisionPath: string;
  private readonly lockPath: string;
  private readonly sharedLockPath: string;
  private readonly readOnly_: boolean;
  private readonly initialized_: boolean;
  private readonly incarnation_: string;
  private readonly productionIncarnation_: string;
  private productionNamespaceAncestries_: readonly IPhysicalDirectoryAncestry[] =
    [];
  private manifest_: IAutoMovieProductionManifest & Record<string, unknown>;
  private lastReadRevision_: number;
  private deleted_ = false;

  private constructor(
    /**
     * Canonical host-selected project root for this production repository.
     */
    public readonly root: string,
    rootIdentity: Pick<
      IAutoMovieProductionRootNamespaceLease,
      "device" | "inode"
    >,
    requestedProductionId?: string,
    readOnly = false,
    /**
     * The archetype catalogue every design record in this project is judged
     * against, and the one its compiler builds from.
     */
    public readonly archetypes: AutoMovieModelArchetypeRegistry = AUTOMOVIE_REGISTERED_ARCHETYPES,
  ) {
    this.readOnly_ = readOnly;
    this.rootReal = fileSystem.realpathSync(root);
    this.rootDevice = rootIdentity.device;
    this.rootInode = rootIdentity.inode;
    this.automovieRoot = path.join(root, "automovie");
    this.incarnationPath = path.join(this.automovieRoot, "incarnation.json");
    this.registryPath = path.join(this.automovieRoot, "productions.json");
    const initialStateRoot = lstatOrNull(this.automovieRoot);
    if (initialStateRoot?.isSymbolicLink())
      throw new Error(
        `Reserved AutoMovie state root "${this.automovieRoot}" is a symlink or junction. Replace it with a physical project directory before opening the project.`,
      );
    if (
      readOnly &&
      (initialStateRoot === null || initialStateRoot.isDirectory() === false)
    )
      throw new Error(
        `Reserved AutoMovie state root "${this.automovieRoot}" is missing or not a directory. Open a complete physical project before read-only verification.`,
      );
    if (readOnly === false) this.mkdirOwned(this.automovieRoot);
    const stateIdentity = fileSystem.statSync(this.automovieRoot, {
      bigint: true,
    });
    this.automovieIdentity = fileIdentityKey(stateIdentity);
    const incarnation = readOwnedJson(this.rootReal, this.incarnationPath);
    if (incarnation === undefined) {
      if (readOnly)
        throw new Error(
          `Read-only verification requires existing state incarnation "${this.incarnationPath}". Run npm run compile once to initialize the project.`,
        );
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
    this.initialized_ =
      readOwnedJson(this.rootReal, this.registryPath) === undefined;
    this.manifest_ = {
      ...PROJECT_LAYOUT,
      projectId: projectIdOf(root),
      ...importedLegacyOf(this.rootReal, this.automovieRoot),
    };
    const registration = readOnly
      ? this.readProductionRegistration(requestedProductionId)
      : this.activateProduction(requestedProductionId);
    this.productionId = registration.productionId;
    this.productionIncarnation_ = registration.incarnation;
    this.productionSegment = encodeId(this.productionId);
    this.productionStateRoot = path.join(
      this.automovieRoot,
      "productions",
      this.productionSegment,
    );
    this.productionDesignRoot = productionDesignRootOf(root, this.productionId);
    this.sharedDesignRoot = path.join(this.automovieRoot, "design", "shared");
    this.revisionPath = path.join(this.productionStateRoot, "revision.json");
    this.lockPath = path.join(this.productionStateRoot, "revision.lock");
    this.sharedLockPath = path.join(this.automovieRoot, "shared-design.lock");
    if (readOnly === false) {
      if (registration.legacy) this.migrateLegacyProductionLayout();
      for (const directory of SHARED_DESIGN_DIRECTORIES)
        this.mkdirOwned(path.join(this.sharedDesignRoot, directory));
      for (const directory of PRODUCTION_DESIGN_DIRECTORIES)
        this.mkdirOwned(path.join(this.productionDesignRoot, directory));
      this.mkdirOwned(path.join(this.productionStateRoot, "render-receipts"));
      for (const directory of [
        ...this.manifest_.sourceRoots,
        this.manifest_.generatedRoot,
        this.manifest_.renderRoot,
      ])
        this.mkdirOwned(this.resolveOwnedDirectory(directory));
      this.mkdirOwned(this.generatedRoot());
      this.mkdirOwned(this.renderRoot());
    } else
      for (const directory of [
        ...this.productionNamespaceDirectories(),
        ...this.manifest_.sourceRoots.map((entry) =>
          this.resolveOwnedDirectory(entry),
        ),
      ])
        assertPhysicalDirectoryAncestors(this.rootReal, directory, false);
    this.productionNamespaceAncestries_ =
      this.productionNamespaceDirectories().map((directory) =>
        acquirePhysicalDirectoryAncestry(this.rootReal, directory),
      );
    validateRealOwnershipLayout(
      this.rootReal,
      this.root,
      this.manifest_,
      PROJECT_LAYOUT_LABEL,
    );
    this.lastReadRevision_ = readRevision(this.rootReal, this.revisionPath);
  }

  private mkdirOwned(directory: string): void {
    this.assertWritable();
    this.assertProjectRootIdentity();
    assertPhysicalDirectoryAncestors(this.rootReal, directory, true);
    fileSystem.mkdirSync(directory, {
      recursive: true,
    });
    assertPhysicalDirectoryAncestors(this.rootReal, directory, false);
    this.assertProjectRootIdentity();
  }

  private assertWritable(): void {
    if (this.readOnly_)
      throw new Error(
        `Production "${this.productionId}" was opened read-only and cannot mutate project state.`,
      );
  }

  private writeOwnedJsonAtomic(file: string, value: unknown): void {
    this.assertWritable();
    this.assertProjectRootIdentity();
    assertPhysicalDirectoryAncestors(this.rootReal, path.dirname(file), false);
    assertOwnedRegularFile(this.rootReal, file);
    writeJsonAtomic(file, value);
    assertPhysicalDirectoryAncestors(this.rootReal, path.dirname(file), false);
    assertOwnedRegularFile(this.rootReal, file);
    this.assertProjectRootIdentity();
  }

  private activateProduction(requestedProductionId?: string): {
    incarnation: string;
    legacy: boolean;
    productionId: string;
  } {
    const stored = readOwnedJson(this.rootReal, this.registryPath);
    const registry =
      stored === undefined
        ? {
            version: 1 as const,
            layoutVersion: 0,
            productions: [] as string[],
            incarnations: {} as Record<string, string>,
          }
        : validateProductionRegistry(stored, this.registryPath);
    const legacyId = legacyProductionId(this.rootReal, this.automovieRoot);
    let productionId = requestedProductionId;
    if (
      productionId !== undefined &&
      (productionId.trim().length === 0 || productionId.trim() !== productionId)
    )
      throw new Error("Production id must be a trimmed non-empty stable id.");
    if (productionId !== undefined) validateProductionId(productionId);
    if (
      registry.layoutVersion === 0 &&
      legacyId !== null &&
      productionId !== undefined &&
      productionId !== legacyId
    )
      throw new Error(
        `Legacy production design declares id "${legacyId}", not requested production "${productionId}". Open "${legacyId}" once to migrate it, then register another production.`,
      );
    if (productionId === undefined) {
      if (registry.productions.length === 1)
        productionId = registry.productions[0]!;
      else if (registry.productions.length > 1)
        throw new Error(
          `Project "${this.root}" contains ${registry.productions.length} productions. Configure the host with one productionId from: ${registry.productions.join(", ")}.`,
        );
      else productionId = legacyId ?? this.manifest_.projectId;
    }
    validateProductionId(productionId);
    if (productionId.toLowerCase() === "shared")
      throw new Error(
        'Production id "shared" is reserved for project-level design assets. Choose another stable id.',
      );
    const productionKey = portableProductionKey(productionId);
    const collision = registry.productions.find(
      (candidate) =>
        portableProductionKey(candidate) === productionKey &&
        candidate !== productionId,
    );
    if (collision !== undefined)
      throw new Error(
        `Production id "${productionId}" collides with registered production "${collision}" on a case-insensitive filesystem. Choose one portable spelling.`,
      );
    this.preflightProductionNamespace(productionId);
    if (registry.productions.includes(productionId) === false) {
      registry.productions.push(productionId);
      setProductionIncarnation(
        registry.incarnations,
        productionId,
        randomUUID(),
      );
    } else if (
      productionIncarnationOf(registry.incarnations, productionId) === undefined
    )
      setProductionIncarnation(
        registry.incarnations,
        productionId,
        randomUUID(),
      );
    registry.productions.sort(compareCodeUnits);
    const legacy = registry.layoutVersion !== 1;
    this.writeOwnedJsonAtomic(this.registryPath, registry);
    return {
      incarnation: productionIncarnationOf(
        registry.incarnations,
        productionId,
      )!,
      legacy,
      productionId,
    };
  }

  private readProductionRegistration(requestedProductionId?: string): {
    incarnation: string;
    legacy: false;
    productionId: string;
  } {
    const registry = validateProductionRegistry(
      readOwnedJson(this.rootReal, this.registryPath),
      this.registryPath,
    );
    if (registry.layoutVersion !== 1)
      throw new Error(
        `Read-only verification cannot migrate legacy production layout "${this.registryPath}". Run npm run compile once before verifying.`,
      );
    let productionId = requestedProductionId;
    if (productionId === undefined) {
      if (registry.productions.length !== 1)
        throw new Error(
          `Read-only verification requires one productionId; registered productions: ${registry.productions.join(", ") || "<none>"}.`,
        );
      productionId = registry.productions[0]!;
    }
    validateProductionId(productionId);
    if (productionId.toLowerCase() === "shared")
      throw new Error(
        'Production id "shared" is reserved for project-level design assets.',
      );
    if (registry.productions.includes(productionId) === false)
      throw new Error(
        `Read-only verification cannot register missing production "${productionId}". Run npm run compile once to initialize it.`,
      );
    const incarnation = productionIncarnationOf(
      registry.incarnations,
      productionId,
    );
    if (incarnation === undefined)
      throw new Error(
        `Read-only verification requires an existing incarnation for production "${productionId}". Run npm run compile once to initialize it.`,
      );
    return { incarnation, legacy: false, productionId };
  }

  private preflightProductionNamespace(productionId: string): void {
    const segment = encodeId(productionId);
    for (const directory of [
      path.join(this.automovieRoot, "design", "shared"),
      path.join(this.automovieRoot, "design", segment),
      path.join(this.automovieRoot, "productions", segment),
      path.join(
        this.resolveOwnedDirectory(this.manifest_.generatedRoot),
        segment,
      ),
      path.join(this.resolveOwnedDirectory(this.manifest_.renderRoot), segment),
    ])
      assertPhysicalDirectoryAncestors(this.rootReal, directory, true);
  }

  private migrateLegacyProductionLayout(): void {
    const moves: Array<{ source: string; destination: string }> = [];
    for (const directory of ["models", "formations"])
      moves.push({
        source: path.join(this.automovieRoot, "design", directory),
        destination: path.join(this.sharedDesignRoot, directory),
      });
    moves.push({
      source: path.join(this.automovieRoot, "design", "world.json"),
      destination: path.join(this.sharedDesignRoot, "world.json"),
    });
    moves.push({
      source: path.join(this.automovieRoot, "design", "production.json"),
      destination: path.join(this.productionDesignRoot, "production.json"),
    });
    for (const directory of ["shots", "acceptance", "screenplay"])
      moves.push({
        source: path.join(this.automovieRoot, "design", directory),
        destination: path.join(this.productionDesignRoot, directory),
      });
    for (const entry of [
      "revision.json",
      "generated-manifest.json",
      "render-manifest.json",
      "render-manifest-receipt.json",
      "render-receipts",
      "audit",
    ])
      moves.push({
        source: path.join(this.automovieRoot, entry),
        destination: path.join(this.productionStateRoot, entry),
      });
    for (const relativeRoot of [
      this.manifest_.generatedRoot,
      this.manifest_.renderRoot,
    ]) {
      const outputRoot = this.resolveOwnedDirectory(relativeRoot);
      moves.push({
        source: outputRoot,
        destination: path.join(outputRoot, this.productionSegment),
      });
    }

    const temporary = path.join(
      this.automovieRoot,
      `.layout-migration-${randomUUID()}`,
    );
    this.mkdirOwned(temporary);
    const staged: Array<{
      source: string;
      destination: string;
      temporary: string;
      identity: string;
      destinationParent?: IPhysicalDirectoryAncestry;
    }> = [];
    const published: typeof staged = [];
    const temporaryAncestry = acquirePhysicalDirectoryAncestry(
      this.rootReal,
      temporary,
    );
    let registryPublished = false;
    const assertMigrationFence = (): void => {
      this.assertProjectRootIdentity();
      this.assertStateRootIdentity();
      assertPhysicalDirectoryAncestry(temporaryAncestry);
    };
    const assertResidentMove = (file: string, identity: string): void => {
      assertPhysicalDirectoryAncestors(
        this.rootReal,
        path.dirname(file),
        false,
      );
      const linked = lstatOrNull(file);
      if (
        linked === null ||
        linked.isSymbolicLink() ||
        fileIdentityKey(fileSystem.statSync(file, { bigint: true })) !==
          identity
      )
        throw new AutoMovieProductionInputRaceError(
          `Legacy migration entry "${file}" changed physical identity. No stale-path rollback may touch its replacement.`,
        );
    };
    try {
      for (const [index, move] of moves.entries()) {
        assertMigrationFence();
        // A fresh project has no legacy tree to migrate. Permit that missing
        // tail while still rejecting every existing linked/non-directory
        // ancestor before the source itself is inspected.
        assertPhysicalDirectoryAncestors(
          this.rootReal,
          path.dirname(move.source),
          true,
        );
        const state = lstatOrNull(move.source);
        if (state === null) continue;
        if (state.isSymbolicLink())
          throw new Error(
            `Legacy production path "${move.source}" is a symlink or junction. Replace it with project-owned files before migration.`,
          );
        const identity = fileIdentityKey(
          fileSystem.statSync(move.source, { bigint: true }),
        );
        const stagedPath = path.join(temporary, String(index).padStart(2, "0"));
        fileSystem.renameSync(move.source, stagedPath);
        assertResidentMove(stagedPath, identity);
        staged.push({ ...move, temporary: stagedPath, identity });
      }
      for (const move of staged) {
        assertMigrationFence();
        assertResidentMove(move.temporary, move.identity);
        if (lstatOrNull(move.destination) !== null)
          throw new Error(
            `Legacy production path "${move.source}" conflicts with namespaced destination "${move.destination}". Keep one authoritative copy before reopening the project.`,
          );
        this.mkdirOwned(path.dirname(move.destination));
        move.destinationParent = acquirePhysicalDirectoryAncestry(
          this.rootReal,
          path.dirname(move.destination),
        );
        fileSystem.renameSync(move.temporary, move.destination);
        assertPhysicalDirectoryAncestry(move.destinationParent);
        assertResidentMove(move.destination, move.identity);
        published.push(move);
      }
      assertMigrationFence();
      for (const move of published) {
        assertPhysicalDirectoryAncestry(move.destinationParent!);
        assertResidentMove(move.destination, move.identity);
      }
      const registry = validateProductionRegistry(
        readOwnedJson(this.rootReal, this.registryPath),
        this.registryPath,
      );
      registry.layoutVersion = 1;
      writeAtomic(
        this.registryPath,
        Buffer.from(serializeJson(registry), "utf8"),
        assertMigrationFence,
        () => {
          registryPublished = true;
        },
      );
    } catch (error) {
      if (registryPublished)
        throw new AggregateError(
          [error],
          "Legacy migration data and registry were committed. No rollback was attempted after the registry commit point.",
        );
      try {
        assertMigrationFence();
        for (const move of published) {
          assertPhysicalDirectoryAncestry(move.destinationParent!);
          assertResidentMove(move.destination, move.identity);
        }
        for (const move of staged)
          if (published.includes(move) === false)
            assertResidentMove(move.temporary, move.identity);
      } catch (identityError) {
        throw new AggregateError(
          [error, identityError],
          "Legacy migration stopped after an owned namespace changed physical identity. No stale-path rollback was attempted.",
        );
      }
      for (const move of [...published].reverse()) {
        assertPhysicalDirectoryAncestry(move.destinationParent!);
        assertResidentMove(move.destination, move.identity);
        if (lstatOrNull(move.temporary) === null)
          fileSystem.renameSync(move.destination, move.temporary);
        assertResidentMove(move.temporary, move.identity);
        if (
          path.dirname(move.destination) === move.source &&
          lstatOrNull(move.source)?.isDirectory() === true &&
          fileSystem.readdirSync(move.source).length === 0
        )
          fileSystem.rmdirSync(move.source);
      }
      for (const move of [...staged].reverse()) {
        const existing = lstatOrNull(move.source);
        if (
          existing?.isDirectory() === true &&
          fileSystem.readdirSync(move.source).length === 0
        )
          fileSystem.rmdirSync(move.source);
        if (
          lstatOrNull(move.source) === null &&
          lstatOrNull(move.temporary) !== null
        ) {
          this.mkdirOwned(path.dirname(move.source));
          assertResidentMove(move.temporary, move.identity);
          fileSystem.renameSync(move.temporary, move.source);
          assertResidentMove(move.source, move.identity);
        }
      }
      throw error;
    } finally {
      try {
        assertPhysicalDirectoryAncestry(temporaryAncestry);
        if (fileSystem.readdirSync(temporary).length === 0)
          fileSystem.rmdirSync(temporary);
      } catch {
        // A replacement temporary root is not ours to inspect or remove.
      }
    }
    this.assertProjectRootIdentity();
  }

  /**
   * Open or initialize one production inside a project repository.
   */
  public static open(
    rootDirectory: string,
    productionId?: string,
    archetypes: AutoMovieModelArchetypeRegistry = AUTOMOVIE_REGISTERED_ARCHETYPES,
  ): AutoMovieProductionProject {
    const root = path.resolve(rootDirectory);
    if (path.parse(root).root === root)
      throw new Error(
        `AutoMovie production root "${root}" is a filesystem root. Configure the host with a dedicated project directory.`,
      );
    const lease = acquireOrCreateProductionRootNamespace(root);
    try {
      assertProductionRootNamespaceLease(lease);
      const project = new AutoMovieProductionProject(
        lease.root,
        lease,
        productionId,
        false,
        archetypes,
      );
      assertProductionRootNamespaceLease(lease);
      return project;
    } finally {
      releaseProductionRootNamespace(lease);
    }
  }

  /**
   * Open one fully initialized production without creating, migrating, or
   * repairing any project-resident path.
   */
  public static openReadOnly(
    rootDirectory: string,
    productionId?: string,
    archetypes: AutoMovieModelArchetypeRegistry = AUTOMOVIE_REGISTERED_ARCHETYPES,
  ): AutoMovieProductionProject {
    const root = path.resolve(rootDirectory);
    if (path.parse(root).root === root)
      throw new Error(
        `AutoMovie production root "${root}" is a filesystem root. Configure the host with a dedicated project directory.`,
      );
    const lease = acquireProductionRootNamespace(root);
    try {
      assertProductionRootNamespaceLease(lease);
      const project = new AutoMovieProductionProject(
        lease.root,
        lease,
        productionId,
        true,
        archetypes,
      );
      assertProductionRootNamespaceLease(lease);
      return project;
    } finally {
      releaseProductionRootNamespace(lease);
    }
  }

  /**
   * Read one production's own design record without opening project state.
   *
   * The design record is where a production states the decisions it answers
   * for, so a consumer that needs one of them before anything has been opened
   * for writing asks the design rather than a second declaration beside it.
   * This reads exactly that one file under the same physical fence the project
   * reads it through, creates nothing, and takes no lock.
   *
   * A project that has emitted no design record has authored no such decision,
   * which is `null` rather than a fault: each reader of an optional decision
   * then falls back to its shipped default instead of inventing a value. A
   * resident record that does not validate is still an error, because a
   * decision nobody can read is not the same as a decision nobody made.
   */
  public static productionDesign(
    rootDirectory: string,
    productionId: string,
  ): IAutoMovieProductionDesign | null {
    const root = path.resolve(rootDirectory);
    const rootReal = fileSystem.realpathSync(root);
    return readOwnedTypedJson(
      rootReal,
      path.join(productionDesignRootOf(root, productionId), "production.json"),
      validateProductionDesign,
    );
  }

  /**
   * Read registered production ids without creating project state.
   */
  public static registeredProductionIds(rootDirectory: string): string[] {
    const root = path.resolve(rootDirectory);
    const rootReal = fileSystem.realpathSync(root);
    const registryPath = path.join(rootReal, "automovie", "productions.json");
    return validateProductionRegistry(
      readOwnedJson(rootReal, registryPath),
      registryPath,
    ).productions;
  }

  /**
   * Current manifest with unknown future fields preserved.
   */
  public manifest(): IAutoMovieProductionManifest {
    this.refreshRevision();
    return structuredClone(this.manifest_);
  }

  /**
   * Read byte-exact project-wide records under the current state fence.
   */
  public projectStateRecords(): {
    incarnation: Uint8Array;
  } {
    this.assertIncarnation();
    const root = ownedRootReal(this.rootReal, this.automovieRoot);
    const read = (file: string): Uint8Array => {
      assertOwnedRegularFile(root, file);
      return readAutoMovieProductionOwnedFile({
        root,
        directory: root,
        relative: path.basename(file),
      });
    };
    return {
      incarnation: read(this.incarnationPath),
    };
  }

  /**
   * Every registered production in this project.
   */
  public productionIds(): string[] {
    this.refreshRevision();
    return [
      ...validateProductionRegistry(
        readOwnedJson(this.rootReal, this.registryPath),
        this.registryPath,
      ).productions,
    ];
  }

  /**
   * Enumerate declared source, viewer, script and asset inputs safely.
   */
  public contentInputs(): IAutoMovieProductionContentInput[] {
    this.assertProjectRootIdentity();
    const readContent = (physicalRoot: string, file: string): Uint8Array =>
      readAutoMovieProductionOwnedFile({
        root: physicalRoot,
        directory: path.dirname(file),
        relative: path.basename(file),
      });
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
      inputs.set(inputPath, {
        bytes,
        render,
        source,
      });
    };
    const visit = (
      directory: string,
      physicalRoot: string,
      source: boolean,
      render: boolean,
    ): void => {
      const realDirectory = fileSystem.realpathSync(directory);
      if (
        isInside(this.rootReal, realDirectory) === false ||
        isInside(physicalRoot, realDirectory) === false
      )
        throw new Error(
          `Declared content directory "${relativeToRoot(this.root, directory)}" escapes its verified physical project root. Replace the junction with physical project content.`,
        );
      for (const entry of fileSystem
        .readdirSync(directory, { withFileTypes: true })
        .sort((left, right) => compareCodeUnits(left.name, right.name))) {
        const absolute = path.join(directory, entry.name);
        const linked = fileSystem.lstatSync(absolute);
        if (linked.isSymbolicLink())
          throw new Error(
            `Declared content path "${relativeToRoot(this.root, absolute)}" is a symlink or junction. Replace it with physical project content before compilation.`,
          );
        if (linked.isDirectory()) visit(absolute, physicalRoot, source, render);
        else if (linked.isFile()) {
          const real = fileSystem.realpathSync(absolute);
          if (
            isInside(this.rootReal, real) === false ||
            isInside(physicalRoot, real) === false
          )
            throw new Error(
              `Declared content file "${relativeToRoot(this.root, absolute)}" escapes its verified physical project root. Replace the junction with a physical file.`,
            );
          setInput(
            normalizeSlash(path.relative(this.root, absolute)),
            readContent(physicalRoot, real),
            source,
            render,
          );
        }
      }
    };
    for (const [relativeRoot, source, render] of [
      ...this.manifest_.sourceRoots.map((root) => [root, true, false] as const),
      ...PROJECT_LAYOUT.contentRoots.map(
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
          `Declared content root "${relativeRoot}" must be a physical project directory before compilation.`,
        );
      const physicalRoot = fileSystem.realpathSync(absolute);
      if (isInside(this.rootReal, physicalRoot) === false)
        throw new Error(
          `Declared content root "${relativeRoot}" escapes the production project through a directory junction. Move it into a physical project directory before compilation.`,
        );
      visit(absolute, physicalRoot, source, render);
    }
    for (const relativeFile of PROJECT_LAYOUT.contentFiles) {
      const absolute = resolveInside(this.root, relativeFile);
      const linked = lstatOrNull(absolute);
      if (linked === null) {
        setInput(normalizeSlash(relativeFile), null, false, true);
        continue;
      }
      if (linked.isSymbolicLink() || linked.isFile() === false)
        throw new Error(
          `Declared content file "${relativeFile}" must be a physical regular file before compilation.`,
        );
      const real = fileSystem.realpathSync(absolute);
      if (isInside(this.rootReal, real) === false)
        throw new Error(
          `Declared content file "${relativeFile}" escapes the production project through a directory junction. Move it into a physical project directory before compilation.`,
        );
      setInput(
        normalizeSlash(relativeFile),
        readContent(this.rootReal, real),
        false,
        true,
      );
    }
    if (this.manifest_.assetManifest !== undefined) {
      const relativeFile = this.manifest_.assetManifest;
      const absolute = resolveInside(this.root, relativeFile);
      const linked = lstatOrNull(absolute);
      if (linked === null)
        setInput(normalizeSlash(relativeFile), null, false, false);
      else {
        if (linked.isSymbolicLink() || linked.isFile() === false)
          throw new Error(
            `Declared asset manifest "${relativeFile}" must be a physical regular file before compilation.`,
          );
        const real = fileSystem.realpathSync(absolute);
        if (isInside(this.rootReal, real) === false)
          throw new Error(
            `Declared asset manifest "${relativeFile}" escapes the production project through a junction. Move it into the physical automovie directory before compilation.`,
          );
        setInput(
          normalizeSlash(relativeFile),
          readContent(this.rootReal, real),
          false,
          false,
        );
      }
    }
    return [...inputs]
      .map(([inputPath, input]) => ({ path: inputPath, ...input }))
      .sort((left, right) => compareCodeUnits(left.path, right.path));
  }

  /**
   * Current open summary.
   */
  public summary(): IAutoMovieProductionProjectSummary {
    this.refreshRevision();
    return {
      root: this.root,
      productionId: this.productionId,
      productions: this.productionIds(),
      formatVersion: this.manifest_.formatVersion,
      revision: this.lastReadRevision_,
      initialized: this.initialized_,
    };
  }

  /**
   * Current monotonic revision.
   */
  public revision(): number {
    this.refreshRevision();
    return this.lastReadRevision_;
  }

  /**
   * Compact deterministic design inventory.
   */
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

  /**
   * Load every current design artifact and validate its stored shape.
   */
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
      models: this.readKeyedDesigns(
        path.join(this.sharedDesignRoot, "models"),
        validateModelRecipe,
      ),
      world: readOwnedTypedJson(
        stateRootReal,
        this.designPath({ kind: "world" }),
        validateWorldDesign,
      ),
      formations: this.readKeyedDesigns(
        path.join(this.sharedDesignRoot, "formations"),
        validateFormationDesign,
      ),
      shots: this.readKeyedDesigns(
        path.join(this.productionDesignRoot, "shots"),
        validateShotContract,
      ),
      acceptance: this.readKeyedDesigns(
        path.join(this.productionDesignRoot, "acceptance"),
        validateAcceptanceScenario,
      ),
    };
  }

  /**
   * Read one exact design artifact, returning null when absent.
   */
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

  /**
   * Upsert the active production's design.
   */
  public setProductionDesign(
    design: IAutoMovieProductionDesign,
  ): IAutoMovieDesignMutationOutput {
    if (design.id !== this.productionId) {
      const graph = this.loadGraph();
      return {
        accepted: false,
        revision: this.lastReadRevision_,
        target: { kind: "production" },
        fingerprint: null,
        consequences: consequencesOf(
          graph,
          { kind: "production" },
          this.loadGeneratedManifest()?.files.map((file) => file.path) ?? [],
          this.loadScreenplayIndex(),
        ),
        diagnostics: [
          {
            code: "production-address-mismatch",
            category: "error",
            phase: "design",
            target: "production",
            path: relativeToRoot(
              this.root,
              this.designPath({ kind: "production" }),
            ),
            message: `Active production "${this.productionId}" cannot store design "${design.id}". Reopen the project with productionId "${design.id}" or correct the design id.`,
          },
        ],
      };
    }
    return this.setDesign(
      { kind: "production" },
      design,
      validateProductionDesign(design),
    );
  }

  /**
   * Upsert exactly one model recipe.
   */
  public setModelRecipe(
    design: IAutoMovieModelRecipe,
  ): IAutoMovieDesignMutationOutput {
    return this.setDesign(
      { kind: "model", id: inputDesignId(design) },
      design,
      validateModelRecipe(design),
    );
  }

  /**
   * Upsert the project-shared world design.
   */
  public setWorldDesign(
    design: IAutoMovieWorldDesign,
  ): IAutoMovieDesignMutationOutput {
    return this.setDesign(
      { kind: "world" },
      design,
      validateWorldDesign(design),
    );
  }

  /**
   * Upsert exactly one formation.
   */
  public setFormationDesign(
    design: IAutoMovieFormationDesign,
  ): IAutoMovieDesignMutationOutput {
    return this.setDesign(
      { kind: "formation", id: inputDesignId(design) },
      design,
      validateFormationDesign(design),
    );
  }

  /**
   * Upsert exactly one code-bound shot contract.
   */
  public setShotContract(
    design: IAutoMovieShotContract,
  ): IAutoMovieDesignMutationOutput {
    return this.setDesign(
      { kind: "shot", id: inputDesignId(design) },
      design,
      validateShotContract(design),
    );
  }

  /**
   * Upsert exactly one acceptance scenario.
   */
  public setAcceptanceScenario(
    design: IAutoMovieAcceptanceScenario,
  ): IAutoMovieDesignMutationOutput {
    return this.setDesign(
      { kind: "acceptance", id: inputDesignId(design) },
      design,
      validateAcceptanceScenario(design),
    );
  }

  /**
   * Remove exactly one unreferenced design artifact.
   */
  public eraseDesignArtifact(
    target: IAutoMovieDesignTarget,
    reason = "direct project API erase",
  ): IAutoMovieDesignMutationOutput {
    if (reason.trim().length === 0)
      throw new Error("Design erase audit reason must not be blank.");
    const expectedRevision = this.lastReadRevision_;
    const graph = this.loadGraph();
    const current = designFromGraph(graph, target);
    const consequences = consequencesOf(
      graph,
      target,
      this.loadGeneratedManifest()?.files.map((file) => file.path) ?? [],
      this.loadScreenplayIndex(),
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
          message: `${reference} still references this design. Update that artifact before removing the design record.`,
        })),
      };
    const nextRevision = requireNextRevision(expectedRevision);
    const revision = this.commitFiles(
      [
        { path: this.designPath(target), content: null },
        {
          path: path.join(
            isSharedDesign(target)
              ? path.join(
                  this.automovieRoot,
                  "audit",
                  "shared-design-mutations",
                )
              : path.join(
                  this.productionStateRoot,
                  "audit",
                  "design-mutations",
                ),
            `${
              isSharedDesign(target) ? `${this.productionSegment}-` : ""
            }${String(nextRevision).padStart(12, "0")}-erase.json`,
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
      ],
      undefined,
      expectedRevision,
      undefined,
      true,
      isSharedDesign(target),
    );
    return {
      accepted: true,
      revision,
      target,
      fingerprint: null,
      consequences,
      diagnostics: [],
    };
  }

  /**
   * Remove the active production namespace without touching shared assets or
   * any sibling production.
   */
  public eraseProduction(reason: string): {
    erased: boolean;
    productionId: string;
    remaining: string[];
  } {
    this.assertWritable();
    if (reason.trim().length === 0)
      throw new Error("Production erase audit reason must not be blank.");
    const lease = acquireProductionRootNamespace(this.root);
    let token: string | null = null;
    const quarantine = path.join(
      this.automovieRoot,
      `.erase-${this.productionSegment}-${randomUUID()}`,
    );
    const moved: Array<{ from: string; to: string; identity: string }> = [];
    const auditPath = path.join(
      this.automovieRoot,
      "audit",
      "production-deletions",
      `${this.productionSegment}-${randomUUID()}.json`,
    );
    let erased = false;
    let registryPublished = false;
    let remaining: string[] = [];
    let quarantineAncestry: IPhysicalDirectoryAncestry | null = null;
    let auditParentAncestry: IPhysicalDirectoryAncestry | null = null;
    let sourceParentAncestries: readonly IPhysicalDirectoryAncestry[] = [];
    let auditIdentity: string | null = null;
    let productionStateIdentity: string | null = null;
    const committedErase: {
      fence: {
        quarantine: IPhysicalDirectoryAncestry;
        state: string;
      } | null;
    } = { fence: null };
    const assertResidentEntry = (file: string, identity: string): void => {
      assertPhysicalDirectoryAncestors(
        this.rootReal,
        path.dirname(file),
        false,
      );
      const linked = lstatOrNull(file);
      if (
        linked === null ||
        linked.isSymbolicLink() ||
        fileIdentityKey(fileSystem.statSync(file, { bigint: true })) !==
          identity
      )
        throw new AutoMovieProductionInputRaceError(
          `Production erase entry "${file}" changed physical identity. No stale-path cleanup may touch its replacement.`,
        );
    };
    const assertEraseFence = (): void => {
      assertProductionRootNamespaceLease(lease);
      this.assertProjectRootIdentity();
      this.assertStateRootIdentity();
      if (quarantineAncestry !== null)
        assertPhysicalDirectoryAncestry(quarantineAncestry);
      if (auditParentAncestry !== null)
        assertPhysicalDirectoryAncestry(auditParentAncestry);
      for (const ancestry of sourceParentAncestries)
        assertPhysicalDirectoryAncestry(ancestry);
    };
    const markErased = (
      fence: NonNullable<(typeof committedErase)["fence"]>,
    ): NonNullable<(typeof committedErase)["fence"]> => {
      this.deleted_ = true;
      erased = true;
      return fence;
    };
    try {
      token = acquireCommitLock(this.lockPath);
      assertProductionRootNamespaceLease(lease);
      this.assertIncarnation();
      const residentStateIdentity = fileIdentityKey(
        fileSystem.statSync(this.productionStateRoot, { bigint: true }),
      );
      productionStateIdentity = residentStateIdentity;
      const registry = validateProductionRegistry(
        readOwnedJson(this.rootReal, this.registryPath),
        this.registryPath,
      );
      const sources = [
        this.productionDesignRoot,
        this.generatedRoot(),
        this.renderRoot(),
      ];
      this.mkdirOwned(quarantine);
      const residentQuarantineAncestry = acquirePhysicalDirectoryAncestry(
        this.rootReal,
        quarantine,
      );
      quarantineAncestry = residentQuarantineAncestry;
      const residentEraseFence = {
        quarantine: residentQuarantineAncestry,
        state: residentStateIdentity,
      };
      this.mkdirOwned(path.dirname(auditPath));
      auditParentAncestry = acquirePhysicalDirectoryAncestry(
        this.rootReal,
        path.dirname(auditPath),
      );
      sourceParentAncestries = sources.map((source) =>
        acquirePhysicalDirectoryAncestry(this.rootReal, path.dirname(source)),
      );
      for (const source of sources) {
        assertEraseFence();
        const state = lstatOrNull(source);
        if (state === null) continue;
        if (state.isSymbolicLink())
          throw new Error(
            `Production erase refused unsafe namespace "${source}". Replace links and reopen before retrying.`,
          );
        const identity = fileIdentityKey(
          fileSystem.statSync(source, { bigint: true }),
        );
        const destination = path.join(
          quarantine,
          String(moved.length).padStart(2, "0"),
        );
        fileSystem.renameSync(source, destination);
        assertResidentEntry(destination, identity);
        moved.push({ from: source, to: destination, identity });
      }
      remaining = registry.productions.filter(
        (production) => production !== this.productionId,
      );
      writeAtomic(
        auditPath,
        Buffer.from(
          serializeJson({
            version: 1,
            productionId: this.productionId,
            reason: reason.trim(),
          }),
          "utf8",
        ),
        assertEraseFence,
        () => {
          auditIdentity = fileIdentityKey(
            fileSystem.statSync(auditPath, { bigint: true }),
          );
        },
      );
      writeAtomic(
        this.registryPath,
        Buffer.from(
          serializeJson({
            ...registry,
            productions: remaining,
            incarnations: Object.fromEntries(
              Object.entries(registry.incarnations).filter(
                ([production]) => production !== this.productionId,
              ),
            ),
          }),
          "utf8",
        ),
        assertEraseFence,
        () => {
          registryPublished = true;
          committedErase.fence = markErased(residentEraseFence);
        },
      );
    } catch (error) {
      if (registryPublished === false) {
        try {
          assertEraseFence();
          for (const entry of moved)
            assertResidentEntry(entry.to, entry.identity);
          if (auditIdentity !== null)
            assertResidentEntry(auditPath, auditIdentity);
        } catch (identityError) {
          throw new AggregateError(
            [error, identityError],
            "Production erase stopped after an owned namespace changed physical identity. No stale-path rollback was attempted.",
          );
        }
        const rollbackErrors: unknown[] = [];
        for (const entry of [...moved].reverse())
          try {
            assertEraseFence();
            assertResidentEntry(entry.to, entry.identity);
            if (lstatOrNull(entry.from) !== null)
              throw new AutoMovieProductionInputRaceError(
                `Production erase source "${entry.from}" was replaced before rollback. The quarantined original was left untouched.`,
              );
            this.mkdirOwned(path.dirname(entry.from));
            fileSystem.renameSync(entry.to, entry.from);
            assertResidentEntry(entry.from, entry.identity);
          } catch (rollbackError) {
            rollbackErrors.push(rollbackError);
          }
        if (auditIdentity !== null)
          try {
            assertEraseFence();
            assertResidentEntry(auditPath, auditIdentity);
            fileSystem.rmSync(auditPath);
          } catch (rollbackError) {
            rollbackErrors.push(rollbackError);
          }
        if (rollbackErrors.length !== 0)
          throw new AggregateError(
            [error, ...rollbackErrors],
            "Production erase failed and identity-fenced rollback was incomplete. Restore only the listed quarantined originals before retrying.",
          );
        throw error;
      }
    } finally {
      try {
        if (token !== null) {
          const state = physicalDirectoryIdentityOrNull(
            this.productionStateRoot,
          );
          if (
            productionStateIdentity !== null &&
            state !== null &&
            directoryIdentityKey(state) === productionStateIdentity
          )
            releaseCommitLock(this.lockPath, token);
          else releaseCommitLock(this.lockPath, token, { unlink: false });
        }
        if (committedErase.fence !== null) {
          assertPhysicalDirectoryAncestry(committedErase.fence.quarantine);
          for (const entry of moved)
            assertResidentEntry(entry.to, entry.identity);
          assertResidentEntry(
            this.productionStateRoot,
            committedErase.fence.state,
          );
          const stateDestination = path.join(quarantine, "state");
          fileSystem.renameSync(this.productionStateRoot, stateDestination);
          assertResidentEntry(stateDestination, committedErase.fence.state);
          fileSystem.rmSync(quarantine, { force: true, recursive: true });
        } else if (registryPublished === false && quarantineAncestry !== null)
          try {
            assertPhysicalDirectoryAncestry(quarantineAncestry);
            if (fileSystem.readdirSync(quarantine).length === 0)
              fileSystem.rmdirSync(quarantine);
          } catch {
            // A replacement quarantine is not ours to inspect or remove.
          }
      } finally {
        releaseProductionRootNamespace(lease);
      }
    }
    return {
      erased,
      productionId: this.productionId,
      remaining,
    };
  }

  /**
   * Resolve and read one coding-agent-owned source module.
   */
  public readSource(relativePath: string): Uint8Array {
    const file = this.resolveSourcePath(relativePath);
    if (fileSystem.existsSync(file) === false)
      throw new AutoMovieProductionSourcePathError(
        "missing",
        `Source "${relativePath}" does not exist. Create it under a configured source root before compilation.`,
      );
    const real = fileSystem.realpathSync(file);
    if (this.isInSourceRoot(real) === false)
      throw new AutoMovieProductionSourcePathError(
        "outside-root",
        `Source "${relativePath}" escapes its configured source root through a symlink. Move it inside a source root.`,
      );
    return readAutoMovieProductionOwnedFile({
      root: this.rootReal,
      directory: path.dirname(real),
      relative: path.basename(real),
    });
  }

  /**
   * Resolve a project-relative source path and enforce source-root ownership.
   */
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

  /**
   * Load the generated ownership manifest if one exists.
   */
  public generatedManifest(): IAutoMovieGeneratedManifest | null {
    this.refreshRevision();
    return this.loadGeneratedManifest();
  }

  private loadGeneratedManifest(): IAutoMovieGeneratedManifest | null {
    this.assertProjectRootIdentity();
    return readOwnedTypedJson(
      ownedRootReal(this.rootReal, this.automovieRoot),
      path.join(this.productionStateRoot, "generated-manifest.json"),
      validateGeneratedManifest,
    );
  }

  /**
   * Read one active-production state file without following an escaping link.
   */
  public readTrackedStateFile(relativePath: string): Uint8Array | null {
    this.assertIncarnation();
    const file = this.trackedStatePath(relativePath);
    if (lstatOrNull(file) === null) return null;
    const root = ownedRootReal(this.rootReal, this.productionStateRoot);
    assertOwnedRegularFile(root, file);
    return readAutoMovieProductionOwnedFile({
      root,
      directory: root,
      relative: path.relative(root, file),
    });
  }

  /**
   * Absolute path of one active-production tracked state record.
   */
  public trackedStatePath(relativePath: string): string {
    this.assertIncarnation();
    return resolveInside(this.productionStateRoot, relativePath);
  }

  /**
   * Project-relative path of the generated root.
   */
  public generatedRoot(): string {
    this.assertIncarnation();
    return resolveInside(
      this.resolveOwnedDirectory(this.manifest_.generatedRoot),
      this.productionSegment,
    );
  }

  /**
   * Read one compiler-owned file without following an escaping link.
   */
  public readGeneratedFile(relativePath: string): Uint8Array {
    const root = this.generatedRoot();
    const file = resolveInside(root, relativePath);
    const linked = lstatOrNull(file);
    if (linked === null)
      throw new Error(`Generated file "${relativePath}" does not exist.`);
    if (linked.isSymbolicLink())
      throw new Error(
        `Generated file "${relativePath}" is a symlink or junction. Remove that link before compilation.`,
      );
    const real = fileSystem.realpathSync(file);
    if (isInside(fileSystem.realpathSync(root), real) === false)
      throw new Error(
        `Generated file "${relativePath}" escapes the compiler-owned root through a symlink or junction. Remove that link before compilation.`,
      );
    if (linked.isFile() === false)
      throw new Error(`Generated path "${relativePath}" is not a file.`);
    return readAutoMovieProductionOwnedFile({
      root,
      directory: root,
      relative: relativePath,
    });
  }

  /**
   * Read one author-owned text file a compiler-owned record addresses.
   *
   * Named for its first caller and used by more than one: the screenplay index
   * addresses prose documents, and a shot contract addresses the module that
   * builds it, both of which the compiler reads without owning. The path comes
   * from a record an author edits and is treated as untrusted: it must resolve inside the project and must not be reached
   * through a link, exactly as a compiler-owned read is. An absent document
   * returns `null` rather than throwing, because the screenplay checks report a
   * missing document as their own diagnostic and would otherwise turn one
   * authoring mistake into a crash.
   */
  public readProseDocument(relativePath: string): string | null {
    this.assertIncarnation();
    let file: string;
    try {
      file = resolveInside(this.root, relativePath);
    } catch {
      return null;
    }
    const linked = lstatOrNull(file);
    if (linked === null || linked.isFile() === false) return null;
    if (isInside(this.rootReal, fileSystem.realpathSync(file)) === false)
      return null;
    return Buffer.from(
      readAutoMovieProductionOwnedFile({
        root: this.rootReal,
        directory: path.dirname(file),
        relative: path.basename(file),
      }),
    ).toString("utf8");
  }

  /**
   * Project-relative path of the render root.
   */
  public renderRoot(): string {
    this.assertIncarnation();
    return resolveInside(
      this.resolveOwnedDirectory(this.manifest_.renderRoot),
      this.productionSegment,
    );
  }

  /**
   * Read one render-owned regular file without following a link.
   */
  public readRenderFile(relativePath: string): Uint8Array {
    const root = this.renderRoot();
    const file = resolveInside(root, relativePath);
    const ancestry = acquirePhysicalDirectoryAncestry(root, path.dirname(file));
    const linked = lstatOrNull(file);
    if (linked === null)
      throw new Error(`Render file "${relativePath}" does not exist.`);
    if (linked.isSymbolicLink() || linked.isFile() === false)
      throw new Error(
        `Render file "${relativePath}" is not a regular file. Replace the link or directory with renderer-owned bytes.`,
      );
    let descriptor: number;
    try {
      descriptor = fileSystem.openSync(file, "r");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT")
        throw new Error(`Render file "${relativePath}" does not exist.`);
      throw error;
    }
    let failure: IRenderFileDescriptorFailure | undefined;
    let bytes: Uint8Array | undefined;
    try {
      const opened = fileSystem.fstatSync(descriptor, { bigint: true });
      const assertResidentFile = (): void => {
        assertPhysicalDirectoryAncestry(ancestry);
        const currentLink = fileSystem.lstatSync(file);
        if (currentLink.isSymbolicLink() || currentLink.isFile() === false)
          throw new Error(
            `Render file "${relativePath}" changed into a link or non-file while it was read.`,
          );
        const real = fileSystem.realpathSync(file);
        const residentDescriptor = fileSystem.openSync(real, "r");
        let residentFailure: IRenderFileDescriptorFailure | undefined;
        try {
          const resident = fileSystem.fstatSync(residentDescriptor, {
            bigint: true,
          });
          if (fileIdentityKey(resident) !== fileIdentityKey(opened))
            throw new Error(
              `Render file "${relativePath}" changed physical identity inside the render root. Re-render it inside the owned output root.`,
            );
        } catch (error) {
          residentFailure = { error };
          throw error;
        } finally {
          closeRenderFileDescriptor(
            residentDescriptor,
            residentFailure,
            relativePath,
          );
        }
      };
      assertResidentFile();
      bytes = fileSystem.readFileSync(descriptor);
      assertResidentFile();
    } catch (error) {
      failure = { error };
    }
    closeRenderFileDescriptor(descriptor, failure, relativePath);
    if (failure !== undefined) throw failure.error;
    return bytes!;
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
    const bundleEntry = (relativePath: string) => {
      const normalized = normalizeSlash(relativePath);
      const target = resolveInside(bundleRoot, relativePath);
      const relative = normalizeSlash(path.relative(bundleRoot, target));
      if (relative.length === 0 || normalized !== relative)
        throw new Error(
          `Render bundle path "${relativePath}" is not one canonical bundle-relative identity.`,
        );
      return { key: relative.toLowerCase(), relative, target };
    };
    const supplied = new Map<
      string,
      { bytes: Buffer; relative: string; target: string }
    >();
    for (const [relativePath, bytes] of files) {
      const entry = bundleEntry(relativePath);
      if (supplied.has(entry.key))
        throw new Error(
          `Render bundle repeats portable path "${relativePath}".`,
        );
      supplied.set(entry.key, { ...entry, bytes: Buffer.from(bytes) });
    }
    const payloadPaths = new Set<string>();
    const retainedPaths: string[] = [];
    const expectedPayload: IProductionPayloadSnapshot = { entries: [] };
    for (const frame of manifest.frames) {
      const entry = bundleEntry(frame.path);
      if (payloadPaths.has(entry.key))
        throw new Error(`Render bundle repeats frame path "${frame.path}".`);
      payloadPaths.add(entry.key);
      const relative = normalizeSlash(
        path.relative(this.renderRoot(), entry.target),
      );
      const staged = supplied.get(entry.key)?.bytes;
      if (staged !== undefined) {
        if (digestAutoMovieBytes(staged) !== frame.digest)
          throw new Error(
            `Supplied render frame "${frame.path}" differs from its manifest digest.`,
          );
      } else retainedPaths.push(relative);
      expectedPayload.entries.push({
        path: relative,
        digest: frame.digest,
        bytes: staged?.length ?? this.readRenderFile(relative).length,
      });
    }
    const semanticKeys = new Set<string>();
    for (const semantic of manifest.semanticMasks) {
      const semanticKey = `${semantic.frame}\0${semantic.pass}`;
      if (
        semanticKeys.has(semanticKey) ||
        manifest.target.kind !== "shot" ||
        semantic.shot !== manifest.target.id ||
        manifest.frames.some(
          (frame) =>
            frame.index === semantic.frame && frame.pass === semantic.pass,
        ) === false
      )
        throw new Error(
          `Render bundle semantic receipt for frame ${semantic.frame} is duplicate, foreign, or has no mask frame.`,
        );
      semanticKeys.add(semanticKey);
      const entry = bundleEntry(semantic.sidecar.path);
      if (payloadPaths.has(entry.key))
        throw new Error(
          `Render bundle repeats semantic sidecar path "${semantic.sidecar.path}".`,
        );
      payloadPaths.add(entry.key);
      const relative = normalizeSlash(
        path.relative(this.renderRoot(), entry.target),
      );
      const staged = supplied.get(entry.key)?.bytes;
      const bytes = staged ?? Buffer.from(this.readRenderFile(relative));
      verifyAutoMovieProductionSemanticMaskReceipt({
        receipt: semantic,
        expectedFrame: semantic.frame,
        expectedShot: semantic.shot,
        evidence: {
          version: 1,
          shot: semantic.shot,
          mask: JSON.parse(bytes.toString("utf8")) as IAutoMovieSemanticMask,
          coverage: semantic.coverage,
        },
        resident: { path: semantic.sidecar.path, bytes },
      });
      if (staged === undefined) retainedPaths.push(relative);
      expectedPayload.entries.push({
        path: relative,
        digest: semantic.sidecar.digest,
        bytes: semantic.sidecar.bytes,
      });
    }
    if (
      manifest.target.kind === "shot" &&
      manifest.frames.some(
        (frame) =>
          frame.pass === "mask" &&
          semanticKeys.has(`${frame.index}\0${frame.pass}`) === false,
      )
    )
      throw new Error(
        "Render bundle mask frames require one current semantic sidecar each.",
      );
    if (
      [...supplied.keys()].some(
        (relative) => payloadPaths.has(relative) === false,
      )
    )
      throw new Error(
        "Render bundle supplied a payload that its manifest does not claim.",
      );
    const retainedSnapshot = captureProductionPayloadSnapshot({
      paths: retainedPaths,
      read: (relative) => {
        try {
          return this.readRenderFile(relative);
        } catch {
          return null;
        }
      },
    });
    const payloadCurrent = (snapshot: IProductionPayloadSnapshot): boolean =>
      isProductionPayloadSnapshotCurrent({
        snapshot,
        read: (relative) => {
          try {
            return this.readRenderFile(relative);
          } catch {
            return null;
          }
        },
      });
    const writes: IStagedFile[] = [...supplied.values()].map((entry) => ({
      path: entry.target,
      content: entry.bytes,
    }));
    const serializedManifest = serializeJson(manifest);
    writes.push({
      path: path.join(bundleRoot, "manifest.json"),
      content: serializedManifest,
    });
    const serializedReceipt = serializeJson({
      version: 1,
      bundle: normalizedBundle,
      manifestDigest: digestAutoMovieBytes(
        Buffer.from(serializedManifest, "utf8"),
      ),
    } satisfies IAutoMovieRenderBundleReceipt);
    writes.push({
      path: this.renderReceiptPath(normalizedBundle),
      content: serializedReceipt,
    });
    return this.commitFiles(
      writes,
      () => payloadCurrent(retainedSnapshot) && inputCurrent?.() !== false,
      this.lastReadRevision_,
      () => {
        if (payloadCurrent(expectedPayload) === false)
          throw new AutoMovieProductionInputRaceError(
            "Render bundle payload changed while its manifest and receipt were committed.",
          );
        const residentManifest = this.readRenderFile(
          `${normalizedBundle}/manifest.json`,
        );
        const residentReceipt = this.readTrackedStateFile(
          relativeToRoot(
            this.productionStateRoot,
            this.renderReceiptPath(normalizedBundle),
          ),
        );
        if (
          Buffer.from(residentManifest).equals(
            Buffer.from(serializedManifest, "utf8"),
          ) === false ||
          residentReceipt === null ||
          Buffer.from(residentReceipt).equals(
            Buffer.from(serializedReceipt, "utf8"),
          ) === false
        )
          throw new AutoMovieProductionInputRaceError(
            "Render bundle manifest or receipt changed before revision commit.",
          );
      },
    );
  }

  /** Atomically reserve one exact next repaint attempt before provider dispatch. */
  public acquireRepaintAttemptClaim(
    claim: IAutoMovieRepaintAttemptClaim,
  ): AutoMovieRepaintClaimAdmission {
    assertAutoMovieRepaintAttemptClaim(claim);
    const claimPath = repaintAttemptClaimPath(claim.requestId);
    let admission: AutoMovieRepaintClaimAdmission = {
      status: "prefix-changed",
    };
    this.commitFiles(
      () => {
        const attempts = this.repaintRequestAttempts(claim.requestId);
        const prefixDigest = digestAutoMovieBytes(
          canonicalAutoMovieJsonBytes(attempts),
        );
        const resident = this.readTrackedStateFile(claimPath);
        const current =
          resident === null
            ? null
            : typia.validateEquals<IAutoMovieStoredRepaintAttemptClaim>(
                JSON.parse(Buffer.from(resident).toString("utf8")),
              );
        if (current !== null && current.success === false)
          throw new Error("Stored repaint attempt claim is malformed.");
        if (
          claim.productionId !== this.productionId ||
          claim.prefixDigest !== prefixDigest ||
          claim.attemptOrdinal !== attempts.length + 1
        ) {
          admission = { status: "prefix-changed" };
          return [];
        }
        if (current !== null && current.data.settlement === null) {
          admission = {
            status: "already-active",
            ownerAttemptId: current.data.claim.attemptId,
          };
          return [];
        }
        if (current !== null && current.data.settlement === "unknown-outcome") {
          admission = {
            status: "unknown-outcome",
            ownerAttemptId: current.data.claim.attemptId,
          };
          return [];
        }
        if (
          current !== null &&
          (claim.generation !== current.data.claim.generation + 1 ||
            claim.requestFingerprint !==
              current.data.claim.requestFingerprint ||
            claim.shot !== current.data.claim.shot)
        ) {
          admission = { status: "prefix-changed" };
          return [];
        }
        admission = { status: "acquired" };
        return [
          {
            path: path.join(this.productionStateRoot, ...claimPath.split("/")),
            content: serializeJson({
              claim: structuredClone(claim),
              settlement: null,
            } satisfies IAutoMovieStoredRepaintAttemptClaim),
          },
        ];
      },
      undefined,
      this.lastReadRevision_,
      undefined,
      false,
    );
    return admission;
  }

  /** Settle only the exact claim that owns the just-journaled attempt. */
  public settleRepaintAttemptClaim(
    claim: IAutoMovieRepaintAttemptClaim,
    settlement: AutoMovieRepaintClaimSettlement,
  ): number {
    assertAutoMovieRepaintAttemptClaim(claim);
    const claimPath = repaintAttemptClaimPath(claim.requestId);
    return this.commitFiles(() => {
      const resident = this.readTrackedStateFile(claimPath);
      if (resident === null)
        throw new Error("Repaint attempt claim disappeared before settlement.");
      const current = typia.validateEquals<IAutoMovieStoredRepaintAttemptClaim>(
        JSON.parse(Buffer.from(resident).toString("utf8")),
      );
      if (
        current.success === false ||
        canonicalizeAutoMovieJson(current.data.claim) !==
          canonicalizeAutoMovieJson(claim) ||
        (current.data.settlement !== null &&
          current.data.settlement !== settlement)
      )
        throw new Error("Repaint attempt claim settlement lost ownership.");
      return [
        {
          path: path.join(this.productionStateRoot, ...claimPath.split("/")),
          content: serializeJson({
            claim: current.data.claim,
            settlement,
          } satisfies IAutoMovieStoredRepaintAttemptClaim),
        },
      ];
    });
  }

  /** Persist one immutable terminal repaint attempt without changing selection. */
  public commitRepaintAttempt(
    attempt: IAutoMovieRepaintAttemptRecord,
    inputCurrent?: () => boolean,
  ): number {
    this.assertRepaintAttempt(attempt);
    if (attempt.availableOutput?.receipt !== undefined) {
      const raw = this.repaintRawOutput(attempt.requestId, attempt.attemptId);
      if (
        raw.receipt.digest !== attempt.availableOutput.digest ||
        raw.receipt.bytes !== attempt.availableOutput.bytes
      )
        throw new Error(
          `Repaint attempt "${attempt.attemptId}" does not cite its exact resident raw output revision.`,
        );
    }
    const relative = repaintAttemptPath(attempt.requestId, attempt.attemptId);
    if (this.readTrackedStateFile(relative) !== null)
      throw new Error(`Repaint attempt "${attempt.attemptId}" already exists.`);
    const priorAttempts = this.repaintRequestAttempts(attempt.requestId);
    const previous = priorAttempts.at(-1);
    if (
      attempt.ordinal !== priorAttempts.length + 1 ||
      (previous !== undefined &&
        (previous.status !== "failed" ||
          previous.failure?.retryable !== true ||
          attempt.shot !== previous.shot ||
          attempt.requestFingerprint !== previous.requestFingerprint ||
          attempt.compileFingerprint !== previous.compileFingerprint ||
          attempt.sourceRenderFingerprint !==
            previous.sourceRenderFingerprint ||
          attempt.adapterIdentity !== previous.adapterIdentity ||
          attempt.seed !== previous.seed ||
          new Date(attempt.startedAt).getTime() <
            new Date(previous.completedAt).getTime()))
    )
      throw new Error(
        `Repaint attempt "${attempt.attemptId}" is not the next chronological terminal state of its immutable request.`,
      );
    const priorIdentity = canonicalizeAutoMovieJson(priorAttempts);
    const nextIdentity = canonicalizeAutoMovieJson([...priorAttempts, attempt]);
    return this.commitFiles(
      [
        {
          path: path.join(this.productionStateRoot, ...relative.split("/")),
          content: serializeJson(attempt),
        },
      ],
      () => {
        if ((inputCurrent?.() ?? true) === false) return false;
        try {
          const current = canonicalizeAutoMovieJson(
            this.repaintRequestAttempts(attempt.requestId),
          );
          return current === priorIdentity || current === nextIdentity;
        } catch {
          return false;
        }
      },
    );
  }

  /** Persist raw provider bytes and their receipt before terminal journaling. */
  public commitRepaintRawOutput(
    publication: IAutoMovieRepaintRawOutputPublication,
    inputCurrent?: () => boolean,
  ): number {
    assertAutoMovieRepaintRawOutput({
      receipt: publication.receipt,
      bytes: publication.bytes,
      requestId: publication.receipt.requestId,
      attemptId: publication.receipt.attemptId,
    });
    if (publication.receipt.productionId !== this.productionId)
      throw new Error("Repaint raw output belongs to another production.");
    const receiptPath = productionRepaintRawOutputReceiptPath(
      publication.receipt.requestId,
      publication.receipt.attemptId,
    );
    return this.commitFiles(
      [
        {
          path: path.join(
            this.renderRoot(),
            ...publication.receipt.path.split("/"),
          ),
          content: publication.bytes,
        },
        {
          path: path.join(this.productionStateRoot, ...receiptPath.split("/")),
          content: serializeJson(publication.receipt),
        },
      ],
      () =>
        (inputCurrent?.() ?? true) &&
        this.readTrackedStateFile(receiptPath) === null,
    );
  }

  /** Read and verify one exact raw attempt revision for candidate recovery. */
  public repaintRawOutput(
    requestId: string,
    attemptId: string,
  ): IAutoMovieRepaintRawOutputPublication {
    const receiptPath = productionRepaintRawOutputReceiptPath(
      requestId,
      attemptId,
    );
    const resident = this.readTrackedStateFile(receiptPath);
    if (resident === null)
      throw new Error(`Repaint raw output receipt "${receiptPath}" is absent.`);
    const decoded = typia.validateEquals<IAutoMovieRepaintRawOutputReceipt>(
      JSON.parse(Buffer.from(resident).toString("utf8")),
    );
    if (decoded.success === false)
      throw new Error(
        `Repaint raw output receipt "${receiptPath}" is malformed.`,
      );
    const bytes = this.readRenderFile(decoded.data.path);
    assertAutoMovieRepaintRawOutput({
      receipt: decoded.data,
      bytes,
      requestId,
      attemptId,
    });
    return { receipt: decoded.data, bytes };
  }

  /** Read every immutable terminal attempt belonging to one request. */
  public repaintRequestAttempts(
    requestId: string,
  ): IAutoMovieRepaintAttemptRecord[] {
    const request = uuid(requestId, "Repaint request id");
    const directory = path.join(
      this.productionStateRoot,
      "renditions",
      "attempts",
      request,
    );
    if (lstatOrNull(directory) === null) return [];
    if (fileSystem.lstatSync(directory).isSymbolicLink())
      throw new Error("Repaint attempt directory must not be a link.");
    const attempts = fileSystem
      .readdirSync(directory, { withFileTypes: true })
      .filter((entry) => entry.name.endsWith(".json"))
      .sort((left, right) => compareCodeUnits(left.name, right.name))
      .map((entry): IAutoMovieRepaintAttemptRecord => {
        if (entry.isFile() === false)
          throw new Error(
            `Repaint attempt resident "${entry.name}" must be a regular JSON file.`,
          );
        const relative = `renditions/attempts/${request}/${entry.name}`;
        let decoded: IAutoMovieRepaintAttemptRecord;
        try {
          const bytes = this.readTrackedStateFile(relative);
          if (bytes === null)
            throw new Error("the resident disappeared while being read");
          decoded = JSON.parse(
            Buffer.from(bytes).toString("utf8"),
          ) as IAutoMovieRepaintAttemptRecord;
          this.assertRepaintAttempt(decoded);
        } catch (error) {
          throw new Error(
            `Repaint attempt resident "${entry.name}" is malformed: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
        if (
          decoded.requestId !== request ||
          relative !== repaintAttemptPath(decoded.requestId, decoded.attemptId)
        )
          throw new Error(
            `Repaint attempt resident "${entry.name}" does not match its canonical request and attempt identity.`,
          );
        return decoded;
      })
      .sort(
        (left, right) =>
          left.ordinal - right.ordinal ||
          compareCodeUnits(left.attemptId, right.attemptId),
      );
    for (const [index, attempt] of attempts.entries()) {
      const previous = attempts[index - 1];
      if (
        attempt.ordinal !== index + 1 ||
        (previous !== undefined &&
          (previous.status !== "failed" ||
            previous.failure?.retryable !== true ||
            attempt.shot !== previous.shot ||
            attempt.requestFingerprint !== previous.requestFingerprint ||
            attempt.compileFingerprint !== previous.compileFingerprint ||
            attempt.sourceRenderFingerprint !==
              previous.sourceRenderFingerprint ||
            attempt.adapterIdentity !== previous.adapterIdentity ||
            attempt.seed !== previous.seed ||
            new Date(attempt.startedAt).getTime() <
              new Date(previous.completedAt).getTime()))
      )
        throw new Error(
          `Repaint request "${request}" requires contiguous chronological attempts whose preceding terminal state remained retryable under one immutable request identity.`,
        );
    }
    return attempts;
  }

  /**
   * Atomically commit one parsed repaint candidate and immutable receipt after
   * its matching succeeded terminal attempt is resident.
   *
   * The active pointer is deliberately untouched. A candidate becomes current
   * only through `selectRepaintCandidate` after review.
   */
  public commitRepaintRendition(
    receipt: IAutoMovieRepaintReceipt,
    bytes: Uint8Array,
    inputCurrent?: () => boolean,
  ): number {
    const validation = typia.validateEquals<IAutoMovieRepaintReceipt>(receipt);
    if (validation.success === false)
      throw new Error("Repaint receipt does not match its strict v4 schema.");
    this.assertCurrentRepaintReceipt(receipt, bytes);
    const output = resolveInside(this.renderRoot(), receipt.output.path);
    const tracked = path.join(
      this.productionStateRoot,
      ...productionRepaintReceiptPath(receipt.output.path).split("/"),
    );
    return this.commitFiles(
      [
        { path: output, content: bytes },
        { path: tracked, content: serializeJson(receipt) },
      ],
      inputCurrent,
    );
  }

  /**
   * Select or reverse to one stored current candidate in a guarded transaction.
   *
   * @evidence requirements/repaint/retries-seeds-and-variation.md#repaint-one-accepted-lineage Selects one succeeded attempt through an immutable selection or reversal record and one active pointer.
   * @evidence requirements/repaint/sequence-continuity-and-publication.md#repaint-continuity-baseline-changes Binds the selection to an exact continuity baseline and refuses an unreviewed baseline change.
   * @evidence requirements/repaint/sequence-continuity-and-publication.md#repaint-publication-gate Publishes an active rendition pointer only after structural, continuity, and temporal checks pass in the same guarded transaction.
   * @evidence requirements/repaint/sequence-continuity-and-publication.md#repaint-temporal-artifacts Requires hold, flicker, boil, edge-crawl, and transition-boundary playback verdicts before selection.
   * @evidence specifications/asset-and-representation/generated-assets-and-repaint-handoff.md#asset-spec-repaint-structure-continuity Validates structural review, continuity baseline, playback evidence, and all temporal verdicts before one rendition becomes current.
   */
  public selectRepaintCandidate(props: {
    shot: string;
    attemptId: string;
    kind: "selection" | "reversal";
    reason: string;
    structuralReview: string;
    continuityReview: IAutoMovieRepaintSelectionRecord["continuityReview"];
    selectedAt: string;
    inputCurrent?: () => boolean;
  }): IAutoMovieRepaintReceipt {
    const candidateInspection = this.inspectVerifiedRepaintCandidates([
      props.shot,
    ]);
    const candidates = candidateInspection.records.map(
      (record) => record.value,
    );
    const receipt = candidates.find(
      (candidate) => candidate.attemptId === props.attemptId,
    );
    if (receipt === undefined && candidateInspection.findings.length !== 0)
      throw new Error(
        `Repaint candidate inspection refused: ${candidateInspection.findings
          .map(
            (finding) =>
              `${finding.target.recordId}:${finding.stage}:${finding.failure}`,
          )
          .join(", ")}.`,
      );
    if (receipt === undefined)
      throw new Error(
        `Repaint candidate "${props.attemptId}" is absent, invalid, or stale for shot "${props.shot}".`,
      );
    const selectedAt = new Date(props.selectedAt);
    if (
      Number.isNaN(selectedAt.getTime()) ||
      selectedAt.toISOString() !== props.selectedAt
    )
      throw new Error("Repaint selection requires an exact UTC instant.");
    if (selectedAt.getTime() < new Date(receipt.completedAt!).getTime())
      throw new Error(
        "Repaint selection cannot precede the candidate completion instant.",
      );
    assertAutoMovieExternalGeneratorTermsAt({
      termsCheckedAt: receipt.generatorProvenance.termsCheckedAt,
      occurredAt: selectedAt,
      label: "repaint selection generator provenance",
    });
    assertAutoMovieRepaintExecutionPolicy(receipt.executionPolicy!);
    const reason = trimmedText(props.reason, "Repaint selection reason");
    const structuralReview = trimmedText(
      props.structuralReview,
      "Repaint structural review evidence",
    );
    const continuityReview = props.continuityReview;
    if (continuityReview !== null) {
      trimmedText(continuityReview.baseline, "Repaint continuity baseline");
      trimmedText(
        continuityReview.playbackEvidence,
        "Repaint sequence playback evidence",
      );
      if (continuityReview.mixedDeliveryPolicy !== null)
        trimmedText(
          continuityReview.mixedDeliveryPolicy,
          "Repaint mixed-delivery transition policy",
        );
      if (
        continuityReview.flicker !== "pass" ||
        continuityReview.identityDrift !== "pass" ||
        continuityReview.geometryWarp !== "pass" ||
        continuityReview.textureCrawl !== "pass" ||
        continuityReview.transitionMismatch !== "pass"
      )
        throw new Error(
          "Repaint continuity selection requires passing flicker, identity drift, geometry warp, texture crawl, and transition mismatch observations.",
        );
    }
    if (
      receipt.evidence!.continuity === null
        ? continuityReview !== null
        : continuityReview === null ||
          continuityReview.baseline !== receipt.evidence!.continuity
    )
      throw new Error(
        "Repaint continuity selection must match the candidate continuity evidence exactly.",
      );
    const activePath = productionRepaintActiveReceiptPath(props.shot);
    const activeInspection = this.inspectVerifiedRepaintRenditions([
      props.shot,
    ]);
    const activeFailures = activeInspection.findings.filter(
      (finding) => finding.failure !== "absent",
    );
    if (activeFailures.length !== 0)
      throw new Error(
        `Current repaint selection inspection refused: ${activeFailures
          .map((finding) => `${finding.stage}:${finding.failure}`)
          .join(", ")}.`,
      );
    const verifiedActive = activeInspection.records[0]?.value;
    const activeBytes = this.readTrackedStateFile(activePath);
    let previousSelection: string | null = null;
    let previousCandidate: IAutoMovieRepaintReceipt | undefined;
    if (activeBytes !== null) {
      const previous = typia.validateEquals<IAutoMovieActiveRepaintReceipt>(
        JSON.parse(Buffer.from(activeBytes).toString("utf8")),
      );
      if (previous.success === false || previous.data.shot !== props.shot)
        throw new Error("Current repaint selection pointer is malformed.");
      previousSelection = previous.data.selection;
      previousCandidate = candidates.find(
        (candidate) =>
          productionRepaintReceiptPath(candidate.output.path) ===
            previous.data.receipt &&
          candidate.output.path === previous.data.output,
      );
      if (
        previousCandidate === undefined ||
        verifiedActive?.attemptId !== previousCandidate.attemptId
      )
        throw new Error(
          "Current repaint selection pointer does not name an active verified selection.",
        );
    }
    if (props.kind === "reversal") {
      if (previousSelection === null || previousCandidate === undefined)
        throw new Error(
          "Repaint reversal requires an existing active verified selection.",
        );
      if (
        new Date(receipt.completedAt!).getTime() >=
        new Date(previousCandidate.completedAt!).getTime()
      )
        throw new Error(
          "Repaint reversal requires a candidate completed before the current active candidate.",
        );
    } else if (
      previousCandidate !== undefined &&
      new Date(receipt.completedAt!).getTime() <=
        new Date(previousCandidate.completedAt!).getTime()
    )
      throw new Error(
        "Repaint selection requires a candidate completed after the current active candidate; use reversal for an older candidate.",
      );
    const selectionId = randomUUID();
    const selectionPath = repaintSelectionPath(props.shot, selectionId);
    const candidateReceipt = productionRepaintReceiptPath(receipt.output.path);
    const selection: IAutoMovieRepaintSelectionRecord = {
      version: 1,
      selectionId,
      kind: props.kind,
      productionId: this.productionId,
      shot: props.shot,
      requestId: receipt.requestId!,
      attemptId: receipt.attemptId,
      selectedAt: props.selectedAt,
      candidateReceipt,
      output: receipt.output.path,
      previousSelection,
      reason,
      structuralReview,
      continuityReview: structuredClone(continuityReview),
    };
    const pointer: IAutoMovieActiveRepaintReceipt = {
      version: 2,
      shot: props.shot,
      selection: selectionPath,
      receipt: candidateReceipt,
      output: receipt.output.path,
    };
    const previousIdentity = activeBytes?.toString() ?? null;
    const nextIdentity = serializeJson(pointer);
    const candidateIdentity = canonicalizeAutoMovieJson(receipt);
    const previousCandidateIdentity =
      previousCandidate === undefined
        ? null
        : canonicalizeAutoMovieJson(previousCandidate);
    this.commitFiles(
      [
        {
          path: path.join(
            this.productionStateRoot,
            ...selectionPath.split("/"),
          ),
          content: serializeJson(selection),
        },
        {
          path: path.join(this.productionStateRoot, ...activePath.split("/")),
          content: nextIdentity,
        },
      ],
      () => {
        if ((props.inputCurrent?.() ?? true) === false) return false;
        const currentCandidate = this.verifiedRepaintCandidates([
          props.shot,
        ]).find((candidate) => candidate.attemptId === props.attemptId);
        const activeIdentity =
          this.readTrackedStateFile(activePath)?.toString() ?? null;
        const currentActive = this.verifiedRepaintRenditions([props.shot])[0];
        const activeLineageCurrent =
          activeIdentity === null
            ? previousIdentity === null && currentActive === undefined
            : activeIdentity === previousIdentity
              ? currentActive !== undefined &&
                previousCandidateIdentity !== null &&
                canonicalizeAutoMovieJson(currentActive) ===
                  previousCandidateIdentity
              : activeIdentity === nextIdentity &&
                currentActive !== undefined &&
                canonicalizeAutoMovieJson(currentActive) === candidateIdentity;
        return (
          currentCandidate !== undefined &&
          canonicalizeAutoMovieJson(currentCandidate) === candidateIdentity &&
          activeLineageCurrent
        );
      },
    );
    return receipt;
  }

  /** Re-read every immutable current candidate without consulting selection. */
  public verifiedRepaintCandidates(
    shots?: readonly string[],
  ): IAutoMovieRepaintReceipt[] {
    return this.inspectVerifiedRepaintCandidates(shots).records.map(
      (record) => record.value,
    );
  }

  /** Inspect every candidate while preserving valid siblings and failures. */
  public inspectVerifiedRepaintCandidates(
    shots?: readonly string[],
  ): IAutoMovieRepaintRecordInspection<IAutoMovieRepaintReceipt> {
    this.refreshRevision();
    const selectedShots = shots === undefined ? null : new Set(shots);
    const directory = path.join(this.productionStateRoot, "renditions");
    const records: IAutoMovieRepaintRecordInspection<IAutoMovieRepaintReceipt>["records"] =
      [];
    const findings: IAutoMovieRepaintRecordFinding[] = [];
    const unresolvedShot = "unresolved";
    const enumerationTarget = {
      kind: "candidate" as const,
      shot: unresolvedShot,
      recordId: "renditions",
    };
    const directoryState = lstatOrNull(directory);
    if (directoryState === null) return { records, findings };
    if (directoryState.isSymbolicLink())
      return {
        records,
        findings: [
          {
            target: enumerationTarget,
            stage: "enumeration",
            failure: "unsafe-locator",
            recovery:
              "Replace linked or escaping state with an owned tracked record.",
          },
        ],
      };
    let entries: Dirent[];
    try {
      entries = fileSystem
        .readdirSync(directory, { withFileTypes: true })
        .sort((left, right) => compareCodeUnits(left.name, right.name));
    } catch {
      return {
        records,
        findings: [
          {
            target: enumerationTarget,
            stage: "enumeration",
            failure: "unavailable",
            recovery:
              "Restore access to the tracked repaint state, then inspect it again.",
          },
        ],
      };
    }
    for (const entry of entries) {
      if (entry.name.endsWith(".json") === false) continue;
      let target = {
        kind: "candidate" as const,
        shot: unresolvedShot,
        recordId: entry.name.slice(0, -".json".length),
      };
      if (entry.isSymbolicLink() || entry.isFile() === false) {
        findings.push({
          target,
          stage: "receipt",
          failure: "unsafe-locator",
          recovery:
            "Replace linked or escaping state with an owned tracked record.",
        });
        continue;
      }
      try {
        const receiptPath = `renditions/${entry.name}`;
        const bytes = this.readTrackedStateFile(receiptPath);
        if (bytes === null) {
          findings.push({
            target,
            stage: "receipt",
            failure: "absent",
            recovery:
              "Create or restore the requested candidate record, then inspect it again.",
          });
          continue;
        }
        let decoded: unknown;
        try {
          decoded = JSON.parse(Buffer.from(bytes).toString("utf8"));
        } catch {
          findings.push({
            target,
            stage: "receipt",
            failure: "schema-invalid",
            recovery:
              "Replace the record with one matching the current schema.",
          });
          continue;
        }
        const validation =
          typia.validateEquals<IAutoMovieRepaintReceipt>(decoded);
        if (validation.success === false) {
          findings.push({
            target,
            stage: "receipt",
            failure: "schema-invalid",
            recovery:
              "Replace the record with one matching the current schema.",
          });
          continue;
        }
        const receipt = validation.data;
        if (selectedShots !== null && selectedShots.has(receipt.shot) === false)
          continue;
        target = { ...target, shot: receipt.shot };
        if (receiptPath !== productionRepaintReceiptPath(receipt.output.path)) {
          findings.push({
            target,
            stage: "receipt",
            failure: "identity-invalid",
            recovery: "Restore the record at its canonical identity.",
          });
          continue;
        }
        let output: Uint8Array;
        try {
          output = this.readRenderFile(receipt.output.path);
        } catch (error) {
          const unsafe = safeProjectErrorMessage(error)
            .toLowerCase()
            .includes("link");
          findings.push({
            target,
            stage: "output",
            failure: unsafe ? "unsafe-locator" : "unavailable",
            recovery: unsafe
              ? "Replace linked or escaping state with an owned tracked record."
              : "Restore access to the tracked repaint state, then inspect it again.",
          });
          continue;
        }
        try {
          this.assertCurrentRepaintReceipt(receipt, output);
        } catch (error) {
          const classified = classifyCurrentRepaintReceiptError(error);
          findings.push({
            target,
            stage: classified.stage,
            failure: classified.failure,
            recovery:
              classified.failure === "stale"
                ? "Regenerate the record from current production inputs."
                : classified.failure === "identity-invalid"
                  ? "Restore the record at its canonical identity."
                  : "Restore or regenerate the exact rendition bytes.",
          });
          continue;
        }
        records.push({ target, value: receipt });
      } catch {
        findings.push({
          target,
          stage: "receipt",
          failure: "unavailable",
          recovery:
            "Restore access to the tracked repaint state, then inspect it again.",
        });
      }
    }
    records.sort(
      (left, right) =>
        compareCodeUnits(left.value.shot, right.value.shot) ||
        compareCodeUnits(left.value.completedAt!, right.value.completedAt!) ||
        compareCodeUnits(left.value.attemptId, right.value.attemptId),
    );
    return { records, findings };
  }

  /**
   * Re-read and verify every current repaint receipt and its resident MP4.
   *
   * Invalid, stale, linked, or forged records are omitted; publication
   * verification treats an omitted required shot as missing rendition evidence.
   */
  public verifiedRepaintRenditions(
    shots: readonly string[],
  ): IAutoMovieRepaintReceipt[] {
    return this.inspectVerifiedRepaintRenditions(shots).records.map(
      (record) => record.value,
    );
  }

  /** Inspect current repaint pointers without erasing classified failures. */
  public inspectVerifiedRepaintRenditions(
    shots: readonly string[],
  ): IAutoMovieRepaintRecordInspection<IAutoMovieRepaintReceipt> {
    this.refreshRevision();
    return inspectAutoMovieRepaintRecords({
      targets: [...new Set(shots)].map((shot) => ({
        kind: "rendition" as const,
        shot,
        recordId: "active",
      })),
      inspect: (target) => {
        const shot = target.shot;
        const activePath = productionRepaintActiveReceiptPath(shot);
        let activeBytes: Uint8Array | null;
        try {
          activeBytes = this.readTrackedStateFile(activePath);
        } catch (error) {
          throw new AutoMovieRepaintRecordInspectionError(
            "pointer",
            safeProjectErrorMessage(error).toLowerCase().includes("link")
              ? "unsafe-locator"
              : "unavailable",
          );
        }
        if (activeBytes === null) return null;
        let pointerValidation: IValidation<IAutoMovieActiveRepaintReceipt>;
        try {
          pointerValidation =
            typia.validateEquals<IAutoMovieActiveRepaintReceipt>(
              JSON.parse(Buffer.from(activeBytes).toString("utf8")),
            );
        } catch {
          throw new AutoMovieRepaintRecordInspectionError(
            "pointer",
            "schema-invalid",
          );
        }
        if (pointerValidation.success === false)
          throw new AutoMovieRepaintRecordInspectionError(
            "pointer",
            "schema-invalid",
          );
        const pointer = pointerValidation.data;
        let receipt: IAutoMovieRepaintReceipt;
        try {
          receipt = this.verifiedRepaintSelectionLineage({
            shot,
            selectionPath: pointer.selection,
          });
        } catch (error) {
          if (error instanceof AutoMovieRepaintRecordInspectionError)
            throw error;
          throw new AutoMovieRepaintRecordInspectionError(
            "selection",
            "unavailable",
          );
        }
        if (
          canonicalizeAutoMovieJson(pointer) !==
          canonicalizeAutoMovieJson({
            version: 2,
            shot,
            selection: pointer.selection,
            receipt: productionRepaintReceiptPath(receipt.output.path),
            output: receipt.output.path,
          } satisfies IAutoMovieActiveRepaintReceipt)
        )
          throw new AutoMovieRepaintRecordInspectionError(
            "pointer",
            "identity-invalid",
          );
        return receipt;
      },
    });
  }

  /**
   * Read each current rendition with the selection identity final delivery
   * must seal into its aggregate member set.
   */
  public verifiedRepaintSelections(
    shots: readonly string[],
  ): IAutoMovieVerifiedRepaintSelection[] {
    const inspection = this.inspectVerifiedRepaintRenditions(shots);
    if (inspection.findings.length !== 0)
      throw new Error(
        `Current repaint selection inspection refused: ${inspection.findings
          .map(
            (finding) =>
              `${finding.target.shot}:${finding.stage}:${finding.failure}`,
          )
          .join(", ")}.`,
      );
    const receipts = new Map(
      inspection.records.map((record) => [record.value.shot, record.value]),
    );
    return [...new Set(shots)].sort(compareCodeUnits).flatMap((shot) => {
      const receipt = receipts.get(shot);
      if (receipt === undefined) return [];
      const activeBytes = this.readTrackedStateFile(
        productionRepaintActiveReceiptPath(shot),
      );
      if (activeBytes === null)
        throw new Error(
          `Current repaint selection for shot "${shot}" vanished.`,
        );
      const active = typia.validateEquals<IAutoMovieActiveRepaintReceipt>(
        JSON.parse(Buffer.from(activeBytes).toString("utf8")),
      );
      if (active.success === false)
        throw new Error(
          `Current repaint pointer for shot "${shot}" is malformed.`,
        );
      const selectionBytes = this.readTrackedStateFile(active.data.selection);
      if (selectionBytes === null)
        throw new Error(
          `Current repaint selection for shot "${shot}" vanished.`,
        );
      const selection = typia.validateEquals<IAutoMovieRepaintSelectionRecord>(
        JSON.parse(Buffer.from(selectionBytes).toString("utf8")),
      );
      if (
        selection.success === false ||
        selection.data.selectionId.trim().length === 0 ||
        selection.data.shot !== shot ||
        selection.data.attemptId !== receipt.attemptId ||
        selection.data.candidateReceipt !==
          productionRepaintReceiptPath(receipt.output.path)
      )
        throw new Error(
          `Current repaint selection for shot "${shot}" does not match its verified candidate.`,
        );
      return [
        {
          receipt,
          selectionId: selection.data.selectionId,
          selectionDigest: digestAutoMovieBytes(selectionBytes),
        },
      ];
    });
  }

  private verifiedRepaintSelectionLineage(props: {
    shot: string;
    selectionPath: string;
  }): IAutoMovieRepaintReceipt {
    const visited = new Set<string>();
    let selectionPath: string | null = props.selectionPath;
    let child:
      | {
          selection: IAutoMovieRepaintSelectionRecord;
          selectedAt: number;
          completedAt: number;
        }
      | undefined;
    let selected: IAutoMovieRepaintReceipt | null = null;
    while (selectionPath !== null) {
      if (visited.has(selectionPath))
        throw new AutoMovieRepaintRecordInspectionError(
          "selection",
          "identity-invalid",
        );
      visited.add(selectionPath);
      let selectionBytes: Uint8Array | null;
      try {
        selectionBytes = this.readTrackedStateFile(selectionPath);
      } catch (error) {
        throw new AutoMovieRepaintRecordInspectionError(
          "selection",
          safeProjectErrorMessage(error).toLowerCase().includes("link")
            ? "unsafe-locator"
            : "unavailable",
        );
      }
      if (selectionBytes === null)
        throw new AutoMovieRepaintRecordInspectionError("selection", "absent");
      let selectionValue: unknown;
      try {
        selectionValue = JSON.parse(
          Buffer.from(selectionBytes).toString("utf8"),
        );
      } catch {
        throw new AutoMovieRepaintRecordInspectionError(
          "selection",
          "schema-invalid",
        );
      }
      const selectionValidation =
        typia.validateEquals<IAutoMovieRepaintSelectionRecord>(selectionValue);
      if (selectionValidation.success === false)
        throw new AutoMovieRepaintRecordInspectionError(
          "selection",
          "schema-invalid",
        );
      const selection = selectionValidation.data;
      let receiptBytes: Uint8Array | null;
      try {
        receiptBytes = this.readTrackedStateFile(selection.candidateReceipt);
      } catch (error) {
        throw new AutoMovieRepaintRecordInspectionError(
          "receipt",
          safeProjectErrorMessage(error).toLowerCase().includes("link")
            ? "unsafe-locator"
            : "unavailable",
        );
      }
      if (receiptBytes === null)
        throw new AutoMovieRepaintRecordInspectionError("receipt", "absent");
      let receiptValue: unknown;
      try {
        receiptValue = JSON.parse(Buffer.from(receiptBytes).toString("utf8"));
      } catch {
        throw new AutoMovieRepaintRecordInspectionError(
          "receipt",
          "schema-invalid",
        );
      }
      const receiptValidation =
        typia.validateEquals<IAutoMovieRepaintReceipt>(receiptValue);
      if (receiptValidation.success === false)
        throw new AutoMovieRepaintRecordInspectionError(
          "receipt",
          "schema-invalid",
        );
      const receipt = receiptValidation.data;
      const selectedAt = new Date(selection.selectedAt);
      const completedAt = new Date(receipt.completedAt ?? Number.NaN);
      if (
        selection.productionId !== this.productionId ||
        selection.shot !== props.shot ||
        receipt.shot !== props.shot ||
        selectionPath !==
          repaintSelectionPath(props.shot, selection.selectionId) ||
        selection.requestId !== receipt.requestId ||
        selection.attemptId !== receipt.attemptId ||
        selection.candidateReceipt !==
          productionRepaintReceiptPath(receipt.output.path) ||
        selection.output !== receipt.output.path ||
        Number.isNaN(selectedAt.getTime()) ||
        selectedAt.toISOString() !== selection.selectedAt ||
        Number.isNaN(completedAt.getTime()) ||
        selectedAt.getTime() < completedAt.getTime() ||
        selection.reason.trim().length === 0 ||
        selection.reason !== selection.reason.trim() ||
        selection.structuralReview.trim().length === 0 ||
        selection.structuralReview !== selection.structuralReview.trim() ||
        (receipt.evidence?.continuity === null
          ? selection.continuityReview !== null
          : selection.continuityReview === null ||
            selection.continuityReview.baseline !==
              receipt.evidence?.continuity ||
            selection.continuityReview.playbackEvidence.trim().length === 0 ||
            selection.continuityReview.playbackEvidence !==
              selection.continuityReview.playbackEvidence.trim() ||
            (selection.continuityReview.mixedDeliveryPolicy !== null &&
              (selection.continuityReview.mixedDeliveryPolicy.trim().length ===
                0 ||
                selection.continuityReview.mixedDeliveryPolicy !==
                  selection.continuityReview.mixedDeliveryPolicy.trim()))) ||
        (child !== undefined &&
          (child.selectedAt < selectedAt.getTime() ||
            (child.selection.kind === "reversal"
              ? child.completedAt >= completedAt.getTime()
              : child.completedAt <= completedAt.getTime()))) ||
        (selection.previousSelection === null && selection.kind === "reversal")
      )
        throw new AutoMovieRepaintRecordInspectionError(
          "selection",
          "identity-invalid",
        );
      try {
        assertAutoMovieExternalGeneratorTermsAt({
          termsCheckedAt: receipt.generatorProvenance.termsCheckedAt,
          occurredAt: selection.selectedAt,
          label: "stored repaint selection generator provenance",
        });
      } catch {
        throw new AutoMovieRepaintRecordInspectionError("currentness", "stale");
      }
      let output: Uint8Array;
      try {
        output = this.readRenderFile(receipt.output.path);
      } catch (error) {
        throw new AutoMovieRepaintRecordInspectionError(
          "output",
          safeProjectErrorMessage(error).toLowerCase().includes("link")
            ? "unsafe-locator"
            : "unavailable",
        );
      }
      try {
        this.assertCurrentRepaintReceipt(receipt, output);
      } catch (error) {
        const classified = classifyCurrentRepaintReceiptError(error);
        throw new AutoMovieRepaintRecordInspectionError(
          classified.stage,
          classified.failure,
        );
      }
      selected ??= receipt;
      child = {
        selection,
        selectedAt: selectedAt.getTime(),
        completedAt: completedAt.getTime(),
      };
      selectionPath = selection.previousSelection;
    }
    if (selected === null)
      throw new AutoMovieRepaintRecordInspectionError("selection", "absent");
    return selected;
  }

  /** Revalidate one immutable terminal repaint attempt record. */
  private assertRepaintAttempt(attempt: IAutoMovieRepaintAttemptRecord): void {
    const schema =
      typia.validateEquals<IAutoMovieRepaintAttemptRecord>(attempt);
    if (schema.success === false)
      throw new Error("Repaint attempt record is malformed.");
    let adapterIdentityValid = false;
    try {
      const runtime = typia.validateEquals<IAutoMovieRepaintRuntimeIdentity>(
        JSON.parse(attempt.adapterIdentity),
      );
      adapterIdentityValid =
        runtime.success &&
        canonicalAutoMovieRepaintRuntimeIdentity(runtime.data) ===
          attempt.adapterIdentity;
    } catch {}
    const startedAt = new Date(attempt.startedAt);
    const completedAt = new Date(attempt.completedAt);
    if (
      attempt.version !== 1 ||
      attempt.productionId !== this.productionId ||
      attempt.shot.trim().length === 0 ||
      attempt.shot !== attempt.shot.trim() ||
      uuid(attempt.requestId, "Repaint request id") !== attempt.requestId ||
      uuid(attempt.attemptId, "Repaint attempt id") !== attempt.attemptId ||
      Number.isSafeInteger(attempt.ordinal) === false ||
      attempt.ordinal <= 0 ||
      /^sha256:[0-9a-f]{64}$/u.test(attempt.requestFingerprint) === false ||
      /^sha256:[0-9a-f]{64}$/u.test(attempt.compileFingerprint) === false ||
      /^sha256:[0-9a-f]{64}$/u.test(attempt.sourceRenderFingerprint) ===
        false ||
      adapterIdentityValid === false ||
      Number.isSafeInteger(attempt.seed) === false ||
      Number.isNaN(startedAt.getTime()) ||
      Number.isNaN(completedAt.getTime()) ||
      startedAt.toISOString() !== attempt.startedAt ||
      completedAt.toISOString() !== attempt.completedAt ||
      completedAt.getTime() < startedAt.getTime() ||
      Number.isFinite(attempt.costUnits) === false ||
      attempt.costUnits < 0 ||
      (attempt.status === "succeeded") !== (attempt.failure === null) ||
      (attempt.status === "succeeded" && attempt.availableOutput === null) ||
      (attempt.failure !== null &&
        (attempt.failure.message.trim().length === 0 ||
          attempt.failure.message !== attempt.failure.message.trim() ||
          attempt.status !==
            (attempt.failure.class === "cancelled"
              ? "cancelled"
              : attempt.failure.class === "invalid-output"
                ? "invalid"
                : attempt.failure.class === "input-stale"
                  ? "stale"
                  : "failed") ||
          (attempt.failure.retryable &&
            (attempt.status !== "failed" ||
              REPAINT_RETRYABLE_FAILURE_CLASSES.has(attempt.failure.class) ===
                false)))) ||
      (attempt.availableOutput !== null &&
        (Number.isSafeInteger(attempt.availableOutput.bytes) === false ||
          attempt.availableOutput.bytes <= 0 ||
          /^sha256:[0-9a-f]{64}$/u.test(attempt.availableOutput.digest) ===
            false ||
          (attempt.availableOutput.receipt !== undefined &&
            attempt.availableOutput.receipt !==
              productionRepaintRawOutputReceiptPath(
                attempt.requestId,
                attempt.attemptId,
              ))))
    )
      throw new Error("Repaint attempt record is malformed.");
  }

  /** Bind a succeeded candidate's complete attempt ledger to its policy. */
  private assertRepaintAttemptLedgerPolicy(
    first: IAutoMovieRepaintAttemptRecord,
    remaining: readonly IAutoMovieRepaintAttemptRecord[],
    policy: IAutoMovieRepaintExecutionPolicy,
  ): void {
    const firstStartedAt = new Date(first.startedAt).getTime();
    const firstPolicyMarkedRetryable = policy.retryableFailures.some(
      (failureClass) => failureClass === first.failure?.class,
    );
    let spent = first.costUnits;
    let previous = first;
    if (
      remaining.length + 1 > policy.maximumAttempts ||
      spent > policy.maximumCostUnits ||
      (first.failure !== null &&
        first.failure.retryable !==
          (first.status === "failed" && firstPolicyMarkedRetryable))
    )
      throw new Error(
        "Stored repaint attempt ledger exceeds its immutable execution policy.",
      );
    for (const [index, attempt] of remaining.entries()) {
      const policyMarkedRetryable = policy.retryableFailures.some(
        (failureClass) => failureClass === attempt.failure?.class,
      );
      const backoff = Math.min(...policy.backoffMs.slice(index, index + 1));
      if (
        spent >= policy.maximumCostUnits ||
        new Date(attempt.startedAt).getTime() <
          new Date(previous.completedAt).getTime() + backoff
      )
        throw new Error(
          "Stored repaint attempt ledger exceeds its immutable execution policy.",
        );
      spent += attempt.costUnits;
      if (
        spent > policy.maximumCostUnits ||
        (attempt.failure !== null &&
          attempt.failure.retryable !==
            (attempt.status === "failed" && policyMarkedRetryable))
      )
        throw new Error(
          "Stored repaint attempt ledger exceeds its immutable execution policy.",
        );
      previous = attempt;
    }
    if (
      previous.status !== "succeeded" ||
      new Date(previous.completedAt).getTime() -
        new Date(previous.startedAt).getTime() >=
        policy.attemptTimeoutMs ||
      new Date(previous.completedAt).getTime() - firstStartedAt >=
        policy.maximumElapsedMs
    )
      throw new Error(
        "Stored repaint attempt ledger exceeds its immutable execution policy.",
      );
  }

  /**
   * Revalidate a stored repaint receipt against its terminal attempt and every
   * current dependency.
   */
  private assertCurrentRepaintReceipt(
    receipt: IAutoMovieRepaintReceipt,
    bytes: Uint8Array,
  ): void {
    const startedAt = new Date(receipt.startedAt ?? Number.NaN);
    const completedAt = new Date(receipt.completedAt ?? Number.NaN);
    if (
      receipt.version !== 4 ||
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(
        receipt.requestId ?? "",
      ) === false ||
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(
        receipt.attemptId,
      ) === false ||
      Number.isNaN(startedAt.getTime()) ||
      Number.isNaN(completedAt.getTime()) ||
      startedAt.toISOString() !== receipt.startedAt ||
      completedAt.toISOString() !== receipt.completedAt ||
      completedAt.getTime() < startedAt.getTime() ||
      Number.isFinite(receipt.costUnits) === false ||
      receipt.costUnits! < 0 ||
      receipt.executionPolicy === undefined ||
      receipt.evidence === undefined ||
      Object.entries(receipt.evidence!).some(
        ([key, value]) =>
          (key !== "continuity" || value !== null) &&
          (typeof value !== "string" ||
            value.trim().length === 0 ||
            value !== value.trim()),
      ) ||
      receipt.parameters.prompt.trim().length === 0 ||
      receipt.parameters.prompt !== receipt.parameters.prompt.trim() ||
      (receipt.parameters.negativePrompt !== undefined &&
        (receipt.parameters.negativePrompt.trim().length === 0 ||
          receipt.parameters.negativePrompt !==
            receipt.parameters.negativePrompt.trim())) ||
      Number.isSafeInteger(receipt.parameters.seed) === false ||
      Number.isFinite(receipt.parameters.strength) === false ||
      receipt.parameters.strength < 0 ||
      receipt.parameters.strength > 1 ||
      Object.entries(receipt.parameters.controls ?? {}).some(
        ([key, value]) =>
          key.trim().length === 0 ||
          key !== key.trim() ||
          (typeof value === "string" &&
            (value.trim().length === 0 || value !== value.trim())) ||
          (typeof value === "number" && Number.isFinite(value) === false),
      ) ||
      receipt.controls.length === 0
    )
      throw new Error("Stored repaint receipt parameters are invalid.");
    assertAutoMovieRepaintExecutionPolicy(receipt.executionPolicy!);
    canonicalAutoMovieRepaintGeneratorProvenance(receipt.generatorProvenance);
    assertAutoMovieExternalGeneratorTermsAt({
      termsCheckedAt: receipt.generatorProvenance.termsCheckedAt,
      occurredAt: receipt.startedAt!,
      label: "stored repaint generator provenance",
    });
    const generated = this.generatedManifest();
    if (
      generated === null ||
      generated.inputFingerprint !== receipt.compileFingerprint
    )
      throw new AutoMovieProductionInputRaceError(
        "Repaint receipt does not target the current compiler input.",
      );
    const sourceManifest = this.verifiedRenderManifest(
      resolveInside(
        this.renderRoot(),
        path.join(...receipt.sourceBundle.split("/"), "manifest.json"),
      ),
    );
    if (
      sourceManifest === null ||
      sourceManifest.target.kind !== "shot" ||
      sourceManifest.target.id !== receipt.shot ||
      sourceManifest.compileFingerprint !== receipt.compileFingerprint ||
      productionSourceRenderFingerprint({
        manifest: sourceManifest,
        frames: sourceManifest.frames,
      }) !== receipt.sourceRenderFingerprint ||
      canonicalizeAutoMovieJson(
        productionRepaintStructuralControls(sourceManifest),
      ) !== canonicalizeAutoMovieJson(receipt.controls)
    )
      throw new Error("Stored repaint receipt source evidence is stale.");
    let runtimeIdentity: unknown;
    try {
      runtimeIdentity = JSON.parse(receipt.adapterIdentity);
    } catch {
      throw new Error("Stored repaint adapter identity is not JSON.");
    }
    const runtimeValidation =
      typia.validateEquals<IAutoMovieRepaintRuntimeIdentity>(runtimeIdentity);
    if (
      runtimeValidation.success === false ||
      canonicalAutoMovieRepaintRuntimeIdentity(runtimeValidation.data) !==
        receipt.adapterIdentity
    )
      throw new Error("Stored repaint adapter identity is invalid.");
    this.validateRepaintReferences(receipt);
    const requestFingerprint = productionRepaintRequestFingerprint({
      shot: receipt.shot,
      compileFingerprint: receipt.compileFingerprint,
      sourceRenderFingerprint: receipt.sourceRenderFingerprint,
      adapterIdentity: receipt.adapterIdentity,
      generatorProvenance: receipt.generatorProvenance,
      parameters: receipt.parameters,
      executionPolicy: receipt.executionPolicy!,
      evidence: receipt.evidence!,
      references: receipt.references,
    });
    const attempts = this.repaintRequestAttempts(receipt.requestId!);
    const firstAttempt = attempts.find((candidate) => candidate.ordinal === 1);
    const attempt = attempts.find(
      (candidate) => candidate.attemptId === receipt.attemptId,
    );
    if (
      firstAttempt === undefined ||
      attempt === undefined ||
      canonicalizeAutoMovieJson({
        productionId: attempt.productionId,
        shot: attempt.shot,
        requestId: attempt.requestId,
        attemptId: attempt.attemptId,
        requestFingerprint: attempt.requestFingerprint,
        compileFingerprint: attempt.compileFingerprint,
        sourceRenderFingerprint: attempt.sourceRenderFingerprint,
        adapterIdentity: attempt.adapterIdentity,
        seed: attempt.seed,
        startedAt: attempt.startedAt,
        completedAt: attempt.completedAt,
        status: attempt.status,
        failure: attempt.failure,
        costUnits: attempt.costUnits,
        availableOutput: attempt.availableOutput,
      }) !==
        canonicalizeAutoMovieJson({
          productionId: receipt.productionId,
          shot: receipt.shot,
          requestId: receipt.requestId,
          attemptId: receipt.attemptId,
          requestFingerprint,
          compileFingerprint: receipt.compileFingerprint,
          sourceRenderFingerprint: receipt.sourceRenderFingerprint,
          adapterIdentity: receipt.adapterIdentity,
          seed: receipt.parameters.seed,
          startedAt: receipt.startedAt,
          completedAt: receipt.completedAt,
          status: "succeeded",
          failure: null,
          costUnits: receipt.costUnits,
          availableOutput: {
            digest: receipt.output.digest,
            bytes: receipt.output.bytes,
            ...(attempt.availableOutput?.receipt === undefined
              ? {}
              : { receipt: attempt.availableOutput.receipt }),
          },
        })
    )
      throw new Error(
        "Stored repaint receipt does not match its immutable succeeded terminal attempt.",
      );
    this.assertRepaintAttemptLedgerPolicy(
      firstAttempt,
      attempts.slice(1),
      receipt.executionPolicy!,
    );
    const expected = productionRepaintOutputPath({
      shot: receipt.shot,
      sourceRenderFingerprint: receipt.sourceRenderFingerprint,
      attemptId: receipt.attemptId,
      adapterIdentity: receipt.adapterIdentity,
      generatorProvenance: receipt.generatorProvenance,
      parameters: receipt.parameters,
      executionPolicy: receipt.executionPolicy!,
      evidence: receipt.evidence!,
      references: receipt.references,
      outputDigest: receipt.output.digest,
    });
    if (
      receipt.output.path !== expected ||
      receipt.output.digest !== digestAutoMovieBytes(bytes) ||
      receipt.output.bytes !== bytes.length
    )
      throw new Error("Stored repaint output identity is invalid.");
    const probe = probeProductionVideoMp4(bytes);
    const graph = this.graph();
    const production = graph.production;
    const shot = graph.shots.get(receipt.shot);
    if (production === null || shot === undefined)
      throw new Error("Stored repaint media target is stale.");
    const frameRate = resolveProductionFrameRate(production.frameFormat);
    const expectedFrameCount = Math.round(
      (shot.durationSeconds * frameRate.numerator) / frameRate.denominator,
    );
    if (
      probe.kind !== "video" ||
      canonicalizeAutoMovieJson(probe) !==
        canonicalizeAutoMovieJson(receipt.output.probe) ||
      probe.frameCount !== expectedFrameCount
    )
      throw new Error("Stored repaint media facts are stale.");
    assertProductionRenditionClipDelivery({
      bytes,
      shot: receipt.shot,
      width: production.frameFormat.width,
      height: production.frameFormat.height,
      fps: production.frameFormat.fps,
      frameRate,
      frameCount: expectedFrameCount,
      runtimeSeconds: shot.durationSeconds,
    });
  }

  /** Verify every repaint reference against current declared asset bytes. */
  private validateRepaintReferences(receipt: IAutoMovieRepaintReceipt): void {
    const assetManifest = PROJECT_LAYOUT.assetManifest;
    const inputs = this.contentInputs();
    const manifestInput = inputs.find((input) => input.path === assetManifest);
    if (manifestInput?.bytes === null || manifestInput === undefined)
      throw new Error(
        "Repaint receipt references require the current declared asset manifest.",
      );
    let decoded: unknown;
    try {
      decoded = JSON.parse(Buffer.from(manifestInput.bytes).toString("utf8"));
    } catch {
      throw new Error("Repaint asset manifest is not valid JSON.");
    }
    const validation = typia.validateEquals<IAutoMovieAssetManifest>(decoded);
    if (validation.success === false)
      throw new Error(
        "Repaint asset manifest does not match its strict schema.",
      );
    if (
      validation.data.assets.some(
        (asset) => assetUrlAdmissionRefusal(asset) !== null,
      )
    )
      throw new Error(
        "Repaint asset manifest contains an inadmissible source or license URL.",
      );
    const seen = new Set<string>();
    const rolesByDigest = new Map<
      AutoMovieContentDigest,
      Set<AutoMovieRepaintReferenceRole>
    >();
    if (receipt.references.length === 0)
      throw new Error("Repaint receipt requires at least one fixed reference.");
    for (const reference of receipt.references) {
      const key = `${reference.role}\0${reference.path}`;
      const record = validation.data.assets.find(
        (asset) => asset.path === reference.path,
      );
      const resident = inputs.find(
        (input) => input.path === reference.path && input.bytes !== null,
      );
      if (
        seen.has(key) ||
        record === undefined ||
        resident?.bytes === null ||
        resident === undefined ||
        record.digest !== reference.digest ||
        digestAutoMovieBytes(resident.bytes) !== reference.digest ||
        record.uses.some(
          (use) =>
            use.production === this.productionId &&
            use.consumer.kind === "rendition-reference" &&
            use.consumer.id === receipt.shot,
        ) === false
      )
        throw new Error(
          `Repaint reference "${reference.role}:${reference.path}" is duplicate, absent, byte-stale, or not registered to shot "${receipt.shot}".`,
        );
      seen.add(key);
      const roles = rolesByDigest.get(reference.digest) ?? new Set();
      roles.add(reference.role);
      rolesByDigest.set(reference.digest, roles);
    }
    if (
      [...rolesByDigest.values()].some(
        (roles) => roles.size === REPAINT_REFERENCE_ROLE_COUNT,
      )
    )
      throw new Error(
        "One repaint reference image cannot stand as canonical guidance for every role.",
      );
  }

  /**
   * Every verified frame committed for one target at one exact fingerprint.
   *
   * A bundle is filed under the target's fingerprint, so reading only that
   * directory is what makes the answer current: a target whose design, source,
   * or compiler identity moved has an empty answer here even though its
   * previous self's pixels are still on disk. Each bundle is read through
   * {@link verifiedRenderManifest}, so a manifest whose receipt, path, or
   * frame bytes do not agree contributes nothing rather than counting as
   * evidence.
   */
  public capturedRenderViews(
    target: IAutoMovieRenderBundleManifest["target"],
    fingerprint: AutoMovieContentDigest,
  ): Array<{
    time: number;
    pass: AutoMovieGuidePass;
    semanticCoverage?: { unresolved: string[]; unaddressed: number };
  }> {
    this.assertIncarnation();
    const root = this.renderRoot();
    const directory = path.join(
      root,
      `${target.kind}-${encodeAutoMoviePathSegment(target.id)}`,
      fingerprint.slice("sha256:".length),
    );
    const linked = lstatOrNull(directory);
    if (linked === null || linked.isDirectory() === false) return [];
    const views: Array<{
      time: number;
      pass: AutoMovieGuidePass;
      semanticCoverage?: { unresolved: string[]; unaddressed: number };
    }> = [];
    for (const entry of fileSystem.readdirSync(directory, {
      withFileTypes: true,
    })) {
      if (entry.isDirectory() === false) continue;
      const manifest = this.verifiedRenderManifest(
        path.join(directory, entry.name, "manifest.json"),
      );
      if (manifest === null) continue;
      for (const frame of manifest.frames) {
        const semantic = manifest.semanticMasks.find(
          (record) =>
            record.frame === frame.index && record.pass === frame.pass,
        );
        views.push({
          pass: frame.pass,
          time: frame.time,
          ...(semantic === undefined
            ? {}
            : { semanticCoverage: structuredClone(semantic.coverage) }),
        });
      }
    }
    return views;
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
      const relativeManifest = normalizeSlash(
        path.relative(root, manifestPath),
      );
      const bytes = Buffer.from(this.readRenderFile(relativeManifest));
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
          this.productionStateRoot,
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
          path.dirname(manifestPath),
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
      const semanticKeys = new Set<string>();
      for (const semantic of validation.data.semanticMasks) {
        const key = `${semantic.frame}\u0000${semantic.pass}`;
        if (semanticKeys.has(key)) return null;
        semanticKeys.add(key);
        if (
          validation.data.target.kind !== "shot" ||
          semantic.shot !== validation.data.target.id ||
          validation.data.frames.some(
            (frame) =>
              frame.index === semantic.frame && frame.pass === semantic.pass,
          ) === false
        )
          return null;
        const absoluteSidecar = resolveInside(
          path.dirname(manifestPath),
          semantic.sidecar.path,
        );
        const sidecarBytes = this.readRenderFile(
          normalizeSlash(path.relative(root, absoluteSidecar)),
        );
        const mask = JSON.parse(
          Buffer.from(sidecarBytes).toString("utf8"),
        ) as IAutoMovieSemanticMask;
        verifyAutoMovieProductionSemanticMaskReceipt({
          receipt: semantic,
          expectedFrame: semantic.frame,
          expectedShot: semantic.shot,
          evidence: {
            version: 1,
            shot: semantic.shot,
            mask,
            coverage: semantic.coverage,
          },
          resident: { path: semantic.sidecar.path, bytes: sidecarBytes },
        });
      }
      if (
        validation.data.target.kind === "shot" &&
        validation.data.frames.some(
          (frame) =>
            frame.pass === "mask" &&
            semanticKeys.has(`${frame.index}\u0000${frame.pass}`) === false,
        )
      )
        return null;
      return validation.data;
    } catch {
      return null;
    }
  }

  /**
   * Atomically publish every deliverable byte, aggregate manifest, and parser
   * receipt under one revision/input fence.
   *
   * The file map is render-root-relative and must exactly equal the manifest's
   * claimed file inventory. Probing happens before staging, the input guard
   * runs before and after all writes and once more after `publicationCurrent`
   * runs the read-only final compiler gate against staged bytes. commitFiles
   * restores the previous valid publication if any write, guard, final gate, or
   * post-commit byte assertion fails. A replaced physical root or state
   * incarnation is the exception: stale paths are abandoned without rollback.
   */
  public commitProductionPublication(props: {
    files: ReadonlyMap<string, Uint8Array>;
    manifest: IAutoMovieProductionRenderManifest;
    plan: IAutoMovieProductionRenderJobPlan;
    planCurrent: () => boolean;
    inputCurrent: () => boolean;
    publicationCurrent: () => void;
    expectedRevision: number;
  }): number {
    const validation = typia.validateEquals<IAutoMovieProductionRenderManifest>(
      props.manifest,
    );
    if (validation.success === false)
      throw new Error(
        `Invalid aggregate render manifest: ${validation.errors
          .map((error) => `${error.path} expects ${error.expected}`)
          .join("; ")}.`,
      );
    const candidate = structuredClone(validation.data);
    const publication = assertProductionRenderPublicationCurrent({
      identity: candidate.publication,
      plan: props.plan,
    });
    if (candidate.compileFingerprint !== publication.compileFingerprint)
      throw new Error(
        "The terminal render manifest compile fingerprint differs from its publication identity.",
      );
    if (props.inputCurrent() !== true || props.planCurrent() !== true)
      throw new AutoMovieProductionInputRaceError(
        "Production inputs or the render plan changed before terminal publication began.",
      );
    if (
      this.generatedManifest()?.inputFingerprint !==
      candidate.compileFingerprint
    )
      throw new AutoMovieProductionInputRaceError(
        "The terminal publication does not target the current compiler input. Replan and rerender before finalizing.",
      );
    const renderRoot = this.renderRoot();
    const files = new Map<
      string,
      { bytes: Buffer; relative: string; target: string }
    >();
    for (const [relativePath, content] of props.files) {
      const relative = canonicalProductionRenderPath(relativePath);
      const target = resolveInside(renderRoot, relative);
      const key = relative.toLowerCase();
      if (files.has(key))
        throw new Error(
          `Terminal publication maps more than one byte source to "${relative}". Keep one canonical render path.`,
        );
      files.set(key, { bytes: Buffer.from(content), relative, target });
    }
    const receiptFiles: IAutoMovieProductionRenderReceipt["files"] = [];
    const claimed = new Set<string>();
    for (const deliverable of candidate.deliverables)
      for (const file of deliverable.files) {
        const relative = canonicalProductionRenderPath(file.path);
        const key = relative.toLowerCase();
        if (claimed.has(key))
          throw new Error(
            `Render file "${file.path}" is claimed more than once. Give it one deliverable owner.`,
          );
        claimed.add(key);
        const supplied = files.get(key);
        if (supplied === undefined)
          throw new Error(
            `Terminal publication is missing claimed file "${file.path}".`,
          );
        const bytes = supplied.bytes;
        const digest = digestAutoMovieBytes(bytes);
        if (bytes.length !== file.bytes || digest !== file.digest)
          throw new Error(
            `Terminal publication file "${file.path}" differs from its manifest byte facts.`,
          );
        const probe = probeProductionMedia({
          kind: deliverable.kind,
          mediaType: file.mediaType,
          bytes,
        });
        if (file.semanticMask === undefined) {
          if (probe.kind === "semantic-mask")
            throw new Error(
              `Semantic sidecar "${file.path}" has no semantic receipt in its deliverable manifest.`,
            );
        } else {
          const semantic = file.semanticMask;
          const ownedByPlan = props.plan.chunks.some(
            (chunk) =>
              chunk.deliverable === deliverable.id &&
              chunk.pass === "mask" &&
              chunk.frames.some(
                (frame) =>
                  frame.globalFrame === semantic.frame &&
                  productionRenderLayersForPass(frame, "mask").some(
                    (layer) => layer.shot === semantic.shot,
                  ),
              ),
          );
          if (
            deliverable.kind !== "guide-pass" ||
            probe.kind !== "semantic-mask" ||
            semantic.sidecar.path !== file.path ||
            ownedByPlan === false
          )
            throw new Error(
              `Semantic sidecar "${file.path}" is not bound to one current mask frame in its guide deliverable.`,
            );
          verifyAutoMovieProductionSemanticMaskReceipt({
            receipt: semantic,
            expectedFrame: semantic.frame,
            expectedShot: semantic.shot,
            evidence: {
              version: 1,
              shot: semantic.shot,
              mask: probe.mask,
              coverage: semantic.coverage,
            },
            resident: { path: file.path, bytes },
          });
        }
        receiptFiles.push({
          deliverable: deliverable.id,
          ...file,
          probe,
        });
      }
    if (files.size !== claimed.size)
      throw new Error(
        `Terminal publication supplied ${files.size} files but the manifest claims ${claimed.size}. Remove unclaimed bytes.`,
      );
    receiptFiles.sort((left, right) => compareCodeUnits(left.path, right.path));
    const manifestContent = serializeJson(candidate);
    const receiptContent = serializeJson({
      version: 4,
      manifestDigest: digestAutoMovieBytes(
        Buffer.from(manifestContent, "utf8"),
      ),
      publicationFingerprint: publication.fingerprint,
      files: receiptFiles,
    } satisfies IAutoMovieProductionRenderReceipt);
    const payload = candidate.deliverables.flatMap((deliverable) =>
      deliverable.files.map((file) => {
        const key = canonicalProductionRenderPath(file.path).toLowerCase();
        return files.get(key)!;
      }),
    );
    const writes = (): IStagedFile[] => [
      ...payload.flatMap((entry): IStagedFile[] => {
        if (lstatOrNull(entry.target) === null)
          return [
            {
              path: entry.target,
              content: entry.bytes,
              immutable: true,
            },
          ];
        const resident = this.readRenderFile(entry.relative);
        if (Buffer.from(resident).equals(entry.bytes) === false)
          throw new AutoMovieProductionInputRaceError(
            `Immutable terminal publication path "${entry.relative}" already contains another payload generation. Replan before publishing different bytes.`,
          );
        return [];
      }),
      {
        path: path.join(this.productionStateRoot, "render-manifest.json"),
        content: manifestContent,
      },
      {
        path: path.join(
          this.productionStateRoot,
          "render-manifest-receipt.json",
        ),
        content: receiptContent,
      },
    ];
    return this.commitFiles(
      writes,
      () => props.inputCurrent() === true && props.planCurrent() === true,
      props.expectedRevision,
      () => {
        const assertLedgerCurrent = (): void => {
          const residentManifest = this.readTrackedStateFile(
            "render-manifest.json",
          );
          const residentReceipt = this.readTrackedStateFile(
            "render-manifest-receipt.json",
          );
          if (
            residentManifest === null ||
            residentReceipt === null ||
            Buffer.from(residentManifest).equals(
              Buffer.from(manifestContent, "utf8"),
            ) === false ||
            Buffer.from(residentReceipt).equals(
              Buffer.from(receiptContent, "utf8"),
            ) === false
          )
            throw new AutoMovieProductionInputRaceError(
              "Terminal render manifest or receipt changed after publication.",
            );
        };
        for (const deliverable of candidate.deliverables)
          for (const file of deliverable.files) {
            const bytes = this.readRenderFile(file.path);
            if (
              bytes.length !== file.bytes ||
              digestAutoMovieBytes(bytes) !== file.digest
            )
              throw new AutoMovieProductionInputRaceError(
                `Committed terminal file "${file.path}" failed its post-publication byte check.`,
              );
          }
        assertLedgerCurrent();
        props.publicationCurrent();
        for (const deliverable of candidate.deliverables)
          for (const file of deliverable.files) {
            const bytes = this.readRenderFile(file.path);
            if (
              bytes.length !== file.bytes ||
              digestAutoMovieBytes(bytes) !== file.digest
            )
              throw new AutoMovieProductionInputRaceError(
                `Committed terminal file "${file.path}" changed during the final compiler gate.`,
              );
          }
        assertLedgerCurrent();
        if (props.inputCurrent() !== true || props.planCurrent() !== true)
          throw new AutoMovieProductionInputRaceError(
            "Production inputs or the render-plan generation changed during the staged terminal publication final gate.",
          );
      },
    );
  }

  /**
   * Atomically write renderer-owned files for one declared deliverable.
   *
   * Returned paths are rooted below the active production's
   * `renders/<production>/deliverables/<encoded-id>` slot and can be copied
   * verbatim into the aggregate production render manifest.
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
            fileSystem.existsSync(absolute) === false ||
            Buffer.from(this.readGeneratedFile(relativePath)).equals(
              content,
            ) === false
          )
            writes.push({ path: absolute, content });
        }
        const manifestPath = path.join(
          this.productionStateRoot,
          "generated-manifest.json",
        );
        const residentManifest = this.readTrackedStateFile(
          "generated-manifest.json",
        );
        if (
          residentManifest === null ||
          Buffer.from(residentManifest).equals(
            Buffer.from(serializedManifest, "utf8"),
          ) === false
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
    if (this.readOnly_) {
      if (
        expectedRevision !== this.lastReadRevision_ ||
        inputCurrent() === false ||
        this.revision() !== expectedRevision
      )
        throw new AutoMovieProductionInputRaceError(
          "Production inputs changed during read-only snapshot confirmation.",
        );
      return expectedRevision;
    }
    return this.commitFiles(
      () => [],
      inputCurrent,
      expectedRevision,
      undefined,
      false,
    );
  }

  /**
   * Read the current production's optional screenplay/treatment index.
   */
  public screenplayIndex(): IAutoMovieScreenplayIndex | null {
    this.refreshRevision();
    return this.loadScreenplayIndex();
  }

  private loadScreenplayIndex(): IAutoMovieScreenplayIndex | null {
    this.assertIncarnation();
    const file = path.join(this.productionDesignRoot, "screenplay/index.json");
    if (lstatOrNull(file) === null) return null;
    return readOwnedTypedJson(
      ownedRootReal(this.rootReal, this.automovieRoot),
      file,
      validateScreenplayIndex,
    );
  }

  private setDesign(
    target: IAutoMovieDesignTarget,
    value: unknown,
    validation: IValidation<unknown>,
  ): IAutoMovieDesignMutationOutput {
    const expectedRevision = this.lastReadRevision_;
    const graph = this.loadGraph();
    const generatedPaths =
      this.loadGeneratedManifest()?.files.map((file) => file.path) ?? [];
    const screenplay = this.loadScreenplayIndex();
    const consequences = consequencesOf(
      graph,
      target,
      generatedPaths,
      screenplay,
    );
    const previousDiagnostics = new Set(
      validateAutoMovieProductionGraph(
        graph,
        this.productionId,
        this.archetypes,
      ).map(diagnosticIdentity),
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
    const nextConsequences = consequencesOf(
      next,
      target,
      generatedPaths,
      screenplay,
    );
    const nextDiagnostics = validateAutoMovieProductionGraph(
      next,
      this.productionId,
      this.archetypes,
    );
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
        code: "design-downstream-invalidated" as const,
        category: "warning" as const,
        message: `${diagnostic.message} This staged mutation was accepted so the dependent artifact can be updated next; compilation remains blocked until it is corrected.`,
      }));
    const content = serializeJson(value);
    const revision = this.commitFiles(
      [{ path: this.designPath(target), content }],
      undefined,
      expectedRevision,
      undefined,
      true,
      isSharedDesign(target),
    );
    return {
      accepted: true,
      revision,
      target,
      fingerprint: digestAutoMovieBytes(Buffer.from(content, "utf8")),
      consequences: mergeMutationConsequences(
        consequences,
        nextConsequences,
        next.production?.visualDelivery !== "deterministic",
      ),
      diagnostics: downstreamDiagnostics,
    };
  }

  /**
   * The project-relative file one design record is stored in.
   *
   * Exposed so a diagnostic can name the file rather than only the id. The
   * design tree's layout is this project's to decide, and a caller that spelled
   * `automovie/design/shots/<id>.json` for itself would be restating that
   * layout in a second place and would be wrong the day it changes.
   *
   * It answers for a record whether or not one is resident, because the caller
   * that most needs the path is the one reporting a record that should not be
   * there any more.
   */
  public designRecordPath(target: IAutoMovieDesignTarget): string {
    return relativeToRoot(this.root, this.designPath(target));
  }

  private designPath(target: IAutoMovieDesignTarget): string {
    switch (target.kind) {
      case "production":
        return path.join(this.productionDesignRoot, "production.json");
      case "world":
        return path.join(this.sharedDesignRoot, "world.json");
      case "acceptance":
        return path.join(
          this.productionDesignRoot,
          "acceptance",
          `${encodeId(target.id)}.json`,
        );
      case "formation":
      case "model":
        return path.join(
          this.sharedDesignRoot,
          `${target.kind}s`,
          `${encodeId(target.id)}.json`,
        );
      case "shot":
        return path.join(
          this.productionDesignRoot,
          "shots",
          `${encodeId(target.id)}.json`,
        );
    }
  }

  private renderReceiptPath(relativeBundle: string): string {
    const digest = digestAutoMovieBytes(
      Buffer.from(normalizeSlash(relativeBundle), "utf8"),
    );
    return path.join(
      this.productionStateRoot,
      "render-receipts",
      `${digestSegment(digest)}.json`,
    );
  }

  private readKeyedDesigns<T extends { id: string }>(
    directory: string,
    validate: (input: unknown) => IValidation<T>,
  ): ReadonlyMap<string, T> {
    const absolute = directory;
    const stateRootReal = ownedRootReal(this.rootReal, this.automovieRoot);
    const output = new Map<string, T>();
    for (const entry of fileSystem
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
      return isInside(fileSystem.realpathSync(directory), candidate);
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
    if (this.deleted_)
      throw new AutoMovieProductionInputRaceError(
        `Production "${this.productionId}" was deleted. Open another registered production before reading or mutating project state.`,
      );
    const linked = lstatOrNull(this.root);
    const current =
      linked === null ||
      linked.isSymbolicLink() ||
      linked.isDirectory() === false
        ? null
        : fileSystem.statSync(this.root, { bigint: true });
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
    this.assertProjectRootIdentity();
    this.assertStateRootIdentity();
    const current = validateIncarnation(
      readOwnedJson(this.rootReal, this.incarnationPath),
      this.incarnationPath,
    );
    this.assertStateRootIdentity();
    if (current !== this.incarnation_)
      throw new AutoMovieProductionInputRaceError(
        "Production state incarnation changed. Discard this project handle and open the project again before reading or mutating it.",
      );
    const registry = validateProductionRegistry(
      readOwnedJson(this.rootReal, this.registryPath),
      this.registryPath,
    );
    if (
      registry.productions.includes(this.productionId) === false ||
      productionIncarnationOf(registry.incarnations, this.productionId) !==
        this.productionIncarnation_
    )
      throw new AutoMovieProductionInputRaceError(
        `Production "${this.productionId}" was deleted or recreated. Discard this stale handle and open the current production namespace before reading or mutating it.`,
      );
    this.assertProductionNamespaceIdentities();
  }

  private productionNamespaceDirectories(): string[] {
    return [
      this.sharedDesignRoot,
      this.productionDesignRoot,
      this.productionStateRoot,
      resolveInside(
        resolveInside(this.root, this.manifest_.generatedRoot),
        this.productionSegment,
      ),
      resolveInside(
        resolveInside(this.root, this.manifest_.renderRoot),
        this.productionSegment,
      ),
    ];
  }

  private assertProductionNamespaceIdentities(): void {
    for (const ancestry of this.productionNamespaceAncestries_)
      assertPhysicalDirectoryAncestry(ancestry);
  }

  private assertStateRootIdentity(): void {
    const current = physicalDirectoryIdentityOrNull(this.automovieRoot);
    if (
      current === null ||
      directoryIdentityKey(current) !== this.automovieIdentity
    )
      throw new AutoMovieProductionInputRaceError(
        "Production state root identity changed. Discard this project handle and open the physical project state again before reading or mutating it.",
      );
  }

  private commitFiles(
    files: readonly IStagedFile[] | (() => readonly IStagedFile[]),
    inputCurrent?: () => boolean,
    expectedRevision: number = this.lastReadRevision_,
    outputCurrent?: () => void,
    publishEmptyRevision: boolean = true,
    sharedMutation: boolean = false,
  ): number {
    this.assertWritable();
    const stage = (pending: readonly IStagedFile[]) =>
      pending.map((file) => ({
        path: file.path,
        immutable: file.immutable === true,
        content:
          file.content === null
            ? null
            : typeof file.content === "string"
              ? Buffer.from(file.content, "utf8")
              : Buffer.from(file.content),
        previous: (() => {
          resolveInside(this.root, file.path);
          const ownerRoot = this.ownerRootFor(file.path);
          const ownerRootReal = ownedRootReal(this.rootReal, ownerRoot);
          assertRealAncestorInside(ownerRootReal, path.dirname(file.path));
          const linked = lstatOrNull(file.path);
          if (linked?.isSymbolicLink())
            throw new Error(
              `Owned target "${relativeToRoot(this.root, file.path)}" is a symlink or junction. Remove it before retrying the mutation.`,
            );
          return linked === null
            ? null
            : Buffer.from(
                readAutoMovieProductionOwnedFile({
                  root: ownerRootReal,
                  directory: ownerRootReal,
                  relative: path.relative(ownerRoot, file.path),
                }),
              );
        })(),
      }));
    const lazy = typeof files === "function" ? files : null;
    const eager = lazy === null ? (files as readonly IStagedFile[]) : null;
    const rootLease = acquireProductionRootNamespace(
      this.root,
      sharedMutation ? "@shared-design" : this.productionId,
    );
    try {
      if (
        rootLease.device !== this.rootDevice ||
        rootLease.inode !== this.rootInode
      )
        throw new AutoMovieProductionInputRaceError(
          "Production project root identity changed. Discard this project handle and open the physical project again before mutating it.",
        );
      assertProductionRootNamespaceLease(rootLease);
      this.assertIncarnation();
      const sharedToken = sharedMutation
        ? acquireCommitLock(this.sharedLockPath)
        : null;
      let token: string;
      try {
        token = acquireCommitLock(this.lockPath);
      } catch (error) {
        if (sharedToken !== null)
          releaseCommitLock(this.sharedLockPath, sharedToken);
        throw error;
      }
      let lockBoundToIncarnation = false;
      try {
        assertProductionRootNamespaceLease(rootLease);
        this.assertIncarnation();
        lockBoundToIncarnation = true;
        const current = readRevision(this.rootReal, this.revisionPath);
        if (current !== expectedRevision)
          throw new AutoMovieProductionInputRaceError(
            `Production revision changed from ${expectedRevision} to ${current}. Inspect the project again before retrying the mutation.`,
          );
        const nextRevision = requireNextRevision(current);
        if (inputCurrent?.() === false)
          throw new AutoMovieProductionInputRaceError(
            "Production inputs changed before the guarded commit began.",
          );
        assertProductionRootNamespaceLease(rootLease);
        this.assertIncarnation();
        const staged = stage(eager ?? lazy!());
        assertProductionRootNamespaceLease(rootLease);
        this.assertIncarnation();
        let applied = 0;
        try {
          for (const file of staged) {
            assertProductionRootNamespaceLease(rootLease);
            this.assertIncarnation();
            const assertMutationNamespace = (): void => {
              assertProductionRootNamespaceLease(rootLease);
              this.assertIncarnation();
            };
            if (file.content === null)
              removeAtomic(file.path, assertMutationNamespace);
            else if (file.immutable)
              writeAtomicImmutable(
                file.path,
                file.content,
                assertMutationNamespace,
                assertMutationNamespace,
              );
            else writeAtomic(file.path, file.content, assertMutationNamespace);
            assertProductionRootNamespaceLease(rootLease);
            this.assertIncarnation();
            ++applied;
          }
          if (inputCurrent?.() === false)
            throw new AutoMovieProductionInputRaceError(
              "Production inputs changed while the guarded commit was being applied.",
            );
          assertProductionRootNamespaceLease(rootLease);
          this.assertIncarnation();
          outputCurrent?.();
          assertProductionRootNamespaceLease(rootLease);
          this.assertIncarnation();
          if (staged.length === 0 && publishEmptyRevision === false) {
            this.lastReadRevision_ = current;
            return current;
          }
          assertProductionRootNamespaceLease(rootLease);
          this.assertIncarnation();
          writeJsonAtomic(
            this.revisionPath,
            {
              revision: nextRevision,
            },
            () => {
              assertProductionRootNamespaceLease(rootLease);
              this.assertIncarnation();
            },
          );
          assertProductionRootNamespaceLease(rootLease);
          this.assertIncarnation();
          this.lastReadRevision_ = nextRevision;
          return nextRevision;
        } catch (error) {
          try {
            assertProductionRootNamespaceLease(rootLease);
            this.assertIncarnation();
          } catch (identityError) {
            throw new AggregateError(
              [error, identityError],
              "Production mutation stopped because the physical root or namespace fence changed, or the production state incarnation changed. No stale-path rollback was attempted in the replacement namespace.",
            );
          }
          const rollbackErrors: unknown[] = [];
          for (const file of staged.slice(0, applied).reverse())
            try {
              assertProductionRootNamespaceLease(rootLease);
              this.assertIncarnation();
              const assertRollbackNamespace = (): void => {
                assertProductionRootNamespaceLease(rootLease);
                this.assertIncarnation();
              };
              if (file.previous === null)
                removeAtomic(file.path, assertRollbackNamespace);
              else
                writeAtomic(file.path, file.previous, assertRollbackNamespace);
              assertProductionRootNamespaceLease(rootLease);
              this.assertIncarnation();
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
        if (lockBoundToIncarnation === false)
          // Acquisition itself reached a replacement state root. The exact
          // owner token makes this resident cleanup safe; otherwise the new
          // namespace would inherit a permanent lock created by this attempt.
          releaseCommitLock(this.lockPath, token);
        else
          try {
            assertProductionRootNamespaceLease(rootLease);
            this.assertIncarnation();
            releaseCommitLock(this.lockPath, token);
          } catch {
            // Release only process-local ownership: never follow a stale
            // revision-lock path into a replacement root or state incarnation.
            releaseCommitLock(this.lockPath, token, { unlink: false });
          }
        if (sharedToken !== null)
          try {
            assertProductionRootNamespaceLease(rootLease);
            this.assertIncarnation();
            releaseCommitLock(this.sharedLockPath, sharedToken);
          } catch {
            releaseCommitLock(this.sharedLockPath, sharedToken, {
              unlink: false,
            });
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
        for (const entry of fileSystem
          .readdirSync(directory, { withFileTypes: true })
          .sort((left, right) => compareCodeUnits(left.name, right.name))) {
          const absolute = path.join(directory, entry.name);
          const status = fileSystem.lstatSync(absolute);
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
      const residentManifest = this.readTrackedStateFile(
        "generated-manifest.json",
      );
      if (
        residentManifest === null ||
        Buffer.from(residentManifest).equals(
          Buffer.from(serializedManifest, "utf8"),
        ) === false
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
  immutable?: boolean;
}

interface IAutoMovieRenderBundleReceipt {
  version: 1;
  bundle: string;
  manifestDigest: `sha256:${string}`;
}

interface IAutoMovieProductionRegistry {
  version: 1;
  layoutVersion: number;
  productions: string[];
  incarnations: Record<string, string>;
}

/**
 * Label used where an ownership-layout diagnostic once named a manifest file.
 */
/**
 * The legacy migration this project came from, read from the import record.
 *
 * The layout above is one constant every project shares, and this is the one
 * part of the retired manifest that was never a restatement of it: which v1
 * revision a project was migrated from is true of that project alone. It is
 * read from the import plan the importer already writes rather than copied
 * beside it, so a migrated project cannot disagree with its own provenance.
 */
const importedLegacyOf = (
  rootReal: string,
  automovieRoot: string,
): Pick<IAutoMovieProductionManifest, "importedLegacy"> => {
  const plan = readOwnedJson(
    rootReal,
    path.join(automovieRoot, "imports", "legacy-v1", "plan.json"),
  );
  if (typeof plan !== "object" || plan === null || Array.isArray(plan))
    return {};
  const revision = (plan as { legacyRevision?: unknown }).legacyRevision;
  if (typeof revision !== "number" || Number.isSafeInteger(revision) === false)
    return {};
  return { importedLegacy: { revision, sourceRoot: "." } };
};

const PROJECT_LAYOUT_LABEL = "the AutoMovie project layout";

/**
 * Where one production's own authored design records live.
 *
 * The instance path and the state-free static reader resolve the same
 * directory through this one function, so a project cannot be opened against
 * one design tree and read against another.
 */
const productionDesignRootOf = (root: string, productionId: string): string =>
  path.join(root, "automovie", "design", encodeId(productionId));

/**
 * The project ownership layout, which is the harness's own fixed shape rather
 * than a per-project declaration.
 *
 * This was a tracked `automovie/manifest.json` that every project carried a
 * copy of, and the copy could only ever restate what this constant already
 * says: the class synthesized exactly these values whenever the file was
 * missing. A per-project file that no project may vary is a second source of
 * one truth, so the constant is the only source now and `projectId` is derived
 * from the project directory.
 */
const PROJECT_LAYOUT = {
  formatVersion: 2,
  sourceRoots: ["src"],
  contentRoots: ["viewer", "scripts", "public"],
  contentFiles: ["vite.config.ts", "package.json", "package-lock.json"],
  generatedRoot: "generated",
  renderRoot: "renders",
  assetManifest: "automovie/assets.json",
  derivedArtifactManifest: "automovie/derived-artifacts.json",
} as const satisfies Omit<IAutoMovieProductionManifest, "projectId">;

const SHARED_DESIGN_DIRECTORIES = ["models", "formations"] as const;

const PRODUCTION_DESIGN_DIRECTORIES = [
  "shots",
  "acceptance",
  "screenplay",
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
const validateScreenplayIndex = (
  input: unknown,
): IValidation<IAutoMovieScreenplayIndex> =>
  typia.validateEquals<IAutoMovieScreenplayIndex>(input);

const readOwnedTypedJson = <T>(
  rootReal: string,
  file: string,
  validate: (input: unknown) => IValidation<T>,
): T | null => {
  const value = readOwnedJson(rootReal, file);
  if (value === undefined) return null;
  const result = validate(value);
  if (result.success) return result.data;
  throw new Error(
    `Invalid AutoMovie file "${file}": ${result.errors
      .map((error) => `${error.path} expects ${error.expected}`)
      .join("; ")}. Correct the owning file before continuing.`,
  );
};

const readOwnedJson = (rootReal: string, file: string): unknown => {
  assertOwnedRegularFile(rootReal, file);
  let bytes: Uint8Array;
  try {
    bytes = readAutoMovieProductionOwnedFile({
      root: rootReal,
      directory: path.dirname(file),
      relative: path.basename(file),
    });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
  try {
    return JSON.parse(Buffer.from(bytes).toString("utf8")) as unknown;
  } catch (error) {
    throw new Error(
      `Invalid AutoMovie JSON "${file}": ${String(error)}. Correct the file before continuing.`,
    );
  }
};

const validateProductionRegistry = (
  value: unknown,
  file: string,
): IAutoMovieProductionRegistry => {
  const record = value as Partial<IAutoMovieProductionRegistry> | null;
  if (
    record === null ||
    record === undefined ||
    record.version !== 1 ||
    (record.layoutVersion !== 0 && record.layoutVersion !== 1) ||
    Array.isArray(record.productions) === false ||
    record.productions.some(
      (production) =>
        typeof production !== "string" ||
        production.trim().length === 0 ||
        production.trim() !== production,
    )
  )
    throw new Error(
      `Invalid production registry "${file}". Restore version 1 with a trimmed, portable production id list.`,
    );
  const spellings = new Map<string, string>();
  for (const production of record.productions) {
    validateProductionId(production);
    const folded = portableProductionKey(production);
    const previous = spellings.get(folded);
    if (previous !== undefined)
      throw new Error(
        `Invalid production registry "${file}": production "${production}" collides with "${previous}". Keep one portable id spelling.`,
      );
    spellings.set(folded, production);
  }
  const incarnationRecord =
    record.incarnations === undefined ? {} : record.incarnations;
  if (
    typeof incarnationRecord !== "object" ||
    incarnationRecord === null ||
    Array.isArray(incarnationRecord) ||
    Object.entries(incarnationRecord).some(
      ([production, incarnation]) =>
        record.productions!.includes(production) === false ||
        isUuid(incarnation) === false,
    )
  )
    throw new Error(
      `Invalid production registry "${file}". Production incarnations must be UUIDs keyed only by registered production ids.`,
    );
  return {
    version: 1,
    layoutVersion: record.layoutVersion,
    productions: [...record.productions].sort(compareCodeUnits),
    incarnations: Object.fromEntries(Object.entries(incarnationRecord)),
  };
};

const productionIncarnationOf = (
  incarnations: Record<string, string>,
  productionId: string,
): string | undefined =>
  Object.hasOwn(incarnations, productionId)
    ? incarnations[productionId]
    : undefined;

const setProductionIncarnation = (
  incarnations: Record<string, string>,
  productionId: string,
  incarnation: string,
): void => {
  Object.defineProperty(incarnations, productionId, {
    configurable: true,
    enumerable: true,
    value: incarnation,
    writable: true,
  });
};

const legacyProductionId = (
  rootReal: string,
  automovieRoot: string,
): string | null => {
  const value = readOwnedJson(
    rootReal,
    path.join(automovieRoot, "design", "production.json"),
  );
  const id = (
    value as
      | {
          id?: unknown;
        }
      | null
      | undefined
  )?.id;
  if (id === undefined) return null;
  if (typeof id !== "string" || id.trim().length === 0 || id.trim() !== id)
    throw new Error(
      `Legacy production design has an invalid id in "${path.join(
        automovieRoot,
        "design",
        "production.json",
      )}". Correct it to one trimmed non-empty production id before migration.`,
    );
  return id;
};

const validateRealOwnershipLayout = (
  rootReal: string,
  root: string,
  manifest: IAutoMovieProductionManifest,
  file: string,
): void => {
  assertOwnedRootDirectory(rootReal, path.join(root, "automovie"));
  for (const entry of [
    ...manifest.sourceRoots.map((relative, index) => ({
      owner: `sourceRoots[${index}]`,
      relative,
    })),
    { owner: "generatedRoot", relative: manifest.generatedRoot },
    { owner: "renderRoot", relative: manifest.renderRoot },
  ]) {
    const absolute = resolveInside(root, entry.relative);
    assertOwnedRootDirectory(rootReal, absolute);
  }
  for (const [index, relative] of PROJECT_LAYOUT.contentRoots.entries()) {
    const absolute = resolveInside(root, relative);
    const linked = lstatOrNull(absolute);
    // Absence is a shape, not a fault. The layout is one constant covering both
    // a scaffolded production and a bare project that a legacy import or a
    // first compile just created, and only the first carries viewer, scripts,
    // and public. This requirement read as existence while the layout was a
    // per-project file: declaring a content root there was the project's own
    // claim to have it. A constant claims nothing on a project's behalf, so
    // what survives is the escape it was written to refuse.
    if (linked === null) continue;
    if (linked.isSymbolicLink() || linked.isDirectory() === false)
      throw new Error(
        `Invalid production manifest "${file}": contentRoots[${index}] "${relative}" must be a physical project directory rather than a link or a file.`,
      );
    const real = fileSystem.realpathSync(absolute);
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
      if (acceptanceAddressesShot(acceptance, target.id))
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

type AutoMovieMutationConsequenceReviewTarget = Exclude<
  IAutoMovieReviewTarget,
  { kind: "subject" }
>;

interface IAutoMovieMutationConsequences extends Omit<
  IAutoMovieDesignMutationConsequences,
  "staleReviews"
> {
  staleReviews: AutoMovieMutationConsequenceReviewTarget[];
}

const consequencesOf = (
  graph: IAutoMovieProductionDesignGraph,
  target: IAutoMovieDesignTarget,
  generatedPaths: readonly string[],
  screenplay: IAutoMovieScreenplayIndex | null,
): IAutoMovieMutationConsequences => {
  const staleReviews = new Map<
    string,
    AutoMovieMutationConsequenceReviewTarget
  >();
  const addReview = (
    review: AutoMovieMutationConsequenceReviewTarget,
  ): void => {
    staleReviews.set(reviewConsequenceKey(review), review);
  };
  addReview({ kind: "design", design: target });
  const affectedFormations = new Set<string>();
  const affectedShots = new Set<string>();
  if (target.kind === "model") {
    addReview({ kind: "asset", id: target.id });
    for (const [id] of graph.models)
      if (modelRecipeDependsOn(graph, id, target.id)) {
        addReview({
          kind: "design",
          design: { kind: "model", id },
        });
        addReview({ kind: "asset", id });
      }
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
      if (acceptanceAddressesShot(acceptance, target.id))
        addReview({
          kind: "design",
          design: { kind: "acceptance", id },
        });
  }
  if (target.kind === "acceptance") {
    const acceptance = graph.acceptance.get(target.id);
    if (acceptance?.target.kind === "shot")
      affectedShots.add(acceptance.target.id);
    if (acceptance !== undefined)
      for (const shot of acceptanceCriterionShots(acceptance))
        affectedShots.add(shot);
  }
  if (target.kind === "production")
    for (const [id, acceptance] of graph.acceptance)
      if (acceptance.target.kind === "film")
        addReview({
          kind: "design",
          design: { kind: "acceptance", id },
        });
  for (const id of affectedShots) {
    addReview({ kind: "shot", id });
    if (graph.production?.visualDelivery !== "deterministic")
      addReview({ kind: "rendition", id });
  }
  for (const id of affectedSequenceIds(graph, screenplay, affectedShots))
    addReview({ kind: "sequence", id });
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

const affectedSequenceIds = (
  graph: IAutoMovieProductionDesignGraph,
  screenplay: IAutoMovieScreenplayIndex | null,
  affectedShots: ReadonlySet<string>,
): string[] => {
  if (screenplay === null || affectedShots.size === 0) return [];
  const affectedScenes = new Set(
    [...affectedShots].flatMap(
      (id) =>
        graph.shots.get(id)?.evidence?.map((evidence) => evidence.scene) ?? [],
    ),
  );
  return screenplay.treatment.sequences
    .filter((sequence) => {
      const beats = new Set(sequence.beats.map((beat) => beat.text));
      return screenplay.screenplay.scenes.some(
        (scene) =>
          scene.status === "active" &&
          affectedScenes.has(scene.id) &&
          scene.covers.some((coverage) => beats.has(coverage.beat)),
      );
    })
    .map((sequence) => sequence.id)
    .sort(compareCodeUnits);
};

const mergeMutationConsequences = (
  current: IAutoMovieMutationConsequences,
  next: IAutoMovieMutationConsequences,
  includeRenditions: boolean,
): IAutoMovieMutationConsequences => {
  const staleReviews = new Map<
    string,
    AutoMovieMutationConsequenceReviewTarget
  >();
  for (const target of [...current.staleReviews, ...next.staleReviews])
    if (target.kind !== "rendition" || includeRenditions)
      staleReviews.set(reviewConsequenceKey(target), target);
  return {
    staleReviews: [...staleReviews.values()].sort((left, right) =>
      compareCodeUnits(reviewConsequenceKey(left), reviewConsequenceKey(right)),
    ),
    staleRenders: [
      ...new Set([...current.staleRenders, ...next.staleRenders]),
    ].sort(compareCodeUnits),
    removedGenerated: [
      ...new Set([...current.removedGenerated, ...next.removedGenerated]),
    ].sort(compareCodeUnits),
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

const reviewConsequenceKey = (
  target: AutoMovieMutationConsequenceReviewTarget,
): string => {
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

const repaintAttemptPath = (requestId: string, attemptId: string): string =>
  path.posix.join(
    "renditions",
    "attempts",
    encodeAutoMoviePathSegment(uuid(requestId, "Repaint request id")),
    `${encodeAutoMoviePathSegment(uuid(attemptId, "Repaint attempt id"))}.json`,
  );

const repaintAttemptClaimPath = (requestId: string): string =>
  path.posix.join(
    "renditions",
    "claims",
    `${encodeAutoMoviePathSegment(uuid(requestId, "Repaint request id"))}.json`,
  );

const repaintSelectionPath = (shot: string, selectionId: string): string =>
  path.posix.join(
    "renditions",
    "selections",
    encodeAutoMoviePathSegment(trimmedText(shot, "Repaint shot")),
    `${encodeAutoMoviePathSegment(uuid(selectionId, "Repaint selection id"))}.json`,
  );

const uuid = (value: string, label: string): string => {
  if (
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(
      value,
    ) === false
  )
    throw new Error(`${label} must be a UUID v4.`);
  return value;
};

const trimmedText = (value: string, label: string): string => {
  if (value.trim().length === 0 || value !== value.trim())
    throw new Error(`${label} must be trimmed and non-empty.`);
  return value;
};

const temporaryPath = (file: string, operation: "tmp" | "delete"): string =>
  `${file}.${operation}.${process.pid}.${randomUUID()}`;

interface IProductionAtomicFailure {
  error: unknown;
}

class ProductionAtomicCleanupError extends AggregateError {}

class ProductionAtomicRecoveryError extends AggregateError {}

class ProductionAtomicContentionError extends AggregateError {}

/**
 * The codes a publish collides with while another process holds the target.
 *
 * On Windows a rename onto an existing path fails outright when anything else
 * has a handle open on it, and everything ordinary holds one: an antivirus
 * scanner reading a file the compiler just wrote, the search indexer, a viewer
 * page with project state open, a sibling command a second ahead. POSIX renames
 * over an open file without complaint, so this whole guard is a Windows fault on
 * a platform this repository supports rather than a portability nicety.
 *
 * The distinction that matters is that the collision is **transient**. The same
 * rename a few milliseconds later succeeds, because the other handle was never
 * going to be held for long. A permission fault that is not transient carries
 * one of these codes too, which is why the retry is bounded and why what it
 * finally throws still names what actually happened.
 */
const CONTENDED_ATOMIC_CODES: ReadonlySet<string> = new Set([
  "EPERM",
  "EACCES",
  "EBUSY",
]);

/**
 * How many times a contended atomic step is attempted, and the pause between.
 *
 * The pause grows with the attempt so a scanner that took the handle for tens
 * of milliseconds is waited out without making the uncontended path slower: the
 * first attempt is the ordinary one and costs nothing extra, and only a file
 * that actually collided ever pauses. Five attempts spend at most 300 ms before
 * giving up, which is short enough that a genuine permission fault still reads
 * as a refusal rather than as a hang.
 */
const CONTENDED_ATOMIC_ATTEMPTS = 5;
const CONTENDED_ATOMIC_PAUSE_MS = 20;

const isContendedAtomicError = (error: unknown): boolean =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  typeof (error as { code: unknown }).code === "string" &&
  CONTENDED_ATOMIC_CODES.has((error as { code: string }).code);

/**
 * Wait without yielding, because every caller here is synchronous.
 *
 * The atomic publish path is called from constructors and from compile steps
 * that are not promises, so there is no await to reach for. Blocking the thread
 * is the correct behaviour rather than a compromise: the work that follows the
 * publish depends on it having happened.
 */
const pauseAtomicRetry = (milliseconds: number): void => {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, milliseconds);
};

/**
 * Run one atomic filesystem step, surviving a contended target.
 *
 * A code outside {@link CONTENDED_ATOMIC_CODES} is thrown immediately and
 * unchanged, because retrying an error this does not understand would turn a
 * clear refusal into a slow one. A contended code that outlives every attempt
 * is thrown as {@link ProductionAtomicContentionError} carrying the original,
 * because the caller's real problem by then is not the rename: the project has
 * a compiler-owned file that did not land, and the next command will read that
 * as state being merely out of date and tell the author to rerun the thing that
 * just died.
 */
const runContendedAtomic = <T>(step: () => T, describe: () => string): T => {
  for (let attempt = 1; attempt < CONTENDED_ATOMIC_ATTEMPTS; ++attempt)
    try {
      return step();
    } catch (error) {
      if (isContendedAtomicError(error) === false) throw error;
      pauseAtomicRetry(CONTENDED_ATOMIC_PAUSE_MS * attempt);
    }
  try {
    return step();
  } catch (error) {
    if (isContendedAtomicError(error) === false) throw error;
    throw new ProductionAtomicContentionError(
      [error],
      `${describe()} after ${CONTENDED_ATOMIC_ATTEMPTS} attempts against a held handle. The compiler-owned file did not land, so the project may still describe an input it no longer has. Close whatever holds the path and run the command again.`,
    );
  }
};

const renameContendedAtomic = (from: string, to: string): void =>
  runContendedAtomic(
    () => fileSystem.renameSync(from, to),
    () => `Production atomic publish of "${to}" failed`,
  );

const removeContendedAtomic = (file: string): void =>
  runContendedAtomic(
    () => fileSystem.rmSync(file, { force: true }),
    () => `Production atomic removal of "${file}" failed`,
  );

const removeAtomicTemporary = (
  temporary: string,
  failure: IProductionAtomicFailure | undefined,
): void => {
  try {
    removeContendedAtomic(temporary);
  } catch (cleanupFailure) {
    if (failure === undefined) throw cleanupFailure;
    throw new ProductionAtomicCleanupError(
      [failure.error, cleanupFailure],
      `Production atomic write cleanup failed after the operation failed: ${temporary}.`,
    );
  }
};

const writeAtomic = (
  file: string,
  content: Uint8Array,
  beforePublish: () => void = () => undefined,
  afterPublish: () => void = () => undefined,
): void => {
  fileSystem.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = temporaryPath(file, "tmp");
  let failure: IProductionAtomicFailure | undefined;
  try {
    fileSystem.writeFileSync(temporary, content);
    beforePublish();
    renameContendedAtomic(temporary, file);
    afterPublish();
  } catch (error) {
    failure = { error };
    throw error;
  } finally {
    removeAtomicTemporary(temporary, failure);
  }
};

/** Publish complete bytes at a path that no generation may replace. */
const writeAtomicImmutable = (
  file: string,
  content: Uint8Array,
  beforePublish: () => void,
  afterPublish: () => void,
): void => {
  fileSystem.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = temporaryPath(file, "tmp");
  let failure: IProductionAtomicFailure | undefined;
  try {
    fileSystem.writeFileSync(temporary, content);
    beforePublish();
    try {
      fileSystem.linkSync(temporary, file);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "EEXIST")
        throw new AutoMovieProductionInputRaceError(
          `Immutable publication target "${file}" already exists. Reopen its exact bytes instead of replacing it.`,
        );
      throw error;
    }
    afterPublish();
  } catch (error) {
    failure = { error };
    throw error;
  } finally {
    removeAtomicTemporary(temporary, failure);
  }
};

const removeAtomic = (file: string, afterQuarantine: () => void): void => {
  if (lstatOrNull(file) === null) {
    afterQuarantine();
    return;
  }
  const quarantine = temporaryPath(file, "delete");
  renameContendedAtomic(file, quarantine);
  try {
    afterQuarantine();
    removeContendedAtomic(quarantine);
  } catch (error) {
    try {
      if (lstatOrNull(quarantine) !== null && lstatOrNull(file) === null)
        renameContendedAtomic(quarantine, file);
    } catch (recoveryFailure) {
      throw new ProductionAtomicRecoveryError(
        [error, recoveryFailure],
        `Production atomic delete recovery failed after the operation failed: ${file}.`,
      );
    }
    throw error;
  }
};

const writeJsonAtomic = (
  file: string,
  value: unknown,
  beforePublish?: () => void,
): void =>
  writeAtomic(file, Buffer.from(serializeJson(value), "utf8"), beforePublish);

const lstatOrNull = (file: string): Stats | null => {
  try {
    return fileSystem.lstatSync(file);
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

interface IPhysicalDirectoryIdentity {
  device: string;
  inode: string;
}

interface IPhysicalDirectoryAncestry {
  directories: ReadonlyArray<
    IPhysicalDirectoryIdentity & {
      path: string;
    }
  >;
}

const physicalDirectoryIdentityOrNull = (
  directory: string,
): IPhysicalDirectoryIdentity | null => {
  const linked = lstatOrNull(directory);
  if (
    linked === null ||
    linked.isSymbolicLink() ||
    linked.isDirectory() === false
  )
    return null;
  const status = fileSystem.statSync(directory, { bigint: true });
  return {
    device: status.dev.toString(),
    inode: status.ino.toString(),
  };
};

const acquirePhysicalDirectoryAncestry = (
  root: string,
  directory: string,
): IPhysicalDirectoryAncestry => {
  const rootPath = path.resolve(root);
  const candidate = path.resolve(directory);
  const relative = path.relative(rootPath, candidate);
  const directories: Array<
    IPhysicalDirectoryIdentity & {
      path: string;
    }
  > = [];
  let current = rootPath;
  for (const segment of [
    "",
    ...(relative === "" ? [] : relative.split(path.sep)),
  ]) {
    if (segment !== "") current = path.join(current, segment);
    const identity = physicalDirectoryIdentityOrNull(current);
    if (identity === null)
      throw new Error(
        `Owned directory "${current}" is not a physical directory.`,
      );
    directories.push({
      path: current,
      ...identity,
    });
  }
  return { directories };
};

const assertPhysicalDirectoryAncestry = (
  ancestry: IPhysicalDirectoryAncestry,
): void => {
  const changed = ancestry.directories.find((expected) => {
    const current = physicalDirectoryIdentityOrNull(expected.path);
    return (
      current === null ||
      directoryIdentityKey(current) !== directoryIdentityKey(expected)
    );
  });
  if (changed !== undefined)
    throw new Error(
      `Owned directory "${changed.path}" changed physical identity. Discard this stale project handle and reopen the physical production namespace.`,
    );
};

const fileIdentityKey = (status: BigIntStats): string =>
  `${status.dev}\0${status.ino}`;

const directoryIdentityKey = (identity: IPhysicalDirectoryIdentity): string =>
  `${identity.device}\0${identity.inode}`;

const assertOwnedRegularFile = (rootReal: string, file: string): void => {
  const linked = lstatOrNull(file);
  if (linked === null) return;
  if (linked.isSymbolicLink())
    throw new Error(
      `Owned file "${file}" is a symlink. Replace it with a project-local regular file.`,
    );
  const real = fileSystem.realpathSync(file);
  if (isInside(rootReal, real) === false)
    throw new Error(
      `Owned file "${file}" escapes the production root. Replace the link with a project-local file.`,
    );
  if (linked.isFile() === false)
    throw new Error(`Owned path "${file}" is not a regular file.`);
};

const readRevision = (rootReal: string, file: string): number => {
  const value = readOwnedJson(rootReal, file);
  const decision = decodeAutoMovieProjectRevision(value);
  if (decision.state === "invalid")
    throw new Error(
      `Invalid production revision "${file}". Restore a non-negative safe integer revision.`,
    );
  return decision.revision;
};

const requireNextRevision = (revision: number): number => {
  const decision = advanceAutoMovieProjectRevision(revision);
  if (decision.state === "next") return decision.revision;
  throw new Error(
    decision.state === "exhausted"
      ? "Production revision is exhausted. No production bytes were written because the store cannot publish another safe-integer revision."
      : "Production revision is invalid. No production bytes were written.",
  );
};

const validateIncarnation = (value: unknown, file: string): string => {
  const version = (
    value as { version?: unknown; id?: unknown } | null | undefined
  )?.version;
  const id = (value as { version?: unknown; id?: unknown } | null | undefined)
    ?.id;
  if (version !== 1 || isUuid(id) === false)
    throw new Error(
      `Invalid production state incarnation "${file}". Reopen a complete, physical AutoMovie project state.`,
    );
  return id;
};

const isUuid = (value: unknown): value is string =>
  typeof value === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u.test(
    value,
  );

/**
 * The project's own declared identity.
 *
 * A tracked manifest used to carry a `projectId` copied from the same template
 * value that names the package, so the identity was written twice and the two
 * could disagree. `package.json` is the one place a project already states its
 * name, and the directory basename remains the fallback for a checkout that
 * has none.
 */
const projectIdOf = (root: string): string => {
  try {
    const declared: unknown = JSON.parse(
      fileSystem.readFileSync(path.join(root, "package.json"), "utf8"),
    );
    const name = (declared as { name?: unknown } | null)?.name;
    if (typeof name === "string" && name.trim().length > 0) return name.trim();
  } catch {
    /* a project without a readable declaration falls back to its directory. */
  }
  return path.basename(root).trim();
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

const isSharedDesign = (target: IAutoMovieDesignTarget): boolean =>
  target.kind === "model" ||
  target.kind === "world" ||
  target.kind === "formation";

const encodeId = (id: string): string => {
  if (id.trim().length === 0)
    throw new Error("AutoMovie design and review ids must not be blank.");
  return encodeAutoMoviePathSegment(id);
};

const validateProductionId = (id: string): void => {
  if (
    id.trim().length === 0 ||
    id.trim() !== id ||
    id === "." ||
    id === ".." ||
    id.endsWith(".")
  )
    throw new Error(
      `Production id "${id}" must be trimmed, non-empty, and must not be ".", "..", or end in a dot. Choose one portable directory identity.`,
    );
  encodeId(id);
};

const portableProductionKey = (id: string): string =>
  encodeId(id).toLowerCase();

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

/**
 * Canonical render-root-relative bundle path for one manifest identity.
 */
export const productionRenderBundleRelativePath = (
  manifest: Pick<
    IAutoMovieRenderBundleManifest,
    | "target"
    | "dialogueRuntimeIdentity"
    | "rendererIdentity"
    | "targetFingerprint"
    | "renderSpec"
  >,
): string => {
  const renderSpecFingerprint = digestAutoMovieBytes(
    canonicalAutoMovieJsonBytes({
      target: manifest.target,
      dialogueRuntimeIdentity: manifest.dialogueRuntimeIdentity,
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

const canonicalProductionRenderPath = (value: string): string => {
  if (isPortableProductionPublicationPath(value) === false)
    throw new Error(
      `Render publication path "${value}" is not one canonical portable relative path.`,
    );
  return value;
};

const normalizeSlash = (value: string): string =>
  value.split(path.sep).join("/");

const safeProjectErrorMessage = (error: unknown): string => {
  try {
    return error instanceof Error ? error.message : "";
  } catch {
    return "";
  }
};

const classifyCurrentRepaintReceiptError = (
  error: unknown,
): {
  stage: "receipt" | "currentness" | "output";
  failure: "identity-invalid" | "stale" | "render-corrupt";
} => {
  const message = safeProjectErrorMessage(error).toLowerCase();
  let inputRace = false;
  try {
    inputRace = error instanceof AutoMovieProductionInputRaceError;
  } catch {
    inputRace = false;
  }
  if (
    inputRace ||
    message.includes("stale") ||
    message.includes("current compiler input")
  )
    return { stage: "currentness", failure: "stale" };
  if (
    message.includes("identity") ||
    message.includes("receipt") ||
    message.includes("attempt ledger") ||
    message.includes("execution policy") ||
    message.includes("reference")
  )
    return { stage: "receipt", failure: "identity-invalid" };
  return { stage: "output", failure: "render-corrupt" };
};

const assertRealAncestorInside = (
  rootReal: string,
  candidate: string,
): string => {
  let existing = candidate;
  while (fileSystem.existsSync(existing) === false)
    existing = path.dirname(existing);
  const real = fileSystem.realpathSync(existing);
  if (isInside(rootReal, real) === false)
    throw new Error(
      `Owned path "${candidate}" escapes the production root through "${existing}". Replace the symlink or junction with a project-local directory.`,
    );
  return real;
};

/**
 * Reject every existing link in an owned directory chain.
 *
 * A realpath-inside check alone accepts an internal alias such as `design/beta
 * -> design/alpha`; walking lstat identities keeps logical production leaves
 * physically disjoint even when both targets are in-project.
 */
const assertPhysicalDirectoryAncestors = (
  projectRootReal: string,
  directory: string,
  allowMissingTail: boolean,
): void => {
  const resolved = path.resolve(directory);
  const relative = path.relative(projectRootReal, resolved);
  let current = projectRootReal;
  for (const segment of relative === "" ? [] : relative.split(path.sep)) {
    current = path.join(current, segment);
    const linked = lstatOrNull(current);
    if (linked === null) {
      if (allowMissingTail) return;
      throw new Error(`Owned directory "${current}" does not exist.`);
    }
    if (linked.isSymbolicLink() || linked.isDirectory() === false)
      throw new Error(
        `Owned directory "${current}" is not a physical directory. Replace every symlink or junction with a project-owned directory.`,
      );
  }
};

const assertOwnedRootDirectory = (
  projectRootReal: string,
  directory: string,
): void => {
  const ancestry = acquirePhysicalDirectoryAncestry(projectRootReal, directory);
  assertRealAncestorInside(projectRootReal, directory);
  assertPhysicalDirectoryAncestry(ancestry);
};

const ownedRootReal = (projectRootReal: string, directory: string): string => {
  const linked = fileSystem.lstatSync(directory);
  if (linked.isSymbolicLink() || linked.isDirectory() === false)
    throw new Error(
      `Owned root "${directory}" was replaced by a symlink, junction, or non-directory. Restore its physical project directory.`,
    );
  return assertRealAncestorInside(projectRootReal, directory);
};

const relativeToRoot = (root: string, file: string): string =>
  path.relative(root, file).split(path.sep).join("/");
