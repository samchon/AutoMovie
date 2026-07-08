import { toValidation, violation } from "@automovie/engine";
import {
  AutoMovieGuidePass,
  IAutoMovieConstraintViolation,
  IAutoMovieRenderSpec,
  IAutoMovieSequence,
  IAutoMovieShot,
} from "@automovie/interface";
import {
  ffmpegArgs,
  frameName,
  framePattern,
  frameTimes,
  guidePassFrameName,
  isGuidePass,
  planGuidePassOutputs,
  planSequenceRender,
  renderPathStem,
} from "@automovie/render";

import { AutoMovieContext } from "../AutoMovieContext";
import {
  IAutoMovieMcpCaptureRequest,
  IAutoMovieMcpRenderPlan,
  IAutoMovieMcpRenderTarget,
  IAutoMovieMcpWritableSlate,
  IAutoMoviePlanRenderOutput,
  IAutoMovieSeeFrameOutput,
} from "../dto";
import { validateSequenceArtifact } from "../validators/artifacts";
import {
  appendValidation,
  pushViolation,
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
}

const buildRenderPlan = (props: {
  slate: IAutoMovieMcpWritableSlate;
  spec: IAutoMovieRenderSpec;
  passes?: string[];
  frameDir?: string;
  outputPath?: string;
  resident: boolean;
}): IAutoMoviePlanRenderOutput => {
  const violations: IAutoMovieConstraintViolation[] = [];
  validateRenderSpec(props.spec, violations);
  const passes = resolveGuidePasses(props.passes, violations);
  const target = resolveRenderTarget(
    props.slate,
    props.spec.target,
    violations,
  );
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
};

const resolveRenderTarget = (
  slate: IAutoMovieMcpWritableSlate,
  target: string,
  violations: IAutoMovieConstraintViolation[],
): { target: IAutoMovieMcpRenderTarget; duration: number } | null => {
  const shots = slate.shots
    .map((shot, index) => ({ shot, index }))
    .filter(({ shot }) => shot.id === target);
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

  if (slate.film !== null && slate.film.id === target) {
    appendValidation(
      violations,
      validateSequenceArtifact(slate.film, slate.shots),
    );
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
