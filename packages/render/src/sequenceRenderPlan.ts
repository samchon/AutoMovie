import {
  IAutoMoviePlaybackTimeline,
  playbackCursor,
  sequenceTimeline,
} from "@automovie/engine";
import {
  IAutoMovieRenderSpec,
  IAutoMovieSequence,
  IAutoMovieShot,
  IAutoMovieTransition,
  IAutoMovieTrim,
} from "@automovie/interface";

import {
  ffmpegArgs,
  frameName,
  framePattern,
  frameTimes,
  renderPathStem,
} from "./plan";

/**
 * A shot entry resolved onto the sequence output clock.
 *
 * @evidence requirements/rendering/frame-schedules-and-sampling.md#rendering-frame-number-time `IAutoMovieSequenceRenderShotSpan` preserves the deterministic mapping between output frame identity and film time.
 * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-frame-schedule `IAutoMovieSequenceRenderShotSpan` exposes that responsibility through the package-independent system contract.
 * @author Samchon
 */
export interface IAutoMovieSequenceRenderShotSpan {
  /**
   * Index into `sequence.shots`.
   *
   * @evidence requirements/rendering/frame-schedules-and-sampling.md#rendering-frame-number-time `IAutoMovieSequenceRenderShotSpan.entry` preserves the deterministic mapping between output frame identity and film time.
   * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-frame-schedule `IAutoMovieSequenceRenderShotSpan.entry` exposes that responsibility through the package-independent system contract.
   * @author Samchon
   */
  entry: number;

  /**
   * Shot id played by this entry.
   *
   * @evidence requirements/rendering/frame-schedules-and-sampling.md#rendering-frame-number-time `IAutoMovieSequenceRenderShotSpan.shot` preserves the deterministic mapping between output frame identity and film time.
   * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-frame-schedule `IAutoMovieSequenceRenderShotSpan.shot` exposes that responsibility through the package-independent system contract.
   * @author Samchon
   */
  shot: string;

  /**
   * Global output second where the entry starts.
   *
   * @evidence requirements/rendering/frame-schedules-and-sampling.md#rendering-frame-number-time `IAutoMovieSequenceRenderShotSpan.start` preserves the deterministic mapping between output frame identity and film time.
   * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-frame-schedule `IAutoMovieSequenceRenderShotSpan.start` exposes that responsibility through the package-independent system contract.
   * @author Samchon
   */
  start: number;

  /**
   * Global output second where the entry ends.
   *
   * @evidence requirements/rendering/frame-schedules-and-sampling.md#rendering-frame-number-time `IAutoMovieSequenceRenderShotSpan.end` preserves the deterministic mapping between output frame identity and film time.
   * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-frame-schedule `IAutoMovieSequenceRenderShotSpan.end` exposes that responsibility through the package-independent system contract.
   * @author Samchon
   */
  end: number;

  /**
   * Seconds of the source shot that this entry plays.
   *
   * @evidence requirements/rendering/frame-schedules-and-sampling.md#rendering-frame-number-time `IAutoMovieSequenceRenderShotSpan.played` preserves the deterministic mapping between output frame identity and film time.
   * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-frame-schedule `IAutoMovieSequenceRenderShotSpan.played` exposes that responsibility through the package-independent system contract.
   * @author Samchon
   */
  played: number;

  /**
   * Source shot-local second where playback begins.
   *
   * @evidence requirements/rendering/frame-schedules-and-sampling.md#rendering-frame-number-time `IAutoMovieSequenceRenderShotSpan.offset` preserves the deterministic mapping between output frame identity and film time.
   * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-frame-schedule `IAutoMovieSequenceRenderShotSpan.offset` exposes that responsibility through the package-independent system contract.
   * @author Samchon
   */
  offset: number;

  /**
   * Trim copied from the sequence entry.
   *
   * @evidence requirements/rendering/frame-schedules-and-sampling.md#rendering-frame-number-time `IAutoMovieSequenceRenderShotSpan.trim` preserves the deterministic mapping between output frame identity and film time.
   * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-frame-schedule `IAutoMovieSequenceRenderShotSpan.trim` exposes that responsibility through the package-independent system contract.
   * @author Samchon
   */
  trim: IAutoMovieTrim | null;
}

