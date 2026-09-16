import type {
  IAutoMovieHumanFaceBindings,
  IAutoMovieHumanFaceExpression,
} from "../IAutoMovieHumanFaceDocument";
import type { IPortraitComponentHost } from "../geometry/portraitComponents";
import { resolveHumanFaceExpression } from "../humanFaceExpression";
import type { IPortraitNeckShape } from "./cranium";
import { createPortraitFacePerformanceComponent } from "./facePerformance";
import type { IPortraitHeadPerformance } from "./head";
import { portraitJawSkinWeight, posePortraitJawPoint } from "./jawPerformance";

/**
 * Continue the facial jaw field through reference-formed cranium and neck.
 * The actual facial-performance constraints identify the restored source
 * vertices, so the mouth's separately owned tissue is never restored or posed
 * twice. The posterior hinge plane and lower cervical section stay anchored.
 *
 * The observed lower face bounds a rigid angular sector. A monotone rational
 * quadratic continues its rotation to the fixed posterior/cervical boundary
 * on each sagittal ray. Unlike multiplying Cartesian falloffs, the angular
 * transition does not reverse the fully mandibular cervical field. The oral
 * band retains facial performance's weight. These are kinematic attachments,
 * not recovered muscle weights, joint translation or a collision simulation.
 * Matching observed/current angles omit the extra assembly path exactly.
 *
 * @evidence requirements/actors/facial-authoring/contract.md#actor-face-expression Carries mandibular motion into connected head tissue while retaining fixed posterior and lower-neck attachments.
 * @evidence specifications/asset-and-representation/facial-authoring/contract.md#face-spec-expression Builds continuation in its reference frame and poses only its appended vertices before common skin refinement.
 */
export function createPortraitJawContinuation(
  inputHost: IPortraitComponentHost,
  inputBindings: IAutoMovieHumanFaceBindings,
  inputObservation: IAutoMovieHumanFaceExpression,
  inputExpression: IAutoMovieHumanFaceExpression,
  inputNeck: IPortraitNeckShape,
): IPortraitHeadPerformance | undefined {
  const observation = resolveHumanFaceExpression(inputObservation);
  const expression = resolveHumanFaceExpression(inputExpression);
  const angle = expression.jawOpen - observation.jawOpen;
  if (angle === 0) return undefined;
  const host = structuredClone(inputHost),
    bindings = structuredClone(inputBindings);
  const plan = createPortraitFacePerformanceComponent(bindings, observation, {
    ...expression,
    browRaise: observation.browRaise,
  }).fit(host);
  const reference = new Map(
    plan.constraints.map(({ vertex }) => [vertex, host.positions[vertex]]),
  );
  const middle = (curve: number[]) =>
    host.positions[curve[Math.floor(curve.length / 2)]][1];
  const upper = middle(bindings.mouth.upper),
    lower = middle(bindings.mouth.lower);
  const lowerFace = [...reference.values()].filter(
    (point) => portraitJawSkinWeight(point[1], upper, lower) === 1,
  );
  const chin = Math.min(...lowerFace.map((point) => point[1]));
  const anterior = Math.min(...lowerFace.map((point) => point[2]));
  const hinge = bindings.jawHinge!,
    anchorY = inputNeck.lower.y;
  if (
    !Number.isFinite(chin) ||
    !Number.isFinite(anchorY) ||
    chin <= anchorY ||
    chin >= hinge.y ||
    anterior <= hinge.z
  )
    throw new Error(
      "Jaw continuation needs lower facial attachments above the lower neck, below the hinge and anterior to it.",
    );
  const frontAngle = Math.max(
    ...lowerFace.map((point) =>
      Math.atan2(hinge.y - point[1], point[2] - hinge.z),
    ),
  );
  return {
    reference: (point, vertex) => {
      const original = reference.get(vertex);
      if (original === undefined) return [...point];
      // Undo only the jaw rotation. A second component's compatible residual
      // must survive rather than being replaced by the original host sample.
      const restored = posePortraitJawPoint(
        { x: point[0], y: point[1], z: point[2] },
        hinge,
        -angle,
        portraitJawSkinWeight(original[1], upper, lower),
      );
      return [restored.x, restored.y, restored.z];
    },
    pose: ([x, y, z]) => {
      let weight = portraitJawSkinWeight(y, upper, lower);
      if (z <= hinge.z || y <= anchorY) weight = 0;
      else if (weight !== 0) {
        const radius = Math.hypot(y - hinge.y, z - hinge.z),
          theta = Math.atan2(hinge.y - y, z - hinge.z),
          start = Math.min(
            frontAngle,
            Math.asin(Math.min(1, (hinge.y - chin) / radius)),
          ),
          end = Math.asin(Math.min(1, (hinge.y - anchorY) / radius));
        if (theta > start) {
          const span = end - start,
            ratio = 1 - (angle * weight * Math.PI) / (180 * span);
          if (!Number.isFinite(ratio) || ratio <= 0)
            throw new Error(
              "Jaw continuation has no angular clearance before its fixed cervical boundary.",
            );
          const u = (theta - start) / span;
          // Unit endpoint derivatives join rigid and fixed tissue. This is
          // the displacement form of a monotone rational quadratic, avoiding
          // subtraction of nearly identical posed/reference polar angles.
          const fraction =
            ((1 - u) ** 2 * (ratio + 2 * u)) /
            (ratio + 2 * (1 - ratio) * u * (1 - u));
          weight *= Math.max(0, Math.min(1, fraction));
        }
      }
      const point = posePortraitJawPoint({ x, y, z }, hinge, angle, weight);
      return [point.x, point.y, point.z];
    },
  };
}
