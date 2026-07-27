import { AutoMovieGuidePass } from "../cinematics";
import { IAutoMovieVector3 } from "../geometry";

/** A SHA-256 value computed by AutoMovie from authoritative project bytes. */
export type AutoMovieContentDigest = `sha256:${string}`;

/** One deliverable the production must eventually materialize. */
export interface IAutoMovieProductionDeliverable {
  /** Stable deliverable id. */
  id: string;
  /** Output class. */
  kind: "preview" | "feature" | "guide-pass" | "captions" | "audio-mix";
  /** Whether final compilation requires the deliverable. */
  required: boolean;
}

/** Global frame and art-direction invariants for one production. */
export interface IAutoMovieProductionDesign {
  /** Stable production id. */
  id: string;
  /** Human-facing title. */
  title: string;
  /** One-sentence narrative promise. */
  logline: string;
  /** Intended finished runtime in seconds. */
  targetRuntimeSeconds: number;
  /** Deterministic frame clock and raster format. */
  frameFormat: {
    /** Pixel width. */
    width: number;
    /** Pixel height. */
    height: number;
    /** Frames per second. */
    fps: number;
    /** Output color space. */
    colorSpace: "srgb";
  };
  /** Bounded visual grammar rather than screenplay prose. */
  artDirection: {
    /** Foundation visual style. */
    style: "primitive-3d";
    /** CSS-compatible palette colors. */
    palette: string[];
    /** Rules that keep important silhouettes legible. */
    silhouettePriority: string;
    /** Rules for conveying scale with primitive geometry. */
    scaleGrammar: string;
  };
  /** Required and optional production outputs. */
  deliverables: IAutoMovieProductionDeliverable[];
}

/** One distance-specific representation used by a model recipe. */
export interface IAutoMovieModelLodRecipe {
  /** Detail tier. */
  tier: "hero" | "near" | "far";
  /** Maximum viewing distance, or null for an unbounded final tier. */
  maxDistance: number | null;
  /** Recipe id used at this tier. */
  recipe: string;
}

/** A bounded primitive model recipe compiled into deterministic model data. */
export interface IAutoMovieModelRecipe {
  /** Stable recipe id. */
  id: string;
  /** Production role. */
  role: "performer" | "mount" | "prop" | "set";
  /** Supported primitive archetype. */
  archetype:
    | "stickman"
    | "horse"
    | "artillery"
    | "flag"
    | "weapon"
    | "primitive-prop";
  /** Archetype-specific scalar parameters validated by the compiler. */
  parameters: Record<string, number | string | boolean>;
  /** Named material colors. */
  palette: Record<string, string>;
  /** Near-to-far representations. */
  lod: IAutoMovieModelLodRecipe[];
  /** Named runtime abilities provided by the compiled model. */
  capabilities: string[];
  /** Named attachment sockets and their bones. */
  attachments: Array<{
    /** Stable attachment id. */
    id: string;
    /** Bone id used as the attachment parent. */
    bone: string;
  }>;
}

/** A named point in the production world. */
export interface IAutoMovieWorldLandmark {
  /** Stable landmark id. */
  id: string;
  /** Center in meters. */
  position: IAutoMovieVector3;
  /** Selection and clearance radius in meters. */
  radius: number;
  /** Narrative or tactical meaning. */
  meaning: string;
}

/** A height rule used by a world surface. */
export type IAutoMovieHeightRule =
  | {
      /** Flat surface. */
      kind: "constant";
      /** Surface height in meters. */
      value: number;
    }
  | {
      /** Planar slope. */
      kind: "plane";
      /** Plane height at the world origin. */
      originHeight: number;
      /** Height gained per positive X meter. */
      slopeX: number;
      /** Height gained per positive Z meter. */
      slopeZ: number;
    };

/** A bounded horizontal polygon with a deterministic height function. */
export interface IAutoMovieWorldSurface {
  /** Stable surface id. */
  id: string;
  /** Polygon vertices in world XZ coordinates. */
  polygon: Array<{
    /** World X in meters. */
    x: number;
    /** World Z in meters. */
    z: number;
  }>;
  /** Surface height function. */
  height: IAutoMovieHeightRule;
  /** Whether performers may traverse the surface. */
  walkable: boolean;
}

