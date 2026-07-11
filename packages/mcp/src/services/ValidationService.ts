import {
  IResolveBeatProps,
  toValidation,
  validateModel as validateEngineModel,
  validateMotion as validateEngineMotion,
  validatePose as validateEnginePose,
  validateFilmContinuity,
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
  pushViolation,
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
    appendMcpPoseShape(violations, props.pose, "$input.pose");
    appendMcpSkeletonShape(violations, props.skeleton, "$input.skeleton");
    const shape = toValidation(violations);
    if (shape.success === false) return { validation: shape };
    return {
      validation: remapValidationPaths(
        validateEnginePose({
          pose: props.pose,
          skeleton: props.skeleton,
        }).toValidation(),
        [["$input", "$input.pose"]],
      ),
    };
  }

  public validateMotion(props: {
    motion: IAutoMovieMcpMotion;
    skeleton: IAutoMovieSkeleton;
  }): IAutoMovieValidateOutput {
    const requestRoot = validateValidationRequestRoot(props);
    if (requestRoot !== null) return { validation: requestRoot };
    const violations: IAutoMovieConstraintViolation[] = [];
    appendMcpMotionShape(violations, props.motion, "$input.motion");
    appendMcpSkeletonShape(violations, props.skeleton, "$input.skeleton");
    const shape = toValidation(violations);
    if (shape.success === false) return { validation: shape };
    return {
      validation: remapValidationPaths(
        validateEngineMotion({
          motion: toEngineMotion(props.motion),
          skeleton: props.skeleton,
        }),
        [["$input", "$input.motion"]],
      ),
    };
  }

  public validateModel(props: {
    model: IAutoMovieModel;
  }): IAutoMovieValidateOutput {
    const requestRoot = validateValidationRequestRoot(props);
    if (requestRoot !== null) return { validation: requestRoot };
    const shape = remapValidationPaths(validateMcpModelShape(props.model), [
      ["$input", "$input.model"],
    ]);
    if (shape.success === false) return { validation: shape };
    return {
      validation: remapValidationPaths(
        validateEngineModel({ model: props.model }),
        [["$input", "$input.model"]],
      ),
    };
  }

  public validateScene(props: {
    scene: IAutoMovieScene;
    models: IAutoMovieMcpGeometryModel[];
  }): IAutoMovieValidateOutput {
    const requestRoot = validateValidationRequestRoot(props);
    if (requestRoot !== null) return { validation: requestRoot };
    return {
      validation: remapValidationPaths(
        validateSceneArtifact(props.scene, props.models),
        [
          ["$input", "$input.scene"],
          ["$models", "$input.models"],
        ],
      ),
    };
  }

  public validateShot(props: {
    shot: IAutoMovieShot;
    scene: IAutoMovieScene;
    motions?: Record<string, IAutoMovieMcpMotion>;
  }): IAutoMovieValidateOutput {
    const requestRoot = validateValidationRequestRoot(props);
    if (requestRoot !== null) return { validation: requestRoot };
    return {
      validation: remapValidationPaths(
        validateShotArtifact(props.shot, props.scene, props.motions),
        [
          ["$input", "$input.shot"],
          ["$motions", "$input.motions"],
        ],
      ),
    };
  }

  public validateSequence(props: {
    sequence: IAutoMovieSequence;
    shots: IAutoMovieShot[];
  }): IAutoMovieValidateOutput {
    const requestRoot = validateValidationRequestRoot(props);
    if (requestRoot !== null) return { validation: requestRoot };
    return {
      validation: remapValidationPaths(
        validateSequenceArtifact(props.sequence, props.shots),
        [
          ["$input", "$input.sequence"],
          ["$shots", "$input.shots"],
        ],
      ),
    };
  }

  public lintContinuity(props: {
    scene: IAutoMovieScene;
    beats: {
      beat: string;
      shot: IAutoMovieShot;
      motions?: Record<string, IAutoMovieMcpMotion>;
    }[];
    positionTolerance?: number;
    facingToleranceDeg?: number;
  }): IAutoMovieValidateOutput {
    const requestRoot = validateValidationRequestRoot(props);
    if (requestRoot !== null) return { validation: requestRoot };

    const violations: IAutoMovieConstraintViolation[] = [];
    if (
      !validateArrayArtifact(
        props.beats,
        "$input.beats",
        "continuity beats",
        violations,
      )
    )
      return { validation: toValidation(violations) };

    // Each beat's shot is validated against the scene + its motions first, so
    // the engine walker below only ever resolves structurally-sound shots and
    // never throws its resolve-time invariants at the caller.
    const resolveBeats: IResolveBeatProps[] = [];
    props.beats.forEach((beat, index) => {
      const path = `$input.beats[${index}]`;
      if (!validateObjectArtifact(beat, path, "continuity beat", violations))
        return;
      validateNonEmptyId(beat.beat, `${path}.beat`, "beat id", violations);
      const shotValidation = remapValidationPaths(
        validateShotArtifact(beat.shot, props.scene, beat.motions),
        [
          ["$input", `${path}.shot`],
          ["$motions", `${path}.motions`],
        ],
      );
      if (shotValidation.success === false) {
        violations.push(...shotValidation.violations);
        return;
      }
      // Residual resolve-time invariants validateShotArtifact does not cover:
      // duplicate motion ids in the registry, and a scene node's ambient
      // motion that the registry omits (both throw inside resolveBeatEnd).
      const engineMotions = Object.values(beat.motions ?? {}).map(
        toEngineMotion,
      );
      const motionIds = new Set<string>();
      engineMotions.forEach((motion) => {
        if (motionIds.has(motion.id))
          pushViolation(
            violations,
            "type",
            `${path}.motions`,
            `motion id "${motion.id}" is declared more than once`,
            motion.id,
          );
        motionIds.add(motion.id);
      });
      // Only an UNPERFORMED node falls back to its ambient motion at resolve
      // time; a performed node uses its performance clip, so its ambient motion
      // is never looked up (and need not be provided).
      const performed = new Set(
        beat.shot.performances.map((performance) => performance.node),
      );
      props.scene.nodes.forEach((node) => {
        if (
          !performed.has(node.id) &&
          node.motion !== null &&
          !motionIds.has(node.motion)
        )
          pushViolation(
            violations,
            "type",
            `${path}.motions`,
            `scene node "${node.id}" ambient motion "${node.motion}" must be provided in the beat's motions`,
            node.motion,
          );
      });
      resolveBeats.push({
        beat: beat.beat,
        scene: props.scene,
        shot: beat.shot,
        motions: engineMotions,
      });
    });
    if (violations.length > 0) return { validation: toValidation(violations) };

    return {
      validation: validateFilmContinuity({
        beats: resolveBeats,
        positionTolerance: props.positionTolerance,
        facingToleranceDeg: props.facingToleranceDeg,
      }),
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

const remapValidationPaths = (
  validation: IAutoMovieValidation,
  replacements: ReadonlyArray<readonly [from: string, to: string]>,
): IAutoMovieValidation => {
  if (validation.success === true) return validation;
  return {
    success: false,
    violations: validation.violations.map((item) => ({
      ...item,
      path: remapPath(item.path, replacements),
    })),
  };
};

const remapPath = (
  path: string,
  replacements: ReadonlyArray<readonly [from: string, to: string]>,
): string => {
  for (const [from, to] of replacements)
    if (
      path === from ||
      path.startsWith(`${from}.`) ||
      path.startsWith(`${from}[`)
    )
      return `${to}${path.slice(from.length)}`;
  /* c8 ignore start -- unreachable fallthrough: the standalone validate* tools remap only engine/artifact validator output, whose paths all begin with a replacement key ("$input"/"$models"/"$motions"/"$shots") (#1040). */
  return path;
};
/* c8 ignore stop */

const appendMcpPoseShape = (
  violations: IAutoMovieConstraintViolation[],
  pose: unknown,
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
  motion: unknown,
  path: string,
): void => {
  if (!validateObjectArtifact(motion, path, "motion", violations)) return;
  const shape = motion as Partial<IAutoMovieMcpMotion>;
  validateNonEmptyId(shape.id, `${path}.id`, "motion id", violations);
  const keyframes = shape.keyframes;
  if (
    validateArrayArtifact(
      keyframes,
      `${path}.keyframes`,
      "motion keyframes",
      violations,
    )
  )
    keyframes.forEach((keyframe, index) => {
      const keyframePath = `${path}.keyframes[${index}]`;
      if (
        !validateObjectArtifact(
          keyframe,
          keyframePath,
          "motion keyframe",
          violations,
        )
      )
        return;
      appendMcpPoseShape(violations, keyframe.pose, `${keyframePath}.pose`);
      appendMcpExpressionShape(
        violations,
        keyframe.expression,
        `${keyframePath}.expression`,
      );
      appendMcpBezierShape(
        violations,
        keyframe.bezier,
        `${keyframePath}.bezier`,
      );
    });
};

const appendMcpExpressionShape = (
  violations: IAutoMovieConstraintViolation[],
  expression: unknown,
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
  skeleton: unknown,
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
