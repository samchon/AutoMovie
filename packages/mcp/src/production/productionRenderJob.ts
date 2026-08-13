import {
  AutoMovieContentDigest,
  AutoMovieGuidePass,
  IAutoMovieCaptureRuntimeIdentity,
  IAutoMovieFilmTimeline,
  IAutoMovieProductionDesign,
} from "@automovie/interface";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

/**
 * Package-owned encoder identity fenced into every chunk.
 *
 * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Lets project code persist the encoder facts that make render bytes reproducible.
 * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Makes encoder identity a deterministic package record rather than MCP-authored state.
 */
export interface IAutoMovieProductionEncoderIdentity {
  /**
   * Exact installed package name.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Exposes the installed encoder package selection to repository-owned render planning.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Pins encoder provenance in typed data without adding a package-selection tool.
   */
  package: string;
  /**
   * Exact installed package version.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Allows source-controlled jobs to record the exact encoder release they depend on.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps encoder-version selection in package inputs, outside MCP mutation.
   */
  version: string;
  /**
   * Digest of the resolved executable JavaScript entry.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Gives ordinary code a byte identity for the executable that performed encoding.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Fences executable verification into deterministic render metadata instead of a tool action.
   */
  entryDigest: AutoMovieContentDigest;
  /**
   * Closed codec family emitted by the foundation adapter.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Makes the supported video codec an inspectable compile-time choice for project code.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Closes the codec family in the package contract rather than exposing codec authoring through MCP.
   */
  codec: "h264";
  /**
   * Every encoder argument that can affect output bytes.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Lets repository code capture every encoder control that can change output bytes.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Treats encoder tuning as deterministic adapter identity, not an MCP command surface.
   */
  arguments: {
    /** Constant-rate-factor analogue accepted by the package encoder. */
    quantizationParameter: number;
    /** Package encoder speed setting. */
    speed: number;
    /** Key-frame period in frames. */
    groupOfPictures: number;
  };
}

/**
 * Capture and encoder identity for one homogeneous render job.
 *
 * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Gives a source-authored render job one reviewable capture-and-encode environment identity.
 * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Binds runtime provenance in deterministic records without widening the evidence tools.
 */
export interface IAutoMovieProductionRenderRuntimeIdentity {
  /**
   * Render-runtime identity schema.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Lets project code reject runtime records whose schema predates the current contract.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Versions the package-owned runtime envelope independently of MCP protocol state.
   */
  protocolVersion: "automovie.production-render-runtime.v1";
  /**
   * Digest of declared viewer, capture, asset, and package input bytes.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Exposes one content fingerprint for all declared inputs that can alter a capture.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Carries capture input closure through deterministic data, not hidden tool memory.
   */
  sourceDigest: AutoMovieContentDigest;
  /**
   * Package-owned browser and graphics identity.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Allows repository logic to compare the browser and graphics stack used for frame capture.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Imports capture identity as package evidence without creating an MCP runtime chooser.
   */
  capture: IAutoMovieCaptureRuntimeIdentity;
  /**
   * Package-owned encoder binary and argument identity.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Gives source-controlled verification the exact encoder identity paired with captured frames.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Composes encoder provenance into the job boundary instead of delegating encoding choices to MCP.
   */
  encoder: IAutoMovieProductionEncoderIdentity;
}

/**
 * Explicit cost/quality tier sharing one compiler-owned edit.
 *
 * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Lets authors declare proxy economics without changing the compiler-owned edit.
 * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps quality-tier policy in typed project configuration rather than an MCP render instruction.
 */
export interface IAutoMovieProductionRenderTier {
  /**
   * Stable tier identity used in slots, chunks, and publication paths.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Gives source paths a stable distinction between review proxies and final output.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Restricts tier selection to the package plan instead of a new MCP operation.
   */
  kind: "proxy" | "final";
  /**
   * Output raster multiplier in `(0, 1]`; final is exactly one.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Allows ordinary code to state the proxy raster tradeoff explicitly and reviewably.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Applies resolution economy as deterministic plan data, outside the tool vocabulary.
   */
  resolutionScale: number;
  /**
   * Keep every Nth source frame; final is exactly one.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Makes temporal decimation an explicit source-owned proxy policy.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps frame skipping reproducible in package code instead of session-driven tooling.
   */
  frameStep: number;
}

/**
 * One source image participating in a film-global output frame.
 *
 * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Represents transition source contributions as inspectable typed edit data.
 * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Resolves compositing inputs in the deterministic render model, not through MCP authorship.
 */
export interface IAutoMovieProductionRenderLayer {
  /**
   * Compiler-owned shot id.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Preserves the compiler-assigned shot identity for source-side frame inspection.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Carries shot selection as compiled data without a shot-authoring tool.
   */
  shot: string;
  /**
   * Exact shot-local integer source frame.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Exposes the precise shot-local sample chosen by the compiled edit.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps timeline sampling in deterministic package output rather than MCP state.
   */
  sourceFrame: number;
  /**
   * Linear compositing weight in `[0, 1]`.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Lets code audit the exact contribution of each shot during a transition.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Encodes compositing weight as a pure plan fact instead of a tool-side adjustment.
   */
  weight: number;
}

/**
 * One exact film-global frame with transitions already resolved.
 *
 * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Gives repository code the fully resolved edit state for one output frame.
 * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Places frame resolution behind a deterministic function rather than MCP-generated timing.
 */
export interface IAutoMovieProductionRenderFrame {
  /**
   * Exact zero-based output frame in this render tier.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Provides an exact tier-relative address for every emitted frame.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Assigns output-frame identity deterministically without an MCP clock.
   */
  globalFrame: number;
  /**
   * Exact frame on the compiler-owned full-rate film timeline.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Retains the full-rate edit coordinate behind a decimated proxy frame.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Grounds proxy samples in compiler time instead of tool-session sequencing.
   */
  timelineFrame: number;
  /**
   * Derived film time, never an accumulated clock.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Makes frame time derivable and inspectable in ordinary project logic.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Derives seconds from the declared frame clock without hidden MCP time accumulation.
   */
  timeSeconds: number;
  /**
   * One hard-cut/fade layer or two dissolve layers, back to front.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Exposes the ordered transition layers that source-owned render code must combine.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Fixes transition composition in typed frame data rather than tool-directed blending.
   */
  layers: IAutoMovieProductionRenderLayer[];
}

/**
 * One deterministic, independently lockable render/encode range.
 *
 * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Lets project code partition a film into reproducible, independently recoverable work.
 * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Defines chunk scheduling as deterministic package data rather than an MCP orchestration primitive.
 */
