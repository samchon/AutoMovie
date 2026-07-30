import { AutoMovieGuidePass } from "../cinematics";
import { IAutoMovieVector3 } from "../geometry";
import { AutoMovieHumanoidBone } from "../skeleton";

/** A SHA-256 value computed by AutoMovie from authoritative project bytes. */
export type AutoMovieContentDigest = `sha256:${string}`;

/** One deliverable the production must eventually materialize. */
export interface IAutoMovieProductionDeliverable {
  /** Non-blank id, unique within this production. */
  id: string;
  /** Output class. */
  kind: "preview" | "feature" | "guide-pass" | "captions" | "audio-mix";
  /** Whether final compilation requires the deliverable. */
  required: boolean;
}

/** Global frame and art-direction invariants for one production. */
export interface IAutoMovieProductionDesign {
  /** Non-blank stable production id; film-level acceptance targets use it. */
  id: string;
  /** Non-blank human-facing title. */
  title: string;
  /** Non-blank one-sentence narrative promise. */
  logline: string;
  /**
   * Finite intended finished runtime in seconds, strictly above zero and on the
   * production frame clock.
   */
  targetRuntimeSeconds: number;
  /** Deterministic frame clock and raster format. */
  frameFormat: {
    /**
     * Integer pixel width from 16 through 16,384. Width times height may not
     * exceed 16,777,216 pixels, the exact-frame review capture ceiling.
     */
    width: number;
    /**
     * Integer pixel height from 16 through 16,384. Width times height may not
     * exceed 16,777,216 pixels, the exact-frame review capture ceiling.
     */
    height: number;
    /** Finite frames per second, strictly above zero. */
    fps: number;
    /** Output color space. */
    colorSpace: "srgb";
  };
  /** Bounded visual grammar rather than screenplay prose. */
  artDirection: {
    /** Foundation visual style. */
    style: "primitive-3d";
    /** Non-empty unique CSS-compatible palette colors. */
    palette: string[];
    /** Non-blank rules that keep important silhouettes legible. */
    silhouettePriority: string;
    /** Non-blank rules for conveying scale with primitive geometry. */
    scaleGrammar: string;
  };
  /** At least one output, with every deliverable id unique. */
  deliverables: IAutoMovieProductionDeliverable[];
}

/**
 * One distance-specific recipe reference emitted as authoring/runtime metadata.
 *
 * The foundation compiler materializes every referenced recipe. The scaffold
 * viewer automatically selects anonymous formation tiers from distance and
 * projected contribution with hysteresis; ordinary scene nodes do not yet
 * switch model tiers automatically.
 */
export interface IAutoMovieModelLodRecipe {
  /** Detail tier. */
  tier: "hero" | "near" | "far";
  /**
   * Positive maximum viewing distance in meters, strictly increasing between
   * tiers, or null only on the final unbounded tier.
   */
  maxDistance: number | null;
  /** Existing recipe id used at this tier; self-reference is allowed. */
  recipe: string;
}

/** A bounded primitive model recipe compiled into deterministic model data. */
export interface IAutoMovieModelRecipe {
  /** Non-blank stable recipe id, unique under portable case folding. */
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
  /**
   * Exact archetype-specific parameter map. Read `MODEL_RECIPE`: required keys,
   * value kinds and ranges vary by archetype, and unsupported keys are
   * refused.
   */
  parameters: Record<string, number | string | boolean>;
  /**
   * Exactly one named six-digit `#RRGGBB` material color in the foundation
   * compiler. Multiple semantic part materials remain unsupported and are
   * refused instead of silently discarded.
   */
  palette: Record<string, string>;
  /**
   * Non-empty unique tiers ordered `hero`, `near`, `far`, with increasing
   * positive distances and an optional unbounded tier only at the end.
   */
  lod: IAutoMovieModelLodRecipe[];
  /**
   * Supported semantic abilities visible to source and review. Currently only
   * `stickman` may declare `signal`; source still authors the actual signaling
   * motion, and every other archetype must use an empty list.
   */
  capabilities: string[];
  /**
   * Unique semantic bone sockets. Only `stickman` may declare a bone that
   * actually exists on its compiler-owned foundation skeleton; the materializer
   * does not create attached scene nodes automatically.
   */
  attachments: Array<{
    /** Non-blank attachment id, unique within the recipe. */
    id: string;
    /** Bone id used as the attachment parent. */
    bone: AutoMovieHumanoidBone;
  }>;
}

