import { IAutoMovieShot } from "../cinematics";
import { IAutoMovieTransform, IAutoMovieVector3 } from "../geometry";
import { IAutoMovieModel } from "../model";
import { IAutoMovieMotion } from "../motion";
import { IAutoMovieScene } from "../scene";
import {
  AutoMovieContentDigest,
  AutoMovieFormationCapability,
  IAutoMovieDesignTarget,
  IAutoMovieEffectRecipe,
  IAutoMovieFormationDesign,
  IAutoMovieInstanceSetDesign,
  IAutoMovieModelRecipe,
  IAutoMovieProductionDeliverable,
  IAutoMovieProductionDesign,
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
  /**
   * Project-global asset provenance ledger.
   *
   * When declared, compiler asset references are restricted to the byte-exact
   * paths in this manifest.
   */
  assetManifest?: ".automovie/assets.json";
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

/** Compiler-owned registry of targets that evidence tools may resolve. */
export interface IAutoMovieProductionRegistryManifest {
  /** Registry format. */
  version: 2;
  /** Compiler protocol that produced this registry. */
  compiler: string;
  /** Exact production namespace. */
  productionId: string;
  /** Current aggregate compiler input fingerprint. */
  inputFingerprint: AutoMovieContentDigest;
  /** Built model/asset targets with their generated paths. */
  assets: Array<{
    /** Exact model recipe id. */
    id: string;
    /** Compiler-owned generated model path. */
    path: string;
  }>;
  /** Built shot targets with their generated paths. */
  shots: Array<{
    /** Exact shot registration id. */
    id: string;
    /** Compiler-owned generated shot path. */
    path: string;
  }>;
  /** Current compiler-owned film id, or null before film materialization. */
  film: string | null;
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
      /** Number of non-empty resident coded packets. */
      sampleCount: number;
      /** Encoder priming discarded by the presentation timeline. */
      primingSamples: number;
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
    }
  | {
      /** Parsed deterministic sound evidence JSON. */
      kind: "sound-evidence";
      /** Number of semantic events in the sound plan. */
      eventCount: number;
      /** Number of locally synthesized dialogue receipts. */
      dialogueCount: number;
      /** Number of samples outside [-1, 1] in the final PCM. */
      clippingSamples: number;
      /** Whether every semantic event passed the frame-alignment gate. */
      eventAlignmentPassed: boolean;
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
  /** Exact digest of the active production's tracked render manifest. */
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
  /** Regenerate one exact compiler-owned formation slot without expanding it. */
  formationSlot(formation: string, slot: number): IAutoMovieFormationSlot;
  /** Regenerate one exact compiler-owned general instance without expanding it. */
  instanceSlot(instanceSet: string, slot: number): IAutoMovieInstanceSlot;
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
  /** Compact compiler-derived formation runtimes keyed by formation id. */
  formationRuntime: Readonly<Record<string, IAutoMovieCompiledFormation>>;
  /** Compact compiler-derived general instance runtimes keyed by set id. */
  instanceSetRuntime: Readonly<Record<string, IAutoMovieCompiledInstanceSet>>;
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
  /** Stable normalized phase used by bounded instance motion. */
  motionPhase: number;
}

/** Axis-aligned world-space bounds of a compact formation range. */
export interface IAutoMovieFormationBounds {
  /** Minimum world-space corner. */
  min: IAutoMovieVector3;
  /** Maximum world-space corner. */
  max: IAutoMovieVector3;
}

/** One bounded slot range regenerated independently by viewer workers. */
export interface IAutoMovieFormationChunk {
  /** Zero-based stable chunk index. */
  index: number;
  /** Inclusive first slot. */
  start: number;
  /** Number of slots in this chunk. */
  count: number;
  /** Anonymous slots rendered through instancing after hero exclusion. */
  anonymousCount: number;
  /** Exact world-space range bounds. */
  bounds: IAutoMovieFormationBounds;
  /** Exact arithmetic centroid of the range. */
  centroid: IAutoMovieVector3;
}

/** One slot promoted out of anonymous batches into an explicit scene node. */
export interface IAutoMovieCompiledFormationHero {
  /** Exact promoted slot. */
  slot: number;
  /** Named explicit scene-node id. */
  actor: string;
  /** Compiler-owned base transform before source-authored performance. */
  transform: IAutoMovieTransform;
}

/** One camera-selected runtime representation for anonymous formation slots. */
export interface IAutoMovieCompiledFormationLod {
  /** Semantic near-to-far tier. */
  tier: "hero" | "near" | "far";
  /** Positive maximum distance, or null only for the final tier. */
  maxDistance: number | null;
  /** Design recipe id. */
  recipe: string;
  /** Exact current recipe digest, including geometry and palette parameters. */
  recipeDigest: AutoMovieContentDigest;
  /** Compiler-owned runtime model id. */
  model: string;
}

/** Compact generated formation runtime; it never stores every anonymous slot. */
export interface IAutoMovieCompiledFormation {
  /** Generated formation format. */
  version: 1;
  /** Stable formation design id. */
  id: string;
  /** Exact designed slot count. */
  count: number;
  /** Count remaining in instance batches after hero exclusion. */
  anonymousCount: number;
  /** Base design recipe. */
  modelRecipe: string;
  /** Exact compact layout algorithm and parameters. */
  layout: IAutoMovieFormationDesign["layout"];
  /** World-space origin. */
  anchor: IAutoMovieVector3;
  /** World-space base heading in degrees. */
  facingDeg: number;
  /** Full safe-integer design seed. */
  seed: number;
  /** Exact bounds of all slots. */
  bounds: IAutoMovieFormationBounds;
  /** Exact arithmetic centroid of all slots. */
  centroid: IAutoMovieVector3;
  /** Compiler-derived representative member radius used by LOD projection. */
  projectionRadius: number;
  /** Bounded independently regenerable slot ranges. */
  chunks: IAutoMovieFormationChunk[];
  /** Explicit hero promotions, ordered by slot. */
  heroes: IAutoMovieCompiledFormationHero[];
  /** Ordered automatic LOD representations. */
  lod: IAutoMovieCompiledFormationLod[];
  /** Deterministic per-slot phase generator contract. */
  phase: {
    /** Domain-separated safe-integer seed. */
    seed: number;
    /** Positive cycle length used by bounded formation animation. */
    periodSeconds: number;
  };
  /** Digest of every field above except this digest. */
  digest: AutoMovieContentDigest;
}

/** One exactly regenerated member of a non-formation instance set. */
export interface IAutoMovieInstanceSlot {
  /** Zero-based deterministic slot index. */
  slot: number;
  /** Compiler-owned stable instance id. */
  node: string;
  /** Runtime model recipe id. */
  modelRecipe: string;
  /** Compiler-derived world position in meters. */
  position: IAutoMovieVector3;
  /** Compiler-derived world-space heading in degrees. */
  facingDeg: number;
  /** Positive uniform scale. */
  scale: number;
  /** Selected exact sRGB palette value. */
  palette: string;
  /** Seed-derived numeric traits keyed by declared name. */
  traits: Record<string, number>;
}

/** One independently regenerable range of a general instance set. */
export interface IAutoMovieInstanceChunk {
  /** Zero-based stable chunk index. */
  index: number;
  /** Inclusive first slot. */
  start: number;
  /** Number of slots in this chunk. */
  count: number;
  /** Exact world-space range bounds. */
  bounds: IAutoMovieFormationBounds;
  /** Exact arithmetic centroid of the range. */
  centroid: IAutoMovieVector3;
}

/** Compact generated runtime for a non-formation instance set. */
export interface IAutoMovieCompiledInstanceSet {
  /** Generated instance-set format. */
  version: 1;
  /** Stable world-design id. */
  id: string;
  /** Exact designed slot count. */
  count: number;
  /** Base design recipe. */
  modelRecipe: string;
  /** Exact compact placement law. */
  layout: IAutoMovieInstanceSetDesign["layout"];
  /**
   * Resolved route geometry for `along-route`, or null for local layouts.
   *
   * The viewer and source oracle regenerate slots from this snapshot without
   * consulting mutable world design.
   */
  route: IAutoMovieWorldDesign["routes"][number] | null;
  /** World-space origin for local layouts. */
  anchor: IAutoMovieVector3;
  /** World-space base heading in degrees. */
  facingDeg: number;
  /** Full safe-integer design seed. */
  seed: number;
  /** Exact seed-derived visual and semantic variation law. */
  variation: IAutoMovieInstanceSetDesign["variation"];
  /** Exact bounds of all generated slots. */
  bounds: IAutoMovieFormationBounds;
  /** Exact arithmetic centroid of all generated slots. */
  centroid: IAutoMovieVector3;
  /** Compiler-derived representative radius used by viewer culling. */
  projectionRadius: number;
  /** Bounded independently regenerable slot ranges. */
  chunks: IAutoMovieInstanceChunk[];
  /** Ordered automatic LOD representations. */
  lod: IAutoMovieCompiledFormationLod[];
  /** Digest of every field above except this digest. */
  digest: AutoMovieContentDigest;
}

/** One compact formation-level transform state relative to its designed base. */
export interface IAutoMovieFormationMotionState {
  /** World-space translation added to the designed formation anchor. */
  translation: IAutoMovieVector3;
  /** Heading offset added around the designed anchor, in degrees. */
  facingOffsetDeg: number;
  /** Positive lateral and depth scale for bounded density deformation. */
  spacingScale: {
    /** Left-to-right spacing multiplier. */
    lateral: number;
    /** Front-to-back spacing multiplier. */
    depth: number;
  };
}

/**
 * One source-authored compact formation cue.
 *
 * Capability labels do not grant this motion. The source explicitly authors
 * each cue, while arbitrary per-slot curves remain outside the public shape.
 */
export interface IAutoMovieFormationMotion {
  /** Stable cue id, unique inside one shot. */
  id: string;
  /** Participating compiled formation id. */
  formation: string;
  /** Review-facing action expressed by this exact cue. */
  action: AutoMovieFormationCapability;
  /** Inclusive shot-local cue start. */
  start: number;
  /** Exclusive shot-local cue end. */
  end: number;
  /** State at cue start. */
  from: IAutoMovieFormationMotionState;
  /** State at cue end. */
  to: IAutoMovieFormationMotionState;
  /** Deterministic interpolation curve. */
  easing: "linear" | "easeIn" | "easeOut" | "easeInOut" | "step";
}

/** One source-authored shot-local effect activation. */
export interface IAutoMovieShotEffectCue {
  /** Stable cue id, unique inside one shot. */
  id: string;
  /** Existing world effect-zone id. */
  zone: string;
  /** Inclusive shot-local start in seconds. */
  start: number;
  /** Exclusive shot-local end in seconds. */
  end: number;
  /** Bounded intensity envelope. */
  intensity: {
    /** Intensity at cue start. */
    from: number;
    /** Intensity at cue end. */
    to: number;
  };
  /** Optional authoritative shot event that must realize inside this cue. */
  event?: string;
}

/** Compiler-owned deterministic effect runtime consumed by viewer and oracle. */
export interface IAutoMovieCompiledEffect {
  /** Generated effect format. */
  version: 1;
  /** Stable source cue id. */
  id: string;
  /** Existing world zone id. */
  zone: string;
  /** Supported primitive effect family. */
  kind: IAutoMovieEffectRecipe["kind"];
  /** Exact world-space emitter bounds. */
  bounds: IAutoMovieWorldDesign["effectZones"][number]["bounds"];
  /** Domain-separated deterministic stream seed. */
  seed: number;
  /** Exact current recipe. */
  recipe: IAutoMovieEffectRecipe;
  /** Inclusive shot-local cue start. */
  start: number;
  /** Exclusive shot-local cue end. */
  end: number;
  /** Bounded cue intensity envelope. */
  intensity: IAutoMovieShotEffectCue["intensity"];
  /** Bound authoritative event, when present. */
  event?: string;
  /** Production frame-clock simulation step. */
  fixedStepSeconds: number;
  /** Digest of every field above except this digest. */
  digest: AutoMovieContentDigest;
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
  /**
   * Optional compact formation-level cues. The compiler materializes an empty
   * list when omitted; source never emits arbitrary per-member curves.
   */
  formationMotions?: IAutoMovieFormationMotion[];
  /** Optional bounded shot-local deterministic effect cues. */
  effectCues?: IAutoMovieShotEffectCue[];
  /** Compiled shot choreography. */
  shot: IAutoMovieShot;
}

/** Fully compiler-owned shot artifact consumed by render and oracle services. */
export interface IAutoMovieCompiledShotSource extends IAutoMovieShotSourceOutput {
  /** Models required by this shot. */
  models: IAutoMovieModel[];
  /** Compact formation runtimes required by this shot. */
  formations: IAutoMovieCompiledFormation[];
  /** Compact general instance runtimes placed by the production world. */
  instanceSets: IAutoMovieCompiledInstanceSet[];
  /** Validated compact formation-level cues, empty when source omitted them. */
  formationMotions: IAutoMovieFormationMotion[];
  /** Compiler-owned deterministic effect runtimes. */
  effects: IAutoMovieCompiledEffect[];
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
  /**
   * Exact shot registration id.
   *
   * The compiler compares this value with the design contract selected by the
   * module path and named export, so source code cannot accidentally build a
   * different shot under a valid pointer.
   */
  id: string;
  /** Build derived shot data from the frozen design context. */
  build(context: IAutoMovieShotBuildContext): IAutoMovieShotSourceOutput;
}

/** Compact inventory returned by project inspection. */
export interface IAutoMovieProductionDesignInventory {
  /** Whether the active production design exists. */
  production: boolean;
  /** Model recipe ids. */
  models: string[];
  /** Whether the project-shared world design exists. */
  world: boolean;
  /** Formation ids. */
  formations: string[];
  /** Shot contract ids. */
  shots: string[];
  /** Acceptance scenario ids. */
  acceptance: string[];
}

/** One discovered renderer-owned evidence bundle. */
export interface IAutoMovieProductionRenderStatus {
  /** Project-relative bundle manifest. */
  path: string;
  /** Whether the bundle matches current target-local inputs. */
  current: boolean;
}

/** Compact project status for CLI and lint consumers. */
export interface IAutoMovieProductionInspection {
  /** Current project revision. */
  revision: number;
  /** Typed design inventory. */
  design: IAutoMovieProductionDesignInventory;
  /** Coding-agent and compiler ownership status. */
  source: {
    /** Bound source modules that currently exist. */
    bound: string[];
    /** Bound source modules that are missing or unsafe. */
    missing: string[];
    /** Files under generated absent from its manifest. */
    unownedGenerated: string[];
  };
  /** Current structural and ownership diagnostics. */
  diagnostics: IAutoMovieDiagnostic[];
  /** Current review ledger projection. */
  reviews: IAutoMovieReviewQueue;
  /** Discovered render manifests. */
  renders: IAutoMovieProductionRenderStatus[];
  /** Ordered concrete corrections. */
  nextActions: IAutoMovieProductionNextAction[];
}

/** One action that moves the production toward a clean compile. */
export interface IAutoMovieProductionNextAction {
  /** Owning surface. */
  owner: "design" | "source" | "compile" | "review" | "render";
  /** Exact package API or coding-agent command to run. */
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
      /** Consumed compiled model asset. */
      kind: "asset";
      /** Model-recipe id. */
      id: string;
    }
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
      /** Authored treatment sequence. */
      kind: "sequence";
      /** Stable sequence id. */
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
