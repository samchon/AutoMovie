import { resolveProductionFrameRate } from "@automovie/engine";
import {
  AutoMovieDiagnosticCode,
  IAutoMovieBuildProjectInput,
  IAutoMovieCompiledContractRealization,
  IAutoMovieCompiledShotSource,
  IAutoMovieDiagnostic,
  IAutoMovieFilmBuildContext,
  IAutoMovieFilmEdit,
  IAutoMovieFilmTimeline,
  IAutoMovieProductionFrameRate,
  IAutoMovieShotContract,
} from "@automovie/interface";
import typia from "typia";

import { parseAutoMovieCaptionLanguage } from "./captionLanguage";
import {
  canonicalizeAutoMovieCaptionText,
  isAutoMovieWebVttIdentifier,
  serializeAutoMovieWebVttSingleLineText,
} from "./captionText";
import { canonicalAutoMovieJsonBytes } from "./contentIdentity";
import { filmGrammarDiagnostics } from "./filmGrammarDiagnostics";
import { ISourceBuildResult, buildSourceExport } from "./productionSourceBuild";

export const FILM_SOURCE_PATH = "src/film.ts";

export const FILM_SOURCE_EXPORT = "film";

export interface ICompiledFilmDraft {
  edit: IAutoMovieFilmEdit;
  timeline: Omit<
    IAutoMovieFilmTimeline,
    "builder" | "inputFingerprint" | "sourceDigest"
  >;
}

interface IFilmAssemblyProps {
  source: ISourceBuildResult<IAutoMovieFilmEdit>;
  context: IAutoMovieFilmBuildContext;
  contracts: ReadonlyMap<string, IAutoMovieShotContract>;
  compiled: ReadonlyMap<string, IAutoMovieCompiledShotSource>;
  realizations: ReadonlyMap<string, IAutoMovieCompiledContractRealization>;
  /** Requested compile scope; the runtime target is only binding from review on. */
  scope: IAutoMovieBuildProjectInput["scope"];
}

/**
 * Evaluate the deterministic film module once, before ordered shot compile.
 *
 * The edit links project source exactly as a shot does. `SOURCE_COMPOSITION.md`
 * tells an author to assemble the edit by walking the same table its shots are
 * derived from, and an edit that could not import that table would have to
 * restate the order it already holds.
 */
export const buildFilmEdit = (props: {
  source: string;
  sourceRoot: string;
  context: IAutoMovieFilmBuildContext;
}): ISourceBuildResult<IAutoMovieFilmEdit> =>
  buildSourceExport<IAutoMovieFilmEdit>({
    target: "film",
    label: "film edit",
    path: FILM_SOURCE_PATH,
    exportName: FILM_SOURCE_EXPORT,
    source: props.source,
    readSource: props.readSource,
    context: props.context,
    validate: (input) => typia.validateEquals<IAutoMovieFilmEdit>(input),
  });

