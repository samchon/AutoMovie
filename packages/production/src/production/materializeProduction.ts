import {
  materializeCompiledEffects,
  materializeCompiledFormation,
  productionRuntimeModelId,
  productionRuntimeSkeletonId,
  srgbHexToLinearColor,
} from "@automovie/engine";
import {
  AutoMovieContentDigest,
  IAutoMovieBuiltEnvironment,
  IAutoMovieCompiledFormation,
  IAutoMovieCompiledInstanceSet,
  IAutoMovieCompiledShotSource,
  IAutoMovieEnvironmentContext,
  IAutoMovieFormationDesign,
  IAutoMovieGeneratedCollisionProxy,
  IAutoMovieGeneratedMeasurementProxy,
  IAutoMovieLibraryContribution,
  IAutoMovieMaterializedLibrary,
  IAutoMovieMaterializedLibraryOwner,
  IAutoMovieModel,
  IAutoMovieModelRecipe,
  IAutoMovieShotContract,
  IAutoMovieShotSourceOutput,
  IAutoMovieWorldDesign,
} from "@automovie/interface";
import typia from "typia";

import {
  canonicalAutoMovieJsonBytes,
  compareCodeUnits,
  encodeAutoMoviePathSegment,
} from "./contentIdentity";
import { parseAutoMovieStructuredJson } from "./duplicateAwareJson";
import {
  AUTOMOVIE_REGISTERED_ARCHETYPES,
  AutoMovieModelArchetypeRegistry,
} from "./productionArchetypes";

/**
 * Matrix bytes reserved by one slot in one LOD instance buffer.
 */
export const AUTOMOVIE_FORMATION_MATRIX_BYTES =
  16 * Float32Array.BYTES_PER_ELEMENT;

export { productionRuntimeModelId, productionRuntimeSkeletonId };

/**
 * Compiler-resolved external appearance and deterministic proxy semantics.
 */
export interface IAutoMovieExternalModelRuntimeBinding {
  /**
   * Manifest-owned final render asset.
   */
  asset: string;
  /**
   * Fixed normalization profile proved by ingest.
   */
  profile: NonNullable<IAutoMovieModel["imported"]>["profile"];
  /**
   * Exact model LOD identities retained for host selection.
   */
  lod: NonNullable<IAutoMovieModel["imported"]>["lod"];
  /**
   * Compiler-sealed model, sidecar and proxy digest closure.
   */
  assets: NonNullable<IAutoMovieModel["imported"]>["assets"];
  /**
   * Ingest/VRM-owned normalized bone mapping.
   */
  humanoidBones: NonNullable<IAutoMovieModel["imported"]>["humanoidBones"];
  /**
   * Exact collision primitive used by engine geometry and mass queries.
   */
  collision: IAutoMovieGeneratedCollisionProxy;
  /**
   * Exact measurement envelope used by projection and distance queries.
   */
  measurement: IAutoMovieGeneratedMeasurementProxy;
}

/**
 * Materialize every bounded model recipe into deterministic proxy data.
 *
 * External appearances keep only a recipe skeleton proved by ingest mapping,
 * drop unproved semantic profiles, replace visible primitive parts with the
 * registered collision proxy for engine semantics, and bind the final
 * manifest-owned mesh plus its closed byte ledger.
 */
export const materializeProductionModels = (
  recipes: ReadonlyMap<string, IAutoMovieModelRecipe>,
  externalModels: ReadonlyMap<
    string,
    IAutoMovieExternalModelRuntimeBinding
  > = new Map(),
  archetypes: AutoMovieModelArchetypeRegistry = AUTOMOVIE_REGISTERED_ARCHETYPES,
): ReadonlyMap<string, IAutoMovieModel> =>
  new Map(
    [...recipes]
      .sort(([left], [right]) => compareCodeUnits(left, right))
      .map(
        ([id, recipe]) =>
          [
            id,
            materializeModel(recipe, externalModels.get(id), archetypes),
          ] as const,
      ),
  );

/**
 * Add builder-owned models, hero nodes and compact formations to choreography.
 *
 * Anonymous identities remain derived from formation id and slot index and
 * never become a large scene-node array.
 * @evidence specifications/authoring-and-authority/prototype-determinism-and-fidelity.md#spec-authoring-structural-output-invariant Materializes each compiled shot's models, hero nodes and formations into a reviewable runtime form whose proxies stay marked as proxies.
 */
