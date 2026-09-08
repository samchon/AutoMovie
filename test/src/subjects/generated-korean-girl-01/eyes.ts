import { createAutoMovieMeshDepthSampler } from "@automovie/engine";
import type {
  IAutoMovieModelPart,
  IAutoMovieVector3,
} from "@automovie/interface";

import { blendPortraitSkin } from "../blendPortraitSkin";
import {
  portraitSpline as interpolate,
  portraitMix as mix,
  portraitPoint as p,
  portraitPatch as patch,
  portraitPart,
  portraitRegion,
  portraitTube as tube,
} from "../geometry";
import {
  type IPortraitComponent,
  portraitFacesInsideLoop,
} from "../portraitComponents";
import { buildPortraitCornea } from "../portraitCornea";
import { createPortraitDirectionalContact } from "../portraitDirectionalContact";
import {
  type IPortraitEyeSphere,
  fitPortraitEyeSphere,
  portraitEyeSphereHeight,
  portraitEyeSphereIntersection,
} from "../portraitEyeSphere";
import type { IControlMesh } from "../subdivideControlMesh";
import {
  type IPortraitEyebrowProfile,
  assertPortraitEyebrowProfile,
  buildPortraitEyebrow,
  portraitEyebrowProfile,
} from "./eyebrows";
import {
  type IPortraitIrisPigment,
  createPortraitIrisMaterials,
} from "./irisPigment";
import {
  type IPortraitLowerLidProfile,
  type IPortraitLowerLidSection,
  createPortraitLowerLidProfile,
} from "./lowerLidSection";
import {
  type IPortraitOcularTissueShape,
  createPortraitOcularTissues,
} from "./ocularTissues";

type Point = IAutoMovieVector3;
const pi = Math.PI,
  tau = pi * 2;

/**
 * One subject-owned eye socket. Ordered lid curves run from negative to positive
 * local X; the component receives their identities instead of embedding them.
 *
 * @author Samchon
 */
export interface IPortraitEyeSocket {
  /** Anatomical side; positive host X is left. */
  name: "left" | "right";
  /** Upper aperture rim from negative X to positive X, including both corners. */
  top: number[];
  /** Lower rim in the same direction, including the same corner identities. */
  bottom: number[];
  /** Non-skin measured gaze marker. */
  iris: number;
  /** Upper brow boundary, in the same X order. */
  browTop: number[];
  /** Lower brow boundary, in the same X order. */
  browBottom: number[];
}

/**
 * Numerical eye shape independent of its host socket. Lengths are millimetres;
 * width/opening multipliers deform the fitted aperture, not an isolated eyeball.
 *
 * @author Samchon
 */