/** A named point in the production world. */
export interface IAutoMovieWorldLandmark {
  /** Stable landmark id. */
  id: string;
  /** Center in meters. */
  position: IAutoMovieVector3;
  /** Finite selection and clearance radius in meters, strictly above zero. */
  radius: number;
  /** Non-blank narrative or tactical meaning. */
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
  /**
   * At least three distinct finite XZ vertices forming a simple,
   * non-self-intersecting polygon with non-zero area.
   */
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
  /** At least two finite ordered centerline points in world XZ coordinates. */
  waypoints: Array<{
    /** World X in meters. */
    x: number;
    /** World Z in meters. */
    z: number;
  }>;
  /** Finite maximum formation width in meters, strictly above zero. */
  allowedFormationWidth: number;
}

/** An axis-aligned world-space effect volume. */
export interface IAutoMovieWorldBounds {
  /** Minimum corner. */
  min: IAutoMovieVector3;
  /** Maximum corner. */
  max: IAutoMovieVector3;
}

/** One bounded deterministic environmental-effect emitter recipe. */
export interface IAutoMovieEffectRecipe {
  /** Stable recipe id. */
  id: string;
  /** Supported primitive effect family. */
  kind: "fog" | "smoke" | "dust";
  /** Explicit deterministic recipe seed. */
  seed: number;
  /** Bounded deterministic emission. */
  emission: {
    /** Particles emitted per second. */
    rate: number;
    /** Particles emitted at cue start. */
    burst: number;
    /** Maximum emitting duration in seconds. */
    duration: number;
  };
  /** Bounded billboard appearance. */
  particle: {
    /** Inclusive lifetime range in seconds. */
    lifetime: { min: number; max: number };
    /** Inclusive world-size range in meters. */
    size: { min: number; max: number };
    /** Exact opaque hexadecimal RGB color. */
    color: string;
    /** Inclusive alpha range from zero through one. */
    opacity: { min: number; max: number };
  };
  /** Bounded deterministic transport. */
  motion: {
    /** World-space meters per second. */
    wind: IAutoMovieVector3;
    /** Additional upward meters per second. */
    rise: number;
    /** Maximum seeded lateral velocity deviation. */
    turbulence: number;
  };
  /** Hard runtime and LOD budgets. */
  budget: {
    /** Maximum live billboard instances. */
    maxParticles: number;
    /** Distance beyond which deterministic thinning applies. */
    lodDistance: number;
  };
  /** Only supported transparency law. */
  blend: "alpha";
}

/** An axis-aligned world-space effect volume. */
export interface IAutoMovieWorldEffectZone {
  /** Stable zone id. */
  id: string;
  /** Existing deterministic effect recipe id. */
  recipe: string;
  /** World-space volume. */
  bounds: IAutoMovieWorldBounds;
  /** Explicit deterministic zone seed. */
  seed: number;
}

/** Named spatial constraints and semantic anchors for a production. */
export interface IAutoMovieWorldDesign {
  /** Non-blank stable world id. */
  id: string;
  /** World unit. */
  units: "meter";
  /** Named tactical or narrative landmarks. */
  landmarks: IAutoMovieWorldLandmark[];
  /** Queryable surfaces. */
  surfaces: IAutoMovieWorldSurface[];
  /** Named formation routes. */
  routes: IAutoMovieWorldRoute[];
  /** Bounded deterministic environmental-effect recipes. */
  effectRecipes: IAutoMovieEffectRecipe[];
  /** Deterministic effect regions bound to recipes. */
  effectZones: IAutoMovieWorldEffectZone[];
}