export const assembleFilm = (
  props: IFilmAssemblyProps,
): ISourceBuildResult<ICompiledFilmDraft> => {
  const source = props.source;
  if (source.value === null)
    return { value: null, diagnostics: source.diagnostics };
  const diagnostics = [...source.diagnostics];
  const edit = source.value;
  const frameRate = resolveProductionFrameRate(
    props.context.production.frameFormat,
  );
  const fps = frameRate.numerator / frameRate.denominator;
  const targetFrames = frameTime(
    { seconds: props.context.production.targetRuntimeSeconds },
    frameRate,
    "production target runtime",
    diagnostics,
  );
  if (edit.id !== props.context.production.id)
    diagnostics.push(
      filmDiagnostic(
        "film-id-mismatch",
        `Film id "${edit.id}" differs from production id "${props.context.production.id}". Return the current production id from ${FILM_SOURCE_PATH}.`,
      ),
    );
  const omitted = new Set<string>();
  for (const omission of edit.omissions) {
    if (
      omission.shot.trim().length === 0 ||
      omission.reason.trim().length === 0 ||
      omitted.has(omission.shot)
    )
      diagnostics.push(
        filmDiagnostic(
          "film-shot-accounting-invalid",
          `Omission "${omission.shot}" must name one unique current shot with a non-blank reason.`,
        ),
      );
    else omitted.add(omission.shot);
    if (props.contracts.has(omission.shot) === false)
      diagnostics.push(
        filmDiagnostic(
          "film-shot-unknown",
          `Omission "${omission.shot}" is not a current shot contract. Remove it or restore that contract.`,
        ),
      );
  }
  const used = new Set<string>();
  const segments: IAutoMovieFilmTimeline["segments"] = [];
  for (const placement of edit.tracks.video) {
    const contract = props.contracts.get(placement.shot);
    if (
      placement.shot.trim().length === 0 ||
      used.has(placement.shot) ||
      omitted.has(placement.shot)
    )
      diagnostics.push(
        filmDiagnostic(
          "film-shot-accounting-invalid",
          `Video shot "${placement.shot}" must appear once and cannot also be omitted.`,
        ),
      );
    else used.add(placement.shot);
    if (contract === undefined) {
      diagnostics.push(
        filmDiagnostic(
          "film-shot-unknown",
          `Video shot "${placement.shot}" is not a current shot contract.`,
        ),
      );
      continue;
    }
    if (
      props.compiled.has(placement.shot) === false ||
      props.realizations.has(placement.shot) === false
    )
      diagnostics.push(
        filmDiagnostic(
          "film-shot-not-compiled",
          `Shot "${placement.shot}" has no current compiled source and realization. Correct that shot before compiling the film.`,
        ),
      );
    const sourceInFrame = frameTime(
      placement.sourceIn,
      frameRate,
      `${placement.shot} sourceIn`,
      diagnostics,
    );
    const sourceOutFrame = frameTime(
      placement.sourceOut,
      frameRate,
      `${placement.shot} sourceOut`,
      diagnostics,
    );
    const startFrame = frameTime(
      placement.start,
      frameRate,
      `${placement.shot} global start`,
      diagnostics,
    );
    const headHandleFrames = frameTime(
      placement.handles.head,
      frameRate,
      `${placement.shot} head handle`,
      diagnostics,
    );
    const tailHandleFrames = frameTime(
      placement.handles.tail,
      frameRate,
      `${placement.shot} tail handle`,
      diagnostics,
    );
    const transitionIn = normalizeFilmTransition(
      placement.transitionIn,
      frameRate,
      `${placement.shot} transitionIn`,
      diagnostics,
    );
    const transitionOut = normalizeFilmTransition(
      placement.transitionOut,
      frameRate,
      `${placement.shot} transitionOut`,
      diagnostics,
    );
    const shotFrames = frameTime(
      { seconds: contract.durationSeconds },
      frameRate,
      `${placement.shot} contract duration`,
      diagnostics,
    );
    if (
      sourceInFrame === null ||
      sourceOutFrame === null ||
      startFrame === null ||
      headHandleFrames === null ||
      tailHandleFrames === null ||
      transitionIn === null ||
      transitionOut === null ||
      shotFrames === null
    )
      continue;
    if (
      sourceOutFrame <= sourceInFrame ||
      sourceOutFrame > shotFrames ||
      headHandleFrames > sourceOutFrame - sourceInFrame ||
      tailHandleFrames > sourceOutFrame - sourceInFrame
    )
      diagnostics.push(
        filmDiagnostic(
          "film-source-range-invalid",
          `Shot "${placement.shot}" source range ${sourceInFrame}..${sourceOutFrame} and handles ${headHandleFrames}/${tailHandleFrames} must fit its ${shotFrames}-frame contract.`,
        ),
      );
    segments.push({
      shot: placement.shot,
      sourceInFrame,
      sourceOutFrame,
      startFrame,
      endFrame: startFrame + sourceOutFrame - sourceInFrame,
      headHandleFrames,
      tailHandleFrames,
      transitionIn,
      transitionOut,
    });
  }
  for (const shot of props.contracts.keys())
    if (used.has(shot) === false && omitted.has(shot) === false)
      diagnostics.push(
        filmDiagnostic(
          "film-shot-unaccounted",
          `Shot "${shot}" is neither placed nor explicitly omitted. Account for every current narrative shot.`,
        ),
      );
  validateVideoTimeline(segments, props, frameRate, diagnostics);
  const totalFrames =
    segments.length === 0
      ? 0
      : Math.max(...segments.map((item) => item.endFrame));
  // `targetRuntimeSeconds` is the production's *intended finished* runtime, so
  // a film edit shorter than it is the normal state of an unfinished
  // production, not an authoring error. Failing `source` scope on the gap would
  // make a target impossible to declare before the film that fills it exists,
  // which turns a stated intent into a value derived from whatever is built so
  // far. Delivery is where the two must agree, and `review` is already the
  // scope that judges the whole assembled film, so the gap is binding from
  // there on.
  if (targetFrames !== null && totalFrames !== targetFrames)
    diagnostics.push({
      ...filmDiagnostic(
        "film-runtime-mismatch",
        `Film timeline ends at frame ${totalFrames}, but production target runtime is frame ${targetFrames}.${
          props.scope === "source"
            ? " The film does not yet fill its intended runtime; it must before review."
            : " Correct placement timing or production runtime."
        }`,
      ),
      category: props.scope === "source" ? "warning" : "error",
    });
  const audio = normalizeAudioCues(
    edit,
    props.context.assets,
    frameRate,
    totalFrames,
    diagnostics,
  );
  const captions = normalizeCaptionCues(
    edit,
    frameRate,
    totalFrames,
    diagnostics,
  );
  const effects = normalizeEffectCues(
    edit,
    props.context.effectZones.map((zone) => zone.id),
    frameRate,
    totalFrames,
    diagnostics,
  );
  // The mechanical read of the assembled edit, once the edit is known to hold
  // together. The analyzer's preconditions — one unique shot per placement, a
  // positive edited duration, a compiled shot behind each one — are exactly
  // what the checks above establish, and an edit that fails them publishes no
  // artifact for anyone to read a grammar out of.
  if (diagnostics.every((diagnostic) => diagnostic.category !== "error"))
    diagnostics.push(
      ...filmGrammarDiagnostics({
        segments,
        fps,
        aspect:
          props.context.production.frameFormat.width /
          props.context.production.frameFormat.height,
        contracts: props.contracts,
        compiled: props.compiled,
      }),
    );
  return {
    value: diagnostics.some((diagnostic) => diagnostic.category === "error")
      ? null
      : {
          edit,
          timeline: {
            version: 1,
            id: edit.id,
            fps,
            frameRate,
            totalFrames,
            segments,
            omissions: edit.omissions,
            tracks: { audio, captions, effects },
          },
        },
    diagnostics,
  };
};