/**
 * Incoming transition span on the output clock.
 *
 * @evidence requirements/rendering/frame-schedules-and-sampling.md#rendering-frame-number-time `IAutoMovieSequenceRenderTransitionSpan` preserves the deterministic mapping between output frame identity and film time.
 * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-frame-schedule `IAutoMovieSequenceRenderTransitionSpan` exposes that responsibility through the package-independent system contract.
 * @author Samchon
 */
export interface IAutoMovieSequenceRenderTransitionSpan {
  /**
   * Index of the incoming entry in `sequence.shots`.
   *
   * @evidence requirements/rendering/frame-schedules-and-sampling.md#rendering-frame-number-time `IAutoMovieSequenceRenderTransitionSpan.entry` preserves the deterministic mapping between output frame identity and film time.
   * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-frame-schedule `IAutoMovieSequenceRenderTransitionSpan.entry` exposes that responsibility through the package-independent system contract.
   * @author Samchon
   */
  entry: number;

  /**
   * Outgoing shot id.
   *
   * @evidence requirements/rendering/frame-schedules-and-sampling.md#rendering-frame-number-time `IAutoMovieSequenceRenderTransitionSpan.from` preserves the deterministic mapping between output frame identity and film time.
   * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-frame-schedule `IAutoMovieSequenceRenderTransitionSpan.from` exposes that responsibility through the package-independent system contract.
   * @author Samchon
   */
  from: string;

  /**
   * Incoming shot id.
   *
   * @evidence requirements/rendering/frame-schedules-and-sampling.md#rendering-frame-number-time `IAutoMovieSequenceRenderTransitionSpan.to` preserves the deterministic mapping between output frame identity and film time.
   * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-frame-schedule `IAutoMovieSequenceRenderTransitionSpan.to` exposes that responsibility through the package-independent system contract.
   * @author Samchon
   */
  to: string;

  /**
   * Transition style copied from the sequence entry.
   *
   * @evidence requirements/rendering/frame-schedules-and-sampling.md#rendering-frame-number-time `IAutoMovieSequenceRenderTransitionSpan.kind` preserves the deterministic mapping between output frame identity and film time.
   * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-frame-schedule `IAutoMovieSequenceRenderTransitionSpan.kind` exposes that responsibility through the package-independent system contract.
   * @author Samchon
   */
  kind: IAutoMovieTransition["kind"];

  /**
   * Global output second where the transition begins.
   *
   * @evidence requirements/rendering/frame-schedules-and-sampling.md#rendering-frame-number-time `IAutoMovieSequenceRenderTransitionSpan.start` preserves the deterministic mapping between output frame identity and film time.
   * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-frame-schedule `IAutoMovieSequenceRenderTransitionSpan.start` exposes that responsibility through the package-independent system contract.
   * @author Samchon
   */
  start: number;

  /**
   * Global output second where the transition ends.
   *
   * @evidence requirements/rendering/frame-schedules-and-sampling.md#rendering-frame-number-time `IAutoMovieSequenceRenderTransitionSpan.end` preserves the deterministic mapping between output frame identity and film time.
   * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-frame-schedule `IAutoMovieSequenceRenderTransitionSpan.end` exposes that responsibility through the package-independent system contract.
   * @author Samchon
   */
  end: number;

  /**
   * Transition overlap duration in seconds.
   *
   * @evidence requirements/rendering/frame-schedules-and-sampling.md#rendering-frame-number-time `IAutoMovieSequenceRenderTransitionSpan.duration` preserves the deterministic mapping between output frame identity and film time.
   * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-frame-schedule `IAutoMovieSequenceRenderTransitionSpan.duration` exposes that responsibility through the package-independent system contract.
   * @author Samchon
   */
  duration: number;
}