/**
 * Review-facing formation behavior vocabulary.
 *
 * The compiler does not infer or restrict source motion from these labels.
 * Observable shot predicates and review evidence remain authoritative.
 */
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
      /** Integer ranks from 1 through count. */
      ranks: number;
      /** Integer files from 1 through count; ranks times files covers count. */
      files: number;
      /** Finite inter-slot spacing in meters, strictly above zero. */
      spacing: {
        /** Left-to-right spacing between files. */
        lateral: number;
        /** Front-to-back spacing between ranks. */
        depth: number;
      };
    }
  | {
      /** March column. */
      kind: "column";
      /** Integer ranks from 1 through count. */
      ranks: number;
      /** Integer files from 1 through count; ranks times files covers count. */
      files: number;
      /** Finite inter-slot spacing in meters, strictly above zero. */
      spacing: {
        /** Left-to-right spacing between files. */
        lateral: number;
        /** Front-to-back spacing between ranks. */
        depth: number;
      };
    }
  | {
      /** Wedge layout. */
      kind: "wedge";
      /** Integer rows from 1 through count; depth squared must cover count. */
      depth: number;
      /** Finite inter-slot spacing in meters, strictly above zero. */
      spacing: {
        /** Left-to-right spacing between members in one row. */
        lateral: number;
        /** Front-to-back spacing between rows. */
        depth: number;
      };
    }
  | {
      /** Arc layout. */
      kind: "arc";
      /** Finite arc radius in meters, strictly above zero. */
      radius: number;
      /** Finite covered angle, strictly above zero and at most 360 degrees. */
      arcDegrees: number;
    }
  | {
      /** Seeded scatter layout. */
      kind: "scatter";
      /** Finite scatter radius in meters, strictly above zero. */
      radius: number;
      /** Integer layout-specific seed from zero through `MAX_SAFE_INTEGER`. */
      seed: number;
    };

/** A unit-level formation whose members are deterministic derived slots. */
export interface IAutoMovieFormationDesign {
  /** Non-blank stable formation id, unique under portable case folding. */
  id: string;
  /** Existing model recipe id enforced on every derived slot, including heroes. */
  modelRecipe: string;
  /**
   * Integer number of derived slots from 1 through 100,000. Generated output
   * stores bounded chunks and hero exceptions; anonymous slots are regenerated
   * from index and seed and rendered through instancing.
   */
  count: number;
  /**
   * Compact layout with only the parameters its algorithm consumes. Line,
   * column and wedge own explicit spacing; arc separation follows radius and
   * angle, while scatter density follows count and radius.
   */
  layout: IAutoMovieFormationLayout;
  /** Formation origin in world space. */
  anchor: IAutoMovieVector3;
  /** Finite world-space heading in degrees. */
  facingDeg: number;
  /** Integer deterministic seed from zero through `MAX_SAFE_INTEGER`. */
  seed: number;
  /**
   * Unique intended formation behaviors for source/review coordination.
   *
   * These labels are not a compiler permission boundary and do not prove that
   * source implemented or avoided a motion.
   */
  capabilities: AutoMovieFormationCapability[];
  /** Slots promoted to named hero actors. */
  heroOverrides: Array<{
    /** Unique zero-based slot strictly below this formation's count. */
    slot: number;
    /** Non-blank actor id, unique among this formation's hero overrides. */
    actor: string;
  }>;
}

/** A named opening or closing state required by a shot. */
export interface IAutoMovieNamedState {
  /** Stable state id. */
  id: string;
  /** Non-blank human-readable state contract; it is never proof by itself. */
  description: string;
  /**
   * Machine-checkable facts sampled from compiled pose and transform output.
   *
   * Descriptive prose never discharges a state contract by itself.
   */
  predicates: IAutoMovieShotPredicate[];
}

/** A spatial operand measured from one compiled shot. */
export type IAutoMovieShotSpatialSelector =
  | {
      /** One compiled scene node. */
      kind: "node";
      /** Exact scene-node id. */
      id: string;
    }
  | {
      /** Centroid of every compiler-materialized formation slot. */
      kind: "formation";
      /** Exact formation design id. */
      id: string;
    }
  | {
      /** One named production-world landmark. */
      kind: "landmark";
      /** Exact landmark id. */
      id: string;
    }
  | {
      /** One literal world-space point. */
      kind: "point";
      /** Exact point in meters. */
      position: IAutoMovieVector3;
    };

/** A scalar comparison evaluated by the deterministic compiler. */
export interface IAutoMovieScalarPredicate {
  /** Numeric comparison. */
  operator: "<=" | ">=" | "==";
  /** Finite expected value in the unit implied by the selected predicate. */
  value: number;
  /** Finite non-negative absolute comparison tolerance. */
  tolerance: number;
}

