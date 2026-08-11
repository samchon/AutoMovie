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
 * @author Samchon
 * @evidence requirements/rendering/frame-schedules-and-sampling.md#rendering-frame-number-time `IAutoMovieSequenceRenderShotSpan` preserves the deterministic mapping between output frame identity and film time.
 * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-frame-schedule `IAutoMovieSequenceRenderShotSpan` exposes that responsibility through the package-independent system contract.
 */
export interface IAutoMovieSequenceRenderShotSpan {
  /**
   * Index into `sequence.shots`.
   *
   * @author Samchon
   * @evidence requirements/rendering/frame-schedules-and-sampling.md#rendering-frame-number-time `IAutoMovieSequenceRenderShotSpan.entry` preserves the deterministic mapping between output frame identity and film time.
   * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-frame-schedule `IAutoMovieSequenceRenderShotSpan.entry` exposes that responsibility through the package-independent system contract.
   */
  entry: number;

  /**
   * Shot id played by this entry.
   *
   * @author Samchon
   * @evidence requirements/rendering/frame-schedules-and-sampling.md#rendering-frame-number-time `IAutoMovieSequenceRenderShotSpan.shot` preserves the deterministic mapping between output frame identity and film time.
   * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-frame-schedule `IAutoMovieSequenceRenderShotSpan.shot` exposes that responsibility through the package-independent system contract.
   */
  shot: string;

  /**
   * Global output second where the entry starts.
   *
   * @author Samchon
   * @evidence requirements/rendering/frame-schedules-and-sampling.md#rendering-frame-number-time `IAutoMovieSequenceRenderShotSpan.start` preserves the deterministic mapping between output frame identity and film time.
   * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-frame-schedule `IAutoMovieSequenceRenderShotSpan.start` exposes that responsibility through the package-independent system contract.
   */
  start: number;

  /**
   * Global output second where the entry ends.
   *
   * @author Samchon
   * @evidence requirements/rendering/frame-schedules-and-sampling.md#rendering-frame-number-time `IAutoMovieSequenceRenderShotSpan.end` preserves the deterministic mapping between output frame identity and film time.
   * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-frame-schedule `IAutoMovieSequenceRenderShotSpan.end` exposes that responsibility through the package-independent system contract.
   */
  end: number;

  /**
   * Seconds of the source shot that this entry plays.
   *
   * @author Samchon
   * @evidence requirements/rendering/frame-schedules-and-sampling.md#rendering-frame-number-time `IAutoMovieSequenceRenderShotSpan.played` preserves the deterministic mapping between output frame identity and film time.
   * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-frame-schedule `IAutoMovieSequenceRenderShotSpan.played` exposes that responsibility through the package-independent system contract.
   */
  played: number;

  /**
   * Source shot-local second where playback begins.
   *
   * @author Samchon
   * @evidence requirements/rendering/frame-schedules-and-sampling.md#rendering-frame-number-time `IAutoMovieSequenceRenderShotSpan.offset` preserves the deterministic mapping between output frame identity and film time.
   * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-frame-schedule `IAutoMovieSequenceRenderShotSpan.offset` exposes that responsibility through the package-independent system contract.
   */
  offset: number;

  /**
   * Trim copied from the sequence entry.
   *
   * @author Samchon
   * @evidence requirements/rendering/frame-schedules-and-sampling.md#rendering-frame-number-time `IAutoMovieSequenceRenderShotSpan.trim` preserves the deterministic mapping between output frame identity and film time.
   * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-frame-schedule `IAutoMovieSequenceRenderShotSpan.trim` exposes that responsibility through the package-independent system contract.
   */
  trim: IAutoMovieTrim | null;
}

/**
 * Incoming transition span on the output clock.
 *
 * @author Samchon
 * @evidence requirements/rendering/frame-schedules-and-sampling.md#rendering-frame-number-time `IAutoMovieSequenceRenderTransitionSpan` preserves the deterministic mapping between output frame identity and film time.
 * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-frame-schedule `IAutoMovieSequenceRenderTransitionSpan` exposes that responsibility through the package-independent system contract.
 */
export interface IAutoMovieSequenceRenderTransitionSpan {
  /**
   * Index of the incoming entry in `sequence.shots`.
   *
   * @author Samchon
   * @evidence requirements/rendering/frame-schedules-and-sampling.md#rendering-frame-number-time `IAutoMovieSequenceRenderTransitionSpan.entry` preserves the deterministic mapping between output frame identity and film time.
   * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-frame-schedule `IAutoMovieSequenceRenderTransitionSpan.entry` exposes that responsibility through the package-independent system contract.
   */
  entry: number;

  /**
   * Outgoing shot id.
   *
   * @author Samchon
   * @evidence requirements/rendering/frame-schedules-and-sampling.md#rendering-frame-number-time `IAutoMovieSequenceRenderTransitionSpan.from` preserves the deterministic mapping between output frame identity and film time.
   * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-frame-schedule `IAutoMovieSequenceRenderTransitionSpan.from` exposes that responsibility through the package-independent system contract.
   */
  from: string;

  /**
   * Incoming shot id.
   *
   * @author Samchon
   * @evidence requirements/rendering/frame-schedules-and-sampling.md#rendering-frame-number-time `IAutoMovieSequenceRenderTransitionSpan.to` preserves the deterministic mapping between output frame identity and film time.
   * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-frame-schedule `IAutoMovieSequenceRenderTransitionSpan.to` exposes that responsibility through the package-independent system contract.
   */
  to: string;

  /**
   * Transition style copied from the sequence entry.
   *
   * @author Samchon
   * @evidence requirements/rendering/frame-schedules-and-sampling.md#rendering-frame-number-time `IAutoMovieSequenceRenderTransitionSpan.kind` preserves the deterministic mapping between output frame identity and film time.
   * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-frame-schedule `IAutoMovieSequenceRenderTransitionSpan.kind` exposes that responsibility through the package-independent system contract.
   */
  kind: IAutoMovieTransition["kind"];

  /**
   * Global output second where the transition begins.
   *
   * @author Samchon
   * @evidence requirements/rendering/frame-schedules-and-sampling.md#rendering-frame-number-time `IAutoMovieSequenceRenderTransitionSpan.start` preserves the deterministic mapping between output frame identity and film time.
   * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-frame-schedule `IAutoMovieSequenceRenderTransitionSpan.start` exposes that responsibility through the package-independent system contract.
   */
  start: number;

  /**
   * Global output second where the transition ends.
   *
   * @author Samchon
   * @evidence requirements/rendering/frame-schedules-and-sampling.md#rendering-frame-number-time `IAutoMovieSequenceRenderTransitionSpan.end` preserves the deterministic mapping between output frame identity and film time.
   * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-frame-schedule `IAutoMovieSequenceRenderTransitionSpan.end` exposes that responsibility through the package-independent system contract.
   */
  end: number;

  /**
   * Transition overlap duration in seconds.
   *
   * @author Samchon
   * @evidence requirements/rendering/frame-schedules-and-sampling.md#rendering-frame-number-time `IAutoMovieSequenceRenderTransitionSpan.duration` preserves the deterministic mapping between output frame identity and film time.
   * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-frame-schedule `IAutoMovieSequenceRenderTransitionSpan.duration` exposes that responsibility through the package-independent system contract.
   */
  duration: number;
}

/**
 * A sequence frame sample ready for a render host.
 *
 * @author Samchon
 * @evidence requirements/rendering/frame-schedules-and-sampling.md#rendering-frame-number-time `IAutoMovieSequenceRenderFrame` preserves the deterministic mapping between output frame identity and film time.
 * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-frame-schedule `IAutoMovieSequenceRenderFrame` exposes that responsibility through the package-independent system contract.
 */
export interface IAutoMovieSequenceRenderFrame {
  /**
   * Zero-based output frame index.
   *
   * @author Samchon
   * @evidence requirements/rendering/frame-schedules-and-sampling.md#rendering-frame-number-time `IAutoMovieSequenceRenderFrame.index` preserves the deterministic mapping between output frame identity and film time.
   * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-frame-schedule `IAutoMovieSequenceRenderFrame.index` exposes that responsibility through the package-independent system contract.
   */
  index: number;

  /**
   * Global output sample time in seconds.
   *
   * @author Samchon
   * @evidence requirements/rendering/frame-schedules-and-sampling.md#rendering-frame-number-time `IAutoMovieSequenceRenderFrame.timeSeconds` preserves the deterministic mapping between output frame identity and film time.
   * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-frame-schedule `IAutoMovieSequenceRenderFrame.timeSeconds` exposes that responsibility through the package-independent system contract.
   */
  timeSeconds: number;

