import {
  AutoMovieHumanoidBone,
  IAutoMovieMotion,
  IAutoMovieProfileBinding,
  IAutoMovieSkeleton,
  IAutoMovieValidation,
} from "@automovie/interface";

import { HUMANOID_JOINT_AXES } from "../kinematics/humanoidJointAxes";
import {
  IAutoMovieJointAxes,
  validateJointAxesBasis,
} from "../kinematics/jointToQuaternion";
import { resolvePose } from "../kinematics/resolvePose";
import { HUMANOID_REST_FRAME, IAutoMovieRestFrame } from "../rom/restFrame";
import { validateMotion } from "../validation/validateMotion";
import { validateTransformScalars } from "../validation/validateTransformScalars";
import { ViolationCollector } from "../validation/violation";

const EPSILON = 1e-6;

/** Root-facing policy for v1 retargeting: keep the authored root rotation. */
export type AutoMovieRetargetFacing = "preserve-authored";

/** ROM priority used by the retargeted clip's validation pass. */
export type AutoMovieRetargetRomPolicy =
  "target-override-then-default-humanoid";

/**
 * A normalized humanoid rig characterized for motion retargeting: the semantic
 * bone slots, the concrete node ids the host should address, and the
 * rest-frame/axis tables needed to read clinical angles on that rig.
 *
 * @author Samchon
 */
export interface IAutoMovieHumanoidRigCharacterization {
  /** Skeleton id the characterization was derived from. */
  skeleton: string;

  /** Humanoid slot -> concrete target node id. */
  boneMap: Partial<Record<AutoMovieHumanoidBone, string>>;

  /** Rest-pose vertical extent in model units, used for root-motion scale. */
  height: number;

  /** Clinical-axis remap to pass to `resolvePose` / viewer playback. */
  jointAxes: Partial<Record<AutoMovieHumanoidBone, IAutoMovieJointAxes>>;

  /** Clinical rest-frame remap to pass to `resolvePose` / viewer playback. */
  restFrames: Partial<Record<AutoMovieHumanoidBone, IAutoMovieRestFrame>>;
}

/**
 * The source-target decision record for a retargeted humanoid clip.
 *
 * @author Samchon
 */
export interface IAutoMovieHumanoidRetargetCharacterization {
  /** Source rig the clip was authored against. */
  source: IAutoMovieHumanoidRigCharacterization;

  /** Target rig the clip now plays on. */
  target: IAutoMovieHumanoidRigCharacterization;

  /** Root translation multiplier (`target.height / source.height` by default). */
  rootScale: number;

  /** Root facing convention: v1 preserves authored root rotations. */
  facing: AutoMovieRetargetFacing;

  /** Effective ROM priority for the target validation pass. */
  romPolicy: AutoMovieRetargetRomPolicy;

  /** Bones that had to exist in both rigs for this retarget operation. */
  requiredBones: AutoMovieHumanoidBone[];
}

/** Input for {@link retargetHumanoidMotion}. */
export interface IAutoMovieHumanoidRetargetProps {
  /** Clip authored on `source`. */
  motion: IAutoMovieMotion;

  /** Skeleton the clip was authored against. */
  source: IAutoMovieSkeleton;

  /** Skeleton the clip should play on. */
  target: IAutoMovieSkeleton;

  /** Optional source profile binding carrying semantic slot -> node ids. */
  sourceBinding?: IAutoMovieProfileBinding;

  /** Optional target profile binding carrying semantic slot -> node ids. */
  targetBinding?: IAutoMovieProfileBinding;

  /** Optional source clinical axes; defaults to the humanoid table. */
  sourceJointAxes?: Partial<Record<AutoMovieHumanoidBone, IAutoMovieJointAxes>>;

  /** Optional target clinical axes; defaults to the humanoid table. */
  targetJointAxes?: Partial<Record<AutoMovieHumanoidBone, IAutoMovieJointAxes>>;

