import type {
  IAutoMovieBuiltEnvironment,
  IAutoMovieDesignEvidence,
  IAutoMovieDesignLineage,
  IAutoMovieDesignReference,
  IAutoMovieEffectRecipe,
  IAutoMovieFluidDomain,
  IAutoMovieFormationMotion,
  IAutoMovieFormationSlotMotion,
  IAutoMovieInstanceSetDesign,
  IAutoMovieModel,
  IAutoMovieMotion,
  IAutoMoviePlantingCluster,
  IAutoMoviePlantingDomain,
  IAutoMoviePlantingInstallation,
  IAutoMoviePropSpec,
  IAutoMovieServiceNetwork,
  IAutoMovieShotActorProgram,
  IAutoMovieShotBuildContext,
  IAutoMovieShotEffectCue,
  IAutoMovieSoftBodyDomain,
  IAutoMovieSoftFurnishing,
  IAutoMovieSpace,
  IAutoMovieStageSetPiece,
  IAutoMovieWaterFeature,
  IAutoMovieWorldEffectZone,
  IAutoMovieWorldLandmark,
  IAutoMovieWorldRoute,
  IAutoMovieWorldSurface,
} from "@automovie/interface";

/**
 * What one subject puts into the shot it appears in.
 *
 * A shot program is assembled from many subjects, so no subject returns one.
 * Each returns only the parts it owns, and the shot merges them. That is what
 * lets a group be its clusters and a village be its buildings without any of
 * them knowing they were composed.
 *
 * Every field is optional because most subjects fill one or two. A prop
 * standing in the background contributes world geometry and nothing else; a
 * performer contributes an actor and its clips; a formation contributes compact
 * cues that the engine expands from count, layout, anchor, facing, and seed
 * rather than into per-member nodes.
 *
 * @evidence requirements/product/capability-and-content.md#product-project-owned-content Keeps every artifact a project-authored subject owns separate from the shot assembled from many subjects.
 * @evidence specifications/authoring-and-authority/capability-and-content-boundary.md#spec-authoring-capability-input-output Defines the optional plain-data outputs through which a subject hands its authored models, motion, world state, and effects to compilation.
 */