export interface IAutoMovieProductionRenderChunk {
  /**
   * Stable operational slot before content identity changes.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Gives repository automation a stable lock and publication address across content revisions.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Separates operational slot identity from MCP session identity.
   */
  slot: string;
  /**
   * Content id over edit, pass, frame range, raster, and runtime.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Allows ordinary code to invalidate work whenever any byte-affecting chunk input changes.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Makes chunk currency content-addressed instead of tool-session dependent.
   */
  id: AutoMovieContentDigest;
  /**
   * Production deliverable id that owns the completed range.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Connects every rendered range to its source-declared deliverable namespace.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Carries deliverable ownership through the plan without exposing publication authorship to MCP.
   */
  deliverable: string;
  /**
   * Final moving-image deliverable class that owns this video-only chunk.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Lets typed source distinguish the feature stream from diagnostic guide streams.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Closes video range classification in the package schema rather than a tool option.
   */
  kind: "feature" | "guide-pass";
  /**
   * Beauty or the one structural pass declared for this range.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Exposes which compiled beauty or structural channel ordinary render code must capture.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Selects a declared guide pass through deterministic plan data, not MCP direction.
   */
  pass: AutoMovieGuidePass;
  /**
   * Inclusive zero-based film frame.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Gives workers an unambiguous source-owned beginning for resumable work.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Derives the inclusive range boundary in package planning rather than tool state.
   */
  frameStart: number;
  /**
   * Exclusive film-frame boundary.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Gives repository workers an exact nonoverlapping stopping boundary.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Fixes exclusive range termination in deterministic plan construction.
   */
  frameEndExclusive: number;
  /**
   * Exact edit mapping for every frame in the range.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Supplies source-owned capture code with every resolved frame in the assigned range.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Materializes edit sampling before execution instead of asking MCP to reconstruct it.
   */
  frames: IAutoMovieProductionRenderFrame[];
}

/**
 * Persisted plan reopened by every `automovie render` subcommand.
 *
 * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Gives every render subcommand one source-controlled, reopenable statement of work.
 * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Persists render planning at the deterministic package boundary rather than in MCP memory.
 */
export interface IAutoMovieProductionRenderJobPlan {
  /**
   * Plan schema.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Allows project code to reject persisted plans from an incompatible schema generation.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Versions the disk contract without coupling it to the MCP protocol.
   */
  version: 3;
  /**
   * Exact production namespace that owns every slot and output.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Names the production that repository paths, locks, and completed outputs belong to.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Anchors output ownership in compiled plan data instead of tool context.
   */
  productionId: string;
  /**
   * Compiler source-input fingerprint used by all captures.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Lets ordinary verification detect any change to compiler-consumed source inputs.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Carries compiler provenance as a stable digest without exposing compilation as MCP authorship.
   */
  compileFingerprint: AutoMovieContentDigest;
  /**
   * Digest of the compiler-owned film edit.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Allows project code to distinguish a new film edit from unchanged source infrastructure.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Records edit identity in deterministic planning rather than a tool-authored revision marker.
   */
  editFingerprint: AutoMovieContentDigest;
  /**
   * Homogeneous capture and encoder identity.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Makes the capture and encoding environment reviewable beside the planned edit.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Embeds runtime closure in package output rather than hidden MCP execution context.
   */
  runtimeIdentity: IAutoMovieProductionRenderRuntimeIdentity;
  /**
   * Proxy/final cost policy; both retain the same edit fingerprint.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Lets the same authored edit be rendered under an explicit proxy or final cost policy.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Stores quality policy as deterministic package input, not an MCP session preference.
   */
  tier: IAutoMovieProductionRenderTier;
  /**
   * Compiler-owned full-quality clock and raster before tier sampling.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Preserves the compiler's full-quality raster and clock for audit and tier derivation.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps the authoritative source format in typed compiler output rather than tool state.
   */
  sourceFrameFormat: IAutoMovieProductionDesign["frameFormat"];
  /**
   * Exact production raster and frame clock.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Gives capture code the exact tier-adjusted raster and frame clock it must honor.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Resolves emitted format deterministically before any host worker runs.
   */
  frameFormat: IAutoMovieProductionDesign["frameFormat"];
  /**
   * Exact total film frame count.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Lets repository automation bound progress against an exact film length.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Carries total schedule extent as compiled data without an MCP progress clock.
   */
  totalFrames: number;
  /**
   * Maximum frames assigned to one independently resumable chunk.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Makes the source-owned recovery granularity explicit and reproducible.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Fixes chunk sizing in plan construction instead of tool-side scheduling.
   */
  chunkFrames: number;
  /**
   * Content-addressed video ranges in deterministic order.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Gives ordinary workers a stable ordered queue derived from the authored production.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Materializes the work queue in deterministic package output, outside MCP orchestration.
   */
  chunks: IAutoMovieProductionRenderChunk[];
  /**
   * Non-video compiler tracks used during terminal publication.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps authored captions and audio available to terminal publication code beside video work.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Transfers non-video compiler tracks through the plan without adding media-authoring tools.
   */
  tracks: {
    /** Canonical WebVTT derived from the caption placements. */
    captions: string;
    /** Exact compiler-owned audio placements. */
    audio: IAutoMovieFilmTimeline["tracks"]["audio"];
    /** Byte, duration, and format identity for every referenced audio asset. */
    audioAssets: IAutoMovieProductionAudioAssetIdentity[];
  };
}

/**
 * Byte-exact PNG committed by one completed chunk.
 *
 * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Gives source-owned verification a byte-exact account of each rendered frame artifact.
 * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Defines frame completion as deterministic receipt data rather than MCP observation.
 */
export interface IAutoMovieProductionRenderedFrameReceipt {
  /**
   * Exact zero-based film frame.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Associates resident PNG facts with the exact film coordinate they prove.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Grounds receipt ordering in the compiled frame schedule, not tool arrival order.
   */
  globalFrame: number;
  /**
   * Chunk-directory-relative PNG path.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Gives repository publication code a relocatable path to the captured PNG.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps artifact location relative to the deterministic chunk boundary.
   */
  path: string;
  /**
   * Digest of the resident PNG bytes.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Lets ordinary code prove that resident PNG bytes still match completion.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Content-addresses the captured frame without relying on MCP-held evidence.
   */
  digest: AutoMovieContentDigest;
  /**
   * Positive resident PNG byte count.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Allows source-side receipt checks to reject empty or truncated PNG artifacts.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Records byte extent in parser-verified package facts rather than a tool report.
   */
  bytes: number;
  /**
   * Decoded PNG width.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Lets repository checks compare decoded frame width with the planned raster.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Carries parser-measured width through deterministic receipt verification.
   */
  width: number;
  /**
   * Decoded PNG height.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Lets project logic reject frames whose decoded height diverges from the plan.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Makes raster-height proof a package receipt fact, not an MCP visual judgment.
   */
  height: number;
}