export interface IPortraitEyeShape {
  /** Multiplier of the socket aperture width; one retains its measured width. */
  widthScale: number;
  /** Multiplier of aperture height; one retains the measured opening. */
  openingScale: number;
  /** Upward outer-corner displacement, fading towards the inner corner, in mm. */
  outerCornerLift: number;
  /** Socket translation along the recorded camera ray, in mm. */
  socketLift: number;
  /** Geodesic reach of surrounding skin adaptation, in mm. */
  blendReach: number;
  /** Upper lid fold width, in mm. */
  foldWidth: number;
  /** Upper crease depth behind the lid ridge, in mm. */
  foldDepth: number;
  /** Additional upper tarsal volume in front of the aperture plane, in mm. */
  upperLidVolume: number;
  /** Width of the lower eyelid's soft-tissue transition, in mm. */
  lowerLidWidth: number;
  /** Peak lower-lid roll projection, in mm; independent of the upper fold. */
  lowerLidVolume: number;
  /**
   * Optional complete lower-tissue sections, ordered medial to lateral. The
   * section owns pretarsal body, subtarsal boundary and preseptal transition.
   * A sine fade blends it to the basic canthi; omission is the exact basic row
   * formula. Ocular contact owns its inner support; a separate final check
   * resolves residual penetration after shared refinement and surface layers.
   */
  lowerLidProfile?: IPortraitLowerLidProfile;
  /** Forward projection of the inner lid margin, in mm. */
  lidThickness: number;
  /** Spherical surface radius in mm; fitted in the socket plane independently of gaze. */
  surfaceRadius: number;
  /** Corneal curvature radius in mm; greater than iris radius and no greater than globe radius. */
  cornealRadius: number;
  /** Positive axial thickness of the closed anterior optical shell, in mm. */
  cornealThickness: number;
  /** Corneal rim's lift above the globe, in mm; clears the underlying iris surface. */
  cornealRimLift: number;
  /**
   * Closed optical boundary: omission or aperture retains visible-aperture
   * clipping; limbus keeps the complete circular cornea independent of the lids.
   * The latter separates optical anatomy from visibility. It does not itself
   * refit lid contact to the larger volume, which requires rendered inspection.
   */
  cornealBoundary?: "aperture" | "limbus";
  /**
   * Optional ocular contact basis. Omission or globe retains the basic rows;
   * cornea first places the inner section support on the actual full corneal
   * mesh along viewRay, then resolves residual refined-skin penetration with
   * lidThickness clearance. It requires limbus boundary and preserves the
   * recorded projection coordinates of each boundary contact.
   */
  lidContact?: "globe" | "cornea";
  /** Post-contact skin adaptation distance in mm; omission uses 3, zero retains pointwise contact. */
  lidContactReach?: number;
  /** Iris radius in mm before clipping against the fitted eyelid. */
  irisRadius: number;
  /** Pupil radius in mm; smaller than the iris. */
  pupilRadius: number;
  /** Optional instance-owned linear-RGB pigment; omission uses the shared legacy palette. */
  irisPigment?: IPortraitIrisPigment;
  /** Optional medial conjunctiva and lower lid margin; omission leaves them absent. */
  tissues?: IPortraitOcularTissueShape;
  /** Number of independently generated brow fibres, in [0,4096]; zero disables them. */
  browFibres: number;
  /** Optional fibre dimensions and skin clearance; omission uses the declared brow profile. */
  browProfile?: IPortraitEyebrowProfile;
  /** Number of upper lashes. */
  upperLashes: number;
  /** Tessellation controls, separate from the anatomical shape. */
  sampling: {
    eyeColumns: number;
    eyeRows: number;
    irisColumns: number;
    irisRows: number;
  };
}

const loopOf = (socket: IPortraitEyeSocket): number[] => [
  ...socket.bottom,
  ...socket.top.slice(1, -1).reverse(),
];

