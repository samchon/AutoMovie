import { createAutoMovieMeshDepthSampler } from "@automovie/engine";
import type { IAutoMovieMeshDeformationField } from "@automovie/interface";

import type {
  IAutoMovieHumanFaceBindings,
  IAutoMovieHumanFaceExpression,
} from "../IAutoMovieHumanFaceDocument";
import { portraitPart, portraitSpline } from "../geometry/geometry";
import type { IPortraitSurfaceLayer } from "../geometry/portraitSurface";
import { resolveHumanFaceExpression } from "../humanFaceExpression";
import { type IPortraitSkinShape, resolvePortraitSkinShape } from "./skinShape";

/**
 * Shape resting and expression-dependent skin on the live shared face. Eye
 * and oral attachments define each region; every support queries anterior
 * skin depth rather than borrowing an offset anchor's unmodified depth.
 * Narrow overlapping compact fields form crease valleys; broad fields carry
 * tissue descent, deflation and infraorbital projection. No texture is painted.
 *
 * Both sides share settings, with independent current expression and live
 * attachments. Curves fade at their ends and are clipped to the resident skin
 * silhouette. Open rims retain the surface assembler's geodesic protection.
 * Displacements use head Y/Z, not simulated material stress or measured age.
 * Zero laxity and expression creasing require no new attachment or topology.
 *
 * @evidence requirements/actors/facial-authoring/contract.md#actor-face-skin-condition Forms named forehead, glabellar, orbital and oral creases with separate soft-tissue descent.
 * @evidence specifications/asset-and-representation/facial-authoring/contract.md#face-spec-skin-condition Emits one skin-bound field layer using actual surface depth and millimetre anatomy.
 * @evidence requirements/actors/facial-authoring/contract.md#actor-face-expression Keeps persistent folds separate from creases driven by current facial performance.
 * @evidence specifications/asset-and-representation/facial-authoring/contract.md#face-spec-expression Reads current paired brows, lids and mouth performance without changing optical identity.
 */