/**
 * Content-only completion facts; attempts and PIDs are deliberately absent.
 *
 * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Gives resumable project automation durable completion evidence without process-local noise.
 * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Separates content proof from transient worker state at the deterministic package boundary.
 */
export interface IAutoMovieProductionRenderChunkReceipt {
  /**
   * Receipt schema.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Lets repository readers reject completion records from a future incompatible layout.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Versions completion persistence independently from tool protocol evolution.
   */
  version: 1;
  /**
   * Stable operational slot.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Associates durable completion with the same stable operational address used by the plan.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Joins receipts to slots through package identity rather than worker-session context.
   */
  slot: string;
  /**
   * Exact current chunk content id.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Allows source-side recovery to distinguish current completion from stale bytes in the same slot.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Binds completion to content identity without consulting MCP history.
   */
  chunk: AutoMovieContentDigest;
  /**
   * Ordered byte facts for the full frame range.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Provides ordinary verification every captured-frame byte fact in scheduled order.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Carries complete range proof in the receipt rather than an MCP summary.
   */
  frames: IAutoMovieProductionRenderedFrameReceipt[];
  /**
   * Parser-verified chunk MP4.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Gives publication code parser-backed identity for the chunk's encoded video.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Encapsulates MP4 proof in deterministic completion data instead of a tool assertion.
   */
  encoded: {
    /** Chunk-directory-relative MP4 path. */
    path: string;
    /** Digest of the resident MP4 bytes. */
    digest: AutoMovieContentDigest;
    /** Positive resident MP4 byte count. */
    bytes: number;
  };
}

/**
 * Ephemeral attempt state stored outside a completion receipt.
 *
 * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Gives source-owned schedulers explicit transient failure state without corrupting completion facts.
 * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Models attempts as host-process data outside both durable receipts and MCP state.
 */
export interface IAutoMovieProductionRenderAttempt {
  /**
   * Stable operational slot.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Lets ordinary recovery correlate an attempt with the operational range it occupied.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Addresses attempt state by plan slot rather than MCP call identity.
   */
  slot: string;
  /**
   * Chunk identity attempted by the process.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Identifies exactly which planned content a running or failed process attempted.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Connects ephemeral execution to deterministic chunk identity without tool memory.
   */
  chunk: AutoMovieContentDigest;
  /**
   * Non-content attempt state.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Makes incomplete worker lifecycle state inspectable to repository automation.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Closes attempt classification to scheduler-owned execution states.
   */
  state: "running" | "failed";
  /**
   * Exact recovery action or failure message.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Gives source-side operators a concrete retry action or failure explanation.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps recovery guidance in scheduler output rather than MCP-authored advice.
   */
  correction: string;
}

/**
 * One resumable status row with an exact next action.
 *
 * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Gives ordinary render commands one actionable, typed status row per planned range.
 * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Derives resumable status from package records instead of MCP conversation state.
 */
export interface IAutoMovieProductionRenderChunkStatus {
  /**
   * Stable operational slot.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Lets project diagnostics retain the stable range address behind each status.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keys status computation to the persisted plan, not a tool invocation.
   */
  slot: string;
  /**
   * Current planned content identity.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Shows ordinary code which exact content identity the status evaluates.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Prevents stale slot state from masquerading as current deterministic work.
   */
  chunk: AutoMovieContentDigest;
  /**
   * Current completion/recovery classification.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Makes each range's completion or recovery class available to source-owned control flow.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Computes lifecycle classification at the package boundary rather than through MCP inference.
   */
  status: "planned" | "running" | "complete" | "stale" | "failed";
  /**
   * Exact next action for this state.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Supplies repository automation the exact next operation implied by current artifacts.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Produces correction text deterministically from plan, receipt, and attempt facts.
   */
  correction: string;
}

/**
 * Parser/preflight identity for one compiler-declared audio source asset.
 *
 * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Makes every compiler-referenced audio dependency reviewable before a render runs.
 * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Supplies deterministic audio preflight data without turning MCP into a media importer.
 */
export interface IAutoMovieProductionAudioAssetIdentity {
  /**
   * Project-relative compiler-declared asset path.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Preserves the source-authored project path that the compiler placed on the timeline.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Resolves audio ownership from repository paths rather than tool-managed uploads.
   */
  path: string;
  /**
   * Digest of the exact current asset bytes.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Lets project verification detect any replacement of the referenced audio bytes.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Content-addresses audio dependencies in package preflight instead of MCP storage.
   */
  digest: AutoMovieContentDigest;
  /**
   * Declared source duration.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Gives ordinary scheduling code the declared audio extent used for placement checks.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Carries decoded duration as deterministic adapter input, not tool-derived timing.
   */
  durationSeconds: number;
  /**
   * Declared PCM clock used by the deterministic adapter.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Exposes the PCM clock ordinary publication code must reproduce.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Fixes audio sample timing in typed preflight data rather than MCP configuration.
   */
  sampleRate: number;
  /**
   * Declared channel count used by the deterministic adapter.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Makes the decoded channel layout available to repository-owned adapter validation.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Pins channel count as a deterministic media fact outside the MCP tool surface.
   */
  channels: number;
}

/**
 * Build content-addressed chunks from the compiler-owned film edit.
 *
 * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Lets ordinary project code compile a film edit into content-addressed, resumable render work.
 * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Performs render planning as a pure package operation instead of an MCP authoring command.
 */