// One calculation supplies both the part boundary constraint and its lid rows.
// The host and the component therefore cannot disagree about the seam position.
const lidRows = (
  source: number[][],
  socket: IPortraitEyeSocket,
  shape: IPortraitEyeShape,
  outerDepths?: ReadonlyMap<number, number>,
  lowerProfile?: ReturnType<typeof createPortraitLowerLidProfile>,
  guide?: readonly (readonly number[])[],
) => {
  const loop = loopOf(socket);
  const frame = guide ?? source;
  const left = Math.min(...loop.map((id) => frame[id][0]));
  const right = Math.max(...loop.map((id) => frame[id][0]));
  return loop.map((id, index) => {
    const point = source[id];
    const nominal = frame[id];
    // The rim expands along its own planar normal, independently of gaze.
    // Counterclockwise boundary order gives the outward normal directly; the
    // iris marker does not participate in the surrounding skin's shape.
    const before = frame[loop[(index + loop.length - 1) % loop.length]];
    const after = frame[loop[(index + 1) % loop.length]];
    const nx = after[1] - before[1];
    const ny = before[0] - after[0];
    const distance = Math.hypot(nx, ny);
    const weight = socket.top.includes(id)
      ? Math.sin((pi * (nominal[0] - left)) / (right - left))
      : 0;
    const progress = (nominal[0] - left) / (right - left);
    const detail = socket.top.includes(id)
      ? undefined
      : lowerProfile?.(socket.name === "left" ? progress : 1 - progress);
    const at = (
      offset: number,
      depth: number,
      role?: Exclude<keyof IPortraitLowerLidSection, "attachment">,
    ): number[] => {
      if (detail !== undefined && role !== undefined) {
        // Replace this section point within the canthal boundary blend. The
        // old lower-roll depth is not added to the new anatomical projection.
        offset = offset * (1 - lowerWeight) + detail[role].offset * lowerWeight;
        depth =
          depth * (1 - lowerWeight) + detail[role].projection * lowerWeight;
      }
      const t = Math.min(1, offset / outerWidth),
        blend = t * t * (3 - 2 * t);
      return [
        guide === undefined
          ? point[0] + (offset * nx) / distance
          : nominal[0] +
            (offset * nx) / distance +
            (point[0] - nominal[0]) * (1 - blend),
        guide === undefined
          ? point[1] + (offset * ny) / distance
          : nominal[1] +
            (offset * ny) / distance +
            (point[1] - nominal[1]) * (1 - blend),
        mix(point[2], outerDepths?.get(id) ?? point[2], blend) + depth,
      ];
    };
    // Two nearby support rows delimit the supratarsal crease through common
    // Loop subdivision and retain its depth between the tarsal ridge and hood.
    // The hood sits above the recessed fold and produces a real cast shadow.
    // Weight fades the fold at both canthi and leaves the lower lid uncreased.
    const fold = shape.foldWidth * weight;
    const depth = shape.foldDepth * weight;
    const lowerWeight = socket.top.includes(id)
      ? 0
      : Math.sin((pi * (nominal[0] - left)) / (right - left));
    // This basic lower branch is only a two-control envelope. Its shared row
    // names below come from the upper-lid construction; they do not imply an
    // independently authored pretarsal body, subtarsal boundary or preseptal
    // section. In particular, corneal clearance added later is contact data,
    // not the anatomical definition of the lower roll. ../FACE-ANATOMY.md records
    // the missing detailed section and its lid/cheek boundary responsibilities.
    const lowerWidth = shape.lowerLidWidth * lowerWeight;
    const lowerVolume = shape.lowerLidVolume * lowerWeight;
    const basicWidth = 1.2 + (shape.foldWidth + 2.2) * weight + lowerWidth;
    const outerWidth =
      detail === undefined
        ? basicWidth
        : basicWidth * (1 - lowerWeight) + detail.attachment * lowerWeight;
    return {
      id,
      outer: at(outerWidth, -0.4 + 0.2 * weight),
      hoodUpper: at(
        1.0 + (shape.foldWidth + 1.1) * weight + 0.9 * lowerWidth,
        shape.lidThickness + 0.45 * depth + 0.1 * lowerVolume,
        "preseptal",
      ),
      hoodEdge: at(
        0.85 + fold + 0.75 * lowerWidth,
        shape.lidThickness + 0.5 * depth + 0.3 * lowerVolume,
        "subtarsalOuter",
      ),
      creaseOuter: at(
        0.65 + fold + 0.6 * lowerWidth,
        shape.lidThickness - depth + 0.6 * lowerVolume,
        "subtarsalInner",
      ),
      creaseInner: at(
        0.4 + fold + 0.45 * lowerWidth,
        shape.lidThickness - depth + lowerVolume,
        "pretarsalLower",
      ),
      tarsal: at(
        0.35 + 0.55 * fold + 0.3 * lowerWidth,
        shape.lidThickness +
          0.2 * depth +
          shape.upperLidVolume * weight +
          lowerVolume,
        "pretarsalCrest",
      ),
      ridge: at(0.18, shape.lidThickness + 0.08, "margin"),
      inner: [point[0], point[1], point[2] + shape.lidThickness],
    };
  });
};