  /** Optional source rest frames; defaults to the humanoid table. */
  sourceRestFrames?: Partial<
    Record<AutoMovieHumanoidBone, IAutoMovieRestFrame>
  >;

  /** Optional target rest frames; defaults to the humanoid table. */
  targetRestFrames?: Partial<
    Record<AutoMovieHumanoidBone, IAutoMovieRestFrame>
  >;

  /** Extra bones, such as a reach end effector, that must exist on both rigs. */
  requiredBones?: readonly AutoMovieHumanoidBone[];

  /**
   * Explicit root translation scale; omitted means target height / source
   * height.
   */
  rootScale?: number;

  /** Optional id for the retargeted clip. */
  id?: string;
}

/**
 * Result of retargeting. `motion` and `characterization` are present only when
 * every structural, scale, and target-ROM check passed.
 *
 * @author Samchon
 */
export interface IAutoMovieHumanoidRetargetResult {
  /** Validation envelope containing field-located failures. */
  validation: IAutoMovieValidation;

  /** Retargeted clip, or `null` when validation failed. */
  motion: IAutoMovieMotion | null;

  /** The rig characterization required to play the clip on the target. */
  characterization: IAutoMovieHumanoidRetargetCharacterization | null;
}

/**
 * Retarget a humanoid clip from one normalized skeleton onto another.
 *
 * The clip's joint angles remain **clinical**. Retargeting changes the skeleton
 * id, scales root translation by target/source rest height, validates the
 * result against the target skeleton's ROM policy, and returns the target
 * `jointAxes`/`restFrames` that convert those clinical values into target
 * rig-space during FK or viewer playback.
 *
 * @author Samchon
 */
export const retargetHumanoidMotion = (
  props: IAutoMovieHumanoidRetargetProps,
): IAutoMovieHumanoidRetargetResult => {
  const collector = new ViolationCollector();
  const requiredBones = collectRequiredBones(props);

  props.motion.skeleton === props.source.id ||
    collector.push(
      "type",
      "$input.motion.skeleton",
      "motion skeleton must match the source skeleton id",
      props.motion.skeleton,
    );

  validateSkeleton("source", props.source, requiredBones, collector);
  validateSkeleton("target", props.target, requiredBones, collector);
  validateBinding(
    "sourceBinding",
    props.sourceBinding,
    requiredBones,
    collector,
  );
  validateBinding(
    "targetBinding",
    props.targetBinding,
    requiredBones,
    collector,
  );
  validateAxes(
    "sourceJointAxes",
    props.sourceJointAxes ?? HUMANOID_JOINT_AXES,
    collector,
  );
  validateAxes(
    "targetJointAxes",
    props.targetJointAxes ?? HUMANOID_JOINT_AXES,
    collector,
  );
  validateRestFrames(
    "sourceRestFrames",
    props.sourceRestFrames ?? HUMANOID_REST_FRAME,
    collector,
  );
  validateRestFrames(
    "targetRestFrames",
    props.targetRestFrames ?? HUMANOID_REST_FRAME,
    collector,
  );

  const sourceHeight = skeletonHeight(props.source);
  const targetHeight = skeletonHeight(props.target);
  if (!(sourceHeight > EPSILON))
    collector.push(
      "range",
      "$input.source.scale",
      "source skeleton rest height must be finite and > 0 to derive root scale",
      sourceHeight,
    );
  if (!(targetHeight > EPSILON))
    collector.push(
      "range",
      "$input.target.scale",
      "target skeleton rest height must be finite and > 0 to derive root scale",
      targetHeight,
    );

  const rootScale =
    props.rootScale ??
    (sourceHeight > EPSILON ? targetHeight / sourceHeight : 0);
  if (!Number.isFinite(rootScale) || !(rootScale > 0))
    collector.push(
      "range",
      "$input.rootScale",
      "rootScale must be a finite number > 0",
      props.rootScale ?? rootScale,
    );

  if (collector.items.length > 0)
    return {
      validation: collector.toValidation(),
      motion: null,
      characterization: null,
    };

  const source = characterizeRig({
    skeleton: props.source,
    binding: props.sourceBinding,
    height: sourceHeight,
    jointAxes: props.sourceJointAxes ?? HUMANOID_JOINT_AXES,
    restFrames: props.sourceRestFrames ?? HUMANOID_REST_FRAME,
  });
  const target = characterizeRig({
    skeleton: props.target,
    binding: props.targetBinding,
    height: targetHeight,
    jointAxes: props.targetJointAxes ?? HUMANOID_JOINT_AXES,
    restFrames: props.targetRestFrames ?? HUMANOID_REST_FRAME,
  });
  const motion = retargetMotion(
    props.motion,
    props.target.id,
    rootScale,
    props.id,
  );

  const targetValidation = validateMotion({ motion, skeleton: props.target });
  if (!targetValidation.success) {
    collector.items.push(...targetValidation.violations);
    return {
      validation: collector.toValidation(),
      motion: null,
      characterization: null,
    };
  }

  return {
    validation: { success: true },
    motion,
    characterization: {
      source,
      target,
      rootScale,
      facing: "preserve-authored",
      romPolicy: "target-override-then-default-humanoid",
      requiredBones,
    },
  };
};

