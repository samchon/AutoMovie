import { portraitNormals } from "../geometry/geometry";
import type { IPortraitComponent } from "../geometry/portraitComponents";
import type { IControlMesh } from "../geometry/subdivideControlMesh";
import type { IPortraitNasalBodyShape } from "./nasalBody";
import { createPortraitNasalBodySurface } from "./nasalBodySurface";
import {
  type IPortraitNasalEnvelope,
  createPortraitNasalEnvelope,
} from "./nasalEnvelope";
import {
  type IPortraitNasalLobule,
  createPortraitNasalLobules,
} from "./nasalLobule";
import {
  type IPortraitNasalRimSection,
  appendPortraitNasalRimSection,
  createPortraitNasalRimSection,
} from "./nasalRimSection";
import {
  type IPortraitNasalSection,
  createPortraitNasalSection,
} from "./nasalSection";
import { createPortraitNasalSupport } from "./nasalSupport";
import { fitPortraitNostrilRim, resizePortraitNostrilRim } from "./nostrilRim";

/**
 * Subject-owned nasal attachment. The two cut populations are triangle ordinals
 * on the measured host, fixed before a component deforms its openings.
 *
 * @author Samchon
 * @evidence requirements/actors/facial-authoring/contract.md#actor-face-anatomical-components Binds replaceable nasal skin and openings to the caller's host rather than embedding a person's coordinates.
 * @evidence specifications/asset-and-representation/facial-authoring/contract.md#face-spec-components Defines the midline, relief support locations, surface vertices, original cut-face ordinals and optional section/support datums.
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
  /** Three retained skin datums spanning the nasal root and paired facial base. */
  supportPlane?: readonly number[];
}

/**
 * Numerical nasal shape. Width and opening scales change the shared rim; the
 * same changed vertices seed the surrounding skin blend and recessed cavity.
 *
 * @author Samchon
 * @evidence requirements/actors/facial-authoring/contract.md#actor-face-anatomical-components Separates nasal body, tip, alae, nostril aperture, rim tissue and cavity dimensions.
 * @evidence specifications/asset-and-representation/facial-authoring/contract.md#face-spec-components Carries explicit alternative depth bases plus coupled opening scales, tilt, rim refinement and lining controls on the same host.
 */
export interface IPortraitNoseShape {
  /** Width multiplier about the socket midline. */
  widthScale: number;
  /**
   * Optional projection ratio relative to the socket's common skin support
   * plane. Omission/one is identity. Positive smaller values reduce the entire
   * nose's inferred depth, including the samples used by rim fitting. This is
   * a basis replacement and cannot combine with another complete section/body
   * basis. Local final-body lobules may use the scaled datums.
   */
  depthScale?: number;
  /** Optional local tip/alar sections after support scaling; empty/omitted is identity. */
  lobules?: readonly IPortraitNasalLobule[];
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
  /**
   * Optional shared anatomical-curve refinement of each aperture. Omission or
   * surface retains general Loop weights; curve uses the host's existing 1D
   * rule on the same skin/lining vertices, without creating a normal crease.
   */
  rimRefinement?: "surface" | "curve";
  /** Optional exterior skin band; omission retains direct skin-to-lining attachment. */
  rimSection?: IPortraitNasalRimSection;
  /**
   * Optional complete envelope per opening, in socket.nostrils order. Empty or
   * omitted retains legacy construction. Each envelope supplies independent
   * circumferential sections after subdivision. It replaces rimSection and
   * surface/curve refinement of the aperture, and cannot stack a final body
   * deformation that would invalidate its shared skin-to-vestibule jets.
   */
  envelopes?: readonly IPortraitNasalEnvelope[];
  /** Cavity floor offset in host XYZ millimetres, rotated with the nostril tilt. */
  cavityOffset: number[];
  /** Reach of adjacent skin adaptation along the original mesh, in mm. */
  blendReach: number;
  /** Optional connected depth basis for the lower nasal body; omission is identity. */
  section?: IPortraitNasalSection;
  /**
   * Optional final exterior construction, after shared refinement. Choose either
   * additive anatomical body sections or a target-depth grid. Both preserve the
   * fitted aperture and its first derivative. joinWidth/depthReach are positive
   * millimetre distances. A pre-fit section cannot also be selected: each is a
   * complete alternative basis, and stacking them would silently compound form.
   * The local lobule alternative instead binds to the same pre-fit scaled
   * datums as ordinary lobules and evaluates after subdivision. It may retain
   * depthScale but cannot stack pre-fit lobules or a complete section. Its depth
   * support is full through half depthReach and fades to zero at depthReach;
   * all alternatives preserve the actual rim and lining. Arrays replace the
   * complete local section population, and an empty population is identity.
   */
  body?: {
    shape:
      | IPortraitNasalBodyShape
      | { section: IPortraitNasalSection }
      | { lobules: readonly IPortraitNasalLobule[] };
    joinWidth: number;
    depthReach: number;
  };
}