/** Fit one replaceable eye and expose its actual outer lid as the skin seam. */
export function createPortraitEyeComponent(
  inputSocket: IPortraitEyeSocket,
  inputShape: IPortraitEyeShape,
): IPortraitComponent {
  // A fitted component owns its inputs. Editing a preset for another instance
  // must not silently mutate an already constructed eye.
  const socket = {
    ...inputSocket,
    top: [...inputSocket.top],
    bottom: [...inputSocket.bottom],
    browTop: [...inputSocket.browTop],
    browBottom: [...inputSocket.browBottom],
  };
  const shape = {
    ...inputShape,
    sampling: { ...inputShape.sampling },
    browProfile: { ...(inputShape.browProfile ?? portraitEyebrowProfile) },
    tissues:
      inputShape.tissues === undefined ? undefined : { ...inputShape.tissues },
  };
  // Build/validate once and retain the copied dimensions through fitting. Both
  // visible tissue surfaces will consume this eye's final refined boundary.
  const tissues =
    shape.tissues === undefined
      ? undefined
      : createPortraitOcularTissues(shape.tissues);
  const lowerProfile =
    inputShape.lowerLidProfile === undefined
      ? undefined
      : createPortraitLowerLidProfile(inputShape.lowerLidProfile);
  assertPortraitEyebrowProfile(shape.browProfile, shape.browFibres);
  if (
    shape.lidContactReach !== undefined &&
    (!Number.isFinite(shape.lidContactReach) || shape.lidContactReach < 0)
  )
    throw new Error("Lid contact reach must be finite and nonnegative.");
  if (
    (shape.lidContact !== undefined &&
      shape.lidContact !== "globe" &&
      shape.lidContact !== "cornea") ||
    (shape.lidContact === "cornea" && shape.cornealBoundary !== "limbus")
  )
    throw new Error(
      "Corneal lid contact requires a full limbus; other contact modes must be globe or omitted.",
    );
  if (
    shape.cornealBoundary !== undefined &&
    shape.cornealBoundary !== "aperture" &&
    shape.cornealBoundary !== "limbus"
  )
    throw new Error(
      "Corneal boundary must be aperture or limbus when supplied.",
    );
  const positive = [
    shape.widthScale,
    shape.openingScale,
    shape.irisRadius,
    shape.pupilRadius,
    shape.surfaceRadius,
    shape.cornealRadius,
    shape.cornealThickness,
    shape.cornealRimLift,
  ];
  const nonnegative = [
    shape.blendReach,
    shape.foldWidth,
    shape.foldDepth,
    shape.upperLidVolume,
    shape.lowerLidWidth,
    shape.lowerLidVolume,
    shape.lidThickness,
  ];
  const counts = [shape.upperLashes, ...Object.values(shape.sampling)];
  if (
    positive.some((v) => !Number.isFinite(v) || v <= 0) ||
    nonnegative.some((v) => !Number.isFinite(v) || v < 0) ||
    counts.some((v) => !Number.isInteger(v) || v < 1) ||
    !Number.isFinite(shape.socketLift) ||
    !Number.isFinite(shape.outerCornerLift) ||
    shape.pupilRadius >= shape.irisRadius ||
    shape.cornealRadius <= shape.irisRadius ||
    shape.cornealRadius > shape.surfaceRadius ||
    shape.cornealRimLift <= shape.cornealThickness + 0.055 ||
    shape.sampling.eyeColumns < 2 ||
    shape.sampling.irisColumns < 3
  )
    throw new Error(
      "Eye dimensions must be finite, with a positive aperture and pupil inside the iris.",
    );
  return {
    id: socket.name + "-eye",
    // Each optical volume owns its material so changing one shell's thickness
    // cannot leave a shared global thickness behind on either eye.
    materials: [
      {
        id: socket.name + "-cornea",
        name: socket.name + " corneal surface",
        baseColor: { r: 1, g: 1, b: 1, a: 1, hex: null },
        roughness: 0.035,
        metallic: 0,
        opacity: 1,
        emissive: null,
        baseColorTexture: null,
        doubleSided: true,
        transmission: 1,
        ior: 1.376,
        thickness: shape.cornealThickness / 1000,
      },
      // Preserve the optical material's established first slot; additive
      // pigment ownership appends materials without moving that existing entry.
      ...(shape.irisPigment === undefined
        ? []
        : createPortraitIrisMaterials(
            socket.name + "-iris",
            shape.irisPigment,
          )),
    ],
    fit: (host) => {
      const loop = loopOf(socket);
      const points = loop.map((id) => host.positions[id]);
      const left = Math.min(...points.map((p) => p[0])),
        right = Math.max(...points.map((p) => p[0]));
      const middleX = (left + right) / 2;
      const middleY =
        (Math.min(...points.map((p) => p[1])) +
          Math.max(...points.map((p) => p[1]))) /
        2;
      const aperture = host.positions.map((point) => [...point]);
      for (const id of loop) {
        const point = host.positions[id],
          u = (point[0] - left) / (right - left);
        const outer = socket.name === "left" ? u : 1 - u;
        aperture[id] = [
          middleX + (point[0] - middleX) * shape.widthScale,
          middleY +
            (point[1] - middleY) * shape.openingScale +
            shape.outerCornerLift * outer,
          point[2],
        ].map((value, axis) => value + shape.socketLift * host.viewRay[axis]);
      }
      aperture[socket.iris] = host.positions[socket.iris].map(
        (value, axis) => value + shape.socketLift * host.viewRay[axis],
      );
      const direction = p(host.viewRay[0], host.viewRay[1], host.viewRay[2]);
      const pointAt = (id: number): Point =>
        p(aperture[id][0], aperture[id][1], aperture[id][2]);
      const sphere = fitPortraitEyeSphere(
        socket.top.map(pointAt),
        socket.bottom.map(pointAt),
        direction,
        shape.surfaceRadius,
      );
      // The lid section starts at its actual ocular contact, not at a lower
      // globe surface that will later be pushed through a raised cornea. A
      // post-refinement collision correction alone leaves a local platform:
      // its movement never informed the tissue bridge constructed below.
      // Use the same resident optical builder and recorded projection ray as
      // the final contact check. Section thickness is added by the lid rows,
      // so this boundary query uses zero extra clearance, avoiding two copies.
      const contactBoundary =
        shape.lidContact !== "cornea"
          ? undefined
          : createPortraitDirectionalContact(
              portraitPart(
                "corneal-attachment-basis",
                eyeCornea(
                  portraitEyeSphereIntersection(
                    sphere,
                    pointAt(socket.iris),
                    direction,
                  ),
                  sphere,
                  shape,
                  [],
                ),
                "skin",
              ).geometry.mesh,
              direction,
            );
      // Corneal contact must not redefine the gaze-independent outer seam.
      // Retain the sphere-projected aperture as its planar guide, then fade
      // inner contact's XY movement to zero across the tissue bridge.
      const apertureGuide =
        contactBoundary === undefined
          ? undefined
          : aperture.map((point) => [...point]);
      for (const id of loop) {
        const contact = portraitEyeSphereIntersection(
          sphere,
          pointAt(id),
          direction,
        );
        if (apertureGuide !== undefined)
          apertureGuide[id] = [contact.x, contact.y, contact.z];
        if (contactBoundary === undefined)
          aperture[id] = [contact.x, contact.y, contact.z];
        else {
          const metric = p(
            contact.x / 1000,
            contact.y / 1000,
            contact.z / 1000,
          );
          const boundary = contactBoundary(metric);
          // A missed/clear sample keeps the original double coordinates
          // exactly, rather than introducing an unnecessary unit round trip.
          aperture[id] =
            boundary === metric
              ? [contact.x, contact.y, contact.z]
              : [boundary.x * 1000, boundary.y * 1000, boundary.z * 1000];
        }
      }
      // The outer eyelid attaches to the actual supporting skin. Its section
      // bridges that depth to the fitted ocular contact instead of extruding a flat
      // annulus from the aperture. The two boundaries keep distinct ownership.
      const support = createAutoMovieMeshDepthSampler(
        portraitPart(
          "orbital-support-basis",
          {
            positions: host.positions.flat(),
            indices: host.indices,
            normals: null,
            uvs: null,
            skin: null,
          },
          "skin",
        ).geometry.mesh,
        "z",
      );
      return {
        constraints: [
          ...lidRows(
            aperture,
            socket,
            shape,
            undefined,
            lowerProfile,
            apertureGuide,
          ).map((row) => {
            const hit = support(row.outer[0] / 1000, row.outer[1] / 1000);
            if (hit === null)
              throw new Error(
                "An eyelid's outer attachment must remain on supporting skin.",
              );
            return {
              vertex: row.id,
              target: [
                row.outer[0],
                row.outer[1],
                hit.maximum * 1000 + shape.socketLift * host.viewRay[2],
              ],
              reach: shape.blendReach,
            };
          }),
          { vertex: socket.iris, target: aperture[socket.iris], reach: 0 },
        ],
        cutFaces: portraitFacesInsideLoop(host, loop),
        attach: (cage, _adapted, region) => {
          const lidGroup =
            shape.lidContact === "cornea"
              ? region(socket.name + "-eyelids", "skin")
              : 0;
          const margins = appendPortraitEyeMargins(
            cage,
            aperture,
            socket,
            shape,
            lidGroup,
            lowerProfile,
            apertureGuide,
          );
          return {
            openings: [loopOf(socket).map((id) => margins.get(id)!)],
            finalSurface:
              shape.lidContact !== "cornea"
                ? undefined
                : (final) => {
                    const gaze = final.positions[socket.iris];
                    const center = portraitEyeSphereIntersection(
                      sphere,
                      p(gaze[0], gaze[1], gaze[2]),
                      direction,
                    );
                    const optical = portraitPart(
                      "corneal-contact-basis",
                      eyeCornea(center, sphere, shape, []),
                      "skin",
                    ).geometry.mesh;
                    const contact = createPortraitDirectionalContact(
                      optical,
                      direction,
                      shape.lidThickness / 1000,
                    );
                    const vertices = new Set<number>();
                    for (let i = 0; i < final.groups.length; i++)
                      if (final.groups[i] === lidGroup)
                        for (const vertex of final.indices.slice(
                          3 * i,
                          3 * i + 3,
                        ))
                          vertices.add(vertex);
                    const constraints = [...vertices].flatMap((vertex) => {
                      const source = final.positions[vertex];
                      const point = p(
                        source[0] / 1000,
                        source[1] / 1000,
                        source[2] / 1000,
                      );
                      const target = contact(point);
                      return target === point
                        ? []
                        : [
                            {
                              vertex,
                              reach: shape.lidContactReach ?? 3,
                              target: [
                                target.x * 1000,
                                target.y * 1000,
                                target.z * 1000,
                              ],
                            },
                          ];
                    });
                    // Contact fixes the required points; the same geodesic skin
                    // adapter used by initial component fitting carries their
                    // movement into surrounding tissue. A pointwise clamp alone
                    // leaves a hard platform at the optical footprint boundary.
                    const adapted = blendPortraitSkin(
                      final.positions.map((point) => [...point]),
                      [...final.indices],
                      constraints,
                    );
                    return adapted.flatMap((target, vertex) =>
                      target.some(
                        (value, axis) =>
                          value !== final.positions[vertex][axis],
                      )
                        ? [{ vertex, target }]
                        : [],
                    );
                  },
            finish: (refined) =>
              buildPortraitEye(
                refined.positions,
                refined,
                margins,
                host.viewRay,
                socket,
                shape,
                sphere,
                tissues,
              ),
          };
        },
      };
    },
  };
}

