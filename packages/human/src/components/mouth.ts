/**
 * Fit a replaceable lip band and publish its shared skin/lining boundaries.
 * buildHumanFace and direct component callers provide subject-owned socket
 * identities and millimetre shape values in head coordinates (+Z anterior).
 * Admission copies caller settings; fit reads an immutable host and returns
 * constraints/cuts; attachment only labels the assembly cage's lip triangles.
 * The refined-rim finisher delegates to mouthInterior after shared subdivision,
 * so the lining consumes the actual opening and material-owned connectivity.
 * Separate dental components own performed teeth; legacy crowns are refused
 * with performance. Changing the fitted band invalidates lining, material
 * coordinates and downstream normals. This owner does not certify likeness.
 */
import type { IAutoMovieVector3 } from "@automovie/interface";

import { portraitPoint as p } from "../geometry/geometry";
import {
  type IPortraitComponent,
  portraitFacesInsideLoop,
} from "../geometry/portraitComponents";
import {
  type IPortraitDentalCrown,
  assertPortraitDentalCrown,
} from "./dentalCrown";
import {
  type IPortraitLipBandKnot,
  type IPortraitLipSection,
  createPortraitLipBandSampler,
  createPortraitLipBandScale,
  createPortraitLipSection,
} from "./lipSection";
import { buildPortraitMouth } from "./mouthInterior";
import {
  type IPortraitMouthPerformance,
  createPortraitMouthPerformance,
} from "./mouthPerformance";
import {
  type IPortraitOralChamber,
  assertPortraitOralLining,
} from "./oralLining";

export { buildPortraitMouth } from "./mouthInterior";

type Point = IAutoMovieVector3;

/**
 * Subject-owned oral boundaries. Upper and lower curves share their endpoints
 * and run from negative to positive X. No landmark identity belongs to the
 * replaceable mouth implementation.
 *
 * @author Samchon
 * @evidence requirements/actors/facial-authoring/contract.md#actor-face-anatomical-components Binds a replaceable mouth to common outer vermilion and inner oral boundaries.
 * @evidence specifications/asset-and-representation/facial-authoring/contract.md#face-spec-components Defines ordered shared-corner upper/lower rims and a strictly interior lip-band seed without embedding landmark numbers.
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
 * @evidence requirements/actors/facial-authoring/contract.md#actor-face-anatomical-components Separates lip width, aperture, thickness, relief, cavity and optional legacy enamel dimensions.
 * @evidence specifications/asset-and-representation/facial-authoring/contract.md#face-spec-components Carries metric oral controls, replaceable band/section profiles and individual crown settings relative to the caller's socket.
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
  /**
   * Shared oral-rim projection in host Z, in mm. Positive advances the contact
   * line and negative deepens it, without moving the outer vermilion boundary
   * or changing aperture XY. Smoothly fades through both lip bands and at the
   * corners. Omission is zero; closed paired rims stay coincident.
   */
  seamProjection?: number;
  /** Optional body and tubercle relief between the existing lip boundaries. */
  section?: IPortraitLipSection;
  /**
   * Optional upper/lower thickness ratios over the curved mouth. A scalar sets
   * the centre; a knot array states a nonuniform profile. Omission is identity.
   * Both preserve the existing oral opening and corner positions. The outer
   * cutaneous boundary and neighbouring skin follow the resulting band shape.
   */
  band?: {
    upper?: number | readonly IPortraitLipBandKnot[];
    lower?: number | readonly IPortraitLipBandKnot[];
  };
  /**
   * Optional cutaneous-vermilion boundary refinement. `curve` gives this
   * closed boundary its own cubic subdivision rule while sharing it with the
   * adjoining skin. Omission or `surface` uses the general surface weights.
   * This retains the inner boundary's refinement rule and adds no pigment
   * overlay. Later rounds can propagate the new outer positions into adjacent
   * lip vertices, so final inner-rim coordinates still require comparison.
   */
  borderRefinement?: "surface" | "curve";
  /** Geodesic reach of surrounding skin adaptation. */
  blendReach: number;
  /** Recession of the oral cavity behind the actual refined opening. */
  cavityDepth: number;
  /**
   * Optional straight-wall fraction [0,0.95] before the posterior cosine taper.
   * Selecting a fraction joins the actual refined oral rim to an enclosure at
   * 1.8 cavityDepth in head -Z. Zero starts tapering at the rim; omission keeps
   * the legacy detached backdrop. This does not set tongue or dental placement.
   */
  cavityWall?: number;
  /** Optional internal room beyond the vestibule. Requires explicit cavityWall; never moves teeth or the lip rim. */
  cavityChamber?: IPortraitOralChamber;
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
    /** Optional proximal detail, oriented by the common dental arch. */
    contour?: IPortraitDentalCrown["contour"];
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
 * @evidence requirements/actors/facial-authoring/contract.md#actor-face-anatomical-components Keeps the vermilion material bound to the complete connected anatomical band.
 * @evidence specifications/asset-and-representation/facial-authoring/contract.md#face-spec-components Floods triangle adjacency from an interior seed while treating both outer lip and inner mouth loops as uncrossable barriers.
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

