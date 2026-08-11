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
import { compareCodeUnits } from "../text/compareCodeUnits";
import { validateMotion } from "../validation/validateMotion";
import { validateTransformScalars } from "../validation/validateTransformScalars";
import { ViolationCollector } from "../validation/violation";
import {
  AutoMovieRetargetContactPolicy,
  IAutoMovieRetargetContactProps,
  preserveRetargetContacts,
} from "./retargetContacts";

const EPSILON = 1e-6;

/**
 * Root-facing policy for v1 retargeting: keep the authored root rotation.
 *
 * @evidence requirements/motion/retargeting-and-scale.md#motion-retarget-mapping-selection Makes preservation of source facing an explicit retarget decision.
 * @evidence specifications/performance-motion-and-staging/kinematics-contact-and-interaction.md#performance-kinematics-retarget-scale-contact Prevents the target conversion from inventing a new root orientation.
 */
export type AutoMovieRetargetFacing = "preserve-authored";

/**
 * ROM priority used by the retargeted clip's validation pass.
 *
 * @evidence requirements/motion/retargeting-and-scale.md#motion-retarget-refusal Requires the converted clip to satisfy the target rig's effective range policy.
 * @evidence specifications/performance-motion-and-staging/kinematics-contact-and-interaction.md#performance-kinematics-retarget-scale-contact Names the ROM authority used to accept or reject the retarget.
 */
export type AutoMovieRetargetRomPolicy =
  "target-override-then-default-humanoid";

/**
 * A normalized humanoid rig characterized for motion retargeting: the semantic
 * bone slots, the concrete node ids the host should address, and the
 * rest-frame/axis tables needed to read clinical angles on that rig.
 *
 * @evidence requirements/motion/retargeting-and-scale.md#motion-retarget-source-provenance Preserves the concrete rig basis used to interpret clinical joint angles.
 * @evidence specifications/performance-motion-and-staging/kinematics-contact-and-interaction.md#performance-kinematics-retarget-scale-contact Supplies the normalized characterization required for a reproducible rig conversion.
 * @evidence requirements/actors/skeleton-rig-and-retargeting.md#actor-humanoid-mapping Records the explicit semantic humanoid-slot to concrete-node correspondence instead of relying on name similarity.
 * @evidence specifications/performance-motion-and-staging/rig-deformation-and-retargeting.md#performance-rig-semantic-joint-mapping Carries the concrete node, clinical-axis, and rest-frame basis for each mapped humanoid role.
 * @author Samchon
 */
export interface IAutoMovieHumanoidRigCharacterization {
  /**
   * Skeleton id the characterization was derived from.
   *
   * @evidence requirements/motion/retargeting-and-scale.md#motion-retarget-source-provenance Identifies the exact rig whose measurements and mappings were used.
   * @evidence specifications/performance-motion-and-staging/kinematics-contact-and-interaction.md#performance-kinematics-retarget-scale-contact Binds each characterization record to the skeleton it describes.
   */
  skeleton: string;

  /**
   * Humanoid slot -> concrete target node id.
   *
   * @evidence requirements/motion/retargeting-and-scale.md#motion-retarget-mapping-selection Records the chosen semantic correspondence instead of inferring it during playback.
   * @evidence specifications/performance-motion-and-staging/kinematics-contact-and-interaction.md#performance-kinematics-retarget-scale-contact Maps clinical humanoid channels onto the concrete rig nodes being converted.
   */
  boneMap: Partial<Record<AutoMovieHumanoidBone, string>>;

  /**
   * Rest-pose vertical extent in model units, used for root-motion scale.
   *
   * @evidence requirements/motion/retargeting-and-scale.md#motion-retarget-proportion Measures the rig proportion used to scale authored root displacement.
   * @evidence specifications/performance-motion-and-staging/kinematics-contact-and-interaction.md#performance-kinematics-retarget-scale-contact Supplies the rest-pose extent used in the root-scale ratio.
   */
  height: number;

  /**
   * Clinical-axis remap to pass to `resolvePose` / viewer playback.
   *
   * @evidence requirements/motion/retargeting-and-scale.md#motion-retarget-mapping-selection Preserves how each semantic joint axis maps into the concrete rig basis.
   * @evidence specifications/performance-motion-and-staging/kinematics-contact-and-interaction.md#performance-kinematics-retarget-scale-contact Lets the converted clinical angles resolve consistently on the target rig.
   */
  jointAxes: Partial<Record<AutoMovieHumanoidBone, IAutoMovieJointAxes>>;