/**
 * Attach the lid rows to the already fitted shared outer rim. New inner vertex
 * identities are returned for the eyeball to read after common subdivision.
 * The optional group is a registered host skin region; omission retains zero.
 * An optional sphere-projected guide retains the gaze-independent outer seam
 * while the supplied aperture carries the inner ocular contact. Their XY
 * difference fades to zero across the same section bridge as its depth.
 */
export function appendPortraitEyeMargins(
  cage: IControlMesh,
  aperture: number[][],
  socket: IPortraitEyeSocket,
  shape: IPortraitEyeShape,
  group = 0,
  lowerProfile = shape.lowerLidProfile === undefined
    ? undefined
    : createPortraitLowerLidProfile(shape.lowerLidProfile),
  guide?: readonly (readonly number[])[],
): Map<number, number> {
  const rows = lidRows(
    aperture,
    socket,
    shape,
    new Map(loopOf(socket).map((id) => [id, cage.positions[id][2]])),
    lowerProfile,
    guide,
  );
  const margins = new Map<number, number>();
  const rings = [rows.map((row) => row.id)];
  for (const name of [
    "hoodUpper",
    "hoodEdge",
    "creaseOuter",
    "creaseInner",
    "tarsal",
    "ridge",
    "inner",
  ] as const)
    rings.push(rows.map((row) => cage.positions.push(row[name]) - 1));
  for (let i = 0; i < rows.length; i++)
    margins.set(rows[i].id, rings[rings.length - 1][i]);
  for (let ring = 0; ring < rings.length - 1; ring++)
    for (let i = 0; i < rows.length; i++) {
      const j = (i + 1) % rows.length;
      cage.indices.push(
        rings[ring][i],
        rings[ring][j],
        rings[ring + 1][i],
        rings[ring][j],
        rings[ring + 1][j],
        rings[ring + 1][i],
      );
      cage.groups.push(group, group);
    }
  return margins;
}

