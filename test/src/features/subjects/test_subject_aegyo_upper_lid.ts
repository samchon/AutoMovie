import { appendPortraitEyeMargins } from "@automovie/human/components/eyes";
import { TestValidator } from "@nestia/e2e";

import {
  portraitEyeShape,
  portraitEyeSockets,
} from "../../subjects/generated-korean-girl-01/configuration";
import { referenceControlNet } from "../../subjects/generated-korean-girl-01/controlNet";

/**
 * Pretarsal lower-lid fullness must preserve the upper fold and both canthi.
 * The lower-lid group cannot replace the upper lid's independent tissue rows.
 *
 * Scenarios:
 * 1. Toggle a nonzero lower roll on both anatomical eyes. Every upper row and
 *    shared endpoint stays identical while at least one lower row changes.
 * 2. A zero-projection roll still owns lower spacing without moving upper rows.
 */
export const test_subject_aegyo_upper_lid = (): void => {
  for (const socket of portraitEyeSockets) {
    const loop = [...socket.bottom, ...socket.top.slice(1, -1).reverse()];
    const build = (projection?: number) => {
      const cage = {
        positions: referenceControlNet.positions.map((point) => [...point]),
        indices: [] as number[],
        groups: [] as number[],
      };
      appendPortraitEyeMargins(cage, referenceControlNet.positions, socket, {
        ...portraitEyeShape,
        aegyoSal:
          projection === undefined
            ? undefined
            : { ...portraitEyeShape.aegyoSal!, projection },
      });
      return cage.positions.slice(referenceControlNet.positions.length);
    };
    const plain = build();
    for (const projection of [0, 1.2]) {
      const changed = build(projection);
      for (let ring = 0; ring < 7; ring++)
        for (const vertex of socket.top) {
          const id = ring * loop.length + loop.indexOf(vertex);
          TestValidator.equals(
            "upper lid and canthi are independent",
            changed[id],
            plain[id],
          );
        }
      TestValidator.predicate(
        "lower section responds",
        changed.some((point, id) =>
          point.some((value, axis) => value !== plain[id][axis]),
        ),
      );
    }
  }
};