/**
 * A sequence frame sample ready for a render host.
 *
 * @evidence requirements/rendering/frame-schedules-and-sampling.md#rendering-frame-number-time `IAutoMovieSequenceRenderFrame` preserves the deterministic mapping between output frame identity and film time.
 * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-frame-schedule `IAutoMovieSequenceRenderFrame` exposes that responsibility through the package-independent system contract.
 * @author Samchon
 */
export interface IAutoMovieSequenceRenderFrame {
  /**
   * Zero-based output frame index.
   *
   * @evidence requirements/rendering/frame-schedules-and-sampling.md#rendering-frame-number-time `IAutoMovieSequenceRenderFrame.index` preserves the deterministic mapping between output frame identity and film time.
   * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-frame-schedule `IAutoMovieSequenceRenderFrame.index` exposes that responsibility through the package-independent system contract.
   * @author Samchon
   */
  index: number;

  /**
   * Global output sample time in seconds.
   *
   * @evidence requirements/rendering/frame-schedules-and-sampling.md#rendering-frame-number-time `IAutoMovieSequenceRenderFrame.timeSeconds` preserves the deterministic mapping between output frame identity and film time.
   * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-frame-schedule `IAutoMovieSequenceRenderFrame.timeSeconds` exposes that responsibility through the package-independent system contract.
   * @author Samchon
   */
  timeSeconds: number;

  /**
   * Frame path that the capture host should write.
   *
   * @evidence requirements/rendering/frame-schedules-and-sampling.md#rendering-frame-number-time `IAutoMovieSequenceRenderFrame.path` preserves the deterministic mapping between output frame identity and film time.
   * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-frame-schedule `IAutoMovieSequenceRenderFrame.path` exposes that responsibility through the package-independent system contract.
   * @author Samchon
   */
  path: string;

  /**
   * Live shot id at this output frame.
   *
   * @evidence requirements/rendering/frame-schedules-and-sampling.md#rendering-frame-number-time `IAutoMovieSequenceRenderFrame.shot` preserves the deterministic mapping between output frame identity and film time.
   * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-frame-schedule `IAutoMovieSequenceRenderFrame.shot` exposes that responsibility through the package-independent system contract.
   * @author Samchon
   */
  shot: string;

  /**
   * Live shot-local time in seconds.
   *
   * @evidence requirements/rendering/frame-schedules-and-sampling.md#rendering-frame-number-time `IAutoMovieSequenceRenderFrame.shotTimeSeconds` preserves the deterministic mapping between output frame identity and film time.
   * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-frame-schedule `IAutoMovieSequenceRenderFrame.shotTimeSeconds` exposes that responsibility through the package-independent system contract.
   * @author Samchon
   */
  shotTimeSeconds: number;

  /**
   * Outgoing tail blended into this frame, or `null` for a hard cut.
   *
   * @evidence requirements/rendering/frame-schedules-and-sampling.md#rendering-frame-number-time `IAutoMovieSequenceRenderFrame.blend` preserves the deterministic mapping between output frame identity and film time.
   * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-frame-schedule `IAutoMovieSequenceRenderFrame.blend` exposes that responsibility through the package-independent system contract.
   * @author Samchon
   */
  blend: {
    /** Outgoing shot id. */
    shot: string;

    /** Outgoing shot-local time in seconds. */
    shotTimeSeconds: number;

    /** Incoming weight in `[0, 1)`. */
    alpha: number;
  } | null;
}

/**
 * Public sequence render manifest: editorial timeline, transition spans, frame
 * samples, output paths, and encoder args in one deterministic artifact.
 *
 * @evidence requirements/rendering/frame-schedules-and-sampling.md#rendering-frame-number-time `IAutoMovieSequenceRenderPlan` preserves the deterministic mapping between output frame identity and film time.
 * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-frame-schedule `IAutoMovieSequenceRenderPlan` exposes that responsibility through the package-independent system contract.
 * @author Samchon
 */
export interface IAutoMovieSequenceRenderPlan {
  /**
   * Render target identity.
   *
   * @evidence requirements/rendering/frame-schedules-and-sampling.md#rendering-frame-number-time `IAutoMovieSequenceRenderPlan.target` preserves the deterministic mapping between output frame identity and film time.
   * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-frame-schedule `IAutoMovieSequenceRenderPlan.target` exposes that responsibility through the package-independent system contract.
   * @author Samchon
   */
  target: { kind: "sequence"; id: string };