/**
 * Fit the lips, adapt adjacent skin and finish the selected oral interior at
 * the refined rim. A connected lining receives only the final lip triangles,
 * retaining every refined boundary vertex without scanning the whole head.
 *
 * @evidence requirements/actors/facial-authoring/contract.md#actor-face-anatomical-components Fits shared lips and adjacent skin, with separate maxillary teeth required during oral performance.
 * @evidence specifications/asset-and-representation/facial-authoring/contract.md#face-spec-components Copies oral settings, applies curved-band thickness and observed-relative motion, and passes final lip-group connectivity to a selected oral lining.
 */
export function createPortraitMouthComponent(
  inputSocket: IPortraitMouthSocket,
  inputShape: IPortraitMouthShape,
  inputPerformance?: IPortraitMouthPerformance,
): IPortraitComponent {
  const performance =
    inputPerformance === undefined
      ? undefined
      : structuredClone(inputPerformance);
  if (performance !== undefined && inputShape.crowns.length !== 0)
    throw new Error(
      "Oral performance requires separate maxillary dentition, not crowns attached to the moving lip.",
    );
  const socket = {
    ...inputSocket,
    outer: [...inputSocket.outer],
    upper: [...inputSocket.upper],
    lower: [...inputSocket.lower],
  };
  const shape = {
    ...inputShape,
    crowns: structuredClone(inputShape.crowns),
    cavityChamber:
      inputShape.cavityChamber === undefined
        ? undefined
        : structuredClone(inputShape.cavityChamber),
  };
  const seamProjection =
    shape.seamProjection === undefined ? 0 : shape.seamProjection;
  const section =
    inputShape.section === undefined
      ? undefined
      : createPortraitLipSection(inputShape.section);
  const upperBand = createPortraitLipBandScale(inputShape.band?.upper);
  const lowerBand = createPortraitLipBandScale(inputShape.band?.lower);
  if (shape.cavityWall !== undefined || shape.cavityChamber !== undefined)
    assertPortraitOralLining(
      shape.cavityDepth,
      shape.cavityWall!,
      shape.cavityChamber,
    );
  if (
    shape.borderRefinement !== undefined &&
    shape.borderRefinement !== "surface" &&
    shape.borderRefinement !== "curve"
  )
    throw new Error("Lip border refinement must be surface or curve.");
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
      seamProjection,
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
      const coordinate = createPortraitLipBandSampler(
        socket.outer.map((id) => host.positions[id]),
        socket.upper.map((id) => host.positions[id]),
        socket.lower.map((id) => host.positions[id]),
      );
      let constraints = [...skin].map((vertex) => {
        const point = host.positions[vertex];
        const band = coordinate(point);
        const local = band.coordinate;
        const ratio = (local.side === "upper" ? upperBand : lowerBand)(
          local.lateral,
        );
        // Identity keeps the original coordinate exactly. Detail scales the
        // curved band about its actual oral boundary, not about the head's Y.
        const height =
          ratio === 1
            ? point[1]
            : band.innerY + (point[1] - band.innerY) * ratio;
        const corner = Math.min(
          1,
          Math.abs((point[0] - centerX) / ((right - left) / 2)),
        );
        return {
          vertex,
          target: [
            centerX + (point[0] - centerX) * shape.widthScale,
            centerY +
              (height - centerY) * shape.openingScale +
              shape.cornerLift * corner ** 2,
            point[2] +
              (local.side === "upper"
                ? shape.upperLipProjection
                : shape.lowerLipProjection) *
                (1 - corner ** 2) +
              (section?.(local) ?? 0) +
              seamProjection *
                (1 - local.lateral ** 2) ** 2 *
                local.across ** 2 *
                (3 - 2 * local.across),
          ],
          reach: shape.blendReach,
        };
      });
      if (performance !== undefined) {
        const targets = new Map(
          constraints.map((constraint) => [
            constraint.vertex,
            constraint.target,
          ]),
        );
        const point = (id: number) =>
          p(...(targets.get(id)! as [number, number, number]));
        const pose = createPortraitMouthPerformance(
          socket.upper.map(point),
          socket.lower.map(point),
          performance,
        );
        const rims = new Map<number, Point>();
        for (const side of ["upper", "lower"] as const)
          socket[side].forEach((id, i) => rims.set(id, pose[side][i]));
        constraints = constraints.map((constraint) => {
          const target =
            rims.get(constraint.vertex) ??
            pose.move(
              point(constraint.vertex),
              coordinate(host.positions[constraint.vertex]).coordinate.side,
            );
          return { ...constraint, target: [target.x, target.y, target.z] };
        });
      }
      return {
        constraints,
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
            closures:
              performance?.lipPart === 0 &&
              (performance.jaw?.current ?? 0) === 0
                ? [inner[0]]
                : undefined,
            curves:
              shape.borderRefinement === "curve" ? [socket.outer] : undefined,
            finish: (refined) =>
              buildPortraitMouth(
                refined.positions,
                socket,
                shape,
                performance,
                shape.cavityWall === undefined
                  ? undefined
                  : refined.indices.filter(
                      (_vertex, i) =>
                        refined.groups[Math.floor(i / 3)] === group,
                    ),
              ),
          };
        },
      };
    },
  };
}
