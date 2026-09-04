import {
  HUMANOID_JOINT_AXES,
  Quaternion,
  Vector3,
  composeFormationHeroTransform,
  intersectsPerspectiveFrustumSphere,
  placeFormationSlot,
  projectToNdc,
  reachPose,
  renderAutoMovieSemanticMaskSidecar,
  resolveAutoMovieDeliveryCrop,
  resolveCameraAt,
  resolvePose,
  sampleClipSequence,
  sampleCompiledEffect,
  sampleFormationMotion,
  sampleFormationSlotMotion,
  sampleMotion,
  selectFormationLod,
  transformFormationBounds,
  transformFormationPoint,
  validatePose,
  worldGroundSurface,
  worldSurfaceHeight,
} from "@automovie/engine";
import {
  AutoMovieContentDigest,
  AutoMovieDiagnosticCode,
  AutoMovieProductionFrameCapture,
  IAutoMovieCompileProjectOutput,
  IAutoMovieCompiledShotSource,
  IAutoMovieDiagnostic,
  IAutoMovieGeneratedManifest,
  IAutoMovieGeometryResult,
  IAutoMovieGeometrySelector,
  IAutoMovieModel,
  IAutoMoviePose,
  IAutoMoviePreviewFrameInput,
  IAutoMoviePreviewFrameOutput,
  IAutoMovieQueryGeometryInput,
  IAutoMovieQueryGeometryOutput,
  IAutoMovieRenderBundleManifest,
  IAutoMovieRenderSpec,
  IAutoMovieSkeleton,
  IAutoMovieTransform,
  IAutoMovieVector3,
  IAutoMovieWorldDesign,
} from "@automovie/interface";
import fs from "node:fs";
import path from "node:path";
import type { PNG } from "pngjs";
import typia from "typia";

import {
  AutoMovieProductionInputRaceError,
  AutoMovieProductionProject,
  productionRenderBundleRelativePath,
} from "./AutoMovieProductionProject";
import { canonicalAutoMovieCaptureRuntimeIdentity } from "./captureRuntimeIdentity";
import {
  canonicalAutoMovieJsonBytes,
  compareCodeUnits,
  digestAutoMovieBytes,
  encodeAutoMoviePathSegment,
} from "./contentIdentity";
import { readAutoMovieFilmTimeline } from "./filmTimeline";
import { materializeFormationSlot } from "./materializeProduction";
import { productionRenderTargetFingerprint } from "./renderIdentity";
import { residentPngJs } from "./residentCodecs";
import {
  classifyAutoMovieProductionSemanticMaskEvidence,
  createAutoMovieProductionSemanticMaskReceipt,
} from "./semanticMaskEvidence";

/**
 * Read-only current compiler status used to refuse stale oracle answers.
 */
export type AutoMovieCompileStatusProvider =
  () => IAutoMovieCompileProjectOutput;

/**
 * Compact geometry and actual-frame oracle over current compiled artifacts.
 *
 * Geometry queries read generated shot data and bounded design rather than
 * accepting a caller-supplied film graph. Preview delegates pixels to a
 * project-fixed host adapter, decodes the PNG, binds it to the current compile
 * fingerprint and atomically records a content-addressed render bundle.
 */
export class AutoMovieProductionOracleService {
  /** Bind current project state and optional host evidence adapters. */
  public constructor(
    private readonly project: AutoMovieProductionProject,
    private readonly capture?: AutoMovieProductionFrameCapture,
    private readonly compileStatus?: AutoMovieCompileStatusProvider,
  ) {}

