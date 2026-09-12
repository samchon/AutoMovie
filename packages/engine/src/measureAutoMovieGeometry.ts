import {
  AutoMovieGeometryQuery,
  IAutoMovieCompiledShotSource,
  IAutoMovieFilmTimeline,
  IAutoMovieFormationDesign,
  IAutoMovieGeometryResult,
  IAutoMovieGeometrySelector,
  IAutoMoviePose,
  IAutoMovieProductionDesign,
  IAutoMovieShotContract,
  IAutoMovieSkeleton,
  IAutoMovieTransform,
  IAutoMovieVector3,
  IAutoMovieWorldDesign,
} from "@automovie/interface";

import { sampleCompiledEffect } from "./effect";
import {
  intersectsPerspectiveFrustumSphere,
  projectToNdc,
  resolveAutoMovieDeliveryCrop,
  resolveCameraAt,
} from "./film/cameraProjection";
import {
  composeFormationHeroTransform,
  formationSlotPosition,
  sampleFormationMotion,
  selectFormationLod,
  transformFormationBounds,
  transformFormationPoint,
} from "./formation";
import { placeFormationSlot, sampleFormationSlotMotion } from "./formationSlot";
import { HUMANOID_JOINT_AXES } from "./kinematics/humanoidJointAxes";
import { reachPose } from "./kinematics/reachPose";
import { resolvePose } from "./kinematics/resolvePose";
import { Quaternion } from "./math/Quaternion";
import { Vector3 } from "./math/Vector3";
import { sampleMotion } from "./motion/sampleMotion";
import { sampleClipSequence } from "./resolve/sampleClip";
import { validatePose } from "./validation/validatePose";
import { worldGroundSurface, worldSurfaceHeight } from "./worldKit";

/**
 * Answer one compact geometry question from a production's current records.
 *
 * This is what a review asks without rendering a frame: how far apart two
 * selectors stand, whether an actor's arm chain reaches a target, what the
 * terrain is under a point, how a formation stands and resolves in a
 * participating shot, how active and obstructive an effect is from the shot
 * camera, which film-global frame a time names, what an actor's pose is doing,
 * and whether subjects' roots project inside the camera's frame. Every answer
 * comes from the records passed in and nothing else, so a caller establishes
 * that those records are current first, as the production oracle and a loaded
 * current project state both do.
 *
 * A formation's representative members are placed from its compiled record,
 * which carries the terrain snapshot the unit was compiled on. Placed from the
 * design instead, every member stood at its anchor's height, and members
 * standing correctly on a rise were reported as off their ground.
 *
 * A question the records cannot answer throws an error whose message names the
 * selector, time or record at fault and the correction, which a caller reports
 * as its own diagnostic.
 *
 * @evidence requirements/formations/budgets-and-validation.md#formation-determinism Reports a formation's representative members where its compiled runtime places them, grounded on the same terrain snapshot, rather than re-deriving them from the design.
 * @evidence specifications/performance-motion-and-staging/formation-motion-resolution-and-budgets.md#performance-formation-determinism-status-compatibility Keeps the one-member ground check on the transform and state the full compiled runtime holds for each measured slot.
 * @evidence requirements/motion/constraints-and-inverse-kinematics.md#motion-constraint-reachability Reports a target's gap beyond the arm chain's length and whether a solved reach stays inside the rig's range instead of stretching or falling back.
 * @evidence specifications/performance-motion-and-staging/kinematics-contact-and-interaction.md#performance-contact-phase-weight-support Measures reachability in the actor's model space from bone rest lengths and the bounded reach solve, per arm.
 * @evidence requirements/effects-and-simulation/clock-seek-and-determinism.md#effects-arbitrary-seek Samples the addressed effect stream afresh at the requested shot time, so a measurement never depends on an earlier query.
 * @evidence specifications/simulation-effects-and-sound/clocks-ordering-seek-and-checkpoints.md#arbitrary-seek-reconstruction-contract Reads effect activity, particle population and visibility risk from the absolute-time sample of the compiled stream.
 * @evidence requirements/camera/validation.md#camera-hand-computable-geometry Reports subject root projections, depth-range and frame membership, and frame margin from the resolved camera, FOV, aspect and crop.
 * @evidence specifications/camera-light-and-visibility/visibility-and-image-space-observation.md#clv-computable-geometry-results Returns the counts and margin a canonical projection case can reproduce by hand, and states that occlusion is not measured.
 * @evidence requirements/map/terrain-and-landforms.md#map-elevation-slope Answers the elevation and the surface id and walkability under one ground-plan point from the declared world surfaces.
 * @evidence specifications/world-and-site/terrain-ground-and-geology.md#world-site-elevation-slope-surface-input Selects the first declared surface containing the point and evaluates that surface's own height rule there.
 * @evidence requirements/editorial/rational-time-and-ranges.md#editorial-canonical-time Resolves an exact frame and the frame-grid second naming the same frame to one film-global frame and its owning segment.
 * @evidence specifications/editorial-render-and-delivery/rational-timeline-and-composition.md#spec-editorial-rational-timeline Refuses a film time off the production frame grid or outside the canonical timeline instead of rounding it silently.
 */
