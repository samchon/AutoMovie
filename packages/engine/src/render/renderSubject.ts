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

import { compareAutoMovieRenderIds } from "./renderDigest";

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
 * One conversion is the point: every evidence path reading its subject here
 * would measure the same artifact. The test suite is currently the only caller,
 * so that is a property of the signature and not of the pipeline. It becomes a
 * property of the pipeline when the inventory path and the capture path both
 * take their subject from this call instead of assembling one each.
 *
 * Simulated drawables and texture dimensions are not carried by the compiled
 * shot yet and are supplied by the caller, which is why they are separate
 * arguments rather than silently defaulted to empty inside a report that would
 * then read as complete.
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
 * Read a compiled shot as the complete drawable world one frame commits to.
 *
 * {@link autoMovieRenderSubjectOfShot} leaves the simulated drawables to its
 * caller, because it was written while the compiled shot carried none. It
 * carries them now: the artifact holds every fluid, cloth and planting domain
 * beside the bindings that place them, and this is the one conversion that
 * reads both. Anywhere else, and the colour a pond is painted in the mask and
 * the cost a report prices for it would come from two different readings of one
 * artifact.
 *
 * Every declared domain becomes one drawable, bound or not. A fluid domain no
 * water feature claims is still a free surface somebody staged, and a palette
 * that skipped it would have no colour to notice its absence with; what the
 * binding adds is the owning space, which is how a colour resolves to a room.
 *
 * Branch and leaf prototype costs stay `null` on purpose. The solid a renderer
 * sweeps along a branch is the renderer's own choice and is in no compiled
 * record, so the geometry metrics report `not-run` rather than approve a
 * triangle count this repository invented.
 *
 * @author Samchon
 */
export const autoMovieRenderSubjectOfCompiledShot = (props: {
  /** Fully compiler-owned shot artifact. */
  compiled: IAutoMovieCompiledShotSource;
  /** Known texture dimensions, if the caller resolved the assets. */
  textures?: readonly IAutoMovieRenderTextureSource[];
}): IAutoMovieRenderSubject => {
  const { compiled } = props;
  const waterOwner = bindingOf(
    compiled.waterFeatures ?? [],
    (feature) => feature.domain,
  );
  const softOwner = bindingOf(
    compiled.softFurnishings ?? [],
    (furnishing) => furnishing.domain,
  );
  const plantingOwner = bindingOf(
    compiled.plantingInstallations ?? [],
    (installation) => installation.cluster,
  );
  const recipes = new Map(
    (compiled.plantingDomains ?? []).map((domain) => [domain.id, domain]),
  );
  return autoMovieRenderSubjectOfShot({
    compiled,
    textures: props.textures,
    waterBodies: (compiled.fluidDomains ?? []).map((domain) => {
      const feature = waterOwner.get(domain.id);
      return {
        id: domain.id,
        owner: spaceOwner(feature?.environment, feature?.space),
        // The bound domain draws its own free surface, which the mask joins by
        // the viewer's name for it. Naming a scene node here as well would bill
        // the same water twice.
        nodes: [],
        domain,
        cells: null,
        particles: null,
        material: feature?.material ?? null,
      };
    }),
    softBodies: (compiled.softBodyDomains ?? []).map((domain) => {
      const furnishing = softOwner.get(domain.id);
      return {
        domain,
        owner: spaceOwner(furnishing?.environment, furnishing?.space),
        material: furnishing?.material ?? null,
      };
    }),
    plantings: (compiled.plantingClusters ?? []).map((cluster) => {
      const domain = recipes.get(cluster.domain);
      if (domain === undefined)
        throw new Error(
          `render subject cannot stage planting cluster "${cluster.id}": recipe "${cluster.domain}" is absent from the compiled shot`,
        );
      const installation = plantingOwner.get(cluster.id);
      return {
        domain,
        cluster,
        owner: spaceOwner(installation?.environment, installation?.space),
        branchMaterial: installation?.branchMaterial ?? null,
        leafMaterial: installation?.leafMaterial ?? null,
        branch: null,
        leaf: null,
      };
    }),
  });
};

/**
 * Index one binding list by the drawable it places, keeping the smallest id.
 *
 * Two bindings naming one drawable is an authoring contradiction the compiler
 * refuses, but the subject still has to be a function of the design rather than
 * of array order, or two runs of the same shot would attribute one pond to two
 * rooms and derive two different palettes for one frame.
 */
const bindingOf = <Entry extends { id: string }>(
  entries: readonly Entry[],
  drawable: (entry: Entry) => string,
): Map<string, Entry> => {
  const index = new Map<string, Entry>();
  for (const entry of [...entries].sort((left, right) =>
    compareAutoMovieRenderIds(left.id, right.id),
  ))
    if (!index.has(drawable(entry))) index.set(drawable(entry), entry);
  return index;
};

/** The semantic id of the building space a binding hangs its drawable in. */
const spaceOwner = (
  environment: string | undefined,
  space: string | undefined,
): string | null =>
  environment === undefined || space === undefined
    ? null
    : `space:${environment}/${space}`;

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