export const planProductionRenderJob = (props: {
  timeline: IAutoMovieFilmTimeline;
  production: IAutoMovieProductionDesign;
  runtimeIdentity: IAutoMovieProductionRenderRuntimeIdentity;
  sourceFingerprints: Readonly<Record<string, AutoMovieContentDigest>>;
  audioAssets: readonly IAutoMovieProductionAudioAssetIdentity[];
  chunkFrames: number;
  guidePasses?: readonly Exclude<AutoMovieGuidePass, "beauty">[];
  /** Explicit proxy/final policy; omitted is the exact final tier. */
  tier?: IAutoMovieProductionRenderTier;
}): IAutoMovieProductionRenderJobPlan => {
  if (
    Number.isSafeInteger(props.chunkFrames) === false ||
    props.chunkFrames <= 0
  )
    throw new Error(
      `chunkFrames must be a positive safe integer, but was ${props.chunkFrames}.`,
    );
  if (validDigest(props.runtimeIdentity.sourceDigest) === false)
    throw new Error(
      "Render runtime sourceDigest must be one current SHA-256 content identity.",
    );
  const tier = normalizeRenderTier(props.tier);
  const frameFormat = resolveProductionRenderTierFrameFormat(
    props.production.frameFormat,
    tier,
  );
  if (frameFormat.width % 2 !== 0 || frameFormat.height % 2 !== 0)
    throw new Error(
      "The production H.264 render adapter requires even width and height.",
    );
  if (
    props.timeline.id !== props.production.id ||
    props.timeline.fps !== props.production.frameFormat.fps ||
    props.timeline.totalFrames !==
      Math.round(
        props.production.targetRuntimeSeconds *
          props.production.frameFormat.fps,
      )
  )
    throw new Error(
      "The film edit differs from the production identity, frame clock, or runtime. Recompile before planning.",
    );
  if (props.timeline.totalFrames % tier.frameStep !== 0)
    throw new Error(
      `Render tier "${tier.kind}" frameStep ${tier.frameStep} does not divide the ${props.timeline.totalFrames}-frame edit. Choose a divisor so proxy and final have the same exact runtime.`,
    );
  const audioAssets = normalizeAudioAssets(props.audioAssets);
  for (const cue of props.timeline.tracks.audio) {
    const asset = audioAssets.find((candidate) => candidate.path === cue.asset);
    if (
      asset === undefined ||
      Math.round(asset.durationSeconds * props.timeline.fps) !==
        cue.sourceDurationFrames
    )
      throw new Error(
        `Audio cue "${cue.id}" lacks one digest-, format-, and duration-verified source asset.`,
      );
  }
  const legacyGuidePasses = normalizeGuidePasses(props.guidePasses ?? ["pose"]);
  const editFingerprint = digestJson({
    protocol: "automovie.production-render-edit.v1",
    id: props.timeline.id,
    fps: props.timeline.fps,
    totalFrames: props.timeline.totalFrames,
    segments: props.timeline.segments,
    omissions: props.timeline.omissions,
    tracks: props.timeline.tracks,
  });
  const frames = Array.from(
    { length: props.timeline.totalFrames / tier.frameStep },
    (_, outputFrame) => {
      const timelineFrame = outputFrame * tier.frameStep;
      return {
        ...sampleProductionRenderFrame(props.timeline, timelineFrame),
        globalFrame: outputFrame,
        timelineFrame,
        timeSeconds: outputFrame / frameFormat.fps,
      };
    },
  );
  const chunks: IAutoMovieProductionRenderChunk[] = [];
  for (const deliverable of props.production.deliverables) {
    // Only the two moving-image kinds carry chunks. Narrowing here rather than
    // resolving an empty pass list keeps the chunk's own `kind` exact, so a
    // caption or audio deliverable cannot reach a video parser probe.
    if (deliverable.kind !== "feature" && deliverable.kind !== "guide-pass")
      continue;
    const passes: readonly AutoMovieGuidePass[] =
      deliverable.kind === "feature"
        ? ["beauty"]
        : normalizeGuidePasses(
            deliverable.pass === undefined
              ? legacyGuidePasses
              : [deliverable.pass],
          );
    for (const pass of passes)
      for (
        let frameStart = 0, index = 0;
        frameStart < frames.length;
        frameStart += props.chunkFrames, ++index
      ) {
        const frameEndExclusive = Math.min(
          frameStart + props.chunkFrames,
          frames.length,
        );
        const range = frames.slice(frameStart, frameEndExclusive);
        const sources = [
          ...new Set(
            range.flatMap((frame) => frame.layers.map((layer) => layer.shot)),
          ),
        ]
          .sort(compareCodeUnits)
          .map((shot) => {
            const digest = props.sourceFingerprints[shot];
            if (digest === undefined || validDigest(digest) === false)
              throw new Error(
                `Render range references shot "${shot}" without one current compiler-owned source fingerprint.`,
              );
            return { shot, digest };
          });
        const slot = `${props.production.id}:${tier.kind}:${deliverable.id}:${pass}:${index}`;
        const identity = {
          protocol: "automovie.production-render-chunk.v3",
          production: props.production.id,
          tier,
          deliverable: deliverable.id,
          kind: deliverable.kind,
          editFingerprint,
          sourceFrameFormat: props.production.frameFormat,
          frameFormat,
          frameStart,
          frameEndExclusive,
          pass,
          runtimeIdentity: props.runtimeIdentity,
          sources,
        };
        chunks.push({
          slot,
          id: digestJson(identity),
          deliverable: deliverable.id,
          kind: deliverable.kind,
          pass,
          frameStart,
          frameEndExclusive,
          frames: range,
        });
      }
  }
  return {
    version: 3,
    productionId: props.production.id,
    compileFingerprint: props.timeline.inputFingerprint,
    editFingerprint,
    runtimeIdentity: props.runtimeIdentity,
    tier,
    sourceFrameFormat: structuredClone(props.production.frameFormat),
    frameFormat,
    totalFrames: frames.length,
    chunkFrames: props.chunkFrames,
    chunks,
    tracks: {
      captions: canonicalProductionWebVtt(props.timeline),
      audio: structuredClone(props.timeline.tracks.audio),
      audioAssets,
    },
  };
};

/**
 * Prove a persisted plan is exactly reproducible from current compiler inputs.
 *
 * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Enables repository automation to prove a saved plan still follows the current authored inputs.
 * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Recomputes plan identity deterministically without consulting MCP session history.
 */
export const verifyProductionRenderJobPlan = (props: {
  plan: IAutoMovieProductionRenderJobPlan;
  timeline: IAutoMovieFilmTimeline;
  production: IAutoMovieProductionDesign;
  runtimeIdentity: IAutoMovieProductionRenderRuntimeIdentity;
  sourceFingerprints: Readonly<Record<string, AutoMovieContentDigest>>;
  audioAssets: readonly IAutoMovieProductionAudioAssetIdentity[];
  guidePasses?: readonly Exclude<AutoMovieGuidePass, "beauty">[];
}): void => {
  const expected = planProductionRenderJob({
    timeline: props.timeline,
    production: props.production,
    runtimeIdentity: props.runtimeIdentity,
    sourceFingerprints: props.sourceFingerprints,
    audioAssets: props.audioAssets,
    chunkFrames: props.plan.chunkFrames,
    guidePasses: props.guidePasses,
    tier: props.plan.tier,
  });
  if (canonicalJson(props.plan) !== canonicalJson(expected))
    throw new Error(
      "Stored render plan differs from the current compiler-owned timeline and render inputs. Run automovie render plan, then rerender only changed chunk identities.",
    );
};

