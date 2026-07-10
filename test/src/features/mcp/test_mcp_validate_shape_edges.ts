import { IAutoMovieSkeleton } from "@automovie/interface";
import { AutoMovieApplication, IAutoMovieMcpMotion } from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";

import {
  createSkeleton,
  joint,
  keyframe,
  makePose,
} from "../internal/fixtures";
import { hasViolation } from "../internal/predicates";

const app = new AutoMovieApplication();
const skeleton: IAutoMovieSkeleton = createSkeleton();

const motionOf = (over: Partial<IAutoMovieMcpMotion>): IAutoMovieMcpMotion => ({
  id: "clip",
  skeleton: skeleton.id,
  duration: 1,
  loop: false,
  keyframes: [
    {
      ...keyframe(0, makePose([joint("spine", { flexion: 0 })])),
      bezier: null,
    },
    {
      ...keyframe(1, makePose([joint("spine", { flexion: 10 })])),
      bezier: null,
    },
  ],
  ...over,
});

/**
 * The standalone `validateMotion` tool's SHAPE pass guards the engine validator
 * from malformed MCP payloads: every structural defect returns a field-located
 * violation instead of leaking a wrapper TypeError (#1040).
 *
 * Scenarios:
 *
 * 1. A `null` motion root violates at `$input.motion` (the engine validator is
 *    never reached).
 * 2. A `null` entry inside `keyframes` violates at its index.
 * 3. A non-object keyframe `expression` (a string) and a non-object `bezier` (a
 *    number) violate at their own paths; `null` for either stays legal
 *    (negative twins ride the valid clip below).
 * 4. Negative twin: the well-shaped clip passes the shape pass and validates clean
 *    end to end.
 */
export const test_mcp_validate_shape_edges = (): void => {
  // 1. null motion root
  const nullMotion = app.validateMotion({
    motion: null as unknown as IAutoMovieMcpMotion,
    skeleton,
  });
  TestValidator.predicate(
    "a null motion violates at the motion root",
    hasViolation(nullMotion.validation, "type", "$input.motion"),
  );

  // 2. a null keyframe entry
  const nullKeyframe = app.validateMotion({
    motion: motionOf({
      keyframes: [null] as unknown as IAutoMovieMcpMotion["keyframes"],
    }),
    skeleton,
  });
  TestValidator.predicate(
    "a null keyframe violates at its index",
    hasViolation(nullKeyframe.validation, "type", "$input.motion.keyframes[0]"),
  );

  // 3. non-object expression and bezier are located, not TypeErrors
  const badExpression = app.validateMotion({
    motion: motionOf({
      keyframes: [
        {
          ...keyframe(0, makePose([])),
          expression: "grin" as never,
          bezier: null,
        },
      ],
    }),
    skeleton,
  });
  TestValidator.predicate(
    "a string expression violates at its keyframe path",
    hasViolation(
      badExpression.validation,
      "type",
      "$input.motion.keyframes[0].expression",
    ),
  );
  const badBezier = app.validateMotion({
    motion: motionOf({
      keyframes: [{ ...keyframe(0, makePose([])), bezier: 0.25 as never }],
    }),
    skeleton,
  });
  TestValidator.predicate(
    "a numeric bezier violates at its keyframe path",
    hasViolation(
      badBezier.validation,
      "type",
      "$input.motion.keyframes[0].bezier",
    ),
  );

  // 4. negative twin: the well-shaped clip validates clean
  TestValidator.equals(
    "the well-shaped clip passes shape and engine validation",
    app.validateMotion({ motion: motionOf({}), skeleton }).validation,
    { success: true },
  );
};