/** A named route whose width constrains formations. */
export interface IAutoMovieWorldRoute {
  /** Stable route id. */
  id: string;
  /** Ordered centerline points in world XZ coordinates. */
  waypoints: Array<{
    /** World X in meters. */
    x: number;
    /** World Z in meters. */
    z: number;
  }>;
  /** Maximum formation width in meters. */
  allowedFormationWidth: number;
}

/** An axis-aligned world-space effect volume. */
export interface IAutoMovieWorldBounds {
  /** Minimum corner. */
  min: IAutoMovieVector3;
  /** Maximum corner. */
  max: IAutoMovieVector3;
}

/** A deterministic environmental-effect region. */
export interface IAutoMovieWorldEffectZone {
  /** Stable zone id. */
  id: string;
  /** Effect family. */
  kind: "fog" | "smoke" | "dust";
  /** World-space volume. */
  bounds: IAutoMovieWorldBounds;
  /** Explicit deterministic seed. */
  seed: number;
}

/** Named spatial constraints and semantic anchors for a production. */
export interface IAutoMovieWorldDesign {
  /** Stable world id. */
  id: string;
  /** World unit. */
  units: "meter";
  /** Named tactical or narrative landmarks. */
  landmarks: IAutoMovieWorldLandmark[];
  /** Queryable surfaces. */
  surfaces: IAutoMovieWorldSurface[];
  /** Named formation routes. */
  routes: IAutoMovieWorldRoute[];
  /** Deterministic effect regions. */
  effectZones: IAutoMovieWorldEffectZone[];
}

/** A supported formation behavior. */
export type AutoMovieFormationCapability =
  | "hold"
  | "advance"
  | "wheel"
  | "charge"
  | "fire-volley"
  | "break"
  | "retreat";

/** A compact formation layout; individual members are derived slots. */
export type IAutoMovieFormationLayout =
  | {
      /** Rectangular line. */
      kind: "line";
      /** Number of ranks. */
      ranks: number;
      /** Number of files. */
      files: number;
    }
  | {
      /** March column. */
      kind: "column";
      /** Number of ranks. */
      ranks: number;
      /** Number of files. */
      files: number;
    }
  | {
      /** Wedge layout. */
      kind: "wedge";
      /** Number of rows from point to base. */
      depth: number;
    }
  | {
      /** Arc layout. */
      kind: "arc";
      /** Arc radius in meters. */
      radius: number;
      /** Covered angle in degrees. */
      arcDegrees: number;
    }
  | {
      /** Seeded scatter layout. */
      kind: "scatter";
      /** Scatter radius in meters. */
      radius: number;
      /** Layout-specific seed. */
      seed: number;
    };

/** A unit-level formation whose members are deterministic derived slots. */
export interface IAutoMovieFormationDesign {
  /** Stable formation id. */
  id: string;
  /** Model recipe used by ordinary slots. */
  modelRecipe: string;
  /** Number of derived slots. */
  count: number;
  /** Compact layout. */
  layout: IAutoMovieFormationLayout;
  /** Inter-slot spacing in meters. */
  spacing: {
    /** Lateral spacing. */
    lateral: number;
    /** Front-to-back spacing. */
    depth: number;
  };
  /** Formation origin in world space. */
  anchor: IAutoMovieVector3;
  /** Heading in degrees. */
  facingDeg: number;
  /** Explicit deterministic seed. */
  seed: number;
  /** Permitted formation behaviors. */
  capabilities: AutoMovieFormationCapability[];
  /** Slots promoted to named hero actors. */
  heroOverrides: Array<{
    /** Zero-based deterministic slot. */
    slot: number;
    /** Named actor id. */
    actor: string;
  }>;
}

/** A named opening or closing state required by a shot. */
export interface IAutoMovieNamedState {
  /** Stable state id. */
  id: string;
  /** Human-readable state contract. */
  description: string;
}

/** An actor or formation required by a shot. */
export type IAutoMovieShotParticipant =
  | {
      /** Named actor participant. */
      kind: "actor";
      /** Actor id. */
      id: string;
    }
  | {
      /** Formation participant. */
      kind: "formation";
      /** Formation id. */
      id: string;
    };

