import { IForgeHeadMorph, morphHead } from "@automovie/forge";
import { TestValidator } from "@nestia/e2e";

/**
 * The parametric-head morph primitive applies bipolar parameters additively: a
 * positive value weights the `plus` sculpt, a negative value the independent
 * `minus` sculpt, each scaled by the magnitude; zero values and unknown names
 * are skipped and the base array is never mutated.
 *
 * Scenario: two verts, two bipolar morphs; check the positive side, the
 * negative side scaled by |v|, accumulation across params with a zero and an
 * unknown name both skipped, and that the input base survives untouched.
 */
export const test_forge_head_morph = (): void => {
  const base = [0, 0, 0, 1, 1, 1];
  const morphs: Record<string, IForgeHeadMorph> = {
    a: { plus: [[0, 1, 0, 0]], minus: [[0, -2, 0, 0]] },
    b: { plus: [[1, 0, 1, 0]], minus: [[1, 0, -1, 0]] },
  };
  TestValidator.equals(
    "positive weights plus",
    morphHead(base, morphs, { a: 0.5 }),
    [0.5, 0, 0, 1, 1, 1],
  );
  TestValidator.equals(
    "negative weights the independent minus by |v|",
    morphHead(base, morphs, { a: -1 }),
    [-2, 0, 0, 1, 1, 1],
  );
  TestValidator.equals(
    "zero + unknown skipped, params accumulate",
    morphHead(base, morphs, { a: 0, b: 1, zzz: 1 }),
    [0, 0, 0, 1, 2, 1],
  );
  TestValidator.equals("base not mutated", base, [0, 0, 0, 1, 1, 1]);
};
