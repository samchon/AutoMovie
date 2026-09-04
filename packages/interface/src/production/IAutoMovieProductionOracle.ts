import {
  AutoMovieGuidePass,
  IAutoMovieDeliveryCrop,
  IAutoMovieRenderSpec,
} from "../cinematics";
import { IAutoMovieVector3 } from "../geometry";
import { IAutoMovieRenderObservation } from "../render/IAutoMovieRenderObservation";
import {
  IAutoMovieSemanticMaskEvidence,
  IAutoMovieSemanticMaskReceipt,
} from "../render/IAutoMovieSemanticMask";
import {
  AutoMovieFilmTime,
  IAutoMovieDiagnostic,
} from "./IAutoMovieProductionCompiler";
import { AutoMovieContentDigest } from "./IAutoMovieProductionDesign";

/**
 * A point, actor or named world anchor used by geometry queries.
 *
 * @evidence requirements/agent-authoring/knowledge-boundary.md#agent-contract-guidance Exposes `IAutoMovieGeometrySelector` as the portable data boundary for the agent contract guidance requirement.
 * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-knowledge-request-output Types `IAutoMovieGeometrySelector` for the spec authoring knowledge request output system contract.
 */
export type IAutoMovieGeometrySelector =
  | {
      /** Explicit world-space point. */
      kind: "point";
      /** Position in meters. */
      position: IAutoMovieVector3;
    }
  | {
      /** Named actor root or bone. */
      kind: "actor";
      /** Actor id. */
      actor: string;
      /** Optional bone id. */
      bone?: string;
    }
  | {
      /** Named world landmark. */
      kind: "landmark";
      /** Landmark id. */
      landmark: string;
    };

/**
 * One compact query over the current compiled production.
 *
 * @evidence requirements/agent-authoring/knowledge-boundary.md#agent-contract-guidance Exposes `AutoMovieGeometryQuery` as the portable data boundary for the agent contract guidance requirement.
 * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-knowledge-request-output Types `AutoMovieGeometryQuery` for the spec authoring knowledge request output system contract.
 */
export type AutoMovieGeometryQuery =
  | {
      /** Distance query. */
      query: "distance";
      /** First selector. */
      from: IAutoMovieGeometrySelector;
      /** Second selector. */
      to: IAutoMovieGeometrySelector;
      /** Optional shot that disambiguates recurring actors. */
      shot?: string;
      /** Optional shot-local sample time, zero by default. */
      time?: number;
    }
  | {
      /** Reachability query. */
      query: "reach";
      /** Actor id. */
      actor: string;
      /** Optional shot that disambiguates actors appearing more than once. */
      shot?: string;
      /** Target selector. */
      target: IAutoMovieGeometrySelector;
      /** Optional shot time in seconds. */
      time?: number;
    }
  | {
      /** Resolved pose query. */
      query: "pose";
      /** Actor id. */
      actor: string;
      /** Optional shot id. */
      shot?: string;
      /** Time in seconds. */
      time: number;
    }
  | {
      /** World-ground query. */
      query: "ground";
      /** Horizontal world point. */
      point: {
        /** World X in meters. */
        x: number;
        /** World Z in meters. */
        z: number;
      };
    }
  | {
      /** Compact formation bounds, budget, representative and LOD query. */
      query: "formation";
      /** Formation id. */
      formation: string;
      /** Optional participating shot used for camera-distance LOD summary. */
      shot?: string;
      /** Optional shot-local sample time, zero by default. */
      time?: number;
    }
  | {
      /** Bounded deterministic effect activity and visibility-risk query. */
      query: "effect";
      /** Existing world effect-zone id. */
      zone: string;
      /** Participating compiled shot id. */
      shot: string;
      /** Shot-local sample time. */
      time: number;
      /** Optional compiled scene-node ids tested against the zone. */
      subjects?: string[];
    }
  | {
      /** Resolve one film-global frame through the canonical edit timeline. */
      query: "film-time";
      /** Exact global frame or frame-grid second. */
      at: AutoMovieFilmTime;
    }
  | {
      /**
       * Camera root-point projection query; pixel occlusion remains a
       * frame-review concern.
       */
      query: "camera";
      /** Shot id. */
      shot: string;
      /** Time in seconds. */
      time: number;
      /** Unique compiled scene-node ids whose animated roots are projected. */
      subjects: string[];
    };

