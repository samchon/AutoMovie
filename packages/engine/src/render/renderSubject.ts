import {
  IAutoMovieBuiltEnvironment,
  IAutoMovieCompiledInstanceSet,
  IAutoMovieCompiledShotSource,
  IAutoMovieFluidDomain,
  IAutoMovieModel,
  IAutoMoviePlantingCluster,
  IAutoMoviePlantingDomain,
  IAutoMovieScene,
  IAutoMovieSoftBodyDomain,
} from "@automovie/interface";

/**
 * Everything one drawn frame is made of, in one record.
 *
 * The semantic mask and the render inventory read the same subject, which is
 * the only reason a colour in the mask and a cost in the report can name the
 * same owner. Two functions that each reached into the compiled artifact their
 * own way would drift the first time one of them learned about a new kind of
 * drawable, and the report's owner ids would stop resolving in the mask without
 * anything going red.
 *
 * @author Samchon
 */
export interface IAutoMovieRenderSubject {
  /** Staged scene: ordinary nodes, lights, and the render environment. */
  scene: IAutoMovieScene;

  /** Every runtime model cited by a scene node or an instance prototype. */
  models: readonly IAutoMovieModel[];

  /** Structured buildings retained by the compiled shot, if any. */
  environments?: readonly IAutoMovieBuiltEnvironment[];

  /** Compact general instance runtimes placed by the production world. */
  instanceSets?: readonly IAutoMovieCompiledInstanceSet[];

  /**
   * Water bodies the production declares.
   *
   * A body bound to a {@link IAutoMovieRenderWaterBody.domain fluid domain} is
   * measured from that record; one carrying only hand-supplied counts is taken
   * at its word; one carrying neither makes the fluid metrics `unsupported`
   * rather than zero.
   */
  waterBodies?: readonly IAutoMovieRenderWaterBody[];

  /**
   * Cloth panels the production hangs.
   *
   * A soft-body panel is drawn geometry that no scene node holds, so a subject
   * that omitted it would report a triangle count for a room the curtain is
   * missing from. The panel's cost is a property of the domain's lattice alone
   * and needs no solve: the drawn mesh is one vertex per particle and two
   * triangles per lattice quad at every step.
   */
  softBodies?: readonly IAutoMovieRenderSoftPanel[];

  /**
   * Planting clusters the production grows.
   *
   * Like a panel, a bed of ferns is drawn geometry no scene node holds; unlike
   * a panel, its per-instance shape is chosen by the renderer, which is why the
   * batching cost is exact here and the geometry cost is only as exact as the
   * {@link IAutoMovieRenderPlanting.branch prototype cost} the caller supplies.
   */
  plantings?: readonly IAutoMovieRenderPlanting[];

  /**
   * Decoded dimensions of texture assets, when the caller knows them.
   *
   * An asset a material binds but this list omits makes `textureBytes`
   * `not-run`: an invented byte count is exactly the kind of number a budget
   * would then approve.
   */
  textures?: readonly IAutoMovieRenderTextureSource[];
}

/** One declared water body and whatever a solver has proved about it. */
export interface IAutoMovieRenderWaterBody {
  /** Stable water-body id. */
  id: string;

  /** Semantic id of the owning building space, or `null` when unowned. */
  owner: string | null;

  /**
   * Scene node ids that draw the water surface, if any.
   *
   * These are ordinary staged nodes and are already counted as such, so a body
   * drawn by a bound {@link domain}'s own free surface names none here: listing
   * both would bill the same water twice.
   */
  nodes: string[];

  /**
   * The shallow-water domain filling this body, or `null` when none exists.
   *
   * When present it is authoritative and {@link cells} and {@link particles} are
   * ignored: the grid states the cell count exactly and the emitters state the
   * particle cap, so a number derived from the record cannot drift from the
   * record the way a hand-copied one does. It also carries the drawn free
   * surface, one vertex per cell, into the geometry metrics.
   */
  domain: IAutoMovieFluidDomain | null;

  /**
   * Simulation cell count proved by a solver outside this repository, or `null`
   * when none ran. Ignored when {@link domain} is present.
   */
  cells: number | null;

  /** Live particle count proved by such a solver, or `null` when none ran. */
  particles: number | null;

  /**
   * Material id the free surface is drawn with, or `null` for the renderer's
   * own default. Ignored when {@link domain} is `null`, because a body with no
   * domain draws no surface of its own here.
   */
  material: string | null;
}

/** One cloth panel drawn from a soft-body domain. */
export interface IAutoMovieRenderSoftPanel {
  /** The domain whose lattice is drawn as one panel. */
  domain: IAutoMovieSoftBodyDomain;

