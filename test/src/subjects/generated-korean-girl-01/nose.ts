import type { IPortraitComponent } from "../portraitComponents";
import type { IControlMesh } from "../subdivideControlMesh";
import {
  type IPortraitNasalSection,
  createPortraitNasalSection,
} from "./nasalSection";
import { fitPortraitNostrilRim, resizePortraitNostrilRim } from "./nostrilRim";

/**
 * Subject-owned nasal attachment. The two cut populations are triangle ordinals
 * on the measured host, fixed before a component deforms its openings.
 *
 * @author Samchon
 */
export interface IPortraitNoseSocket {
  /** Nasal midline in the host frame, in mm. */
  midline: number;
  /** Tip influence centre Y, in mm. */
  tipY: number;
  /** Tip influence radii in X/Y, in mm. */
  tipRadius: [number, number];
  /** Alar centres' distance from the midline, in mm. */
  alarOffset: number;
  /** Alar centre Y, in mm. */
  alarY: number;
  /** Alar influence radius, in mm. */
  alarRadius: number;
  /** Host skin vertices that the component directly sculpts. */
  surface: number[];
  /** Original triangle ordinals for each nasal opening. */
  nostrils: number[][];
  /** Optional retained vertex supplying the local section loft's XYZ datum. */
  sectionAnchor?: number;
}

/**
 * Numerical nasal shape. Width and opening scales change the shared rim; the
 * same changed vertices seed the surrounding skin blend and recessed cavity.
 *
 * @author Samchon
 */
export interface IPortraitNoseShape {
  /** Width multiplier about the socket midline. */
  widthScale: number;
  /** Tip displacement along host Z, in mm. */
  tipProjection: number;
  /** Alar displacement along host Z, in mm. */
  alarProjection: number;
  /** Width multiplier in the aperture plane, before overall head-X nasal scaling. */
  nostrilWidthScale: number;
  /** Height multiplier in the aperture plane; preserves its orientation about its centre. */
  nostrilHeightScale: number;
  /** Aperture displacement upwards in host Y, in mm. */
  nostrilRise: number;
  /** Additional rotation around host X, in degrees; positive faces the opening down. */
  nostrilTilt: number;
  /** Inner lining's retained fraction of the fitted rim width/height. */
  cavityContraction: number;
  /** Fraction of cavity travel at the rim support ring; strictly between zero and one. */
  rimSupport: number;
  /** Blend from the measured rim to its fitted smooth ellipse, in [0,1]. */
  rimRoundness: number;
  /** Cavity floor offset in host XYZ millimetres, rotated with the nostril tilt. */
  cavityOffset: number[];
  /** Reach of adjacent skin adaptation along the original mesh, in mm. */
  blendReach: number;
  /** Optional connected depth basis for the lower nasal body; omission is identity. */
  section?: IPortraitNasalSection;
}

/** Smooth nasal volume controls evaluated in the subject-owned socket frame. */
export function portraitNoseDepth(
  point: number[],
  socket: IPortraitNoseSocket,
  shape: IPortraitNoseShape,
): number {
  const x = point[0] - socket.midline;
  const alar = Math.exp(
    -(((Math.abs(x) - socket.alarOffset) / socket.alarRadius) ** 2) -
      ((point[1] - socket.alarY) / socket.alarRadius) ** 2,
  );
  const tip = Math.exp(
    -((x / socket.tipRadius[0]) ** 2) -
      ((point[1] - socket.tipY) / socket.tipRadius[1]) ** 2,
  );
  return shape.alarProjection * alar + shape.tipProjection * tip;
}

/** Select an ellipse footprint while binding a measured host socket. */
export const portraitNostrilContains = (
  x: number,
  y: number,
  footprint: {
    x: number;
    y: number;
    width: number;
    height: number;
  },
): boolean =>
  ((x - footprint.x) / footprint.width) ** 2 +
    ((y - footprint.y) / footprint.height) ** 2 <
  1;