/**
 * Tool-compatible wrapper around the exact geometry-query union.
 *
 * The portable contract requires one non-union object parameter; the nested request
 * preserves discriminator validation without widening mutually exclusive fields
 * into optional properties.
 *
 * @evidence requirements/agent-authoring/knowledge-boundary.md#agent-contract-guidance Exposes `IAutoMovieQueryGeometryInput` as the portable data boundary for the agent contract guidance requirement.
 * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-knowledge-request-output Types `IAutoMovieQueryGeometryInput` for the spec authoring knowledge request output system contract.
 */
export interface IAutoMovieQueryGeometryInput {
  /**
   * Exact compact query over the current source compile. Selectors refer to
   * compiled node, formation or world identities, not caller-supplied
   * geometry.
   *
   * @evidence requirements/agent-authoring/knowledge-boundary.md#agent-contract-guidance Exposes `request` as the portable data boundary for the agent contract guidance requirement.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-knowledge-request-output Types `request` for the spec authoring knowledge request output system contract.
   */
  request: AutoMovieGeometryQuery;
}

/**
 * Geometry result intentionally remains compact and query-specific.
 *
 * @evidence requirements/agent-authoring/partial-work.md#agent-partial-result-control Exposes `IAutoMovieGeometryResult` as the portable data boundary for the agent partial result control requirement.
 * @evidence specifications/authoring-and-authority/partial-targets-and-atomic-results.md#spec-authoring-partial-result-checkpoint Types `IAutoMovieGeometryResult` for the spec authoring partial result checkpoint system contract.
 */
export type IAutoMovieGeometryResult =
  | {
      /** Distance in meters. */
      kind: "distance";
      /** Measured value. */
      meters: number;
    }
  | {
      /** Ground sample. */
      kind: "ground";
      /** Surface height in meters. */
      height: number;
      /** Matching surface id, or null. */
      surface: string | null;
      /** Whether the surface is walkable. */
      walkable: boolean;
    }
  | {
      /** Generic current-compile measurement. */
      kind: "measurement";
      /** Machine-readable metric names and scalar or text values. */
      values: Record<string, number | string | boolean>;
    };

/**
 * Result of one geometry query.
 *
 * @evidence requirements/agent-authoring/partial-work.md#agent-partial-result-control Exposes `IAutoMovieQueryGeometryOutput` as the portable data boundary for the agent partial result control requirement.
 * @evidence specifications/authoring-and-authority/partial-targets-and-atomic-results.md#spec-authoring-partial-result-checkpoint Types `IAutoMovieQueryGeometryOutput` for the spec authoring partial result checkpoint system contract.
 */
export interface IAutoMovieQueryGeometryOutput {
  /**
   * Echoed query family.
   *
   * @evidence requirements/agent-authoring/partial-work.md#agent-partial-result-control Exposes `query` as the portable data boundary for the agent partial result control requirement.
   * @evidence specifications/authoring-and-authority/partial-targets-and-atomic-results.md#spec-authoring-partial-result-checkpoint Types `query` for the spec authoring partial result checkpoint system contract.
   */
  query: AutoMovieGeometryQuery["query"];
  /**
   * Current compile fingerprint or null before a successful compile.
   *
   * @evidence requirements/agent-authoring/partial-work.md#agent-partial-result-control Exposes `compileFingerprint` as the portable data boundary for the agent partial result control requirement.
   * @evidence specifications/authoring-and-authority/partial-targets-and-atomic-results.md#spec-authoring-partial-result-checkpoint Types `compileFingerprint` for the spec authoring partial result checkpoint system contract.
   */
  compileFingerprint: AutoMovieContentDigest | null;
  /**
   * Engine-derived result, or null when compilation is missing or stale, a
   * selector is ambiguous, or the requested fact cannot be measured.
   *
   * @evidence requirements/agent-authoring/partial-work.md#agent-partial-result-control Exposes `result` as the portable data boundary for the agent partial result control requirement.
   * @evidence specifications/authoring-and-authority/partial-targets-and-atomic-results.md#spec-authoring-partial-result-checkpoint Types `result` for the spec authoring partial result checkpoint system contract.
   */
  result: IAutoMovieGeometryResult | null;
  /**
   * Exact refusal diagnostics and the correction required before retrying.
   *
   * @evidence requirements/agent-authoring/partial-work.md#agent-partial-result-control Exposes `diagnostics` as the portable data boundary for the agent partial result control requirement.
   * @evidence specifications/authoring-and-authority/partial-targets-and-atomic-results.md#spec-authoring-partial-result-checkpoint Types `diagnostics` for the spec authoring partial result checkpoint system contract.
   */
  diagnostics: IAutoMovieDiagnostic[];
}

