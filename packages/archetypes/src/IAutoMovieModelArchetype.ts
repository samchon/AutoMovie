import {
  AutoMovieHumanoidBone,
  IAutoMovieModel,
  IAutoMovieModelPart,
} from "@automovie/interface";

/**
 * One archetype parameter's accepted value kind and inclusive bounds.
 *
 * @author Samchon
 * @evidence requirements/asset-authoring/geometry.md#asset-geometry-dimensions Defines the typed, bounded dimensions a recipe may author.
 * @evidence requirements/asset-authoring/validation.md#asset-geometry-validation Publishes the value-kind and range constraints the design gate uses before geometry construction.
 * @evidence specifications/asset-and-representation/model-geometry-and-surface-facts.md#asset-spec-geometry-inputs Carries the geometry-input schema before a builder consumes it.
 * @evidence specifications/asset-and-representation/fidelity-and-validation.md#asset-spec-validation-numeric-structure Supplies the expected kind and range for each numeric structure finding.
 */
export interface IAutoMovieArchetypeParameter {
  /**
   * Exact accepted value kind.
   *
   * @evidence requirements/asset-authoring/geometry.md#asset-geometry-dimensions Keeps each authored dimension in its declared numeric or discriminating domain.
   * @evidence specifications/asset-and-representation/model-geometry-and-surface-facts.md#asset-spec-geometry-inputs Tells the design gate how to interpret one geometry input.
   */
  kind: "number" | "string" | "boolean";
  /**
   * Inclusive minimum, for a numeric parameter that declares one.
   *
   * @evidence requirements/asset-authoring/geometry.md#asset-geometry-dimensions Bounds a real-dimension input before it can become geometry.
   * @evidence specifications/asset-and-representation/model-geometry-and-surface-facts.md#asset-spec-geometry-inputs Supplies the lower endpoint of the accepted geometry-input range.
   */
  minimum?: number;
  /**
   * Inclusive maximum, for a numeric parameter that declares one.
   *
   * @evidence requirements/asset-authoring/geometry.md#asset-geometry-dimensions Bounds a real-dimension input before it can become geometry.
   * @evidence specifications/asset-and-representation/model-geometry-and-surface-facts.md#asset-spec-geometry-inputs Supplies the upper endpoint of the accepted geometry-input range.
   */
  maximum?: number;
}

/**
 * One archetype-owned refusal raised while planning a parameter map.
 *
 * @author Samchon
 * @evidence requirements/asset-authoring/geometry.md#asset-degenerate-geometry-refusal Requires invalid or unsupported geometry inputs to fail explicitly.
 * @evidence requirements/asset-authoring/validation.md#asset-validation-gap Preserves an unsupported parameter decision as a refusal instead of successful output.
 * @evidence specifications/asset-and-representation/model-geometry-and-surface-facts.md#asset-spec-model-output-failures Carries a stable refusal before invalid parameters reach geometry output.
 * @evidence specifications/asset-and-representation/fidelity-and-validation.md#asset-spec-validation-status-failures Carries a machine-readable failure and operator-facing reason for the unsupported input.
 */
export interface IAutoMovieArchetypeRefusal {
  /**
   * Diagnostic code the design gate reports verbatim.
   *
   * @evidence requirements/asset-authoring/geometry.md#asset-degenerate-geometry-refusal Identifies which invalid-geometry rule rejected the parameter map.
   * @evidence specifications/asset-and-representation/model-geometry-and-surface-facts.md#asset-spec-model-output-failures Gives a model-output refusal a stable machine-readable identity.
   */
  code: string;
  /**
   * Complete operator-facing sentence, including the correction.
   *
   * @evidence requirements/asset-authoring/geometry.md#asset-degenerate-geometry-refusal Explains how the author can replace the invalid geometry input.
   * @evidence specifications/asset-and-representation/model-geometry-and-surface-facts.md#asset-spec-model-output-failures Preserves the actionable reason instead of emitting a placeholder model.
   */
  message: string;
}

/**
 * The exact keys one parameter map must carry and may carry.
 *
 * A plan is computed from the parameters themselves because an archetype may
 * take a discriminating parameter whose value decides which other keys are
 * meaningful. The design gate owns the diagnostics; the archetype owns only the
 * facts they are derived from.
 *
 * @author Samchon
 * @evidence requirements/asset-authoring/geometry.md#asset-geometry-dimensions Declares exactly which dimensions one selected recipe must and may provide.
 * @evidence specifications/asset-and-representation/model-geometry-and-surface-facts.md#asset-spec-geometry-inputs Resolves discriminated geometry inputs before materialization.
 */