export const measureAutoMovieGeometry = (props: {
  /** One compact geometry question. */
  request: AutoMovieGeometryQuery;
  /** Current design the question is asked of. */
  design: {
    /** Active production design, or null before one exists. */
    production: Pick<IAutoMovieProductionDesign, "frameFormat"> | null;
    /** Project-shared world design, or null before one exists. */
    world: Pick<
      IAutoMovieWorldDesign,
      "landmarks" | "surfaces" | "routes"
    > | null;
    /** Formation designs keyed by id. */
    formations: ReadonlyMap<
      string,
      Pick<IAutoMovieFormationDesign, "id" | "count" | "facingDeg">
    >;
    /** Shot contracts keyed by id. */
    shots: ReadonlyMap<
      string,
      Pick<IAutoMovieShotContract, "participants" | "camera">
    >;
  };
  /** Current compiled shots keyed by shot id. */
  compiled: ReadonlyMap<string, IAutoMovieCompiledShotSource>;
  /** Canonical film timeline of the current compile, or null without one. */
  timeline: Pick<
    IAutoMovieFilmTimeline,
    "id" | "fps" | "totalFrames" | "segments"
  > | null;
}): IAutoMovieGeometryResult => {
  const request = props.request;
  const shots = props.compiled;
  let result: IAutoMovieGeometryResult;
  switch (request.query) {
    case "distance": {
      if (
        request.time !== undefined &&
        (Number.isFinite(request.time) === false || request.time < 0)
      )
        throw new Error(
          `Distance sample time ${request.time} is invalid. Choose a finite non-negative shot time.`,
        );
      const options = { shot: request.shot, time: request.time };
      const left = resolveSelector(
        request.from,
        props.design.world,
        shots,
        options,
      );
      const right = resolveSelector(
        request.to,
        props.design.world,
        shots,
        options,
      );
      result = {
        kind: "distance",
        meters: distance(left, right),
      };
      break;
    }
    case "reach": {
      const sampledTime = request.time ?? 0;
      const actor = findCompiledActor(shots, request.actor, request.shot);
      const target = resolveSelector(
        request.target,
        props.design.world,
        shots,
        {
          shot: actor.compiled.shot.id,
          time: sampledTime,
        },
      );
      const actorTransform = actorTransformAt(
        actor.compiled,
        request.actor,
        sampledTime,
      );
      const localTarget = toModelPoint(target, actorTransform);
      if (localTarget === null)
        throw new Error(
          `Actor "${request.actor}" has a degenerate current scale. Correct its compiled scene transform before reach measurement.`,
        );
      if (actor.model.skeleton === null)
        throw new Error(
          `Actor "${request.actor}" has no skeleton. Bind a rigged model before reach measurement.`,
        );
      const left = measureArmReach(actor.model.skeleton, "left", localTarget);
      const right = measureArmReach(actor.model.skeleton, "right", localTarget);
      if (left === null && right === null)
        throw new Error(
          `Actor "${request.actor}" has no measurable upper-arm, lower-arm and hand chain. Correct the rig before reach measurement.`,
        );
      result = {
        kind: "measurement",
        values: {
          sampledTime,
          reachable: Boolean(left?.reachable || right?.reachable),
          leftMeasurable: left !== null,
          leftGap: left?.gap ?? 0,
          leftPoseWithinRom: left?.poseWithinRom ?? false,
          rightMeasurable: right !== null,
          rightGap: right?.gap ?? 0,
          rightPoseWithinRom: right?.poseWithinRom ?? false,
        },
      };
      break;
    }
    case "ground": {
      const sample = groundSample(props.design.world, request.point);
      result = {
        kind: "ground",
        height: sample.height,
        surface: sample.surface,
        walkable: sample.walkable,
      };
      break;
    }
    case "formation": {
      const formation = props.design.formations.get(request.formation);
      if (formation === undefined)
        throw new Error(
          `Formation "${request.formation}" does not exist. Inspect current formation ids.`,
        );
      const participatingShots = [...props.design.shots]
        .filter(([, contract]) =>
          contract.participants.some(
            (participant) =>
              participant.kind === "formation" &&
              participant.id === request.formation,
          ),
        )
        .map(([id]) => id);
      const runtimes = participatingShots.flatMap((id) => {
        const runtime = shots
          .get(id)
          ?.formations.find((candidate) => candidate.id === formation.id);
        return runtime === undefined ? [] : [runtime];
      });
      const firstParticipatingShot = participatingShots[0];
      if (
        firstParticipatingShot === undefined ||
        runtimes.length !== participatingShots.length ||
        runtimes.some(
          (runtime) =>
            runtime.count !== formation.count ||
            runtime.digest !== runtimes[0]!.digest ||
            runtime.chunks.length === 0,
        )
      )
        throw new Error(
          `Formation "${request.formation}" is not fully materialized in every current participating shot. Recompile its source and builder-owned slots.`,
        );
      const runtime = runtimes[0]!;
      if (
        request.shot !== undefined &&
        participatingShots.includes(request.shot) === false
      )
        throw new Error(
          `Shot "${request.shot}" does not participate in formation "${request.formation}". Select one of ${participatingShots.join(", ")}.`,
        );
      const selectedShot = request.shot ?? firstParticipatingShot;
      const compiled = shots.get(selectedShot)!;
      const sampledTime = request.time ?? 0;
      if (
        Number.isFinite(sampledTime) === false ||
        sampledTime < 0 ||
        sampledTime > compiled.shot.duration
      )
        throw new Error(
          `Formation sample time ${sampledTime} is outside current shot "${selectedShot}". Choose a finite time from 0 through ${compiled.shot.duration}.`,
        );
      const sampledMotion = sampleFormationMotion(
        compiled.formationMotions,
        formation.id,
        sampledTime,
      );
      const transformPoint = (point: IAutoMovieVector3): IAutoMovieVector3 =>
        transformFormationPoint(
          point,
          runtime.anchor,
          sampledMotion,
          runtime.facingDeg,
        );
      const representative = [
        ...new Set(
          runtime.chunks.flatMap((chunk) => [
            chunk.start,
            chunk.start + Math.floor((chunk.count - 1) / 2),
            chunk.start + chunk.count - 1,
          ]),
        ),
      ];
      // A member the shot has taken out of this unit is standing nowhere, so
      // reporting it as a unit standing over a void would be a lie about a
      // member nobody can see. A member displaced by its own cue is reported
      // where its cue really put it, which is the same reason.
      const groundViolations = representative.filter((slot) => {
        const placed = placeFormationSlot({
          position: formationSlotPosition(runtime, slot),
          facingDeg: runtime.facingDeg,
          anchor: runtime.anchor,
          baseFacingDeg: runtime.facingDeg,
          unit: sampledMotion,
          member: sampleFormationSlotMotion(
            compiled.formationSlotMotions,
            formation.id,
            slot,
            sampledTime,
          ),
        });
        if (placed.present === false) return false;
        const sample = groundSample(props.design.world, placed.position);
        return (
          sample.walkable === false ||
          Math.abs(sample.height - placed.position.y) > 1e-6
        );
      });
      const bounds = transformFormationBounds(
        runtime.bounds,
        runtime.anchor,
        sampledMotion,
        runtime.facingDeg,
      );
      const centroid = transformPoint(runtime.centroid);
      const width = bounds.max.x - bounds.min.x;
      const depth = bounds.max.z - bounds.min.z;
      // No world design is no route to clear, as it is no ground to stand on.
      const routes = props.design.world?.routes ?? [];
      const routeClearance =
        routes.length === 0
          ? 0
          : Math.min(
              ...routes.map((route) => route.allowedFormationWidth - width),
            );
      const camera = compiled.scene.cameras.find(
        (candidate) => candidate.id === compiled.shot.camera,
      );
      if (camera === undefined)
        throw new Error(
          `Shot "${selectedShot}" has no current compiled camera "${compiled.shot.camera}".`,
        );
      const resolvedCamera = resolveCameraAt(
        camera.transform,
        compiled.shot.cameraMotion,
        camera.id,
        request.time ?? 0,
      );
      const halfY = Math.tan((camera.fovY * Math.PI) / 360);
      const production = props.design.production;
      if (production === null)
        throw new Error(
          "Formation measurement requires current production frame format. Restore production design and compile.",
        );
      const aspect =
        production.frameFormat.width / production.frameFormat.height;
      const crop = resolveAutoMovieDeliveryCrop(production.frameFormat.crop);
      const chunkMeasurements = runtime.chunks.map((chunk) => {
        const center = transformPoint(chunk.centroid);
        const transformedBounds = transformFormationBounds(
          chunk.bounds,
          runtime.anchor,
          sampledMotion,
          runtime.facingDeg,
        );
        const radius =
          Math.max(
            0.01,
            ...[transformedBounds.min.x, transformedBounds.max.x].flatMap((x) =>
              [transformedBounds.min.y, transformedBounds.max.y].flatMap((y) =>
                [transformedBounds.min.z, transformedBounds.max.z].map((z) =>
                  Math.hypot(x - center.x, y - center.y, z - center.z),
                ),
              ),
            ),
          ) + runtime.projectionRadius;
        const distance = Math.hypot(
          center.x - resolvedCamera.position.x,
          center.y - resolvedCamera.position.y,
          center.z - resolvedCamera.position.z,
        );
        const projection = projectToNdc(
          resolvedCamera,
          center,
          halfY,
          aspect,
          crop,
        );
        const projectedPixels =
          (runtime.projectionRadius * production.frameFormat.height) /
          (halfY *
            Math.max(0.001, projection.depth) *
            (crop.bottom - crop.top));
        const visible = intersectsPerspectiveFrustumSphere({
          camera: resolvedCamera,
          center,
          radius,
          near: camera.near,
          far: camera.far,
          halfY,
          aspect,
          crop,
        });
        return {
          distance,
          projectedPixels,
          visible,
        };
      });
      const distances = chunkMeasurements.map(
        (measurement) => measurement.distance,
      );
      const projectedPixels = chunkMeasurements.map(
        (measurement) => measurement.projectedPixels,
      );
      const tierCounts = { hero: 0, near: 0, far: 0 };
      let culled = 0;
      runtime.chunks.forEach((chunk, index) => {
        const measurement = chunkMeasurements[index]!;
        if (measurement.visible === false) {
          culled += chunk.anonymousCount;
          return;
        }
        const lod = selectFormationLod({
          lod: runtime.lod,
          distance: measurement.distance,
          projectedPixels: measurement.projectedPixels,
          previous: null,
        }).lod;
        tierCounts[lod.tier] += chunk.anonymousCount;
      });
      const heroVisible = runtime.heroes.filter((hero) => {
        const node = compiled.scene.nodes.find(
          (candidate) => candidate.id === hero.actor,
        );
        if (node === undefined) return false;
        const found = findCompiledActor(
          new Map([[compiled.shot.id, compiled]]),
          hero.actor,
          compiled.shot.id,
        );
        const source = actorSpatialAt(
          compiled,
          hero.actor,
          sampledTime,
          found.model.skeleton,
        );
        const formed = composeFormationHeroTransform(
          hero.transform,
          source.nodeTransform,
          runtime.anchor,
          sampledMotion,
          runtime.facingDeg,
        );
        const point =
          source.poseRoot === null
            ? formed.translation
            : composeTransforms(formed, {
                ...source.poseRoot,
                scale: { x: 1, y: 1, z: 1 },
              }).translation;
        const projectionRadius =
          runtime.projectionRadius *
          Math.max(
            Math.abs(formed.scale.x),
            Math.abs(formed.scale.y),
            Math.abs(formed.scale.z),
          );
        return intersectsPerspectiveFrustumSphere({
          camera: resolvedCamera,
          center: point,
          radius: projectionRadius,
          near: camera.near,
          far: camera.far,
          halfY,
          aspect,
          crop,
        });
      }).length;
      result = {
        kind: "measurement",
        values: {
          designCount: formation.count,
          materializedCount: runtime.count,
          anonymousCount: runtime.anonymousCount,
          heroCount: runtime.heroes.length,
          chunkCount: runtime.chunks.length,
          participatingShots: participatingShots.length,
          width,
          depth,
          centroidX: centroid.x,
          centroidY: centroid.y,
          centroidZ: centroid.z,
          facingDeg: formation.facingDeg,
          sampledTime,
          motionOffsetX: sampledMotion.translation.x,
          motionOffsetY: sampledMotion.translation.y,
          motionOffsetZ: sampledMotion.translation.z,
          motionFacingOffsetDeg: sampledMotion.facingOffsetDeg,
          lateralSpacingScale: sampledMotion.spacingScale.lateral,
          depthSpacingScale: sampledMotion.spacingScale.depth,
          routeClearance,
          representativeSlots: representative.length,
          groundViolations: groundViolations.length,
          nearestDistance: Math.min(...distances),
          farthestDistance: Math.max(...distances),
          minimumProjectedPixels: Math.min(...projectedPixels),
          maximumProjectedPixels: Math.max(...projectedPixels),
          heroVisible,
          nearVisible: tierCounts.near,
          farVisible: tierCounts.far,
          culled,
          compiledDigest: runtime.digest,
          state: "compiled",
        },
      };
      break;
    }
    case "effect": {
      if (Number.isFinite(request.time) === false || request.time < 0)
        throw new Error(
          `Effect sample time ${request.time} is invalid. Choose a finite non-negative shot time.`,
        );
      const compiled = shots.get(request.shot);
      if (compiled === undefined)
        throw new Error(
          `Shot "${request.shot}" has no current compiled source. Recompile it before effect measurement.`,
        );
      if (request.time > compiled.shot.duration)
        throw new Error(
          `Effect sample time ${request.time} exceeds shot "${request.shot}" duration ${compiled.shot.duration}.`,
        );
      const zoneEffects = compiled.effects.filter(
        (candidate) => candidate.zone === request.zone,
      );
      const effect =
        zoneEffects.find(
          (candidate) =>
            request.time >= candidate.start && request.time < candidate.end,
        ) ?? (zoneEffects.length === 1 ? zoneEffects[0] : undefined);
      if (effect === undefined)
        throw new Error(
          zoneEffects.length === 0
            ? `Shot "${request.shot}" has no compiled effect cue for zone "${request.zone}".`
            : `Shot "${request.shot}" has no unambiguous effect cue for zone "${request.zone}" at ${request.time}s.`,
        );
      const camera = compiled.scene.cameras.find(
        (candidate) => candidate.id === compiled.shot.camera,
      );
      if (camera === undefined)
        throw new Error(
          `Shot "${request.shot}" has no current compiled camera "${compiled.shot.camera}".`,
        );
      if (props.design.production === null)
        throw new Error(
          "Effect measurement requires current production frame format. Restore production design and compile.",
        );
      const cameraTransform = resolveCameraAt(
        camera.transform,
        compiled.shot.cameraMotion,
        camera.id,
        request.time,
      );
      const center = {
        x: (effect.bounds.min.x + effect.bounds.max.x) / 2,
        y: (effect.bounds.min.y + effect.bounds.max.y) / 2,
        z: (effect.bounds.min.z + effect.bounds.max.z) / 2,
      };
      const cameraDistance = distance(cameraTransform.position, center);
      const sample = sampleCompiledEffect(effect, request.time, cameraDistance);
      const volume =
        (effect.bounds.max.x - effect.bounds.min.x) *
        (effect.bounds.max.y - effect.bounds.min.y) *
        (effect.bounds.max.z - effect.bounds.min.z);
      const direction = Quaternion.rotateVector(cameraTransform.rotation, {
        x: 0,
        y: 0,
        z: -1,
      });
      const intersectionLength = rayBoundsIntersectionLength(
        cameraTransform.position,
        direction,
        effect.bounds,
        camera.far,
      );
      const subjects = request.subjects ?? [];
      if (subjects.length > 256 || new Set(subjects).size !== subjects.length)
        throw new Error(
          "Effect subjects must contain at most 256 unique compiled scene-node ids.",
        );
      const insideSubjects = subjects.filter((subject) =>
        pointInsideBounds(
          actorTransformAt(compiled, subject, request.time).translation,
          effect.bounds,
        ),
      ).length;
      const density = sample.particles.length / volume;
      const maximumOpacity =
        effect.recipe.particle.opacity.max * sample.intensity;
      const visibilityRisk = Math.min(
        1,
        density * intersectionLength * maximumOpacity,
      );
      result = {
        kind: "measurement",
        values: {
          active: sample.active,
          sampledTime: sample.time,
          particleCount: sample.particles.length,
          particleCap: effect.recipe.budget.maxParticles,
          intensity: sample.intensity,
          density,
          minimumOpacity: effect.recipe.particle.opacity.min * sample.intensity,
          maximumOpacity,
          cameraDistance,
          cameraIntersectionLength: intersectionLength,
          subjectCount: subjects.length,
          subjectsInside: insideSubjects,
          visibilityRisk,
          representativeFrame: Math.round(
            sample.time * props.design.production.frameFormat.fps,
          ),
          effectDigest: effect.digest,
        },
      };
      break;
    }
    case "film-time": {
      const timeline = props.timeline;
      if (timeline === null)
        throw new Error(
          "Film-time measurement requires the canonical film timeline of the current compile. Compile a film before resolving film-global time.",
        );
      const raw =
        "frame" in request.at
          ? request.at.frame
          : request.at.seconds * timeline.fps;
      const globalFrame = Math.round(raw);
      if (
        Number.isFinite(raw) === false ||
        Number.isSafeInteger(globalFrame) === false ||
        globalFrame < 0 ||
        globalFrame >= timeline.totalFrames ||
        Math.abs(raw - globalFrame) >
          Number.EPSILON * 64 * Math.max(1, Math.abs(raw))
      )
        throw new Error(
          `Film-global time does not resolve to one current frame in 0..${timeline.totalFrames - 1}. Use an exact frame or frame-grid second.`,
        );
      const segment = [...timeline.segments]
        .reverse()
        .find(
          (item) =>
            item.startFrame <= globalFrame && globalFrame < item.endFrame,
        );
      if (segment === undefined)
        throw new Error(
          `Film-global frame ${globalFrame} has no owning video segment. Recompile a gap-free canonical timeline.`,
        );
      const sourceFrame =
        segment.sourceInFrame + globalFrame - segment.startFrame;
      result = {
        kind: "measurement",
        values: {
          film: timeline.id,
          globalFrame,
          globalTime: globalFrame / timeline.fps,
          shot: segment.shot,
          sourceFrame,
          shotTime: sourceFrame / timeline.fps,
          transitionIn: segment.transitionIn.kind,
          transitionOut: segment.transitionOut.kind,
        },
      };
      break;
    }
    case "pose": {
      const sampled = sampleActorPose(
        shots,
        request.actor,
        request.shot,
        request.time,
      );
      result = {
        kind: "measurement",
        values: sampled,
      };
      break;
    }
    case "camera": {
      const compiled = shots.get(request.shot);
      const contract = props.design.shots.get(request.shot);
      if (compiled === undefined || contract === undefined)
        throw new Error(
          `Shot "${request.shot}" is not current compiled output. Compile it before a camera query.`,
        );
      if (
        Number.isFinite(request.time) === false ||
        request.time < 0 ||
        request.time > compiled.shot.duration
      )
        throw new Error(
          `Camera sample time ${request.time} is outside shot "${request.shot}" duration 0..${compiled.shot.duration}. Choose a current in-range time.`,
        );
      if (
        request.subjects.length === 0 ||
        new Set(request.subjects).size !== request.subjects.length
      )
        throw new Error(
          "Camera subjects must be a non-empty list of unique compiled scene-node ids. Correct the subjects.",
        );
      const camera = compiled.scene.cameras.find(
        (item) => item.id === compiled.shot.camera,
      );
      if (camera === undefined)
        throw new Error(
          `Shot "${request.shot}" references missing camera "${compiled.shot.camera}". Recompile corrected source.`,
        );
      if (props.design.production === null)
        throw new Error(
          "Camera measurement requires current production frame format. Restore production design and compile.",
        );
      const resolvedCamera = resolveCameraAt(
        camera.transform,
        compiled.shot.cameraMotion,
        camera.id,
        request.time,
      );
      const halfY = Math.tan((camera.fovY * Math.PI) / 360);
      const aspect =
        props.design.production.frameFormat.width /
        props.design.production.frameFormat.height;
      const crop = props.design.production.frameFormat.crop;
      const samples = request.subjects.flatMap((subject) => {
        const node = compiled.scene.nodes.find((item) => item.id === subject);
        if (node === undefined) return [];
        const point = actorTransformAt(
          compiled,
          subject,
          request.time,
        ).translation;
        const projection = projectToNdc(
          resolvedCamera,
          point,
          halfY,
          aspect,
          crop,
        );
        return [{ projection }];
      });
      const inDepth = samples.filter(
        ({ projection }) =>
          projection.depth >= camera.near && projection.depth <= camera.far,
      );
      const inFrame = inDepth.filter(
        ({ projection }) =>
          Math.abs(projection.ndcX) <= 1 && Math.abs(projection.ndcY) <= 1,
      );
      const minimumRootPointMargin =
        samples.length === 0
          ? -1
          : Math.min(
              ...samples.map(({ projection }) =>
                Math.min(
                  1 - Math.abs(projection.ndcX),
                  1 - Math.abs(projection.ndcY),
                ),
              ),
            );
      result = {
        kind: "measurement",
        values: {
          requestedSubjects: request.subjects.length,
          resolvedSubjectRootPoints: samples.length,
          missingSubjects: request.subjects.length - samples.length,
          inDepthRangeRootPoints: inDepth.length,
          inFrameRootPoints: inFrame.length,
          clippedOrBehindRootPoints: samples.length - inDepth.length,
          outsideFrameRootPoints: inDepth.length - inFrame.length,
          minimumRootPointMargin,
          maxAllowedOcclusionRatio: contract.camera.maxOcclusionRatio,
          occlusionMeasured: false,
          sampledTime: request.time,
        },
      };
      break;
    }
  }
  return result;
};

