import {
  IAutoMovieAssetProvenance,
  IAutoMovieMaterial,
  IAutoMovieModel,
  IAutoMovieSceneEnvironment,
  IAutoMovieTextureReference,
  IAutoMovieValidation,
} from "@automovie/interface";

import { compareCodeUnits } from "../text/compareCodeUnits";
import { ViolationCollector } from "./violation";

/**
 * Image facts read from an asset's own bytes, never from its file name.
 *
 * A manifest can claim anything; a PNG signature cannot. The compiler hands
 * these in so this validator stays a pure function of facts, and so the same
 * closure runs against probed bytes in the compiler and against fixed facts in
 * a test.
 *
 * @evidence requirements/asset-authoring/validation.md#asset-surface-validation `IAutoMovieTextureImageFacts` carries the byte-proven format and dimensions used to validate a sampled surface image.
 * @evidence specifications/asset-and-representation/model-geometry-and-surface-facts.md#asset-spec-model-output-failures `IAutoMovieTextureImageFacts` provides the observed image facts required to reject unresolved or incompatible surface resources.
 */
export interface IAutoMovieTextureImageFacts {
  /**
   * IANA media type the bytes themselves prove.
   *
   * @evidence requirements/asset-authoring/validation.md#asset-surface-validation `mediaType` records the IANA image format proved by the asset bytes before channel use is accepted.
   * @evidence specifications/asset-and-representation/model-geometry-and-surface-facts.md#asset-spec-model-output-failures `mediaType` supplies the observed container identity checked against the texture or environment consumer's accepted set.
   */
  mediaType: AutoMovieTextureMediaType;
  /**
   * Pixel width, a positive integer.
   *
   * @evidence requirements/asset-authoring/validation.md#asset-surface-validation `width` records the byte-proven horizontal pixel count used to detect an unusable surface image.
   * @evidence specifications/asset-and-representation/model-geometry-and-surface-facts.md#asset-spec-model-output-failures `width` provides the measured edge checked for positivity and the portable sampling limit.
   */
  width: number;
  /**
   * Pixel height, a positive integer.
   *
   * @evidence requirements/asset-authoring/validation.md#asset-surface-validation `height` records the byte-proven vertical pixel count used to detect an unusable surface image.
   * @evidence specifications/asset-and-representation/model-geometry-and-surface-facts.md#asset-spec-model-output-failures `height` provides the independent vertical edge measurement enforced before model output is accepted.
   */
  height: number;
}

/**
 * Every image container a texture or environment asset may actually be.
 *
 * @evidence requirements/asset-authoring/validation.md#asset-surface-validation `AutoMovieTextureMediaType` enumerates the actual image containers whose channels can enter texture and environment validation.
 * @evidence specifications/asset-and-representation/model-geometry-and-surface-facts.md#asset-spec-model-output-failures `AutoMovieTextureMediaType` bounds format interpretation to named byte containers instead of trusting a file extension.
 */
export type AutoMovieTextureMediaType =
  | "image/png"
  | "image/jpeg"
  | "image/webp"
  | "image/vnd.radiance";

/**
 * The largest edge a portable target is required to sample.
 *
 * WebGL 2 guarantees `MAX_TEXTURE_SIZE >= 2048` and desktop GPUs report 16384,
 * but a 16k tile is not a finish decision, it is a download nobody meant to
 * ship. 8192 is the widest edge every currently targeted browser/GPU pair in
 * this project's capture matrix samples without a driver-side rescale, so it is
 * the bound a production is held to rather than the bound a driver happens to
 * allow.
 *
 * @evidence requirements/asset-authoring/validation.md#asset-surface-validation `AUTO_MOVIE_MAX_TEXTURE_EDGE` fixes the largest image dimension accepted by the portable surface-sampling contract.
 * @evidence specifications/asset-and-representation/model-geometry-and-surface-facts.md#asset-spec-model-output-failures `AUTO_MOVIE_MAX_TEXTURE_EDGE` supplies the expected bound reported beside an oversized width or height observation.
 */
export const AUTO_MOVIE_MAX_TEXTURE_EDGE = 8192;

