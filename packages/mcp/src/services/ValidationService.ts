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
import { validateArrayArtifact } from "../validators/primitives";

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

const validateMcpPoseShape = (pose: IAutoMoviePose): IAutoMovieValidation => {
  const violations: IAutoMovieConstraintViolation[] = [];
  validateArrayArtifact(
    (pose as Partial<IAutoMoviePose>).joints,
    "$input.joints",
    "pose joints",
    violations,
  );
  return toValidation(violations);
};

const validateMcpMotionShape = (
  motion: IAutoMovieMcpMotion,
): IAutoMovieValidation => {
  const violations: IAutoMovieConstraintViolation[] = [];
  validateArrayArtifact(
    (motion as Partial<IAutoMovieMcpMotion>).keyframes,
    "$input.keyframes",
    "motion keyframes",
    violations,
  );
  return toValidation(violations);
};