  /** Semantic id of the owning building space, or `null` when unowned. */
  owner: string | null;

  /** Material id the panel is drawn with, or `null` for the default. */
  material: string | null;
}

/** One planting cluster drawn as instanced branch and leaf batches. */
export interface IAutoMovieRenderPlanting {
  /** The recipe every member of the cluster instances. */
  domain: IAutoMoviePlantingDomain;

  /** The cluster placing the members. */
  cluster: IAutoMoviePlantingCluster;

  /** Semantic id of the owning building space, or `null` when unowned. */
  owner: string | null;

  /** Material id of the branch batch, or `null` for the default. */
  branchMaterial: string | null;

  /** Material id of the leaf batch, or `null` for the default. */
  leafMaterial: string | null;

  /**
   * Drawn cost of one branch instance, or `null` when the caller did not state
   * it.
   *
   * A branch is drawn as whatever solid the renderer chooses to sweep along it,
   * and that choice is not in the recipe: the same derived plant is a six-sided
   * tube in one viewer and a twenty-sided one in another. So the engine refuses
   * to invent a number here, exactly as it refuses to invent texture bytes, and
   * an absent cost makes the geometry metrics `not-run` while the batching
   * metrics stay exact.
   */
  branch: IAutoMovieRenderPrototypeCost | null;

  /**
   * Drawn cost of one leaf instance, or `null` when the caller did not state
   * it. A recipe bearing no leaves draws no leaf batch, so its absence costs
   * nothing and reports no gap.
   */
  leaf: IAutoMovieRenderPrototypeCost | null;
}

/** What one instance of a renderer-chosen prototype costs to draw. */
export interface IAutoMovieRenderPrototypeCost {
  /** Exact vertex count of one instance; a non-negative integer. */
  vertices: number;

  /** Exact triangle count of one instance; a non-negative integer. */
  triangles: number;
}

/** One texture asset's decoded size, used to estimate device memory. */
export interface IAutoMovieRenderTextureSource {
  /** Project asset id, as a material binding cites it. */
  asset: string;

  /** Decoded width in pixels, a positive integer. */
  width: number;

  /** Decoded height in pixels, a positive integer. */
  height: number;

  /**
   * Whether the renderer uploads a full mip chain. A mipmapped 2D texture costs
   * four thirds of its base level, the geometric series `1 + 1/4 + ...` summed
   * over the chain.
   */
  mipmapped: boolean;
}

/**
 * Read a compiled shot as a render subject.
 *
 * One conversion, so every evidence path measures the same artifact. Simulated
 * drawables and texture dimensions are not carried by the compiled shot yet and
 * are supplied by the caller, which is why they are separate arguments rather
 * than silently defaulted to empty inside a report that would then read as
 * complete.
 */
export const autoMovieRenderSubjectOfShot = (props: {
  /** Fully compiler-owned shot artifact. */
  compiled: IAutoMovieCompiledShotSource;
  /** Declared water bodies, if the production has any. */
  waterBodies?: readonly IAutoMovieRenderWaterBody[];
  /** Declared cloth panels, if the production has any. */
  softBodies?: readonly IAutoMovieRenderSoftPanel[];
  /** Declared planting clusters, if the production has any. */
  plantings?: readonly IAutoMovieRenderPlanting[];
  /** Known texture dimensions, if the caller resolved the assets. */
  textures?: readonly IAutoMovieRenderTextureSource[];
}): IAutoMovieRenderSubject => ({
  scene: props.compiled.scene,
  models: props.compiled.models,
  environments: props.compiled.builtEnvironments ?? [],
  instanceSets: props.compiled.instanceSets,
  waterBodies: props.waterBodies ?? [],
  softBodies: props.softBodies ?? [],
  plantings: props.plantings ?? [],
  textures: props.textures ?? [],
});

/**
 * Name of the viewer object drawing one soft-body panel.
 *
 * Mirrors `buildSoftBodyObject`. The engine cannot import the viewer and the
 * mask has to be derivable without a renderer, so the names both sides agree on
 * live here and are asserted by the test suite, exactly as the standable
 * ground's group name is.
 */
export const autoMovieSoftBodyNodeName = (domain: string): string =>
  `soft:${domain}`;

/** Name of the viewer group drawing one planting cluster's batches. */
export const autoMoviePlantingNodeName = (cluster: string): string =>
  `planting:${cluster}`;

/** Name of the viewer object drawing one fluid domain's free surface. */
export const autoMovieFluidSurfaceNodeName = (domain: string): string =>
  `water:${domain}`;