/**
 * Resolve one global frame, including exact dissolve and fade weights.
 *
 * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Lets source-owned renderers resolve cuts, fades, and dissolves at an exact film frame.
 * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Samples compiled transition math deterministically rather than asking an MCP client to compose frames.
 */
export const sampleProductionRenderFrame = (
  timeline: IAutoMovieFilmTimeline,
  globalFrame: number,
): IAutoMovieProductionRenderFrame => {
  if (
    Number.isSafeInteger(globalFrame) === false ||
    globalFrame < 0 ||
    globalFrame >= timeline.totalFrames
  )
    throw new Error(
      `Film-global frame ${globalFrame} is outside 0..${timeline.totalFrames - 1}.`,
    );
  const active = timeline.segments
    .map((segment, index) => ({ segment, index }))
    .filter(
      ({ segment }) =>
        segment.startFrame <= globalFrame && globalFrame < segment.endFrame,
    );
  const current = active.at(-1);
  if (current === undefined)
    throw new Error(
      `Film-global frame ${globalFrame} has no compiler-owned video segment.`,
    );
  const offset = globalFrame - current.segment.startFrame;
  const incoming: IAutoMovieProductionRenderLayer = {
    shot: current.segment.shot,
    sourceFrame: current.segment.sourceInFrame + offset,
    weight: 1,
  };
  if (
    current.segment.transitionIn.kind === "dissolve" &&
    offset < current.segment.transitionIn.durationFrames
  ) {
    const previous = timeline.segments[current.index - 1];
    if (previous === undefined)
      throw new Error(
        `Segment "${current.segment.shot}" dissolves without an outgoing segment.`,
      );
    const alpha = offset / current.segment.transitionIn.durationFrames;
    return frame(timeline, globalFrame, [
      {
        shot: previous.shot,
        sourceFrame:
          previous.sourceOutFrame -
          current.segment.transitionIn.durationFrames +
          offset,
        weight: 1 - alpha,
      },
      { ...incoming, weight: alpha },
    ]);
  }
  const fadeIn =
    current.segment.transitionIn.kind === "fade" &&
    offset < current.segment.transitionIn.durationFrames
      ? offset / current.segment.transitionIn.durationFrames
      : 1;
  const remaining = current.segment.endFrame - globalFrame;
  const fadeOut =
    current.segment.transitionOut.kind === "fade" &&
    remaining <= current.segment.transitionOut.durationFrames
      ? remaining / current.segment.transitionOut.durationFrames
      : 1;
  return frame(timeline, globalFrame, [
    { ...incoming, weight: Math.min(fadeIn, fadeOut) },
  ]);
};

/**
 * Resolve pass-specific transition inputs.
 *
 * Beauty is alpha composited. Structural guide passes are classifications or
 * geometric fields, so linearly blending their pixels invents invalid values;
 * they select the dominant shot layer instead (incoming wins an exact tie).
 *
 * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Gives ordinary capture code the valid shot inputs for beauty or structural guide output.
 * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Applies pass-specific transition semantics in package logic, outside the MCP evidence surface.
 */
export const productionRenderLayersForPass = (
  frame: IAutoMovieProductionRenderFrame,
  pass: AutoMovieGuidePass,
): IAutoMovieProductionRenderLayer[] => {
  if (pass === "beauty") return structuredClone(frame.layers);
  const selected = frame.layers.reduce((selected, candidate) =>
    candidate.weight >= selected.weight ? candidate : selected,
  );
  return [
    {
      ...structuredClone(selected),
      weight: 1,
    },
  ];
};

/**
 * Canonical WebVTT derived only from compiled caption placements.
 *
 * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Allows project publication code to derive captions reproducibly from the compiled timeline.
 * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Generates canonical WebVTT as deterministic package output rather than MCP-authored text.
 */
export const canonicalProductionWebVtt = (
  timeline: IAutoMovieFilmTimeline,
): string => {
  const cues = [...timeline.tracks.captions].sort(
    (left, right) =>
      left.startFrame - right.startFrame ||
      left.endFrame - right.endFrame ||
      compareCodeUnits(left.id, right.id),
  );
  return [
    `WEBVTT ${webVttPlainText(timeline.id)}`,
    "",
    ...cues.flatMap((cue) => [
      webVttPlainText(cue.id),
      `${webVttTime(cue.startFrame / timeline.fps)} --> ${webVttTime(
        cue.endFrame / timeline.fps,
      )}`,
      `<lang ${webVttPlainText(cue.language)}>${
        cue.speaker === undefined
          ? webVttPlainText(cue.text)
          : `<v ${webVttPlainText(cue.speaker)}>${webVttPlainText(
              cue.text,
            )}</v>`
      }</lang>`,
      "",
    ]),
  ].join("\n");
};

/**
 * Classify current identities without treating an old slot as current.
 *
 * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Lets source-owned orchestration classify every planned chunk from durable and transient records.
 * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Computes recovery status in deterministic package code instead of an MCP workflow.
 */
export const productionRenderChunkStatuses = (props: {
  plan: IAutoMovieProductionRenderJobPlan;
  receipts: readonly IAutoMovieProductionRenderChunkReceipt[];
  attempts: readonly IAutoMovieProductionRenderAttempt[];
}): IAutoMovieProductionRenderChunkStatus[] => {
  return props.plan.chunks.map((chunk) => {
    const slotReceipts = props.receipts.filter(
      (item) => item.slot === chunk.slot,
    );
    const receipt =
      slotReceipts.find((item) => item.chunk === chunk.id) ??
      slotReceipts.at(-1);
    const slotAttempts = props.attempts.filter(
      (item) => item.slot === chunk.slot,
    );
    const attempt =
      slotAttempts.find((item) => item.chunk === chunk.id) ??
      slotAttempts.at(-1);
    if (receipt?.chunk === chunk.id)
      return status(
        chunk,
        "complete",
        "Verify current bytes, then reuse this chunk.",
      );
    if (attempt?.chunk === chunk.id)
      return status(
        chunk,
        attempt.state,
        attempt.state === "running"
          ? "Wait for its lock owner or recover the abandoned attempt."
          : attempt.correction,
      );
    if (receipt !== undefined || attempt !== undefined)
      return status(
        chunk,
        "stale",
        "Quarantine prior slot output and render only this current chunk.",
      );
    return status(
      chunk,
      "planned",
      "Acquire its lock, render, encode, verify, and commit.",
    );
  });
};

/**
 * Verify completion identity, exact range coverage, raster, and byte facts.
 *
 * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Allows repository commands to prove that completed frame and MP4 bytes match their current chunk.
 * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Validates completion from parser and content facts without MCP judgment.
 */