/** Media types a material's PBR slot may bind. */
const MATERIAL_MEDIA: ReadonlySet<AutoMovieTextureMediaType> = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
]);

/** Media types a scene environment may bind. */
const ENVIRONMENT_MEDIA: ReadonlySet<AutoMovieTextureMediaType> = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/vnd.radiance",
]);

/**
 * One compiled shot's scene environment, addressed by the shot that owns it.
 *
 * @evidence requirements/asset-authoring/validation.md#asset-surface-validation `IAutoMovieSceneEnvironmentUse` attaches one environment image declaration to the exact compiled shot that samples it.
 * @evidence specifications/asset-and-representation/model-geometry-and-surface-facts.md#asset-spec-model-output-failures `IAutoMovieSceneEnvironmentUse` provides the consumer scope needed to locate missing or multiply interpreted lighting resources.
 */
export interface IAutoMovieSceneEnvironmentUse {
  /**
   * Exact shot id.
   *
   * @evidence requirements/asset-authoring/validation.md#asset-surface-validation `shot` names the compiled shot whose image-lighting use is being validated.
   * @evidence specifications/asset-and-representation/model-geometry-and-surface-facts.md#asset-spec-model-output-failures `shot` supplies the stable consumer identity included in an environment-resource failure path.
   */
  shot: string;
  /**
   * The scene's declared environment, or null/undefined when it declares none.
   *
   * @evidence requirements/asset-authoring/validation.md#asset-surface-validation `environment` carries the optional lighting image and interpretation selected by the owning scene.
   * @evidence specifications/asset-and-representation/model-geometry-and-surface-facts.md#asset-spec-model-output-failures `environment` distinguishes an absent use from a declared image whose resource closure must resolve.
   */
  environment?: IAutoMovieSceneEnvironment | null;
}

/**
 * Everything the texture closure is decided against.
 *
 * @evidence requirements/asset-authoring/validation.md#asset-surface-validation `IAutoMovieTextureClosureInput` gathers every material and environment image use with the ledger and byte facts that authorize it.
 * @evidence specifications/asset-and-representation/model-geometry-and-surface-facts.md#asset-spec-model-output-failures `IAutoMovieTextureClosureInput` defines the complete resource-closure scope checked for missing, unused, or conflicting surface assets.
 */
export interface IAutoMovieTextureClosureInput {
  /**
   * Exact production id whose ledger entries authorize these uses.
   *
   * @evidence requirements/asset-authoring/validation.md#asset-surface-validation `production` names the production whose provenance ledger is allowed to authorize the sampled images.
   * @evidence specifications/asset-and-representation/model-geometry-and-surface-facts.md#asset-spec-model-output-failures `production` supplies the ownership identity checked against each registered asset record.
   */
  production: string;
  /**
   * Compiled models whose materials bind PBR images.
   *
   * @evidence requirements/asset-authoring/validation.md#asset-surface-validation `models` identifies the compiled material slots that actually sample each PBR image.
   * @evidence specifications/asset-and-representation/model-geometry-and-surface-facts.md#asset-spec-model-output-failures `models` provides model, material, and texture-member paths for locating unresolved surface resources.
   */
  models: readonly IAutoMovieModel[];
  /**
   * Compiled shots whose scenes bind image lighting.
   *
   * @evidence requirements/asset-authoring/validation.md#asset-surface-validation `scenes` identifies the shot-owned environment declarations that sample image lighting.
   * @evidence specifications/asset-and-representation/model-geometry-and-surface-facts.md#asset-spec-model-output-failures `scenes` provides shot and environment paths for failures outside model material bindings.
   */
  scenes: readonly IAutoMovieSceneEnvironmentUse[];
  /**
   * The project asset ledger, exactly as the manifest holds it.
   *
   * @evidence requirements/asset-authoring/validation.md#asset-surface-validation `assets` carries the manifest ledger entries against which every sampled image path is authorized.
   * @evidence specifications/asset-and-representation/model-geometry-and-surface-facts.md#asset-spec-model-output-failures `assets` supplies ownership, kind, and declared-use facts for missing-use and unused-resource decisions.
   */
  assets: readonly IAutoMovieAssetProvenance[];
  /**
   * Image facts for one registered asset path, or `undefined` when the compiler
   * could not read the bytes as an image at all.
   *
   * @evidence requirements/asset-authoring/validation.md#asset-surface-validation `facts` resolves one asset path to the media type and dimensions proved by its bytes.
   * @evidence specifications/asset-and-representation/model-geometry-and-surface-facts.md#asset-spec-model-output-failures `facts` leaves an unreadable image unresolved so the validator rejects it instead of inventing metadata.
   */
  facts: (asset: string) => IAutoMovieTextureImageFacts | undefined;
}