const collectRequiredBones = (
  props: IAutoMovieHumanoidRetargetProps,
): AutoMovieHumanoidBone[] => {
  const bones = new Set<AutoMovieHumanoidBone>(["hips"]);
  for (const kf of props.motion.keyframes)
    for (const joint of kf.pose.joints) bones.add(joint.bone);
  for (const bone of props.requiredBones ?? []) bones.add(bone);
  return [...bones].sort();
};

const validateSkeleton = (
  label: string,
  skeleton: IAutoMovieSkeleton,
  requiredBones: readonly AutoMovieHumanoidBone[],
  collector: ViolationCollector,
): void => {
  const path = `$input.${label}`;
  const byBone = new Map<AutoMovieHumanoidBone, number>();

  skeleton.bones.forEach((bone, i) => {
    const bonePath = `${path}.bones[${i}]`;
    if (byBone.has(bone.bone))
      collector.push(
        "type",
        `${bonePath}.bone`,
        `bone "${bone.bone}" appears more than once in the ${label} skeleton`,
        bone.bone,
      );
    byBone.set(bone.bone, i);
    validateTransformScalars({
      transform: bone.rest,
      path: `${bonePath}.rest`,
      label: `${label} bone rest transform`,
      collector,
    });
  });

  for (const bone of skeleton.bones)
    if (bone.parent !== null && !byBone.has(bone.parent))
      collector.push(
        "type",
        `${path}.bones[${byBone.get(bone.bone)!}].parent`,
        `parent bone "${bone.parent}" must be present in the ${label} skeleton`,
        bone.parent,
      );

  for (const bone of requiredBones)
    if (!byBone.has(bone))
      collector.push(
        "type",
        `${path}.bones["${bone}"]`,
        `required bone "${bone}" is missing from the ${label} skeleton`,
        bone,
      );
};

const validateBinding = (
  label: "sourceBinding" | "targetBinding",
  binding: IAutoMovieProfileBinding | undefined,
  requiredBones: readonly AutoMovieHumanoidBone[],
  collector: ViolationCollector,
): void => {
  if (binding === undefined) return;
  for (const bone of requiredBones) {
    const mapped = binding.boneMap[bone];
    if (mapped === undefined || mapped.trim().length === 0)
      collector.push(
        "type",
        `$input.${label}.boneMap.${bone}`,
        `binding must map required humanoid bone "${bone}" to a concrete node id`,
        mapped,
      );
  }
};