const resolveSelector = (
  selector: IAutoMovieGeometrySelector,
  world: Pick<IAutoMovieWorldDesign, "landmarks"> | null,
  shots: ReadonlyMap<string, IAutoMovieCompiledShotSource>,
  options: { shot?: string; time?: number } = {},
): IAutoMovieVector3 => {
  if (selector.kind === "point") return selector.position;
  if (selector.kind === "landmark") {
    const landmark = world?.landmarks.find(
      (item) => item.id === selector.landmark,
    );
    if (landmark === undefined)
      throw new Error(
        `Landmark "${selector.landmark}" does not exist. Inspect current world landmarks.`,
      );
    return landmark.position;
  }
  const actor = findCompiledActor(shots, selector.actor, options.shot);
  const spatial = actorSpatialAt(
    actor.compiled,
    selector.actor,
    options.time ?? 0,
    actor.model.skeleton,
  );
  if (selector.bone === undefined) return spatial.transform.translation;
  if (actor.model.skeleton === null)
    throw new Error(
      `Actor "${selector.actor}" has no skeleton, so bone "${selector.bone}" cannot resolve.`,
    );
  const bone = resolvePose(
    spatial.pose,
    actor.model.skeleton,
    HUMANOID_JOINT_AXES,
  ).find((item) => item.bone === selector.bone);
  if (bone === undefined)
    throw new Error(
      `Actor "${selector.actor}" has no resolved bone "${selector.bone}". Correct the selector or rig.`,
    );
  return applyTransformPoint(spatial.transform, bone.worldPosition);
};

