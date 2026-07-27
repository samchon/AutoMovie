import { IAutoMovieShot } from "../cinematics";
import { IAutoMovieModel } from "../model";
import { IAutoMovieMotion } from "../motion";
import { IAutoMovieScene } from "../scene";
import {
  AutoMovieContentDigest,
  IAutoMovieDesignTarget,
  IAutoMovieFormationDesign,
  IAutoMovieModelRecipe,
  IAutoMovieProductionDeliverable,
  IAutoMovieShotContract,
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
  /** Human-readable explanation ending with a concrete correction. */
  message: string;
}

/** The tracked manifest for a coding-agent production repository. */
export interface IAutoMovieProductionManifest {
  /** Production format version. */
  formatVersion: 2;
  /** Repository-local project identity, excluded from content fingerprints. */
  projectId: string;
  /** Coding-agent-owned source roots. */
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
  /** Deterministic geometry helpers. */
  engine: IAutoMovieSourceOracle;
}

/**
 * Derived runtime artifacts returned by one shot source. They are generated
 * output, never tracked source truth.
 */
export interface IAutoMovieCompiledShotSource {
  /**
   * Explicit contract-compliance witness checked against scene, shot, model
   * recipes and the authoritative shot contract before output is accepted.
   */
  contract: {
    /** Contract participants and the concrete scene nodes realizing them. */
    participants: Array<{
      /** Participant family. */
      kind: "actor" | "formation";
      /** Exact participant id from the shot contract. */
      id: string;
      /** Concrete scene nodes carrying this participant. */
      nodes: string[];
    }>;
    /** Exact opening-state ids the source implements. */
    openingStates: string[];
    /** Exact closing-state ids the source implements. */
    closingStates: string[];
    /** Exact required camera-subject ids kept readable by this source. */
    cameraSubjects: string[];
    /** Timed realization of every semantic contract event. */
    events: Array<{
      /** Exact contract event id. */
      id: string;
      /** Shot-local realized time. */
      time: number;
      /** Exact semantic subjects involved. */
      subjects: string[];
    }>;
    /** Recipe-to-runtime-model provenance for every placed scene model. */
    models: Array<{
      /** Authoritative model recipe id. */
      recipe: string;
      /** Compiled runtime model id. */
      model: string;
    }>;
  };
  /** Models required by this shot. */
  models: IAutoMovieModel[];
  /** Scene staged for the shot. */
  scene: IAutoMovieScene;
  /** Sparse deterministic motions referenced by the shot. */
  motions: IAutoMovieMotion[];
  /** Compiled shot. */
  shot: IAutoMovieShot;
}

/** Coding-agent-owned module export compiled in a deterministic sandbox. */
export interface IAutoMovieShotSource {
  /** Build derived shot data from the frozen design context. */
  build(context: IAutoMovieShotBuildContext): IAutoMovieCompiledShotSource;
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
  /** Method or command to run. */
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
  /** Whether the mutation was committed. */
  accepted: boolean;
  /** Current monotonic project revision. */
  revision: number;
  /** Exact addressed target. */
  target: IAutoMovieDesignTarget;
  /** Current target digest, or null when refused or erased. */
  fingerprint: AutoMovieContentDigest | null;
  /** Downstream invalidation. */
  consequences: IAutoMovieDesignMutationConsequences;
  /** Validation and reference diagnostics. */
  diagnostics: IAutoMovieDiagnostic[];
}

/** One materialized compiler file and its write status. */
export interface IAutoMovieMaterializedFile extends IAutoMovieGeneratedFile {
  /** Whether bytes were first created, updated, or already current. */
  status: "created" | "updated" | "unchanged";
}

/** A compile request with progressively stricter gates. */
export interface IAutoMovieCompileProjectInput {
  /** Highest gate to enforce. */
  scope: "design" | "source" | "review" | "final";
}

/** Result of an atomic production compile. */
export interface IAutoMovieCompileProjectOutput {
  /** Whether every error-level gate passed. */
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
  /** Files materialized only after every requested gate passed. */
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
