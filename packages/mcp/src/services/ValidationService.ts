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
  validateVectorArtifact,
} from "../validators/primitives";

const JOINT_CONSTRAINT_AXES = ["flexion", "abduction", "twist"] as const;

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
    const requestRoot = validateValidationRequestRoot(props);
    if (requestRoot !== null) return { validation: requestRoot };
    const violations: IAutoMovieConstraintViolation[] = [];
    appendMcpPoseShape(violations, props.pose, "$input");
    appendMcpSkeletonShape(violations, props.skeleton, "$skeleton");
    const shape = toValidation(violations);
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
    const requestRoot = validateValidationRequestRoot(props);
    if (requestRoot !== null) return { validation: requestRoot };
    const violations: IAutoMovieConstraintViolation[] = [];
    appendMcpMotionShape(violations, props.motion);
    appendMcpSkeletonShape(violations, props.skeleton, "$skeleton");
    const shape = toValidation(violations);
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
    const requestRoot = validateValidationRequestRoot(props);
    if (requestRoot !== null) return { validation: requestRoot };
    const shape = validateMcpModelShape(props.model);
    if (shape.success === false) return { validation: shape };
    return { validation: validateEngineModel({ model: props.model }) };
  }

  public validateScene(props: {
    scene: IAutoMovieScene;
    models: IAutoMovieMcpGeometryModel[];
  }): IAutoMovieValidateOutput {
    const requestRoot = validateValidationRequestRoot(props);
    if (requestRoot !== null) return { validation: requestRoot };
    return { validation: validateSceneArtifact(props.scene, props.models) };
  }

  public validateShot(props: {
    shot: IAutoMovieShot;
    scene: IAutoMovieScene;
    motions?: Record<string, IAutoMovieMcpMotion>;
  }): IAutoMovieValidateOutput {
    const requestRoot = validateValidationRequestRoot(props);
    if (requestRoot !== null) return { validation: requestRoot };
    return {
      validation: validateShotArtifact(props.shot, props.scene, props.motions),
    };
  }

  public validateSequence(props: {
    sequence: IAutoMovieSequence;
    shots: IAutoMovieShot[];
  }): IAutoMovieValidateOutput {
    const requestRoot = validateValidationRequestRoot(props);
    if (requestRoot !== null) return { validation: requestRoot };
    return {
      validation: validateSequenceArtifact(props.sequence, props.shots),
    };
  }
}

const validateValidationRequestRoot = (
  props: unknown,
): IAutoMovieValidation | null => {
  const violations: IAutoMovieConstraintViolation[] = [];
  if (validateObjectArtifact(props, "$input", "validation request", violations))
    return null;
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

const appendMcpMotionShape = (
  violations: IAutoMovieConstraintViolation[],
  motion: IAutoMovieMcpMotion | unknown,
): void => {
  if (!validateObjectArtifact(motion, "$input", "motion", violations)) return;
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
      appendMcpBezierShape(violations, keyframe.bezier, `${path}.bezier`);
    });
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

