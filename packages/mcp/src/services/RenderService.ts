import { toValidation, violation } from "@automovie/engine";
import {
  AutoMovieGuidePass,
  IAutoMovieConstraintViolation,
  IAutoMovieRenderSpec,
  IAutoMovieSequence,
  IAutoMovieShot,
} from "@automovie/interface";
import {
  IAutoMovieCaptionSidecar,
  IAutoMovieRenderChunkPlan,
  ffmpegArgs,
  frameName,
  framePattern,
  frameTimes,
  guidePassFrameName,
  isGuidePass,
  planCaptionSidecar,
  planChunkedSequenceRender,
  planGuidePassOutputs,
  planSequenceRender,
  renderPathStem,
  sliceCaptionSidecar,
} from "@automovie/render";

import { AutoMovieContext } from "../AutoMovieContext";
import {
  IAutoMovieMcpCaptureRequest,
  IAutoMovieMcpRenderChunk,
  IAutoMovieMcpRenderChunkPlan,
  IAutoMovieMcpRenderPlan,
  IAutoMovieMcpRenderTarget,
  IAutoMovieMcpWritableSlate,
  IAutoMoviePlanCaptionsOutput,
  IAutoMoviePlanChunkedRenderOutput,
  IAutoMoviePlanRenderOutput,
  IAutoMovieSeeFrameOutput,
} from "../dto";
import { validateSequenceArtifact } from "../validators/artifacts";
import {
  appendValidation,
  isRecord,
  pushViolation,
  validateArrayArtifact,
  validateNonEmptyId,
  validateRange,
} from "../validators/primitives";

/**
 * The render/see loop — deterministic render planning and the host-adapter
 * frame capture (#608). Pixels never flow through the server: the service plans
 * the frame and hands the context's capture adapter the request. The MCP
 * contract lives on the {@link AutoMovieApplication} facade.
 *
 * Like every stateful tool (#614), render is **resident-or-explicit**: omit
 * `slate` and it reads the resident project's `writableSlate()`, so a long
 * production never re-sends its whole state just to plan a render. Planning is
 * a pure read — no film-ladder prerequisite gate (that guards resident
 * _commits_); an unready target still surfaces as a `resolveRenderTarget`
 * violation, the more precise feedback. The resident default frame/output paths
 * live under the project's reserved `renders/` directory; an explicit slate
 * keeps the legacy `frames/<stem>` / `<stem>.mp4` defaults, byte-identical.
 */
export class RenderService {
  public constructor(private readonly context: AutoMovieContext) {}

  /**
   * The slate a render reads: the explicit one when given (a pure stateless
   * plan), else the resident project's writable slate (#614, the
   * {@link SlateQueryService} `stored()` / {@link CommitService} `base()`
   * precedent). `resident` selects the `renders/` default paths.
   */
  private resolveSlate(
    slate: IAutoMovieMcpWritableSlate | undefined,
    caller: string,
  ): { slate: IAutoMovieMcpWritableSlate; resident: boolean } {
    if (slate !== undefined) return { slate, resident: false };
    return {
      slate: this.context.requireProject(caller).writableSlate(),
      resident: true,
    };
  }

  public planRender(props: {
    slate?: IAutoMovieMcpWritableSlate;
    spec: IAutoMovieRenderSpec;
    passes?: string[];
    frameDir?: string;
    outputPath?: string;
  }): IAutoMoviePlanRenderOutput {
    const { slate, resident } = this.resolveSlate(props.slate, "planRender");
    return buildRenderPlan({ ...props, slate, resident });
  }

