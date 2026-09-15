import type { IAutoMovieMesh, IAutoMovieModel } from "@automovie/interface";

import { createModel } from "./fixtures";

/** One finite +Z triangle; binary-fraction RGB values survive Float32 exactly. */
export const vertexColourMesh = (): IAutoMovieMesh => ({
  positions: [0, 0, 0, 1, 0, 0, 0, 1, 0],
  normals: [0, 0, 1, 0, 0, 1, 0, 0, 1],
  uvs: null,
  indices: [0, 1, 2],
  skin: null,
  colors: [1, 0, 0.5, 0.25, 1, 0, 0, 0.5, 1],
});

/** Separate triangles share one material without overlapping topology. */
export const vertexColourModel = (
  meshes: IAutoMovieMesh[],
): IAutoMovieModel => {
  const base = createModel(null);
  return {
    ...base,
    parts: meshes.map((mesh, index) => ({
      ...base.parts[0]!,
      id: `triangle-${index}`,
      name: `triangle-${index}`,
      geometry: { type: "mesh", mesh },
      transform: {
        translation: { x: index * 2, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0, w: 1 },
        scale: { x: 1, y: 1, z: 1 },
      },
    })),
  };
};
