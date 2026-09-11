import type {
  IPortraitCheekShape,
  IPortraitCheekSocket,
} from "../../subjects/generated-korean-girl-01/cheeks";
import type { IPortraitSurfaceHost } from "../../subjects/portraitSurface";

/** Independent millimetre attachments with separated volume centres and one straight fold. */
export function createPortraitCheekFixture(): {
  socket: IPortraitCheekSocket;
  shape: IPortraitCheekShape;
  host: IPortraitSurfaceHost;
} {
  const volume = () => ({
    width: 20,
    height: 20,
    reach: 40,
    projection: 0,
    lift: 0,
  });
  return {
    socket: {
      side: "right",
      malar: 0,
      medial: 1,
      buccal: 2,
      modiolus: 3,
      nasolabial: [4, 5],
    },
    shape: {
      malar: volume(),
      medial: volume(),
      buccal: volume(),
      modiolus: volume(),
      foldWidth: 4,
      foldDepth: 0,
      foldReach: 40,
    },
    host: {
      positions: [
        [0, 0, 0],
        [100, 0, 0],
        [0, 100, 0],
        [100, 100, 0],
        [-40, -80, 0],
        [40, -80, 0],
      ],
      indices: [],
      normals: [],
    },
  };
}