  /**
   * Sequence fps as authored by the cut.
   *
   * @evidence requirements/rendering/frame-schedules-and-sampling.md#rendering-frame-number-time `IAutoMovieSequenceRenderPlan.sequenceFps` preserves the deterministic mapping between output frame identity and film time.
   * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-frame-schedule `IAutoMovieSequenceRenderPlan.sequenceFps` exposes that responsibility through the package-independent system contract.
   * @author Samchon
   */
  sequenceFps: number;

  /**
   * Output fps from the render spec.
   *
   * @evidence requirements/rendering/frame-schedules-and-sampling.md#rendering-frame-number-time `IAutoMovieSequenceRenderPlan.renderFps` preserves the deterministic mapping between output frame identity and film time.
   * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-frame-schedule `IAutoMovieSequenceRenderPlan.renderFps` exposes that responsibility through the package-independent system contract.
   * @author Samchon
   */
  renderFps: number;

  /**
   * Total output seconds after transition overlaps are subtracted.
   *
   * @evidence requirements/rendering/frame-schedules-and-sampling.md#rendering-frame-number-time `IAutoMovieSequenceRenderPlan.durationSeconds` preserves the deterministic mapping between output frame identity and film time.
   * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-frame-schedule `IAutoMovieSequenceRenderPlan.durationSeconds` exposes that responsibility through the package-independent system contract.
   * @author Samchon
   */
  durationSeconds: number;

  /**
   * Number of output frames.
   *
   * @evidence requirements/rendering/frame-schedules-and-sampling.md#rendering-frame-number-time `IAutoMovieSequenceRenderPlan.frameCount` preserves the deterministic mapping between output frame identity and film time.
   * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-frame-schedule `IAutoMovieSequenceRenderPlan.frameCount` exposes that responsibility through the package-independent system contract.
   * @author Samchon
   */
  frameCount: number;

  /**
   * Global output sample times, one per frame.
   *
   * @evidence requirements/rendering/frame-schedules-and-sampling.md#rendering-frame-number-time `IAutoMovieSequenceRenderPlan.times` preserves the deterministic mapping between output frame identity and film time.
   * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-frame-schedule `IAutoMovieSequenceRenderPlan.times` exposes that responsibility through the package-independent system contract.
   * @author Samchon
   */
  times: number[];

  /**
   * Shot spans on the output clock.
   *
   * @evidence requirements/rendering/frame-schedules-and-sampling.md#rendering-frame-number-time `IAutoMovieSequenceRenderPlan.shots` preserves the deterministic mapping between output frame identity and film time.
   * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-frame-schedule `IAutoMovieSequenceRenderPlan.shots` exposes that responsibility through the package-independent system contract.
   * @author Samchon
   */
  shots: IAutoMovieSequenceRenderShotSpan[];

  /**
   * Incoming transition spans on the output clock.
   *
   * @evidence requirements/rendering/frame-schedules-and-sampling.md#rendering-frame-number-time `IAutoMovieSequenceRenderPlan.transitionSpans` preserves the deterministic mapping between output frame identity and film time.
   * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-frame-schedule `IAutoMovieSequenceRenderPlan.transitionSpans` exposes that responsibility through the package-independent system contract.
   * @author Samchon
   */
  transitionSpans: IAutoMovieSequenceRenderTransitionSpan[];

  /**
   * Frame samples in capture order.
   *
   * @evidence requirements/rendering/frame-schedules-and-sampling.md#rendering-frame-number-time `IAutoMovieSequenceRenderPlan.frames` preserves the deterministic mapping between output frame identity and film time.
   * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-frame-schedule `IAutoMovieSequenceRenderPlan.frames` exposes that responsibility through the package-independent system contract.
   * @author Samchon
   */
  frames: IAutoMovieSequenceRenderFrame[];