export const verifyProductionRenderChunkReceipt = (props: {
  plan: IAutoMovieProductionRenderJobPlan;
  chunk: IAutoMovieProductionRenderChunk;
  receipt: IAutoMovieProductionRenderChunkReceipt;
}): void => {
  const { plan, chunk, receipt } = props;
  if (
    receipt.version !== 1 ||
    receipt.slot !== chunk.slot ||
    receipt.chunk !== chunk.id
  )
    throw new Error(`Chunk receipt "${receipt.slot}" is stale.`);
  if (receipt.frames.length !== chunk.frames.length)
    throw new Error(
      `Chunk "${chunk.slot}" has ${receipt.frames.length} frame receipts; expected ${chunk.frames.length}.`,
    );
  receipt.frames.forEach((frameReceipt, index) => {
    const expected = chunk.frames[index]!.globalFrame;
    if (
      frameReceipt.globalFrame !== expected ||
      frameReceipt.width !== plan.frameFormat.width ||
      frameReceipt.height !== plan.frameFormat.height ||
      validByteFact(frameReceipt) === false
    )
      throw new Error(
        `Chunk "${chunk.slot}" frame ${index} does not prove global frame ${expected} at the production raster.`,
      );
  });
  if (validByteFact(receipt.encoded) === false)
    throw new Error(`Chunk "${chunk.slot}" has no verified encoded output.`);
};

interface IProductionRenderChunkFailure {
  error: unknown;
}

class ProductionRenderChunkLifecycleError extends AggregateError {}

/** Preserve one acquired chunk's complete fatal lifecycle in phase order. */
const productionRenderChunkLifecycleFailure = (
  attempt: IProductionRenderChunkFailure | undefined,
  failureRecord: IProductionRenderChunkFailure | undefined,
  release: IProductionRenderChunkFailure | undefined,
): unknown => {
  const failures = [attempt, failureRecord, release].filter(
    (failure): failure is IProductionRenderChunkFailure =>
      failure !== undefined,
  );
  if (failures.length === 1) return failures[0]!.error;
  return new ProductionRenderChunkLifecycleError(
    failures.map((failure) => failure.error),
    "Production render chunk cleanup failed after the render attempt failed.",
  );
};

/**
 * Schedule only non-current chunks through host-owned lock/byte adapters.
 *
 * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Gives ordinary host code a bounded worker scheduler for only the chunks that still need bytes.
 * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Executes deterministic work through host-owned lock and byte adapters rather than MCP side effects.
 */
export const runProductionRenderJob = async (props: {
  plan: IAutoMovieProductionRenderJobPlan;
  workers: number;
  deliverable?: string;
  adapters: {
    current(
      chunk: IAutoMovieProductionRenderChunk,
    ): Promise<IAutoMovieProductionRenderChunkReceipt | null>;
    acquire(chunk: IAutoMovieProductionRenderChunk): Promise<boolean>;
    render(
      chunk: IAutoMovieProductionRenderChunk,
    ): Promise<IAutoMovieProductionRenderChunkReceipt>;
    fail(
      chunk: IAutoMovieProductionRenderChunk,
      correction: string,
    ): Promise<void>;
    release(chunk: IAutoMovieProductionRenderChunk): Promise<void>;
  };
}): Promise<{
  complete: string[];
  rendered: string[];
  busy: string[];
  failed: Array<{ slot: string; correction: string }>;
}> => {
  if (Number.isSafeInteger(props.workers) === false || props.workers <= 0)
    throw new Error(
      `workers must be a positive safe integer, but was ${props.workers}.`,
    );
  const queue = props.plan.chunks.filter(
    (chunk) =>
      props.deliverable === undefined ||
      chunk.deliverable === props.deliverable,
  );
  if (
    props.deliverable !== undefined &&
    props.plan.chunks.some(
      (chunk) => chunk.deliverable === props.deliverable,
    ) === false
  )
    throw new Error(
      `Render plan has no video chunks for deliverable "${props.deliverable}".`,
    );
  const output = {
    complete: [] as string[],
    rendered: [] as string[],
    busy: [] as string[],
    failed: [] as Array<{ slot: string; correction: string }>,
  };
  let cursor = 0;
  const fatalFailures: IProductionRenderChunkFailure[] = [];
  const reserveFatalFailure = (): IProductionRenderChunkFailure | undefined => {
    if (fatalFailures.length !== 0) return undefined;
    const failure: IProductionRenderChunkFailure = { error: undefined };
    fatalFailures.push(failure);
    return failure;
  };
  const recordFatalFailure = (error: unknown): void => {
    const failure = reserveFatalFailure();
    if (failure !== undefined) failure.error = error;
  };
  const worker = async (): Promise<void> => {
    try {
      while (fatalFailures.length === 0 && cursor < queue.length) {
        const chunk = queue[cursor++]!;
        const current = await props.adapters.current(chunk);
        if (current !== null) {
          verifyProductionRenderChunkReceipt({
            plan: props.plan,
            chunk,
            receipt: current,
          });
          output.complete.push(chunk.slot);
          continue;
        }
        if ((await props.adapters.acquire(chunk)) === false) {
          output.busy.push(chunk.slot);
          continue;
        }
        let attemptFailure: IProductionRenderChunkFailure | undefined;
        let failureRecordFailure: IProductionRenderChunkFailure | undefined;
        let releaseFailure: IProductionRenderChunkFailure | undefined;
        let fatalFailure: IProductionRenderChunkFailure | undefined;
        try {
          const receipt = await props.adapters.render(chunk);
          verifyProductionRenderChunkReceipt({
            plan: props.plan,
            chunk,
            receipt,
          });
          output.rendered.push(chunk.slot);
        } catch (error) {
          attemptFailure = { error };
          const correction =
            error instanceof Error ? error.message : String(error);
          try {
            await props.adapters.fail(chunk, correction);
            output.failed.push({ slot: chunk.slot, correction });
          } catch (failure) {
            failureRecordFailure = { error: failure };
            fatalFailure = reserveFatalFailure();
          }
        } finally {
          try {
            await props.adapters.release(chunk);
          } catch (failure) {
            releaseFailure = { error: failure };
            fatalFailure ??= reserveFatalFailure();
          }
          if (fatalFailure !== undefined)
            fatalFailure.error = productionRenderChunkLifecycleFailure(
              attemptFailure,
              failureRecordFailure,
              releaseFailure,
            );
        }
      }
    } catch (error) {
      recordFatalFailure(error);
    }
  };
  await Promise.all(
    Array.from(
      { length: Math.min(props.workers, Math.max(1, queue.length)) },
      worker,
    ),
  );
  if (fatalFailures.length !== 0) throw fatalFailures[0]!.error;
  const order = new Map(queue.map((chunk, index) => [chunk.slot, index]));
  output.complete.sort((left, right) => order.get(left)! - order.get(right)!);
  output.rendered.sort((left, right) => order.get(left)! - order.get(right)!);
  output.busy.sort((left, right) => order.get(left)! - order.get(right)!);
  output.failed.sort(
    (left, right) => order.get(left.slot)! - order.get(right.slot)!,
  );
  return output;
};