/**
 * Smooth nasal volume controls evaluated in the subject-owned socket frame.
 *
 * @evidence requirements/actors/facial-authoring/contract.md#actor-face-anatomical-components Evaluates basic tip and alar volume within the declared nasal socket.
 * @evidence specifications/asset-and-representation/facial-authoring/contract.md#face-spec-components Adds signed tip and paired alar Gaussian relief using the caller's metric centres and support radii.
 */
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

/**
 * Select an ellipse footprint while binding a measured host socket.
 *
 * @evidence requirements/actors/facial-authoring/contract.md#actor-face-anatomical-components Selects the initial nostril footprint used when binding a measured host.
 * @evidence specifications/asset-and-representation/facial-authoring/contract.md#face-spec-components Tests strict interior membership of the caller-owned elliptical XY footprint without changing connectivity.
 */
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

/**
 * Boundary edges of a connected cut patch, preserving its original winding.
 *
 * @evidence requirements/actors/facial-authoring/contract.md#actor-face-anatomical-components Retains the oriented attachment rim of a selected component cut.
 * @evidence specifications/asset-and-representation/facial-authoring/contract.md#face-spec-components Counts the cut's edges and refuses an empty, open, branched or multiple-loop boundary before returning its cyclic order.
 */
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

/**
 * Build one replaceable nose against the host's declared nasal attachment.
 *
 * @evidence requirements/actors/facial-authoring/contract.md#actor-face-anatomical-components Fits a replaceable nose whose aperture, surrounding skin and recessed cavity share one boundary.
 * @evidence specifications/asset-and-representation/facial-authoring/contract.md#face-spec-components Owns copied nasal settings, admits mutually exclusive depth bases, fits each rim once and attaches lining plus optional final exterior shaping.
 */
