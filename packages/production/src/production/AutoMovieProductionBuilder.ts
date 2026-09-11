import {
  realizeShotContract,
  validateAutoMovieEnvironmentContext,
  validateBuiltEnvironment,
  validateDesignLineageBinding,
  validateModel,
} from "@automovie/engine";
import type { IAutoMovieProductionEvidence } from "@automovie/evidence";
import {
  AutoMovieContentDigest,
  IAutoMovieAssetProvenance,
  IAutoMovieBeatEndState,
  IAutoMovieBuildProjectInput,
  IAutoMovieBuildProjectOutput,
  IAutoMovieCompiledContractRealization,
  IAutoMovieCompiledShotSource,
  IAutoMovieConstraintViolation,
  IAutoMovieDerivedArtifactSource,
  IAutoMovieDesignEvidence,
  IAutoMovieDesignLineage,
  IAutoMovieDesignReference,
  IAutoMovieDiagnostic,
  IAutoMovieFilmBuildContext,
  IAutoMovieFilmEdit,
  IAutoMovieGeneratedFile,
  IAutoMovieGeneratedManifest,
  IAutoMovieLibraryBuildContext,
  IAutoMovieModel,
  IAutoMovieRenderBundleManifest,
} from "@automovie/interface";
import { createRequire } from "node:module";
import path from "node:path";
import typia from "typia";

