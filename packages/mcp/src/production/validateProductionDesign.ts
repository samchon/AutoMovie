import {
  IAutoMovieAcceptanceScenario,
  IAutoMovieDiagnostic,
  IAutoMovieFormationDesign,
  IAutoMovieModelRecipe,
  IAutoMovieProductionDesign,
  IAutoMovieShotContract,
  IAutoMovieShotPredicate,
  IAutoMovieWorldDesign,
} from "@automovie/interface";

import {
  compareCodeUnits,
  encodeAutoMoviePathSegment,
} from "./contentIdentity";

/** In-memory design graph used for cross-reference validation. */
export interface IAutoMovieProductionDesignGraph {
  /** Singleton production design. */
  production: IAutoMovieProductionDesign | null;
  /** Model recipes keyed by id. */
  models: ReadonlyMap<string, IAutoMovieModelRecipe>;
  /** Singleton world design. */
  world: IAutoMovieWorldDesign | null;
  /** Formations keyed by id. */
  formations: ReadonlyMap<string, IAutoMovieFormationDesign>;
  /** Shot contracts keyed by id. */
  shots: ReadonlyMap<string, IAutoMovieShotContract>;
  /** Acceptance scenarios keyed by id. */
  acceptance: ReadonlyMap<string, IAutoMovieAcceptanceScenario>;
}

const SUPPORTED_MODEL_CAPABILITIES: Record<
  IAutoMovieModelRecipe["archetype"],
  ReadonlySet<string>
> = {
  stickman: new Set(["signal"]),
  horse: new Set(),
  artillery: new Set(),
  flag: new Set(),
  weapon: new Set(),
  "primitive-prop": new Set(),
};

/** Maximum exact production raster accepted by design and frame review. */
export const AUTOMOVIE_MAX_FRAME_PIXELS = 16_777_216;

