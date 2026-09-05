import {
  autoMovieStoryTime,
  resolveProductionFrameRate,
  validateProfileCapabilities,
} from "@automovie/engine";
import {
  AUTOMOVIE_DIAGNOSTIC_CODES,
  AutoMovieDiagnosticCode,
  IAutoMovieAcceptanceScenario,
  IAutoMovieDiagnostic,
  IAutoMovieFormationDesign,
  IAutoMovieModelRecipe,
  IAutoMovieProductionDesign,
  IAutoMovieProductionFrameRate,
  IAutoMovieProfile,
  IAutoMovieShotContract,
  IAutoMovieShotPredicate,
  IAutoMovieWorldDesign,
} from "@automovie/interface";
import path from "node:path";

import { parseAutoMovieCaptionLanguage } from "./captionLanguage";
import {
  compareCodeUnits,
  encodeAutoMoviePathSegment,
} from "./contentIdentity";
import {
  AUTOMOVIE_REGISTERED_ARCHETYPES,
  AutoMovieModelArchetypeRegistry,
  IAutoMovieModelArchetype,
} from "./productionArchetypes";

const AUTOMOVIE_DIAGNOSTIC_CODE_SET = new Set<string>(
  AUTOMOVIE_DIAGNOSTIC_CODES,
);

/**
 * In-memory canonical design graph used for cross-reference validation.
 *
 * @author Samchon
 */
export interface IAutoMovieProductionDesignGraph {
  /**
   * Active production design.
   */
  production: IAutoMovieProductionDesign | null;
  /**
   * Model recipes keyed by id.
   */
  models: ReadonlyMap<string, IAutoMovieModelRecipe>;
  /**
   * Project-shared world design.
   */
  world: IAutoMovieWorldDesign | null;
  /**
   * Formations keyed by id.
   */
  formations: ReadonlyMap<string, IAutoMovieFormationDesign>;
  /**
   * Shot contracts keyed by id.
   */
  shots: ReadonlyMap<string, IAutoMovieShotContract>;
  /**
   * Acceptance scenarios keyed by id.
   */
  acceptance: ReadonlyMap<string, IAutoMovieAcceptanceScenario>;
}

/**
 * Maximum exact production raster accepted by design and frame review.
 *
 * @author Samchon
 * @evidence specifications/editorial-render-and-delivery/render-budget-identity-and-recovery.md#spec-render-raster-admission-bound Fixes the exact pixel-product limit the raster admission compares against, admitting equality and refusing excess.
 */
export const AUTOMOVIE_MAX_FRAME_PIXELS = 16_777_216;
/**
 * Maximum live billboards reserved by one effect recipe.
 *
 * @author Samchon
 */
export const AUTOMOVIE_MAX_EFFECT_PARTICLES = 4_096;
/**
 * Maximum aggregate live billboards across declared effect zones.
 *
 * @author Samchon
 */
export const AUTOMOVIE_EFFECT_PARTICLE_BUDGET = 16_384;
/**
 * Maximum declared effect recipes and placed zones in one world.
 *
 * @author Samchon
 */
export const AUTOMOVIE_EFFECT_DECLARATION_LIMIT = 256;
/**
 * Largest supported absolute metric coordinate in deterministic runtimes.
 *
 * @author Samchon
 */
export const AUTOMOVIE_WORLD_COORDINATE_LIMIT = 1_000_000_000;

/**
 * Maximum compact formation slots in one production.
 *
 * @author Samchon
 */
export const AUTOMOVIE_MAX_FORMATION_MEMBERS = 100_000;
/**
 * Named rigged exceptions remain explicit nodes and source performances.
 *
 * @author Samchon
 */
export const AUTOMOVIE_MAX_FORMATION_HEROES = 256;
/**
 * One 4x4 transform plus one deterministic phase scalar per LOD instance.
 *
 * @author Samchon
 */
export const AUTOMOVIE_FORMATION_INSTANCE_BYTES =
  16 * Float32Array.BYTES_PER_ELEMENT + Float32Array.BYTES_PER_ELEMENT;
/**
 * Maximum aggregate anonymous instance storage across all declared LOD tiers.
 *
 * @author Samchon
 */
export const AUTOMOVIE_FORMATION_INSTANCE_BUFFER_BUDGET_BYTES = 8 * 1024 * 1024;
/**
 * Conservative generated compact-runtime envelope.
 *
 * @author Samchon
 */
export const AUTOMOVIE_FORMATION_RUNTIME_BUDGET_BYTES = 128 * 1024;
/**
 * Maximum general instances retained as compact deterministic world data.
 *
 * @author Samchon
 */
export const AUTOMOVIE_MAX_GENERAL_INSTANCES = 250_000;
/**
 * Maximum per-instance matrix, color, and declared trait storage.
 *
 * @author Samchon
 */
export const AUTOMOVIE_GENERAL_INSTANCE_BUFFER_BUDGET_BYTES = 32 * 1024 * 1024;

/**
 * Validate graph-level production invariants after structural validation.
 *
 * @author Samchon
 * @evidence specifications/editorial-render-and-delivery/render-budget-identity-and-recovery.md#spec-render-budget-preflight Bounds formation members, instances, effect particles and raster before anything is materialized, refusing the design that would exceed them.
 */
