import {
  HUMANOID_JOINT_AXES,
  Quaternion,
  Vector3,
  projectToNdc,
  reachPose,
  resolveCameraAt,
  resolvePose,
  sampleClipSequence,
  sampleMotion,
  validatePose,
} from "@automovie/engine";
import {
  AutoMovieContentDigest,
  AutoMovieProductionFrameCapture,
  IAutoMovieCompileProjectOutput,
  IAutoMovieCompiledShotSource,
  IAutoMovieDiagnostic,
  IAutoMovieGeneratedManifest,
  IAutoMovieGeometryResult,
  IAutoMovieGeometrySelector,
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
import path from "node:path";
import { PNG } from "pngjs";
import typia from "typia";

import {
  AutoMovieProductionProject,
  productionRenderBundleRelativePath,
} from "./AutoMovieProductionProject";
import {
  canonicalAutoMovieJsonBytes,
  compareCodeUnits,
  digestAutoMovieBytes,
  encodeAutoMoviePathSegment,
} from "./contentIdentity";
import { materializeFormationSlots } from "./materializeProduction";

/** Read-only current compiler status used to refuse stale oracle answers. */
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
  public constructor(
    private readonly project: AutoMovieProductionProject,
    private readonly capture?: AutoMovieProductionFrameCapture,
    private readonly compileStatus?: AutoMovieCompileStatusProvider,
  ) {}

  /** Measure one compact geometry question against the current compile. */
  public query(
    input: IAutoMovieQueryGeometryInput,
  ): IAutoMovieQueryGeometryOutput {
    const request = input.request;
    const generated = this.project.generatedManifest();
    if (generated === null)
      return queryFailure(request.query, null, {
        code: "compile-missing",
        category: "error",
        phase: "compile",
        target: request.query,
        path: ".automovie/generated-manifest.json",
        message:
          "No current compile exists. Run compileProject scope source before queryGeometry.",
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
          const slots = materializeFormationSlots(formation);
          const participatingShots = [...graph.shots]
            .filter(([, contract]) =>
              contract.participants.some(
                (participant) =>
                  participant.kind === "formation" &&
                  participant.id === request.formation,
              ),
            )
            .map(([id]) => id);
          const points = participatingShots.flatMap((id) => {
            const compiled = shots.get(id);
            return compiled === undefined
              ? []
              : slots.flatMap((slot) => {
                  const node = compiled.scene.nodes.find(
                    (candidate) => candidate.id === slot.node,
                  );
                  return node === undefined ? [] : [node.transform.translation];
                });
          });
          if (
            participatingShots.length === 0 ||
            points.length !== participatingShots.length * formation.count
          )
            throw new Error(
              `Formation "${request.formation}" is not fully materialized in every current participating shot. Recompile its source and compiler-owned slots.`,
            );
          const minimumX = Math.min(...points.map((point) => point.x));
          const maximumX = Math.max(...points.map((point) => point.x));
          const minimumZ = Math.min(...points.map((point) => point.z));
          const maximumZ = Math.max(...points.map((point) => point.z));
          result = {
            kind: "measurement",
            values: {
              designCount: formation.count,
              materializedCount: points.length / participatingShots.length,
              participatingShots: participatingShots.length,
              width: maximumX - minimumX,
              depth: maximumZ - minimumZ,
              facingDeg: formation.facingDeg,
              state: "compiled",
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

  /** Capture and verify one actual PNG frame from the current compile. */
  public async preview(
    input: IAutoMoviePreviewFrameInput,
  ): Promise<IAutoMoviePreviewFrameOutput> {
    const generated = this.project.generatedManifest();
    if (generated === null)
      throw new Error(
        "previewFrame requires a current source compile. Run compileProject before requesting pixels.",
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
        "previewFrame requires production frame format. Call setProductionDesign and compileProject.",
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
      width * height > MAX_PREVIEW_PIXELS ||
      Number.isFinite(input.time) === false ||
      input.time < 0
    )
      return previewFailure(
        generated.inputFingerprint,
        "preview-input-invalid",
        `Preview time must be non-negative; dimensions must be positive integers no larger than the ${production.frameFormat.width}x${production.frameFormat.height} production frame and ${MAX_PREVIEW_PIXELS} total pixels. Correct previewFrame input.`,
      );
    const duration = graph.shots.get(input.target.id)?.durationSeconds;
    const targetMaterialized = generated.files.some(
      (file) =>
        file.path ===
        `shots/${encodeAutoMoviePathSegment(input.target.id)}.json`,
    );
    if (duration === undefined || targetMaterialized === false)
      return previewFailure(
        generated.inputFingerprint,
        "preview-target-missing",
        `Target "${input.target.kind}:${input.target.id}" is absent from current compiler-owned output. Correct the target or compile its source before previewFrame.`,
      );
    if (input.time > duration)
      return previewFailure(
        generated.inputFingerprint,
        "preview-input-invalid",
        `Preview time ${input.time} exceeds target duration ${duration}. Choose a current in-range frame time.`,
      );
    if (this.capture === undefined)
      return previewFailure(
        generated.inputFingerprint,
        "capture-host-unavailable",
        "This MCP host has no project-fixed frame capture. Run the scaffold preview host or configure a capture adapter.",
      );
    const index = Math.min(
      Math.round(input.time * fps),
      Math.floor(duration * fps),
    );
    const time = index / fps;
    let captured: Awaited<ReturnType<AutoMovieProductionFrameCapture>>;
    try {
      captured = await this.capture({
        ...input,
        time,
        width,
        height,
        projectRoot: this.project.root,
        compileFingerprint: generated.inputFingerprint,
      });
    } catch (error) {
      return previewFailure(
        generated.inputFingerprint,
        "capture-failed",
        `${
          error instanceof Error ? error.message : String(error)
        }. Correct the preview host and retry previewFrame.`,
      );
    }
    let png: PNG;
    try {
      if (captured.bytes.length === 0)
        throw new Error("capture returned zero bytes");
      png = PNG.sync.read(Buffer.from(captured.bytes));
    } catch (error) {
      return previewFailure(
        generated.inputFingerprint,
        "capture-png-invalid",
        `${
          error instanceof Error ? error.message : String(error)
        }. The preview host must return a decodable PNG.`,
      );
    }
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
      frameFormat: { width, height, fps },
      toneMapping: "none",
      codec: "h264",
      pixelFormat: "yuv420p",
      crf: 17,
    };
    const relativeBundle = productionRenderBundleRelativePath({
      target: input.target,
      compileFingerprint: generated.inputFingerprint,
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
    const retained = verifiedRetainedFrames(
      this.project,
      bundleRoot,
      {
        target: input.target,
        compileFingerprint: generated.inputFingerprint,
        renderSpec,
      },
      duration,
    ).filter(
      (entry) => entry.frame.index !== index || entry.frame.pass !== pass,
    );
    const frames = [...retained.map((entry) => entry.frame), nextFrame].sort(
      (left, right) =>
        left.index - right.index || compareCodeUnits(left.pass, right.pass),
    );
    const manifest: IAutoMovieRenderBundleManifest = {
      version: 1,
      target: input.target,
      compileFingerprint: generated.inputFingerprint,
      renderSpec,
      frames,
    };
    this.project.commitRenderBundle(
      relativeBundle,
      new Map([
        ...retained.map((entry) => [entry.frame.path, entry.bytes] as const),
        [relativeFrame, bytes],
      ]),
      manifest,
    );
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
    if (this.compileStatus === undefined) return null;
    const status = this.compileStatus();
    if (status.compiler.inputFingerprint !== generated.inputFingerprint)
      return {
        code: "generated-stale",
        category: "error",
        phase: "compile",
        target: "generated-manifest",
        path: ".automovie/generated-manifest.json",
        message: `Generated input ${generated.inputFingerprint} differs from current ${status.compiler.inputFingerprint}. Run compileProject before requesting oracle evidence.`,
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
        path: ".automovie/generated-manifest.json",
        message: `Current source does not pass the read-only compiler gate${error === undefined ? "" : `: ${error.message}`}. Correct it and run compileProject before requesting oracle evidence.`,
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
        `Generated shot "${entry.path}" changed after compiler freshness validation. Run compileProject before requesting oracle evidence.`,
      );
    const raw = JSON.parse(Buffer.from(bytes).toString("utf8")) as unknown;
    const validation = typia.validateEquals<IAutoMovieCompiledShotSource>(raw);
    if (validation.success === false)
      throw new Error(
        `Generated shot "${entry.path}" is invalid. Run compileProject after correcting source.`,
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
}

const actorSpatialAt = (
  compiled: IAutoMovieCompiledShotSource,
  actor: string,
  time: number,
  skeleton: IAutoMovieSkeleton | null,
): IActorSpatialSample => {
  const pose = actorPoseAt(compiled, actor, time, skeleton);
  const node = compiled.scene.nodes.find((item) => item.id === actor)!;
  const base =
    pose.root === null
      ? node.transform
      : composeTransforms(node.transform, pose.root);
  const sampled = sampleClipSequence(compiled.shot.objectMotions, time);
  const translation = sampled.get(`node:${actor}:translation`)?.value;
  const rotation = sampled.get(`node:${actor}:rotation`)?.value;
  const scale = sampled.get(`node:${actor}:scale`)?.value;
  return {
    pose: { ...pose, root: null },
    transform: {
      translation:
        translation === undefined
          ? base.translation
          : {
              x: translation[0]!,
              y: translation[1]!,
              z: translation[2]!,
            },
      rotation:
        rotation === undefined
          ? base.rotation
          : {
              x: rotation[0]!,
              y: rotation[1]!,
              z: rotation[2]!,
              w: rotation[3]!,
            },
      scale:
        scale === undefined
          ? base.scale
          : { x: scale[0]!, y: scale[1]!, z: scale[2]! },
    },
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
  if (performance === undefined)
    throw new Error(
      `Actor "${actor}" has no performance in shot "${found.compiled.shot.id}". Correct the actor or shot source.`,
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
    held: performance.motion === null,
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

const groundSample = (
  world: IAutoMovieWorldDesign | null,
  point: { x: number; z: number },
): { height: number; surface: string | null; walkable: boolean } => {
  for (const surface of world?.surfaces ?? [])
    if (insidePolygon(point, surface.polygon))
      return {
        height:
          surface.height.kind === "constant"
            ? surface.height.value
            : surface.height.originHeight +
              surface.height.slopeX * point.x +
              surface.height.slopeZ * point.z,
        surface: surface.id,
        walkable: surface.walkable,
      };
  return { height: 0, surface: null, walkable: false };
};

const verifiedRetainedFrames = (
  project: AutoMovieProductionProject,
  bundleRoot: string,
  expected: Pick<
    IAutoMovieRenderBundleManifest,
    "target" | "compileFingerprint" | "renderSpec"
  >,
  duration: number,
): Array<{
  frame: IAutoMovieRenderBundleManifest["frames"][number];
  bytes: Uint8Array;
}> => {
  const manifest = project.verifiedRenderManifest(
    path.join(bundleRoot, "manifest.json"),
  );
  if (
    manifest === null ||
    Buffer.from(
      canonicalAutoMovieJsonBytes({
        target: manifest.target,
        compileFingerprint: manifest.compileFingerprint,
        renderSpec: manifest.renderSpec,
      }),
    ).equals(
      Buffer.from(
        canonicalAutoMovieJsonBytes({
          target: expected.target,
          compileFingerprint: expected.compileFingerprint,
          renderSpec: expected.renderSpec,
        }),
      ),
    ) === false
  )
    return [];
  const retained: Array<{
    frame: IAutoMovieRenderBundleManifest["frames"][number];
    bytes: Uint8Array;
  }> = [];
  for (const frame of manifest.frames)
    try {
      if (
        frame.index < 0 ||
        frame.time !== frame.index / manifest.renderSpec.frameFormat.fps ||
        frame.time > duration
      )
        continue;
      const absolute = path.resolve(bundleRoot, frame.path);
      const insideBundle = path.relative(bundleRoot, absolute);
      if (
        insideBundle === "" ||
        insideBundle === ".." ||
        insideBundle.startsWith(`..${path.sep}`) ||
        path.isAbsolute(insideBundle)
      )
        continue;
      const relative = normalizeSlash(
        path.relative(project.renderRoot(), absolute),
      );
      const bytes = project.readRenderFile(relative);
      if (digestAutoMovieBytes(bytes) !== frame.digest) continue;
      const png = PNG.sync.read(Buffer.from(bytes));
      if (
        png.width !== frame.width ||
        png.height !== frame.height ||
        hasVisiblePixelVariance(png) === false
      )
        continue;
      retained.push({ frame, bytes });
    } catch {
      continue;
    }
  return retained;
};

const previewFailure = (
  compileFingerprint: AutoMovieContentDigest,
  code: string,
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

const insidePolygon = (
  point: { x: number; z: number },
  polygon: ReadonlyArray<{ x: number; z: number }>,
): boolean => {
  let inside = false;
  for (
    let index = 0, previous = polygon.length - 1;
    index < polygon.length;
    previous = index++
  ) {
    const currentPoint = polygon[index]!;
    const previousPoint = polygon[previous]!;
    if (
      currentPoint.z > point.z !== previousPoint.z > point.z &&
      point.x <
        ((previousPoint.x - currentPoint.x) * (point.z - currentPoint.z)) /
          (previousPoint.z - currentPoint.z) +
          currentPoint.x
    )
      inside = !inside;
  }
  return inside;
};

const normalizeSlash = (value: string): string =>
  value.split(path.sep).join("/");

const MAX_PREVIEW_PIXELS = 16_777_216;

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