  public async seeFrame(props: {
    slate?: IAutoMovieMcpWritableSlate;
    spec: IAutoMovieRenderSpec;
    frame?: number;
    time?: number;
    pass?: string;
  }): Promise<IAutoMovieSeeFrameOutput> {
    const { slate, resident } = this.resolveSlate(props.slate, "seeFrame");
    const planned = buildRenderPlan({
      slate,
      spec: props.spec,
      resident,
    });
    if (planned.validation.success === false)
      return { validation: planned.validation, preview: null };
    const plan = planned.plan!;
    const violations: IAutoMovieConstraintViolation[] = [];
    const frame = resolvePreviewFrame(props, plan, violations);
    const pass = resolveGuidePass(props.pass, violations);
    const validation = toValidation(violations);
    if (validation.success === false) return { validation, preview: null };

    const time = plan.times[frame]!;
    const framePath = `${plan.frameDir}/${guidePassFrameName(frame, pass!)}`;
    const request: IAutoMovieMcpCaptureRequest = {
      target: plan.target,
      frame,
      time,
      pass: pass!,
      framePath,
      width: props.spec.width,
      height: props.spec.height,
      toneMapping: props.spec.toneMapping,
    };
    const image =
      this.context.capture === undefined
        ? null
        : await this.context.capture(request);
    return {
      validation,
      preview: {
        target: plan.target,
        frame,
        time,
        pass: pass!,
        framePath,
        width: props.spec.width,
        height: props.spec.height,
        toneMapping: props.spec.toneMapping,
        status: image === null ? "no-capture-adapter" : "captured",
        image,
      },
    };
  }

  /**
   * Plan a long film as `chunkFrames`-sized, independently-renderable chunks
   * (#609/#644) so an hours-long render is produced in bounded windows and
   * regenerated one window at a time. Resident-or-explicit like every render
   * tool; the target must be the committed film (a single shot renders whole
   * via {@link planRender}). Frame-atomic boundaries — no frame duplicated or
   * dropped — so concatenating the chunks reproduces the whole render.
   */
  public planChunkedRender(props: {
    slate?: IAutoMovieMcpWritableSlate;
    spec: IAutoMovieRenderSpec;
    chunkFrames: number;
    passes?: string[];
    frameDir?: string;
    outputPath?: string;
  }): IAutoMoviePlanChunkedRenderOutput {
    const { slate, resident } = this.resolveSlate(
      props.slate,
      "planChunkedRender",
    );
    return buildChunkedRenderPlan({ ...props, slate, resident });
  }

  /**
   * Plan the caption sidecar — the per-shot diffusion-prompt track a render
   * host reads beside the guide frames (#607). Resident-or-explicit; the
   * committed script and film supply the captions and the cut. Pass
   * `chunkFrames` to also get one chunk-local sidecar per render chunk, aligned
   * with {@link planChunkedRender}'s frame-atomic windows.
   */
  public planCaptions(props: {
    slate?: IAutoMovieMcpWritableSlate;
    fps: number;
    chunkFrames?: number;
  }): IAutoMoviePlanCaptionsOutput {
    const { slate } = this.resolveSlate(props.slate, "planCaptions");
    return buildCaptionPlan({ ...props, slate });
  }
}

const buildChunkedRenderPlan = (props: {
  slate: IAutoMovieMcpWritableSlate;
  spec: IAutoMovieRenderSpec;
  chunkFrames: number;
  passes?: string[];
  frameDir?: string;
  outputPath?: string;
  resident: boolean;
}): IAutoMoviePlanChunkedRenderOutput => {
  const violations: IAutoMovieConstraintViolation[] = [];
  const specIsRecord = isRecord(props.spec);
  validateRenderSpec(props.spec, violations);
  // Omitted passes => a beauty-only chunk plan with NO pass fields (byte-
  // identical to the pass-less engine plan); an explicit list is validated and
  // planned per chunk. resolveGuidePasses' beauty default is deliberately not
  // used here (it would fabricate a beauty pass manifest).
  const passes =
    props.passes === undefined
      ? undefined
      : resolveGuidePasses(props.passes, violations);
  validateChunkFrames(props.chunkFrames, violations);
  const target = specIsRecord
    ? resolveRenderTarget(props.slate, props.spec.target, violations)
    : null;
  // Chunking splits a sequence render; a single shot renders whole via
  // planRender, so a shot target is a violation, not a chunk plan.
  if (
    target !== null &&
    (target.target.kind !== "sequence" || props.slate.film === null)
  )
    pushViolation(
      violations,
      "type",
      "$input.spec.target",
      `chunked render requires a committed film target, but "${props.spec.target}" is not the film`,
      props.spec.target,
    );
  const validation = toValidation(violations);
  if (validation.success === false) return { validation, plan: null };

  const stem = renderPathStem(props.spec.target);
  const plan = planSequenceRender({
    sequence: props.slate.film!,
    shots: props.slate.shots,
    spec: props.spec,
    frameDir:
      props.frameDir ?? (props.resident ? `renders/${stem}` : undefined),
    outputPath:
      props.outputPath ?? (props.resident ? `renders/${stem}.mp4` : undefined),
  });
  // After a successful validation `passes` is undefined (omitted) or a
  // validated pass list (never null — a null would have failed validation).
  const chunked = planChunkedSequenceRender({
    plan,
    spec: props.spec,
    chunkFrames: props.chunkFrames,
    passes: passes ?? undefined,
  });
  return { validation: { success: true }, plan: toMcpChunkPlan(chunked) };
};

