import {
  IAutoMovieExpression,
  IAutoMovieModel,
  IAutoMoviePose,
} from "@automovie/interface";
import { AutoMovieApplication, IAutoMovieMcpMotion } from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";

import {
  createModel,
  createSkeleton,
  keyframe,
  makePose,
} from "../internal/fixtures";
import { hasViolation } from "../internal/predicates";

const app = new AutoMovieApplication();
const skeleton = createSkeleton();
const model = createModel(skeleton);

/**
 * ValidationService shape-pass branches the representative validation tests
 * miss (#1040 coverage): a null pose, a keyframe expression's blendshapes
 * buffer, and null entries inside the model's material/part lists each reject
 * at their own `$input...` path instead of leaking a wrapper TypeError.
 *
 * Scenarios:
 *
 * 1. A null pose violates at `$input.pose` before the pose shape helper reads its
 *    joints.
 * 2. A keyframe expression carrying a non-array `blendshapes` violates at that
 *    buffer path.
 * 3. A null model violates at `$input.model`; a null material entry and a null
 *    part entry violate at their own indices.
 */
export const test_mcp_validate_model_pose_edges = (): void => {
  // 1. null pose
  const nullPose = app.validatePose({
    pose: null as unknown as IAutoMoviePose,
    skeleton,
  });
  TestValidator.predicate(
    "a null pose violates at the pose root",
    hasViolation(nullPose.validation, "type", "$input.pose"),
  );

  // 2. keyframe expression blendshapes buffer
  const expression = {
    preset: "smile",
    intensity: 0.5,
    blendshapes: "NOT_ARRAY",
  } as unknown as IAutoMovieExpression;
  const badBlendshapes = app.validateMotion({
    motion: {
      id: "clip",
      skeleton: skeleton.id,
      duration: 1,
      loop: false,
      keyframes: [
        { ...keyframe(0, makePose([])), expression, bezier: null },
        { ...keyframe(1, makePose([])), bezier: null },
      ],
    } as IAutoMovieMcpMotion,
    skeleton,
  });
  TestValidator.predicate(
    "a non-array expression blendshapes buffer violates at its path",
    hasViolation(
      badBlendshapes.validation,
      "type",
      "$input.motion.keyframes[0].expression.blendshapes",
    ),
  );

  // 3. null model / material / part entries
  const nullModel = app.validateModel({
    model: null as unknown as IAutoMovieModel,
  });
  TestValidator.predicate(
    "a null model violates at the model root",
    hasViolation(nullModel.validation, "type", "$input.model"),
  );
  const nullMaterial = app.validateModel({
    model: {
      ...model,
      materials: [null] as unknown as IAutoMovieModel["materials"],
    },
  });
  TestValidator.predicate(
    "a null material entry violates at its index",
    hasViolation(nullMaterial.validation, "type", "$input.model.materials[0]"),
  );
  const nullPart = app.validateModel({
    model: {
      ...model,
      parts: [null] as unknown as IAutoMovieModel["parts"],
    },
  });
  TestValidator.predicate(
    "a null part entry violates at its index",
    hasViolation(nullPart.validation, "type", "$input.model.parts[0]"),
  );
};
