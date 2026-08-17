import type { IAutoMovieMesh } from "@automovie/interface";

/** The smallest and largest texel density any triangle of a mesh carries. */
export interface IAtlasDensityRange {
  /** Least emitted-uv-area over surface-area; below 1 the texels are stretched. */
  least: number;
  /** Greatest of the same ratio; above 1 the texels are crowded. */
  most: number;
  /** Triangles with no surface area, which contribute no ratio to either bound. */
  degenerate: number;
}

/**
 * Measure emitted atlas area against real surface area, triangle by triangle.
 *
 * Area is the half of a coordinate set's distortion an author cannot diagnose
 * from a frame: a sheared atlas draws a square as a parallelogram, which is
 * visible, while a stretched one draws the same texels over more surface, which
 * reads only as a finish that is somehow the wrong size. Both areas come from
 * the mesh's own buffers, so the ratio is 1 exactly when the map preserves area
 * and nothing about how the mesh sits in space can move it.
 *
 * This lives here because two cases need the same number and a second copy of
 * one quantity is a second answer that eventually disagrees with the first. It
 * deliberately reports area alone rather than growing into the singular-value
 * decomposition `test_geometry_revolve_atlas_shear` performs for anisotropy;
 * that case needs the whole matrix and this one needs its determinant, and
 * merging them would give both cases a measurement neither one reads.
 *
 * A triangle with no surface area has no ratio to report and is counted rather
 * than skipped in silence. Skipping quietly is how a bound comes to be taken
 * over a shrinking subset: a collapsed band would drop out of both extremes and
 * leave the survivors looking well behaved, so a caller asserts the count is
 * zero and every bound it reports is then known to come from real area.
 */
export const atlasDensityRange = (mesh: IAutoMovieMesh): IAtlasDensityRange => {
  const indices = mesh.indices!;
  const range: IAtlasDensityRange = {
    least: Number.POSITIVE_INFINITY,
    most: Number.NEGATIVE_INFINITY,
    degenerate: 0,
  };
  for (let at = 0; at < indices.length; at += 3) {
    const cornerAt = (
      offset: number,
    ): { position: readonly number[]; atlas: readonly number[] } => {
      const index = indices[at + offset]!;
      return {
        position: [
          mesh.positions[index * 3]!,
          mesh.positions[index * 3 + 1]!,
          mesh.positions[index * 3 + 2]!,
        ],
        atlas: [mesh.uvs![index * 2]!, mesh.uvs![index * 2 + 1]!],
      };
    };
    const origin = cornerAt(0);
    const alpha = cornerAt(1);
    const beta = cornerAt(2);
    const first = alpha.position.map(
      (value, axis) => value - origin.position[axis]!,
    );
    const second = beta.position.map(
      (value, axis) => value - origin.position[axis]!,
    );
    const surface =
      Math.hypot(
        first[1]! * second[2]! - first[2]! * second[1]!,
        first[2]! * second[0]! - first[0]! * second[2]!,
        first[0]! * second[1]! - first[1]! * second[0]!,
      ) / 2;
    if (surface <= 1e-12) {
      range.degenerate += 1;
      continue;
    }
    const atlas =
      Math.abs(
        (alpha.atlas[0]! - origin.atlas[0]!) *
          (beta.atlas[1]! - origin.atlas[1]!) -
          (alpha.atlas[1]! - origin.atlas[1]!) *
            (beta.atlas[0]! - origin.atlas[0]!),
      ) / 2;
    const ratio = atlas / surface;
    range.least = Math.min(range.least, ratio);
    range.most = Math.max(range.most, ratio);
  }
  return range;
};
