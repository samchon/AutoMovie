import type {
  IPortraitComponentHost,
  IPortraitEyeSocket,
} from "@automovie/human";

/**
 * Independent tilted orbital patch for complete eye-component scenarios.
 * The host is the plane Z=X/4 in head millimetres: a 20-by-6 mm diamond
 * aperture, its centre, and a 60-by-60 mm surrounding square. Four centre
 * triangles supply the removable opening; eight annular triangles supply the
 * shared skin. Every triangle faces +Z, so the outer square remains a free rim.
 * The aperture plane differs from the axial observation ray deliberately;
 * comparing the two sphere-fit modes must therefore exercise distinct frames.
 * Each invocation owns its arrays. No photographed landmark, named subject or
 * fitted identity profile participates, and the patch is not a whole cranium.
 */
export const portraitEyeHostFixture = (): {
  host: IPortraitComponentHost;
  socket: IPortraitEyeSocket;
} => {
  const positions = [
    [-10, 0],
    [0, 3],
    [10, 0],
    [0, -3],
    [0, 0],
    [-30, -30],
    [30, -30],
    [30, 30],
    [-30, 30],
  ].map(([x, y]) => [x, y, x / 4]);
  const indices = [0, 3, 4, 3, 2, 4, 2, 1, 4, 1, 0, 4];
  const inner = [0, 3, 2, 1],
    outer = [5, 6, 7, 8];
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    indices.push(outer[i], outer[j], inner[i], outer[j], inner[j], inner[i]);
  }
  return {
    host: { positions, indices, viewRay: [0, 0, 1] },
    socket: {
      name: "right",
      top: [0, 1, 2],
      bottom: [0, 3, 2],
      iris: 4,
      browTop: [1],
      browBottom: [1],
    },
  };
};