/** Strip each chunk's per-frame samples; the host re-derives frame content. */
const toMcpChunkPlan = (
  plan: IAutoMovieRenderChunkPlan,
): IAutoMovieMcpRenderChunkPlan => ({
  target: plan.target,
  renderFps: plan.renderFps,
  frameCount: plan.frameCount,
  chunkFrames: plan.chunkFrames,
  chunkCount: plan.chunkCount,
  chunks: plan.chunks.map(
    (chunk): IAutoMovieMcpRenderChunk => ({
      index: chunk.index,
      frameStart: chunk.frameStart,
      frameEnd: chunk.frameEnd,
      frameCount: chunk.frameCount,
      startSeconds: chunk.startSeconds,
      endSeconds: chunk.endSeconds,
      frameDir: chunk.frameDir,
      firstFrame: chunk.firstFrame,
      lastFrame: chunk.lastFrame,
      inputPattern: chunk.inputPattern,
      outputPath: chunk.outputPath,
      ffmpegArgs: chunk.ffmpegArgs,
      ...(chunk.passOutputs === undefined
        ? {}
        : { passOutputs: chunk.passOutputs }),
    }),
  ),
  reassembly: plan.reassembly,
  ...(plan.passManifests === undefined
    ? {}
    : { passManifests: plan.passManifests }),
});

const buildCaptionPlan = (props: {
  slate: IAutoMovieMcpWritableSlate;
  fps: number;
  chunkFrames?: number;
}): IAutoMoviePlanCaptionsOutput => {
  const violations: IAutoMovieConstraintViolation[] = [];
  validateRange(
    props.fps,
    "$input.fps",
    0,
    Infinity,
    "caption fps",
    violations,
    false,
  );
  if (props.chunkFrames !== undefined)
    validateChunkFrames(props.chunkFrames, violations);
  if (props.slate.script === null)
    pushViolation(
      violations,
      "type",
      "$slate.script",
      "a script must be committed before captions",
      props.slate.script,
    );
  const shots = props.slate.shots as unknown;
  const shotsReady = validateArrayArtifact(
    shots,
    "$slate.shots",
    "slate shots",
    violations,
  );
  let shotEntriesReady = shotsReady;
  if (shotsReady)
    shotEntriesReady = validateSlateShotEntries(
      shots,
      "$slate.shots",
      violations,
    );

  const film = props.slate.film as unknown;
  let sequence: IAutoMovieSequence | null = null;
  let sequenceReady = false;
  if (film === null)
    pushViolation(
      violations,
      "type",
      "$slate.film",
      "a film must be committed before captions",
      film,
    );
  else if (!isRecord(film))
    pushViolation(
      violations,
      "type",
      "$slate.film",
      "slate film must be null or a JSON object",
      film,
    );
  else if (shotsReady) {
    sequence = film as unknown as IAutoMovieSequence;
    const sequenceValidation = validateSequenceArtifact(
      sequence,
      shots as IAutoMovieShot[],
    );
    appendValidation(violations, sequenceValidation);
    sequenceReady = shotEntriesReady && sequenceValidation.success;
  }
  // Match planSequenceRender/planCaptionSidecar's zero-frame policy with a
  // violation rather than letting the engine throw, so the tool answers a
  // diagnostic like every other planning path.
  const duration =
    sequenceReady && sequence !== null
      ? sequenceRuntime(sequence, shots as IAutoMovieShot[])
      : 0;
  if (sequenceReady && Math.round(duration * props.fps) === 0)
    pushViolation(
      violations,
      "range",
      "$input.fps",
      "caption fps and film duration must produce at least one frame",
      { fps: props.fps, duration },
    );
  const validation = toValidation(violations);
  if (validation.success === false)
    return { validation, sidecar: null, chunks: null };

  const sidecar = planCaptionSidecar({
    script: props.slate.script!,
    sequence: sequence!,
    shots: shots as IAutoMovieShot[],
    fps: props.fps,
  });
  const chunks =
    props.chunkFrames === undefined
      ? null
      : sliceCaptionChunks(sidecar, props.chunkFrames);
  return { validation: { success: true }, sidecar, chunks };
};

