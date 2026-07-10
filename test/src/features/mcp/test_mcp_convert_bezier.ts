import { IAutoMovieMotion } from "@automovie/interface";
import {
  IAutoMovieMcpMotion,
  toEngineMotion,
  toEngineTransform,
  toMcpMotion,
} from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";

import { joint, keyframe, makeMotion, makePose } from "../internal/fixtures";
import { qclose, vclose } from "../internal/predicates";

/**
 * The MCP ⇄ engine conversion bridge is public API (#1040): the LLM JSON schema
 * cannot express tuples, so keyframe cubic-bezier controls cross the boundary
 * as named `{x1, y1, x2, y2}` objects and hosts converting motions between the
 * two shapes must not hand-roll the mapping (the test fixtures themselves used
 * to). Placement rotations cross as semantic Eulers (#723).
 *
 * Scenarios:
 *
 * 1. `toMcpMotion` maps an engine clip's bezier tuple onto the named object and
 *    preserves a null bezier — and `toEngineMotion` inverts both, so the round
 *    trip is identity.
 * 2. `toEngineTransform` lowers an omitted/null rotation to the identity
 *    quaternion and an Euler rotation to its quaternion (90° about Y turns +Z
 *    into +X).
 */
export const test_mcp_convert_bezier = (): void => {
  // 1. bezier tuple ⇄ named object, null preserved, round trip exact
  const engine: IAutoMovieMotion = {
    ...makeMotion(
      [
        {
          ...keyframe(0, makePose([joint("spine", { flexion: 0 })])),
          easing: "cubicBezier",
          bezier: [0.25, 0.1, 0.75, 0.9],
        },
        keyframe(1, makePose([joint("spine", { flexion: 20 })])),
      ],
      1,
    ),
  };
  const mcp = toMcpMotion(engine);
  TestValidator.equals(
    "the bezier tuple crosses as a named object",
    mcp.keyframes[0]!.bezier,
    { x1: 0.25, y1: 0.1, x2: 0.75, y2: 0.9 },
  );
  TestValidator.equals(
    "a null bezier stays null",
    mcp.keyframes[1]!.bezier,
    null,
  );
  TestValidator.equals(
    "toEngineMotion inverts toMcpMotion exactly",
    toEngineMotion(mcp),
    engine,
  );
  const authored: IAutoMovieMcpMotion = {
    ...mcp,
    keyframes: mcp.keyframes.map((kf) => ({ ...kf })),
  };
  TestValidator.equals(
    "an authored MCP bezier lowers to the engine tuple",
    toEngineMotion(authored).keyframes[0]!.bezier,
    [0.25, 0.1, 0.75, 0.9],
  );

  // 2. placement transforms: null rotation → identity, Euler → quaternion
  const identity = toEngineTransform({
    translation: { x: 1, y: 2, z: 3 },
    rotation: null,
    scale: { x: 1, y: 1, z: 1 },
  });
  TestValidator.predicate(
    "a null placement rotation lowers to the identity quaternion",
    qclose(identity.rotation, { x: 0, y: 0, z: 0, w: 1 }) &&
      vclose(identity.translation, { x: 1, y: 2, z: 3 }),
  );
  const s = Math.SQRT1_2;
  const turned = toEngineTransform({
    translation: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 90, z: 0, order: "XYZ" },
    scale: { x: 1, y: 1, z: 1 },
  });
  TestValidator.predicate(
    "a 90° Y Euler lowers to its quaternion",
    qclose(turned.rotation, { x: 0, y: s, z: 0, w: s }),
  );
};
