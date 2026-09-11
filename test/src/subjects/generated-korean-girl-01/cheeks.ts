import type { IAutoMovieMeshDeformationField } from "@automovie/interface";

import { portraitPoint, portraitSpline } from "../geometry";
import type { IPortraitSurfaceLayer } from "../portraitSurface";

/**
 * Subject-owned attachments for one side of the midface. All identities refer
 * to skin vertices retained by subdivision. The mouth-corner attachment lies
 * on the neighbouring cheek, outside the actual oral opening.
 *
 * @author Samchon
 */
export interface IPortraitCheekSocket {
  /** Anatomical side; positive head X is left. */
  side: "left" | "right";
  /** Prominence beneath the lateral orbital margin. */
  malar: number;
  /** Medial cheek mass lateral to the nasal wing. */
  medial: number;
  /** Lower/lateral cheek transition towards the mandibular region. */
  buccal: number;
  /** Perioral attachment lateral to the lip commissure. */
  modiolus: number;
  /** Nasolabial path from beside the nasal wing towards the mouth corner. */
  nasolabial: number[];
}

/**
 * A compact envelope of soft-tissue displacement. Lengths use millimetres.
 * Projection is a surface offset, not a measurement of fat volume or thickness.
 * Zero projection and lift retain the supplied host's existing expression.
 *
 * @author Samchon
 */
export interface IPortraitCheekVolume {
  /**
   * Optional support-centre shift [outward, up, forward] from the bound skin
   * anchor, in mm. Outward is mirrored by the anatomical side; a negative first
   * coordinate moves both cheeks towards the nose. Omission retains the anchor.
   */
  offset?: [number, number, number];
  /** Positive transverse support radius in the head frame. */
  width: number;
  /** Positive vertical support radius in the head frame. */
  height: number;
  /** Positive depth support radius; limits influence through the head. */
  reach: number;
  /** Peak anterior displacement along head Z, in mm. */
  projection: number;
  /** Peak upward displacement along head Y, in mm. */
  lift: number;
}

/**
 * Independently authored cheek and perioral relief on one connected skin.
 * Support masses and the adjacent groove are separate controls: a nasolabial
 * crease alone does not supply the raised cheek beside it. The host supplies
 * current correspondence positions, not a validated three-dimensional smile.
 * These values add only the explicitly requested relief. Each basic region is
 * one axis-aligned envelope, not a complete reconstruction of a fat compartment
 * or a freely authored cheek section. A missing directional contour requires
 * the detailed form ownership described in ../FACE-ANATOMY.md.
 *
 * @author Samchon
 */
export interface IPortraitCheekShape {
  /** Upper cheek support below the lateral orbital margin. */
  malar: IPortraitCheekVolume;
  /** Medial cheek fullness beside the nasal wing and nasolabial groove. */
  medial: IPortraitCheekVolume;
  /** Lower lateral cheek transition towards the mandibular region. */
  buccal: IPortraitCheekVolume;
  /** Local perioral support outside the mouth corner. */
  modiolus: IPortraitCheekVolume;
  /** Positive transverse support radius of the groove, in mm. */
  foldWidth: number;
  /** Nonnegative posterior groove displacement, in mm, fading at both ends. */
  foldDepth: number;
  /** Positive depth support radius of the groove, in mm. */
  foldReach: number;
}

/**
 * Fit named cheek envelopes and a nasolabial groove to the final shared skin.
 * Input settings are copied. Every layer reads the same undeformed refined
 * host; the surface assembler sums fields, preserves open rims and recomputes
 * normals before attached interiors consume that result.
 *
 * The groove integrates compact radial fields along a sampled spline. A cubic
 * radial kernel integrates to 32r/35 along a straight centreline. Multiplying
 * each sample by its normalized segment length times 35/32 keeps depth tied to a metric
 * surface effect rather than the number of samples. Fields are spaced in the
 * normalized support metric; their sine-squared envelope follows physical arc
 * distance, independently of the spacing of the subject's attachment vertices.
 * The anatomical path fades at both ends. Curved paths remain an approximation
 * and require rendered inspection; no cadaver measurement is claimed here.
 * At most 256 groove samples are admitted so an arbitrarily narrow requested
 * radius cannot create an unbounded field population.
 */