export const materializeCompiledShot = (props: {
  contract: IAutoMovieShotContract;
  formations: ReadonlyMap<string, IAutoMovieFormationDesign>;
  formationRuntime?: Readonly<Record<string, IAutoMovieCompiledFormation>>;
  instanceSetRuntime?: Readonly<Record<string, IAutoMovieCompiledInstanceSet>>;
  modelRecipes?: ReadonlyMap<string, IAutoMovieModelRecipe>;
  runtimeModels: ReadonlyMap<string, IAutoMovieModel>;
  world?: IAutoMovieWorldDesign;
  fps?: number;
  source: IAutoMovieShotSourceOutput;
  /** Member radius in metres keyed by recipe id, for a formation compiled here. */
  projectionRadii?: ReadonlyMap<string, number>;
}): {
  value: IAutoMovieCompiledShotSource;
  collisions: string[];
} => {
  const source = structuredClone(props.source);
  const effects = materializeCompiledEffects({
    contract: props.contract,
    world: props.world,
    fps: props.fps,
    cues: source.effectCues ?? [],
  });
  const nodes = new Map(source.scene.nodes.map((node) => [node.id, node]));
  const collisions: string[] = [];
  const formations: IAutoMovieCompiledFormation[] = [];
  for (const participant of props.contract.participants) {
    if (participant.kind !== "formation") continue;
    const formation = props.formations.get(participant.id);
    if (formation === undefined) continue;
    const compiled =
      props.formationRuntime?.[participant.id] ??
      materializeCompiledFormation({
        formation,
        recipes: props.modelRecipes,
        projectionRadii: props.projectionRadii,
        // The terrain a member stands on, so a unit compiled here rather than
        // taken from the shared inventory is the same unit either way.
        surfaces: props.world?.surfaces,
      });
    const runtimeModel = props.runtimeModels.get(formation.modelRecipe);
    if (runtimeModel === undefined) continue;
    formations.push(compiled);
    const ordinaryPrefix = `formation:${formation.id}:slot:`;
    for (const node of source.scene.nodes) {
      if (node.id.startsWith(ordinaryPrefix) === false) continue;
      const suffix = node.id.slice(ordinaryPrefix.length);
      const slot = Number(suffix);
      if (
        /^\d{6}$/.test(suffix) &&
        Number.isSafeInteger(slot) &&
        slot >= 0 &&
        slot < formation.count &&
        formation.heroOverrides.some((hero) => hero.slot === slot) === false
      )
        collisions.push(node.id);
    }
    for (const hero of compiled.heroes) {
      const existing = nodes.get(hero.actor);
      if (existing !== undefined) {
        existing.model = runtimeModel.id;
        existing.transform = hero.transform;
        continue;
      }
      const node = {
        id: hero.actor,
        model: runtimeModel.id,
        transform: hero.transform,
        motion: null,
        pose: null,
      };
      source.scene.nodes.push(node);
      nodes.set(node.id, node);
    }
  }
  for (const instanceSet of Object.values(props.instanceSetRuntime ?? {})) {
    const ordinaryPrefix = `instance:${instanceSet.id}:slot:`;
    const explicitIds = new Set(
      instanceSet.layout.kind === "explicit"
        ? instanceSet.layout.transforms.map(
            (transform) => `instance:${instanceSet.id}:${transform.id}`,
          )
        : [],
    );
    for (const node of source.scene.nodes) {
      if (explicitIds.has(node.id)) {
        collisions.push(node.id);
        continue;
      }
      if (node.id.startsWith(ordinaryPrefix) === false) continue;
      const suffix = node.id.slice(ordinaryPrefix.length);
      const slot = Number(suffix);
      if (
        /^\d{6}$/.test(suffix) &&
        Number.isSafeInteger(slot) &&
        slot >= 0 &&
        slot < instanceSet.count
      )
        collisions.push(node.id);
    }
  }
  const modelByRuntimeId = new Map(
    [...props.runtimeModels.values()].map((model) => [model.id, model]),
  );
  for (const model of source.authoredModels ?? [])
    modelByRuntimeId.set(model.id, model);
  const models = [
    ...new Set([
      ...source.scene.nodes.map((node) => node.model),
      ...formations.flatMap((formation) =>
        formation.lod.map((lod) => lod.model),
      ),
      ...Object.values(props.instanceSetRuntime ?? {}).flatMap((instanceSet) =>
        (instanceSet.prototypes ?? [{ lod: instanceSet.lod }]).flatMap(
          (prototype) => prototype.lod.map((lod) => lod.model),
        ),
      ),
    ]),
  ]
    .sort(compareCodeUnits)
    .flatMap((id) => {
      const model = modelByRuntimeId.get(id);
      return model === undefined ? [] : [model];
    });
  return {
    value: {
      ...source,
      formationMotions: source.formationMotions ?? [],
      formationSlotMotions: source.formationSlotMotions ?? [],
      effects,
      models,
      formations,
      instanceSets: Object.values(props.instanceSetRuntime ?? {}).sort(
        (left, right) => compareCodeUnits(left.id, right.id),
      ),
    },
    collisions,
  };
};