export interface IAutoMovieSubjectContribution {
  /**
   * Source-authored models this subject makes available to the shot.
   *
   * @evidence requirements/product/capability-and-content.md#product-project-owned-content Preserves the exact model records the project chose for this subject instead of substituting an engine catalogue.
   * @evidence specifications/authoring-and-authority/capability-and-content-boundary.md#spec-authoring-capability-input-output Makes source-authored models an explicit subject output available to the shot compiler.
   */
  models?: readonly IAutoMovieModel[];
  /**
   * Static visible placements this subject adds to the staged set.
   *
   * @evidence requirements/product/capability-and-content.md#product-project-owned-content Retains the project's visible set placements as subject-owned content rather than deriving scenery from a subject name.
   * @evidence specifications/authoring-and-authority/capability-and-content-boundary.md#spec-authoring-capability-input-output Exposes static set pieces as explicit output for deterministic shot assembly.
   */
  set?: readonly IAutoMovieStageSetPiece[];
  /**
   * Locomotion spaces this subject contributes for later deterministic merge.
   *
   * @evidence requirements/product/capability-and-content.md#product-project-owned-content Preserves the locomotion spaces authored for this subject without an engine-selected environment preset.
   * @evidence specifications/authoring-and-authority/capability-and-content-boundary.md#spec-authoring-capability-input-output Passes traversable space records explicitly into the merged shot input.
   */
  spaces?: readonly IAutoMovieSpace[];
  /**
   * Structured buildings retained for spatial queries and evidence.
   *
   * @evidence requirements/product/capability-and-content.md#product-project-owned-content Retains the project's structured building identities and authored facts beside their visible representation.
   * @evidence specifications/authoring-and-authority/capability-and-content-boundary.md#spec-authoring-capability-input-output Makes built-environment records explicit compiler input for spatial queries and evidence checks.
   */
  builtEnvironments?: readonly IAutoMovieBuiltEnvironment[];
  /**
   * Observation documents the building source read, carried as provenance.
   *
   * A reading is not a design. These travel beside the building so the compiler
   * can hold each one against the bytes it claims to have observed, and they
   * never become geometry on their own.
   *
   * @evidence requirements/product/capability-and-content.md#product-project-owned-content Preserves the project's source observations as provenance without converting those observations into authored geometry.
   * @evidence specifications/authoring-and-authority/capability-and-content-boundary.md#spec-authoring-capability-input-output Carries reference observations beside the building output so compilation can verify the bytes each reference claims to describe.
   */
  designReferences?: readonly IAutoMovieDesignReference[];
  /**
   * Citations from authored design members back to those observations.
   *
   * @evidence requirements/product/capability-and-content.md#product-project-owned-content Preserves the project's citations from authored design members to the observations that justify them.
   * @evidence specifications/authoring-and-authority/capability-and-content-boundary.md#spec-authoring-capability-input-output Exposes member-to-reference evidence as explicit output rather than inferring support from co-location.
   */
  designEvidence?: readonly IAutoMovieDesignEvidence[];
  /**
   * Phase, alternative and change-impact lineage over those same identities.
   *
   * @evidence requirements/product/capability-and-content.md#product-project-owned-content Retains project-authored phase, alternative, and change-impact lineage over stable design identities.
   * @evidence specifications/authoring-and-authority/capability-and-content-boundary.md#spec-authoring-capability-input-output Passes design lineage as a declared output instead of reconstructing history from the current geometry.
   */
  designLineages?: readonly IAutoMovieDesignLineage[];
  /**
   * Independent deterministic fluid domains this subject declares.
   *
   * @evidence requirements/product/capability-and-content.md#product-project-owned-content Preserves the fluid domains and parameters the project selected for this subject.
   * @evidence specifications/authoring-and-authority/capability-and-content-boundary.md#spec-authoring-capability-input-output Makes independent fluid-domain declarations explicit simulation input.
   */
  fluidDomains?: readonly IAutoMovieFluidDomain[];
  /**
   * Cloth and cushion domains this subject declares.
   *
   * @evidence requirements/product/capability-and-content.md#product-project-owned-content Preserves the cloth and cushion domains authored by the project for this subject.
   * @evidence specifications/authoring-and-authority/capability-and-content-boundary.md#spec-authoring-capability-input-output Supplies soft-body domains as explicit solver input rather than inferring deformation from appearance.
   */
  softBodyDomains?: readonly IAutoMovieSoftBodyDomain[];
  /**
   * Bindings that hang those domains on a building's own elements.
   *
   * @evidence requirements/product/capability-and-content.md#product-project-owned-content Retains each project-authored binding between a soft domain and its owning building element.
   * @evidence specifications/authoring-and-authority/capability-and-content-boundary.md#spec-authoring-capability-input-output Emits furnishing attachments as explicit relationship records consumed during assembly.
   */
  softFurnishings?: readonly IAutoMovieSoftFurnishing[];
  /**
   * Growth recipes for the planting this subject declares.
   *
   * @evidence requirements/product/capability-and-content.md#product-project-owned-content Preserves the project's chosen planting and growth recipes without supplying a built-in species catalogue.
   * @evidence specifications/authoring-and-authority/capability-and-content-boundary.md#spec-authoring-capability-input-output Carries authored planting-domain rules as explicit inputs to deterministic growth resolution.
   */
  plantingDomains?: readonly IAutoMoviePlantingDomain[];
  /**
   * Arrangements those recipes are grown into.
   *
   * @evidence requirements/product/capability-and-content.md#product-project-owned-content Retains the arrangements into which the project's planting recipes are grown.
   * @evidence specifications/authoring-and-authority/capability-and-content-boundary.md#spec-authoring-capability-input-output Provides cluster placement and membership as explicit authored output.
   */
  plantingClusters?: readonly IAutoMoviePlantingCluster[];
  /**
   * Bindings that plant those clusters in a building's own spaces.
   *
   * @evidence requirements/product/capability-and-content.md#product-project-owned-content Preserves project-authored bindings from planting clusters to the building spaces that host them.
   * @evidence specifications/authoring-and-authority/capability-and-content-boundary.md#spec-authoring-capability-input-output Emits planting installation relationships explicitly for building and site assembly.
   */
  plantingInstallations?: readonly IAutoMoviePlantingInstallation[];
  /**
   * Port networks that serve the buildings this subject stages.
   *
   * @evidence requirements/product/capability-and-content.md#product-project-owned-content Retains the ports and connectivity the project declared for services supporting this subject's buildings.
   * @evidence specifications/authoring-and-authority/capability-and-content-boundary.md#spec-authoring-capability-input-output Supplies service-network topology as explicit output for later validation and staging.
   */
  serviceNetworks?: readonly IAutoMovieServiceNetwork[];
  /**
   * Bindings that make those domains a building's own water features.
   *
   * @evidence requirements/product/capability-and-content.md#product-project-owned-content Preserves the project's bindings between water domains and the building elements they occupy.
   * @evidence specifications/authoring-and-authority/capability-and-content-boundary.md#spec-authoring-capability-input-output Exposes water-feature relationships as authored input to compilation instead of deriving them from geometry.
   */
  waterFeatures?: readonly IAutoMovieWaterFeature[];
  /**
   * Source-owned semantic props retained beside their staged placements.
   *
   * @evidence requirements/product/capability-and-content.md#product-project-owned-content Retains source-owned prop semantics beside the project's visible prop placements.
   * @evidence specifications/authoring-and-authority/capability-and-content-boundary.md#spec-authoring-capability-input-output Makes semantic prop records explicit compiler input rather than inferring meaning from a mesh.
   */
  props?: readonly IAutoMoviePropSpec[];
  /**
   * Articulated performers this subject stages.
   *
   * @evidence requirements/product/capability-and-content.md#product-project-owned-content Preserves the articulated performers the project selected and programmed for this subject.
   * @evidence specifications/authoring-and-authority/capability-and-content-boundary.md#spec-authoring-capability-input-output Hands actor programs to shot compilation as explicit subject output.
   */
  actors?: readonly IAutoMovieShotActorProgram[];
  /**
   * Source-computed clips cited by explicit `enact` actions.
   *
   * @evidence requirements/product/capability-and-content.md#product-project-owned-content Preserves source-computed motions chosen by the project instead of replacing them with named engine actions.
   * @evidence specifications/authoring-and-authority/capability-and-content-boundary.md#spec-authoring-capability-input-output Exposes motion clips as explicit output that actor `enact` actions can reference by identity.
   */
  clips?: readonly IAutoMovieMotion[];
  /**
   * Compact formation-level cues.
   *
   * @evidence requirements/product/capability-and-content.md#product-project-owned-content Retains the project's compact group-motion cues without expanding them into authored per-member nodes.
   * @evidence specifications/authoring-and-authority/capability-and-content-boundary.md#spec-authoring-capability-input-output Supplies formation-level motion as an explicit compact input to deterministic expansion.
   */
  formationMotions?: readonly IAutoMovieFormationMotion[];
  /**
   * Sparse per-member exceptions inside the formations this subject stages.
   *
   * @evidence requirements/product/capability-and-content.md#product-project-owned-content Preserves project-authored motion exceptions for identified formation slots without duplicating the whole population.
   * @evidence specifications/authoring-and-authority/capability-and-content-boundary.md#spec-authoring-capability-input-output Carries sparse member overrides separately from the group-motion input they refine.
   */
  formationSlotMotions?: readonly IAutoMovieFormationSlotMotion[];
  /**
   * Bounded shot-local deterministic effect cues.
   *
   * @evidence requirements/product/capability-and-content.md#product-project-owned-content Retains the bounded shot-local effect cues the project authored for this subject.
   * @evidence specifications/authoring-and-authority/capability-and-content-boundary.md#spec-authoring-capability-input-output Passes effect timing and parameters explicitly into shot assembly.
   */
  effectCues?: readonly IAutoMovieShotEffectCue[];
  /**
   * Named points this subject contributes to the world.
   *
   * @evidence requirements/product/capability-and-content.md#product-project-owned-content Preserves the named world points and identities the project assigned to this subject.
   * @evidence specifications/authoring-and-authority/capability-and-content-boundary.md#spec-authoring-capability-input-output Exposes landmarks as explicit spatial output for routing, framing, and validation.
   */
  landmarks?: readonly IAutoMovieWorldLandmark[];
  /**
   * Queryable surfaces this subject contributes to the world.
   *
   * @evidence requirements/product/capability-and-content.md#product-project-owned-content Preserves the queryable terrain and support surfaces authored as part of this subject.
   * @evidence specifications/authoring-and-authority/capability-and-content-boundary.md#spec-authoring-capability-input-output Supplies surface footprints, height rules, and traversal state as explicit world input.
   */
  surfaces?: readonly IAutoMovieWorldSurface[];
  /**
   * Named routes this subject contributes to the world.
   *
   * @evidence requirements/product/capability-and-content.md#product-project-owned-content Retains the named routes and waypoints the project chose for this subject's world contribution.
   * @evidence specifications/authoring-and-authority/capability-and-content-boundary.md#spec-authoring-capability-input-output Makes route geometry and formation clearance explicit output for downstream traversal checks.
   */
  routes?: readonly IAutoMovieWorldRoute[];
  /**
   * Deterministic effect recipes this subject declares.
   *
   * @evidence requirements/product/capability-and-content.md#product-project-owned-content Preserves the deterministic effect recipes authored by the project for this subject.
   * @evidence specifications/authoring-and-authority/capability-and-content-boundary.md#spec-authoring-capability-input-output Makes reusable effect rules explicit input instead of embedding them inside shot execution.
   */
  effectRecipes?: readonly IAutoMovieEffectRecipe[];
  /**
   * Deterministic effect regions this subject occupies.
   *
   * @evidence requirements/product/capability-and-content.md#product-project-owned-content Retains the project-authored world regions in which this subject's deterministic effects apply.
   * @evidence specifications/authoring-and-authority/capability-and-content-boundary.md#spec-authoring-capability-input-output Passes effect extent and identity as explicit spatial input to compilation.
   */
  effectZones?: readonly IAutoMovieWorldEffectZone[];
  /**
   * Compact populations this subject materializes.
   *
   * **No shot consumes this.** `IAutoMovieShotProgram` carries no
   * `instanceSets`, so the only route a compact population takes into a
   * compiled artifact is the production's shared `world.instanceSets`. A
   * subject may state one, a shot may stage that subject, and the population
   * will not appear.
   *
   * Said here rather than left to be discovered, because the shape invites the
   * mistake: the field exists on this contribution, so scene-local scenery —
   * the debris of one engagement, onlookers present for one beat, a baggage
   * park that stands in a single shot — reads as authorable per subject and is
   * not. It is also one reason parallel scene authorship converges on the
   * singleton world: scenery has nowhere else to go, so every author writes
   * into one registry and the integrator serializes them by hand.
   *
   * What would consume it is a shot program able to carry compact populations
   * of its own. That is an addition to the authoring surface rather than a
   * correction here, so until it exists, declare the population in the world
   * design and accept that it stands for the whole production.
   *
   * @evidence requirements/product/capability-and-content.md#product-project-owned-content Preserves compact project-authored populations without replacing them with engine-supplied catalogue entries.
   * @evidence specifications/authoring-and-authority/capability-and-content-boundary.md#spec-authoring-capability-input-output Supplies prototype, layout, variation, count, and seed as explicit instance-set output.
   */
  instanceSets?: readonly IAutoMovieInstanceSetDesign[];
}

