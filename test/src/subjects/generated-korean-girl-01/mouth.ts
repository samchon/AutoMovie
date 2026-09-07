import type {
  IAutoMovieModelPart,
  IAutoMovieVector3,
} from "@automovie/interface";

import {
  portraitSpline as interpolate,
  portraitMix as mix,
  portraitPoint as p,
  portraitPatch as patch,
  portraitPart,
} from "../geometry";
import {
  type IPortraitComponent,
  portraitFacesInsideLoop,
} from "../portraitComponents";
import { createPortraitDentalArc } from "./dentalArc";
import {
  assertPortraitDentalCrown,
  buildPortraitDentalCrown,
} from "./dentalCrown";
import {
  type IPortraitLipSection,
  createPortraitLipCoordinates,
  createPortraitLipSection,
} from "./lipSection";

type Point = IAutoMovieVector3;
const pi = Math.PI;

/**
 * Subject-owned oral boundaries. Upper and lower curves share their endpoints
 * and run from negative to positive X. No landmark identity belongs to the
 * replaceable mouth implementation.
 *
 * @author Samchon
 */
export interface IPortraitMouthSocket {
  /** Closed outer vermilion loop, in boundary order. */
  outer: number[];
  /** Upper inner lip from negative to positive X. */
  upper: number[];
  /** Lower inner lip in the same direction. */
  lower: number[];
  /** A vertex strictly inside the connected vermilion band. */
  lipSeed: number;
}

/**
 * Mouth dimensions and an independently replaceable upper dental row. All
 * distances are millimetres; scales multiply the subject's measured socket.
 * The row contains its own crown dimensions rather than one repeated tooth.
 *
 * @author Samchon
 */
export interface IPortraitMouthShape {
  /** Width multiplier about the centre between the mouth corners. */
  widthScale: number;
  /** Height multiplier about the measured opening centre. */
  openingScale: number;
  /** Upward movement of both corners, fading to zero at the midline. */
  cornerLift: number;
  /** Upper vermilion projection in host Z. Zero retains measured depth. */
  upperLipProjection: number;
  /** Lower vermilion projection in host Z. Zero retains measured depth. */
  lowerLipProjection: number;
  /** Optional body and tubercle relief between the existing lip boundaries. */
  section?: IPortraitLipSection;
  /** Geodesic reach of surrounding skin adaptation. */
  blendReach: number;
  /** Recession of the oral cavity behind the actual refined opening. */
  cavityDepth: number;
  /** Signed distance of the dental row along the arch from the lip midpoint. */
  dentalOffset: number;
  /** Recession of crown centres behind the upper inner lip. */
  dentalRecess: number;
  /** Downward distance from the upper inner lip to the crown centres. */
  dentalDrop: number;
  /** Half-depth of the crowns along their local arch normal. */
  dentalDepth: number;
  /** Clearance along the arch; changing it never shrinks a crown's width. */
  toothGap: number;
  /** Individual crown widths and heights, ordered from negative to positive X. */
  crowns: {
    width: number;
    height: number;
    cervicalWidth?: number;
    edgeRise?: number;
  }[];
}

const innerLoop = (socket: IPortraitMouthSocket): number[] => [
  ...socket.lower,
  ...socket.upper.slice(1, -1).reverse(),
];

/**
 * Select the connected vermilion band by its two anatomical boundary loops.
 * Flooding from the socket's interior seed may cross an
 * internal triangulation edge but may never cross the outer lip or mouth rim.
 * This preserves the authored contour after subdivision; a centroid-in-polygon
 * paint test can select half of a boundary quad and produce a jagged lip edge.
 * Returned identities are triangle numbers in the supplied connectivity.
 */
