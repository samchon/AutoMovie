import {
  toValidation,
  validateModel as validateEngineModel,
  validateMotion as validateEngineMotion,
  validatePose as validateEnginePose,
} from "@automovie/engine";
import {
  IAutoMovieConstraintViolation,
  IAutoMovieModel,
  IAutoMoviePose,
  IAutoMovieScene,
  IAutoMovieSequence,
  IAutoMovieShot,
  IAutoMovieSkeleton,
  IAutoMovieValidation,
} from "@automovie/interface";

import { toEngineMotion } from "../convert";
import {
  IAutoMovieMcpGeometryModel,
  IAutoMovieMcpMotion,
  IAutoMovieValidateOutput,
} from "../dto";
import {
  validateSceneArtifact,
  validateSequenceArtifact,
  validateShotArtifact,
} from "../validators/artifacts";
import {
  validateArrayArtifact,
  validateNonEmptyId,
  validateObjectArtifact,
  validateTransformArtifact,
} from "../validators/primitives";

/**
 * The standalone `validate*` tools — thin dispatch onto the engine validators
 * and the shared MCP artifact validators. The MCP contract lives on the
 * {@link AutoMovieApplication} facade; this service owns the execution.
 */
export class ValidationService {
  public validatePose(props: {
    pose: IAutoMoviePose;
    skeleton: IAutoMovieSkeleton;
  }): IAutoMovieValidateOutput {
    const shape = validateMcpPoseShape(props.pose);
    if (shape.success === false) return { validation: shape };
    return {
      validation: validateEnginePose({
        pose: props.pose,
        skeleton: props.skeleton,
      }).toValidation(),
    };
  }

  public validateMotion(props: {
    motion: IAutoMovieMcpMotion;
    skeleton: IAutoMovieSkeleton;
  }): IAutoMovieValidateOutput {
    const shape = validateMcpMotionShape(props.motion);
    if (shape.success === false) return { validation: shape };
    return {
      validation: validateEngineMotion({
        motion: toEngineMotion(props.motion),
        skeleton: props.skeleton,
      }),
    };
  }

  public validateModel(props: {
    model: IAutoMovieModel;
  }): IAutoMovieValidateOutput {
    const shape = validateMcpModelShape(props.model);
    if (shape.success === false) return { validation: shape };
    return { validation: validateEngineModel({ model: props.model }) };
  }

  public validateScene(props: {
    scene: IAutoMovieScene;
    models: IAutoMovieMcpGeometryModel[];
  }): IAutoMovieValidateOutput {
    return { validation: validateSceneArtifact(props.scene, props.models) };
  }

  public validateShot(props: {
    shot: IAutoMovieShot;
    scene: IAutoMovieScene;
    motions?: Record<string, IAutoMovieMcpMotion>;
  }): IAutoMovieValidateOutput {
    return {
      validation: validateShotArtifact(props.shot, props.scene, props.motions),
    };
  }

  public validateSequence(props: {
    sequence: IAutoMovieSequence;
    shots: IAutoMovieShot[];
  }): IAutoMovieValidateOutput {
    return {
      validation: validateSequenceArtifact(props.sequence, props.shots),
    };
  }
}

const validateMcpPoseShape = (
  pose: IAutoMoviePose | unknown,
  path = "$input",
): IAutoMovieValidation => {
  const violations: IAutoMovieConstraintViolation[] = [];
  appendMcpPoseShape(violations, pose, path);
  return toValidation(violations);
};

const appendMcpPoseShape = (
  violations: IAutoMovieConstraintViolation[],
  pose: IAutoMoviePose | unknown,
  path: string,
): void => {
  if (!validateObjectArtifact(pose, path, "pose", violations)) return;
  validateArrayArtifact(
    (pose as Partial<IAutoMoviePose>).joints,
    `${path}.joints`,
    "pose joints",
    violations,
  );
  const root = (pose as Partial<IAutoMoviePose>).root;
  if (root !== null)
    validateTransformArtifact(root, `${path}.root`, "pose root", violations);
};

const validateMcpMotionShape = (
  motion: IAutoMovieMcpMotion,
): IAutoMovieValidation => {
  const violations: IAutoMovieConstraintViolation[] = [];
  if (!validateObjectArtifact(motion, "$input", "motion", violations))
    return toValidation(violations);
  const shape = motion as Partial<IAutoMovieMcpMotion>;
  validateNonEmptyId(shape.id, "$input.id", "motion id", violations);
  const keyframes = shape.keyframes;
  if (
    validateArrayArtifact(
      keyframes,
      "$input.keyframes",
      "motion keyframes",
      violations,
    )
  )
    keyframes.forEach((keyframe, index) => {
      const path = `$input.keyframes[${index}]`;
      if (
        !validateObjectArtifact(keyframe, path, "motion keyframe", violations)
      )
        return;
      appendMcpPoseShape(violations, keyframe.pose, `${path}.pose`);
    });
  return toValidation(violations);
};

const validateMcpModelShape = (
  model: IAutoMovieModel,
): IAutoMovieValidation => {
  const violations: IAutoMovieConstraintViolation[] = [];
  validateArrayArtifact(
    (model as Partial<IAutoMovieModel>).materials,
    "$input.materials",
    "model materials",
    violations,
  );
  validateArrayArtifact(
    (model as Partial<IAutoMovieModel>).parts,
    "$input.parts",
    "model parts",
    violations,
  );
  const skeleton = (model as Partial<IAutoMovieModel>).skeleton;
  if (skeleton !== null && skeleton !== undefined)
    validateArrayArtifact(
      skeleton.bones,
      "$input.skeleton.bones",
      "skeleton bones",
      violations,
    );
  const affordances = (model as Partial<IAutoMovieModel>).affordances;
  if (affordances !== null && affordances !== undefined)
    validateArrayArtifact(
      affordances,
      "$input.affordances",
      "model affordances",
      violations,
    );
  return toValidation(violations);
};
