import {
  autoMovieCaptionLanguageComparisonKey,
  parseAutoMovieCaptionLanguage,
} from "@automovie/render";
import { TestValidator } from "@nestia/e2e";

/**
 * Caption language tags follow RFC 5646's grammar, not a registry lookup.
 *
 * The delivery contract requires a well-formed retained tag with an ASCII
 * case-insensitive comparison identity, and forbids registry membership,
 * Preferred-Value replacement and language inference. The grammar is therefore
 * the whole admission rule: every production below is taken from RFC 5646
 * section 2.1 (`langtag`, `privateuse`, `grandfathered`) and its uniqueness
 * requirements for variants and extension singletons, so a tag is admitted for
 * its shape and rejected for a shape violation the section names.
 *
 * Scenarios:
 *
 * 1. A grandfathered production is admitted by the fixed list, case-folded for
 *    comparison, while a tag one letter away from it falls through to the
 *    ordinary grammar and is judged there.
 * 2. Subtag shape refusals: an empty subtag, a nine-character subtag, and a
 *    non-alphanumeric character are all malformed regardless of position.
 * 3. A private-use tag needs at least one subtag after its `x` singleton.
 * 4. The primary language is two to eight alphabetic characters, so a single
 *    letter and a digit-leading subtag are refused.
 * 5. Up to three extlang subtags, one script, and either an alphabetic or a
 *    three-digit region are consumed in order, and a fourth extlang leaves a
 *    subtag the grammar cannot place.
 * 6. Variants are five-to-eight characters or four characters starting with a
 *    digit, and a repeated variant is refused by the uniqueness rule.
 * 7. Extension singletons carry at least one subtag each and never repeat, so a
 *    bare singleton and a repeated singleton are both refused.
 * 8. A private-use tail ends the tag, and a trailing subtag the grammar cannot
 *    place is refused rather than ignored.
 * 9. The comparison key folds ASCII case only, and a malformed tag has no key.
 */
export const test_render_caption_language_tag_grammar = (): void => {
  const parsed = (value: string): string | null =>
    parseAutoMovieCaptionLanguage(value)?.comparisonKey ?? null;
  const display = (value: string): string | null =>
    parseAutoMovieCaptionLanguage(value)?.display ?? null;

  TestValidator.equals(
    "a grandfathered production is admitted case-insensitively",
    {
      exact: parsed("art-lojban"),
      upper: parsed("I-Klingon"),
      display: display("ART-Lojban"),
      nearMiss: parsed("art-lojbar"),
    },
    {
      exact: "art-lojban",
      upper: "i-klingon",
      display: "ART-Lojban",
      nearMiss: "art-lojbar",
    },
  );

  TestValidator.equals(
    "a subtag outside one to eight alphanumeric characters is malformed",
    {
      empty: parsed("en--US"),
      tooLong: parsed("en-abcdefghi"),
      punctuation: parsed("en_US"),
      trailingSeparator: parsed("en-"),
    },
    { empty: null, tooLong: null, punctuation: null, trailingSeparator: null },
  );

  TestValidator.equals(
    "a private-use tag carries at least one subtag after its singleton",
    { withSubtag: parsed("x-movie"), bare: parsed("x") },
    { withSubtag: "x-movie", bare: null },
  );

  TestValidator.equals(
    "the primary language is two to eight alphabetic characters",
    {
      twoLetter: parsed("de"),
      eightLetter: parsed("abcdefgh"),
      oneLetter: parsed("e"),
      digitLeading: parsed("1en"),
    },
    {
      twoLetter: "de",
      eightLetter: "abcdefgh",
      oneLetter: null,
      digitLeading: null,
    },
  );

  TestValidator.equals(
    "extlang, script, and region subtags are consumed in grammar order",
    {
      extlangScriptRegion: parsed("zh-yue-Hant-HK"),
      threeExtlang: parsed("zh-abc-def-ghi"),
      fourExtlang: parsed("zh-abc-def-ghi-jkl"),
      numericRegion: parsed("es-419"),
      scriptOnly: parsed("sr-Latn"),
    },
    {
      extlangScriptRegion: "zh-yue-hant-hk",
      threeExtlang: "zh-abc-def-ghi",
      fourExtlang: null,
      numericRegion: "es-419",
      scriptOnly: "sr-latn",
    },
  );

  TestValidator.equals(
    "variants are unique and either long or digit-led four characters",
    {
      alphabetic: parsed("sl-rozaj-biske"),
      digitLed: parsed("de-DE-1901"),
      repeated: parsed("de-DE-1901-1901"),
      fourAlphabetic: parsed("de-DE-abcd-x-priv"),
    },
    {
      alphabetic: "sl-rozaj-biske",
      digitLed: "de-de-1901",
      repeated: null,
      fourAlphabetic: null,
    },
  );

  TestValidator.equals(
    "an extension singleton needs its own subtag and never repeats",
    {
      single: parsed("en-u-co-phonebk"),
      twoSingletons: parsed("en-a-bbb-u-co-phonebk"),
      bare: parsed("en-u"),
      repeated: parsed("en-u-aaa-u-bbb"),
    },
    {
      single: "en-u-co-phonebk",
      twoSingletons: "en-a-bbb-u-co-phonebk",
      bare: null,
      repeated: null,
    },
  );

  TestValidator.equals(
    "a private-use tail closes the tag and an unplaceable subtag is refused",
    {
      tail: parsed("en-US-x-movie-01"),
      bareTail: parsed("en-US-x"),
      digitVariant: parsed("en-US-999999"),
      unplaceable: parsed("en-US-abc"),
    },
    {
      tail: "en-us-x-movie-01",
      bareTail: null,
      digitVariant: "en-us-999999",
      unplaceable: null,
    },
  );

  TestValidator.equals(
    "the comparison key folds ASCII case only and refuses a malformed tag",
    {
      folded: autoMovieCaptionLanguageComparisonKey("EN-Us"),
      preserved: display("EN-Us"),
      malformed: autoMovieCaptionLanguageComparisonKey("en-12"),
    },
    { folded: "en-us", preserved: "EN-Us", malformed: null },
  );
};
