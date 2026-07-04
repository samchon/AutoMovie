import { CANONICAL_FACE_POSITIONS } from "./CanonicalFace";
import {
  IForgeMeshPart,
  IForgeSkullParameters,
  buildSkullShell,
} from "./HairShell";

/**
 * The twin-tail controls — pure `[0, 1]` numbers, preset data like every other
 * hair parameter.
 */
export interface IForgeTailParameters {
  /** Tail length: `0` none (empty parts), `1` past the shoulders. */
  length: number;

  /** Anchor height on the skull side: `0` at the nape, `1` above the ears. */
  height: number;

  /** Outward sweep: `0` hanging straight, `1` flaring wide. */
  spread: number;

  /** Tail thickness. */
  width: number;
}

const SEG = 12;
const RINGS = 16;

const tailPart = (
  side: 1 | -1,
  p: IForgeTailParameters,
  skull: IForgeSkullParameters | undefined,
  face: number[],
): IForgeMeshPart => {
  if (p.length <= 0) return { positions: [], indices: [] };
  // skull frame from the same axes the dome uses
  const dome = buildSkullShell(skull, face);
  let maxX = 0,
    topY = -Infinity,
    botY = Infinity;
  for (let i = 0; i < dome.positions.length; i += 3) {
    maxX = Math.max(maxX, Math.abs(dome.positions[i]!));
    topY = Math.max(topY, dome.positions[i + 1]!);
    botY = Math.min(botY, dome.positions[i + 1]!);
  }
  const anchor: [number, number, number] = [
    side * maxX * 0.92,
    botY + (topY - botY) * (0.25 + 0.35 * p.height),
    -0.008,
  ];
  const L = 0.06 + 0.3 * p.length;
  const r0 = 0.012 + 0.022 * p.width;

  const positions: number[] = [];
  const indices: number[] = [];
  for (let r = 0; r <= RINGS; r++) {
    const t = r / RINGS;
    // centerline: out and down, swinging with `spread`, settling inward at
    // the tip the way a bound tail hangs
    const cxL =
      anchor[0] + side * (0.012 + (0.05 * p.spread + 0.01) * Math.pow(t, 0.7));
    const cyL = anchor[1] - L * t;
    const czL = anchor[2] - 0.012 * t;
    // radius: puff after the tie, taper to the tip
    const rad =
      r0 * (0.55 + 0.85 * Math.sin(Math.PI * Math.min(1, 0.15 + t * 0.85)));
    for (let s = 0; s <= SEG; s++) {
      const th = (2 * Math.PI * s) / SEG;
      positions.push(cxL + rad * Math.cos(th), cyL, czL + rad * Math.sin(th));
    }
  }
  const col = SEG + 1;
  for (let r = 0; r < RINGS; r++)
    for (let s = 0; s < SEG; s++) {
      const i0 = r * col + s;
      indices.push(i0, i0 + 1, i0 + col, i0 + 1, i0 + col + 1, i0 + col);
    }
  return { positions, indices };
};

/**
 * Twin-tail lobes — the hairstyle element the draped shell cannot express (a
 * closed loft has no detached masses).
 *
 * Each tail is a tapered tube anchored on the skull's side: a short stem at the
 * tie, a puff, then a taper to the tip, swinging outward by `spread` and
 * settling back in the way a bound tail hangs. `length` 0 yields empty parts,
 * so the same preset schema covers tailless styles.
 *
 * @author Samchon
 */
export const buildHairTails = (
  params: IForgeTailParameters,
  skull?: IForgeSkullParameters,
  face: number[] = CANONICAL_FACE_POSITIONS,
): { right: IForgeMeshPart; left: IForgeMeshPart } => ({
  right: tailPart(-1, params, skull, face),
  left: tailPart(1, params, skull, face),
});
