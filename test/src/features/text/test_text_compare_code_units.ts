import { compareCodeUnits } from "@automovie/engine";
import { TestValidator } from "@nestia/e2e";

/**
 * `compareCodeUnits` is the locale-independent total order the engine and store
 * use wherever an order feeds the render event stream, tool-visible arrays, or
 * persisted slate reads (#1225). It must be a pure function of the UTF-16 code
 * units — reproducible on every host regardless of locale or ICU build — and,
 * unlike `localeCompare`, it must return a non-zero result for any two distinct
 * strings so a sort stays a strict order.
 *
 * Scenarios:
 *
 * 1. The three outcomes: a strictly-lesser string yields -1, a strictly-greater
 *    string yields +1, and an equal string yields 0 (the branch a sort of
 *    distinct keys never reaches).
 * 2. Uppercase sorts before lowercase (code-unit order: 'A' 0x41 < 'a' 0x61), the
 *    exact case where locale collation interleaves and this order does not.
 * 3. Distinct-but-Unicode-equivalent strings (NFC vs NFD) compare non-zero —
 *    `localeCompare` returns 0 here, which would collapse two distinct keys;
 *    the code-unit order keeps them ordered.
 * 4. A full sort of mixed-case filenames matches the hand-written code-unit oracle
 *    (not the output of any locale-sensitive comparator).
 */
export const test_text_compare_code_units = (): void => {
  // 1. the three outcomes
  TestValidator.equals(
    "a lesser string yields -1",
    compareCodeUnits("a", "b"),
    -1,
  );
  TestValidator.equals(
    "a greater string yields +1",
    compareCodeUnits("b", "a"),
    1,
  );
  TestValidator.equals(
    "an equal string yields 0",
    compareCodeUnits("x", "x"),
    0,
  );

  // 2. uppercase before lowercase (code-unit, not locale, order)
  TestValidator.equals(
    "uppercase sorts before lowercase",
    compareCodeUnits("A", "a"),
    -1,
  );

  // 3. distinct Unicode-equivalent forms compare non-zero (localeCompare = 0).
  // Built from char codes so the two are runtime-distinct `string` values, not
  // literal types the checker would flag as a never-equal comparison.
  const nfcCafe = `caf${String.fromCharCode(0x00e9)}`; // precomposed U+00E9
  const nfdCafe = `cafe${String.fromCharCode(0x0301)}`; // e + combining U+0301
  TestValidator.predicate(
    "distinct Unicode-equivalent strings are ordered, not equal",
    nfcCafe !== nfdCafe && compareCodeUnits(nfcCafe, nfdCafe) !== 0,
  );

  // 4. a full sort matches the hand-written code-unit oracle
  const names = [
    "Beat10.json",
    "beat2.json",
    "BEAT1.json",
    "aShot.json",
    "AShot.json",
    "b-1.json",
    "b.1.json",
  ];
  TestValidator.equals(
    "a mixed-case sort follows code-unit order",
    [...names].sort(compareCodeUnits),
    [
      "AShot.json",
      "BEAT1.json",
      "Beat10.json",
      "aShot.json",
      "b-1.json",
      "b.1.json",
      "beat2.json",
    ],
  );
};