  /**
   * Measure one compact geometry question against the current compile.
   */
  public query(
    input: IAutoMovieQueryGeometryInput,
  ): IAutoMovieQueryGeometryOutput {
    const request = input.request;
    const generated = this.project.generatedManifest();
    const generatedManifestPath = normalizeSlash(
      path.relative(
        this.project.root,
        this.project.trackedStatePath("generated-manifest.json"),
      ),
    );
    if (generated === null)
      return queryFailure(request.query, null, {
        code: "compile-missing",
        category: "error",
        phase: "compile",
        target: request.query,
        path: generatedManifestPath,
        message:
          "No current compile exists. Run the scaffold source compile command before using the geometry API.",
      });
    const freshness = this.freshnessDiagnostic(generated);
    if (freshness !== null)
      return queryFailure(request.query, generated.inputFingerprint, freshness);
    try {
      const graph = this.project.graph();
      const shots = readCompiledShots(this.project, generated.inputFingerprint);
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
            graph.world,
            shots,
            options,
          );
          const right = resolveSelector(
            request.to,
            graph.world,
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
          const target = resolveSelector(request.target, graph.world, shots, {
            shot: actor.compiled.shot.id,
            time: sampledTime,
          });
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
          const left = measureArmReach(
            actor.model.skeleton,
            "left",
            localTarget,
          );
          const right = measureArmReach(
            actor.model.skeleton,
            "right",
            localTarget,
          );
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
          const sample = groundSample(graph.world, request.point);
          result = {
            kind: "ground",
            height: sample.height,
            surface: sample.surface,
            walkable: sample.walkable,
          };
          break;
        }
        case "formation": {
          const formation = graph.formations.get(request.formation);
          if (formation === undefined)
            throw new Error(
              `Formation "${request.formation}" does not exist. Inspect current formation ids.`,
            );
          const participatingShots = [...graph.shots]
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
              `Formation "${request.formation}" is not fully materialized in every current participating shot. Recompile its source and compiler-owned slots.`,
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
          const transformPoint = (
            point: IAutoMovieVector3,
          ): IAutoMovieVector3 =>
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
              position: materializeFormationSlot(formation, slot).position,
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
            const sample = groundSample(graph.world, placed.position);
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
          const routes = graph.world!.routes;
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
          const production = graph.production!;
          const aspect =
            production.frameFormat.width / production.frameFormat.height;
          const crop = resolveAutoMovieDeliveryCrop(
            production.frameFormat.crop,
          );
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
                ...[transformedBounds.min.x, transformedBounds.max.x].flatMap(
                  (x) =>
                    [transformedBounds.min.y, transformedBounds.max.y].flatMap(
                      (y) =>
                        [transformedBounds.min.z, transformedBounds.max.z].map(
                          (z) =>
                            Math.hypot(
                              x - center.x,
                              y - center.y,
                              z - center.z,
                            ),
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
          const sample = sampleCompiledEffect(
            effect,
            request.time,
            cameraDistance,
          );
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
          if (
            subjects.length > 256 ||
            new Set(subjects).size !== subjects.length
          )
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
              minimumOpacity:
                effect.recipe.particle.opacity.min * sample.intensity,
              maximumOpacity,
              cameraDistance,
              cameraIntersectionLength: intersectionLength,
              subjectCount: subjects.length,
              subjectsInside: insideSubjects,
              visibilityRisk,
              representativeFrame: Math.round(
                sample.time * graph.production!.frameFormat.fps,
              ),
              effectDigest: effect.digest,
            },
          };
          break;
        }
        case "film-time": {
          const timeline = readAutoMovieFilmTimeline(
            this.project,
            generated.inputFingerprint,
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
          const contract = graph.shots.get(request.shot);
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
          if (graph.production === null)
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
            graph.production.frameFormat.width /
            graph.production.frameFormat.height;
          const crop = graph.production.frameFormat.crop;
          const samples = request.subjects.flatMap((subject) => {
            const node = compiled.scene.nodes.find(
              (item) => item.id === subject,
            );
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
      return {
        query: request.query,
        compileFingerprint: generated.inputFingerprint,
        result,
        diagnostics: [],
      };
    } catch (error) {
      return queryFailure(request.query, generated.inputFingerprint, {
        code: "geometry-selector-invalid",
        category: "error",
        phase: "compile",
        target: request.query,
        path: null,
        message:
          error instanceof Error
            ? error.message
            : "Geometry query failed. Correct its current selectors.",
      });
    }
  }

  /**
   * Capture and verify one actual PNG frame from the current compile.
   */
  public async preview(
    input: IAutoMoviePreviewFrameInput,
  ): Promise<IAutoMoviePreviewFrameOutput> {
    const generated = this.project.generatedManifest();
    if (generated === null)
      throw new Error(
        "Capture requires a current source compile. Run the scaffold compile command before requesting pixels.",
      );
    const freshness = this.freshnessDiagnostic(generated);
    if (freshness !== null)
      return previewFailure(
        generated.inputFingerprint,
        freshness.code,
        freshness.message,
      );
    const graph = this.project.graph();
    const production = graph.production;
    if (production === null)
      throw new Error(
        "Capture requires a production frame format. Create the tracked production design record and run the scaffold compile command.",
      );
    const pass = input.pass ?? "beauty";
    const width = input.width ?? production.frameFormat.width;
    const height = input.height ?? production.frameFormat.height;
    const fps = production.frameFormat.fps;
    if (
      Number.isInteger(width) === false ||
      Number.isInteger(height) === false ||
      width <= 0 ||
      height <= 0 ||
      width > production.frameFormat.width ||
      height > production.frameFormat.height ||
      Number.isFinite(input.time) === false ||
      input.time < 0
    )
      return previewFailure(
        generated.inputFingerprint,
        "preview-input-invalid",
        `Capture time must be non-negative; dimensions must be positive integers no larger than the validated ${production.frameFormat.width}x${production.frameFormat.height} production frame. Correct the capture request.`,
      );
    let duration: number | undefined;
    let requestedTime = input.time;
    const targetPath =
      input.target.kind === "shot"
        ? `shots/${encodeAutoMoviePathSegment(input.target.id)}.json`
        : `models/${encodeAutoMoviePathSegment(input.target.id)}.json`;
    const targetMaterialized = generated.files.some(
      (file) => file.path === targetPath,
    );
    if (input.target.kind === "shot")
      duration = graph.shots.get(input.target.id)?.durationSeconds;
    else {
      if (
        graph.models.has(input.target.id) === false ||
        Number.isFinite(input.target.angleDeg) === false ||
        input.target.angleDeg < 0 ||
        input.target.angleDeg >= 360 ||
        Number.isFinite(input.target.elevationDeg) === false ||
        input.target.elevationDeg < -85 ||
        input.target.elevationDeg > 85
      )
        return previewFailure(
          generated.inputFingerprint,
          "preview-input-invalid",
          "Asset preview requires a current model, angleDeg in [0, 360), and elevationDeg in [-85, 85]. Correct the isolated turntable target.",
        );
      duration = 12;
      requestedTime = input.target.angleDeg / 30;
      if (input.target.pose === "rom-extremes")
        try {
          const validation = typia.validateEquals<IAutoMovieModel>(
            JSON.parse(
              Buffer.from(this.project.readGeneratedFile(targetPath)).toString(
                "utf8",
              ),
            ) as unknown,
          );
          if (validation.success === false || validation.data.skeleton === null)
            throw new Error("the compiled model has no humanoid skeleton");
        } catch (error) {
          return previewFailure(
            generated.inputFingerprint,
            "preview-input-invalid",
            `Asset ROM-extremes capture is unavailable because ${
              error instanceof Error ? error.message : String(error)
            }. Use rest pose for props or compile a valid rig.`,
          );
        }
      const part = input.target.part;
      if (part !== undefined) {
        let model: IAutoMovieModel;
        try {
          const validation = typia.validateEquals<IAutoMovieModel>(
            JSON.parse(
              Buffer.from(this.project.readGeneratedFile(targetPath)).toString(
                "utf8",
              ),
            ) as unknown,
          );
          if (validation.success === false)
            throw new Error("the compiled model has an invalid schema");
          model = validation.data;
        } catch (error) {
          return previewFailure(
            generated.inputFingerprint,
            "preview-input-invalid",
            `Asset part capture is unavailable because ${
              error instanceof Error ? error.message : String(error)
            }. Compile the model before framing one of its parts.`,
          );
        }
        if (model.origin === "imported")
          return previewFailure(
            generated.inputFingerprint,
            "preview-input-invalid",
            `Compiled model "${input.target.id}" is imported geometry, whose interior nodes this surface does not address. Capture the whole model, or author the piece you need to frame as its own recipe part.`,
          );
        if (model.parts.some((candidate) => candidate.id === part) === false)
          return previewFailure(
            generated.inputFingerprint,
            "preview-input-invalid",
            `Compiled model "${input.target.id}" has no part "${part}". Frame one of its current parts: ${namedParts(model)}.`,
          );
      }
    }
    if (duration === undefined || targetMaterialized === false)
      return previewFailure(
        generated.inputFingerprint,
        "preview-target-missing",
        `Target "${input.target.kind}:${input.target.id}" is absent from current compiler-owned output. Correct the target or compile its source before capturing.`,
      );
    if (requestedTime > duration)
      return previewFailure(
        generated.inputFingerprint,
        "preview-input-invalid",
        `Preview time ${requestedTime} exceeds target duration ${duration}. Choose a current in-range frame time.`,
      );
    if (this.capture === undefined)
      return previewFailure(
        generated.inputFingerprint,
        "capture-host-unavailable",
        "This project supplies no project-fixed frame capture. Run the scaffold preview host, or pass a capture adapter.",
      );
    const targetFingerprint = productionRenderTargetFingerprint(
      this.project,
      generated,
      input.target,
    );
    const index = Math.min(
      Math.round(requestedTime * fps),
      Math.floor(duration * fps),
    );
    const time = index / fps;
    const crop =
      input.target.kind === "shot" ? production.frameFormat.crop : undefined;
    let captured: Awaited<ReturnType<AutoMovieProductionFrameCapture>>;
    try {
      captured = await this.capture({
        ...input,
        time,
        width,
        height,
        ...(crop === undefined ? {} : { crop: structuredClone(crop) }),
        projectRoot: this.project.root,
        productionId: this.project.productionId,
        compileFingerprint: generated.inputFingerprint,
      });
    } catch (error) {
      return previewFailure(
        generated.inputFingerprint,
        "capture-failed",
        `${
          error instanceof Error ? error.message : String(error)
        }. Correct the capture host and retry.`,
      );
    }
    const captureInputsCurrent = (): boolean => {
      const current = this.project.generatedManifest();
      return (
        current !== null &&
        current.inputFingerprint === generated.inputFingerprint &&
        this.freshnessDiagnostic(current) === null &&
        productionRenderTargetFingerprint(
          this.project,
          current,
          input.target,
        ) === targetFingerprint
      );
    };
    if (captureInputsCurrent() === false)
      return previewFailure(
        generated.inputFingerprint,
        "capture-input-changed",
        "Production source, design, generated output, or declared renderer inputs changed while the PNG was being captured. Discard this mixed snapshot, compile the current project, and capture the frame again.",
      );
    let png: PNG;
    try {
      if (captured.bytes.length === 0)
        throw new Error("capture returned zero bytes");
      png = residentPngJs().PNG.sync.read(Buffer.from(captured.bytes));
    } catch (error) {
      return previewFailure(
        generated.inputFingerprint,
        "capture-png-invalid",
        `${
          error instanceof Error ? error.message : String(error)
        }. The preview host must return a decodable PNG.`,
      );
    }
    let rendererIdentity: string;
    try {
      rendererIdentity = canonicalAutoMovieCaptureRuntimeIdentity(
        captured.runtimeIdentity,
      );
    } catch (error) {
      return previewFailure(
        generated.inputFingerprint,
        "capture-renderer-identity-invalid",
        `${String(error)} Correct the capture adapter or run npm run capture:install and npm run capture:doctor before these pixels enter a render bundle.`,
      );
    }
    const dialogueRuntimeIdentity = captured.dialogueRuntimeIdentity;
    if (
      dialogueRuntimeIdentity !== null &&
      /^sha256:[0-9a-f]{64}$/u.test(dialogueRuntimeIdentity) === false
    )
      return previewFailure(
        generated.inputFingerprint,
        "capture-dialogue-identity-invalid",
        "The capture host returned an invalid dialogue runtime identity. Rebuild the current dialogue runtime and capture the frame again.",
      );
    if (input.target.kind !== "shot" && dialogueRuntimeIdentity !== null)
      return previewFailure(
        generated.inputFingerprint,
        "capture-dialogue-identity-invalid",
        "A non-shot capture must not claim a dialogue runtime identity. Clear the capture host dialogue state and capture the asset again.",
      );
    const semanticStatus =
      input.target.kind === "shot"
        ? classifyAutoMovieProductionSemanticMaskEvidence({
            observation: captured.semanticMask,
            expectedShot: input.target.id,
          })
        : captured.semanticMask.status === "not-run"
          ? null
          : { status: "foreign" as const };
    if (
      semanticStatus !== null &&
      semanticStatus.status !== "complete" &&
      semanticStatus.status !== "incomplete" &&
      (pass === "mask" || captured.semanticMask.status === "available")
    )
      return previewFailure(
        generated.inputFingerprint,
        "capture-failed",
        `The capture host returned ${semanticStatus.status} semantic evidence${"reason" in semanticStatus ? `: ${semanticStatus.reason}` : "."} Correct the capture host and capture this frame again.`,
      );
    if (
      captured.width !== width ||
      captured.height !== height ||
      png.width !== width ||
      png.height !== height
    )
      return previewFailure(
        generated.inputFingerprint,
        "capture-size-mismatch",
        `Requested ${width}x${height}, adapter reported ${captured.width}x${captured.height}, and PNG decoded as ${png.width}x${png.height}. Fix the preview host viewport.`,
      );
    if (hasVisiblePixelVariance(png) === false)
      return previewFailure(
        generated.inputFingerprint,
        "capture-png-blank",
        "The decoded PNG has no visible pixel variance. Fix the camera, lighting, scene, or preview host before using this frame as review evidence.",
      );
    const renderSpec: IAutoMovieRenderSpec = {
      target: input.target.id,
      frameFormat: {
        width,
        height,
        fps,
        ...(crop === undefined ? {} : { crop: structuredClone(crop) }),
      },
      toneMapping: "none",
      codec: "h264",
      pixelFormat: "yuv420p",
      crf: 17,
    };
    const relativeBundle = productionRenderBundleRelativePath({
      target: input.target,
      dialogueRuntimeIdentity,
      rendererIdentity,
      targetFingerprint,
      renderSpec,
    });
    const suffix = pass === "beauty" ? "" : `.${pass}`;
    const relativeFrame = `preview/frame_${String(index).padStart(6, "0")}${suffix}.png`;
    const bytes = Buffer.from(captured.bytes);
    const digest = digestAutoMovieBytes(bytes);
    const bundleRoot = path.join(
      this.project.renderRoot(),
      ...relativeBundle.split("/"),
    );
    const nextFrame = {
      index,
      time,
      pass,
      path: relativeFrame,
      digest,
      width,
      height,
    };
    const semanticSidecar =
      pass === "mask" &&
      semanticStatus !== null &&
      (semanticStatus.status === "complete" ||
        semanticStatus.status === "incomplete")
        ? {
            path: `preview/frame_${String(index).padStart(6, "0")}.mask.json`,
            bytes: Buffer.from(
              renderAutoMovieSemanticMaskSidecar(semanticStatus.evidence.mask),
              "utf8",
            ),
            evidence: semanticStatus.evidence,
          }
        : null;
    if (
      input.target.kind === "shot" &&
      pass === "mask" &&
      semanticSidecar === null
    )
      return previewFailure(
        generated.inputFingerprint,
        "capture-failed",
        "A shot mask frame has no reopenable same-shot semantic evidence. Correct the capture host and capture it again.",
      );
    const retained = retainedBundleFrames(
      this.project,
      bundleRoot,
      {
        target: input.target,
        compileFingerprint: generated.inputFingerprint,
        dialogueRuntimeIdentity,
        rendererIdentity,
        targetFingerprint,
        renderSpec,
      },
      duration,
    ).filter((frame) => frame.index !== index || frame.pass !== pass);
    const frames = [...retained, nextFrame].sort(
      (left, right) =>
        left.index - right.index || compareCodeUnits(left.pass, right.pass),
    );
    const priorManifest = this.project.verifiedRenderManifest(
      path.join(bundleRoot, "manifest.json"),
    );
    const retainedKeys = new Set(
      retained.map((frame) => `${frame.index}\u0000${frame.pass}`),
    );
    const semanticMasks = [
      ...(priorManifest?.semanticMasks.filter((record) =>
        retainedKeys.has(`${record.frame}\u0000${record.pass}`),
      ) ?? []),
      ...(semanticSidecar === null
        ? []
        : [
            createAutoMovieProductionSemanticMaskReceipt({
              frame: index,
              evidence: semanticSidecar.evidence,
              sidecar: semanticSidecar,
            }),
          ]),
    ].sort(
      (left, right) =>
        left.frame - right.frame || compareCodeUnits(left.shot, right.shot),
    );
    const manifest: IAutoMovieRenderBundleManifest = {
      version: 6,
      target: input.target,
      compileFingerprint: generated.inputFingerprint,
      dialogueRuntimeIdentity,
      rendererIdentity,
      targetFingerprint,
      renderSpec,
      frames,
      semanticMasks,
    };
    try {
      this.project.commitRenderBundle(
        relativeBundle,
        new Map([
          [relativeFrame, bytes],
          ...(semanticSidecar === null
            ? []
            : ([[semanticSidecar.path, semanticSidecar.bytes]] as const)),
        ]),
        manifest,
        captureInputsCurrent,
      );
    } catch (error) {
      if (error instanceof AutoMovieProductionInputRaceError)
        return previewFailure(
          generated.inputFingerprint,
          "capture-input-changed",
          `${error.message} Discard this mixed snapshot, compile the current project, and capture the frame again.`,
        );
      throw error;
    }
    return {
      captured: true,
      compileFingerprint: generated.inputFingerprint,
      renderBundle: normalizeSlash(
        path.relative(this.project.root, bundleRoot),
      ),
      frame: {
        index,
        time,
        pass,
        path: normalizeSlash(
          path.join(
            path.relative(this.project.root, bundleRoot),
            relativeFrame,
          ),
        ),
        mime: "image/png",
        digest,
        width,
        height,
      },
      diagnostics: [],
    };
  }

  private freshnessDiagnostic(
    generated: IAutoMovieGeneratedManifest,
  ): IAutoMovieDiagnostic | null {
    const generatedManifestPath = normalizeSlash(
      path.relative(
        this.project.root,
        this.project.trackedStatePath("generated-manifest.json"),
      ),
    );
    if (this.compileStatus === undefined) return null;
    const status = this.compileStatus();
    if (status.compiler.inputFingerprint !== generated.inputFingerprint)
      return {
        code: "generated-stale",
        category: "error",
        phase: "compile",
        target: "generated-manifest",
        path: generatedManifestPath,
        message: `Generated input ${generated.inputFingerprint} differs from current ${status.compiler.inputFingerprint}. Run the scaffold compile command before requesting oracle evidence.`,
      };
    const error = status.diagnostics.find(
      (diagnostic) => diagnostic.category === "error",
    );
    if (status.success === false || error !== undefined)
      return {
        code: "compile-current-invalid",
        category: "error",
        phase: "compile",
        target: "generated-manifest",
        path: generatedManifestPath,
        message: `Current source does not pass the read-only compiler gate${error === undefined ? "" : `: ${error.message}`}. Correct it and run the scaffold compile command before requesting oracle evidence.`,
      };
    return null;
  }
}

const readCompiledShots = (
  project: AutoMovieProductionProject,
  fingerprint: AutoMovieContentDigest,
): ReadonlyMap<string, IAutoMovieCompiledShotSource> => {
  const manifest = project.generatedManifest();
  if (manifest?.inputFingerprint !== fingerprint)
    throw new Error("Generated manifest changed during geometry query.");
  const output = new Map<string, IAutoMovieCompiledShotSource>();
  for (const entry of manifest.files
    .filter((file) => file.path.startsWith("shots/"))
    .sort((left, right) => compareCodeUnits(left.path, right.path))) {
    const bytes = project.readGeneratedFile(entry.path);
    if (digestAutoMovieBytes(bytes) !== entry.digest)
      throw new Error(
        `Generated shot "${entry.path}" changed after compiler freshness validation. Run the scaffold compile command before requesting oracle evidence.`,
      );
    const raw = JSON.parse(Buffer.from(bytes).toString("utf8")) as unknown;
    const validation = typia.validateEquals<IAutoMovieCompiledShotSource>(raw);
    if (validation.success === false)
      throw new Error(
        `Generated shot "${entry.path}" is invalid. Run the scaffold compile command after correcting source.`,
      );
    output.set(validation.data.shot.id, validation.data);
  }
  return output;
};

const resolveSelector = (
  selector: IAutoMovieGeometrySelector,
  world: IAutoMovieWorldDesign | null,
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
  world: IAutoMovieWorldDesign | null,
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

/**
 * The frames this bundle already holds, kept without opening one of them.
 *
 * Appending a frame used to read, digest, and decode every frame already in the
 * bundle, and then write all of them back. That made one capture cost the whole
 * bundle and a capture loop cost its square: 1.7 seconds per frame at 139
 * frames, 14 seconds at 163, which is what made a 432-capture scenario take
 * hours and stop being a canary anybody would run (`#1957`).
 *
 * Two of those three were duplicate work. `verifiedRenderManifest` already
 * reads every frame in the bundle, digests it against the manifest, and probes
 * its raster, so decoding each one a second time proved nothing the read had not
 * just proved, and pixel variance cannot change while the digest holds. The
 * rewrite proved even less: the bytes were being written back exactly as they
 * were read, which is what made an append cost the bundle twice over.
 *
 * So the retained bytes are neither decoded again nor rewritten. The caller
 * commits the one new frame beside the manifest, and the frames already on disk
 * stay where the captures that made them put them.
 *
 * What remains here is the part that is about this append rather than about the
 * bytes: the manifest must describe this exact target and render spec, a frame's
 * index and time must agree with the production clock, and its file must still
 * be inside this bundle and still exist. A frame whose file is gone is dropped,
 * so the manifest never names one that is not there.
 */
const retainedBundleFrames = (
  project: AutoMovieProductionProject,
  bundleRoot: string,
  expected: Pick<
    IAutoMovieRenderBundleManifest,
    | "target"
    | "compileFingerprint"
    | "dialogueRuntimeIdentity"
    | "rendererIdentity"
    | "targetFingerprint"
    | "renderSpec"
  >,
  duration: number,
): IAutoMovieRenderBundleManifest["frames"] => {
  const manifest = project.verifiedRenderManifest(
    path.join(bundleRoot, "manifest.json"),
  );
  if (
    manifest === null ||
    Buffer.from(
      canonicalAutoMovieJsonBytes({
        target: manifest.target,
        dialogueRuntimeIdentity: manifest.dialogueRuntimeIdentity,
        rendererIdentity: manifest.rendererIdentity,
        targetFingerprint: manifest.targetFingerprint,
        renderSpec: manifest.renderSpec,
      }),
    ).equals(
      Buffer.from(
        canonicalAutoMovieJsonBytes({
          target: expected.target,
          dialogueRuntimeIdentity: expected.dialogueRuntimeIdentity,
          rendererIdentity: expected.rendererIdentity,
          targetFingerprint: expected.targetFingerprint,
          renderSpec: expected.renderSpec,
        }),
      ),
    ) === false
  )
    return [];
  const retained: IAutoMovieRenderBundleManifest["frames"] = [];
  const bundlePrefix = `${path.resolve(bundleRoot)}${path.sep}`;
  for (const frame of manifest.frames)
    try {
      if (
        Number.isSafeInteger(frame.index) === false ||
        frame.index < 0 ||
        frame.time !== frame.index / manifest.renderSpec.frameFormat.fps ||
        frame.time > duration
      )
        continue;
      const absolute = path.resolve(bundleRoot, frame.path);
      if (absolute.startsWith(bundlePrefix) === false) continue;
      if (fs.statSync(absolute).isFile() === false) continue;
      retained.push(frame);
    } catch {
      continue;
    }
  return retained;
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

/**
 * Name the parts a caller may frame, bounded so the refusal stays readable.
 *
 * A building compiles to hundreds of parts, and a refusal that pastes all of
 * them is one nobody reads. The first twenty plus a count is enough to correct
 * a misspelling and to see that the inventory is larger than the message.
 */
const namedParts = (model: IAutoMovieModel): string => {
  const ids = model.parts.map((part) => part.id).sort(compareCodeUnits);
  return ids.length <= 20
    ? ids.join(", ")
    : `${ids.slice(0, 20).join(", ")}, and ${ids.length - 20} more`;
};

const previewFailure = (
  compileFingerprint: AutoMovieContentDigest,
  code: AutoMovieDiagnosticCode,
  message: string,
): IAutoMoviePreviewFrameOutput => ({
  captured: false,
  compileFingerprint,
  renderBundle: null,
  frame: null,
  diagnostics: [
    {
      code,
      category: "error",
      phase: "render",
      target: "preview",
      path: null,
      message,
    },
  ],
});

const queryFailure = (
  query: IAutoMovieQueryGeometryOutput["query"],
  compileFingerprint: AutoMovieContentDigest | null,
  diagnostic: IAutoMovieDiagnostic,
): IAutoMovieQueryGeometryOutput => ({
  query,
  compileFingerprint,
  result: null,
  diagnostics: [diagnostic],
});

const distance = (left: IAutoMovieVector3, right: IAutoMovieVector3): number =>
  Math.hypot(left.x - right.x, left.y - right.y, left.z - right.z);

const normalizeSlash = (value: string): string =>
  value.split(path.sep).join("/");

const hasVisiblePixelVariance = (png: PNG): boolean => {
  if (png.data.length < 8) return false;
  const alpha = png.data[3]!;
  const first = [
    png.data[0]! * alpha,
    png.data[1]! * alpha,
    png.data[2]! * alpha,
    alpha,
  ];
  for (let offset = 4; offset < png.data.length; offset += 4) {
    const currentAlpha = png.data[offset + 3]!;
    if (
      png.data[offset]! * currentAlpha !== first[0] ||
      png.data[offset + 1]! * currentAlpha !== first[1] ||
      png.data[offset + 2]! * currentAlpha !== first[2] ||
      currentAlpha !== first[3]
    )
      return true;
  }
  return false;
};