/**
 * Generated-root path of the builder-owned library index.
 *
 * Exported because the offline observation command opens the same file the
 * builder wrote, and a second spelling of that path is a second answer to
 * where the library's lineage lives.
 *
 */
export const AUTOMOVIE_LIBRARY_INDEX_PATH = "library/index.json";

/**
 * One design owner's executed source result, before it becomes generated bytes.
 *
 * The builder produces these by running library source; this module turns them
 * into the builder-owned files and index a later reader opens. Keeping the two
 * apart is what lets the publication be measured against a hand-built result
 * rather than only against whatever the sandbox happened to return.
 *
 * @author Samchon
 */
export interface IAutoMovieMaterializedLibraryResult {
  /** Active manifest-derived design branch. */
  branch: string;
  /** Exact `docs/<document>.md#<anchor>` address the export registered. */
  owner: string;
  /** Project-relative source file whose export produced the contribution. */
  source: string;
  /** Named export inside that file. */
  export: string;
  /** Digest of the normalized source bytes that were executed. */
  sourceDigest: AutoMovieContentDigest;
  /** Exact validated contribution that export returned. */
  /**
   * What the owner's build function returned, with `contexts` already decided.
   *
   * Definite here where the contract leaves it optional. The builder is this
   * type's only producer and normalizes at the registration boundary, so a
   * second `?? []` on this side would be a branch no run can take -- which is
   * what it became the moment that normalization landed.
   */
  contribution: IAutoMovieLibraryContribution & {
    contexts: IAutoMovieEnvironmentContext[];
  };
}

/**
 * Turn every executed library owner into builder-owned bytes and one index.
 *
 * A library publishes what a film publishes for the two things a film also has
 * and at the same addresses: a model lands under `models/` so the fixed turntable set and
 * the rig test read it exactly as they read a film's, and a built environment
 * lands under `library/environments/` because a film has no equivalent to
 * reuse. The index beside them is the part a film does not need at all: without
 * a shot there is nothing that already says which design decision an artifact
 * belongs to, so the lineage is written down rather than inferred from a
 * filename.
 *
 * The result is a pure function of the executed owners, so a second compile of
 * unchanged source produces the same bytes down to the trailing newline.
 *
 * @evidence requirements/review/subject-inspection.md#review-subject-evidence Publishes each artifact with the owner, source export, and compile identity a receipt is bound to.
 * @evidence specifications/review-and-acceptance/subject-surface-and-inspection.md#review-system-subject-freshness Records the compile identity the published library artifacts were derived at.
 * @author Samchon
 */
export const materializeAutoMovieLibraryFiles = (props: {
  /** Production namespace this library is compiled under. */
  production: string;
  /** Compiler protocol identity recorded in the index. */
  builder: string;
  /** Compiler input identity this publication was derived at. */
  inputFingerprint: AutoMovieContentDigest;
  /** Executed owners in any order; the result is sorted by its own address. */
  results: readonly IAutoMovieMaterializedLibraryResult[];
}): {
  files: ReadonlyMap<string, Uint8Array>;
  index: IAutoMovieMaterializedLibrary;
} => {
  const files = new Map<string, Uint8Array>();
  const put = (file: string, value: unknown): void => {
    files.set(
      file,
      Buffer.concat([
        Buffer.from(canonicalAutoMovieJsonBytes(value)),
        Buffer.from("\n", "utf8"),
      ]),
    );
  };
  const owners = [...props.results]
    .sort((left, right) =>
      compareCodeUnits(
        JSON.stringify([left.branch, left.owner]),
        JSON.stringify([right.branch, right.owner]),
      ),
    )
    .map((result): IAutoMovieMaterializedLibraryOwner => {
      for (const environment of result.contribution.environments)
        put(
          `library/environments/${encodeAutoMoviePathSegment(environment.id)}.json`,
          environment,
        );
      for (const model of result.contribution.models)
        put(`models/${encodeAutoMoviePathSegment(model.id)}.json`, model);
      // Under their own directory rather than beside the environments. A
      // context is not a thing in the world the environments describe; it is
      // the world they are described against, and one adopted context may be
      // the ground several owners' buildings stand on.
      for (const context of result.contribution.contexts)
        put(
          `library/contexts/${encodeAutoMoviePathSegment(context.id)}.json`,
          context,
        );
      return {
        branch: result.branch,
        owner: result.owner,
        source: result.source,
        export: result.export,
        sourceDigest: result.sourceDigest,
        environments: result.contribution.environments
          .map((environment) => environment.id)
          .sort(compareCodeUnits),
        models: result.contribution.models
          .map((model) => model.id)
          .sort(compareCodeUnits),
        contexts: result.contribution.contexts
          .map((context) => context.id)
          .sort(compareCodeUnits),
      };
    });
  const index: IAutoMovieMaterializedLibrary = {
    version: 1,
    builder: props.builder,
    production: props.production,
    inputFingerprint: props.inputFingerprint,
    owners,
  };
  put(AUTOMOVIE_LIBRARY_INDEX_PATH, index);
  return { files, index };
};

