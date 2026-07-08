import {
  toValidation,
  validateModel as validateEngineModel,
  validateMotion as validateEngineMotion,
  validatePose as validateEnginePose,
} from "@automovie/engine";
import {
  IAutoMovieConstraintViolation,
  IAutoMovieExpression,
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
  validateColorArtifact,
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
      appendMcpExpressionShape(
        violations,
        keyframe.expression,
        `${path}.expression`,
      );
    });
  return toValidation(violations);
};

const appendMcpExpressionShape = (
  violations: IAutoMovieConstraintViolation[],
  expression: IAutoMovieExpression | unknown,
  path: string,
): void => {
  if (expression === null) return;
  if (
    !validateObjectArtifact(expression, path, "keyframe expression", violations)
  )
    return;
  const blendshapes = (expression as Partial<IAutoMovieExpression>).blendshapes;
  if (blendshapes !== undefined)
    validateArrayArtifact(
      blendshapes,
      `${path}.blendshapes`,
      "expression blendshapes",
      violations,
    );
};

const validateMcpModelShape = (
  model: IAutoMovieModel,
): IAutoMovieValidation => {
  const violations: IAutoMovieConstraintViolation[] = [];
  if (!validateObjectArtifact(model, "$input", "model", violations))
    return toValidation(violations);
  const shape = model as Partial<IAutoMovieModel>;
  validateNonEmptyId(shape.id, "$input.id", "model id", violations);
  if (shape.asset !== null)
    validateNonEmptyId(
      shape.asset,
      "$input.asset",
      "model asset id",
      violations,
    );
  const materials = shape.materials;
  if (
    validateArrayArtifact(
      materials,
      "$input.materials",
      "model materials",
      violations,
    )
  )
    materials.forEach((material, index) => {
      const path = `$input.materials[${index}]`;
      if (!validateObjectArtifact(material, path, "model material", violations))
        return;
      validateNonEmptyId(material.id, `${path}.id`, "material id", violations);
      if (material.baseColorTexture !== null)
        validateNonEmptyId(
          material.baseColorTexture,
          `${path}.baseColorTexture`,
          "base color texture id",
          violations,
        );
      validateColorArtifact(
        material.baseColor,
        `${path}.baseColor`,
        violations,
      );
      if (material.emissive !== null)
        validateColorArtifact(
          material.emissive,
          `${path}.emissive`,
          violations,
        );
    });
  const parts = shape.parts;
  if (validateArrayArtifact(parts, "$input.parts", "model parts", violations))
    parts.forEach((part, index) => {
      const path = `$input.parts[${index}]`;
      if (!validateObjectArtifact(part, path, "model part", violations)) return;
      validateNonEmptyId(part.id, `${path}.id`, "model part id", violations);
      if (part.material !== null)
        validateNonEmptyId(
          part.material,
          `${path}.material`,
          "model part material id",
          violations,
        );
      validateObjectArtifact(
        part.geometry,
        `${path}.geometry`,
        "model part geometry",
        violations,
      );
      if (part.transform !== null)
        validateTransformArtifact(
          part.transform,
          `${path}.transform`,
          "model part transform",
          violations,
        );
    });
  const skeleton = shape.skeleton;
  if (
    skeleton !== null &&
    validateObjectArtifact(skeleton, "$input.skeleton", "skeleton", violations)
  ) {
    validateNonEmptyId(
      skeleton.id,
      "$input.skeleton.id",
      "skeleton id",
      violations,
    );
    validateArrayArtifact(
      skeleton.bones,
      "$input.skeleton.bones",
      "skeleton bones",
      violations,
    );
  }
  const affordances = shape.affordances;
  if (affordances !== null && affordances !== undefined)
    validateArrayArtifact(
      affordances,
      "$input.affordances",
      "model affordances",
      violations,
    );
  return toValidation(violations);
};