export const validateAutoMovieProductionGraph = (
  graph: IAutoMovieProductionDesignGraph,
  productionId: string = graph.production?.id ?? "unbound-production",
  archetypes: AutoMovieModelArchetypeRegistry = AUTOMOVIE_REGISTERED_ARCHETYPES,
): IAutoMovieDiagnostic[] => {
  const diagnostics: IAutoMovieDiagnostic[] = [];
  const productionRoot = `automovie/design/${encodeAutoMoviePathSegment(
    productionId,
  )}`;
  const sharedRoot = "automovie/design/shared";
  const seenDeliverables = new Set<string>();
  if (graph.production !== null) {
    const target = "production";
    const file = `${productionRoot}/production.json`;
    text(diagnostics, graph.production.id, target, file, "id");
    text(diagnostics, graph.production.title, target, file, "title");
    text(diagnostics, graph.production.logline, target, file, "logline");
    positive(
      diagnostics,
      graph.production.targetRuntimeSeconds,
      target,
      file,
      "targetRuntimeSeconds",
    );
    if (
      graph.production.visualDelivery !== "deterministic" &&
      graph.production.visualDelivery !== "repainted" &&
      graph.production.visualDelivery !== "mixed"
    )
      invalid(
        diagnostics,
        "design-enum-invalid",
        target,
        file,
        'visualDelivery must be "deterministic", "repainted", or "mixed". Choose the final visual delivery layer in the tracked production design record.',
      );
    const deliveryLanes = graph.production.visualDeliveryLanes;
    const mixedPolicy = graph.production.mixedVisualDeliveryPolicy;
    if (
      graph.production.visualDelivery === "mixed"
        ? deliveryLanes === undefined ||
          deliveryLanes.length === 0 ||
          new Set(deliveryLanes.map((lane) => lane.occurrence)).size !==
            deliveryLanes.length ||
          deliveryLanes.some(
            (lane) =>
              lane.occurrence.trim().length === 0 ||
              lane.occurrence !== lane.occurrence.trim() ||
              lane.shot.trim().length === 0 ||
              lane.shot !== lane.shot.trim(),
          ) ||
          new Set(deliveryLanes.map((lane) => lane.lane)).size !== 2 ||
          mixedPolicy === undefined ||
          mixedPolicy.version !== 1 ||
          /^sha256:[0-9a-f]{64}$/u.test(mixedPolicy.observationDigest) === false
        : deliveryLanes !== undefined || mixedPolicy !== undefined
    )
      invalid(
        diagnostics,
        "design-enum-invalid",
        target,
        file,
        "Mixed visual delivery requires one unique explicit occurrence-lane population containing both lanes and one versioned aggregate-observation transition policy; all-one-lane shorthand must omit both fields.",
      );
    if (graph.production.storyClock !== undefined)
      text(
        diagnostics,
        graph.production.storyClock.epoch,
        target,
        file,
        "storyClock.epoch",
      );
    integer(
      diagnostics,
      graph.production.frameFormat.width,
      16,
      16_384,
      target,
      file,
      "frameFormat.width",
    );
    integer(
      diagnostics,
      graph.production.frameFormat.height,
      16,
      16_384,
      target,
      file,
      "frameFormat.height",
    );
    if (
      graph.production.frameFormat.width * graph.production.frameFormat.height >
      AUTOMOVIE_MAX_FRAME_PIXELS
    )
      invalid(
        diagnostics,
        "design-range-invalid",
        target,
        file,
        `frameFormat width times height exceeds ${AUTOMOVIE_MAX_FRAME_PIXELS} pixels. Reduce the exact production raster so capture can produce the required review evidence.`,
      );
    positive(
      diagnostics,
      graph.production.frameFormat.fps,
      target,
      file,
      "frameFormat.fps",
    );
    try {
      resolveProductionFrameRate(graph.production.frameFormat);
    } catch (error) {
      invalid(
        diagnostics,
        "design-frame-clock-invalid",
        target,
        file,
        `${error instanceof Error ? error.message : String(error)} Author one exact reduced rational frame rate and an equal display fps, or use a lossless positive integer fps.`,
      );
    }
    const crop = graph.production.frameFormat.crop;
    if (crop !== undefined) {
      bounded(
        diagnostics,
        crop.left,
        0,
        1,
        target,
        file,
        "frameFormat.crop.left",
      );
      bounded(
        diagnostics,
        crop.top,
        0,
        1,
        target,
        file,
        "frameFormat.crop.top",
      );
      bounded(
        diagnostics,
        crop.right,
        0,
        1,
        target,
        file,
        "frameFormat.crop.right",
      );
      bounded(
        diagnostics,
        crop.bottom,
        0,
        1,
        target,
        file,
        "frameFormat.crop.bottom",
      );
      if (
        Number.isFinite(crop.left) &&
        Number.isFinite(crop.top) &&
        Number.isFinite(crop.right) &&
        Number.isFinite(crop.bottom) &&
        (crop.left >= crop.right || crop.top >= crop.bottom)
      )
        invalid(
          diagnostics,
          "design-range-invalid",
          target,
          file,
          "frameFormat.crop must have left < right and top < bottom inside the normalized delivery gate. Correct the crop in the tracked production design record.",
        );
    }
    if (
      Number.isFinite(graph.production.targetRuntimeSeconds) &&
      graph.production.targetRuntimeSeconds > 0 &&
      Number.isFinite(graph.production.frameFormat.fps) &&
      graph.production.frameFormat.fps > 0 &&
      isProductionFrameTime(
        graph.production.targetRuntimeSeconds,
        graph.production.frameFormat.frameRate ??
          graph.production.frameFormat.fps,
      ) === false
    )
      invalid(
        diagnostics,
        "design-frame-clock-invalid",
        target,
        file,
        `targetRuntimeSeconds must land on the ${graph.production.frameFormat.fps}fps production clock. Choose an exact integer frame count divided by fps in the tracked production design record.`,
      );
    if (graph.production.artDirection.palette.length === 0)
      invalid(
        diagnostics,
        "design-collection-empty",
        target,
        file,
        "artDirection.palette must contain at least one color. Add a visual palette in the tracked production design record.",
      );
    uniqueTextValues(
      diagnostics,
      graph.production.artDirection.palette,
      target,
      file,
      "artDirection.palette",
    );
    text(
      diagnostics,
      graph.production.artDirection.silhouettePriority,
      target,
      file,
      "artDirection.silhouettePriority",
    );
    text(
      diagnostics,
      graph.production.artDirection.scaleGrammar,
      target,
      file,
      "artDirection.scaleGrammar",
    );
    if (graph.production.deliverables.length === 0)
      invalid(
        diagnostics,
        "design-collection-empty",
        target,
        file,
        "deliverables must contain at least one output. Add a required production deliverable.",
      );
    for (const deliverable of graph.production.deliverables) {
      unique(
        diagnostics,
        seenDeliverables,
        deliverable.id,
        target,
        file,
        "deliverables",
      );
      if (deliverable.kind !== "guide-pass" && deliverable.pass !== undefined)
        invalid(
          diagnostics,
          "design-deliverable-pass-invalid",
          target,
          file,
          `Deliverable "${deliverable.id}:${deliverable.kind}" cannot own structural pass "${deliverable.pass}". Remove pass or change the deliverable to guide-pass.`,
        );
    }
    if (
      graph.production.visualDelivery !== "deterministic" &&
      graph.production.deliverables.some(
        (deliverable) => deliverable.kind === "feature" && deliverable.required,
      ) === false
    )
      invalid(
        diagnostics,
        "design-repaint-feature-required",
        target,
        file,
        "Repainted or mixed visual delivery requires at least one required feature deliverable. A nominal repaint selection cannot ship only deterministic previews, guides, audio, or omitted optional features.",
      );
    const adoptionIds = new Set<string>();
    const adoptionClips = new Set<string>();
    for (const adoption of graph.production.externalMotions ?? []) {
      unique(
        diagnostics,
        adoptionIds,
        adoption.id,
        target,
        file,
        "externalMotions",
      );
      unique(
        diagnostics,
        adoptionClips,
        adoption.clip,
        target,
        file,
        "externalMotions.clip",
      );
      for (const [field, value] of [
        ["asset", adoption.asset],
        ["take", adoption.take],
        ["shot", adoption.shot],
        ["actor", adoption.actor],
        ["clip", adoption.clip],
        ["sourceRig.id", adoption.sourceRig.id],
      ] as const)
        text(
          diagnostics,
          value,
          target,
          file,
          `externalMotions.${adoption.id}.${field}`,
        );
      const shot = graph.shots.get(adoption.shot);
      if (shot === undefined)
        missing(
          diagnostics,
          target,
          file,
          `shot "${adoption.shot}"`,
          `create that shot or correct external motion adoption "${adoption.id}"`,
        );
      else if (
        shot.participants.some(
          (participant) =>
            participant.kind === "actor" && participant.id === adoption.actor,
        ) === false
      )
        invalid(
          diagnostics,
          "design-reference-missing",
          target,
          file,
          `External motion adoption "${adoption.id}" targets actor "${adoption.actor}" outside shot "${adoption.shot}" participants. Add that actor participant or correct the adoption.`,
        );
      const sourceBones = new Set(
        adoption.sourceRig.bones.map((bone) => bone.bone),
      );
      const mappedSources = new Set<string>();
      const mappedTargets = new Set<string>();
      if (adoption.mapping.length === 0)
        invalid(
          diagnostics,
          "design-collection-empty",
          target,
          file,
          `External motion adoption "${adoption.id}" has no explicit source-node mapping. Declare every adopted channel mapping; the compiler will not infer one.`,
        );
      for (const mapping of adoption.mapping) {
        if (
          mapping.source.trim().length === 0 ||
          mappedSources.has(mapping.source) ||
          mappedTargets.has(mapping.target) ||
          sourceBones.has(mapping.target) === false
        )
          invalid(
            diagnostics,
            "design-reference-invalid",
            target,
            file,
            `External motion adoption "${adoption.id}" has a blank, duplicate, or source-rig-incompatible mapping ${JSON.stringify(mapping)}. Keep a one-to-one explicit mapping to declared source-rig bones.`,
          );
        mappedSources.add(mapping.source);
        mappedTargets.add(mapping.target);
      }
      if (
        adoption.mode.kind === "humanoid-retarget" &&
        (Number.isFinite(adoption.mode.translationScale) === false ||
          adoption.mode.translationScale <= 0)
      )
        invalid(
          diagnostics,
          "design-range-invalid",
          target,
          file,
          `External motion adoption "${adoption.id}" translationScale must be finite and positive. Correct the explicit retarget scale.`,
        );
    }
    const captionIds = new Set<string>();
    const captionLanguages = new Set<string>();
    for (const profile of graph.production.captionReadabilityProfiles ?? []) {
      unique(
        diagnostics,
        captionIds,
        profile.id,
        target,
        file,
        "captionReadabilityProfiles",
      );
      text(
        diagnostics,
        profile.language,
        target,
        file,
        "captionReadabilityProfiles.language",
      );
      const languageIdentity = parseAutoMovieCaptionLanguage(profile.language);
      if (languageIdentity === null)
        invalid(
          diagnostics,
          "design-reference-invalid",
          target,
          file,
          `Caption readability profile "${profile.id}" language "${profile.language}" is not a well-formed RFC 5646 tag. Correct its language without inferring a replacement.`,
        );
      else if (captionLanguages.has(languageIdentity.comparisonKey))
        invalid(
          diagnostics,
          "design-duplicate-id",
          target,
          file,
          `Caption readability profile language "${profile.language}" duplicates an existing language by ASCII case-insensitive identity. Keep one profile for that language identity.`,
        );
      else captionLanguages.add(languageIdentity.comparisonKey);
      validateCaptionGraphemeSegmentationIdentity(
        diagnostics,
        profile.segmentation,
        profile.id,
        target,
        file,
      );
      if (!Number.isSafeInteger(profile.version) || profile.version <= 0)
        invalid(
          diagnostics,
          "design-range-invalid",
          target,
          file,
          `Caption readability profile "${profile.id}" version must be a positive safe integer.`,
        );
      for (const [field, boundary] of Object.entries({
        maxGraphemesPerSecond: profile.maxGraphemesPerSecond,
        maxLinesPerCue: profile.maxLinesPerCue,
        maxGraphemesPerLine: profile.maxGraphemesPerLine,
        minDurationFrames: profile.minDurationFrames,
        minGapFrames: profile.minGapFrames,
      }))
        if (Number.isFinite(boundary.value) === false || boundary.value < 0)
          invalid(
            diagnostics,
            "design-range-invalid",
            target,
            file,
            `Caption readability profile "${profile.id}" ${field}.value must be finite and non-negative.`,
          );
    }
  }

  for (const [id, model] of graph.models) {
    const target = `model:${id}`;
    const file = `${sharedRoot}/models/${encodeAutoMoviePathSegment(id)}.json`;
    text(diagnostics, model.id, target, file, "id");
    if (model.id !== id)
      invalid(
        diagnostics,
        "design-identity-mismatch",
        target,
        file,
        `Model file identity is "${id}" but value id is "${model.id}". Rewrite the model as a tracked model recipe using one matching id.`,
      );
    if (model.asset !== undefined)
      text(diagnostics, model.asset, target, file, "asset");
    text(diagnostics, model.archetype, target, file, "archetype");
    // The recipe names a builder rather than a member of a closed union, so an
    // unregistered name is a design fact this gate has to report. Everything
    // downstream of it — parameters, capabilities, attachments — is defined by
    // the archetype, so none of it can be judged without one.
    const archetype = archetypes.get(model.archetype);
    if (archetype === undefined)
      invalid(
        diagnostics,
        "model-archetype-unregistered",
        target,
        file,
        `Model archetype "${model.archetype}" is not registered with this compiler. Name a registered archetype (${registeredArchetypeNames(archetypes)}) in the tracked model recipe record, or register a builder for "${model.archetype}" before compiling.`,
      );
    validateModelProfiles(diagnostics, model.profiles ?? [], target, file);
    validateModelParameters(diagnostics, model, archetype, target, file);
    const paletteSize = Object.keys(model.palette).length;
    if (paletteSize === 0)
      invalid(
        diagnostics,
        "design-collection-empty",
        target,
        file,
        "palette must contain one named #RRGGBB material color. Add it in the tracked model recipe record.",
      );
    else if (paletteSize > 1)
      invalid(
        diagnostics,
        "design-collection-cardinality-invalid",
        target,
        file,
        "palette must contain exactly one material color in the foundation compiler. Split visually distinct materials into separate recipes until semantic part-role binding is implemented.",
      );
    const lodTiers = new Set<string>();
    if (model.lod.length === 0)
      invalid(
        diagnostics,
        "design-collection-empty",
        target,
        file,
        "lod must contain at least one representation. Add a hero, near, or far tier in the tracked model recipe record.",
      );
    let previousDistance = 0;
    let previousTier = -1;
    for (const [index, lod] of model.lod.entries()) {
      unique(diagnostics, lodTiers, lod.tier, target, file, "lod");
      const tier = ["hero", "near", "far"].indexOf(lod.tier);
      if (tier <= previousTier)
        invalid(
          diagnostics,
          "model-lod-order-invalid",
          target,
          file,
          `LOD tier "${lod.tier}" is out of near-to-far order. Order unique tiers as hero, near, then far in the tracked model recipe record.`,
        );
      previousTier = tier;
      if (lod.maxDistance === null) {
        if (index !== model.lod.length - 1)
          invalid(
            diagnostics,
            "model-lod-order-invalid",
            target,
            file,
            `Unbounded LOD tier "${lod.tier}" is not final. Move it to the end or give it a finite maxDistance in the tracked model recipe record.`,
          );
      } else {
        positive(diagnostics, lod.maxDistance, target, file, "lod.maxDistance");
        if (
          Number.isFinite(lod.maxDistance) &&
          lod.maxDistance <= previousDistance
        )
          invalid(
            diagnostics,
            "model-lod-order-invalid",
            target,
            file,
            `LOD maxDistance ${lod.maxDistance} is not above prior distance ${previousDistance}. Increase it in the tracked model recipe record.`,
          );
        previousDistance = lod.maxDistance;
      }
      if (lod.recipe !== id && graph.models.has(lod.recipe) === false)
        missing(
          diagnostics,
          target,
          file,
          `LOD recipe "${lod.recipe}"`,
          `Create or correct the model recipe record for "${lod.recipe}" or change ${id}.lod`,
        );
    }
    for (const [name, color] of Object.entries(model.palette)) {
      text(diagnostics, name, target, file, "palette.name");
      text(diagnostics, color, target, file, `palette.${name}`);
      if (/^#[0-9a-f]{6}$/i.test(color) === false)
        invalid(
          diagnostics,
          "design-color-invalid",
          target,
          file,
          `Palette color "${color}" is not a six-digit hexadecimal sRGB color. Use #RRGGBB in the tracked model recipe record.`,
        );
    }
    uniqueTextValues(
      diagnostics,
      model.capabilities,
      target,
      file,
      "capabilities",
    );
    for (const capability of model.capabilities)
      if (
        archetype !== undefined &&
        archetype.capabilities.includes(capability) === false
      )
        invalid(
          diagnostics,
          "design-capability-unsupported",
          target,
          file,
          `Model capability "${capability}" is not implemented for archetype "${model.archetype}". Remove the claim or implement and register its deterministic source/runtime binding before compilation.`,
        );
    const attachmentIds = new Set<string>();
    for (const attachment of model.attachments) {
      unique(
        diagnostics,
        attachmentIds,
        attachment.id,
        target,
        file,
        "attachments",
      );
      text(diagnostics, attachment.bone, target, file, "attachments.bone");
      if (
        archetype !== undefined &&
        archetype.bones.length !== 0 &&
        archetype.bones.includes(attachment.bone) === false
      )
        invalid(
          diagnostics,
          "design-attachment-unsupported",
          target,
          file,
          `Attachment "${attachment.id}" names bone "${attachment.bone}", which the compiler-owned skeleton of archetype "${model.archetype}" does not materialize. Use one of ${archetype.bones.join(", ")} or remove the attachment.`,
        );
    }
    if (
      archetype !== undefined &&
      archetype.bones.length === 0 &&
      model.attachments.length !== 0
    )
      invalid(
        diagnostics,
        "design-attachment-unsupported",
        target,
        file,
        `Archetype "${model.archetype}" builds no compiler-owned skeleton for bone attachments. Remove attachments or name an archetype whose builder owns one.`,
      );
  }

  if (graph.world !== null) {
    const file = `${sharedRoot}/world.json`;
    if (
      graph.world.effectRecipes.length > AUTOMOVIE_EFFECT_DECLARATION_LIMIT ||
      graph.world.effectZones.length > AUTOMOVIE_EFFECT_DECLARATION_LIMIT
    )
      invalid(
        diagnostics,
        "design-range-invalid",
        "world",
        file,
        `World effects must stay within ${AUTOMOVIE_EFFECT_DECLARATION_LIMIT} recipes and ${AUTOMOVIE_EFFECT_DECLARATION_LIMIT} zones. Reduce the declared effect graph.`,
      );
    text(diagnostics, graph.world.id, "world", file, "id");
    const ids = new Set<string>();
    for (const landmark of graph.world.landmarks) {
      unique(diagnostics, ids, landmark.id, "world", file, "landmarks");
      positive(diagnostics, landmark.radius, "world", file, "landmark.radius");
      vector(
        diagnostics,
        landmark.position,
        "world",
        file,
        "landmark.position",
      );
      text(diagnostics, landmark.meaning, "world", file, "landmark.meaning");
    }
    const surfaceIds = new Set<string>();
    for (const surface of graph.world.surfaces) {
      unique(diagnostics, surfaceIds, surface.id, "world", file, "surfaces");
      if (surface.polygon.length < 3)
        invalid(
          diagnostics,
          "design-range-invalid",
          "world",
          file,
          `Surface "${surface.id}" has ${surface.polygon.length} polygon points. Add at least three points in the tracked world design record.`,
        );
      for (const point of surface.polygon)
        bounded2(
          diagnostics,
          point,
          -AUTOMOVIE_WORLD_COORDINATE_LIMIT,
          AUTOMOVIE_WORLD_COORDINATE_LIMIT,
          "world",
          file,
          "surface.polygon",
        );
      if (isSimpleNonDegeneratePolygon(surface.polygon) === false)
        invalid(
          diagnostics,
          "design-polygon-invalid",
          "world",
          file,
          `Surface "${surface.id}" must use distinct finite vertices forming one non-self-intersecting polygon with non-zero area. Correct surface.polygon in the tracked world design record.`,
        );
      if (surface.height.kind === "constant")
        finite(
          diagnostics,
          surface.height.value,
          "world",
          file,
          "surface.height.value",
        );
      else if (surface.height.kind === "plane") {
        finite(
          diagnostics,
          surface.height.originHeight,
          "world",
          file,
          "surface.height.originHeight",
        );
        finite(
          diagnostics,
          surface.height.slopeX,
          "world",
          file,
          "surface.height.slopeX",
        );
        finite(
          diagnostics,
          surface.height.slopeZ,
          "world",
          file,
          "surface.height.slopeZ",
        );
      } else {
        const lattice = surface.height;
        finite(
          diagnostics,
          lattice.originX,
          "world",
          file,
          "surface.height.originX",
        );
        finite(
          diagnostics,
          lattice.originZ,
          "world",
          file,
          "surface.height.originZ",
        );
        positive(
          diagnostics,
          lattice.spacingX,
          "world",
          file,
          "surface.height.spacingX",
        );
        positive(
          diagnostics,
          lattice.spacingZ,
          "world",
          file,
          "surface.height.spacingZ",
        );
        // A lattice needs two lines on each axis before anything between them
        // can be interpolated, and its samples have to be exactly the lattice:
        // a short array would read relief that was never authored, and a long
        // one hides a row the author meant to be read.
        if (
          Number.isSafeInteger(lattice.columns) === false ||
          Number.isSafeInteger(lattice.rows) === false ||
          lattice.columns < 2 ||
          lattice.rows < 2
        )
          invalid(
            diagnostics,
            "design-range-invalid",
            "world",
            file,
            `Surface "${surface.id}" heightfield has ${lattice.columns} columns and ${lattice.rows} rows. Use at least two of each in the tracked world design record.`,
          );
        else if (lattice.samples.length !== lattice.columns * lattice.rows)
          invalid(
            diagnostics,
            "design-range-invalid",
            "world",
            file,
            `Surface "${surface.id}" heightfield carries ${lattice.samples.length} samples for a lattice of ${lattice.columns} by ${lattice.rows}. Store exactly ${lattice.columns * lattice.rows} row-major heights in the tracked world design record.`,
          );
        for (const sample of lattice.samples)
          finite(diagnostics, sample, "world", file, "surface.height.samples");
      }
    }
    const routeIds = new Set<string>();
    for (const route of graph.world.routes) {
      unique(diagnostics, routeIds, route.id, "world", file, "routes");
      if (route.waypoints.length < 2)
        invalid(
          diagnostics,
          "design-range-invalid",
          "world",
          file,
          `Route "${route.id}" has ${route.waypoints.length} waypoints. Add at least two waypoints in the tracked world design record.`,
        );
      positive(
        diagnostics,
        route.allowedFormationWidth,
        "world",
        file,
        "route.allowedFormationWidth",
      );
      for (const point of route.waypoints)
        bounded2(
          diagnostics,
          point,
          -AUTOMOVIE_WORLD_COORDINATE_LIMIT,
          AUTOMOVIE_WORLD_COORDINATE_LIMIT,
          "world",
          file,
          "route.waypoints",
        );
      const routeLength = route.waypoints
        .slice(1)
        .reduce(
          (length, point, index) =>
            length +
            Math.hypot(
              point.x - route.waypoints[index]!.x,
              point.z - route.waypoints[index]!.z,
            ),
          0,
        );
      if (Number.isFinite(routeLength) === false || routeLength <= 0)
        invalid(
          diagnostics,
          "design-route-invalid",
          "world",
          file,
          `Route "${route.id}" must have finite non-zero total length within the supported world. Correct its waypoints in the tracked world design record.`,
        );
    }
    validateInstanceSets(diagnostics, graph, routeIds, file);
    const effectRecipeIds = new Set<string>();
    for (const recipe of graph.world.effectRecipes) {
      const target = `effect-recipe:${recipe.id}`;
      unique(
        diagnostics,
        effectRecipeIds,
        recipe.id,
        "world",
        file,
        "effectRecipes",
      );
      text(diagnostics, recipe.id, target, file, "id");
      integer(
        diagnostics,
        recipe.seed,
        0,
        Number.MAX_SAFE_INTEGER,
        target,
        file,
        "seed",
      );
      bounded(
        diagnostics,
        recipe.emission.rate,
        0,
        1_024,
        target,
        file,
        "emission.rate",
      );
      integer(
        diagnostics,
        recipe.emission.burst,
        0,
        AUTOMOVIE_MAX_EFFECT_PARTICLES,
        target,
        file,
        "emission.burst",
      );
      bounded(
        diagnostics,
        recipe.emission.duration,
        1 / 240,
        60,
        target,
        file,
        "emission.duration",
      );
      boundedRange(
        diagnostics,
        recipe.particle.lifetime,
        1 / 240,
        30,
        target,
        file,
        "particle.lifetime",
      );
      boundedRange(
        diagnostics,
        recipe.particle.size,
        0.01,
        20,
        target,
        file,
        "particle.size",
      );
      boundedRange(
        diagnostics,
        recipe.particle.opacity,
        0,
        1,
        target,
        file,
        "particle.opacity",
      );
      if (/^#[0-9a-f]{6}$/i.test(recipe.particle.color) === false)
        invalid(
          diagnostics,
          "design-color-invalid",
          target,
          file,
          `Effect color "${recipe.particle.color}" must be one opaque #RRGGBB value.`,
        );
      boundedVector(
        diagnostics,
        recipe.motion.wind,
        -50,
        50,
        target,
        file,
        "motion.wind",
      );
      bounded(
        diagnostics,
        recipe.motion.rise,
        -50,
        50,
        target,
        file,
        "motion.rise",
      );
      bounded(
        diagnostics,
        recipe.motion.turbulence,
        0,
        50,
        target,
        file,
        "motion.turbulence",
      );
      integer(
        diagnostics,
        recipe.budget.maxParticles,
        1,
        AUTOMOVIE_MAX_EFFECT_PARTICLES,
        target,
        file,
        "budget.maxParticles",
      );
      bounded(
        diagnostics,
        recipe.budget.lodDistance,
        0.1,
        2_000,
        target,
        file,
        "budget.lodDistance",
      );
      const totalRegular = Math.floor(
        recipe.emission.rate * recipe.emission.duration + 1e-9,
      );
      const lifetimeRegular = Math.ceil(
        recipe.emission.rate * recipe.particle.lifetime.max,
      );
      const regularPeak = Math.min(totalRegular, lifetimeRegular);
      // Regular particles spawn at n / rate and expire at age >= lifetime, so
      // an exact lifetime boundary does not overlap the initial burst.
      const regularBeforeBurstExpiry = Math.min(
        totalRegular,
        Math.max(0, lifetimeRegular - 1),
      );
      const liveUpperBound = Math.max(
        regularPeak,
        recipe.emission.burst + regularBeforeBurstExpiry,
      );
      if (liveUpperBound > recipe.budget.maxParticles)
        invalid(
          diagnostics,
          "design-budget-exceeded",
          target,
          file,
          `Effect recipe "${recipe.id}" can keep ${liveUpperBound} particles live, above its ${recipe.budget.maxParticles} cap. Reduce burst, rate, emission duration, or lifetime.`,
        );
    }
    const effectIds = new Set<string>();
    for (const zone of graph.world.effectZones) {
      unique(diagnostics, effectIds, zone.id, "world", file, "effectZones");
      text(diagnostics, zone.recipe, "world", file, "effect.recipe");
      if (effectRecipeIds.has(zone.recipe) === false)
        missing(
          diagnostics,
          "world",
          file,
          `effect recipe "${zone.recipe}"`,
          `add it to effectRecipes or change zone "${zone.id}".recipe`,
        );
      boundedVector(
        diagnostics,
        zone.bounds.min,
        -AUTOMOVIE_WORLD_COORDINATE_LIMIT,
        AUTOMOVIE_WORLD_COORDINATE_LIMIT,
        "world",
        file,
        "effect.bounds.min",
      );
      boundedVector(
        diagnostics,
        zone.bounds.max,
        -AUTOMOVIE_WORLD_COORDINATE_LIMIT,
        AUTOMOVIE_WORLD_COORDINATE_LIMIT,
        "world",
        file,
        "effect.bounds.max",
      );
      if (
        zone.bounds.min.x >= zone.bounds.max.x ||
        zone.bounds.min.y >= zone.bounds.max.y ||
        zone.bounds.min.z >= zone.bounds.max.z
      )
        invalid(
          diagnostics,
          "design-range-invalid",
          "world",
          file,
          `Effect zone "${zone.id}" bounds are empty or inverted. Fix bounds in the tracked world design record.`,
        );
      integer(
        diagnostics,
        zone.seed,
        0,
        Number.MAX_SAFE_INTEGER,
        "world",
        file,
        "effect.seed",
      );
    }
    const particleBudget = graph.world.effectZones.reduce(
      (sum, zone) =>
        sum +
        (graph.world!.effectRecipes.find((recipe) => recipe.id === zone.recipe)
          ?.budget.maxParticles ?? 0),
      0,
    );
    if (particleBudget > AUTOMOVIE_EFFECT_PARTICLE_BUDGET)
      invalid(
        diagnostics,
        "design-budget-exceeded",
        "world",
        file,
        `Effect zones reserve ${particleBudget} live particles, above the production budget ${AUTOMOVIE_EFFECT_PARTICLE_BUDGET}. Reduce zone count or recipe caps.`,
      );
  }

  const formationMemberCount = [...graph.formations.values()].reduce(
    (sum, formation) => sum + formation.count,
    0,
  );
  if (
    Number.isSafeInteger(formationMemberCount) === false ||
    formationMemberCount > AUTOMOVIE_MAX_FORMATION_MEMBERS
  )
    invalid(
      diagnostics,
      "design-range-invalid",
      "formations",
      `${sharedRoot}/formations`,
      `The production declares ${formationMemberCount} formation members, above the compact-runtime limit ${AUTOMOVIE_MAX_FORMATION_MEMBERS}. Reduce the total; unlimited crowds are not supported.`,
    );
  const formationInstanceBytes = [...graph.formations.values()].reduce(
    (bytes, formation) => {
      const anonymousTiers =
        graph.models
          .get(formation.modelRecipe)
          ?.lod.filter((lod) => lod.tier !== "hero").length ?? 0;
      return (
        bytes +
        (formation.count - formation.heroOverrides.length) *
          Math.max(1, anonymousTiers) *
          AUTOMOVIE_FORMATION_INSTANCE_BYTES
      );
    },
    0,
  );
  if (
    Number.isSafeInteger(formationInstanceBytes) === false ||
    formationInstanceBytes > AUTOMOVIE_FORMATION_INSTANCE_BUFFER_BUDGET_BYTES
  )
    invalid(
      diagnostics,
      "design-range-invalid",
      "formations",
      `${sharedRoot}/formations`,
      `Formation LOD matrices and phase attributes require ${formationInstanceBytes} bytes, above the ${AUTOMOVIE_FORMATION_INSTANCE_BUFFER_BUDGET_BYTES}-byte viewer budget. Reduce count or LOD tiers.`,
    );
  const formationRuntimeBytes = [...graph.formations.values()].reduce(
    (bytes, formation) => {
      const occurrences = [...graph.shots.values()].filter((shot) =>
        shot.participants.some(
          (participant) =>
            participant.kind === "formation" && participant.id === formation.id,
        ),
      ).length;
      const variableBytes = Buffer.byteLength(
        JSON.stringify({
          id: formation.id,
          modelRecipe: formation.modelRecipe,
          layout: formation.layout,
          heroes: formation.heroOverrides,
          lod: graph.models.get(formation.modelRecipe)?.lod ?? [],
        }),
        "utf8",
      );
      const runtimeBytes =
        4_096 +
        variableBytes +
        Math.ceil(formation.count / 1_024) * 1_024 +
        formation.heroOverrides.length * 1_024;
      return bytes + runtimeBytes * Math.max(1, occurrences);
    },
    0,
  );
  if (
    Number.isSafeInteger(formationRuntimeBytes) === false ||
    formationRuntimeBytes > AUTOMOVIE_FORMATION_RUNTIME_BUDGET_BYTES
  )
    invalid(
      diagnostics,
      "design-range-invalid",
      "formations",
      `${sharedRoot}/formations`,
      `Estimated compact formation runtime is ${formationRuntimeBytes} bytes, above the ${AUTOMOVIE_FORMATION_RUNTIME_BUDGET_BYTES}-byte generated payload budget. Reduce count or hero overrides.`,
    );

  for (const [id, formation] of graph.formations) {
    const target = `formation:${id}`;
    const file = `${sharedRoot}/formations/${encodeAutoMoviePathSegment(id)}.json`;
    text(diagnostics, formation.id, target, file, "id");
    text(diagnostics, formation.modelRecipe, target, file, "modelRecipe");
    if (formation.id !== id)
      invalid(
        diagnostics,
        "design-identity-mismatch",
        target,
        file,
        `Formation file identity is "${id}" but value id is "${formation.id}". Rewrite it as a tracked formation design using one matching id.`,
      );
    if (graph.models.has(formation.modelRecipe) === false)
      missing(
        diagnostics,
        target,
        file,
        `model recipe "${formation.modelRecipe}"`,
        `Create or correct the model recipe record for "${formation.modelRecipe}" or change ${id}.modelRecipe`,
      );
    integer(
      diagnostics,
      formation.count,
      1,
      AUTOMOVIE_MAX_FORMATION_MEMBERS,
      target,
      file,
      "count",
    );
    boundedVector(
      diagnostics,
      formation.anchor,
      -AUTOMOVIE_WORLD_COORDINATE_LIMIT,
      AUTOMOVIE_WORLD_COORDINATE_LIMIT,
      target,
      file,
      "anchor",
    );
    bounded(
      diagnostics,
      formation.facingDeg,
      -360_000,
      360_000,
      target,
      file,
      "facingDeg",
    );
    integer(
      diagnostics,
      formation.seed,
      0,
      Number.MAX_SAFE_INTEGER,
      target,
      file,
      "seed",
    );
    validateFormationLayout(diagnostics, formation, target, file);
    uniqueTextValues(
      diagnostics,
      formation.capabilities,
      target,
      file,
      "capabilities",
    );
    const slots = new Set<number>();
    const actors = new Set<string>();
    if (formation.heroOverrides.length > AUTOMOVIE_MAX_FORMATION_HEROES)
      invalid(
        diagnostics,
        "design-range-invalid",
        target,
        file,
        `Formation "${id}" promotes ${formation.heroOverrides.length} heroes, above the explicit-node limit ${AUTOMOVIE_MAX_FORMATION_HEROES}. Keep the anonymous crowd instanced.`,
      );
    for (const hero of formation.heroOverrides) {
      if (
        Number.isInteger(hero.slot) === false ||
        hero.slot < 0 ||
        hero.slot >= formation.count
      )
        invalid(
          diagnostics,
          "design-range-invalid",
          target,
          file,
          `Hero slot ${hero.slot} is outside formation count ${formation.count}. Fix heroOverrides in the tracked formation design record.`,
        );
      if (slots.has(hero.slot))
        invalid(
          diagnostics,
          "design-duplicate-id",
          target,
          file,
          `Hero slot ${hero.slot} is duplicated. Keep each slot once in the tracked formation design record.`,
        );
      slots.add(hero.slot);
      text(diagnostics, hero.actor, target, file, "heroOverrides.actor");
      if (actors.has(hero.actor))
        invalid(
          diagnostics,
          "design-duplicate-id",
          target,
          file,
          `Hero actor "${hero.actor}" is assigned to more than one slot. Keep each actor identity once in the tracked formation design record.`,
        );
      actors.add(hero.actor);
    }
  }

  const sourceModuleSpellings = new Map<string, string>();
  for (const [id, shot] of graph.shots) {
    const target = `shot:${id}`;
    const file = `${productionRoot}/shots/${encodeAutoMoviePathSegment(id)}.json`;
    text(diagnostics, shot.id, target, file, "id");
    if (shot.id !== id)
      invalid(
        diagnostics,
        "design-identity-mismatch",
        target,
        file,
        `Shot file identity is "${id}" but value id is "${shot.id}". Rewrite it as a tracked shot contract using one matching id.`,
      );
    text(diagnostics, shot.beat, target, file, "beat");
    text(diagnostics, shot.source.module, target, file, "source.module");
    text(diagnostics, shot.source.export, target, file, "source.export");
    if (
      path.posix.isAbsolute(shot.source.module) ||
      /^[A-Za-z]:/.test(shot.source.module) ||
      shot.source.module.includes("\\") ||
      path.posix.normalize(shot.source.module) !== shot.source.module ||
      shot.source.module
        .split("/")
        .some((segment) => segment.length === 0 || segment === "..") ||
      [".ts", ".tsx", ".mts", ".cts"].includes(
        path.posix.extname(shot.source.module),
      ) === false
    )
      invalid(
        diagnostics,
        "design-source-path-invalid",
        target,
        file,
        `Source module "${shot.source.module}" is not one canonical project-relative POSIX TypeScript path. Remove absolute or drive roots, backslashes, empty or dot segments, and use a .ts, .tsx, .mts, or .cts extension before writing the shot contract record.`,
      );
    const foldedSourceModule = shot.source.module.toLowerCase();
    const priorSourceModule = sourceModuleSpellings.get(foldedSourceModule);
    if (
      priorSourceModule !== undefined &&
      priorSourceModule !== shot.source.module
    )
      invalid(
        diagnostics,
        "design-source-path-collision",
        target,
        file,
        `Source module "${shot.source.module}" collides with "${priorSourceModule}" on a case-insensitive filesystem. Use one portable spelling for every shared module binding.`,
      );
    else sourceModuleSpellings.set(foldedSourceModule, shot.source.module);
    positive(
      diagnostics,
      shot.durationSeconds,
      target,
      file,
      "durationSeconds",
    );
    uniqueTextValues(
      diagnostics,
      shot.styleIntent ?? [],
      target,
      file,
      "styleIntent",
    );
    if (
      graph.production !== null &&
      Number.isFinite(shot.durationSeconds) &&
      shot.durationSeconds > 0 &&
      isProductionFrameTime(
        shot.durationSeconds,
        graph.production.frameFormat.frameRate ??
          graph.production.frameFormat.fps,
      ) === false
    )
      invalid(
        diagnostics,
        "design-frame-clock-invalid",
        target,
        file,
        `Shot "${id}" durationSeconds is off the ${graph.production.frameFormat.fps}fps production clock. Choose an exact integer frame count divided by fps in the tracked shot contract record.`,
      );
    if (shot.storyTime !== undefined) {
      if (
        graph.production !== null &&
        graph.production.storyClock === undefined
      )
        invalid(
          diagnostics,
          "design-story-clock-absent",
          target,
          file,
          `Shot "${id}" is pinned to a story clock the production does not keep. Add storyClock to the tracked production design record, or remove ${id}.storyTime.`,
        );
      finite(
        diagnostics,
        shot.storyTime.originSeconds,
        target,
        file,
        "storyTime.originSeconds",
      );
      if (shot.storyTime.rate !== undefined)
        positive(
          diagnostics,
          shot.storyTime.rate,
          target,
          file,
          "storyTime.rate",
        );
    }
    const participantIds = new Set<string>();
    for (const participant of shot.participants) {
      text(diagnostics, participant.id, target, file, "participants.id");
      const participantKey = `${participant.kind}:${participant.id}`;
      if (participantIds.has(participantKey))
        invalid(
          diagnostics,
          "design-duplicate-id",
          target,
          file,
          `Participant "${participantKey}" is duplicated. Keep each participant once in the tracked shot contract record.`,
        );
      participantIds.add(participantKey);
      if (
        participant.kind === "formation" &&
        graph.formations.has(participant.id) === false
      )
        missing(
          diagnostics,
          target,
          file,
          `formation "${participant.id}"`,
          `Create or correct the formation design record for "${participant.id}" or remove it from ${id}.participants`,
        );
    }
    const formationHeroOwners = new Map<string, string>();
    for (const participant of shot.participants) {
      if (participant.kind !== "formation") continue;
      const formation = graph.formations.get(participant.id);
      if (formation === undefined) continue;
      for (const hero of formation.heroOverrides) {
        const owner = formationHeroOwners.get(hero.actor);
        if (owner !== undefined && owner !== formation.id)
          invalid(
            diagnostics,
            "design-duplicate-id",
            target,
            file,
            `Hero actor "${hero.actor}" belongs to participating formations "${owner}" and "${formation.id}" in the same shot. Keep one formation owner per hero actor in ${id}.participants.`,
          );
        else formationHeroOwners.set(hero.actor, formation.id);
      }
    }
    validateNamedStates(
      diagnostics,
      graph,
      shot.opening,
      target,
      file,
      "opening",
    );
    validateNamedStates(
      diagnostics,
      graph,
      shot.closing,
      target,
      file,
      "closing",
    );
    text(diagnostics, shot.camera.intent, target, file, "camera.intent");
    uniqueTextValues(
      diagnostics,
      shot.camera.requiredSubjects,
      target,
      file,
      "camera.requiredSubjects",
    );
    if (shot.camera.requiredSubjects.length === 0)
      invalid(
        diagnostics,
        "design-collection-empty",
        target,
        file,
        `Shot "${id}" must name at least one required camera subject. Add one in the tracked shot contract record.`,
      );
    if (
      Number.isFinite(shot.camera.maxOcclusionRatio) === false ||
      shot.camera.maxOcclusionRatio < 0 ||
      shot.camera.maxOcclusionRatio > 1
    )
      invalid(
        diagnostics,
        "design-range-invalid",
        target,
        file,
        `Camera maxOcclusionRatio must be between 0 and 1. Fix ${id}.camera in the tracked shot contract record.`,
      );
    const events = new Set<string>();
    for (const event of shot.events) {
      unique(diagnostics, events, event.id, target, file, "events");
      uniqueTextValues(
        diagnostics,
        event.subjects,
        target,
        file,
        `events.${event.id}.subjects`,
      );
      if (event.subjects.length === 0)
        invalid(
          diagnostics,
          "design-collection-empty",
          target,
          file,
          `Event "${event.id}" must name at least one subject. Add one in the tracked shot contract record.`,
        );
      validatePredicates(
        diagnostics,
        graph,
        event.predicates,
        target,
        file,
        `events.${event.id}.predicates`,
      );
      if (
        Number.isFinite(event.window.from) === false ||
        Number.isFinite(event.window.to) === false ||
        event.window.from < 0 ||
        event.window.from > event.window.to ||
        event.window.to > shot.durationSeconds
      )
        invalid(
          diagnostics,
          "design-range-invalid",
          target,
          file,
          `Event "${event.id}" has a window outside shot duration. Fix ${id}.events in the tracked shot contract record.`,
        );
    }
    const frames = new Set<string>();
    if (shot.reviewFrames.length === 0)
      invalid(
        diagnostics,
        "design-collection-empty",
        target,
        file,
        `Shot "${id}" must declare at least one exact review frame and pass. Add reviewFrames in the tracked shot contract record so visual review has a reachable evidence target.`,
      );
    for (const frame of shot.reviewFrames) {
      unique(diagnostics, frames, frame.id, target, file, "reviewFrames");
      if (
        Number.isFinite(frame.time) === false ||
        frame.time < 0 ||
        frame.time > shot.durationSeconds
      )
        invalid(
          diagnostics,
          "design-range-invalid",
          target,
          file,
          `Review frame "${frame.id}" time is outside shot duration. Fix ${id}.reviewFrames in the tracked shot contract record.`,
        );
      else if (
        graph.production !== null &&
        isProductionFrameTime(
          frame.time,
          graph.production.frameFormat.frameRate ??
            graph.production.frameFormat.fps,
        ) === false
      )
        invalid(
          diagnostics,
          "design-frame-clock-invalid",
          target,
          file,
          `Review frame "${frame.id}" is off the ${graph.production.frameFormat.fps}fps production clock. Snap its time to an exact frame in the tracked shot contract record.`,
        );
      if (new Set(frame.passes).size !== frame.passes.length)
        invalid(
          diagnostics,
          "design-duplicate-id",
          target,
          file,
          `Review frame "${frame.id}" repeats a pass. Keep each pass once in the tracked shot contract record.`,
        );
      if (frame.passes.length === 0)
        invalid(
          diagnostics,
          "design-collection-empty",
          target,
          file,
          `Review frame "${frame.id}" must request at least one pass. Add a pass in the tracked shot contract record.`,
        );
    }
  }

  for (const [id, acceptance] of graph.acceptance) {
    const target = `acceptance:${id}`;
    const file = `${productionRoot}/acceptance/${encodeAutoMoviePathSegment(id)}.json`;
    text(diagnostics, acceptance.id, target, file, "id");
    text(diagnostics, acceptance.target.id, target, file, "target.id");
    if (acceptance.id !== id)
      invalid(
        diagnostics,
        "design-identity-mismatch",
        target,
        file,
        `Acceptance file identity is "${id}" but value id is "${acceptance.id}". Rewrite it as a tracked acceptance record using one matching id.`,
      );
    const criterion = acceptance.criterion;
    if (criterion.kind !== "metric")
      text(
        diagnostics,
        criterion.expectation,
        target,
        file,
        "criterion.expectation",
      );
    if (criterion.kind === "story-sync")
      validateStorySyncCriterion(
        diagnostics,
        graph,
        acceptance,
        criterion,
        target,
        file,
      );
    if (acceptance.target.kind === "shot") {
      const shot = graph.shots.get(acceptance.target.id);
      if (shot === undefined)
        missing(
          diagnostics,
          target,
          file,
          `shot "${acceptance.target.id}"`,
          `Create or correct the shot contract record for "${acceptance.target.id}" or change ${id}.target`,
        );
      else {
        if (
          (criterion.kind === "frame" || criterion.kind === "event") &&
          criterion.shot !== undefined &&
          criterion.shot !== shot.id
        )
          missing(
            diagnostics,
            target,
            file,
            `criterion shot "${criterion.shot}"`,
            `remove criterion.shot or change it to target shot "${shot.id}"`,
          );
        validateAcceptanceCriterionAgainstShot(
          diagnostics,
          criterion,
          shot,
          target,
          file,
          id,
        );
      }
    } else {
      if (
        graph.production !== null &&
        acceptance.target.id !== graph.production.id
      )
        missing(
          diagnostics,
          target,
          file,
          `film "${acceptance.target.id}"`,
          `change ${id}.target to production "${graph.production.id}"`,
        );
      if (criterion.kind === "frame" || criterion.kind === "event") {
        if (criterion.shot === undefined)
          missing(
            diagnostics,
            target,
            file,
            "criterion shot",
            `set ${id}.criterion.shot so a film-level frame or event is unambiguous`,
          );
        else {
          const shot = graph.shots.get(criterion.shot);
          if (shot === undefined)
            missing(
              diagnostics,
              target,
              file,
              `criterion shot "${criterion.shot}"`,
              `Create or correct the shot contract record for "${criterion.shot}" or change ${id}.criterion.shot`,
            );
          else
            validateAcceptanceCriterionAgainstShot(
              diagnostics,
              criterion,
              shot,
              target,
              file,
              id,
            );
        }
      }
    }
    if (
      acceptance.criterion.kind === "metric" &&
      Number.isFinite(acceptance.criterion.value) === false
    )
      invalid(
        diagnostics,
        "design-range-invalid",
        target,
        file,
        `Metric value must be finite. Fix ${id}.criterion in the tracked acceptance record.`,
      );
  }
  return diagnostics.sort(compareDiagnostics);
};

const isSimpleNonDegeneratePolygon = (
  polygon: ReadonlyArray<{ x: number; z: number }>,
): boolean => {
  if (
    polygon.length < 3 ||
    polygon.some(
      (point) =>
        Number.isFinite(point.x) === false ||
        Number.isFinite(point.z) === false,
    ) ||
    new Set(polygon.map((point) => `${point.x}\0${point.z}`)).size !==
      polygon.length
  )
    return false;
  let twiceArea = 0;
  for (let index = 0; index < polygon.length; ++index) {
    const current = polygon[index]!;
    const next = polygon[(index + 1) % polygon.length]!;
    twiceArea += current.x * next.z - next.x * current.z;
  }
  if (Number.isFinite(twiceArea) === false || Math.abs(twiceArea) <= 1e-9)
    return false;
  for (let index = 0; index < polygon.length; ++index) {
    const previous = polygon[(index + polygon.length - 1) % polygon.length]!;
    const current = polygon[index]!;
    const next = polygon[(index + 1) % polygon.length]!;
    const bend = turn(previous, current, next);
    const reverseDot =
      (previous.x - current.x) * (next.x - current.x) +
      (previous.z - current.z) * (next.z - current.z);
    if (
      Number.isFinite(bend) === false ||
      Number.isFinite(reverseDot) === false ||
      (Math.abs(bend) <= 1e-9 && reverseDot > 0)
    )
      return false;
  }
  for (let left = 0; left < polygon.length; ++left) {
    const leftNext = (left + 1) % polygon.length;
    for (let right = left + 1; right < polygon.length; ++right) {
      const rightNext = (right + 1) % polygon.length;
      if (left === right || leftNext === right || rightNext === left) continue;
      if (
        segmentsIntersect(
          polygon[left]!,
          polygon[leftNext]!,
          polygon[right]!,
          polygon[rightNext]!,
        )
      )
        return false;
    }
  }
  return true;
};

const segmentsIntersect = (
  a: { x: number; z: number },
  b: { x: number; z: number },
  c: { x: number; z: number },
  d: { x: number; z: number },
): boolean => {
  const abC = turn(a, b, c);
  const abD = turn(a, b, d);
  const cdA = turn(c, d, a);
  const cdB = turn(c, d, b);
  return (
    [abC, abD, cdA, cdB].every(Number.isFinite) &&
    Math.max(Math.min(a.x, b.x), Math.min(c.x, d.x)) <=
      Math.min(Math.max(a.x, b.x), Math.max(c.x, d.x)) + 1e-9 &&
    Math.max(Math.min(a.z, b.z), Math.min(c.z, d.z)) <=
      Math.min(Math.max(a.z, b.z), Math.max(c.z, d.z)) + 1e-9 &&
    abC * abD <= 1e-9 &&
    cdA * cdB <= 1e-9
  );
};

const turn = (
  first: { x: number; z: number },
  second: { x: number; z: number },
  third: { x: number; z: number },
): number =>
  (second.x - first.x) * (third.z - first.z) -
  (second.z - first.z) * (third.x - first.x);

const validateAcceptanceCriterionAgainstShot = (
  diagnostics: IAutoMovieDiagnostic[],
  criterion: IAutoMovieAcceptanceScenario["criterion"],
  shot: IAutoMovieShotContract,
  target: string,
  file: string,
  acceptanceId: string,
): void => {
  if (
    criterion.kind === "frame" &&
    shot.reviewFrames.some((frame) => frame.id === criterion.frame) === false
  )
    missing(
      diagnostics,
      target,
      file,
      `review frame "${criterion.frame}"`,
      `add that frame to ${shot.id}.reviewFrames or change ${acceptanceId}.criterion`,
    );
  else if (
    criterion.kind === "frame" &&
    shot.reviewFrames.some(
      (frame) =>
        frame.id === criterion.frame && frame.passes.includes(criterion.pass),
    ) === false
  )
    missing(
      diagnostics,
      target,
      file,
      `pass "${criterion.pass}" on review frame "${criterion.frame}"`,
      `add that pass to ${shot.id}.reviewFrames or change ${acceptanceId}.criterion`,
    );
  else if (
    criterion.kind === "event" &&
    shot.events.some((event) => event.id === criterion.event) === false
  )
    missing(
      diagnostics,
      target,
      file,
      `event "${criterion.event}"`,
      `add that event to ${shot.id}.events or change ${acceptanceId}.criterion`,
    );
};

/**
 * Validate one cross-shot simultaneity claim before anything is compiled.
 *
 * Two checks live here that compilation cannot make cheaper. The first is
 * addressability: every named shot must exist, own the named event, and carry a
 * story-clock pin, because an unpinned shot has no story time and the claim
 * would be unmeasurable rather than false. The second is satisfiability: the
 * declared event windows already bound where each realized time can land, so
 * mapping those windows through their pins says whether any realization could
 * ever satisfy the tolerance. A claim no source could discharge is refused now
 * instead of after a compile that was never going to work.
 */
const validateStorySyncCriterion = (
  diagnostics: IAutoMovieDiagnostic[],
  graph: IAutoMovieProductionDesignGraph,
  acceptance: IAutoMovieAcceptanceScenario,
  criterion: Extract<
    IAutoMovieAcceptanceScenario["criterion"],
    { kind: "story-sync" }
  >,
  target: string,
  file: string,
): void => {
  const id = acceptance.id;
  if (acceptance.target.kind !== "film")
    invalid(
      diagnostics,
      "design-target-invalid",
      target,
      file,
      `Acceptance "${id}" compares events across shots, so no single shot owns it. Change ${id}.target to the film, or state a shot-local event criterion instead.`,
    );
  if (graph.production !== null && graph.production.storyClock === undefined)
    invalid(
      diagnostics,
      "design-story-clock-absent",
      target,
      file,
      `Acceptance "${id}" measures story time the production does not keep. Add storyClock to the tracked production design record, or remove ${id}.`,
    );
  const toleranceUsable =
    Number.isFinite(criterion.toleranceSeconds) &&
    criterion.toleranceSeconds >= 0;
  if (toleranceUsable === false)
    invalid(
      diagnostics,
      "design-range-invalid",
      target,
      file,
      `criterion.toleranceSeconds must be a finite value of zero or above. Fix ${id}.criterion in the tracked acceptance record.`,
    );
  if (criterion.events.length < 2) {
    invalid(
      diagnostics,
      "design-collection-cardinality-invalid",
      target,
      file,
      `Acceptance "${id}" must name at least two events; nothing is simultaneous on its own. Fix ${id}.criterion.events in the tracked acceptance record.`,
    );
    return;
  }
  const seen = new Set<string>();
  const windows: Array<{ from: number; to: number }> = [];
  for (const entry of criterion.events) {
    const key = `${entry.shot}\u0000${entry.event}`;
    if (seen.has(key))
      invalid(
        diagnostics,
        "design-duplicate-id",
        target,
        file,
        `Event "${entry.event}" of shot "${entry.shot}" appears twice in ${id}.criterion.events. An event is always simultaneous with itself; name each addressed event once.`,
      );
    seen.add(key);
    const shot = graph.shots.get(entry.shot);
    if (shot === undefined) {
      missing(
        diagnostics,
        target,
        file,
        `shot "${entry.shot}"`,
        `Create or correct the shot contract record for "${entry.shot}" or change ${id}.criterion.events`,
      );
      continue;
    }
    const event = shot.events.find((candidate) => candidate.id === entry.event);
    if (event === undefined) {
      missing(
        diagnostics,
        target,
        file,
        `event "${entry.event}" in shot "${entry.shot}"`,
        `add that event to ${entry.shot}.events or change ${id}.criterion.events`,
      );
      continue;
    }
    const pin = shot.storyTime;
    if (pin === undefined) {
      invalid(
        diagnostics,
        "design-story-pin-missing",
        target,
        file,
        `Shot "${entry.shot}" carries no story-clock pin, so event "${entry.event}" has no story time to compare. Add storyTime to the tracked shot contract record for "${entry.shot}", or drop it from ${id}.criterion.events.`,
      );
      continue;
    }
    // An unusable pin is already diagnosed on its own shot. Mapping a window
    // through it would produce a second, derived complaint about a number the
    // author has yet to fix, so the reachability question waits for a pin that
    // can answer it.
    if (
      Number.isFinite(pin.originSeconds) === false ||
      (pin.rate !== undefined &&
        (Number.isFinite(pin.rate) === false || pin.rate <= 0))
    )
      continue;
    windows.push({
      from: autoMovieStoryTime(pin, event.window.from),
      to: autoMovieStoryTime(pin, event.window.to),
    });
  }
  if (
    toleranceUsable === false ||
    windows.length !== criterion.events.length ||
    windows.some(
      (window) =>
        Number.isFinite(window.from) === false ||
        Number.isFinite(window.to) === false ||
        window.from > window.to,
    )
  )
    return;
  // Every realized time is confined to its own mapped window, so the closest
  // the events can possibly be placed is the latest window opening minus the
  // earliest window closing. Nothing below zero: overlapping windows can always
  // coincide exactly.
  const latestOpening = Math.max(...windows.map((window) => window.from));
  const earliestClosing = Math.min(...windows.map((window) => window.to));
  const closest = Math.max(0, latestOpening - earliestClosing);
  if (closest > criterion.toleranceSeconds)
    invalid(
      diagnostics,
      "design-story-sync-unsatisfiable",
      target,
      file,
      `Acceptance "${id}" claims simultaneity within ${criterion.toleranceSeconds}s, but the declared event windows cannot come closer than ${closest}s on the story clock, so no source could ever satisfy it. Widen the windows, repin a shot, or raise ${id}.criterion.toleranceSeconds.`,
    );
};

/** Registered archetype names, for a diagnostic that has to name the choices. */
const registeredArchetypeNames = (
  archetypes: AutoMovieModelArchetypeRegistry,
): string =>
  [...archetypes.keys()].sort(compareCodeUnits).join(", ") || "none registered";

/**
 * Judge one parameter map against the archetype that owns it.
 *
 * The schema, the bounds, and which keys a discriminating value makes
 * meaningful all belong to the archetype. This gate only turns those facts into
 * diagnostics, which is why an unregistered archetype leaves early: without a
 * builder there is no contract to measure the map against, and the recipe has
 * already been refused for naming one.
 */
const validateModelParameters = (
  diagnostics: IAutoMovieDiagnostic[],
  model: IAutoMovieModelRecipe,
  archetype: IAutoMovieModelArchetype | undefined,
  target: string,
  file: string,
): void => {
  if (archetype === undefined) return;
  const plan = archetype.plan(model.parameters);
  for (const key of plan.required)
    if (key in model.parameters === false)
      invalid(
        diagnostics,
        "model-parameter-missing",
        target,
        file,
        `Required parameter "${key}" is missing for ${model.archetype}. Add it in the tracked model recipe record.`,
      );
  for (const refusal of plan.refusals) {
    const registered = AUTOMOVIE_DIAGNOSTIC_CODE_SET.has(refusal.code);
    invalid(
      diagnostics,
      registered
        ? (refusal.code as AutoMovieDiagnosticCode)
        : "model-parameter-invalid",
      target,
      file,
      registered
        ? refusal.message
        : `Archetype returned unregistered diagnostic code "${refusal.code}". Register a closed AutoMovie diagnostic identity or correct the archetype plan. ${refusal.message}`,
    );
  }
  const accepted = plan.accepted === null ? null : new Set(plan.accepted);
  for (const [key, value] of Object.entries(model.parameters)) {
    const rule = archetype.parameters[key];
    if (
      rule === undefined ||
      (accepted !== null && accepted.has(key) === false)
    ) {
      invalid(
        diagnostics,
        "model-parameter-unsupported",
        target,
        file,
        `Parameter "${key}" is unsupported for ${model.archetype}. Remove it from the tracked model recipe record.`,
      );
      continue;
    }
    if (typeof value !== rule.kind) {
      invalid(
        diagnostics,
        "model-parameter-invalid",
        target,
        file,
        `Parameter "${key}" must be ${rule.kind}. Fix it in the tracked model recipe record.`,
      );
      continue;
    }
    if (
      rule.kind === "number" &&
      (Number.isFinite(value as number) === false ||
        (rule.minimum !== undefined && (value as number) < rule.minimum) ||
        (rule.maximum !== undefined && (value as number) > rule.maximum))
    )
      invalid(
        diagnostics,
        "model-parameter-invalid",
        target,
        file,
        `Parameter "${key}" is outside its supported range. Fix it in the tracked model recipe record.`,
      );
  }
};

const validateModelProfiles = (
  diagnostics: IAutoMovieDiagnostic[],
  profiles: readonly IAutoMovieProfile[],
  target: string,
  file: string,
): void => {
  const validation = validateProfileCapabilities({ profiles });
  if (validation.success === false) {
    for (const violation of validation.violations)
      invalid(
        diagnostics,
        violation.kind === "range"
          ? "design-range-invalid"
          : violation.expected.includes("unique")
            ? "design-capability-duplicate"
            : "design-text-empty",
        target,
        file,
        `${violation.path}: ${violation.expected}. Correct the typed profile data before writing the model recipe record.`,
      );
    return;
  }
  const profileIds = new Set<string>();
  for (const profile of profiles) {
    unique(diagnostics, profileIds, profile.id, target, file, "profiles");
    text(diagnostics, profile.name, target, file, "profiles.name");
    const traitKinds = new Set<string>();
    for (const trait of profile.traits ?? []) {
      if (traitKinds.has(trait.kind))
        invalid(
          diagnostics,
          "design-capability-duplicate",
          target,
          file,
          `Profile "${profile.id}" repeats ${trait.kind}. Keep one typed trait of each kind.`,
        );
      traitKinds.add(trait.kind);
      if (trait.kind === "mountable") {
        integer(
          diagnostics,
          trait.seats,
          1,
          1_024,
          target,
          file,
          `profiles.${profile.id}.mountable.seats`,
        );
        positive(
          diagnostics,
          trait.payloadMass,
          target,
          file,
          `profiles.${profile.id}.mountable.payloadMass`,
        );
        continue;
      }
      positive(
        diagnostics,
        trait.durability,
        target,
        file,
        `profiles.${profile.id}.destructible.durability`,
      );
      positive(
        diagnostics,
        trait.impactBody.mass,
        target,
        file,
        `profiles.${profile.id}.destructible.impactBody.mass`,
      );
      bounded(
        diagnostics,
        trait.impactBody.restitution,
        0,
        1,
        target,
        file,
        `profiles.${profile.id}.destructible.impactBody.restitution`,
      );
      positive(
        diagnostics,
        trait.impactBody.hardness,
        target,
        file,
        `profiles.${profile.id}.destructible.impactBody.hardness`,
      );
      positive(
        diagnostics,
        trait.impactBody.penetrability,
        target,
        file,
        `profiles.${profile.id}.destructible.impactBody.penetrability`,
      );
    }
  }
};

const validateInstanceSets = (
  diagnostics: IAutoMovieDiagnostic[],
  graph: IAutoMovieProductionDesignGraph,
  routeIds: ReadonlySet<string>,
  file: string,
): void => {
  const instanceSets = graph.world?.instanceSets ?? [];
  const ids = new Set<string>();
  let total = 0;
  let bufferBytes = 0;
  for (const instanceSet of instanceSets) {
    const target = `instance-set:${instanceSet.id}`;
    unique(diagnostics, ids, instanceSet.id, target, file, "instanceSets");
    text(diagnostics, instanceSet.modelRecipe, target, file, "modelRecipe");
    const model = graph.models.get(instanceSet.modelRecipe);
    if (model === undefined)
      missing(
        diagnostics,
        target,
        file,
        `model recipe "${instanceSet.modelRecipe}"`,
        `Create or correct the model recipe record for "${instanceSet.modelRecipe}" or change ${instanceSet.id}.modelRecipe`,
      );
    integer(
      diagnostics,
      instanceSet.count,
      1,
      AUTOMOVIE_MAX_FORMATION_MEMBERS,
      target,
      file,
      "count",
    );
    total += instanceSet.count;
    boundedVector(
      diagnostics,
      instanceSet.anchor,
      -AUTOMOVIE_WORLD_COORDINATE_LIMIT,
      AUTOMOVIE_WORLD_COORDINATE_LIMIT,
      target,
      file,
      "anchor",
    );
    finite(diagnostics, instanceSet.facingDeg, target, file, "facingDeg");
    integer(
      diagnostics,
      instanceSet.seed,
      0,
      Number.MAX_SAFE_INTEGER,
      target,
      file,
      "seed",
    );
    const layout = instanceSet.layout;
    if (layout.kind === "grid") {
      integer(
        diagnostics,
        layout.rows,
        1,
        instanceSet.count,
        target,
        file,
        "layout.rows",
      );
      integer(
        diagnostics,
        layout.columns,
        1,
        instanceSet.count,
        target,
        file,
        "layout.columns",
      );
      positive(diagnostics, layout.spacing.x, target, file, "layout.spacing.x");
      positive(diagnostics, layout.spacing.z, target, file, "layout.spacing.z");
      if (layout.rows * layout.columns < instanceSet.count)
        invalid(
          diagnostics,
          "design-range-invalid",
          target,
          file,
          `Instance grid capacity ${layout.rows * layout.columns} is below count ${instanceSet.count}. Increase rows or columns.`,
        );
      const radius = Math.hypot(
        ((layout.columns - 1) * layout.spacing.x) / 2,
        (layout.rows - 1) * layout.spacing.z,
      );
      validateInstanceHorizontalExtent(
        diagnostics,
        instanceSet.anchor,
        radius,
        target,
        file,
        "grid",
      );
    } else if (layout.kind === "scatter") {
      positive(diagnostics, layout.radius, target, file, "layout.radius");
      validateInstanceHorizontalExtent(
        diagnostics,
        instanceSet.anchor,
        layout.radius,
        target,
        file,
        "scatter",
      );
    } else if (layout.kind === "along-route") {
      text(diagnostics, layout.route, target, file, "layout.route");
      if (routeIds.has(layout.route) === false)
        missing(
          diagnostics,
          target,
          file,
          `route "${layout.route}"`,
          `add it to world.routes or change ${instanceSet.id}.layout.route`,
        );
      bounded(
        diagnostics,
        layout.lateralJitter,
        0,
        AUTOMOVIE_WORLD_COORDINATE_LIMIT,
        target,
        file,
        "layout.lateralJitter",
      );
      const route = graph.world?.routes.find(
        (candidate) => candidate.id === layout.route,
      );
      if (
        route !== undefined &&
        route.waypoints.some(
          (point) =>
            Math.abs(point.x) + layout.lateralJitter >
              AUTOMOVIE_WORLD_COORDINATE_LIMIT ||
            Math.abs(point.z) + layout.lateralJitter >
              AUTOMOVIE_WORLD_COORDINATE_LIMIT,
        )
      )
        invalid(
          diagnostics,
          "design-range-invalid",
          target,
          file,
          `Along-route instance set "${instanceSet.id}" can jitter beyond the supported world coordinate limit. Reduce lateralJitter or move the route inward.`,
        );
    } else if (layout.kind === "lattice") {
      integer(
        diagnostics,
        layout.rows,
        1,
        instanceSet.count,
        target,
        file,
        "layout.rows",
      );
      integer(
        diagnostics,
        layout.columns,
        1,
        instanceSet.count,
        target,
        file,
        "layout.columns",
      );
      integer(
        diagnostics,
        layout.layers,
        1,
        instanceSet.count,
        target,
        file,
        "layout.layers",
      );
      boundedVector(
        diagnostics,
        layout.spacing,
        Number.EPSILON,
        AUTOMOVIE_WORLD_COORDINATE_LIMIT,
        target,
        file,
        "layout.spacing",
      );
      if (layout.rows * layout.columns * layout.layers < instanceSet.count)
        invalid(
          diagnostics,
          "design-range-invalid",
          target,
          file,
          `Instance lattice capacity ${layout.rows * layout.columns * layout.layers} is below count ${instanceSet.count}. Increase rows, columns, or layers.`,
        );
      // Columns are centred on the anchor and rows run forward from it, which
      // is exactly how the slot is materialised, so the reach is measured the
      // same way rather than assumed symmetric. Grid and scatter have been held
      // to the world limit since they existed; a lattice reaches further than
      // either for the same spacing and was never measured at all.
      validateInstanceHorizontalExtent(
        diagnostics,
        instanceSet.anchor,
        Math.hypot(
          ((layout.columns - 1) * layout.spacing.x) / 2,
          (layout.rows - 1) * layout.spacing.z,
        ),
        target,
        file,
        "lattice",
      );
    } else {
      if (layout.transforms.length !== instanceSet.count)
        invalid(
          diagnostics,
          "design-range-invalid",
          target,
          file,
          `Explicit transform count ${layout.transforms.length} must equal instance count ${instanceSet.count}.`,
        );
      const transformIds = new Set<string>();
      const knownPrototypeIds = new Set([
        "default",
        ...(instanceSet.prototypes ?? []).map((prototype) => prototype.id),
      ]);
      for (const [index, transform] of layout.transforms.entries()) {
        unique(
          diagnostics,
          transformIds,
          transform.id,
          target,
          file,
          "layout.transforms",
        );
        boundedVector(
          diagnostics,
          transform.translation,
          -AUTOMOVIE_WORLD_COORDINATE_LIMIT,
          AUTOMOVIE_WORLD_COORDINATE_LIMIT,
          target,
          file,
          `layout.transforms[${index}].translation`,
        );
        // Each translation is anchor-relative, so a slot inside the limit and
        // an anchor inside the limit still place a piece outside it. Every
        // other layout is measured from its anchor; this one measured only the
        // offset.
        validateInstanceHorizontalExtent(
          diagnostics,
          instanceSet.anchor,
          Math.hypot(transform.translation.x, transform.translation.z),
          target,
          file,
          "explicit",
        );
        const norm = Math.hypot(
          transform.rotation.x,
          transform.rotation.y,
          transform.rotation.z,
          transform.rotation.w,
        );
        if (Number.isFinite(norm) === false || Math.abs(norm - 1) > 1e-6)
          invalid(
            diagnostics,
            "design-quaternion-invalid",
            target,
            file,
            `Explicit transform "${transform.id}" rotation must be a finite unit quaternion.`,
          );
        boundedVector(
          diagnostics,
          transform.scale,
          Number.EPSILON,
          1_000,
          target,
          file,
          `layout.transforms[${index}].scale`,
        );
        if (
          transform.prototype !== undefined &&
          knownPrototypeIds.has(transform.prototype) === false
        )
          missing(
            diagnostics,
            target,
            file,
            `instance prototype "${transform.prototype}"`,
            `add it to ${instanceSet.id}.prototypes or use "default"`,
          );
        if (
          transform.palette !== undefined &&
          /^#[0-9a-f]{6}$/i.test(transform.palette) === false
        )
          invalid(
            diagnostics,
            "design-color-invalid",
            target,
            file,
            `Explicit transform "${transform.id}" palette must be one opaque #RRGGBB value.`,
          );
        for (const [name, value] of Object.entries(transform.traits ?? {})) {
          finite(
            diagnostics,
            value,
            target,
            file,
            `layout.transforms[${index}].traits.${name}`,
          );
          if (
            instanceSet.variation.traits.some(
              (trait) => trait.name === name,
            ) === false
          )
            invalid(
              diagnostics,
              "design-reference-invalid",
              target,
              file,
              `Explicit transform "${transform.id}" overrides undeclared trait "${name}".`,
            );
        }
      }
    }
    const prototypeIds = new Set<string>();
    let maximumPrototypeLodCount = Math.max(1, model?.lod.length ?? 0);
    for (const prototype of instanceSet.prototypes ?? []) {
      unique(
        diagnostics,
        prototypeIds,
        prototype.id,
        target,
        file,
        "prototypes",
      );
      if (prototype.id === "default")
        invalid(
          diagnostics,
          "design-id-reserved",
          target,
          file,
          'Instance prototype id "default" is reserved for modelRecipe.',
        );
      text(
        diagnostics,
        prototype.modelRecipe,
        target,
        file,
        `prototypes.${prototype.id}.modelRecipe`,
      );
      const prototypeModel = graph.models.get(prototype.modelRecipe);
      if (prototypeModel === undefined)
        missing(
          diagnostics,
          target,
          file,
          `model recipe "${prototype.modelRecipe}"`,
          `create it or correct prototype "${prototype.id}"`,
        );
      positive(
        diagnostics,
        prototype.weight,
        target,
        file,
        `prototypes.${prototype.id}.weight`,
      );
      maximumPrototypeLodCount = Math.max(
        maximumPrototypeLodCount,
        Math.max(1, prototypeModel?.lod.length ?? 0),
      );
    }
    boundedRange(
      diagnostics,
      instanceSet.variation.scale,
      Number.EPSILON,
      1_000,
      target,
      file,
      "variation.scale",
    );
    if (instanceSet.variation.scale3 !== undefined) {
      boundedVector(
        diagnostics,
        instanceSet.variation.scale3.min,
        Number.EPSILON,
        1_000,
        target,
        file,
        "variation.scale3.min",
      );
      boundedVector(
        diagnostics,
        instanceSet.variation.scale3.max,
        Number.EPSILON,
        1_000,
        target,
        file,
        "variation.scale3.max",
      );
      for (const axis of ["x", "y", "z"] as const)
        if (
          instanceSet.variation.scale3.min[axis] >
          instanceSet.variation.scale3.max[axis]
        )
          invalid(
            diagnostics,
            "design-range-invalid",
            target,
            file,
            `variation.scale3.${axis} min must not exceed max.`,
          );
    }
    if (instanceSet.variation.rotationDeg !== undefined)
      for (const axis of ["x", "y", "z"] as const)
        boundedRange(
          diagnostics,
          instanceSet.variation.rotationDeg[axis],
          -360_000,
          360_000,
          target,
          file,
          `variation.rotationDeg.${axis}`,
        );
    if (instanceSet.variation.visibleProbability !== undefined)
      bounded(
        diagnostics,
        instanceSet.variation.visibleProbability,
        0,
        1,
        target,
        file,
        "variation.visibleProbability",
      );
    if (instanceSet.variation.palette.length === 0)
      invalid(
        diagnostics,
        "design-collection-empty",
        target,
        file,
        "Instance variation palette must contain at least one #RRGGBB color.",
      );
    uniqueTextValues(
      diagnostics,
      instanceSet.variation.palette,
      target,
      file,
      "variation.palette",
    );
    for (const color of instanceSet.variation.palette)
      if (/^#[0-9a-f]{6}$/i.test(color) === false)
        invalid(
          diagnostics,
          "design-color-invalid",
          target,
          file,
          `Instance palette color "${color}" must be one opaque #RRGGBB value.`,
        );
    const traitNames = new Set<string>();
    for (const trait of instanceSet.variation.traits) {
      unique(
        diagnostics,
        traitNames,
        trait.name,
        target,
        file,
        "variation.traits",
      );
      bounded(
        diagnostics,
        trait.min,
        -AUTOMOVIE_WORLD_COORDINATE_LIMIT,
        AUTOMOVIE_WORLD_COORDINATE_LIMIT,
        target,
        file,
        `${trait.name}.min`,
      );
      bounded(
        diagnostics,
        trait.max,
        -AUTOMOVIE_WORLD_COORDINATE_LIMIT,
        AUTOMOVIE_WORLD_COORDINATE_LIMIT,
        target,
        file,
        `${trait.name}.max`,
      );
      if (trait.min > trait.max)
        invalid(
          diagnostics,
          "design-range-invalid",
          target,
          file,
          `Instance trait "${trait.name}" min must not exceed max.`,
        );
    }
    const lodCount = maximumPrototypeLodCount;
    bufferBytes +=
      instanceSet.count *
      lodCount *
      (16 * Float32Array.BYTES_PER_ELEMENT +
        3 * Float32Array.BYTES_PER_ELEMENT +
        Float32Array.BYTES_PER_ELEMENT *
          (1 + instanceSet.variation.traits.length));
  }
  if (
    Number.isSafeInteger(total) === false ||
    total > AUTOMOVIE_MAX_GENERAL_INSTANCES
  )
    invalid(
      diagnostics,
      "design-range-invalid",
      "instance-sets",
      file,
      `The world declares ${total} general instances, above the compact-runtime limit ${AUTOMOVIE_MAX_GENERAL_INSTANCES}. Reduce the total.`,
    );
  if (
    Number.isSafeInteger(bufferBytes) === false ||
    bufferBytes > AUTOMOVIE_GENERAL_INSTANCE_BUFFER_BUDGET_BYTES
  )
    invalid(
      diagnostics,
      "design-budget-exceeded",
      "instance-sets",
      file,
      `General instance matrices, colors, scales, and traits require ${bufferBytes} bytes, above the ${AUTOMOVIE_GENERAL_INSTANCE_BUFFER_BUDGET_BYTES}-byte viewer budget.`,
    );
};

/**
 * A dressing tolerance is a distance, so it obeys the same bounds spacing does,
 * except that zero is meaningful: it is how a layout asks for exact geometry.
 *
 * And it is bounded by the interval it perturbs. A tolerance says how far a
 * member may stand off its own place, so two neighbours may each come that far
 * toward each other: at half the interval between them they can stand in
 * exactly one place, and above it they can change places. That is not a loosely
 * dressed line, it is a line that has stopped being one, and saying so needs no
 * knowledge of how large a member is.
 *
 * Which interval depends on the layout, because each states its own. A lattice
 * states two spacings and each tolerance answers to the one it moves along, the
 * other only carrying a member further away. An arc states none, so the
 * interval is the chord between neighbouring slots that its radius, covered
 * angle and count fix together, and the tolerance measured against it is the
 * smaller of the two: a chord runs in a direction the layout chose and no
 * tolerance is certain to close it by more than its narrower side. An arc of
 * one member has no neighbour and so no interval to keep.
 *
 * This refuses a tolerance that has stopped being one, and nothing finer. Where
 * members really end up standing once a tolerance is applied is a question
 * about placement, and the compiler answers it against the real dressed
 * positions.
 */
const validateFormationDressing = (
  diagnostics: IAutoMovieDiagnostic[],
  formation: IAutoMovieFormationDesign,
  target: string,
  file: string,
): void => {
  const layout = formation.layout;
  if (layout.kind === "scatter") return;
  const dressing = layout.dressing;
  if (dressing === undefined) return;
  bounded(
    diagnostics,
    dressing.lateral,
    0,
    10_000,
    target,
    file,
    "layout.dressing.lateral",
  );
  bounded(
    diagnostics,
    dressing.depth,
    0,
    10_000,
    target,
    file,
    "layout.dressing.depth",
  );
  if (layout.kind === "arc") {
    // An arc of one member has no neighbour, so there is no interval to keep
    // and no divisor to take. Every comparison against an unreachable chord is
    // false, which is how that case declines without a rule of its own.
    const chord =
      formation.count < 2
        ? Number.POSITIVE_INFINITY
        : 2 *
          layout.radius *
          Math.sin(
            (layout.arcDegrees * Math.PI) / 180 / (2 * (formation.count - 1)),
          );
    if (2 * Math.min(dressing.lateral, dressing.depth) >= chord)
      invalid(
        diagnostics,
        "design-range-invalid",
        target,
        file,
        `Dressing can move two neighbouring members of this arc onto one another, because twice its narrower tolerance reaches the whole chord between adjacent slots whichever way that chord runs. Reduce layout.dressing, or widen layout.radius or layout.arcDegrees, in the tracked formation design record.`,
      );
    return;
  }
  dressedInterval(
    diagnostics,
    dressing.lateral,
    layout.spacing.lateral,
    "lateral",
    target,
    file,
  );
  dressedInterval(
    diagnostics,
    dressing.depth,
    layout.spacing.depth,
    "depth",
    target,
    file,
  );
};

/**
 * Refuse one tolerance that reaches the whole interval it is drawn across.
 *
 * Stated as the comparison that has to hold rather than as a guard around it,
 * so a tolerance or a spacing that is not a real measurement declines on its
 * own: no comparison against one is ever true. Those are already refused as
 * ranges, and saying a second time that a number nobody can read closes an
 * interval nobody can read would be noise rather than a correction.
 */
const dressedInterval = (
  diagnostics: IAutoMovieDiagnostic[],
  tolerance: number,
  spacing: number,
  axis: string,
  target: string,
  file: string,
): void => {
  if (2 * tolerance >= spacing)
    invalid(
      diagnostics,
      "design-range-invalid",
      target,
      file,
      `Dressing tolerance ${tolerance} m reaches half the ${spacing} m ${axis} interval it perturbs, so two neighbouring members can stand in one place. Keep twice layout.dressing.${axis} below layout.spacing.${axis} in the tracked formation design record.`,
    );
};

const validateFormationLayout = (
  diagnostics: IAutoMovieDiagnostic[],
  formation: IAutoMovieFormationDesign,
  target: string,
  file: string,
): void => {
  const layout = formation.layout;
  validateFormationDressing(diagnostics, formation, target, file);
  if (layout.kind === "line" || layout.kind === "column") {
    bounded(
      diagnostics,
      layout.spacing.lateral,
      Number.EPSILON,
      10_000,
      target,
      file,
      "layout.spacing.lateral",
    );
    bounded(
      diagnostics,
      layout.spacing.depth,
      Number.EPSILON,
      10_000,
      target,
      file,
      "layout.spacing.depth",
    );
    integer(
      diagnostics,
      layout.ranks,
      1,
      formation.count,
      target,
      file,
      "layout.ranks",
    );
    integer(
      diagnostics,
      layout.files,
      1,
      formation.count,
      target,
      file,
      "layout.files",
    );
    if (layout.ranks * layout.files < formation.count)
      invalid(
        diagnostics,
        "design-range-invalid",
        target,
        file,
        `Layout capacity ${layout.ranks * layout.files} is below count ${formation.count}. Fix layout in the tracked formation design record.`,
      );
  } else if (layout.kind === "wedge") {
    bounded(
      diagnostics,
      layout.spacing.lateral,
      Number.EPSILON,
      10_000,
      target,
      file,
      "layout.spacing.lateral",
    );
    bounded(
      diagnostics,
      layout.spacing.depth,
      Number.EPSILON,
      10_000,
      target,
      file,
      "layout.spacing.depth",
    );
    integer(
      diagnostics,
      layout.depth,
      1,
      formation.count,
      target,
      file,
      "layout.depth",
    );
    if (layout.depth * layout.depth < formation.count)
      invalid(
        diagnostics,
        "design-range-invalid",
        target,
        file,
        `Wedge depth ${layout.depth} materializes ${layout.depth * layout.depth} slots, below count ${formation.count}. Increase layout.depth in the tracked formation design record.`,
      );
  } else {
    bounded(
      diagnostics,
      layout.radius,
      Number.EPSILON,
      AUTOMOVIE_WORLD_COORDINATE_LIMIT,
      target,
      file,
      "layout.radius",
    );
    if (
      layout.kind === "arc" &&
      (Number.isFinite(layout.arcDegrees) === false ||
        layout.arcDegrees <= 0 ||
        layout.arcDegrees > 360)
    )
      invalid(
        diagnostics,
        "design-range-invalid",
        target,
        file,
        `Arc degrees must be above 0 and at most 360. Fix layout in the tracked formation design record.`,
      );
    if (layout.kind === "scatter")
      integer(
        diagnostics,
        layout.seed,
        0,
        Number.MAX_SAFE_INTEGER,
        target,
        file,
        "layout.seed",
      );
  }
};

const validateInstanceHorizontalExtent = (
  diagnostics: IAutoMovieDiagnostic[],
  anchor: { x: number; z: number },
  radius: number,
  target: string,
  file: string,
  layout: string,
): void => {
  if (
    Number.isFinite(radius) === false ||
    Math.abs(anchor.x) + radius > AUTOMOVIE_WORLD_COORDINATE_LIMIT ||
    Math.abs(anchor.z) + radius > AUTOMOVIE_WORLD_COORDINATE_LIMIT
  )
    invalid(
      diagnostics,
      "design-range-invalid",
      target,
      file,
      `Instance ${layout} derives coordinates beyond the supported world limit. Reduce its extent or move its anchor inward.`,
    );
};

const invalid = (
  diagnostics: IAutoMovieDiagnostic[],
  code: AutoMovieDiagnosticCode,
  target: string,
  path: string,
  message: string,
): void => {
  diagnostics.push({
    code,
    category: "error",
    phase: "design",
    target,
    path,
    message,
  });
};

const missing = (
  diagnostics: IAutoMovieDiagnostic[],
  target: string,
  file: string,
  dependency: string,
  correction: string,
): void =>
  invalid(
    diagnostics,
    "design-reference-missing",
    target,
    file,
    `Referenced ${dependency} does not exist. ${correction}.`,
  );

const unique = (
  diagnostics: IAutoMovieDiagnostic[],
  seen: Set<string>,
  id: string,
  target: string,
  file: string,
  field: string,
): void => {
  text(diagnostics, id, target, file, `${field}.id`);
  if (seen.has(id))
    invalid(
      diagnostics,
      "design-duplicate-id",
      target,
      file,
      `Duplicate id "${id}" appears in ${field}. Keep each id once in its design setter.`,
    );
  seen.add(id);
};

const uniqueTextValues = (
  diagnostics: IAutoMovieDiagnostic[],
  values: readonly string[],
  target: string,
  file: string,
  field: string,
): void => {
  const seen = new Set<string>();
  for (const value of values) {
    text(diagnostics, value, target, file, field);
    if (seen.has(value))
      invalid(
        diagnostics,
        "design-duplicate-id",
        target,
        file,
        `Duplicate value "${value}" appears in ${field}. Keep each value once in its design setter.`,
      );
    seen.add(value);
  }
};

const validateNamedStates = (
  diagnostics: IAutoMovieDiagnostic[],
  graph: IAutoMovieProductionDesignGraph,
  states: readonly {
    id: string;
    description: string;
    predicates: IAutoMovieShotPredicate[];
  }[],
  target: string,
  file: string,
  field: string,
): void => {
  const seen = new Set<string>();
  for (const state of states) {
    unique(diagnostics, seen, state.id, target, file, field);
    text(diagnostics, state.description, target, file, `${field}.description`);
    validatePredicates(
      diagnostics,
      graph,
      state.predicates,
      target,
      file,
      `${field}.${state.id}.predicates`,
    );
  }
};

const validatePredicates = (
  diagnostics: IAutoMovieDiagnostic[],
  graph: IAutoMovieProductionDesignGraph,
  predicates: readonly IAutoMovieShotPredicate[],
  target: string,
  file: string,
  field: string,
): void => {
  if (predicates.length === 0)
    invalid(
      diagnostics,
      "design-collection-empty",
      target,
      file,
      `${field} must contain at least one machine-checkable predicate. Descriptive prose cannot prove compiled realization.`,
    );
  const selector = (
    value:
      | Extract<IAutoMovieShotPredicate, { kind: "position" }>["subject"]
      | Extract<IAutoMovieShotPredicate, { kind: "distance" }>["from"],
    path: string,
  ): void => {
    if (value.kind === "point")
      vector(diagnostics, value.position, target, file, path);
    else {
      text(diagnostics, value.id, target, file, `${path}.id`);
      if (
        value.kind === "formation" &&
        graph.formations.has(value.id) === false
      )
        missing(
          diagnostics,
          target,
          file,
          `formation "${value.id}"`,
          `Create or correct the formation design record for "${value.id}" or correct ${path}`,
        );
      if (
        value.kind === "landmark" &&
        graph.world?.landmarks.some((landmark) => landmark.id === value.id) !==
          true
      )
        missing(
          diagnostics,
          target,
          file,
          `landmark "${value.id}"`,
          `add that landmark to the tracked world design record or correct ${path}`,
        );
    }
  };
  for (const predicate of predicates) {
    finite(diagnostics, predicate.value, target, file, `${field}.value`);
    if (
      Number.isFinite(predicate.tolerance) === false ||
      predicate.tolerance < 0
    )
      invalid(
        diagnostics,
        "design-range-invalid",
        target,
        file,
        `${field}.tolerance must be a finite non-negative value. Correct the predicate.`,
      );
    if (predicate.kind === "joint-angle")
      text(diagnostics, predicate.actor, target, file, `${field}.actor`);
    else if (predicate.kind === "position")
      selector(predicate.subject, `${field}.subject`);
    else {
      selector(predicate.from, `${field}.from`);
      selector(predicate.to, `${field}.to`);
    }
  }
};

/**
 * Whether a time is numerically equivalent to one integer production frame.
 *
 * @author Samchon
 */
export const isProductionFrameTime = (
  time: number,
  input: number | IAutoMovieProductionFrameRate,
): boolean => {
  if (Number.isFinite(time) === false || time < 0) return false;
  try {
    const frameRate =
      typeof input === "number"
        ? resolveProductionFrameRate({ fps: input })
        : resolveProductionFrameRate({
            fps: input.numerator / input.denominator,
            frameRate: input,
          });
    const frame = Math.round(
      (time * frameRate.numerator) / frameRate.denominator,
    );
    return (
      Number.isSafeInteger(frame) &&
      time === (frame * frameRate.denominator) / frameRate.numerator
    );
  } catch {
    return false;
  }
};

const text = (
  diagnostics: IAutoMovieDiagnostic[],
  value: string,
  target: string,
  file: string,
  field: string,
): void => {
  if (value.trim().length === 0)
    invalid(
      diagnostics,
      "design-text-empty",
      target,
      file,
      `${field} must contain non-whitespace text. Fix ${field} in its design setter.`,
    );
};

const validateCaptionGraphemeSegmentationIdentity = (
  diagnostics: IAutoMovieDiagnostic[],
  value: unknown,
  profileId: string,
  target: string,
  file: string,
): void => {
  const field = `captionReadabilityProfiles.${profileId}.segmentation`;
  if (typeof value !== "object" || value === null) {
    invalid(
      diagnostics,
      "design-reference-invalid",
      target,
      file,
      `${field} must carry a complete grapheme segmentation identity. Copy a supported package identity or declare another complete runtime identity.`,
    );
    return;
  }
  const identity = value as Record<string, unknown>;
  if (typeof identity.algorithm === "string")
    text(diagnostics, identity.algorithm, target, file, `${field}.algorithm`);
  else
    invalid(
      diagnostics,
      "design-reference-invalid",
      target,
      file,
      `${field}.algorithm must be non-blank text.`,
    );
  if (typeof identity.version === "string")
    text(diagnostics, identity.version, target, file, `${field}.version`);
  else
    invalid(
      diagnostics,
      "design-reference-invalid",
      target,
      file,
      `${field}.version must be non-blank text.`,
    );
  if (identity.granularity !== "grapheme")
    invalid(
      diagnostics,
      "design-reference-invalid",
      target,
      file,
      `${field}.granularity must be "grapheme".`,
    );
  if (typeof identity.locale !== "object" || identity.locale === null) {
    invalid(
      diagnostics,
      "design-reference-invalid",
      target,
      file,
      `${field}.locale must declare requested-resolved or locale-neutral execution.`,
    );
    return;
  }
  const locale = identity.locale as Record<string, unknown>;
  if (locale.kind === "locale-neutral") return;
  if (locale.kind !== "requested-resolved") {
    invalid(
      diagnostics,
      "design-reference-invalid",
      target,
      file,
      `${field}.locale.kind must be "requested-resolved" or "locale-neutral".`,
    );
    return;
  }
  if (typeof locale.requested === "string")
    text(
      diagnostics,
      locale.requested,
      target,
      file,
      `${field}.locale.requested`,
    );
  else
    invalid(
      diagnostics,
      "design-reference-invalid",
      target,
      file,
      `${field}.locale.requested must be non-blank text.`,
    );
  if (typeof locale.resolved === "string")
    text(
      diagnostics,
      locale.resolved,
      target,
      file,
      `${field}.locale.resolved`,
    );
  else
    invalid(
      diagnostics,
      "design-reference-invalid",
      target,
      file,
      `${field}.locale.resolved must be non-blank text.`,
    );
};

const positive = (
  diagnostics: IAutoMovieDiagnostic[],
  value: number,
  target: string,
  file: string,
  field: string,
): void => {
  if (Number.isFinite(value) === false || value <= 0)
    invalid(
      diagnostics,
      "design-range-invalid",
      target,
      file,
      `${field} must be a finite value above zero. Fix ${field} in its design setter.`,
    );
};

const bounded = (
  diagnostics: IAutoMovieDiagnostic[],
  value: number,
  min: number,
  max: number,
  target: string,
  file: string,
  field: string,
): void => {
  if (Number.isFinite(value) === false || value < min || value > max)
    invalid(
      diagnostics,
      "design-range-invalid",
      target,
      file,
      `${field} must be a finite value from ${min} through ${max}. Fix ${field} in its design setter.`,
    );
};

const boundedRange = (
  diagnostics: IAutoMovieDiagnostic[],
  value: { min: number; max: number },
  min: number,
  max: number,
  target: string,
  file: string,
  field: string,
): void => {
  bounded(diagnostics, value.min, min, max, target, file, `${field}.min`);
  bounded(diagnostics, value.max, min, max, target, file, `${field}.max`);
  if (
    Number.isFinite(value.min) &&
    Number.isFinite(value.max) &&
    value.min > value.max
  )
    invalid(
      diagnostics,
      "design-range-invalid",
      target,
      file,
      `${field}.min must not exceed ${field}.max. Fix the range in its design setter.`,
    );
};

const integer = (
  diagnostics: IAutoMovieDiagnostic[],
  value: number,
  min: number,
  max: number,
  target: string,
  file: string,
  field: string,
): void => {
  if (Number.isInteger(value) === false || value < min || value > max)
    invalid(
      diagnostics,
      "design-range-invalid",
      target,
      file,
      `${field} must be an integer from ${min} through ${max}. Fix ${field} in its design setter.`,
    );
};

const finite = (
  diagnostics: IAutoMovieDiagnostic[],
  value: number,
  target: string,
  file: string,
  field: string,
): void => {
  if (Number.isFinite(value) === false)
    invalid(
      diagnostics,
      "design-range-invalid",
      target,
      file,
      `${field} must be finite. Fix ${field} in its design setter.`,
    );
};

const vector = (
  diagnostics: IAutoMovieDiagnostic[],
  value: { x: number; y: number; z: number },
  target: string,
  file: string,
  field: string,
): void => {
  finite(diagnostics, value.x, target, file, `${field}.x`);
  finite(diagnostics, value.y, target, file, `${field}.y`);
  finite(diagnostics, value.z, target, file, `${field}.z`);
};

const boundedVector = (
  diagnostics: IAutoMovieDiagnostic[],
  value: { x: number; y: number; z: number },
  min: number,
  max: number,
  target: string,
  file: string,
  field: string,
): void => {
  bounded(diagnostics, value.x, min, max, target, file, `${field}.x`);
  bounded(diagnostics, value.y, min, max, target, file, `${field}.y`);
  bounded(diagnostics, value.z, min, max, target, file, `${field}.z`);
};

const bounded2 = (
  diagnostics: IAutoMovieDiagnostic[],
  value: { x: number; z: number },
  min: number,
  max: number,
  target: string,
  file: string,
  field: string,
): void => {
  bounded(diagnostics, value.x, min, max, target, file, `${field}.x`);
  bounded(diagnostics, value.z, min, max, target, file, `${field}.z`);
};

const compareDiagnostics = (
  left: IAutoMovieDiagnostic,
  right: IAutoMovieDiagnostic,
): number =>
  compareCodeUnits(left.path!, right.path!) ||
  compareCodeUnits(left.code, right.code) ||
  compareCodeUnits(left.message, right.message);