  /**
   * Clinical rest-frame remap to pass to `resolvePose` / viewer playback.
   *
   * @evidence requirements/motion/retargeting-and-scale.md#motion-retarget-source-provenance Retains the declared rest basis against which clinical motion is interpreted.
   * @evidence specifications/performance-motion-and-staging/kinematics-contact-and-interaction.md#performance-kinematics-retarget-scale-contact Keeps target playback in the same characterization used by the conversion.
   */
  restFrames: Partial<Record<AutoMovieHumanoidBone, IAutoMovieRestFrame>>;
}

/**
 * The source-target decision record for a retargeted humanoid clip.
 *
 * @evidence requirements/motion/retargeting-and-scale.md#motion-retarget-source-provenance Records the resolved basis of one completed retarget.
 * @evidence specifications/performance-motion-and-staging/kinematics-contact-and-interaction.md#performance-kinematics-retarget-scale-contact Makes the effective retarget policy reproducible at playback.
 * @evidence requirements/actors/skeleton-rig-and-retargeting.md#actor-motion-retargeting Records the source and target characterizations, root scale, facing, ROM, contact policy, and required mappings used by the conversion.
 * @evidence specifications/performance-motion-and-staging/rig-deformation-and-retargeting.md#performance-rig-external-adoption-retarget-characterization Preserves the exact source-to-target characterization beside the retargeted result.
 * @author Samchon
 */
export interface IAutoMovieHumanoidRetargetCharacterization {
  /**
   * Source rig the clip was authored against.
   *
   * @evidence requirements/motion/retargeting-and-scale.md#motion-retarget-source-provenance Preserves the rig basis in which the authored clip has meaning.
   * @evidence specifications/performance-motion-and-staging/kinematics-contact-and-interaction.md#performance-kinematics-retarget-scale-contact Defines the rig-space in which source motion is measured.
   */
  source: IAutoMovieHumanoidRigCharacterization;

  /**
   * Target rig the clip now plays on.
   *
   * @evidence requirements/motion/retargeting-and-scale.md#motion-retarget-mapping-selection Identifies the selected destination and its semantic mapping.
   * @evidence specifications/performance-motion-and-staging/kinematics-contact-and-interaction.md#performance-kinematics-retarget-scale-contact Defines the rig-space in which the converted motion must play.
   */
  target: IAutoMovieHumanoidRigCharacterization;

  /**
   * Root translation multiplier (`target.height / source.height` by default).
   *
   * @evidence requirements/motion/retargeting-and-scale.md#motion-retarget-proportion Records the concrete root-motion correction for the rigs' size difference.
   * @evidence specifications/performance-motion-and-staging/kinematics-contact-and-interaction.md#performance-kinematics-retarget-scale-contact Applies the same scale to root travel and mapped contact positions.
   */
  rootScale: number;

  /**
   * Root facing convention: v1 preserves authored root rotations.
   *
   * @evidence requirements/motion/retargeting-and-scale.md#motion-retarget-mapping-selection Records the selected rule for interpreting source root orientation.
   * @evidence specifications/performance-motion-and-staging/kinematics-contact-and-interaction.md#performance-kinematics-retarget-scale-contact Confirms that target conversion preserves the authored facing.
   */
  facing: AutoMovieRetargetFacing;

  /**
   * Effective ROM priority for the target validation pass.
   *
   * @evidence requirements/motion/retargeting-and-scale.md#motion-retarget-refusal Records which range authority determines whether target playback is legal.
   * @evidence specifications/performance-motion-and-staging/kinematics-contact-and-interaction.md#performance-kinematics-retarget-scale-contact Exposes the ROM policy enforced after contact correction.
   */
  romPolicy: AutoMovieRetargetRomPolicy;

  /**
   * Whether source contacts were re-pinned on the target rig.
   *
   * @evidence requirements/motion/retargeting-and-scale.md#motion-retarget-contact-preservation Records whether target contact was solved or source angles were carried unchanged.
   * @evidence specifications/performance-motion-and-staging/kinematics-contact-and-interaction.md#performance-kinematics-retarget-scale-contact Identifies the contact treatment that produced the returned clip.
   */
  contactPolicy: AutoMovieRetargetContactPolicy;

  /**
   * Bones that had to exist in both rigs for this retarget operation.
   *
   * @evidence requirements/motion/retargeting-and-scale.md#motion-retarget-mapping-selection Lists the semantic correspondences required by this specific conversion.
   * @evidence specifications/performance-motion-and-staging/kinematics-contact-and-interaction.md#performance-kinematics-retarget-scale-contact Makes an incomplete semantic correspondence diagnosable before conversion.
   */
  requiredBones: AutoMovieHumanoidBone[];
}

