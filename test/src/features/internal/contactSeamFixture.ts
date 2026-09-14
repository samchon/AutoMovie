import type { IControlMesh } from "@automovie/human";

/** An annular skin strip whose six-vertex inner rim has two paired contact samples. */
export const contactSeamFixture = (): IControlMesh => {
  const mesh: IControlMesh = {
    positions: [
      [-3, 0, 0],
      [-1, 2, 0],
      [1, 2, 0],
      [3, 0, 0],
      [1, -2, 0],
      [-1, -2, 0],
      [-2, 0, 1],
      [-0.7, 0, 1],
      [0.7, 0, 1],
      [2, 0, 1],
      [0.7, 0, 1],
      [-0.7, 0, 1],
    ],
    indices: [0, 1, 7, 0, 7, 6],
    groups: [0, 0],
  };
  for (let i = 1; i < 6; i++) {
    const j = (i + 1) % 6;
    mesh.indices.push(i, j, i + 6, j, j + 6, i + 6);
    mesh.groups.push(0, 0);
  }
  return mesh;
};
