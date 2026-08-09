import {
  AutoMovieHumanoidBone,
  IAutoMovieModel,
  IAutoMovieModelPart,
} from "@automovie/interface";

/** One archetype parameter's accepted value kind and inclusive bounds. */
export interface IAutoMovieArchetypeParameter {
  /** Exact accepted value kind. */
  kind: "number" | "string" | "boolean";
  /** Inclusive minimum, for a numeric parameter that declares one. */
  minimum?: number;
  /** Inclusive maximum, for a numeric parameter that declares one. */
  maximum?: number;
}

/** One archetype-owned refusal raised while planning a parameter map. */
export interface IAutoMovieArchetypeRefusal {
  /** Diagnostic code the design gate reports verbatim. */
  code: string;
  /** Complete operator-facing sentence, including the correction. */
  message: string;
}

/**
 * The exact keys one parameter map must carry and may carry.
 *
 * A plan is computed from the parameters themselves because an archetype may
 * take a discriminating parameter whose value decides which other keys are
 * meaningful. The design gate owns the diagnostics; the archetype owns only the
 * facts they are derived from.
 */
export interface IAutoMovieArchetypeParameterPlan {
  /** Keys that must be present. */
  required: readonly string[];
  /** Keys accepted at all, or null when every declared schema key is. */
  accepted: readonly string[] | null;
  /** Archetype-owned refusals, such as an unsupported discriminating value. */
  refusals: readonly IAutoMovieArchetypeRefusal[];
}

/** Everything a geometry builder needs beyond the recipe's own parameters. */
export interface IAutoMovieArchetypeBuildInput {
  /** Recipe id the compiler is materializing. */
  recipe: string;
  /** Exact recipe parameter map, already accepted by the design gate. */
  parameters: Readonly<Record<string, number | string | boolean>>;
  /** Compiler-owned material id every generated part references. */
  material: string;
  /** Compiler-owned skeleton id an articulated archetype must use. */
  skeleton: string;
}

/** Deterministic geometry one archetype builds for one recipe. */
export interface IAutoMovieArchetypeGeometry {
  /** Compiler-owned skeleton, or null for a runtime without one. */
  skeleton: IAutoMovieModel["skeleton"];
  /** Visible primitive parts in deterministic order. */
  parts: IAutoMovieModelPart[];
}

/**
 * One registered model archetype: its parameter contract and its builder.
 *
 * The production core keeps the shape of a model recipe and never the
 * catalogue. It resolves `archetype` through a registry of these definitions,
 * so which figures, props, or shells a production can build is a decision that
 * belongs to the catalogue it registers, not to the compiler.
 *
 * Every member is data or a pure function of that data: the same parameters
 * must always plan the same keys, measure the same radius, and build the same
 * geometry, on every host and in every process.
 */
export interface IAutoMovieModelArchetype {
  /** Non-blank identifier a model recipe names. */
  id: string;
  /** Semantic capabilities a recipe of this archetype may declare. */
  capabilities: readonly string[];
  /**
   * Humanoid bones the builder's skeleton materializes.
   *
   * An empty list means the builder owns no skeleton at all, which is what
   * refuses a bone attachment and what binds a static external appearance.
   */
  bones: readonly AutoMovieHumanoidBone[];
  /** Accepted value kind and bounds of every parameter, keyed by name. */
  parameters: Readonly<Record<string, IAutoMovieArchetypeParameter>>;
  /** Plan which keys one parameter map must carry, may carry, and cannot. */
  plan: (
    parameters: Readonly<Record<string, number | string | boolean>>,
  ) => IAutoMovieArchetypeParameterPlan;
  /**
   * Conservative projection radius in meters for one accepted parameter map.
   *
   * Selection and culling read this before any geometry exists, so it answers
   * for a malformed map with a finite number rather than a throw.
   */
  projectionRadius: (
    parameters: Readonly<Record<string, number | string | boolean>>,
  ) => number;
  /** Build deterministic geometry from one accepted parameter map. */
  build: (input: IAutoMovieArchetypeBuildInput) => IAutoMovieArchetypeGeometry;
}