interface IProductionOwnedDescriptorFailure {
  error: unknown;
}

class ProductionOwnedDescriptorCleanupError extends AggregateError {}

/** Close one production-owned descriptor without losing earlier failures. */
const closeProductionOwnedDescriptor = (
  descriptor: number,
  failure: IProductionOwnedDescriptorFailure | undefined,
  target: string,
): void => {
  try {
    fs.closeSync(descriptor);
  } catch (closeFailure) {
    if (failure === undefined) throw closeFailure;
    throw new ProductionOwnedDescriptorCleanupError(
      [
        ...(failure.error instanceof ProductionOwnedDescriptorCleanupError
          ? failure.error.errors
          : [failure.error]),
        closeFailure,
      ],
      `Production-owned descriptor cleanup failed after the read failed: ${target}.`,
    );
  }
};

/**
 * Read one production-owned file without following a link in its namespace.
 *
 * The returned bytes come from one regular file whose complete ancestry is a
 * physical descendant of `root`. Every directory and the file are identified
 * before the read and rechecked afterwards, so a replacement cannot turn a
 * verified content-addressed path into different resident bytes.
 *
 * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Lets repository code read a verified production descendant without trusting mutable path traversal.
 * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Enforces production-owned artifact access in package code instead of exposing filesystem reads as an MCP tool.
 */
export function readAutoMovieProductionOwnedFile(props: {
  /** Physical production ownership root. */
  root: string;
  /** Physical directory that owns the relative file. */
  directory: string;
  /** Strict descendant path below `directory`. */
  relative: string;
  /** Return `null` only when the first target observation is absent. */
  optional: true;
}): Uint8Array | null;
/**
 * Read one required production-owned file without following a link in its
 * namespace.
 *
 * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Gives ordinary project code a deterministic read of its own required artifact instead of relying on hidden MCP session state.
 * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps required artifact access in a typed repository API rather than a tool-authored content operation.
 */
export function readAutoMovieProductionOwnedFile(props: {
  /** Physical production ownership root. */
  root: string;
  /** Physical directory that owns the relative file. */
  directory: string;
  /** Strict descendant path below `directory`. */
  relative: string;
}): Uint8Array;
/**
 * Execute the production-owned read with an explicit optionality policy.
 *
 * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Implements the code-owned read boundary whose result remains reproducible outside an MCP session.
 * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Performs repository-owned artifact access without turning the evidence surface into an authoring API.
 */
export function readAutoMovieProductionOwnedFile(props: {
  root: string;
  directory: string;
  relative: string;
  optional?: boolean;
}): Uint8Array | null {
  const root = path.resolve(props.root);
  const directory = path.resolve(props.directory);
  const target = path.resolve(directory, props.relative);
  if (
    `${directory}${path.sep}`.startsWith(`${root}${path.sep}`) === false ||
    target.startsWith(`${directory}${path.sep}`) === false
  )
    throw new Error(
      `Production-owned path "${props.relative}" escapes its owned directory.`,
    );

  const relativeParent = path.relative(root, path.dirname(target));
  const components =
    relativeParent.length === 0 ? [] : relativeParent.split(path.sep);
  const directories = [root];
  for (const component of components)
    directories.push(path.join(directories.at(-1)!, component));

  const identities: IProductionOwnedPathIdentity[] = directories.map(
    (file) => ({
      file,
      identity: productionOwnedDirectoryIdentity(file),
    }),
  );
  const assertResidentDirectories = (): void => {
    const changed = identities.find(
      (expected) =>
        expected.identity !== productionOwnedDirectoryIdentity(expected.file),
    );
    if (changed !== undefined)
      throw new Error(
        `Production-owned path "${changed.file}" changed physical identity while it was read.`,
      );
  };
  let linkedIdentity: string;
  try {
    linkedIdentity = productionOwnedFileIdentity(target);
  } catch (error) {
    if (
      props.optional === true &&
      (error as NodeJS.ErrnoException).code === "ENOENT"
    ) {
      assertResidentDirectories();
      return null;
    }
    throw error;
  }
  const descriptor = fs.openSync(target, "r");
  let failure: IProductionOwnedDescriptorFailure | undefined;
  try {
    const openedIdentity = productionOwnedDescriptorIdentity(
      target,
      descriptor,
    );
    const assertResidentFile = (): void => {
      assertResidentDirectories();
      if (productionOwnedFileIdentity(target) !== linkedIdentity)
        throw new Error(
          `Production-owned path "${target}" changed physical identity while it was read.`,
        );
      const residentDescriptor = fs.openSync(target, "r");
      let residentFailure: IProductionOwnedDescriptorFailure | undefined;
      try {
        if (
          productionOwnedDescriptorIdentity(target, residentDescriptor) !==
          openedIdentity
        )
          throw new Error(
            `Production-owned path "${target}" changed physical identity while it was read.`,
          );
      } catch (error) {
        residentFailure = { error };
        throw error;
      } finally {
        closeProductionOwnedDescriptor(
          residentDescriptor,
          residentFailure,
          target,
        );
      }
    };
    assertResidentFile();
    const bytes = fs.readFileSync(descriptor);
    assertResidentFile();
    return bytes;
  } catch (error) {
    failure = { error };
    throw error;
  } finally {
    closeProductionOwnedDescriptor(descriptor, failure, target);
  }
}

const frame = (
  timeline: IAutoMovieFilmTimeline,
  globalFrame: number,
  layers: IAutoMovieProductionRenderLayer[],
): IAutoMovieProductionRenderFrame => ({
  globalFrame,
  timelineFrame: globalFrame,
  timeSeconds: globalFrame / timeline.fps,
  layers,
});