/**
 * Reopen the buildings a library compile published, addressed by design owner.
 *
 * The builder answers this from memory while it is running, because the owner
 * it just refused must not be charged observations against a building still on
 * disk from an earlier run. Every other reader is outside that run and has only
 * the tree, so this is how the shipped observation command arrives at the same
 * required population the review gate will derive: through the index the same
 * compile wrote, never by re-executing source or by guessing from a filename.
 *
 * A missing, unreadable, or schema-invalid index yields an empty population
 * rather than throwing. That is the honest answer for a project that has not
 * compiled yet, and the compile gate is what refuses the state itself; a reader
 * that threw here would report a compile problem as an observation problem.
 *
 * @evidence requirements/review/subject-inspection.md#review-subject-viewpoint-ownership Supplies the compiled topology the required viewpoint population is derived from.
 * @evidence specifications/review-and-acceptance/subject-surface-and-inspection.md#review-system-subject-viewpoint-plan Hands the derivation the exact compiled buildings one owner published.
 * @author Samchon
 */
export const autoMovieMaterializedLibraryEnvironments = (props: {
  /** Read one generated-root-relative file, throwing when it is absent. */
  read: (relativePath: string) => Uint8Array;
}): ((request: {
  branch: string;
  owner: string;
  anchor: string;
}) => readonly IAutoMovieBuiltEnvironment[]) =>
  materializedLibraryReader<IAutoMovieBuiltEnvironment>({
    read: props.read,
    select: (owner) => owner.environments,
    file: (id) => `library/environments/${encodeAutoMoviePathSegment(id)}.json`,
    validate: (value) =>
      typia.validateEquals<IAutoMovieBuiltEnvironment>(value),
    what: "environments",
  });

/**
 * Reopen the worlds a library compile published, addressed by design owner.
 *
 * Beside {@link autoMovieMaterializedLibraryEnvironments} and through the same
 * index, because a map owner is measured the way a space owner is: against
 * what it contributed, not against what the production happens to carry. The
 * production design also holds one context for the whole production, and that
 * one belongs to nobody -- two map owners would each owe its every instant, and
 * one adopted world would be paid for twice.
 *
 * @author Samchon
 */
export const autoMovieMaterializedLibraryContexts = (props: {
  /** Read one generated-root-relative file, throwing when it is absent. */
  read: (relativePath: string) => Uint8Array;
}): ((request: {
  branch: string;
  owner: string;
  anchor: string;
}) => readonly IAutoMovieEnvironmentContext[]) =>
  materializedLibraryReader<IAutoMovieEnvironmentContext>({
    read: props.read,
    select: (owner) => owner.contexts,
    file: (id) => `library/contexts/${encodeAutoMoviePathSegment(id)}.json`,
    validate: (value) =>
      typia.validateEquals<IAutoMovieEnvironmentContext>(value),
    what: "contexts",
  });

/**
 * One reading of the published index, for one kind of published artifact.
 *
 * The two readers differ in three values and in nothing else, and the parts
 * they share are the parts that were wrong: the index is keyed by the design
 * owner's full `path#anchor` address, and a request carrying the document path
 * alone matched nothing -- every time, for every owner, in silence. Written
 * twice, that defect would have had two places to be reintroduced.
 */