/** Boundary edges of a connected cut patch, preserving its original winding. */
export function portraitCutBoundary(
  faces: number[][],
): { a: number; b: number }[] {
  if (faces.length === 0)
    throw new Error("A nostril opening must select at least one control face.");
  const edges = new Map<string, { a: number; b: number; count: number }>();
  for (const face of faces)
    for (let i = 0; i < 3; i++) {
      const a = face[i],
        b = face[(i + 1) % 3];
      const key = Math.min(a, b) + "/" + Math.max(a, b);
      const edge = edges.get(key);
      if (edge === undefined) edges.set(key, { a, b, count: 1 });
      else edge.count++;
    }
  const boundary = [...edges.values()].filter((edge) => edge.count === 1);
  const next = new Map(boundary.map((edge) => [edge.a, edge]));
  const ordered: { a: number; b: number }[] = [];
  if (boundary.length === 0 || next.size !== boundary.length)
    throw new Error("A nasal cut must have one simple oriented boundary.");
  let edge = boundary[0];
  const visited = new Set<number>();
  while (!visited.has(edge.a)) {
    visited.add(edge.a);
    ordered.push({ a: edge.a, b: edge.b });
    const following = next.get(edge.b);
    if (following === undefined)
      throw new Error("A nasal cut boundary must be closed.");
    edge = following;
  }
  if (edge.a !== ordered[0].a || ordered.length !== boundary.length)
    throw new Error("A nasal cut must contain exactly one boundary loop.");
  return ordered;
}

/** Build one replaceable nose against the host's declared nasal attachment. */
export function createPortraitNoseComponent(
  inputSocket: IPortraitNoseSocket,
  inputShape: IPortraitNoseShape,
): IPortraitComponent {
  const socket = {
    ...inputSocket,
    tipRadius: [...inputSocket.tipRadius] as [number, number],
    surface: [...inputSocket.surface],
    nostrils: inputSocket.nostrils.map((faces) => [...faces]),
  };
  const shape = { ...inputShape, cavityOffset: [...inputShape.cavityOffset] };
  const section =
    inputShape.section === undefined
      ? undefined
      : createPortraitNasalSection(inputShape.section);
  if (
    [
      shape.widthScale,
      shape.nostrilWidthScale,
      shape.nostrilHeightScale,
      shape.cavityContraction,
      shape.rimSupport,
    ].some((v) => !Number.isFinite(v) || v <= 0) ||
    shape.cavityContraction >= 1 ||
    shape.rimSupport >= 1 ||
    !Number.isFinite(shape.rimRoundness) ||
    shape.rimRoundness < 0 ||
    shape.rimRoundness > 1 ||
    !Number.isFinite(shape.blendReach) ||
    shape.blendReach < 0 ||
    ![
      shape.tipProjection,
      shape.alarProjection,
      shape.nostrilRise,
      shape.nostrilTilt,
    ].every(Number.isFinite) ||
    shape.cavityOffset.length !== 3 ||
    !shape.cavityOffset.every(Number.isFinite)
  )
    throw new Error(
      "Nasal dimensions must be finite, with positive openings and a contracted inner lining.",
    );
  return {
    id: "nose",
    fit: (host) => {
      const datum =
        socket.sectionAnchor === undefined
          ? undefined
          : host.positions[socket.sectionAnchor];
      if (
        section !== undefined &&
        (!Number.isInteger(socket.sectionAnchor) ||
          socket.sectionAnchor! < 0 ||
          datum === undefined ||
          datum.length !== 3 ||
          !datum.every(Number.isFinite))
      )
        throw new Error(
          "A nasal section needs a resident finite socket datum.",
        );
      // One depth evaluator owns both exterior targets and pre-fit aperture
      // samples. A section replaces the inferred local depth; the existing tip
      // and alar controls remain explicit additional signed offsets. The lining
      // later reads the actual fitted rim, so it cannot retain a stale basis.
      const depth = (point: number[]): number =>
        portraitNoseDepth(point, socket, shape) +
        (section === undefined ? 0 : section(point, datum!));
      const openings = socket.nostrils.map((ordinals) =>
        ordinals.map((i) => host.indices.slice(3 * i, 3 * i + 3)),
      );
      const targets = new Map<number, number[]>();
      for (const id of socket.surface) {
        const point = host.positions[id];
        targets.set(id, [
          socket.midline + (point[0] - socket.midline) * shape.widthScale,
          point[1],
          point[2] + depth(point),
        ]);
      }
      for (const faces of openings) {
        const ids = portraitCutBoundary(faces).map((edge) => edge.a);
        const rim = resizePortraitNostrilRim(
          fitPortraitNostrilRim(
            ids.map((id) => [
              host.positions[id][0],
              host.positions[id][1],
              host.positions[id][2] + depth(host.positions[id]),
            ]),
            shape.rimRoundness,
          ),
          shape.nostrilWidthScale,
          shape.nostrilHeightScale,
        );
        const center = [0, 1, 2].map(
          (axis) =>
            ids.reduce((sum, id) => sum + host.positions[id][axis], 0) /
            ids.length,
        );
        // Rotate about the fitted opening centre, including the nasal volume
        // edit. The rim and its lining must use the same anatomical frame.
        const centerZ =
          ids.reduce(
            (sum, id) =>
              sum + host.positions[id][2] + depth(host.positions[id]),
            0,
          ) / ids.length;
        const angle = (shape.nostrilTilt * Math.PI) / 180;
        for (let vertex = 0; vertex < ids.length; vertex++) {
          const id = ids[vertex],
            point = rim[vertex];
          const y = point[1] - center[1];
          const z = point[2] - centerZ;
          targets.set(id, [
            socket.midline + (point[0] - socket.midline) * shape.widthScale,
            center[1] +
              shape.nostrilRise +
              y * Math.cos(angle) -
              z * Math.sin(angle),
            centerZ + y * Math.sin(angle) + z * Math.cos(angle),
          ]);
        }
      }
      return {
        constraints: [...targets].map(([vertex, target]) => ({
          vertex,
          target,
          reach: shape.blendReach,
        })),
        cutFaces: socket.nostrils.flat(),
        attach: (cage, _adapted, region) => {
          appendPortraitNostrils(
            cage,
            openings,
            shape,
            region("nostril-interiors", "nasal-interior"),
          );
          return { openings: [], finish: () => [] };
        },
      };
    },
  };
}