  /**
   * Directory where frame files should be written.
   *
   * @evidence requirements/rendering/frame-schedules-and-sampling.md#rendering-frame-number-time `IAutoMovieSequenceRenderPlan.frameDir` preserves the deterministic mapping between output frame identity and film time.
   * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-frame-schedule `IAutoMovieSequenceRenderPlan.frameDir` exposes that responsibility through the package-independent system contract.
   * @author Samchon
   */
  frameDir: string;

  /**
   * First output frame path.
   *
   * @evidence requirements/rendering/frame-schedules-and-sampling.md#rendering-frame-number-time `IAutoMovieSequenceRenderPlan.firstFrame` preserves the deterministic mapping between output frame identity and film time.
   * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-frame-schedule `IAutoMovieSequenceRenderPlan.firstFrame` exposes that responsibility through the package-independent system contract.
   * @author Samchon
   */
  firstFrame: string;

  /**
   * Last output frame path.
   *
   * @evidence requirements/rendering/frame-schedules-and-sampling.md#rendering-frame-number-time `IAutoMovieSequenceRenderPlan.lastFrame` preserves the deterministic mapping between output frame identity and film time.
   * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-frame-schedule `IAutoMovieSequenceRenderPlan.lastFrame` exposes that responsibility through the package-independent system contract.
   * @author Samchon
   */
  lastFrame: string;

  /**
   * Ffmpeg input pattern for the frame sequence.
   *
   * @evidence requirements/rendering/frame-schedules-and-sampling.md#rendering-frame-number-time `IAutoMovieSequenceRenderPlan.inputPattern` preserves the deterministic mapping between output frame identity and film time.
   * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-frame-schedule `IAutoMovieSequenceRenderPlan.inputPattern` exposes that responsibility through the package-independent system contract.
   * @author Samchon
   */
  inputPattern: string;

  /**
   * Encoded video output path.
   *
   * @evidence requirements/rendering/frame-schedules-and-sampling.md#rendering-frame-number-time `IAutoMovieSequenceRenderPlan.outputPath` preserves the deterministic mapping between output frame identity and film time.
   * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-frame-schedule `IAutoMovieSequenceRenderPlan.outputPath` exposes that responsibility through the package-independent system contract.
   * @author Samchon
   */
  outputPath: string;

  /**
   * Exact ffmpeg argument vector for the encoded output.
   *
   * @evidence requirements/rendering/frame-schedules-and-sampling.md#rendering-frame-number-time `IAutoMovieSequenceRenderPlan.ffmpegArgs` preserves the deterministic mapping between output frame identity and film time.
   * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-frame-schedule `IAutoMovieSequenceRenderPlan.ffmpegArgs` exposes that responsibility through the package-independent system contract.
   * @author Samchon
   */
  ffmpegArgs: string[];
}

