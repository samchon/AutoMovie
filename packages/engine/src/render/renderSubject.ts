import {
  IAutoMovieBuiltEnvironment,
  IAutoMovieCompiledInstanceSet,
  IAutoMovieCompiledShotSource,
  IAutoMovieModel,
  IAutoMovieScene,
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
   * The fluid domain itself is not owned here. This is the seam a fluid
   * implementation fills; until one exists, a declared body makes the fluid
   * metrics `unsupported` rather than zero.
   */
  waterBodies?: readonly IAutoMovieRenderWaterBody[];

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

  /** Scene node ids that draw the water surface, if any. */
  nodes: string[];

  /**
   * Simulation cell count proved by a solver, or `null` when no solver ran.
   *
   * `null` is the honest state today: no fluid solver is integrated, so this
   * stays absent and the fluid metrics report `unsupported`.
   */
  cells: number | null;

  /** Live particle count proved by a solver, or `null` when none ran. */
  particles: number | null;
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
 * One conversion, so every evidence path measures the same artifact. Water
 * bodies and texture dimensions are not carried by the compiled shot yet and
 * are supplied by the caller, which is why they are separate arguments rather
 * than silently defaulted to empty inside a report that would then read as
 * complete.
 */
export const autoMovieRenderSubjectOfShot = (props: {
  /** Fully compiler-owned shot artifact. */
  compiled: IAutoMovieCompiledShotSource;
  /** Declared water bodies, if the production has any. */
  waterBodies?: readonly IAutoMovieRenderWaterBody[];
  /** Known texture dimensions, if the caller resolved the assets. */
  textures?: readonly IAutoMovieRenderTextureSource[];
}): IAutoMovieRenderSubject => ({
  scene: props.compiled.scene,
  models: props.compiled.models,
  environments: props.compiled.builtEnvironments ?? [],
  instanceSets: props.compiled.instanceSets,
  waterBodies: props.waterBodies ?? [],
  textures: props.textures ?? [],
});
