import { IAutoMovieShot } from "../cinematics";
import { IAutoMovieVector3 } from "../geometry";
import { IAutoMovieModel } from "../model";
import { IAutoMovieMotion } from "../motion";
import { IAutoMovieScene } from "../scene";
import {
  AutoMovieContentDigest,
  IAutoMovieDesignTarget,
  IAutoMovieFormationDesign,
  IAutoMovieModelRecipe,
  IAutoMovieProductionDesign,
  IAutoMovieProductionDeliverable,
  IAutoMovieShotContract,
  IAutoMovieShotPredicate,
  IAutoMovieWorldDesign,
} from "./IAutoMovieProductionDesign";

/** A stable production diagnostic returned by compiler, lint and MCP. */
export interface IAutoMovieDiagnostic {
  /** Machine-readable diagnostic code. */
  code: string;
  /** Whether the diagnostic blocks the current operation. */
  category: "error" | "warning";
  /** Pipeline phase that owns the correction. */
  phase: "project" | "design" | "source" | "compile" | "review" | "render";
  /** Stable target identity. */
  target: string;
  /** Project-relative file or null when no one file owns it. */
  path: string | null;
  /**
   * Human-readable cause followed by the concrete correction owned by this
   * phase. Do not discard it and retry unchanged.
   */
  message: string;
}

/** The tracked manifest for a coding-agent production repository. */
export interface IAutoMovieProductionManifest {
  /** Production format version. */
  formatVersion: 2;
  /** Repository-local project identity, excluded from content fingerprints. */
  projectId: string;
  /**
   * Project-relative coding-agent-owned source directories. Shot modules must
   * resolve as real TypeScript files inside one of these roots.
   */
  sourceRoots: string[];
  /**
   * Additional project-relative directories whose exact files affect compile
   * and render identity, such as viewer, scripts and public assets.
   */
  contentRoots?: string[];
  /** Additional project-relative files whose bytes affect compile identity. */
  contentFiles?: string[];
  /** Compiler-owned generated root. */
  generatedRoot: string;
  /** Content-addressed render root. */
  renderRoot: string;
  /** Optional non-destructive legacy import provenance. */
  importedLegacy?: {
    /** Imported legacy project revision. */
    revision: number;
    /** Relative source directory containing the untouched legacy tree. */
    sourceRoot: string;
  };
}

/** One compiler-owned generated file. */
export interface IAutoMovieGeneratedFile {
  /** Project-relative generated path. */
  path: string;
  /** Ownership marker. */
  owner: "compiler";
  /** File-byte digest. */
  digest: AutoMovieContentDigest;
  /** Design or source targets that produced the file. */
  sourceTargets: string[];
}

/** Manifest proving the identity and ownership of generated output. */
export interface IAutoMovieGeneratedManifest {
  /** Generated-manifest format. */
  version: 1;
  /** Compiler identity. */
  compiler: {
    /** Package version. */
    packageVersion: string;
    /** Content protocol version. */
    protocolVersion: string;
  };
  /** Ordered design and source input fingerprint. */
  inputFingerprint: AutoMovieContentDigest;
  /** Compiler-owned files. */
  files: IAutoMovieGeneratedFile[];
}

/** One byte-exact file proving a final production deliverable. */
export interface IAutoMovieProductionDeliverableFile {
  /** Render-root-relative regular file path. */
  path: string;
  /** Exact file-byte digest. */
  digest: AutoMovieContentDigest;
  /** Exact non-zero file size. */
  bytes: number;
  /** Explicit media type, such as video/mp4 or text/vtt. */
  mediaType: string;
}

/** One materialized production deliverable in the aggregate render ledger. */
export interface IAutoMovieProductionRenderedDeliverable {
  /** Exact id declared by production design. */
  id: string;
  /** Exact kind declared by production design. */
  kind: IAutoMovieProductionDeliverable["kind"];
  /** Byte-exact owned output files. */
  files: IAutoMovieProductionDeliverableFile[];
  /** Timeline duration, or null for a still-only deliverable. */
  runtimeSeconds: number | null;
  /** Rendered frame count, or null when the kind has no video frame clock. */
  frameCount: number | null;
  /** Actual codec name, or null for unencoded text/image artifacts. */
  codec: string | null;
}