export function portraitLipTriangles(
  triangles: number[],
  socket: IPortraitMouthSocket,
): Set<number> {
  const edgeKey = (a: number, b: number): string =>
    `${Math.min(a, b)}/${Math.max(a, b)}`;
  const barriers = new Set<string>();
  for (const loop of [socket.outer, innerLoop(socket)])
    for (let i = 0; i < loop.length; i++)
      barriers.add(edgeKey(loop[i], loop[(i + 1) % loop.length]));
  const incident = new Map<string, number[]>();
  const faceEdges: string[][] = [];
  let seed = -1;
  for (let i = 0; i < triangles.length; i += 3) {
    const face = triangles.slice(i, i + 3);
    if (face.includes(socket.lipSeed)) seed = i / 3;
    const edges = face.map((a, j) => edgeKey(a, face[(j + 1) % 3]));
    faceEdges.push(edges);
    for (const edge of edges) {
      const neighbours = incident.get(edge);
      if (neighbours === undefined) incident.set(edge, [i / 3]);
      else neighbours.push(i / 3);
    }
  }
  if (seed < 0)
    throw new Error("The lip control cage must include its interior seed.");
  const selected = new Set<number>([seed]);
  const queue = [seed];
  for (let i = 0; i < queue.length; i++)
    for (const edge of faceEdges[queue[i]]) {
      if (barriers.has(edge)) continue;
      for (const neighbour of incident.get(edge)!)
        if (!selected.has(neighbour)) {
          selected.add(neighbour);
          queue.push(neighbour);
        }
    }
  return selected;
}

/** Fit the lips, adapt adjacent skin and finish a dental row at the refined rim. */
export function createPortraitMouthComponent(
  inputSocket: IPortraitMouthSocket,
  inputShape: IPortraitMouthShape,
): IPortraitComponent {
  const socket = {
    ...inputSocket,
    outer: [...inputSocket.outer],
    upper: [...inputSocket.upper],
    lower: [...inputSocket.lower],
  };
  const shape = {
    ...inputShape,
    crowns: inputShape.crowns.map((crown) => ({ ...crown })),
  };
  const section =
    inputShape.section === undefined
      ? undefined
      : createPortraitLipSection(inputShape.section);
  for (const crown of shape.crowns)
    assertPortraitDentalCrown({
      ...crown,
      depth: shape.dentalDepth,
      cervicalWidth: crown.cervicalWidth ?? 0.78,
      edgeRise: crown.edgeRise ?? 0.035 * crown.height,
    });
  if (
    [
      shape.widthScale,
      shape.openingScale,
      shape.cavityDepth,
      shape.dentalDepth,
    ].some((value) => !Number.isFinite(value) || value <= 0) ||
    [
      shape.blendReach,
      shape.toothGap,
      shape.dentalRecess,
      shape.dentalDrop,
    ].some((value) => !Number.isFinite(value) || value < 0) ||
    [
      shape.cornerLift,
      shape.upperLipProjection,
      shape.lowerLipProjection,
      shape.dentalOffset,
    ].some((value) => !Number.isFinite(value))
  )
    throw new Error(
      "Mouth dimensions must be finite, with positive openings and crown sizes.",
    );
  return {
    id: "mouth",
    fit: (host) => {
      const inner = innerLoop(socket);
      const lips = portraitLipTriangles(host.indices, socket);
      const skin = new Set<number>();
      const lipKeys = new Set<string>();
      for (const triangle of lips) {
        const ids = host.indices.slice(3 * triangle, 3 * triangle + 3);
        lipKeys.add(ids.join("/"));
        for (const id of ids) skin.add(id);
      }
      const points = inner.map((id) => host.positions[id]);
      const left = Math.min(...points.map((point) => point[0]));
      const right = Math.max(...points.map((point) => point[0]));
      const centerX = (left + right) / 2;
      const centerY =
        (Math.min(...points.map((point) => point[1])) +
          Math.max(...points.map((point) => point[1]))) /
        2;
      // Follow the curved smile locally when distinguishing the two bands.
      // A lower-lip point near a raised corner may be above the global centre;
      // its anatomical role is still lower lip. Both borders come from this
      // socket, and section relief is exactly zero on either retained boundary.
      const coordinate = createPortraitLipCoordinates(
        socket.outer.map((id) => host.positions[id]),
        socket.upper.map((id) => host.positions[id]),
        socket.lower.map((id) => host.positions[id]),
      );
      return {
        constraints: [...skin].map((vertex) => {
          const point = host.positions[vertex];
          const local = coordinate(point);
          const corner = Math.min(
            1,
            Math.abs((point[0] - centerX) / ((right - left) / 2)),
          );
          return {
            vertex,
            target: [
              centerX + (point[0] - centerX) * shape.widthScale,
              centerY +
                (point[1] - centerY) * shape.openingScale +
                shape.cornerLift * corner ** 2,
              point[2] +
                (local.side === "upper"
                  ? shape.upperLipProjection
                  : shape.lowerLipProjection) *
                  (1 - corner ** 2) +
                (section?.(local) ?? 0),
            ],
            reach: shape.blendReach,
          };
        }),
        cutFaces: portraitFacesInsideLoop(host, inner),
        attach: (cage, _adapted, region) => {
          // Material ownership follows the original anatomical band through
          // other components' cuts. The host contains no lip-specific policy.
          const group = region("lips", "lips");
          for (let i = 0; i < cage.indices.length; i += 3)
            if (lipKeys.has(cage.indices.slice(i, i + 3).join("/")))
              cage.groups[i / 3] = group;
          return {
            openings: [inner],
            finish: (refined) =>
              buildPortraitMouth(refined.positions, socket, shape),
          };
        },
      };
    },
  };
}