/**
 * Slice a sidecar into the same frame-atomic windows planChunkedSequenceRender
 * uses (`[i·chunkFrames, min((i+1)·chunkFrames, frameCount))`), so caption
 * chunk `i` aligns with render chunk `i`.
 */
const sliceCaptionChunks = (
  sidecar: IAutoMovieCaptionSidecar,
  chunkFrames: number,
): IAutoMovieCaptionSidecar[] => {
  const count = Math.ceil(sidecar.frameCount / chunkFrames);
  return Array.from({ length: count }, (_, index) =>
    sliceCaptionSidecar(
      sidecar,
      index * chunkFrames,
      Math.min((index + 1) * chunkFrames, sidecar.frameCount),
    ),
  );
};

const validateChunkFrames = (
  chunkFrames: number,
  violations: IAutoMovieConstraintViolation[],
): void => {
  if (!Number.isInteger(chunkFrames) || chunkFrames <= 0)
    pushViolation(
      violations,
      "range",
      "$input.chunkFrames",
      `chunkFrames must be a positive integer, but was ${chunkFrames}`,
      chunkFrames,
    );
};

const buildRenderPlan = (props: {
  slate: IAutoMovieMcpWritableSlate;
  spec: IAutoMovieRenderSpec;
  passes?: string[];
  frameDir?: string;
  outputPath?: string;
  resident: boolean;
}): IAutoMoviePlanRenderOutput => {
  const violations: IAutoMovieConstraintViolation[] = [];
  const specIsRecord = isRecord(props.spec);
  validateRenderSpec(props.spec, violations);
  const passes = resolveGuidePasses(props.passes, violations);
  const target = specIsRecord
    ? resolveRenderTarget(props.slate, props.spec.target, violations)
    : null;
  const validation = toValidation(violations);
  if (validation.success === false) return { validation, plan: null };

  const times = frameTimes(props.spec.fps, target!.duration);
  if (times.length === 0)
    return {
      validation: toValidation([
        violation(
          "range",
          "$input.spec.fps",
          "render spec and target duration must produce at least one frame",
          { fps: props.spec.fps, duration: target!.duration },
        ),
      ]),
      plan: null,
    };

  // Resident renders default into the project's reserved `renders/` directory
  // (#614/#678); an explicit slate keeps the legacy `frames/<stem>` /
  // `<stem>.mp4` defaults so its plan stays byte-identical. An explicit
  // frameDir/outputPath overrides either default.
  const stem = renderPathStem(props.spec.target);
  const defaultFrameDir = props.resident ? `renders/${stem}` : `frames/${stem}`;
  const defaultOutputPath = props.resident
    ? `renders/${stem}.mp4`
    : `${stem}.mp4`;

  if (target!.target.kind === "sequence" && props.slate.film !== null) {
    const plan = planSequenceRender({
      sequence: props.slate.film,
      shots: props.slate.shots,
      spec: props.spec,
      frameDir:
        props.frameDir ?? (props.resident ? defaultFrameDir : undefined),
      outputPath:
        props.outputPath ?? (props.resident ? defaultOutputPath : undefined),
    });
    return {
      validation: { success: true },
      plan: {
        target: plan.target,
        duration: plan.durationSeconds,
        frameCount: plan.frameCount,
        times: plan.times,
        frameDir: plan.frameDir,
        firstFrame: plan.firstFrame,
        lastFrame: plan.lastFrame,
        inputPattern: plan.inputPattern,
        outputPath: plan.outputPath,
        ffmpegArgs: plan.ffmpegArgs,
        passes: planGuidePassOutputs({
          frameDir: plan.frameDir,
          frameCount: plan.frameCount,
          passes: passes!,
        }),
      },
    };
  }

  const frameDir = props.frameDir ?? defaultFrameDir;
  const outputPath = props.outputPath ?? defaultOutputPath;
  const inputPattern = `${frameDir}/${framePattern()}`;
  return {
    validation: { success: true },
    plan: {
      target: target!.target,
      duration: target!.duration,
      frameCount: times.length,
      times,
      frameDir,
      firstFrame: `${frameDir}/${frameName(0)}`,
      lastFrame: `${frameDir}/${frameName(times.length - 1)}`,
      inputPattern,
      outputPath,
      ffmpegArgs: ffmpegArgs(props.spec, inputPattern, outputPath),
      passes: planGuidePassOutputs({
        frameDir,
        frameCount: times.length,
        passes: passes!,
      }),
    },
  };
};

