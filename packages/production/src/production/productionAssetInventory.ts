import {
  importedNodeClipToAutoMovieMotion,
  unsupportedAutoMovieMaterialExtensions,
} from "@automovie/engine";
import {
  adoptAutoMovieExternalMotion,
  inspectAutoMovieExternalModelBytes,
} from "@automovie/ingest";
import {
  AutoMovieContentDigest,
  AutoMovieDiagnosticCode,
  AutoMovieHumanoidBone,
  IAutoMovieAssetManifest,
  IAutoMovieAssetProvenance,
  IAutoMovieDiagnostic,
  IAutoMovieExternalMotionBasis,
  IAutoMovieExternalMotionConversionReceipt,
  IAutoMovieFilmEdit,
  IAutoMovieGeneratedCollisionProxy,
  IAutoMovieGeneratedMeasurementProxy,
  IAutoMovieModelProxyAsset,
  IAutoMovieModelRecipe,
  IAutoMovieProductionManifest,
} from "@automovie/interface";
import path from "node:path";
import typia from "typia";

import { IAutoMovieProductionContentInput } from "./AutoMovieProductionProject";
import { assetUrlAdmissionRefusal } from "./assetAcquisition";
import {
  canonicalAutoMovieJsonBytes,
  compareCodeUnits,
  digestAutoMovieBytes,
} from "./contentIdentity";
import { parseAutoMovieStructuredJson } from "./duplicateAwareJson";
import { IAutoMovieExternalModelRuntimeBinding } from "./materializeProduction";
import { AutoMovieModelArchetypeRegistry } from "./productionArchetypes";
import { errorMessage } from "./productionBuildDiagnostics";
import { IProductionExternalMotionAdoption } from "./productionExternalMotion";
import { filmDiagnostic } from "./productionFilmAssembly";
import { IAutoMovieProductionDesignGraph } from "./validateProductionDesign";

/** Resolve declared asset bytes into model and motion inputs with their consuming targets.
 * @evidence requirements/external-inputs/credentials-rights-and-provenance.md#external-provenance-derivation-consumers Resolves registered asset bytes to their declared consuming model or motion.
 * @evidence requirements/external-inputs/credentials-rights-and-provenance.md#external-provenance-source-record Preserves the selected asset path and byte identity.
 * @evidence specifications/interchange-and-adoption/provenance-rights-and-secrets.md#interchange-derivation-consumer-reachability Checks the consuming target while adopting model and motion inputs.
 * @evidence specifications/interchange-and-adoption/provenance-rights-and-secrets.md#interchange-source-provenance-snapshot Carries the asset byte snapshot into its runtime binding.
 */
export const productionAssetInventory = (
  manifestPath: IAutoMovieProductionManifest["assetManifest"],
  inputs: readonly IAutoMovieProductionContentInput[],
  productionId: string,
  graph: IAutoMovieProductionDesignGraph,
  archetypes: AutoMovieModelArchetypeRegistry,
): {
  assets: string[];
  records: IAutoMovieAssetProvenance[];
  externalModels: Map<string, IAutoMovieExternalModelRuntimeBinding>;
  externalMotions: Map<string, IProductionExternalMotionAdoption>;
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
   * Report something the builder cannot restate without refusing the asset.
   *
   * Compilation succeeds when no diagnostic is an `error`, so this states a
   * fact the author should know while leaving the decision with them. Refusing
   * a licensed model because it carries a material lobe this engine has no
   * field for would be the builder deciding what art a production may buy.
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
    decoded = parseAutoMovieStructuredJson({
      record: "asset-manifest",
      bytes: manifestInput.bytes,
    });
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
        .join("; ")}. Correct the typed asset manifest before compiling.`,
    );
    return {
      assets: [],
      records: [],
      externalModels: new Map(),
      externalMotions: new Map(),
      diagnostics,
    };
  }

  const records = validation.data.assets;
  validation.data.assets = [];
  for (const asset of records) {
    const refusal = assetUrlAdmissionRefusal(asset);
    if (refusal === null) {
      validation.data.assets.push(asset);
      continue;
    }
    diagnostic(
      "asset-provenance-incomplete",
      asset.path,
      `Asset "${asset.path}" ${refusal.field} locator contains credentials. Remove the secret from the asset metadata.`,
    );
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
        `Manifest digest ${asset.digest} does not match current bytes ${digestAutoMovieBytes(input.bytes)}. Register the current asset bytes or restore the intended revision.`,
      );
    if (
      isSha256Digest(asset.digest) === false ||
      asset.uses.length === 0 ||
      asset.uses.some(assetUseIncomplete) ||
      (asset.processing ?? []).some(assetProcessingStepIncomplete)
    )
      diagnostic(
        "asset-provenance-incomplete",
        asset.path,
        `Asset "${asset.path}" has an invalid current SHA-256, consumer binding, or supplied processing step. Correct the asset record before compiling.`,
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
        use.consumer.kind !== "material-texture" &&
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
  const externalMotions = new Map<string, IProductionExternalMotionAdoption>();
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
        `External motion adoption "${declaration.id}" is invalid: ${errorMessage(error)} Correct the selected take, source rig, mapping, or mode; the builder will not infer a replacement.`,
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
      parseAutoMovieStructuredJson({
        record: "model-proxy-asset",
        bytes: input.bytes,
      }),
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
  step: NonNullable<IAutoMovieAssetProvenance["processing"]>[number],
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

/** Check that compiled scene consumers agree with the declared asset use. */
export const validateCompiledAssetUses = (
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

const isExternalModelAsset = (value: string): boolean =>
  [".gltf", ".glb", ".vrm"].includes(path.extname(value).toLowerCase());