const CONTRIBUTION_KEYS = [
  "models",
  "set",
  "spaces",
  "builtEnvironments",
  "designReferences",
  "designEvidence",
  "designLineages",
  "fluidDomains",
  "softBodyDomains",
  "softFurnishings",
  "plantingDomains",
  "plantingClusters",
  "plantingInstallations",
  "serviceNetworks",
  "waterFeatures",
  "props",
  "actors",
  "clips",
  "formationMotions",
  "formationSlotMotions",
  "effectCues",
  "landmarks",
  "surfaces",
  "routes",
  "effectRecipes",
  "effectZones",
  "instanceSets",
] as const;

/**
 * Merge what several subjects contribute into one contribution.
 *
 * Order is the order given, so a group that lists its members in a stable order
 * merges to the same bytes every run. Nothing is deduplicated: two subjects
 * claiming the same id is a defect for the compiler's own uniqueness checks to
 * report, and silently collapsing it here would hide the collision from the
 * gate that owns it.
 *
 * @evidence requirements/product/capability-and-content.md#product-project-owned-content Preserves every project-owned subject artifact in authored order without deduplicating identities or choosing replacement content.
 * @evidence specifications/authoring-and-authority/capability-and-content-boundary.md#spec-authoring-capability-input-output Combines only explicitly present contribution arrays and leaves collision decisions visible to the compiler that owns validation.
 */
