import { fitSimilarity2 } from "@automovie/forge";
import { TestValidator } from "@nestia/e2e";

import { nclose } from "../internal/predicates";

/**
 * The 2D similarity fit recovers a known transform exactly when the
 * correspondence is exact: destination points are the sources rotated 30°,
 * scaled 2x, and translated, with z scaled by the same factor about the
 * centroid. The oracle is the constructed transform itself, not the fit's own
 * output.
 *
 * Scenario: a 4-point square mapped by (s=2, θ=30°, t=(5, -3), z 2x) yields
 * scale 2, rotation π/6, and `apply` reproduces every destination point.
 */
export const test_forge_similarity2 = (): void => {
  const s = 2;
  const th = Math.PI / 6;
  const src: number[] = [0, 0, 0, 1, 0, 0.5, 1, 1, 1, 0, 1, -0.5];
  const dst: number[] = [];
  for (let i = 0; i < 4; i++) {
    const [x, y, z] = [src[i * 3]!, src[i * 3 + 1]!, src[i * 3 + 2]!];
    dst.push(
      s * (x * Math.cos(th) - y * Math.sin(th)) + 5,
      s * (x * Math.sin(th) + y * Math.cos(th)) - 3,
      s * (z - 0.25) + 7, // z about the src z-centroid (0.25), offset 7
    );
  }
  const fit = fitSimilarity2(src, dst);
  TestValidator.predicate("scale recovered", nclose(fit.scale, 2));
  TestValidator.predicate("rotation recovered", nclose(fit.rotation, th));
  for (let i = 0; i < 4; i++) {
    const p = fit.apply([src[i * 3]!, src[i * 3 + 1]!, src[i * 3 + 2]!]);
    TestValidator.predicate(
      `point ${i} mapped`,
      nclose(p[0], dst[i * 3]!) &&
        nclose(p[1], dst[i * 3 + 1]!) &&
        nclose(p[2], dst[i * 3 + 2]!),
    );
  }
};