/**
 * Input for {@link retargetHumanoidMotion}.
 *
 * @evidence requirements/motion/retargeting-and-scale.md#motion-retarget-mapping-selection Defines the caller-authoritative basis for one conversion.
 * @evidence specifications/performance-motion-and-staging/kinematics-contact-and-interaction.md#performance-kinematics-retarget-scale-contact Makes one target-rig conversion request reproducible.
 * @author Samchon
 */
export interface IAutoMovieHumanoidRetargetProps {
  /**
   * Clip authored on `source`.
   *
   * @evidence requirements/motion/retargeting-and-scale.md#motion-retarget-source-provenance Supplies the exact authored motion whose basis the conversion records.
   * @evidence specifications/performance-motion-and-staging/kinematics-contact-and-interaction.md#performance-kinematics-retarget-scale-contact Provides the authored performance evaluated by the conversion.
   */
  motion: IAutoMovieMotion;

  /**
   * Skeleton the clip was authored against.
   *
   * @evidence requirements/motion/retargeting-and-scale.md#motion-retarget-source-provenance Identifies the rig that gives the clip's clinical channels their source meaning.
   * @evidence specifications/performance-motion-and-staging/kinematics-contact-and-interaction.md#performance-kinematics-retarget-scale-contact Provides the source rig used to characterize the authored performance.
   */
  source: IAutoMovieSkeleton;

  /**
   * Skeleton the clip should play on.
   *
   * @evidence requirements/motion/retargeting-and-scale.md#motion-retarget-mapping-selection Names the destination rig selected for the authored motion.
   * @evidence specifications/performance-motion-and-staging/kinematics-contact-and-interaction.md#performance-kinematics-retarget-scale-contact Provides the target rig against which converted motion is solved.
   */
  target: IAutoMovieSkeleton;

  /**
   * Optional source profile binding carrying semantic slot -> node ids.
   *
   * @evidence requirements/motion/retargeting-and-scale.md#motion-retarget-mapping-selection Uses the caller's source correspondence instead of guessing concrete node names.
   * @evidence specifications/performance-motion-and-staging/kinematics-contact-and-interaction.md#performance-kinematics-retarget-scale-contact Characterizes source semantic slots before contact positions are measured.
   */
  sourceBinding?: IAutoMovieProfileBinding;

  /**
   * Optional target profile binding carrying semantic slot -> node ids.
   *
   * @evidence requirements/motion/retargeting-and-scale.md#motion-retarget-mapping-selection Uses the caller's target correspondence instead of name similarity.
   * @evidence specifications/performance-motion-and-staging/kinematics-contact-and-interaction.md#performance-kinematics-retarget-scale-contact Characterizes the target nodes that receive the clinical motion.
   */
  targetBinding?: IAutoMovieProfileBinding;

  /**
   * Optional source clinical axes; defaults to the humanoid table.
   *
   * @evidence requirements/motion/retargeting-and-scale.md#motion-retarget-source-provenance Preserves the source axis basis used to read authored joint angles.
   * @evidence specifications/performance-motion-and-staging/kinematics-contact-and-interaction.md#performance-kinematics-retarget-scale-contact Interprets source clinical angles in the authored rig basis.
   */
  sourceJointAxes?: Partial<Record<AutoMovieHumanoidBone, IAutoMovieJointAxes>>;

  /**
   * Optional target clinical axes; defaults to the humanoid table.
   *
   * @evidence requirements/motion/retargeting-and-scale.md#motion-retarget-mapping-selection Declares how clinical angles map into the chosen target joint basis.
   * @evidence specifications/performance-motion-and-staging/kinematics-contact-and-interaction.md#performance-kinematics-retarget-scale-contact Lowers the converted angles through the target's own characterized axes.
   */
  targetJointAxes?: Partial<Record<AutoMovieHumanoidBone, IAutoMovieJointAxes>>;

  /**
   * Optional source rest frames; defaults to the humanoid table.
   *
   * @evidence requirements/motion/retargeting-and-scale.md#motion-retarget-source-provenance Retains the source rest orientation used to measure the authored performance.
   * @evidence specifications/performance-motion-and-staging/kinematics-contact-and-interaction.md#performance-kinematics-retarget-scale-contact Reconstructs source effector positions in their declared rest basis.
   */
  sourceRestFrames?: Partial<
    Record<AutoMovieHumanoidBone, IAutoMovieRestFrame>
  >;

