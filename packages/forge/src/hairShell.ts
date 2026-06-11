import { CANONICAL_FACE_POSITIONS } from "./canonicalFace";

/** A self-contained triangle mesh part (flat xyz triples + indices). */
export interface IForgeMeshPart {
  /** Vertex positions, xyz triples (meters). */
  positions: number[];

  /** Triangle vertex indices. */
  indices: number[];
}

/**
 * The parametric hair controls — pure numbers in `[0, 1]`, so a character's
 * hairstyle rides in a preset document next to its face parameters.
 */
export interface IForgeHairParameters {
  /** Fall length: `0` cropped at the jaw, `1` well past the shoulders. */
  length: number;

  /** Outward volume over the skull: `0` skin-tight, `1` voluminous. */
  volume: number;

  /** Fringe coverage: `0` bare forehead (hairline visible), `1` to the brows. */
  bangs: number;

  /** Side-curtain closure: `0` face fully open, `1` curtains hug the cheeks. */
  curtain: number;

  /**
   * Gathered-up styling: `0` the back/sides fall by `length`, `1` the drape
   * lifts to the nape and hugs the skull (bound or braided-up hair). Pair with
   * {@link buildHairBun} for a chignon.
   *
   * @default 0
   */
  updo?: number;
}

/** The neck/shoulder bust controls — preset data like every other parameter. */
export interface IForgeBustParameters {
  /** Neck thickness: `0` slender, `1` thick. */
  neck: number;

  /** Shoulder span: `0` narrow, `1` broad. */
  shoulders: number;
}

/** The chignon controls — preset data like every other hair parameter. */
export interface IForgeBunParameters {
  /** Bun size: `0` none (empty part), `1` a full chignon. */
  size: number;

  /** Height on the occiput: `0` at the nape, `1` near the crown. */
  height: number;
}

/**
 * The parametric cranium controls — signed `[-1, 1]` numbers, `0` the
 * face-derived default, each scaling its axis by ±20%.
 */
export interface IForgeSkullParameters {
  /** Lateral width of the dome. */
  width: number;

  /** Crown height above the hairline. */
  crown: number;

  /** Occiput depth behind the head's center. */
  depth: number;
}

const anchors = (face: number[]) => {
  const P = (i: number): [number, number, number] => [
    face[i * 3]!,
    face[i * 3 + 1]!,
    face[i * 3 + 2]!,
  ];
  const chinY = P(152)[1];
  const topY = P(10)[1]; // face-oval top (hairline-ish)
  const browY = (P(105)[1] + P(334)[1]) / 2;
  const halfW = Math.abs(P(454)[0] - P(234)[0]) / 2;
  return { chinY, topY, browY, halfW };
};

/** Shared ellipsoid axes both the skull and the hair drape derive from. */
const skullAxes = (face: number[], skull: IForgeSkullParameters) => {
  const { chinY, topY, browY, halfW } = anchors(face);
  const faceH = topY - chinY;
  const cy = topY - 0.1 * faceH;
  const b = (topY + 0.38 * faceH - cy) * (1 + 0.2 * skull.crown);
  return {
    chinY,
    topY,
    browY,
    halfW,
    cy,
    crownY: cy + b,
    a: halfW * 1.06 * (1 + 0.2 * skull.width),
    b,
    cBack: halfW * 1.25 * (1 + 0.2 * skull.depth),
    cFront: halfW * 0.34, // behind the eyelid plane: eyeballs must own the openings
  };
};

const NEUTRAL_SKULL: IForgeSkullParameters = { width: 0, crown: 0, depth: 0 };

/**
 * A cranium for the canonical face — the ellipsoid the face shell wraps and
 * every hairstyle drapes over.
 *
 * Proportions derive from the face itself: the dome spans the face width with
 * the crown about a third of a face-height above the hairline, and its front
 * face stays just behind the face shell so the two never z-fight. A
 * mannequin-grade simplification, not anatomy — props and hair need a volume,
 * not a skull atlas.
 *
 * @author Samchon
 */
export const buildSkullShell = (
  skull: IForgeSkullParameters = NEUTRAL_SKULL,
  face: number[] = CANONICAL_FACE_POSITIONS,
): IForgeMeshPart => {
  const { cy, a, b, cBack, cFront, chinY } = skullAxes(face, skull);
  const SEG = 48;
  const RING = 24;
  const positions: number[] = [];
  const indices: number[] = [];
  for (let r = 0; r <= RING; r++) {
    const phi = (Math.PI * r) / RING; // 0 crown .. π bottom
    for (let s = 0; s <= SEG; s++) {
      const th = -Math.PI + (2 * Math.PI * s) / SEG;
      const sin = Math.sin(phi);
      const z = Math.cos(th) * sin;
      const depth = z >= 0 ? cFront : cBack;
      positions.push(
        a * Math.sin(th) * sin,
        // the dome ends at the chin line — a full ellipsoid's lower half
        // reads as a second chin under the face
        Math.max(cy + b * Math.cos(phi), chinY + 0.008),
        depth * z - 0.004,
      );
    }
  }
  const col = SEG + 1;
  for (let r = 0; r < RING; r++)
    for (let s = 0; s < SEG; s++) {
      const i0 = r * col + s;
      indices.push(i0, i0 + col, i0 + 1, i0 + 1, i0 + col, i0 + col + 1);
    }
  return { positions, indices };
};