const appendMcpBezierShape = (
  violations: IAutoMovieConstraintViolation[],
  bezier: unknown,
  path: string,
): void => {
  if (bezier === null) return;
  validateObjectArtifact(bezier, path, "motion keyframe bezier", violations);
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
      const geometry = part.geometry;
      if (
        validateObjectArtifact(
          geometry,
          `${path}.geometry`,
          "model part geometry",
          violations,
        )
      ) {
        if (geometry.type === "primitive")
          validateObjectArtifact(
            geometry.shape,
            `${path}.geometry.shape`,
            "model part primitive shape",
            violations,
          );
        else if (geometry.type === "mesh") {
          const mesh = geometry.mesh;
          if (
            validateObjectArtifact(
              mesh,
              `${path}.geometry.mesh`,
              "model part mesh",
              violations,
            )
          ) {
            validateArrayArtifact(
              mesh.positions,
              `${path}.geometry.mesh.positions`,
              "mesh positions",
              violations,
            );
            for (const buffer of ["normals", "uvs", "indices"] as const) {
              const values = mesh[buffer];
              if (values !== null)
                validateArrayArtifact(
                  values,
                  `${path}.geometry.mesh.${buffer}`,
                  `mesh ${buffer}`,
                  violations,
                );
            }
            const skin = mesh.skin;
            if (
              skin !== null &&
              validateObjectArtifact(
                skin,
                `${path}.geometry.mesh.skin`,
                "mesh skin",
                violations,
              )
            )
              for (const buffer of [
                "joints",
                "boneIndices",
                "weights",
              ] as const)
                validateArrayArtifact(
                  skin[buffer],
                  `${path}.geometry.mesh.skin.${buffer}`,
                  `mesh skin ${buffer}`,
                  violations,
                );
          }
        }
      }
      if (part.transform !== null)
        validateTransformArtifact(
          part.transform,
          `${path}.transform`,
          "model part transform",
          violations,
        );
    });
  const body = shape.body;
  if (
    body !== null &&
    validateObjectArtifact(body, "$input.body", "model body", violations)
  ) {
    const centerOfMass = body.centerOfMass;
    if (centerOfMass !== null)
      validateVectorArtifact(
        centerOfMass,
        "$input.body.centerOfMass",
        "model body center of mass",
        violations,
      );
  }
  if (shape.skeleton !== null)
    appendMcpSkeletonShape(violations, shape.skeleton, "$input.skeleton");
  const affordances = shape.affordances;
  if (
    affordances !== null &&
    affordances !== undefined &&
    validateArrayArtifact(
      affordances,
      "$input.affordances",
      "model affordances",
      violations,
    )
  )
    affordances.forEach((affordance, index) => {
      const path = `$input.affordances[${index}]`;
      if (
        !validateObjectArtifact(
          affordance,
          path,
          "model affordance",
          violations,
        )
      )
        return;
      validateNonEmptyId(
        affordance.id,
        `${path}.id`,
        "affordance id",
        violations,
      );
      validateTransformArtifact(
        affordance.frame,
        `${path}.frame`,
        "affordance frame",
        violations,
      );
      if (affordance.kind === "stack-top") {
        const extent = affordance.extent;
        if (
          validateArrayArtifact(
            extent,
            `${path}.extent`,
            "stack-top affordance extent",
            violations,
          )
        )
          extent.forEach((point, pointIndex) =>
            validateVectorArtifact(
              point,
              `${path}.extent[${pointIndex}]`,
              "stack-top affordance extent point",
              violations,
            ),
          );
      }
    });
  return toValidation(violations);
};

const appendMcpSkeletonShape = (
  violations: IAutoMovieConstraintViolation[],
  skeleton: IAutoMovieSkeleton | unknown,
  path: string,
): void => {
  if (!validateObjectArtifact(skeleton, path, "skeleton", violations)) return;
  validateNonEmptyId(skeleton.id, `${path}.id`, "skeleton id", violations);
  const bones = skeleton.bones;
  if (
    validateArrayArtifact(bones, `${path}.bones`, "skeleton bones", violations)
  )
    bones.forEach((bone, index) => {
      const bonePath = `${path}.bones[${index}]`;
      if (!validateObjectArtifact(bone, bonePath, "skeleton bone", violations))
        return;
      validateNonEmptyId(
        bone.bone,
        `${bonePath}.bone`,
        "skeleton bone",
        violations,
      );
      if (bone.parent !== null)
        validateNonEmptyId(
          bone.parent,
          `${bonePath}.parent`,
          "skeleton bone parent",
          violations,
        );
      validateTransformArtifact(
        bone.rest,
        `${bonePath}.rest`,
        "skeleton bone rest transform",
        violations,
      );
      const constraint = bone.constraint;
      if (
        constraint !== null &&
        validateObjectArtifact(
          constraint,
          `${bonePath}.constraint`,
          "skeleton bone constraint",
          violations,
        )
      )
        JOINT_CONSTRAINT_AXES.forEach((axis) => {
          const range = constraint[axis];
          if (range !== null)
            validateObjectArtifact(
              range,
              `${bonePath}.constraint.${axis}`,
              `skeleton bone constraint ${axis} range`,
              violations,
            );
        });
    });
};