export const filmDiagnostic = (
  code: AutoMovieDiagnosticCode,
  message: string,
): IAutoMovieDiagnostic => ({
  code,
  category: "error",
  phase: "compile",
  target: "film",
  path: FILM_SOURCE_PATH,
  message,
});

const frameTime = (
  value: { frame: number } | { seconds: number },
  frameRate: IAutoMovieProductionFrameRate,
  label: string,
  diagnostics: IAutoMovieDiagnostic[],
): number | null => {
  const raw =
    "frame" in value
      ? value.frame
      : (value.seconds * frameRate.numerator) / frameRate.denominator;
  const rounded = Math.round(raw);
  if (
    Number.isFinite(raw) === false ||
    Number.isSafeInteger(rounded) === false ||
    rounded < 0 ||
    ("frame" in value
      ? value.frame !== rounded
      : value.seconds !==
        (rounded * frameRate.denominator) / frameRate.numerator)
  ) {
    const fps = frameRate.numerator / frameRate.denominator;
    diagnostics.push(
      filmDiagnostic(
        "film-time-off-grid",
        `${label} does not resolve to one non-negative safe production frame at ${fps} fps. Use an exact frame or frame-grid second.`,
      ),
    );
    return null;
  }
  return rounded;
};

const normalizeFilmTransition = (
  transition: IAutoMovieFilmEdit["tracks"]["video"][number]["transitionIn"],
  frameRate: IAutoMovieProductionFrameRate,
  label: string,
  diagnostics: IAutoMovieDiagnostic[],
): IAutoMovieFilmTimeline["segments"][number]["transitionIn"] | null => {
  if (transition.kind === "cut") return { kind: "cut" };
  const durationFrames = frameTime(
    transition.duration,
    frameRate,
    `${label} duration`,
    diagnostics,
  );
  if (durationFrames === null) return null;
  if (durationFrames === 0) {
    diagnostics.push(
      filmDiagnostic(
        "film-transition-invalid",
        `${label} ${transition.kind} duration must be at least one frame.`,
      ),
    );
    return null;
  }
  return { kind: transition.kind, durationFrames };
};

