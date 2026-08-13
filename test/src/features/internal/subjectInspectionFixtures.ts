import {
  IAutoMovieBuiltEnvironment,
  IAutoMovieCompiledInstanceSet,
  IAutoMovieCompiledShotSource,
  IAutoMovieModel,
  IAutoMovieSubjectArtifact,
  IAutoMovieTransform,
  IAutoMovieVector3,
} from "@automovie/interface";

/** Identity transform used by the compiled subject-inspection fixtures. */
export const subjectInspectionIdentityTransform = (): IAutoMovieTransform => ({
  translation: { x: 0, y: 0, z: 0 },
  rotation: { x: 0, y: 0, z: 0, w: 1 },
  scale: { x: 1, y: 1, z: 1 },
});

/** Minimal mesh-backed model whose resident positions state one exact box. */
export const subjectInspectionModel = (props: {
  id: string;
  min: IAutoMovieVector3;
  max: IAutoMovieVector3;
  name?: string | null;
  material?: string | null;
}): IAutoMovieModel =>
  ({
    id: props.id,
    name: props.name ?? props.id,
    origin: "generated",
    parts: [
      {
        id: "body",
        name: "body",
        geometry: {
          type: "mesh",
          mesh: {
            positions: [
              props.min.x,
              props.min.y,
              props.min.z,
              props.max.x,
              props.max.y,
              props.max.z,
            ],
            normals: [0, 1, 0, 0, 1, 0],
            uvs: null,
            indices: [],
            skin: null,
          },
        },
        material: props.material ?? "stone",
        attachedBone: null,
        transform: null,
      },
    ],
    skeleton: null,
    body: null,
    materials:
      props.material === null
        ? []
        : [
            {
              id: props.material ?? "stone",
              name: "inspection stone",
            },
          ],
    asset: null,
  }) as unknown as IAutoMovieModel;

/** Compact compiled set fixture with enough facts for exact slot regeneration. */
export const subjectInspectionInstanceSet = (props: {
  id: string;
  model: string;
  count: number;
  overrides?: Partial<IAutoMovieCompiledInstanceSet>;
}): IAutoMovieCompiledInstanceSet =>
  ({
    version: 1,
    id: props.id,
    count: props.count,
    modelRecipe: props.model,
    layout: {
      kind: "grid",
      rows: 1,
      columns: Math.max(1, props.count),
      spacing: { x: 1, z: 1 },
    },
    route: null,
    anchor: { x: 0, y: 0, z: 0 },
    facingDeg: 0,
    seed: 17,
    variation: {
      scale: { min: 1, max: 1 },
      palette: ["#ffffff"],
      traits: [],
    },
    bounds: {
      min: { x: -(props.count - 1) / 2, y: 0, z: 0 },
      max: { x: (props.count - 1) / 2, y: 0, z: 0 },
    },
    centroid: { x: 0, y: 0, z: 0 },
    projectionRadius: 1,
    chunks: [],
    lod: [
      {
        tier: "near",
        maxDistance: null,
        recipe: props.model,
        recipeDigest: `sha256:${"1".repeat(64)}`,
        model: props.model,
      },
    ],
    digest: `sha256:${"2".repeat(64)}`,
    ...props.overrides,
  }) as unknown as IAutoMovieCompiledInstanceSet;

/**
 * Compiled artifact with the three #1902 coordinate oracles and one declared
 * room whose occupied content is intentionally smaller than its volume.
 */
export const subjectInspectionArtifact = (
  props: {
    revision?: string;
    models?: IAutoMovieModel[];
    nodes?: IAutoMovieCompiledShotSource["scene"]["nodes"];
    instanceSets?: IAutoMovieCompiledInstanceSet[];
    environment?: IAutoMovieBuiltEnvironment | null;
  } = {},
): IAutoMovieSubjectArtifact => {
  const models = props.models ?? [
    subjectInspectionModel({
      id: "guard-rack-west-pole-0-model",
      min: { x: -13.92, y: 0, z: 5.32 },
      max: { x: -13.87, y: 2.7, z: 5.38 },
    }),
    subjectInspectionModel({
      id: "solar-oriel-model",
      min: { x: 14.75, y: 4.6, z: -1.71 },
      max: { x: 15.65, y: 7.4, z: 1.71 },
    }),
    subjectInspectionModel({
      id: "south-half-timber-brace-0-model",
      min: { x: -14.27, y: 6.89, z: 11.99 },
      max: { x: -3.73, y: 7.73, z: 12.17 },
    }),
  ];
  const nodes =
    props.nodes ??
    models.map((model) => ({
      id: `castle/${model.id.replace(/-model$/, "")}`,
      model: model.id,
      transform: subjectInspectionIdentityTransform(),
      motion: null,
      pose: null,
    }));
  const environment =
    props.environment === undefined
      ? subjectInspectionEnvironment(models)
      : props.environment;
  return {
    revision: props.revision ?? "sha256:inspection-a",
    compiled: {
      eventSamples: [],
      scene: {
        id: "inspection-scene",
        name: "Inspection scene",
        nodes,
        cameras: [],
        lights: [],
      },
      motions: [],
      models,
      formations: [],
      instanceSets: props.instanceSets ?? [],
      formationMotions: [],
      formationSlotMotions: [],
      effects: [],
      shot: {},
      ...(environment === null ? {} : { builtEnvironments: [environment] }),
    } as unknown as IAutoMovieCompiledShotSource,
  };
};

const subjectInspectionEnvironment = (
  models: IAutoMovieModel[],
): IAutoMovieBuiltEnvironment =>
  ({
    version: 1,
    id: "castle",
    units: "meter",
    buildings: [
      { id: "castle", element: "guard-rack-west-pole-0", space: "hall" },
    ],
    models,
    modelReferences: [],
    elements: models.map((model) => ({
      id: model.id.replace(/-model$/, ""),
      kind: model.id.includes("oriel")
        ? "window"
        : model.id.includes("brace")
          ? "brace"
          : "pole",
      parent: null,
      transform: subjectInspectionIdentityTransform(),
      model: model.id,
      space: "hall",
    })),
    spaces: [
      {
        id: "hall",
        kind: "room",
        parent: null,
        cells: [
          {
            id: "hall-cell",
            planes: [
              { normal: { x: 1, y: 0, z: 0 }, offset: 20 },
              { normal: { x: -1, y: 0, z: 0 }, offset: 20 },
              { normal: { x: 0, y: 1, z: 0 }, offset: 10 },
              { normal: { x: 0, y: -1, z: 0 }, offset: 0 },
              { normal: { x: 0, y: 0, z: 1 }, offset: 20 },
              { normal: { x: 0, y: 0, z: -1 }, offset: 20 },
            ],
          },
        ],
      },
    ],
    boundaries: [],
    openings: [],
    connectors: [],
    surfaces: [],
    walkable: [],
  }) as unknown as IAutoMovieBuiltEnvironment;
