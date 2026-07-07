import { IAutoMovieKeyframe, IAutoMovieMotion } from "@automovie/interface";

import { IAutoMovieMcpBezier, IAutoMovieMcpMotion } from "./dto";

/**
 * The MCP ⇄ engine motion bridge. The LLM JSON schema cannot express tuples, so
 * keyframe cubic-bezier controls cross the MCP boundary as named `{x1, y1, x2,
 * y2}` objects ({@link IAutoMovieMcpBezier}) and are converted to and from the
 * engine's `[x1, y1, x2, y2]` tuple here — the single place both directions
 * live, so they cannot drift apart.
 */

export const toMcpMotion = (motion: IAutoMovieMotion): IAutoMovieMcpMotion => ({
  ...motion,
  keyframes: motion.keyframes.map((keyframe) => ({
    ...keyframe,
    bezier: toMcpBezier(keyframe.bezier),
  })),
});

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
