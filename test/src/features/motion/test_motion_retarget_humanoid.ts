import {
  HUMANOID_JOINT_AXES,
  HUMANOID_PROFILE,
  HUMANOID_REST_FRAME,
  bindProfileGaits,
  gestureMotion,
  reachPose,
  resolvePose,
  retargetHumanoidMotion,
  sampleMotion,
  travelMotion,
} from "@automovie/engine";
import {
  AutoMovieHumanoidBone,
  IAutoMovieBone,
  IAutoMovieJointConstraint,
  IAutoMovieMotion,
  IAutoMovieProfileBinding,
  IAutoMovieSkeleton,
  IAutoMovieTransform,
  IAutoMovieVector3,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { keyframe } from "../internal/fixtures";
import { hasViolation, nclose, vclose } from "../internal/predicates";

const restAt = (x: number, y: number, z: number): IAutoMovieTransform => ({
  translation: { x, y, z },
  rotation: { x: 0, y: 0, z: 0, w: 1 },
  scale: { x: 1, y: 1, z: 1 },
});

const bone = (
  name: AutoMovieHumanoidBone,
  parent: AutoMovieHumanoidBone | null,
  rest: IAutoMovieTransform,
): IAutoMovieBone => ({ bone: name, parent, rest, constraint: null });

const sourceSkeleton = (): IAutoMovieSkeleton => ({
  id: "stickman-source",
  bones: [
    bone("hips", null, restAt(0, 0.92, 0)),
    bone("spine", "hips", restAt(0, 0.2, 0)),
    bone("chest", "spine", restAt(0, 0.22, 0)),
    bone("neck", "chest", restAt(0, 0.12, 0)),
    bone("head", "neck", restAt(0, 0.12, 0)),
    bone("leftUpperArm", "chest", restAt(0.17, 0.14, 0)),
    bone("leftLowerArm", "leftUpperArm", restAt(0.29, 0, 0)),
    bone("leftHand", "leftLowerArm", restAt(0.26, 0, 0)),
    bone("rightUpperArm", "chest", restAt(-0.17, 0.14, 0)),
    bone("rightLowerArm", "rightUpperArm", restAt(-0.29, 0, 0)),
    bone("rightHand", "rightLowerArm", restAt(-0.26, 0, 0)),
    bone("leftUpperLeg", "hips", restAt(0.1, -0.12, 0)),
    bone("leftLowerLeg", "leftUpperLeg", restAt(0, -0.44, 0)),
    bone("leftFoot", "leftLowerLeg", restAt(0, -0.08, 0.1)),
    bone("rightUpperLeg", "hips", restAt(-0.1, -0.12, 0)),
    bone("rightLowerLeg", "rightUpperLeg", restAt(0, -0.44, 0)),
    bone("rightFoot", "rightLowerLeg", restAt(0, -0.08, 0.1)),
  ],
});

const scaleSkeleton = (
  skeleton: IAutoMovieSkeleton,
  id: string,
  factor: number,
): IAutoMovieSkeleton => ({
  id,
  bones: skeleton.bones.map((b) => ({
    ...b,
    rest: {
      ...b.rest,
      translation: {
        x: b.rest.translation.x * factor,
        y: b.rest.translation.y * factor,
        z: b.rest.translation.z * factor,
      },
    },
  })),
});

const elbowReachConstraint: IAutoMovieJointConstraint = {
  flexion: { min: 0, max: 150 },
  abduction: { min: -90, max: 90 },
  twist: { min: -90, max: 90 },
};

const withReachElbowConstraint = (
  skeleton: IAutoMovieSkeleton,
): IAutoMovieSkeleton => ({
  ...skeleton,
  bones: skeleton.bones.map((b) =>
    b.bone === "rightLowerArm" ? { ...b, constraint: elbowReachConstraint } : b,
  ),
});

const rootless = (skeleton: IAutoMovieSkeleton): IAutoMovieSkeleton => ({
  ...skeleton,
  bones: skeleton.bones.map((b) =>
    b.bone === "hips" ? { ...b, parent: "spine" } : b,
  ),
});

const malformedTarget = (skeleton: IAutoMovieSkeleton): IAutoMovieSkeleton => ({
  ...skeleton,
  id: "malformed-target",
  bones: [
    ...skeleton.bones
      .filter((b) => b.bone !== "rightHand")
      .map((b) =>
        b.bone === "hips"
          ? { ...b, parent: "spine" as AutoMovieHumanoidBone }
          : b.bone === "rightUpperArm"
            ? { ...b, parent: "jaw" as AutoMovieHumanoidBone }
            : b,
      ),
    { ...skeleton.bones[0]!, parent: "spine" },
  ],
});

const bindingFor = (
  skeleton: IAutoMovieSkeleton,
  prefix: string,
): IAutoMovieProfileBinding => ({
  profile: "humanoid",
  root: `${prefix}:root`,
  instanceName: null,
  boneMap: Object.fromEntries(
    skeleton.bones.map((b) => [b.bone, `${prefix}:${b.bone}`]),
  ),
});

const world = (
  skeleton: IAutoMovieSkeleton,
  motion: IAutoMovieMotion,
  time: number,
  boneName: AutoMovieHumanoidBone,
): IAutoMovieVector3 =>
  resolvePose(
    sampleMotion(motion, time).pose,
    skeleton,
    HUMANOID_JOINT_AXES,
    HUMANOID_REST_FRAME,
  ).find((b) => b.bone === boneName)!.worldPosition;

/**
 * `retargetHumanoidMotion` characterizes source/target humanoid rigs and moves
 * clinical stickman-authored clips onto an imported humanoid skeleton.
 *
 * Scenarios:
 *
 * 1. A travelled humanoid walk retargets from a stickman to a twice-tall imported
 *    rig, preserving authored facing and scaling root translation by the
 *    target/source rest-height ratio.
 * 2. A clinical wave resolves on the imported rig with the returned
 *    rest-frame/axis tables, so the right hand rises instead of mirroring
 *    down.
 * 3. A reach pose retargets onto the imported rig and the target hand lands at the
 *    scaled source hand position. It carries no elbow abduction for the default
 *    humanoid ROM to reject, because the arm solve keeps the elbow on its own
 *    hinge (#1345); it used to need the target to widen that axis.
 * 4. Missing required bones and invalid explicit root scale return field-located
 *    validation failures instead of throwing.
 */
export const test_motion_retarget_humanoid = (): void => {
  const source = sourceSkeleton();
  const target = scaleSkeleton(source, "imported-avatar", 2);
  const targetBinding = bindingFor(target, "vrm");

  // 1. walk/travel root motion scales, facing is preserved by policy.
  const walk = bindProfileGaits(HUMANOID_PROFILE, source.id, 4).walk!;
  const travelled = travelMotion("walk-forward", walk, 1, {
    x: 0,
    y: 0,
    z: 1,
  });
  const walkResult = retargetHumanoidMotion({
    motion: travelled,
    source,
    target,
    targetBinding,
  });
  TestValidator.equals("walk retarget succeeds", walkResult.validation, {
    success: true,
  });
  if (walkResult.motion === null || walkResult.characterization === null)
    throw new Error("walk retarget unexpectedly failed");

  TestValidator.equals(
    "clip targets imported skeleton",
    walkResult.motion.skeleton,
    target.id,
  );
  TestValidator.equals(
    "keyframe poses target imported skeleton",
    walkResult.motion.keyframes.every((kf) => kf.pose.skeleton === target.id),
    true,
  );
  TestValidator.predicate(
    "root translation scales by target/source height",
    nclose(
      walkResult.motion.keyframes.at(-1)!.pose.root!.translation.z,
      travelled.keyframes.at(-1)!.pose.root!.translation.z * 2,
    ),
  );
  TestValidator.equals(
    "target binding is carried in the characterization",
    walkResult.characterization.target.boneMap.rightUpperArm,
    "vrm:rightUpperArm",
  );
  TestValidator.equals(
    "facing policy preserves authored root rotations",
    walkResult.characterization.facing,
    "preserve-authored",
  );
  TestValidator.equals(
    "ROM policy is target override then default humanoid",
    walkResult.characterization.romPolicy,
    "target-override-then-default-humanoid",
  );

  const namedWave = retargetHumanoidMotion({
    motion: gestureMotion("named-wave", source.id, "wave", 1)!,
    source,
    target,
    sourceBinding: bindingFor(source, "src"),
    sourceJointAxes: HUMANOID_JOINT_AXES,
    targetJointAxes: HUMANOID_JOINT_AXES,
    sourceRestFrames: HUMANOID_REST_FRAME,
    targetRestFrames: HUMANOID_REST_FRAME,
    rootScale: 2,
    id: "imported-wave",
  });
  TestValidator.equals(
    "explicit retarget options succeed",
    namedWave.validation,
    {
      success: true,
    },
  );
  if (namedWave.motion === null || namedWave.characterization === null)
    throw new Error("named wave retarget unexpectedly failed");
  TestValidator.equals(
    "explicit id is used",
    namedWave.motion.id,
    "imported-wave",
  );
  TestValidator.equals(
    "source binding is carried in the characterization",
    namedWave.characterization.source.boneMap.rightUpperArm,
    "src:rightUpperArm",
  );

  // 2. wave: clinical right-arm abduction rises on the imported rig.
  const wave = gestureMotion("wave", source.id, "wave", 1)!;
  const waveResult = retargetHumanoidMotion({
    motion: wave,
    source,
    target,
    requiredBones: ["rightHand"],
  });
  TestValidator.equals("wave retarget succeeds", waveResult.validation, {
    success: true,
  });
  if (waveResult.motion === null || waveResult.characterization === null)
    throw new Error("wave retarget unexpectedly failed");

  const wavePose = sampleMotion(waveResult.motion, 0.4).pose;
  const raised = resolvePose(
    wavePose,
    target,
    waveResult.characterization.target.jointAxes,
    waveResult.characterization.target.restFrames,
  );
  const shoulderY = raised.find((b) => b.bone === "rightUpperArm")!
    .worldPosition.y;
  const handY = raised.find((b) => b.bone === "rightHand")!.worldPosition.y;
  TestValidator.predicate(
    "clinical wave raises the imported right hand",
    handY > shoulderY + 0.45,
  );

  // 3. reach: a proportional imported rig lands at the scaled source hand point.
  const reach = reachPose(
    source,
    "right",
    { x: -0.5, y: 1.28, z: 0.25 },
    HUMANOID_REST_FRAME,
  );
  if (reach === null) throw new Error("expected source reach pose");
  const reachMotion: IAutoMovieMotion = {
    id: "reach",
    skeleton: source.id,
    duration: 1,
    loop: false,
    keyframes: [
      keyframe(0, { skeleton: source.id, root: null, joints: [] }),
      keyframe(1, reach),
    ],
  };
  const reachDefault = retargetHumanoidMotion({
    motion: reachMotion,
    source,
    target,
    requiredBones: ["rightHand"],
  });
  // Since #1345 the source reach no longer swings the elbow off its hinge, so
  // the pose that retargets carries NO elbow abduction to reject. The contact
  // pass cannot reintroduce it either: it pins humanoid legs by default and no
  // hand contact was declared, so the arm chain is carried through the
  // characterization rather than re-solved.
  //
  // Scoped deliberately to that one axis. This scenario's oracle is the
  // proportional landing below, and asserting the whole retarget clean here
  // would pin far more than the elbow fact this line exists to state.
  TestValidator.predicate(
    "the retargeted reach carries no elbow abduction to reject",
    !hasViolation(
      reachDefault.validation,
      "rom",
      "$input.keyframes[1].pose.joints[1].abduction",
    ),
  );

  const reachTarget = withReachElbowConstraint(target);
  const reachResult = retargetHumanoidMotion({
    motion: reachMotion,
    source,
    target: reachTarget,
    requiredBones: ["rightHand"],
  });
  TestValidator.equals("reach retarget succeeds", reachResult.validation, {
    success: true,
  });
  if (reachResult.motion === null || reachResult.characterization === null)
    throw new Error("reach retarget unexpectedly failed");

  const sourceHand = world(source, reachMotion, 1, "rightHand");
  const targetHand = resolvePose(
    sampleMotion(reachResult.motion, 1).pose,
    reachTarget,
    reachResult.characterization.target.jointAxes,
    reachResult.characterization.target.restFrames,
  ).find((b) => b.bone === "rightHand")!.worldPosition;
  TestValidator.predicate(
    "reach lands proportionally on the imported rig",
    vclose(targetHand, {
      x: sourceHand.x * 2,
      y: sourceHand.y * 2,
      z: sourceHand.z * 2,
    }),
  );

  // 4. validation failures stay field-located.
  const noHand = {
    ...target,
    id: "missing-hand",
    bones: target.bones.filter((b) => b.bone !== "rightHand"),
  };
  const missing = retargetHumanoidMotion({
    motion: wave,
    source,
    target: noHand,
    requiredBones: ["rightHand"],
  });
  TestValidator.predicate(
    "missing required bone reports the target field",
    hasViolation(
      missing.validation,
      "type",
      '$input.target.bones["rightHand"]',
    ),
  );

  const invalidScale = retargetHumanoidMotion({
    motion: wave,
    source,
    target,
    rootScale: 0,
  });
  TestValidator.predicate(
    "invalid explicit root scale reports rootScale",
    hasViolation(invalidScale.validation, "range", "$input.rootScale"),
  );

  const srcBinding = bindingFor(source, "src");
  const tgtBinding = bindingFor(target, "bad");
  const malformed = retargetHumanoidMotion({
    motion: { ...wave, skeleton: "wrong-source" },
    source: rootless(source),
    target: malformedTarget(target),
    sourceBinding: {
      ...srcBinding,
      boneMap: { ...srcBinding.boneMap, hips: "" },
    },
    targetBinding: {
      ...tgtBinding,
      boneMap: { ...tgtBinding.boneMap, rightHand: "" },
    },
    sourceJointAxes: {
      rightUpperArm: {
        flexion: { x: Number.NaN, y: 0, z: 0 },
        abduction: { x: 0, y: 0, z: 1 },
        twist: { x: 1, y: 0, z: 0 },
      },
    },
    targetJointAxes: {
      leftUpperArm: {
        flexion: { x: 0, y: 1, z: 0 },
        abduction: { x: 0, y: 1, z: 1 },
        twist: { x: 1, y: 0, z: 0 },
      },
      rightUpperArm: {
        flexion: { x: 0, y: 1, z: 0 },
        abduction: { x: 0, y: 0, z: Infinity },
        twist: { x: 1, y: 0, z: 0 },
      },
    },
    sourceRestFrames: {
      rightUpperArm: { abduction: { sign: 0, neutral: 90 } },
    } as any,
    targetRestFrames: {
      rightUpperArm: { abduction: { sign: -1, neutral: Number.NaN } },
    },
    requiredBones: ["rightHand"],
  });
  TestValidator.predicate(
    "malformed retarget reports the source skeleton id field",
    hasViolation(malformed.validation, "type", "$input.motion.skeleton"),
  );
  TestValidator.predicate(
    "rootless source reports automatic scale failure",
    hasViolation(malformed.validation, "range", "$input.source.scale"),
  );
  TestValidator.predicate(
    "rootless target reports automatic scale failure",
    hasViolation(malformed.validation, "range", "$input.target.scale"),
  );
  TestValidator.predicate(
    "source binding reports blank bone map entry",
    hasViolation(
      malformed.validation,
      "type",
      "$input.sourceBinding.boneMap.hips",
    ),
  );
  TestValidator.predicate(
    "target binding reports blank bone map entry",
    hasViolation(
      malformed.validation,
      "type",
      "$input.targetBinding.boneMap.rightHand",
    ),
  );
  TestValidator.predicate(
    "source axes report non-finite component",
    hasViolation(
      malformed.validation,
      "range",
      "$input.sourceJointAxes.rightUpperArm.flexion.x",
    ),
  );
  TestValidator.predicate(
    "target axes report non-finite component",
    hasViolation(
      malformed.validation,
      "range",
      "$input.targetJointAxes.rightUpperArm.abduction.z",
    ),
  );
  TestValidator.predicate(
    "target axes report non-orthogonal basis",
    hasViolation(
      malformed.validation,
      "range",
      "$input.targetJointAxes.leftUpperArm.abduction",
    ),
  );
  TestValidator.predicate(
    "source rest frame reports bad sign",
    hasViolation(
      malformed.validation,
      "type",
      "$input.sourceRestFrames.rightUpperArm.abduction.sign",
    ),
  );
  TestValidator.predicate(
    "target rest frame reports bad neutral",
    hasViolation(
      malformed.validation,
      "range",
      "$input.targetRestFrames.rightUpperArm.abduction.neutral",
    ),
  );
};