/** Aggregate final-delivery ledger bound to one current compile. */
export interface IAutoMovieProductionRenderManifest {
  /** Aggregate manifest format. */
  version: 1;
  /** Exact compiler input that produced every listed output. */
  compileFingerprint: AutoMovieContentDigest;
  /** Materialized required and optional deliverables. */
  deliverables: IAutoMovieProductionRenderedDeliverable[];
}

/** Parser-derived metadata for one renderer-owned output file. */
export type IAutoMovieProductionMediaProbe =
  | {
      /** Decoded PNG raster. */
      kind: "png";
      /** Actual pixel width. */
      width: number;
      /** Actual pixel height. */
      height: number;
    }
  | {
      /** Parsed ISO base-media video track. */
      kind: "video";
      /** Actual container family. */
      container: "mp4";
      /** Actual video codec family. */
      codec: "h264";
      /** Actual coded width. */
      width: number;
      /** Actual coded height. */
      height: number;
      /** Actual track duration in seconds. */
      runtimeSeconds: number;
      /** Actual video sample count. */
      frameCount: number;
      /** Actual constant frame rate. */
      fps: number;
    }
  | {
      /** Parsed ISO base-media audio track. */
      kind: "audio";
      /** Actual container family. */
      container: "mp4";
      /** Actual codec string reported by the container. */
      codec: string;
      /** Actual track duration in seconds. */
      runtimeSeconds: number;
      /** Actual audio channel count. */
      channels: number;
      /** Actual audio sample rate. */
      sampleRate: number;
    }
  | {
      /** Parsed WebVTT text. */
      kind: "webvtt";
      /** Number of syntactically valid, non-empty cue timing lines. */
      cueCount: number;
      /** Earliest parsed cue start in seconds. */
      firstCueSeconds: number;
      /** Latest parsed cue end in seconds. */
      lastCueSeconds: number;
    };

/** One file record independently derived by the renderer-owned receipt gate. */
export interface IAutoMovieProductionRenderReceiptFile extends IAutoMovieProductionDeliverableFile {
  /** Deliverable that exclusively owns this path. */
  deliverable: string;
  /** Parser-derived media facts. */
  probe: IAutoMovieProductionMediaProbe;
}

/** Renderer-owned aggregate receipt bound to current output bytes. */
export interface IAutoMovieProductionRenderReceipt {
  /** Receipt format. */
  version: 2;
  /** Exact digest of `.automovie/render-manifest.json`. */
  manifestDigest: AutoMovieContentDigest;
  /** Exact byte and media probes in canonical path order. */
  files: IAutoMovieProductionRenderReceiptFile[];
}

/** Deterministic pure helpers exposed to a shot source builder. */
export interface IAutoMovieSourceOracle {
  /** Euclidean distance between two points. */
  distance(
    left: { x: number; y: number; z: number },
    right: { x: number; y: number; z: number },
  ): number;
  /** Height of the first matching world surface, or zero. */
  groundHeight(point: { x: number; z: number }): number;
}

/** One non-negative film time authored as an exact frame or frame-grid second. */
export type AutoMovieFilmTime =
  | {
      /** Zero-based production frame. */
      frame: number;
    }
  | {
      /** Seconds that must land exactly on the production frame clock. */
      seconds: number;
    };

/** A cut or bounded transition at one side of a video edit. */
export type IAutoMovieFilmTransition =
  | {
      /** Zero-duration hard cut. */
      kind: "cut";
    }
  | {
      /** Cross-shot overlap using declared head and tail handles. */
      kind: "dissolve";
      /** Exact overlap duration. */
      duration: AutoMovieFilmTime;
    }
  | {
      /** In-segment fade without cross-shot overlap. */
      kind: "fade";
      /** Exact fade duration. */
      duration: AutoMovieFilmTime;
    };

/** One source-shot placement on the finished-film video track. */
export interface IAutoMovieVideoEdit {
  /** Current compiled shot id. */
  shot: string;
  /** Inclusive source frame. */
  sourceIn: AutoMovieFilmTime;
  /** Exclusive source frame. */
  sourceOut: AutoMovieFilmTime;
  /** Film-global inclusive start frame. */
  start: AutoMovieFilmTime;
  /** Available transition material at each side of this placement. */
  handles: {
    /** Available incoming frames. */
    head: AutoMovieFilmTime;
    /** Available outgoing frames. */
    tail: AutoMovieFilmTime;
  };
  /** Transition entering this placement. */
  transitionIn: IAutoMovieFilmTransition;
  /** Transition leaving this placement. */
  transitionOut: IAutoMovieFilmTransition;
}