/**
 * Build the render-layer manifest for a committed sequence. The output FPS is
 * controlled by the render spec; the cut's fps is preserved as editorial
 * metadata. Trim and transition arithmetic is delegated to the engine playback
 * timeline, then copied into the manifest so the capture host has no hidden
 * timing rules.
 *
 * @evidence requirements/rendering/frame-schedules-and-sampling.md#rendering-frame-number-time `planSequenceRender` preserves the deterministic mapping between output frame identity and film time.
 * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-frame-schedule `planSequenceRender` exposes that responsibility through the package-independent system contract.
 * @evidence requirements/editorial/rational-time-and-ranges.md#editorial-time-ranges Carries trims and resolved shot spans as explicit output-clock ranges.
 * @evidence requirements/editorial/rational-time-and-ranges.md#editorial-time-transforms Preserves shot-local offsets when mapping the cut onto the output clock.
 * @evidence specifications/editorial-render-and-delivery/rational-timeline-and-composition.md#spec-editorial-clip-boundaries Materializes trim and source-offset boundaries in the render manifest.
 * @evidence specifications/editorial-render-and-delivery/rational-timeline-and-composition.md#spec-editorial-transition-overlap Materializes transition overlap and blend samples without hidden timing rules.
 * @evidenceExclude requirements/editorial/README.md#편집-요구사항 Render planning computes schedules, paths, pass manifests, and encoder arguments; runtime publication and recovery remain outside this planner.
 * @evidenceExclude requirements/editorial/rational-time-and-ranges.md#editorial-canonical-time Render planning computes schedules, paths, pass manifests, and encoder arguments; runtime publication and recovery remain outside this planner.
 * @evidenceExclude requirements/editorial/rational-time-and-ranges.md#editorial-frame-grid Render planning computes schedules, paths, pass manifests, and encoder arguments; runtime publication and recovery remain outside this planner.
 * @evidenceExclude requirements/editorial/rational-time-and-ranges.md#editorial-mixed-timebases Render planning computes schedules, paths, pass manifests, and encoder arguments; runtime publication and recovery remain outside this planner.
 * @evidenceExclude requirements/editorial/rational-time-and-ranges.md#editorial-range-operations Render planning computes schedules, paths, pass manifests, and encoder arguments; runtime publication and recovery remain outside this planner.
 * @evidenceExclude requirements/editorial/rational-time-and-ranges.md#editorial-time-refusal Render planning computes schedules, paths, pass manifests, and encoder arguments; runtime publication and recovery remain outside this planner.
 * @evidenceExclude requirements/rendering/README.md#rendering-요구사항 Render planning computes schedules, paths, pass manifests, and encoder arguments; runtime publication and recovery remain outside this planner.
 * @evidenceExclude requirements/rendering/encoding-and-multiplexing.md#rendering-encode-atomic-output Render planning computes schedules, paths, pass manifests, and encoder arguments; runtime publication and recovery remain outside this planner.
 * @evidenceExclude requirements/rendering/encoding-and-multiplexing.md#rendering-encode-refusal Render planning computes schedules, paths, pass manifests, and encoder arguments; runtime publication and recovery remain outside this planner.
 * @evidenceExclude requirements/rendering/encoding-and-multiplexing.md#rendering-encode-retry Render planning computes schedules, paths, pass manifests, and encoder arguments; runtime publication and recovery remain outside this planner.
 * @evidenceExclude requirements/rendering/encoding-and-multiplexing.md#rendering-encode-stream-selection Render planning computes schedules, paths, pass manifests, and encoder arguments; runtime publication and recovery remain outside this planner.
 * @evidenceExclude requirements/rendering/encoding-and-multiplexing.md#rendering-encode-timestamps Render planning computes schedules, paths, pass manifests, and encoder arguments; runtime publication and recovery remain outside this planner.
 * @evidenceExclude requirements/rendering/frame-schedules-and-sampling.md#rendering-frame-boundary-convention Render planning computes schedules, paths, pass manifests, and encoder arguments; runtime publication and recovery remain outside this planner.
 * @evidenceExclude requirements/rendering/frame-schedules-and-sampling.md#rendering-schedule-audio-cues Render planning computes schedules, paths, pass manifests, and encoder arguments; runtime publication and recovery remain outside this planner.
 * @evidenceExclude requirements/rendering/frame-schedules-and-sampling.md#rendering-schedule-refusal Render planning computes schedules, paths, pass manifests, and encoder arguments; runtime publication and recovery remain outside this planner.
 * @evidenceExclude requirements/rendering/frame-schedules-and-sampling.md#rendering-shutter-samples Render planning computes schedules, paths, pass manifests, and encoder arguments; runtime publication and recovery remain outside this planner.
 * @evidenceExclude requirements/rendering/frame-schedules-and-sampling.md#rendering-state-sampling Render planning computes schedules, paths, pass manifests, and encoder arguments; runtime publication and recovery remain outside this planner.
 * @evidenceExclude requirements/rendering/frame-schedules-and-sampling.md#rendering-subrange-stability Render planning computes schedules, paths, pass manifests, and encoder arguments; runtime publication and recovery remain outside this planner.
 * @evidenceExclude requirements/rendering/passes-channels-and-products.md#rendering-arbitrary-channels Render planning computes schedules, paths, pass manifests, and encoder arguments; runtime publication and recovery remain outside this planner.
 * @evidenceExclude requirements/rendering/passes-channels-and-products.md#rendering-beauty-structural-distinction Render planning computes schedules, paths, pass manifests, and encoder arguments; runtime publication and recovery remain outside this planner.
 * @evidenceExclude requirements/rendering/passes-channels-and-products.md#rendering-identity-mask-channels Render planning computes schedules, paths, pass manifests, and encoder arguments; runtime publication and recovery remain outside this planner.
 * @evidenceExclude requirements/rendering/passes-channels-and-products.md#rendering-multiview-products Render planning computes schedules, paths, pass manifests, and encoder arguments; runtime publication and recovery remain outside this planner.
 * @evidenceExclude requirements/rendering/passes-channels-and-products.md#rendering-partial-product-set Render planning computes schedules, paths, pass manifests, and encoder arguments; runtime publication and recovery remain outside this planner.
 * @evidenceExclude requirements/rendering/passes-channels-and-products.md#rendering-pass-refusal Render planning computes schedules, paths, pass manifests, and encoder arguments; runtime publication and recovery remain outside this planner.
 * @evidenceExclude requirements/rendering/scope-and-artifact-identity.md#rendering-artifact-invalidation Render planning computes schedules, paths, pass manifests, and encoder arguments; runtime publication and recovery remain outside this planner.
 * @evidenceExclude requirements/rendering/scope-and-artifact-identity.md#rendering-compile-render-distinction Render planning computes schedules, paths, pass manifests, and encoder arguments; runtime publication and recovery remain outside this planner.
 * @evidenceExclude requirements/rendering/scope-and-artifact-identity.md#rendering-deterministic-lane Render planning computes schedules, paths, pass manifests, and encoder arguments; runtime publication and recovery remain outside this planner.
 * @evidenceExclude requirements/rendering/scope-and-artifact-identity.md#rendering-missing-artifact-refusal Render planning computes schedules, paths, pass manifests, and encoder arguments; runtime publication and recovery remain outside this planner.
 * @evidenceExclude requirements/rendering/scope-and-artifact-identity.md#rendering-partial-artifact Render planning computes schedules, paths, pass manifests, and encoder arguments; runtime publication and recovery remain outside this planner.
 * @evidenceExclude requirements/rendering/scope-and-artifact-identity.md#rendering-product-scope Render planning computes schedules, paths, pass manifests, and encoder arguments; runtime publication and recovery remain outside this planner.
 * @evidenceExclude specifications/editorial-render-and-delivery/README.md#editorial-render와-delivery-system-specifications Render planning describes schedule and pass inputs; runtime validation, publication, and unsupported editorial composition remain separate.
 * @evidenceExclude specifications/editorial-render-and-delivery/rational-timeline-and-composition.md#spec-editorial-rational-timeline Render planning describes schedule and pass inputs; runtime validation, publication, and unsupported editorial composition remain separate.
 * @evidenceExclude specifications/editorial-render-and-delivery/rational-timeline-and-composition.md#spec-editorial-track-composition Render planning describes schedule and pass inputs; runtime validation, publication, and unsupported editorial composition remain separate.
 * @evidenceExclude specifications/editorial-render-and-delivery/render-encoding-and-validation.md#spec-render-validation Render planning describes schedule and pass inputs; runtime validation, publication, and unsupported editorial composition remain separate.
 * @evidenceExclude specifications/editorial-render-and-delivery/render-products-visibility-and-color.md#spec-render-material-color Render planning describes schedule and pass inputs; runtime validation, publication, and unsupported editorial composition remain separate.
 * @evidenceExclude specifications/editorial-render-and-delivery/render-products-visibility-and-color.md#spec-render-visibility-culling Render planning describes schedule and pass inputs; runtime validation, publication, and unsupported editorial composition remain separate.
 * @evidenceExclude specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-headless-platform Render planning describes schedule and pass inputs; runtime validation, publication, and unsupported editorial composition remain separate.
 * @evidenceExclude specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-state-isolation Render planning describes schedule and pass inputs; runtime validation, publication, and unsupported editorial composition remain separate.
 * @author Samchon
 */
