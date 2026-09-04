import { CAT_GAITS, HORSE_GAITS, HUMANOID_GAITS } from "@automovie/archetypes";
import {
  IAutoMovieActorContext,
  type IAutoMovieCameraClearanceRuntime,
  type IAutoMovieFormationPlacement,
  autoMovieModelGaits,
  compileDefinedShot,
  defineShot,
  formationSlotPosition,
  heightAt,
  importedNodeClipToAutoMovieMotion,
  inheritProductionLighting,
  makeActorSynthesizer,
  placeFormationSlot,
  readAutoMovieImageFacts,
  realizeShotContract,
  resolveAutoMovieMaterial,
  retargetHumanoidMotion,
  sampleFormationMotion,
  sampleFormationSlotMotion,
  unsupportedAutoMovieMaterialExtensions,
  validateAutoMovieEnvironmentContext,
  validateAutoMovieSoftFurnishingDomainOwnership,
  validateBuiltEnvironment,
  validateDesignLineage,
  validateDesignLineageBinding,
  validateFluidDomain,
  validateModel,
  validateMotion,
  validatePlantingDomain,
  validatePlantingInstallations,
  validatePropPlacements,
  validateServiceNetwork,
  validateShotArtifact,
  validateSoftBodyDomain,
  validateSoftFurnishings,
  validateTextureAssets,
  validateWaterFeatures,
  validateWetZones,
} from "@automovie/engine";
import type { IAutoMovieProductionEvidence } from "@automovie/evidence";
import {
  type IAutoMovieExternalMotionAdoption as IAutoMovieIngestExternalMotionAdoption,
  adoptAutoMovieExternalMotion,
  inspectAutoMovieExternalModelBytes,
} from "@automovie/ingest";
import {
  AutoMovieContentDigest,
  AutoMovieDiagnosticCode,
  AutoMovieHumanoidBone,
  IAutoMovieAcceptanceScenario,
  IAutoMovieAssetManifest,
  IAutoMovieAssetProvenance,
  IAutoMovieBeatEndState,
  IAutoMovieCompileProjectInput,
  IAutoMovieCompileProjectOutput,
  IAutoMovieCompiledContractRealization,
  IAutoMovieCompiledFilmEdit,
  IAutoMovieCompiledFormation,
  IAutoMovieCompiledShotSource,
  IAutoMovieConstraintViolation,
  IAutoMovieDefinedShotContract,
  IAutoMovieDesignEvidence,
  IAutoMovieDesignLineage,
  IAutoMovieDesignReference,
  IAutoMovieDiagnostic,
  IAutoMovieEnvironmentContext,
  IAutoMovieExternalMotionBasis,
  IAutoMovieExternalMotionConversionReceipt,
  IAutoMovieExternalMotionLossEntry,
  IAutoMovieExternalMotionReceiptCharacterization,
  IAutoMovieExternalMotionTake,
  IAutoMovieExternalMotionTransformActivity,
  IAutoMovieFilmBuildContext,
  IAutoMovieFilmEdit,
  IAutoMovieFilmTimeline,
  IAutoMovieFormationMotion,
  IAutoMovieFormationSlotMotion,
  IAutoMovieGeneratedCollisionProxy,
  IAutoMovieGeneratedFile,
  IAutoMovieGeneratedManifest,
  IAutoMovieGeneratedMeasurementProxy,
  IAutoMovieLibraryBuildContext,
  IAutoMovieLibraryContribution,
  IAutoMovieMaterializedFile,
  IAutoMovieModel,
  IAutoMovieModelProxyAsset,
  IAutoMovieModelRecipe,
  IAutoMovieMotion,
  IAutoMovieProductionDesign,
  IAutoMovieExternalMotionAdoption as IAutoMovieProductionExternalMotionAdoption,
  IAutoMovieProductionManifest,
  IAutoMovieProductionMediaProbe,
  IAutoMovieProductionRenderManifest,
  IAutoMovieProductionRenderReceipt,
  IAutoMovieProductionShotProgram,
  IAutoMovieRenderBundleManifest,
  IAutoMovieScene,
  IAutoMovieScreenplayIndex,
  IAutoMovieShotBuildContext,
  IAutoMovieShotContract,
  IAutoMovieShotSourceOutput,
  IAutoMovieSkeleton,
  IAutoMovieSpace,
  IAutoMovieValidation,
  IAutoMovieVector3,
  IAutoMovieVideoEdit,
  IAutoMovieWorldDesign,
} from "@automovie/interface";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript-compiler";
import typia, { IValidation } from "typia";

import { validateSceneArtifact } from "../validators/artifacts";
import {
  AutoMovieProductionInputRaceError,
  AutoMovieProductionProject,
  AutoMovieProductionSourcePathError,
  IAutoMovieProductionContentInput,
} from "./AutoMovieProductionProject";
import {
  assetAcquisitionIncomplete,
  assetProcessingOmitted,
} from "./assetAcquisition";
import { parseAutoMovieCaptionLanguage } from "./captionLanguage";
import {
  AUTOMOVIE_COMPILE_FINGERPRINT_PROTOCOL,
  IAutoMovieFingerprintField,
  canonicalAutoMovieJsonBytes,
  compareCodeUnits,
  digestAutoMovieBytes,
  encodeAutoMoviePathSegment,
  fingerprintAutoMovieFields,
  normalizeAutoMovieSource,
} from "./contentIdentity";
import { inspectAutoMovieDerivedArtifacts } from "./derivedArtifacts";
import { designReferenceDiagnostics } from "./designReferenceDiagnostics";
import { filmGrammarDiagnostics } from "./filmGrammarDiagnostics";
import { readAutoMovieFilmTimeline } from "./filmTimeline";
import { autoMovieLibraryArtifactSourceTargets } from "./libraryArtifactTargets";
import {
  IAutoMovieLibraryAuthoringSnapshot,
  captureAutoMovieLibraryAuthoringSnapshot,
  createAutoMovieLibrarySourceExecutionPlan,
  sameAutoMovieLibraryAuthoringSnapshot,
} from "./libraryAuthoringSnapshot";
import { autoMovieLibraryContributionDiagnostics } from "./libraryContributionContract";
import { libraryReviewEvidenceConsumerDiagnostics } from "./libraryReviewEvidenceConsumer";
import {
  AUTOMOVIE_SANDBOX_MODULE_EXPORTS,
  isProjectSourceSpecifier,
  linkProductionSource,
} from "./linkProductionSource";
import {
  IAutoMovieExternalModelRuntimeBinding,
  IAutoMovieMaterializedLibraryResult,
  materializeAutoMovieLibraryFiles,
  materializeCompiledFormationInventory,
  materializeCompiledInstanceSetInventory,
  materializeCompiledShot,
  materializeProductionModels,
} from "./materializeProduction";
import { assertProductionFeatureUsesRenditionClips } from "./muxProductionFeatureMp4";
import { probeProductionMedia } from "./probeProductionMedia";
import { AutoMovieModelArchetypeRegistry } from "./productionArchetypes";
import { productionRenderTargetFingerprint } from "./renderIdentity";
import {
  assetReviewEvidenceDiagnostics,
  consumedModelIds,
  reviewEvidenceDiagnostics,
} from "./reviewEvidenceDiagnostics";
import {
  AUTOMOVIE_SANDBOX_BRIDGED_ENGINE_EXPORTS,
  callAutoMovieSandboxEngine,
} from "./sandboxEngineBridge";
import {
  AUTOMOVIE_SANDBOX_ENGINE_SPECIFIER,
  AUTOMOVIE_SANDBOX_ENGINE_SURFACE,
  autoMovieSandboxEngineImportRefusal,
} from "./sandboxEngineSurface";
import { screenplayLedgerDiagnostics } from "./screenplayLedgerDiagnostics";
import { screenplayProseDiagnostics } from "./screenplayProseDiagnostics";
import { screenplayTimingDiagnostics } from "./screenplayTimingDiagnostics";
import { shotDeterminismDiagnostics } from "./shotDeterminismDiagnostics";
import {
  IAutoMovieSourceContentFinding,
  autoMovieSourceContentDiagnostic,
  autoMovieSourceContentFinding,
  autoMovieValidationFindings,
} from "./sourceContentDiagnostics";
import { resolveAutoMovieSourceOwnerBinding } from "./sourceOwnerBinding";
import { createAutoMovieSourceRuntimeModelRegistry } from "./sourceRuntimeModelRegistry";
import { storySyncDiagnostics } from "./storySyncDiagnostics";
import {
  IAutoMovieProductionDesignGraph,
  validateAutoMovieProductionGraph,
} from "./validateProductionDesign";

/**
 * Production compiler protocol embedded in generated manifests.
 *
 * Bumped whenever the shape of a generated artifact changes, so an older
 * generated tree is recognised as older rather than silently misread as
 * current. This revision added a per-member cue channel, a ground sample per
 * member, and a story clock; each of those is a field a v7 reader would not
 * find where it expects one. It also dropped `phase.periodSeconds` from a
 * compiled formation, because a cycle's period is now measured from the baked
 * motion rather than written down beside it -- so a v7 reader would look for
 * that one where it is no longer written.
 *
 * @author Samchon
 */
export const AUTOMOVIE_PRODUCTION_COMPILER_PROTOCOL = "automovie.compiler.v9";

const FILM_SOURCE_PATH = "src/film.ts";
const FILM_SOURCE_EXPORT = "film";

/**
 * Compiler package version used in generated identity.
 *
 * @author Samchon
 */
export const AUTOMOVIE_PRODUCTION_COMPILER_VERSION =
  // A static specifier rather than a path built at run time. Both resolve to
  // this package's own manifest from `src/production` and from the emitted
  // `lib/production`, so the two shapes agree -- but only the static one
  // survives bundling, and a generated project bundles this package. Built
  // from `__dirname`, the specifier resolved against the bundle's own
  // directory instead: the generated project's `package.json` sits exactly
  // where the walk lands, so the identity took the consumer's version and
  // reported no error at all. Rollup refuses the dynamic form outright, which
  // is how a silently wrong version finally became a failure.
  (
    require("../../package.json") as {
      version: string;
    }
  ).version;

/**
 * Deterministic source compiler and generated-ownership gate.
 *
 * Coding-agent TypeScript runs in a no-I/O VM with explicit design input and
 * deterministic geometry helpers. It may use loops, ordinary math, linked
 * project-relative modules, and named sandbox-package imports, but no wall
 * clock, random source, process, network or filesystem.
 * The resulting scene, shot, models and sparse motions are validated by the
 * same engine consumers use and then materialized atomically as derived data.
 *
 * @evidence requirements/review/subject-inspection.md#review-library-delivery-coverage Consumes the graph-derived library owner population at review and final without charging unused film inventory.
 * @evidence specifications/review-and-acceptance/subject-surface-and-inspection.md#review-system-library-delivery-coverage Runs the current finite library observation gate inside the same compiler path as final publication.
 * @author Samchon
 */
export class AutoMovieProductionCompiler {
  public constructor(
    private readonly project: AutoMovieProductionProject,
    private readonly authoringEvidence?: IAutoMovieProductionEvidence,
    private readonly currentAuthoringEvidence?: () => IAutoMovieProductionEvidence,
  ) {}

  /**
   * Whether one compiled model carries a skeleton.
   *
   * The extreme-range pose is part of an asset's required view set only for a
   * rigged model, because a rig that reads correctly at rest is exactly the rig
   * whose limits nobody looked at. A model whose compiled bytes cannot be read
   * is reported by the compiler's own registry diagnostics, so it is treated as
   * unrigged here rather than raising a second, worse-placed error.
   */
  private compiledModelIsRigged(model: string): boolean {
    try {
      const validation = typia.validateEquals<IAutoMovieModel>(
        JSON.parse(
          Buffer.from(
            this.project.readGeneratedFile(
              `models/${encodeAutoMoviePathSegment(model)}.json`,
            ),
          ).toString("utf8"),
        ) as unknown,
      );
      return validation.success && validation.data.skeleton !== null;
    } catch {
      return false;
    }
  }

  /**
   * Compile the active design and source through the requested gate.
   */
  public compile(
    input: IAutoMovieCompileProjectInput,
  ): IAutoMovieCompileProjectOutput {
    return this.run(input, true);
  }

  /**
   * Run every compiler gate without materializing generated files.
   *
   * Project linters use this entry point so a read-only check can never repair
   * the ownership or freshness failure it is supposed to report.
   */
  public lint(
    input: IAutoMovieCompileProjectInput,
  ): IAutoMovieCompileProjectOutput {
    return this.run(input, false);
  }

  private run(
    input: IAutoMovieCompileProjectInput,
    materialize: boolean,
  ): IAutoMovieCompileProjectOutput {
    if (this.authoringEvidence?.manifest.kind === "library")
      return this.runLibrary(input, materialize);
    const graph = this.project.graph();
    const inputRevision = this.project.revision();
    const projectManifest = this.project.manifest();
    const archetypes = this.project.archetypes;
    const diagnostics: IAutoMovieDiagnostic[] = [
      ...missingDesignDiagnostics(this.project, graph),
      ...validateAutoMovieProductionGraph(
        graph,
        this.project.productionId,
        archetypes,
      ),
    ];
    const designReady = diagnostics.every(
      (diagnostic) => diagnostic.category !== "error",
    );
    // One reader for every deterministic module the linker follows. A shot and
    // the film edit are the same kind of source, so they must reach project
    // source through the same owned-source read and the same normalization; two
    // readers is two chances for one of them to widen what may be opened.
    const readLinkedSource = (relative: string): string =>
      Buffer.from(
        normalizeAutoMovieSource(this.project.readSource(relative)),
      ).toString("utf8");
    const sourceFields: IAutoMovieFingerprintField[] = [];
    if (this.authoringEvidence !== undefined)
      sourceFields.push({
        role: "source:owner-bindings",
        kind: "application/json",
        payload: canonicalAutoMovieJsonBytes(
          this.authoringEvidence.sourceOwners ?? [],
        ),
      });
    const contentFields: IAutoMovieFingerprintField[] = [];
    let contentInputs: IAutoMovieProductionContentInput[] | undefined;
    let declaredAssets: string[] = [];
    let assetRecords: IAutoMovieAssetProvenance[] = [];
    let derivedArtifacts: IAutoMovieFilmBuildContext["derivedArtifacts"] = {};
    let derivedArtifactsReady = true;
    let externalModels = new Map<
      string,
      IAutoMovieExternalModelRuntimeBinding
    >();
    let externalMotions = new Map<string, ICompilerExternalMotionAdoption>();
    if (input.scope !== "design")
      try {
        contentInputs = this.project.contentInputs();
        contentFields.push(...contentFingerprintFields(contentInputs));
        const assetInventory = compilerAssetInventory(
          projectManifest.assetManifest,
          contentInputs,
          graph.production?.id ?? this.project.productionId,
          graph,
          archetypes,
        );
        diagnostics.push(...assetInventory.diagnostics);
        declaredAssets = assetInventory.assets;
        assetRecords = assetInventory.records;
        externalModels = assetInventory.externalModels;
        externalMotions = assetInventory.externalMotions;
      } catch (error) {
        diagnostics.push({
          code: "content-input-unsafe",
          category: "error",
          phase: "source",
          target: "declared-content",
          // No one file owns the content inventory: it is read across every
          // content root and file the layout declares.
          path: null,
          message: `${errorMessage(error)} Correct contentRoots/contentFiles ownership before running the compiler.`,
        });
        contentFields.push({
          role: "content:inventory",
          kind: "unsafe",
          payload: new Uint8Array(),
        });
      }
    if (input.scope !== "design") {
      const inspection = inspectAutoMovieDerivedArtifacts({
        root: this.project.root,
        manifestPath: projectManifest.derivedArtifactManifest,
        externalAssetPaths: assetRecords.map((asset) => asset.path),
      });
      contentFields.push(...inspection.fingerprintFields);
      derivedArtifacts = inspection.artifacts;
      derivedArtifactsReady = inspection.problems.length === 0;
      diagnostics.push(
        ...inspection.problems.map(
          (problem): IAutoMovieDiagnostic => ({
            code: problem.code,
            category: "error",
            phase: "project",
            target: problem.target,
            path: problem.path,
            message: problem.message,
          }),
        ),
      );
    }
    const compiled = new Map<string, IAutoMovieCompiledShotSource>();
    const externalMotionConversions = new Map<
      string,
      ICompilerExternalMotionConversionDraft
    >();
    const realizations = new Map<
      string,
      IAutoMovieCompiledContractRealization
    >();
    let runtimeModels = new Map<
      string,
      IAutoMovieCompiledShotSource["models"][number]
    >();
    let formationRuntime: ReturnType<
      typeof materializeCompiledFormationInventory
    > = {};
    let instanceSetRuntime: ReturnType<
      typeof materializeCompiledInstanceSetInventory
    > = {};
    let filmSource: Uint8Array | null = null;
    let filmSourceDigest: AutoMovieContentDigest | null = null;
    if (input.scope !== "design" && designReady) {
      runtimeModels = new Map(
        materializeProductionModels(graph.models, externalModels, archetypes),
      );
      formationRuntime = materializeCompiledFormationInventory(
        graph.formations,
        graph.models,
        externalModels,
        graph.world!.surfaces,
        archetypes,
      );
      instanceSetRuntime = materializeCompiledInstanceSetInventory(
        graph.world!,
        graph.models,
        externalModels,
        archetypes,
      );
    }
    const shotSources = new Map<string, Uint8Array>();
    for (const [id, contract] of graph.shots) {
      if (input.scope === "design") {
        sourceFields.push({
          role: `source:${id}`,
          kind: "not-inspected",
          payload: new Uint8Array(),
        });
        continue;
      }
      let source: Uint8Array;
      try {
        source = this.project.readSource(contract.source.module);
      } catch (error) {
        diagnostics.push(
          sourcePathDiagnostic(id, contract.source.module, error),
        );
        sourceFields.push({
          role: `source:${id}`,
          kind: "absent",
          payload: new Uint8Array(),
        });
        continue;
      }
      const normalized = normalizeAutoMovieSource(source);
      shotSources.set(id, normalized);
      sourceFields.push({
        role: `source:${id}`,
        kind: "typescript",
        payload: normalized,
      });
    }
    if (input.scope === "design")
      sourceFields.push({
        role: "source:film",
        kind: "not-inspected",
        payload: new Uint8Array(),
      });
    else
      try {
        filmSource = normalizeAutoMovieSource(
          this.project.readSource(FILM_SOURCE_PATH),
        );
        filmSourceDigest = digestAutoMovieBytes(filmSource);
        sourceFields.push({
          role: "source:film",
          kind: "typescript",
          payload: filmSource,
        });
      } catch (error) {
        diagnostics.push(filmSourcePathDiagnostic(error));
        sourceFields.push({
          role: "source:film",
          kind: "absent",
          payload: new Uint8Array(),
        });
      }
    let filmContext: IAutoMovieFilmBuildContext | null = null;
    let filmEditSource: ICompileDeterministicSourceResult<IAutoMovieFilmEdit> | null =
      null;
    if (
      input.scope !== "design" &&
      designReady &&
      derivedArtifactsReady &&
      filmSource !== null &&
      contentInputs !== undefined
    ) {
      filmContext = {
        production: graph.production!,
        shots: Object.fromEntries(graph.shots),
        assets: declaredAssets,
        derivedArtifacts,
        effectZones: graph.world!.effectZones,
      };
      filmEditSource = compileFilmEditSource({
        source: Buffer.from(filmSource).toString("utf8"),
        readSource: readLinkedSource,
        context: filmContext,
      });
    }

    if (input.scope !== "design" && designReady && derivedArtifactsReady) {
      let previousVideo: ICompiledVideoClosing | null = null;
      for (const entry of shotCompileOrder(
        graph.shots,
        filmEditSource?.value ?? null,
      )) {
        const normalized = shotSources.get(entry.id);
        let closing: IAutoMovieBeatEndState | null = null;
        if (normalized !== undefined) {
          const requireReviewed =
            input.scope === "review" || input.scope === "final";
          const owner =
            this.authoringEvidence !== undefined || requireReviewed
              ? resolveAutoMovieSourceOwnerBinding({
                  bindings: this.authoringEvidence?.sourceOwners,
                  branch: "shots",
                  sourcePath: entry.contract.source.module,
                  exportName: entry.contract.source.export,
                  sourceDigest: digestAutoMovieBytes(normalized),
                  requireReviewed,
                })
              : null;
          if (owner !== null && owner.success === false) {
            diagnostics.push({
              code: "source-owner-mismatch",
              category: "error",
              phase: "source",
              target: entry.id,
              path: entry.contract.source.module,
              message: owner.message,
            });
            continue;
          }
          const previous =
            previousVideo !== null &&
            entry.placement !== null &&
            fullHardCutBoundary(
              previousVideo,
              entry,
              graph.production!.frameFormat.fps,
            )
              ? previousVideo.closing
              : null;
          const result = compileShotSource({
            id: entry.id,
            path: entry.contract.source.module,
            exportName: entry.contract.source.export,
            source: Buffer.from(normalized).toString("utf8"),
            readSource: readLinkedSource,
            context: {
              contract: entry.contract,
              models: Object.fromEntries(graph.models),
              derivedArtifacts,
              // Undefined when the production declares no lighting, so the
              // frozen context a source reads is unchanged for every production
              // that says nothing about light.
              lighting: graph.production!.lighting,
              world: graph.world!,
              formations: Object.fromEntries(graph.formations),
              runtimeModels: Object.fromEntries(runtimeModels),
              formationRuntime,
              instanceSetRuntime,
              externalMotions: [...externalMotions.values()].filter(
                (adoption) => adoption.declaration.shot === entry.id,
              ),
              frameFormat: graph.production!.frameFormat,
            },
            previous,
            cameraClearance: {
              revision: String(inputRevision),
              currentRevision: String(this.project.revision()),
              sampleRate: graph.production!.frameFormat.fps,
            },
          });
          diagnostics.push(...result.diagnostics);
          if (result.value !== null) {
            const materialized = materializeCompiledShot({
              contract: entry.contract,
              formations: graph.formations,
              formationRuntime,
              instanceSetRuntime,
              modelRecipes: graph.models,
              runtimeModels,
              world: graph.world!,
              fps: graph.production!.frameFormat.fps,
              source: result.value,
              archetypes,
            });
            const realized = realizeShotContract({
              contract: entry.contract,
              production: graph.production,
              world: graph.world,
              formations: graph.formations,
              compiled: materialized.value,
              collisions: materialized.collisions,
            });
            const postDiagnostics = [
              ...validateCompiledShot(entry.contract, materialized.value),
              ...realized.diagnostics,
            ];
            diagnostics.push(...postDiagnostics);
            const binding = owner?.success === true ? owner.binding : null;
            const target =
              binding === null
                ? null
                : `${binding.targetPath}#${binding.targetAnchor}`;
            compiled.set(entry.id, {
              ...materialized.value,
              ...(binding === null
                ? {}
                : {
                    sourceOwner: {
                      branch: binding.branch,
                      path: binding.sourcePath,
                      export: binding.exportName,
                      digest: binding.sourceDigest as AutoMovieContentDigest,
                      target: target!,
                    },
                    acceptanceSources: (
                      this.authoringEvidence?.sourceOwners ?? []
                    )
                      .filter(
                        (candidate) =>
                          candidate.branch === "shots" &&
                          candidate.reviewed &&
                          `${candidate.targetPath}#${candidate.targetAnchor}` ===
                            target &&
                          !(
                            candidate.sourcePath === binding.sourcePath &&
                            candidate.exportName === binding.exportName
                          ),
                      )
                      .map((candidate) => ({
                        path: candidate.sourcePath,
                        export: candidate.exportName,
                        digest:
                          candidate.sourceDigest as AutoMovieContentDigest,
                        target: target!,
                      })),
                  }),
            });
            for (const conversion of result.conversions)
              externalMotionConversions.set(conversion.adoption, conversion);
            realizations.set(entry.id, realized.realization);
            if (
              postDiagnostics.every(
                (diagnostic) => diagnostic.category !== "error",
              )
            )
              closing = result.closing;
          }
        }
        if (entry.placement !== null && entry.placementIndex !== null)
          previousVideo = {
            ...entry,
            placement: entry.placement,
            placementIndex: entry.placementIndex,
            closing,
          };
      }
      // Every shot has now been realized, so a claim spanning several of them
      // can finally be measured. It is deliberately checked before the film is
      // assembled: simultaneity is an assertion about the story, and it stands
      // or falls whatever order the edit later puts these shots in.
      diagnostics.push(
        ...storySyncDiagnostics({
          acceptance: graph.acceptance,
          contracts: graph.shots,
          realizations,
        }),
      );
    }

    let compiledFilm: ICompiledFilmDraft | null = null;
    if (filmContext !== null && filmEditSource !== null) {
      const film = compileFilmSource({
        source: filmEditSource,
        context: filmContext,
        contracts: graph.shots,
        compiled,
        realizations,
        scope: input.scope,
      });
      diagnostics.push(...film.diagnostics);
      if (film.value !== null) {
        const useDiagnostics = validateCompiledAssetUses(
          graph.production!.id,
          assetRecords,
          film.value.edit,
        );
        diagnostics.push(...useDiagnostics);
        if (useDiagnostics.length === 0) compiledFilm = film.value;
      }
    }
    const inputFingerprint = productionCompilerInputFingerprint(
      this.project.productionId,
      graph,
      sourceFields,
      contentFields,
    );
    const filmArtifacts =
      compiledFilm === null || filmSourceDigest === null
        ? null
        : materializeFilmArtifacts(
            compiledFilm,
            filmSourceDigest,
            inputFingerprint,
          );
    const inputCurrent = (): boolean =>
      `${this.project.revision()}\0${currentAutoMovieProductionCompilerInputFingerprint(this.project, input.scope)}\0${this.project.revision()}` ===
      `${inputRevision}\0${inputFingerprint}\0${inputRevision}`;
    const files =
      input.scope === "design"
        ? null
        : materializeGeneratedFiles(
            this.project.productionId,
            graph,
            runtimeModels,
            compiled,
            externalMotionConversions,
            realizations,
            filmArtifacts,
            inputFingerprint,
          );
    const entries: IAutoMovieGeneratedFile[] =
      files === null
        ? []
        : [...files]
            .map(([file, bytes]) => ({
              path: file,
              owner: "compiler" as const,
              digest: digestAutoMovieBytes(bytes),
              sourceTargets: sourceTargetsOf(file, graph),
            }))
            .sort((left, right) => compareCodeUnits(left.path, right.path));
    const manifest: IAutoMovieGeneratedManifest | null =
      files === null
        ? null
        : {
            version: 1,
            compiler: {
              packageVersion: AUTOMOVIE_PRODUCTION_COMPILER_VERSION,
              protocolVersion: AUTOMOVIE_PRODUCTION_COMPILER_PROTOCOL,
            },
            inputFingerprint,
            files: entries,
          };
    if (manifest !== null)
      diagnostics.push(
        ...this.generatedOwnershipDiagnostics(manifest, materialize),
      );
    const screenplay = this.project.screenplayIndex();
    diagnostics.push(
      ...screenplayResidencyDiagnostics({ contracts: graph.shots, screenplay }),
      ...screenplayLedgerDiagnostics({
        acceptance: graph.acceptance,
        contracts: graph.shots,
        screenplay,
        designRecordPath: (target) => this.project.designRecordPath(target),
      }),
      ...screenplayProseDiagnostics({
        screenplay,
        read: (relative) => this.project.readProseDocument(relative),
      }),
      ...screenplayTimingDiagnostics({
        contracts: graph.shots,
        read: (relative) => this.project.readProseDocument(relative),
        scope: input.scope,
        screenplay,
      }),
      ...shotDeterminismDiagnostics({
        contracts: graph.shots,
        read: (relative) => this.project.readProseDocument(relative),
      }),
    );
    if (input.scope !== "design")
      diagnostics.push(
        ...screenplayCoverageDiagnostics({
          acceptance: graph.acceptance,
          contracts: graph.shots,
          realizations,
          scope: input.scope,
          screenplay,
        }),
      );
    // A citation states what was verified and expires when its source moves,
    // which says everything about prose and nothing about pixels. This is the
    // other half: the frames a contract declared must exist at the target's
    // current identity before any review of it can be true.
    //
    // Both halves need the generated manifest and the content inventory to
    // address a target at all. Unsafe content is already reported as
    // `content-input-unsafe`, and a fingerprint computed from an inventory this
    // compile could not read would be a second, worse failure over the same
    // cause. A production with no design record has no clock to resolve a
    // declared time on, and nothing reviewable either. The scope condition is
    // repeated here rather than left to the two functions so that an ordinary
    // `--scope source` compile does not walk the model graph for an answer it
    // will discard.
    const productionDesign = graph.production;
    if (
      manifest !== null &&
      productionDesign !== null &&
      contentInputs !== undefined &&
      (input.scope === "review" || input.scope === "final")
    ) {
      const fingerprint = (
        target: IAutoMovieRenderBundleManifest["target"],
      ): AutoMovieContentDigest =>
        productionRenderTargetFingerprint(
          this.project,
          manifest,
          target,
          contentInputs,
        );
      const captured = (
        target: IAutoMovieRenderBundleManifest["target"],
        digest: AutoMovieContentDigest,
      ): ReturnType<AutoMovieProductionProject["capturedRenderViews"]> =>
        this.project.capturedRenderViews(target, digest);
      diagnostics.push(
        ...reviewEvidenceDiagnostics({
          captured,
          contracts: graph.shots,
          fingerprint,
          fps: productionDesign.frameFormat.fps,
          scope: input.scope,
        }),
        ...assetReviewEvidenceDiagnostics({
          captured,
          consumed: consumedModelIds(graph, compiled),
          fingerprint,
          rigged: (model) => this.compiledModelIsRigged(model),
          scope: input.scope,
        }),
      );
    }
    if (this.authoringEvidence !== undefined)
      diagnostics.push(
        ...libraryReviewEvidenceConsumerDiagnostics({
          authoring: this.authoringEvidence,
          project: this.project,
          scope: input.scope,
          compileFingerprint: inputFingerprint,
          modelExists: (model) => graph.models.has(model),
          rigged: (model) => this.compiledModelIsRigged(model),
          fingerprint: (target) =>
            manifest === null || contentInputs === undefined
              ? null
              : productionRenderTargetFingerprint(
                  this.project,
                  manifest,
                  target,
                  contentInputs,
                ),
          captured: (target, digest) =>
            this.project.capturedRenderViews(target, digest),
        }),
      );
    if (input.scope === "final")
      diagnostics.push(
        ...finalDeliverableDiagnostics(
          this.project,
          graph.production,
          inputFingerprint,
        ),
      );
    // Close the loop between what the compiled production SAMPLES and what its
    // ledger AUTHORIZES. This runs here rather than beside the asset inventory
    // because it is decided against compiled models and scenes, which do not
    // exist until every shot has compiled. A design-scope compile has no
    // compiled artifact to close, so it states nothing rather than guessing.
    if (input.scope !== "design" && compiled.size !== 0) {
      const bytesOf = new Map(
        (contentInputs ?? []).map((entry) => [entry.path, entry.bytes]),
      );
      const models = new Map<string, IAutoMovieModel>();
      for (const shot of compiled.values())
        for (const model of shot.models) models.set(model.id, model);
      const closure = validateTextureAssets({
        production: graph.production?.id ?? this.project.productionId,
        models: [...models.values()],
        scenes: [...compiled.values()].map((shot) => ({
          shot: shot.shot.id,
          environment: shot.scene.environment,
        })),
        assets: assetRecords,
        facts: (asset) =>
          readAutoMovieImageFacts(bytesOf.get(asset)) ?? undefined,
      });
      if (closure.success === false)
        for (const violation of closure.violations)
          diagnostics.push({
            code: "asset-texture-unclosed",
            category: "error",
            phase: "compile",
            target: "asset-manifest",
            path: "automovie/assets.json",
            message: `${violation.path} ${violation.expected}. Register the image, correct its typed use, or stop binding it before compiling.`,
          });
    }
    // Hold every observation the buildings read against the bytes it claims,
    // and every phase, alternative and derivation against the identities the
    // buildings publish. Both run here rather than per shot: two shots that
    // stage the same building carry the same documents, so a per-shot gate
    // would read one production's evidence as a duplicate of itself.
    if (input.scope !== "design" && compiled.size !== 0) {
      const referenceOf = new Map<string, IAutoMovieDesignReference>();
      const referenceDigests = new Map<string, AutoMovieContentDigest>();
      const evidence: IAutoMovieDesignEvidence[] = [];
      const lineages = new Map<string, IAutoMovieDesignLineage>();
      const published = new Set<string>();
      for (const shot of compiled.values()) {
        for (const reference of shot.designReferences ?? []) {
          const digest = digestAutoMovieBytes(
            canonicalAutoMovieJsonBytes(reference),
          );
          const seen = referenceDigests.get(reference.id);
          // The same document staged by two shots is one document. Only a
          // second document wearing the same id is a collision, and the gate
          // below is the one that reports it.
          if (seen === undefined || seen !== digest)
            referenceOf.set(reference.id, reference);
          if (seen === undefined) referenceDigests.set(reference.id, digest);
        }
        for (const citation of shot.designEvidence ?? [])
          evidence.push(citation);
        for (const lineage of shot.designLineages ?? [])
          lineages.set(lineage.id, lineage);
        for (const environment of shot.builtEnvironments ?? []) {
          for (const building of environment.buildings)
            published.add(building.id);
          for (const element of environment.elements) published.add(element.id);
          for (const space of environment.spaces) published.add(space.id);
          for (const boundary of environment.boundaries)
            published.add(boundary.id);
          for (const opening of environment.openings) published.add(opening.id);
          for (const connector of environment.connectors)
            published.add(connector.id);
        }
        for (const model of shot.models) published.add(model.id);
      }
      const production = graph.production?.id ?? this.project.productionId;
      const uses = new Map<string, Set<string>>();
      for (const record of assetRecords)
        for (const use of record.uses) {
          if (use.production !== production) continue;
          published.add(use.consumer.id);
          if (use.consumer.kind !== "design-reference") continue;
          const documents = uses.get(record.path) ?? new Set<string>();
          documents.add(use.consumer.id);
          uses.set(record.path, documents);
        }
      if (referenceOf.size !== 0 || evidence.length !== 0 || uses.size !== 0)
        diagnostics.push(
          ...designReferenceDiagnostics({
            path: projectManifest.assetManifest ?? "automovie/assets.json",
            references: [...referenceOf.values()],
            evidence,
            assets: new Map(
              (contentInputs ?? []).map((entry) => [entry.path, entry.bytes]),
            ),
            uses,
          }),
        );
      for (const lineage of lineages.values()) {
        const bound = validateDesignLineageBinding({
          lineage,
          known: [...published],
        });
        if (bound.success === false)
          for (const violation of bound.violations)
            diagnostics.push({
              code: "design-lineage-unbound",
              category: "error",
              phase: "compile",
              target: `design-lineage:${lineage.id}`,
              path: null,
              message: `${violation.path} ${violation.expected}. Cite an identity the compiled buildings or the asset ledger publish, or drop the lineage subject.`,
            });
      }
    }
    // Hold the read-only site context to its one-way direction. A context id
    // colliding with a building's own element, space or boundary is a mass the
    // building would appear to own, which is exactly how external conditions
    // stop being external.
    const environmentContext = graph.production?.environmentContext;
    if (environmentContext !== undefined) {
      const reserved: string[] = [];
      for (const shot of compiled.values())
        for (const environment of shot.builtEnvironments ?? []) {
          for (const element of environment.elements) reserved.push(element.id);
          for (const space of environment.spaces) reserved.push(space.id);
          for (const boundary of environment.boundaries)
            reserved.push(boundary.id);
        }
      const site = validateAutoMovieEnvironmentContext({
        context: environmentContext,
        reserved,
      });
      if (site.success === false)
        for (const violation of site.violations)
          diagnostics.push({
            code: "environment-context-invalid",
            category: "error",
            phase: "compile",
            target: `environment-context:${environmentContext.id}`,
            path: null,
            message: `${violation.path} ${violation.expected}. Correct the declared site context, or rename the building member it collides with, before compiling.`,
          });
    }
    diagnostics.sort(compareDiagnostics);
    const inputRaceFailure = (
      message: string,
    ): IAutoMovieCompileProjectOutput =>
      this.inputRaceFailure({ diagnostics, inputFingerprint, message });
    const confirmInputSnapshot = (): IAutoMovieCompileProjectOutput | null =>
      this.confirmInputSnapshot({
        diagnostics,
        inputCurrent,
        inputFingerprint,
        inputRevision,
      });
    if (diagnostics.some((diagnostic) => diagnostic.category === "error"))
      return (
        confirmInputSnapshot() ?? {
          success: false,
          revision: inputRevision,
          compiler: {
            version: AUTOMOVIE_PRODUCTION_COMPILER_VERSION,
            inputFingerprint,
          },
          diagnostics,
          materialized: [],
        }
      );
    if (input.scope === "design")
      return (
        confirmInputSnapshot() ?? {
          success: true,
          revision: inputRevision,
          compiler: {
            version: AUTOMOVIE_PRODUCTION_COMPILER_VERSION,
            inputFingerprint,
          },
          diagnostics,
          materialized: [],
        }
      );

    const sourceFiles = files!;
    const sourceManifest = manifest!;
    const materialized = statusesOf(this.project, entries);
    if (materialize === false)
      return (
        confirmInputSnapshot() ?? {
          success: true,
          revision: inputRevision,
          compiler: {
            version: AUTOMOVIE_PRODUCTION_COMPILER_VERSION,
            inputFingerprint,
          },
          diagnostics,
          materialized: [],
        }
      );
    let revision: number;
    try {
      revision = this.project.commitGenerated(
        sourceFiles,
        sourceManifest,
        inputCurrent,
        inputRevision,
      );
    } catch (error) {
      if (error instanceof AutoMovieProductionInputRaceError === false)
        throw error;
      return inputRaceFailure(error.message);
    }
    return {
      success: true,
      revision,
      compiler: {
        version: AUTOMOVIE_PRODUCTION_COMPILER_VERSION,
        inputFingerprint,
      },
      diagnostics,
      materialized,
    };
  }

  /**
   * Execute, publish and gate one generated reusable library.
   *
   * A film reaches its compiled artifacts through shots. A library has none, so
   * this is the whole of its source path: every file the reviewed source
   * branches select is linked, inspected, transpiled and evaluated in the same
   * deterministic sandbox a shot runs in, every owner registration it exports is
   * matched against an exact active design H2, and what those owners return is
   * validated by the engine and published atomically as compiler-owned bytes.
   *
   * The order matters. The built environments this run produced are what the
   * review consumer derives its required observation population from, so they
   * are handed over from memory rather than read back from the tree: an owner
   * whose building the compile just refused must not be charged observations
   * against a stale copy of it, and an owner whose building it accepted must be
   * charged them whether or not anything has been written yet.
   */
  private runLibrary(
    input: IAutoMovieCompileProjectInput,
    materialize: boolean,
  ): IAutoMovieCompileProjectOutput {
    const authoring = this.authoringEvidence!;
    const inputRevision = this.project.revision();
    const snapshot = captureAutoMovieLibraryAuthoringSnapshot({
      root: this.project.root,
      evidence: authoring,
      readSource: (source) => this.project.readSource(source),
    });
    const requireReviewed = input.scope === "review" || input.scope === "final";
    const execution = createAutoMovieLibrarySourceExecutionPlan(
      snapshot,
      requireReviewed,
    );
    const sources = snapshot.sources.map((source) => source.path);
    const inputFingerprint = this.libraryInputFingerprint(snapshot);
    const diagnostics: IAutoMovieDiagnostic[] = [];
    if (input.scope !== "design")
      diagnostics.push(
        ...execution.problems.map(
          (message): IAutoMovieDiagnostic => ({
            code: "source-owner-mismatch",
            category: "error",
            phase: "source",
            target: "library-source-owners",
            path: null,
            message,
          }),
        ),
      );

    // The exact addresses a source registration is allowed to name. A library
    // owner declares which reviewed decision it realizes; anything else is a
    // building nobody asked for, and a review that never charges it is exactly
    // how an unreviewed artifact ships.
    const units = new Map<string, IAutoMovieLibraryBuildContext>();
    const sourceBranchByDesign = new Map<string, string>();
    for (const owner of authoring.designOwners)
      for (const unit of owner.units) {
        const address = `${owner.path}#${unit.anchor}`;
        units.set(address, {
          production: this.project.productionId,
          branch: owner.branch,
          design: owner.path,
          anchor: unit.anchor,
        });
        sourceBranchByDesign.set(address, owner.sourceBinding?.branch ?? "");
      }
    for (const entry of execution.entries)
      if (entry.branch === "productionSources") {
        const separator = entry.owner.lastIndexOf("#");
        units.set(entry.owner, {
          production: this.project.productionId,
          branch: entry.branch,
          design: entry.owner.slice(0, separator),
          anchor: entry.owner.slice(separator + 1),
        });
        sourceBranchByDesign.set(entry.owner, entry.branch);
      }

    const results: IAutoMovieMaterializedLibraryResult[] = [];
    const registeredBy = new Map<string, string>();
    const environmentOwner = new Map<string, string>();
    // Claimed like the other two, though a context is the world rather than a
    // thing in it. Two map owners adopting one id are two answers to "what is
    // north here", and the report that read whichever landed second would be
    // measuring one owner's work against the other's world.
    const contextOwner = new Map<string, string>();
    const models = new Map<string, IAutoMovieModel>();
    const modelOwner = new Map<string, string>();
    if (input.scope !== "design")
      for (const source of sources) {
        let text: string | null = null;
        try {
          text = this.readLibrarySource(source);
        } catch (error) {
          diagnostics.push({
            code: "source-path-missing",
            category: "error",
            phase: "source",
            target: `library-source:${source}`,
            path: source,
            message: `Library source "${source}" is selected by a reviewed source binding but cannot be read (${errorMessage(error)}). Restore the exact tracked file or correct the binding before compiling.`,
          });
        }
        if (text === null) continue;
        const sourceDigest = digestAutoMovieBytes(Buffer.from(text, "utf8"));
        const compiled = compileLibrarySource({
          path: source,
          source: text,
          readSource: (relative) => this.readLibrarySource(relative),
          context: (design) => units.get(design) ?? null,
          admit: (exportName, design) =>
            resolveAutoMovieSourceOwnerBinding({
              bindings: authoring.sourceOwners,
              branch: sourceBranchByDesign.get(design) ?? "",
              sourcePath: source,
              exportName,
              owner: design,
              sourceDigest,
              requireReviewed,
            }),
        });
        diagnostics.push(...compiled.diagnostics);
        for (const registration of compiled.registrations) {
          const context = units.get(registration.design)!;
          const target = `library:${context.branch}:${registration.design}`;
          const previous = registeredBy.get(registration.design);
          if (previous !== undefined) {
            diagnostics.push({
              code: "source-registration-mismatch",
              category: "error",
              phase: "source",
              target,
              path: source,
              message: `Library design owner "${registration.design}" is registered by both "${previous}" and "${source}#${registration.export}". Keep one source export per reviewed H2; two registrations make the published artifact depend on file order.`,
            });
            continue;
          }
          registeredBy.set(
            registration.design,
            `${source}#${registration.export}`,
          );
          const accepted =
            context.branch === "productionSources"
              ? this.acceptLibraryProductionContribution({
                  diagnostics,
                  registration,
                  source,
                  target,
                })
              : this.acceptLibraryContribution({
                  context,
                  diagnostics,
                  contextOwner,
                  environmentOwner,
                  modelOwner,
                  models,
                  registration,
                  source,
                  target,
                });
          if (accepted === false) continue;
          results.push({
            branch: context.branch,
            owner: registration.design,
            source,
            export: registration.export,
            sourceDigest: digestAutoMovieBytes(Buffer.from(text, "utf8")),
            contribution: registration.contribution,
          });
        }
      }

    if (input.scope !== "design")
      for (const entry of execution.entries)
        if (
          entry.branch === "productionSources" &&
          registeredBy.has(entry.owner) === false
        )
          diagnostics.push({
            code: "source-export-missing",
            category: requireReviewed ? "error" : "warning",
            phase: "source",
            target: `library:productionSources:${entry.owner}`,
            path: entry.sourcePath,
            message: `Production source "${entry.sourcePath}#${entry.exportName}" did not register its exact settings owner "${entry.owner}" as a zero-payload library delivery. Export one synchronous IAutoMovieLibrarySourceOwner for that address.`,
          });

    // An owner whose branch already has source and no registration is an
    // unrealized decision. It warns while source is being written, because that
    // is the ordinary state of a branch in progress, and blocks from review on,
    // where a design document with nothing behind it is the exact thing the
    // library gate exists to refuse.
    if (input.scope !== "design")
      for (const owner of [...authoring.designOwners].sort((left, right) =>
        compareCodeUnits(left.path, right.path),
      )) {
        // A branch that has not started its source yet owes no registration,
        // and neither does one whose binding selects no file. The owner is read
        // from the population it came from rather than looked up again, so the
        // binding is in hand and no absent-owner case can arise here.
        const binding = owner.sourceBinding;
        if (binding === null || binding.paths.length === 0) continue;
        for (const unit of [...owner.units].sort((left, right) =>
          compareCodeUnits(left.anchor, right.anchor),
        )) {
          const address = `${owner.path}#${unit.anchor}`;
          if (registeredBy.has(address)) continue;
          diagnostics.push({
            code: "source-export-missing",
            category:
              input.scope === "review" || input.scope === "final"
                ? "error"
                : "warning",
            phase: "source",
            target: `library:${owner.branch}:${address}`,
            path: owner.path,
            message: `No source export in the ${binding.branch} population registers library design owner "${address}". Export one owner whose \`design\` names that exact document and anchor, so this reviewed decision has a compiled artifact behind it.`,
          });
        }
      }

    const publication =
      input.scope === "design"
        ? null
        : materializeAutoMovieLibraryFiles({
            production: this.project.productionId,
            compiler: AUTOMOVIE_PRODUCTION_COMPILER_PROTOCOL,
            inputFingerprint,
            results,
          });
    const entries: IAutoMovieGeneratedFile[] =
      publication === null
        ? []
        : [...publication.files]
            .map(([file, bytes]) => ({
              path: file,
              owner: "compiler" as const,
              digest: digestAutoMovieBytes(bytes),
              sourceTargets: autoMovieLibraryArtifactSourceTargets(
                file,
                publication.index,
              ),
            }))
            .sort((left, right) => compareCodeUnits(left.path, right.path));
    const manifest: IAutoMovieGeneratedManifest | null =
      publication === null
        ? null
        : {
            version: 1,
            compiler: {
              packageVersion: AUTOMOVIE_PRODUCTION_COMPILER_VERSION,
              protocolVersion: AUTOMOVIE_PRODUCTION_COMPILER_PROTOCOL,
            },
            inputFingerprint,
            files: entries,
          };
    if (manifest !== null)
      diagnostics.push(
        ...this.generatedOwnershipDiagnostics(manifest, materialize),
      );

    // Decided once, here, rather than inside the callback. A design-scope
    // compile publishes nothing, so there is no generated manifest to resolve a
    // render target against -- but asking that question inside the callback
    // asked it where nothing ever asks: measured, no scope reaches the callback
    // while the manifest is null, because the consumer only wants a fingerprint
    // when it is judging a receipt or an asset review and neither runs in
    // design scope. The branch was real and unreachable at once. Bound here it
    // is taken by every compile, in the scope that decides it.
    const renderTargetFingerprint =
      manifest === null
        ? (): null => null
        : (target: IAutoMovieRenderBundleManifest["target"]) =>
            productionRenderTargetFingerprint(this.project, manifest, target);

    const environmentsOf = new Map(
      results.map((result) => [
        JSON.stringify([result.branch, result.owner]),
        result.contribution.environments,
      ]),
    );
    const contextsOf = new Map(
      results.map((result) => [
        JSON.stringify([result.branch, result.owner]),
        result.contribution.contexts,
      ]),
    );
    diagnostics.push(
      ...libraryReviewEvidenceConsumerDiagnostics({
        authoring,
        project: this.project,
        scope: input.scope,
        compileFingerprint: inputFingerprint,
        environments: ({ branch, owner }) =>
          environmentsOf.get(JSON.stringify([branch, owner])) ?? [],
        contexts: ({ branch, owner }) =>
          contextsOf.get(JSON.stringify([branch, owner])) ?? [],
        modelExists: (model) => models.has(model),
        rigged: (model) => (models.get(model)?.skeleton ?? null) !== null,
        // A library publishes models, so an asset render target resolves here
        // exactly as it does on the film path: the generated manifest above
        // carries the models/<id>.json entry the fingerprint reads, and the
        // project answers the content inputs. Returning null unconditionally
        // made every turntable receipt permanently uncurrent -- a plan could
        // name one, the record command could write one, and the compiler would
        // answer "does not reopen" forever -- and it made the modelExists
        // binding beside it a question whose answer nothing could observe.
        fingerprint: renderTargetFingerprint,
        captured: (target, digest) =>
          this.project.capturedRenderViews(target, digest),
      }),
    );
    diagnostics.sort(compareDiagnostics);

    const inputCurrent = (): boolean => {
      if (this.currentAuthoringEvidence === undefined) return false;
      try {
        return sameAutoMovieLibraryAuthoringSnapshot(
          snapshot,
          captureAutoMovieLibraryAuthoringSnapshot({
            root: this.project.root,
            evidence: this.currentAuthoringEvidence(),
            readSource: (source) => this.project.readSource(source),
          }),
        );
      } catch {
        return false;
      }
    };
    const compiler = {
      version: AUTOMOVIE_PRODUCTION_COMPILER_VERSION,
      inputFingerprint,
    };
    const confirmInputSnapshot = (): IAutoMovieCompileProjectOutput | null =>
      this.confirmInputSnapshot({
        diagnostics,
        inputCurrent,
        inputFingerprint,
        inputRevision,
      });
    const failed = diagnostics.some(
      (diagnostic) => diagnostic.category === "error",
    );
    if (failed || input.scope === "design" || materialize === false)
      return (
        confirmInputSnapshot() ?? {
          success: failed === false,
          revision: inputRevision,
          compiler,
          diagnostics,
          materialized: [],
        }
      );
    const materializedFiles = statusesOf(this.project, entries);
    let revision: number;
    try {
      revision = this.project.commitGenerated(
        publication!.files,
        manifest!,
        inputCurrent,
        inputRevision,
      );
    } catch (error) {
      if (error instanceof AutoMovieProductionInputRaceError === false)
        throw error;
      return this.inputRaceFailure({
        diagnostics,
        inputFingerprint,
        message: error.message,
      });
    }
    return {
      success: true,
      revision,
      compiler,
      diagnostics,
      materialized: materializedFiles,
    };
  }

  /** Normalized project source text, read exactly as the film linker reads it. */
  private readLibrarySource(relative: string): string {
    return Buffer.from(
      normalizeAutoMovieSource(this.project.readSource(relative)),
    ).toString("utf8");
  }

  /**
   * The compiler input identity of one library, recomputed on demand.
   *
   * A library's inputs are the authoring declaration and the source bytes its
   * reviewed bindings select, so the same read answers both the fingerprint the
   * result carries and the guard the atomic publication runs against a
   * concurrent edit.
   */
  private libraryInputFingerprint(
    snapshot: IAutoMovieLibraryAuthoringSnapshot,
  ): AutoMovieContentDigest {
    return fingerprintAutoMovieFields([
      {
        role: "library:compiler",
        kind: AUTOMOVIE_PRODUCTION_COMPILER_PROTOCOL,
        payload: canonicalAutoMovieJsonBytes({
          version: AUTOMOVIE_PRODUCTION_COMPILER_VERSION,
          authoringSnapshot: snapshot.digest,
        }),
      },
    ]);
  }

  /** Admit settings serialization only as a zero-payload lineage result. */
  private acceptLibraryProductionContribution(props: {
    diagnostics: IAutoMovieDiagnostic[];
    registration: ICompiledLibraryOwnerRegistration;
    source: string;
    target: string;
  }): boolean {
    const contribution = props.registration.contribution;
    const populations =
      contribution.environments.length +
      contribution.models.length +
      contribution.contexts.length;
    if (populations === 0) return true;
    props.diagnostics.push({
      code: "source-export-invalid",
      category: "error",
      phase: "source",
      target: props.target,
      path: props.source,
      message: `Production source export "${props.registration.export}" serializes settings and must return empty environments, models, and contexts. Publish semantic artifacts from their reviewed design-source owner instead.`,
    });
    return false;
  }

  /**
   * Validate one owner's contribution and claim the ids it publishes.
   *
   * The engine validators decide whether the building and the models are
   * coherent, exactly as they do for a shot's code-authored environment, so a
   * library and a film cannot disagree about what a valid building is. What is
   * decided here instead is ownership: two owners publishing one id would write
   * one file twice, and which of them won would depend on the order the source
   * population happened to be read in.
   */
  private acceptLibraryContribution(props: {
    context: IAutoMovieLibraryBuildContext;
    contextOwner: Map<string, string>;
    diagnostics: IAutoMovieDiagnostic[];
    environmentOwner: Map<string, string>;
    modelOwner: Map<string, string>;
    models: Map<string, IAutoMovieModel>;
    registration: ICompiledLibraryOwnerRegistration;
    source: string;
    target: string;
  }): boolean {
    const before = props.diagnostics.length;
    // The path is sliced and printed without a fallback because the two
    // validators below build every violation path from `$input.` and neither
    // ever reports at the bare root: a contribution that is not a record at all
    // is refused earlier, by the shape check on what `build()` returned, with a
    // message of its own. A fallback for the empty remainder was a second
    // sentence for a case that cannot arrive here, and no test could reach it.
    const report = (violation: IAutoMovieConstraintViolation): void => {
      props.diagnostics.push(
        autoMovieSourceContentDiagnostic({
          finding: autoMovieSourceContentFinding(
            violation,
            `Library owner "${props.registration.design}" publishes ${violation.path.slice("$input".length)} that ${violation.expected}. Correct ${props.source} before compiling.`,
          ),
          target: props.target,
          path: props.source,
        }),
      );
    };
    const claim = (
      owners: Map<string, string>,
      id: string,
      kind: string,
    ): boolean => {
      const previous = owners.get(id);
      if (previous !== undefined) {
        props.diagnostics.push({
          code: "source-export-invalid",
          category: "error",
          phase: "source",
          target: props.target,
          path: props.source,
          message: `Library ${kind} "${id}" is published by both "${previous}" and "${props.registration.design}". Give every published ${kind} one owner; two owners write one compiler-owned file twice.`,
        });
        return false;
      }
      owners.set(id, props.registration.design);
      return true;
    };
    for (const environment of props.registration.contribution.environments) {
      for (const violation of autoMovieValidationFindings(
        validateBuiltEnvironment({ environment }),
      ))
        report(violation);
      claim(props.environmentOwner, environment.id, "built environment");
    }
    for (const model of props.registration.contribution.models) {
      for (const violation of autoMovieValidationFindings(
        validateModel({ model }),
      ))
        report(violation);
      if (claim(props.modelOwner, model.id, "model"))
        props.models.set(model.id, model);
    }
    for (const context of props.registration.contribution.contexts) {
      for (const violation of autoMovieValidationFindings(
        validateAutoMovieEnvironmentContext({ context }),
      ))
        report(violation);
      claim(props.contextOwner, context.id, "environment context");
    }
    return props.diagnostics
      .slice(before)
      .every((diagnostic) => diagnostic.category !== "error");
  }

  /**
   * Publish the refusal a compiler-input race produces.
   *
   * Both shapes end here rather than carrying a copy each. What raced is the
   * same fact whichever gate noticed it, and a second spelling of the message
   * would be a second answer to "what does a caller do about this".
   */
  private inputRaceFailure(props: {
    diagnostics: IAutoMovieDiagnostic[];
    inputFingerprint: AutoMovieContentDigest;
    message: string;
  }): IAutoMovieCompileProjectOutput {
    props.diagnostics.push({
      code: "compile-input-changed",
      category: "error",
      phase: "compile",
      target: "compiler-input",
      path: null,
      message: `${props.message} Re-run the scaffold compile command against the current design, source, and declared content snapshot.`,
    });
    props.diagnostics.sort(compareDiagnostics);
    return {
      success: false,
      revision: this.project.revision(),
      compiler: {
        version: AUTOMOVIE_PRODUCTION_COMPILER_VERSION,
        inputFingerprint: props.inputFingerprint,
      },
      diagnostics: props.diagnostics,
      materialized: [],
    };
  }

  /** Confirm nothing moved under a result that publishes no generated bytes. */
  private confirmInputSnapshot(props: {
    diagnostics: IAutoMovieDiagnostic[];
    inputCurrent: () => boolean;
    inputFingerprint: AutoMovieContentDigest;
    inputRevision: number;
  }): IAutoMovieCompileProjectOutput | null {
    try {
      this.project.confirmCurrentSnapshot(
        props.inputCurrent,
        props.inputRevision,
      );
      return null;
    } catch (error) {
      if (error instanceof AutoMovieProductionInputRaceError === false)
        throw error;
      return this.inputRaceFailure({ ...props, message: error.message });
    }
  }

  private generatedOwnershipDiagnostics(
    expected: IAutoMovieGeneratedManifest,
    repairDeclaredFiles: boolean,
  ): IAutoMovieDiagnostic[] {
    const manifest = this.project.generatedManifest();
    const generatedManifestPath = normalizeSlash(
      path.relative(
        this.project.root,
        this.project.trackedStatePath("generated-manifest.json"),
      ),
    );
    const diagnostics: IAutoMovieDiagnostic[] = [];
    const expectedByPath = new Map(
      expected.files.map((file) => [normalizeSlash(file.path), file]),
    );
    const declaredByPath = new Map(
      (manifest?.files ?? []).map((file) => [normalizeSlash(file.path), file]),
    );
    if (manifest === null)
      diagnostics.push({
        code: "generated-manifest-missing",
        category: repairDeclaredFiles ? "warning" : "error",
        phase: "compile",
        target: "generated-manifest",
        path: generatedManifestPath,
        message: repairDeclaredFiles
          ? "Compiler-owned output has no generated manifest. The compiler will publish the exact current ownership manifest with the derived files."
          : "Compiler-owned output has no generated manifest. Run the scaffold compile command before trusting generated bytes.",
      });
    for (const file of listFiles(this.project.generatedRoot())) {
      const relative = normalizeSlash(
        path.relative(this.project.generatedRoot(), file),
      );
      if (expectedByPath.has(relative) === false) {
        const declared = declaredByPath.get(relative);
        let matchesDeclared = false;
        try {
          matchesDeclared =
            declared !== undefined &&
            digestAutoMovieBytes(this.project.readGeneratedFile(relative)) ===
              declared.digest;
        } catch {
          matchesDeclared = false;
        }
        diagnostics.push({
          code: matchesDeclared
            ? "generated-stale-output"
            : "generated-unowned",
          category:
            matchesDeclared && repairDeclaredFiles ? "warning" : "error",
          phase: "compile",
          target: relative,
          path: normalizeSlash(path.relative(this.project.root, file)),
          message: matchesDeclared
            ? repairDeclaredFiles
              ? `Generated file "${relative}" belonged to the prior compiler result but is absent from the current result. The compiler will remove it.`
              : `Generated file "${relative}" is stale output from a different compile. Run the scaffold compile command to remove it.`
            : `Generated file "${relative}" is not the canonical output derived from current source and design. Remove it before running the compiler.`,
        });
      }
    }
    for (const entry of expected.files) {
      const file = path.resolve(this.project.generatedRoot(), entry.path);
      let actual: AutoMovieContentDigest | null = null;
      try {
        actual = digestAutoMovieBytes(
          this.project.readGeneratedFile(entry.path),
        );
      } catch (error) {
        if (error instanceof Error && error.message.includes("does not exist"))
          actual = null;
        else {
          diagnostics.push({
            code: "generated-path-outside",
            category: "error",
            phase: "compile",
            target: entry.path,
            path: normalizeSlash(path.relative(this.project.root, file)),
            message:
              error instanceof Error
                ? error.message
                : `Generated file "${entry.path}" is unsafe. Remove the link before running the compiler.`,
          });
          continue;
        }
      }
      if (actual !== entry.digest)
        diagnostics.push({
          code: "generated-tampered",
          category: repairDeclaredFiles ? "warning" : "error",
          phase: "compile",
          target: entry.path,
          path: normalizeSlash(path.relative(this.project.root, file)),
          message: repairDeclaredFiles
            ? `Generated digest is ${String(actual)} but current source and design derive ${entry.digest}. The compiler will regenerate this compiler-owned file.`
            : `Generated digest is ${String(actual)} but current source and design derive ${entry.digest}. Run the scaffold compile command to regenerate it before accepting lint.`,
        });
    }
    if (
      manifest !== null &&
      manifest.inputFingerprint !== expected.inputFingerprint
    )
      diagnostics.push({
        code: "generated-stale",
        category: repairDeclaredFiles ? "warning" : "error",
        phase: "compile",
        target: "generated-manifest",
        path: generatedManifestPath,
        message: repairDeclaredFiles
          ? `Generated input ${manifest.inputFingerprint} differs from current ${expected.inputFingerprint}. The compiler will refresh all compiler-owned output.`
          : `Generated input ${manifest.inputFingerprint} differs from current ${expected.inputFingerprint}. Run the scaffold compile command before trusting generated output.`,
      });
    if (
      manifest !== null &&
      Buffer.from(canonicalAutoMovieJsonBytes(manifest)).equals(
        Buffer.from(canonicalAutoMovieJsonBytes(expected)),
      ) === false
    )
      diagnostics.push({
        code: "generated-manifest-stale",
        category: repairDeclaredFiles ? "warning" : "error",
        phase: "compile",
        target: "generated-manifest",
        path: generatedManifestPath,
        message: repairDeclaredFiles
          ? "The generated manifest does not exactly match compiler-derived inventory, digests, identity, and provenance. The compiler will replace it."
          : "The generated manifest does not exactly match compiler-derived inventory, digests, identity, and provenance. Run the scaffold compile command before trusting generated output.",
      });
    return diagnostics;
  }
}

interface ICompilerExternalMotionAdoption {
  declaration: IAutoMovieProductionExternalMotionAdoption;
  receipt: IAutoMovieIngestExternalMotionAdoption;
  sourceClosure: IAutoMovieExternalMotionConversionReceipt["source"]["closure"];
  sourceBasis: IAutoMovieExternalMotionBasis;
  sourceTake: IAutoMovieExternalMotionTake;
  sourceMotion: IAutoMovieMotion;
}

/** Receipt facts whose result path and bytes are sealed during materialization. */
interface ICompilerExternalMotionConversionDraft extends Omit<
  IAutoMovieExternalMotionConversionReceipt,
  "result"
> {
  motion: IAutoMovieMotion;
}

interface ICompileShotSourceProps {
  id: string;
  path: string;
  exportName: string;
  source: string;
  /** Reader for project source this shot imports. */
  readSource: (relativePath: string) => string;
  context: {
    contract: IAutoMovieShotContract;
    models: IAutoMovieShotBuildContext["models"];
    derivedArtifacts: IAutoMovieShotBuildContext["derivedArtifacts"];
    lighting: IAutoMovieShotBuildContext["lighting"];
    world: IAutoMovieWorldDesign;
    formations: IAutoMovieShotBuildContext["formations"];
    runtimeModels: IAutoMovieShotBuildContext["runtimeModels"];
    formationRuntime: IAutoMovieShotBuildContext["formationRuntime"];
    instanceSetRuntime: IAutoMovieShotBuildContext["instanceSetRuntime"];
    externalMotions: readonly ICompilerExternalMotionAdoption[];
    frameFormat: Pick<
      IAutoMovieProductionDesign["frameFormat"],
      "width" | "height"
    >;
  };
  /** Compiler-owned snapshot and fixed clock; never exposed to shot source. */
  cameraClearance: IAutoMovieCameraClearanceRuntime;
  /** Prior full-shot closing state at the authoritative hard-cut boundary. */
  previous: IAutoMovieBeatEndState | null;
}

interface ICompileShotSourceResult {
  value: IAutoMovieShotSourceOutput | null;
  /** Closing state available to the next full hard-cut shot, on success. */
  closing: IAutoMovieBeatEndState | null;
  conversions: ICompilerExternalMotionConversionDraft[];
  diagnostics: IAutoMovieDiagnostic[];
}

/** One unique shot in authoritative film order, or an unplaced graph remainder. */
interface IShotCompileEntry {
  id: string;
  contract: IAutoMovieShotContract;
  placement: IAutoMovieVideoEdit | null;
  placementIndex: number | null;
}

/** The immediately preceding placed shot and its successfully measured closing. */
interface ICompiledVideoClosing extends IShotCompileEntry {
  placement: IAutoMovieVideoEdit;
  placementIndex: number;
  closing: IAutoMovieBeatEndState | null;
}

/**
 * Compile placed shots in film order, then every remaining graph shot in its
 * stable design order so omitted/unaccounted sources keep their diagnostics.
 */
const shotCompileOrder = (
  contracts: ReadonlyMap<string, IAutoMovieShotContract>,
  edit: IAutoMovieFilmEdit | null,
): IShotCompileEntry[] => {
  const ordered: IShotCompileEntry[] = [];
  const placed = new Set<string>();
  edit?.tracks.video.forEach((placement, placementIndex) => {
    const contract = contracts.get(placement.shot);
    if (contract === undefined || placed.has(placement.shot)) return;
    placed.add(placement.shot);
    ordered.push({
      id: placement.shot,
      contract,
      placement,
      placementIndex,
    });
  });
  for (const [id, contract] of contracts)
    if (placed.has(id) === false)
      ordered.push({ id, contract, placement: null, placementIndex: null });
  return ordered;
};

/** Resolve an authored film time only when it lies on the production clock. */
const resolvedFilmFrame = (
  time: IAutoMovieVideoEdit["sourceIn"],
  fps: number,
): number | null => {
  const raw = "frame" in time ? time.frame : time.seconds * fps;
  const rounded = Math.round(raw);
  return Number.isFinite(raw) &&
    Number.isSafeInteger(rounded) &&
    rounded >= 0 &&
    Math.abs(raw - rounded) <= Number.EPSILON * 64 * Math.max(1, Math.abs(raw))
    ? rounded
    : null;
};

/**
 * A full beat-end snapshot is authoritative only across adjacent hard cuts that
 * play the previous source through its end and start the next at frame 0.
 */
const fullHardCutBoundary = (
  previous: ICompiledVideoClosing,
  current: IShotCompileEntry,
  fps: number,
): boolean => {
  if (current.placement === null || current.placementIndex === null)
    return false;
  const previousOut = resolvedFilmFrame(previous.placement.sourceOut, fps);
  const previousDuration = resolvedFilmFrame(
    { seconds: previous.contract.durationSeconds },
    fps,
  );
  return (
    current.placementIndex === previous.placementIndex + 1 &&
    previous.placement.transitionOut.kind === "cut" &&
    current.placement.transitionIn.kind === "cut" &&
    previousOut !== null &&
    previousOut === previousDuration &&
    resolvedFilmFrame(current.placement.sourceIn, fps) === 0
  );
};

interface ICompileDeterministicSourceProps<T> {
  target: string;
  label: string;
  path: string;
  exportName: string;
  source: string;
  context: unknown;
  /** Reader for project source this module imports. */
  readSource: (relativePath: string) => string;
  /** Expected source-owned defineShot registration, for one shot module. */
  registration?: {
    id: string;
    contract: IAutoMovieDefinedShotContract;
  };
  validate(input: unknown): IValidation<T>;
}

interface ICompileDeterministicSourceResult<T> {
  value: T | null;
  diagnostics: IAutoMovieDiagnostic[];
  /** Source-owned scene captured from a validated defineShot registration. */
  registrationScene?: string;
}

const SANDBOX_BOOTSTRAP = `
(() => {
  "use strict";
  const automovieModule = { exports: {} };
  Object.defineProperty(globalThis, "module", {
    value: automovieModule,
    writable: false,
    configurable: false,
  });
  Object.defineProperty(globalThis, "exports", {
    value: automovieModule.exports,
    writable: false,
    configurable: false,
  });
  const quiet = () => undefined;
  Object.defineProperty(globalThis, "console", {
    value: Object.freeze({ log: quiet, warn: quiet, error: quiet }),
    writable: false,
    configurable: false,
  });
  for (const [prototype, names] of [
    [String.prototype, ["localeCompare", "toLocaleLowerCase", "toLocaleUpperCase"]],
    [Number.prototype, ["toLocaleString"]],
    [BigInt.prototype, ["toLocaleString"]],
    [Array.prototype, ["toLocaleString"]],
    [Date.prototype, ["toLocaleDateString", "toLocaleString", "toLocaleTimeString"]],
  ])
    for (const name of names)
      Object.defineProperty(prototype, name, {
        value: undefined,
        writable: false,
        configurable: false,
      });
  for (const name of [
    "Date",
    "Intl",
    "process",
    "fetch",
    "Promise",
    "queueMicrotask",
    "setTimeout",
    "setInterval",
    "performance",
    "crypto",
    "Intl",
    "Temporal",
  ])
    Object.defineProperty(globalThis, name, {
      value: undefined,
      writable: false,
      configurable: false,
    });
  Object.defineProperty(Math, "random", {
    value: () => {
      throw new Error("Math.random is unavailable in deterministic shot source.");
    },
    writable: false,
    configurable: false,
  });
  const parse = JSON.parse;
  const stringify = JSON.stringify;
  const values = Object.values;
  const freeze = (value) => {
    if (typeof value === "object" && value !== null && !Object.isFrozen(value)) {
      Object.freeze(value);
      for (const child of values(value)) freeze(child);
    }
    return value;
  };
  // The engine's own answer, fetched across the boundary as text. The sandbox
  // holds the host's forwarding function in this closure only and drops the
  // global immediately, so authored source can neither call it nor take a
  // Function constructor off it, and nothing structured is ever shared.
  const engineCall = globalThis.__automovieEngineCall;
  delete globalThis.__automovieEngineCall;
  const finiteArgument = (key, value) => {
    if (typeof value === "number" && Number.isFinite(value) === false)
      throw new Error(
        "An engine call may not pass " +
          String(value) +
          ' at "' +
          key +
          '", because JSON carries it across the boundary as a hole rather than as a number.',
      );
    return value;
  };
  const engineBridge =
    (name) =>
    (...args) => {
      const answer = parse(engineCall(name, stringify(args, finiteArgument)));
      if (answer.ok !== true) throw new Error(answer.message);
      return answer.value;
    };
  const defineShot = (id, definition) =>
    freeze({ id, ...definition });
  // The subject vocabulary is defined here rather than loaded from the package,
  // exactly as defineShot is: a class carries a prototype and defineShot closes
  // over a definition, and neither survives the JSON round trip that carries
  // every other engine name to its own implementation.
  class AutoMovieSubject {
    design() {
      throw new Error("A subject must implement design().");
    }
    render() {
      throw new Error("A subject must implement render().");
    }
  }
  // The engine's merge, not a second one. A group's contribution keys are the
  // keys of IAutoMovieSubjectContribution, and a sandbox copy of that list is a
  // copy that goes stale the moment the contract gains a fold: it would drop
  // the new key silently, which is the failure a merge can least afford.
  const mergeAutoMovieSubjectContributions = engineBridge(
    "mergeAutoMovieSubjectContributions",
  );
  class AutoMovieSubjectGroup extends AutoMovieSubject {
    members() {
      throw new Error("A subject group must implement members().");
    }
    render(context) {
      return mergeAutoMovieSubjectContributions(
        this.members().map((member) => member.render(context)),
      );
    }
  }
  // A terrain subject answers height at a point by asking the engine rather
  // than reading the record itself, which is right for a level patch and wrong
  // the day it slopes. The arithmetic is pure and takes the record it is given,
  // so the sandbox can carry it exactly as it carries the subject vocabulary.
  // Every height rule the interface declares is answered here: a rule the
  // sandbox did not know would read a rise as a plain plane and stage a crowd
  // through the hill it stands on.
  const heightfieldCell = (coordinate, count) => {
    const last = Math.max(0, count - 2);
    const clamped = Math.min(Math.max(coordinate, 0), Math.max(0, count - 1));
    const index = Math.min(Math.floor(clamped), last);
    return { index, fraction: clamped - index };
  };
  const heightfieldSample = (rule, column, row) => {
    const sample =
      rule.samples[
        Math.min(Math.max(row, 0), rule.rows - 1) * rule.columns +
          Math.min(Math.max(column, 0), rule.columns - 1)
      ];
    return sample === undefined ? 0 : sample;
  };
  const mix = (from, to, progress) => from + (to - from) * progress;
  const worldSurfaceHeight = (surface, point) => {
    const rule = surface.height;
    if (rule.kind === "constant") return rule.value;
    if (rule.kind === "plane")
      return rule.originHeight + rule.slopeX * point.x + rule.slopeZ * point.z;
    const column = heightfieldCell(
      (point.x - rule.originX) / rule.spacingX,
      rule.columns,
    );
    const row = heightfieldCell(
      (point.z - rule.originZ) / rule.spacingZ,
      rule.rows,
    );
    return mix(
      mix(
        heightfieldSample(rule, column.index, row.index),
        heightfieldSample(rule, column.index + 1, row.index),
        column.fraction,
      ),
      mix(
        heightfieldSample(rule, column.index, row.index + 1),
        heightfieldSample(rule, column.index + 1, row.index + 1),
        column.fraction,
      ),
      row.fraction,
    );
  };
  const pointSegmentDistance = (point, from, to) => {
    const dx = to.x - from.x;
    const dz = to.z - from.z;
    const lengthSquared = dx * dx + dz * dz;
    const ratio =
      lengthSquared === 0
        ? 0
        : Math.max(
            0,
            Math.min(
              1,
              ((point.x - from.x) * dx + (point.z - from.z) * dz) /
                lengthSquared,
            ),
          );
    return Math.hypot(
      point.x - (from.x + dx * ratio),
      point.z - (from.z + dz * ratio),
    );
  };
  // Where the terrain applies, beside what it says. The first declared surface
  // containing a point wins and a point on a footprint edge is on it, exactly
  // as the engine reads it; a second reading here is how a source and a
  // compiler come to place the same member on two different heights.
  const worldGroundSurface = (surfaces, point) => {
    for (const surface of surfaces)
      if (
        surface.polygon.some(
          (vertex, index) =>
            pointSegmentDistance(
              point,
              vertex,
              surface.polygon[(index + 1) % surface.polygon.length],
            ) <= 1e-9,
        ) ||
        insidePolygon(point, surface.polygon)
      )
        return surface;
    return null;
  };
  const worldGroundHeight = (surfaces, point) => {
    const surface = worldGroundSurface(surfaces, point);
    return surface === null ? null : worldSurfaceHeight(surface, point);
  };
  // The names the sandbox answers itself, because each carries a closure or a
  // prototype that no JSON round trip survives. Everything else on the surface
  // is the engine's own function, called rather than copied.
  const engineStandIns = {
    defineShot,
    AutoMovieSubject,
    AutoMovieSubjectGroup,
    worldSurfaceHeight,
  };
  const engineBridged = parse(${JSON.stringify(
    JSON.stringify(AUTOMOVIE_SANDBOX_BRIDGED_ENGINE_EXPORTS),
  )});
  const engineSurface = parse(${JSON.stringify(
    JSON.stringify(AUTOMOVIE_SANDBOX_ENGINE_SURFACE),
  )});
  const engineSurfaceModule = {};
  for (const name of engineSurface) {
    const standIn = engineStandIns[name];
    if (standIn !== undefined && engineBridged.includes(name))
      throw new Error(
        'The importable engine name "' +
          name +
          '" is both bridged to the engine and stood in for inside the sandbox. Two answers for one name is the disagreement this boundary exists to prevent; keep one.',
      );
    if (standIn === undefined && engineBridged.includes(name) === false)
      throw new Error(
        'The importable engine surface lists "' +
          name +
          '", which the sandbox neither bridges to the engine nor stands in for. Bridge it, add the stand-in, or drop the name from the surface.',
      );
    engineSurfaceModule[name] = Object.freeze(
      standIn !== undefined ? standIn : engineBridge(name),
    );
  }
  for (const name of Object.keys(engineStandIns))
    if (engineSurface.includes(name) === false)
      throw new Error(
        'The sandbox stands in for "' +
          name +
          '", which the importable engine surface does not list, so no source module could ever reach it. List the name on the surface, or drop the stand-in.',
      );
  for (const name of engineBridged)
    if (engineSurface.includes(name) === false)
      throw new Error(
        'The sandbox bridges "' +
          name +
          '", which the importable engine surface does not list, so no source module could ever reach it. List the name on the surface, or drop the bridge.',
      );
  const sourceModules = {
    // Constant tables, carried in as data rather than loaded as a package. A
    // table has no behaviour to make non-deterministic, and serialising it here
    // is what keeps the sandbox's answer and the package's the same numbers
    // rather than two copies that drift.
    "@automovie/archetypes": freeze(parse(${JSON.stringify(
      JSON.stringify({
        CAT_GAITS,
        HORSE_GAITS,
        HUMANOID_GAITS,
      }),
    )})),
    "@automovie/engine": freeze(engineSurfaceModule),
  };
  // A module's own import map, resolved once by the compiler and handed in.
  // The sandbox looks a specifier up rather than resolving it a second time,
  // so there is no arithmetic here that could disagree with the linker about
  // which module a spelling names.
  const makeRequire = (imports) => (specifier) => {
    const key = imports[specifier] ?? specifier;
    const selected = sourceModules[key];
    if (selected === undefined)
      throw new Error(
        'Runtime module "' +
          specifier +
          '" is unavailable; a deterministic source module may import the engine surface and other project source only.',
      );
    return selected;
  };
  let entryImports = null;
  Object.defineProperty(globalThis, "require", {
    value: (specifier) => makeRequire(entryImports ?? {})(specifier),
    writable: false,
    configurable: false,
  });
  // One-shot, so the entry module resolves through its own map.
  Object.defineProperty(globalThis, "__automovieSetEntry", {
    value: (imports) => {
      if (entryImports !== null)
        throw new Error("The sandbox entry module is already set.");
      entryImports = freeze({ ...imports });
    },
    writable: false,
    configurable: false,
  });
  // One loader, used by the compiler to register each linked project module in
  // dependency order. Registration is one-shot: a specifier that is already
  // present cannot be replaced, so a linked module can never shadow the engine
  // surface or redefine a sibling that has already been evaluated.
  Object.defineProperty(globalThis, "__automovieDefine", {
    value: (specifier, imports, factory) => {
      if (Object.prototype.hasOwnProperty.call(sourceModules, specifier))
        throw new Error(
          'Runtime module "' + specifier + '" is already registered.',
        );
      const linked = { exports: {} };
      factory(linked, linked.exports, makeRequire(imports));
      sourceModules[specifier] = freeze(linked.exports);
    },
    writable: false,
    configurable: false,
  });
  const hypot = Math.hypot;
  const mixSeed = (seed, salt) => {
    const integer = Math.trunc(seed);
    const low = integer >>> 0;
    const high = Math.floor(integer / 4294967296) >>> 0;
    let value = (salt ^ low) >>> 0;
    value = Math.imul(value ^ (value >>> 16), 0x7feb352d);
    value = Math.imul(value ^ (value >>> 15) ^ high, 0x846ca68b);
    return (value ^ (value >>> 16)) >>> 0;
  };
  const seededValue = (...items) => {
    let state = 0x9e3779b9;
    for (const item of items) state = mixSeed(item, state);
    state = (state + 0x6d2b79f5) >>> 0;
    let output = state;
    output = Math.imul(output ^ (output >>> 15), output | 1);
    output ^= output + Math.imul(output ^ (output >>> 7), output | 61);
    return ((output ^ (output >>> 14)) >>> 0) / 4294967296;
  };
  const formationSlot = (data, formationId, slot) => {
    const formation = data.formationRuntime[formationId];
    if (
      formation === undefined ||
      Number.isSafeInteger(slot) === false ||
      slot < 0 ||
      slot >= formation.count
    )
      throw new RangeError(
        'Formation "' + formationId + '" slot ' + slot + " is unavailable.",
      );
    const layout = formation.layout;
    let x;
    let z;
    if (layout.kind === "line" || layout.kind === "column") {
      const rank =
        layout.kind === "line"
          ? Math.floor(slot / layout.files)
          : slot % layout.ranks;
      const file =
        layout.kind === "line"
          ? slot % layout.files
          : Math.floor(slot / layout.ranks);
      x = (file - (layout.files - 1) / 2) * layout.spacing.lateral;
      z = rank * layout.spacing.depth;
    } else if (layout.kind === "wedge") {
      const row = Math.floor(Math.sqrt(slot));
      x = (slot - row * row - row) * layout.spacing.lateral;
      z = row * layout.spacing.depth;
    } else if (layout.kind === "arc") {
      const ratio =
        formation.count === 1 ? 0.5 : slot / (formation.count - 1);
      const radians =
        (((ratio - 0.5) * layout.arcDegrees) / 180) * Math.PI;
      x = Math.sin(radians) * layout.radius;
      z = Math.cos(radians) * layout.radius;
    } else {
      const radius =
        Math.sqrt(
          seededValue(formation.seed, layout.seed, slot, 0),
        ) * layout.radius;
      const angle =
        seededValue(formation.seed, layout.seed, slot, 1) * Math.PI * 2;
      x = Math.cos(angle) * radius;
      z = Math.sin(angle) * radius;
    }
    // A formed layout may be dressed to a tolerance, and a member the compiler
    // drew off its slot has to be off it here too. A scatter is already seeded
    // and carries no tolerance, which is why the engine dresses the formed
    // layouts only and this reads the same way.
    const dressing =
      layout.kind === "scatter" ? undefined : layout.dressing;
    if (dressing !== undefined) {
      x +=
        dressing.lateral === 0
          ? 0
          : (seededValue(formation.seed, slot, 0x64726573) * 2 - 1) *
            dressing.lateral;
      z +=
        dressing.depth === 0
          ? 0
          : (seededValue(formation.seed, slot, 0x73646570) * 2 - 1) *
            dressing.depth;
    }
    const radians = (formation.facingDeg * Math.PI) / 180;
    const cosine = Math.cos(radians);
    const sine = Math.sin(radians);
    const hero = formation.heroes.find((item) => item.slot === slot);
    const placedX = formation.anchor.x + x * cosine + z * sine;
    const placedZ = formation.anchor.z - x * sine + z * cosine;
    // A member stands on the ground under itself, measured against the ground
    // under the anchor so the height the unit was staged at keeps its meaning.
    const ground = formation.ground;
    let relief = 0;
    if (ground !== undefined && ground.length !== 0) {
      const here = worldGroundHeight(ground, { x: placedX, z: placedZ });
      const datum =
        here === null ? null : worldGroundHeight(ground, formation.anchor);
      if (here !== null && datum !== null) relief = here - datum;
    }
    return freeze({
      slot,
      node:
        hero?.actor ??
        "formation:" +
          formation.id +
          ":slot:" +
          String(slot).padStart(6, "0"),
      actor: hero?.actor ?? null,
      modelRecipe: formation.modelRecipe,
      position: {
        x: placedX,
        y: formation.anchor.y + relief,
        z: placedZ,
      },
      facingDeg: formation.facingDeg,
      motionPhase: seededValue(formation.seed, slot, 0x70686173),
    });
  };
  const instanceSlot = (data, instanceSetId, slot) => {
    const instanceSet = data.instanceSetRuntime[instanceSetId];
    if (
      instanceSet === undefined ||
      Number.isSafeInteger(slot) === false ||
      slot < 0 ||
      slot >= instanceSet.count
    )
      throw new RangeError(
        'Instance set "' +
          instanceSetId +
          '" slot ' +
          slot +
          " is unavailable.",
      );
    const layout = instanceSet.layout;
    let point;
    if (layout.kind === "grid") {
      const row = Math.floor(slot / layout.columns);
      const column = slot % layout.columns;
      point = {
        x: (column - (layout.columns - 1) / 2) * layout.spacing.x,
        y: 0,
        z: row * layout.spacing.z,
      };
    } else if (layout.kind === "scatter") {
      const radius =
        Math.sqrt(seededValue(instanceSet.seed, slot, 0x72616469)) *
        layout.radius;
      const angle =
        seededValue(instanceSet.seed, slot, 0x616e676c) * Math.PI * 2;
      point = {
        x: Math.cos(angle) * radius,
        y: 0,
        z: Math.sin(angle) * radius,
      };
    } else if (layout.kind === "lattice") {
      const perLayer = layout.rows * layout.columns;
      const layer = Math.floor(slot / perLayer);
      const within = slot % perLayer;
      const row = Math.floor(within / layout.columns);
      const column = within % layout.columns;
      point = {
        x: (column - (layout.columns - 1) / 2) * layout.spacing.x,
        y: layer * layout.spacing.y,
        z: row * layout.spacing.z,
      };
    } else if (layout.kind === "explicit") {
      const transform = layout.transforms[slot];
      if (transform === undefined)
        throw new Error(
          'Instance set "' +
            instanceSet.id +
            '" slot ' +
            slot +
            " has no explicit transform.",
        );
      point = transform.translation;
    } else {
      const route = instanceSet.route;
      if (route === null || route.waypoints.length < 2)
        throw new Error(
          'Instance set "' +
            instanceSetId +
            '" route "' +
            layout.route +
            '" is unavailable.',
        );
      const segments = route.waypoints.slice(1).map((right, index) => {
        const left = route.waypoints[index];
        return {
          left,
          right,
          length: hypot(right.x - left.x, right.z - left.z),
        };
      });
      const total = segments.reduce(
        (sum, segment) => sum + segment.length,
        0,
      );
      if (Number.isFinite(total) === false || total <= 0)
        throw new RangeError(
          'Instance set "' +
            instanceSet.id +
            '" route "' +
            layout.route +
            '" must have finite non-zero length.',
        );
      let remaining = ((slot + 0.5) / instanceSet.count) * total;
      let segment = segments[segments.length - 1];
      for (const candidate of segments) {
        segment = candidate;
        if (remaining <= candidate.length) break;
        remaining -= candidate.length;
      }
      const ratio =
        segment.length === 0
          ? 0
          : Math.min(1, remaining / segment.length);
      const tangentX = segment.right.x - segment.left.x;
      const tangentZ = segment.right.z - segment.left.z;
      const tangentLength = hypot(tangentX, tangentZ);
      const jitter =
        (seededValue(instanceSet.seed, slot, 0x6a697474) * 2 - 1) *
        layout.lateralJitter;
      point = {
        x:
          segment.left.x +
          tangentX * ratio -
          (tangentLength === 0 ? 0 : (tangentZ / tangentLength) * jitter),
        y: 0,
        z:
          segment.left.z +
          tangentZ * ratio +
          (tangentLength === 0 ? 0 : (tangentX / tangentLength) * jitter),
      };
    }
    const radians = (instanceSet.facingDeg * Math.PI) / 180;
    const cosine = Math.cos(radians);
    const sine = Math.sin(radians);
    const scaleRatio = seededValue(
      instanceSet.seed,
      slot,
      0x7363616c,
    );
    const scale =
      instanceSet.variation.scale.min * (1 - scaleRatio) +
      instanceSet.variation.scale.max * scaleRatio;
    const paletteIndex = Math.min(
      instanceSet.variation.palette.length - 1,
      Math.floor(
        seededValue(instanceSet.seed, slot, 0x70616c65) *
          instanceSet.variation.palette.length,
      ),
    );
    const position =
      layout.kind === "along-route"
        ? { x: point.x, y: instanceSet.anchor.y, z: point.z }
        : {
            x:
              instanceSet.anchor.x +
              point.x * cosine +
              point.z * sine,
            y: instanceSet.anchor.y + point.y,
            z:
              instanceSet.anchor.z -
              point.x * sine +
              point.z * cosine,
          };
    const traits = Object.fromEntries(
      instanceSet.variation.traits.map((trait, index) => {
        const ratio = seededValue(
          instanceSet.seed,
          slot,
          index,
          0x74726169,
        );
        return [
          trait.name,
          trait.min * (1 - ratio) + trait.max * ratio,
        ];
      }),
    );
    const explicit =
      layout.kind === "explicit" ? layout.transforms[slot] : undefined;
    const palette =
      explicit?.palette ?? instanceSet.variation.palette[paletteIndex];
    if (
      [position.x, position.y, position.z, scale, ...values(traits)].some(
        (value) => Number.isFinite(value) === false,
      ) ||
      palette === undefined
    )
      throw new RangeError(
        'Instance set "' +
          instanceSet.id +
          '" slot ' +
          slot +
          " derived non-finite variation or an empty palette.",
      );
    const choices =
      instanceSet.prototypes ?? [
        {
          id: "default",
          modelRecipe: instanceSet.modelRecipe,
          weight: 1,
        },
      ];
    const selectPrototype = () => {
      if (explicit?.prototype !== undefined) {
        const selected = choices.find(
          (choice) => choice.id === explicit.prototype,
        );
        if (selected === undefined)
          throw new Error(
            'Instance set "' +
              instanceSet.id +
              '" slot ' +
              slot +
              ' references missing prototype "' +
              explicit.prototype +
              '".',
          );
        return selected;
      }
      const total = choices.reduce(
        (sum, choice) => sum + choice.weight,
        0,
      );
      let sample =
        seededValue(instanceSet.seed, slot, 0x70726f74) * total;
      for (const choice of choices) {
        if (sample < choice.weight) return choice;
        sample -= choice.weight;
      }
      return choices[choices.length - 1];
    };
    const selectedPrototype = selectPrototype();
    const legacy =
      instanceSet.prototypes === undefined &&
      layout.kind !== "lattice" &&
      layout.kind !== "explicit" &&
      instanceSet.variation.scale3 === undefined &&
      instanceSet.variation.rotationDeg === undefined &&
      instanceSet.variation.visibleProbability === undefined;
    const base = {
      slot,
      node:
        explicit === undefined
          ? "instance:" +
            instanceSet.id +
            ":slot:" +
            String(slot).padStart(6, "0")
          : "instance:" + instanceSet.id + ":" + explicit.id,
      modelRecipe: selectedPrototype.modelRecipe,
      position,
      facingDeg: instanceSet.facingDeg,
      scale,
      palette,
      traits: { ...traits, ...explicit?.traits },
    };
    if (legacy) return freeze(base);
    const scale3 =
      explicit?.scale ??
      (instanceSet.variation.scale3 === undefined
        ? { x: scale, y: scale, z: scale }
        : {
            x:
              instanceSet.variation.scale3.min.x *
                (1 - seededValue(instanceSet.seed, slot, 0x73637878)) +
              instanceSet.variation.scale3.max.x *
                seededValue(instanceSet.seed, slot, 0x73637878),
            y:
              instanceSet.variation.scale3.min.y *
                (1 - seededValue(instanceSet.seed, slot, 0x73637979)) +
              instanceSet.variation.scale3.max.y *
                seededValue(instanceSet.seed, slot, 0x73637979),
            z:
              instanceSet.variation.scale3.min.z *
                (1 - seededValue(instanceSet.seed, slot, 0x73637a7a)) +
              instanceSet.variation.scale3.max.z *
                seededValue(instanceSet.seed, slot, 0x73637a7a),
          });
    const quaternionMultiply = (left, right) => ({
      x:
        left.w * right.x +
        left.x * right.w +
        left.y * right.z -
        left.z * right.y,
      y:
        left.w * right.y -
        left.x * right.z +
        left.y * right.w +
        left.z * right.x,
      z:
        left.w * right.z +
        left.x * right.y -
        left.y * right.x +
        left.z * right.w,
      w:
        left.w * right.w -
        left.x * right.x -
        left.y * right.y -
        left.z * right.z,
    });
    const quaternionAxisAngle = (axis, angle) => {
      const length = Math.sqrt(
        axis.x * axis.x + axis.y * axis.y + axis.z * axis.z,
      );
      if (length === 0) return { x: 0, y: 0, z: 0, w: 1 };
      // Quaternion.fromAxisAngle halves the radian angle in two steps, so
      // folding both into a single division by 360 rounds differently and
      // disagreed with the engine on 384 of 1441 sampled angles.
      const half = (angle * (Math.PI / 180)) / 2;
      const scalar = Math.sin(half) / length;
      return {
        x: axis.x * scalar,
        y: axis.y * scalar,
        z: axis.z * scalar,
        w: Math.cos(half),
      };
    };
    const ranges = instanceSet.variation.rotationDeg;
    const sampledRotation =
      ranges === undefined
        ? { x: 0, y: 0, z: 0, w: 1 }
        : [
            [
              { x: 1, y: 0, z: 0 },
              ranges.x.min *
                  (1 - seededValue(instanceSet.seed, slot, 0x726f7478)) +
                ranges.x.max *
                  seededValue(instanceSet.seed, slot, 0x726f7478),
            ],
            [
              { x: 0, y: 1, z: 0 },
              ranges.y.min *
                  (1 - seededValue(instanceSet.seed, slot, 0x726f7479)) +
                ranges.y.max *
                  seededValue(instanceSet.seed, slot, 0x726f7479),
            ],
            [
              { x: 0, y: 0, z: 1 },
              ranges.z.min *
                  (1 - seededValue(instanceSet.seed, slot, 0x726f747a)) +
                ranges.z.max *
                  seededValue(instanceSet.seed, slot, 0x726f747a),
            ],
          ]
            .map(([axis, angle]) => quaternionAxisAngle(axis, angle))
            .reduce(
              (rotation, next) => quaternionMultiply(rotation, next),
              { x: 0, y: 0, z: 0, w: 1 },
            );
    const combinedRotation = quaternionMultiply(
      quaternionAxisAngle({ x: 0, y: 1, z: 0 }, instanceSet.facingDeg),
      explicit?.rotation ?? sampledRotation,
    );
    const rotationLength = Math.sqrt(
      combinedRotation.x * combinedRotation.x +
        combinedRotation.y * combinedRotation.y +
        combinedRotation.z * combinedRotation.z +
        combinedRotation.w * combinedRotation.w,
    );
    // Quaternion.normalize scales by the reciprocal, so this divides once
    // rather than four times and stays byte-identical to the engine.
    const rotationInverse = rotationLength === 0 ? 0 : 1 / rotationLength;
    const rotation =
      rotationLength === 0
        ? { x: 0, y: 0, z: 0, w: 1 }
        : {
            x: combinedRotation.x * rotationInverse,
            y: combinedRotation.y * rotationInverse,
            z: combinedRotation.z * rotationInverse,
            w: combinedRotation.w * rotationInverse,
          };
    return freeze({
      ...base,
      prototype: selectedPrototype.id,
      rotation,
      scale3,
      visible:
        explicit?.visible ??
        (instanceSet.variation.visibleProbability === undefined ||
          seededValue(instanceSet.seed, slot, 0x76697369) <
            instanceSet.variation.visibleProbability),
    });
  };
  const insidePolygon = (point, polygon) => {
    let inside = false;
    for (
      let index = 0, previous = polygon.length - 1;
      index < polygon.length;
      previous = index++
    ) {
      const currentPoint = polygon[index];
      const previousPoint = polygon[previous];
      if (
        (currentPoint.z > point.z) !== (previousPoint.z > point.z) &&
        point.x <
          ((previousPoint.x - currentPoint.x) * (point.z - currentPoint.z)) /
            (previousPoint.z - currentPoint.z) +
            currentPoint.x
      )
        inside = !inside;
    }
    return inside;
  };
  // What a build function returned, read once for both entry points. A promise
  // is reported rather than awaited, because a deterministic module that had to
  // wait for something has already left the boundary this sandbox draws.
  const settle = (result) => {
    const returnedPromise =
      typeof result === "object" &&
      result !== null &&
      typeof result.then === "function";
    const serialized = returnedPromise ? null : stringify(result);
    return {
      returnedPromise,
      resultJson: typeof serialized === "string" ? serialized : null,
    };
  };
  const invoke = (contextJson, exportName) => {
    const data = parse(contextJson);
    const engine = Object.freeze({
      distance: (left, right) =>
        hypot(left.x - right.x, left.y - right.y, left.z - right.z),
      // Asked of the one reading, so a source placing a prop on the ground and
      // a compiler placing a member on it get the same number. Over nothing it
      // is the scalar plane the engine assumed before terrain existed.
      groundHeight: (point) =>
        worldGroundHeight(data.world.surfaces, point) ?? 0,
      formationSlot: (formation, slot) =>
        formationSlot(data, formation, slot),
      instanceSlot: (instanceSet, slot) =>
        instanceSlot(data, instanceSet, slot),
    });
    const context = freeze({ ...data, engine });
    return settle(automovieModule.exports[exportName].build(context));
  };
  // A library owner receives its own address and nothing else. The film helpers
  // above read a staged world, a formation runtime and an instance runtime, and
  // a library compile has none of the three, so handing one over would be a
  // context whose members throw the moment they are touched.
  const invokeLibrary = (contextJson, exportName) =>
    settle(
      automovieModule.exports[exportName].build(freeze(parse(contextJson))),
    );
  Object.defineProperty(globalThis, "__automovieInvoke", {
    value: invoke,
    writable: false,
    configurable: false,
  });
  Object.defineProperty(globalThis, "__automovieInvokeLibrary", {
    value: invokeLibrary,
    writable: false,
    configurable: false,
  });
  Object.freeze(Math);
  Object.freeze(JSON);
})();
`;

const SOURCE_INVOCATION = `
(() => {
  "use strict";
  const snapshot = __automovieInvoke(
    __automovieContextJson,
    __automovieExportName,
  );
  globalThis.__automovieReturnedPromise = snapshot.returnedPromise;
  globalThis.__automovieResultJson = snapshot.resultJson;
  delete globalThis.__automovieContextJson;
  delete globalThis.__automovieExportName;
})();
`;

const compileShotSource = (
  props: ICompileShotSourceProps,
): ICompileShotSourceResult => {
  const program = compileDeterministicSource({
    ...props,
    target: `shot:${props.id}`,
    label: "thin shot program",
    registration: {
      id: props.id,
      contract: contractOfRegistration(props.context.contract),
    },
    validate: (input) =>
      typia.validateEquals<IAutoMovieProductionShotProgram>(input),
  });
  if (program.value === null)
    return {
      value: null,
      closing: null,
      conversions: [],
      diagnostics: program.diagnostics,
    };

  const sourceRuntime = sourceRuntimeOf({
    program: program.value,
    runtimeModels: props.context.runtimeModels,
    target: `shot:${props.id}`,
    sourcePath: props.path,
  });
  const adoptedMotions = resolveExternalMotionClips({
    adoptions: props.context.externalMotions,
    program: program.value,
    runtimeModels: sourceRuntime.runtimeModels,
    target: `shot:${props.id}`,
    sourcePath: props.path,
  });
  const shotProgram: IAutoMovieProductionShotProgram = {
    ...program.value,
    clips: [...(program.value.clips ?? []), ...adoptedMotions.clips],
  };
  const runtime = actorRuntimeOf(
    shotProgram,
    sourceRuntime.runtimeModels,
    `shot:${props.id}`,
    props.path,
  );
  // Severity decides, not count. Both halves used to be counted because both
  // could only produce errors, and the moment one of them learned to warn, a
  // warning would have withheld the compiled shot while explaining nothing: the
  // author would read one advisory sentence and a film that reports the shot as
  // never compiled.
  if (
    sourceRuntime.diagnostics.some(
      (diagnostic) => diagnostic.category === "error",
    ) ||
    adoptedMotions.diagnostics.some(
      (diagnostic) => diagnostic.category === "error",
    ) ||
    runtime.diagnostics.some((diagnostic) => diagnostic.category === "error")
  )
    return {
      value: null,
      closing: null,
      conversions: [],
      diagnostics: [
        ...program.diagnostics,
        ...sourceRuntime.diagnostics,
        ...adoptedMotions.diagnostics,
        ...runtime.diagnostics,
      ],
    };
  const shot = defineShot(props.id, {
    scene: program.registrationScene!,
    contract: contractOfRegistration(props.context.contract),
    build: () => shotProgram,
  });
  const clipById = new Map(
    (shotProgram.clips ?? []).map((clip) => [clip.id, clip]),
  );
  const referenceSynthesizer = makeActorSynthesizer(
    runtime.actors,
    runtime.nodes,
  );
  const compiled = compileDefinedShot({
    shot,
    context: undefined,
    runtime: {
      synthesize: (action, actor, previous) =>
        action.verb === "enact"
          ? (clipById.get(action.clip) ?? null)
          : referenceSynthesizer(action, actor, previous),
      skeleton: (node) => runtime.models.get(node)?.skeleton ?? null,
      hasActorContext: (node) => runtime.actors.has(node),
      gaits: (node) => runtime.actors.get(node)?.gaits.map((gait) => gait.name),
      frameFormat: props.context.frameFormat,
      cameraClearance: props.cameraClearance,
      world: props.context.world,
      formationDesigns: new Map(Object.entries(props.context.formations)),
      formations: Object.values(props.context.formationRuntime),
      // The unit cues the source authored, handed to the performance boundary
      // rather than only attached to the artifact below: a camera framing a
      // formation has to measure it where its cue has moved it.
      formationMotions: shotProgram.formationMotions ?? [],
      // The shot's own light statement, left undefined when the source made
      // none so its compiled artifact keeps the exact bytes it had before this
      // channel existed.
      lightMotions: shotProgram.lightMotions,
      // The shot's own turning things: a building panel on its opening, a
      // prop's leaf on its hinge. Without them the performance boundary has
      // nothing to gate, so a source could author a door swing, pass every
      // validator, and be dropped here without a word.
      objectMotions: shotProgram.objectMotions,
      props: shotProgram.props,
      models: sourceRuntime.models,
      previous: props.previous ?? undefined,
    },
  });
  if (compiled.success === false)
    return {
      value: null,
      closing: null,
      conversions: [],
      diagnostics: [
        ...program.diagnostics,
        ...adoptedMotions.diagnostics,
        ...compiled.diagnostics.map(
          (diagnostic): IAutoMovieDiagnostic => ({
            code: diagnostic.code,
            category: "error",
            phase: "source",
            target: `shot:${props.id}`,
            path: props.path,
            message: `${diagnostic.fact} ${diagnostic.impact} ${diagnostic.recovery}`,
          }),
        ),
      ],
    };
  // The production's own light, at the story moment this shot is pinned to.
  //
  // A film that runs across a stretch of story states its source once and
  // every shot stands under it, instead of each scene restaging its own light
  // with nothing relating one to the next. The merge is the engine's, by id:
  // a staged light a source names is replaced in place, and a source no scene
  // declares is appended. A production that declares no lighting, or a shot
  // carrying no story pin, gets its staged lights back element by element, so
  // the compiled bytes are unchanged for every film that says nothing.
  //
  // State, not motion: the shot inherits where the light IS at its own story
  // origin. Carrying the source's motion in as well would mean resampling a
  // story-clock curve onto a shot-local one, and a resampling is exact for
  // some interpolations and an approximation for others -- a shot states its
  // own light-over-time through `lightMotions`, which runs on top of this.
  const scene = compiled.source.scene;
  const inherited = inheritProductionLighting({
    lighting: props.context.lighting ?? null,
    lights: scene.lights,
    pin: props.context.contract.storyTime ?? null,
    seconds: 0,
  });
  return {
    value: {
      ...compiled.source,
      authoredModels: structuredClone(sourceRuntime.authoredModels),
      props: structuredClone(shotProgram.props ?? []),
      builtEnvironments: structuredClone(shotProgram.builtEnvironments ?? []),
      // Every fold a building binds travels with the artifact, because the
      // renderer reads the artifact and nothing else. A record validated at
      // compile and dropped here is a pond the compiler approved and the frame
      // does not contain.
      //
      // A fold nobody declared stays absent rather than arriving as an empty
      // array: the artifact is content-addressed, and eleven empty keys would
      // rewrite the digest of every production that has never heard of water.
      ...boundFolds(shotProgram),
      scene: { ...scene, lights: inherited },
      formationMotions: structuredClone(shotProgram.formationMotions ?? []),
      formationSlotMotions: structuredClone(
        shotProgram.formationSlotMotions ?? [],
      ),
      effectCues: structuredClone(shotProgram.effectCues ?? []),
    },
    closing: compiled.continuity.closing,
    conversions: adoptedMotions.conversions,
    // Every source-phase finding travels, including the two lists a shot used to
    // publish only when it failed. Reaching here means neither carried an error,
    // so what they carry is advice, and advice nobody is told about is the same
    // as advice nobody wrote.
    diagnostics: [
      ...program.diagnostics,
      ...sourceRuntime.diagnostics,
      ...adoptedMotions.diagnostics,
      ...runtime.diagnostics,
    ],
  };
};

const resolveExternalMotionClips = (props: {
  adoptions: readonly ICompilerExternalMotionAdoption[];
  program: IAutoMovieProductionShotProgram;
  runtimeModels: IAutoMovieShotBuildContext["runtimeModels"];
  target: string;
  sourcePath: string;
}): {
  clips: IAutoMovieMotion[];
  conversions: ICompilerExternalMotionConversionDraft[];
  diagnostics: IAutoMovieDiagnostic[];
} => {
  const clips: IAutoMovieMotion[] = [];
  const conversions: ICompilerExternalMotionConversionDraft[] = [];
  const diagnostics: IAutoMovieDiagnostic[] = [];
  const modelRegistry = createAutoMovieSourceRuntimeModelRegistry(
    props.runtimeModels,
  );
  const authoredClipIds = new Set(
    (props.program.clips ?? []).map((clip) => clip.id),
  );
  for (const adoption of props.adoptions) {
    const declaration = adoption.declaration;
    if (authoredClipIds.has(declaration.clip)) {
      diagnostics.push({
        code: "source-motion-adoption-invalid",
        category: "error",
        phase: "source",
        target: props.target,
        path: props.sourcePath,
        message: `External motion adoption "${declaration.id}" targets clip id "${declaration.clip}", but the shot source already declares that clip. Choose a distinct adoption clip id instead of replacing source-authored motion by map insertion order.`,
      });
      continue;
    }
    const actor = props.program.actors.find(
      (candidate) => candidate.node === declaration.actor,
    );
    const targetModel =
      actor === undefined ? undefined : modelRegistry.resolve(actor.model);
    const targetSkeleton = targetModel?.skeleton ?? null;
    if (actor === undefined || targetSkeleton === null) {
      diagnostics.push({
        code: "source-motion-adoption-invalid",
        category: "error",
        phase: "source",
        target: props.target,
        path: props.sourcePath,
        message: `External motion adoption "${declaration.id}" targets actor "${declaration.actor}", but that actor is absent or has no resolved articulated runtime model in this shot. Correct the explicit actor or model binding.`,
      });
      continue;
    }
    const actions =
      props.program.performance.revise.final ?? props.program.performance.draft;
    const consumers = actions.filter(
      (action) => action.verb === "enact" && action.clip === declaration.clip,
    );
    if (consumers.length === 0) {
      diagnostics.push({
        code: "source-motion-adoption-invalid",
        category: "error",
        phase: "source",
        target: props.target,
        path: props.sourcePath,
        message: `External motion adoption "${declaration.id}" exposes clip "${declaration.clip}" for actor "${declaration.actor}", but the final performance never enacts it. Remove the unused adoption or enact that exact clip with the declared actor.`,
      });
      continue;
    }
    const wrongConsumer = consumers.find((action) => {
      const actors = Array.isArray(action.actor)
        ? action.actor
        : [action.actor];
      return actors.length !== 1 || actors[0] !== declaration.actor;
    });
    if (wrongConsumer !== undefined) {
      const actors = Array.isArray(wrongConsumer.actor)
        ? wrongConsumer.actor
        : [wrongConsumer.actor];
      diagnostics.push({
        code: "source-motion-adoption-invalid",
        category: "error",
        phase: "source",
        target: props.target,
        path: props.sourcePath,
        message: `External motion adoption "${declaration.id}" belongs only to actor "${declaration.actor}", but final enact clip "${declaration.clip}" names actor set [${actors.map((value) => `"${value}"`).join(", ")}]. Use the declared actor alone; same-rig or mixed actors do not inherit this adoption.`,
      });
      continue;
    }
    if (adoption.receipt.handoff.mode === "native") {
      if (
        adoption.sourceMotion.skeleton !== targetSkeleton.id ||
        nativeExternalMotionRigCompatible(
          adoption.receipt.handoff.sourceRig,
          adoption.receipt.handoff.mapping.map((entry) => entry.bone),
          targetSkeleton,
        ) === false
      ) {
        diagnostics.push({
          code: "source-motion-adoption-invalid",
          category: "error",
          phase: "source",
          target: props.target,
          path: props.sourcePath,
          message: `Native external motion adoption "${declaration.id}" was authored for source rig "${adoption.sourceMotion.skeleton}" but actor "${declaration.actor}" does not resolve the same mapped hierarchy, rest transforms, constraints, and rig identity in "${targetSkeleton.id}". Choose retarget mode or bind a byte-compatible native rig.`,
        });
        continue;
      }
      clips.push(adoption.sourceMotion);
      conversions.push(
        externalMotionConversionDraft({
          adoption,
          shot: declaration.shot,
          targetModel: actor.model,
          targetSkeleton,
          motion: adoption.sourceMotion,
          characterization: { status: "compatible", findings: [] },
          losses: [],
        }),
      );
      continue;
    }
    const retargeted = retargetHumanoidMotion({
      motion: adoption.sourceMotion,
      source: adoption.receipt.handoff.sourceRig,
      target: targetSkeleton,
      rootScale: adoption.receipt.handoff.translationScale,
      id: declaration.clip,
    });
    const findings =
      retargeted.validation.success === false
        ? retargeted.validation.violations
        : (retargeted.validation.warnings ?? []);
    diagnostics.push(
      ...findings.map(
        (finding): IAutoMovieDiagnostic => ({
          code: "source-motion-retarget-invalid",
          category: finding.severity === "error" ? "error" : "warning",
          phase: "source",
          target: props.target,
          path: props.sourcePath,
          message: `External motion adoption "${declaration.id}" retarget ${finding.path}: ${finding.expected}. Correct the declared source rig, target actor, mapping, or translation scale.`,
        }),
      ),
    );
    if (retargeted.motion !== null) {
      clips.push(retargeted.motion);
      const characterization: IAutoMovieExternalMotionReceiptCharacterization =
        findings.length === 0
          ? { status: "compatible", findings: [] }
          : {
              status: "override-required",
              findings: findings.map(
                (finding) => `${finding.path}: ${finding.expected}`,
              ),
            };
      const losses: IAutoMovieExternalMotionLossEntry[] = findings.map(
        (finding) => ({
          kind: "semantic-loss",
          source: [finding.path],
          consequence: finding.expected,
          authorized: false,
        }),
      );
      conversions.push(
        externalMotionConversionDraft({
          adoption,
          shot: declaration.shot,
          targetModel: actor.model,
          targetSkeleton,
          motion: retargeted.motion,
          characterization,
          losses,
        }),
      );
    }
  }
  return { clips, conversions, diagnostics };
};

/** Build the deterministic receipt facts available before output bytes exist. */
const externalMotionConversionDraft = (props: {
  adoption: ICompilerExternalMotionAdoption;
  shot: string;
  targetModel: string;
  targetSkeleton: IAutoMovieSkeleton;
  motion: IAutoMovieMotion;
  characterization: IAutoMovieExternalMotionReceiptCharacterization;
  losses: IAutoMovieExternalMotionLossEntry[];
}): ICompilerExternalMotionConversionDraft => {
  const declaration = props.adoption.declaration;
  const mapping = declaration.mapping
    .map((entry) => ({ ...entry }))
    .sort(
      (left, right) =>
        compareCodeUnits(left.source, right.source) ||
        compareCodeUnits(left.target, right.target),
    );
  const channelSources = props.adoption.receipt.take.tracks.map((track) =>
    track.channel.kind === "node"
      ? `${track.channel.node}:${track.channel.path}`
      : `${track.channel.pointer}:${track.channel.valueType}`,
  );
  const boneByNode = new Map(
    mapping.map((entry) => [entry.source, entry.target] as const),
  );
  const channelTargets = props.adoption.receipt.take.tracks.map((track) =>
    track.channel.kind === "node"
      ? `${boneByNode.get(track.channel.node)!}:${track.channel.path}`
      : track.channel.pointer,
  );
  const transforms: IAutoMovieExternalMotionTransformActivity[] = [
    {
      kind: "channel-conversion",
      source: channelSources,
      target: channelTargets,
      parameters: {
        take: declaration.take,
        sourceTracks: channelSources.length,
        resultChannels: channelTargets.length,
      },
    },
  ];
  if (declaration.mode.kind === "humanoid-retarget") {
    transforms.push({
      kind: "retarget",
      source: mapping.map((entry) => entry.source),
      target: mapping.map((entry) => entry.target),
      parameters: {
        sourceRig: declaration.sourceRig.id,
        targetRig: props.targetSkeleton.id,
      },
    });
    transforms.push({
      kind: "translation-scale",
      source: ["hips:translation"],
      target: ["hips:translation"],
      parameters: { scale: declaration.mode.translationScale },
    });
  }
  return {
    version: 1,
    compiler: {
      packageVersion: AUTOMOVIE_PRODUCTION_COMPILER_VERSION,
      protocolVersion: AUTOMOVIE_PRODUCTION_COMPILER_PROTOCOL,
    },
    adoption: declaration.id,
    source: {
      asset: {
        path: props.adoption.receipt.source.path,
        digest: props.adoption.receipt.source.digest,
      },
      closure: props.adoption.sourceClosure.map((entry) => ({ ...entry })),
      take: { ...props.adoption.sourceTake },
      basis: structuredClone(props.adoption.sourceBasis),
      basisDigest: digestAutoMovieBytes(
        canonicalAutoMovieJsonBytes(props.adoption.sourceBasis),
      ),
    },
    decision: {
      shot: props.shot,
      actor: declaration.actor,
      clip: declaration.clip,
      mode: declaration.mode.kind,
      mapping,
      translationScale:
        declaration.mode.kind === "humanoid-retarget"
          ? declaration.mode.translationScale
          : null,
    },
    target: {
      model: props.targetModel,
      skeleton: props.targetSkeleton.id,
      basisDigest: digestAutoMovieBytes(
        canonicalAutoMovieJsonBytes(props.targetSkeleton),
      ),
    },
    transforms,
    losses: props.losses.map((entry) => ({
      ...entry,
      source: [...entry.source],
    })),
    characterization: {
      status: props.characterization.status,
      findings: [...props.characterization.findings],
    },
    motion: structuredClone(props.motion),
  };
};

/** Whether every mapped native source bone is byte-compatible with its target. */
const nativeExternalMotionRigCompatible = (
  source: IAutoMovieSkeleton,
  mapped: readonly AutoMovieHumanoidBone[],
  target: IAutoMovieSkeleton,
): boolean => {
  if (source.id !== target.id) return false;
  const sourceBones = new Map(source.bones.map((bone) => [bone.bone, bone]));
  const targetBones = new Map(target.bones.map((bone) => [bone.bone, bone]));
  const mappedBones = new Set(mapped);
  for (const bone of mappedBones) {
    const from = sourceBones.get(bone);
    const to = projectedNativeBone(targetBones, mappedBones, bone);
    if (
      from === undefined ||
      to === null ||
      Buffer.from(canonicalAutoMovieJsonBytes(from)).equals(
        Buffer.from(canonicalAutoMovieJsonBytes(to)),
      ) === false
    )
      return false;
  }
  return true;
};

/**
 * Collapse unmapped target helpers exactly as byte-grounded source mapping
 * does.
 */
const projectedNativeBone = (
  bones: ReadonlyMap<
    AutoMovieHumanoidBone,
    IAutoMovieSkeleton["bones"][number]
  >,
  mapped: ReadonlySet<AutoMovieHumanoidBone>,
  bone: AutoMovieHumanoidBone,
): IAutoMovieSkeleton["bones"][number] | null => {
  const terminal = bones.get(bone);
  if (terminal === undefined) return null;
  const chain: IAutoMovieSkeleton["bones"][number][] = [terminal];
  let parent = terminal.parent;
  while (parent !== null && mapped.has(parent) === false) {
    const helper = bones.get(parent);
    if (helper === undefined) return null;
    chain.push(helper);
    parent = helper.parent;
  }
  let rest: IAutoMovieSkeleton["bones"][number]["rest"] = {
    translation: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0, w: 1 },
    scale: { x: 1, y: 1, z: 1 },
  };
  for (const member of chain.reverse())
    rest = composeNativeRest(rest, member.rest);
  return {
    bone,
    parent,
    rest,
    constraint: structuredClone(terminal.constraint),
  };
};

/** Compose two parent-local TRS values without introducing matrix ambiguity. */
const composeNativeRest = (
  parent: IAutoMovieSkeleton["bones"][number]["rest"],
  local: IAutoMovieSkeleton["bones"][number]["rest"],
): IAutoMovieSkeleton["bones"][number]["rest"] => {
  const scaled = {
    x: local.translation.x * parent.scale.x,
    y: local.translation.y * parent.scale.y,
    z: local.translation.z * parent.scale.z,
  };
  const q = parent.rotation;
  const uv = {
    x: q.y * scaled.z - q.z * scaled.y,
    y: q.z * scaled.x - q.x * scaled.z,
    z: q.x * scaled.y - q.y * scaled.x,
  };
  const uuv = {
    x: q.y * uv.z - q.z * uv.y,
    y: q.z * uv.x - q.x * uv.z,
    z: q.x * uv.y - q.y * uv.x,
  };
  const rotated = {
    x: scaled.x + 2 * (q.w * uv.x + uuv.x),
    y: scaled.y + 2 * (q.w * uv.y + uuv.y),
    z: scaled.z + 2 * (q.w * uv.z + uuv.z),
  };
  const a = parent.rotation;
  const b = local.rotation;
  return {
    translation: {
      x: parent.translation.x + rotated.x,
      y: parent.translation.y + rotated.y,
      z: parent.translation.z + rotated.z,
    },
    rotation: {
      x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
      y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
      z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
      w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
    },
    scale: {
      x: parent.scale.x * local.scale.x,
      y: parent.scale.y * local.scale.y,
      z: parent.scale.z * local.scale.z,
    },
  };
};

/**
 * How one fold's validator paths are read as addresses in the program.
 *
 * Two shapes exist because the validators take two shapes of input, and a fold
 * has to say which one it handed over. A validator given several lists roots its
 * paths at those lists (`$input.features[0]`), and one given a single record
 * roots them at the record's own fields (`$input.zones[0]`, `$input.id`), where
 * the same text means something entirely different.
 */
interface IBindingAddress {
  /** `$input` is one record of this program list, so every path hangs under it. */
  root?: { key: string; index: number };

  /** `$input.<name>[i]` addresses this program list at the mapped position. */
  fields?: Readonly<
    Record<string, { key: string; indices: readonly number[] }>
  >;
}

/**
 * One binding's own address inside the program that declared it.
 *
 * A fold's validator is handed the records for one building, so its violation
 * paths count within that filtered list. An author reads the program, not the
 * filter, so each local index is mapped back to the position the record
 * actually occupies.
 *
 * A single-record fold needs the other direction. Its validator was handed the
 * record itself, so `$input.zones[0]` means the zones of that record and not a
 * program field called `zones`; without the record's own address in front, the
 * author is handed a path to a field the program does not have. Three of the four
 * folds here were reported that way, which is how a service network's finding
 * arrived as `$program.penetrations[0]`.
 */
const rewriteBindingPath = (path: string, address: IBindingAddress): string => {
  const inside = path.slice("$input".length);
  if (address.root !== undefined)
    return `$program.${address.root.key}[${address.root.index}]${inside}`;
  const matched = /^\$input\.([A-Za-z]+)\[(\d+)\]/u.exec(path);
  if (matched === null) return `$program${inside}`;
  const field = address.fields?.[matched[1]!];
  if (field === undefined) return `$program${inside}`;
  const local = Number(matched[2]);
  return `$program.${field.key}[${field.indices[local] ?? local}]${path.slice(matched[0].length)}`;
};

/** Records of one fold that name a building, kept with where they were written. */
const bindingsOfEnvironment = <T extends { environment: string }>(
  items: readonly T[],
  environment: string,
): { items: T[]; indices: number[] } => {
  const kept: T[] = [];
  const indices: number[] = [];
  items.forEach((item, index) => {
    if (item.environment !== environment) return;
    kept.push(item);
    indices.push(index);
  });
  return { items: kept, indices };
};

/**
 * Refuse every fold that binds itself to a building this shot does not stage.
 *
 * Water, cloth, planting and building services are independent domains that
 * become architecture only through a binding, and each binding names the
 * building it belongs to. An unresolved name is the one failure none of those
 * folds can see for itself: each validator is handed one building and answers
 * about that one, so a record pointing at a building nobody staged would simply
 * never be checked by anyone.
 */
const buildingBoundDiagnostics = (
  program: IAutoMovieProductionShotProgram,
): IAutoMovieSourceContentFinding[] => {
  const messages: IAutoMovieSourceContentFinding[] = [];
  const environments = program.builtEnvironments ?? [];
  const known = new Set(environments.map((environment) => environment.id));
  const waterFeatures = program.waterFeatures ?? [];
  const softFurnishings = program.softFurnishings ?? [];
  const plantingInstallations = program.plantingInstallations ?? [];
  const serviceNetworks = program.serviceNetworks ?? [];
  const unresolved = (
    key: string,
    items: readonly { environment: string }[],
  ): void => {
    items.forEach((item, index) => {
      if (known.has(item.environment)) return;
      // A name that resolves to nothing is the record's own content, so it takes
      // the same identity a validator's `type` violation would.
      messages.push({
        kind: "type",
        severity: "error",
        message: `$program.${key}[${index}].environment "${item.environment}" does not resolve to a building this shot stages. Declare that building, or bind the record to one the shot already carries.`,
      });
    });
  };
  unresolved("waterFeatures", waterFeatures);
  unresolved("softFurnishings", softFurnishings);
  unresolved("plantingInstallations", plantingInstallations);
  unresolved("serviceNetworks", serviceNetworks);

  const fluidDomains = program.fluidDomains ?? [];
  const softBodyDomains = program.softBodyDomains ?? [];
  const plantingDomains = program.plantingDomains ?? [];
  const plantingClusters = program.plantingClusters ?? [];
  const allOf = (items: readonly unknown[]): number[] =>
    items.map((_, index) => index);
  // Both branches of the validation are read. A fold that produced only warnings
  // succeeds, and reading the failure branch alone is how an uncited penetration
  // never reached the author at all while the same warning beside an error
  // reached them as a refusal.
  const say = (
    validation: IAutoMovieValidation,
    address: IBindingAddress,
    remedy: string,
  ): void => {
    for (const violation of autoMovieValidationFindings(validation))
      messages.push(
        autoMovieSourceContentFinding(
          violation,
          `${rewriteBindingPath(violation.path, address)} ${violation.expected}. ${remedy}`,
        ),
      );
  };

  say(
    validateAutoMovieSoftFurnishingDomainOwnership(softFurnishings),
    {
      fields: {
        furnishings: {
          key: "softFurnishings",
          indices: allOf(softFurnishings),
        },
      },
    },
    "Give each world-space soft-body domain exactly one furnishing owner before compiling the shot.",
  );

  for (const environment of environments) {
    const water = bindingsOfEnvironment(waterFeatures, environment.id);
    if (water.items.length !== 0)
      say(
        validateWaterFeatures({
          environment,
          features: water.items,
          domains: [...fluidDomains],
        }),
        {
          fields: {
            features: { key: "waterFeatures", indices: water.indices },
            domains: { key: "fluidDomains", indices: allOf(fluidDomains) },
          },
        },
        "Correct the water feature or the domain it binds before compiling the shot.",
      );
    const cloth = bindingsOfEnvironment(softFurnishings, environment.id);
    if (cloth.items.length !== 0)
      say(
        validateSoftFurnishings({
          environment,
          furnishings: cloth.items,
          domains: [...softBodyDomains],
          domainOwnership: "prevalidated",
        }),
        {
          fields: {
            furnishings: { key: "softFurnishings", indices: cloth.indices },
            domains: {
              key: "softBodyDomains",
              indices: allOf(softBodyDomains),
            },
          },
        },
        "Correct the soft furnishing or the domain it hangs before compiling the shot.",
      );
    const planting = bindingsOfEnvironment(
      plantingInstallations,
      environment.id,
    );
    if (planting.items.length !== 0)
      say(
        validatePlantingInstallations({
          environment,
          installations: planting.items,
          clusters: [...plantingClusters],
          domains: [...plantingDomains],
        }),
        {
          fields: {
            installations: {
              key: "plantingInstallations",
              indices: planting.indices,
            },
            clusters: {
              key: "plantingClusters",
              indices: allOf(plantingClusters),
            },
            domains: {
              key: "plantingDomains",
              indices: allOf(plantingDomains),
            },
          },
        },
        "Correct the planting installation, its cluster or its recipe before compiling the shot.",
      );
    serviceNetworks.forEach((network, index) => {
      if (network.environment !== environment.id) return;
      const address = { root: { key: "serviceNetworks", index } };
      say(
        validateServiceNetwork({ network, environment }),
        address,
        "Correct the port network before compiling the shot.",
      );
      say(
        validateWetZones({ network, environment }),
        address,
        "Correct the wet zone before compiling the shot.",
      );
    });
  }

  // A domain nobody bound is still a domain the production declared, and an
  // unsound one no feature happens to cite is exactly the record an author is
  // about to bind. It answers for itself here rather than staying unchecked
  // until the binding exists.
  const boundFluid = new Set(waterFeatures.map((feature) => feature.domain));
  fluidDomains.forEach((domain, index) => {
    if (boundFluid.has(domain.id)) return;
    say(
      validateFluidDomain({ domain }),
      { root: { key: "fluidDomains", index } },
      "Correct the fluid domain before compiling the shot.",
    );
  });
  const boundCloth = new Set(
    softFurnishings.map((furnishing) => furnishing.domain),
  );
  softBodyDomains.forEach((domain, index) => {
    if (boundCloth.has(domain.id)) return;
    say(
      validateSoftBodyDomain({ domain }),
      { root: { key: "softBodyDomains", index } },
      "Correct the soft body domain before compiling the shot.",
    );
  });
  const boundPlanting = new Set(
    plantingClusters.map((cluster) => cluster.domain),
  );
  plantingDomains.forEach((domain, index) => {
    if (boundPlanting.has(domain.id)) return;
    say(
      validatePlantingDomain({ domain }),
      { root: { key: "plantingDomains", index } },
      "Correct the planting recipe before compiling the shot.",
    );
  });
  return messages;
};

/** The building-bound folds a program declared, absent when it declared none. */
const boundFolds = (
  program: IAutoMovieProductionShotProgram,
): Partial<IAutoMovieShotSourceOutput> => {
  const carried: Record<string, unknown> = {};
  for (const key of [
    "designReferences",
    "designEvidence",
    "designLineages",
    "fluidDomains",
    "waterFeatures",
    "softBodyDomains",
    "softFurnishings",
    "plantingDomains",
    "plantingClusters",
    "plantingInstallations",
    "serviceNetworks",
  ] as const) {
    const records = program[key];
    if (records === undefined || records.length === 0) continue;
    carried[key] = structuredClone(records);
  }
  return carried as Partial<IAutoMovieShotSourceOutput>;
};

interface ISourceRuntime {
  runtimeModels: Readonly<Record<string, IAutoMovieModel>>;
  models: IAutoMovieModel[];
  authoredModels: IAutoMovieModel[];
  diagnostics: IAutoMovieDiagnostic[];
}

/** Validate and bind models and buildings created by deterministic shot code. */
const sourceRuntimeOf = (props: {
  program: IAutoMovieProductionShotProgram;
  runtimeModels: IAutoMovieShotBuildContext["runtimeModels"];
  target: string;
  sourcePath: string;
}): ISourceRuntime => {
  const diagnostics: IAutoMovieDiagnostic[] = [];
  const authoredModels: IAutoMovieModel[] = [];
  const authoredDigests = new Map<string, AutoMovieContentDigest>();
  const registry = createAutoMovieSourceRuntimeModelRegistry(
    props.runtimeModels,
  );
  const runtimeIds = new Set([
    ...registry.keys(),
    ...registry.values().map((model) => model.id),
  ]);

  const report = (message: string): void => {
    diagnostics.push({
      code: "source-scene-content-invalid",
      category: "error",
      phase: "source",
      target: props.target,
      path: props.sourcePath,
      message,
    });
  };
  /**
   * Report one finding under the identity and severity its kind decides.
   *
   * `report` above is for the checks this compiler performs itself, where there
   * is no engine classification to preserve and the answer is always a blocking
   * content error. Anything a validator found comes through here instead, so a
   * physical conflict and a coverage gap keep their own catalog entries and a
   * warning stays a warning.
   */
  const classify = (finding: IAutoMovieSourceContentFinding): void => {
    diagnostics.push(
      autoMovieSourceContentDiagnostic({
        finding,
        target: props.target,
        path: props.sourcePath,
      }),
    );
  };
  const acceptModel = (
    model: IAutoMovieModel,
    modelPath: string,
    /** The registered appearance this model borrows, when a prop cites one. */
    modelRef: string | null = null,
  ): void => {
    const digest = digestAutoMovieBytes(canonicalAutoMovieJsonBytes(model));
    const existing = authoredDigests.get(model.id);
    if (existing !== undefined) {
      if (existing !== digest)
        report(
          `${modelPath}.id "${model.id}" conflicts with another source-owned model of the same id. Keep one byte-identical generated model per id.`,
        );
      return;
    }
    authoredDigests.set(model.id, digest);
    if (runtimeIds.has(model.id)) {
      report(
        `${modelPath}.id "${model.id}" shadows a compiler-owned runtime model. Rename the source model or cite the existing runtime id.`,
      );
      return;
    }
    // A prop that cites a registered appearance is the one case where source
    // may hand back an imported model, and it is only allowed to hand back the
    // one the compiler already sealed. Everything the prop means -- its proxy
    // parts, its body, its affordances, its articulation -- stays in the
    // record, so borrowing bytes never buys an escape from the semantics.
    if (modelRef === null) {
      if (model.origin !== "generated")
        report(
          `${modelPath}.origin is "${model.origin}". Shot source may create generated geometry only; register imported asset bytes in the production model registry and cite that runtime id.`,
        );
    } else {
      const registered = registry.resolve(modelRef);
      if (registered === undefined)
        report(
          `${modelPath} cites modelRef "${modelRef}", which does not resolve to a compiler-owned runtime model. Register the asset or model recipe, or drop the reference.`,
        );
      else if (
        registered.imported === undefined ||
        registered.imported === null
      )
        report(
          `${modelPath} cites modelRef "${modelRef}", which is not a registered external appearance. Register glTF, GLB or VRM bytes for it, or drop the reference.`,
        );
      else if (
        digestAutoMovieBytes(
          canonicalAutoMovieJsonBytes(registered.imported),
        ) !==
        digestAutoMovieBytes(
          canonicalAutoMovieJsonBytes(model.imported ?? null),
        )
      )
        report(
          `${modelPath}.imported is not the closure the compiler sealed for "${modelRef}". Restate the registered closure verbatim, or recompile after registering the asset again.`,
        );
      else if (model.asset !== registered.asset)
        report(
          `${modelPath}.asset "${String(model.asset)}" is not the registered appearance "${String(registered.asset)}" of "${modelRef}".`,
        );
    }
    const validation = validateModel({ model });
    if (validation.success === false)
      for (const violation of validation.violations)
        report(
          `${modelPath}${violation.path.slice("$input".length)} ${violation.expected}. Correct the source-owned model before compiling the shot.`,
        );
    // A cited appearance is judged by the reference checks rather than by its
    // origin, so it is allowed past here; a source-authored import is not, for
    // the same reason it was refused above.
    if (
      validation.success === false ||
      (modelRef === null && model.origin !== "generated")
    )
      return;
    authoredModels.push(model);
    registry.define(model.id, model);
  };

  (props.program.models ?? []).forEach((model, index) =>
    acceptModel(model, `$program.models[${index}]`),
  );
  (props.program.props ?? []).forEach((prop, index) =>
    acceptModel(
      prop.model,
      `$program.props[${index}].model`,
      prop.modelRef ?? null,
    ),
  );
  (props.program.builtEnvironments ?? []).forEach((environment, index) => {
    const environmentPath = `$program.builtEnvironments[${index}]`;
    const validation = validateBuiltEnvironment({ environment });
    if (validation.success === false)
      for (const violation of validation.violations)
        report(
          `${environmentPath}${violation.path.slice("$input".length)} ${violation.expected}. Correct the code-authored building before compiling the shot.`,
        );
    environment.models.forEach((model, modelIndex) =>
      acceptModel(model, `${environmentPath}.models[${modelIndex}]`),
    );
    environment.modelReferences.forEach((id, referenceIndex) => {
      if (registry.resolve(id) === undefined)
        report(
          `${environmentPath}.modelReferences[${referenceIndex}] "${id}" does not resolve to a compiler-owned runtime model. Register the asset/model recipe or remove the reference.`,
        );
    });
  });

  // Lineage is checked for coherence here, where the shot that authored it is
  // in hand, and bound to published identities later, where the production's
  // assets are. Splitting it that way is what lets a phase cite a texture the
  // shot itself never names.
  (props.program.designLineages ?? []).forEach((lineage, index) => {
    const lineagePath = `$program.designLineages[${index}]`;
    for (const violation of autoMovieValidationFindings(
      validateDesignLineage({ lineage }),
    ))
      classify(
        autoMovieSourceContentFinding(
          violation,
          `${lineagePath}${violation.path.slice("$input".length)} ${violation.expected}. Correct the construction phase, alternative or derivation record before compiling the shot.`,
        ),
      );
  });

  for (const finding of buildingBoundDiagnostics(props.program))
    classify(finding);

  for (const violation of autoMovieValidationFindings(
    validatePropPlacements({
      props: props.program.props ?? [],
      set: props.program.stage.set ?? [],
      builtEnvironments: props.program.builtEnvironments ?? [],
    }),
  ))
    classify(
      autoMovieSourceContentFinding(
        violation,
        `${violation.path} ${violation.expected}. Correct the code-authored prop registry or staged placement before compiling the shot.`,
      ),
    );

  const available = new Set([
    ...registry.keys(),
    ...registry.values().map((model) => model.id),
  ]);
  (props.program.stage.set ?? []).forEach((piece, index) => {
    if (!available.has(piece.model))
      report(
        `$program.stage.set[${index}].model "${piece.model}" is unavailable. Add a generated source model or cite a compiler-owned runtime model.`,
      );
  });

  return {
    runtimeModels: registry.record,
    models: registry.values(),
    authoredModels,
    diagnostics,
  };
};

const contractOfRegistration = (
  contract: IAutoMovieShotContract,
): IAutoMovieDefinedShotContract => {
  const { id: _id, source: _source, ...registration } = contract;
  return registration;
};

interface IShotActorRuntime {
  actors: Map<string, IAutoMovieActorContext>;
  nodes: Map<string, IAutoMovieVector3>;
  models: Map<string, IAutoMovieModel>;
  diagnostics: IAutoMovieDiagnostic[];
}

/** Bind a thin program's actor facts to compiler-owned runtime models. */
const actorRuntimeOf = (
  program: IAutoMovieProductionShotProgram,
  runtimeModels: IAutoMovieShotBuildContext["runtimeModels"],
  target = `shot:${program.blocking.beat}`,
  sourcePath: string | null = null,
): IShotActorRuntime => {
  const diagnostics: IAutoMovieDiagnostic[] = [];
  const actors = new Map<string, IAutoMovieActorContext>();
  const models = new Map<string, IAutoMovieModel>();
  const modelRegistry =
    createAutoMovieSourceRuntimeModelRegistry(runtimeModels);
  const stageActors = new Map(
    program.stage.actors.map((actor) => [actor.node, actor]),
  );
  program.actors.forEach((actor, index) => {
    const path = `$program.actors[${index}]`;
    const staged = stageActors.get(actor.node);
    const model = modelRegistry.resolve(actor.model);
    const gaitNames = new Set<string>();
    const gaits =
      model?.profiles
        ?.flatMap((profile) => profile.gaits ?? [])
        .filter((gait) => {
          if (gaitNames.has(gait.name)) {
            diagnostics.push({
              code: "source-actor-runtime-invalid",
              category: "error",
              phase: "source",
              target,
              path: sourcePath,
              message: `${path}.model "${actor.model}" supplies duplicate gait "${gait.name}". Keep each compiler-owned gait name unique before rebuilding this shot.`,
            });
            return false;
          }
          gaitNames.add(gait.name);
          return true;
        }) ?? [];
    const fact = actors.has(actor.node)
      ? `duplicates actor node "${actor.node}"`
      : staged === undefined
        ? `names actor node "${actor.node}" that is absent from stage.actors`
        : model === undefined
          ? `names unavailable runtime model "${actor.model}"`
          : model.skeleton === null
            ? `names rig-less runtime model "${actor.model}"`
            : Number.isFinite(actor.speed) === false || actor.speed <= 0
              ? `sets speed ${JSON.stringify(actor.speed)} instead of a finite value above zero`
              : Number.isFinite(actor.eyeHeight) === false ||
                  actor.eyeHeight < 0
                ? `sets eyeHeight ${JSON.stringify(actor.eyeHeight)} instead of a finite non-negative value`
                : null;
    if (fact !== null) {
      diagnostics.push({
        code: "source-actor-runtime-invalid",
        category: "error",
        phase: "source",
        target,
        path: sourcePath,
        message: `${path} ${fact}. Correct the node/model join or measured actor runtime fact; the compiler will not guess a rig, speed, or eye height.`,
      });
      return;
    }
    const boundModel = model!;
    const boundSkeleton = boundModel.skeleton!;
    const placement = staged!;
    actors.set(actor.node, {
      skeleton: boundSkeleton.id,
      gaits,
      position: placement.position,
      speed: actor.speed,
      facingDeg: placement.facingDeg,
      eyeHeight: actor.eyeHeight,
      restPose: {
        skeleton: boundSkeleton.id,
        root: null,
        joints: [],
      },
      rig: boundSkeleton,
    });
    models.set(actor.node, boundModel);
  });
  const clips = new Map<string, number>();
  (program.clips ?? []).forEach((clip, index) => {
    const first = clips.get(clip.id);
    if (clip.id.trim().length === 0 || first !== undefined)
      diagnostics.push({
        code: "source-clip-invalid",
        category: "error",
        phase: "source",
        target,
        path: sourcePath,
        message:
          first === undefined
            ? `$program.clips[${index}].id is blank. Give every enact clip one stable non-blank id.`
            : `$program.clips[${index}].id duplicates $program.clips[${first}].id "${clip.id}". Keep one authoritative clip per id.`,
      });
    else clips.set(clip.id, index);
  });
  const actions = program.performance.revise.final ?? program.performance.draft;
  actions.forEach((action, index) => {
    if (action.verb === "enact" && clips.has(action.clip) === false)
      diagnostics.push({
        code: "source-clip-invalid",
        category: "error",
        phase: "source",
        target,
        path: sourcePath,
        message: `$program.performance action ${index} enacts absent clip "${action.clip}". Add that exact clip to program.clips or replace enact with a supported thin verb.`,
      });
  });
  const nodes = new Map<string, IAutoMovieVector3>([
    ...program.stage.actors.map(
      (actor) => [actor.node, actor.position] as const,
    ),
    ...(program.stage.set ?? []).map(
      (piece) => [piece.node, piece.position] as const,
    ),
    ...program.stage.cameras.map(
      (camera) => [camera.node, camera.position] as const,
    ),
  ]);
  return { actors, nodes, models, diagnostics };
};

const transpileDeterministicSource = (props: {
  target: string;
  path: string;
  source: string;
}): { output: string | null; diagnostics: IAutoMovieDiagnostic[] } => {
  const diagnostics: IAutoMovieDiagnostic[] = [];
  const transpiled = ts.transpileModule(props.source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.CommonJS,
      esModuleInterop: true,
      isolatedModules: true,
    },
    fileName: props.path,
    reportDiagnostics: true,
  });
  for (const diagnostic of transpiled.diagnostics!)
    if (diagnostic.category === ts.DiagnosticCategory.Error)
      diagnostics.push({
        code: "source-transpile-failed",
        category: "error",
        phase: "source",
        target: props.target,
        path: props.path,
        message: `${ts.flattenDiagnosticMessageText(diagnostic.messageText, " ")} Fix ${props.path} before running the compiler.`,
      });
  return {
    output: diagnostics.length === 0 ? transpiled.outputText : null,
    diagnostics,
  };
};

/**
 * One linked, inspected and transpiled module graph, ready to evaluate.
 *
 * The plan exists because two callers need the same preparation and then
 * diverge: a film's shot or edit module has exactly one named export the
 * compiler already knows, and a library module carries however many owner
 * registrations its author wrote. Preparing the graph twice would be two
 * answers to what "deterministic project source" means.
 */
interface IDeterministicSourcePlan {
  /** Resolved import map of the entry module. */
  entryImports: Record<string, string>;
  /** Every imported project module, transpiled in dependency order. */
  transpiledImports: Array<{
    path: string;
    imports: Record<string, string>;
    output: string;
  }>;
  /** Transpiled entry module. */
  output: string;
}

/** Link, inspect and transpile one deterministic entry and its import graph. */
const planDeterministicSource = (props: {
  target: string;
  path: string;
  source: string;
  readSource: (relativePath: string) => string;
}): {
  plan: IDeterministicSourcePlan | null;
  diagnostics: IAutoMovieDiagnostic[];
} => {
  const diagnostics = inspectSource(props.target, props.path, props.source);
  // Imported project source is inspected and transpiled exactly as the entry
  // is. A determinism rule that applied only to the module a shot happens to
  // live in would be no rule at all once the work moved one import away.
  const linked = linkProductionSource({
    entryPath: props.path,
    entrySource: props.source,
    read: props.readSource,
  });
  for (const failure of linked.failures)
    diagnostics.push({
      code: "source-import-unresolved",
      category: "error",
      phase: "source",
      target: props.target,
      path: failure.path,
      message: failure.reason,
    });
  const imported = linked.modules.filter(
    (module) => module.path !== props.path,
  );
  for (const module of imported)
    diagnostics.push(
      ...inspectSource(props.target, module.path, module.source),
    );
  if (diagnostics.some((diagnostic) => diagnostic.category === "error"))
    return { plan: null, diagnostics };
  const transpiledImports: Array<{
    path: string;
    imports: Record<string, string>;
    output: string;
  }> = [];
  for (const module of imported) {
    const result = transpileDeterministicSource({
      target: props.target,
      path: module.path,
      source: module.source,
    });
    diagnostics.push(...result.diagnostics);
    if (result.output !== null)
      transpiledImports.push({
        path: module.path,
        imports: module.imports,
        output: result.output,
      });
  }
  if (diagnostics.some((diagnostic) => diagnostic.category === "error"))
    return { plan: null, diagnostics };
  // The entry transpiles through the same helper its imports do, so an option
  // that changes for one cannot fail to change for the other.
  const transpiled = transpileDeterministicSource({
    target: props.target,
    path: props.path,
    source: props.source,
  });
  diagnostics.push(...transpiled.diagnostics);
  if (transpiled.output === null) return { plan: null, diagnostics };
  return {
    plan: {
      entryImports: linked.entryImports,
      transpiledImports,
      output: transpiled.output,
    },
    diagnostics,
  };
};

/**
 * Evaluate one prepared module graph inside a fresh deterministic sandbox.
 *
 * Every failure here is thrown rather than reported, because the caller owns
 * the diagnostic identity: the same broken module is a shot that failed to
 * build or a library owner that failed to register, and only the caller knows
 * which. A sandbox is created per call, so no two entry modules share a realm.
 */
const evaluateDeterministicPlan = (props: {
  target: string;
  path: string;
  plan: IDeterministicSourcePlan;
}): vm.Context => {
  const sandbox = vm.createContext(
    {},
    {
      codeGeneration: { strings: false, wasm: false },
      microtaskMode: "afterEvaluate",
      name: `automovie:${props.target}`,
    },
  );
  // Handed in before the bootstrap runs, and dropped by the bootstrap itself.
  // Only strings cross it in either direction, so the sandbox never holds a
  // structured value from this realm.
  sandbox.__automovieEngineCall = callAutoMovieSandboxEngine;
  new vm.Script(SANDBOX_BOOTSTRAP, {
    filename: `${props.path}#sandbox`,
  }).runInContext(sandbox, { timeout: 1_000 });
  sandbox.__automovieSetEntry(props.plan.entryImports);
  for (const module of props.plan.transpiledImports)
    new vm.Script(
      `__automovieDefine(${JSON.stringify(module.path)}, ${JSON.stringify(module.imports)}, (module, exports, require) => {\n${module.output}\n});`,
      { filename: module.path },
    ).runInContext(sandbox, { timeout: 1_000 });
  new vm.Script(props.plan.output, {
    filename: props.path,
  }).runInContext(sandbox, { timeout: 1_000 });
  return sandbox;
};

const compileDeterministicSource = <T>(
  props: ICompileDeterministicSourceProps<T>,
): ICompileDeterministicSourceResult<T> => {
  const planned = planDeterministicSource(props);
  const diagnostics = planned.diagnostics;
  if (planned.plan === null) return { value: null, diagnostics };
  let registrationScene: string | undefined;
  try {
    const sandbox = evaluateDeterministicPlan({
      target: props.target,
      path: props.path,
      plan: planned.plan,
    });
    sandbox.__automovieExportName = props.exportName;
    new vm.Script(
      `globalThis.__automovieExportValid =
        typeof module.exports[__automovieExportName]?.build === "function";
       delete globalThis.__automovieExportName;`,
      { filename: `${props.path}#export` },
    ).runInContext(sandbox, { timeout: 1_000 });
    if (sandbox.__automovieExportValid !== true)
      return {
        value: null,
        diagnostics: [
          ...diagnostics,
          {
            code: "source-export-missing",
            category: "error",
            phase: "source",
            target: props.target,
            path: props.path,
            message: `Export "${props.exportName}" with a build(context) function was not found. Add that named export to ${props.path}.`,
          },
        ],
      };
    if (props.registration !== undefined) {
      sandbox.__automovieExportName = props.exportName;
      new vm.Script(
        `globalThis.__automovieRegistrationJson = (() => {
           const candidate = module.exports[__automovieExportName]?.id;
           const registered = module.exports[__automovieExportName];
           return typeof candidate === "string"
             ? JSON.stringify({
                 id: candidate,
                 scene: registered.scene,
                 contract: registered.contract,
               })
             : null;
         })();
         delete globalThis.__automovieExportName;`,
        { filename: `${props.path}#registration` },
      ).runInContext(sandbox, { timeout: 1_000 });
      const registrationJson = sandbox.__automovieRegistrationJson as unknown;
      const registration =
        typeof registrationJson === "string"
          ? (JSON.parse(registrationJson) as {
              id?: unknown;
              scene?: unknown;
              contract?: unknown;
            })
          : null;
      const contractMatches =
        registration !== null &&
        typeof registration.contract === "object" &&
        registration.contract !== null &&
        Buffer.from(canonicalAutoMovieJsonBytes(registration.contract)).equals(
          Buffer.from(canonicalAutoMovieJsonBytes(props.registration.contract)),
        );
      if (
        registration === null ||
        registration.id !== props.registration.id ||
        typeof registration.scene !== "string" ||
        registration.scene.trim().length === 0 ||
        contractMatches === false
      )
        return {
          value: null,
          diagnostics: [
            ...diagnostics,
            {
              code: "source-registration-mismatch",
              category: "error",
              phase: "source",
              target: props.target,
              path: props.path,
              message:
                registration === null
                  ? `Contract id "${props.registration.id}" points to export "${props.exportName}" in ${props.path}, but that export is not a defineShot registration. Export defineShot("${props.registration.id}", { scene, contract, build }) so module path, named export, id, and measurable contract identify one artifact.`
                  : `Contract id "${props.registration.id}" points to export "${props.exportName}" in ${props.path}, but its registration has id ${JSON.stringify(registration.id)}, scene ${JSON.stringify(registration.scene)}, or a contract that differs from the design. Make the defineShot registration id and measurable contract exactly match the selected design contract, and keep scene non-blank.`,
            },
          ],
        };
      registrationScene = registration.scene;
    }
    sandbox.__automovieContextJson = JSON.stringify(props.context);
    sandbox.__automovieExportName = props.exportName;
    new vm.Script(SOURCE_INVOCATION, {
      filename: `${props.path}#${props.exportName}`,
    }).runInContext(sandbox, { timeout: 1_000 });
    if (sandbox.__automovieReturnedPromise === true)
      return {
        value: null,
        diagnostics: [
          ...diagnostics,
          {
            code: "source-export-invalid",
            category: "error",
            phase: "source",
            target: props.target,
            path: props.path,
            message: `Export "${props.exportName}" returned a Promise. Return a synchronous deterministic ${props.label} from ${props.path}.`,
          },
        ],
      };
    const resultJson = sandbox.__automovieResultJson as unknown;
    const value =
      typeof resultJson === "string" ? JSON.parse(resultJson) : undefined;
    const validation = props.validate(value);
    if (validation.success === false)
      return {
        value: null,
        diagnostics: [
          ...diagnostics,
          ...validation.errors.map(
            (error): IAutoMovieDiagnostic => ({
              code: "source-export-invalid",
              category: "error",
              phase: "source",
              target: props.target,
              path: props.path,
              message: `${error.path} expects ${error.expected}. Fix the returned ${props.label} in ${props.path}.`,
            }),
          ),
        ],
      };
    return { value: validation.data, diagnostics, registrationScene };
  } catch (error) {
    const message =
      typeof error === "object" && error !== null && "message" in error
        ? String((error as { message: unknown }).message)
        : String(error);
    return {
      value: null,
      diagnostics: [
        ...diagnostics,
        {
          code: message.includes("timed out")
            ? "source-execution-timeout"
            : "source-execution-failed",
          category: "error",
          phase: "source",
          target: props.target,
          path: props.path,
          message: `Source export "${props.exportName}" in ${props.path} failed while building ${props.label}: ${message}. No generated artifact was published. Correct the operation or precondition named by this fact, then rerun the same compile scope.`,
        },
      ],
    };
  }
};

/**
 * Which generated file each executed library owner is answerable for.
 *
 * The film path reads its targets back out of the design graph, because a shot
 * file is named after the shot it compiles. A library artifact is named after
 * the environment or model inside it, so the index the same publication just
 * produced is what says whose it is; nothing has to be parsed out of a path.
 */
/** One owner registration a library source module exported and returned. */
interface ICompiledLibraryOwnerRegistration {
  /** Named export the registration was found under. */
  export: string;
  /** Exact design-document and H2 address the export registered. */
  design: string;
  /**
   * Validated contribution the export's build function returned.
   *
   * `contexts` is definite here where the contract leaves it optional. The
   * contract is optional so a library source written before the field existed
   * still satisfies the shape; inside the compile every reader is owed a list,
   * and three of them were each deciding that for themselves.
   */
  contribution: IAutoMovieLibraryContribution & {
    contexts: IAutoMovieEnvironmentContext[];
  };
}

/**
 * Find every library owner registration a module exports, in code-unit order.
 *
 * Discovery is a property of the module rather than a name the compiler was
 * told, because a source population selects files and an author decides how
 * many owners live in one. Only the address crosses the boundary here; the
 * contribution is fetched separately through the ordinary invocation path.
 */
const LIBRARY_OWNER_DISCOVERY = `
(() => {
  "use strict";
  globalThis.__automovieLibraryOwnersJson = JSON.stringify(
    Object.keys(module.exports)
      .filter((name) => {
        const value = module.exports[name];
        return (
          value !== null &&
          typeof value === "object" &&
          typeof value.design === "string" &&
          typeof value.build === "function"
        );
      })
      .sort()
      .map((name) => ({ name, design: module.exports[name].design })),
  );
})();
`;

const LIBRARY_INVOCATION = `
(() => {
  "use strict";
  const snapshot = __automovieInvokeLibrary(
    __automovieContextJson,
    __automovieExportName,
  );
  globalThis.__automovieReturnedPromise = snapshot.returnedPromise;
  globalThis.__automovieResultJson = snapshot.resultJson;
  delete globalThis.__automovieContextJson;
  delete globalThis.__automovieExportName;
})();
`;

/**
 * Run one library source module and collect the owners it registers.
 *
 * The module graph is prepared exactly as a shot's is, so a library owner is
 * held to the same determinism rules and reaches the same engine surface. What
 * differs is only what happens after evaluation: instead of invoking one export
 * the compiler already knew the name of, this discovers however many owner
 * registrations the module carries and invokes each against its own address.
 *
 * An address the active authoring declaration does not own is refused here
 * rather than silently skipped, because a module that builds a subject no
 * reviewed decision asked for would publish an artifact no review ever charges
 * an observation on.
 */
const compileLibrarySource = (props: {
  /** Project-relative source path selected by a reviewed source binding. */
  path: string;
  /** Normalized source text of that file. */
  source: string;
  /** Reader for project source this module imports. */
  readSource: (relativePath: string) => string;
  /** Build context for an address the active authoring population owns. */
  context: (design: string) => IAutoMovieLibraryBuildContext | null;
  /** Admit the exact graph-selected owner edge before invoking build(). */
  admit: (
    exportName: string,
    design: string,
  ) => ReturnType<typeof resolveAutoMovieSourceOwnerBinding>;
}): {
  registrations: ICompiledLibraryOwnerRegistration[];
  diagnostics: IAutoMovieDiagnostic[];
} => {
  const target = `library-source:${props.path}`;
  const planned = planDeterministicSource({
    target,
    path: props.path,
    source: props.source,
    readSource: props.readSource,
  });
  const diagnostics = planned.diagnostics;
  const registrations: ICompiledLibraryOwnerRegistration[] = [];
  if (planned.plan === null) return { registrations, diagnostics };
  let current = "the module";
  try {
    const sandbox = evaluateDeterministicPlan({
      target,
      path: props.path,
      plan: planned.plan,
    });
    new vm.Script(LIBRARY_OWNER_DISCOVERY, {
      filename: `${props.path}#library-owners`,
    }).runInContext(sandbox, { timeout: 1_000 });
    const discovered = JSON.parse(
      sandbox.__automovieLibraryOwnersJson as string,
    ) as Array<{ name: string; design: string }>;
    for (const entry of discovered) {
      current = `export "${entry.name}"`;
      const context = props.context(entry.design);
      if (context === null) {
        diagnostics.push({
          code: "source-registration-mismatch",
          category: "error",
          phase: "source",
          target: `${target}:${entry.name}`,
          path: props.path,
          message: `Library source export "${entry.name}" registers design owner ${JSON.stringify(entry.design)}, which is not an exact active design document and H2 anchor in this project's authoring declaration. Register one "docs/<branch>/<document>.md#<anchor>" address the graph already selects, or remove the export.`,
        });
        continue;
      }
      const admission = props.admit(entry.name, entry.design);
      if (admission.success === false) {
        diagnostics.push({
          code: "source-owner-mismatch",
          category: "error",
          phase: "source",
          target: `${target}:${entry.name}`,
          path: props.path,
          message: admission.message,
        });
        continue;
      }
      sandbox.__automovieContextJson = JSON.stringify(context);
      sandbox.__automovieExportName = entry.name;
      new vm.Script(LIBRARY_INVOCATION, {
        filename: `${props.path}#${entry.name}`,
      }).runInContext(sandbox, { timeout: 1_000 });
      if (sandbox.__automovieReturnedPromise === true) {
        diagnostics.push({
          code: "source-export-invalid",
          category: "error",
          phase: "source",
          target: `${target}:${entry.name}`,
          path: props.path,
          message: `Library owner export "${entry.name}" returned a Promise. Return a synchronous deterministic library contribution from ${props.path}.`,
        });
        continue;
      }
      const resultJson = sandbox.__automovieResultJson as unknown;
      const validation = typia.validateEquals<IAutoMovieLibraryContribution>(
        typeof resultJson === "string"
          ? (JSON.parse(resultJson) as unknown)
          : undefined,
      );
      if (validation.success === false) {
        for (const error of validation.errors)
          diagnostics.push({
            code: "source-export-invalid",
            category: "error",
            phase: "source",
            target: `${target}:${entry.name}`,
            path: props.path,
            message: `${error.path} expects ${error.expected}. Fix the returned library contribution in ${props.path}.`,
          });
        continue;
      }
      const contribution = {
        ...validation.data,
        contexts: validation.data.contexts ?? [],
      };
      const contributionDiagnostics = autoMovieLibraryContributionDiagnostics(
        context.branch,
        contribution,
      );
      for (const message of contributionDiagnostics)
        diagnostics.push({
          code: "source-export-invalid",
          category: "error",
          phase: "source",
          target: `${target}:${entry.name}`,
          path: props.path,
          message,
        });
      if (contributionDiagnostics.length !== 0) continue;
      registrations.push({
        export: entry.name,
        design: entry.design,
        // Normalized once, here, where every executed owner passes. `contexts`
        // is optional on the contract so a library source written before it
        // existed still satisfies the shape; every reader after this point is
        // owed a list, and three of them were each deciding that for
        // themselves.
        contribution,
      });
    }
  } catch (error) {
    const message =
      typeof error === "object" && error !== null && "message" in error
        ? String((error as { message: unknown }).message)
        : String(error);
    return {
      registrations: [],
      diagnostics: [
        ...diagnostics,
        {
          code: message.includes("timed out")
            ? "source-execution-timeout"
            : "source-execution-failed",
          category: "error",
          phase: "source",
          target,
          path: props.path,
          message: `Library source ${current} in ${props.path} failed while building its contribution: ${message}. No generated artifact was published. Correct the operation or precondition named by this fact, then rerun the same compile scope.`,
        },
      ],
    };
  }
  return { registrations, diagnostics };
};

interface ICompiledFilmDraft {
  edit: IAutoMovieFilmEdit;
  timeline: Omit<
    IAutoMovieFilmTimeline,
    "compiler" | "inputFingerprint" | "sourceDigest"
  >;
}

interface ICompileFilmSourceProps {
  source: ICompileDeterministicSourceResult<IAutoMovieFilmEdit>;
  context: IAutoMovieFilmBuildContext;
  contracts: ReadonlyMap<string, IAutoMovieShotContract>;
  compiled: ReadonlyMap<string, IAutoMovieCompiledShotSource>;
  realizations: ReadonlyMap<string, IAutoMovieCompiledContractRealization>;
  /** Requested compile scope; the runtime target is only binding from review on. */
  scope: IAutoMovieCompileProjectInput["scope"];
}

/**
 * Evaluate the deterministic film module once, before ordered shot compile.
 *
 * The edit links project source exactly as a shot does. `SOURCE_COMPOSITION.md`
 * tells an author to assemble the edit by walking the same table its shots are
 * derived from, and an edit that could not import that table would have to
 * restate the order it already holds.
 */
const compileFilmEditSource = (props: {
  source: string;
  readSource: (relativePath: string) => string;
  context: IAutoMovieFilmBuildContext;
}): ICompileDeterministicSourceResult<IAutoMovieFilmEdit> =>
  compileDeterministicSource<IAutoMovieFilmEdit>({
    target: "film",
    label: "film edit",
    path: FILM_SOURCE_PATH,
    exportName: FILM_SOURCE_EXPORT,
    source: props.source,
    readSource: props.readSource,
    context: props.context,
    validate: (input) => typia.validateEquals<IAutoMovieFilmEdit>(input),
  });

const compileFilmSource = (
  props: ICompileFilmSourceProps,
): ICompileDeterministicSourceResult<ICompiledFilmDraft> => {
  const source = props.source;
  if (source.value === null)
    return { value: null, diagnostics: source.diagnostics };
  const diagnostics = [...source.diagnostics];
  const edit = source.value;
  const fps = props.context.production.frameFormat.fps;
  const targetFrames = frameTime(
    { seconds: props.context.production.targetRuntimeSeconds },
    fps,
    "production target runtime",
    diagnostics,
  );
  if (edit.id !== props.context.production.id)
    diagnostics.push(
      filmDiagnostic(
        "film-id-mismatch",
        `Film id "${edit.id}" differs from production id "${props.context.production.id}". Return the current production id from ${FILM_SOURCE_PATH}.`,
      ),
    );
  const omitted = new Set<string>();
  for (const omission of edit.omissions) {
    if (
      omission.shot.trim().length === 0 ||
      omission.reason.trim().length === 0 ||
      omitted.has(omission.shot)
    )
      diagnostics.push(
        filmDiagnostic(
          "film-shot-accounting-invalid",
          `Omission "${omission.shot}" must name one unique current shot with a non-blank reason.`,
        ),
      );
    else omitted.add(omission.shot);
    if (props.contracts.has(omission.shot) === false)
      diagnostics.push(
        filmDiagnostic(
          "film-shot-unknown",
          `Omission "${omission.shot}" is not a current shot contract. Remove it or restore that contract.`,
        ),
      );
  }
  const used = new Set<string>();
  const segments: IAutoMovieFilmTimeline["segments"] = [];
  for (const placement of edit.tracks.video) {
    const contract = props.contracts.get(placement.shot);
    if (
      placement.shot.trim().length === 0 ||
      used.has(placement.shot) ||
      omitted.has(placement.shot)
    )
      diagnostics.push(
        filmDiagnostic(
          "film-shot-accounting-invalid",
          `Video shot "${placement.shot}" must appear once and cannot also be omitted.`,
        ),
      );
    else used.add(placement.shot);
    if (contract === undefined) {
      diagnostics.push(
        filmDiagnostic(
          "film-shot-unknown",
          `Video shot "${placement.shot}" is not a current shot contract.`,
        ),
      );
      continue;
    }
    if (
      props.compiled.has(placement.shot) === false ||
      props.realizations.has(placement.shot) === false
    )
      diagnostics.push(
        filmDiagnostic(
          "film-shot-not-compiled",
          `Shot "${placement.shot}" has no current compiled source and realization. Correct that shot before compiling the film.`,
        ),
      );
    const sourceInFrame = frameTime(
      placement.sourceIn,
      fps,
      `${placement.shot} sourceIn`,
      diagnostics,
    );
    const sourceOutFrame = frameTime(
      placement.sourceOut,
      fps,
      `${placement.shot} sourceOut`,
      diagnostics,
    );
    const startFrame = frameTime(
      placement.start,
      fps,
      `${placement.shot} global start`,
      diagnostics,
    );
    const headHandleFrames = frameTime(
      placement.handles.head,
      fps,
      `${placement.shot} head handle`,
      diagnostics,
    );
    const tailHandleFrames = frameTime(
      placement.handles.tail,
      fps,
      `${placement.shot} tail handle`,
      diagnostics,
    );
    const transitionIn = normalizeFilmTransition(
      placement.transitionIn,
      fps,
      `${placement.shot} transitionIn`,
      diagnostics,
    );
    const transitionOut = normalizeFilmTransition(
      placement.transitionOut,
      fps,
      `${placement.shot} transitionOut`,
      diagnostics,
    );
    const shotFrames = frameTime(
      { seconds: contract.durationSeconds },
      fps,
      `${placement.shot} contract duration`,
      diagnostics,
    );
    if (
      sourceInFrame === null ||
      sourceOutFrame === null ||
      startFrame === null ||
      headHandleFrames === null ||
      tailHandleFrames === null ||
      transitionIn === null ||
      transitionOut === null ||
      shotFrames === null
    )
      continue;
    if (
      sourceOutFrame <= sourceInFrame ||
      sourceOutFrame > shotFrames ||
      headHandleFrames > sourceOutFrame - sourceInFrame ||
      tailHandleFrames > sourceOutFrame - sourceInFrame
    )
      diagnostics.push(
        filmDiagnostic(
          "film-source-range-invalid",
          `Shot "${placement.shot}" source range ${sourceInFrame}..${sourceOutFrame} and handles ${headHandleFrames}/${tailHandleFrames} must fit its ${shotFrames}-frame contract.`,
        ),
      );
    segments.push({
      shot: placement.shot,
      sourceInFrame,
      sourceOutFrame,
      startFrame,
      endFrame: startFrame + sourceOutFrame - sourceInFrame,
      headHandleFrames,
      tailHandleFrames,
      transitionIn,
      transitionOut,
    });
  }
  for (const shot of props.contracts.keys())
    if (used.has(shot) === false && omitted.has(shot) === false)
      diagnostics.push(
        filmDiagnostic(
          "film-shot-unaccounted",
          `Shot "${shot}" is neither placed nor explicitly omitted. Account for every current narrative shot.`,
        ),
      );
  validateVideoTimeline(segments, props, fps, diagnostics);
  const totalFrames =
    segments.length === 0
      ? 0
      : Math.max(...segments.map((item) => item.endFrame));
  // `targetRuntimeSeconds` is the production's *intended finished* runtime, so
  // a film edit shorter than it is the normal state of an unfinished
  // production, not an authoring error. Failing `source` scope on the gap would
  // make a target impossible to declare before the film that fills it exists,
  // which turns a stated intent into a value derived from whatever is built so
  // far. Delivery is where the two must agree, and `review` is already the
  // scope that judges the whole assembled film, so the gap is binding from
  // there on.
  if (targetFrames !== null && totalFrames !== targetFrames)
    diagnostics.push({
      ...filmDiagnostic(
        "film-runtime-mismatch",
        `Film timeline ends at frame ${totalFrames}, but production target runtime is frame ${targetFrames}.${
          props.scope === "source"
            ? " The film does not yet fill its intended runtime; it must before review."
            : " Correct placement timing or production runtime."
        }`,
      ),
      category: props.scope === "source" ? "warning" : "error",
    });
  const audio = normalizeAudioCues(
    edit,
    props.context.assets,
    fps,
    totalFrames,
    diagnostics,
  );
  const captions = normalizeCaptionCues(edit, fps, totalFrames, diagnostics);
  const effects = normalizeEffectCues(
    edit,
    props.context.effectZones.map((zone) => zone.id),
    fps,
    totalFrames,
    diagnostics,
  );
  // The mechanical read of the assembled edit, once the edit is known to hold
  // together. The analyzer's preconditions — one unique shot per placement, a
  // positive edited duration, a compiled shot behind each one — are exactly
  // what the checks above establish, and an edit that fails them publishes no
  // artifact for anyone to read a grammar out of.
  if (diagnostics.every((diagnostic) => diagnostic.category !== "error"))
    diagnostics.push(
      ...filmGrammarDiagnostics({
        segments,
        fps,
        aspect:
          props.context.production.frameFormat.width /
          props.context.production.frameFormat.height,
        contracts: props.contracts,
        compiled: props.compiled,
      }),
    );
  return {
    value: diagnostics.some((diagnostic) => diagnostic.category === "error")
      ? null
      : {
          edit,
          timeline: {
            version: 1,
            id: edit.id,
            fps,
            totalFrames,
            segments,
            omissions: edit.omissions,
            tracks: { audio, captions, effects },
          },
        },
    diagnostics,
  };
};

const filmDiagnostic = (
  code: AutoMovieDiagnosticCode,
  message: string,
): IAutoMovieDiagnostic => ({
  code,
  category: "error",
  phase: "compile",
  target: "film",
  path: FILM_SOURCE_PATH,
  message,
});

const frameTime = (
  value: { frame: number } | { seconds: number },
  fps: number,
  label: string,
  diagnostics: IAutoMovieDiagnostic[],
): number | null => {
  const raw = "frame" in value ? value.frame : value.seconds * fps;
  const rounded = Math.round(raw);
  if (
    Number.isFinite(raw) === false ||
    Number.isSafeInteger(rounded) === false ||
    rounded < 0 ||
    Math.abs(raw - rounded) > Number.EPSILON * 64 * Math.max(1, Math.abs(raw))
  ) {
    diagnostics.push(
      filmDiagnostic(
        "film-time-off-grid",
        `${label} does not resolve to one non-negative safe production frame at ${fps} fps. Use an exact frame or frame-grid second.`,
      ),
    );
    return null;
  }
  return rounded;
};

const normalizeFilmTransition = (
  transition: IAutoMovieFilmEdit["tracks"]["video"][number]["transitionIn"],
  fps: number,
  label: string,
  diagnostics: IAutoMovieDiagnostic[],
): IAutoMovieFilmTimeline["segments"][number]["transitionIn"] | null => {
  if (transition.kind === "cut") return { kind: "cut" };
  const durationFrames = frameTime(
    transition.duration,
    fps,
    `${label} duration`,
    diagnostics,
  );
  if (durationFrames === null) return null;
  if (durationFrames === 0) {
    diagnostics.push(
      filmDiagnostic(
        "film-transition-invalid",
        `${label} ${transition.kind} duration must be at least one frame.`,
      ),
    );
    return null;
  }
  return { kind: transition.kind, durationFrames };
};

const transitionDuration = (
  transition: IAutoMovieFilmTimeline["segments"][number]["transitionIn"],
): number => ("durationFrames" in transition ? transition.durationFrames : 0);

const validateVideoTimeline = (
  segments: readonly IAutoMovieFilmTimeline["segments"][number][],
  props: ICompileFilmSourceProps,
  fps: number,
  diagnostics: IAutoMovieDiagnostic[],
): void => {
  if (segments.length === 0) {
    diagnostics.push(
      filmDiagnostic(
        "film-video-empty",
        "The finished film must contain at least one current video placement.",
      ),
    );
    return;
  }
  if (segments[0]!.startFrame !== 0)
    diagnostics.push(
      filmDiagnostic(
        "film-global-order-invalid",
        `The first video placement starts at frame ${segments[0]!.startFrame}; it must start at frame 0.`,
      ),
    );
  for (let index = 0; index < segments.length; ++index) {
    const segment = segments[index]!;
    if (
      (index === 0 && segment.transitionIn.kind === "dissolve") ||
      (index === segments.length - 1 &&
        segment.transitionOut.kind === "dissolve")
    )
      diagnostics.push(
        filmDiagnostic(
          "film-transition-invalid",
          `Shot "${segment.shot}" cannot dissolve beyond the beginning or end of the film.`,
        ),
      );
    for (const [side, transition, handle] of [
      ["incoming", segment.transitionIn, segment.headHandleFrames],
      ["outgoing", segment.transitionOut, segment.tailHandleFrames],
    ] as const)
      if (
        transition.kind !== "cut" &&
        transitionDuration(transition) >
          (transition.kind === "dissolve"
            ? handle
            : segment.endFrame - segment.startFrame)
      )
        diagnostics.push(
          filmDiagnostic(
            "film-transition-handle-missing",
            `Shot "${segment.shot}" ${side} ${transition.kind} needs ${transitionDuration(transition)} frames, but only ${handle} transition-handle frames are declared.`,
          ),
        );
    if (index === 0) continue;
    const previous = segments[index - 1]!;
    if (
      previous.transitionOut.kind !== segment.transitionIn.kind ||
      transitionDuration(previous.transitionOut) !==
        transitionDuration(segment.transitionIn)
    )
      diagnostics.push(
        filmDiagnostic(
          "film-transition-mismatch",
          `Transition between "${previous.shot}" and "${segment.shot}" must have identical outgoing and incoming kind/duration.`,
        ),
      );
    const overlap =
      previous.transitionOut.kind === "dissolve"
        ? transitionDuration(previous.transitionOut)
        : 0;
    const expectedStart = previous.endFrame - overlap;
    if (segment.startFrame !== expectedStart)
      diagnostics.push(
        filmDiagnostic(
          "film-global-order-invalid",
          `Shot "${segment.shot}" starts at frame ${segment.startFrame}; transition law requires frame ${expectedStart}. Arbitrary gaps and overlaps are forbidden.`,
        ),
      );
    validateStateContinuity(previous, segment, props, fps, diagnostics);
  }
};

const validateStateContinuity = (
  previous: IAutoMovieFilmTimeline["segments"][number],
  current: IAutoMovieFilmTimeline["segments"][number],
  props: ICompileFilmSourceProps,
  fps: number,
  diagnostics: IAutoMovieDiagnostic[],
): void => {
  const previousContract = props.contracts.get(previous.shot)!;
  const currentContract = props.contracts.get(current.shot)!;
  const previousFrames = Math.round(previousContract.durationSeconds * fps);
  if (
    previous.sourceOutFrame !== previousFrames ||
    current.sourceInFrame !== 0
  ) {
    if (
      previousContract.closing.length !== 0 ||
      currentContract.opening.length !== 0
    )
      diagnostics.push(
        filmDiagnostic(
          "film-state-handoff-unverifiable",
          `Trimmed boundary "${previous.shot}" -> "${current.shot}" cannot use contract edge-state continuity. Author full contract edges or remove edge-state claims.`,
        ),
      );
    return;
  }
  const previousRealization = props.realizations.get(previous.shot);
  const currentRealization = props.realizations.get(current.shot);
  if (previousRealization === undefined || currentRealization === undefined)
    return;
  const closing = previousRealization.closing.map((state) => state.predicates);
  const opening = currentRealization.opening.map((state) => state.predicates);
  if (
    Buffer.from(canonicalAutoMovieJsonBytes(closing)).equals(
      Buffer.from(canonicalAutoMovieJsonBytes(opening)),
    ) === false
  )
    diagnostics.push(
      filmDiagnostic(
        "film-state-handoff-mismatch",
        `Closing state of "${previous.shot}" does not equal opening state of "${current.shot}". An untrimmed cut hands one measured state across, so both edges must claim it; leave both unclaimed when the cut is a scene break rather than a continuous handoff.`,
      ),
    );
};

const normalizeAudioCues = (
  edit: IAutoMovieFilmEdit,
  assets: readonly string[],
  fps: number,
  totalFrames: number,
  diagnostics: IAutoMovieDiagnostic[],
): IAutoMovieFilmTimeline["tracks"]["audio"] => {
  const output: IAutoMovieFilmTimeline["tracks"]["audio"] = [];
  const ids = new Set<string>();
  let priorStart = -1;
  for (const cue of edit.tracks.audio) {
    const sourceDurationFrames = frameTime(
      cue.sourceDuration,
      fps,
      `${cue.id} audio source duration`,
      diagnostics,
    );
    const sourceOffsetFrame = frameTime(
      cue.sourceOffset,
      fps,
      `${cue.id} audio source offset`,
      diagnostics,
    );
    const startFrame = frameTime(
      cue.start,
      fps,
      `${cue.id} audio start`,
      diagnostics,
    );
    const durationFrames = frameTime(
      cue.duration,
      fps,
      `${cue.id} audio duration`,
      diagnostics,
    );
    const fadeInFrames = frameTime(
      cue.fadeIn,
      fps,
      `${cue.id} audio fadeIn`,
      diagnostics,
    );
    const fadeOutFrames = frameTime(
      cue.fadeOut,
      fps,
      `${cue.id} audio fadeOut`,
      diagnostics,
    );
    if (
      sourceDurationFrames === null ||
      sourceOffsetFrame === null ||
      startFrame === null ||
      durationFrames === null ||
      fadeInFrames === null ||
      fadeOutFrames === null
    )
      continue;
    if (
      cue.id.trim().length === 0 ||
      ids.has(cue.id) ||
      assets.includes(cue.asset) === false ||
      sourceDurationFrames === 0 ||
      durationFrames === 0 ||
      sourceOffsetFrame + durationFrames > sourceDurationFrames ||
      startFrame + durationFrames > totalFrames ||
      fadeInFrames + fadeOutFrames > durationFrames ||
      Number.isFinite(cue.gain) === false ||
      cue.gain < 0 ||
      cue.gain > 4 ||
      startFrame < priorStart
    )
      diagnostics.push(
        filmDiagnostic(
          "film-audio-cue-invalid",
          `Audio cue "${cue.id}" must be unique, ordered, in film/source range, reference a present declared asset, use fades within duration, and set gain from 0 through 4.`,
        ),
      );
    ids.add(cue.id);
    priorStart = startFrame;
    output.push({
      id: cue.id,
      asset: cue.asset,
      sourceDurationFrames,
      sourceOffsetFrame,
      startFrame,
      durationFrames,
      gain: cue.gain,
      fadeInFrames,
      fadeOutFrames,
      bus: cue.bus,
    });
  }
  return output;
};

const normalizeCaptionCues = (
  edit: IAutoMovieFilmEdit,
  fps: number,
  totalFrames: number,
  diagnostics: IAutoMovieDiagnostic[],
): IAutoMovieFilmTimeline["tracks"]["captions"] => {
  const output: IAutoMovieFilmTimeline["tracks"]["captions"] = [];
  const ids = new Set<string>();
  let priorEnd = 0;
  for (const cue of edit.tracks.captions) {
    const startFrame = frameTime(
      cue.start,
      fps,
      `${cue.id} caption start`,
      diagnostics,
    );
    const endFrame = frameTime(
      cue.end,
      fps,
      `${cue.id} caption end`,
      diagnostics,
    );
    if (startFrame === null || endFrame === null) continue;
    if (
      cue.id.trim().length === 0 ||
      ids.has(cue.id) ||
      cue.text.trim().length === 0 ||
      parseAutoMovieCaptionLanguage(cue.language) === null ||
      cue.speaker?.trim().length === 0 ||
      startFrame < priorEnd ||
      endFrame <= startFrame ||
      endFrame > totalFrames
    )
      diagnostics.push(
        filmDiagnostic(
          "film-caption-cue-invalid",
          `Caption cue "${cue.id}" must be unique, non-overlapping, in range, plain non-blank text, use a well-formed RFC 5646 language tag, and use a non-blank speaker identity.`,
        ),
      );
    ids.add(cue.id);
    priorEnd = endFrame;
    output.push({
      id: cue.id,
      text: cue.text,
      language: cue.language,
      ...(cue.speaker === undefined ? {} : { speaker: cue.speaker }),
      startFrame,
      endFrame,
    });
  }
  return output;
};

const normalizeEffectCues = (
  edit: IAutoMovieFilmEdit,
  zones: readonly string[],
  fps: number,
  totalFrames: number,
  diagnostics: IAutoMovieDiagnostic[],
): IAutoMovieFilmTimeline["tracks"]["effects"] => {
  const output: IAutoMovieFilmTimeline["tracks"]["effects"] = [];
  const ids = new Set<string>();
  let priorStart = -1;
  for (const cue of edit.tracks.effects) {
    const startFrame = frameTime(
      cue.start,
      fps,
      `${cue.id} effect start`,
      diagnostics,
    );
    const durationFrames = frameTime(
      cue.duration,
      fps,
      `${cue.id} effect duration`,
      diagnostics,
    );
    if (startFrame === null || durationFrames === null) continue;
    if (
      cue.id.trim().length === 0 ||
      ids.has(cue.id) ||
      zones.includes(cue.zone) === false ||
      durationFrames === 0 ||
      startFrame + durationFrames > totalFrames ||
      cue.intensity < 0 ||
      cue.intensity > 1 ||
      startFrame < priorStart
    )
      diagnostics.push(
        filmDiagnostic(
          "film-effect-cue-invalid",
          `Effect cue "${cue.id}" must be unique, ordered, in range, reference a registered world zone, and use intensity from 0 through 1.`,
        ),
      );
    ids.add(cue.id);
    priorStart = startFrame;
    output.push({
      id: cue.id,
      recipe: cue.recipe,
      zone: cue.zone,
      startFrame,
      durationFrames,
      intensity: cue.intensity,
    });
  }
  return output;
};

/**
 * The exact placeholder the scaffold leaves where an author must implement.
 *
 * Assembled rather than written whole so this file does not contain the token
 * it looks for. A checker that trips over its own definition is the same
 * self-defeating shape as a probe that moves the value it measures.
 */
const TEMPLATE_SENTINEL = ["AUTOMOVIE", "IMPLEMENT", "ME"].join("_");

/**
 * Whether compiled source still carries the scaffold's placeholder.
 *
 * Matched on identifier boundaries so prose that merely mentions the sentinel,
 * or a longer name that contains it, is not the placeholder itself. A project
 * that never had the scaffold section is silent because the token is absent.
 */
const containsTemplateSentinel = (source: string): boolean => {
  // An identifier character, tested without a character class so the linter's
  // duplicate-member check has nothing to object to: a letter is what changes
  // under case folding, and the rest are named outright.
  const identifier = (character: string): boolean =>
    character.toLowerCase() !== character.toUpperCase() ||
    (character >= "0" && character <= "9") ||
    character === "_" ||
    character === "$";
  const boundary = (character: string | undefined): boolean =>
    character === undefined || identifier(character) === false;
  for (
    let index = source.indexOf(TEMPLATE_SENTINEL);
    index >= 0;
    index = source.indexOf(TEMPLATE_SENTINEL, index + 1)
  )
    if (
      boundary(source[index - 1]) &&
      boundary(source[index + TEMPLATE_SENTINEL.length])
    )
      return true;
  return false;
};

const inspectSource = (
  target: string,
  sourcePath: string,
  source: string,
): IAutoMovieDiagnostic[] => {
  const sourceFile = ts.createSourceFile(
    sourcePath,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const diagnostics: IAutoMovieDiagnostic[] = [];
  const found = new Set<string>();
  if (containsTemplateSentinel(source))
    diagnostics.push({
      code: "source-template-sentinel",
      category: "error",
      phase: "compile",
      target,
      path: sourcePath,
      message: `Template sentinel "${TEMPLATE_SENTINEL}" remains in ${sourcePath}. The placeholder says this scaffold section has no implementation, so compile and review cannot treat it as resident work. Implement the marked section and remove the exact sentinel.`,
    });
  const report = (
    code: AutoMovieDiagnosticCode,
    capability: string,
    reason?: string,
  ): void => {
    const key = `${code}:${capability}`;
    if (found.has(key)) return;
    found.add(key);
    diagnostics.push({
      code,
      category: "error",
      phase: "source",
      target,
      path: sourcePath,
      message:
        reason ??
        `${capability} is unavailable in deterministic shot source. Replace it with design input, an explicit seed, or an AutoMovie engine oracle in ${sourcePath}.`,
    });
  };
  const visit = (node: ts.Node): void => {
    if (
      ts.canHaveModifiers(node) &&
      ts
        .getModifiers(node)
        ?.some((modifier) => modifier.kind === ts.SyntaxKind.AsyncKeyword)
    )
      report("source-capability-forbidden", "async function");
    if (
      ts.isImportDeclaration(node) &&
      importDeclarationHasRuntimeBinding(node) &&
      isLinkableImport(node) === false
    ) {
      const refused = refusedEngineNames(node).flatMap((name) => {
        const reason = autoMovieSandboxEngineImportRefusal({
          name,
          sourcePath,
        });
        return reason === null ? [] : [{ name, reason }];
      });
      if (refused.length === 0)
        report("source-import-unsupported", "runtime import");
      else
        for (const entry of refused)
          report("source-import-unsupported", entry.name, entry.reason);
    }
    if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword
    )
      report("source-import-unsupported", "dynamic import");
    if (ts.isPropertyAccessExpression(node)) {
      const expression = node.expression.getText(sourceFile);
      const name = node.name.text;
      if (LOCALE_SENSITIVE_SOURCE_MEMBERS.has(name))
        report("source-nondeterministic", name);
      if (
        (expression === "Math" && name === "random") ||
        (expression === "Date" && name === "now") ||
        (expression === "performance" && name === "now") ||
        (expression === "crypto" && name === "randomUUID")
      )
        report("source-nondeterministic", `${expression}.${name}`);
    }
    if (
      ts.isElementAccessExpression(node) &&
      ts.isStringLiteralLike(node.argumentExpression) &&
      LOCALE_SENSITIVE_SOURCE_MEMBERS.has(node.argumentExpression.text)
    )
      report("source-nondeterministic", node.argumentExpression.text);
    if (
      ts.isIdentifier(node) &&
      [
        "Date",
        "Intl",
        "process",
        "require",
        "fetch",
        "Promise",
        "queueMicrotask",
        "setTimeout",
        "setInterval",
      ].includes(node.text) &&
      (ts.isPropertyAccessExpression(node.parent) === false ||
        node.parent.name !== node)
    )
      report("source-capability-forbidden", node.text);
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return diagnostics;
};

const importDeclarationHasRuntimeBinding = (
  declaration: ts.ImportDeclaration,
): boolean => {
  const clause = declaration.importClause;
  if (clause === undefined) return true;
  if (clause.isTypeOnly) return false;
  if (clause.name !== undefined) return true;
  const bindings = clause.namedBindings!;
  if (ts.isNamespaceImport(bindings)) return true;
  return bindings.elements.some((element) => element.isTypeOnly === false);
};

/**
 * Whether a runtime import is one the sandbox can actually satisfy.
 *
 * Two kinds resolve. The engine surface is published by a reviewed bridge or
 * deterministic stand-in, so a name absent from that surface must be refused
 * here rather than fail at execution with a missing-property message.
 * Project-relative source is linked from the project's own reader, which keeps
 * path escape and symlinks refused exactly as they are for an entry module.
 *
 * A default or namespace import is refused for both. The sandbox registry hands
 * out a frozen exports object, and binding it as a whole hides which names a
 * module actually depends on from the link graph that has to resolve them.
 */
const isLinkableImport = (declaration: ts.ImportDeclaration): boolean => {
  if (ts.isStringLiteralLike(declaration.moduleSpecifier) === false)
    return false;
  const specifier = declaration.moduleSpecifier.text;
  const clause = declaration.importClause;
  if (
    clause === undefined ||
    clause.isTypeOnly ||
    clause.name !== undefined ||
    clause.namedBindings === undefined ||
    ts.isNamedImports(clause.namedBindings) === false
  )
    return false;
  const runtime = clause.namedBindings.elements.filter(
    (element) => element.isTypeOnly === false,
  );
  if (runtime.length === 0) return false;
  if (isProjectSourceSpecifier(specifier)) return true;
  const permitted = AUTOMOVIE_SANDBOX_MODULE_EXPORTS.get(specifier);
  if (permitted === undefined) return false;
  return runtime.every((element) =>
    permitted.has(element.propertyName?.text ?? element.name.text),
  );
};

/**
 * The engine names a refused import declaration asked for by name.
 *
 * Only a named import from the engine package yields anything, because that is
 * the only shape in which the author addressed a capability rather than a
 * module: a default, namespace or side-effect clause is refused for what it
 * binds, not for which name it wanted, and no per-name reason would be true of
 * it. Everything else keeps the declaration-level refusal.
 *
 * The names come back unfiltered. A mixed import naming one reachable and one
 * withheld capability is refused as a whole, and telling the author which half
 * caused it is the point; {@link autoMovieSandboxEngineImportRefusal} is what
 * drops the reachable half.
 */
const refusedEngineNames = (
  declaration: ts.ImportDeclaration,
): readonly string[] => {
  if (
    ts.isStringLiteralLike(declaration.moduleSpecifier) === false ||
    declaration.moduleSpecifier.text !== AUTOMOVIE_SANDBOX_ENGINE_SPECIFIER
  )
    return [];
  const clause = declaration.importClause;
  if (
    clause === undefined ||
    clause.namedBindings === undefined ||
    ts.isNamedImports(clause.namedBindings) === false
  )
    return [];
  return clause.namedBindings.elements
    .filter((element) => element.isTypeOnly === false)
    .map((element) => (element.propertyName ?? element.name).text);
};

const LOCALE_SENSITIVE_SOURCE_MEMBERS = new Set([
  "localeCompare",
  "toLocaleDateString",
  "toLocaleLowerCase",
  "toLocaleString",
  "toLocaleTimeString",
  "toLocaleUpperCase",
]);

const validateCompiledShot = (
  contract: IAutoMovieShotContract,
  value: IAutoMovieCompiledShotSource,
): IAutoMovieDiagnostic[] => {
  const id = contract.id;
  const diagnostics: IAutoMovieDiagnostic[] = [];
  if (value.shot.id !== id)
    diagnostics.push(
      engineDiagnostic(id, "shot.id", `must equal contract id "${id}"`),
    );
  if (value.shot.duration !== contract.durationSeconds)
    diagnostics.push(
      engineDiagnostic(
        id,
        "shot.duration",
        `must equal contract duration ${contract.durationSeconds}`,
      ),
    );
  appendValidation(
    diagnostics,
    id,
    validateSceneArtifact(value.scene, value.models),
  );
  const motionIds = new Set(value.motions.map((motion) => motion.id));
  appendValidation(
    diagnostics,
    id,
    validateShotArtifact(value.shot, value.scene, motionIds),
  );
  diagnostics.push(...validateAutoMovieFormationMotions(contract, value));
  diagnostics.push(...validateAutoMovieFormationSlotMotions(contract, value));
  diagnostics.push(...validateAutoMovieFormationGround(contract, value));
  diagnostics.push(...validateAutoMovieFormationOverlap(contract, value));
  diagnostics.push(...validateAutoMovieEffects(contract, value));
  for (const model of value.models)
    appendValidation(diagnostics, id, validateModel({ model }));
  diagnostics.push(...validateCompiledMaterialBindings(id, value));
  const skeletons = new Map(
    value.models.flatMap((model) =>
      model.skeleton === null
        ? []
        : [[model.skeleton.id, model.skeleton] as const],
    ),
  );
  for (const motion of value.motions) {
    const skeleton = skeletons.get(motion.skeleton);
    if (skeleton === undefined)
      diagnostics.push(
        engineDiagnostic(
          id,
          `motion:${motion.id}`,
          `references missing skeleton "${motion.skeleton}"`,
        ),
      );
    else
      appendValidation(diagnostics, id, validateMotion({ motion, skeleton }));
  }
  return diagnostics;
};

/** Refuse every simulated-surface material citation that cannot resolve once. */
const validateCompiledMaterialBindings = (
  id: string,
  value: IAutoMovieCompiledShotSource,
): IAutoMovieDiagnostic[] => {
  const bindings: Array<{ path: string; material: string | null }> = [
    ...(value.waterFeatures ?? []).map((feature, index) => ({
      path: `waterFeatures[${index}].material`,
      material: feature.material,
    })),
    ...(value.softFurnishings ?? []).map((furnishing, index) => ({
      path: `softFurnishings[${index}].material`,
      material: furnishing.material,
    })),
    ...(value.plantingInstallations ?? []).flatMap((installation, index) => [
      {
        path: `plantingInstallations[${index}].branchMaterial`,
        material: installation.branchMaterial,
      },
      {
        path: `plantingInstallations[${index}].leafMaterial`,
        material: installation.leafMaterial,
      },
    ]),
  ];
  return bindings.flatMap((binding) => {
    if (binding.material === null) return [];
    try {
      resolveAutoMovieMaterial({
        models: value.models,
        material: binding.material,
      });
      return [];
    } catch (error) {
      const message =
        error instanceof Error ? error.message.replace(/\.$/u, "") : `${error}`;
      return [
        engineDiagnostic(
          id,
          binding.path,
          `must resolve to one compiled material definition, but ${message}`,
        ),
      ];
    }
  });
};

/**
 * Metres a member may travel between neighbouring samples inside one cue.
 *
 * Ground is judged in metres, so the resolution is stated in metres too. What
 * it buys is exactly this: no measured member moves further than half a metre
 * between one sample and the next, so a stretch of void wider than that has a
 * sample in it. A narrower one can still be stepped over. Nothing requires an
 * authored surface to be wide, so that is a limit of the gate and not a claim
 * about spaces.
 */
const FORMATION_GROUND_SAMPLE_METRES = 0.5;

/**
 * Directions the outermost member of a formation is asked for.
 *
 * A formation is a set of members, and which of them is furthest out depends on
 * which way you look. Sixteen evenly spaced looks put a measured member within
 * eleven degrees of any direction, so the outermost member in a direction not
 * asked about stands at least `cos(11.25 deg)` of the way out as the one that
 * was. Every measured point is a member, so a coarser reading can only miss; it
 * cannot refuse a formation that was standing on its ground.
 */
const FORMATION_GROUND_SUPPORT_DIRECTIONS = 16;

/**
 * Members already found for one compiled formation.
 *
 * The set is a pure function of the formation, and the compiler hands the same
 * compiled formation to every shot that stages it, so a crowd in fifty shots
 * would otherwise regenerate every one of its members fifty times over. Keyed
 * by the formation itself, so nothing outlives the compile that made it.
 */
const formationGroundMemberCache = new WeakMap<
  IAutoMovieFormationPlacement,
  IFormationGroundMember[]
>();

/**
 * One member the ground gate measures, kept with the slot that produced it.
 *
 * The point alone was enough while every member of a unit did the same thing. A
 * member with its own cue does not, so the slot has to travel with the point: a
 * member removed at four seconds must stop being measured, and a member that
 * stepped off its place must be measured where it stepped to.
 */
interface IFormationGroundMember {
  /** Zero-based slot this point belongs to. */
  slot: number;
  /** Designed world-space position of that slot at rest. */
  point: IAutoMovieVector3;
}

/**
 * The members a formation is judged by: its outermost in each asked direction.
 *
 * `bounds` is the axis-aligned box over every slot, and its corners are not
 * members. A full `line` or `column` grid happens to put a slot at each of
 * them; a `wedge`, an `arc` and a `scatter` do not, so judging the corners
 * refuses formations every member of which is carried. This asks the engine
 * where the members are and keeps the outermost ones, which is both sound and
 * the set a floor's edge is met by.
 *
 * One pass over the slots, so the cost is the formation's own size and not the
 * square of it. The same member is usually outermost in several directions; it
 * is measured once.
 */
const formationGroundMembers = (
  formation: IAutoMovieFormationPlacement,
): IFormationGroundMember[] => {
  const remembered = formationGroundMemberCache.get(formation);
  if (remembered !== undefined) return remembered;
  const looks = Array.from(
    { length: FORMATION_GROUND_SUPPORT_DIRECTIONS },
    (_, index) => {
      const radians =
        (2 * Math.PI * index) / FORMATION_GROUND_SUPPORT_DIRECTIONS;
      return { x: Math.cos(radians), z: Math.sin(radians) };
    },
  );
  const furthest = looks.map(() => Number.NEGATIVE_INFINITY);
  const outermost = looks.map((): IFormationGroundMember | null => null);
  // One record per slot rather than per direction, so a formation of a hundred
  // thousand members is asked for each of them once. A member outermost in
  // several directions is the same object in each, which is what the set below
  // dedupes on.
  for (let slot = 0; slot < formation.count; ++slot) {
    const member = { slot, point: formationSlotPosition(formation, slot) };
    for (let index = 0; index < looks.length; ++index) {
      const look = looks[index]!;
      const reach = member.point.x * look.x + member.point.z * look.z;
      if (reach <= furthest[index]!) continue;
      furthest[index] = reach;
      outermost[index] = member;
    }
  }
  // A type predicate rather than a plain test: `filter` does not narrow on
  // its own, so the null the loop starts from would travel into every
  // consumer of a member's slot.
  const members = [
    ...new Set(
      outermost.filter(
        (member): member is IFormationGroundMember => member !== null,
      ),
    ),
  ];
  formationGroundMemberCache.set(formation, members);
  return members;
};

/**
 * Samples one cue may take, however far it carries a unit.
 *
 * A cue's turn and travel are plain unbounded numbers, and holding the
 * resolution over a turn of a thousand revolutions would cost a unit of
 * ordinary size hundreds of thousands of samples. Past this the walk stays
 * bounded and the resolution coarsens in proportion, which is the trade a gate
 * that samples has to make somewhere and had better say out loud.
 */
const FORMATION_GROUND_SAMPLE_LIMIT = 360;

/**
 * One reading as a reader wants it: three decimals, so a metre is stated to the
 * millimetre and a second to the millisecond.
 */
const round = (value: number): number => Math.round(value * 1_000) / 1_000;

/**
 * When inside one cue a staged unit is worth measuring against its ground.
 *
 * Reading only the ends of a cue would be enough if ground were convex, because
 * every part of a cue interpolates monotonically and a corner therefore travels
 * a bounded path between two ends. Ground is not convex: a space is a union of
 * authored surfaces, so a unit can stand on one, end on another, and cross what
 * is between them. That is true of a turn, which swings a corner through an arc
 * neither end holds, and just as true of a straight walk between two roads.
 *
 * So the interior is walked, at a resolution stated in the same metres the
 * ground is. How far a corner can travel in one cue is bounded by what the cue
 * does to it: the anchor's own travel, the arc a turn sweeps it through at its
 * radius, and the reach a spacing change adds. The interior is walked in even
 * time steps rather than even distance steps, because the state at a time is
 * the engine's answer and inverting an easing to land on an exact distance
 * would be a second one. Every easing this engine has moves at most twice the
 * average rate, so `n` even steps hold a corner's travel between neighbours
 * below `2 * reach / n`, and the step count is chosen from that bound rather
 * than guessed. The bound holds until {@link FORMATION_GROUND_SAMPLE_LIMIT}
 * clamps the count; a cue that carries a unit far enough to reach it is
 * measured more coarsely, in proportion.
 *
 * This samples; it does not solve. The set of times a unit is off its ground
 * has no closed form — it depends on the authored polygons as much as on the
 * cue — so a resolution is stated instead of a guarantee. Every sampled time is
 * a state the unit really occupies, which is what keeps the gate from ever
 * refusing a shot that was correct.
 *
 * A `step` cue holds its start state until its end, so its interior samples all
 * repeat that one state. They cost a little and answer correctly, which is the
 * trade taken rather than a branch here for the one easing that does not move.
 */
const formationGroundSampleTimes = (
  cue: IAutoMovieFormationMotion,
  radius: number,
  reformReach: number,
): number[] => {
  // How many times its design reach a spacing change ever holds a member out
  // at, so the arc a turn sweeps it through is measured at the radius it really
  // turns on. Read as a magnitude: a negative scale mirrors a unit rather than
  // shrinking it past nothing, and a mirrored member travels just as far.
  const spread = Math.max(
    Math.abs(cue.from.spacingScale.lateral),
    Math.abs(cue.to.spacingScale.lateral),
    Math.abs(cue.from.spacingScale.depth),
    Math.abs(cue.to.spacingScale.depth),
  );
  const reach =
    Math.hypot(
      cue.to.translation.x - cue.from.translation.x,
      cue.to.translation.z - cue.from.translation.z,
    ) +
    ((Math.abs(cue.to.facingOffsetDeg - cue.from.facingOffsetDeg) * Math.PI) /
      180) *
      radius *
      spread +
    Math.max(
      Math.abs(cue.to.spacingScale.lateral - cue.from.spacingScale.lateral),
      Math.abs(cue.to.spacingScale.depth - cue.from.spacingScale.depth),
    ) *
      radius +
    // A re-form moves members without moving the unit, so none of the terms
    // above sees it: a crowd changing shape in place has zero translation,
    // zero turn and unit spacing, and would be sampled at its two ends only.
    // The ground between two arrangements is exactly what an author cannot see
    // from either of them.
    reformReach;
  const steps = Math.min(
    FORMATION_GROUND_SAMPLE_LIMIT,
    Math.ceil((2 * reach) / FORMATION_GROUND_SAMPLE_METRES),
  );
  const span = cue.end - cue.start;
  return [
    cue.start,
    ...Array.from(
      { length: Math.max(0, steps - 1) },
      (_, index) => cue.start + (span * (index + 1)) / steps,
    ),
    cue.end,
  ];
};

/**
 * When inside one member's own cue that member is worth measuring.
 *
 * The same argument as {@link formationGroundSampleTimes} and the same bound: a
 * member's cue displaces it along a straight segment, ground is not convex, and
 * both ends can stand on floor the middle does not. What the member travels is
 * the length of that displacement, so the step count follows from it rather
 * than from a guess, and the same cap keeps a member carried absurdly far
 * measured coarsely instead of endlessly.
 *
 * A turn of the member alone sweeps nothing, because a member is a point to
 * this gate: the ground under it does not move when it faces another way.
 */
const formationSlotGroundSampleTimes = (
  cue: IAutoMovieFormationSlotMotion,
): number[] => {
  const reach = Math.hypot(
    cue.to.offset.x - cue.from.offset.x,
    cue.to.offset.z - cue.from.offset.z,
  );
  const steps = Math.min(
    FORMATION_GROUND_SAMPLE_LIMIT,
    Math.ceil((2 * reach) / FORMATION_GROUND_SAMPLE_METRES),
  );
  const span = cue.end - cue.start;
  return [
    cue.start,
    ...Array.from(
      { length: Math.max(0, steps - 1) },
      (_, index) => cue.start + (span * (index + 1)) / steps,
    ),
    cue.end,
  ];
};

/**
 * How far under a surface a member may read before it is inside the ground.
 *
 * A millimetre, which is what the refusal states its metres to. Terrain height
 * is interpolated — along a ramp axis, across a heightfield cell — and a member
 * placed from one record and judged against another accumulates the last bits
 * of two such interpolations. Refusing at those bits would refuse a unit
 * standing exactly on its ground, and this gate's whole discipline is that it
 * never refuses a shot that was correct.
 */
const FORMATION_GROUND_SINK_TOLERANCE_METRES = 1e-3;

/**
 * Why one placed member is off the ground a shot staged, or `null` when it is
 * not off it at all.
 *
 * Two ways to leave a floor, and the second is as broken as the first: standing
 * where nothing carries you, and standing under what does. `carried` names
 * which — `null` for the void, the surface's own height for the sinking — so
 * the refusal can say what an author has to correct rather than the same
 * sentence twice.
 *
 * Standing _above_ the surface is not refused. `anchor.y` is the height a unit
 * was staged at and always has been, and a shot deliberately holding a unit
 * over the space it staged — a rank on structure the space does not model, a
 * unit whose terrain record and staged space are two readings of one place — is
 * a composition, not a mistake. Under the surface admits no such reading: the
 * member is inside the ground and nothing can see it.
 */
const formationGroundEscape = (
  space: IAutoMovieSpace,
  place: IAutoMovieVector3,
): { carried: number | null } | null => {
  const carried = heightAt(space, place.x, place.z);
  if (carried === null) return { carried: null };
  return place.y < carried - FORMATION_GROUND_SINK_TOLERANCE_METRES
    ? { carried }
    : null;
};

/**
 * Refuse a staged unit the ground it was staged on does not carry.
 *
 * A shot's space is what the scene keeps and what the viewer turns into real
 * meshes, so a formation reaching past it is a unit standing over a void. That
 * is not caught by the world design: a world surface is authored terrain and is
 * a different record from the space a shot stages, which is how a field
 * corrected in one went on drawing a floor a third the size of its unit in the
 * other.
 *
 * The bounds are the compiler's own and both the placement and the containment
 * question go to the engine that owns them, so this compares answers that
 * already exist rather than deriving a third that could disagree with both.
 *
 * What is measured is members, chosen by {@link formationGroundMembers}: the
 * outermost slot in each of a stated set of directions, carried through a cue
 * as points. Every measured point is somewhere a member really stands, so a
 * refusal is always sound; a member not asked about is the honest gap, stated
 * the same way the time resolution is.
 *
 * Each measured member is judged in height as well as in plan, by
 * {@link formationGroundEscape}: standing under the surface that carries you is
 * as broken as standing where nothing does, and a gate that refused only the
 * second would pass a whole unit buried in the hill it was staged on. The same
 * measured set answers both questions, so the height reading inherits its
 * honest gap: a member not asked about in plan is not asked about in height.
 *
 * A shot that stages no space is not measured. The engine then falls back to
 * the scalar ground plane it assumed before spaces existed, and there is no
 * authored extent for a unit to leave.
 *
 * A unit is measured where it stands and along every cue that moves it, at the
 * times {@link formationGroundSampleTimes} picks: the ends always, and the
 * interior at a resolution stated in metres. The interior is walked because
 * ground is not convex — two ends a unit stands on say nothing about what lies
 * between them. Every sampled time is a state the unit really occupies, so the
 * gate never refuses a shot that was correct, and it samples rather than solves
 * because where a unit leaves authored ground has no closed form.
 *
 * A member with its own cue is measured too, and measured as itself. Every slot
 * a per-member cue names is added to the set above — the channel is sparse, so
 * that costs the exceptions and not the crowd — and each measured member is
 * carried through its own cue as well as its unit's. A member the shot has
 * removed is not measured at all while it is absent: refusing a shot because
 * something nobody can see stands over a void is exactly the false refusal this
 * gate is built never to make.
 *
 * @author Samchon
 */
export const validateAutoMovieFormationGround = (
  contract: Pick<IAutoMovieShotContract, "id">,
  value: {
    scene: Pick<IAutoMovieScene, "space">;
    formations: readonly IAutoMovieFormationPlacement[];
    formationMotions?: readonly IAutoMovieFormationMotion[];
    formationSlotMotions?: readonly IAutoMovieFormationSlotMotion[];
  },
): IAutoMovieDiagnostic[] => {
  const space = value.scene.space;
  if (space === undefined || space === null) return [];
  const cues = value.formationMotions ?? [];
  const slotCues = value.formationSlotMotions ?? [];
  const diagnostics: IAutoMovieDiagnostic[] = [];
  for (const formation of value.formations) {
    const own = cues.filter((cue) => cue.formation === formation.id);
    const ownSlots = slotCues.filter((cue) => cue.formation === formation.id);
    // The outermost members, carried as points through the same transform the
    // runtime places them with, plus every member a cue singles out. The
    // outermost set is keyed by slot so a member that is both is measured once,
    // and measured with its own cue rather than without it.
    const members = new Map(
      formationGroundMembers(formation).map((member) => [member.slot, member]),
    );
    for (const cue of ownSlots)
      for (const slot of cue.slots) {
        if (
          members.has(slot) ||
          Number.isSafeInteger(slot) === false ||
          slot < 0 ||
          slot >= formation.count
        )
          continue;
        members.set(slot, {
          slot,
          point: formationSlotPosition(formation, slot),
        });
      }
    // How far out the furthest measured member sits, which is what turns an
    // angle a cue sweeps into the metres that member travels.
    const radius = Math.max(
      0,
      ...[...members.values()].map((member) =>
        Math.hypot(
          member.point.x - formation.anchor.x,
          member.point.z - formation.anchor.z,
        ),
      ),
    );
    const times = [
      ...new Set([
        ...own.flatMap((cue) =>
          formationGroundSampleTimes(
            cue,
            radius,
            // How far the furthest member this gate measures travels between
            // the two arrangements. Read off the members it walks rather than
            // bounded by the layouts' radii, so the sampling density is the
            // density of what is actually being asked.
            cue.layout === undefined
              ? 0
              : Math.max(
                  0,
                  ...[...members.values()].map((member) => {
                    const target = formationSlotPosition(
                      formation,
                      member.slot,
                      { layout: cue.layout!, progress: 1 },
                    );
                    return Math.hypot(
                      target.x - member.point.x,
                      target.z - member.point.z,
                    );
                  }),
                ),
          ),
        ),
        ...ownSlots.flatMap(formationSlotGroundSampleTimes),
      ]),
    ].sort((left, right) => left - right);
    // Where it was staged is measured only when the unit is ever there: with no
    // cue it never moves, and with a cue starting after zero it stands still
    // until then. A cue starting at zero means the unit begins somewhere its
    // design bounds never describe, and measuring those would refuse a shot for
    // a position it never holds.
    //
    // Asked of the earliest sampled time itself. A unit with no cue has none,
    // which is the same answer as a cue that starts later, and reading it once
    // spares a fallback for a `times` that cannot be empty when `own` is not:
    // a branch nothing can reach is a branch nothing can test.
    const first = times[0];
    const resting = first === undefined || first > 0;
    // Walked rather than collected, and stopped at the first escape. A cue is
    // sampled up to the cap, so gathering every member at every sampled time
    // before taking the first would measure a unit hundreds of times over to
    // report the moment it already found.
    let escape: {
      time: number | null;
      place: IAutoMovieVector3;
      carried: number | null;
    } | null = null;
    for (const time of [...(resting ? [null] : []), ...times]) {
      // The rest pass is its own loop rather than a branch inside the moving
      // one. At rest no cue of either kind has begun, so the member is exactly
      // where its design put it and is read as the designed point rather than
      // through an identity transform that would only round it -- and asking
      // the question here is what tells the sampler below that it has a time.
      if (time === null) {
        for (const member of members.values()) {
          const off = formationGroundEscape(space, member.point);
          if (off === null) continue;
          escape = { time, place: member.point, ...off };
          break;
        }
        if (escape !== null) break;
        continue;
      }
      const motion = sampleFormationMotion(own, formation.id, time);
      for (const member of members.values()) {
        // Re-read where the design puts this member when a cue is re-forming
        // the unit: the arrangement itself is moving, so the point the cached
        // sweep found is where the member stood before the re-form began. Read
        // once per member per sampled time, and only when a re-form is under
        // way -- a unit that keeps its arrangement pays nothing.
        const designed =
          motion.reform === null
            ? member.point
            : formationSlotPosition(formation, member.slot, motion.reform);
        const placed = placeFormationSlot({
          position: designed,
          facingDeg: formation.facingDeg,
          anchor: formation.anchor,
          baseFacingDeg: formation.facingDeg,
          unit: motion,
          member: sampleFormationSlotMotion(
            ownSlots,
            formation.id,
            member.slot,
            time,
          ),
        });
        // A member the shot has taken out is standing nowhere, so no surface
        // has to carry it. Refusing a shot for a member nobody can see is the
        // false refusal this gate exists never to make.
        if (placed.present === false) continue;
        const off = formationGroundEscape(space, placed.position);
        if (off === null) continue;
        escape = { time, place: placed.position, ...off };
        break;
      }
      if (escape !== null) break;
    }
    if (escape === null) continue;
    diagnostics.push(
      engineDiagnostic(
        contract.id,
        `formation:${formation.id}`,
        // Reported to the millimetre and the millisecond. A sampled interior
        // time and a turned member are both long fractions, and a diagnostic an
        // author reads to find a place on a field gains nothing from the digits
        // below that. Only the reading is rounded; the comparison above is not.
        `must stand on the space this shot staged, but ${
          escape.time === null
            ? "a member of it stands at"
            : `at ${round(escape.time)}s its cue takes a member of it to`
        } (${round(escape.place.x)}, ${round(escape.place.z)}) ${
          escape.carried === null
            ? "where no walkable surface carries it"
            : `at ${round(escape.place.y)}m, below the ${round(escape.carried)}m the surface there stands at`
        }`,
      ),
    );
  }
  return diagnostics;
};

/**
 * Members of one unit the overlap gate measures.
 *
 * Every measured member is a point placed into a grid at every sampled time,
 * and a unit may be a hundred thousand of them. Past this many the walk stays
 * bounded and what is measured is the unit's first slots, which is the trade a
 * gate that samples has to make somewhere and had better say out loud. Below it
 * — where nearly every authored unit sits — every member is measured, so every
 * pair standing inside its own bodies is found.
 */
const FORMATION_OVERLAP_MEMBER_LIMIT = 4096;

/**
 * Times inside one shot the overlap gate places its units at.
 *
 * Zero and both ends of every cue are always among them, because those are
 * states the shot certainly holds; whatever budget is left fills the gaps
 * between them evenly. The interior is what catches two units standing clear at
 * both ends of a cue and walking through one another in between, and a cue that
 * closes a gap for less than one such interval is the honest limit this number
 * states rather than hides.
 */
const FORMATION_OVERLAP_SAMPLE_LIMIT = 16;

/**
 * One vertical column a runtime model certainly fills, about its own axis.
 *
 * Not the extent of the model but a disc inside it: the largest circle that
 * fits in one part's own horizontal cross-section, centred on the axis the
 * member stands on, over the height that part covers. Two members standing
 * closer than the sum of two such radii, at heights whose intervals meet, are
 * two bodies in one place, and that is what lets a refusal be sound. Everything
 * the measure leaves out — an arm reaching outside the column, a part hung off
 * the axis — costs the gate an overlap it does not find, and can never make it
 * invent one.
 *
 * This is the model as it rests, which is the shape a unit is staged in and the
 * shape a crowd holds. What one member's own performance does to one of its
 * parts is not read here, in either direction: a gate that tried to would be
 * measuring a solver's output rather than a design's arrangement.
 *
 * @author Samchon
 */
export interface IAutoMovieModelColumn {
  /**
   * Radius of the disc the model fills, in metres.
   */
  radius: number;
  /**
   * Bottom of the column, in metres above where the model stands.
   */
  bottom: number;
  /**
   * Top of the column, in metres above where the model stands.
   */
  top: number;
}

/**
 * The columns one runtime model fills, read from the geometry it already is.
 *
 * A member's size is not a field an author states beside the model and then
 * contradicts: it is derived from the parts the compiler materialized, so a
 * recipe that grows grows here too and there is nothing to keep in step by
 * hand. One reading answers for a figure assembled from primitives, for a
 * single-primitive object, and for the proxy an imported appearance is bound
 * through, because all three are parts with stated dimensions.
 *
 * Only parts standing on the model's own vertical axis are read. A part hung
 * off the axis sits somewhere different for every heading its member holds, and
 * this answer has to hold whichever way a member faces; a disc about the axis
 * does. A part turned about anything but the vertical is left out for the same
 * reason, its column no longer being vertical, and so is a scaled one, whose
 * real dimensions are no longer the ones its shape states.
 *
 * @author Samchon
 */
export const autoMovieModelColumns = (
  model: Pick<IAutoMovieModel, "parts" | "skeleton">,
): IAutoMovieModelColumn[] => {
  const heights = axialBoneHeights(model.skeleton);
  return model.parts.flatMap((part) => {
    const column = axialPartColumn(part, heights);
    return column === null ? [] : [column];
  });
};

/**
 * Where each bone rests on the model's own vertical axis, above its origin.
 *
 * A bone is on that axis when it and every bone above it rest with no sideways
 * displacement and no turn out of the vertical, which is exactly when adding up
 * the chain's heights gives the bone's real resting height. A bone that fails
 * either test, or whose parent does, is simply absent: the parts riding it are
 * then not measured, which costs the gate a column and never gives it a wrong
 * one.
 *
 * Resolved by repeated passes rather than by walking parents, because bones are
 * not required to be listed above their children, and a chain that never
 * resolves — a parent that is missing, off the axis, or its own ancestor —
 * simply stops adding heights instead of needing a cycle guard of its own.
 */
const axialBoneHeights = (
  skeleton: IAutoMovieModel["skeleton"],
): Map<AutoMovieHumanoidBone, number> => {
  const heights = new Map<AutoMovieHumanoidBone, number>();
  const axial = (skeleton?.bones ?? []).filter(
    (bone) =>
      bone.rest.translation.x === 0 &&
      bone.rest.translation.z === 0 &&
      bone.rest.rotation.x === 0 &&
      bone.rest.rotation.z === 0,
  );
  let settled = true;
  while (settled) {
    settled = false;
    for (const bone of axial) {
      if (heights.has(bone.bone)) continue;
      const above = bone.parent === null ? 0 : heights.get(bone.parent);
      if (above === undefined) continue;
      heights.set(bone.bone, above + bone.rest.translation.y);
      settled = true;
    }
  }
  return heights;
};

/**
 * The column one part fills on its model's axis, or `null` when it fills none.
 *
 * A part's own scale is applied rather than refused, because a scaled part is
 * still a solid: each horizontal reach is stretched by its own factor and the
 * disc inside the result is the narrower of the two, while a mirrored part
 * occupies exactly what its unmirrored twin did. That is also what makes one
 * reading at the end enough — a dimension that was never real, and a scale that
 * erases one, both arrive here as a column with nothing inside it.
 */
const axialPartColumn = (
  part: IAutoMovieModel["parts"][number],
  heights: ReadonlyMap<AutoMovieHumanoidBone, number>,
): IAutoMovieModelColumn | null => {
  const solid = columnOfShape(part.geometry);
  if (solid === null) return null;
  const base = axialPartHeight(part, heights);
  if (base === null) return null;
  const scale = part.transform === null ? UNIT_SCALE : part.transform.scale;
  const radius = Math.min(
    solid.across * Math.abs(scale.x),
    solid.deep * Math.abs(scale.z),
  );
  const centre = base + solid.centre * scale.y;
  const half = solid.half * Math.abs(scale.y);
  return finitePositive(radius) && finitePositive(half)
    ? { radius, bottom: centre - half, top: centre + half }
    : null;
};

/** The scale a part with no transform of its own is drawn at. */
const UNIT_SCALE: IAutoMovieVector3 = { x: 1, y: 1, z: 1 };

/**
 * Height above the model's origin at which one part rides, or `null` off-axis.
 *
 * A part rides a bone, or the model's origin when it rides no bone at all, and
 * then its own transform moves it again. Either step can take it off the axis
 * this gate measures about, and a part it cannot place is a part it does not
 * measure.
 */
const axialPartHeight = (
  part: IAutoMovieModel["parts"][number],
  heights: ReadonlyMap<AutoMovieHumanoidBone, number>,
): number | null => {
  const bone = part.attachedBone === null ? 0 : heights.get(part.attachedBone);
  if (bone === undefined) return null;
  const local = part.transform;
  if (local === null) return bone;
  return vertical(local.translation) && vertical(local.rotation)
    ? bone + local.translation.y
    : null;
};

/**
 * True when one displacement or turn leaves the model's vertical axis alone.
 *
 * A quaternion with no `x` and no `z` part turns about the vertical and nothing
 * else, which is exactly the turn a column of circular section does not notice.
 * A displacement with neither is a move straight up or down the axis it already
 * stood on.
 */
const vertical = (value: { x: number; z: number }): boolean =>
  value.x === 0 && value.z === 0;

/**
 * The solid one primitive shape certainly holds, as half-extents about its own
 * centre.
 *
 * Read as two horizontal reaches and a height rather than as a finished disc,
 * because the part's scale stretches the two reaches by different factors and
 * the disc inside the result is the narrower of them. A cone tapers, so what it
 * certainly holds is half its base reach over its wider half; a plane has no
 * thickness, so nothing is ever inside one; a mesh states no dimensions here
 * and is left to the parts that do.
 */
const columnOfShape = (
  geometry: IAutoMovieModel["parts"][number]["geometry"],
): { across: number; deep: number; centre: number; half: number } | null => {
  if (geometry.type !== "primitive") return null;
  const shape = geometry.shape;
  if (shape.type === "sphere")
    return {
      across: shape.radius,
      deep: shape.radius,
      centre: 0,
      half: shape.radius,
    };
  if (shape.type === "capsule" || shape.type === "cylinder")
    return {
      across: shape.radius,
      deep: shape.radius,
      centre: 0,
      half: shape.height / 2,
    };
  if (shape.type === "cone")
    return {
      across: shape.radius / 2,
      deep: shape.radius / 2,
      centre: shape.height / 4,
      half: shape.height / 4,
    };
  if (shape.type === "box")
    return {
      across: shape.width / 2,
      deep: shape.depth / 2,
      centre: 0,
      half: shape.height / 2,
    };
  return null;
};

const finitePositive = (value: number): boolean =>
  Number.isFinite(value) && value > 0;

/** One unit the overlap gate measures, with everything it is measured by. */
interface IFormationOverlapUnit {
  /** Position in the shot's own order, which is the order refusals come in. */
  index: number;
  /** The staged unit itself. */
  formation: IAutoMovieFormationPlacement & {
    lod: ReadonlyArray<{ model: string }>;
  };
  /** Where each measured member stands at rest, with the slot it is. */
  members: ReadonlyArray<{ slot: number; point: IAutoMovieVector3 }>;
  /** Columns of every runtime one of its members may be drawn as. */
  tiers: ReadonlyArray<readonly IAutoMovieModelColumn[]>;
}

/** One measured member, placed where the sampled time really puts it. */
interface IFormationOverlapPlacement {
  /** Unit this member stands in. */
  unit: IFormationOverlapUnit;
  /** Zero-based slot it is. */
  slot: number;
  /** Where it stands at the sampled time. */
  point: IAutoMovieVector3;
}

/**
 * The members one unit is measured by, found once and remembered.
 *
 * The set is a pure function of the unit, and the compiler hands the same
 * compiled unit to every shot that stages it, so a crowd in fifty shots would
 * otherwise be regenerated fifty times over. Keyed by the unit itself, so
 * nothing outlives the compile that made it.
 */
const formationOverlapMemberCache = new WeakMap<
  IAutoMovieFormationPlacement,
  ReadonlyArray<{ slot: number; point: IAutoMovieVector3 }>
>();

const formationOverlapMembers = (
  formation: IAutoMovieFormationPlacement,
): ReadonlyArray<{ slot: number; point: IAutoMovieVector3 }> => {
  const remembered = formationOverlapMemberCache.get(formation);
  if (remembered !== undefined) return remembered;
  const members = Array.from(
    { length: Math.min(formation.count, FORMATION_OVERLAP_MEMBER_LIMIT) },
    (_, slot) => ({ slot, point: formationSlotPosition(formation, slot) }),
  );
  formationOverlapMemberCache.set(formation, members);
  return members;
};

/**
 * When one shot is worth placing its units at.
 *
 * Ends first, because the ends of a cue are states the shot certainly holds and
 * zero is where a unit that has no cue at all stands. Then the gaps between
 * them, filled evenly with whatever budget is left, because two units clear at
 * both ends of a cue can walk straight through one another in between and a
 * spacing that closes and reopens inside one cue never shows at either end.
 *
 * This samples; it does not solve. Whether two members are ever inside one
 * another has no closed form — it depends on the layouts, the easings and the
 * cues together — so a resolution is stated instead of a guarantee. Every
 * sampled time is a state the shot really holds, which is what keeps the gate
 * from refusing a production that was correct.
 */
const formationOverlapSampleTimes = (
  cues: readonly IAutoMovieFormationMotion[],
  slotCues: readonly IAutoMovieFormationSlotMotion[],
): number[] => {
  const ends = [
    ...new Set([
      0,
      ...cues.flatMap((cue) => [cue.start, cue.end]),
      ...slotCues.flatMap((cue) => [cue.start, cue.end]),
    ]),
  ].sort((left, right) => left - right);
  const gaps = Math.max(1, ends.length - 1);
  const inside = Math.max(
    0,
    Math.floor((FORMATION_OVERLAP_SAMPLE_LIMIT - ends.length) / gaps),
  );
  return [
    ...new Set(
      ends.flatMap((time, index) => {
        const next = ends[index + 1];
        return next === undefined
          ? [time]
          : [
              time,
              ...Array.from(
                { length: inside },
                (_, step) => time + ((next - time) * (step + 1)) / (inside + 1),
              ),
            ];
      }),
    ),
  ];
};

/**
 * How close two members of two units may stand before they are in one place.
 *
 * The least any pair of the runtimes they may be drawn as allows, because which
 * tier a member is drawn at is the camera's decision and a refusal has to hold
 * whichever one it makes. Zero when no pair of their columns ever meets in
 * height, which is two bodies that pass each other at different levels rather
 * than through each other.
 */
const formationOverlapClearance = (
  left: IFormationOverlapUnit,
  right: IFormationOverlapUnit,
  lift: number,
): number => {
  let least = Number.POSITIVE_INFINITY;
  for (const near of left.tiers)
    for (const far of right.tiers) {
      let widest = 0;
      for (const one of near)
        for (const other of far)
          if (
            Math.max(one.bottom, other.bottom + lift) <
              Math.min(one.top, other.top + lift) &&
            one.radius + other.radius > widest
          )
            widest = one.radius + other.radius;
      least = Math.min(least, widest);
    }
  return least;
};

/**
 * Refuse a shot that stands one member of a crowd inside another.
 *
 * Two bodies cannot occupy one place. That is a fact about dancers, animals,
 * vehicles and machines alike, and until this gate existed nothing in the
 * pipeline checked it: a unit could be laid out at a tenth of its members' own
 * width, a cue could pull one to a fifth of its spacing, and two units could be
 * staged on the same ground, and every one of those compiled clean and rendered
 * as figures standing through each other.
 *
 * A member's own size is not asked of the author. It is read from the runtime
 * the compiler already built for it by {@link autoMovieModelColumns}, so the
 * measure follows the geometry rather than sitting beside it going stale, and a
 * unit whose runtime this shot does not carry is not measured at all rather
 * than measured against a guess.
 *
 * What is measured is members, at the times {@link formationOverlapSampleTimes}
 * picks and in the places {@link placeFormationSlot} puts them, which is the
 * same answer the renderer places them by. Both units of a pair are placed at
 * one time and compared to each other, which is what the ground gate's
 * per-formation loop structurally cannot see: two crowds each standing
 * perfectly well on the floor, in each other.
 *
 * Sound by construction and incomplete by design, in three stated ways: a
 * column is inscribed in a member and never around it, so a refusal means two
 * bodies really share a place; only the first
 * {@link FORMATION_OVERLAP_MEMBER_LIMIT} slots of an enormous unit are measured;
 * and time is sampled rather than solved. Each of those loses overlaps this
 * gate could have found. None of them can make it refuse a production that was
 * correct, which is the discipline the ground gate beside it is built on and
 * the only one worth having here.
 *
 * A member the shot has taken out is not measured, because nothing can stand
 * inside a body that is not there.
 *
 * @author Samchon
 */
export const validateAutoMovieFormationOverlap = (
  contract: Pick<IAutoMovieShotContract, "id">,
  value: {
    models: readonly IAutoMovieModel[];
    formations: ReadonlyArray<
      IAutoMovieFormationPlacement & {
        lod: ReadonlyArray<{ model: string }>;
      }
    >;
    formationMotions?: readonly IAutoMovieFormationMotion[];
    formationSlotMotions?: readonly IAutoMovieFormationSlotMotion[];
  },
): IAutoMovieDiagnostic[] => {
  const runtimes = new Map(value.models.map((model) => [model.id, model]));
  const units = value.formations.flatMap(
    (formation, index): IFormationOverlapUnit[] => {
      const tiers = formation.lod.map((tier) => {
        const runtime = runtimes.get(tier.model);
        return runtime === undefined ? [] : autoMovieModelColumns(runtime);
      });
      // A unit with a tier this shot does not carry, or one whose geometry fills
      // no column at all, has no size this gate can prove. Measuring it against
      // a stand-in number is how a gate starts refusing productions that were
      // correct, so it is left alone instead.
      return tiers.length === 0 || tiers.some((columns) => columns.length === 0)
        ? []
        : [
            {
              index,
              formation,
              members: formationOverlapMembers(formation),
              tiers,
            },
          ];
    },
  );
  if (units.length === 0) return [];
  const cues = value.formationMotions ?? [];
  const slotCues = value.formationSlotMotions ?? [];
  // One cell wide enough that no pair inside its own clearance can fall outside
  // the ring of cells around either of them. A height difference narrows a
  // clearance and never widens it, so twice the widest column in the shot bounds
  // every clearance there is.
  const cell =
    2 *
    Math.max(
      ...units.flatMap((unit) =>
        unit.tiers.flatMap((columns) => columns.map((column) => column.radius)),
      ),
    );
  const found = new Map<
    string,
    {
      time: number;
      left: IFormationOverlapPlacement;
      right: IFormationOverlapPlacement;
      apart: number;
      clearance: number;
    }
  >();
  for (const time of formationOverlapSampleTimes(cues, slotCues)) {
    const grid = new Map<string, IFormationOverlapPlacement[]>();
    for (const unit of units) {
      const motion = sampleFormationMotion(cues, unit.formation.id, time);
      for (const member of unit.members) {
        // Where the design puts this member NOW: a re-forming unit is moving
        // its own arrangement, so the cached point is where the member stood
        // before the cue began. Members crossing each other mid-re-form is
        // exactly the collision this gate exists to catch.
        const designed =
          motion.reform === null
            ? member.point
            : formationSlotPosition(unit.formation, member.slot, motion.reform);
        const placed = placeFormationSlot({
          position: designed,
          facingDeg: unit.formation.facingDeg,
          anchor: unit.formation.anchor,
          baseFacingDeg: unit.formation.facingDeg,
          unit: motion,
          member: sampleFormationSlotMotion(
            slotCues,
            unit.formation.id,
            member.slot,
            time,
          ),
        });
        if (placed.present === false) continue;
        const here: IFormationOverlapPlacement = {
          unit,
          slot: member.slot,
          point: placed.position,
        };
        const column = Math.floor(placed.position.x / cell);
        const row = Math.floor(placed.position.z / cell);
        for (let across = -1; across <= 1; ++across)
          for (let along = -1; along <= 1; ++along)
            for (const other of grid.get(`${column + across}:${row + along}`) ??
              []) {
              // Ordered by the unit each stands in, and every member already in
              // the grid was placed by a unit no later than this one, so one
              // reading of a pair of units is the whole of what it reports.
              const pair = `${other.unit.index}:${unit.index}`;
              if (found.has(pair)) continue;
              const clearance = formationOverlapClearance(
                other.unit,
                unit,
                here.point.y - other.point.y,
              );
              const apart = Math.hypot(
                here.point.x - other.point.x,
                here.point.z - other.point.z,
              );
              if (apart >= clearance) continue;
              found.set(pair, {
                time,
                left: other,
                right: here,
                apart,
                clearance,
              });
            }
        const key = `${column}:${row}`;
        const neighbours = grid.get(key);
        if (neighbours === undefined) grid.set(key, [here]);
        else neighbours.push(here);
      }
    }
  }
  return [...found.values()].map((overlap) =>
    engineDiagnostic(
      contract.id,
      `formation:${overlap.left.unit.formation.id}`,
      // Reported to the millimetre and the millisecond, the same as every other
      // reading a shot's author reads to find a place on a field. Only the
      // reading is rounded; the comparison above is not.
      `must not stand a member where another body already is, but at ${round(
        overlap.time,
      )}s ${
        overlap.left.unit === overlap.right.unit
          ? `its slots ${overlap.left.slot} and ${overlap.right.slot}`
          : `its slot ${overlap.left.slot} and slot ${overlap.right.slot} of "${overlap.right.unit.formation.id}"`
      } stand ${round(overlap.apart)}m apart at (${round(
        (overlap.left.point.x + overlap.right.point.x) / 2,
      )}, ${round(
        (overlap.left.point.z + overlap.right.point.z) / 2,
      )}), inside the ${round(overlap.clearance)}m their bodies fill`,
    ),
  );
};

/**
 * Validate bounded source-authored formation cues against one compiled shot.
 *
 * @author Samchon
 */
export const validateAutoMovieFormationMotions = (
  contract: IAutoMovieShotContract,
  value: IAutoMovieCompiledShotSource,
): IAutoMovieDiagnostic[] => {
  const diagnostics: IAutoMovieDiagnostic[] = [];
  const fail = (field: string, expectation: string): void => {
    diagnostics.push(engineDiagnostic(contract.id, field, expectation));
  };
  if (value.formationMotions.length > 256)
    fail(
      "formationMotions",
      "must contain at most 256 compact cues rather than per-member curves",
    );
  const ids = new Set<string>();
  const participating = new Set(
    contract.participants.flatMap((participant) =>
      participant.kind === "formation" ? [participant.id] : [],
    ),
  );
  const priorByFormation = new Map<
    string,
    IAutoMovieCompiledShotSource["formationMotions"][number]
  >();
  // What each unit's own tier figures can perform, read through the engine's
  // answer rather than a second one, so a cue this compile accepts is one the
  // viewer's bake accepts too. A unit whose figures declare nothing is a crowd
  // of props and has no repertoire to disagree with, exactly as the bake reads
  // it.
  const runtimeById = new Map(value.models.map((model) => [model.id, model]));
  const repertoire = new Map(
    value.formations.map((formation) => [
      formation.id,
      new Set(
        formation.lod.flatMap((tier) => {
          const model = runtimeById.get(tier.model);
          return model === undefined
            ? []
            : autoMovieModelGaits(model).map((gait) => gait.name);
        }),
      ),
    ]),
  );
  for (const cue of [...value.formationMotions].sort(
    (left, right) =>
      compareCodeUnits(left.formation, right.formation) ||
      left.start - right.start ||
      compareCodeUnits(left.id, right.id),
  )) {
    if (cue.id.trim().length === 0 || ids.has(cue.id))
      fail(
        `formationMotion:${cue.id || "(blank)"}`,
        "must have one non-blank id unique inside the shot",
      );
    ids.add(cue.id);
    if (
      participating.has(cue.formation) === false ||
      value.formations.some((formation) => formation.id === cue.formation) ===
        false
    )
      fail(
        `formationMotion:${cue.id}.formation`,
        `must reference participating compiled formation "${cue.formation}"`,
      );
    // The arrangement a cue re-forms into has to be one this unit can stand
    // in. A lattice narrower than the unit is a member with no place, and a
    // lattice of zero files is a division by zero inside the placement itself
    // -- neither is a picture, and both are the author's to correct here
    // rather than the renderer's to discover.
    const target = cue.layout;
    const unit = value.formations.find(
      (formation) => formation.id === cue.formation,
    );
    if (target !== undefined && unit !== undefined) {
      const lattice =
        target.kind === "line" || target.kind === "column"
          ? { ranks: target.ranks, files: target.files }
          : null;
      if (
        lattice !== null &&
        (Number.isSafeInteger(lattice.ranks) === false ||
          Number.isSafeInteger(lattice.files) === false ||
          lattice.ranks < 1 ||
          lattice.files < 1 ||
          lattice.ranks * lattice.files < unit.count)
      )
        fail(
          `formationMotion:${cue.id}.layout`,
          `must seat all ${unit.count} members in whole ranks and files rather than ${lattice.ranks} x ${lattice.files}`,
        );
    }
    const declared = repertoire.get(cue.formation);
    if (
      cue.gait !== undefined &&
      declared !== undefined &&
      declared.size !== 0 &&
      declared.has(cue.gait) === false
    )
      fail(
        `formationMotion:${cue.id}.gait`,
        `must name one of the gaits this unit's figures declare (${[...declared]
          .sort(compareCodeUnits)
          .join(", ")}) rather than "${cue.gait}"`,
      );
    if (
      Number.isFinite(cue.start) === false ||
      Number.isFinite(cue.end) === false ||
      cue.start < 0 ||
      cue.end <= cue.start ||
      cue.end > contract.durationSeconds
    )
      fail(
        `formationMotion:${cue.id}.time`,
        `must be one positive interval inside 0..${contract.durationSeconds}s`,
      );
    for (const [name, state] of [
      ["from", cue.from],
      ["to", cue.to],
    ] as const) {
      if (
        [state.translation.x, state.translation.y, state.translation.z].some(
          (number) =>
            Number.isFinite(number) === false ||
            Math.abs(number) > 1_000_000_000,
        ) ||
        Number.isFinite(state.facingOffsetDeg) === false ||
        Math.abs(state.facingOffsetDeg) > 360_000
      )
        fail(
          `formationMotion:${cue.id}.${name}`,
          "must keep translation inside +/-1000000000m and facing inside +/-360000 degrees",
        );
      if (
        [state.spacingScale.lateral, state.spacingScale.depth].some(
          (number) =>
            Number.isFinite(number) === false || number < 0.25 || number > 4,
        )
      )
        fail(
          `formationMotion:${cue.id}.${name}.spacingScale`,
          "must stay inside the bounded 0.25..4 envelope",
        );
    }
    const prior = priorByFormation.get(cue.formation);
    if (prior !== undefined && cue.start < prior.end)
      fail(
        `formationMotion:${cue.id}.start`,
        `must not overlap prior cue "${prior.id}" ending at ${prior.end}s`,
      );
    priorByFormation.set(cue.formation, cue);
  }
  return diagnostics;
};

/**
 * Members one shot may single out of its crowds, in total.
 *
 * The channel's whole promise is that a crowd of a hundred thousand does not
 * pay for the three members something happens to, and a promise nothing
 * enforces is a comment. Past this the answer is the other mechanism: a member
 * that needs a shot's full attention is promoted to a named actor, which exists
 * and is capped for the same reason. This is the cheaper thing and must not
 * become that.
 */
const FORMATION_SLOT_EXCEPTION_LIMIT = 1_024;

/**
 * Validate sparse per-member exceptions against one compiled shot.
 *
 * Narrowed to what it reads, like the ground gate beside it: the unit's own
 * count and hero inventory decide which slots exist and which already belong to
 * an actor, and nothing else about a compiled shot bears on the question.
 *
 * @author Samchon
 */
export const validateAutoMovieFormationSlotMotions = (
  contract: Pick<
    IAutoMovieShotContract,
    "id" | "participants" | "durationSeconds"
  >,
  value: {
    formations: readonly Pick<
      IAutoMovieCompiledFormation,
      "id" | "count" | "heroes"
    >[];
    formationSlotMotions: readonly IAutoMovieFormationSlotMotion[];
  },
): IAutoMovieDiagnostic[] => {
  const diagnostics: IAutoMovieDiagnostic[] = [];
  const fail = (field: string, expectation: string): void => {
    diagnostics.push(engineDiagnostic(contract.id, field, expectation));
  };
  const cues = value.formationSlotMotions;
  if (cues.length > 256)
    fail(
      "formationSlotMotions",
      "must contain at most 256 sparse per-member cues",
    );
  const named = cues.reduce((sum, cue) => sum + cue.slots.length, 0);
  if (named > FORMATION_SLOT_EXCEPTION_LIMIT)
    fail(
      "formationSlotMotions",
      `must single out at most ${FORMATION_SLOT_EXCEPTION_LIMIT} members in one shot rather than author a curve per member`,
    );
  const ids = new Set<string>();
  const participating = new Set(
    contract.participants.flatMap((participant) =>
      participant.kind === "formation" ? [participant.id] : [],
    ),
  );
  const compiledById = new Map(
    value.formations.map((formation) => [formation.id, formation]),
  );
  // Keyed by formation and then by slot rather than by formation alone, because
  // two members of one crowd doing different things at the same second is the
  // whole point of the channel. One member doing two things at once is not.
  // Nested rather than joined into one string key, because a formation id is
  // author-chosen text and any separator picked to join them is one an id may
  // legitimately contain.
  const priorBySlot = new Map<
    string,
    Map<number, IAutoMovieFormationSlotMotion>
  >();
  for (const cue of [...cues].sort(
    (left, right) =>
      compareCodeUnits(left.formation, right.formation) ||
      left.start - right.start ||
      compareCodeUnits(left.id, right.id),
  )) {
    if (cue.id.trim().length === 0 || ids.has(cue.id))
      fail(
        `formationSlotMotion:${cue.id || "(blank)"}`,
        "must have one non-blank id unique inside the shot",
      );
    ids.add(cue.id);
    const compiled = compiledById.get(cue.formation);
    if (participating.has(cue.formation) === false || compiled === undefined)
      fail(
        `formationSlotMotion:${cue.id}.formation`,
        `must reference participating compiled formation "${cue.formation}"`,
      );
    if (
      Number.isFinite(cue.start) === false ||
      Number.isFinite(cue.end) === false ||
      cue.start < 0 ||
      cue.end <= cue.start ||
      cue.end > contract.durationSeconds
    )
      fail(
        `formationSlotMotion:${cue.id}.time`,
        `must be one positive interval inside 0..${contract.durationSeconds}s`,
      );
    if (
      cue.slots.length === 0 ||
      new Set(cue.slots).size !== cue.slots.length ||
      cue.slots.some(
        (slot) =>
          Number.isSafeInteger(slot) === false ||
          slot < 0 ||
          (compiled !== undefined && slot >= compiled.count),
      )
    )
      fail(
        `formationSlotMotion:${cue.id}.slots`,
        `must name at least one unique slot inside 0..${(compiled?.count ?? 0) - 1}`,
      );
    // A promoted hero is already an explicit scene node with a full authoring
    // surface of its own. Letting this channel move one too would give a member
    // two owners writing the same transform, and the frame would show whichever
    // wrote last.
    const heroes = (compiled?.heroes ?? []).filter((hero) =>
      cue.slots.includes(hero.slot),
    );
    if (heroes.length !== 0)
      fail(
        `formationSlotMotion:${cue.id}.slots`,
        `must not name slots promoted to named actors (${heroes
          .map((hero) => `${hero.slot} is "${hero.actor}"`)
          .join(", ")}); author those on the actor instead`,
      );
    for (const [name, state] of [
      ["from", cue.from],
      ["to", cue.to],
    ] as const) {
      if (
        [state.offset.x, state.offset.y, state.offset.z].some(
          (number) =>
            Number.isFinite(number) === false ||
            Math.abs(number) > 1_000_000_000,
        ) ||
        Number.isFinite(state.facingOffsetDeg) === false ||
        Math.abs(state.facingOffsetDeg) > 360_000
      )
        fail(
          `formationSlotMotion:${cue.id}.${name}`,
          "must keep offset inside +/-1000000000m and facing inside +/-360000 degrees",
        );
    }
    const priorSlots =
      priorBySlot.get(cue.formation) ??
      new Map<number, IAutoMovieFormationSlotMotion>();
    priorBySlot.set(cue.formation, priorSlots);
    for (const slot of cue.slots) {
      const prior = priorSlots.get(slot);
      // Never against itself. A cue naming one member twice is a malformed
      // slot list, already refused as one above; reading the second mention as
      // an overlap would refuse the same mistake a second time and name the
      // cue as its own prior, which is not a sentence an author can act on.
      if (prior !== undefined && prior !== cue && cue.start < prior.end)
        fail(
          `formationSlotMotion:${cue.id}.start`,
          `must not overlap prior cue "${prior.id}" on slot ${slot} ending at ${prior.end}s`,
        );
      priorSlots.set(slot, cue);
    }
  }
  return diagnostics;
};

/**
 * Validate shot-local effect cues against compiler-owned streams and events.
 *
 * @author Samchon
 */
export const validateAutoMovieEffects = (
  contract: IAutoMovieShotContract,
  value: IAutoMovieCompiledShotSource,
): IAutoMovieDiagnostic[] => {
  const diagnostics: IAutoMovieDiagnostic[] = [];
  const fail = (field: string, expectation: string): void => {
    diagnostics.push(engineDiagnostic(contract.id, field, expectation));
  };
  const cues = value.effectCues ?? [];
  if (cues.length > 128)
    fail("effectCues", "must contain at most 128 bounded zone activations");
  const ids = new Set<string>();
  const priorByZone = new Map<string, (typeof cues)[number]>();
  const events = new Map(contract.events.map((event) => [event.id, event]));
  const samples = new Map(
    value.eventSamples.map((sample) => [sample.id, sample.time]),
  );
  for (const cue of [...cues].sort(
    (left, right) =>
      compareCodeUnits(left.zone, right.zone) ||
      left.start - right.start ||
      compareCodeUnits(left.id, right.id),
  )) {
    const field = `effectCue:${cue.id || "(blank)"}`;
    if (cue.id.trim().length === 0 || ids.has(cue.id))
      fail(field, "must have one non-blank id unique inside the shot");
    ids.add(cue.id);
    const compiled = value.effects.find((effect) => effect.id === cue.id);
    if (compiled === undefined || compiled.zone !== cue.zone)
      fail(
        `${field}.zone`,
        `must reference one current compiler-materialized world zone "${cue.zone}"`,
      );
    if (
      Number.isFinite(cue.start) === false ||
      Number.isFinite(cue.end) === false ||
      cue.start < 0 ||
      cue.end <= cue.start ||
      cue.end > contract.durationSeconds
    )
      fail(
        `${field}.time`,
        `must be one positive interval inside 0..${contract.durationSeconds}s`,
      );
    if (
      [cue.intensity.from, cue.intensity.to].some(
        (intensity) =>
          Number.isFinite(intensity) === false ||
          intensity < 0 ||
          intensity > 1,
      )
    )
      fail(`${field}.intensity`, "must stay inside the bounded 0..1 envelope");
    if (cue.event !== undefined) {
      const event = events.get(cue.event);
      const sample = samples.get(cue.event);
      if (
        event === undefined ||
        sample === undefined ||
        sample < cue.start ||
        sample >= cue.end
      )
        fail(
          `${field}.event`,
          `must name one compiled event realized inside [${cue.start}, ${cue.end})`,
        );
    }
    const prior = priorByZone.get(cue.zone);
    if (prior !== undefined && cue.start < prior.end)
      fail(
        `${field}.start`,
        `must not overlap prior zone cue "${prior.id}" ending at ${prior.end}s`,
      );
    priorByZone.set(cue.zone, cue);
  }
  if (
    value.effects.length !== cues.length ||
    value.effects.some((effect) => ids.has(effect.id) === false)
  )
    fail(
      "effects",
      "must contain exactly one compiler-owned stream for every source cue",
    );
  return diagnostics;
};

const appendValidation = (
  diagnostics: IAutoMovieDiagnostic[],
  id: string,
  validation: ReturnType<typeof validateModel>,
): void => {
  if (validation.success === false)
    for (const violation of validation.violations)
      diagnostics.push({
        code: "engine-validation-failed",
        category: "error",
        phase: "compile",
        target: `shot:${id}`,
        path: null,
        message: `${violation.path}: ${violation.expected}. Correct the owning shot source before running the compiler.`,
      });
};

const engineDiagnostic = (
  id: string,
  field: string,
  expectation: string,
): IAutoMovieDiagnostic => ({
  code: "engine-validation-failed",
  category: "error",
  phase: "compile",
  target: `shot:${id}`,
  path: null,
  message: `${field} ${expectation}. Correct the owning shot source before running the compiler.`,
});

const missingDesignDiagnostics = (
  project: AutoMovieProductionProject,
  graph: ReturnType<AutoMovieProductionProject["graph"]>,
): IAutoMovieDiagnostic[] => {
  const productionSegment = encodeAutoMoviePathSegment(project.productionId);
  const diagnostics: IAutoMovieDiagnostic[] = [];
  if (graph.production === null)
    diagnostics.push({
      code: "design-missing",
      category: "error",
      phase: "design",
      target: "production",
      path: `automovie/design/${productionSegment}/production.json`,
      message:
        "Production design is missing. Create the tracked production design record.",
    });
  if (graph.world === null)
    diagnostics.push({
      code: "design-missing",
      category: "error",
      phase: "design",
      target: "world",
      path: "automovie/design/shared/world.json",
      message:
        "World design is missing. Create the tracked world design record.",
    });
  if (graph.shots.size === 0)
    diagnostics.push({
      code: "design-missing",
      category: "error",
      phase: "design",
      target: "shots",
      path: `automovie/design/${productionSegment}/shots`,
      message:
        "No shot contract exists. Create the first tracked shot contract record.",
    });
  return diagnostics;
};

const sourcePathDiagnostic = (
  id: string,
  sourcePath: string,
  error: unknown,
): IAutoMovieDiagnostic => {
  const message = errorMessage(error);
  return {
    code:
      error instanceof AutoMovieProductionSourcePathError &&
      error.reason === "outside-root"
        ? "source-path-outside-root"
        : "source-path-missing",
    category: "error",
    phase: "source",
    target: `shot:${id}`,
    path: sourcePath,
    message,
  };
};

const filmSourcePathDiagnostic = (error: unknown): IAutoMovieDiagnostic => ({
  code:
    error instanceof AutoMovieProductionSourcePathError &&
    error.reason === "outside-root"
      ? "source-path-outside-root"
      : "source-path-missing",
  category: "error",
  phase: "source",
  target: "film",
  path: FILM_SOURCE_PATH,
  message: `${errorMessage(error)} Export "${FILM_SOURCE_EXPORT}" with build(context) from ${FILM_SOURCE_PATH}.`,
});

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const isTypeScriptSourcePath = (file: string): boolean =>
  [".ts", ".tsx", ".mts", ".cts"].includes(path.extname(file).toLowerCase());

const compilerAssetInventory = (
  manifestPath: IAutoMovieProductionManifest["assetManifest"],
  inputs: readonly IAutoMovieProductionContentInput[],
  productionId: string,
  graph: IAutoMovieProductionDesignGraph,
  archetypes: AutoMovieModelArchetypeRegistry,
): {
  assets: string[];
  records: IAutoMovieAssetProvenance[];
  externalModels: Map<string, IAutoMovieExternalModelRuntimeBinding>;
  externalMotions: Map<string, ICompilerExternalMotionAdoption>;
  diagnostics: IAutoMovieDiagnostic[];
} => {
  if (manifestPath === undefined)
    return {
      assets: [],
      records: [],
      externalModels: new Map(),
      externalMotions: new Map(),
      diagnostics: [],
    };
  const diagnostics: IAutoMovieDiagnostic[] = [];
  const diagnostic = (
    code: AutoMovieDiagnosticCode,
    target: string,
    message: string,
  ): void => {
    diagnostics.push({
      code,
      category: "error",
      phase: "project",
      target,
      path: manifestPath,
      message,
    });
  };
  /**
   * Report something the compiler cannot restate without refusing the asset.
   *
   * Compilation succeeds when no diagnostic is an `error`, so this states a
   * fact the author should know while leaving the decision with them. Refusing
   * a licensed model because it carries a material lobe this engine has no
   * field for would be the compiler deciding what art a production may buy.
   */
  const warning = (
    code: AutoMovieDiagnosticCode,
    target: string,
    message: string,
  ): void => {
    diagnostics.push({
      code,
      category: "warning",
      phase: "project",
      target,
      path: manifestPath,
      message,
    });
  };
  const manifestInput = inputs.find((entry) => entry.path === manifestPath);
  if (manifestInput?.bytes === null || manifestInput === undefined) {
    diagnostic(
      "asset-manifest-missing",
      "asset-manifest",
      `Production manifest declares "${manifestPath}", but that physical provenance ledger is absent. Restore it before compiling asset references.`,
    );
    return {
      assets: [],
      records: [],
      externalModels: new Map(),
      externalMotions: new Map(),
      diagnostics,
    };
  }

  let decoded: unknown;
  try {
    decoded = JSON.parse(Buffer.from(manifestInput.bytes).toString("utf8"));
  } catch (error) {
    diagnostic(
      "asset-manifest-invalid",
      "asset-manifest",
      `Asset manifest is not valid JSON: ${errorMessage(error)}. Restore one IAutoMovieAssetManifest before compiling.`,
    );
    return {
      assets: [],
      records: [],
      externalModels: new Map(),
      externalMotions: new Map(),
      diagnostics,
    };
  }
  const validation = typia.validateEquals<IAutoMovieAssetManifest>(decoded);
  if (validation.success === false) {
    diagnostic(
      "asset-manifest-invalid",
      "asset-manifest",
      `Asset manifest does not satisfy IAutoMovieAssetManifest: ${validation.errors
        .map((error) => `${error.path}: ${error.expected}`)
        .join("; ")}. Correct the typed provenance ledger before compiling.`,
    );
    return {
      assets: [],
      records: [],
      externalModels: new Map(),
      externalMotions: new Map(),
      diagnostics,
    };
  }

  const content = new Map(inputs.map((entry) => [entry.path, entry]));
  const paths = new Map<string, string>();
  const assets = validation.data.assets
    .filter((asset) =>
      asset.uses.some((use) => use.production === productionId),
    )
    .map((asset) => asset.path);
  const orderedPaths = validation.data.assets.map((asset) => asset.path);
  if (
    orderedPaths.some(
      (asset, index) =>
        index !== 0 && compareCodeUnits(orderedPaths[index - 1]!, asset) >= 0,
    )
  )
    diagnostic(
      "asset-manifest-order",
      "asset-manifest",
      "Asset entries must be in unique canonical path order. Sort them by code unit and remove duplicates before compiling.",
    );
  const activeConsumerAssets = new Map<string, string>();
  const consumedModelResources = new Set<string>();
  const consumedMotionResources = new Set<string>();
  const motionInspections = new Map<
    string,
    ReturnType<typeof inspectAutoMovieExternalModelBytes>
  >();
  const motionClosures = new Map<
    string,
    IAutoMovieExternalMotionConversionReceipt["source"]["closure"]
  >();
  const externalByAsset = new Map<
    string,
    Omit<IAutoMovieExternalModelRuntimeBinding, "asset" | "lod">
  >();
  for (const asset of validation.data.assets) {
    if (asset.motion === undefined) continue;
    const resident = content.get(asset.path);
    if (
      resident?.bytes === null ||
      resident === undefined ||
      asset.digest !== digestAutoMovieBytes(resident.bytes)
    )
      continue;
    const diagnosticCount = diagnostics.length;
    const closure = new Map<string, AutoMovieContentDigest>();
    try {
      const inspection = inspectAutoMovieExternalModelBytes({
        path: asset.path,
        bytes: resident.bytes,
        profile: asset.motion.ingestProfile,
        resolveResource: (uri) => {
          const resource = externalModelResourcePath(asset.path, uri);
          const resourceRecord = validation.data.assets.find(
            (candidate) => candidate.path === resource,
          );
          const resourceInput = content.get(resource);
          if (
            resourceRecord === undefined ||
            resourceInput?.bytes === null ||
            resourceInput === undefined ||
            resourceRecord.digest !== digestAutoMovieBytes(resourceInput.bytes)
          ) {
            diagnostic(
              "asset-motion-provenance-missing",
              asset.path,
              `External motion "${asset.path}" references sidecar "${uri}", but resolved project asset "${resource}" is absent or byte-stale in the manifest.`,
            );
            return null;
          }
          if (
            hasActiveAssetUse(
              resourceRecord,
              productionId,
              "motion-resource",
              asset.path,
            ) === false
          )
            diagnostic(
              "asset-motion-provenance-missing",
              asset.path,
              `External motion sidecar "${resource}" is not authorized as a motion-resource of "${asset.path}" in production "${productionId}".`,
            );
          else {
            consumedMotionResources.add(`${asset.path}\0${resource}`);
            closure.set(resource, resourceRecord.digest);
          }
          return resourceInput.bytes;
        },
      });
      if (
        inspection.motion === undefined ||
        motionTakeInventoryMatches(
          asset.motion.takes,
          inspection.motion.takes,
        ) === false ||
        Buffer.from(canonicalAutoMovieJsonBytes(asset.motion.basis)).equals(
          Buffer.from(
            canonicalAutoMovieJsonBytes(
              externalMotionBasisOf(inspection.motion),
            ),
          ),
        ) === false
      )
        diagnostic(
          "asset-motion-provenance-missing",
          asset.path,
          `External motion "${asset.path}" inspected take inventory or byte-grounded hierarchy/rest basis does not match its manifest provenance. Re-inspect the current digest and preserve every take identity, node, parent, and local rest transform.`,
        );
      if (diagnostics.length === diagnosticCount) {
        motionInspections.set(asset.path, inspection);
        motionClosures.set(
          asset.path,
          [...closure]
            .map(([path, digest]) => ({ path, digest }))
            .sort((left, right) => compareCodeUnits(left.path, right.path)),
        );
      }
    } catch (error) {
      diagnostic(
        "asset-motion-ingest-invalid",
        asset.path,
        `External motion "${asset.path}" cannot be inspected with profile "${asset.motion.ingestProfile}": ${errorMessage(error)} Restore valid fixed bytes or correct the declared profile.`,
      );
    }
  }
  for (const asset of validation.data.assets) {
    const folded = asset.path.toLowerCase();
    const prior = paths.get(folded);
    if (
      isCanonicalAssetPath(asset.path) === false ||
      (prior !== undefined && prior !== asset.path)
    )
      diagnostic(
        "asset-path-invalid",
        asset.path,
        `Asset path "${asset.path}" is not one canonical, portable project-relative identity. Keep one spelling inside declared content roots.`,
      );
    paths.set(folded, asset.path);
    const input = content.get(asset.path);
    if (input?.bytes === null || input === undefined || input.render === false)
      diagnostic(
        "asset-bytes-missing",
        asset.path,
        `Manifest asset "${asset.path}" is not a physical file inside contentRoots/contentFiles. Restore and declare the exact bytes before compiling.`,
      );
    else if (asset.digest !== digestAutoMovieBytes(input.bytes))
      diagnostic(
        "asset-digest-mismatch",
        asset.path,
        `Manifest digest ${asset.digest} does not match current bytes ${digestAutoMovieBytes(input.bytes)}. Restore the licensed bytes or update provenance from the verified source.`,
      );
    if (
      isSha256Digest(asset.digest) === false ||
      assetAcquisitionIncomplete(asset) ||
      asset.license.identifier.trim().length === 0 ||
      isHttpUrl(asset.license.url) === false ||
      asset.uses.length === 0 ||
      asset.uses.some(assetUseIncomplete) ||
      asset.processing.some(assetProcessingStepIncomplete)
    )
      diagnostic(
        "asset-provenance-incomplete",
        asset.path,
        `Asset "${asset.path}" lacks a complete acquisition (exactly one of a fetched "original" with a real source URL and SHA-256, or a "generated" provider/model/prompt/output ledger), current SHA-256, license, processing identity, or reasoned use. Complete the distribution ledger before compiling.`,
      );
    if (assetProcessingOmitted(asset))
      diagnostic(
        "asset-processing-missing",
        asset.path,
        `Asset "${asset.path}" differs from the digest it was acquired or generated at but records no processing steps. Record the reproducible transformation chain before compiling.`,
      );
    if (
      asset.model !== undefined &&
      (asset.model.ingestProfile.trim().length === 0 ||
        asset.model.lod.length === 0)
    )
      diagnostic(
        "asset-model-provenance-missing",
        asset.path,
        `External model "${asset.path}" must declare its ingest profile, explicit LOD ledger, collision proxy and measurement proxy before compiling.`,
      );
    else if (
      isExternalModelAsset(asset.path) &&
      asset.model === undefined &&
      asset.motion === undefined
    )
      diagnostic(
        "asset-model-provenance-missing",
        asset.path,
        `External glTF-family asset "${asset.path}" must declare either model ingest/LOD/proxy provenance or motion ingest/take provenance before compiling.`,
      );
  }
  for (const asset of validation.data.assets) {
    const activeUses = asset.uses.filter(
      (use) => use.production === productionId,
    );
    const seenUses = new Set<string>();
    for (const use of activeUses) {
      const key = `${use.consumer.kind}\0${use.consumer.id}`;
      const priorAsset = activeConsumerAssets.get(key);
      const exclusive =
        use.consumer.kind !== "model-resource" &&
        use.consumer.kind !== "model-proxy" &&
        use.consumer.kind !== "motion-resource";
      if (seenUses.has(key) || (exclusive && priorAsset !== undefined))
        diagnostic(
          "asset-use-duplicate",
          asset.path,
          `Asset "${asset.path}" repeats active consumer ${use.consumer.kind} "${use.consumer.id}"${priorAsset === undefined ? "" : ` already owned by "${priorAsset}"`}. Keep one reasoned use per production consumer.`,
        );
      seenUses.add(key);
      if (exclusive) activeConsumerAssets.set(key, asset.path);
      if (
        assetConsumerExists(
          graph,
          validation.data.assets,
          asset.path,
          use.consumer,
        ) === false
      )
        diagnostic(
          "asset-use-dangling",
          asset.path,
          `Asset "${asset.path}" cites missing ${use.consumer.kind} "${use.consumer.id}" in production "${productionId}". Correct the typed consumer or remove the stale use.`,
        );
    }
    if (asset.model === undefined) continue;
    const diagnosticCount = diagnostics.length;
    let priorLevel = -1;
    const levels = new Set<string>();
    for (const lod of asset.model.lod) {
      const order = ["hero", "near", "far"].indexOf(lod.level);
      const target = paths.get(lod.asset.toLowerCase());
      if (
        levels.has(lod.level) ||
        order <= priorLevel ||
        target === undefined ||
        isExternalModelAsset(target) === false
      )
        diagnostic(
          "asset-model-lod-dangling",
          asset.path,
          `Model asset "${asset.path}" has duplicate/out-of-order LOD "${lod.level}" or points to non-model manifest asset "${lod.asset}". Keep unique hero/near/far levels in order and ground each in model bytes.`,
        );
      if (
        lod.level !== "hero" &&
        (target === undefined ||
          hasActiveAssetUse(
            validation.data.assets.find(
              (candidate) => candidate.path === target,
            ),
            productionId,
            "model-resource",
            asset.path,
          ) === false)
      )
        diagnostic(
          "asset-model-resource-unbound",
          asset.path,
          `LOD "${lod.level}" asset "${lod.asset}" is not authorized as a model-resource of "${asset.path}" in production "${productionId}".`,
        );
      else if (lod.level !== "hero" && target !== undefined)
        consumedModelResources.add(`${asset.path}\0${target}`);
      levels.add(lod.level);
      priorLevel = Math.max(priorLevel, order);
    }
    if (
      asset.model.lod[0]?.level !== "hero" ||
      asset.model.lod[0]?.asset !== asset.path
    )
      diagnostic(
        "asset-model-lod-dangling",
        asset.path,
        `Model asset "${asset.path}" must bind its own exact bytes as the first hero LOD. Keep optional near/far members after that owned hero identity.`,
      );
    const resident = content.get(asset.path);
    let ingested = false;
    let inspection:
      | ReturnType<typeof inspectAutoMovieExternalModelBytes>
      | undefined;
    const closure = new Map<string, AutoMovieContentDigest>();
    closure.set(asset.path, asset.digest);
    if (resident?.bytes !== null && resident !== undefined)
      try {
        inspection = inspectAutoMovieExternalModelBytes({
          path: asset.path,
          bytes: resident.bytes,
          profile: asset.model.ingestProfile,
          resolveResource: (uri) => {
            const resource = externalModelResourcePath(asset.path, uri);
            const resourceRecord = validation.data.assets.find(
              (candidate) => candidate.path === resource,
            );
            const resourceInput = content.get(resource);
            if (
              resourceRecord === undefined ||
              resourceInput?.bytes === null ||
              resourceInput === undefined ||
              resourceRecord.digest !==
                digestAutoMovieBytes(resourceInput.bytes)
            ) {
              diagnostic(
                "asset-model-resource-unbound",
                asset.path,
                `External model "${asset.path}" references sidecar "${uri}", but resolved project asset "${resource}" is absent or byte-stale in the manifest.`,
              );
              return null;
            }
            if (
              hasActiveAssetUse(
                resourceRecord,
                productionId,
                "model-resource",
                asset.path,
              ) === false
            )
              diagnostic(
                "asset-model-resource-unbound",
                asset.path,
                `External model sidecar "${resource}" is not authorized as a model-resource of "${asset.path}" in production "${productionId}".`,
              );
            else consumedModelResources.add(`${asset.path}\0${resource}`);
            closure.set(resource, resourceRecord.digest);
            return resourceInput.bytes;
          },
        });
        ingested = diagnostics.length === diagnosticCount;
      } catch (error) {
        diagnostic(
          "asset-model-ingest-invalid",
          asset.path,
          `External model "${asset.path}" cannot be ingested with profile "${asset.model.ingestProfile}": ${errorMessage(error)} Restore valid fixed bytes or select the correct supported profile.`,
        );
      }
    // After `ingested` is decided, because this is a report rather than a
    // refusal and must not turn a sound ingest into a failed one.
    if (inspection !== undefined) {
      const unsupported = unsupportedAutoMovieMaterialExtensions(
        inspection.extensions,
      );
      if (unsupported.length !== 0)
        warning(
          "asset-model-material-unsupported",
          asset.path,
          `External model "${asset.path}" declares material extensions automovie cannot restate: ${unsupported.join(", ")}. Its appearance will not match a generated material, and no validator in this repository has an opinion about it.`,
        );
    }
    const collision = resolveExternalCollisionProxy({
      owner: asset.path,
      reference: asset.model.collisionProxy,
      records: validation.data.assets,
      content,
      productionId,
      diagnostic,
    });
    const measurement = resolveExternalMeasurementProxy({
      owner: asset.path,
      reference: asset.model.measurementProxy,
      records: validation.data.assets,
      content,
      productionId,
      diagnostic,
    });
    for (const reference of [
      asset.model.collisionProxy,
      asset.model.measurementProxy,
    ])
      if (reference.kind === "asset") {
        const proxyRecord = validation.data.assets.find(
          (candidate) => candidate.path === reference.asset,
        );
        if (proxyRecord !== undefined)
          closure.set(proxyRecord.path, proxyRecord.digest);
      }
    if (
      ingested &&
      resident?.bytes !== null &&
      resident !== undefined &&
      asset.digest === digestAutoMovieBytes(resident.bytes) &&
      isCanonicalAssetPath(asset.path) &&
      diagnostics.length === diagnosticCount &&
      collision !== null &&
      measurement !== null &&
      inspection !== undefined &&
      inspection.profile !== "gltf-motion-v1"
    )
      externalByAsset.set(asset.path, {
        profile: inspection.profile,
        humanoidBones: inspection.humanoidBones,
        assets: [...closure]
          .map(([path, digest]) => ({ path, digest }))
          .sort((left, right) => compareCodeUnits(left.path, right.path)),
        collision,
        measurement,
      });
  }
  for (const resource of validation.data.assets)
    for (const use of resource.uses)
      if (
        use.production === productionId &&
        use.consumer.kind === "model-resource" &&
        consumedModelResources.has(`${use.consumer.id}\0${resource.path}`) ===
          false
      )
        diagnostic(
          "asset-use-dangling",
          resource.path,
          `Asset "${resource.path}" is authorized as a model-resource of "${use.consumer.id}" but is not an actual LOD, buffer, or image dependency of that model.`,
        );
      else if (
        use.production === productionId &&
        use.consumer.kind === "motion-resource" &&
        consumedMotionResources.has(`${use.consumer.id}\0${resource.path}`) ===
          false
      )
        diagnostic(
          "asset-use-dangling",
          resource.path,
          `Asset "${resource.path}" is authorized as a motion-resource of "${use.consumer.id}" but is not an actual buffer or image dependency of that motion source.`,
        );
  const externalModels = new Map<
    string,
    IAutoMovieExternalModelRuntimeBinding
  >();
  for (const [id, model] of graph.models) {
    if (model.asset === undefined) continue;
    const record = validation.data.assets.find(
      (asset) => asset.path === model.asset,
    );
    if (
      isExternalModelAsset(model.asset) === false ||
      record === undefined ||
      record.model === undefined ||
      record.uses.some(
        (use) =>
          use.production === productionId &&
          use.consumer.kind === "model-recipe" &&
          use.consumer.id === id,
      ) === false
    )
      diagnostic(
        "asset-use-missing",
        model.asset,
        `Model recipe "${id}" consumes "${model.asset}" without external-model provenance and one matching typed use for production "${productionId}". Register the exact model bytes, model decisions and model-recipe use.`,
      );
    const external = externalByAsset.get(model.asset);
    if (
      record !== undefined &&
      record.model !== undefined &&
      external !== undefined
    ) {
      const levels = record.model.lod.flatMap((lod) => {
        const levelRecord = validation.data.assets.find(
          (candidate) => candidate.path === lod.asset,
        );
        const level = externalByAsset.get(lod.asset);
        return levelRecord === undefined || level === undefined
          ? []
          : [
              {
                level: lod.level,
                asset: lod.asset,
                digest: levelRecord.digest,
                profile: level.profile,
                humanoidBones: level.humanoidBones,
              },
            ];
      });
      const recipeBones = requiredRecipeBones(model, archetypes);
      const generatedHasSkeleton = recipeBones.length !== 0;
      const levelProfiles = new Set(levels.map((level) => level.profile));
      if (
        levels.length !== record.model.lod.length ||
        levelProfiles.size !== 1 ||
        levelProfiles.has(external.profile) === false
      )
        diagnostic(
          "asset-model-lod-incompatible",
          model.asset,
          `Model recipe "${id}" requires every declared LOD to pass the same fixed ingest profile as its hero asset.`,
        );
      else if ((external.profile === "gltf-static-v1") === generatedHasSkeleton)
        diagnostic(
          "asset-model-rig-incompatible",
          model.asset,
          `Model recipe "${id}" and ingest profile "${external.profile}" disagree on whether the runtime is articulated. Bind static assets only to skeleton-free recipes and humanoid assets only to articulated recipes.`,
        );
      else if (
        generatedHasSkeleton &&
        levels.some((level) =>
          recipeBones.some(
            (bone) =>
              level.humanoidBones.some(
                (mapping) => mapping.bone === bone && mapping.weighted,
              ) === false,
          ),
        )
      )
        diagnostic(
          "asset-model-rig-incompatible",
          model.asset,
          `Model recipe "${id}" requires normalized, visibly weighted skeleton bones that at least one ingested LOD does not prove.`,
        );
      else {
        const assets = new Map(
          levels.flatMap((level) =>
            externalByAsset
              .get(level.asset)!
              .assets.map((entry) => [entry.path, entry.digest] as const),
          ),
        );
        externalModels.set(id, {
          asset: model.asset,
          ...external,
          lod: levels,
          assets: [...assets]
            .map(([path, digest]) => ({ path, digest }))
            .sort((left, right) => compareCodeUnits(left.path, right.path)),
        });
      }
    }
  }
  const externalMotions = new Map<string, ICompilerExternalMotionAdoption>();
  const externalMotionClips = new Map<string, string>();
  for (const declaration of graph.production?.externalMotions ?? []) {
    const priorClip = externalMotionClips.get(declaration.clip);
    if (
      externalMotions.has(declaration.id) ||
      declaration.id.trim().length === 0 ||
      declaration.clip.trim().length === 0 ||
      priorClip !== undefined
    ) {
      diagnostic(
        "source-motion-adoption-invalid",
        declaration.id || "external-motion-adoption",
        priorClip === undefined
          ? `External motion adoption and clip ids must be non-blank and unique, but received adoption "${declaration.id}" and clip "${declaration.clip}".`
          : `External motion adoption "${declaration.id}" repeats clip "${declaration.clip}" already owned by "${priorClip}". Keep one adoption per clip identity.`,
      );
      continue;
    }
    externalMotionClips.set(declaration.clip, declaration.id);
    const record = validation.data.assets.find(
      (asset) => asset.path === declaration.asset,
    );
    const input = content.get(declaration.asset);
    const inspection = motionInspections.get(declaration.asset);
    if (
      record?.motion === undefined ||
      input?.bytes === null ||
      input === undefined ||
      inspection === undefined ||
      record.uses.some(
        (use) =>
          use.production === productionId &&
          use.consumer.kind === "motion-adoption" &&
          use.consumer.id === declaration.id,
      ) === false
    ) {
      diagnostic(
        "asset-motion-provenance-missing",
        declaration.id,
        `External motion adoption "${declaration.id}" requires current motion provenance, resident digest-matched bytes, a successful inspection, and one matching motion-adoption use on asset "${declaration.asset}".`,
      );
      continue;
    }
    try {
      if (inspection.motion === undefined)
        throw new Error("External motion inspection has no motion basis.");
      const receipt = adoptAutoMovieExternalMotion({
        inspection,
        source: {
          path: declaration.asset,
          digest: record.digest,
          byteLength: input.bytes.byteLength,
        },
        decision:
          declaration.mode.kind === "native"
            ? {
                mode: "native",
                take: declaration.take,
                sourceRig: declaration.sourceRig,
                mapping: declaration.mapping.map((entry) => ({
                  node: entry.source,
                  bone: entry.target,
                })),
              }
            : {
                mode: "retarget",
                take: declaration.take,
                sourceRig: declaration.sourceRig,
                mapping: declaration.mapping.map((entry) => ({
                  node: entry.source,
                  bone: entry.target,
                })),
                target: declaration.actor,
                translationScale: declaration.mode.translationScale,
              },
      });
      const sourceMotion = importedNodeClipToAutoMovieMotion({
        clip: receipt.take,
        sourceSkeleton: receipt.handoff.sourceRig,
        mapping: receipt.handoff.mapping,
        motionId: declaration.clip,
      });
      const sourceTake = record.motion.takes.find(
        (take) => take.id === declaration.take,
      );
      const sourceClosure = motionClosures.get(declaration.asset);
      if (sourceTake === undefined || sourceClosure === undefined)
        throw new Error(
          `External motion take "${declaration.take}" or its inspected source closure is absent from manifest provenance.`,
        );
      externalMotions.set(declaration.id, {
        declaration,
        receipt,
        sourceClosure,
        sourceBasis: externalMotionBasisOf(inspection.motion),
        sourceTake: { ...sourceTake },
        sourceMotion,
      });
    } catch (error) {
      diagnostic(
        "source-motion-adoption-invalid",
        declaration.id,
        `External motion adoption "${declaration.id}" is invalid: ${errorMessage(error)} Correct the selected take, source rig, mapping, or mode; the compiler will not infer a replacement.`,
      );
    }
  }
  refuseUnsupportedExternalInstancing(graph, externalModels, diagnostic);
  return {
    assets,
    records: validation.data.assets,
    externalModels,
    externalMotions,
    diagnostics,
  };
};

const resolveExternalCollisionProxy = (props: {
  owner: string;
  reference: NonNullable<IAutoMovieAssetProvenance["model"]>["collisionProxy"];
  records: readonly IAutoMovieAssetProvenance[];
  content: ReadonlyMap<string, IAutoMovieProductionContentInput>;
  productionId: string;
  diagnostic: (
    code: AutoMovieDiagnosticCode,
    target: string,
    message: string,
  ) => void;
}): IAutoMovieGeneratedCollisionProxy | null => {
  const proxy =
    props.reference.kind === "generated"
      ? props.reference
      : readExternalProxyAsset(
          {
            owner: props.owner,
            reference: props.reference,
            records: props.records,
            content: props.content,
            productionId: props.productionId,
          },
          "collision",
        );
  if (
    proxy === null ||
    (proxy.recipe === "capsule-v1"
      ? positiveFiniteValues(proxy.parameters, ["radius", "height"]) === false
      : positiveFiniteValues(proxy.parameters, ["width", "height", "depth"]) ===
        false)
  ) {
    props.diagnostic(
      "asset-model-proxy-dangling",
      props.owner,
      `Model asset "${props.owner}" has no byte-grounded collision proxy with the exact positive parameters required by capsule-v1 or box-v1. Correct the explicit proxy decision; mesh inference is not a fallback.`,
    );
    return null;
  }
  return proxy;
};

const resolveExternalMeasurementProxy = (props: {
  owner: string;
  reference: NonNullable<
    IAutoMovieAssetProvenance["model"]
  >["measurementProxy"];
  records: readonly IAutoMovieAssetProvenance[];
  content: ReadonlyMap<string, IAutoMovieProductionContentInput>;
  productionId: string;
  diagnostic: (
    code: AutoMovieDiagnosticCode,
    target: string,
    message: string,
  ) => void;
}): IAutoMovieGeneratedMeasurementProxy | null => {
  const proxy =
    props.reference.kind === "generated"
      ? props.reference
      : readExternalProxyAsset(
          {
            owner: props.owner,
            reference: props.reference,
            records: props.records,
            content: props.content,
            productionId: props.productionId,
          },
          "measurement",
        );
  if (
    proxy === null ||
    (proxy.recipe === "box-v1"
      ? positiveFiniteValues(proxy.parameters, ["width", "height", "depth"]) ===
        false
      : positiveFiniteValues(proxy.parameters, [
          "height",
          "shoulderWidth",
          "hipWidth",
        ]) === false)
  ) {
    props.diagnostic(
      "asset-model-proxy-dangling",
      props.owner,
      `Model asset "${props.owner}" has no byte-grounded measurement proxy with the exact positive parameters required by box-v1 or humanoid-landmarks-v1. Correct the explicit proxy decision; mesh inference is not a fallback.`,
    );
    return null;
  }
  return proxy;
};

const readExternalProxyAsset = <Kind extends "collision" | "measurement">(
  props: {
    owner: string;
    reference: { kind: "asset"; asset: string };
    records: readonly IAutoMovieAssetProvenance[];
    content: ReadonlyMap<string, IAutoMovieProductionContentInput>;
    productionId: string;
  },
  kind: Kind,
): NonNullable<IAutoMovieModelProxyAsset[Kind]> | null => {
  const record = props.records.find(
    (candidate) => candidate.path === props.reference.asset,
  );
  const input = props.content.get(props.reference.asset);
  if (
    path.posix.extname(props.reference.asset).toLowerCase() !== ".json" ||
    record === undefined ||
    input?.bytes === null ||
    input === undefined ||
    record.digest !== digestAutoMovieBytes(input.bytes) ||
    hasActiveAssetUse(
      record,
      props.productionId,
      "model-proxy",
      props.owner,
    ) === false
  )
    return null;
  try {
    const validation = typia.validateEquals<IAutoMovieModelProxyAsset>(
      JSON.parse(Buffer.from(input.bytes).toString("utf8")),
    );
    if (validation.success === false) return null;
    const selected = validation.data[kind];
    return selected === undefined
      ? null
      : (selected as NonNullable<IAutoMovieModelProxyAsset[Kind]>);
  } catch {
    return null;
  }
};

const positiveFiniteValues = (
  values: Record<string, number>,
  keys: readonly string[],
): boolean =>
  Object.keys(values).length === keys.length &&
  keys.every(
    (key) =>
      Object.prototype.hasOwnProperty.call(values, key) &&
      Number.isFinite(values[key]) &&
      values[key]! > 0,
  );

const externalModelResourcePath = (modelPath: string, uri: string): string => {
  if (
    uri.includes("?") ||
    uri.includes("#") ||
    /^[A-Za-z][A-Za-z0-9+.-]*:/u.test(uri) ||
    uri.startsWith("//")
  )
    throw new Error(
      `Sidecar URI "${uri}" must be a plain project-relative asset path.`,
    );
  let decoded: string;
  try {
    decoded = decodeURIComponent(uri);
  } catch {
    throw new Error(`Sidecar URI "${uri}" is not valid percent-encoding.`);
  }
  if (
    decoded.startsWith("/") ||
    decoded.includes("\\") ||
    decoded.includes("?") ||
    decoded.includes("#") ||
    /^[A-Za-z][A-Za-z0-9+.-]*:/u.test(decoded)
  )
    throw new Error(
      `Sidecar URI "${uri}" must decode to one plain relative asset path.`,
    );
  const resolved = path.posix.join(path.posix.dirname(modelPath), decoded);
  if (isCanonicalAssetPath(resolved) === false)
    throw new Error(
      `Sidecar URI "${uri}" escapes or aliases the project asset namespace.`,
    );
  return resolved;
};

const assetUseIncomplete = (
  use: IAutoMovieAssetProvenance["uses"][number],
): boolean =>
  use.production.trim().length === 0 ||
  use.consumer.id.trim().length === 0 ||
  use.reason.trim().length === 0;

const assetProcessingStepIncomplete = (
  step: IAutoMovieAssetProvenance["processing"][number],
): boolean => step.tool.trim().length === 0 || step.command.trim().length === 0;

const motionTakeInventoryMatches = (
  declared: Readonly<NonNullable<IAutoMovieAssetProvenance["motion"]>["takes"]>,
  inspected: Readonly<
    NonNullable<
      ReturnType<typeof inspectAutoMovieExternalModelBytes>["motion"]
    >["takes"]
  >,
): boolean =>
  declared.length === inspected.length &&
  declared.every((take, index) => {
    const observed = inspected[index]!;
    return (
      take.id === observed.id &&
      take.animationIndex === index &&
      take.sourceName === observed.name &&
      take.durationSeconds === observed.duration
    );
  });

/** Convert byte-inspected glTF node facts to the manifest's canonical basis. */
const externalMotionBasisOf = (
  inspected: NonNullable<
    ReturnType<typeof inspectAutoMovieExternalModelBytes>["motion"]
  >,
): IAutoMovieExternalMotionBasis => ({
  profile: "gltf-motion-basis-v1",
  lengthUnit: "meter",
  handedness: "right-handed",
  upAxis: "Y-up",
  nodes: inspected.nodes.map((node) => ({
    nodeIndex: node.index,
    id: node.id,
    sourceName: node.name,
    parent: node.parent,
    localRest: structuredClone(node.transform),
  })),
});

const assetConsumerExists = (
  graph: IAutoMovieProductionDesignGraph,
  records: readonly IAutoMovieAssetProvenance[],
  assetPath: string,
  consumer: IAutoMovieAssetProvenance["uses"][number]["consumer"],
): boolean => {
  switch (consumer.kind) {
    case "audio-cue":
      return true;
    case "model-recipe":
      return graph.models.get(consumer.id)?.asset === assetPath;
    case "model-resource": {
      const owner = records.find((record) => record.path === consumer.id);
      return (
        owner?.model !== undefined &&
        assetPath !== owner.path &&
        [...graph.models.values()].some((model) => model.asset === owner.path)
      );
    }
    case "model-proxy": {
      const owner = records.find((record) => record.path === consumer.id);
      return (
        owner?.model !== undefined &&
        [owner.model.collisionProxy, owner.model.measurementProxy].some(
          (reference) =>
            reference.kind === "asset" && reference.asset === assetPath,
        )
      );
    }
    case "motion-resource": {
      const owner = records.find((record) => record.path === consumer.id);
      return owner?.motion !== undefined && assetPath !== owner.path;
    }
    case "motion-adoption":
      return (
        graph.production?.externalMotions?.some(
          (adoption) =>
            adoption.id === consumer.id && adoption.asset === assetPath,
        ) === true
      );
    case "rendition-reference":
      return graph.shots.has(consumer.id);
    // Like an audio cue, the reverse binding is owned by the consumer's own
    // gate: `designReferenceDiagnostics` refuses a document whose asset carries
    // no matching use, and refuses a use naming no declared document.
    case "design-reference":
      return true;
    // Same delegation, for the same reason: a texture use is keyed by the
    // compiled model id rather than a recipe id, and a scene environment is not
    // in the design graph at all, so this graph cannot answer either question.
    // `validateTextureAssets` sees the compiled models and scenes and reports
    // both directions -- an image bound by no authorized use, and a use no
    // compiled consumer binds any more -- so answering `false` here would
    // double-report the same fault at a less specific path.
    case "material-texture":
    case "scene-environment":
      return true;
  }
};

const hasActiveAssetUse = (
  record: IAutoMovieAssetProvenance | undefined,
  productionId: string,
  kind: "model-resource" | "model-proxy" | "motion-resource",
  owner: string,
): boolean =>
  record?.uses.some(
    (use) =>
      use.production === productionId &&
      use.consumer.kind === kind &&
      use.consumer.id === owner,
  ) === true;

/**
 * Bones an imported appearance must weight to stand in for a generated one.
 *
 * The archetype's builder decides them: an empty list is exactly a recipe whose
 * runtime has no skeleton, which is what binds a static asset instead of a
 * humanoid one.
 */
const requiredRecipeBones = (
  model: IAutoMovieModelRecipe,
  archetypes: AutoMovieModelArchetypeRegistry,
): readonly AutoMovieHumanoidBone[] =>
  archetypes.get(model.archetype)?.bones ?? [];

const refuseUnsupportedExternalInstancing = (
  graph: IAutoMovieProductionDesignGraph,
  externalModels: ReadonlyMap<string, IAutoMovieExternalModelRuntimeBinding>,
  diagnostic: (
    code: AutoMovieDiagnosticCode,
    target: string,
    message: string,
  ) => void,
): void => {
  for (const formation of graph.formations.values()) {
    const recipes = [
      formation.modelRecipe,
      ...(graph.models
        .get(formation.modelRecipe)
        ?.lod.filter((lod) => lod.tier !== "hero")
        .map((lod) => lod.recipe) ?? []),
    ];
    if (recipes.some((recipe) => externalModels.has(recipe)))
      diagnostic(
        "asset-model-instancing-unsupported",
        formation.id,
        `Formation "${formation.id}" selects a registered external model for anonymous members, but imported-mesh instancing is not yet supported. Use generated anonymous tiers or named hero nodes.`,
      );
  }
  for (const instanceSet of graph.world?.instanceSets ?? []) {
    const recipes = [
      instanceSet.modelRecipe,
      ...(instanceSet.prototypes ?? []).map(
        (prototype) => prototype.modelRecipe,
      ),
    ].flatMap((recipe) => [
      recipe,
      ...(graph.models.get(recipe)?.lod.map((lod) => lod.recipe) ?? []),
    ]);
    for (const recipe of new Set(recipes)) {
      const external = externalModels.get(recipe);
      if (external !== undefined && external.profile !== "gltf-static-v1")
        diagnostic(
          "asset-model-instancing-unsupported",
          instanceSet.id,
          `Instance set "${instanceSet.id}" selects external model "${recipe}" with profile "${external.profile}". General instancing accepts only rigid gltf-static-v1 prototypes; use named nodes for skinned, morphed, or animated assets.`,
        );
    }
  }
};

const validateCompiledAssetUses = (
  productionId: string,
  records: readonly IAutoMovieAssetProvenance[],
  edit: IAutoMovieFilmEdit,
): IAutoMovieDiagnostic[] => {
  const diagnostics: IAutoMovieDiagnostic[] = [];
  const audioByConsumer = new Map<string, string>();
  for (const asset of records)
    for (const use of asset.uses)
      if (use.production === productionId && use.consumer.kind === "audio-cue")
        audioByConsumer.set(use.consumer.id, asset.path);
  const actual = new Map(edit.tracks.audio.map((cue) => [cue.id, cue.asset]));
  for (const [id, asset] of audioByConsumer)
    if (actual.get(id) !== asset)
      diagnostics.push(
        filmDiagnostic(
          "asset-use-stale",
          `Asset ledger assigns "${asset}" to audio cue "${id}", but the active film does not contain that exact reference. Correct the production use or film cue.`,
        ),
      );
  for (const [id, asset] of actual)
    if (audioByConsumer.get(id) !== asset)
      diagnostics.push(
        filmDiagnostic(
          "asset-use-missing",
          `Audio cue "${id}" consumes "${asset}" without one matching typed use for production "${productionId}". Add the exact production/audio-cue ledger entry.`,
        ),
      );
  return diagnostics;
};

const isCanonicalAssetPath = (value: string): boolean =>
  path.posix.isAbsolute(value) === false &&
  /^[A-Za-z]:/.test(value) === false &&
  value.includes("\\") === false &&
  value !== "." &&
  path.posix.normalize(value) === value &&
  value.split("/").every((segment) => segment.length > 0 && segment !== "..");

const isSha256Digest = (value: string): boolean =>
  /^sha256:[0-9a-f]{64}$/.test(value);

const isHttpUrl = (value: string): boolean => {
  try {
    return ["http:", "https:"].includes(new URL(value).protocol);
  } catch {
    return false;
  }
};

const isExternalModelAsset = (value: string): boolean =>
  [".gltf", ".glb", ".vrm"].includes(path.extname(value).toLowerCase());

const contentFingerprintFields = (
  inputs: readonly IAutoMovieProductionContentInput[],
): IAutoMovieFingerprintField[] =>
  inputs.map((content) => ({
    role: `content:${content.path}`,
    kind: content.bytes === null ? "absent" : "file",
    payload:
      content.bytes === null
        ? new Uint8Array()
        : content.source && isTypeScriptSourcePath(content.path)
          ? normalizeAutoMovieSource(content.bytes)
          : content.bytes,
  }));

const productionCompilerInputFingerprint = (
  productionId: string,
  graph: ReturnType<AutoMovieProductionProject["graph"]>,
  sourceFields: readonly IAutoMovieFingerprintField[],
  contentFields: readonly IAutoMovieFingerprintField[],
): AutoMovieContentDigest =>
  fingerprintAutoMovieFields([
    {
      role: "protocol",
      kind: "compile-input",
      payload: Buffer.from(
        `${AUTOMOVIE_COMPILE_FINGERPRINT_PROTOCOL}\0${AUTOMOVIE_PRODUCTION_COMPILER_PROTOCOL}\0${AUTOMOVIE_PRODUCTION_COMPILER_VERSION}`,
        "utf8",
      ),
    },
    {
      role: "production",
      kind: "namespace",
      payload: Buffer.from(productionId, "utf8"),
    },
    ...designFingerprintFields(graph),
    ...sourceFields,
    ...contentFields,
  ]);

/**
 * Re-derive the current compiler-input identity without compiling or writing.
 *
 * Guarded publications use this inside the commit lock to prove that the
 * design, source, and declared-content bytes still match the snapshot they
 * intend to publish.
 *
 * @author Samchon
 */
export const currentAutoMovieProductionCompilerInputFingerprint = (
  project: AutoMovieProductionProject,
  scope: IAutoMovieCompileProjectInput["scope"],
): AutoMovieContentDigest | null => {
  try {
    const graph = project.graph();
    const sourceFields: IAutoMovieFingerprintField[] = [];
    for (const [id, contract] of graph.shots) {
      if (scope === "design") {
        sourceFields.push({
          role: `source:${id}`,
          kind: "not-inspected",
          payload: new Uint8Array(),
        });
        continue;
      }
      try {
        sourceFields.push({
          role: `source:${id}`,
          kind: "typescript",
          payload: normalizeAutoMovieSource(
            project.readSource(contract.source.module),
          ),
        });
      } catch {
        sourceFields.push({
          role: `source:${id}`,
          kind: "absent",
          payload: new Uint8Array(),
        });
      }
    }
    if (scope === "design")
      sourceFields.push({
        role: "source:film",
        kind: "not-inspected",
        payload: new Uint8Array(),
      });
    else
      try {
        sourceFields.push({
          role: "source:film",
          kind: "typescript",
          payload: normalizeAutoMovieSource(
            project.readSource(FILM_SOURCE_PATH),
          ),
        });
      } catch {
        sourceFields.push({
          role: "source:film",
          kind: "absent",
          payload: new Uint8Array(),
        });
      }
    const contentFields: IAutoMovieFingerprintField[] = [];
    if (scope !== "design")
      try {
        contentFields.push(
          ...contentFingerprintFields(project.contentInputs()),
        );
      } catch {
        contentFields.push({
          role: "content:inventory",
          kind: "unsafe",
          payload: new Uint8Array(),
        });
      }
    if (scope !== "design")
      contentFields.push(
        ...inspectAutoMovieDerivedArtifacts({
          root: project.root,
          manifestPath: project.manifest().derivedArtifactManifest,
        }).fingerprintFields,
      );
    return productionCompilerInputFingerprint(
      project.productionId,
      graph,
      sourceFields,
      contentFields,
    );
  } catch {
    return null;
  }
};

const designFingerprintFields = (
  graph: ReturnType<AutoMovieProductionProject["graph"]>,
): IAutoMovieFingerprintField[] => {
  const fields: IAutoMovieFingerprintField[] = [];
  const add = (role: string, value: unknown): void => {
    fields.push({
      role,
      kind: value === null ? "absent" : "canonical-json",
      payload:
        value === null ? new Uint8Array() : canonicalAutoMovieJsonBytes(value),
    });
  };
  add("design:production", graph.production);
  for (const [id, value] of graph.models) add(`design:model:${id}`, value);
  add("design:world", graph.world);
  for (const [id, value] of graph.formations)
    add(`design:formation:${id}`, value);
  for (const [id, value] of graph.shots) add(`design:shot:${id}`, value);
  for (const [id, value] of graph.acceptance)
    add(`design:acceptance:${id}`, value);
  return fields;
};

const materializeGeneratedFiles = (
  productionId: string,
  graph: ReturnType<AutoMovieProductionProject["graph"]>,
  runtimeModels: ReadonlyMap<
    string,
    IAutoMovieCompiledShotSource["models"][number]
  >,
  compiled: ReadonlyMap<string, IAutoMovieCompiledShotSource>,
  externalMotionConversions: ReadonlyMap<
    string,
    ICompilerExternalMotionConversionDraft
  >,
  realizations: ReadonlyMap<string, IAutoMovieCompiledContractRealization>,
  film: {
    edit: IAutoMovieCompiledFilmEdit;
    timeline: IAutoMovieFilmTimeline;
  } | null,
  inputFingerprint: AutoMovieContentDigest,
): ReadonlyMap<string, Uint8Array> => {
  const files = new Map<string, Uint8Array>();
  const put = (file: string, value: unknown): void => {
    files.set(
      file,
      Buffer.concat([
        Buffer.from(canonicalAutoMovieJsonBytes(value)),
        Buffer.from("\n", "utf8"),
      ]),
    );
  };
  put("contracts/production.json", graph.production);
  put("contracts/world.json", graph.world);
  for (const [id, value] of graph.models)
    put(`contracts/models/${encodeAutoMoviePathSegment(id)}.json`, value);
  for (const [id, value] of graph.formations)
    put(`contracts/formations/${encodeAutoMoviePathSegment(id)}.json`, value);
  for (const [id, value] of graph.shots)
    put(`contracts/shots/${encodeAutoMoviePathSegment(id)}.json`, value);
  for (const [id, value] of graph.acceptance)
    put(`contracts/acceptance/${encodeAutoMoviePathSegment(id)}.json`, value);
  for (const [id, value] of runtimeModels)
    put(`models/${encodeAutoMoviePathSegment(id)}.json`, value);
  for (const [id, value] of compiled)
    put(`shots/${encodeAutoMoviePathSegment(id)}.json`, value);
  for (const [adoption, draft] of [...externalMotionConversions].sort(
    ([left], [right]) => compareCodeUnits(left, right),
  )) {
    const outputPath = `shots/${encodeAutoMoviePathSegment(draft.decision.shot)}.json`;
    const outputBytes = files.get(outputPath);
    if (outputBytes === undefined)
      throw new Error(
        `External motion conversion "${adoption}" has no materialized shot output "${outputPath}".`,
      );
    const { motion, ...receipt } = draft;
    const compiledShot = compiled.get(draft.decision.shot);
    const resultMotionId = compiledShot?.shot.performances.find(
      (performance) => performance.node === draft.decision.actor,
    )?.motion;
    const resultMotion = compiledShot?.motions.find(
      (candidate) => candidate.id === resultMotionId,
    );
    if (resultMotion === undefined)
      throw new Error(
        `External motion conversion "${adoption}" for actor "${draft.decision.actor}" has no canonical enacted performance in materialized shot "${draft.decision.shot}".`,
      );
    const value: IAutoMovieExternalMotionConversionReceipt = {
      ...receipt,
      result: {
        motionId: resultMotion.id,
        motionDigest: digestAutoMovieBytes(
          canonicalAutoMovieJsonBytes(resultMotion),
        ),
        outputPath,
        outputDigest: digestAutoMovieBytes(outputBytes),
      },
    };
    put(
      `receipts/external-motion/${encodeAutoMoviePathSegment(adoption)}.json`,
      value,
    );
  }
  for (const [id, value] of realizations)
    put(`realizations/${encodeAutoMoviePathSegment(id)}.json`, value);
  if (film !== null) {
    put("contracts/film-edit.json", film.edit);
    put("film-timeline.json", film.timeline);
  }
  put("manifests/compile.json", {
    version: 2,
    compiler: AUTOMOVIE_PRODUCTION_COMPILER_PROTOCOL,
    productionId,
    inputFingerprint,
    assets: [...runtimeModels.keys()].sort(compareCodeUnits).map((id) => ({
      id,
      path: `models/${encodeAutoMoviePathSegment(id)}.json`,
    })),
    shots: [...compiled.keys()].sort(compareCodeUnits).map((id) => ({
      id,
      path: `shots/${encodeAutoMoviePathSegment(id)}.json`,
    })),
    film: film?.timeline.id ?? null,
  });
  return files;
};

const materializeFilmArtifacts = (
  draft: ICompiledFilmDraft,
  sourceDigest: AutoMovieContentDigest,
  inputFingerprint: AutoMovieContentDigest,
): {
  edit: IAutoMovieCompiledFilmEdit;
  timeline: IAutoMovieFilmTimeline;
} => ({
  edit: {
    version: 1,
    compiler: AUTOMOVIE_PRODUCTION_COMPILER_PROTOCOL,
    inputFingerprint,
    source: {
      path: FILM_SOURCE_PATH,
      export: FILM_SOURCE_EXPORT,
      digest: sourceDigest,
    },
    edit: draft.edit,
  },
  timeline: {
    ...draft.timeline,
    compiler: AUTOMOVIE_PRODUCTION_COMPILER_PROTOCOL,
    inputFingerprint,
    sourceDigest,
  },
});

const statusesOf = (
  project: AutoMovieProductionProject,
  files: readonly IAutoMovieGeneratedFile[],
): IAutoMovieMaterializedFile[] => {
  return files.map((file) => {
    let before: AutoMovieContentDigest | null = null;
    try {
      before = digestAutoMovieBytes(project.readGeneratedFile(file.path));
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes("does not exist") === false
      )
        throw error;
    }
    return {
      ...file,
      status:
        before === null
          ? "created"
          : before === file.digest
            ? "unchanged"
            : "updated",
    };
  });
};

const sourceTargetsOf = (
  file: string,
  graph: ReturnType<AutoMovieProductionProject["graph"]>,
): string[] => {
  if (file === "contracts/film-edit.json" || file === "film-timeline.json")
    return ["film"];
  for (const [id] of graph.shots)
    if (
      file === `shots/${encodeAutoMoviePathSegment(id)}.json` ||
      file === `realizations/${encodeAutoMoviePathSegment(id)}.json` ||
      file === `contracts/shots/${encodeAutoMoviePathSegment(id)}.json`
    )
      return [`shot:${id}`];
  for (const adoption of graph.production?.externalMotions ?? [])
    if (
      file ===
      `receipts/external-motion/${encodeAutoMoviePathSegment(adoption.id)}.json`
    )
      return [`external-motion:${adoption.id}`, `shot:${adoption.shot}`];
  for (const [id] of graph.models)
    if (
      file === `models/${encodeAutoMoviePathSegment(id)}.json` ||
      file === `contracts/models/${encodeAutoMoviePathSegment(id)}.json`
    )
      return [`model:${id}`];
  for (const [id] of graph.formations)
    if (file === `contracts/formations/${encodeAutoMoviePathSegment(id)}.json`)
      return [`formation:${id}`];
  for (const [id] of graph.acceptance)
    if (file === `contracts/acceptance/${encodeAutoMoviePathSegment(id)}.json`)
      return [`acceptance:${id}`];
  return [
    file === "contracts/production.json"
      ? "production"
      : file === "contracts/world.json"
        ? "world"
        : "compiler",
  ];
};

/**
 * Every active scene must be realized by a shot that actually compiled.
 *
 * The screenplay is the only join the compiler did not own, so a scene could
 * sit in the index forever with nothing built against it and every gate stayed
 * green. Intent is not realization: a shot contract that cites a scene proves
 * the author meant to cover it, and only a passing compiled realization proves
 * the film does.
 *
 * Scope decides severity, on the precedent `film-runtime-mismatch` sets. A film
 * being built sequence by sequence has uncovered scenes by construction, so
 * `source` reports the gap and lets the work continue; `review` and `final`
 * refuse, because a film presented for review is claiming to be whole.
 *
 * `OMITTED` tombstones are skipped. They exist precisely to record a scene the
 * production dropped without renumbering the ones around it.
 */
const screenplayCoverageDiagnostics = (props: {
  acceptance: ReadonlyMap<string, IAutoMovieAcceptanceScenario>;
  contracts: ReadonlyMap<string, IAutoMovieShotContract>;
  realizations: ReadonlyMap<string, IAutoMovieCompiledContractRealization>;
  scope: IAutoMovieCompileProjectInput["scope"];
  screenplay: IAutoMovieScreenplayIndex | null;
}): IAutoMovieDiagnostic[] => {
  if (props.screenplay === null) return [];
  const realized = new Set<string>();
  for (const [id, contract] of props.contracts) {
    if (props.realizations.get(id) === undefined) continue;
    for (const evidence of contract.evidence ?? [])
      realized.add(evidence.scene);
  }
  // A `production`-phase disposition is the index's own way of exempting a
  // scene from shot realization with an auditable reason, so honouring it is
  // the difference between a coverage gate and a demand that every scene be
  // shot. Tombstones need no exemption; they are not active.
  // A required acceptance scenario citing a scene is what claims that scene was
  // observed. The claim is a declaration in the ledger and this set is coverage
  // over declarations, not over pixels: whether the frames behind it exist is
  // asked by `review-evidence-missing`, and whether anyone looked at them is
  // stated in the evidence citation on the source that realizes the shot.
  const observed = new Set<string>();
  for (const scenario of props.acceptance.values()) {
    if (scenario.required !== true) continue;
    for (const evidence of scenario.evidence ?? [])
      observed.add(evidence.scene);
  }
  const diagnostics: IAutoMovieDiagnostic[] = [];
  // A ledger asserting both absence and realization contradicts itself, and
  // the contradiction is not a scope-dependent "not yet": it is wrong the
  // moment both records exist.
  for (const scene of props.screenplay.screenplay.scenes) {
    const claimed = realized.has(scene.id) || observed.has(scene.id);
    if (claimed === false) continue;
    if (scene.status === "OMITTED")
      diagnostics.push({
        code: "screenplay-tombstone-realized",
        category: "error",
        phase: "compile",
        target: "screenplay",
        path: null,
        message: `Scene "${scene.id}" is an OMITTED tombstone, yet a compiled realization or a required acceptance scenario cites it. The ledger asserts both absence and realized work. Remove the downstream claim or reactivate the scene, then compile again.`,
      });
    else if (scene.disposition !== null)
      diagnostics.push({
        code: "screenplay-disposition-realized",
        category: "error",
        phase: "compile",
        target: "screenplay",
        path: null,
        message: `Scene "${scene.id}" is exempted at the ${scene.disposition.phase} phase, yet a compiled realization or a required acceptance scenario cites it. Intentional omission and realized work contradict each other. Remove the disposition or the downstream claim, then compile again.`,
      });
  }
  const active = props.screenplay.screenplay.scenes.filter(
    (scene) =>
      scene.status === "active" && scene.disposition?.phase !== "production",
  );
  // Observation is the review scopes' bar, not authoring's. A film being built
  // has scenes nobody has looked at yet by construction; a film presented for
  // review is claiming somebody did.
  const unobserved =
    props.scope === "review" || props.scope === "final"
      ? active.filter((scene) => observed.has(scene.id) === false)
      : [];
  if (unobserved.length !== 0)
    diagnostics.push({
      code: "screenplay-scene-unobserved",
      category: "error",
      phase: "compile",
      target: "screenplay",
      path: null,
      message: `Active ${unobserved.length === 1 ? "scene" : "scenes"} ${unobserved
        .map((scene) => `"${scene.id}"`)
        .join(
          ", ",
        )} ${unobserved.length === 1 ? "has" : "have"} no required acceptance scenario citing them. A compiled realization is not an observation, so nothing here was ever looked at. Author a required acceptance scenario citing the scene, or record a phase-local disposition, then compile again.`,
    });
  const uncovered = active.filter((scene) => realized.has(scene.id) === false);
  if (uncovered.length === 0) return diagnostics;
  return [
    ...diagnostics,
    {
      code: "screenplay-scene-unrealized",
      category: props.scope === "source" ? "warning" : "error",
      phase: "compile",
      target: "screenplay",
      path: null,
      message: `Active ${uncovered.length === 1 ? "scene" : "scenes"} ${uncovered
        .map((scene) => `"${scene.id}"`)
        .join(
          ", ",
        )} ${uncovered.length === 1 ? "has" : "have"} no shot with a passing compiled realization.${
        props.scope === "source"
          ? " The film does not cover its screenplay yet; it must before review."
          : " Build and compile a citing shot, or record the scene as OMITTED."
      }`,
    },
  ];
};

/**
 * A resident shot contract requires a resident screenplay index.
 *
 * Shot ids join to scene ids, so a shot written before the ledger exists is
 * citing numbering nothing has fixed yet. This is residency only: the index is
 * never decoded here, so a structurally valid but empty ledger still counts as
 * present and its content is judged by the checks that own it.
 *
 * A project with no shot contracts is silent, which is what keeps a fresh
 * scaffold and a design-only session from being told to author a screenplay
 * before there is anything to join it to.
 */
const screenplayResidencyDiagnostics = (props: {
  contracts: ReadonlyMap<string, IAutoMovieShotContract>;
  screenplay: IAutoMovieScreenplayIndex | null;
}): IAutoMovieDiagnostic[] =>
  props.screenplay !== null || props.contracts.size === 0
    ? []
    : [
        {
          code: "screenplay-index-missing",
          category: "error",
          phase: "compile",
          target: "screenplay",
          path: null,
          message: `${props.contracts.size} shot contract(s) are resident with no screenplay index. Their scene citations join to numbering that does not exist, so nothing downstream can be traced to authored work. Author the screenplay index, then compile again.`,
        },
      ];

const finalDeliverableDiagnostics = (
  project: AutoMovieProductionProject,
  production: ReturnType<AutoMovieProductionProject["graph"]>["production"],
  inputFingerprint: AutoMovieContentDigest,
): IAutoMovieDiagnostic[] => {
  if (production === null) return [];
  let bytes: Uint8Array | null;
  try {
    bytes = project.readTrackedStateFile("render-manifest.json");
  } catch {
    bytes = Buffer.from("unsafe tracked render manifest");
  }
  if (bytes === null)
    return [
      {
        code: "render-deliverable-missing",
        category: "error",
        phase: "render",
        target: production.id,
        path: `automovie/productions/${encodeAutoMoviePathSegment(project.productionId)}/render-manifest.json`,
        message:
          "Required deliverables have no current render manifest. Run the project render command before final compilation.",
      },
    ];
  const manifestDigest = digestAutoMovieBytes(bytes);
  let receipt: IAutoMovieProductionRenderReceipt | null = null;
  try {
    const receiptBytes = project.readTrackedStateFile(
      "render-manifest-receipt.json",
    );
    if (receiptBytes !== null) {
      const validation =
        typia.validateEquals<IAutoMovieProductionRenderReceipt>(
          JSON.parse(Buffer.from(receiptBytes).toString("utf8")) as unknown,
        );
      if (validation.success) receipt = validation.data;
    }
  } catch {
    receipt = null;
  }
  if (
    receipt === null ||
    receipt.version !== 2 ||
    receipt.manifestDigest !== manifestDigest
  )
    return [
      renderDeliverableDiagnostic(
        "render-deliverable-unowned",
        production.id,
        "The aggregate render manifest lacks the matching renderer-owned receipt. Recreate it through the production render command instead of editing tracked state directly.",
      ),
    ];
  let manifest: IAutoMovieProductionRenderManifest;
  try {
    const validation = typia.validateEquals<IAutoMovieProductionRenderManifest>(
      JSON.parse(Buffer.from(bytes).toString("utf8")) as unknown,
    );
    if (validation.success === false)
      return [
        renderDeliverableDiagnostic(
          "render-deliverable-invalid",
          production.id,
          `The active production render manifest does not satisfy the aggregate render-ledger schema: ${validation.errors
            .map((error) => `${error.path} expects ${error.expected}`)
            .join("; ")}. Recreate it through the production render command.`,
        ),
      ];
    manifest = validation.data;
  } catch {
    return [
      renderDeliverableDiagnostic(
        "render-deliverable-invalid",
        production.id,
        "The aggregate render manifest is not valid JSON. Recreate it through the production render command.",
      ),
    ];
  }
  if (manifest.compileFingerprint !== inputFingerprint)
    return [
      renderDeliverableDiagnostic(
        "render-deliverable-stale",
        production.id,
        "Required deliverables are not bound to the current compile fingerprint. Re-render the current production and replace the aggregate render manifest.",
      ),
    ];
  const diagnostics: IAutoMovieDiagnostic[] = [];
  const declared = new Map(
    production.deliverables.map((deliverable) => [deliverable.id, deliverable]),
  );
  const resident = new Map<
    string,
    IAutoMovieProductionRenderManifest["deliverables"][number]
  >();
  const filePaths = new Set<string>();
  const receiptByPath = new Map(
    receipt.files.map((file) => [
      normalizeSlash(file.path).toLowerCase(),
      file,
    ]),
  );
  if (receiptByPath.size !== receipt.files.length)
    diagnostics.push(
      renderDeliverableDiagnostic(
        "render-deliverable-unowned",
        production.id,
        "The renderer-owned receipt repeats a physical file path. Recreate it through the production render command.",
      ),
    );
  const witnessedReceiptPaths = new Set<string>();
  for (const deliverable of manifest.deliverables) {
    if (resident.has(deliverable.id))
      diagnostics.push(
        renderDeliverableDiagnostic(
          "render-deliverable-invalid",
          deliverable.id,
          `Deliverable "${deliverable.id}" is duplicated in the aggregate render manifest. Keep one byte-exact record.`,
        ),
      );
    else resident.set(deliverable.id, deliverable);
    const contract = declared.get(deliverable.id);
    if (contract === undefined || contract.kind !== deliverable.kind)
      diagnostics.push(
        renderDeliverableDiagnostic(
          "render-deliverable-invalid",
          deliverable.id,
          `Deliverable "${deliverable.id}" kind "${deliverable.kind}" does not match current production design. Remove it or restore the exact declared id and kind.`,
        ),
      );
    if (deliverable.files.length === 0)
      diagnostics.push(
        renderDeliverableDiagnostic(
          "render-deliverable-incomplete",
          deliverable.id,
          `Deliverable "${deliverable.id}" has no output file. Render at least one owned byte artifact and record its digest and size.`,
        ),
      );
    const probes: IAutoMovieProductionMediaProbe[] = [];
    for (const file of deliverable.files) {
      const portablePath = normalizeSlash(file.path).toLowerCase();
      if (filePaths.has(portablePath))
        diagnostics.push(
          renderDeliverableDiagnostic(
            "render-deliverable-invalid",
            deliverable.id,
            `Render file "${file.path}" is claimed more than once. Give each owned output one deliverable owner.`,
            file.path,
          ),
        );
      filePaths.add(portablePath);
      witnessedReceiptPaths.add(portablePath);
      if (
        Number.isInteger(file.bytes) === false ||
        file.bytes <= 0 ||
        file.mediaType.trim().length === 0
      ) {
        diagnostics.push(
          renderDeliverableDiagnostic(
            "render-deliverable-invalid",
            deliverable.id,
            `Render file "${file.path}" needs a positive integer byte size and non-empty media type. Rebuild its ledger entry.`,
            file.path,
          ),
        );
        continue;
      }
      try {
        const actual = project.readRenderFile(file.path);
        if (
          actual.length !== file.bytes ||
          digestAutoMovieBytes(actual) !== file.digest
        )
          diagnostics.push(
            renderDeliverableDiagnostic(
              "render-deliverable-stale",
              deliverable.id,
              `Render file "${file.path}" bytes do not match its recorded size and digest. Re-render the current deliverable.`,
              file.path,
            ),
          );
        const receiptFile = receiptByPath.get(portablePath);
        if (
          receiptFile === undefined ||
          receiptFile.deliverable !== deliverable.id ||
          receiptFile.digest !== file.digest ||
          receiptFile.bytes !== file.bytes ||
          receiptFile.mediaType !== file.mediaType
        )
          diagnostics.push(
            renderDeliverableDiagnostic(
              "render-deliverable-unowned",
              deliverable.id,
              `Render file "${file.path}" lacks one exact renderer-owned byte and media-probe receipt. Recreate the aggregate manifest through the production render command.`,
              file.path,
            ),
          );
        else {
          let probe: IAutoMovieProductionMediaProbe;
          try {
            probe = probeProductionMedia({
              kind: deliverable.kind,
              mediaType: file.mediaType,
              bytes: actual,
            });
          } catch (error) {
            diagnostics.push(
              renderDeliverableDiagnostic(
                "render-deliverable-invalid",
                deliverable.id,
                `Render file "${file.path}" failed current media probing: ${errorMessage(error)} Re-render a valid declared medium.`,
                file.path,
              ),
            );
            continue;
          }
          if (canonicalizeProbe(probe) !== canonicalizeProbe(receiptFile.probe))
            diagnostics.push(
              renderDeliverableDiagnostic(
                "render-deliverable-unowned",
                deliverable.id,
                `Render file "${file.path}" current media facts differ from its renderer-owned receipt. Recreate the aggregate manifest.`,
                file.path,
              ),
            );
          else probes.push(probe);
        }
      } catch (error) {
        diagnostics.push(
          renderDeliverableDiagnostic(
            "render-deliverable-missing",
            deliverable.id,
            `${errorMessage(error)} Re-render the missing owned output.`,
            file.path,
          ),
        );
      }
    }
    appendDeliverableTimelineDiagnostics(
      diagnostics,
      production,
      deliverable,
      probes,
    );
    appendRenditionDeliveryDiagnostics(
      diagnostics,
      project,
      production,
      inputFingerprint,
      deliverable,
    );
  }
  for (const file of receipt.files)
    if (
      witnessedReceiptPaths.has(normalizeSlash(file.path).toLowerCase()) ===
      false
    )
      diagnostics.push(
        renderDeliverableDiagnostic(
          "render-deliverable-unowned",
          file.deliverable,
          `Renderer receipt file "${file.path}" is not owned by the current aggregate manifest. Recreate the manifest and receipt together.`,
          file.path,
        ),
      );
  for (const deliverable of production.deliverables)
    if (deliverable.required && resident.has(deliverable.id) === false)
      diagnostics.push(
        renderDeliverableDiagnostic(
          "render-deliverable-missing",
          deliverable.id,
          `Required ${deliverable.kind} deliverable "${deliverable.id}" is absent from the aggregate render manifest. Render and record it before final compilation.`,
        ),
      );
  return diagnostics;
};

const appendRenditionDeliveryDiagnostics = (
  diagnostics: IAutoMovieDiagnostic[],
  project: AutoMovieProductionProject,
  production: NonNullable<
    ReturnType<AutoMovieProductionProject["graph"]>["production"]
  >,
  inputFingerprint: AutoMovieContentDigest,
  deliverable: IAutoMovieProductionRenderManifest["deliverables"][number],
): void => {
  if (deliverable.kind !== "feature") {
    if (deliverable.rendition !== undefined)
      diagnostics.push(
        renderDeliverableDiagnostic(
          "render-rendition-provenance-invalid",
          deliverable.id,
          "Only feature delivery may claim repaint rendition provenance.",
        ),
      );
    return;
  }
  if (production.visualDelivery !== "repainted") {
    if (deliverable.rendition !== undefined)
      diagnostics.push(
        renderDeliverableDiagnostic(
          "render-rendition-provenance-invalid",
          deliverable.id,
          "Deterministic feature delivery must not claim repaint rendition provenance.",
        ),
      );
    return;
  }
  try {
    const timeline = readAutoMovieFilmTimeline(project, inputFingerprint);
    const shots = [
      ...new Set(timeline.segments.map((segment) => segment.shot)),
    ];
    const receipts = new Map(
      project
        .verifiedRepaintRenditions(shots)
        .map((receipt) => [receipt.shot, receipt] as const),
    );
    const expected = {
      kind: "repainted" as const,
      shots: shots.map((shot) => {
        const receipt = receipts.get(shot);
        if (receipt === undefined)
          throw new Error(
            `Shot "${shot}" has no current verified repaint receipt.`,
          );
        return {
          shot,
          path: receipt.output.path,
          digest: receipt.output.digest,
          receiptDigest: digestAutoMovieBytes(
            canonicalAutoMovieJsonBytes(receipt),
          ),
        };
      }),
    };
    if (
      deliverable.rendition === undefined ||
      Buffer.from(canonicalAutoMovieJsonBytes(deliverable.rendition)).equals(
        Buffer.from(canonicalAutoMovieJsonBytes(expected)),
      ) === false
    )
      throw new Error(
        "Feature manifest does not exactly cite the current receipt and review chain.",
      );
    const feature = deliverable.files.find(
      (file) => file.mediaType === "video/mp4",
    );
    if (feature === undefined)
      throw new Error("Feature manifest has no video/mp4 output.");
    assertProductionFeatureUsesRenditionClips({
      feature: project.readRenderFile(feature.path),
      timeline,
      clips: new Map(
        shots.map(
          (shot) =>
            [
              shot,
              project.readRenderFile(receipts.get(shot)!.output.path),
            ] as const,
        ),
      ),
    });
  } catch (error) {
    diagnostics.push(
      renderDeliverableDiagnostic(
        "render-rendition-provenance-invalid",
        deliverable.id,
        `${errorMessage(error)} Re-finalize from current reviewed repaint receipts; deterministic fallback is not accepted for repainted delivery.`,
      ),
    );
  }
};

const appendDeliverableTimelineDiagnostics = (
  diagnostics: IAutoMovieDiagnostic[],
  production: NonNullable<
    ReturnType<AutoMovieProductionProject["graph"]>["production"]
  >,
  deliverable: IAutoMovieProductionRenderManifest["deliverables"][number],
  probes: readonly IAutoMovieProductionMediaProbe[],
): void => {
  const timed = ["feature", "guide-pass", "captions", "audio-mix"].includes(
    deliverable.kind,
  );
  const framed =
    deliverable.kind === "feature" || deliverable.kind === "guide-pass";
  const encoded =
    deliverable.kind === "feature" ||
    deliverable.kind === "guide-pass" ||
    deliverable.kind === "audio-mix";
  const expectedFrames = Math.round(
    production.targetRuntimeSeconds * production.frameFormat.fps,
  );
  if (
    (timed && deliverable.runtimeSeconds !== production.targetRuntimeSeconds) ||
    (!timed &&
      deliverable.runtimeSeconds !== null &&
      (Number.isFinite(deliverable.runtimeSeconds) === false ||
        deliverable.runtimeSeconds <= 0)) ||
    (framed && deliverable.frameCount !== expectedFrames) ||
    (!framed &&
      deliverable.frameCount !== null &&
      (Number.isInteger(deliverable.frameCount) === false ||
        deliverable.frameCount <= 0)) ||
    (encoded &&
      (deliverable.codec === null || deliverable.codec.trim().length === 0)) ||
    (!encoded &&
      deliverable.codec !== null &&
      deliverable.codec.trim().length === 0)
  )
    diagnostics.push(
      renderDeliverableDiagnostic(
        "render-deliverable-incomplete",
        deliverable.id,
        `Deliverable "${deliverable.id}" has incomplete runtime, frame-count, or codec evidence for kind "${deliverable.kind}". Match the ${production.targetRuntimeSeconds}s production clock and ${expectedFrames} frames where applicable.`,
      ),
    );
  if (deliverable.kind === "feature" || deliverable.kind === "guide-pass") {
    const videos = probes.filter((probe) => probe.kind === "video");
    const video = videos.length === 1 ? videos[0] : null;
    const controls =
      deliverable.kind === "guide-pass"
        ? probes.filter((probe) => probe.kind === "png")
        : [];
    const guideContract = production.deliverables.find(
      (candidate) =>
        candidate.id === deliverable.id && candidate.kind === "guide-pass",
    );
    const guidePass =
      deliverable.kind === "guide-pass"
        ? (guideContract?.pass ?? "pose")
        : null;
    const controlPaths =
      guidePass === null
        ? []
        : deliverable.files
            .filter((file) => file.mediaType === "image/png")
            .map((file) => normalizeSlash(file.path));
    const expectedControlPath = (frame: number): string =>
      `frames/${guidePass}/frame_${String(frame).padStart(8, "0")}.png`;
    if (
      video?.kind !== "video" ||
      (deliverable.kind === "feature" && probes.length !== 1) ||
      (deliverable.kind === "guide-pass" &&
        (controls.length !== probes.length - 1 ||
          controlPaths.length !== expectedFrames ||
          controlPaths.some(
            (control, index) =>
              control !== expectedControlPath(index) &&
              control.endsWith(`/${expectedControlPath(index)}`) === false,
          ) ||
          controls.some(
            (probe) =>
              probe.width !== production.frameFormat.width ||
              probe.height !== production.frameFormat.height,
          ))) ||
      video.width !== production.frameFormat.width ||
      video.height !== production.frameFormat.height ||
      video.frameCount !== expectedFrames ||
      frameClockClose(video.fps, production.frameFormat.fps) === false ||
      frameClockClose(video.runtimeSeconds, production.targetRuntimeSeconds) ===
        false ||
      deliverable.codec?.toLowerCase() !== video.codec ||
      deliverable.frameCount !== video.frameCount ||
      deliverable.runtimeSeconds !== video.runtimeSeconds
    )
      diagnostics.push(
        renderDeliverableDiagnostic(
          "render-deliverable-media-mismatch",
          deliverable.id,
          `Deliverable "${deliverable.id}" must own one parsed ${production.frameFormat.width}x${production.frameFormat.height} H.264 MP4 at ${production.frameFormat.fps}fps with ${expectedFrames} resident samples and ${production.targetRuntimeSeconds}s runtime${deliverable.kind === "guide-pass" ? `, plus exactly ${expectedFrames} continuous same-raster "${guidePass}" PNG controls` : ""}. Manifest strings cannot substitute for parser-derived media facts.`,
        ),
      );
  } else if (deliverable.kind === "preview") {
    if (
      probes.length !== deliverable.files.length ||
      probes.some(
        (probe) =>
          probe.kind !== "png" ||
          probe.width !== production.frameFormat.width ||
          probe.height !== production.frameFormat.height,
      )
    )
      diagnostics.push(
        renderDeliverableDiagnostic(
          "render-deliverable-media-mismatch",
          deliverable.id,
          `Preview deliverable "${deliverable.id}" must contain decoded PNGs at the exact ${production.frameFormat.width}x${production.frameFormat.height} production raster.`,
        ),
      );
  } else if (deliverable.kind === "captions") {
    if (
      probes.length !== deliverable.files.length ||
      probes.some(
        (probe) =>
          probe.kind !== "webvtt" ||
          probe.lastCueSeconds > production.targetRuntimeSeconds,
      )
    )
      diagnostics.push(
        renderDeliverableDiagnostic(
          "render-deliverable-media-mismatch",
          deliverable.id,
          `Caption deliverable "${deliverable.id}" must contain parser-verified, ordered, non-empty WebVTT cues wholly inside the ${production.targetRuntimeSeconds}s production timeline.`,
        ),
      );
  } else {
    const audio = probes.filter((probe) => probe.kind === "audio");
    const rasters = probes.filter((probe) => probe.kind === "png");
    const evidence = probes.filter((probe) => probe.kind === "sound-evidence");
    if (
      audio.length !== 1 ||
      rasters.length !== 2 ||
      evidence.length !== 1 ||
      frameClockClose(
        audio[0]!.runtimeSeconds,
        production.targetRuntimeSeconds,
      ) === false ||
      audio[0]!.sampleCount <= 0 ||
      audio[0]!.channels !== 2 ||
      audio[0]!.sampleRate !== 48_000 ||
      /^(opus|mp4a)(?:\.|$)/i.test(audio[0]!.codec) === false ||
      deliverable.codec !== audio[0]!.codec ||
      deliverable.runtimeSeconds !== audio[0]!.runtimeSeconds ||
      evidence[0]!.clippingSamples !== 0 ||
      evidence[0]!.eventAlignmentPassed === false
    )
      diagnostics.push(
        renderDeliverableDiagnostic(
          "render-deliverable-media-mismatch",
          deliverable.id,
          `Audio deliverable "${deliverable.id}" must own one exact-runtime parsed audio/mp4 track, waveform and spectrogram PNGs, and parser-verified zero-clipping event-alignment evidence.`,
        ),
      );
  }
};

const canonicalizeProbe = (probe: IAutoMovieProductionMediaProbe): string =>
  Buffer.from(canonicalAutoMovieJsonBytes(probe)).toString("utf8");

const frameClockClose = (left: number, right: number): boolean =>
  Math.abs(left - right) <=
  Number.EPSILON * 64 * Math.max(1, Math.abs(left), Math.abs(right));

const renderDeliverableDiagnostic = (
  code: AutoMovieDiagnosticCode,
  target: string,
  message: string,
  renderPath: string | null = null,
): IAutoMovieDiagnostic => ({
  code,
  category: "error",
  phase: "render",
  target,
  path: renderPath,
  message,
});

const listFiles = (root: string): string[] => {
  const files: string[] = [];
  const visit = (directory: string): void => {
    for (const entry of fs
      .readdirSync(directory, { withFileTypes: true })
      .sort((left, right) => compareCodeUnits(left.name, right.name))) {
      const child = path.join(directory, entry.name);
      const status = fs.lstatSync(child);
      if (status.isSymbolicLink()) files.push(child);
      else if (status.isDirectory()) visit(child);
      else if (status.isFile()) files.push(child);
    }
  };
  visit(root);
  return files;
};

const compareDiagnostics = (
  left: IAutoMovieDiagnostic,
  right: IAutoMovieDiagnostic,
): number =>
  compareCodeUnits(left.phase, right.phase) ||
  compareCodeUnits(left.path ?? "", right.path ?? "") ||
  compareCodeUnits(left.code, right.code) ||
  compareCodeUnits(left.message, right.message);

const normalizeSlash = (value: string): string =>
  value.split(path.sep).join("/");