/** One declared audio asset placement. */
export interface IAutoMovieAudioCue {
  /** Stable cue id. */
  id: string;
  /** Project-relative declared render-content asset. */
  asset: string;
  /** Declared source duration used for bounded trim validation. */
  sourceDuration: AutoMovieFilmTime;
  /** Source offset inside the asset. */
  sourceOffset: AutoMovieFilmTime;
  /** Film-global cue start. */
  start: AutoMovieFilmTime;
  /** Cue duration. */
  duration: AutoMovieFilmTime;
  /** Linear gain from silence through a bounded boost. */
  gain: number;
  /** Fade-in duration. */
  fadeIn: AutoMovieFilmTime;
  /** Fade-out duration. */
  fadeOut: AutoMovieFilmTime;
  /** Deterministic destination bus. */
  bus: "dialogue" | "music" | "effects" | "ambience";
}

/** One plain-text caption cue from which renderers may derive WebVTT. */
export interface IAutoMovieCaptionCue {
  /** Stable cue id. */
  id: string;
  /** Non-blank plain text. */
  text: string;
  /** Non-blank BCP-47-style language tag. */
  language: string;
  /** Optional speaker id. */
  speaker?: string;
  /** Film-global inclusive start. */
  start: AutoMovieFilmTime;
  /** Film-global exclusive end. */
  end: AutoMovieFilmTime;
}

/** One bounded reference to a registered deterministic world effect zone. */
export interface IAutoMovieEffectCue {
  /** Stable cue id. */
  id: string;
  /** Supported compiler-owned recipe family. */
  recipe: "world-zone";
  /** Existing world effect-zone id. */
  zone: string;
  /** Film-global cue start. */
  start: AutoMovieFilmTime;
  /** Cue duration. */
  duration: AutoMovieFilmTime;
  /** Bounded normalized strength. */
  intensity: number;
}

/** Explicit narrative-shot omission disposition. */
export interface IAutoMovieFilmOmission {
  /** Current shot contract intentionally absent from the edit. */
  shot: string;
  /** Auditable non-blank reason. */
  reason: string;
}

/** Coding-agent-authored finished-film edit before frame normalization. */
export interface IAutoMovieFilmEdit {
  /** Stable film id, equal to production id. */
  id: string;
  /** Explicit accounting for intentionally unused shot contracts. */
  omissions: IAutoMovieFilmOmission[];
  /** Narrow deterministic edit tracks. */
  tracks: {
    /** Ordered source-shot placements. */
    video: IAutoMovieVideoEdit[];
    /** Ordered audio cues. */
    audio: IAutoMovieAudioCue[];
    /** Ordered caption cues. */
    captions: IAutoMovieCaptionCue[];
    /** Ordered supported-effect cues. */
    effects: IAutoMovieEffectCue[];
  };
}

/** Frozen design and ownership facts available to the film source builder. */
export interface IAutoMovieFilmBuildContext {
  /** Current production design. */
  production: IAutoMovieProductionDesign;
  /** Current shot contracts keyed by id. */
  shots: Readonly<Record<string, IAutoMovieShotContract>>;
  /** Declared, present render-content paths. */
  assets: readonly string[];
  /** Current registered deterministic effect zones. */
  effectZones: Readonly<IAutoMovieWorldDesign["effectZones"]>;
}

/** Coding-agent-owned deterministic film module export. */
export interface IAutoMovieFilmSource {
  /** Build one finished-film edit from frozen compiler context. */
  build(context: IAutoMovieFilmBuildContext): IAutoMovieFilmEdit;
}