export function createPortraitSkinLayer(
  inputBindings: Pick<IAutoMovieHumanFaceBindings, "eyes" | "mouth">,
  input: IPortraitSkinShape,
  inputExpression: IAutoMovieHumanFaceExpression = {},
): IPortraitSurfaceLayer {
  const bindings = structuredClone(inputBindings),
    shape = resolvePortraitSkinShape(input),
    expression = resolveHumanFaceExpression(inputExpression);
  return {
    id: "anatomical-skin",
    sampleSpacing:
      shape.laxity * shape.wrinkleDepth > 0 || shape.expressionCreasing > 0
        ? shape.wrinkleWidth * 0.75
        : undefined,
    fields: (host) => {
      if (shape.laxity === 0 && shape.expressionCreasing === 0) return [];
      const point = (id: number): readonly number[] => {
        const p = host.positions[id];
        if (
          !Number.isInteger(id) ||
          p === undefined ||
          p.length !== 3 ||
          !p.every(Number.isFinite)
        )
          throw new Error(
            "Skin morphology requires finite resident anatomical attachments.",
          );
        return p;
      };
      const curve = (ids: readonly number[]) => {
        if (ids.length < 2)
          throw new Error(
            "Skin morphology requires nonempty anatomical boundary curves.",
          );
        return ids.map(point);
      };
      const middle = (points: readonly (readonly number[])[]) =>
        points[Math.floor(points.length / 2)];
      const mouth = curve(bindings.mouth.upper),
        lowerMouth = curve(bindings.mouth.lower);
      const skin = createAutoMovieMeshDepthSampler(
        portraitPart(
          "skin-morphology-basis",
          {
            positions: host.positions.flat(),
            indices: [...host.indices],
            normals: null,
            uvs: null,
            skin: null,
          },
          "skin",
        ).geometry.mesh,
        "z",
      );
      const fields: IAutoMovieMeshDeformationField[] = [];
      const support = (
        x: number,
        y: number,
        rx: number,
        ry: number,
        dy: number,
        dz: number,
      ) => {
        if (dy === 0 && dz === 0) return;
        const hit = skin(x / 1000, y / 1000);
        if (hit === null) return;
        fields.push({
          center: { x: x / 1000, y: y / 1000, z: hit.maximum },
          radius: { x: rx / 1000, y: ry / 1000, z: 0.018 },
          displacement: { x: 0, y: dy / 1000, z: dz / 1000 },
          stretch: { x: 0, y: 0, z: 0 },
        });
      };
      const stroke = (
        points: readonly (readonly number[])[],
        depth: number,
        width = shape.wrinkleWidth,
      ) => {
        if (depth === 0) return;
        const lengths = points
          .slice(1)
          .map((p, i) => Math.hypot(p[0] - points[i][0], p[1] - points[i][1]));
        const total = lengths.reduce((a, b) => a + b, 0);
        const guide = points.map((p) => ({ x: p[0], y: p[1], z: 0 }));
        // Every constructed path spans at least seven millimetres vertically,
        // has a positive admitted eye span, or contains the forehead arch.
        let travelled = 0;
        for (let i = 0; i < lengths.length; i++) {
          const length = lengths[i],
            count = Math.max(1, Math.ceil(length / width));
          for (let sample = 0; sample < count; sample++) {
            const t = sample / count,
              progress = (travelled + length * t) / total;
            // A sine envelope retains the continuous interior and zero ends.
            const at = portraitSpline(guide, (i + t) / lengths.length);
            support(
              at.x,
              at.y,
              width * 1.2,
              width * 1.2,
              0,
              -depth * 0.65 * Math.sin(Math.PI * progress),
            );
          }
          travelled += length;
        }
      };
      const rest = shape.laxity * shape.wrinkleDepth,
        dynamic = shape.expressionCreasing;
      const eyeData = (["right", "left"] as const).map((side) => {
        const eye = bindings.eyes[side],
          top = curve(eye.top),
          bottom = curve(eye.bottom),
          brow = curve(eye.browBottom),
          sign = side === "right" ? -1 : 1;
        const outer = top[side === "right" ? 0 : top.length - 1],
          inner = top[side === "right" ? top.length - 1 : 0],
          width = Math.abs(outer[0] - inner[0]);
        if (!(width > 1))
          throw new Error("Skin morphology requires nondegenerate eye spans.");
        return { side, sign, outer, inner, width, brow, lower: middle(bottom) };
      });
      const leftEdge = Math.min(...eyeData[0].brow.map((p) => p[0])),
        rightEdge = Math.max(...eyeData[1].brow.map((p) => p[0]));
      const browY = eyeData.reduce((s, e) => s + middle(e.brow)[1], 0) / 2;
      const elevation =
        (expression.browRaise.left + expression.browRaise.right) / 2;
      for (let line = 0; line < 4; line++) {
        const y = browY + 10 + line * 6;
        const span = 0.78 - line * 0.07,
          centreX = (leftEdge + rightEdge) / 2;
        stroke(
          Array.from({ length: 9 }, (_, i) => {
            const t = i / 8;
            return [
              centreX +
                (leftEdge - centreX) * span +
                (rightEdge - leftEdge) * span * t,
              y + 2 * Math.sin(Math.PI * t),
            ];
          }),
          (rest * shape.forehead + (dynamic * Math.max(0, elevation)) / 8) *
            (1 - line * 0.15),
        );
      }
      const midX = (eyeData[0].inner[0] + eyeData[1].inner[0]) / 2;
      for (const e of eyeData) {
        const { side, sign, width, outer, lower } = e,
          corner = mouth[side === "right" ? 0 : mouth.length - 1],
          smile = Math.max(0, expression.smile[side]) / 8;
        stroke(
          [
            [midX + sign * 3, browY - 5],
            [midX + sign * 4, browY + 5],
            [midX + sign * 5, browY + 15],
          ],
          rest * shape.glabella +
            (dynamic * Math.max(0, -expression.browRaise[side])) / 6,
        );
        for (let ray = -1; ray <= 1; ray++)
          stroke(
            [
              [outer[0] + sign * 2, outer[1] + ray],
              [outer[0] + sign * width * 0.27, outer[1] + ray * 3],
              [outer[0] + sign * width * 0.53, outer[1] + ray * 6],
            ],
            rest * shape.crowFeet +
              dynamic * (expression.blink[side] * 0.25 + smile * 0.75),
          );
        stroke(
          [
            [e.inner[0] + sign * 3, lower[1] - 5],
            [lower[0], lower[1] - 7],
            [outer[0] - sign * 2, lower[1] - 5],
          ],
          rest * shape.lowerLid * 0.75,
        );
        stroke(
          [
            [corner[0] * 0.64, corner[1] + width * 0.7],
            [corner[0] + sign * 2, corner[1] + width * 0.3],
            [corner[0] + sign * 4, corner[1] - 3],
          ],
          rest * shape.nasolabial + dynamic * smile * 0.5,
          shape.wrinkleWidth * 1.5,
        );
        stroke(
          [
            [corner[0] + sign * 3, corner[1] - 2],
            [corner[0] + sign * 5, corner[1] - 10],
            [corner[0] + sign * 8, corner[1] - 21],
          ],
          rest * shape.marionette,
          shape.wrinkleWidth * 1.5,
        );
        support(
          lower[0],
          lower[1] - 6,
          width * 0.45,
          5,
          0,
          shape.laxity * shape.underEyeBag,
        );
        support(
          lower[0] + sign * 5,
          lower[1] - width * 0.7,
          width * 0.8,
          width * 0.7,
          -shape.laxity * shape.cheekSag,
          -shape.laxity * shape.volumeLoss,
        );
        support(
          corner[0] + sign * width * 0.42,
          Math.min(corner[1], middle(lowerMouth)[1]) - 12,
          width * 0.5,
          14,
          -shape.laxity * shape.jowlSag,
          shape.laxity * shape.jowlSag * 0.2,
        );
      }
      const centre = middle(mouth),
        half = (mouth.at(-1)![0] - mouth[0][0]) / 2;
      for (const fraction of [-0.65, -0.4, -0.2, 0.2, 0.4, 0.65])
        stroke(
          [
            [centre[0] + half * fraction, centre[1] + 3],
            [centre[0] + half * fraction * 1.1, centre[1] + 10],
          ],
          rest * shape.perioral + (dynamic * expression.pucker) / 4,
        );
      return fields;
    },
  };
}