/**
 * Close the loop between what a compiled production SAMPLES and what its asset
 * ledger AUTHORIZES.
 *
 * Four different lies are possible once materials name images, and the manifest
 * alone catches none of them:
 *
 * 1. A material binds an image the ledger never heard of, so nothing verifies its
 *    licence, its origin, or its bytes;
 * 2. The ledger authorizes an image for a model or shot that no longer binds it,
 *    so a stale entry keeps a file in the distributable forever;
 * 3. The bytes are not the image they are used as: a renamed `.png` that is really
 *    a PDF, or a Radiance HDR bound as a base-color map;
 * 4. Two consumers bind the same bytes under contradictory color-space intent, so
 *    the same pixels are both a colour and a measurement and one of the two is
 *    silently wrong. A material slot states its intent; a scene environment
 *    takes it from its proven media, because an equirectangular image is always
 *    a colour and only its container says how that colour is stored.
 *
 * Byte identity itself is NOT rechecked here. The manifest gate already digests
 * every registered asset against its resident bytes, and repeating that would
 * be a second copy of a rule with an owner. What this adds is the reason that
 * gate applies at all: an image nobody registered is an image nobody digests.
 *
 * @evidence requirements/asset-authoring/validation.md#asset-surface-validation Verifies every sampled texture is registered with matching image facts and intent.
 * @evidence specifications/asset-and-representation/model-geometry-and-surface-facts.md#asset-spec-model-output-failures Rejects missing, unused, mismatched, and multiply interpreted surface resources before model output is accepted.
 * @evidence requirements/external-inputs/identity-coordinates-and-units.md#external-identity-value-interpretation `validateTextureAssets` keeps sRGB color slots, linear measurement slots, and Radiance environment intent explicit and rejects one image used under contradictory interpretations.
 * @evidence specifications/interchange-and-adoption/identity-coordinates-and-units.md#interchange-value-interpretation-layer The texture gate validates the Engine's image color-space and channel-role subset without claiming general raster, audio, no-data, or scalar-unit interpretation.
 * @evidence requirements/external-inputs/resource-closure-and-acquisition.md#external-resource-media-dependencies `validateTextureAssets` resolves every sampled material or environment image through its typed asset-ledger use and byte-proven image facts and rejects missing or stale uses.
 * @evidence specifications/interchange-and-adoption/resource-closure-and-acquisition.md#interchange-media-dependency-extraction The validator closes the Engine's material-texture and scene-environment dependency subset; archive, stream, sidecar, and network closure remain upstream.
 * @evidence requirements/external-inputs/unsupported-and-degradation.md#external-unsupported-format-feature `validateTextureAssets` distinguishes a readable image container from suitability for a material or environment consumer and rejects the unsupported image/material combination.
 * @evidence specifications/interchange-and-adoption/support-degradation-and-refusal.md#interchange-format-feature-support-matrix The texture gate evaluates byte-proven container type against the selected Engine consumer's accepted image subset instead of treating parser recognition as universal support.
 * @evidence requirements/external-inputs/identity-coordinates-and-units.md#external-identity-collision-ambiguity `validateTextureAssets` rejects a shared image whose material and environment bindings demand competing color-space interpretations rather than selecting one by traversal order.
 * @evidence specifications/interchange-and-adoption/identity-coordinates-and-units.md#interchange-identity-ambiguity-refusal The validator reports every conflicting binding path and blocks the ambiguous image interpretation without choosing a silent winner.
 * @author Samchon
 */