interface ICompiledActor {
  compiled: IAutoMovieCompiledShotSource;
  node: IAutoMovieCompiledShotSource["scene"]["nodes"][number];
  model: IAutoMovieCompiledShotSource["models"][number];
}

const findCompiledActor = (
  shots: ReadonlyMap<string, IAutoMovieCompiledShotSource>,
  actor: string,
  shotId?: string,
): ICompiledActor => {
  const candidates =
    shotId === undefined
      ? [...shots.values()]
      : [shots.get(shotId)].filter(
          (value): value is IAutoMovieCompiledShotSource => value !== undefined,
        );
  const matches: ICompiledActor[] = [];
  for (const compiled of candidates) {
    const node = compiled.scene.nodes.find((item) => item.id === actor);
    if (node === undefined) continue;
    const model = compiled.models.find((item) => item.id === node.model);
    if (model === undefined)
      throw new Error(
        `Actor "${actor}" references missing model "${node.model}" in shot "${compiled.shot.id}". Recompile corrected source.`,
      );
    matches.push({ compiled, node, model });
  }
  if (matches.length > 1)
    throw new Error(
      `Actor "${actor}" appears in multiple compiled shots (${matches
        .map((match) => match.compiled.shot.id)
        .join(
          ", ",
        )}). Supply the shot id so geometry never depends on file order.`,
    );
  if (matches.length === 1) return matches[0]!;
  throw new Error(
    `Actor "${actor}" does not exist${shotId === undefined ? "" : ` in shot "${shotId}"`} in current compiled scenes. Compile the owning shot or correct the selector.`,
  );
};

