/** A skin-gated profile silhouette curve (one entry per image row). */
export interface IForgeProfileCurve {
  /** Front-extent pixel column per row; `-1` where the row has no figure. */
  ext: number[];

  /** Whether each row's silhouette edge is skin (vs hair / accessories). */
  skin: boolean[];

  /** The nose-tip row (the most protruding skin row). */
  noseRow: number;
}

/** The fitted depth calibration. */
export interface IForgeAmplitudeFit {
  /** Multiply detected depths by this to match the photographed profile. */
  alpha: number;

  /** Frontal-view rows per profile-view row (the cross-view y scale). */
  rowScale: number;

  /** Root-mean-square residual of the winning fit, in frontal px. */
  rms: number;
}

/**
 * Calibrate the absolute depth amplitude of a detected face against its profile
 * photograph.
 *
 * Landmark detectors get relative depth shapes roughly right but their
 * amplitude wrong, and two-view triangulation cannot fix it either (the
 * bas-relief ambiguity couples depth scale with the unknown yaw) — the profile
 * silhouette is the one absolute reference. Point anchors ("the chin tip")
 * proved fragile across chin shapes, so the WHOLE nose→chin midline curve is
 * matched instead: grid-search the cross-view row scale (the nose row pins the
 * offset), solve the amplitude by least squares at each candidate, keep the
 * best-residual pair. Rows whose silhouette edge is not skin (bangs, strands)
 * are excluded. The amplitude is clamped to `[0.2, 1.5]` — beyond that the fit
 * is answering a different question.
 *
 * @author Samchon
 * @param midline Nose→chin midline depths (strictly increasing y, first sample
 *   AT the nose), `{ y, z }` in frontal px with `z = 0` at the nose and
 *   negative behind it, sorted by y
 * @param curve The profile silhouette (see {@link IForgeProfileCurve})
 * @param noseY The nose-tip row in the frontal view
 * @param chinY The chin row in the frontal view
 * @throws When no row scale yields at least 15 usable row pairs
 */
export const fitProfileAmplitude = (props: {
  midline: { y: number; z: number }[];
  curve: IForgeProfileCurve;
  noseY: number;
  chinY: number;
}): IForgeAmplitudeFit => {
  const { midline, curve, noseY, chinY } = props;
  const midZ = (y: number): number => {
    for (let j = 1; j < midline.length; j++)
      if (y <= midline[j]!.y) {
        const t = (y - midline[j - 1]!.y) / (midline[j]!.y - midline[j - 1]!.y);
        return midline[j - 1]!.z + t * (midline[j]!.z - midline[j - 1]!.z);
      }
    return midline[midline.length - 1]!.z;
  };

  const extNose = curve.ext[curve.noseRow]!;
  let best: IForgeAmplitudeFit | null = null;
  for (let k = 0; k <= 65; k++) {
    const rowScale = 0.55 + k * 0.01;
    let saa = 0;
    let sab = 0;
    let n = 0;
    const pairs: [number, number][] = [];
    for (let y = noseY + 2; y <= chinY; y++) {
      const yP = Math.round(curve.noseRow + rowScale * (y - noseY));
      if (yP >= curve.ext.length) continue;
      if (!curve.skin[yP] || curve.ext[yP]! < 0) continue;
      const a = midZ(y);
      const b = (curve.ext[yP]! - extNose) / rowScale;
      saa += a * a;
      sab += a * b;
      pairs.push([a, b]);
      n++;
    }
    if (n < 15) continue;
    const alpha = sab / saa;
    let res = 0;
    for (const [a, b] of pairs) res += (alpha * a - b) ** 2;
    const rms = Math.sqrt(res / n);
    if (best === null || rms < best.rms) best = { alpha, rowScale, rms };
  }
  if (best === null)
    throw new Error("profile span too short to calibrate (need 15 row pairs)");
  best.alpha = Math.max(0.2, Math.min(1.5, best.alpha));
  return best;
};