/**
 * A parametric hairstyle shell — the hair system's base layer.
 *
 * The surface is a strand grid (yaw around the skull × travel down the strand):
 * every strand leaves the skull cap at the parting, hugs the dome inflated by
 * `volume`, then falls to a tip whose height blends by yaw — `length` rules the
 * back and sides, `bangs` rules the front sector over the forehead, and
 * `curtain` narrows the face opening so side hair overlaps the cheeks. All
 * controls are `[0, 1]` numbers, so a hairstyle is preset data, not geometry —
 * the same recipe redraws it over any same-topology face.
 *
 * This intentionally replaces silhouette carving for hair: carved long hair
 * collapses into pillars (single-ellipse slices can't hold concave multi-lobe
 * sections), while a parametric shell stays well-formed across the whole
 * control range.
 *
 * @author Samchon
 */
export const buildHairShell = (
  params: IForgeHairParameters,
  skull: IForgeSkullParameters = NEUTRAL_SKULL,
  face: number[] = CANONICAL_FACE_POSITIONS,
): IForgeMeshPart => {
  const { chinY, topY, browY, cy, crownY, b, a, cBack, cFront } = skullAxes(
    face,
    skull,
  );
  const offset = 0.004 + 0.018 * params.volume;
  const aH = a + offset;
  const cBackH = cBack + offset;
  // extra front reach: the drape must clear the face temples or its rim
  // pokes through painted bangs as bare wedges
  const cFrontH = cFront + offset + 0.006;

  // tip height per yaw: back/sides fall by `length`, the front sector is the
  // fringe ruled by `bangs`; the opening half-angle shrinks with `curtain`;
  // `updo` lifts the back/side fall toward the nape (gathered-up hair)
  const openHalf = (Math.PI / 180) * (70 - 38 * params.curtain);
  const lift = params.updo ?? 0;
  const napeY = cy - 0.95 * b;
  const fallTip = chinY - (0.02 + 0.33 * params.length);
  const backTip = fallTip + (Math.max(napeY, fallTip) - fallTip) * lift;
  const bangTip = topY - (0.004 + (topY - browY) * params.bangs);
  const tipY = (yaw: number): number => {
    const ax = Math.abs(yaw);
    if (ax >= openHalf * 1.35) return backTip;
    if (ax <= openHalf) return bangTip;
    const t = (ax - openHalf) / (openHalf * 0.35);
    return bangTip + (backTip - bangTip) * t;
  };
  // fringe hug: 0 outside the fringe sector, 1 inside — fringe strands taper
  // back onto the forehead instead of floating in front of it
  const fringeness = (yaw: number): number => {
    const ax = Math.abs(yaw);
    if (ax <= openHalf) return 1;
    if (ax >= openHalf * 1.35) return 0;
    return 1 - (ax - openHalf) / (openHalf * 0.35);
  };

  const SEG = 64;
  const ROWS = 30;
  const positions: number[] = [];
  const indices: number[] = [];
  for (let s = 0; s <= SEG; s++) {
    const yaw = -Math.PI + (2 * Math.PI * s) / SEG;
    const tip = tipY(yaw);
    for (let r = 0; r <= ROWS; r++) {
      const v = r / ROWS;
      // descend from the crown: over the dome (y > cy) follow the inflated
      // ellipsoid; below it keep the dome's equator radius, tapering 12%
      // toward the tip so the fall reads as hair, not a tube
      const y = crownY - (crownY - tip) * v;
      const yc = Math.min(1, Math.max(-1, (y - cy) / b));
      const ring = y > cy ? Math.sqrt(1 - yc * yc) : 1;
      const fall = y > cy ? 0 : (cy - y) / Math.max(1e-6, cy - tip);
      const fr = fringeness(yaw);
      // side/back strands FLARE outward as they fall (twin-tail / A-line
      // reading), scaled by volume — bound hair doesn't flare, so `updo`
      // suppresses it
      const flare =
        1 + (1 - fr) * fall * (0.04 + 0.3 * params.volume) * (1 - 0.85 * lift);
      // fringe hug pulls tips onto the forehead — but at temple yaws the
      // tuck must never dive inside the skull (bare-scalp patches): clamp it
      // to the dome radius there, while the center forehead (face-plate
      // territory, skull safely behind) keeps the full hug
      const tuckRaw = 1 - fr * v * (offset / (cFront + offset)) * 0.9;
      const guard = (a + 0.003) / (aH * flare);
      const tuck =
        Math.abs(Math.sin(yaw)) > 0.3 || y > topY
          ? Math.max(tuckRaw, guard)
          : tuckRaw;
      const depth = Math.cos(yaw) >= 0 ? cFrontH : cBackH;
      positions.push(
        aH * Math.sin(yaw) * ring * flare * tuck,
        y,
        depth * Math.cos(yaw) * ring * flare * tuck,
      );
    }
  }
  const col = ROWS + 1;
  for (let s = 0; s < SEG; s++)
    for (let r = 0; r < ROWS; r++) {
      const i0 = s * col + r;
      indices.push(i0, i0 + 1, i0 + col, i0 + 1, i0 + col + 1, i0 + col);
    }
  return { positions, indices };
};