export const planSequenceRender = (props: {
  /** Sequence being rendered. */
  sequence: IAutoMovieSequence;

  /** Committed shots referenced by the sequence. */
  shots: IAutoMovieShot[];

  /** Render parameters whose `target` must equal `sequence.id`. */
  spec: IAutoMovieRenderSpec;

  /** Optional frame directory override. */
  frameDir?: string;

  /** Optional encoded output path override. */
  outputPath?: string;
}): IAutoMovieSequenceRenderPlan => {
  if (props.spec.target !== props.sequence.id)
    throw new Error(
      `render spec target "${props.spec.target}" must equal sequence "${props.sequence.id}"`,
    );

  const timeline = sequenceTimeline(props.sequence, props.shots);
  const times = frameTimes(props.spec.frameFormat.fps, timeline.runtime);
  if (times.length === 0)
    throw new Error(
      `planSequenceRender requires at least one frame; fps ${props.spec.frameFormat.fps} and duration ${timeline.runtime} produced zero frames`,
    );

  const stem = renderPathStem(props.sequence.id);
  const frameDir = props.frameDir ?? `frames/${stem}`;
  const outputPath = props.outputPath ?? `${stem}.mp4`;
  const inputPattern = `${frameDir}/${framePattern()}`;
  return {
    target: { kind: "sequence", id: props.sequence.id },
    sequenceFps: props.sequence.fps,
    renderFps: props.spec.frameFormat.fps,
    durationSeconds: timeline.runtime,
    frameCount: times.length,
    times,
    shots: timeline.entries.map((entry) => ({
      entry: entry.entry,
      shot: entry.shot,
      start: entry.start,
      end: entry.start + entry.played,
      played: entry.played,
      offset: entry.offset,
      trim: props.sequence.shots[entry.entry]!.trim,
    })),
    transitionSpans: transitionSpans(props.sequence, timeline),
    frames: frameSamples(props.sequence, timeline, times, frameDir),
    frameDir,
    firstFrame: `${frameDir}/${frameName(0)}`,
    lastFrame: `${frameDir}/${frameName(times.length - 1)}`,
    inputPattern,
    outputPath,
    ffmpegArgs: ffmpegArgs(props.spec, inputPattern, outputPath),
  };
};