import {
  AutoMovieProductionInputRaceError,
  AutoMovieProductionProject,
  IAutoMovieProductionContentInput,
} from "./AutoMovieProductionProject";
import {
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
import { parseAutoMovieStructuredJson } from "./duplicateAwareJson";
import { autoMovieLibraryArtifactSourceTargets } from "./libraryArtifactTargets";
import {
  IAutoMovieLibraryAuthoringSnapshot,
  captureAutoMovieLibraryAuthoringSnapshot,
  createAutoMovieLibrarySourceExecutionPlan,
  sameAutoMovieLibraryAuthoringSnapshot,
} from "./libraryAuthoringSnapshot";
import {
  IAutoMovieExternalModelRuntimeBinding,
  IAutoMovieMaterializedLibraryResult,
  materializeAutoMovieLibraryFiles,
  materializeCompiledFormationInventory,
  materializeCompiledInstanceSetInventory,
  materializeCompiledShot,
  materializeProductionModels,
} from "./materializeProduction";
import {
  productionAssetInventory,
  validateCompiledAssetUses,
} from "./productionAssetInventory";
import {
  materializeFilmArtifacts,
  materializeGeneratedFiles,
} from "./productionBuildArtifacts";
import {
  compareDiagnostics,
  errorMessage,
  filmSourcePathDiagnostic,
  listFiles,
  missingDesignDiagnostics,
  normalizeSlash,
  sourcePathDiagnostic,
} from "./productionBuildDiagnostics";
import {
  authoringEvidenceFingerprintFields,
  contentFingerprintFields,
  currentAutoMovieProductionBuildInputFingerprintWithEvidence,
  productionBuildInputFingerprint,
} from "./productionBuildIdentity";
import {
  AUTOMOVIE_PRODUCTION_BUILD_PROTOCOL,
  AUTOMOVIE_PRODUCTION_BUILD_VERSION,
} from "./productionBuildProtocol";
import { sourceTargetsOf, statusesOf } from "./productionBuildStatus";
import { finalDeliverableDiagnostics } from "./productionDeliveryValidation";
import {
  IProductionExternalMotionAdoption,
  IProductionExternalMotionConversionDraft,
} from "./productionExternalMotion";
import {
  FILM_SOURCE_PATH,
  ICompiledFilmDraft,
  assembleFilm,
  buildFilmEdit,
  filmDiagnostic,
} from "./productionFilmAssembly";
import { type IAutoMovieProductionRenderJobPlan } from "./productionRenderJob";
import {
  screenplayCoverageDiagnostics,
  screenplayResidencyDiagnostics,
} from "./productionScreenplayValidation";
import {
  ICompiledVideoClosing,
  assembleShotSource,
  fullHardCutBoundary,
  shotAssemblyOrder,
  shotSourceOwnerTarget,
} from "./productionShotAssembly";
import { validateCompiledShot } from "./productionShotValidation";
import {
  ICompiledLibraryOwnerRegistration,
  ISourceBuildResult,
  buildLibrarySource,
} from "./productionSourceBuild";
import { productionTextureClosureDiagnostics } from "./productionTextureClosure";
import { productionRenderTargetFingerprint } from "./renderIdentity";
import {
  assetReviewEvidenceDiagnostics,
  consumedModelIds,
  reviewEvidenceDiagnostics,
} from "./reviewEvidenceDiagnostics";
import { screenplayLedgerDiagnostics } from "./screenplayLedgerDiagnostics";
import { screenplayProseDiagnostics } from "./screenplayProseDiagnostics";
import { screenplayTimingDiagnostics } from "./screenplayTimingDiagnostics";
import { shotDeterminismDiagnostics } from "./shotDeterminismDiagnostics";
import {
  autoMovieSourceContentDiagnostic,
  autoMovieSourceContentFinding,
  autoMovieValidationFindings,
} from "./sourceContentDiagnostics";
import { resolveAutoMovieSourceOwnerBinding } from "./sourceOwnerBinding";
import { storySyncDiagnostics } from "./storySyncDiagnostics";
import { resolveAutoMovieTimedAuthoringKind } from "./timedAuthoringKind";
import { validateAutoMovieProductionGraph } from "./validateProductionDesign";

/**
 * Assemble authored modules into validated production artifacts.
 *
 * Project scripts execute under ttsx. Node loads the authored modules; the
 * engine owns geometry and motion validation, and the project store publishes
 * the resulting artifact set atomically.
 *
 * @author Samchon
 */
export class AutoMovieProductionBuilder {
  public constructor(
    private readonly project: AutoMovieProductionProject,
    private readonly authoringEvidence?: IAutoMovieProductionEvidence,
    private readonly currentAuthoringEvidence?: () => IAutoMovieProductionEvidence,
    private readonly finalRenderPlan?: IAutoMovieProductionRenderJobPlan,
  ) {}

  /**
   * Whether one compiled model carries a skeleton.
   *
   * The extreme-range pose is part of an asset's required view set only for a
   * rigged model, because a rig that reads correctly at rest is exactly the rig
   * whose limits nobody looked at. A model whose compiled bytes cannot be read
   * is reported by the builder's own registry diagnostics, so it is treated as
   * unrigged here rather than raising a second, worse-placed error.
   */
  private compiledModelIsRigged(model: string): boolean {
    try {
      const validation = typia.validateEquals<IAutoMovieModel>(
        parseAutoMovieStructuredJson({
          record: "compiled-model",
          bytes: this.project.readGeneratedFile(
            `models/${encodeAutoMoviePathSegment(model)}.json`,
          ),
        }),
      );
      return validation.success && validation.data.skeleton !== null;
    } catch {
      return false;
    }
  }

  /**
   * Compile the active design and source through the requested gate.
   */
  public build(
    input: IAutoMovieBuildProjectInput,
  ): IAutoMovieBuildProjectOutput {
    return this.run(input, true);
  }

  /**
   * Run every builder gate without materializing generated files.
   *
   * Project linters use this entry point so a read-only check can never repair
   * the ownership or freshness failure it is supposed to report.
   */
  public lint(
    input: IAutoMovieBuildProjectInput,
  ): IAutoMovieBuildProjectOutput {
    return this.run(input, false);
  }

  private run(
    input: IAutoMovieBuildProjectInput,
    materialize: boolean,
  ): IAutoMovieBuildProjectOutput {
    const require = createRequire(path.join(this.project.root, "package.json"));
    for (const id of Object.keys(require.cache)) {
      const relative = path.relative(this.project.root, id);
      if (
        relative !== "" &&
        !relative.startsWith("..") &&
        !path.isAbsolute(relative) &&
        !relative.split(path.sep).includes("node_modules")
      )
        delete require.cache[id];
    }

    if (this.authoringEvidence?.manifest.kind === "library")
      return this.runLibrary(input, materialize, this.authoringEvidence);
    const timedAuthoring = resolveAutoMovieTimedAuthoringKind(
      this.authoringEvidence,
    )!;
    const graph = this.project.graph();
    const screenplay = this.project.screenplayIndex();
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
    const sourceFields: IAutoMovieFingerprintField[] = [
      ...authoringEvidenceFingerprintFields(this.authoringEvidence),
    ];
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
    let externalMotions = new Map<string, IProductionExternalMotionAdoption>();
    if (input.scope !== "design")
      try {
        contentInputs = this.project.contentInputs();
        contentFields.push(...contentFingerprintFields(contentInputs));
        const assetInventory = productionAssetInventory(
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
          message: `${errorMessage(error)} Correct contentRoots/contentFiles ownership before running the builder.`,
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
      IProductionExternalMotionConversionDraft
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
    let filmEditSource: ISourceBuildResult<IAutoMovieFilmEdit> | null = null;
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
      filmEditSource = buildFilmEdit({
        source: Buffer.from(filmSource).toString("utf8"),
        sourceRoot: this.project.root,
        context: filmContext,
      });
    }

    if (input.scope !== "design" && designReady && derivedArtifactsReady) {
      let previousVideo: ICompiledVideoClosing | null = null;
      for (const entry of shotAssemblyOrder(
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
                  owner: shotSourceOwnerTarget(entry.contract, screenplay),
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
          const result = assembleShotSource({
            id: entry.id,
            path: entry.contract.source.module,
            exportName: entry.contract.source.export,
            source: Buffer.from(normalized).toString("utf8"),
            sourceRoot: this.project.root,
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
                      digest: binding.sourceDigest,
                      target: target!,
                    },
                    // A resolved binding came from this evidence carrier, so
                    // the sibling reviewed exports are read from the same one.
                    acceptanceSources:
                      this.authoringEvidence!.sourceOwners.filter(
                        (candidate) =>
                          candidate.branch === "shots" &&
                          candidate.reviewed &&
                          `${candidate.targetPath}#${candidate.targetAnchor}` ===
                            target &&
                          !(
                            candidate.sourcePath === binding.sourcePath &&
                            candidate.exportName === binding.exportName
                          ),
                      ).map((candidate) => ({
                        path: candidate.sourcePath,
                        export: candidate.exportName,
                        digest: candidate.sourceDigest,
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
      const film = assembleFilm({
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
    const inputFingerprint = productionBuildInputFingerprint(
      this.project.productionId,
      graph,
      sourceFields,
      contentFields,
    );
    let filmArtifacts: ReturnType<typeof materializeFilmArtifacts> | null =
      null;
    if (compiledFilm !== null && filmSourceDigest !== null)
      try {
        filmArtifacts = materializeFilmArtifacts(
          compiledFilm,
          filmSourceDigest,
          inputFingerprint,
          graph.production!,
          graph.world!,
          compiled,
        );
      } catch (error) {
        // The film-effect runtime throws nothing but its typed Error refusal.
        diagnostics.push(
          filmDiagnostic("film-effect-cue-invalid", (error as Error).message),
        );
      }
    const inputCurrent = (): boolean => {
      try {
        const currentAuthoring =
          this.currentAuthoringEvidence === undefined
            ? this.authoringEvidence
            : this.currentAuthoringEvidence();
        return (
          `${this.project.revision()}\0${currentAutoMovieProductionBuildInputFingerprintWithEvidence(this.project, input.scope, currentAuthoring)}\0${this.project.revision()}` ===
          `${inputRevision}\0${inputFingerprint}\0${inputRevision}`
        );
      } catch {
        return false;
      }
    };
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
              owner: "builder" as const,
              digest: digestAutoMovieBytes(bytes),
              sourceTargets: sourceTargetsOf(file, graph),
            }))
            .sort((left, right) => compareCodeUnits(left.path, right.path));
    const manifest: IAutoMovieGeneratedManifest | null =
      files === null
        ? null
        : {
            version: 1,
            builder: {
              packageVersion: AUTOMOVIE_PRODUCTION_BUILD_VERSION,
              protocolVersion: AUTOMOVIE_PRODUCTION_BUILD_PROTOCOL,
            },
            inputFingerprint,
            files: entries,
          };
    if (manifest !== null)
      diagnostics.push(
        ...this.generatedOwnershipDiagnostics(manifest, materialize),
      );
    if (timedAuthoring.kind === "brief" && screenplay !== null)
      diagnostics.push({
        code: "screenplay-index-forbidden",
        category: "error",
        phase: "design",
        target: "screenplay",
        path: null,
        message:
          "A direct brief cannot carry a film screenplay index. Remove the forbidden narrative residue and keep delivery, shot, and observation ownership in the reviewed brief.",
      });
    if (timedAuthoring.screenplayRequired)
      diagnostics.push(
        ...screenplayResidencyDiagnostics({
          contracts: graph.shots,
          screenplay,
        }),
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
      );
    diagnostics.push(
      ...shotDeterminismDiagnostics({
        contracts: graph.shots,
        read: (relative) => this.project.readProseDocument(relative),
      }),
    );
    if (input.scope !== "design" && timedAuthoring.screenplayRequired)
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
    if (input.scope === "final")
      diagnostics.push(
        ...finalDeliverableDiagnostics(
          this.project,
          graph.production,
          inputFingerprint,
          graph.shots,
          compiled,
          this.finalRenderPlan,
        ),
      );
    // Both production shapes close image uses over their admitted output.
    if (input.scope !== "design" && compiled.size !== 0)
      diagnostics.push(
        ...productionTextureClosureDiagnostics({
          production: graph.production?.id ?? this.project.productionId,
          models: [...compiled.values()].flatMap((shot) => shot.models),
          environments: [...compiled.values()].flatMap(
            (shot) => shot.builtEnvironments ?? [],
          ),
          scenes: [...compiled.values()].map((shot) => ({
            shot: shot.shot.id,
            environment: shot.scene.environment,
          })),
          assets: assetRecords,
          content: contentInputs ?? [],
        }),
      );
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
    const inputRaceFailure = (message: string): IAutoMovieBuildProjectOutput =>
      this.inputRaceFailure({ diagnostics, inputFingerprint, message });
    const confirmInputSnapshot = (): IAutoMovieBuildProjectOutput | null =>
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
          builder: {
            version: AUTOMOVIE_PRODUCTION_BUILD_VERSION,
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
          builder: {
            version: AUTOMOVIE_PRODUCTION_BUILD_VERSION,
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
          builder: {
            version: AUTOMOVIE_PRODUCTION_BUILD_VERSION,
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
      builder: {
        version: AUTOMOVIE_PRODUCTION_BUILD_VERSION,
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
   * validated by the engine and published atomically as builder-owned bytes.
   *
   * The order matters. The built environments this run produced are what the
   * review consumer derives its required observation population from, so they
   * are handed over from memory rather than read back from the tree: an owner
   * whose building the compile just refused must not be charged observations
   * against a stale copy of it, and an owner whose building it accepted must be
   * charged them whether or not anything has been written yet.
   */
  private runLibrary(
    input: IAutoMovieBuildProjectInput,
    materialize: boolean,
    initialAuthoring: IAutoMovieProductionEvidence,
  ): IAutoMovieBuildProjectOutput {
    // The dispatcher selects this path from the evidence it already holds, so
    // the only question left is whether a fresher reading is available.
    const authoring =
      this.currentAuthoringEvidence === undefined
        ? initialAuthoring
        : this.currentAuthoringEvidence();
    const inputRevision = this.project.revision();
    const snapshot = captureAutoMovieLibraryAuthoringSnapshot({
      root: this.project.root,
      evidence: authoring,
      readSource: (source) => this.project.readSource(source),
    });
    const snapshotAuthoring: IAutoMovieProductionEvidence = {
      ...authoring,
      configuration: snapshot.configuration,
      manifest: snapshot.manifest,
      designBranches: snapshot.designBranches,
      designOwners: snapshot.designOwners,
      sourceOwners: snapshot.sourceOwners,
    };
    const requireReviewed = input.scope === "review" || input.scope === "final";
    const execution = createAutoMovieLibrarySourceExecutionPlan(
      snapshot,
      requireReviewed,
    );
    const sources = snapshot.sources.map((source) => source.path);
    const derived = this.libraryDerivedInputs(input.scope !== "design");
    const inputFingerprint = this.libraryInputFingerprint(
      snapshot,
      derived.fields,
    );
    const diagnostics: IAutoMovieDiagnostic[] = [...derived.diagnostics];
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
    for (const owner of snapshotAuthoring.designOwners)
      for (const unit of owner.units) {
        const address = `${owner.path}#${unit.anchor}`;
        units.set(address, {
          production: this.project.productionId,
          branch: owner.branch,
          design: owner.path,
          anchor: unit.anchor,
          derivedArtifacts: derived.artifacts,
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
          derivedArtifacts: derived.artifacts,
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
    if (
      input.scope !== "design" &&
      derived.diagnostics.every((item) => item.category !== "error")
    )
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
        const compiled = buildLibrarySource({
          path: source,
          source: text,
          sourceRoot: this.project.root,
          context: (design) => units.get(design) ?? null,
          admit: (exportName, design) =>
            resolveAutoMovieSourceOwnerBinding({
              bindings: snapshotAuthoring.sourceOwners,
              // Admission runs only for a design `context` resolved from the
              // same owner population, so the branch is always recorded.
              branch: sourceBranchByDesign.get(design)!,
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
      for (const owner of [...snapshotAuthoring.designOwners].sort(
        (left, right) => compareCodeUnits(left.path, right.path),
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

    if (input.scope !== "design")
      diagnostics.push(
        ...productionTextureClosureDiagnostics({
          production: this.project.productionId,
          models: results.flatMap((result) => result.contribution.models),
          environments: results.flatMap(
            (result) => result.contribution.environments,
          ),
          scenes: [],
          assets: derived.assets,
          content: derived.content,
        }),
      );

    const publication =
      input.scope === "design"
        ? null
        : materializeAutoMovieLibraryFiles({
            production: this.project.productionId,
            builder: AUTOMOVIE_PRODUCTION_BUILD_PROTOCOL,
            inputFingerprint,
            results,
          });
    const entries: IAutoMovieGeneratedFile[] =
      publication === null
        ? []
        : [...publication.files]
            .map(([file, bytes]) => ({
              path: file,
              owner: "builder" as const,
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
            builder: {
              packageVersion: AUTOMOVIE_PRODUCTION_BUILD_VERSION,
              protocolVersion: AUTOMOVIE_PRODUCTION_BUILD_PROTOCOL,
            },
            inputFingerprint,
            files: entries,
          };
    if (manifest !== null)
      diagnostics.push(
        ...this.generatedOwnershipDiagnostics(manifest, materialize),
      );

    diagnostics.sort(compareDiagnostics);

    const inputCurrent = (): boolean => {
      if (this.currentAuthoringEvidence === undefined) return false;
      try {
        return (
          sameAutoMovieLibraryAuthoringSnapshot(
            snapshot,
            captureAutoMovieLibraryAuthoringSnapshot({
              root: this.project.root,
              evidence: this.currentAuthoringEvidence(),
              readSource: (source) => this.project.readSource(source),
            }),
          ) &&
          this.libraryInputFingerprint(
            snapshot,
            this.libraryDerivedInputs(input.scope !== "design").fields,
          ) === inputFingerprint
        );
      } catch {
        return false;
      }
    };
    const builder = {
      version: AUTOMOVIE_PRODUCTION_BUILD_VERSION,
      inputFingerprint,
    };
    const confirmInputSnapshot = (): IAutoMovieBuildProjectOutput | null =>
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
          builder,
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
      builder,
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
   * The builder input identity of one library, recomputed on demand.
   *
   * A library's inputs include the authoring declaration, selected source bytes,
   * content inventory and verified derivation closure. The same read answers
   * both the result identity and the atomic publication's concurrent-edit guard.
   */
  private libraryInputFingerprint(
    snapshot: IAutoMovieLibraryAuthoringSnapshot,
    derivedFields: readonly IAutoMovieFingerprintField[],
  ): AutoMovieContentDigest {
    return fingerprintAutoMovieFields([
      ...derivedFields,
      {
        role: "library:builder",
        kind: AUTOMOVIE_PRODUCTION_BUILD_PROTOCOL,
        payload: canonicalAutoMovieJsonBytes({
          version: AUTOMOVIE_PRODUCTION_BUILD_VERSION,
          authoringSnapshot: snapshot.digest,
        }),
      },
    ]);
  }

  /** Read the same verified content closure for execution and publication. */
  private libraryDerivedInputs(enabled: boolean): {
    artifacts: Readonly<Record<string, IAutoMovieDerivedArtifactSource>>;
    fields: IAutoMovieFingerprintField[];
    diagnostics: IAutoMovieDiagnostic[];
    assets: IAutoMovieAssetProvenance[];
    content: IAutoMovieProductionContentInput[];
  } {
    const fields: IAutoMovieFingerprintField[] = [];
    const diagnostics: IAutoMovieDiagnostic[] = [];
    let assets: IAutoMovieAssetProvenance[] = [];
    let content: IAutoMovieProductionContentInput[] = [];
    if (!enabled)
      return { artifacts: {}, fields, diagnostics, assets, content };
    const manifest = this.project.manifest();
    let externalAssetPaths: string[] = [];
    try {
      content = this.project.contentInputs();
      fields.push(...contentFingerprintFields(content));
      const inventory = productionAssetInventory(
        manifest.assetManifest,
        content,
        this.project.productionId,
        this.project.graph(),
        this.project.archetypes,
      );
      assets = inventory.records;
      externalAssetPaths = assets.map((asset) => asset.path);
      diagnostics.push(...inventory.diagnostics);
    } catch (error) {
      fields.push({
        role: "content:inventory",
        kind: "unsafe",
        payload: new Uint8Array(),
      });
      diagnostics.push({
        code: "content-input-unsafe",
        category: "error",
        phase: "source",
        target: "declared-content",
        path: null,
        message: errorMessage(error),
      });
    }
    const inspection = inspectAutoMovieDerivedArtifacts({
      root: this.project.root,
      manifestPath: manifest.derivedArtifactManifest,
      externalAssetPaths,
    });
    fields.push(...inspection.fingerprintFields);
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
    return {
      artifacts: inspection.artifacts,
      fields,
      diagnostics,
      assets,
      content,
    };
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
          message: `Library ${kind} "${id}" is published by both "${previous}" and "${props.registration.design}". Give every published ${kind} one owner; two owners write one builder-owned file twice.`,
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
   * Publish the refusal a builder-input race produces.
   *
   * Both shapes end here rather than carrying a copy each. What raced is the
   * same fact whichever gate noticed it, and a second spelling of the message
   * would be a second answer to "what does a caller do about this".
   */
  private inputRaceFailure(props: {
    diagnostics: IAutoMovieDiagnostic[];
    inputFingerprint: AutoMovieContentDigest;
    message: string;
  }): IAutoMovieBuildProjectOutput {
    props.diagnostics.push({
      code: "compile-input-changed",
      category: "error",
      phase: "compile",
      target: "builder-input",
      path: null,
      message: `${props.message} Re-run the scaffold compile command against the current design, source, and declared content snapshot.`,
    });
    props.diagnostics.sort(compareDiagnostics);
    return {
      success: false,
      revision: this.project.revision(),
      builder: {
        version: AUTOMOVIE_PRODUCTION_BUILD_VERSION,
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
  }): IAutoMovieBuildProjectOutput | null {
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
          ? "Compiler-owned output has no generated manifest. The builder will publish the exact current ownership manifest with the derived files."
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
              ? `Generated file "${relative}" belonged to the prior builder result but is absent from the current result. The builder will remove it.`
              : `Generated file "${relative}" is stale output from a different compile. Run the scaffold compile command to remove it.`
            : `Generated file "${relative}" is not the canonical output derived from current source and design. Remove it before running the builder.`,
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
                : `Generated file "${entry.path}" is unsafe. Remove the link before running the builder.`,
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
            ? `Generated digest is ${String(actual)} but current source and design derive ${entry.digest}. The builder will regenerate this builder-owned file.`
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
          ? `Generated input ${manifest.inputFingerprint} differs from current ${expected.inputFingerprint}. The builder will refresh all builder-owned output.`
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
          ? "The generated manifest does not exactly match builder-derived inventory, digests, identity, and provenance. The builder will replace it."
          : "The generated manifest does not exactly match builder-derived inventory, digests, identity, and provenance. Run the scaffold compile command before trusting generated output.",
      });
    return diagnostics;
  }
}
