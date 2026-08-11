import {
  DEFAULT_SUBJECT_HEIGHT,
  GRAMMAR_STYLE_SUPPRESSION,
  IAutoMovieGrammarShotObservation,
  IAutoMovieGrammarSubjectObservation,
  computeModelRestExtentY,
  foldRoot,
  readFilmGrammar,
  resolveCameraAt,
  sampleMotion,
} from "@automovie/engine";
import type {
  IAutoMovieCameraIntent,
  IAutoMovieCompiledShotSource,
  IAutoMovieDiagnostic,
  IAutoMovieFilmTimeline,
  IAutoMovieSceneNode,
  IAutoMovieShotContract,
  IAutoMovieVector3,
} from "@automovie/interface";

/** One frame-normalized placement in the canonical film timeline. */
type IAutoMovieFilmSegment = IAutoMovieFilmTimeline["segments"][number];

/**
 * Read the assembled edit, and file what it says through the compiler.
 *
 * The film-grammar analyzer has always measured axis crossings, jump cuts,
 * eyeline matches, screen direction, shot size and re-establishment from
 * deterministic observations, and nothing in the pipeline ever asked it. A
 * declared `styleIntent` therefore suppressed nothing, because there was no
 * finding to suppress, and its only check was that its values did not repeat.
 * An author could not learn whether a deliberate break had registered, nor that
 * an undeclared one existed.
 *
 * This is the edit's side of that reading. It observes each PLACED shot at its
 * own edited boundaries, because the cut is what the grammar is about: a shot
 * trimmed to its last two seconds is judged on the frames the film shows, not
 * on the frames its source happens to contain. Every finding lands in the
 * ordinary diagnostic channel as a warning: the reading is mechanical, its
 * recovery is often an editorial choice rather than a repair, and a deliberate
 * break is declarable — refusing the compile would turn a heuristic into a
 * permission system.
 *
 * A declaration that excepted nothing is reported too, because an exception for
 * a break that does not exist is a claim about a film that is not there.
 *
 * The analyzer refuses a malformed edit by throwing, so callers hand it a
 * timeline whose placements already hold: one unique shot per placement, each
 * with a positive edited range. That is exactly what the compiler's own film
 * checks establish, which is why it reads the grammar only from an edit that
 * carries no error-level finding.
 *
 * @evidence requirements/editorial/continuity-and-film-grammar.md#editorial-continuity-finding Emits deterministic observations and recovery targets without turning film grammar into permission authority.
 * @evidence requirements/editorial/continuity-and-film-grammar.md#editorial-match-on-action Measures action continuity at the actual edited cut boundary.
 * @evidence requirements/editorial/continuity-and-film-grammar.md#editorial-spatial-grammar Measures axis, eyeline, screen-direction, and re-establishment relationships.
 * @evidence requirements/editorial/continuity-and-film-grammar.md#editorial-state-continuity Compares current placed-shot subject state across the selected edit.
 * @evidence requirements/editorial/continuity-and-film-grammar.md#editorial-reaction-information Reports current reaction and information relationships without inventing missing evidence.
 * @evidence requirements/editorial/continuity-and-film-grammar.md#editorial-grammar-violation Preserves declared exceptions while reporting undeclared mechanical violations.
 * @evidence requirements/editorial/continuity-and-film-grammar.md#editorial-continuity-incomplete Leaves unobservable or incomplete relationships explicit instead of guessing a pass.
 * @evidence requirements/acceptance/review-surfaces-and-sampling.md#acceptance-sequence-surface Evaluates grammar on the assembled edited sequence rather than isolated source shots.
 * @evidence specifications/editorial-render-and-delivery/editorial-audiovisual-continuity.md#spec-editorial-continuity-grammar Measures the selected edit's current cut relationships and preserves declared exceptions as explicit context.
 */
export const filmGrammarDiagnostics = (props: {
  /** Frame-normalized placements, in edited order. */
  segments: readonly IAutoMovieFilmSegment[];
  /** Production frame clock. */
  fps: number;
  /** Delivery raster width divided by height. */
  aspect: number;
  /** Current shot contracts keyed by id. */
  contracts: ReadonlyMap<string, IAutoMovieShotContract>;
  /** Current compiled shot output keyed by id. */
  compiled: ReadonlyMap<string, IAutoMovieCompiledShotSource>;
}): IAutoMovieDiagnostic[] => {
  const shots = props.segments.flatMap(
    (segment): IAutoMovieGrammarShotObservation[] => {
      const contract = props.contracts.get(segment.shot);
      const compiled = props.compiled.get(segment.shot);
      if (contract === undefined || compiled === undefined) return [];
      const observed = observeSegment({
        segment,
        contract,
        compiled,
        fps: props.fps,
        aspect: props.aspect,
      });
      return observed === null ? [] : [observed];
    },
  );
  if (shots.length === 0) return [];
  const reading = readFilmGrammar({ shots });
  const sourceOf = (shot: string): string =>
    props.contracts.get(shot)!.source.module;
  return [
    ...reading.reported.flatMap((diagnostic): IAutoMovieDiagnostic[] =>
      // Pacing is the one finding every edit produces: a duration series and an
      // average, stated so an author can judge the cadence against the beat. It
      // is computed rather than skipped because a declared `rhythmic-pacing`
      // has to have something to except, and it is not filed because a fact
      // true of every film is not a diagnostic about this one.
      diagnostic.code === "grammar-pacing"
        ? []
        : [
            {
              code: diagnostic.code,
              category: "warning",
              phase: "compile",
              target: `shot:${diagnostic.shot}`,
              path: sourceOf(diagnostic.shot),
              message: `Film grammar (${diagnostic.severity}): ${diagnostic.fact}; ${diagnostic.impact}. ${diagnostic.recovery}.`,
            },
          ],
    ),
    ...reading.unmatched.map(
      (claim): IAutoMovieDiagnostic => ({
        code: "grammar-style-intent-unmatched",
        category: "warning",
        phase: "compile",
        target: `shot:${claim.shot}`,
        path: sourceOf(claim.shot),
        message: `Shot "${claim.shot}" declares styleIntent "${claim.intent}", and the current edit produced no ${GRAMMAR_STYLE_SUPPRESSION[claim.intent]} finding for it to except. Break the rule the declaration claims, or drop the declaration.`,
      }),
    ),
  ];
};

