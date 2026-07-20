import {
  toValidation,
  validateClipArtifact,
  violation,
} from "@automovie/engine";
import {
  AutoMovieGuidePass,
  IAutoMovieConstraintViolation,
  IAutoMovieRenderFrameFormat,
  IAutoMovieRenderSpec,
  IAutoMovieScene,
  IAutoMovieSequence,
  IAutoMovieShot,
  IAutoMovieSkeleton,
  IAutoMovieValidation,
} from "@automovie/interface";
import {
  AUTOMOVIE_GUIDE_PASSES,
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
  planPoseKeypointSidecar,
  planSequenceRender,
  renderPathStem,
  sliceCaptionSidecar,
} from "@automovie/render";

import { AutoMovieContext } from "../AutoMovieContext";
import { toEngineMotion } from "../convert";
import {
  IAutoMovieMcpCaptureRequest,
  IAutoMovieMcpMotion,
  IAutoMovieMcpRenderChunk,
  IAutoMovieMcpRenderChunkPlan,
  IAutoMovieMcpRenderPlan,
  IAutoMovieMcpRenderTarget,
  IAutoMovieMcpWritableSlate,
  IAutoMoviePlanCaptionsOutput,
  IAutoMoviePlanChunkedRenderOutput,
  IAutoMoviePlanPoseKeypointsOutput,
  IAutoMoviePlanRenderOutput,
  IAutoMovieSeeFrameOutput,
} from "../dto";
import { validateSequenceArtifact } from "../validators/artifacts";
import {
  appendMotionClockShape,
  appendValidation,
  isRecord,
  pushViolation,
  validateArrayArtifact,
  validateEvenDimension,
  validateNonEmptyId,
  validateObjectArtifact,
  validateRange,
} from "../validators/primitives";
import {
  appendMcpMotionShape,
  appendMcpSkeletonShape,
} from "./ValidationService";