const actorPoseAt = (
  compiled: IAutoMovieCompiledShotSource,
  actor: string,
  time: number,
  skeleton: IAutoMovieSkeleton | null,
): IAutoMoviePose => {
  if (
    Number.isFinite(time) === false ||
    time < 0 ||
    time > compiled.shot.duration
  )
    throw new Error(
      `Actor sample time ${time} is outside shot "${compiled.shot.id}" duration 0..${compiled.shot.duration}. Choose a current in-range time.`,
    );
  const empty = (): IAutoMoviePose => ({
    skeleton: skeleton?.id ?? "unrigged",
    root: null,
    joints: [],
  });
  const node = compiled.scene.nodes.find((item) => item.id === actor)!;
  const performance = compiled.shot.performances.find(
    (item) => item.node === actor,
  );
  const motionId = performance === undefined ? node.motion : performance.motion;
  if (motionId === null) return node.pose ?? empty();
  const motion = compiled.motions.find((item) => item.id === motionId);
  if (motion === undefined)
    throw new Error(
      `Actor "${actor}" references missing motion "${motionId}". Recompile the shot source.`,
    );
  return sampleMotion(
    motion,
    performance === undefined
      ? time
      : Math.max(0, time - performance.startOffset),
  ).pose;
};

interface IActorSpatialSample {
  pose: IAutoMoviePose;
  transform: IAutoMovieTransform;
  nodeTransform: IAutoMovieTransform;
  poseRoot: IAutoMovieTransform | null;
}