const materializedLibraryReader = <T>(props: {
  read: (relativePath: string) => Uint8Array;
  select: (
    owner: IAutoMovieMaterializedLibraryOwner,
  ) => readonly string[] | undefined;
  file: (id: string) => string;
  validate: (value: unknown) => typia.IValidation<T>;
  what: string;
}): ((request: {
  branch: string;
  owner: string;
  anchor: string;
}) => readonly T[]) => {
  const published = new Map<string, string[]>();
  try {
    const index = typia.validateEquals<IAutoMovieMaterializedLibrary>(
      parseAutoMovieStructuredJson({
        record: "library-index",
        bytes: props.read(AUTOMOVIE_LIBRARY_INDEX_PATH),
      }),
    );
    if (index.success === true)
      for (const owner of index.data.owners)
        published.set(JSON.stringify([owner.branch, owner.owner]), [
          ...(props.select(owner) ?? []),
        ]);
  } catch {
    // An absent or unreadable index is an uncompiled project, which the compile
    // gate reports at its own address; here it is simply an empty population.
  }
  return (request) => {
    // An empty answer is a real one for an owner that published nothing, so it
    // cannot also mean "you addressed this wrongly"; that has to be said
    // separately or it is never said at all. `building:report` passed the
    // document path alone and read no materialized building for as long as that
    // stood, while reporting that it had looked.
    if (request.owner.includes("#") === false)
      throw new Error(
        `Materialized library ${props.what} are addressed by the design owner's "path#anchor", not by "${request.owner}" alone.`,
      );
    const ids = published.get(JSON.stringify([request.branch, request.owner]));
    if (ids === undefined) return [];
    const found: T[] = [];
    for (const id of ids)
      try {
        const validation = props.validate(
          parseAutoMovieStructuredJson({
            record: "library-record",
            bytes: props.read(props.file(id)),
          }),
        );
        if (validation.success === true) found.push(validation.data);
      } catch {
        // A published path the tree no longer carries is generated-output
        // tampering, which `generated-tampered` names at that exact file.
      }
    return found;
  };
};

const materializeModel = (
  recipe: IAutoMovieModelRecipe,
  external: IAutoMovieExternalModelRuntimeBinding | undefined,
  archetypes: AutoMovieModelArchetypeRegistry,
): IAutoMovieModel => {
  const generated = materializeGeneratedModel(recipe, archetypes);
  if (external === undefined) return generated;
  const shape =
    external.collision.recipe === "capsule-v1"
      ? {
          type: "capsule" as const,
          radius: external.collision.parameters.radius,
          height: external.collision.parameters.height,
        }
      : {
          type: "box" as const,
          width: external.collision.parameters.width,
          height: external.collision.parameters.height,
          depth: external.collision.parameters.depth,
        };
  return {
    ...generated,
    name: `imported recipe ${recipe.id}`,
    origin: "imported",
    asset: external.asset,
    profiles: [],
    imported: {
      profile: external.profile,
      lod: structuredClone(external.lod),
      assets: structuredClone(external.assets),
      humanoidBones: structuredClone(external.humanoidBones),
    },
    parts: [
      {
        id: "registered-collision-proxy",
        name: "registered collision proxy",
        geometry: { type: "primitive", shape },
        material: generated.materials[0]!.id,
        attachedBone: null,
        transform: null,
      },
    ],
  };
};

const materializeGeneratedModel = (
  recipe: IAutoMovieModelRecipe,
  archetypes: AutoMovieModelArchetypeRegistry,
): IAutoMovieModel => {
  const archetype = archetypes.get(recipe.archetype);
  if (archetype === undefined)
    throw new Error(
      `Model recipe "${recipe.id}" names archetype "${recipe.archetype}", which is not registered with this builder. Register a builder for it, or name a registered archetype in the tracked model recipe record; the design gate refuses an unregistered archetype before compilation reaches geometry.`,
    );
  const material = materialOf(recipe);
  const geometry = archetype.build({
    recipe: recipe.id,
    parameters: recipe.parameters,
    material: material.id,
    skeleton: productionRuntimeSkeletonId(recipe.id),
  });
  return {
    id: productionRuntimeModelId(recipe.id),
    name: `${recipe.archetype} recipe ${recipe.id}`,
    origin: "generated" as const,
    body: null,
    affordances: null,
    materials: [material],
    asset: null,
    profiles: structuredClone(recipe.profiles ?? []),
    skeleton: geometry.skeleton,
    parts: geometry.parts,
  };
};

const materialOf = (
  recipe: IAutoMovieModelRecipe,
): IAutoMovieModel["materials"][number] => {
  const [name, hex] = Object.entries(recipe.palette).sort(([left], [right]) =>
    compareCodeUnits(left, right),
  )[0]!;
  return {
    id: name,
    name,
    // A recipe palette is an sRGB swatch and `baseColor` is linear, so the
    // digits are decoded rather than divided by 255. Dividing was this
    // repository's only sRGB-to-linear "conversion", and being an identity it
    // made every generated material about 2.3x too bright at midtones while
    // instanced slots covering the same surface decoded theirs correctly.
    baseColor: srgbHexToLinearColor(hex),
    metallic: 0,
    roughness: 0.7,
    emissive: null,
    opacity: 1,
    baseColorTexture: null,
  };
};