/**
 * What one placed shot contributes to the read, or null when it cannot be
 * observed at all.
 *
 * Everything here is measured from compiler-owned output: the staged camera and
 * its compiled move, the performed root of each subject the contract requires
 * readable, and the framing the compiled camera intent claims. Nothing is
 * inferred from prose, and a subject the shot never staged simply is not one.
 */
const observeSegment = (props: {
  segment: IAutoMovieFilmSegment;
  contract: IAutoMovieShotContract;
  compiled: IAutoMovieCompiledShotSource;
  fps: number;
  aspect: number;
}): IAutoMovieGrammarShotObservation | null => {
  const { compiled, segment } = props;
  const camera = compiled.scene.cameras.find(
    (candidate) => candidate.id === compiled.shot.camera,
  );
  if (camera === undefined) return null;
  const start = segment.sourceInFrame / props.fps;
  // The last frame the edit SHOWS. `sourceOutFrame` is exclusive, so sampling
  // it would measure the closing boundary from a frame the trim removed.
  const end = (segment.sourceOutFrame - 1) / props.fps;
  const duration = (segment.sourceOutFrame - segment.sourceInFrame) / props.fps;
  const motionById = new Map(compiled.motions.map((clip) => [clip.id, clip]));
  const performanceByNode = new Map(
    compiled.shot.performances.map((performance) => [
      performance.node,
      performance,
    ]),
  );
  const modelById = new Map(compiled.models.map((model) => [model.id, model]));
  const nodeById = new Map(compiled.scene.nodes.map((node) => [node.id, node]));
  // The engine's own answer to "where in the world is this subject", played at
  // the shot-local second the cut actually shows, startOffset-aware exactly as
  // the visual-read pass is.
  const rootAt = (
    node: IAutoMovieSceneNode,
    seconds: number,
  ): IAutoMovieVector3 => {
    const performance = performanceByNode.get(node.id);
    const clip = motionById.get(performance?.motion ?? "");
    return clip === undefined
      ? node.transform.translation
      : foldRoot(
          node.transform,
          sampleMotion(clip, Math.max(0, seconds - performance!.startOffset))
            .pose.root,
        ).translation;
  };
  const subjects = props.contract.camera.requiredSubjects.flatMap(
    (id): IAutoMovieGrammarSubjectObservation[] => {
      const node = nodeById.get(id);
      // A required subject naming a formation or an unstaged id is not a scene
      // node with a root and a height, so it contributes no geometry here.
      if (node === undefined) return [];
      const model = modelById.get(node.model);
      const extent =
        model === undefined ? null : computeModelRestExtentY(model);
      // A rig-derived span below a tenth of a metre is not a figure; the
      // documented stand-in height is what the framing solve itself falls back
      // to, so both read the same subject.
      const measured = extent === null ? 0 : extent.max - extent.min;
      return [
        {
          id,
          start: rootAt(node, start),
          end: rootAt(node, end),
          height: measured >= 0.1 ? measured : DEFAULT_SUBJECT_HEIGHT,
          eyeline: null,
        },
      ];
    },
  );
  const cameraAt = (
    seconds: number,
  ): IAutoMovieGrammarShotObservation["camera"]["start"] => ({
    ...resolveCameraAt(
      camera.transform,
      compiled.shot.cameraMotion,
      camera.id,
      seconds,
    ),
    fovY: camera.fovY,
    aspect: props.aspect,
  });
  // The line of action is the first two subjects the contract requires
  // readable, in the order it requires them: a shot states which subjects its
  // camera must hold, and the pair among them the audience reads a left-right
  // geography from is the pair it named first. The analyzer normalizes the
  // endpoints by id, so two shots naming the same pair in either order share
  // one axis.
  const actionAxis: readonly [string, string] | null =
    subjects.length < 2 ? null : [subjects[0]!.id, subjects[1]!.id];
  return {
    id: segment.shot,
    duration,
    camera: { start: cameraAt(start), end: cameraAt(end) },
    subjects,
    primarySubject: subjects.length === 0 ? null : subjects[0]!.id,
    declaredShotSize: declaredFraming(
      compiled.shot.cameraIntent ?? [],
      start,
      end,
    ),
    actionAxis,
    styleIntent: props.contract.styleIntent,
  };
};

/**
 * The framing this shot claims across the whole of the placement, or null.
 *
 * A shot may change its framing part-way through, and the shot-size check
 * compares one declared claim against the size measured at BOTH edited
 * boundaries. So a claim is only read when exactly one intent span covers the
 * placement: a shot that goes wide then close is making two claims, and holding
 * either of them against the other boundary would report a change the author
 * authored on purpose.
 */
const declaredFraming = (
  intents: readonly IAutoMovieCameraIntent[],
  start: number,
  end: number,
): IAutoMovieCameraIntent["framing"] | null => {
  const covering = [...intents]
    .sort((left, right) => left.start - right.start)
    .filter((intent) => intent.start <= start);
  return covering.length === 0 ||
    intents.some((intent) => intent.start > start && intent.start <= end)
    ? null
    : covering[covering.length - 1]!.framing;
};