/** Compiler-owned envelope preserving the exact validated authored edit. */
export interface IAutoMovieCompiledFilmEdit {
  /** Generated edit format. */
  version: 1;
  /** Compiler protocol that validated the edit. */
  compiler: string;
  /** Exact aggregate compile input. */
  inputFingerprint: AutoMovieContentDigest;
  /** Film source provenance. */
  source: {
    /** Project-relative module path. */
    path: string;
    /** Named build export. */
    export: string;
    /** Digest of normalized TypeScript source. */
    digest: AutoMovieContentDigest;
  };
  /** Strict authored edit returned by the deterministic sandbox. */
  edit: IAutoMovieFilmEdit;
}

/** One frame-normalized video segment in the canonical film timeline. */
export interface IAutoMovieFilmTimelineSegment {
  /** Current compiled shot id. */
  shot: string;
  /** Inclusive source frame. */
  sourceInFrame: number;
  /** Exclusive source frame. */
  sourceOutFrame: number;
  /** Film-global inclusive start frame. */
  startFrame: number;
  /** Film-global exclusive end frame. */
  endFrame: number;
  /** Available incoming handle frames. */
  headHandleFrames: number;
  /** Available outgoing handle frames. */
  tailHandleFrames: number;
  /** Normalized incoming transition. */
  transitionIn:
    | { kind: "cut" }
    | { kind: "dissolve" | "fade"; durationFrames: number };
  /** Normalized outgoing transition. */
  transitionOut:
    | { kind: "cut" }
    | { kind: "dissolve" | "fade"; durationFrames: number };
}

/** Canonical global timeline consumed by review, oracle and render layers. */
export interface IAutoMovieFilmTimeline {
  /** Generated timeline format. */
  version: 1;
  /** Compiler protocol that derived the timeline. */
  compiler: string;
  /** Exact aggregate compile input. */
  inputFingerprint: AutoMovieContentDigest;
  /** Digest of normalized `src/film.ts` bytes. */
  sourceDigest: AutoMovieContentDigest;
  /** Stable finished-film id. */
  id: string;
  /** Production frame rate. */
  fps: number;
  /** Exact target and derived timeline duration. */
  totalFrames: number;
  /** Ordered global-to-shot mapping. */
  segments: IAutoMovieFilmTimelineSegment[];
  /** Explicitly omitted current narrative shots. */
  omissions: IAutoMovieFilmOmission[];
  /** Frame-normalized non-video tracks. */
  tracks: {
    /** Ordered audio placements. */
    audio: Array<{
      id: string;
      asset: string;
      sourceDurationFrames: number;
      sourceOffsetFrame: number;
      startFrame: number;
      durationFrames: number;
      gain: number;
      fadeInFrames: number;
      fadeOutFrames: number;
      bus: IAutoMovieAudioCue["bus"];
    }>;
    /** Ordered caption placements. */
    captions: Array<{
      id: string;
      text: string;
      language: string;
      speaker?: string;
      startFrame: number;
      endFrame: number;
    }>;
    /** Ordered effect placements. */
    effects: Array<{
      id: string;
      recipe: IAutoMovieEffectCue["recipe"];
      zone: string;
      startFrame: number;
      durationFrames: number;
      intensity: number;
    }>;
  };
}

/** Frozen input available to a coding-agent-owned shot source builder. */
export interface IAutoMovieShotBuildContext {
  /** Current shot contract. */
  contract: IAutoMovieShotContract;
  /** Current model recipes keyed by id. */
  models: Readonly<Record<string, IAutoMovieModelRecipe>>;
  /** Current world design. */
  world: IAutoMovieWorldDesign;
  /** Current formations keyed by id. */
  formations: Readonly<Record<string, IAutoMovieFormationDesign>>;
  /** Compiler-generated primitive runtime models keyed by recipe id. */
  runtimeModels: Readonly<Record<string, IAutoMovieModel>>;
  /** Compiler-derived formation slots keyed by formation id. */
  formationSlots: Readonly<Record<string, readonly IAutoMovieFormationSlot[]>>;
  /** Deterministic geometry helpers. */
  engine: IAutoMovieSourceOracle;
}

/** One deterministic formation member materialized from compact design. */
export interface IAutoMovieFormationSlot {
  /** Zero-based deterministic slot index. */
  slot: number;
  /** Compiler-owned scene-node id. */
  node: string;
  /** Named hero actor at this slot, or null. */
  actor: string | null;
  /** Runtime model recipe id. */
  modelRecipe: string;
  /** Compiler-derived world position in meters. */
  position: IAutoMovieVector3;
  /** Compiler-derived world-space heading in degrees. */
  facingDeg: number;
}

