import type {
  IAutoMovieBuiltEnvironment,
  IAutoMovieEffectRecipe,
  IAutoMovieFormationMotion,
  IAutoMovieFormationSlotMotion,
  IAutoMovieInstanceSetDesign,
  IAutoMovieModel,
  IAutoMovieMotion,
  IAutoMoviePropSpec,
  IAutoMovieShotActorProgram,
  IAutoMovieShotBuildContext,
  IAutoMovieShotEffectCue,
  IAutoMovieSpace,
  IAutoMovieStageSetPiece,
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
 */
export interface IAutoMovieSubjectContribution {
  /** Source-authored models this subject makes available to the shot. */
  models?: readonly IAutoMovieModel[];
  /** Static visible placements this subject adds to the staged set. */
  set?: readonly IAutoMovieStageSetPiece[];
  /** Locomotion spaces this subject contributes for later deterministic merge. */
  spaces?: readonly IAutoMovieSpace[];
  /** Structured buildings retained for spatial queries and evidence. */
  builtEnvironments?: readonly IAutoMovieBuiltEnvironment[];
  /** Source-owned semantic props retained beside their staged placements. */
  props?: readonly IAutoMoviePropSpec[];
  /** Articulated performers this subject stages. */
  actors?: readonly IAutoMovieShotActorProgram[];
  /** Source-computed clips cited by explicit `enact` actions. */
  clips?: readonly IAutoMovieMotion[];
  /** Compact formation-level cues. */
  formationMotions?: readonly IAutoMovieFormationMotion[];
  /** Sparse per-member exceptions inside the formations this subject stages. */
  formationSlotMotions?: readonly IAutoMovieFormationSlotMotion[];
  /** Bounded shot-local deterministic effect cues. */
  effectCues?: readonly IAutoMovieShotEffectCue[];
  /** Named points this subject contributes to the world. */
  landmarks?: readonly IAutoMovieWorldLandmark[];
  /** Queryable surfaces this subject contributes to the world. */
  surfaces?: readonly IAutoMovieWorldSurface[];
  /** Named routes this subject contributes to the world. */
  routes?: readonly IAutoMovieWorldRoute[];
  /** Deterministic effect recipes this subject declares. */
  effectRecipes?: readonly IAutoMovieEffectRecipe[];
  /** Deterministic effect regions this subject occupies. */
  effectZones?: readonly IAutoMovieWorldEffectZone[];
  /** Compact populations this subject materializes. */
  instanceSets?: readonly IAutoMovieInstanceSetDesign[];
}

const CONTRIBUTION_KEYS = [
  "models",
  "set",
  "spaces",
  "builtEnvironments",
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
 */
export abstract class AutoMovieSubject<TDesign> {
  /** Stable identity this subject is cited by. */
  public abstract readonly id: string;

  /** The tracked record the compiler reads, derived rather than transcribed. */
  public abstract design(): TDesign;

  /**
   * What this subject puts into a shot.
   *
   * The context carries the compiler-owned runtime facts a source cannot infer,
   * so a subject reads its model, skeleton, or formation runtime from there
   * rather than restating them.
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
 */
export abstract class AutoMovieSubjectGroup<
  TDesign,
  TMember extends AutoMovieSubject<unknown>,
> extends AutoMovieSubject<TDesign> {
  /** The subjects this group holds, in a stable order. */
  public abstract members(): readonly TMember[];

  public render(
    context: IAutoMovieShotBuildContext,
  ): IAutoMovieSubjectContribution {
    return mergeAutoMovieSubjectContributions(
      this.members().map((member) => member.render(context)),
    );
  }
}