const transitionDuration = (
  transition: IAutoMovieFilmTimeline["segments"][number]["transitionIn"],
): number => ("durationFrames" in transition ? transition.durationFrames : 0);

const validateVideoTimeline = (
  segments: readonly IAutoMovieFilmTimeline["segments"][number][],
  props: IFilmAssemblyProps,
  frameRate: IAutoMovieProductionFrameRate,
  diagnostics: IAutoMovieDiagnostic[],
): void => {
  if (segments.length === 0) {
    diagnostics.push(
      filmDiagnostic(
        "film-video-empty",
        "The finished film must contain at least one current video placement.",
      ),
    );
    return;
  }
  if (segments[0]!.startFrame !== 0)
    diagnostics.push(
      filmDiagnostic(
        "film-global-order-invalid",
        `The first video placement starts at frame ${segments[0]!.startFrame}; it must start at frame 0.`,
      ),
    );
  for (let index = 0; index < segments.length; ++index) {
    const segment = segments[index]!;
    if (
      (index === 0 && segment.transitionIn.kind === "dissolve") ||
      (index === segments.length - 1 &&
        segment.transitionOut.kind === "dissolve")
    )
      diagnostics.push(
        filmDiagnostic(
          "film-transition-invalid",
          `Shot "${segment.shot}" cannot dissolve beyond the beginning or end of the film.`,
        ),
      );
    for (const [side, transition, handle] of [
      ["incoming", segment.transitionIn, segment.headHandleFrames],
      ["outgoing", segment.transitionOut, segment.tailHandleFrames],
    ] as const)
      if (
        transition.kind !== "cut" &&
        transitionDuration(transition) >
          (transition.kind === "dissolve"
            ? handle
            : segment.endFrame - segment.startFrame)
      )
        diagnostics.push(
          filmDiagnostic(
            "film-transition-handle-missing",
            `Shot "${segment.shot}" ${side} ${transition.kind} needs ${transitionDuration(transition)} frames, but only ${handle} transition-handle frames are declared.`,
          ),
        );
    if (index === 0) continue;
    const previous = segments[index - 1]!;
    if (
      previous.transitionOut.kind !== segment.transitionIn.kind ||
      transitionDuration(previous.transitionOut) !==
        transitionDuration(segment.transitionIn)
    )
      diagnostics.push(
        filmDiagnostic(
          "film-transition-mismatch",
          `Transition between "${previous.shot}" and "${segment.shot}" must have identical outgoing and incoming kind/duration.`,
        ),
      );
    const overlap =
      previous.transitionOut.kind === "dissolve"
        ? transitionDuration(previous.transitionOut)
        : 0;
    const expectedStart = previous.endFrame - overlap;
    if (segment.startFrame !== expectedStart)
      diagnostics.push(
        filmDiagnostic(
          "film-global-order-invalid",
          `Shot "${segment.shot}" starts at frame ${segment.startFrame}; transition law requires frame ${expectedStart}. Arbitrary gaps and overlaps are forbidden.`,
        ),
      );
    validateStateContinuity(previous, segment, props, frameRate, diagnostics);
  }
};