/** Coding-agent output before compiler-owned models and formations are added. */
export interface IAutoMovieShotSourceOutput {
  /** Event sample times selected inside authoritative event windows. */
  eventSamples: Array<{
    /** Exact event-contract id. */
    id: string;
    /** Shot-local time at which the compiler evaluates its predicates. */
    time: number;
  }>;
  /** Scene authored around compiler-owned runtime model ids. */
  scene: IAutoMovieScene;
  /** Sparse deterministic motions referenced by the shot. */
  motions: IAutoMovieMotion[];
  /** Compiled shot choreography. */
  shot: IAutoMovieShot;
}

/** Fully compiler-owned shot artifact consumed by render and oracle services. */
export interface IAutoMovieCompiledShotSource extends IAutoMovieShotSourceOutput {
  /** Models required by this shot. */
  models: IAutoMovieModel[];
}

/** One scalar predicate and the value measured by the compiler. */
export interface IAutoMovieCompiledPredicateResult {
  /** Exact authoritative predicate. */
  predicate: IAutoMovieShotPredicate;
  /** Actual sampled value, or null when the operand could not be resolved. */
  actual: number | null;
  /** Whether the authoritative comparison passed. */
  passed: boolean;
}

/** Compiler-derived realization of one shot contract. */
export interface IAutoMovieCompiledContractRealization {
  /** Realization format. */
  version: 1;
  /** Exact compiled shot id. */
  shot: string;
  /** Opening-state outcomes sampled at time zero. */
  opening: Array<{
    /** Exact state id. */
    id: string;
    /** Compiler-owned predicate results. */
    predicates: IAutoMovieCompiledPredicateResult[];
    /** Whether every predicate passed. */
    passed: boolean;
  }>;
  /** Closing-state outcomes sampled at the shot duration. */
  closing: Array<{
    /** Exact state id. */
    id: string;
    /** Compiler-owned predicate results. */
    predicates: IAutoMovieCompiledPredicateResult[];
    /** Whether every predicate passed. */
    passed: boolean;
  }>;
  /** Semantic event outcomes sampled inside their declared windows. */
  events: Array<{
    /** Exact event id. */
    id: string;
    /** Compiler-checked event sample time. */
    time: number;
    /** Compiler-owned predicate results. */
    predicates: IAutoMovieCompiledPredicateResult[];
    /** Whether timing and every predicate passed. */
    passed: boolean;
  }>;
  /** Camera root-projection checks at authoritative review times. */
  camera: Array<{
    /** Shot-local sample time. */
    time: number;
    /** Number of required subjects. */
    requiredSubjects: number;
    /** Number resolved in current compiled output. */
    resolvedSubjects: number;
    /** Number whose root point is inside depth and frame bounds. */
    readableSubjects: number;
    /** Whether every required root point is readable. */
    passed: boolean;
  }>;
  /** Compiler-materialized formation summaries. */
  formations: Array<{
    /** Exact formation id. */
    id: string;
    /** Exact materialized slot count. */
    count: number;
    /** World-space minimum bound. */
    min: IAutoMovieVector3;
    /** World-space maximum bound. */
    max: IAutoMovieVector3;
    /** Whether count, slots, hero ids and placement passed. */
    passed: boolean;
  }>;
}

/** Coding-agent-owned module export compiled in a deterministic sandbox. */
export interface IAutoMovieShotSource {
  /** Build derived shot data from the frozen design context. */
  build(context: IAutoMovieShotBuildContext): IAutoMovieShotSourceOutput;
}

/** Compact inventory returned by project inspection. */
export interface IAutoMovieProductionDesignInventory {
  /** Whether the singleton production design exists. */
  production: boolean;
  /** Model recipe ids. */
  models: string[];
  /** Whether the singleton world design exists. */
  world: boolean;
  /** Formation ids. */
  formations: string[];
  /** Shot contract ids. */
  shots: string[];
  /** Acceptance scenario ids. */
  acceptance: string[];
}