/**
 * Request one actual current preview frame.
 *
 * @evidence requirements/agent-authoring/knowledge-boundary.md#agent-contract-guidance Exposes `IAutoMoviePreviewFrameInput` as the portable data boundary for the agent contract guidance requirement.
 * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-knowledge-request-output Types `IAutoMoviePreviewFrameInput` for the spec authoring knowledge request output system contract.
 */
export interface IAutoMoviePreviewFrameInput {
  /**
   * Exact shot or isolated compiled-model target.
   *
   * Whole-film and sequence review compose current shot frames. Asset review
   * supplies the server-required turntable view so the capture receipt proves
   * which angle and pose was inspected.
   *
   * @evidence requirements/agent-authoring/knowledge-boundary.md#agent-contract-guidance Exposes `target` as the portable data boundary for the agent contract guidance requirement.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-knowledge-request-output Types `target` for the spec authoring knowledge request output system contract.
   */
  target:
    | {
        /** Shot target. */
        kind: "shot";
        /** Shot id. */
        id: string;
      }
    | {
        /** Isolated compiled model turntable target. */
        kind: "asset";
        /** Model-recipe id. */
        id: string;
        /** Finite turntable azimuth in degrees. */
        angleDeg: number;
        /** Finite camera elevation in degrees. */
        elevationDeg: number;
        /** Rest or required extreme-range rig pose. */
        pose: "rest" | "rom-extremes";
        /**
         * Compiled part id to frame instead of the whole model, when given.
         *
         * The turntable then fits that one part, which is how a mullion, a
         * hinge, or a hand is looked at without exporting a separate model for
         * it. A framed part is a diagnostic view: the asset review's required
         * turntable is of the whole model and no part view discharges it.
         */
        part?: string;
      };
  /**
   * Finite non-negative shot-local time no later than shot duration. The oracle
   * snaps it to the nearest current production frame. Asset targets derive the
   * canonical turntable time from `angleDeg`, so this field is ignored there.
   *
   * @evidence requirements/agent-authoring/knowledge-boundary.md#agent-contract-guidance Exposes `time` as the portable data boundary for the agent contract guidance requirement.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-knowledge-request-output Types `time` for the spec authoring knowledge request output system contract.
   */
  time: number;
  /**
   * Requested render pass, beauty by default.
   *
   * @evidence requirements/agent-authoring/knowledge-boundary.md#agent-contract-guidance Exposes `pass` as the portable data boundary for the agent contract guidance requirement.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-knowledge-request-output Types `pass` for the spec authoring knowledge request output system contract.
   */
  pass?: AutoMovieGuidePass;
  /**
   * Optional positive integer width, no larger than production width. Width
   * times height may not exceed 16,777,216 pixels.
   *
   * @evidence requirements/agent-authoring/knowledge-boundary.md#agent-contract-guidance Exposes `width` as the portable data boundary for the agent contract guidance requirement.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-knowledge-request-output Types `width` for the spec authoring knowledge request output system contract.
   */
  width?: number;
  /**
   * Optional positive integer height, no larger than production height. Width
   * times height may not exceed 16,777,216 pixels.
   *
   * @evidence requirements/agent-authoring/knowledge-boundary.md#agent-contract-guidance Exposes `height` as the portable data boundary for the agent contract guidance requirement.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-knowledge-request-output Types `height` for the spec authoring knowledge request output system contract.
   */
  height?: number;
}

/**
 * An actual PNG frame bound to a compile and render bundle.
 *
 * @evidence requirements/agent-authoring/knowledge-boundary.md#agent-contract-guidance Exposes `IAutoMoviePreviewFrameOutput` as the portable data boundary for the agent contract guidance requirement.
 * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-knowledge-request-output Types `IAutoMoviePreviewFrameOutput` for the spec authoring knowledge request output system contract.
 */