/**
 * Validate a requested guide-pass list against the closed pass union. `null`
 * when any name is unknown (a violation is pushed); beauty-only when omitted.
 */
const resolveGuidePasses = (
  passes: string[] | undefined,
  violations: IAutoMovieConstraintViolation[],
): AutoMovieGuidePass[] | null => {
  if (passes === undefined) return ["beauty"];
  if (!Array.isArray(passes)) {
    pushViolation(
      violations,
      "type",
      "$input.passes",
      "guide passes must be an array",
      passes,
    );
    return null;
  }
  const known: AutoMovieGuidePass[] = [];
  let valid = true;
  passes.forEach((pass, index) => {
    if (isGuidePass(pass)) known.push(pass);
    else {
      valid = false;
      pushViolation(
        violations,
        "type",
        `$input.passes[${index}]`,
        `guide pass "${pass}" must be one of beauty, depth, mask, outline, pose`,
        pass,
      );
    }
  });
  return valid ? known : null;
};

/** Validate one requested guide pass; beauty when omitted, null when unknown. */
const resolveGuidePass = (
  pass: string | undefined,
  violations: IAutoMovieConstraintViolation[],
): AutoMovieGuidePass | null => {
  if (pass === undefined) return "beauty";
  if (isGuidePass(pass)) return pass;
  pushViolation(
    violations,
    "type",
    "$input.pass",
    `guide pass "${pass}" must be one of beauty, depth, mask, outline, pose`,
    pass,
  );
  return null;
};

const validateRenderSpec = (
  spec: IAutoMovieRenderSpec,
  violations: IAutoMovieConstraintViolation[],
): void => {
  if (!isRecord(spec)) {
    pushViolation(
      violations,
      "type",
      "$input.spec",
      "render spec must be a JSON object",
      spec,
    );
    return;
  }
  validateNonEmptyId(
    spec.target,
    "$input.spec.target",
    "render target",
    violations,
  );
  validateRange(
    spec.fps,
    "$input.spec.fps",
    0,
    Infinity,
    "render fps",
    violations,
    false,
  );
  validateRange(
    spec.width,
    "$input.spec.width",
    0,
    Infinity,
    "render width",
    violations,
    false,
  );
  validateRange(
    spec.height,
    "$input.spec.height",
    0,
    Infinity,
    "render height",
    violations,
    false,
  );
  validateRange(spec.crf, "$input.spec.crf", 0, 51, "render crf", violations);
  if (spec.codec !== "h264")
    pushViolation(
      violations,
      "type",
      "$input.spec.codec",
      `render codec must be "h264", but was "${spec.codec}"`,
      spec.codec,
    );
  if (spec.pixelFormat !== "yuv420p")
    pushViolation(
      violations,
      "type",
      "$input.spec.pixelFormat",
      `render pixelFormat must be "yuv420p", but was "${spec.pixelFormat}"`,
      spec.pixelFormat,
    );
};