export interface IAutoMovieArchetypeParameterPlan {
  /**
   * Keys that must be present.
   *
   * @evidence requirements/asset-authoring/geometry.md#asset-geometry-dimensions Prevents a builder from receiving an incomplete dimension set.
   * @evidence specifications/asset-and-representation/model-geometry-and-surface-facts.md#asset-spec-geometry-inputs States the required portion of the selected input contract.
   */
  required: readonly string[];
  /**
   * Keys accepted at all, or null when every declared schema key is.
   *
   * @evidence requirements/asset-authoring/geometry.md#asset-geometry-dimensions Keeps unused dimensions from becoming stored claims the geometry ignores.
   * @evidence specifications/asset-and-representation/model-geometry-and-surface-facts.md#asset-spec-geometry-inputs Narrows a discriminated parameter map to inputs the chosen shape consumes.
   */
  accepted: readonly string[] | null;
  /**
   * Archetype-owned refusals, such as an unsupported discriminating value.
   *
   * @evidence requirements/asset-authoring/geometry.md#asset-degenerate-geometry-refusal Refuses unsupported shape input instead of materializing an arbitrary fallback.
   * @evidence specifications/asset-and-representation/model-geometry-and-surface-facts.md#asset-spec-model-output-failures Returns the exact failed input contract before output construction.
   */
  refusals: readonly IAutoMovieArchetypeRefusal[];
}

/**
 * Everything a geometry builder needs beyond the recipe's own parameters.
 *
 * @author Samchon
 * @evidence requirements/asset-authoring/geometry.md#asset-primitive-freeform-geometry Supplies a registered builder with the context needed to materialize either primitive or mesh parts.
 * @evidence specifications/asset-and-representation/model-geometry-and-surface-facts.md#asset-spec-geometry-inputs Carries accepted source facts into the selected geometry builder.
 */
export interface IAutoMovieArchetypeBuildInput {
  /**
   * Recipe id the compiler is materializing.
   *
   * @evidence requirements/asset-authoring/identity-and-instances.md#asset-prototype-instance Keeps the shared archetype definition separate from the recipe occurrence being built.
   * @evidence specifications/asset-and-representation/alternatives-instances-and-groups.md#asset-spec-prototype-instance Carries the recipe-side occurrence without turning it into the registered prototype.
   */
  recipe: string;
  /**
   * Exact recipe parameter map, already accepted by the design gate.
   *
   * @evidence requirements/asset-authoring/geometry.md#asset-geometry-dimensions Carries the accepted real dimensions into deterministic construction.
   * @evidence specifications/asset-and-representation/model-geometry-and-surface-facts.md#asset-spec-geometry-inputs Makes the builder consume the same geometry inputs the design gate accepted.
   */
  parameters: Readonly<Record<string, number | string | boolean>>;
  /**
   * Compiler-owned material id every generated part references.
   *
   * @evidence requirements/asset-authoring/identity-and-instances.md#asset-prototype-instance Carries the recipe occurrence's selected material independently of the shared archetype definition.
   * @evidence specifications/asset-and-representation/alternatives-instances-and-groups.md#asset-spec-prototype-instance Keeps the occurrence material input separate from the registered prototype.
   */
  material: string;
  /**
   * Compiler-owned skeleton id an articulated archetype must use.
   *
   * @evidence requirements/asset-authoring/rig-and-state.md#asset-rig-basis-controls Gives an articulated builder the exact compiler-owned rig identity it must materialize.
   * @evidence specifications/asset-and-representation/rig-deformation-and-state.md#asset-spec-rig-inputs Carries the named skeleton basis into construction without inventing another rig id.
   */
  skeleton: string;
}

/**
 * Deterministic geometry one archetype builds for one recipe.
 *
 * @author Samchon
 * @evidence requirements/asset-authoring/geometry.md#asset-primitive-freeform-geometry Returns primitive or mesh parts behind one reusable builder result.
 * @evidence specifications/asset-and-representation/model-geometry-and-surface-facts.md#asset-spec-geometry-inputs Publishes the deterministic geometry facts built from accepted inputs.
 */