export interface IAutoMoviePreviewFrameOutput {
  /**
   * True only after current decodable, dimension-matching PNG bytes with
   * visible pixel variance are verified and committed to a render bundle.
   *
   * @evidence requirements/agent-authoring/knowledge-boundary.md#agent-contract-guidance Exposes `captured` as the portable data boundary for the agent contract guidance requirement.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-knowledge-request-output Types `captured` for the spec authoring knowledge request output system contract.
   */
  captured: boolean;
  /**
   * Current compile fingerprint.
   *
   * @evidence requirements/agent-authoring/knowledge-boundary.md#agent-contract-guidance Exposes `compileFingerprint` as the portable data boundary for the agent contract guidance requirement.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-knowledge-request-output Types `compileFingerprint` for the spec authoring knowledge request output system contract.
   */
  compileFingerprint: AutoMovieContentDigest;
  /**
   * Project-relative content-addressed render bundle, or null on any refusal.
   *
   * @evidence requirements/agent-authoring/knowledge-boundary.md#agent-contract-guidance Exposes `renderBundle` as the portable data boundary for the agent contract guidance requirement.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-knowledge-request-output Types `renderBundle` for the spec authoring knowledge request output system contract.
   */
  renderBundle: string | null;
  /**
   * Verified frame metadata or null on refusal.
   *
   * @evidence requirements/agent-authoring/knowledge-boundary.md#agent-contract-guidance Exposes `frame` as the portable data boundary for the agent contract guidance requirement.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-knowledge-request-output Types `frame` for the spec authoring knowledge request output system contract.
   */
  frame: {
    /** Zero-based frame index. */
    index: number;
    /** Frame time in seconds. */
    time: number;
    /** Render pass. */
    pass: AutoMovieGuidePass;
    /** Project-relative PNG path. */
    path: string;
    /** Raster media type. */
    mime: "image/png";
    /** Raw PNG digest. */
    digest: AutoMovieContentDigest;
    /** Pixel width. */
    width: number;
    /** Pixel height. */
    height: number;
  } | null;
  /**
   * Exact capture refusal diagnostics and correction, empty on success.
   *
   * @evidence requirements/agent-authoring/knowledge-boundary.md#agent-contract-guidance Exposes `diagnostics` as the portable data boundary for the agent contract guidance requirement.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-knowledge-request-output Types `diagnostics` for the spec authoring knowledge request output system contract.
   */
  diagnostics: IAutoMovieDiagnostic[];
}

/**
 * Versioned, comparable identity of the host capture runtime.
 *
 * @evidence requirements/rendering/passes-channels-and-products.md#rendering-identity-mask-channels Exposes `IAutoMovieCaptureRuntimeIdentity` as the portable data boundary for the rendering identity mask channels requirement.
 * @evidence specifications/editorial-render-and-delivery/render-products-visibility-and-color.md#spec-render-pass-products Types `IAutoMovieCaptureRuntimeIdentity` for the spec render pass products system contract.
 */