/**
 * A chignon lobe on the occiput — the gathered mass an `updo` drape ties into,
 * which a closed loft cannot express (same reasoning as the twin tails).
 *
 * A head-flattened spheroid whose center rides the occiput surface at `height`
 * between the nape and the crown, sunk slightly into the dome so the seam stays
 * hidden. `size` `0` yields empty parts, so the same preset schema covers
 * bunless styles.
 *
 * @author Samchon
 */
export const buildHairBun = (
  params: IForgeBunParameters,
  skull: IForgeSkullParameters = NEUTRAL_SKULL,
  face: number[] = CANONICAL_FACE_POSITIONS,
): IForgeMeshPart => {
  if (params.size <= 0) return { positions: [], indices: [] };
  const { cy, b, cBack } = skullAxes(face, skull);
  const r0 = 0.016 + 0.038 * params.size;
  const yC = cy - 0.6 * b + 1.25 * b * params.height;
  const yn = Math.min(1, Math.max(-1, (yC - cy) / b));
  // center sits just inside the occiput surface at that height
  const zC = -cBack * Math.sqrt(1 - yn * yn) - r0 * 0.15;
  const SEG = 24;
  const RING = 12;
  const positions: number[] = [];
  const indices: number[] = [];
  for (let r = 0; r <= RING; r++) {
    const phi = (Math.PI * r) / RING;
    for (let s = 0; s <= SEG; s++) {
      const th = -Math.PI + (2 * Math.PI * s) / SEG;
      positions.push(
        r0 * Math.sin(phi) * Math.sin(th),
        yC + r0 * Math.cos(phi),
        zC - 0.8 * r0 * Math.sin(phi) * Math.cos(th), // flattened toward the head
      );
    }
  }
  const col = SEG + 1;
  for (let r = 0; r < RING; r++)
    for (let s = 0; s < SEG; s++) {
      const i0 = r * col + s;
      indices.push(i0, i0 + col, i0 + 1, i0 + 1, i0 + col, i0 + col + 1);
    }
  return { positions, indices };
};

/**
 * A neck-and-shoulders bust under the head — without it every render reads as a
 * severed mask floating in space. Proportions derive from the face: the neck
 * spans a fraction of the jaw width and drops from just above the chin line (so
 * the jaw overlaps it, no gap at any chin length), flaring into a shoulder slab
 * below. A mannequin-grade base for portraits, not anatomy.
 *
 * @author Samchon
 */
export const buildBust = (
  params: IForgeBustParameters,
  face: number[] = CANONICAL_FACE_POSITIONS,
): IForgeMeshPart => {
  const { chinY, topY, halfW } = anchors(face);
  const faceH = topY - chinY;
  const rxNeck = halfW * (0.42 + 0.22 * params.neck);
  const rzNeck = rxNeck * 0.92;
  const yTop = chinY + 0.015; // tucked behind the jaw
  const neckLen = 0.32 * faceH;
  const slabLen = 0.3 * faceH;
  const rxShoulder = halfW * (1.7 + 1.1 * params.shoulders);
  const rzShoulder = rzNeck * 1.5;
  const SEG = 32;
  const RING = 14;
  const positions: number[] = [];
  const indices: number[] = [];
  const smooth = (t: number): number => t * t * (3 - 2 * t);
  for (let r = 0; r <= RING; r++) {
    const t = r / RING;
    const y = yTop - (neckLen + slabLen) * t;
    // the neck holds its radius, then eases into the shoulder span
    const flare = smooth(Math.max(0, (t - 0.45) / 0.55));
    const rx = rxNeck + (rxShoulder - rxNeck) * flare;
    const rz = rzNeck + (rzShoulder - rzNeck) * flare;
    for (let s = 0; s <= SEG; s++) {
      const th = -Math.PI + (2 * Math.PI * s) / SEG;
      positions.push(rx * Math.sin(th), y, rz * Math.cos(th) - 0.012);
    }
  }
  const col = SEG + 1;
  for (let r = 0; r < RING; r++)
    for (let s = 0; s < SEG; s++) {
      const i0 = r * col + s;
      indices.push(i0, i0 + col, i0 + 1, i0 + 1, i0 + col, i0 + col + 1);
    }
  // bottom cap so the bust reads solid from low angles
  const center = positions.length / 3;
  positions.push(0, yTop - (neckLen + slabLen), -0.012);
  const base = RING * col;
  for (let s = 0; s < SEG; s++) indices.push(center, base + s, base + s + 1);
  return { positions, indices };
};