export function createPortraitNoseComponent(
  inputSocket: IPortraitNoseSocket,
  inputShape: IPortraitNoseShape,
): IPortraitComponent {
  const socket = {
    ...inputSocket,
    tipRadius: [...inputSocket.tipRadius] as [number, number],
    surface: [...inputSocket.surface],
    nostrils: inputSocket.nostrils.map((faces) => [...faces]),
    supportPlane:
      inputSocket.supportPlane === undefined
        ? undefined
        : [...inputSocket.supportPlane],
  };
  const shape = { ...inputShape, cavityOffset: [...inputShape.cavityOffset] };
  const bindLobules = createPortraitNasalLobules(inputShape.lobules);
  const rimSection =
    inputShape.rimSection === undefined
      ? undefined
      : { ...inputShape.rimSection };
  const envelopes = structuredClone(inputShape.envelopes ?? []);
  if (
    envelopes.length !== 0 &&
    (envelopes.length !== socket.nostrils.length ||
      rimSection !== undefined ||
      inputShape.body !== undefined ||
      inputShape.rimRefinement === "curve")
  )
    throw new Error(
      "Complete nasal envelopes need one profile per opening and cannot stack legacy rim or final-body construction.",
    );
  if (
    (shape.rimRefinement ?? "surface") !== "surface" &&
    shape.rimRefinement !== "curve"
  )
    throw new Error("Nasal rim refinement must be surface or curve.");
  const body =
    inputShape.body === undefined
      ? undefined
      : structuredClone(inputShape.body);
  if (inputShape.section !== undefined && body !== undefined)
    throw new Error(
      "Choose one pre-fit or final nasal section basis, not two stacked constructions.",
    );
  if (
    (inputShape.lobules?.length ?? 0) !== 0 &&
    (inputShape.section !== undefined || body !== undefined)
  )
    throw new Error(
      "Choose local nasal lobules or a complete section/body basis.",
    );
  if (
    (shape.depthScale ?? 1) !== 1 &&
    (inputShape.section !== undefined ||
      (body !== undefined && !("lobules" in body.shape)))
  )
    throw new Error("Choose one nasal depth-scale or section/body basis.");
  if (!Number.isFinite(shape.depthScale ?? 1) || (shape.depthScale ?? 1) <= 0)
    throw new Error("Nasal depth scale must be finite and positive.");
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
      const supportIds = socket.supportPlane ?? [];
      if (
        (shape.depthScale ?? 1) !== 1 &&
        supportIds.some(
          (id) =>
            !Number.isInteger(id) || id < 0 || id >= host.positions.length,
        )
      )
        throw new Error("Nasal support plane must name resident skin datums.");
      const support = createPortraitNasalSupport(
        (shape.depthScale ?? 1) === 1
          ? []
          : supportIds.map((id) => host.positions[id]),
        shape.depthScale,
      );
      const datum =
        socket.sectionAnchor === undefined
          ? undefined
          : host.positions[socket.sectionAnchor];
      if (
        (section !== undefined || body !== undefined) &&
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
      const baseDepth = (point: number[]): number =>
        support(point) +
        portraitNoseDepth(point, socket, shape) +
        (section === undefined ? 0 : section(point, datum!));
      const sculptedDatums = host.positions.map((point) => [
        point[0],
        point[1],
        point[2] + baseDepth(point),
      ]);
      const lobules = bindLobules(sculptedDatums);
      const depth = (point: number[]): number => {
        const base = baseDepth(point);
        return base + lobules([point[0], point[1], point[2] + base]);
      };
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
      // Exterior tangents belong to the sculpted skin before an aperture plane
      // moves its cut vertices. Capture that basis once for every rim section.
      const nasalCuts = new Set(socket.nostrils.flat());
      const skinNormals =
        rimSection === undefined && envelopes.length === 0
          ? undefined
          : portraitNormals(
              host.positions.flatMap((point, id) => targets.get(id) ?? point),
              host.indices.filter(
                (_value, index) => !nasalCuts.has(Math.floor(index / 3)),
              ),
            );
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
      const rimBands =
        rimSection === undefined
          ? undefined
          : openings.map((faces) => {
              const ids = portraitCutBoundary(faces).map((edge) => edge.a);
              const section = createPortraitNasalRimSection(
                ids.map((id) => targets.get(id)!),
                rimSection,
                ids.map((id) => skinNormals!.slice(id * 3, id * 3 + 3)),
              );
              ids.forEach((id, i) => targets.set(id, section.outer[i]));
              return { ids, section };
            });
      const fittedEnvelopes = envelopes.map((profile, index) => {
        const ids = portraitCutBoundary(openings[index]).map((edge) => edge.a);
        const envelope = createPortraitNasalEnvelope(
          ids.map((id) => targets.get(id)!),
          ids.map((id) => skinNormals!.slice(id * 3, id * 3 + 3)),
          profile,
          cavityOffset(shape),
          shape.cavityContraction,
        );
        ids.forEach((id, i) => targets.set(id, envelope.outer[i]));
        return { ids, envelope };
      });
      return {
        constraints: [...targets].map(([vertex, target]) => ({
          vertex,
          target,
          reach: shape.blendReach,
        })),
        cutFaces: socket.nostrils.flat(),
        attach: (cage, _adapted, region) => {
          const liningGroup = region("nostril-interiors", "nasal-interior");
          if (fittedEnvelopes.length !== 0) {
            const skinGroup = region("nasal-rims", "skin");
            const replacements = fittedEnvelopes.map(
              ({ ids, envelope }, index) => {
                const group = region(
                  "nasal-envelope-reserved-" + index,
                  "skin",
                );
                // Refine against the same complete section, not a fan to the
                // floor: that fan pulls the outer attachment across the rim.
                envelope.append(cage, ids, ids, group, group);
                return {
                  group,
                  append: (mesh: IControlMesh, boundary: readonly number[]) =>
                    envelope.append(
                      mesh,
                      boundary,
                      ids,
                      skinGroup,
                      liningGroup,
                    ),
                };
              },
            );
            return { openings: [], replacements, finish: () => [] };
          }
          const bandGroup =
            rimBands === undefined ? undefined : region("nasal-rims", "skin");
          const innerLoops =
            rimBands === undefined
              ? openings.map((faces) =>
                  portraitCutBoundary(faces).map((edge) => edge.a),
                )
              : rimBands.map(({ ids, section }) =>
                  appendPortraitNasalRimSection(cage, ids, section, bandGroup!),
                );
          const liningFaces =
            rimBands === undefined
              ? openings
              : innerLoops.map((loop) =>
                  Array.from({ length: loop.length - 2 }, (_, i) => [
                    loop[0],
                    loop[i + 1],
                    loop[i + 2],
                  ]),
                );
          appendPortraitNostrils(cage, liningFaces, shape, liningGroup);
          return {
            openings: [],
            // Both exterior and vestibule share these actual fitted rim IDs.
            // Opposite triangles may be asymmetric; they must not pull a
            // deliberately smooth aperture contour back into a pinched edge.
            curves: shape.rimRefinement === "curve" ? innerLoops : undefined,
            finalSurface:
              body === undefined
                ? undefined
                : createPortraitNasalBodySurface(
                    body.shape,
                    socket.sectionAnchor!,
                    liningGroup,
                    host.viewRay,
                    body.joinWidth,
                    body.depthReach,
                    sculptedDatums,
                  ),
            finish: () => [],
          };
        },
      };
    },
  };
}