  /**
   * Frame path that the capture host should write.
   *
   * @author Samchon
   * @evidence requirements/rendering/frame-schedules-and-sampling.md#rendering-frame-number-time `IAutoMovieSequenceRenderFrame.path` preserves the deterministic mapping between output frame identity and film time.
   * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-frame-schedule `IAutoMovieSequenceRenderFrame.path` exposes that responsibility through the package-independent system contract.
   */
  path: string;

  /**
   * Live shot id at this output frame.
   *
   * @author Samchon
   * @evidence requirements/rendering/frame-schedules-and-sampling.md#rendering-frame-number-time `IAutoMovieSequenceRenderFrame.shot` preserves the deterministic mapping between output frame identity and film time.
   * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-frame-schedule `IAutoMovieSequenceRenderFrame.shot` exposes that responsibility through the package-independent system contract.
   */
  shot: string;

  /**
   * Live shot-local time in seconds.
   *
   * @author Samchon
   * @evidence requirements/rendering/frame-schedules-and-sampling.md#rendering-frame-number-time `IAutoMovieSequenceRenderFrame.shotTimeSeconds` preserves the deterministic mapping between output frame identity and film time.
   * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-frame-schedule `IAutoMovieSequenceRenderFrame.shotTimeSeconds` exposes that responsibility through the package-independent system contract.
   */
  shotTimeSeconds: number;

  /**
   * Outgoing tail blended into this frame, or `null` for a hard cut.
   *
   * @author Samchon
   * @evidence requirements/rendering/frame-schedules-and-sampling.md#rendering-frame-number-time `IAutoMovieSequenceRenderFrame.blend` preserves the deterministic mapping between output frame identity and film time.
   * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-frame-schedule `IAutoMovieSequenceRenderFrame.blend` exposes that responsibility through the package-independent system contract.
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
 * @author Samchon
 * @evidence requirements/rendering/frame-schedules-and-sampling.md#rendering-frame-number-time `IAutoMovieSequenceRenderPlan` preserves the deterministic mapping between output frame identity and film time.
 * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-frame-schedule `IAutoMovieSequenceRenderPlan` exposes that responsibility through the package-independent system contract.
 */
export interface IAutoMovieSequenceRenderPlan {
  /**
   * Render target identity.
   *
   * @author Samchon
   * @evidence requirements/rendering/frame-schedules-and-sampling.md#rendering-frame-number-time `IAutoMovieSequenceRenderPlan.target` preserves the deterministic mapping between output frame identity and film time.
   * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-frame-schedule `IAutoMovieSequenceRenderPlan.target` exposes that responsibility through the package-independent system contract.
   */
  target: { kind: "sequence"; id: string };

  /**
   * Sequence fps as authored by the cut.
   *
   * @author Samchon
   * @evidence requirements/rendering/frame-schedules-and-sampling.md#rendering-frame-number-time `IAutoMovieSequenceRenderPlan.sequenceFps` preserves the deterministic mapping between output frame identity and film time.
   * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-frame-schedule `IAutoMovieSequenceRenderPlan.sequenceFps` exposes that responsibility through the package-independent system contract.
   */
  sequenceFps: number;

  /**
   * Output fps from the render spec.
   *
   * @author Samchon
   * @evidence requirements/rendering/frame-schedules-and-sampling.md#rendering-frame-number-time `IAutoMovieSequenceRenderPlan.renderFps` preserves the deterministic mapping between output frame identity and film time.
   * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-frame-schedule `IAutoMovieSequenceRenderPlan.renderFps` exposes that responsibility through the package-independent system contract.
   */
  renderFps: number;

  /**
   * Total output seconds after transition overlaps are subtracted.
   *
   * @author Samchon
   * @evidence requirements/rendering/frame-schedules-and-sampling.md#rendering-frame-number-time `IAutoMovieSequenceRenderPlan.durationSeconds` preserves the deterministic mapping between output frame identity and film time.
   * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-frame-schedule `IAutoMovieSequenceRenderPlan.durationSeconds` exposes that responsibility through the package-independent system contract.
   */
  durationSeconds: number;

  /**
   * Number of output frames.
   *
   * @author Samchon
   * @evidence requirements/rendering/frame-schedules-and-sampling.md#rendering-frame-number-time `IAutoMovieSequenceRenderPlan.frameCount` preserves the deterministic mapping between output frame identity and film time.
   * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-frame-schedule `IAutoMovieSequenceRenderPlan.frameCount` exposes that responsibility through the package-independent system contract.
   */
  frameCount: number;

  /**
   * Global output sample times, one per frame.
   *
   * @author Samchon
   * @evidence requirements/rendering/frame-schedules-and-sampling.md#rendering-frame-number-time `IAutoMovieSequenceRenderPlan.times` preserves the deterministic mapping between output frame identity and film time.
   * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-frame-schedule `IAutoMovieSequenceRenderPlan.times` exposes that responsibility through the package-independent system contract.
   */
  times: number[];

  /**
   * Shot spans on the output clock.
   *
   * @author Samchon
   * @evidence requirements/rendering/frame-schedules-and-sampling.md#rendering-frame-number-time `IAutoMovieSequenceRenderPlan.shots` preserves the deterministic mapping between output frame identity and film time.
   * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-frame-schedule `IAutoMovieSequenceRenderPlan.shots` exposes that responsibility through the package-independent system contract.
   */
  shots: IAutoMovieSequenceRenderShotSpan[];

  /**
   * Incoming transition spans on the output clock.
   *
   * @author Samchon
   * @evidence requirements/rendering/frame-schedules-and-sampling.md#rendering-frame-number-time `IAutoMovieSequenceRenderPlan.transitionSpans` preserves the deterministic mapping between output frame identity and film time.
   * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-frame-schedule `IAutoMovieSequenceRenderPlan.transitionSpans` exposes that responsibility through the package-independent system contract.
   */
  transitionSpans: IAutoMovieSequenceRenderTransitionSpan[];

  /**
   * Frame samples in capture order.
   *
   * @author Samchon
   * @evidence requirements/rendering/frame-schedules-and-sampling.md#rendering-frame-number-time `IAutoMovieSequenceRenderPlan.frames` preserves the deterministic mapping between output frame identity and film time.
   * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-frame-schedule `IAutoMovieSequenceRenderPlan.frames` exposes that responsibility through the package-independent system contract.
   */
  frames: IAutoMovieSequenceRenderFrame[];

  /**
   * Directory where frame files should be written.
   *
   * @author Samchon
   * @evidence requirements/rendering/frame-schedules-and-sampling.md#rendering-frame-number-time `IAutoMovieSequenceRenderPlan.frameDir` preserves the deterministic mapping between output frame identity and film time.
   * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-frame-schedule `IAutoMovieSequenceRenderPlan.frameDir` exposes that responsibility through the package-independent system contract.
   */
  frameDir: string;

  /**
   * First output frame path.
   *
   * @author Samchon
   * @evidence requirements/rendering/frame-schedules-and-sampling.md#rendering-frame-number-time `IAutoMovieSequenceRenderPlan.firstFrame` preserves the deterministic mapping between output frame identity and film time.
   * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-frame-schedule `IAutoMovieSequenceRenderPlan.firstFrame` exposes that responsibility through the package-independent system contract.
   */
  firstFrame: string;

  /**
   * Last output frame path.
   *
   * @author Samchon
   * @evidence requirements/rendering/frame-schedules-and-sampling.md#rendering-frame-number-time `IAutoMovieSequenceRenderPlan.lastFrame` preserves the deterministic mapping between output frame identity and film time.
   * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-frame-schedule `IAutoMovieSequenceRenderPlan.lastFrame` exposes that responsibility through the package-independent system contract.
   */
  lastFrame: string;

  /**
   * Ffmpeg input pattern for the frame sequence.
   *
   * @author Samchon
   * @evidence requirements/rendering/frame-schedules-and-sampling.md#rendering-frame-number-time `IAutoMovieSequenceRenderPlan.inputPattern` preserves the deterministic mapping between output frame identity and film time.
   * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-frame-schedule `IAutoMovieSequenceRenderPlan.inputPattern` exposes that responsibility through the package-independent system contract.
   */
  inputPattern: string;

  /**
   * Encoded video output path.
   *
   * @author Samchon
   * @evidence requirements/rendering/frame-schedules-and-sampling.md#rendering-frame-number-time `IAutoMovieSequenceRenderPlan.outputPath` preserves the deterministic mapping between output frame identity and film time.
   * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-frame-schedule `IAutoMovieSequenceRenderPlan.outputPath` exposes that responsibility through the package-independent system contract.
   */
  outputPath: string;