const validateSlateShotEntries = (
  shots: unknown[],
  path: string,
  violations: IAutoMovieConstraintViolation[],
): boolean => {
  let success = true;
  shots.forEach((shot, index) => {
    if (isRecord(shot)) return;
    success = false;
    pushViolation(
      violations,
      "type",
      `${path}[${index}]`,
      "slate shot must be a JSON object",
      shot,
    );
  });
  return success;
};

const resolveRenderTarget = (
  slate: IAutoMovieMcpWritableSlate,
  target: string,
  violations: IAutoMovieConstraintViolation[],
): { target: IAutoMovieMcpRenderTarget; duration: number } | null => {
  if (
    !validateArrayArtifact(
      slate.shots,
      "$slate.shots",
      "slate shots",
      violations,
    )
  )
    return null;
  if (!validateSlateShotEntries(slate.shots, "$slate.shots", violations))
    return null;
  const shots = slate.shots
    .map((shot, index) => ({ shot, index }))
    .filter(({ shot }) => isRecord(shot) && shot.id === target);
  if (shots.length > 1)
    pushViolation(
      violations,
      "type",
      `$slate.shots[${shots[1]!.index}].id`,
      `render target shot "${target}" must be unique`,
      target,
    );
  if (shots.length > 0) {
    const shot = shots[0]!.shot;
    validateRange(
      shot.duration,
      "$target.duration",
      0,
      Infinity,
      "render target duration",
      violations,
      false,
    );
    return { target: { kind: "shot", id: shot.id }, duration: shot.duration };
  }

  if (slate.film !== null && !isRecord(slate.film)) {
    pushViolation(
      violations,
      "type",
      "$slate.film",
      "slate film must be null or a JSON object",
      slate.film,
    );
    return null;
  }

  if (slate.film !== null && slate.film.id === target) {
    const sequenceValidation = validateSequenceArtifact(
      slate.film,
      slate.shots,
    );
    appendValidation(violations, sequenceValidation);
    if (sequenceValidation.success === false) return null;
    const duration = sequenceRuntime(slate.film, slate.shots);
    validateRange(
      duration,
      "$target.duration",
      0,
      Infinity,
      "render target duration",
      violations,
      false,
    );
    return { target: { kind: "sequence", id: slate.film.id }, duration };
  }

  pushViolation(
    violations,
    "type",
    "$input.spec.target",
    `render target "${target}" must match a committed shot or film`,
    target,
  );
  return null;
};

const sequenceRuntime = (
  sequence: IAutoMovieSequence,
  shots: IAutoMovieShot[],
): number => {
  const byId = new Map(shots.map((shot) => [shot.id, shot]));
  return sequence.shots.reduce((sum, entry) => {
    const shot = byId.get(entry.shot);
    const duration = entry.trim?.duration ?? shot?.duration ?? 0;
    return sum + duration - (entry.transition?.duration ?? 0);
  }, 0);
};

const resolvePreviewFrame = (
  props: { frame?: number; time?: number },
  plan: IAutoMovieMcpRenderPlan,
  violations: IAutoMovieConstraintViolation[],
): number => {
  let frame =
    props.frame === undefined
      ? props.time === undefined
        ? 0
        : Math.floor(props.time * (plan.frameCount / plan.duration))
      : props.frame;
  if (!Number.isInteger(frame) || frame < 0 || frame >= plan.frameCount)
    pushViolation(
      violations,
      "range",
      "$input.frame",
      `preview frame must be an integer within [0, ${plan.frameCount - 1}]`,
      props.frame,
    );

  if (props.time !== undefined) {
    if (
      !Number.isFinite(props.time) ||
      props.time < 0 ||
      props.time >= plan.duration
    )
      pushViolation(
        violations,
        "range",
        "$input.time",
        `preview time must be finite and within [0, ${plan.duration})`,
        props.time,
      );
    else {
      const timeFrame = Math.floor(
        props.time * (plan.frameCount / plan.duration),
      );
      if (props.frame !== undefined && timeFrame !== frame)
        pushViolation(
          violations,
          "temporal",
          "$input.time",
          `preview time maps to frame ${timeFrame}, not frame ${frame}`,
          props.time,
        );
      frame = props.frame ?? timeFrame;
    }
  }
  return frame;
};
