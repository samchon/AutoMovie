import {
  IAutoMovieCamera,
  IAutoMovieCameraClearanceReport,
  IAutoMovieClip,
  IAutoMovieModel,
  IAutoMovieMotion,
  IAutoMovieScene,
  IAutoMovieShot,
  IAutoMovieShotCoverage,
  IAutoMovieTransform,
} from "@automovie/interface";

import { sampleTimes } from "../motion/sampleClock";
import { sampleMotion } from "../motion/sampleMotion";
import { channelKey } from "../resolve/channel";
import { sampleClipSequence } from "../resolve/sampleClip";
import { ViolationCollector } from "../validation/violation";
import { foldRoot } from "./beatEndSim";
import { evaluateCameraClearance } from "./cameraClearance";
import { computeModelRestExtent } from "./cameraMove";
import { resolveCameraAt } from "./cameraProjection";
import { nodeSubjectBox } from "./subjectExtent";

/**
 * Geometry-revision and fixed-clock authority supplied by the compiler.
 *
 * @evidence requirements/camera/clipping-occlusion-and-spatial-constraints.md#camera-spatial-geometry-revision Binds one clearance evaluation to the geometry revision read and the revision still current.
 * @evidence specifications/camera-light-and-visibility/framing-axis-and-camera-path.md#clv-camera-path-constraints-refusal Supplies the deterministic clock and freshness authority used before a take is admitted.
 */
export interface IAutoMovieCameraClearanceRuntime {
  /**
   * Revision from which staged models were materialized.
   *
   * @evidence requirements/camera/clipping-occlusion-and-spatial-constraints.md#camera-spatial-geometry-revision Identifies the exact staged geometry snapshot inspected.
   * @evidence specifications/camera-light-and-visibility/framing-axis-and-camera-path.md#clv-camera-path-constraints-refusal Supplies the report's measured revision.
   */
  revision: string;
  /**
   * Revision still current at the performance gate.
   *
   * @evidence requirements/camera/clipping-occlusion-and-spatial-constraints.md#camera-spatial-geometry-revision Prevents a stale measured snapshot from being accepted as current.
   * @evidence specifications/camera-light-and-visibility/framing-axis-and-camera-path.md#clv-camera-path-constraints-refusal Supplies the revision freshness comparison.
   */
  currentRevision: string;
  /**
   * Fixed-clock inspection samples per second.
   *
   * @evidence requirements/camera/clipping-occlusion-and-spatial-constraints.md#camera-dynamic-spatial-sampling Declares the endpoint-inclusive inspection clock.
   * @evidence specifications/camera-light-and-visibility/framing-axis-and-camera-path.md#clv-camera-path-constraints-refusal Supplies the deterministic path gate sample rate.
   */
  sampleRate: number;
}

/** A measured model and the conservative radius used while it moves. */
interface IMeasuredObstacle {
  node: IAutoMovieScene["nodes"][number];
  extent: NonNullable<ReturnType<typeof computeModelRestExtent>>;
  radius: number;
  dynamic: boolean;
}

/** Maximum distance from model origin to any corner of its measured box. */
const originRadius = (
  extent: NonNullable<ReturnType<typeof computeModelRestExtent>>,
): number =>
  Math.max(
    ...[extent.min.x, extent.max.x].flatMap((x) =>
      [extent.min.y, extent.max.y].flatMap((y) =>
        [extent.min.z, extent.max.z].map((z) => Math.hypot(x, y, z)),
      ),
    ),
  );

/** Resolve actor and object root authority at one shot-local instant. */
const nodeTransformAt = (
  node: IAutoMovieScene["nodes"][number],
  actorMotion: IAutoMovieMotion | undefined,
  objectMotions: readonly IAutoMovieClip[],
  seconds: number,
): IAutoMovieTransform => {
  const base =
    actorMotion === undefined
      ? node.transform
      : foldRoot(node.transform, sampleMotion(actorMotion, seconds).pose.root);
  const sampled = sampleClipSequence(objectMotions, seconds);
  const translation = sampled.get(
    channelKey({ kind: "node", node: node.id, path: "translation" }),
  )?.value;
  const rotation = sampled.get(
    channelKey({ kind: "node", node: node.id, path: "rotation" }),
  )?.value;
  const scale = sampled.get(
    channelKey({ kind: "node", node: node.id, path: "scale" }),
  )?.value;
  return {
    translation:
      translation === undefined
        ? base.translation
        : { x: translation[0]!, y: translation[1]!, z: translation[2]! },
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
  };
};

/**
 * Compile clearance reports for every envelope-bearing delivered take and add
 * author-addressed failures to the performance collector.
 *
 * @evidence requirements/camera/clipping-occlusion-and-spatial-constraints.md#camera-clearance Measures the hero and coverage camera bodies against every resolved modeled scene node.
 * @evidence requirements/camera/clipping-occlusion-and-spatial-constraints.md#camera-dynamic-spatial-sampling Resolves camera, actor, and object state on one shared fixed clock before conservative interval comparison.
 * @evidence specifications/camera-light-and-visibility/framing-axis-and-camera-path.md#clv-camera-path-constraints-refusal Converts missing geometry, stale state, and body or rig contact into author-addressed performance refusal.
 */