/** One compiler-evaluable state or event fact. */
export type IAutoMovieShotPredicate =
  | (IAutoMovieScalarPredicate & {
      /** Sample one articulated joint angle. */
      kind: "joint-angle";
      /** Performed scene-node id. */
      actor: string;
      /** Normalized humanoid bone. */
      bone: AutoMovieHumanoidBone;
      /** Semantic pose axis. */
      axis: "flexion" | "abduction" | "twist";
    })
  | (IAutoMovieScalarPredicate & {
      /** Sample one world-space coordinate. */
      kind: "position";
      /** Compiled spatial subject. */
      subject: IAutoMovieShotSpatialSelector;
      /** World-space coordinate axis. */
      axis: "x" | "y" | "z";
    })
  | (IAutoMovieScalarPredicate & {
      /** Measure Euclidean distance between two compiled spatial operands. */
      kind: "distance";
      /** First spatial operand. */
      from: IAutoMovieShotSpatialSelector;
      /** Second spatial operand. */
      to: IAutoMovieShotSpatialSelector;
    });

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
  /** Inclusive finite event window inside the owning shot's duration. */
  window: {
    /** Earliest valid time. */
    from: number;
    /** Latest valid time. */
    to: number;
  };
  /** Non-empty unique actor, formation or object ids involved. */
  subjects: string[];
  /** Non-empty machine-checkable facts required at the realized event time. */
  predicates: IAutoMovieShotPredicate[];
}

/** A frame time and guide passes required for shot review. */
export interface IAutoMovieShotReviewFrame {
  /** Stable frame-contract id. */
  id: string;
  /** Time inside the owning shot, snapped exactly to the production frame clock. */
  time: number;
  /** Non-empty unique passes that must be captured. */
  passes: AutoMovieGuidePass[];
}

/** A code-bound shot contract, not a dense keyframe list. */
export interface IAutoMovieShotContract {
  /** Non-blank stable shot id, unique under portable case folding. */
  id: string;
  /** Non-blank narrative beat id owned by the coding-agent treatment. */
  beat: string;
  /** Coding-agent-owned source export. */
  source: {
    /**
     * Canonical project-relative POSIX TypeScript path. Backslashes, absolute
     * paths, dot segments and case-variant aliases are refused.
     */
    module: string;
    /** Named exported builder. */
    export: string;
  };
  /**
   * Finite shot runtime in seconds, strictly above zero and on the production
   * frame clock.
   */
  durationSeconds: number;
  /** Unique required actor and formation ids; formations must already exist. */
  participants: IAutoMovieShotParticipant[];
  /** Required opening states. */
  opening: IAutoMovieNamedState[];
  /** Required closing states. */
  closing: IAutoMovieNamedState[];
  /** Camera readability constraints. */
  camera: {
    /** Non-blank creative camera intent. */
    intent: string;
    /**
     * Non-empty unique compiled scene-node or formation ids that must remain
     * readable.
     */
    requiredSubjects: string[];
    /**
     * Finite maximum allowed pixel-occlusion ratio, inclusive from zero to one.
     *
     * The compiler projects subject root points but does not measure this
     * ratio. The external reviewer must compare current mask, depth, outline or
     * beauty frames against it.
     */
    maxOcclusionRatio: number;
  };
  /** Timed semantic events. */
  events: IAutoMovieShotEventContract[];
  /** At least one required visual-review frame. */
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
      /** Non-blank observable expectation for the cited current frame. */
      expectation: string;
    }
  | {
      /** Semantic event criterion. */
      kind: "event";
      /** Owning shot id; required when the acceptance target is the film. */
      shot?: string;
      /** Event id in the target shot or film. */
      event: string;
      /** Non-blank observable expectation for the cited compiled event. */
      expectation: string;
    }
  | {
      /** Numeric metric criterion. */
      kind: "metric";
      /**
       * Supported compiler-owned metric.
       *
       * Physics and occlusion metrics remain geometry/frame review concerns
       * until their operands and measurement protocols are explicit.
       */
      metric: "runtime-seconds";
      /** Numeric comparison. */
      operator: "<=" | ">=" | "==";
      /** Finite threshold value, in seconds for `runtime-seconds`. */
      value: number;
    };

/** A required or optional acceptance scenario for a shot or film. */
export interface IAutoMovieAcceptanceScenario {
  /** Non-blank stable scenario id, unique under portable case folding. */
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
  /**
   * Observable frame, compiled event or runtime metric criterion. Film-level
   * frame and event criteria also name their owning shot.
   */
  criterion: IAutoMovieAcceptanceCriterion;
  /**
   * Whether current review and final compilation require exact passing evidence
   * for this scenario.
   */
  required: boolean;
}

/** An addressable design artifact. */
export type IAutoMovieDesignTarget =
  | {
      /** Active production design. */
      kind: "production";
    }
  | {
      /** Model recipe. */
      kind: "model";
      /** Recipe id. */
      id: string;
    }
  | {
      /** Project-shared world design. */
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