/** A time-bounded event the shot source must implement. */
export interface IAutoMovieShotEventContract {
  /** Stable event id. */
  id: string;
  /** Event family. */
  kind: "contact" | "arrival" | "volley" | "break" | "reveal" | "transition";
  /** Inclusive event time window in seconds. */
  window: {
    /** Earliest valid time. */
    from: number;
    /** Latest valid time. */
    to: number;
  };
  /** Actor, formation or object ids involved. */
  subjects: string[];
}

/** A frame time and guide passes required for shot review. */
export interface IAutoMovieShotReviewFrame {
  /** Stable frame-contract id. */
  id: string;
  /** Time in seconds. */
  time: number;
  /** Passes that must be captured. */
  passes: AutoMovieGuidePass[];
}

/** A code-bound shot contract, not a dense keyframe list. */
export interface IAutoMovieShotContract {
  /** Stable shot id. */
  id: string;
  /** Narrative beat id. */
  beat: string;
  /** Coding-agent-owned source export. */
  source: {
    /** Project-relative TypeScript module path. */
    module: string;
    /** Named exported builder. */
    export: string;
  };
  /** Shot runtime in seconds. */
  durationSeconds: number;
  /** Required actor and formation ids. */
  participants: IAutoMovieShotParticipant[];
  /** Required opening states. */
  opening: IAutoMovieNamedState[];
  /** Required closing states. */
  closing: IAutoMovieNamedState[];
  /** Camera readability constraints. */
  camera: {
    /** Creative camera intent. */
    intent: string;
    /** Subjects that must remain readable. */
    requiredSubjects: string[];
    /** Maximum allowed occlusion ratio from zero to one. */
    maxOcclusionRatio: number;
  };
  /** Timed semantic events. */
  events: IAutoMovieShotEventContract[];
  /** Required visual-review frames. */
  reviewFrames: IAutoMovieShotReviewFrame[];
}

/** A measurable acceptance criterion. */
export type IAutoMovieAcceptanceCriterion =
  | {
      /** Visual frame criterion. */
      kind: "frame";
      /** Owning shot id; required when the acceptance target is the film. */
      shot?: string;
      /** Review-frame id in the target shot. */
      frame: string;
      /** Render pass to inspect. */
      pass: AutoMovieGuidePass;
      /** Observable expectation. */
      expectation: string;
    }
  | {
      /** Semantic event criterion. */
      kind: "event";
      /** Owning shot id; required when the acceptance target is the film. */
      shot?: string;
      /** Event id in the target shot or film. */
      event: string;
      /** Observable expectation. */
      expectation: string;
    }
  | {
      /** Numeric metric criterion. */
      kind: "metric";
      /** Supported metric. */
      metric:
        | "runtime-seconds"
        | "ground-penetration"
        | "foot-skate"
        | "occlusion-ratio"
        | "continuity-gap";
      /** Numeric comparison. */
      operator: "<=" | ">=" | "==";
      /** Threshold value. */
      value: number;
    };

/** A required or optional acceptance scenario for a shot or film. */
export interface IAutoMovieAcceptanceScenario {
  /** Stable scenario id. */
  id: string;
  /** Scenario target. */
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
  /** Observable criterion. */
  criterion: IAutoMovieAcceptanceCriterion;
  /** Whether review and final compilation require it. */
  required: boolean;
}

/** An addressable design artifact. */
export type IAutoMovieDesignTarget =
  | {
      /** Singleton production design. */
      kind: "production";
    }
  | {
      /** Model recipe. */
      kind: "model";
      /** Recipe id. */
      id: string;
    }
  | {
      /** Singleton world design. */
      kind: "world";
    }
  | {
      /** Formation design. */
      kind: "formation";
      /** Formation id. */
      id: string;
    }
  | {
      /** Shot contract. */
      kind: "shot";
      /** Shot id. */
      id: string;
    }
  | {
      /** Acceptance scenario. */
      kind: "acceptance";
      /** Scenario id. */
      id: string;
    };

/** Union of every addressable production design value. */
export type IAutoMovieDesignArtifact =
  | IAutoMovieProductionDesign
  | IAutoMovieModelRecipe
  | IAutoMovieWorldDesign
  | IAutoMovieFormationDesign
  | IAutoMovieShotContract
  | IAutoMovieAcceptanceScenario;
