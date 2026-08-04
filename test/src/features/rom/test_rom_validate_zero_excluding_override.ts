import {
  ViolationCollector,
  clampJointRom,
  validateJointRom,
} from "@automovie/engine";
import { IAutoMovieJointConstraint } from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { joint } from "../internal/fixtures";
import { nclose } from "../internal/predicates";

/**
 * Evaluate named facts in order and stop at the first false one, so a failed
 * comparison names the fact instead of collapsing into one boolean. Stopping
 * keeps the short-circuit semantics the original conjunction had, which some
 * facts depend on to guard the ones after them.
 */
const namedFacts = (
  entries: ReadonlyArray<readonly [string, () => boolean]>,
): Record<string, boolean> => {
  const output: Record<string, boolean> = {};
  for (const [name, evaluate] of entries) {
    output[name] = evaluate();
    if (output[name] === false) break;
  }
  return output;
};

/**
 * Detect and enforce must be one calculation: `validateJointRom` used to skip
 * `angle === 0` unconditionally, but a per-bone override may legally EXCLUDE
 * zero (`flexion: [10, 90]`, only min ≤ max is enforced), and `clampJointRom`
 * moves that 0 to the min. Validation calling the authored 0 clean while the
 * clamp rewrites it broke the pair's contract (#1057). The zero skip exists
 * only for the IMMOBILE axis, where 0 is that axis's rest.
 *
 * Scenarios:
 *
 * 1. Flexion 0 against a zero-excluding `[10, 90]` override reports a `rom`
 *    violation at the axis path, and `clampJointRom` moves the same input to 10
 *    (clamp/validate parity).
 * 2. Zero on an immobile (`null`) axis of the same constraint stays clean, and a
 *    zero against a zero-INCLUDING range stays clean: the skip survives exactly
 *    where it is correct.
 */
export const test_rom_validate_zero_excluding_override = (): void => {
  const constraint: IAutoMovieJointConstraint = {
    flexion: { min: 10, max: 90 },
    abduction: null,
    twist: { min: -30, max: 30 },
  };

  // 1. zero against a zero-excluding override reports and clamps to the min
  const collector = new ViolationCollector();
  validateJointRom({
    joint: joint("leftLowerArm", { flexion: 0, abduction: 0, twist: 0 }),
    constraint,
    path: "$input",
    collector,
  });
  TestValidator.equals(
    "zero against a zero-excluding override is a rom violation",
    namedFacts([
      ["collectorCount", () => collector.items.length === 1],
      ["collectorItems", () => collector.items[0]!.kind === "rom"],
      ["collectorItems2", () => collector.items[0]!.path === "$input.flexion"],
    ]),
    {
      collectorCount: true,
      collectorItems: true,
      collectorItems2: true,
    },
  );
  const clamped = clampJointRom(
    joint("leftLowerArm", { flexion: 0, abduction: 0, twist: 0 }),
    constraint,
  );
  TestValidator.predicate(
    "clampJointRom agrees: the same zero moves to the range min",
    nclose(clamped.flexion!, 10),
  );

  // 2. the immobile-axis skip and zero-including ranges stay clean (the
  //    abduction 0 and twist 0 above produced no violations of their own)
  const clean = new ViolationCollector();
  validateJointRom({
    joint: joint("leftLowerArm", { flexion: 45, abduction: 0, twist: 0 }),
    constraint,
    path: "$input",
    collector: clean,
  });
  TestValidator.equals(
    "immobile-axis zero and zero-including ranges stay clean",
    clean.items.length,
    0,
  );
};