/**
 * The render/see loop, deterministic render planning and the host-adapter frame
 * capture (#608). Pixels never flow through the server: the service plans the
 * frame and hands the context's capture adapter the request. The MCP contract
 * lives on the {@link AutoMovieApplication} facade.
 *
 * Like every stateful tool (#614), render is **resident-or-explicit**: omit
 * `slate` and it reads the resident project's `writableSlate()`, so a long
 * production never re-sends its whole state just to plan a render. Planning is
 * a pure read, no film-ladder prerequisite gate (that guards resident
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
  ): { slate: IAutoMovieMcpWritableSlate; resident: boolean; root: string } {
    if (slate !== undefined)
      return { slate, resident: false, root: "$input.slate" };
    return {
      slate: this.context.requireProject(caller).writableSlate(),
      resident: true,
      root: "$slate",
    };
  }

  public planRender(props: {
    slate?: IAutoMovieMcpWritableSlate;
    spec: IAutoMovieRenderSpec;
    passes?: string[];
    frameDir?: string;
    outputPath?: string;
  }): IAutoMoviePlanRenderOutput {
    const rootValidation = validateRenderRequestRoot(props);
    if (rootValidation !== null)
      return { validation: rootValidation, plan: null };
    const slateValidation = validateExplicitRenderSlateRoot(props.slate);
    if (slateValidation !== null)
      return { validation: slateValidation, plan: null };
    const source = this.resolveSlate(props.slate, "planRender");
    return buildRenderPlan({
      ...props,
      slate: source.slate,
      slateRoot: source.root,
      resident: source.resident,
    });
  }

  public async seeFrame(props: {
    slate?: IAutoMovieMcpWritableSlate;
    spec: IAutoMovieRenderSpec;
    frame?: number;
    time?: number;
    pass?: string;
  }): Promise<IAutoMovieSeeFrameOutput> {
    const rootValidation = validateRenderRequestRoot(props);
    if (rootValidation !== null)
      return { validation: rootValidation, preview: null };
    const slateValidation = validateExplicitRenderSlateRoot(props.slate);
    if (slateValidation !== null)
      return { validation: slateValidation, preview: null };
    const source = this.resolveSlate(props.slate, "seeFrame");
    const planned = buildRenderPlan({
      slate: source.slate,
      spec: props.spec,
      slateRoot: source.root,
      resident: source.resident,
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
      width: props.spec.frameFormat.width,
      height: props.spec.frameFormat.height,
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
        width: props.spec.frameFormat.width,
        height: props.spec.frameFormat.height,
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
   * via {@link planRender}). Frame-atomic boundaries, no frame duplicated or
   * dropped, so concatenating the chunks reproduces the whole render.
   */
  public planChunkedRender(props: {
    slate?: IAutoMovieMcpWritableSlate;
    spec: IAutoMovieRenderSpec;
    chunkFrames: number;
    passes?: string[];
    frameDir?: string;
    outputPath?: string;
  }): IAutoMoviePlanChunkedRenderOutput {
    const rootValidation = validateRenderRequestRoot(props);
    if (rootValidation !== null)
      return { validation: rootValidation, plan: null };
    const slateValidation = validateExplicitRenderSlateRoot(props.slate);
    if (slateValidation !== null)
      return { validation: slateValidation, plan: null };
    const source = this.resolveSlate(props.slate, "planChunkedRender");
    return buildChunkedRenderPlan({
      ...props,
      slate: source.slate,
      slateRoot: source.root,
      resident: source.resident,
    });
  }

  /**
   * Plan the caption sidecar, the per-shot diffusion-prompt track a render host
   * reads beside the guide frames (#607). Resident-or-explicit; the committed
   * script and film supply the captions and the cut. Pass `chunkFrames` to also
   * get one chunk-local sidecar per render chunk, aligned with
   * {@link planChunkedRender}'s frame-atomic windows.
   */
  public planCaptions(props: {
    slate?: IAutoMovieMcpWritableSlate;
    frameFormat: IAutoMovieRenderFrameFormat;
    chunkFrames?: number;
  }): IAutoMoviePlanCaptionsOutput {
    const rootValidation = validateRenderRequestRoot(props);
    if (rootValidation !== null)
      return { validation: rootValidation, sidecar: null, chunks: null };
    const slateValidation = validateExplicitRenderSlateRoot(props.slate);
    if (slateValidation !== null)
      return { validation: slateValidation, sidecar: null, chunks: null };
    const source = this.resolveSlate(props.slate, "planCaptions");
    return buildCaptionPlan({
      ...props,
      slate: source.slate,
      slateRoot: source.root,
    });
  }

  /**
   * Plan the per-frame pose-keypoint sidecar (#1168), the OpenPose-style
   * companion a diffusion host reads beside the guide frames. Resident-or-
   * explicit for the slate (scene, shots, film); motions are DERIVED, never
   * stored, so the caller supplies the `motions` registry (and the skeletons
   * they target) exactly as `commitShot`/`lintContinuity` do.
   */
  public planPoseKeypoints(props: {
    slate?: IAutoMovieMcpWritableSlate;
    frameFormat: IAutoMovieRenderFrameFormat;
    motions: Record<string, IAutoMovieMcpMotion>;
    skeletons: IAutoMovieSkeleton[];
  }): IAutoMoviePlanPoseKeypointsOutput {
    const rootValidation = validateRenderRequestRoot(props);
    if (rootValidation !== null)
      return { validation: rootValidation, sidecar: null };
    const slateValidation = validateExplicitRenderSlateRoot(props.slate);
    if (slateValidation !== null)
      return { validation: slateValidation, sidecar: null };
    const source = this.resolveSlate(props.slate, "planPoseKeypoints");
    return buildPoseKeypointPlan({
      ...props,
      slate: source.slate,
      slateRoot: source.root,
    });
  }
}