  /**
   * Optional target rest frames; defaults to the humanoid table.
   *
   * @evidence requirements/motion/retargeting-and-scale.md#motion-retarget-mapping-selection Declares the target rest basis in which converted clinical channels play.
   * @evidence specifications/performance-motion-and-staging/kinematics-contact-and-interaction.md#performance-kinematics-retarget-scale-contact Re-solves mapped contacts against the target's characterized rest frame.
   */
  targetRestFrames?: Partial<
    Record<AutoMovieHumanoidBone, IAutoMovieRestFrame>
  >;

  /**
   * Extra bones, such as a reach end effector, that must exist on both rigs.
   *
   * @evidence requirements/motion/retargeting-and-scale.md#motion-retarget-refusal Makes operation-specific semantic dependencies explicit and rejectable when absent.
   * @evidence specifications/performance-motion-and-staging/kinematics-contact-and-interaction.md#performance-kinematics-retarget-scale-contact Extends the structural compatibility check beyond the canonical minimum.
   */
  requiredBones?: readonly AutoMovieHumanoidBone[];

  /**
   * Explicit root translation scale; omitted means target height / source
   * height.
   *
   * @evidence requirements/motion/retargeting-and-scale.md#motion-retarget-proportion Allows an explicit, validated root correction instead of the measured height ratio.
   * @evidence specifications/performance-motion-and-staging/kinematics-contact-and-interaction.md#performance-kinematics-retarget-scale-contact Applies one scale consistently to root displacement and contact mapping.
   */
  rootScale?: number;

  /**
   * Contact policy for the contact-preserving pass. Omitted runs the pass with
   * humanoid legs and no declared hand contact.
   *
   * @evidence requirements/motion/retargeting-and-scale.md#motion-retarget-contact-preservation Declares which source contacts the target conversion must re-establish.
   * @evidence specifications/performance-motion-and-staging/kinematics-contact-and-interaction.md#performance-kinematics-retarget-scale-contact Defines the policy applied by the target contact re-solve.
   */
  contacts?: IAutoMovieRetargetContactProps;

  /**
   * Optional id for the retargeted clip.
   *
   * @evidence requirements/motion/retargeting-and-scale.md#motion-retarget-source-provenance Lets the caller assign the converted result's stable identity while preserving its source record.
   * @evidence specifications/performance-motion-and-staging/kinematics-contact-and-interaction.md#performance-kinematics-retarget-scale-contact Identifies the target clip produced by this characterized conversion.
   */
  id?: string;
}

/**
 * Result of retargeting. `motion` and `characterization` are present only when
 * every structural, scale, and target-ROM check passed.
 *
 * @evidence requirements/motion/retargeting-and-scale.md#motion-retarget-refusal Separates validation findings from nullable artifacts so an invalid conversion cannot masquerade as motion.
 * @evidence specifications/performance-motion-and-staging/kinematics-contact-and-interaction.md#performance-kinematics-retarget-scale-contact Gates both returned artifacts on the conversion's validated success.
 * @author Samchon
 */
export interface IAutoMovieHumanoidRetargetResult {
  /**
   * Validation envelope containing field-located failures.
   *
   * @evidence requirements/motion/retargeting-and-scale.md#motion-retarget-refusal Reports field-located causes when the target conversion cannot be accepted.
   * @evidence specifications/performance-motion-and-staging/kinematics-contact-and-interaction.md#performance-kinematics-retarget-scale-contact Carries the conversion verdict and its field-located findings.
   */
  validation: IAutoMovieValidation;

  /**
   * Retargeted clip, or `null` when validation failed.
   *
   * @evidence requirements/motion/retargeting-and-scale.md#motion-retarget-refusal Withholds target motion whenever conversion validation fails.
   * @evidence specifications/performance-motion-and-staging/kinematics-contact-and-interaction.md#performance-kinematics-retarget-scale-contact Carries the usable target performance produced by the accepted conversion.
   */
  motion: IAutoMovieMotion | null;

