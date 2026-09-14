import { Quaternion } from "@automovie/engine";
import type { IAutoMovieVector3 } from "@automovie/interface";

import { portraitPart, portraitPoint } from "../geometry/geometry";
import type { IPortraitComponent } from "../geometry/portraitComponents";
import {
  type IPortraitDentalRow,
  attachPortraitDentalRow,
  buildPortraitDentalRow,
} from "./dentalRow";
import { posePortraitJawPoint } from "./jawPerformance";

/**
 * Resident lower enamel attached to the observed mandibular frame. Its own
 * crown array describes smaller lower incisors and individual laterals/canines;
 * upper profiles are never silently reused. Cervical ends point inferiorly,
 * incisal edges superiorly. The whole row follows only the jaw hinge, not lip
 * separation, smile or pucker. No gingiva, tongue or occlusion solver is implied.
 *
 * @evidence requirements/actors/facial-authoring/contract.md#actor-face-anatomical-components Adds independently authored mandibular enamel to the oral structures.
 * @evidence requirements/actors/facial-authoring/contract.md#actor-face-expression Attaches lower teeth to the mandible while maxillary teeth remain fixed.
 * @evidence specifications/asset-and-representation/facial-authoring/contract.md#face-spec-components Owns lower crown dimensions, arch shape and inferior cervical placement.
 * @evidence specifications/asset-and-representation/facial-authoring/contract.md#face-spec-expression Moves the intact lower row through one observed-relative jaw rotation.
 */
export function createPortraitMandibularDentition(
  inputSocket: {
    rightCorner: number;
    leftCorner: number;
    lowerLipMiddle: number;
  },
  inputRow: IPortraitDentalRow,
  inputPlacement: { drop: number; recess: number },
  inputJaw: { hinge: IAutoMovieVector3; observed: number; current: number },
): IPortraitComponent {
  const socket = structuredClone(inputSocket),
    placement = structuredClone(inputPlacement),
    jaw = structuredClone(inputJaw);
  if (
    ![placement.drop, placement.recess, jaw.observed, jaw.current].every(
      Number.isFinite,
    ) ||
    placement.drop < 0 ||
    placement.recess < 0 ||
    jaw.observed < 0 ||
    jaw.observed > 25 ||
    jaw.current < 0 ||
    jaw.current > 25
  )
    throw new Error(
      "Mandibular dentition requires nonnegative finite offsets and jaw angles in [0,25] degrees.",
    );
  posePortraitJawPoint(jaw.hinge, jaw.hinge, 0, 1);
  const row = buildPortraitDentalRow(inputRow);
  // Reflect the cervical-to-incisal axis, including normals and handedness.
  for (let i = 1; i < row.positions.length; i += 3) {
    row.positions[i] = -row.positions[i];
    row.normals![i] = -row.normals![i];
  }
  // buildPortraitDentalRow always returns indexed, normal-bearing crowns.
  const indices = row.indices!;
  for (let i = 0; i < indices.length; i += 3)
    [indices[i + 1], indices[i + 2]] = [indices[i + 2], indices[i + 1]];
  return {
    id: "lower-dentition",
    fit: (host) => {
      if (
        Object.values(socket).some(
          (id) =>
            !Number.isInteger(id) || id < 0 || id >= host.positions.length,
        )
      )
        throw new Error("Mandibular sockets must name resident host vertices.");
      const point = (id: number) =>
        portraitPoint(...(host.positions[id] as [number, number, number]));
      const placed = attachPortraitDentalRow(row, {
        rightCorner: point(socket.rightCorner),
        leftCorner: point(socket.leftCorner),
        upperLipMiddle: point(socket.lowerLipMiddle),
        up: { x: 0, y: 1, z: 0 },
        lift: -placement.drop,
        recess: placement.recess,
      });
      const angle = jaw.current - jaw.observed,
        rotation = Quaternion.fromAxisAngle({ x: 1, y: 0, z: 0 }, angle);
      for (let i = 0; i < placed.positions.length; i += 3) {
        const p = posePortraitJawPoint(
          {
            x: placed.positions[i],
            y: placed.positions[i + 1],
            z: placed.positions[i + 2],
          },
          jaw.hinge,
          angle,
          1,
        );
        const n = Quaternion.rotateVector(rotation, {
          x: placed.normals![i],
          y: placed.normals![i + 1],
          z: placed.normals![i + 2],
        });
        placed.positions.splice(i, 3, p.x, p.y, p.z);
        placed.normals!.splice(i, 3, n.x, n.y, n.z);
      }
      return {
        constraints: [],
        cutFaces: [],
        attach: () => ({
          openings: [],
          finish: () => [
            portraitPart("tooth-lower-arch", structuredClone(placed), "teeth"),
          ],
        }),
      };
    },
  };
}