export const mergeAutoMovieSubjectContributions = (
  contributions: readonly IAutoMovieSubjectContribution[],
): IAutoMovieSubjectContribution => {
  const merged: {
    -readonly [K in keyof IAutoMovieSubjectContribution]: Array<
      NonNullable<IAutoMovieSubjectContribution[K]>[number]
    >;
  } = {};
  for (const contribution of contributions)
    for (const key of CONTRIBUTION_KEYS) {
      const values = contribution[key];
      if (values === undefined || values.length === 0) continue;
      const bucket = (merged[key] ??= []);
      for (const value of values) bucket.push(value as never);
    }
  return merged;
};

/**
 * One thing in a production: a performer, a prop, a place, or a population.
 *
 * A subject owns four obligations that were previously scattered. Its
 * constraints are checked where it is built rather than asserted in a comment;
 * its motions are methods rather than strings in a `capabilities` array; its
 * utilities answer questions about it rather than living as free functions the
 * caller has to locate; and its `render` states what it puts into a shot.
 *
 * `design` is the wire. A class is an authoring surface and never reaches the
 * compile sandbox, so everything the compiler stores and validates leaves
 * through this one method as the plain record it already understands. Two
 * constructions with the same inputs must produce byte-identical records, which
 * is what keeps the same design compiling to the same frames.
 *
 * Utilities delegate to the engine functions that already compute their
 * answers. Reimplementing that arithmetic here would produce a second answer
 * that can disagree with the first, which is the failure mode the whole
 * one-owner rule exists to prevent.
 *
 * @evidence requirements/product/capability-and-content.md#product-project-owned-content Gives a project-authored performer, prop, place, or population one identity, portable design record, and shot contribution contract.
 * @evidence specifications/authoring-and-authority/capability-and-content-boundary.md#spec-authoring-capability-input-output Separates the source class used for authoring from the plain design and contribution outputs consumed by compilation.
 */
