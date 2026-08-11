import { Quaternion } from "@automovie/engine";
import {
  IAutoMovieDriver,
  IAutoMovieKeyframe,
  IAutoMovieMotion,
  IAutoMovieProfile,
  IAutoMoviePropSpec,
  IAutoMovieTransform,
} from "@automovie/interface";

import {
  IAutoMovieMcpBezier,
  IAutoMovieMcpMotion,
  IAutoMovieMcpPropDriver,
  IAutoMovieMcpPropProfile,
  IAutoMovieMcpPropSpec,
  IAutoMovieMcpTransform,
} from "./dto";

/**
 * The MCP ⇄ engine motion bridge. The LLM JSON schema cannot express tuples, so
 * keyframe cubic-bezier controls cross the MCP boundary as named `{x1, y1, x2,
 * y2}` objects ({@link IAutoMovieMcpBezier}) and are converted to and from the
 * engine's `[x1, y1, x2, y2]` tuple here, the single place both directions
 * live, so they cannot drift apart.
 */

/**
 * Lower an MCP placement transform onto the engine's {@link IAutoMovieTransform}
 * (#723, D016): the semantic Euler rotation becomes a quaternion via
 * {@link Quaternion.fromEuler}, and an omitted/`null` rotation is identity, so
 * the LLM authors placements in degrees it understands and never emits a raw
 * quaternion. Translation and scale pass through unchanged.
 *
 * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Lets production TypeScript lower human-readable Euler placement into the engine quaternion while retaining authored translation and scale.
 * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Implements that deterministic placement conversion as a reusable source helper rather than an interactive MCP mutation.
 */
export const toEngineTransform = (
  transform: IAutoMovieMcpTransform,
): IAutoMovieTransform => ({
  translation: transform.translation,
  rotation:
    transform.rotation === undefined || transform.rotation === null
      ? Quaternion.identity()
      : Quaternion.fromEuler(transform.rotation),
  scale: transform.scale,
});

/**
 * Project engine motion into the writable MCP production-design shape.
 *
 * @evidence requirements/agent-authoring/source-owned-loop.md#agent-source-result-link Keeps the engine motion and its writable projection joined as two representations of one source-owned result.
 * @evidence specifications/authoring-and-authority/source-authority-and-derivation.md#spec-authoring-derivation-output-lineage Treats the MCP form as a derived projection of the same authored motion.
 */
export const toMcpMotion = (motion: IAutoMovieMotion): IAutoMovieMcpMotion => ({
  ...motion,
  keyframes: motion.keyframes.map((keyframe) => ({
    ...keyframe,
    bezier: toMcpBezier(keyframe.bezier),
  })),
});

/**
 * Project one engine Bezier tuple into named MCP control points.
 *
 * @evidence requirements/agent-authoring/source-owned-loop.md#agent-source-result-link Preserves the source curve's identity while projecting its tuple into named control points.
 * @evidence specifications/authoring-and-authority/source-authority-and-derivation.md#spec-authoring-derivation-output-lineage Keeps this named shape derived from the tuple source.
 */
export const toMcpBezier = (
  bezier: IAutoMovieKeyframe["bezier"],
): IAutoMovieMcpBezier | null =>
  bezier === null
    ? null
    : {
        x1: bezier[0],
        y1: bezier[1],
        x2: bezier[2],
        y2: bezier[3],
      };

/**
 * Lower one writable MCP motion into the deterministic engine contract.
 *
 * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Consumes the caller-authored motion as ordinary typed source without replacing its content.
 * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Converts named Bezier controls into the engine tuple shape in deterministic source code.
 */
export const toEngineMotion = (
  motion: IAutoMovieMcpMotion,
): IAutoMovieMotion => ({
  ...motion,
  keyframes: motion.keyframes.map((keyframe) => ({
    ...keyframe,
    bezier:
      keyframe.bezier === null
        ? null
        : ([
            keyframe.bezier.x1,
            keyframe.bezier.y1,
            keyframe.bezier.x2,
            keyframe.bezier.y2,
          ] as [number, number, number, number]),
  })),
});

/**
 * Lower an MCP prop spec onto the engine's {@link IAutoMoviePropSpec}: the
 * driven drivers' named `{from, to}` ranges become the engine's `[from, to]`
 * pairs, and the gait-less MCP profile becomes a plain profile (a prop does not
 * locomote, so `gaits` is simply absent).
 *
 * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Lets authored prop records move from the writable MCP shape into engine tuples without hidden state.
 * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Performs the prop-profile and driven-range lowering entirely in deterministic package code.
 */
export const toEnginePropSpec = (
  spec: IAutoMovieMcpPropSpec,
): IAutoMoviePropSpec => ({
  node: spec.node,
  model: spec.model,
  articulation:
    spec.articulation === null
      ? null
      : {
          nodes: spec.articulation.nodes,
          profile: toEnginePropProfile(spec.articulation.profile),
          binding: spec.articulation.binding,
        },
});

const toEnginePropProfile = (
  profile: IAutoMovieMcpPropProfile,
): IAutoMovieProfile => ({
  id: profile.id,
  name: profile.name,
  controls: profile.controls,
  drivers: profile.drivers.map(toEnginePropDriver),
  limits: profile.limits,
});

const toEnginePropDriver = (
  driver: IAutoMovieMcpPropDriver,
): IAutoMovieDriver => {
  if (driver.type !== "driven") return driver;
  // Strip the MCP-form ranges and re-add engine tuples only when present, a
  // curve-driven driver omits both, so it must not carry a dead range (#724).
  const { inRange, outRange, ...rest } = driver;
  return {
    ...rest,
    ...(inRange !== undefined
      ? { inRange: [inRange.from, inRange.to] as [number, number] }
      : {}),
    ...(outRange !== undefined
      ? { outRange: [outRange.from, outRange.to] as [number, number] }
      : {}),
  };
};
