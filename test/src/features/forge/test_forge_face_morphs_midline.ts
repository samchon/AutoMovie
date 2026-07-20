import { CANONICAL_FACE_POSITIONS, buildFaceMorphs } from "@automovie/forge";
import { TestValidator } from "@nestia/e2e";

/**
 * A paired feature's side-ownership gate must split an exact tie, not double
 * it. A vertex on the mirror midline (`x === 0`) is equidistant from a paired
 * feature's two centers, so both sides' gaussians are equal; a plain `>=` gave
 * such a vertex the FULL gaussian from both targets: a 2× deformation spike
 * down the centerline (glabella, nose bridge, philtrum), #1256. The fix splits
 * the tie 0.5/0.5, keeping the combined field continuous as `x → 0`.
 *
 * Scenarios (browHeight, the highest-blast-radius pair):
 *
 * 1. At every midline vertex the gate touches, the two sides' deltas are exactly
 *    equal (the split), so neither side owns the tie alone.
 * 2. The combined R+L deformation at a midline vertex is CONTINUOUS across the
 *    seam: nudging that vertex a hair off the midline (so one side owns it
 *    outright) barely changes its combined delta: it does NOT halve, which is
 *    what a 2×-at-the-tie spike would show.
 */
export const test_forge_face_morphs_midline = (): void => {
  const morphs = buildFaceMorphs();
  const R = morphs.browHeightR;
  const L = morphs.browHeightL;
  const dyR = (v: number): number => R[v * 3 + 1]!;
  const dyL = (v: number): number => L[v * 3 + 1]!;

  // midline vertices the brow gate actually deforms
  const n = CANONICAL_FACE_POSITIONS.length / 3;
  const touched: number[] = [];
  for (let v = 0; v < n; ++v)
    if (
      CANONICAL_FACE_POSITIONS[v * 3] === 0 &&
      (Math.abs(dyR(v)) > 1e-9 || Math.abs(dyL(v)) > 1e-9)
    )
      touched.push(v);
  TestValidator.predicate(
    "the brow gate touches at least one midline vertex",
    touched.length > 0,
  );

  // 1. each side takes exactly half at the tie
  for (const v of touched)
    TestValidator.predicate(
      `midline vertex ${v} splits the tie evenly`,
      Math.abs(dyR(v) - dyL(v)) < 1e-12 && dyR(v) > 0,
    );

  // 2. continuity across the midline: nudge one midline vertex off-axis so one
  // side owns it, and confirm its combined delta barely moves (no 2× → 1× step).
  const v = touched.reduce((a, b) =>
    Math.abs(dyR(a) + dyL(a)) > Math.abs(dyR(b) + dyL(b)) ? a : b,
  );
  const combinedMid = dyR(v) + dyL(v);
  const nudged = [...CANONICAL_FACE_POSITIONS];
  nudged[v * 3] = 1e-6; // a hair to the +x side
  const off = buildFaceMorphs(nudged);
  const combinedOff = off.browHeightR[v * 3 + 1]! + off.browHeightL[v * 3 + 1]!;
  TestValidator.predicate(
    "the combined brow delta is continuous across the midline (no 2x spike)",
    Math.abs(combinedMid - combinedOff) < 1e-4 &&
      // and it is NOT twice the off-midline value (the pre-fix symptom)
      Math.abs(combinedMid - 2 * combinedOff) > Math.abs(combinedMid) * 0.4,
  );
};