const normalizeRenderTier = (
  tier: IAutoMovieProductionRenderTier | undefined,
): IAutoMovieProductionRenderTier => {
  const value = tier ?? {
    kind: "final",
    resolutionScale: 1,
    frameStep: 1,
  };
  if (
    (value.kind !== "proxy" && value.kind !== "final") ||
    Number.isFinite(value.resolutionScale) === false ||
    value.resolutionScale <= 0 ||
    value.resolutionScale > 1 ||
    Number.isSafeInteger(value.frameStep) === false ||
    value.frameStep <= 0 ||
    value.frameStep > 16 ||
    (value.kind === "final" &&
      (value.resolutionScale !== 1 || value.frameStep !== 1)) ||
    (value.kind === "proxy" &&
      value.resolutionScale === 1 &&
      value.frameStep === 1)
  )
    throw new Error(
      "Render tier must be exact final (scale 1, step 1) or a bounded cheaper proxy (scale in (0, 1], integer step 1..16, with at least one reduction).",
    );
  return structuredClone(value);
};

/**
 * Derive the exact even raster and frame clock for one render tier.
 *
 * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Lets project planning derive a codec-safe proxy or final raster from authored frame format.
 * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Resolves tier dimensions and clock through deterministic math rather than MCP render settings.
 */
export const resolveProductionRenderTierFrameFormat = (
  source: IAutoMovieProductionDesign["frameFormat"],
  tier: IAutoMovieProductionRenderTier,
): IAutoMovieProductionDesign["frameFormat"] => {
  const normalized = normalizeRenderTier(tier);
  if (normalized.kind === "final") return structuredClone(source);
  const even = (value: number): number =>
    Math.max(2, Math.floor((value * normalized.resolutionScale) / 2) * 2);
  return {
    width: even(source.width),
    height: even(source.height),
    fps: source.fps / normalized.frameStep,
    colorSpace: source.colorSpace,
  };
};

const status = (
  chunk: IAutoMovieProductionRenderChunk,
  state: IAutoMovieProductionRenderChunkStatus["status"],
  correction: string,
): IAutoMovieProductionRenderChunkStatus => ({
  slot: chunk.slot,
  chunk: chunk.id,
  status: state,
  correction,
});

const normalizeGuidePasses = (
  passes: readonly Exclude<AutoMovieGuidePass, "beauty">[],
): Exclude<AutoMovieGuidePass, "beauty">[] => {
  const valid = new Set<AutoMovieGuidePass>([
    "depth",
    "mask",
    "normal",
    "outline",
    "pose",
  ]);
  const output: Exclude<AutoMovieGuidePass, "beauty">[] = [];
  for (const pass of passes) {
    if (valid.has(pass) === false)
      throw new Error(`Guide-pass render cannot use "${pass}".`);
    if (output.includes(pass) === false) output.push(pass);
  }
  if (output.length !== 1)
    throw new Error(
      `A guide-pass deliverable requires exactly one declared pass, but received ${output.length}. Declare separate deliverables when the production contract gains per-pass ownership.`,
    );
  return output;
};

const normalizeAudioAssets = (
  assets: readonly IAutoMovieProductionAudioAssetIdentity[],
): IAutoMovieProductionAudioAssetIdentity[] => {
  const paths = new Set<string>();
  const output = [...assets]
    .sort((left, right) => compareCodeUnits(left.path, right.path))
    .map((asset) => {
      if (
        asset.path.trim().length === 0 ||
        paths.has(asset.path) ||
        validByteFact({ digest: asset.digest, bytes: 1 }) === false ||
        Number.isFinite(asset.durationSeconds) === false ||
        asset.durationSeconds <= 0 ||
        Number.isSafeInteger(asset.sampleRate) === false ||
        asset.sampleRate <= 0 ||
        Number.isSafeInteger(asset.channels) === false ||
        asset.channels <= 0
      )
        throw new Error(
          `Audio asset "${asset.path}" has invalid identity, duration, sample rate, channels, or duplicate ownership.`,
        );
      paths.add(asset.path);
      return structuredClone(asset);
    });
  return output;
};

const webVttTime = (seconds: number): string => {
  const milliseconds = Math.round(seconds * 1_000);
  const hours = Math.floor(milliseconds / 3_600_000);
  const minutes = Math.floor((milliseconds % 3_600_000) / 60_000);
  const remainder = Math.floor((milliseconds % 60_000) / 1_000);
  const fraction = milliseconds % 1_000;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(
    2,
    "0",
  )}:${String(remainder).padStart(2, "0")}.${String(fraction).padStart(
    3,
    "0",
  )}`;
};

/** Escape one authored plain-text field into a single WebVTT content line. */
const webVttPlainText = (value: string): string =>
  value
    .replace(/[\u0000-\u001f\u007f]/gu, " ")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");

const validByteFact = (fact: { digest: string; bytes: number }): boolean =>
  Number.isSafeInteger(fact.bytes) &&
  fact.bytes > 0 &&
  validDigest(fact.digest);

const validDigest = (value: string): boolean =>
  /^sha256:[0-9a-f]{64}$/.test(value);

const digestJson = (value: unknown): AutoMovieContentDigest =>
  `sha256:${createHash("sha256")
    .update(Buffer.from(canonicalJson(value), "utf8"))
    .digest("hex")}`;

const canonicalJson = (value: unknown): string => {
  if (value === null || typeof value === "boolean" || typeof value === "string")
    return JSON.stringify(value);
  if (typeof value === "number") {
    if (Number.isFinite(value) === false)
      throw new Error("Render identity refuses non-finite numbers.");
    return JSON.stringify(value);
  }
  if (Array.isArray(value))
    return `[${value.map((item) => canonicalJson(item)).join(",")}]`;
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .filter((key) => record[key] !== undefined)
      .sort(compareCodeUnits)
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
      .join(",")}}`;
  }
  throw new Error("Render identity requires JSON-compatible values.");
};

const compareCodeUnits = (left: string, right: string): number =>
  left < right ? -1 : left > right ? 1 : 0;

interface IProductionOwnedPathIdentity {
  file: string;
  identity: string;
}

const productionOwnedDirectoryIdentity = (directory: string): string => {
  const linked = fs.lstatSync(directory, { bigint: true });
  if (linked.isSymbolicLink() || linked.isDirectory() === false)
    throw new Error(
      `Production-owned directory "${directory}" is not a physical directory.`,
    );
  return `${linked.dev}\0${linked.ino}`;
};

const productionOwnedFileIdentity = (file: string): string => {
  const linked = fs.lstatSync(file, { bigint: true });
  if (linked.isSymbolicLink() || linked.isFile() === false)
    throw new Error(`Production-owned path "${file}" is not a physical file.`);
  return `${linked.dev}\0${linked.ino}`;
};

const productionOwnedDescriptorIdentity = (
  file: string,
  descriptor: number,
): string => {
  const opened = fs.fstatSync(descriptor, { bigint: true });
  if (opened.isFile() === false)
    throw new Error(`Production-owned path "${file}" is not a physical file.`);
  return `${opened.dev}\0${opened.ino}`;
};