const validateRenderRequestRoot = (
  props: unknown,
): IAutoMovieValidation | null =>
  isRecord(props)
    ? null
    : toValidation([
        violation(
          "type",
          "$input",
          "render request must be a JSON object",
          props,
        ),
      ]);

const validateExplicitRenderSlateRoot = (
  slate: unknown,
): IAutoMovieValidation | null =>
  slate === undefined || isRecord(slate)
    ? null
    : toValidation([
        violation(
          "type",
          "$input.slate",
          "render slate must be a JSON object",
          slate,
        ),
      ]);

const buildChunkedRenderPlan = (props: {
  slate: IAutoMovieMcpWritableSlate;
  slateRoot: string;
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
  validateRenderPathOverrides(props, violations);
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
    ? resolveRenderTarget(
        props.slate,
        props.slateRoot,
        props.spec.target,
        violations,
      )
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

  // buildRenderPlan's zero-frame gate, replicated (#1092): a degenerate
  // fps × duration otherwise reaches planSequenceRender's raw throw and
  // escapes to the MCP client instead of a field-located violation.
  const times = frameTimes(props.spec.frameFormat.fps, target!.duration);
  if (times.length === 0)
    return {
      validation: toValidation([
        violation(
          "range",
          "$input.spec.frameFormat.fps",
          "render spec and target duration must produce at least one frame",
          { fps: props.spec.frameFormat.fps, duration: target!.duration },
        ),
      ]),
      plan: null,
    };

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
  // validated pass list (never null, a null would have failed validation).
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
  slateRoot: string;
  frameFormat: IAutoMovieRenderFrameFormat;
  chunkFrames?: number;
}): IAutoMoviePlanCaptionsOutput => {
  const violations: IAutoMovieConstraintViolation[] = [];
  const frameFormatReady = validateRenderFrameFormat(
    props.frameFormat,
    "$input.frameFormat",
    "caption",
    violations,
  );
  if (props.chunkFrames !== undefined)
    validateChunkFrames(props.chunkFrames, violations);
  if (props.slate.script === null)
    pushViolation(
      violations,
      "type",
      `${props.slateRoot}.script`,
      "a script must be committed before captions",
      props.slate.script,
    );
  const shots = props.slate.shots as unknown;
  const shotsReady = validateArrayArtifact(
    shots,
    `${props.slateRoot}.shots`,
    "slate shots",
    violations,
  );
  let shotEntriesReady = shotsReady;
  if (shotsReady)
    shotEntriesReady = validateSlateShotEntries(
      shots,
      `${props.slateRoot}.shots`,
      violations,
    );

  const film = props.slate.film as unknown;
  let sequence: IAutoMovieSequence | null = null;
  let sequenceReady = false;
  if (film === null)
    pushViolation(
      violations,
      "type",
      `${props.slateRoot}.film`,
      "a film must be committed before captions",
      film,
    );
  else if (!isRecord(film))
    pushViolation(
      violations,
      "type",
      `${props.slateRoot}.film`,
      "slate film must be null or a JSON object",
      film,
    );
  else if (shotsReady) {
    sequence = film as unknown as IAutoMovieSequence;
    const sequenceValidation = remapRenderValidationPaths(
      validateSequenceArtifact(sequence, shots as IAutoMovieShot[]),
      [
        ["$input", `${props.slateRoot}.film`],
        ["$shots", `${props.slateRoot}.shots`],
      ],
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
  if (
    sequenceReady &&
    frameFormatReady &&
    Math.round(duration * props.frameFormat.fps) === 0
  )
    pushViolation(
      violations,
      "range",
      "$input.frameFormat.fps",
      "caption fps and film duration must produce at least one frame",
      { fps: props.frameFormat.fps, duration },
    );
  const validation = toValidation(violations);
  if (validation.success === false)
    return { validation, sidecar: null, chunks: null };

  const sidecar = planCaptionSidecar({
    script: props.slate.script!,
    sequence: sequence!,
    shots: shots as IAutoMovieShot[],
    fps: props.frameFormat.fps,
  });
  const chunks =
    props.chunkFrames === undefined
      ? null
      : sliceCaptionChunks(sidecar, props.chunkFrames);
  return { validation: { success: true }, sidecar, chunks };
};

/**
 * Gate and build the pose-keypoint plan (#1168). The slate must carry a staged
 * scene, valid shots, and a committed film; the caller-supplied motion registry
 * and skeletons are shape-gated (plus the sampling essentials the shape gate
 * does not cover: at least one keyframe, finite duration, finite keyframe
 * times) so the engine planner never throws on malformed input.
 */
const buildPoseKeypointPlan = (props: {
  slate: IAutoMovieMcpWritableSlate;
  slateRoot: string;
  frameFormat: IAutoMovieRenderFrameFormat;
  motions: Record<string, IAutoMovieMcpMotion>;
  skeletons: IAutoMovieSkeleton[];
}): IAutoMoviePlanPoseKeypointsOutput => {
  const violations: IAutoMovieConstraintViolation[] = [];
  const frameFormatReady = validateRenderFrameFormat(
    props.frameFormat,
    "$input.frameFormat",
    "keypoint",
    violations,
  );

  const scene = props.slate.scene as unknown;
  if (scene === null)
    pushViolation(
      violations,
      "type",
      `${props.slateRoot}.scene`,
      "a scene must be committed before pose keypoints",
      scene,
    );
  else
    validateObjectArtifact(
      scene,
      `${props.slateRoot}.scene`,
      "slate scene",
      violations,
    );

  const shots = props.slate.shots as unknown;
  const shotsReady =
    validateArrayArtifact(
      shots,
      `${props.slateRoot}.shots`,
      "slate shots",
      violations,
    ) &&
    validateSlateShotEntries(
      shots as unknown[],
      `${props.slateRoot}.shots`,
      violations,
    );
  // The clip this planner SAMPLES. `resolvePoseKeypoints` hands
  // `shot.cameraMotion` to `resolveCameraAt` -> `sampleClip`, which validates
  // its own track shape and throws. A resident slate arrives already checked to
  // this depth by the store's read gate (#1324); an explicit one is checked
  // only for object-ness, so the same artifact reached the same sampler under
  // two very different contracts and the shallow side threw where every sibling
  // refusal returns a located violation (#1331). One definition, the engine's.
  if (shotsReady)
    // Every entry is a record here: that is what `validateSlateShotEntries`
    // just proved, so re-testing it would add a branch nothing can reach.
    (shots as IAutoMovieShot[]).forEach((shot, index) => {
      // Exactly as wide as the consumer's requirement, and stated the same way:
      // `resolveCameraAt` takes `cameraMotion ?? null` and samples nothing for
      // either, so neither absence nor null is a fault here.
      const clip = shot.cameraMotion ?? null;
      if (clip === null) return;
      validateClipArtifact(
        clip,
        `${props.slateRoot}.shots[${index}].cameraMotion`,
        violations,
      );
    });

  const film = props.slate.film as unknown;
  let sequence: IAutoMovieSequence | null = null;
  let sequenceReady = false;
  if (film === null)
    pushViolation(
      violations,
      "type",
      `${props.slateRoot}.film`,
      "a film must be committed before pose keypoints",
      film,
    );
  else if (!isRecord(film))
    pushViolation(
      violations,
      "type",
      `${props.slateRoot}.film`,
      "slate film must be null or a JSON object",
      film,
    );
  else if (shotsReady) {
    sequence = film as unknown as IAutoMovieSequence;
    const sequenceValidation = remapRenderValidationPaths(
      validateSequenceArtifact(sequence, shots as IAutoMovieShot[]),
      [
        ["$input", `${props.slateRoot}.film`],
        ["$shots", `${props.slateRoot}.shots`],
      ],
    );
    appendValidation(violations, sequenceValidation);
    sequenceReady = sequenceValidation.success;
  }

  const motionsReady = validateObjectArtifact(
    props.motions as unknown,
    "$input.motions",
    "motion registry",
    violations,
  );
  if (motionsReady)
    for (const [key, motion] of Object.entries(props.motions)) {
      const path = `$input.motions.${key}`;
      appendMcpMotionShape(violations, motion, path);
      if (!isRecord(motion)) continue;
      // Sampling essentials the shape gate does not cover: sampleMotion throws
      // on an empty keyframe list, and a non-finite duration/time yields NaN
      // poses downstream instead of an honest refusal.
      if (Array.isArray(motion.keyframes)) {
        if (motion.keyframes.length === 0)
          pushViolation(
            violations,
            "type",
            `${path}.keyframes`,
            "a motion must have at least one keyframe to sample",
            motion.keyframes,
          );
        motion.keyframes.forEach((keyframe, index) => {
          if (isRecord(keyframe) && !Number.isFinite(keyframe.time))
            pushViolation(
              violations,
              "range",
              `${path}.keyframes[${index}].time`,
              `keyframe time must be a finite number, but was ${keyframe.time}`,
              keyframe.time,
            );
        });
        // And the order those times put the clip in. `planPoseKeypointSidecar`
        // samples this registry directly, and `sampleMotion`'s binary search
        // assumes a positive span between neighbours: out of order it selects a
        // segment that does not straddle the instant, so the sidecar's joint
        // coordinates are finite, deterministic, and not the pose the clip
        // describes (#1328).
        appendMotionClockShape(
          motion.keyframes,
          `${path}.keyframes`,
          violations,
        );
      }
      if (!Number.isFinite(motion.duration))
        pushViolation(
          violations,
          "range",
          `${path}.duration`,
          `motion duration must be a finite number, but was ${motion.duration}`,
          motion.duration,
        );
    }

  const skeletonsReady = validateArrayArtifact(
    props.skeletons as unknown,
    "$input.skeletons",
    "skeletons",
    violations,
  );
  if (skeletonsReady)
    props.skeletons.forEach((skeleton, index) =>
      appendMcpSkeletonShape(
        violations,
        skeleton,
        `$input.skeletons[${index}]`,
      ),
    );

  const duration =
    sequenceReady && sequence !== null
      ? sequenceRuntime(sequence, shots as IAutoMovieShot[])
      : 0;
  if (
    sequenceReady &&
    frameFormatReady &&
    Math.round(duration * props.frameFormat.fps) === 0
  )
    pushViolation(
      violations,
      "range",
      "$input.frameFormat.fps",
      "keypoint fps and film duration must produce at least one frame",
      { fps: props.frameFormat.fps, duration },
    );
  const validation = toValidation(violations);
  if (validation.success === false) return { validation, sidecar: null };

  return {
    validation: { success: true },
    sidecar: planPoseKeypointSidecar({
      sequence: sequence!,
      shots: shots as IAutoMovieShot[],
      scenes: [props.slate.scene as IAutoMovieScene],
      motions: Object.values(props.motions).map(toEngineMotion),
      skeletons: props.skeletons,
      fps: props.frameFormat.fps,
      aspect: props.frameFormat.width / props.frameFormat.height,
    }),
  };
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
  slateRoot: string;
  spec: IAutoMovieRenderSpec;
  passes?: string[];
  frameDir?: string;
  outputPath?: string;
  resident: boolean;
}): IAutoMoviePlanRenderOutput => {
  const violations: IAutoMovieConstraintViolation[] = [];
  const specIsRecord = isRecord(props.spec);
  validateRenderSpec(props.spec, violations);
  validateRenderPathOverrides(props, violations);
  const passes = resolveGuidePasses(props.passes, violations);
  const target = specIsRecord
    ? resolveRenderTarget(
        props.slate,
        props.slateRoot,
        props.spec.target,
        violations,
      )
    : null;
  const validation = toValidation(violations);
  if (validation.success === false) return { validation, plan: null };

  const times = frameTimes(props.spec.frameFormat.fps, target!.duration);
  if (times.length === 0)
    return {
      validation: toValidation([
        violation(
          "range",
          "$input.spec.frameFormat.fps",
          "render spec and target duration must produce at least one frame",
          { fps: props.spec.frameFormat.fps, duration: target!.duration },
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
        `guide pass "${pass}" must be one of ${AUTOMOVIE_GUIDE_PASSES.join(", ")}`,
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
    `guide pass "${pass}" must be one of ${AUTOMOVIE_GUIDE_PASSES.join(", ")}`,
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
  validateRenderFrameFormat(
    spec.frameFormat,
    "$input.spec.frameFormat",
    "render",
    violations,
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

const validateRenderFrameFormat = (
  frameFormat: IAutoMovieRenderFrameFormat,
  path: string,
  label: string,
  violations: IAutoMovieConstraintViolation[],
): boolean => {
  if (!isRecord(frameFormat)) {
    pushViolation(
      violations,
      "type",
      path,
      `${label} frame format must be a JSON object`,
      frameFormat,
    );
    return false;
  }
  validateRange(
    frameFormat.fps,
    `${path}.fps`,
    0,
    Infinity,
    `${label} fps`,
    violations,
    false,
  );
  validateRange(
    frameFormat.width,
    `${path}.width`,
    0,
    Infinity,
    `${label} width`,
    violations,
    false,
  );
  validateEvenDimension(
    frameFormat.width,
    `${path}.width`,
    `${label} width`,
    violations,
  );
  validateRange(
    frameFormat.height,
    `${path}.height`,
    0,
    Infinity,
    `${label} height`,
    violations,
    false,
  );
  validateEvenDimension(
    frameFormat.height,
    `${path}.height`,
    `${label} height`,
    violations,
  );
  return true;
};

const validateRenderPathOverrides = (
  props: { frameDir?: string; outputPath?: string },
  violations: IAutoMovieConstraintViolation[],
): void => {
  validateOptionalRenderPathOverride(
    props.frameDir,
    "$input.frameDir",
    "render frameDir override",
    violations,
  );
  validateOptionalRenderPathOverride(
    props.outputPath,
    "$input.outputPath",
    "render outputPath override",
    violations,
  );
};

const validateOptionalRenderPathOverride = (
  value: unknown,
  path: string,
  label: string,
  violations: IAutoMovieConstraintViolation[],
): void => {
  if (value === undefined) return;
  if (typeof value !== "string" || value.trim().length === 0) {
    pushViolation(
      violations,
      "type",
      path,
      `${label} must be a non-empty string`,
      value,
    );
    return;
  }
  // ffmpeg's image2 demuxer reads the -i pattern's `%` as a conversion
  // specifier (`frame_%05d.png`), so a literal `%` anywhere in the frame
  // dir/output override corrupts the pattern into reading the wrong files,
  // or none, with no error (#1089). The default paths are stem-sanitized
  // and can never carry one; only these overrides can, so refuse here.
  if (value.includes("%"))
    pushViolation(
      violations,
      "type",
      path,
      `${label} must not contain "%", ffmpeg reads it as a pattern conversion specifier`,
      value,
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

const remapRenderValidationPaths = (
  validation: IAutoMovieValidation,
  replacements: ReadonlyArray<readonly [from: string, to: string]>,
): IAutoMovieValidation => {
  if (validation.success === true) return validation;
  return {
    success: false,
    violations: validation.violations.map((item) => ({
      ...item,
      path: remapRenderPath(item.path, replacements),
    })),
  };
};

const remapRenderPath = (
  path: string,
  replacements: ReadonlyArray<readonly [from: string, to: string]>,
): string => {
  // validateSequenceArtifact roots every path at $input or $shots.
  const [from, to] = replacements.find(
    ([from]) =>
      path === from ||
      path.startsWith(`${from}.`) ||
      path.startsWith(`${from}[`),
  )!;
  return `${to}${path.slice(from.length)}`;
};

const resolveRenderTarget = (
  slate: IAutoMovieMcpWritableSlate,
  slateRoot: string,
  target: string,
  violations: IAutoMovieConstraintViolation[],
): { target: IAutoMovieMcpRenderTarget; duration: number } | null => {
  if (
    !validateArrayArtifact(
      slate.shots,
      `${slateRoot}.shots`,
      "slate shots",
      violations,
    )
  )
    return null;
  if (!validateSlateShotEntries(slate.shots, `${slateRoot}.shots`, violations))
    return null;
  const shots = slate.shots
    .map((shot, index) => ({ shot, index }))
    .filter(({ shot }) => isRecord(shot) && shot.id === target);
  if (shots.length > 1)
    pushViolation(
      violations,
      "type",
      `${slateRoot}.shots[${shots[1]!.index}].id`,
      `render target shot "${target}" must be unique`,
      target,
    );
  if (shots.length > 0) {
    const shot = shots[0]!.shot;
    validateRange(
      shot.duration,
      `${slateRoot}.shots[${shots[0]!.index}].duration`,
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
      `${slateRoot}.film`,
      "slate film must be null or a JSON object",
      slate.film,
    );
    return null;
  }

  if (slate.film !== null && slate.film.id === target) {
    const sequenceValidation = remapRenderValidationPaths(
      validateSequenceArtifact(slate.film, slate.shots),
      [
        ["$input", `${slateRoot}.film`],
        ["$shots", `${slateRoot}.shots`],
      ],
    );
    appendValidation(violations, sequenceValidation);
    if (sequenceValidation.success === false) return null;
    const duration = sequenceRuntime(slate.film, slate.shots);
    validateRange(
      duration,
      `${slateRoot}.film`,
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
    // Each caller has accepted validateSequenceArtifact, which proves that every
    // entry references a supplied shot with a numeric duration (#1040).
    const duration = entry.trim?.duration ?? shot!.duration;
    return sum + duration - (entry.transition?.duration ?? 0);
  }, 0);
};

/**
 * The plan's `times` grid (`i / fps`, exact rationals) is the single source of
 * truth for frame instants; mapping a preview time through a derived "effective
 * fps" (`frameCount / duration`) disagrees with that grid whenever `duration ×
 * fps` is not an integer. Resolve a time to the nearest grid index instead.
 */
const nearestPlanFrame = (time: number, times: number[]): number => {
  let lo = 0;
  let hi = times.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (times[mid]! < time) lo = mid + 1;
    else hi = mid;
  }
  if (lo > 0 && time - times[lo - 1]! < times[lo]! - time) return lo - 1;
  return lo;
};

const resolvePreviewFrame = (
  props: { frame?: number; time?: number },
  plan: IAutoMovieMcpRenderPlan,
  violations: IAutoMovieConstraintViolation[],
): number => {
  if (
    props.frame !== undefined &&
    (!Number.isInteger(props.frame) ||
      props.frame < 0 ||
      props.frame >= plan.frameCount)
  )
    pushViolation(
      violations,
      "range",
      "$input.frame",
      `preview frame must be an integer within [0, ${plan.frameCount - 1}]`,
      props.frame,
    );

  let timeFrame: number | null = null;
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
      timeFrame = nearestPlanFrame(props.time, plan.times);
      if (props.frame !== undefined && timeFrame !== props.frame)
        pushViolation(
          violations,
          "temporal",
          "$input.time",
          `preview time maps to frame ${timeFrame}, not frame ${props.frame}`,
          props.time,
        );
    }
  }
  return props.frame ?? timeFrame ?? 0;
};