export interface IAutoMovieCaptureRuntimeIdentity {
  /**
   * Capture identity schema and semantics.
   *
   * @evidence requirements/rendering/passes-channels-and-products.md#rendering-identity-mask-channels Exposes `protocolVersion` as the portable data boundary for the rendering identity mask channels requirement.
   * @evidence specifications/editorial-render-and-delivery/render-products-visibility-and-color.md#spec-render-pass-products Types `protocolVersion` for the spec render pass products system contract.
   */
  protocolVersion: "automovie.capture-runtime.v2";
  /**
   * Exact Playwright package that selected and launched the browser.
   *
   * @evidence requirements/rendering/passes-channels-and-products.md#rendering-identity-mask-channels Exposes `playwright` as the portable data boundary for the rendering identity mask channels requirement.
   * @evidence specifications/editorial-render-and-delivery/render-products-visibility-and-color.md#spec-render-pass-products Types `playwright` for the spec render pass products system contract.
   */
  playwright: {
    /** Package name. */
    package: "playwright";
    /** Installed package version. */
    version: string;
  };
  /**
   * Content identity of every installed package and browser support byte that
   * can participate in the captured frame.
   *
   * @evidence requirements/acceptance/evidence-and-freshness.md#acceptance-current-historical-evidence Makes an installed renderer change a new evidence generation rather than letting historical pixels remain current.
   * @evidence specifications/review-and-acceptance/evidence-freshness-and-completeness.md#acceptance-system-current-historical-evidence Types the installed runtime closure consumed by capture freshness comparisons.
   * @evidencePart specifications/review-and-acceptance/evidence-freshness-and-completeness.md#acceptance-system-current-historical-evidence::current-historical-closure
   */
  runtimeClosure: {
    /** Capture-closure schema and semantics. */
    protocolVersion: "automovie.capture-runtime-closure.v1";
    /** Canonical digest of the complete package and browser-support identity. */
    contentDigest: AutoMovieContentDigest;
    /** Complete dependency-closed installed package generations. */
    packages: Array<{
      /** Installed package name. */
      package: string;
      /** Installed package version. */
      version: string;
      /** Digest of every captured package file path and byte digest. */
      contentDigest: AutoMovieContentDigest;
      /** Number of captured package files. */
      files: number;
      /** Total captured package bytes. */
      bytes: number;
    }>;
    /** Browser support closure, or the explicit unsealed system-channel boundary. */
    browserSupport:
      | {
          /** A physical support tree was sealed. */
          status: "content-sealed";
          /** How the browser executable was selected. */
          source: "package-owned" | "configured-executable";
          /** Digest of every support-file path and byte digest. */
          contentDigest: AutoMovieContentDigest;
          /** Number of captured support files. */
          files: number;
          /** Total captured support bytes. */
          bytes: number;
        }
      | {
          /** A system channel remains compatible but is not content sealed. */
          status: "system-channel-unsealed";
          /** Explicit compatibility boundary. */
          source: "system-channel";
        };
  };
  /**
   * Exact browser executable provenance.
   *
   * @evidence requirements/rendering/passes-channels-and-products.md#rendering-identity-mask-channels Exposes `browser` as the portable data boundary for the rendering identity mask channels requirement.
   * @evidence specifications/editorial-render-and-delivery/render-products-visibility-and-color.md#spec-render-pass-products Types `browser` for the spec render pass products system contract.
   */
  browser: {
    /** Browser product family. */
    product: "chromium" | "chrome" | "msedge";
    /** Runtime-reported browser version. */
    version: string;
    /** Playwright browser revision, unavailable for a system channel. */
    revision: string | null;
    /** How the executable was selected. */
    source: "package-owned" | "system-channel" | "configured-executable";
    /** SHA-256 of the executable, unavailable only for a system channel. */
    executableDigest: AutoMovieContentDigest | null;
  };
  /**
   * Host operating-system boundary.
   *
   * @evidence requirements/rendering/passes-channels-and-products.md#rendering-identity-mask-channels Exposes `platform` as the portable data boundary for the rendering identity mask channels requirement.
   * @evidence specifications/editorial-render-and-delivery/render-products-visibility-and-color.md#spec-render-pass-products Types `platform` for the spec render pass products system contract.
   */
  platform: {
    /** Node platform name. */
    os: string;
    /** Node architecture name. */
    arch: string;
  };
  /**
   * Browser launch and raster mode.
   *
   * @evidence requirements/rendering/passes-channels-and-products.md#rendering-identity-mask-channels Exposes `mode` as the portable data boundary for the rendering identity mask channels requirement.
   * @evidence specifications/editorial-render-and-delivery/render-products-visibility-and-color.md#spec-render-pass-products Types `mode` for the spec render pass products system contract.
   */
  mode: {
    /** Explicit headless implementation. */
    headless: "chromium";
    /** Exact viewport scale. */
    deviceScaleFactor: number;
  };
  /**
   * Requested and actual WebGL identity.
   *
   * @evidence requirements/rendering/passes-channels-and-products.md#rendering-identity-mask-channels Exposes `graphics` as the portable data boundary for the rendering identity mask channels requirement.
   * @evidence specifications/editorial-render-and-delivery/render-products-visibility-and-color.md#spec-render-pass-products Types `graphics` for the spec render pass products system contract.
   */
  graphics: {
    /** Requested ANGLE/backend selection. */
    requestedBackend: string;
    /** Actual canvas graphics API. */
    api: "webgl" | "webgl2";
    /** Runtime-reported WebGL vendor. */
    vendor: string;
    /** Runtime-reported WebGL renderer. */
    renderer: string;
  };
}