export const compileCameraClearanceReports = (props: {
  scene: IAutoMovieScene;
  hero: { camera: IAutoMovieCamera; motion: IAutoMovieShot["cameraMotion"] };
  coverage: readonly IAutoMovieShotCoverage[];
  duration: number;
  motions: Readonly<Record<string, IAutoMovieMotion>>;
  objectMotions: readonly IAutoMovieClip[];
  models: readonly IAutoMovieModel[];
  runtime: IAutoMovieCameraClearanceRuntime | undefined;
  out: ViolationCollector;
}): IAutoMovieCameraClearanceReport[] | undefined => {
  const cameras = new Map(
    props.scene.cameras.map((camera, index) => [camera.id, { camera, index }]),
  );
  const takes = [
    props.hero,
    ...props.coverage.map((take) => ({
      camera: cameras.get(take.camera)!.camera,
      motion: take.cameraMotion,
    })),
  ].filter((take) => take.camera.clearance !== undefined);
  if (takes.length === 0) return undefined;
  if (props.runtime === undefined) {
    props.out.push(
      "type",
      "$input.cameraClearance",
      "a camera with a physical clearance envelope requires compiler-owned geometry revision and fixed-clock context",
      undefined,
    );
    return undefined;
  }
  if (
    !(Number.isFinite(props.runtime.sampleRate) && props.runtime.sampleRate > 0)
  ) {
    props.out.push(
      "range",
      "$input.cameraClearance.sampleRate",
      "camera clearance sample rate must be finite and greater than zero",
      props.runtime.sampleRate,
    );
    return undefined;
  }

  const models = new Map(props.models.map((model) => [model.id, model]));
  const animatedNodes = new Set(Object.keys(props.motions));
  for (const clip of props.objectMotions)
    for (const track of clip.tracks)
      if (track.channel.kind === "node") animatedNodes.add(track.channel.node);

  const measured: IMeasuredObstacle[] = [];
  props.scene.nodes.forEach((node, index) => {
    const model = models.get(node.model);
    const extent = model === undefined ? null : computeModelRestExtent(model);
    if (extent === null) {
      props.out.push(
        "type",
        `$staged.scene.nodes[${index}].model`,
        `camera clearance cannot measure current obstacle "${node.id}" because model "${node.model}" is absent or has no geometry`,
        node.model,
      );
      return;
    }
    measured.push({
      node,
      extent,
      radius: originRadius(extent),
      dynamic: animatedNodes.has(node.id),
    });
  });
  if (props.out.items.length > 0) return undefined;

  const reports: IAutoMovieCameraClearanceReport[] = [];
  for (const take of takes) {
    const cameraEntry = cameras.get(take.camera.id)!;
    let report: IAutoMovieCameraClearanceReport;
    try {
      report = evaluateCameraClearance({
        camera: take.camera.id,
        envelope: take.camera.clearance!,
        revision: props.runtime.revision,
        currentRevision: props.runtime.currentRevision,
        sampleRate: props.runtime.sampleRate,
        duration: props.duration,
        samples: sampleTimes(props.duration, props.runtime.sampleRate).map(
          (time) => {
            const resolved = resolveCameraAt(
              take.camera.transform,
              take.motion,
              take.camera.id,
              time,
            );
            return {
              time,
              camera: {
                translation: resolved.position,
                rotation: resolved.rotation,
                scale: take.camera.transform.scale,
              },
              obstacles: measured.map((obstacle) => {
                const transform = nodeTransformAt(
                  obstacle.node,
                  props.motions[obstacle.node.id],
                  props.objectMotions,
                  time,
                );
                if (obstacle.dynamic) {
                  const scale = Math.max(
                    Math.abs(transform.scale.x),
                    Math.abs(transform.scale.y),
                    Math.abs(transform.scale.z),
                  );
                  const radius = obstacle.radius * scale;
                  return {
                    node: obstacle.node.id,
                    bounds: {
                      min: {
                        x: transform.translation.x - radius,
                        y: transform.translation.y - radius,
                        z: transform.translation.z - radius,
                      },
                      max: {
                        x: transform.translation.x + radius,
                        y: transform.translation.y + radius,
                        z: transform.translation.z + radius,
                      },
                    },
                  };
                }
                return {
                  node: obstacle.node.id,
                  bounds: nodeSubjectBox(transform, obstacle.extent),
                };
              }),
            };
          },
        ),
      });
    } catch (error) {
      props.out.push(
        "range",
        `$staged.scene.cameras[${cameraEntry.index}].clearance`,
        `camera clearance could not evaluate its fixed-clock input: ${error instanceof Error ? error.message : String(error)}`,
        take.camera.clearance,
      );
      continue;
    }
    if (report.status === "stale") {
      props.out.push(
        "type",
        "$input.cameraClearance.currentRevision",
        `camera "${take.camera.id}" clearance read geometry revision "${report.revision}", but "${report.currentRevision}" is current; recompile against one current snapshot`,
        report.currentRevision,
      );
      continue;
    }
    for (const finding of report.findings)
      props.out.push(
        "range",
        `$staged.scene.cameras[${cameraEntry.index}].clearance.${finding.part === "body" ? "body" : "parentRig"}`,
        `camera "${take.camera.id}" ${finding.part} contacts obstacle "${finding.obstacle}" over the inclusive interval [${finding.start}, ${finding.end}]s; change the path, rig, or scene clearance`,
        finding,
      );
    if (report.status === "clear") reports.push(report);
  }
  return props.out.items.length === 0 ? reports : undefined;
};