/**
 * Build lining and cavity from the actual fitted rim. Original rim IDs stay
 * shared with the face. Changing an opening therefore changes its lining and
 * neighbouring skin together instead of placing a new cavity under an old hole.
 * @evidence requirements/actors/facial-authoring/contract.md#actor-face-anatomical-components Constructs nasal lining from the actual fitted aperture instead of placing a cavity under an unrelated hole.
 * @evidence specifications/asset-and-representation/facial-authoring/contract.md#face-spec-components Retains the host rim IDs, adds support and contracted deep rings, and joins them to the floor using the same rotated cavity offset.
 */
export function appendPortraitNostrils(
  cage: IControlMesh,
  nostrilFaces: number[][][],
  shape: IPortraitNoseShape,
  group: number,
): void {
  const { positions, indices, groups } = cage;
  const offset = cavityOffset(shape);
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

function cavityOffset(shape: IPortraitNoseShape): number[] {
  const angle = (shape.nostrilTilt * Math.PI) / 180;
  return [
    shape.cavityOffset[0],
    shape.cavityOffset[1] * Math.cos(angle) -
      shape.cavityOffset[2] * Math.sin(angle),
    shape.cavityOffset[1] * Math.sin(angle) +
      shape.cavityOffset[2] * Math.cos(angle),
  ];
}