const actorSpatialAt = (
  compiled: IAutoMovieCompiledShotSource,
  actor: string,
  time: number,
  skeleton: IAutoMovieSkeleton | null,
): IActorSpatialSample => {
  const pose = actorPoseAt(compiled, actor, time, skeleton);
  const node = compiled.scene.nodes.find((item) => item.id === actor)!;
  const sampled = sampleClipSequence(compiled.shot.objectMotions, time);
  const translation = sampled.get(`node:${actor}:translation`)?.value;
  const rotation = sampled.get(`node:${actor}:rotation`)?.value;
  const scale = sampled.get(`node:${actor}:scale`)?.value;
  const nodeTransform: IAutoMovieTransform = {
    translation:
      translation === undefined
        ? node.transform.translation
        : {
            x: translation[0]!,
            y: translation[1]!,
            z: translation[2]!,
          },
    rotation:
      rotation === undefined
        ? node.transform.rotation
        : {
            x: rotation[0]!,
            y: rotation[1]!,
            z: rotation[2]!,
            w: rotation[3]!,
          },
    scale:
      scale === undefined
        ? node.transform.scale
        : { x: scale[0]!, y: scale[1]!, z: scale[2]! },
  };
  return {
    pose: { ...pose, root: null },
    nodeTransform,
    poseRoot: pose.root,
    transform:
      pose.root === null
        ? nodeTransform
        : composeTransforms(nodeTransform, {
            ...pose.root,
            // Engine FK and the viewer both treat pose-root scale as identity.
            scale: { x: 1, y: 1, z: 1 },
          }),
  };
};