export const validateTextureAssets = (
  props: IAutoMovieTextureClosureInput,
): IAutoMovieValidation => {
  const out = new ViolationCollector();
  const records = new Map(props.assets.map((asset) => [asset.path, asset]));

  // What the compiled production actually samples, per consumer.
  const declared = new Map<string, Set<string>>();
  const claim = (kind: string, id: string, asset: string): void => {
    const key = `${kind}\0${id}`;
    const existing = declared.get(key);
    if (existing === undefined) declared.set(key, new Set([asset]));
    else existing.add(asset);
  };

  const intents = new Map<string, Map<string, string>>();
  const intend = (asset: string, path: string, intent: string): void => {
    const seen = intents.get(asset) ?? new Map<string, string>();
    seen.set(path, intent);
    intents.set(asset, seen);
  };
  props.models.forEach((model, modelIndex) => {
    model.materials.forEach((material, materialIndex) => {
      const path = `$input.models[${modelIndex}].materials[${materialIndex}]`;
      for (const slot of MATERIAL_SLOTS) {
        const binding = material[slot.field];
        if (binding === null || binding === undefined) continue;
        const asset = bindingAsset(binding);
        claim("material-texture", model.id, asset);
        intend(
          asset,
          `${path}.${slot.field}`,
          typeof binding === "string" ? slot.colorSpace : binding.colorSpace,
        );
        checkAsset({
          asset,
          path: `${path}.${slot.field}`,
          consumer: { kind: "material-texture", id: model.id },
          media: MATERIAL_MEDIA,
          out,
          input: props,
          records,
        });
      }
    });
  });

  props.scenes.forEach((scene, sceneIndex) => {
    const image = scene.environment?.image ?? null;
    if (image === null) return;
    const path = `$input.scenes[${sceneIndex}].environment.image`;
    claim("scene-environment", scene.shot, image);
    checkAsset({
      asset: image,
      path,
      consumer: { kind: "scene-environment", id: scene.shot },
      media: ENVIRONMENT_MEDIA,
      out,
      input: props,
      records,
    });
    // An environment image declares no intent of its own, so the media its own
    // bytes prove decides one, and that intent joins the same contradiction
    // rule the material slots answer to. Bytes that read as no image at all are
    // already reported above; inventing a decoding for them would only add a
    // second complaint about the same file.
    const facts = props.facts(image);
    if (facts !== undefined) intend(image, path, environmentIntent(facts));
  });

  // The same bytes cannot be both a colour and a measurement.
  for (const [asset, slots] of intents) {
    const distinct = new Set(slots.values());
    if (distinct.size < 2) continue;
    for (const [path, intent] of slots)
      out.push(
        "type",
        path,
        `texture asset "${asset}" is bound with contradictory color-space intent (${[...distinct].sort(compareCodeUnits).join(" and ")}); register one image per decoding`,
        intent,
      );
  }

  // A ledger entry for a consumer that no longer samples it.
  props.assets.forEach((asset, assetIndex) => {
    asset.uses.forEach((use, useIndex) => {
      if (use.production !== props.production) return;
      if (
        use.consumer.kind !== "material-texture" &&
        use.consumer.kind !== "scene-environment"
      )
        return;
      const key = `${use.consumer.kind}\0${use.consumer.id}`;
      if (declared.get(key)?.has(asset.path) === true) return;
      out.push(
        "type",
        `$input.assets[${assetIndex}].uses[${useIndex}]`,
        `asset "${asset.path}" is authorized as a ${use.consumer.kind} of "${use.consumer.id}", which no longer binds it; drop the stale use`,
        use.consumer,
      );
    });
  });

  return out.toValidation();
};

/** The one asset id a legacy or structured binding names. */
const bindingAsset = (binding: string | IAutoMovieTextureReference): string =>
  typeof binding === "string" ? binding : binding.asset;