export abstract class AutoMovieSubject<TDesign> {
  /**
   * Stable identity this subject is cited by.
   *
   * @evidence requirements/product/capability-and-content.md#product-project-owned-content Requires every project-authored subject to expose the stable identity by which story, design, and shot records cite it.
   * @evidence specifications/authoring-and-authority/capability-and-content-boundary.md#spec-authoring-capability-input-output Takes subject identity from the authoring source instead of deriving it from class names or construction order.
   */
  public abstract readonly id: string;

  /**
   * The tracked record the compiler reads, derived rather than transcribed.
   *
   * @evidence requirements/product/capability-and-content.md#product-project-owned-content Converts the project's subject construction into the plain tracked record that preserves its authored choices.
   * @evidence specifications/authoring-and-authority/capability-and-content-boundary.md#spec-authoring-capability-input-output Defines the portable design output that crosses from authoring classes into validation and compilation.
   */
  public abstract design(): TDesign;

  /**
   * What this subject puts into a shot.
   *
   * The context carries the compiler-owned runtime facts a source cannot infer,
   * so a subject reads its model, skeleton, or formation runtime from there
   * rather than restating them.
   *
   * @evidence requirements/product/capability-and-content.md#product-project-owned-content Returns only the project-owned artifacts this subject adds to a shot, using compiler context for runtime facts it cannot author.
   * @evidence specifications/authoring-and-authority/capability-and-content-boundary.md#spec-authoring-capability-input-output Defines the explicit contribution output through which source-authored content enters shot assembly.
   */
  public abstract render(
    context: IAutoMovieShotBuildContext,
  ): IAutoMovieSubjectContribution;
}