/** Build the sclera, gaze, iris, lashes and brow against this eye's refined rim. */
export function buildPortraitEye(
  source: number[][],
  refined: IControlMesh,
  eyeMargins: ReadonlyMap<number, number>,
  viewRay: number[],
  socket: IPortraitEyeSocket,
  shape: IPortraitEyeShape,
  sphere: IPortraitEyeSphere,
  tissues?: ReturnType<typeof createPortraitOcularTissues>,
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
  const white = "sclera",
    pupil = "pupil",
    brow = "brows";
  const eye = socket;
  {
    const margin = (id: number): Point => {
      const point = refined.positions[eyeMargins.get(id)!];
      return p(point[0], point[1], point[2]);
    };
    const upper = eye.top.map(margin),
      lower = eye.bottom.map(margin);
    const lidSamples = [lower, upper].map((points) =>
      Array.from({ length: 257 }, (_, i) => {
        const x = mix(points[0].x, points[points.length - 1].x, i / 256);
        let low = 0,
          high = 1;
        for (let iteration = 0; iteration < 18; iteration++) {
          const t = (low + high) / 2;
          if (interpolate(points, t).x < x) low = t;
          else high = t;
        }
        return interpolate(points, (low + high) / 2);
      }),
    );
    const lidAt = (x: number, points: Point[]): Point => {
      const samples = lidSamples[points === lower ? 0 : 1];
      const t = Math.max(
        0,
        Math.min(
          256,
          (256 * (x - points[0].x)) /
            (points[points.length - 1].x - points[0].x),
        ),
      );
      const i = Math.min(255, Math.floor(t));
      return p(
        x,
        mix(samples[i].y, samples[i + 1].y, t - i),
        mix(samples[i].z, samples[i + 1].z, t - i),
      );
    };
    // Spherical curvature is independent of aperture height and gaze. The
    // fitted lid alone determines how much of that surface remains visible.
    const eyeZ = (x: number, y: number): number =>
      portraitEyeSphereHeight(sphere, x, y);
    const sclera = patch(
      (u, v) => {
        const top = interpolate(upper, u),
          bottom = interpolate(lower, u);
        const x = mix(bottom.x, top.x, v),
          y = mix(bottom.y, top.y, v);
        return p(x, y, eyeZ(x, y));
      },
      shape.sampling.eyeColumns,
      shape.sampling.eyeRows,
    );
    // The sclera owns an exact spherical surface: grad(|p-c|^2-r^2)
    // points along p-c, and |p-c|=r. Divide construction millimetres by
    // radius millimetres to obtain dimensionless outward unit normals. This
    // remains defined at a collapsed canthal row where triangle-area averaging
    // has no direction, and avoids a sampling-dependent optical normal field.
    const sphereCenter = [sphere.center.x, sphere.center.y, sphere.center.z];
    sclera.normals = sclera.positions.map(
      (value, index) => (value - sphereCenter[index % 3]) / sphere.radius,
    );
    add(`${eye.name}-sclera`, sclera, white);
    if (tissues !== undefined) {
      const surfaces = tissues({
        side: eye.name,
        minimumX: lower[0].x,
        maximumX: lower[lower.length - 1].x,
        lower: (x) => lidAt(x, lower),
        upper: (x) => lidAt(x, upper),
        globe: eyeZ,
      });
      if (surfaces.corner !== null)
        add(`${eye.name}-medial-conjunctiva`, surfaces.corner, "ocular-corner");
      if (surfaces.lowerMargin !== null)
        add(
          `${eye.name}-lower-lid-margin`,
          surfaces.lowerMargin,
          "ocular-margin",
        );
    }
    // The detector's iris depth differs from the eye surface depth. Simply
    // replacing Z moves the apparent gaze in the reference camera. Intersect
    // its measured ray instead, retaining the photographed iris centre in XY.
    const center = portraitEyeSphereIntersection(
      sphere,
      landmark(eye.iris),
      p(viewRay[0], viewRay[1], viewRay[2]),
    );
    for (const [name, radius] of [
      ["iris", shape.irisRadius],
      ["pupil", shape.pupilRadius],
    ] as const) {
      // All radial samples on one ray share the same clipped endpoint. Solve
      // it once per angular column, retaining the exact same ray and bisection.
      const extents = Array.from(
        { length: shape.sampling.irisColumns + 1 },
        (_, column) => {
          const angle = tau * (column / shape.sampling.irisColumns);
          const inside = (r: number): boolean => {
            const x = center.x + r * Math.cos(angle),
              y = center.y - r * Math.sin(angle);
            return (
              y >= lidAt(x, lower).y + 0.15 && y <= lidAt(x, upper).y - 0.15
            );
          };
          let extent: number = radius;
          if (!inside(radius)) {
            let low = 0,
              high: number = radius;
            for (let i = 0; i < 24; i++) {
              const r = (low + high) / 2;
              if (inside(r)) low = r;
              else high = r;
            }
            extent = (low + high) / 2;
          }
          return extent;
        },
      );
      const mesh = patch(
        (u, v) => {
          const angle = tau * u;
          const extent = extents[Math.round(u * shape.sampling.irisColumns)];
          const x = center.x + extent * (0.0001 + 0.9999 * v) * Math.cos(angle),
            y = center.y - extent * (0.0001 + 0.9999 * v) * Math.sin(angle);
          return p(x, y, eyeZ(x, y) + (name === "pupil" ? 0.09 : 0.055));
        },
        shape.sampling.irisColumns,
        shape.sampling.irisRows,
      );
      if (name === "pupil") add(`${eye.name}-pupil`, mesh, pupil);
      else {
        add(
          `${eye.name}-cornea`,
          eyeCornea(center, sphere, shape, extents.slice(0, -1)),
          eye.name + "-cornea",
        );
        // Pigment follows radial fibres. The outer 13 percent forms a dark
        // limbal ring; the inner bands vary in brown. All regions retain the
        // exact same positions and normals, so this edit cannot enlarge an eye.
        const regions = Array.from({ length: 8 }, () => [] as number[]);
        for (let i = 0; i < mesh.indices!.length; i += 6) {
          const cell = i / 6;
          const angle =
            (tau * ((cell % shape.sampling.irisColumns) + 0.5)) /
            shape.sampling.irisColumns;
          const radius =
            (Math.floor(cell / shape.sampling.irisColumns) + 0.5) /
            shape.sampling.irisRows;
          const fiber =
            0.48 +
            0.23 * Math.sin(angle * 37 + radius * 7) +
            0.17 * Math.sin(angle * 71 - radius * 11) +
            0.12 * Math.cos(angle * 13);
          const group =
            radius > 0.87 ? 0 : Math.max(0, Math.min(7, Math.floor(fiber * 8)));
          regions[group].push(...mesh.indices!.slice(i, i + 6));
        }
        regions.forEach((indices, group) =>
          add(
            `${eye.name}-iris-${group}`,
            portraitRegion(mesh.positions, mesh.normals!, indices),
            `${shape.irisPigment === undefined ? "iris" : eye.name + "-iris"}-${group}`,
          ),
        );
      }
    }
    add(
      `${eye.name}-lash-line`,
      tube(
        (t) => {
          const point = interpolate(upper, t);
          return p(point.x, point.y, point.z + 0.04);
        },
        (t) => 0.06 + 0.16 * Math.sin(pi * t),
        70,
      ),
      brow,
    );
    // Short curled upper lashes belong to the eyelid, not the deferred scalp
    // hairstyle. They project in front of the measured rim, so their shadows
    // affect the eye without changing the opening's geometric silhouette.
    const outward = eye.name === "left" ? 1 : -1;
    for (let i = 0; i < shape.upperLashes; i++) {
      const u = 0.04 + (0.92 * (i + 0.5)) / shape.upperLashes;
      const origin = interpolate(upper, u);
      const length = 0.5 + (eye.name === "left" ? u : 1 - u);
      add(
        `${eye.name}-upper-lash-${i}`,
        tube(
          (t) =>
            p(
              origin.x + outward * 0.25 * length * t,
              origin.y + 0.45 * length * t * t,
              origin.z + 0.05 + length * t,
            ),
          (t) => 0.055 * (1 - 0.9 * t),
          6,
        ),
        brow,
      );
    }
    parts.push(
      ...buildPortraitEyebrow(
        refined,
        { side: eye.name, upper: eye.browTop, lower: eye.browBottom },
        shape.browFibres,
        shape.browProfile,
      ),
    );
  }
  return parts;
}

// Drawing and contact construct the same closed optical shell. The complete
// limbus is independent of aperture clipping; both consumers retain its sphere,
// gaze centre, radii, thickness and sampling before any eyelid is projected.
function eyeCornea(
  center: Point,
  sphere: IPortraitEyeSphere,
  shape: IPortraitEyeShape,
  extents: number[],
) {
  return buildPortraitCornea({
    center,
    radius: shape.irisRadius,
    curvature: shape.cornealRadius,
    globeRadius: shape.surfaceRadius,
    thickness: shape.cornealThickness,
    rimLift: shape.cornealRimLift,
    extents:
      shape.cornealBoundary === "limbus"
        ? new Array(shape.sampling.irisColumns).fill(shape.irisRadius)
        : extents,
    radialSamples: shape.sampling.irisRows,
    surface: (x, y) => portraitEyeSphereHeight(sphere, x, y),
  });
}
