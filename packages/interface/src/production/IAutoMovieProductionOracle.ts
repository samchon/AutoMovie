import { AutoMovieGuidePass, IAutoMovieRenderSpec } from "../cinematics";
import { IAutoMovieVector3 } from "../geometry";
import { IAutoMovieDiagnostic } from "./IAutoMovieProductionCompiler";
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
      /** Formation bounds and slot query. */
      query: "formation";
      /** Formation id. */
      formation: string;
      /** Optional named state. */
      state?: string;
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
  /** Exact compact geometry query. */
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
  /** Query result or null when diagnostics prevent measurement. */
  result: IAutoMovieGeometryResult | null;
  /** Exact query diagnostics. */
  diagnostics: IAutoMovieDiagnostic[];
}

/** Request one actual current preview frame. */
export interface IAutoMoviePreviewFrameInput {
  /** Shot or film target. */
  target:
    | {
        /** Shot target. */
        kind: "shot";
        /** Shot id. */
        id: string;
      }
    | {
        /** Film target. */
        kind: "film";
        /** Film id. */
        id: string;
      };
  /** Time in seconds. */
  time: number;
  /** Requested render pass, beauty by default. */
  pass?: AutoMovieGuidePass;
  /** Optional output width. */
  width?: number;
  /** Optional output height. */
  height?: number;
}

/** An actual PNG frame bound to a compile and render bundle. */
export interface IAutoMoviePreviewFrameOutput {
  /** True only after current non-empty PNG bytes are verified. */
  captured: boolean;
  /** Current compile fingerprint. */
  compileFingerprint: AutoMovieContentDigest;
  /** Project-relative render bundle or null on refusal. */
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
  /** Exact capture diagnostics. */
  diagnostics: IAutoMovieDiagnostic[];
}

/** Content-addressed manifest for preview and production frames. */
export interface IAutoMovieRenderBundleManifest {
  /** Bundle manifest format. */
  version: 1;
  /** Shot or film render target. */
  target:
    | {
        /** Shot target. */
        kind: "shot";
        /** Shot id. */
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
  /** Pixel width. */
  width: number;
  /** Pixel height. */
  height: number;
}>;