export interface IAutoMovieArchetypeGeometry {
  /**
   * Compiler-owned skeleton, or null for a runtime without one.
   *
   * @evidence requirements/asset-authoring/rig-and-state.md#asset-rig-basis-controls Distinguishes an explicit articulated basis from a rigid result with no skeleton.
   * @evidence specifications/asset-and-representation/rig-deformation-and-state.md#asset-spec-rig-inputs Publishes the named hierarchy and rest basis materialized by the builder.
   */
  skeleton: IAutoMovieModel["skeleton"];
  /**
   * Visible primitive parts in deterministic order.
   *
   * @evidence requirements/asset-authoring/geometry.md#asset-primitive-freeform-geometry Represents a model as authored geometry parts with real dimensions.
   * @evidence specifications/asset-and-representation/model-geometry-and-surface-facts.md#asset-spec-geometry-inputs Preserves deterministic part order and the shapes built from accepted inputs.
   */
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
 *
 * @author Samchon
 * @evidence requirements/asset-authoring/geometry.md#asset-primitive-freeform-geometry Lets a host register builders that return either primitive or mesh representation parts.
 * @evidence specifications/asset-and-representation/model-geometry-and-surface-facts.md#asset-spec-geometry-inputs Implements the geometry-input boundary as a deterministic parameter contract and builder.
 * @evidenceExclude requirements/asset-authoring/README.md#자산-저작-요구사항 Generic archetype contracts cover model inputs, bounds, rigs, and refusals but not the entire material, pattern, external, generated, style, and validation topic.
 * @evidenceExclude requirements/asset-authoring/geometry.md#asset-composable-geometry-operations An archetype invokes one builder; reusable modeling-operation composition belongs to the geometry engine.
 * @evidenceExclude requirements/asset-authoring/geometry.md#asset-geometry-topology The generic result names model parts but does not author face, edge, loop, opening, or named-region topology.
 * @evidenceExclude requirements/asset-authoring/representations-bounds-and-lod.md#asset-bounds-state-motion The contract reports one pre-build radius and does not evaluate pose, state, or motion envelopes.
 * @evidenceExclude requirements/asset-authoring/representations-bounds-and-lod.md#asset-lod-proxy-lineage Archetypes return one native model and do not generate proxy or LOD lineage.
 * @evidenceExclude requirements/asset-authoring/representations-bounds-and-lod.md#asset-representation-selection The registry selects an archetype by exact recipe id, not a representation by shot purpose or budget.
 * @evidenceExclude requirements/asset-authoring/representations-bounds-and-lod.md#asset-representation-semantic-preservation No representation replacement occurs inside an archetype build.
 * @evidenceExclude requirements/asset-authoring/representations-bounds-and-lod.md#asset-lod-transition-stability Archetype construction is timeless and owns no runtime LOD transition.
 * @evidenceExclude requirements/asset-authoring/representations-bounds-and-lod.md#asset-representation-stale-refusal Archetype definitions do not cache derived bounds, proxies, or LOD revisions.
 * @evidenceExclude requirements/asset-authoring/rig-and-state.md#asset-general-joint-relations This boundary names humanoid bones but does not author arbitrary hinge, slider, path, or driver graphs.
 * @evidenceExclude requirements/asset-authoring/rig-and-state.md#asset-motion-retargeting Motion-to-rig mapping and compatibility are performed after model construction.
 * @evidenceExclude requirements/asset-authoring/rig-and-state.md#asset-state-motion-distinction Archetypes build neutral model facts and do not own named state transitions.
 * @evidenceExclude requirements/asset-authoring/rig-and-state.md#asset-deformable-surface The archetype result carries primitive or mesh parts but no skin, morph, lattice, or soft-body binding.
 * @evidenceExclude requirements/asset-authoring/rig-and-state.md#asset-derived-deformation-basis The package creates no skin binding, morph delta, or deformation cache to track.
 * @evidenceExclude requirements/asset-authoring/rig-and-state.md#asset-invalid-rig-refusal Rig graph validation belongs to the model validation stage, not this parameter-plan boundary.
 * @evidenceExclude requirements/asset-authoring/validation.md#asset-rig-validation The archetype contract declares bones and build output but does not execute pose-range or deformation validation.
 * @evidenceExclude requirements/asset-authoring/validation.md#asset-surface-validation Material and texture validation belongs to their owning asset pipeline; archetypes receive only a material id.
 * @evidenceExclude requirements/asset-authoring/validation.md#asset-representation-bounds-validation One conservative radius is not a cross-representation bounds or LOD validation result.
 * @evidenceExclude requirements/asset-authoring/validation.md#asset-external-generated-validation Archetype construction consumes accepted native facts and does not adopt external or generated bytes.
 * @evidenceExclude specifications/asset-and-representation/README.md#자산과-표현-시스템-사양 This interface implements one model-archetype slice rather than the complete asset and representation specification family.
 * @evidenceExclude specifications/asset-and-representation/model-geometry-and-surface-facts.md#asset-spec-era-style-inputs Archetypes accept structural parameters and do not interpret era, style references, or style mixing.
 * @evidenceExclude specifications/asset-and-representation/model-geometry-and-surface-facts.md#asset-spec-geometry-operations-topology A builder result contains geometry but no reusable operation or topology lineage.
 * @evidenceExclude specifications/asset-and-representation/model-geometry-and-surface-facts.md#asset-spec-material-texture-relations Builders receive a resolved material id and do not author texture channels or sampling relations.
 * @evidenceExclude specifications/asset-and-representation/model-geometry-and-surface-facts.md#asset-spec-surface-states-substitution Archetypes construct one model state and own no material-state substitution.
 * @evidenceExclude specifications/asset-and-representation/model-geometry-and-surface-facts.md#asset-spec-procedural-pattern-inputs The parameter builder does not define seeded arrays, scatters, or surface pattern rules.
 * @evidenceExclude specifications/asset-and-representation/model-geometry-and-surface-facts.md#asset-spec-surface-resource-closure Archetype inputs contain identifiers and scalar parameters, not external resource bytes or provenance.
 * @evidenceExclude specifications/asset-and-representation/bounds-proxies-and-lod.md#asset-spec-dynamic-bounds-invariants A projection radius is a neutral pre-build bound and does not claim a dynamic envelope.
 * @evidenceExclude specifications/asset-and-representation/bounds-proxies-and-lod.md#asset-spec-proxy-purpose-lineage The package does not generate purpose-specific proxies.
 * @evidenceExclude specifications/asset-and-representation/bounds-proxies-and-lod.md#asset-spec-lod-selection-policy Exact archetype lookup does not evaluate an LOD graph or selection threshold.
 * @evidenceExclude specifications/asset-and-representation/bounds-proxies-and-lod.md#asset-spec-lod-transition-invariants Model construction has no camera-time representation transition.
 * @evidenceExclude specifications/asset-and-representation/bounds-proxies-and-lod.md#asset-spec-lod-output-costs Archetypes report no representation cost or worst-case budget.
 * @evidenceExclude specifications/asset-and-representation/bounds-proxies-and-lod.md#asset-spec-bounds-lod-failures No derived proxy or LOD state exists here to invalidate or mark stale.
 * @evidenceExclude specifications/asset-and-representation/rig-deformation-and-state.md#asset-spec-joint-control-invariants The interface carries a bone list but does not validate dependency order, cycles, or control targets.
 * @evidenceExclude specifications/asset-and-representation/rig-deformation-and-state.md#asset-spec-skin-morph-facts Archetype geometry contains no skin weights, bind relation, or morph delta.
 * @evidenceExclude specifications/asset-and-representation/rig-deformation-and-state.md#asset-spec-state-motion-separation The builder emits neutral facts and no named state or motion function.
 * @evidenceExclude specifications/asset-and-representation/rig-deformation-and-state.md#asset-spec-retarget-compatibility Retarget mapping and contact impact are owned by the motion pipeline.
 * @evidenceExclude specifications/asset-and-representation/rig-deformation-and-state.md#asset-spec-derived-deformation-staleness No derived deformation basis is created or cached by this package.
 * @evidenceExclude specifications/asset-and-representation/rig-deformation-and-state.md#asset-spec-rig-output-failures The contract does not run hierarchy, skin, morph, pose, or contact validation.
 * @evidenceExclude specifications/asset-and-representation/fidelity-and-validation.md#asset-spec-validation-surface-visual This package has no frame, angle, texture, silhouette, or visual-review input.
 * @evidenceExclude specifications/asset-and-representation/fidelity-and-validation.md#asset-spec-validation-motion-transitions Archetype planning is static and does not validate motion or representation transitions.
 * @evidenceExclude specifications/asset-and-representation/fidelity-and-validation.md#asset-spec-validation-current-evidence No validation receipt, frame reference, or prior approved result is stored here.
 * @evidenceExclude specifications/asset-and-representation/fidelity-and-validation.md#asset-spec-validation-compatibility-ceiling Capability declarations are inputs to compatibility review, not the review output or approval.
 */
export interface IAutoMovieModelArchetype {
  /**
   * Non-blank identifier a model recipe names.
   *
   * @evidence requirements/asset-authoring/identity-and-instances.md#asset-prototype-instance Gives every shared definition the id that recipe occurrences reference.
   * @evidence specifications/asset-and-representation/alternatives-instances-and-groups.md#asset-spec-prototype-instance Separates the registered prototype id from every recipe occurrence built from it.
   */
  id: string;
  /**
   * Semantic capabilities a recipe of this archetype may declare.
   *
   * @evidence requirements/asset-authoring/validation.md#asset-purpose-validation Exposes which purposes the generated representation can actually serve.
   * @evidence specifications/asset-and-representation/fidelity-and-validation.md#asset-spec-validation-purpose-inputs Makes capability an explicit validation input instead of inferring it from appearance.
   */
  capabilities: readonly string[];
  /**
   * Humanoid bones the builder's skeleton materializes.
   *
   * An empty list means the builder owns no skeleton at all, which is what
   * refuses a bone attachment and what binds a static external appearance.
   *
   * @evidence requirements/asset-authoring/rig-and-state.md#asset-rig-basis-controls Declares the exact named bone basis an articulated builder materializes.
   * @evidence specifications/asset-and-representation/rig-deformation-and-state.md#asset-spec-rig-inputs Distinguishes a rigid archetype from one with an explicit skeleton input contract.
   */
  bones: readonly AutoMovieHumanoidBone[];
  /**
   * Accepted value kind and bounds of every parameter, keyed by name.
   *
   * @evidence requirements/asset-authoring/geometry.md#asset-geometry-dimensions Declares the dimensions and discriminators an author may control.
   * @evidence specifications/asset-and-representation/model-geometry-and-surface-facts.md#asset-spec-geometry-inputs Defines the input schema independently of any one recipe instance.
   */
  parameters: Readonly<Record<string, IAutoMovieArchetypeParameter>>;
  /**
   * Plan which keys one parameter map must carry, may carry, and cannot.
   *
   * @evidence requirements/asset-authoring/geometry.md#asset-geometry-dimensions Prevents inactive dimensions from becoming false authored state.
   * @evidence specifications/asset-and-representation/model-geometry-and-surface-facts.md#asset-spec-geometry-inputs Resolves value-dependent geometry input obligations before building.
   */
  plan: (
    parameters: Readonly<Record<string, number | string | boolean>>,
  ) => IAutoMovieArchetypeParameterPlan;
  /**
   * Conservative projection radius in meters for one accepted parameter map.
   *
   * Selection and culling read this before any geometry exists, so it answers
   * for a malformed map with a finite number rather than a throw.
   *
   * @evidence requirements/asset-authoring/representations-bounds-and-lod.md#asset-declared-measured-bounds Provides an author-declared conservative bound before measured geometry exists.
   * @evidence specifications/asset-and-representation/bounds-proxies-and-lod.md#asset-spec-bounds-inputs Carries a finite metric bound with the archetype's parameter basis.
   */
  projectionRadius: (
    parameters: Readonly<Record<string, number | string | boolean>>,
  ) => number;
  /**
   * Build deterministic geometry from one accepted parameter map.
   *
   * @evidence requirements/asset-authoring/geometry.md#asset-primitive-freeform-geometry Lets a registered capability turn accepted facts into primitive or mesh model parts.
   * @evidence specifications/asset-and-representation/model-geometry-and-surface-facts.md#asset-spec-geometry-inputs Materializes deterministic geometry facts without making the compiler own the catalogue.
   */
  build: (input: IAutoMovieArchetypeBuildInput) => IAutoMovieArchetypeGeometry;
}