const actorTransformAt = (
  compiled: IAutoMovieCompiledShotSource,
  actor: string,
  time: number,
): IAutoMovieTransform => {
  const found = findCompiledActor(
    new Map([[compiled.shot.id, compiled]]),
    actor,
    compiled.shot.id,
  );
  return actorSpatialAt(compiled, actor, time, found.model.skeleton).transform;
};

const sampleActorPose = (
  shots: ReadonlyMap<string, IAutoMovieCompiledShotSource>,
  actor: string,
  shotId: string | undefined,
  time: number,
): Record<string, number | string | boolean> => {
  const found = findCompiledActor(shots, actor, shotId);
  const performance = found.compiled.shot.performances.find(
    (item) => item.node === actor,
  );
  const pose = actorPoseAt(found.compiled, actor, time, found.model.skeleton);
  const transform = actorSpatialAt(
    found.compiled,
    actor,
    time,
    found.model.skeleton,
  ).transform;
  return {
    shot: found.compiled.shot.id,
    actor,
    held:
      (performance === undefined ? found.node.motion : performance.motion) ===
      null,
    rootX: transform.translation.x,
    rootY: transform.translation.y,
    rootZ: transform.translation.z,
    jointCount: pose.joints.length,
  };
};

interface IArmReachMeasurement {
  gap: number;
  reachable: boolean;
  poseWithinRom: boolean;
}