/**
 * Build lining and cavity from the actual fitted rim. Original rim IDs stay
 * shared with the face. Changing an opening therefore changes its lining and
 * neighbouring skin together instead of placing a new cavity under an old hole.
 */
export function appendPortraitNostrils(
  cage: IControlMesh,
  nostrilFaces: number[][][],
  shape: IPortraitNoseShape,
  group: number,
): void {
  const { positions, indices, groups } = cage;
  const angle = (shape.nostrilTilt * Math.PI) / 180;
  const offset = [
    shape.cavityOffset[0],
    shape.cavityOffset[1] * Math.cos(angle) -
      shape.cavityOffset[2] * Math.sin(angle),
    shape.cavityOffset[1] * Math.sin(angle) +
      shape.cavityOffset[2] * Math.cos(angle),
  ];
  for (const faces of nostrilFaces) {
    const boundary = portraitCutBoundary(faces);
    const ids = [...new Set(boundary.flatMap((edge) => [edge.a, edge.b]))];
    const center = [0, 1, 2].map(
      (axis) =>
        ids.reduce((sum, id) => sum + positions[id][axis], 0) / ids.length,
    );
    // A near support ring retains the aperture edge through subdivision before
    // the lining travels to its contracted deep ring and recessed floor.
    const rings = [new Map(ids.map((id) => [id, id]))];
    for (const fraction of [shape.rimSupport, 1]) {
      const ring = new Map<number, number>();
      for (const id of ids) {
        ring.set(id, positions.length);
        positions.push(
          positions[id].map(
            (value, axis) =>
              center[axis] +
              (1 - fraction * (1 - shape.cavityContraction)) *
                (value - center[axis]) +
              fraction * offset[axis],
          ),
        );
      }
      rings.push(ring);
    }
    const floor = positions.length;
    positions.push(center.map((value, axis) => value + offset[axis]));
    for (const edge of boundary) {
      for (let ring = 0; ring < rings.length - 1; ring++) {
        const a = rings[ring].get(edge.a)!,
          b = rings[ring].get(edge.b)!;
        const c = rings[ring + 1].get(edge.a)!,
          d = rings[ring + 1].get(edge.b)!;
        indices.push(a, b, c, b, d, c);
        groups.push(group, group);
      }
      indices.push(
        rings[rings.length - 1].get(edge.a)!,
        rings[rings.length - 1].get(edge.b)!,
        floor,
      );
      groups.push(group);
    }
  }
}