const validateStateContinuity = (
  previous: IAutoMovieFilmTimeline["segments"][number],
  current: IAutoMovieFilmTimeline["segments"][number],
  props: IFilmAssemblyProps,
  frameRate: IAutoMovieProductionFrameRate,
  diagnostics: IAutoMovieDiagnostic[],
): void => {
  const previousContract = props.contracts.get(previous.shot)!;
  const currentContract = props.contracts.get(current.shot)!;
  const previousFrames = Math.round(
    (previousContract.durationSeconds * frameRate.numerator) /
      frameRate.denominator,
  );
  if (
    previous.sourceOutFrame !== previousFrames ||
    current.sourceInFrame !== 0
  ) {
    if (
      previousContract.closing.length !== 0 ||
      currentContract.opening.length !== 0
    )
      diagnostics.push(
        filmDiagnostic(
          "film-state-handoff-unverifiable",
          `Trimmed boundary "${previous.shot}" -> "${current.shot}" cannot use contract edge-state continuity. Author full contract edges or remove edge-state claims.`,
        ),
      );
    return;
  }
  const previousRealization = props.realizations.get(previous.shot);
  const currentRealization = props.realizations.get(current.shot);
  if (previousRealization === undefined || currentRealization === undefined)
    return;
  const closing = previousRealization.closing.map((state) => state.predicates);
  const opening = currentRealization.opening.map((state) => state.predicates);
  if (
    Buffer.from(canonicalAutoMovieJsonBytes(closing)).equals(
      Buffer.from(canonicalAutoMovieJsonBytes(opening)),
    ) === false
  )
    diagnostics.push(
      filmDiagnostic(
        "film-state-handoff-mismatch",
        `Closing state of "${previous.shot}" does not equal opening state of "${current.shot}". An untrimmed cut hands one measured state across, so both edges must claim it; leave both unclaimed when the cut is a scene break rather than a continuous handoff.`,
      ),
    );
};

const normalizeAudioCues = (
  edit: IAutoMovieFilmEdit,
  assets: readonly string[],
  frameRate: IAutoMovieProductionFrameRate,
  totalFrames: number,
  diagnostics: IAutoMovieDiagnostic[],
): IAutoMovieFilmTimeline["tracks"]["audio"] => {
  const output: IAutoMovieFilmTimeline["tracks"]["audio"] = [];
  const ids = new Set<string>();
  let priorStart = -1;
  for (const cue of edit.tracks.audio) {
    const sourceDurationFrames = frameTime(
      cue.sourceDuration,
      frameRate,
      `${cue.id} audio source duration`,
      diagnostics,
    );
    const sourceOffsetFrame = frameTime(
      cue.sourceOffset,
      frameRate,
      `${cue.id} audio source offset`,
      diagnostics,
    );
    const startFrame = frameTime(
      cue.start,
      frameRate,
      `${cue.id} audio start`,
      diagnostics,
    );
    const durationFrames = frameTime(
      cue.duration,
      frameRate,
      `${cue.id} audio duration`,
      diagnostics,
    );
    const fadeInFrames = frameTime(
      cue.fadeIn,
      frameRate,
      `${cue.id} audio fadeIn`,
      diagnostics,
    );
    const fadeOutFrames = frameTime(
      cue.fadeOut,
      frameRate,
      `${cue.id} audio fadeOut`,
      diagnostics,
    );
    if (
      sourceDurationFrames === null ||
      sourceOffsetFrame === null ||
      startFrame === null ||
      durationFrames === null ||
      fadeInFrames === null ||
      fadeOutFrames === null
    )
      continue;
    if (
      cue.id.trim().length === 0 ||
      ids.has(cue.id) ||
      assets.includes(cue.asset) === false ||
      sourceDurationFrames === 0 ||
      durationFrames === 0 ||
      sourceOffsetFrame + durationFrames > sourceDurationFrames ||
      startFrame + durationFrames > totalFrames ||
      fadeInFrames + fadeOutFrames > durationFrames ||
      Number.isFinite(cue.gain) === false ||
      cue.gain < 0 ||
      cue.gain > 4 ||
      startFrame < priorStart
    )
      diagnostics.push(
        filmDiagnostic(
          "film-audio-cue-invalid",
          `Audio cue "${cue.id}" must be unique, ordered, in film/source range, reference a present declared asset, use fades within duration, and set gain from 0 through 4.`,
        ),
      );
    ids.add(cue.id);
    priorStart = startFrame;
    output.push({
      id: cue.id,
      asset: cue.asset,
      sourceDurationFrames,
      sourceOffsetFrame,
      startFrame,
      durationFrames,
      gain: cue.gain,
      fadeInFrames,
      fadeOutFrames,
      bus: cue.bus,
    });
  }
  return output;
};

