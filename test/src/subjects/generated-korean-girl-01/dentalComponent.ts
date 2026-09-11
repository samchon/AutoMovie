import { portraitPoint as p, portraitPart } from "../geometry";
import type { IPortraitComponent } from "../portraitComponents";
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
 */
export function createPortraitDentalComponent(
  inputSocket: {
    rightCorner: number;
    leftCorner: number;
    upperLipMiddle: number;
  },
  inputRow: IPortraitDentalRow,
  inputPlacement: { lift: number; recess: number },
): IPortraitComponent {
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
      return {
        constraints: [],
        cutFaces: [],
        attach: () => ({
          openings: [],
          finish: (refined) => {
            const point = (id: number) =>
              p(
                refined.positions[id][0],
                refined.positions[id][1],
                refined.positions[id][2],
              );
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