/**
 * The one decoding an equirectangular environment image can mean.
 *
 * A material slot states its intent because one image can be either a colour or
 * a measurement; an environment image is always a colour, and only its
 * container says how that colour is stored. Radiance holds linear radiance
 * already, which is why it is the container an HDR sky arrives in; the three
 * 8-bit containers hold sRGB-encoded texels, which is what the viewer decodes
 * them as. Deriving it here rather than asking the author for it keeps the
 * bytes the single authority, and lets an image bound both as image lighting
 * and as a linear material map be refused like any other contradiction.
 */
const environmentIntent = (
  facts: IAutoMovieTextureImageFacts,
): "srgb" | "linear" =>
  facts.mediaType === "image/vnd.radiance" ? "linear" : "srgb";

/**
 * The PBR slots that bind an image, with the decoding each one requires.
 *
 * A legacy bare-id binding declares no intent, so the slot's own requirement is
 * what it means: base colour and emissive are radiometric colours stored in
 * sRGB, and the three data maps are measurements that must not be gamma
 * decoded.
 */
const MATERIAL_SLOTS: ReadonlyArray<{
  field: keyof IAutoMovieMaterial &
    (
      | "baseColorTexture"
      | "metallicRoughnessTexture"
      | "normalTexture"
      | "occlusionTexture"
      | "emissiveTexture"
    );
  colorSpace: "srgb" | "linear";
}> = [
  { field: "baseColorTexture", colorSpace: "srgb" },
  { field: "metallicRoughnessTexture", colorSpace: "linear" },
  { field: "normalTexture", colorSpace: "linear" },
  { field: "occlusionTexture", colorSpace: "linear" },
  { field: "emissiveTexture", colorSpace: "srgb" },
];

/** Registration, authorization, media, and dimension for one cited asset. */
const checkAsset = (props: {
  asset: string;
  path: string;
  consumer: { kind: "material-texture" | "scene-environment"; id: string };
  media: ReadonlySet<AutoMovieTextureMediaType>;
  out: ViolationCollector;
  input: IAutoMovieTextureClosureInput;
  records: ReadonlyMap<string, IAutoMovieAssetProvenance>;
}): void => {
  const record = props.records.get(props.asset);
  if (record === undefined) {
    props.out.push(
      "type",
      props.path,
      `texture asset "${props.asset}" is not registered in the project asset manifest; register its source, licence, digest and use before compiling`,
      props.asset,
    );
    return;
  }
  if (
    !record.uses.some(
      (use) =>
        use.production === props.input.production &&
        use.consumer.kind === props.consumer.kind &&
        use.consumer.id === props.consumer.id,
    )
  )
    props.out.push(
      "type",
      props.path,
      `asset "${props.asset}" carries no ${props.consumer.kind} use for "${props.consumer.id}" in production "${props.input.production}"; add the exact typed ledger entry`,
      props.consumer.id,
    );
  const facts = props.input.facts(props.asset);
  if (facts === undefined) {
    props.out.push(
      "type",
      props.path,
      `asset "${props.asset}" is bound as an image but its bytes are not a readable PNG, JPEG, WebP or Radiance image`,
      props.asset,
    );
    return;
  }
  if (!props.media.has(facts.mediaType)) {
    props.out.push(
      "type",
      props.path,
      `asset "${props.asset}" is ${facts.mediaType}, which this slot cannot sample; expected one of ${[...props.media].sort(compareCodeUnits).join(", ")}`,
      facts.mediaType,
    );
    return;
  }
  for (const axis of ["width", "height"] as const) {
    const value = facts[axis];
    if (!Number.isSafeInteger(value) || value <= 0)
      props.out.push(
        "range",
        `${props.path}.${axis}`,
        `asset "${props.asset}" reports a ${axis} of ${value}; an image must measure a positive whole number of pixels`,
        value,
      );
    else if (value > AUTO_MOVIE_MAX_TEXTURE_EDGE)
      props.out.push(
        "range",
        `${props.path}.${axis}`,
        `asset "${props.asset}" is ${value} pixels wide on its ${axis}, past the ${AUTO_MOVIE_MAX_TEXTURE_EDGE} portable limit; downscale it in a recorded processing step`,
        value,
      );
  }
};