/** One action that moves the production toward a clean compile. */
export interface IAutoMovieProductionNextAction {
  /** Owning surface. */
  owner: "design" | "source" | "compile" | "review" | "render";
  /** Exact MCP method or coding-agent command to run. */
  action: string;
  /** Exact target or artifact to correct. */
  target: string;
  /** Why this action is next. */
  reason: string;
}

/** Consequences computed before one design mutation is committed. */
export interface IAutoMovieDesignMutationConsequences {
  /** Review targets that become stale. */
  staleReviews: IAutoMovieReviewTarget[];
  /** Render bundle ids that become stale. */
  staleRenders: string[];
  /** Generated paths invalidated by the mutation. */
  removedGenerated: string[];
}

/** Result shared by the one-artifact design setters and eraser. */
export interface IAutoMovieDesignMutationOutput {
  /** Whether the complete mutation was atomically committed. */
  accepted: boolean;
  /** Current monotonic project revision. */
  revision: number;
  /** Exact addressed target. */
  target: IAutoMovieDesignTarget;
  /** Current target digest, or null when refused or erased. */
  fingerprint: AutoMovieContentDigest | null;
  /**
   * Downstream review, render and generated artifacts made stale or removed by
   * the accepted mutation, or predicted for a refused mutation.
   */
  consequences: IAutoMovieDesignMutationConsequences;
  /**
   * Validation, reference and downstream diagnostics. A refused mutation never
   * changes tracked state; accepted warnings must be corrected before compile.
   */
  diagnostics: IAutoMovieDiagnostic[];
}

/** One materialized compiler file and its write status. */
export interface IAutoMovieMaterializedFile extends IAutoMovieGeneratedFile {
  /** Whether bytes were first created, updated, or already current. */
  status: "created" | "updated" | "unchanged";
}

/** A compile request with progressively stricter gates. */
export interface IAutoMovieCompileProjectInput {
  /**
   * Highest atomic gate to enforce. `design` validates the tracked graph only;
   * `source` additionally compiles sandboxed TypeScript and materializes owned
   * generated artifacts; `review` additionally requires every current review
   * target complete; `final` additionally verifies required renderer-owned
   * deliverables, byte receipts and parsed media facts.
   */
  scope: "design" | "source" | "review" | "final";
}

/** Result of an atomic production compile. */
export interface IAutoMovieCompileProjectOutput {
  /**
   * Whether every error-level check through the requested scope passed. False
   * means no partial generated publication occurred.
   */
  success: boolean;
  /** Current project revision. */
  revision: number;
  /** Compiler and input identity. */
  compiler: {
    /** Compiler package version. */
    version: string;
    /** Current design and source fingerprint. */
    inputFingerprint: AutoMovieContentDigest;
  };
  /** Ordered diagnostics. */
  diagnostics: IAutoMovieDiagnostic[];
  /** Current review queue. */
  reviews: IAutoMovieReviewQueue;
  /**
   * Compiler-owned files created, updated or already current. Empty for design
   * scope and for every refused atomic compile.
   */
  materialized: IAutoMovieMaterializedFile[];
}

/**
 * Review target forward declaration kept here to avoid requiring callers to
 * import a second module for mutation consequences.
 */
export type IAutoMovieReviewTarget =
  | {
      /** Typed design target. */
      kind: "design";
      /** Exact design artifact. */
      design: IAutoMovieDesignTarget;
    }
  | {
      /** Coding-agent-owned source file. */
      kind: "source";
      /** Project-relative source path. */
      path: string;
    }
  | {
      /** Compiled shot. */
      kind: "shot";
      /** Shot id. */
      id: string;
    }
  | {
      /** Whole film. */
      kind: "film";
      /** Film id. */
      id: string;
    };

/** One target and its derived review state. */
export interface IAutoMovieReviewQueueEntry {
  /** Review target. */
  target: IAutoMovieReviewTarget;
  /** Current queue state. */
  state: "missing" | "stale" | "incomplete" | "revise" | "complete";
  /** Current target fingerprint. */
  currentFingerprint: AutoMovieContentDigest | null;
  /** Stored review fingerprint when a record exists. */
  storedFingerprint: AutoMovieContentDigest | null;
}

/** Current review states in deterministic target order. */
export interface IAutoMovieReviewQueue {
  /** One entry per required review target. */
  entries: IAutoMovieReviewQueueEntry[];
}