/**
 * A subject that is a collection of subjects.
 *
 * A cluster holds figures, a group holds clusters, a village holds buildings, a
 * map holds everything standing on it. The shape is the same at every level,
 * which is what makes a line battle authorable: a group advancing is one call
 * rather than two thousand.
 *
 * `render` composes its members by default, so a group states what it holds and
 * how it is arranged, not how to draw it. A group that needs to add something
 * of its own (a banner, a dust cue, a shared route) overrides `render` and
 * merges its own contribution with `super.render`, rather than replacing what
 * its members said.
 *
 * @evidence requirements/product/capability-and-content.md#product-project-owned-content Lets a project compose clusters, groups, villages, and maps from its own subjects without an engine-supplied named collection.
 * @evidence specifications/authoring-and-authority/capability-and-content-boundary.md#spec-authoring-capability-input-output Treats a group as an authoring composition whose output remains the same plain subject-contribution boundary.
 * @evidence requirements/asset-authoring/external-assets.md#asset-external-group-composition `AutoMovieSubjectGroup` composes external and local subject contributions under one explicit parent while preserving each member's authored payload and stable order.
 * @evidence requirements/external-inputs/adoption-modes-and-composition.md#external-adoption-group-composition `AutoMovieSubjectGroup` preserves member identity and contribution boundaries when imported and project-native subjects are composed into a higher-level group.
 * @evidence specifications/asset-and-representation/alternatives-instances-and-groups.md#asset-spec-external-adoption-alternatives The group supplies the composition subset of external adoption without flattening member outputs or choosing an adoption mode.
 * @evidence specifications/interchange-and-adoption/adoption-decisions-and-composition.md#interchange-group-composition-boundary Stable member traversal and contribution merging implement the normalized group-composition boundary without parsing external containers.
 */
export abstract class AutoMovieSubjectGroup<
  TDesign,
  TMember extends AutoMovieSubject<unknown>,
> extends AutoMovieSubject<TDesign> {
  /**
   * The subjects this group holds, in a stable order.
   *
   * @evidence requirements/product/capability-and-content.md#product-project-owned-content Exposes the exact project-selected subjects held by the group in the stable order used for composition.
   * @evidence specifications/authoring-and-authority/capability-and-content-boundary.md#spec-authoring-capability-input-output Makes group membership an explicit authoring output rather than discovering members from global state.
   */
  public abstract members(): readonly TMember[];

  /**
   * Merge every member's authored contribution in stable member order.
   *
   * @evidence requirements/product/capability-and-content.md#product-project-owned-content Preserves every member's project-owned payload while composing the group in stable source order.
   * @evidence specifications/authoring-and-authority/capability-and-content-boundary.md#spec-authoring-capability-input-output Emits one plain contribution assembled only from the explicit outputs of its member subjects.
   */
  public render(
    context: IAutoMovieShotBuildContext,
  ): IAutoMovieSubjectContribution {
    return mergeAutoMovieSubjectContributions(
      this.members().map((member) => member.render(context)),
    );
  }
}
