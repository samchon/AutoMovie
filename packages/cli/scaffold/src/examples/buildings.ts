import {
  AutoMovieSubject,
  type IAutoMovieSubjectContribution,
  lowerBuiltEnvironment,
} from "@automovie/engine";
import type {
  IAutoMovieBuiltEnvironment,
  IAutoMovieBuiltSpace,
  IAutoMovieModel,
  IAutoMovieShotBuildContext,
  IAutoMovieSurface,
  IAutoMovieTransform,
} from "@automovie/interface";

const identity = (x: number, y: number, z: number): IAutoMovieTransform => ({
  translation: { x, y, z },
  rotation: { x: 0, y: 0, z: 0, w: 1 },
  scale: { x: 1, y: 1, z: 1 },
});

const boxModel = (): IAutoMovieModel => ({
  id: "building-box",
  name: "Reusable unit box for architectural members",
  origin: "generated",
  skeleton: null,
  materials: [],
  parts: [
    {
      id: "box",
      name: null,
      geometry: {
        type: "primitive",
        shape: { type: "box", width: 1, height: 1, depth: 1 },
      },
      material: null,
      attachedBone: null,
      transform: null,
    },
  ],
  asset: null,
  body: null,
});

const storeySpace = (index: number, height: number): IAutoMovieBuiltSpace => {
  const bottom = index * height;
  const top = bottom + height;
  return {
    id: `storey-${index + 1}`,
    kind: index === 3 ? "attic" : index === 1 ? "mezzanine" : "storey",
    parent: "whole-building",
    cells: [
      {
        id: `storey-${index + 1}-cell`,
        planes: [
          { normal: { x: 1, y: 0, z: 0 }, offset: 6 },
          { normal: { x: -1, y: 0, z: 0 }, offset: 6 },
          { normal: { x: 0, y: 1, z: 0 }, offset: top },
          { normal: { x: 0, y: -1, z: 0 }, offset: -bottom },
          { normal: { x: 0, y: 0, z: 1 }, offset: 4 },
          { normal: { x: 0, y: 0, z: -1 }, offset: 4 },
        ],
      },
    ],
  };
};

const storeySurface = (index: number, height: number): IAutoMovieSurface => ({
  id: `storey-${index + 1}-floor`,
  kind: "floor",
  polygon: [
    { x: -6, y: 0, z: -4 },
    { x: 6, y: 0, z: -4 },
    { x: 6, y: 0, z: 4 },
    { x: -6, y: 0, z: 4 },
  ],
  anchor: { x: -6, y: index * height, z: -4 },
  rampTo: null,
});

/**
 * A code-first building example, deliberately not part of the starter film.
 *
 * The visible assembly and logical partitions are derived from the same
 * parameters, so changing `storeys` or `storeyHeight` cannot leave a copied
 * stair, floor, or room record behind. Open element-kind strings let this same
 * graph describe ancient, medieval, modern, or speculative models.
 */
export class ExampleBuilding extends AutoMovieSubject<IAutoMovieBuiltEnvironment> {
  public readonly id = "example-building";
  public readonly storeys = 4;
  public readonly storeyHeight = 3.2;

  public design(): IAutoMovieBuiltEnvironment {
    const indices = Array.from({ length: this.storeys }, (_, index) => index);
    const spaces = indices.map((index) =>
      storeySpace(index, this.storeyHeight),
    );
    const surfaces = indices.map((index) => ({
      space: spaces[index]!.id,
      surface: storeySurface(index, this.storeyHeight),
    }));
    return {
      version: 1,
      id: this.id,
      units: "meter",
      models: [boxModel()],
      modelReferences: [],
      elements: [
        {
          id: "root",
          kind: "building",
          parent: null,
          transform: identity(0, 0, 0),
          model: null,
          space: "whole-building",
        },
        ...indices.map((index) => ({
          id: `slab-${index + 1}`,
          kind: index === 1 ? "mezzanine-slab" : "floor-slab",
          parent: "root",
          transform: {
            ...identity(0, index * this.storeyHeight, 0),
            scale: { x: 12, y: 0.2, z: 8 },
          },
          model: "building-box",
          space: spaces[index]!.id,
        })),
        {
          id: "facade-ladder",
          kind: "facade-ladder",
          parent: "root",
          transform: {
            ...identity(6.1, (this.storeys * this.storeyHeight) / 2, 0),
            scale: { x: 0.15, y: this.storeys * this.storeyHeight, z: 0.5 },
          },
          model: "building-box",
          space: spaces.at(-1)!.id,
        },
        {
          id: "roof-helipad",
          kind: "helipad",
          parent: "root",
          transform: {
            ...identity(0, this.storeys * this.storeyHeight, 0),
            scale: { x: 8, y: 0.2, z: 8 },
          },
          model: "building-box",
          space: spaces.at(-1)!.id,
        },
      ],
      spaces: [
        { id: "whole-building", kind: "building", parent: null, cells: [] },
        ...spaces,
      ],
      boundaries: indices.slice(1).map((index) => ({
        id: `storey-boundary-${index}`,
        kind: "floor-ceiling",
        spaces: [spaces[index - 1]!.id, spaces[index]!.id],
        elements: [`slab-${index + 1}`],
      })),
      openings: [],
      connectors: [
        ...indices.slice(1).map((index) => ({
          id: `stair-${index}`,
          kind: "stair" as const,
          from: spaces[index - 1]!.id,
          to: spaces[index]!.id,
          bidirectional: true,
          route: [
            { x: -4, y: (index - 1) * this.storeyHeight, z: 0 },
            { x: -2, y: index * this.storeyHeight, z: 0 },
          ],
          width: 1.4,
          clearHeight: 2.2,
          elements: [],
        })),
        {
          id: "lift",
          kind: "lift",
          from: spaces[0]!.id,
          to: spaces.at(-1)!.id,
          bidirectional: true,
          route: [
            { x: 4, y: 0, z: 0 },
            { x: 4, y: (this.storeys - 1) * this.storeyHeight, z: 0 },
          ],
          width: 1.6,
          clearHeight: 2.4,
          elements: [],
        },
      ],
      surfaces,
      walkable: surfaces.map((entry) => entry.surface.id),
    };
  }

  public render(
    _context: IAutoMovieShotBuildContext,
  ): IAutoMovieSubjectContribution {
    return lowerBuiltEnvironment(this.design());
  }
}