/** Validate graph-level production invariants after structural validation. */
export const validateAutoMovieProductionGraph = (
  graph: IAutoMovieProductionDesignGraph,
): IAutoMovieDiagnostic[] => {
  const diagnostics: IAutoMovieDiagnostic[] = [];
  const seenDeliverables = new Set<string>();
  if (graph.production !== null) {
    const target = "production";
    const file = ".automovie/design/production.json";
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
        `frameFormat width times height exceeds ${AUTOMOVIE_MAX_FRAME_PIXELS} pixels. Reduce the exact production raster so previewFrame can capture required review evidence.`,
      );
    positive(
      diagnostics,
      graph.production.frameFormat.fps,
      target,
      file,
      "frameFormat.fps",
    );
    if (
      Number.isFinite(graph.production.targetRuntimeSeconds) &&
      graph.production.targetRuntimeSeconds > 0 &&
      Number.isFinite(graph.production.frameFormat.fps) &&
      graph.production.frameFormat.fps > 0 &&
      isProductionFrameTime(
        graph.production.targetRuntimeSeconds,
        graph.production.frameFormat.fps,
      ) === false
    )
      invalid(
        diagnostics,
        "design-frame-clock-invalid",
        target,
        file,
        `targetRuntimeSeconds must land on the ${graph.production.frameFormat.fps}fps production clock. Choose an exact integer frame count divided by fps in setProductionDesign.`,
      );
    if (graph.production.artDirection.palette.length === 0)
      invalid(
        diagnostics,
        "design-collection-empty",
        target,
        file,
        "artDirection.palette must contain at least one color. Add a visual palette in setProductionDesign.",
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
    for (const deliverable of graph.production.deliverables)
      unique(
        diagnostics,
        seenDeliverables,
        deliverable.id,
        target,
        file,
        "deliverables",
      );
  }

  for (const [id, model] of graph.models) {
    const target = `model:${id}`;
    const file = `.automovie/design/models/${encodeAutoMoviePathSegment(id)}.json`;
    text(diagnostics, model.id, target, file, "id");
    if (model.id !== id)
      invalid(
        diagnostics,
        "design-identity-mismatch",
        target,
        file,
        `Model file identity is "${id}" but value id is "${model.id}". Rewrite the model with setModelRecipe using one matching id.`,
      );
    validateModelParameters(diagnostics, model, target, file);
    if (Object.keys(model.palette).length === 0)
      invalid(
        diagnostics,
        "design-collection-empty",
        target,
        file,
        "palette must contain at least one named material color. Add it in setModelRecipe.",
      );
    const lodTiers = new Set<string>();
    if (model.lod.length === 0)
      invalid(
        diagnostics,
        "design-collection-empty",
        target,
        file,
        "lod must contain at least one representation. Add a hero, near, or far tier in setModelRecipe.",
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
          `LOD tier "${lod.tier}" is out of near-to-far order. Order unique tiers as hero, near, then far in setModelRecipe.`,
        );
      previousTier = tier;
      if (lod.maxDistance === null) {
        if (index !== model.lod.length - 1)
          invalid(
            diagnostics,
            "model-lod-order-invalid",
            target,
            file,
            `Unbounded LOD tier "${lod.tier}" is not final. Move it to the end or give it a finite maxDistance in setModelRecipe.`,
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
            `LOD maxDistance ${lod.maxDistance} is not above prior distance ${previousDistance}. Increase it in setModelRecipe.`,
          );
        previousDistance = lod.maxDistance;
      }
      if (lod.recipe !== id && graph.models.has(lod.recipe) === false)
        missing(
          diagnostics,
          target,
          file,
          `LOD recipe "${lod.recipe}"`,
          `setModelRecipe for "${lod.recipe}" or change ${id}.lod`,
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
          `Palette color "${color}" is not a six-digit hexadecimal sRGB color. Use #RRGGBB in setModelRecipe.`,
        );
    }
    if (Object.keys(model.palette).length === 0)
      invalid(
        diagnostics,
        "design-collection-empty",
        target,
        file,
        "Model palette must contain at least one named #RRGGBB material color. Add one in setModelRecipe.",
      );
    uniqueTextValues(
      diagnostics,
      model.capabilities,
      target,
      file,
      "capabilities",
    );
    const supportedCapabilities = SUPPORTED_MODEL_CAPABILITIES[model.archetype];
    for (const capability of model.capabilities)
      if (supportedCapabilities.has(capability) === false)
        invalid(
          diagnostics,
          "design-capability-unsupported",
          target,
          file,
          `Model capability "${capability}" is not implemented for archetype "${model.archetype}". Remove the claim or implement and register its deterministic source/runtime binding before compileProject.`,
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
    }
    if (model.archetype !== "stickman" && model.attachments.length !== 0)
      invalid(
        diagnostics,
        "design-attachment-unsupported",
        target,
        file,
        `Archetype "${model.archetype}" has no compiler-owned humanoid skeleton for bone attachments. Remove attachments or use a stickman recipe.`,
      );
  }

  if (graph.world !== null) {
    const file = ".automovie/design/world.json";
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
          `Surface "${surface.id}" has ${surface.polygon.length} polygon points. Add at least three points in setWorldDesign.`,
        );
      for (const point of surface.polygon)
        finite2(diagnostics, point, "world", file, "surface.polygon");
      if (isSimpleNonDegeneratePolygon(surface.polygon) === false)
        invalid(
          diagnostics,
          "design-polygon-invalid",
          "world",
          file,
          `Surface "${surface.id}" must use distinct finite vertices forming one non-self-intersecting polygon with non-zero area. Correct surface.polygon in setWorldDesign.`,
        );
      if (surface.height.kind === "constant")
        finite(
          diagnostics,
          surface.height.value,
          "world",
          file,
          "surface.height.value",
        );
      else {
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
          `Route "${route.id}" has ${route.waypoints.length} waypoints. Add at least two waypoints in setWorldDesign.`,
        );
      positive(
        diagnostics,
        route.allowedFormationWidth,
        "world",
        file,
        "route.allowedFormationWidth",
      );
      for (const point of route.waypoints)
        finite2(diagnostics, point, "world", file, "route.waypoints");
    }
    const effectIds = new Set<string>();
    for (const zone of graph.world.effectZones) {
      unique(diagnostics, effectIds, zone.id, "world", file, "effectZones");
      invalid(
        diagnostics,
        "design-capability-unsupported",
        "world",
        file,
        `Effect zone "${zone.id}" kind "${zone.kind}" has no deterministic renderer binding yet. Remove it or implement the effect compiler before claiming this world complete.`,
      );
      vector(diagnostics, zone.bounds.min, "world", file, "effect.bounds.min");
      vector(diagnostics, zone.bounds.max, "world", file, "effect.bounds.max");
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
          `Effect zone "${zone.id}" bounds are empty or inverted. Fix bounds in setWorldDesign.`,
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
  }

  for (const [id, formation] of graph.formations) {
    const target = `formation:${id}`;
    const file = `.automovie/design/formations/${encodeAutoMoviePathSegment(id)}.json`;
    text(diagnostics, formation.id, target, file, "id");
    text(diagnostics, formation.modelRecipe, target, file, "modelRecipe");
    if (formation.id !== id)
      invalid(
        diagnostics,
        "design-identity-mismatch",
        target,
        file,
        `Formation file identity is "${id}" but value id is "${formation.id}". Rewrite it with setFormationDesign using one matching id.`,
      );
    if (graph.models.has(formation.modelRecipe) === false)
      missing(
        diagnostics,
        target,
        file,
        `model recipe "${formation.modelRecipe}"`,
        `setModelRecipe for "${formation.modelRecipe}" or change ${id}.modelRecipe`,
      );
    integer(diagnostics, formation.count, 1, 1_000_000, target, file, "count");
    positive(
      diagnostics,
      formation.spacing.lateral,
      target,
      file,
      "spacing.lateral",
    );
    positive(
      diagnostics,
      formation.spacing.depth,
      target,
      file,
      "spacing.depth",
    );
    vector(diagnostics, formation.anchor, target, file, "anchor");
    finite(diagnostics, formation.facingDeg, target, file, "facingDeg");
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
          `Hero slot ${hero.slot} is outside formation count ${formation.count}. Fix heroOverrides in setFormationDesign.`,
        );
      if (slots.has(hero.slot))
        invalid(
          diagnostics,
          "design-duplicate-id",
          target,
          file,
          `Hero slot ${hero.slot} is duplicated. Keep each slot once in setFormationDesign.`,
        );
      slots.add(hero.slot);
      text(diagnostics, hero.actor, target, file, "heroOverrides.actor");
      if (actors.has(hero.actor))
        invalid(
          diagnostics,
          "design-duplicate-id",
          target,
          file,
          `Hero actor "${hero.actor}" is assigned to more than one slot. Keep each actor identity once in setFormationDesign.`,
        );
      actors.add(hero.actor);
    }
  }

  for (const [id, shot] of graph.shots) {
    const target = `shot:${id}`;
    const file = `.automovie/design/shots/${encodeAutoMoviePathSegment(id)}.json`;
    text(diagnostics, shot.id, target, file, "id");
    if (shot.id !== id)
      invalid(
        diagnostics,
        "design-identity-mismatch",
        target,
        file,
        `Shot file identity is "${id}" but value id is "${shot.id}". Rewrite it with setShotContract using one matching id.`,
      );
    text(diagnostics, shot.beat, target, file, "beat");
    text(diagnostics, shot.source.module, target, file, "source.module");
    text(diagnostics, shot.source.export, target, file, "source.export");
    positive(
      diagnostics,
      shot.durationSeconds,
      target,
      file,
      "durationSeconds",
    );
    if (
      graph.production !== null &&
      Number.isFinite(shot.durationSeconds) &&
      shot.durationSeconds > 0 &&
      isProductionFrameTime(
        shot.durationSeconds,
        graph.production.frameFormat.fps,
      ) === false
    )
      invalid(
        diagnostics,
        "design-frame-clock-invalid",
        target,
        file,
        `Shot "${id}" durationSeconds is off the ${graph.production.frameFormat.fps}fps production clock. Choose an exact integer frame count divided by fps in setShotContract.`,
      );
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
          `Participant "${participantKey}" is duplicated. Keep each participant once in setShotContract.`,
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
          `setFormationDesign for "${participant.id}" or remove it from ${id}.participants`,
        );
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
        `Shot "${id}" must name at least one required camera subject. Add one in setShotContract.`,
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
        `Camera maxOcclusionRatio must be between 0 and 1. Fix ${id}.camera in setShotContract.`,
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
          `Event "${event.id}" must name at least one subject. Add one in setShotContract.`,
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
          `Event "${event.id}" has a window outside shot duration. Fix ${id}.events in setShotContract.`,
        );
    }
    const frames = new Set<string>();
    if (shot.reviewFrames.length === 0)
      invalid(
        diagnostics,
        "design-collection-empty",
        target,
        file,
        `Shot "${id}" must declare at least one exact review frame and pass. Add reviewFrames in setShotContract so visual review has a reachable evidence target.`,
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
          `Review frame "${frame.id}" time is outside shot duration. Fix ${id}.reviewFrames in setShotContract.`,
        );
      else if (
        graph.production !== null &&
        isProductionFrameTime(frame.time, graph.production.frameFormat.fps) ===
          false
      )
        invalid(
          diagnostics,
          "design-frame-clock-invalid",
          target,
          file,
          `Review frame "${frame.id}" is off the ${graph.production.frameFormat.fps}fps production clock. Snap its time to an exact frame in setShotContract.`,
        );
      if (new Set(frame.passes).size !== frame.passes.length)
        invalid(
          diagnostics,
          "design-duplicate-id",
          target,
          file,
          `Review frame "${frame.id}" repeats a pass. Keep each pass once in setShotContract.`,
        );
      if (frame.passes.length === 0)
        invalid(
          diagnostics,
          "design-collection-empty",
          target,
          file,
          `Review frame "${frame.id}" must request at least one pass. Add a pass in setShotContract.`,
        );
    }
  }

  for (const [id, acceptance] of graph.acceptance) {
    const target = `acceptance:${id}`;
    const file = `.automovie/design/acceptance/${encodeAutoMoviePathSegment(id)}.json`;
    text(diagnostics, acceptance.id, target, file, "id");
    text(diagnostics, acceptance.target.id, target, file, "target.id");
    if (acceptance.id !== id)
      invalid(
        diagnostics,
        "design-identity-mismatch",
        target,
        file,
        `Acceptance file identity is "${id}" but value id is "${acceptance.id}". Rewrite it with setAcceptanceScenario using one matching id.`,
      );
    const criterion = acceptance.criterion;
    if (criterion.kind === "frame" || criterion.kind === "event")
      text(
        diagnostics,
        criterion.expectation,
        target,
        file,
        "criterion.expectation",
      );
    if (acceptance.target.kind === "shot") {
      const shot = graph.shots.get(acceptance.target.id);
      if (shot === undefined)
        missing(
          diagnostics,
          target,
          file,
          `shot "${acceptance.target.id}"`,
          `setShotContract for "${acceptance.target.id}" or change ${id}.target`,
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
              `setShotContract for "${criterion.shot}" or change ${id}.criterion.shot`,
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
        `Metric value must be finite. Fix ${id}.criterion in setAcceptanceScenario.`,
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

const MODEL_PARAMETERS: Record<
  IAutoMovieModelRecipe["archetype"],
  Record<
    string,
    readonly [type: "number" | "string" | "boolean", min?: number, max?: number]
  >
> = {
  stickman: {
    height: ["number", 0.5, 3],
    headRadius: ["number", 0.05, 0.5],
    limbRadius: ["number", 0.01, 0.25],
  },
  horse: {
    length: ["number", 0.5, 4],
    height: ["number", 0.5, 3],
    legLength: ["number", 0.2, 2],
  },
  artillery: {
    barrelLength: ["number", 0.2, 8],
    wheelRadius: ["number", 0.1, 3],
    gauge: ["number", 0.2, 5],
  },
  flag: {
    width: ["number", 0.1, 10],
    height: ["number", 0.1, 10],
    poleHeight: ["number", 0.2, 20],
  },
  weapon: {
    length: ["number", 0.05, 8],
    thickness: ["number", 0.001, 1],
  },
  "primitive-prop": {
    shape: ["string"],
    width: ["number", 0.001, 100],
    height: ["number", 0.001, 100],
    depth: ["number", 0.001, 100],
    radius: ["number", 0.001, 50],
  },
};

const REQUIRED_MODEL_PARAMETERS: Record<
  Exclude<IAutoMovieModelRecipe["archetype"], "primitive-prop">,
  readonly string[]
> = {
  stickman: ["height", "headRadius", "limbRadius"],
  horse: ["length", "height", "legLength"],
  artillery: ["barrelLength", "wheelRadius", "gauge"],
  flag: ["width", "height", "poleHeight"],
  weapon: ["length", "thickness"],
};

const PRIMITIVE_PROP_DIMENSIONS: Readonly<Record<string, readonly string[]>> = {
  box: ["width", "height", "depth"],
  sphere: ["radius"],
  capsule: ["radius", "height"],
  cylinder: ["radius", "height"],
  cone: ["radius", "height"],
  plane: ["width", "depth"],
};

const validateModelParameters = (
  diagnostics: IAutoMovieDiagnostic[],
  model: IAutoMovieModelRecipe,
  target: string,
  file: string,
): void => {
  const schema = MODEL_PARAMETERS[model.archetype];
  const required =
    model.archetype === "primitive-prop"
      ? [
          "shape",
          ...(typeof model.parameters.shape === "string"
            ? (PRIMITIVE_PROP_DIMENSIONS[model.parameters.shape] ?? [])
            : []),
        ]
      : REQUIRED_MODEL_PARAMETERS[model.archetype];
  for (const key of required)
    if (key in model.parameters === false)
      invalid(
        diagnostics,
        "model-parameter-missing",
        target,
        file,
        `Required parameter "${key}" is missing for ${model.archetype}. Add it in setModelRecipe.`,
      );
  const primitiveShape =
    model.archetype === "primitive-prop" &&
    typeof model.parameters.shape === "string"
      ? model.parameters.shape
      : null;
  if (
    primitiveShape !== null &&
    primitiveShape in PRIMITIVE_PROP_DIMENSIONS === false
  )
    invalid(
      diagnostics,
      "model-parameter-invalid",
      target,
      file,
      `Primitive-prop shape "${primitiveShape}" is unsupported. Use box, sphere, capsule, cylinder, cone, or plane in setModelRecipe.`,
    );
  const primitiveKeys =
    primitiveShape === null ||
    PRIMITIVE_PROP_DIMENSIONS[primitiveShape] === undefined
      ? null
      : new Set(["shape", ...PRIMITIVE_PROP_DIMENSIONS[primitiveShape]]);
  for (const [key, value] of Object.entries(model.parameters)) {
    const rule = schema[key];
    if (
      rule === undefined ||
      (primitiveKeys !== null && !primitiveKeys.has(key))
    ) {
      invalid(
        diagnostics,
        "model-parameter-unsupported",
        target,
        file,
        `Parameter "${key}" is unsupported for ${model.archetype}. Remove it from setModelRecipe.`,
      );
      continue;
    }
    if (typeof value !== rule[0]) {
      invalid(
        diagnostics,
        "model-parameter-invalid",
        target,
        file,
        `Parameter "${key}" must be ${rule[0]}. Fix it in setModelRecipe.`,
      );
      continue;
    }
    if (
      rule[0] === "number" &&
      (Number.isFinite(value as number) === false ||
        (rule[1] !== undefined && (value as number) < rule[1]) ||
        (rule[2] !== undefined && (value as number) > rule[2]))
    )
      invalid(
        diagnostics,
        "model-parameter-invalid",
        target,
        file,
        `Parameter "${key}" is outside its supported range. Fix it in setModelRecipe.`,
      );
  }
};

const validateFormationLayout = (
  diagnostics: IAutoMovieDiagnostic[],
  formation: IAutoMovieFormationDesign,
  target: string,
  file: string,
): void => {
  const layout = formation.layout;
  if (layout.kind === "line" || layout.kind === "column") {
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
        `Layout capacity ${layout.ranks * layout.files} is below count ${formation.count}. Fix layout in setFormationDesign.`,
      );
  } else if (layout.kind === "wedge") {
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
        `Wedge depth ${layout.depth} materializes ${layout.depth * layout.depth} slots, below count ${formation.count}. Increase layout.depth in setFormationDesign.`,
      );
  } else {
    positive(diagnostics, layout.radius, target, file, "layout.radius");
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
        `Arc degrees must be above 0 and at most 360. Fix layout in setFormationDesign.`,
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

const invalid = (
  diagnostics: IAutoMovieDiagnostic[],
  code: string,
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
          `setFormationDesign for "${value.id}" or correct ${path}`,
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
          `add that landmark with setWorldDesign or correct ${path}`,
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

/** Whether a time is numerically equivalent to one integer production frame. */
export const isProductionFrameTime = (time: number, fps: number): boolean => {
  const frame = time * fps;
  const tolerance =
    Number.EPSILON * 64 * Math.max(1, Math.abs(frame), Math.abs(time), fps);
  return Math.abs(frame - Math.round(frame)) <= tolerance;
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

const finite2 = (
  diagnostics: IAutoMovieDiagnostic[],
  value: { x: number; z: number },
  target: string,
  file: string,
  field: string,
): void => {
  finite(diagnostics, value.x, target, file, `${field}.x`);
  finite(diagnostics, value.z, target, file, `${field}.z`);
};

const compareDiagnostics = (
  left: IAutoMovieDiagnostic,
  right: IAutoMovieDiagnostic,
): number =>
  compareCodeUnits(left.path!, right.path!) ||
  compareCodeUnits(left.code, right.code) ||
  compareCodeUnits(left.message, right.message);