const validateAxes = (
  label: "sourceJointAxes" | "targetJointAxes",
  axes: Partial<Record<AutoMovieHumanoidBone, IAutoMovieJointAxes>>,
  collector: ViolationCollector,
): void => {
  for (const [bone, table] of Object.entries(axes) as [
    AutoMovieHumanoidBone,
    IAutoMovieJointAxes,
  ][])
    for (const issue of validateJointAxesBasis(
      table,
      `$input.${label}.${bone}`,
    ))
      collector.push("range", issue.path, issue.expected, issue.value);
};

const validateRestFrames = (
  label: "sourceRestFrames" | "targetRestFrames",
  frames: Partial<Record<AutoMovieHumanoidBone, IAutoMovieRestFrame>>,
  collector: ViolationCollector,
): void => {
  for (const [bone, frame] of Object.entries(frames) as [
    AutoMovieHumanoidBone,
    IAutoMovieRestFrame,
  ][])
    for (const axis of ["flexion", "abduction", "twist"] as const) {
      const axisFrame = frame[axis];
      if (axisFrame === undefined) continue;
      if (axisFrame.sign !== 1 && axisFrame.sign !== -1)
        collector.push(
          "type",
          `$input.${label}.${bone}.${axis}.sign`,
          "rest-frame sign must be 1 or -1",
          axisFrame.sign,
        );
      if (!Number.isFinite(axisFrame.neutral))
        collector.push(
          "range",
          `$input.${label}.${bone}.${axis}.neutral`,
          "rest-frame neutral angle must be finite",
          axisFrame.neutral,
        );
    }
};

const skeletonHeight = (skeleton: IAutoMovieSkeleton): number => {
  const resolved = resolvePose(
    { skeleton: skeleton.id, root: null, joints: [] },
    skeleton,
  );
  if (resolved.length === 0) return 0;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const bone of resolved) {
    minY = Math.min(minY, bone.worldPosition.y);
    maxY = Math.max(maxY, bone.worldPosition.y);
  }
  return maxY - minY;
};

const characterizeRig = (props: {
  skeleton: IAutoMovieSkeleton;
  binding: IAutoMovieProfileBinding | undefined;
  height: number;
  jointAxes: Partial<Record<AutoMovieHumanoidBone, IAutoMovieJointAxes>>;
  restFrames: Partial<Record<AutoMovieHumanoidBone, IAutoMovieRestFrame>>;
}): IAutoMovieHumanoidRigCharacterization => {
  const slots = new Set(props.skeleton.bones.map((bone) => bone.bone));
  const boneMap: Partial<Record<AutoMovieHumanoidBone, string>> = {};
  const jointAxes: Partial<Record<AutoMovieHumanoidBone, IAutoMovieJointAxes>> =
    {};
  const restFrames: Partial<
    Record<AutoMovieHumanoidBone, IAutoMovieRestFrame>
  > = {};

  for (const slot of slots) {
    boneMap[slot] = props.binding?.boneMap[slot] ?? slot;
    if (props.jointAxes[slot] !== undefined)
      jointAxes[slot] = props.jointAxes[slot];
    if (props.restFrames[slot] !== undefined)
      restFrames[slot] = props.restFrames[slot];
  }

  return {
    skeleton: props.skeleton.id,
    boneMap,
    height: props.height,
    jointAxes,
    restFrames,
  };
};

const retargetMotion = (
  motion: IAutoMovieMotion,
  targetSkeleton: string,
  rootScale: number,
  id: string | undefined,
): IAutoMovieMotion => ({
  ...motion,
  id: id ?? `${motion.id}:to:${targetSkeleton}`,
  skeleton: targetSkeleton,
  keyframes: motion.keyframes.map((kf) => ({
    ...kf,
    pose: {
      ...kf.pose,
      skeleton: targetSkeleton,
      root:
        kf.pose.root === null
          ? null
          : {
              ...kf.pose.root,
              translation: {
                x: kf.pose.root.translation.x * rootScale,
                y: kf.pose.root.translation.y * rootScale,
                z: kf.pose.root.translation.z * rootScale,
              },
            },
    },
  })),
});