export function createPortraitCheekLayer(
  socketInput: IPortraitCheekSocket,
  shapeInput: IPortraitCheekShape,
): IPortraitSurfaceLayer {
  const socket = structuredClone(socketInput);
  const shape = structuredClone(shapeInput);
  const names = ["malar", "medial", "buccal", "modiolus"] as const;
  const bindings = [...names.map((name) => socket[name]), ...socket.nasolabial];
  if (
    (socket.side !== "left" && socket.side !== "right") ||
    socket.nasolabial.length < 2 ||
    new Set(socket.nasolabial).size !== socket.nasolabial.length ||
    bindings.some((id) => !Number.isInteger(id) || id < 0)
  )
    throw new Error(
      "Cheek attachments need a side, skin identities and an ordered distinct fold path.",
    );
  if (
    names.some((name) => {
      const volume = shape[name];
      return (
        (volume.offset !== undefined &&
          (volume.offset.length !== 3 ||
            !volume.offset.every(Number.isFinite))) ||
        ![
          volume.width,
          volume.height,
          volume.reach,
          volume.projection,
          volume.lift,
        ].every(Number.isFinite) ||
        volume.width <= 0 ||
        volume.height <= 0 ||
        volume.reach <= 0
      );
    }) ||
    ![shape.foldWidth, shape.foldDepth, shape.foldReach].every(
      Number.isFinite,
    ) ||
    shape.foldWidth <= 0 ||
    shape.foldDepth < 0 ||
    shape.foldReach <= 0
  )
    throw new Error(
      "Cheek dimensions need finite displacements and positive support radii.",
    );
  return {
    id: `${socket.side}-cheek`,
    fields: (host) => {
      // Read current skin positions rather than freezing fitted coordinates in
      // the component. Mouth/nose replacement can move these same attachments.
      for (const id of bindings) {
        const point = host.positions[id];
        if (
          point === undefined ||
          point.length !== 3 ||
          !point.every(Number.isFinite)
        )
          throw new Error(
            "A cheek attachment must resolve to a finite resident skin position.",
          );
      }
      const fields: IAutoMovieMeshDeformationField[] = [];
      const field = (
        point: readonly number[],
        width: number,
        height: number,
        reach: number,
        projection: number,
        lift: number,
      ): void => {
        fields.push({
          center: {
            x: point[0] / 1000,
            y: point[1] / 1000,
            z: point[2] / 1000,
          },
          radius: { x: width / 1000, y: height / 1000, z: reach / 1000 },
          displacement: { x: 0, y: lift / 1000, z: projection / 1000 },
          stretch: { x: 0, y: 0, z: 0 },
        });
      };
      for (const name of names) {
        const volume = shape[name];
        if (volume.projection !== 0 || volume.lift !== 0) {
          // The attachment follows the actual refined host. A separate local
          // offset positions the tissue envelope without moving the attachment
          // identity or baking another person's absolute coordinates into it.
          const offset = volume.offset ?? [0, 0, 0];
          const center = host.positions[socket[name]].map(
            (v, axis) =>
              v +
              offset[axis] * (axis === 0 && socket.side === "right" ? -1 : 1),
          );
          if (!center.every(Number.isFinite))
            throw new Error(
              "Cheek support centre exceeds its representable range.",
            );
          field(
            center,
            volume.width,
            volume.height,
            volume.reach,
            volume.projection,
            volume.lift,
          );
        }
      }
      if (shape.foldDepth === 0) return fields;
      const path = socket.nasolabial.map((id) => {
        const point = host.positions[id];
        return portraitPoint(point[0], point[1], point[2]);
      });
      let length = 0;
      for (let i = 1; i < path.length; i++)
        length += Math.hypot(
          (path[i].x - path[i - 1].x) / shape.foldWidth,
          (path[i].y - path[i - 1].y) / shape.foldWidth,
          (path[i].z - path[i - 1].z) / shape.foldReach,
        );
      if (!Number.isFinite(length) || length === 0)
        throw new Error(
          "An active nasolabial groove needs a finite nonzero skin path.",
        );
      if (Math.ceil(2 * length) > 256)
        throw new Error(
          "Nasolabial width must resolve the skin path within 256 samples.",
        );
      // Resolve the guide first, retaining both physical travel and travel in
      // its ellipsoidal support metric. Equal spline parameter steps are not
      // equal distances when anatomical landmarks have unequal spacing.
      const samples = Array.from(
        { length: 16 * (path.length - 1) + 1 },
        (_value, i) => ({
          point: portraitSpline(path, i / (16 * (path.length - 1))),
          physical: 0,
          normalized: 0,
        }),
      );
      for (let i = 1; i < samples.length; i++) {
        const previous = samples[i - 1],
          next = samples[i];
        const dx = next.point.x - previous.point.x,
          dy = next.point.y - previous.point.y,
          dz = next.point.z - previous.point.z;
        next.physical = previous.physical + Math.hypot(dx, dy, dz);
        next.normalized =
          previous.normalized +
          Math.hypot(
            dx / shape.foldWidth,
            dy / shape.foldWidth,
            dz / shape.foldReach,
          );
      }
      const total = samples[samples.length - 1];
      if (!Number.isFinite(total.physical) || total.normalized <= 0)
        throw new Error(
          "Nasolabial displacement must remain finite along a nonzero sampled path.",
        );
      const divisions = Math.max(1, Math.ceil(2 * total.normalized));
      if (divisions > 256)
        throw new Error(
          "Nasolabial width must resolve the curved skin path within 256 samples.",
        );
      const step = total.normalized / divisions;
      let cursor = 0;
      for (let i = 0; i < divisions; i++) {
        const distance = (i + 0.5) * step;
        while (
          cursor + 1 < samples.length - 1 &&
          samples[cursor + 1].normalized <= distance
        )
          cursor++;
        const before = samples[cursor],
          after = samples[cursor + 1];
        const fraction =
          (distance - before.normalized) /
          (after.normalized - before.normalized);
        const physical =
          before.physical + fraction * (after.physical - before.physical);
        const center = (["x", "y", "z"] as const).map(
          (axis) =>
            before.point[axis] +
            fraction * (after.point[axis] - before.point[axis]),
        );
        // step is at most one half. Form its bounded quadrature weight before
        // multiplying by depth to avoid a needless large intermediate product.
        const depth =
          shape.foldDepth *
          (Math.sin(Math.PI * (physical / total.physical)) ** 2 *
            ((step * 35) / 32));
        field(
          center,
          shape.foldWidth,
          shape.foldWidth,
          shape.foldReach,
          -depth,
          0,
        );
      }
      return fields;
    },
  };
}