const measureArmReach = (
  skeleton: IAutoMovieSkeleton,
  side: "left" | "right",
  target: IAutoMovieVector3,
): IArmReachMeasurement | null => {
  const upperName = side === "left" ? "leftUpperArm" : "rightUpperArm";
  const lowerName = side === "left" ? "leftLowerArm" : "rightLowerArm";
  const handName = side === "left" ? "leftHand" : "rightHand";
  const rest = resolvePose(
    { skeleton: skeleton.id, root: null, joints: [] },
    skeleton,
    HUMANOID_JOINT_AXES,
  );
  const upper = rest.find((bone) => bone.bone === upperName);
  const lower = rest.find((bone) => bone.bone === lowerName);
  const hand = rest.find((bone) => bone.bone === handName);
  if (upper === undefined || lower === undefined || hand === undefined)
    return null;
  const upperLength = Vector3.length(
    Vector3.subtract(lower.worldPosition, upper.worldPosition),
  );
  const lowerLength = Vector3.length(
    Vector3.subtract(hand.worldPosition, lower.worldPosition),
  );
  if (upperLength < 1e-6 || lowerLength < 1e-6) return null;
  const targetDistance = Vector3.length(
    Vector3.subtract(target, upper.worldPosition),
  );
  const gap = Math.max(0, targetDistance - upperLength - lowerLength);
  const pose = reachPose(skeleton, side, target);
  return {
    gap,
    reachable: gap <= 1e-6,
    poseWithinRom:
      pose !== null && validatePose({ pose, skeleton }).items.length === 0,
  };
};

const applyTransformPoint = (
  transform: IAutoMovieTransform,
  point: IAutoMovieVector3,
): IAutoMovieVector3 =>
  Vector3.add(
    transform.translation,
    Quaternion.rotateVector(transform.rotation, {
      x: point.x * transform.scale.x,
      y: point.y * transform.scale.y,
      z: point.z * transform.scale.z,
    }),
  );

const composeTransforms = (
  parent: IAutoMovieTransform,
  child: IAutoMovieTransform,
): IAutoMovieTransform => ({
  translation: applyTransformPoint(parent, child.translation),
  rotation: Quaternion.multiply(parent.rotation, child.rotation),
  scale: {
    x: parent.scale.x * child.scale.x,
    y: parent.scale.y * child.scale.y,
    z: parent.scale.z * child.scale.z,
  },
});

const toModelPoint = (
  point: IAutoMovieVector3,
  transform: IAutoMovieTransform,
): IAutoMovieVector3 | null => {
  if (
    Math.abs(transform.scale.x) < 1e-6 ||
    Math.abs(transform.scale.y) < 1e-6 ||
    Math.abs(transform.scale.z) < 1e-6
  )
    return null;
  const unrotated = Quaternion.rotateVector(
    Quaternion.inverse(transform.rotation),
    Vector3.subtract(point, transform.translation),
  );
  return {
    x: unrotated.x / transform.scale.x,
    y: unrotated.y / transform.scale.y,
    z: unrotated.z / transform.scale.z,
  };
};

/**
 * What the world's terrain is under one XZ point.
 *
 * Both halves come from the engine: which surface is under the point and how
 * high that surface is there. A private reading here would be a second answer
 * beside the one a placement and a gate already use, and it would go on
 * reporting a plane for terrain that had learned to rise. Over nothing the
 * height is the scalar plane the engine assumed before terrain existed, which
 * is what an oracle answering a point off the world has always reported.
 */
const groundSample = (
  world: Pick<IAutoMovieWorldDesign, "surfaces"> | null,
  point: { x: number; z: number },
): { height: number; surface: string | null; walkable: boolean } => {
  const surface = worldGroundSurface(world?.surfaces ?? [], point);
  return surface === null
    ? { height: 0, surface: null, walkable: false }
    : {
        height: worldSurfaceHeight(surface, point),
        surface: surface.id,
        walkable: surface.walkable,
      };
};

const pointInsideBounds = (
  point: IAutoMovieVector3,
  bounds: IAutoMovieCompiledShotSource["effects"][number]["bounds"],
): boolean =>
  point.x >= bounds.min.x &&
  point.x <= bounds.max.x &&
  point.y >= bounds.min.y &&
  point.y <= bounds.max.y &&
  point.z >= bounds.min.z &&
  point.z <= bounds.max.z;

const rayBoundsIntersectionLength = (
  origin: IAutoMovieVector3,
  direction: IAutoMovieVector3,
  bounds: IAutoMovieCompiledShotSource["effects"][number]["bounds"],
  maximumDistance: number,
): number => {
  let enter = 0;
  let exit = maximumDistance;
  for (const axis of ["x", "y", "z"] as const) {
    const component = direction[axis];
    if (Math.abs(component) < 1e-12) {
      if (origin[axis] < bounds.min[axis] || origin[axis] > bounds.max[axis])
        return 0;
      continue;
    }
    const first = (bounds.min[axis] - origin[axis]) / component;
    const second = (bounds.max[axis] - origin[axis]) / component;
    enter = Math.max(enter, Math.min(first, second));
    exit = Math.min(exit, Math.max(first, second));
    if (enter >= exit) return 0;
  }
  return Math.max(0, exit - enter);
};

const distance = (left: IAutoMovieVector3, right: IAutoMovieVector3): number =>
  Math.hypot(left.x - right.x, left.y - right.y, left.z - right.z);