const normalizeCaptionCues = (
  edit: IAutoMovieFilmEdit,
  frameRate: IAutoMovieProductionFrameRate,
  totalFrames: number,
  diagnostics: IAutoMovieDiagnostic[],
): IAutoMovieFilmTimeline["tracks"]["captions"] => {
  const output: IAutoMovieFilmTimeline["tracks"]["captions"] = [];
  const ids = new Set<string>();
  let priorEnd = 0;
  for (const cue of edit.tracks.captions) {
    const startFrame = frameTime(
      cue.start,
      frameRate,
      `${cue.id} caption start`,
      diagnostics,
    );
    const endFrame = frameTime(
      cue.end,
      frameRate,
      `${cue.id} caption end`,
      diagnostics,
    );
    if (startFrame === null || endFrame === null) continue;
    if (
      cue.id.trim().length === 0 ||
      isAutoMovieWebVttIdentifier(cue.id) === false ||
      ids.has(cue.id) ||
      canonicalizeAutoMovieCaptionText(cue.text).trim().length === 0 ||
      parseAutoMovieCaptionLanguage(cue.language) === null ||
      (cue.speaker !== undefined &&
        serializeAutoMovieWebVttSingleLineText(cue.speaker).trim().length ===
          0) ||
      startFrame < priorEnd ||
      endFrame <= startFrame ||
      endFrame > totalFrames
    )
      diagnostics.push(
        filmDiagnostic(
          "film-caption-cue-invalid",
          `Caption cue "${cue.id}" must be unique, non-overlapping, in range, plain non-blank text, use a well-formed RFC 5646 language tag, and use a non-blank speaker identity.`,
        ),
      );
    ids.add(cue.id);
    priorEnd = endFrame;
    output.push({
      id: cue.id,
      text: cue.text,
      language: cue.language,
      ...(cue.speaker === undefined ? {} : { speaker: cue.speaker }),
      startFrame,
      endFrame,
    });
  }
  return output;
};

const normalizeEffectCues = (
  edit: IAutoMovieFilmEdit,
  zones: readonly string[],
  frameRate: IAutoMovieProductionFrameRate,
  totalFrames: number,
  diagnostics: IAutoMovieDiagnostic[],
): IAutoMovieFilmTimeline["tracks"]["effects"] => {
  const output: IAutoMovieFilmTimeline["tracks"]["effects"] = [];
  const ids = new Set<string>();
  let priorStart = -1;
  for (const cue of edit.tracks.effects) {
    const startFrame = frameTime(
      cue.start,
      frameRate,
      `${cue.id} effect start`,
      diagnostics,
    );
    const durationFrames = frameTime(
      cue.duration,
      frameRate,
      `${cue.id} effect duration`,
      diagnostics,
    );
    if (startFrame === null || durationFrames === null) continue;
    if (
      cue.id.trim().length === 0 ||
      ids.has(cue.id) ||
      zones.includes(cue.zone) === false ||
      durationFrames === 0 ||
      startFrame + durationFrames > totalFrames ||
      cue.intensity < 0 ||
      cue.intensity > 1 ||
      startFrame < priorStart
    )
      diagnostics.push(
        filmDiagnostic(
          "film-effect-cue-invalid",
          `Effect cue "${cue.id}" must be unique, ordered, in range, reference a registered world zone, and use intensity from 0 through 1.`,
        ),
      );
    ids.add(cue.id);
    priorStart = startFrame;
    output.push({
      id: cue.id,
      recipe: cue.recipe,
      zone: cue.zone,
      startFrame,
      durationFrames,
      intensity: cue.intensity,
    });
  }
  return output;
};