/**
 * Content-addressed manifest for preview and production frames.
 *
 * @evidence requirements/acceptance/evidence-and-freshness.md#acceptance-current-historical-evidence Separates current evidence from historical: a bundle is addressed by the target fingerprint it was drawn at, so a previous version's frames remain readable for comparison while never standing in for the current verdict.
 * @evidence specifications/review-and-acceptance/evidence-freshness-and-completeness.md#acceptance-system-current-historical-evidence Types the fingerprint boundary that decides which committed frames are current for a target.
 * @evidence requirements/agent-authoring/knowledge-boundary.md#agent-content-supply-refusal Exposes `IAutoMovieRenderBundleManifest` as the portable data boundary for the agent content supply refusal requirement.
 * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-content-side-effect-invariant Types `IAutoMovieRenderBundleManifest` for the spec authoring tool content side effect invariant system contract.
 */
export interface IAutoMovieRenderBundleManifest {
  /**
   * Bundle manifest format.
   *
   * @evidence requirements/agent-authoring/knowledge-boundary.md#agent-content-supply-refusal Exposes `version` as the portable data boundary for the agent content supply refusal requirement.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-content-side-effect-invariant Types `version` for the spec authoring tool content side effect invariant system contract.
   */
  version: 6;
  /**
   * Asset, shot, sequence, or film render target.
   *
   * @evidence requirements/agent-authoring/knowledge-boundary.md#agent-content-supply-refusal Exposes `target` as the portable data boundary for the agent content supply refusal requirement.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-content-side-effect-invariant Types `target` for the spec authoring tool content side effect invariant system contract.
   */
  target:
    | {
        /** Isolated compiled model turntable. */
        kind: "asset";
        /** Model-recipe id. */
        id: string;
        /** Finite turntable azimuth in degrees. */
        angleDeg: number;
        /** Finite camera elevation in degrees. */
        elevationDeg: number;
        /** Rest or required extreme-range rig pose. */
        pose: "rest" | "rom-extremes";
        /**
         * Compiled part the turntable framed, when it framed one.
         *
         * Absent means the whole model was framed, which is the only form the
         * asset review's required views accept.
         */
        part?: string;
      }
    | {
        /** Shot target. */
        kind: "shot";
        /** Shot id. */
        id: string;
      }
    | {
        /** Authored treatment sequence. */
        kind: "sequence";
        /** Stable treatment-sequence id. */
        id: string;
      }
    | {
        /** Film target. */
        kind: "film";
        /** Film id. */
        id: string;
      };
  /**
   * Compile fingerprint whose bytes were rendered.
   *
   * @evidence requirements/agent-authoring/knowledge-boundary.md#agent-content-supply-refusal Exposes `compileFingerprint` as the portable data boundary for the agent content supply refusal requirement.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-content-side-effect-invariant Types `compileFingerprint` for the spec authoring tool content side effect invariant system contract.
   */
  compileFingerprint: AutoMovieContentDigest;
  /**
   * Final-byte dialogue and viseme identity installed before these pixels were
   * drawn, or null when this target consumes no dialogue runtime.
   *
   * @evidence requirements/agent-authoring/knowledge-boundary.md#agent-content-supply-refusal Exposes `dialogueRuntimeIdentity` as the portable data boundary for the agent content supply refusal requirement.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-content-side-effect-invariant Types `dialogueRuntimeIdentity` for the spec authoring tool content side effect invariant system contract.
   */
  dialogueRuntimeIdentity: AutoMovieContentDigest | null;
  /**
   * Canonical JSON encoding of one validated capture runtime identity.
   *
   * @evidence requirements/agent-authoring/knowledge-boundary.md#agent-content-supply-refusal Exposes `rendererIdentity` as the portable data boundary for the agent content supply refusal requirement.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-content-side-effect-invariant Types `rendererIdentity` for the spec authoring tool content side effect invariant system contract.
   */
  rendererIdentity: string;
  /**
   * Target-local render identity. Unlike the aggregate compile fingerprint,
   * this changes only when this target's compiled bytes or declared viewer,
   * capture, configuration, or asset inputs change. `rendererIdentity`
   * separately distinguishes the browser and graphics backend.
   *
   * @evidence requirements/agent-authoring/knowledge-boundary.md#agent-content-supply-refusal Exposes `targetFingerprint` as the portable data boundary for the agent content supply refusal requirement.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-content-side-effect-invariant Types `targetFingerprint` for the spec authoring tool content side effect invariant system contract.
   */
  targetFingerprint: AutoMovieContentDigest;
  /**
   * Deterministic render specification.
   *
   * @evidence requirements/agent-authoring/knowledge-boundary.md#agent-content-supply-refusal Exposes `renderSpec` as the portable data boundary for the agent content supply refusal requirement.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-content-side-effect-invariant Types `renderSpec` for the spec authoring tool content side effect invariant system contract.
   */
  renderSpec: IAutoMovieRenderSpec;
  /**
   * Verified PNG frames in the bundle.
   *
   * @evidence requirements/agent-authoring/knowledge-boundary.md#agent-content-supply-refusal Exposes `frames` as the portable data boundary for the agent content supply refusal requirement.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-content-side-effect-invariant Types `frames` for the spec authoring tool content side effect invariant system contract.
   */
  frames: Array<{
    /** Zero-based frame index. */
    index: number;
    /** Frame time in seconds. */
    time: number;
    /** Render pass. */
    pass: AutoMovieGuidePass;
    /** Bundle-relative PNG path. */
    path: string;
    /** Raw PNG digest. */
    digest: AutoMovieContentDigest;
    /** Pixel width. */
    width: number;
    /** Pixel height. */
    height: number;
  }>;
  /** Complete semantic dependencies of mask frames in this bundle. */
  semanticMasks: IAutoMovieSemanticMaskReceipt[];
}

