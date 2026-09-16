import type { IPortraitFinalSurface } from "../geometry/portraitFinalSurface";
import {
  type IPortraitNasalBodyShape,
  createPortraitNasalBody,
} from "./nasalBody";
import {
  type IPortraitNasalLobule,
  createPortraitNasalLobules,
} from "./nasalLobule";
import {
  type IPortraitNasalSection,
  createPortraitNasalSection,
} from "./nasalSection";

/**
 * Refine the lower nasal exterior after subdivision, keeping its vestibular
 * boundary and first derivative invariant. Body extents use the part's local
 * X/Y coordinates in millimetres. Forward support follows the group's recorded
 * view ray. A compact depth envelope excludes the posterior head at the same
 * X/Y coordinates; it is centred on the retained tip datum.
 *
 * The nearest point on the complete skin/lining boundary supplies a physical
 * distance. The cubic 3t^2-2t^3 rises from zero value/slope at the rim to unit
 * value/zero slope at joinWidth. This makes the unchanged aperture an explicit
 * boundary condition, rather than refitting its plane from changed alar volume.
 * It preserves the existing rim tangent and cannot repair a wrong rim tangent.
 * Interior vertices are never displaced by this exterior owner.
 *
 * A section-grid shape replaces local depth toward its absolute loft instead
 * of adding support envelopes. Its poles and datum use the head XYZ frame;
 * target-depth alternatives use head Z, while additive body extents follow the
 * recorded ray. All alternatives share this one boundary/lining calculation.
 * The loft is evaluated after refinement, so its curvature is not attenuated
 * again by the cage's subdivision and cannot refit the aperture plane.
 * A local lobule alternative binds its targets to copied pre-fit sculpted
 * datums supplied by the nose. It evaluates those same analytic sections on
 * the final exterior. Its depth support has a unit plateau through half the
 * reach, then a cubic fade to zero at the reach, so supported anterior targets
 * are not attenuated merely for lying behind the tip. The common rim fade
 * still takes precedence; no alternative repairs a wrong aperture tangent.
 * @evidence requirements/actors/facial-authoring/contract.md#actor-face-anatomical-components Shapes the refined nasal exterior while preserving the shared aperture and vestibular lining.
 * @evidence specifications/asset-and-representation/facial-authoring/contract.md#face-spec-components Masks additive, loft or copied-datum local-section targets by the actual lining boundary, with a full anterior depth plateau for final local sections.
 */
export function createPortraitNasalBodySurface(
  shape:
    | IPortraitNasalBodyShape
    | { section: IPortraitNasalSection }
    | { lobules: readonly IPortraitNasalLobule[] },
  datumId: number,
  liningGroup: number,
  viewRay: readonly number[],
  joinWidth: number,
  depthReach: number,
  referenceDatums: readonly (readonly number[])[] = [],
): IPortraitFinalSurface {
  if (
    ["stations", "section", "lobules"].filter((key) => key in shape).length > 1
  )
    throw new Error("Choose one final nasal target basis.");
  const lobules =
    "lobules" in shape
      ? createPortraitNasalLobules(shape.lobules)(referenceDatums)
      : undefined;
  const sample =
    "section" in shape || "lobules" in shape
      ? undefined
      : createPortraitNasalBody(shape);
  const section =
    "section" in shape ? createPortraitNasalSection(shape.section) : undefined;
  const rayLength = Math.hypot(...viewRay);
  if (
    !Number.isInteger(datumId) ||
    datumId < 0 ||
    !Number.isInteger(liningGroup) ||
    liningGroup < 0 ||
    viewRay.length !== 3 ||
    !viewRay.every(Number.isFinite) ||
    !Number.isFinite(rayLength) ||
    rayLength === 0 ||
    ![joinWidth, depthReach].every((v) => Number.isFinite(v) && v > 0)
  )
    throw new Error(
      "Nasal final shaping needs resident identities, a finite ray and positive joining distances.",
    );
  const ray =
    section === undefined && lobules === undefined
      ? viewRay.map((v) => v / rayLength)
      : [0, 0, 1];
  return (host) => {
    const datum = host.positions[datumId];
    if (datum === undefined)
      throw new Error("Nasal final shaping needs its retained tip datum.");
    const lining = new Set<number>();
    const edges = new Map<string, { a: number; b: number; count: number }>();
    for (let i = 0; i < host.groups.length; i++) {
      if (host.groups[i] !== liningGroup) continue;
      const face = host.indices.slice(3 * i, 3 * i + 3);
      for (const id of face) lining.add(id);
      for (let k = 0; k < 3; k++) {
        const a = face[k],
          b = face[(k + 1) % 3];
        const key = `${Math.min(a, b)}/${Math.max(a, b)}`;
        const prior = edges.get(key);
        if (prior === undefined) edges.set(key, { a, b, count: 1 });
        else prior.count++;
      }
    }
    const boundary = [...edges.values()].filter((edge) => edge.count === 1);
    if (boundary.length === 0)
      throw new Error("Nasal final shaping needs an attached lining boundary.");
    const segments = boundary.map(({ a, b }) => {
      const start = host.positions[a];
      const delta = host.positions[b].map((v, axis) => v - start[axis]);
      const square = delta.reduce((sum, v) => sum + v * v, 0);
      if (!Number.isFinite(square) || square === 0)
        throw new Error("A nasal lining boundary needs finite nonzero edges.");
      return { start, delta, square };
    });
    return host.positions.flatMap((point, vertex) => {
      if (lining.has(vertex)) return [];
      const z = (point[2] - datum[2]) / depthReach;
      if (Math.abs(z) >= 1) return [];
      const extent =
        lobules !== undefined
          ? { lateral: 0, forward: lobules(point) }
          : section === undefined
            ? sample!(point[0] - datum[0], point[1] - datum[1])
            : { lateral: 0, forward: section(point, datum) };
      if (extent.forward === 0 && extent.lateral === 0) return [];
      let distance = Infinity;
      for (const { start, delta, square } of segments) {
        const t = Math.max(
          0,
          Math.min(
            1,
            point.reduce(
              (sum, v, axis) => sum + (v - start[axis]) * delta[axis],
              0,
            ) / square,
          ),
        );
        distance = Math.min(
          distance,
          Math.hypot(
            ...point.map((v, axis) => v - start[axis] - t * delta[axis]),
          ),
        );
      }
      const t = Math.min(1, distance / joinWidth);
      const depthT = Math.min(1, 2 * (1 - Math.abs(z)));
      const depthWeight =
        lobules === undefined
          ? (1 - z * z) ** 2
          : depthT * depthT * (3 - 2 * depthT);
      const weight = t * t * (3 - 2 * t) * depthWeight;
      return [
        {
          vertex,
          target: point.map(
            (v, axis) =>
              v +
              weight *
                (extent.forward * ray[axis] +
                  (axis === 0 ? extent.lateral : 0)),
          ),
        },
      ];
    });
  };
}
