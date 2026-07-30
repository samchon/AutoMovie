import { AutoMovieGuidePass, IAutoMovieRenderSpec } from "../cinematics";
import { IAutoMovieVector3 } from "../geometry";
import {
  AutoMovieFilmTime,
  IAutoMovieDiagnostic,
} from "./IAutoMovieProductionCompiler";
import { AutoMovieContentDigest } from "./IAutoMovieProductionDesign";

/** A point, actor or named world anchor used by geometry queries. */
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

/** One compact query over the current compiled production. */
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
 * MCP controllers require one non-union object parameter; the nested request
 * preserves discriminator validation without widening mutually exclusive fields
 * into optional properties.
 */
export interface IAutoMovieQueryGeometryInput {
  /**
   * Exact compact query over the current source compile. Selectors refer to
   * compiled node, formation or world identities, not caller-supplied
   * geometry.
   */
  request: AutoMovieGeometryQuery;
}

/** Geometry result intentionally remains compact and query-specific. */
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

/** Result of one geometry query. */
export interface IAutoMovieQueryGeometryOutput {
  /** Echoed query family. */
  query: AutoMovieGeometryQuery["query"];
  /** Current compile fingerprint or null before a successful compile. */
  compileFingerprint: AutoMovieContentDigest | null;
  /**
   * Engine-derived result, or null when compilation is missing or stale, a
   * selector is ambiguous, or the requested fact cannot be measured.
   */
  result: IAutoMovieGeometryResult | null;
  /** Exact refusal diagnostics and the correction required before retrying. */
  diagnostics: IAutoMovieDiagnostic[];
}

/** Request one actual current preview frame. */
export interface IAutoMoviePreviewFrameInput {
  /**
   * Exact shot or isolated compiled-model target.
   *
   * Whole-film and sequence review compose current shot frames. Asset review
   * supplies the server-required turntable view so the capture receipt proves
   * which angle and pose was inspected.
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
      };
  /**
   * Finite non-negative shot-local time no later than shot duration. The oracle
   * snaps it to the nearest current production frame. Asset targets derive the
   * canonical turntable time from `angleDeg`, so this field is ignored there.
   */
  time: number;
  /** Requested render pass, beauty by default. */
  pass?: AutoMovieGuidePass;
  /**
   * Optional positive integer width, no larger than production width. Width
   * times height may not exceed 16,777,216 pixels.
   */
  width?: number;
  /**
   * Optional positive integer height, no larger than production height. Width
   * times height may not exceed 16,777,216 pixels.
   */
  height?: number;
}

/** An actual PNG frame bound to a compile and render bundle. */
export interface IAutoMoviePreviewFrameOutput {
  /**
   * True only after current decodable, dimension-matching PNG bytes with
   * visible pixel variance are verified and committed to a render bundle.
   */
  captured: boolean;
  /** Current compile fingerprint. */
  compileFingerprint: AutoMovieContentDigest;
  /** Project-relative content-addressed render bundle, or null on any refusal. */
  renderBundle: string | null;
  /** Verified frame metadata or null on refusal. */
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
  /** Exact capture refusal diagnostics and correction, empty on success. */
  diagnostics: IAutoMovieDiagnostic[];
}

/** Versioned, comparable identity of the host capture runtime. */
export interface IAutoMovieCaptureRuntimeIdentity {
  /** Capture identity schema and semantics. */
  protocolVersion: "automovie.capture-runtime.v1";
  /** Exact Playwright package that selected and launched the browser. */
  playwright: {
    /** Package name. */
    package: "playwright";
    /** Installed package version. */
    version: string;
  };
  /** Exact browser executable provenance. */
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
  /** Host operating-system boundary. */
  platform: {
    /** Node platform name. */
    os: string;
    /** Node architecture name. */
    arch: string;
  };
  /** Browser launch and raster mode. */
  mode: {
    /** Explicit headless implementation. */
    headless: "chromium";
    /** Exact viewport scale. */
    deviceScaleFactor: number;
  };
  /** Requested and actual WebGL identity. */
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

/** Content-addressed manifest for preview and production frames. */
export interface IAutoMovieRenderBundleManifest {
  /** Bundle manifest format. */
  version: 3;
  /** Asset, shot, sequence, or film render target. */
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
  /** Compile fingerprint whose bytes were rendered. */
  compileFingerprint: AutoMovieContentDigest;
  /** Canonical JSON encoding of one validated capture runtime identity. */
  rendererIdentity: string;
  /**
   * Target-local render identity. Unlike the aggregate compile fingerprint,
   * this changes only when this target's compiled bytes or declared viewer,
   * capture, configuration, or asset inputs change. `rendererIdentity`
   * separately distinguishes the browser and graphics backend.
   */
  targetFingerprint: AutoMovieContentDigest;
  /** Deterministic render specification. */
  renderSpec: IAutoMovieRenderSpec;
  /** Verified PNG frames in the bundle. */
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
}

/** Host-owned adapter that captures a current compiled production frame. */
export type AutoMovieProductionFrameCapture = (
  input: IAutoMoviePreviewFrameInput & {
    /** Active project root. */
    projectRoot: string;
    /** Current compile fingerprint. */
    compileFingerprint: AutoMovieContentDigest;
  },
) => Promise<{
  /** Raw PNG bytes. */
  bytes: Uint8Array;
  /** Structured browser, executable, mode, platform, and graphics identity. */
  runtimeIdentity: IAutoMovieCaptureRuntimeIdentity;
  /** Pixel width. */
  width: number;
  /** Pixel height. */
  height: number;
}>;
