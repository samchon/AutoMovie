import { AutoMovieFaceParameterName } from "@automovie/interface";

import { CANONICAL_FACE_POSITIONS } from "./canonicalFace";

// FaceMesh landmark feature groups (eyelid rings, brows, lips) — the anchors
// every morph's gaussian falloff is centered on.
const EYE_R = [
  33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246,
];
const EYE_L = [
  362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385, 384,
  398,
];
const BROW_R = [70, 63, 105, 66, 107, 46, 53, 52, 65, 55];
const BROW_L = [300, 293, 334, 296, 336, 276, 283, 282, 295, 285];
const LIPS = [
  61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 409, 270, 269, 267, 0, 37,
  39, 40, 185, 78, 95, 88, 178, 87, 14, 317, 402, 318, 324, 308, 415, 310, 311,
  312, 13, 82, 81, 80, 191,
];

/**
 * Build the 17 semantic face-shape morph targets over a face's resting
 * positions — the slider basis of the face editor.
 *
 * Each {@link AutoMovieFaceParameterName} becomes per-vertex xyz deltas at
 * weight +1: gaussian-falloff deformations anchored on the landmark feature
 * groups (eyelid rings, brows, lips, nose, chin, cheeks), so one nameable trait
 * moves while identity stays put. Positions default to the canonical neutral
 * but any same-topology face (e.g. with its `identity` delta baked) works —
 * anchors are recomputed from the given geometry, keeping the falloffs centered
 * on that face's own features.
 *
 * Magnitudes are tuned so the documented `[-2, 2]` weight range spans
 * subtle-to-caricature; the deltas drop into a glTF primitive's morph targets
 * (or an `IAutoMovieFaceTemplate.targets`) as-is.
 *
 * @author Samchon
 */