const transitionSpans = (
  sequence: IAutoMovieSequence,
  timeline: IAutoMoviePlaybackTimeline,
): IAutoMovieSequenceRenderTransitionSpan[] =>
  timeline.entries.flatMap((entry) => {
    const transition = sequence.shots[entry.entry]!.transition;
    if (transition === null) return [];
    const outgoing = timeline.entries[entry.entry - 1]!;
    return [
      {
        entry: entry.entry,
        from: outgoing.shot,
        to: entry.shot,
        kind: transition.kind,
        start: entry.start,
        end: entry.start + transition.duration,
        duration: transition.duration,
      },
    ];
  });

/**
 * Resolve every output frame in one forward sweep. Frame times come from
 * {@link frameTimes} (`i / fps`, strictly increasing), so a single
 * {@link playbackCursor} walks the timeline once, O(frames + entries) instead of
 * a per-frame scan, landing on the same live entry a per-frame resolve would,
 * so the samples are byte-identical.
 */
const frameSamples = (
  sequence: IAutoMovieSequence,
  timeline: IAutoMoviePlaybackTimeline,
  times: number[],
  frameDir: string,
): IAutoMovieSequenceRenderFrame[] => {
  const cursor = playbackCursor(sequence, timeline);
  return times.map((time, index): IAutoMovieSequenceRenderFrame => {
    const sample = cursor(time);
    return {
      index,
      timeSeconds: time,
      path: `${frameDir}/${frameName(index)}`,
      shot: sample.shot,
      shotTimeSeconds: sample.time,
      blend:
        sample.blend === null
          ? null
          : {
              shot: sample.blend.shot,
              shotTimeSeconds: sample.blend.time,
              alpha: sample.blend.alpha,
            },
    };
  });
};