  /**
   * Exact ffmpeg argument vector for the encoded output.
   *
   * @author Samchon
   * @evidence requirements/rendering/frame-schedules-and-sampling.md#rendering-frame-number-time `IAutoMovieSequenceRenderPlan.ffmpegArgs` preserves the deterministic mapping between output frame identity and film time.
   * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-frame-schedule `IAutoMovieSequenceRenderPlan.ffmpegArgs` exposes that responsibility through the package-independent system contract.
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
 * @author Samchon
 * @evidence requirements/rendering/frame-schedules-and-sampling.md#rendering-frame-number-time `planSequenceRender` preserves the deterministic mapping between output frame identity and film time.
 * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-frame-schedule `planSequenceRender` exposes that responsibility through the package-independent system contract.
 * @evidence requirements/editorial/rational-time-and-ranges.md#editorial-time-ranges Carries trims and resolved shot spans as explicit output-clock ranges.
 * @evidence requirements/editorial/rational-time-and-ranges.md#editorial-time-transforms Preserves shot-local offsets when mapping the cut onto the output clock.
 * @evidence specifications/editorial-render-and-delivery/rational-timeline-and-composition.md#spec-editorial-clip-boundaries Materializes trim and source-offset boundaries in the render manifest.
 * @evidence specifications/editorial-render-and-delivery/rational-timeline-and-composition.md#spec-editorial-transition-overlap Materializes transition overlap and blend samples without hidden timing rules.
 * @evidence specifications/editorial-render-and-delivery/rational-timeline-and-composition.md#spec-editorial-rational-timeline Applies the canonical range algebra and source-to-film time transforms to the sequence schedule.
 * @evidenceExclude requirements/editorial/README.md#편집-요구사항 The render surface consumes an already authored timeline; editorial authority, composition, version choice, and continuity decisions remain with the editorial layer.
 * @evidenceExclude requirements/editorial/clips-source-ranges-and-handles.md#editorial-clip-boundary-result The render surface consumes an already authored timeline; editorial authority, composition, version choice, and continuity decisions remain with the editorial layer.
 * @evidenceExclude requirements/editorial/clips-source-ranges-and-handles.md#editorial-clip-handles The render surface consumes an already authored timeline; editorial authority, composition, version choice, and continuity decisions remain with the editorial layer.
 * @evidenceExclude requirements/editorial/clips-source-ranges-and-handles.md#editorial-clip-refusal The render surface consumes an already authored timeline; editorial authority, composition, version choice, and continuity decisions remain with the editorial layer.
 * @evidenceExclude requirements/editorial/clips-source-ranges-and-handles.md#editorial-clip-replacement The render surface consumes an already authored timeline; editorial authority, composition, version choice, and continuity decisions remain with the editorial layer.
 * @evidenceExclude requirements/editorial/clips-source-ranges-and-handles.md#editorial-clip-retime-direction The render surface consumes an already authored timeline; editorial authority, composition, version choice, and continuity decisions remain with the editorial layer.
 * @evidenceExclude requirements/editorial/clips-source-ranges-and-handles.md#editorial-missing-generated-media The render surface consumes an already authored timeline; editorial authority, composition, version choice, and continuity decisions remain with the editorial layer.
 * @evidenceExclude requirements/editorial/clips-source-ranges-and-handles.md#editorial-source-film-range The render surface consumes an already authored timeline; editorial authority, composition, version choice, and continuity decisions remain with the editorial layer.
 * @evidenceExclude requirements/editorial/conform-and-media-references.md#editorial-conform-publication The render surface consumes an already authored timeline; editorial authority, composition, version choice, and continuity decisions remain with the editorial layer.
 * @evidenceExclude requirements/editorial/conform-and-media-references.md#editorial-conform-refusal The render surface consumes an already authored timeline; editorial authority, composition, version choice, and continuity decisions remain with the editorial layer.
 * @evidenceExclude requirements/editorial/conform-and-media-references.md#editorial-image-sequence-movie The render surface consumes an already authored timeline; editorial authority, composition, version choice, and continuity decisions remain with the editorial layer.
 * @evidenceExclude requirements/editorial/conform-and-media-references.md#editorial-media-relink The render surface consumes an already authored timeline; editorial authority, composition, version choice, and continuity decisions remain with the editorial layer.
 * @evidenceExclude requirements/editorial/conform-and-media-references.md#editorial-partial-conform-recovery The render surface consumes an already authored timeline; editorial authority, composition, version choice, and continuity decisions remain with the editorial layer.
 * @evidenceExclude requirements/editorial/conform-and-media-references.md#editorial-proxy-final-conform The render surface consumes an already authored timeline; editorial authority, composition, version choice, and continuity decisions remain with the editorial layer.
 * @evidenceExclude requirements/editorial/conform-and-media-references.md#editorial-reference-resolution The render surface consumes an already authored timeline; editorial authority, composition, version choice, and continuity decisions remain with the editorial layer.
 * @evidenceExclude requirements/editorial/conform-and-media-references.md#editorial-time-channel-conform The render surface consumes an already authored timeline; editorial authority, composition, version choice, and continuity decisions remain with the editorial layer.
 * @evidenceExclude requirements/editorial/continuity-and-film-grammar.md#editorial-continuity-finding The render surface consumes an already authored timeline; editorial authority, composition, version choice, and continuity decisions remain with the editorial layer.
 * @evidenceExclude requirements/editorial/continuity-and-film-grammar.md#editorial-continuity-incomplete The render surface consumes an already authored timeline; editorial authority, composition, version choice, and continuity decisions remain with the editorial layer.
 * @evidenceExclude requirements/editorial/continuity-and-film-grammar.md#editorial-grammar-violation The render surface consumes an already authored timeline; editorial authority, composition, version choice, and continuity decisions remain with the editorial layer.
 * @evidenceExclude requirements/editorial/continuity-and-film-grammar.md#editorial-match-on-action The render surface consumes an already authored timeline; editorial authority, composition, version choice, and continuity decisions remain with the editorial layer.
 * @evidenceExclude requirements/editorial/continuity-and-film-grammar.md#editorial-reaction-information The render surface consumes an already authored timeline; editorial authority, composition, version choice, and continuity decisions remain with the editorial layer.
 * @evidenceExclude requirements/editorial/continuity-and-film-grammar.md#editorial-spatial-grammar The render surface consumes an already authored timeline; editorial authority, composition, version choice, and continuity decisions remain with the editorial layer.
 * @evidenceExclude requirements/editorial/continuity-and-film-grammar.md#editorial-state-continuity The render surface consumes an already authored timeline; editorial authority, composition, version choice, and continuity decisions remain with the editorial layer.
 * @evidenceExclude requirements/editorial/markers-effects-and-metadata.md#editorial-effect-ordering The render surface consumes an already authored timeline; editorial authority, composition, version choice, and continuity decisions remain with the editorial layer.
 * @evidenceExclude requirements/editorial/markers-effects-and-metadata.md#editorial-effects The render surface consumes an already authored timeline; editorial authority, composition, version choice, and continuity decisions remain with the editorial layer.
 * @evidenceExclude requirements/editorial/markers-effects-and-metadata.md#editorial-marker-event-distinction The render surface consumes an already authored timeline; editorial authority, composition, version choice, and continuity decisions remain with the editorial layer.
 * @evidenceExclude requirements/editorial/markers-effects-and-metadata.md#editorial-marker-partial-result The render surface consumes an already authored timeline; editorial authority, composition, version choice, and continuity decisions remain with the editorial layer.
 * @evidenceExclude requirements/editorial/markers-effects-and-metadata.md#editorial-marker-scope The render surface consumes an already authored timeline; editorial authority, composition, version choice, and continuity decisions remain with the editorial layer.
 * @evidenceExclude requirements/editorial/markers-effects-and-metadata.md#editorial-metadata-provenance The render surface consumes an already authored timeline; editorial authority, composition, version choice, and continuity decisions remain with the editorial layer.
 * @evidenceExclude requirements/editorial/markers-effects-and-metadata.md#editorial-metadata-refusal The render surface consumes an already authored timeline; editorial authority, composition, version choice, and continuity decisions remain with the editorial layer.
 * @evidenceExclude requirements/editorial/pacing-and-rhythm.md#editorial-audiovisual-rhythm The render surface consumes an already authored timeline; editorial authority, composition, version choice, and continuity decisions remain with the editorial layer.
 * @evidenceExclude requirements/editorial/pacing-and-rhythm.md#editorial-duration-pattern The render surface consumes an already authored timeline; editorial authority, composition, version choice, and continuity decisions remain with the editorial layer.
 * @evidenceExclude requirements/editorial/pacing-and-rhythm.md#editorial-narrative-priority The render surface consumes an already authored timeline; editorial authority, composition, version choice, and continuity decisions remain with the editorial layer.
 * @evidenceExclude requirements/editorial/pacing-and-rhythm.md#editorial-pacing-claim-boundary The render surface consumes an already authored timeline; editorial authority, composition, version choice, and continuity decisions remain with the editorial layer.
 * @evidenceExclude requirements/editorial/pacing-and-rhythm.md#editorial-pacing-partial-analysis The render surface consumes an already authored timeline; editorial authority, composition, version choice, and continuity decisions remain with the editorial layer.
 * @evidenceExclude requirements/editorial/pacing-and-rhythm.md#editorial-pacing-version-comparison The render surface consumes an already authored timeline; editorial authority, composition, version choice, and continuity decisions remain with the editorial layer.
 * @evidenceExclude requirements/editorial/pacing-and-rhythm.md#editorial-readability-time The render surface consumes an already authored timeline; editorial authority, composition, version choice, and continuity decisions remain with the editorial layer.
 * @evidenceExclude requirements/editorial/picture-and-sound-edits.md#editorial-audio-boundary-refusal The render surface consumes an already authored timeline; editorial authority, composition, version choice, and continuity decisions remain with the editorial layer.
 * @evidenceExclude requirements/editorial/picture-and-sound-edits.md#editorial-channel-mix-relation The render surface consumes an already authored timeline; editorial authority, composition, version choice, and continuity decisions remain with the editorial layer.
 * @evidenceExclude requirements/editorial/picture-and-sound-edits.md#editorial-dialogue-edits The render surface consumes an already authored timeline; editorial authority, composition, version choice, and continuity decisions remain with the editorial layer.
 * @evidenceExclude requirements/editorial/picture-and-sound-edits.md#editorial-effects-music-edits The render surface consumes an already authored timeline; editorial authority, composition, version choice, and continuity decisions remain with the editorial layer.
 * @evidenceExclude requirements/editorial/picture-and-sound-edits.md#editorial-room-tone-ambience The render surface consumes an already authored timeline; editorial authority, composition, version choice, and continuity decisions remain with the editorial layer.
 * @evidenceExclude requirements/editorial/picture-and-sound-edits.md#editorial-silence-missing-audio The render surface consumes an already authored timeline; editorial authority, composition, version choice, and continuity decisions remain with the editorial layer.
 * @evidenceExclude requirements/editorial/picture-and-sound-edits.md#editorial-sound-emission-presentation The render surface consumes an already authored timeline; editorial authority, composition, version choice, and continuity decisions remain with the editorial layer.
 * @evidenceExclude requirements/editorial/rational-time-and-ranges.md#editorial-canonical-time The render surface consumes an already authored timeline; editorial authority, composition, version choice, and continuity decisions remain with the editorial layer.
 * @evidenceExclude requirements/editorial/rational-time-and-ranges.md#editorial-frame-grid The render surface consumes an already authored timeline; editorial authority, composition, version choice, and continuity decisions remain with the editorial layer.
 * @evidenceExclude requirements/editorial/rational-time-and-ranges.md#editorial-mixed-timebases The render surface consumes an already authored timeline; editorial authority, composition, version choice, and continuity decisions remain with the editorial layer.
 * @evidenceExclude requirements/editorial/rational-time-and-ranges.md#editorial-range-operations The render surface consumes an already authored timeline; editorial authority, composition, version choice, and continuity decisions remain with the editorial layer.
 * @evidenceExclude requirements/editorial/rational-time-and-ranges.md#editorial-time-refusal The render surface consumes an already authored timeline; editorial authority, composition, version choice, and continuity decisions remain with the editorial layer.
 * @evidenceExclude requirements/editorial/scope-and-identity.md#editorial-authored-cut The render surface consumes an already authored timeline; editorial authority, composition, version choice, and continuity decisions remain with the editorial layer.
 * @evidenceExclude requirements/editorial/scope-and-identity.md#editorial-duration-closure The render surface consumes an already authored timeline; editorial authority, composition, version choice, and continuity decisions remain with the editorial layer.
 * @evidenceExclude requirements/editorial/scope-and-identity.md#editorial-identity-boundary The render surface consumes an already authored timeline; editorial authority, composition, version choice, and continuity decisions remain with the editorial layer.
 * @evidenceExclude requirements/editorial/scope-and-identity.md#editorial-missing-refusal The render surface consumes an already authored timeline; editorial authority, composition, version choice, and continuity decisions remain with the editorial layer.
 * @evidenceExclude requirements/editorial/scope-and-identity.md#editorial-source-preservation The render surface consumes an already authored timeline; editorial authority, composition, version choice, and continuity decisions remain with the editorial layer.
 * @evidenceExclude requirements/editorial/scope-and-identity.md#editorial-story-film-order The render surface consumes an already authored timeline; editorial authority, composition, version choice, and continuity decisions remain with the editorial layer.
 * @evidenceExclude requirements/editorial/tracks-stacks-and-composition.md#editorial-composition-refusal The render surface consumes an already authored timeline; editorial authority, composition, version choice, and continuity decisions remain with the editorial layer.
 * @evidenceExclude requirements/editorial/tracks-stacks-and-composition.md#editorial-enable-alternatives The render surface consumes an already authored timeline; editorial authority, composition, version choice, and continuity decisions remain with the editorial layer.
 * @evidenceExclude requirements/editorial/tracks-stacks-and-composition.md#editorial-layered-stacks The render surface consumes an already authored timeline; editorial authority, composition, version choice, and continuity decisions remain with the editorial layer.
 * @evidenceExclude requirements/editorial/tracks-stacks-and-composition.md#editorial-nested-composition The render surface consumes an already authored timeline; editorial authority, composition, version choice, and continuity decisions remain with the editorial layer.
 * @evidenceExclude requirements/editorial/tracks-stacks-and-composition.md#editorial-picture-composition The render surface consumes an already authored timeline; editorial authority, composition, version choice, and continuity decisions remain with the editorial layer.
 * @evidenceExclude requirements/editorial/tracks-stacks-and-composition.md#editorial-sequential-tracks The render surface consumes an already authored timeline; editorial authority, composition, version choice, and continuity decisions remain with the editorial layer.
 * @evidenceExclude requirements/editorial/tracks-stacks-and-composition.md#editorial-sound-composition The render surface consumes an already authored timeline; editorial authority, composition, version choice, and continuity decisions remain with the editorial layer.
 * @evidenceExclude requirements/editorial/transitions-and-overlaps.md#editorial-overlap-composition The render surface consumes an already authored timeline; editorial authority, composition, version choice, and continuity decisions remain with the editorial layer.
 * @evidenceExclude requirements/editorial/transitions-and-overlaps.md#editorial-picture-sound-transition The render surface consumes an already authored timeline; editorial authority, composition, version choice, and continuity decisions remain with the editorial layer.
 * @evidenceExclude requirements/editorial/transitions-and-overlaps.md#editorial-transition-boundary-samples The render surface consumes an already authored timeline; editorial authority, composition, version choice, and continuity decisions remain with the editorial layer.
 * @evidenceExclude requirements/editorial/transitions-and-overlaps.md#editorial-transition-handles The render surface consumes an already authored timeline; editorial authority, composition, version choice, and continuity decisions remain with the editorial layer.
 * @evidenceExclude requirements/editorial/transitions-and-overlaps.md#editorial-transition-partial-state The render surface consumes an already authored timeline; editorial authority, composition, version choice, and continuity decisions remain with the editorial layer.
 * @evidenceExclude requirements/editorial/transitions-and-overlaps.md#editorial-transition-refusal The render surface consumes an already authored timeline; editorial authority, composition, version choice, and continuity decisions remain with the editorial layer.
 * @evidenceExclude requirements/editorial/transitions-and-overlaps.md#editorial-transition-timing The render surface consumes an already authored timeline; editorial authority, composition, version choice, and continuity decisions remain with the editorial layer.
 * @evidenceExclude requirements/editorial/validation.md#editorial-film-review The render surface consumes an already authored timeline; editorial authority, composition, version choice, and continuity decisions remain with the editorial layer.
 * @evidenceExclude requirements/editorial/validation.md#editorial-sequence-review The render surface consumes an already authored timeline; editorial authority, composition, version choice, and continuity decisions remain with the editorial layer.
 * @evidenceExclude requirements/editorial/validation.md#editorial-story-coverage The render surface consumes an already authored timeline; editorial authority, composition, version choice, and continuity decisions remain with the editorial layer.
 * @evidenceExclude requirements/editorial/validation.md#editorial-structural-validation The render surface consumes an already authored timeline; editorial authority, composition, version choice, and continuity decisions remain with the editorial layer.
 * @evidenceExclude requirements/editorial/validation.md#editorial-validation-boundaries The render surface consumes an already authored timeline; editorial authority, composition, version choice, and continuity decisions remain with the editorial layer.
 * @evidenceExclude requirements/editorial/validation.md#editorial-validation-recovery The render surface consumes an already authored timeline; editorial authority, composition, version choice, and continuity decisions remain with the editorial layer.
 * @evidenceExclude requirements/editorial/validation.md#editorial-validation-refusal The render surface consumes an already authored timeline; editorial authority, composition, version choice, and continuity decisions remain with the editorial layer.
 * @evidenceExclude requirements/editorial/validation.md#editorial-validation-status The render surface consumes an already authored timeline; editorial authority, composition, version choice, and continuity decisions remain with the editorial layer.
 * @evidenceExclude requirements/editorial/versions-and-alternative-cuts.md#editorial-alternative-independence The render surface consumes an already authored timeline; editorial authority, composition, version choice, and continuity decisions remain with the editorial layer.
 * @evidenceExclude requirements/editorial/versions-and-alternative-cuts.md#editorial-append-only-revision The render surface consumes an already authored timeline; editorial authority, composition, version choice, and continuity decisions remain with the editorial layer.
 * @evidenceExclude requirements/editorial/versions-and-alternative-cuts.md#editorial-difference-report The render surface consumes an already authored timeline; editorial authority, composition, version choice, and continuity decisions remain with the editorial layer.
 * @evidenceExclude requirements/editorial/versions-and-alternative-cuts.md#editorial-selection-state The render surface consumes an already authored timeline; editorial authority, composition, version choice, and continuity decisions remain with the editorial layer.
 * @evidenceExclude requirements/editorial/versions-and-alternative-cuts.md#editorial-version-merge-conflict The render surface consumes an already authored timeline; editorial authority, composition, version choice, and continuity decisions remain with the editorial layer.
 * @evidenceExclude requirements/editorial/versions-and-alternative-cuts.md#editorial-version-refusal The render surface consumes an already authored timeline; editorial authority, composition, version choice, and continuity decisions remain with the editorial layer.
 * @evidenceExclude requirements/editorial/versions-and-alternative-cuts.md#editorial-version-stale-review The render surface consumes an already authored timeline; editorial authority, composition, version choice, and continuity decisions remain with the editorial layer.
 * @evidenceExclude requirements/rendering/README.md#rendering-요구사항 The render surface schedules, captures, measures, and encodes declared artifacts; this rendering responsibility is not performed by its current public planning and execution contracts.
 * @evidenceExclude requirements/rendering/budgets.md#rendering-frame-total-budget The render surface schedules, captures, measures, and encodes declared artifacts; this rendering responsibility is not performed by its current public planning and execution contracts.
 * @evidenceExclude requirements/rendering/chunks-resume-and-recovery.md#rendering-atomic-publication The render surface schedules, captures, measures, and encodes declared artifacts; this rendering responsibility is not performed by its current public planning and execution contracts.
 * @evidenceExclude requirements/rendering/chunks-resume-and-recovery.md#rendering-concurrent-work The render surface schedules, captures, measures, and encodes declared artifacts; this rendering responsibility is not performed by its current public planning and execution contracts.
 * @evidenceExclude requirements/rendering/chunks-resume-and-recovery.md#rendering-failure-recovery The render surface schedules, captures, measures, and encodes declared artifacts; this rendering responsibility is not performed by its current public planning and execution contracts.
 * @evidenceExclude requirements/rendering/chunks-resume-and-recovery.md#rendering-recovery-refusal The render surface schedules, captures, measures, and encodes declared artifacts; this rendering responsibility is not performed by its current public planning and execution contracts.
 * @evidenceExclude requirements/rendering/chunks-resume-and-recovery.md#rendering-resume The render surface schedules, captures, measures, and encodes declared artifacts; this rendering responsibility is not performed by its current public planning and execution contracts.
 * @evidenceExclude requirements/rendering/chunks-resume-and-recovery.md#rendering-retry-identity The render surface schedules, captures, measures, and encodes declared artifacts; this rendering responsibility is not performed by its current public planning and execution contracts.
 * @evidenceExclude requirements/rendering/encoding-and-multiplexing.md#rendering-encode-atomic-output The render surface schedules, captures, measures, and encodes declared artifacts; this rendering responsibility is not performed by its current public planning and execution contracts.
 * @evidenceExclude requirements/rendering/encoding-and-multiplexing.md#rendering-encode-refusal The render surface schedules, captures, measures, and encodes declared artifacts; this rendering responsibility is not performed by its current public planning and execution contracts.
 * @evidenceExclude requirements/rendering/encoding-and-multiplexing.md#rendering-encode-retry The render surface schedules, captures, measures, and encodes declared artifacts; this rendering responsibility is not performed by its current public planning and execution contracts.
 * @evidenceExclude requirements/rendering/encoding-and-multiplexing.md#rendering-encode-stream-selection The render surface schedules, captures, measures, and encodes declared artifacts; this rendering responsibility is not performed by its current public planning and execution contracts.
 * @evidenceExclude requirements/rendering/encoding-and-multiplexing.md#rendering-encode-timestamps The render surface schedules, captures, measures, and encodes declared artifacts; this rendering responsibility is not performed by its current public planning and execution contracts.
 * @evidenceExclude requirements/rendering/frame-identity-and-content-addressing.md#rendering-canonical-fingerprint The render surface schedules, captures, measures, and encodes declared artifacts; this rendering responsibility is not performed by its current public planning and execution contracts.
 * @evidenceExclude requirements/rendering/frame-identity-and-content-addressing.md#rendering-current-stale The render surface schedules, captures, measures, and encodes declared artifacts; this rendering responsibility is not performed by its current public planning and execution contracts.
 * @evidenceExclude requirements/rendering/frame-identity-and-content-addressing.md#rendering-digest-refusal The render surface schedules, captures, measures, and encodes declared artifacts; this rendering responsibility is not performed by its current public planning and execution contracts.
 * @evidenceExclude requirements/rendering/frame-identity-and-content-addressing.md#rendering-frame-byte-digest The render surface schedules, captures, measures, and encodes declared artifacts; this rendering responsibility is not performed by its current public planning and execution contracts.
 * @evidenceExclude requirements/rendering/frame-identity-and-content-addressing.md#rendering-frame-dependency-closure The render surface schedules, captures, measures, and encodes declared artifacts; this rendering responsibility is not performed by its current public planning and execution contracts.
 * @evidenceExclude requirements/rendering/frame-identity-and-content-addressing.md#rendering-identity-collision-corruption The render surface schedules, captures, measures, and encodes declared artifacts; this rendering responsibility is not performed by its current public planning and execution contracts.
 * @evidenceExclude requirements/rendering/frame-identity-and-content-addressing.md#rendering-output-naming The render surface schedules, captures, measures, and encodes declared artifacts; this rendering responsibility is not performed by its current public planning and execution contracts.
 * @evidenceExclude requirements/rendering/frame-schedules-and-sampling.md#rendering-schedule-audio-cues The render surface schedules, captures, measures, and encodes declared artifacts; this rendering responsibility is not performed by its current public planning and execution contracts.
 * @evidenceExclude requirements/rendering/frame-schedules-and-sampling.md#rendering-schedule-refusal The render surface schedules, captures, measures, and encodes declared artifacts; this rendering responsibility is not performed by its current public planning and execution contracts.
 * @evidenceExclude requirements/rendering/frame-schedules-and-sampling.md#rendering-shutter-samples The render surface schedules, captures, measures, and encodes declared artifacts; this rendering responsibility is not performed by its current public planning and execution contracts.
 * @evidenceExclude requirements/rendering/frame-schedules-and-sampling.md#rendering-state-sampling The render surface schedules, captures, measures, and encodes declared artifacts; this rendering responsibility is not performed by its current public planning and execution contracts.
 * @evidenceExclude requirements/rendering/geometry-visibility-and-culling.md#rendering-culling-diagnostics The render surface schedules, captures, measures, and encodes declared artifacts; this rendering responsibility is not performed by its current public planning and execution contracts.
 * @evidenceExclude requirements/rendering/geometry-visibility-and-culling.md#rendering-culling-refusal The render surface schedules, captures, measures, and encodes declared artifacts; this rendering responsibility is not performed by its current public planning and execution contracts.
 * @evidenceExclude requirements/rendering/geometry-visibility-and-culling.md#rendering-deformed-bounds The render surface schedules, captures, measures, and encodes declared artifacts; this rendering responsibility is not performed by its current public planning and execution contracts.
 * @evidenceExclude requirements/rendering/geometry-visibility-and-culling.md#rendering-frustum-boundaries The render surface schedules, captures, measures, and encodes declared artifacts; this rendering responsibility is not performed by its current public planning and execution contracts.
 * @evidenceExclude requirements/rendering/geometry-visibility-and-culling.md#rendering-hierarchical-transforms The render surface schedules, captures, measures, and encodes declared artifacts; this rendering responsibility is not performed by its current public planning and execution contracts.
 * @evidenceExclude requirements/rendering/geometry-visibility-and-culling.md#rendering-room-region-culling The render surface schedules, captures, measures, and encodes declared artifacts; this rendering responsibility is not performed by its current public planning and execution contracts.
 * @evidenceExclude requirements/rendering/geometry-visibility-and-culling.md#rendering-visibility-state The render surface schedules, captures, measures, and encodes declared artifacts; this rendering responsibility is not performed by its current public planning and execution contracts.
 * @evidenceExclude requirements/rendering/headless-and-platform-determinism.md#rendering-cross-platform-evidence The render surface schedules, captures, measures, and encodes declared artifacts; this rendering responsibility is not performed by its current public planning and execution contracts.
 * @evidenceExclude requirements/rendering/headless-and-platform-determinism.md#rendering-cross-platform-paths The render surface schedules, captures, measures, and encodes declared artifacts; this rendering responsibility is not performed by its current public planning and execution contracts.
 * @evidenceExclude requirements/rendering/headless-and-platform-determinism.md#rendering-font-decoder-closure The render surface schedules, captures, measures, and encodes declared artifacts; this rendering responsibility is not performed by its current public planning and execution contracts.
 * @evidenceExclude requirements/rendering/headless-and-platform-determinism.md#rendering-hardware-variation The render surface schedules, captures, measures, and encodes declared artifacts; this rendering responsibility is not performed by its current public planning and execution contracts.
 * @evidenceExclude requirements/rendering/headless-and-platform-determinism.md#rendering-locale-time-determinism The render surface schedules, captures, measures, and encodes declared artifacts; this rendering responsibility is not performed by its current public planning and execution contracts.
 * @evidenceExclude requirements/rendering/materials-lighting-and-color.md#rendering-color-recovery The render surface schedules, captures, measures, and encodes declared artifacts; this rendering responsibility is not performed by its current public planning and execution contracts.
 * @evidenceExclude requirements/rendering/materials-lighting-and-color.md#rendering-external-materials The render surface schedules, captures, measures, and encodes declared artifacts; this rendering responsibility is not performed by its current public planning and execution contracts.
 * @evidenceExclude requirements/rendering/materials-lighting-and-color.md#rendering-lighting-evaluation The render surface schedules, captures, measures, and encodes declared artifacts; this rendering responsibility is not performed by its current public planning and execution contracts.
 * @evidenceExclude requirements/rendering/materials-lighting-and-color.md#rendering-material-refusal The render surface schedules, captures, measures, and encodes declared artifacts; this rendering responsibility is not performed by its current public planning and execution contracts.
 * @evidenceExclude requirements/rendering/materials-lighting-and-color.md#rendering-material-resolution The render surface schedules, captures, measures, and encodes declared artifacts; this rendering responsibility is not performed by its current public planning and execution contracts.
 * @evidenceExclude requirements/rendering/materials-lighting-and-color.md#rendering-scene-display-color The render surface schedules, captures, measures, and encodes declared artifacts; this rendering responsibility is not performed by its current public planning and execution contracts.
 * @evidenceExclude requirements/rendering/materials-lighting-and-color.md#rendering-texture-decode The render surface schedules, captures, measures, and encodes declared artifacts; this rendering responsibility is not performed by its current public planning and execution contracts.
 * @evidenceExclude requirements/rendering/materials-lighting-and-color.md#rendering-transparency-alpha The render surface schedules, captures, measures, and encodes declared artifacts; this rendering responsibility is not performed by its current public planning and execution contracts.
 * @evidenceExclude requirements/rendering/passes-channels-and-products.md#rendering-arbitrary-channels The render surface schedules, captures, measures, and encodes declared artifacts; this rendering responsibility is not performed by its current public planning and execution contracts.
 * @evidenceExclude requirements/rendering/passes-channels-and-products.md#rendering-beauty-structural-distinction The render surface schedules, captures, measures, and encodes declared artifacts; this rendering responsibility is not performed by its current public planning and execution contracts.
 * @evidenceExclude requirements/rendering/passes-channels-and-products.md#rendering-identity-mask-channels The render surface schedules, captures, measures, and encodes declared artifacts; this rendering responsibility is not performed by its current public planning and execution contracts.
 * @evidenceExclude requirements/rendering/passes-channels-and-products.md#rendering-multiview-products The render surface schedules, captures, measures, and encodes declared artifacts; this rendering responsibility is not performed by its current public planning and execution contracts.
 * @evidenceExclude requirements/rendering/passes-channels-and-products.md#rendering-partial-product-set The render surface schedules, captures, measures, and encodes declared artifacts; this rendering responsibility is not performed by its current public planning and execution contracts.
 * @evidenceExclude requirements/rendering/scene-lowering-and-runtime-state.md#rendering-lowering-ownership The render surface schedules, captures, measures, and encodes declared artifacts; this rendering responsibility is not performed by its current public planning and execution contracts.
 * @evidenceExclude requirements/rendering/scene-lowering-and-runtime-state.md#rendering-lowering-partial-retry The render surface schedules, captures, measures, and encodes declared artifacts; this rendering responsibility is not performed by its current public planning and execution contracts.
 * @evidenceExclude requirements/rendering/scene-lowering-and-runtime-state.md#rendering-lowering-refusal The render surface schedules, captures, measures, and encodes declared artifacts; this rendering responsibility is not performed by its current public planning and execution contracts.
 * @evidenceExclude requirements/rendering/scene-lowering-and-runtime-state.md#rendering-runtime-build-order The render surface schedules, captures, measures, and encodes declared artifacts; this rendering responsibility is not performed by its current public planning and execution contracts.
 * @evidenceExclude requirements/rendering/scene-lowering-and-runtime-state.md#rendering-runtime-lifecycle The render surface schedules, captures, measures, and encodes declared artifacts; this rendering responsibility is not performed by its current public planning and execution contracts.
 * @evidenceExclude requirements/rendering/scene-lowering-and-runtime-state.md#rendering-runtime-state-isolation The render surface schedules, captures, measures, and encodes declared artifacts; this rendering responsibility is not performed by its current public planning and execution contracts.
 * @evidenceExclude requirements/rendering/scene-lowering-and-runtime-state.md#rendering-runtime-time-update The render surface schedules, captures, measures, and encodes declared artifacts; this rendering responsibility is not performed by its current public planning and execution contracts.
 * @evidenceExclude requirements/rendering/scope-and-artifact-identity.md#rendering-artifact-invalidation The render surface schedules, captures, measures, and encodes declared artifacts; this rendering responsibility is not performed by its current public planning and execution contracts.
 * @evidenceExclude requirements/rendering/scope-and-artifact-identity.md#rendering-compile-render-distinction The render surface schedules, captures, measures, and encodes declared artifacts; this rendering responsibility is not performed by its current public planning and execution contracts.
 * @evidenceExclude requirements/rendering/scope-and-artifact-identity.md#rendering-deterministic-lane The render surface schedules, captures, measures, and encodes declared artifacts; this rendering responsibility is not performed by its current public planning and execution contracts.
 * @evidenceExclude requirements/rendering/scope-and-artifact-identity.md#rendering-missing-artifact-refusal The render surface schedules, captures, measures, and encodes declared artifacts; this rendering responsibility is not performed by its current public planning and execution contracts.
 * @evidenceExclude requirements/rendering/scope-and-artifact-identity.md#rendering-partial-artifact The render surface schedules, captures, measures, and encodes declared artifacts; this rendering responsibility is not performed by its current public planning and execution contracts.
 * @evidenceExclude requirements/rendering/scope-and-artifact-identity.md#rendering-product-scope The render surface schedules, captures, measures, and encodes declared artifacts; this rendering responsibility is not performed by its current public planning and execution contracts.
 * @evidenceExclude requirements/rendering/validation.md#rendering-byte-media-probe The render surface schedules, captures, measures, and encodes declared artifacts; this rendering responsibility is not performed by its current public planning and execution contracts.
 * @evidenceExclude requirements/rendering/validation.md#rendering-determinism-check The render surface schedules, captures, measures, and encodes declared artifacts; this rendering responsibility is not performed by its current public planning and execution contracts.
 * @evidenceExclude requirements/rendering/validation.md#rendering-multitime-multipass The render surface schedules, captures, measures, and encodes declared artifacts; this rendering responsibility is not performed by its current public planning and execution contracts.
 * @evidenceExclude requirements/rendering/validation.md#rendering-negative-boundary-validation The render surface schedules, captures, measures, and encodes declared artifacts; this rendering responsibility is not performed by its current public planning and execution contracts.
 * @evidenceExclude requirements/rendering/validation.md#rendering-nonblank-expected-content The render surface schedules, captures, measures, and encodes declared artifacts; this rendering responsibility is not performed by its current public planning and execution contracts.
 * @evidenceExclude requirements/rendering/validation.md#rendering-schedule-set-validation The render surface schedules, captures, measures, and encodes declared artifacts; this rendering responsibility is not performed by its current public planning and execution contracts.
 * @evidenceExclude requirements/rendering/validation.md#rendering-validation-recovery The render surface schedules, captures, measures, and encodes declared artifacts; this rendering responsibility is not performed by its current public planning and execution contracts.
 * @evidenceExclude requirements/rendering/validation.md#rendering-validation-refusal The render surface schedules, captures, measures, and encodes declared artifacts; this rendering responsibility is not performed by its current public planning and execution contracts.
 * @evidenceExclude requirements/rendering/validation.md#rendering-validation-status The render surface schedules, captures, measures, and encodes declared artifacts; this rendering responsibility is not performed by its current public planning and execution contracts.
 * @evidenceExclude requirements/rendering/validation.md#rendering-visual-review The render surface schedules, captures, measures, and encodes declared artifacts; this rendering responsibility is not performed by its current public planning and execution contracts.
 * @evidenceExclude requirements/repaint/README.md#repaint-요구사항 The render surface can emit deterministic control products; repaint generation, provider choice, reference authority, and result adoption remain with the repaint workflow.
 * @evidenceExclude requirements/repaint/eligibility-and-prerequisites.md#repaint-current-evidence The render surface can emit deterministic control products; repaint generation, provider choice, reference authority, and result adoption remain with the repaint workflow.
 * @evidenceExclude requirements/repaint/eligibility-and-prerequisites.md#repaint-delivery-declaration The render surface can emit deterministic control products; repaint generation, provider choice, reference authority, and result adoption remain with the repaint workflow.
 * @evidenceExclude requirements/repaint/eligibility-and-prerequisites.md#repaint-eligibility-refusal The render surface can emit deterministic control products; repaint generation, provider choice, reference authority, and result adoption remain with the repaint workflow.
 * @evidenceExclude requirements/repaint/eligibility-and-prerequisites.md#repaint-source-failure-first The render surface can emit deterministic control products; repaint generation, provider choice, reference authority, and result adoption remain with the repaint workflow.
 * @evidenceExclude requirements/repaint/identity-and-provenance.md#repaint-derivation-chain The render surface can emit deterministic control products; repaint generation, provider choice, reference authority, and result adoption remain with the repaint workflow.
 * @evidenceExclude requirements/repaint/identity-and-provenance.md#repaint-nondeterminism-record The render surface can emit deterministic control products; repaint generation, provider choice, reference authority, and result adoption remain with the repaint workflow.
 * @evidenceExclude requirements/repaint/identity-and-provenance.md#repaint-provenance-refusal The render surface can emit deterministic control products; repaint generation, provider choice, reference authority, and result adoption remain with the repaint workflow.
 * @evidenceExclude requirements/repaint/identity-and-provenance.md#repaint-source-review-freshness The render surface can emit deterministic control products; repaint generation, provider choice, reference authority, and result adoption remain with the repaint workflow.
 * @evidenceExclude requirements/repaint/prompts-controls-and-constraints.md#repaint-negative-prompt The render surface can emit deterministic control products; repaint generation, provider choice, reference authority, and result adoption remain with the repaint workflow.
 * @evidenceExclude requirements/repaint/prompts-controls-and-constraints.md#repaint-prompt-scope The render surface can emit deterministic control products; repaint generation, provider choice, reference authority, and result adoption remain with the repaint workflow.
 * @evidenceExclude requirements/repaint/prompts-controls-and-constraints.md#repaint-request-refusal The render surface can emit deterministic control products; repaint generation, provider choice, reference authority, and result adoption remain with the repaint workflow.
 * @evidenceExclude requirements/repaint/prompts-controls-and-constraints.md#repaint-stable-controls The render surface can emit deterministic control products; repaint generation, provider choice, reference authority, and result adoption remain with the repaint workflow.
 * @evidenceExclude requirements/repaint/providers-models-and-credentials.md#repaint-credential-separation The render surface can emit deterministic control products; repaint generation, provider choice, reference authority, and result adoption remain with the repaint workflow.
 * @evidenceExclude requirements/repaint/providers-models-and-credentials.md#repaint-credential-use-boundary The render surface can emit deterministic control products; repaint generation, provider choice, reference authority, and result adoption remain with the repaint workflow.
 * @evidenceExclude requirements/repaint/providers-models-and-credentials.md#repaint-execution-boundary The render surface can emit deterministic control products; repaint generation, provider choice, reference authority, and result adoption remain with the repaint workflow.
 * @evidenceExclude requirements/repaint/providers-models-and-credentials.md#repaint-provider-capabilities The render surface can emit deterministic control products; repaint generation, provider choice, reference authority, and result adoption remain with the repaint workflow.
 * @evidenceExclude requirements/repaint/providers-models-and-credentials.md#repaint-provider-refusal The render surface can emit deterministic control products; repaint generation, provider choice, reference authority, and result adoption remain with the repaint workflow.
 * @evidenceExclude requirements/repaint/providers-models-and-credentials.md#repaint-provider-terms The render surface can emit deterministic control products; repaint generation, provider choice, reference authority, and result adoption remain with the repaint workflow.
 * @evidenceExclude requirements/repaint/retries-seeds-and-variation.md#repaint-attempt-failure-provenance The render surface can emit deterministic control products; repaint generation, provider choice, reference authority, and result adoption remain with the repaint workflow.
 * @evidenceExclude requirements/repaint/retries-seeds-and-variation.md#repaint-candidate-comparison The render surface can emit deterministic control products; repaint generation, provider choice, reference authority, and result adoption remain with the repaint workflow.
 * @evidenceExclude requirements/repaint/retries-seeds-and-variation.md#repaint-one-accepted-lineage The render surface can emit deterministic control products; repaint generation, provider choice, reference authority, and result adoption remain with the repaint workflow.
 * @evidenceExclude requirements/repaint/retries-seeds-and-variation.md#repaint-retry-budget-stop The render surface can emit deterministic control products; repaint generation, provider choice, reference authority, and result adoption remain with the repaint workflow.
 * @evidenceExclude requirements/repaint/retries-seeds-and-variation.md#repaint-retry-refusal The render surface can emit deterministic control products; repaint generation, provider choice, reference authority, and result adoption remain with the repaint workflow.
 * @evidenceExclude requirements/repaint/retries-seeds-and-variation.md#repaint-retry-request-boundary The render surface can emit deterministic control products; repaint generation, provider choice, reference authority, and result adoption remain with the repaint workflow.
 * @evidenceExclude requirements/repaint/retries-seeds-and-variation.md#repaint-seed-semantics The render surface can emit deterministic control products; repaint generation, provider choice, reference authority, and result adoption remain with the repaint workflow.
 * @evidenceExclude requirements/repaint/scope-and-user-choice.md#repaint-independent-artifact The render surface can emit deterministic control products; repaint generation, provider choice, reference authority, and result adoption remain with the repaint workflow.
 * @evidenceExclude requirements/repaint/scope-and-user-choice.md#repaint-no-automatic-routing The render surface can emit deterministic control products; repaint generation, provider choice, reference authority, and result adoption remain with the repaint workflow.
 * @evidenceExclude requirements/repaint/scope-and-user-choice.md#repaint-provider-independence The render surface can emit deterministic control products; repaint generation, provider choice, reference authority, and result adoption remain with the repaint workflow.
 * @evidenceExclude requirements/repaint/scope-and-user-choice.md#repaint-structure-appearance The render surface can emit deterministic control products; repaint generation, provider choice, reference authority, and result adoption remain with the repaint workflow.
 * @evidenceExclude requirements/repaint/sequence-continuity-and-publication.md#repaint-continuity-baseline-changes The render surface can emit deterministic control products; repaint generation, provider choice, reference authority, and result adoption remain with the repaint workflow.
 * @evidenceExclude requirements/repaint/sequence-continuity-and-publication.md#repaint-continuity-drift-propagation The render surface can emit deterministic control products; repaint generation, provider choice, reference authority, and result adoption remain with the repaint workflow.
 * @evidenceExclude requirements/repaint/sequence-continuity-and-publication.md#repaint-mixed-delivery The render surface can emit deterministic control products; repaint generation, provider choice, reference authority, and result adoption remain with the repaint workflow.
 * @evidenceExclude requirements/repaint/sequence-continuity-and-publication.md#repaint-publication-gate The render surface can emit deterministic control products; repaint generation, provider choice, reference authority, and result adoption remain with the repaint workflow.
 * @evidenceExclude requirements/repaint/sequence-continuity-and-publication.md#repaint-reference-continuity The render surface can emit deterministic control products; repaint generation, provider choice, reference authority, and result adoption remain with the repaint workflow.
 * @evidenceExclude requirements/repaint/sequence-continuity-and-publication.md#repaint-temporal-artifacts The render surface can emit deterministic control products; repaint generation, provider choice, reference authority, and result adoption remain with the repaint workflow.
 * @evidenceExclude requirements/repaint/source-frames-and-reference-locking.md#repaint-project-relative-references The render surface can emit deterministic control products; repaint generation, provider choice, reference authority, and result adoption remain with the repaint workflow.
 * @evidenceExclude requirements/repaint/source-frames-and-reference-locking.md#repaint-reference-refusal The render surface can emit deterministic control products; repaint generation, provider choice, reference authority, and result adoption remain with the repaint workflow.
 * @evidenceExclude requirements/repaint/source-frames-and-reference-locking.md#repaint-reference-roles The render surface can emit deterministic control products; repaint generation, provider choice, reference authority, and result adoption remain with the repaint workflow.
 * @evidenceExclude requirements/repaint/structural-comparison-and-review.md#repaint-pixel-structure-distinction The render surface can emit deterministic control products; repaint generation, provider choice, reference authority, and result adoption remain with the repaint workflow.
 * @evidenceExclude requirements/repaint/structural-comparison-and-review.md#repaint-rendition-review The render surface can emit deterministic control products; repaint generation, provider choice, reference authority, and result adoption remain with the repaint workflow.
 * @evidenceExclude requirements/repaint/structural-comparison-and-review.md#repaint-review-status The render surface can emit deterministic control products; repaint generation, provider choice, reference authority, and result adoption remain with the repaint workflow.
 * @evidenceExclude requirements/repaint/structural-comparison-and-review.md#repaint-structural-failures The render surface can emit deterministic control products; repaint generation, provider choice, reference authority, and result adoption remain with the repaint workflow.
 * @evidenceExclude specifications/editorial-render-and-delivery/README.md#editorial-render와-delivery-system-specifications The render surface consumes an already authored timeline; editorial authority, continuity, conform, and composition remain with the editorial layer.
 * @evidenceExclude specifications/editorial-render-and-delivery/delivery-package-provenance-and-publication.md#spec-delivery-package-safety The render surface emits deterministic capture and encode inputs; delivery packaging, localization, publication authority, and release validation remain with the delivery layer.
 * @evidenceExclude specifications/editorial-render-and-delivery/delivery-package-provenance-and-publication.md#spec-delivery-provenance-integrity The render surface emits deterministic capture and encode inputs; delivery packaging, localization, publication authority, and release validation remain with the delivery layer.
 * @evidenceExclude specifications/editorial-render-and-delivery/delivery-package-provenance-and-publication.md#spec-delivery-publication-retention The render surface emits deterministic capture and encode inputs; delivery packaging, localization, publication authority, and release validation remain with the delivery layer.
 * @evidenceExclude specifications/editorial-render-and-delivery/delivery-profiles-time-and-picture.md#spec-delivery-container-media-facts The render surface emits deterministic capture and encode inputs; delivery packaging, localization, publication authority, and release validation remain with the delivery layer.
 * @evidenceExclude specifications/editorial-render-and-delivery/delivery-profiles-time-and-picture.md#spec-delivery-picture-products The render surface emits deterministic capture and encode inputs; delivery packaging, localization, publication authority, and release validation remain with the delivery layer.
 * @evidenceExclude specifications/editorial-render-and-delivery/delivery-profiles-time-and-picture.md#spec-delivery-profile-matrix The render surface emits deterministic capture and encode inputs; delivery packaging, localization, publication authority, and release validation remain with the delivery layer.
 * @evidenceExclude specifications/editorial-render-and-delivery/delivery-profiles-time-and-picture.md#spec-delivery-timecode-sync The render surface emits deterministic capture and encode inputs; delivery packaging, localization, publication authority, and release validation remain with the delivery layer.
 * @evidenceExclude specifications/editorial-render-and-delivery/delivery-validation-and-release-status.md#spec-delivery-validation-release The render surface emits deterministic capture and encode inputs; delivery packaging, localization, publication authority, and release validation remain with the delivery layer.
 * @evidenceExclude specifications/editorial-render-and-delivery/editorial-audiovisual-continuity.md#spec-editorial-continuity-grammar The render surface consumes an already authored timeline; editorial authority, continuity, conform, and composition remain with the editorial layer.
 * @evidenceExclude specifications/editorial-render-and-delivery/editorial-audiovisual-continuity.md#spec-editorial-marker-effect-metadata The render surface consumes an already authored timeline; editorial authority, continuity, conform, and composition remain with the editorial layer.
 * @evidenceExclude specifications/editorial-render-and-delivery/editorial-audiovisual-continuity.md#spec-editorial-pacing-rhythm The render surface consumes an already authored timeline; editorial authority, continuity, conform, and composition remain with the editorial layer.
 * @evidenceExclude specifications/editorial-render-and-delivery/editorial-audiovisual-continuity.md#spec-editorial-picture-sound The render surface consumes an already authored timeline; editorial authority, continuity, conform, and composition remain with the editorial layer.
 * @evidenceExclude specifications/editorial-render-and-delivery/editorial-version-conform-and-validation.md#spec-editorial-conform-relink The render surface consumes an already authored timeline; editorial authority, continuity, conform, and composition remain with the editorial layer.
 * @evidenceExclude specifications/editorial-render-and-delivery/editorial-version-conform-and-validation.md#spec-editorial-film-identity The render surface consumes an already authored timeline; editorial authority, continuity, conform, and composition remain with the editorial layer.
 * @evidenceExclude specifications/editorial-render-and-delivery/editorial-version-conform-and-validation.md#spec-editorial-validation-recovery The render surface consumes an already authored timeline; editorial authority, continuity, conform, and composition remain with the editorial layer.
 * @evidenceExclude specifications/editorial-render-and-delivery/editorial-version-conform-and-validation.md#spec-editorial-version-selection The render surface consumes an already authored timeline; editorial authority, continuity, conform, and composition remain with the editorial layer.
 * @evidenceExclude specifications/editorial-render-and-delivery/rational-timeline-and-composition.md#spec-editorial-track-composition The render surface consumes an already authored timeline; editorial authority, continuity, conform, and composition remain with the editorial layer.
 * @evidenceExclude specifications/editorial-render-and-delivery/render-budget-identity-and-recovery.md#spec-render-frame-identity The render surface consumes an already authored timeline; editorial authority, continuity, conform, and composition remain with the editorial layer.
 * @evidenceExclude specifications/editorial-render-and-delivery/render-encoding-and-validation.md#spec-render-validation The render surface consumes an already authored timeline; editorial authority, continuity, conform, and composition remain with the editorial layer.
 * @evidenceExclude specifications/editorial-render-and-delivery/render-products-visibility-and-color.md#spec-render-material-color The render surface consumes an already authored timeline; editorial authority, continuity, conform, and composition remain with the editorial layer.
 * @evidenceExclude specifications/editorial-render-and-delivery/render-products-visibility-and-color.md#spec-render-visibility-culling The render surface consumes an already authored timeline; editorial authority, continuity, conform, and composition remain with the editorial layer.
 * @evidenceExclude specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-state-isolation The render surface consumes an already authored timeline; editorial authority, continuity, conform, and composition remain with the editorial layer.
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
