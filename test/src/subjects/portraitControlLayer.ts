import {
  compareCodeUnits,
  createAutoMovieMeshDeformer,
} from "@automovie/engine";
import type { IAutoMovieMeshDeformationField } from "@automovie/interface";

import type { IPortraitSurfaceLayer } from "./portraitSurface";

/**
 * One anatomical control on the common refined surface. A displacement is the
 * requested movement at this point, including the influence of all neighbours.
 * It is not the amplitude of another independently added bump.
 *
 * @author Samchon
 */
export interface IPortraitSurfaceControl {
  /** Unique anatomical responsibility, also fixing deterministic solve order. */
  name: string;
  /** Subject-owned retained vertex used as this point's current datum. */
  anchor: number;
  /** XYZ offset from the datum, in construction millimetres. */
  offset: readonly number[];
  /** Total requested XYZ displacement at the control, in millimetres. */
  displacement: readonly number[];
}

/**
 * Interpolate a complete set of anatomical controls with the engine's compact
 * displacement fields. All controls share one positive support radius in mm.
 * At most 96 points bound the dense solve; an empty population is identity.
 * Zero controls constrain neighbouring movements instead of being discarded.
 *
 * The engine itself samples the interpolation matrix. A normalized probe with
 * displacement 1/4 has a positive Jacobian because the compact kernel's maximum
 * gradient is less than two. The final field is evaluated and checked by that
 * same engine, including its real Jacobians and emitted triangle orientations.
 * No independently copied kernel can drift away from the rendered operation.
 *
 * Partial pivoting refuses unresolved/near-coincident controls. Interpolating
 * handle movements is not a guarantee of likeness or global nonintersection.
 * The surrounding surface assembler retains its open-rim mask; a control in
 * that protected collar consequently does not promise its full displacement.
 */
export function createPortraitControlLayer(
  id: string,
  radius: number,
  input: readonly IPortraitSurfaceControl[],
): IPortraitSurfaceLayer {
  const controls = [...structuredClone(input)].sort((a, b) =>
    compareCodeUnits(a.name, b.name),
  );
  if (
    id.trim().length === 0 ||
    !Number.isFinite(radius) ||
    radius / 1000 <= 0 ||
    controls.length > 96 ||
    new Set(controls.map((c) => c.name)).size !== controls.length ||
    controls.some(
      (c) =>
        c.name.trim().length === 0 ||
        !Number.isInteger(c.anchor) ||
        c.anchor < 0 ||
        [c.offset, c.displacement].some(
          (v) => v.length !== 3 || !v.every(Number.isFinite),
        ),
    )
  )
    throw new Error(
      "Surface controls need unique names, resident bindings, finite XYZ and a positive metric radius.",
    );
  return {
    id,
    fields: (host) => {
      if (controls.length === 0) return [];
      const centers = controls.map((c) => {
        const point = host.positions[c.anchor];
        if (
          point === undefined ||
          point.length !== 3 ||
          !point.every(Number.isFinite)
        )
          throw new Error("Surface controls need a resident finite datum.");
        const center = point.map((value, axis) => value + c.offset[axis]);
        if (!center.every(Number.isFinite))
          throw new Error(
            "Surface control centers exceed their finite domain.",
          );
        return center;
      });
      // All normalized pair differences are sampled together. The probe has no
      // triangles because it asks for a field value, not a surrogate surface.
      const positions = centers.flatMap((a) =>
        centers.flatMap((b) => a.map((v, axis) => (v - b[axis]) / radius)),
      );
      const sampled = createAutoMovieMeshDeformer([
        {
          center: { x: 0, y: 0, z: 0 },
          radius: { x: 1, y: 1, z: 1 },
          displacement: { x: 0, y: 0.25, z: 0 },
          stretch: { x: 0, y: 0, z: 0 },
        },
      ])({ positions, indices: [], normals: null, uvs: null, skin: null });
      const count = controls.length;
      const rows = controls.map((c, row) => [
        ...controls.map((_other, column) => {
          const y = 3 * (row * count + column) + 1;
          return (sampled.positions[y] - positions[y]) * 4;
        }),
        ...c.displacement,
      ]);
      // One elimination carries three right-hand sides. Absolute pivots are
      // meaningful here: the normalized matrix has diagonal one and |a_ij|<=1.
      for (let column = 0; column < count; column++) {
        let pivot = column;
        for (let row = column + 1; row < count; row++)
          if (Math.abs(rows[row][column]) > Math.abs(rows[pivot][column]))
            pivot = row;
        if (Math.abs(rows[pivot][column]) <= 1e-10)
          throw new Error(
            "Surface controls are singular or too close for a stable interpolation.",
          );
        [rows[column], rows[pivot]] = [rows[pivot], rows[column]];
        const divisor = rows[column][column];
        for (let j = column; j < count + 3; j++) rows[column][j] /= divisor;
        for (let row = 0; row < count; row++) {
          if (row === column) continue;
          const factor = rows[row][column];
          for (let j = column; j < count + 3; j++)
            rows[row][j] -= factor * rows[column][j];
        }
      }
      return rows.flatMap((row, i): IAutoMovieMeshDeformationField[] => {
        const movement = row.slice(count).map((v) => v / 1000);
        if (!movement.every(Number.isFinite))
          throw new Error(
            "Surface control coefficients exceed their finite domain.",
          );
        if (movement.every((v) => v === 0)) return [];
        const center = centers[i].map((v) => v / 1000);
        return [
          {
            center: { x: center[0], y: center[1], z: center[2] },
            radius: { x: radius / 1000, y: radius / 1000, z: radius / 1000 },
            displacement: { x: movement[0], y: movement[1], z: movement[2] },
            stretch: { x: 0, y: 0, z: 0 },
          },
        ];
      });
    },
  };
}