/**
 * Recess the mouth interior behind the photographed lip opening, then place
 * the supplied upper crowns along that opening's curved dental arch. Central crowns
 * are wider and taller; side crowns turn with the arch to remain behind the
 * mouth corners. Widths are authored estimates, in millimetres, not dental data.
 * Lips themselves remain in the shared facial mesh, preserving their skin join.
 */
export function buildPortraitMouth(
  source: number[][],
  socket: IPortraitMouthSocket,
  shape: IPortraitMouthShape,
): IAutoMovieModelPart[] {
  const parts: IAutoMovieModelPart[] = [];
  const add = (
    id: string,
    mesh: Parameters<typeof portraitPart>[1],
    finish: string,
  ): void => {
    parts.push(portraitPart(id, mesh, finish));
  };
  const landmark = (id: number): Point =>
    p(source[id][0], source[id][1], source[id][2]);
  const cavity = "mouth-interior",
    enamel = "teeth";
  const mouthUpper = socket.upper.map(landmark);
  const mouthLower = socket.lower.map(landmark);
  add(
    "oral-cavity",
    patch(
      (u, v) => {
        const top = interpolate(mouthUpper, u),
          bottom = interpolate(mouthLower, u);
        return p(
          mix(bottom.x, top.x, v),
          mix(bottom.y, top.y, v),
          mix(bottom.z, top.z, v) -
            shape.cavityDepth * (1 + 0.8 * Math.sin(pi * v)),
        );
      },
      100,
      30,
    ),
    cavity,
  );
  if (shape.crowns.length === 0) return parts;
  // Width is enamel size, not a pitch on the head's X axis. Walk the arch in
  // millimetres so rotating the side teeth cannot create artificial diastemata.
  const rowLength =
    shape.crowns.reduce((sum, crown) => sum + crown.width, 0) +
    shape.toothGap * (shape.crowns.length - 1);
  const arch = createPortraitDentalArc(mouthUpper, rowLength);
  let cursor = arch.center + shape.dentalOffset - rowLength / 2;
  for (let i = 0; i < shape.crowns.length; i++) {
    const { width, height } = shape.crowns[i];
    const { position: at, tangent } = arch.sample(cursor + width / 2);
    cursor += width + shape.toothGap;
    const angleY = -Math.atan2(tangent.z, tangent.x);
    const crown = buildPortraitDentalCrown({
      width,
      height,
      depth: shape.dentalDepth,
      cervicalWidth: shape.crowns[i].cervicalWidth ?? 0.78,
      edgeRise: shape.crowns[i].edgeRise ?? 0.035 * height,
    });
    // Placement and normals use the same rigid arch rotation. The local crown
    // profile therefore cannot silently change measured interdental clearance.
    for (let vertex = 0; vertex < crown.positions.length; vertex += 3) {
      const x = crown.positions[vertex],
        y = crown.positions[vertex + 1],
        z = crown.positions[vertex + 2];
      crown.positions[vertex] =
        at.x + Math.cos(angleY) * x + Math.sin(angleY) * z;
      crown.positions[vertex + 1] = at.y - shape.dentalDrop + y;
      crown.positions[vertex + 2] =
        at.z - shape.dentalRecess - Math.sin(angleY) * x + Math.cos(angleY) * z;
      const nx = crown.normals![vertex],
        nz = crown.normals![vertex + 2];
      crown.normals![vertex] = Math.cos(angleY) * nx + Math.sin(angleY) * nz;
      crown.normals![vertex + 2] =
        -Math.sin(angleY) * nx + Math.cos(angleY) * nz;
    }
    add(`tooth-${i}`, crown, enamel);
  }
  return parts;
}