export const buildFaceMorphs = (
  positions: number[] = CANONICAL_FACE_POSITIONS,
): Record<AutoMovieFaceParameterName, number[]> => {
  const n = positions.length / 3;
  const P = (i: number): [number, number, number] => [
    positions[i * 3]!,
    positions[i * 3 + 1]!,
    positions[i * 3 + 2]!,
  ];
  const centroid = (set: number[]): [number, number, number] => {
    const c: [number, number, number] = [0, 0, 0];
    for (const i of set)
      for (let k = 0; k < 3; k++) c[k] += P(i)[k]! / set.length;
    return c;
  };
  const gauss = (i: number, c: [number, number, number], sigma: number) => {
    const p = P(i);
    const d2 = (p[0] - c[0]) ** 2 + (p[1] - c[1]) ** 2 + (p[2] - c[2]) ** 2;
    return Math.exp(-d2 / (2 * sigma * sigma));
  };

  const eyeCR = centroid(EYE_R);
  const eyeCL = centroid(EYE_L);
  const browCR = centroid(BROW_R);
  const browCL = centroid(BROW_L);
  const mouthC = centroid(LIPS);
  const chinC = P(152);
  const noseTip = P(1);
  const noseBridge = P(6);
  const noseMid: [number, number, number] = [
    (noseTip[0] + noseBridge[0]) / 2,
    (noseTip[1] + noseBridge[1]) / 2,
    (noseTip[2] + noseBridge[2]) / 2,
  ];
  const alarC = centroid([48, 278, 64, 294, 2]);
  const cheekCR = P(50);
  const cheekCL = P(280);

  const eyeR = Math.hypot(P(33)[0] - P(133)[0], P(33)[1] - P(133)[1]) / 2;
  const mouthHalf = Math.abs(P(61)[0] - P(291)[0]) / 2;
  const yEye = (eyeCR[1] + eyeCL[1]) / 2;
  const yLip = (P(13)[1] + P(14)[1]) / 2;
  const U = 0.01; // 1 cm
  /**
   * This side's share of the gaussian: the full value when it owns the vertex
   * (the nearer side), zero when the other side does, and HALF at an exact tie.
   * A vertex on the mirror midline (`x === 0`) is exactly equidistant from a
   * paired feature's two centers, so both sides' gaussians are equal; a plain
   * `>=` gave the vertex the full gaussian from BOTH targets — a 2× deformation
   * spike down the centerline (glabella, nose bridge, philtrum), #1256.
   * Splitting the tie keeps the two shares summing to one side's gaussian, so
   * the combined field stays continuous as `x → 0`.
   */
  const gate = (mine: number, other: number): number =>
    mine <= 1e-3 || mine < other ? 0 : mine === other ? mine / 2 : mine;

  /** Each entry: vertex index -> [dx, dy, dz] at weight +1 */
  const recipes: Record<
    AutoMovieFaceParameterName,
    (i: number) => [number, number, number]
  > = {
    faceWidth: (i) => [0.07 * P(i)[0], 0, 0],
    faceLength: (i) => [0, 0.09 * (P(i)[1] - yEye), 0],
    jawWidth: (i) => {
      const t = Math.max(0, Math.min(1, (yEye - P(i)[1]) / (yEye - chinC[1])));
      return [0.16 * P(i)[0] * t * t, 0, 0];
    },
    chinLength: (i) => [0, -1.2 * U * gauss(i, chinC, 2.2 * U), 0],
    chinProtrusion: (i) => [0, 0, 0.9 * U * gauss(i, chinC, 2.0 * U)],
    // paired features carry one target per side; a vertex binds to the
    // NEARER side's centers and the other side's target leaves it untouched
    // (overlapping gaussians once bound the whole left eye to the right
    // center — only one eye responded). gate() returns this side's gaussian
    // when it owns the vertex, else 0.
    cheekFullnessR: (i) => {
      const g = gate(gauss(i, cheekCR, 2.4 * U), gauss(i, cheekCL, 2.4 * U));
      return [Math.sign(P(i)[0]) * 0.7 * U * g, 0, 0.4 * U * g];
    },
    cheekFullnessL: (i) => {
      const g = gate(gauss(i, cheekCL, 2.4 * U), gauss(i, cheekCR, 2.4 * U));
      return [Math.sign(P(i)[0]) * 0.7 * U * g, 0, 0.4 * U * g];
    },
    eyeSizeR: (i) => {
      const g = gate(gauss(i, eyeCR, 1.7 * eyeR), gauss(i, eyeCL, 1.7 * eyeR));
      const p = P(i);
      return [0.36 * (p[0] - eyeCR[0]) * g, 0.36 * (p[1] - eyeCR[1]) * g, 0];
    },
    eyeSizeL: (i) => {
      const g = gate(gauss(i, eyeCL, 1.7 * eyeR), gauss(i, eyeCR, 1.7 * eyeR));
      const p = P(i);
      return [0.36 * (p[0] - eyeCL[0]) * g, 0.36 * (p[1] - eyeCL[1]) * g, 0];
    },
    eyeWidthR: (i) => {
      const g = gate(gauss(i, eyeCR, 1.7 * eyeR), gauss(i, eyeCL, 1.7 * eyeR));
      return [0.36 * (P(i)[0] - eyeCR[0]) * g, 0, 0];
    },
    eyeWidthL: (i) => {
      const g = gate(gauss(i, eyeCL, 1.7 * eyeR), gauss(i, eyeCR, 1.7 * eyeR));
      return [0.36 * (P(i)[0] - eyeCL[0]) * g, 0, 0];
    },
    eyeSpacingR: (i) => {
      const g = gate(
        gauss(i, eyeCR, 2.2 * eyeR) + gauss(i, browCR, 2.0 * eyeR),
        gauss(i, eyeCL, 2.2 * eyeR) + gauss(i, browCL, 2.0 * eyeR),
      );
      return [Math.sign(P(i)[0]) * 0.7 * U * Math.min(1, g), 0, 0];
    },
    eyeSpacingL: (i) => {
      const g = gate(
        gauss(i, eyeCL, 2.2 * eyeR) + gauss(i, browCL, 2.0 * eyeR),
        gauss(i, eyeCR, 2.2 * eyeR) + gauss(i, browCR, 2.0 * eyeR),
      );
      return [Math.sign(P(i)[0]) * 0.7 * U * Math.min(1, g), 0, 0];
    },
    eyeHeightR: (i) => {
      const g = gate(gauss(i, eyeCR, 2.0 * eyeR), gauss(i, eyeCL, 2.0 * eyeR));
      return [0, 0.7 * U * Math.min(1, g), 0];
    },
    eyeHeightL: (i) => {
      const g = gate(gauss(i, eyeCL, 2.0 * eyeR), gauss(i, eyeCR, 2.0 * eyeR));
      return [0, 0.7 * U * Math.min(1, g), 0];
    },
    eyeTiltR: (i) => {
      const g = gate(gauss(i, eyeCR, 2.0 * eyeR), gauss(i, eyeCL, 2.0 * eyeR));
      return [0, 0.12 * (P(i)[0] - eyeCR[0]) * Math.sign(eyeCR[0]) * g, 0];
    },
    eyeTiltL: (i) => {
      const g = gate(gauss(i, eyeCL, 2.0 * eyeR), gauss(i, eyeCR, 2.0 * eyeR));
      return [0, 0.12 * (P(i)[0] - eyeCL[0]) * Math.sign(eyeCL[0]) * g, 0];
    },
    browHeightR: (i) => {
      const g = gate(
        gauss(i, browCR, 1.6 * eyeR),
        gauss(i, browCL, 1.6 * eyeR),
      );
      return [0, 1.4 * U * Math.min(1, g), 0];
    },
    browHeightL: (i) => {
      const g = gate(
        gauss(i, browCL, 1.6 * eyeR),
        gauss(i, browCR, 1.6 * eyeR),
      );
      return [0, 1.4 * U * Math.min(1, g), 0];
    },
    noseLength: (i) => [0, -1.0 * U * gauss(i, noseMid, 2.0 * U), 0],
    noseWidth: (i) => [0.22 * P(i)[0] * gauss(i, alarC, 1.8 * U), 0, 0],
    noseProjection: (i) => [0, 0, 0.9 * U * gauss(i, noseTip, 1.6 * U)],
    mouthWidth: (i) => [
      0.2 * P(i)[0] * gauss(i, mouthC, 1.6 * mouthHalf),
      0,
      0,
    ],
    lipFullness: (i) => {
      const g = gauss(i, mouthC, 1.3 * mouthHalf);
      return [0, 0.35 * (P(i)[1] - yLip) * g, 0.25 * U * g];
    },
    mouthHeight: (i) => [0, 0.7 * U * gauss(i, mouthC, 1.6 * mouthHalf), 0],
  };

  const out = {} as Record<AutoMovieFaceParameterName, number[]>;
  for (const name of Object.keys(recipes) as AutoMovieFaceParameterName[]) {
    const delta = new Array<number>(n * 3);
    for (let i = 0; i < n; i++) {
      const [dx, dy, dz] = recipes[name](i);
      delta[i * 3] = dx;
      delta[i * 3 + 1] = dy;
      delta[i * 3 + 2] = dz;
    }
    out[name] = delta;
  }
  return out;
};
