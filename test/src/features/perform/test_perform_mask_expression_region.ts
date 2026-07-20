import {
  IAutoMovieActionSynthesizer,
  compilePerformance,
} from "@automovie/engine";
import {
  AutoMovieGestureKind,
  IAutoMovieActionCall,
  IAutoMovieExpression,
  IAutoMovieMotion,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import {
  joint,
  keyframe,
  makeExpression,
  makeMotion,
  makePose,
} from "../internal/fixtures";

const action = (
  kind: AutoMovieGestureKind,
  region: IAutoMovieActionCall["region"],
  start: number,
): IAutoMovieActionCall => ({
  verb: "gesture",
  kind,
  actor: "a",
  start,
  duration: 1,
  region,
});

/** Every synthesized clip authors an expression, keyed by the gesture kind. */
const synth =
  (expressionOf: (kind: string) => IAutoMovieExpression) =>
  (call: IAutoMovieActionCall): IAutoMovieMotion => {
    const kind = call.verb === "gesture" ? call.kind : "";
    return makeMotion(
      [
        keyframe(
          0,
          makePose([joint("spine", { flexion: 0 })]),
          "linear",
          expressionOf(kind),
        ),
        keyframe(
          1,
          makePose([joint("spine", { flexion: 10 })]),
          "linear",
          expressionOf(kind),
        ),
      ],
      1,
    );
  };

const expressions = (m: IAutoMovieMotion): (string | null)[] =>
  m.keyframes.map((k) => k.expression?.preset ?? null);

/**
 * `maskMotionToRegion` strips `expression` from every region except `face`
 * (#1101): joints were made disjoint by the bone filter, but expression rode
 * through on ANY region's clip, so a host synthesizer authoring a grimace on a
 * fullBody stagger overlapped an emote UNGATED: layering resolves expressions
 * last-envelope-wins and one silently ate the other, defeating the
 * fullBody↔face exemption's disjointness claim. Now only the face region's
 * owner speaks for the face, by construction.
 *
 * Scenarios:
 *
 * 1. A single non-face region (`upperBody`) clip carrying an expression compiles
 *    with every keyframe's expression stripped.
 * 2. Negative twin: the same clip on the `face` region keeps its expression at
 *    every keyframe.
 * 3. Layered disjointness: a fullBody clip authoring "angry" beside a face clip
 *    authoring "happy": the composite carries only the face region's "happy";
 *    the fullBody grimace never surfaces.
 */
export const test_perform_mask_expression_region = (): void => {
  const angryEverywhere = synth(() => makeExpression("angry", 1));

  // 1. a non-face region strips the expression
  const stripped = compilePerformance(
    [action("wave", "upperBody", 0)],
    angryEverywhere as IAutoMovieActionSynthesizer,
  ).a!;
  TestValidator.predicate(
    "a non-face region's expression is stripped at every keyframe",
    expressions(stripped).every((preset) => preset === null),
  );

  // 2. negative twin: the face region keeps it
  const kept = compilePerformance(
    [action("nod", "face", 0)],
    angryEverywhere as IAutoMovieActionSynthesizer,
  ).a!;
  TestValidator.predicate(
    "the face region keeps its expression at every keyframe",
    expressions(kept).every((preset) => preset === "angry"),
  );

  // 3. layered: only the face region speaks for the face
  const byKind = synth((kind) =>
    kind === "nod" ? makeExpression("happy", 1) : makeExpression("angry", 1),
  );
  const layered = compilePerformance(
    [action("stagger", "fullBody", 0), action("nod", "face", 0)],
    byKind as IAutoMovieActionSynthesizer,
  ).a!;
  const presets = new Set(
    expressions(layered).filter((preset) => preset !== null),
  );
  TestValidator.equals(
    "the layered composite carries only the face region's expression",
    [...presets],
    ["happy"],
  );
};
