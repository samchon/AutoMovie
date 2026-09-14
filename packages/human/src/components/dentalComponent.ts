import { portraitPoint as p, portraitPart } from "../geometry/geometry";
import type { IPortraitComponent } from "../geometry/portraitComponents";
import {
  type IPortraitDentalRow,
  attachPortraitDentalRow,
  buildPortraitDentalRow,
} from "./dentalRow";

/**
 * Bind an entire dental group through the same component protocol as the eyes,
 * nose and mouth. This interior does not cut or deform skin. The mouth owns its
 * opening; the group reads the actual refined oral anchors in its finish phase.
 * Socket IDs belong to the subject, while enamel, arch and placement remain
 * independent controls. All offsets and local geometry use millimetres.
 * Observed-maxilla attachment instead captures the host before performance,
 * so a facial expression cannot translate or tilt the upper arch with a lip.
 * @evidence requirements/actors/facial-authoring/contract.md#actor-face-anatomical-components Fits an upper enamel row as a non-cutting interior component using caller-owned oral bindings.
 * @evidence specifications/asset-and-representation/facial-authoring/contract.md#face-spec-components Defers the upper row to final oral anchors or an explicitly captured observed-maxilla frame, preserving its rigid group placement.
 * @evidence requirements/actors/facial-authoring/contract.md#actor-face-expression Separates resident maxillary teeth from the moving oral aperture.
 * @evidence specifications/asset-and-representation/facial-authoring/contract.md#face-spec-expression Retains an observed upper-arch attachment during lip and mandibular performance.
 */
export function createPortraitDentalComponent(
  inputSocket: {
    rightCorner: number;
    leftCorner: number;
    upperLipMiddle: number;
  },
  inputRow: IPortraitDentalRow,
  inputPlacement: { lift: number; recess: number },
  attachment: "refined-oral" | "observed-maxilla" = "refined-oral",
): IPortraitComponent {
  if (attachment !== "refined-oral" && attachment !== "observed-maxilla")
    throw new Error(
      "Upper dentition attachment must name the refined oral or observed maxillary frame.",
    );
  const socket = structuredClone(inputSocket),
    placement = structuredClone(inputPlacement),
    row = buildPortraitDentalRow(inputRow);
  if (![placement.lift, placement.recess].every(Number.isFinite))
    throw new Error("Dental component placement must be finite millimetres.");
  return {
    id: "upper-dentition",
    fit: (host) => {
      if (
        Object.values(socket).some(
          (id) =>
            !Number.isInteger(id) || id < 0 || id >= host.positions.length,
        )
      )
        throw new Error(
          "Dental component sockets must name resident host vertices.",
        );
      // Capture before performance. The observed frame is a subject-authored
      // maxillary approximation; subsequent lip and jaw movement cannot carry
      // its entire upper arch along with the moving oral opening.
      const maxilla =
        attachment === "observed-maxilla"
          ? structuredClone(host.positions)
          : undefined;
      return {
        constraints: [],
        cutFaces: [],
        attach: () => ({
          openings: [],
          finish: (refined) => {
            const source = maxilla ?? refined.positions;
            const point = (id: number) =>
              p(source[id][0], source[id][1], source[id][2]);
            return [
              portraitPart(
                "tooth-upper-arch",
                attachPortraitDentalRow(row, {
                  rightCorner: point(socket.rightCorner),
                  leftCorner: point(socket.leftCorner),
                  upperLipMiddle: point(socket.upperLipMiddle),
                  up: p(0, 1, 0),
                  ...placement,
                }),
                "teeth",
              ),
            ];
          },
        }),
      };
    },
  };
}