/**
 * Availability of one host-produced capture observation.
 *
 * The host records absence instead of manufacturing an observation. This type
 * carries the host's result; it does not decide whether absence is acceptable.
 *
 * @evidence requirements/rendering/validation.md#rendering-validation-status Distinguishes available evidence from an explicitly unperformed observation.
 * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-headless-platform Preserves whether the selected host could produce the requested capture observation.
 *
 * @evidence requirements/agent-authoring/knowledge-boundary.md#agent-host-evidence Exposes `AutoMovieCaptureObservation` as the portable data boundary for the agent host evidence requirement.
 * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-host-evidence-output Types `AutoMovieCaptureObservation` for the spec authoring host evidence output system contract.
 */
export type AutoMovieCaptureObservation<T> =
  | {
      /** The host produced the observation. */
      status: "available";
      /** Host-produced observation value. */
      value: T;
    }
  | {
      /** The host did not perform the observation. */
      status: "not-run";
      /** Non-blank reason the observation was not performed. */
      reason: string;
    };

/**
 * Host-owned adapter that captures a current compiled production frame.
 *
 * @evidence requirements/agent-authoring/knowledge-boundary.md#agent-host-evidence Exposes `AutoMovieProductionFrameCapture` as the portable data boundary for the agent host evidence requirement.
 * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-host-evidence-output Types `AutoMovieProductionFrameCapture` for the spec authoring host evidence output system contract.
 */
export type AutoMovieProductionFrameCapture = (
  input: IAutoMoviePreviewFrameInput & {
    /** Active project root. */
    projectRoot: string;
    /** Active production namespace inside the project. */
    productionId: string;
    /** Current compile fingerprint. */
    compileFingerprint: AutoMovieContentDigest;
    /** Delivery crop for a shot capture; absent for isolated asset captures. */
    crop?: IAutoMovieDeliveryCrop;
  },
) => Promise<{
  /** Raw PNG bytes. */
  bytes: Uint8Array;
  /** Final-byte dialogue state consumed by the drawn frame, or null. */
  dialogueRuntimeIdentity: AutoMovieContentDigest | null;
  /** Structured browser, executable, mode, platform, and graphics identity. */
  runtimeIdentity: IAutoMovieCaptureRuntimeIdentity;
  /** Pixel width. */
  width: number;
  /** Pixel height. */
  height: number;
  /**
   * Counts observed from the same drawn shot frame, or an explicit reason the
   * selected capture path could not obtain them.
   */
  observation: AutoMovieCaptureObservation<IAutoMovieRenderObservation>;
  /** Atomic same-shot palette and runtime coverage, or explicit absence. */
  semanticMask: AutoMovieCaptureObservation<IAutoMovieSemanticMaskEvidence>;
}>;
