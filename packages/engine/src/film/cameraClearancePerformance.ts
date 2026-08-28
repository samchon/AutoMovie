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
import { validateModel } from "../validation/validateModel";
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

/** One motion sequence whose authored key boundaries refine the fixed clock. */
interface IClearanceTimedSequence {
  duration: number;
  loop: boolean;
  times: readonly number[];
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

/**
 * Maximum root-to-influencing-bone segment-length sum of one validated rig.
 *
 * The adapter runs the public model validator first, so parent closure, finite
 * rest transforms, non-negative normalized skin weights, and valid skin-joint
 * indices are established here. Bone scale is deliberately absent because
 * both Engine FK and the Viewer ignore rig rest scale. Overflow of an otherwise
 * finite chain remains an addressed error at this consumer.
 */
const maximumRigReach = (model: IAutoMovieModel): number => {
  const skeleton = model.skeleton;
  if (skeleton === null) return 0;
  const bones = new Map(skeleton.bones.map((bone) => [bone.bone, bone]));
  const reaches = new Map<(typeof skeleton.bones)[number]["bone"], number>();
  const resolve = (name: (typeof skeleton.bones)[number]["bone"]): number => {
    const cached = reaches.get(name);
    if (cached !== undefined) return cached;
    const bone = bones.get(name)!;
    const segment = Math.hypot(
      bone.rest.translation.x,
      bone.rest.translation.y,
      bone.rest.translation.z,
    );
    const reach = segment + (bone.parent === null ? 0 : resolve(bone.parent));
    if (!Number.isFinite(reach))
      throw new Error(
        `camera clearance rig "${skeleton.id}" chain to bone "${name}" overflows`,
      );
    reaches.set(name, reach);
    return reach;
  };
  const influenced = model.parts.flatMap((part) => {
    if (part.attachedBone !== null) return [part.attachedBone];
    if (part.geometry.type === "mesh" && part.geometry.mesh.skin !== null)
      return part.geometry.mesh.skin.joints;
    return [];
  });
  return Math.max(0, ...influenced.map(resolve));
};

/**
 * Pose-independent radius for rigid and skinned geometry on one actor rig.
 *
 * For a rest vertex `p` bound at a joint whose chain reach is `c`, its local
 * joint offset is at most `|p| + c`; after arbitrary joint rotations its posed
 * distance is therefore at most `|p| + 2c`. Non-negative normalized skin
 * weights form a convex combination of those bounded influenced positions, so
 * the same radius contains skinned vertices as well as rigid bone attachments.
 */
const conservativeDeformationRadius = (
  model: IAutoMovieModel,
  extent: NonNullable<ReturnType<typeof computeModelRestExtent>>,
  rigReach: number,
): number => {
  const radius = originRadius(extent) + 2 * rigReach;
  if (!Number.isFinite(radius))
    throw new Error(
      `camera clearance deformation radius for model "${model.id}" overflows`,
    );
  return radius;
};

/** Describe an evaluator throw without letting hostile coercion escape. */
const safeThrownDescription = (error: unknown): string => {
  try {
    return String(error);
  } catch {
    return "an uninspectable thrown value";
  }
};

/** Whether two authored component vectors are exactly identical. */
const sameComponents = (left: readonly number[], right: readonly number[]) =>
  left.length === right.length &&
  left.every((component, index) => component === right[index]);

/** Whether a looping actor returns its clearance-relevant root to the seam. */
const actorLoopIsClosed = (motion: IAutoMovieMotion): boolean => {
  if (!motion.loop) return true;
  const first = motion.keyframes[0]?.pose.root;
  const last = motion.keyframes[motion.keyframes.length - 1]?.pose.root;
  if (first === undefined || last === undefined) return false;
  if (first === null || last === null) return first === last;
  return (
    sameComponents(
      [first.translation.x, first.translation.y, first.translation.z],
      [last.translation.x, last.translation.y, last.translation.z],
    ) &&
    Math.max(
      Math.abs(first.scale.x),
      Math.abs(first.scale.y),
      Math.abs(first.scale.z),
    ) ===
      Math.max(
        Math.abs(last.scale.x),
        Math.abs(last.scale.y),
        Math.abs(last.scale.z),
      )
  );
};

/** Whether every geometry-relevant clip channel returns to its loop seam. */
const clipLoopIsClosed = (
  clip: IAutoMovieClip,
  rotationMatters: boolean,
): boolean => {
  if (!clip.loop) return true;
  return clip.tracks.every((track) => {
    if (
      track.channel.kind !== "node" ||
      (track.channel.path === "rotation" && !rotationMatters)
    )
      return true;
    const width = track.values.length / track.times.length;
    if (!(Number.isSafeInteger(width) && width > 0)) return false;
    const first = track.values.slice(0, width);
    const last = track.values.slice(track.values.length - width);
    if (track.channel.path !== "rotation") return sameComponents(first, last);
    return (
      sameComponents(first, last) ||
      sameComponents(
        first,
        last.map((component) => -component),
      )
    );
  });
};

/** Add every in-shot key boundary, repeating a looping sequence deterministically. */
const addSequenceBoundaries = (
  result: Set<number>,
  shotDuration: number,
  sequence: IClearanceTimedSequence,
): void => {
  if (!(Number.isFinite(sequence.duration) && sequence.duration > 0))
    throw new Error(
      "camera clearance cannot sample a motion sequence without a finite positive duration",
    );
  const cycles = sequence.loop
    ? Math.ceil(shotDuration / sequence.duration)
    : 1;
  for (let cycle = 0; cycle < cycles; cycle++)
    for (const time of sequence.times) {
      const absolute = cycle * sequence.duration + time;
      if (Number.isFinite(absolute) && absolute > 0 && absolute < shotDuration)
        result.add(absolute);
    }
};

/** Base fixed clock refined by every camera, actor, and object key boundary. */
const clearanceSampleTimes = (props: {
  duration: number;
  sampleRate: number;
  cameraMotion: IAutoMovieShot["cameraMotion"];
  motions: Readonly<Record<string, IAutoMovieMotion>>;
  objectMotions: readonly IAutoMovieClip[];
}): number[] => {
  for (const motion of Object.values(props.motions)) {
    if (motion.keyframes.some((keyframe) => keyframe.easing === "cubicBezier"))
      throw new Error(
        `camera clearance cannot conservatively bound actor motion "${motion.id}" with cubicBezier easing; use linear, step, or named non-overshooting easing`,
      );
    if (!actorLoopIsClosed(motion))
      throw new Error(
        `camera clearance cannot conservatively bound actor motion "${motion.id}" across an open loop seam; close its root translation and clearance radius`,
      );
  }
  for (const clip of props.objectMotions) {
    if (clip.tracks.some((track) => track.interpolation === "cubicspline"))
      throw new Error(
        `camera clearance cannot conservatively bound clip "${clip.id}" with cubicspline interpolation; use linear or step interpolation`,
      );
    if (!clipLoopIsClosed(clip, false))
      throw new Error(
        `camera clearance cannot conservatively bound clip "${clip.id}" across an open loop seam; close its node translation and scale channels`,
      );
  }
  if (props.cameraMotion !== null) {
    if (
      props.cameraMotion.tracks.some(
        (track) => track.interpolation === "cubicspline",
      )
    )
      throw new Error(
        `camera clearance cannot conservatively bound clip "${props.cameraMotion.id}" with cubicspline interpolation; use linear or step interpolation`,
      );
    if (!clipLoopIsClosed(props.cameraMotion, true))
      throw new Error(
        `camera clearance cannot conservatively bound clip "${props.cameraMotion.id}" across an open loop seam; close its camera transform channels`,
      );
  }
  const result = new Set(sampleTimes(props.duration, props.sampleRate));
  const sequences: IClearanceTimedSequence[] = [
    ...Object.values(props.motions).map((motion) => ({
      duration: motion.duration,
      loop: motion.loop,
      times: motion.keyframes.map((keyframe) => keyframe.time),
    })),
    ...props.objectMotions.map((clip) => ({
      duration: clip.duration,
      loop: clip.loop,
      times: clip.tracks.flatMap((track) => track.times),
    })),
    ...(props.cameraMotion === null
      ? []
      : [
          {
            duration: props.cameraMotion.duration,
            loop: props.cameraMotion.loop,
            times: props.cameraMotion.tracks.flatMap((track) => track.times),
          },
        ]),
  ];
  for (const sequence of sequences)
    addSequenceBoundaries(result, props.duration, sequence);
  return [...result].sort((left, right) => left - right);
};

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
export function compileCameraClearanceReports(props: {
  scene: IAutoMovieScene;
  hero: { camera: IAutoMovieCamera; motion: IAutoMovieShot["cameraMotion"] };
  coverage: readonly IAutoMovieShotCoverage[];
  duration: number;
  motions: Readonly<Record<string, IAutoMovieMotion>>;
  objectMotions: readonly IAutoMovieClip[];
  models: readonly IAutoMovieModel[];
  runtime: IAutoMovieCameraClearanceRuntime | undefined;
  out: ViolationCollector;
}): IAutoMovieCameraClearanceReport[] | undefined {
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
  if (props.runtime.revision !== props.runtime.currentRevision) {
    for (const take of takes)
      props.out.push(
        "type",
        "$input.cameraClearance.currentRevision",
        `camera "${take.camera.id}" clearance read geometry revision "${props.runtime.revision}", but "${props.runtime.currentRevision}" is current; recompile against one current snapshot`,
        props.runtime.currentRevision,
      );
    return undefined;
  }

  props.objectMotions.forEach((clip, clipIndex) =>
    clip.tracks.forEach((track, trackIndex) => {
      if (track.channel.kind === "node" && track.channel.path === "weights")
        props.out.push(
          "type",
          `$input.objectMotions[${clipIndex}].tracks[${trackIndex}].channel.path`,
          `camera clearance cannot conservatively bound morph weights in clip "${clip.id}" because the portable model carries no morph-target expansion envelope`,
          track.channel.path,
        );
    }),
  );
  if (props.out.items.length > 0) return undefined;

  const models = new Map(props.models.map((model) => [model.id, model]));
  const animatedNodes = new Set(Object.keys(props.motions));
  for (const clip of props.objectMotions)
    for (const track of clip.tracks)
      if (track.channel.kind === "node") animatedNodes.add(track.channel.node);

  const measured: IMeasuredObstacle[] = [];
  props.scene.nodes.forEach((node, index) => {
    const model = models.get(node.model);
    let extent: ReturnType<typeof computeModelRestExtent> = null;
    let radius = 0;
    try {
      if (model !== undefined) {
        const validation = validateModel({ model });
        if (validation.success === false) {
          const first = validation.violations[0]!;
          throw new Error(
            `model contract fails at ${first.path}: ${first.expected}`,
          );
        }
      }
      const rigReach = model === undefined ? 0 : maximumRigReach(model);
      extent = model === undefined ? null : computeModelRestExtent(model);
      if (extent !== null && model !== undefined)
        radius = conservativeDeformationRadius(model, extent, rigReach);
    } catch (error) {
      props.out.push(
        "type",
        `$staged.scene.nodes[${index}].model`,
        `camera clearance cannot derive a conservative current bound for obstacle "${node.id}": ${safeThrownDescription(error)}`,
        node.model,
      );
      return;
    }
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
      radius,
      dynamic: animatedNodes.has(node.id),
    });
  });
  if (props.out.items.length > 0) return undefined;

  const reports: IAutoMovieCameraClearanceReport[] = [];
  for (const take of takes) {
    const cameraEntry = cameras.get(take.camera.id)!;
    let report: IAutoMovieCameraClearanceReport;
    try {
      const times = clearanceSampleTimes({
        duration: props.duration,
        sampleRate: props.runtime.sampleRate,
        cameraMotion: take.motion,
        motions: props.motions,
        objectMotions: props.objectMotions,
      });
      report = evaluateCameraClearance({
        camera: take.camera.id,
        envelope: take.camera.clearance!,
        revision: props.runtime.revision,
        currentRevision: props.runtime.currentRevision,
        sampleRate: props.runtime.sampleRate,
        duration: props.duration,
        samples: times.map((time) => {
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
        }),
      });
    } catch (error) {
      props.out.push(
        "range",
        `$staged.scene.cameras[${cameraEntry.index}].clearance`,
        `camera clearance could not evaluate its fixed-clock input: ${safeThrownDescription(error)}`,
        take.camera.clearance,
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
}
