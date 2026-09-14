import type {
  IAutoMovieHumanFaceBindings,
  IAutoMovieHumanFaceExpression,
} from "../IAutoMovieHumanFaceDocument";
import type { IPortraitComponent } from "../geometry/portraitComponents";
import { resolveHumanFaceExpression } from "../humanFaceExpression";
import { posePortraitJawPoint } from "./jawPerformance";
import { portraitLipTriangles } from "./mouth";

/**
 * Attach brow elevation and mandibular skin movement to the same source host
 * as the optical and oral components. The mouth owns its entire vermilion
 * population; this component never applies a second jaw transform to that band.
 * The maxilla, eye markers and skin above the oral transition remain stationary.
 *
 * This is explicit weighted kinematics, not a simulated muscle or skull. The
 * perioral transition spans the observed central opening, with a four-mm
 * minimum for a closed observation; lower facial tissue follows the hinge.
 * Brow movement adapts neighbouring skin over twelve mm and the resident brow
 * fibres subsequently read the final shared skin instead of a detached offset.
 *
 * @evidence requirements/actors/facial-authoring/contract.md#actor-face-expression Carries brow and mandibular performance through their actual facial attachments.
 * @evidence specifications/asset-and-representation/facial-authoring/contract.md#face-spec-expression Keeps fixed optics and maxillary tissue separate from the moving lower face.
 */
export function createPortraitFacePerformanceComponent(
  inputBindings: IAutoMovieHumanFaceBindings,
  inputObservation: IAutoMovieHumanFaceExpression,
  inputExpression: IAutoMovieHumanFaceExpression,
): IPortraitComponent {
  const bindings = structuredClone(inputBindings);
  const observation = resolveHumanFaceExpression(inputObservation);
  const expression = resolveHumanFaceExpression(inputExpression);
  const jaw = expression.jawOpen - observation.jawOpen;
  if (expression.jawOpen !== 0 || observation.jawOpen !== 0) {
    if (bindings.jawHinge === undefined)
      throw new Error(
        "Mandibular performance requires an authored transverse hinge.",
      );
    posePortraitJawPoint(bindings.jawHinge, bindings.jawHinge, jaw, 0);
  }
  return {
    id: "facial-performance",
    fit: (host) => {
      const constraints = new Map<
        number,
        { vertex: number; target: number[]; reach: number }
      >();
      if (jaw !== 0) {
        const lipVertices = new Set(
          [...portraitLipTriangles(host.indices, bindings.mouth)].flatMap(
            (face) => host.indices.slice(3 * face, 3 * face + 3),
          ),
        );
        const middle = (curve: number[]) =>
          host.positions[curve[Math.floor(curve.length / 2)]];
        const upperY = middle(bindings.mouth.upper)[1];
        const transition = Math.max(
          4,
          upperY - middle(bindings.mouth.lower)[1],
        );
        for (const id of new Set(host.indices)) {
          if (lipVertices.has(id)) continue;
          const point = host.positions[id];
          const t = Math.max(0, Math.min(1, (upperY - point[1]) / transition));
          if (t === 0) continue;
          const moved = posePortraitJawPoint(
            { x: point[0], y: point[1], z: point[2] },
            bindings.jawHinge!,
            jaw,
            t * t * (3 - 2 * t),
          );
          constraints.set(id, {
            vertex: id,
            target: [moved.x, moved.y, moved.z],
            reach: 0,
          });
        }
      }
      for (const side of ["right", "left"] as const) {
        const delta = expression.browRaise[side] - observation.browRaise[side];
        if (delta === 0) continue;
        for (const id of new Set([
          ...bindings.eyes[side].browTop,
          ...bindings.eyes[side].browBottom,
        ])) {
          const source = constraints.get(id)?.target ?? host.positions[id];
          if (
            source === undefined ||
            source.length !== 3 ||
            !source.every(Number.isFinite)
          )
            throw new Error(
              "Brow performance requires resident finite brow attachments.",
            );
          constraints.set(id, {
            vertex: id,
            target: [source[0], source[1] + delta, source[2]],
            reach: 12,
          });
        }
      }
      return {
        constraints: [...constraints.values()],
        cutFaces: [],
        attach: () => ({ openings: [], finish: () => [] }),
      };
    },
  };
}