  /**
   * The rig characterization required to play the clip on the target.
   *
   * @evidence requirements/motion/retargeting-and-scale.md#motion-retarget-source-provenance Preserves the resolved playback basis beside the converted clip.
   * @evidence specifications/performance-motion-and-staging/kinematics-contact-and-interaction.md#performance-kinematics-retarget-scale-contact Carries the playback basis that reproduces the accepted target conversion.
   */
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
 * A verbatim angle copy is exact only for a **proportional** target. When the
 * rigs differ in proportion, {@link preserveRetargetContacts} re-pins each
 * contacting limb onto the source contact mapped through the same `rootScale`,
 * so a planted foot lands where the performance put it instead of sliding. The
 * pass runs by default, corrects the clip at its authored keyframe times, and
 * reports a residual it could not reach under the target's ROM as a `warning`,
 * the returned `validation` still succeeds.
 *
 * @evidence requirements/motion/retargeting-and-scale.md#motion-retarget-proportion Derives target root travel from the characterized rig ratio.
 * @evidence requirements/motion/retargeting-and-scale.md#motion-retarget-refusal Rejects a source clip whose clock, pose, expression, or source-rig ROM is already invalid before target conversion.
 * @evidence requirements/asset-authoring/rig-and-state.md#asset-motion-retargeting Validates explicit source and target semantic mappings, rig bases, root scale, ROM, and contact compatibility before returning target motion.
 * @evidence specifications/performance-motion-and-staging/kinematics-contact-and-interaction.md#performance-kinematics-retarget-scale-contact Gates target clip production on source-rig validation before scaling, contact re-solving, and target validation.
 * @evidence specifications/asset-and-representation/rig-deformation-and-state.md#asset-spec-retarget-compatibility Returns the mapped basis and structural verdict that characterize the accepted source-to-target rig conversion.
 * @author Samchon
 */
export const retargetHumanoidMotion = (
  props: IAutoMovieHumanoidRetargetProps,
): IAutoMovieHumanoidRetargetResult => {
  const collector = new ViolationCollector();
  const requiredBones = collectRequiredBones(props);

  const sourceValidation = validateMotion({
    motion: props.motion,
    skeleton: props.source,
  });
  const sourceFindings = sourceValidation.success
    ? (sourceValidation.warnings ?? [])
    : sourceValidation.violations;
  collector.items.push(
    ...sourceFindings.map((violation) => ({
      ...violation,
      path: violation.path.replace("$input", "$input.motion"),
    })),
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

  const sourceSpan = restVerticalSpan(props.source);
  const targetSpan = restVerticalSpan(props.target);
  const sourceHeight = sourceSpan.height;
  const targetHeight = targetSpan.height;
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

  // Resolved once: the characterization, the contact pass's source FK, and the
  // contact pass's target FK must all read the clip through the same tables.
  const sourceJointAxes = props.sourceJointAxes ?? HUMANOID_JOINT_AXES;
  const sourceRestFrames = props.sourceRestFrames ?? HUMANOID_REST_FRAME;
  const targetJointAxes = props.targetJointAxes ?? HUMANOID_JOINT_AXES;
  const targetRestFrames = props.targetRestFrames ?? HUMANOID_REST_FRAME;

  const source = characterizeRig({
    skeleton: props.source,
    binding: props.sourceBinding,
    height: sourceHeight,
    jointAxes: sourceJointAxes,
    restFrames: sourceRestFrames,
  });
  const target = characterizeRig({
    skeleton: props.target,
    binding: props.targetBinding,
    height: targetHeight,
    jointAxes: targetJointAxes,
    restFrames: targetRestFrames,
  });
  const scaled = retargetMotion(
    props.motion,
    props.target.id,
    rootScale,
    props.id,
  );

  const contactsEnabled = props.contacts?.enabled ?? true;
  const motion = contactsEnabled
    ? preserveRetargetContacts({
        source: props.source,
        target: props.target,
        sourceMotion: props.motion,
        retargeted: scaled,
        rootScale,
        sourceFloor: sourceSpan.floor,
        sourceJointAxes,
        sourceRestFrames,
        targetJointAxes,
        targetRestFrames,
        contacts: props.contacts,
        collector,
      })
    : scaled;

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
    validation: collector.toValidation(),
    motion,
    characterization: {
      source,
      target,
      rootScale,
      facing: "preserve-authored",
      romPolicy: "target-override-then-default-humanoid",
      contactPolicy: contactsEnabled
        ? "pin-source-contacts"
        : "carry-joint-angles",
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
  return [...bones].sort(compareCodeUnits);
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

/**
 * The rig's rest-pose vertical extent: `height` drives the root-motion scale,
 * `floor` is the world Y its lowest bone sits at, the ground plane the contact
 * pass judges stance against, so a rig authored with its feet above the origin
 * is still detected as standing on something.
 */
const restVerticalSpan = (
  skeleton: IAutoMovieSkeleton,
): { floor: number; height: number } => {
  const resolved = resolvePose(
    { skeleton: skeleton.id, root: null, joints: [] },
    skeleton,
  );
  if (resolved.length === 0) return { floor: 0, height: 0 };
  let minY = Infinity;
  let maxY = -Infinity;
  for (const bone of resolved) {
    minY = Math.min(minY, bone.worldPosition.y);
    maxY = Math.max(maxY, bone.worldPosition.y);
  }
  return { floor: minY, height: maxY - minY };
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
