/**
 * Parsed RFC 5646 caption-language identity.
 *
 * `display` retains the authored spelling. `comparisonKey` folds only ASCII
 * case, as RFC 5646 comparison requires, without consulting a language
 * registry or replacing a tag with a Preferred-Value.
 */
interface IAutoMovieCaptionLanguageIdentity {
  /** Authored language tag preserved for display and serialization. */
  display: string;
  /** ASCII case-insensitive identity used by every caption consumer. */
  comparisonKey: string;
}

const GRANDFATHERED_LANGUAGE_TAGS = new Set([
  "art-lojban",
  "cel-gaulish",
  "en-gb-oed",
  "i-ami",
  "i-bnn",
  "i-default",
  "i-enochian",
  "i-hak",
  "i-klingon",
  "i-lux",
  "i-mingo",
  "i-navajo",
  "i-pwn",
  "i-tao",
  "i-tay",
  "i-tsu",
  "no-bok",
  "no-nyn",
  "sgn-be-fr",
  "sgn-be-nl",
  "sgn-ch-de",
  "zh-guoyu",
  "zh-hakka",
  "zh-min",
  "zh-min-nan",
  "zh-xiang",
]);

const ALPHA = /^[A-Za-z]+$/u;
const ALPHANUMERIC = /^[A-Za-z0-9]+$/u;
const DIGIT = /^[0-9]+$/u;

/**
 * Parse one RFC 5646 well-formed language tag without registry semantics.
 *
 * Grandfathered tags are the fixed productions listed by RFC 5646. All other
 * tags are checked against its `langtag` and `privateuse` grammar, including
 * the uniqueness requirements for variants and extension singletons.
 */
export const parseAutoMovieCaptionLanguage = (
  value: string,
): IAutoMovieCaptionLanguageIdentity | null => {
  const comparisonKey = value.toLowerCase();
  if (GRANDFATHERED_LANGUAGE_TAGS.has(comparisonKey))
    return { display: value, comparisonKey };

  const subtags = value.split("-");
  if (
    subtags.some(
      (subtag) =>
        subtag.length === 0 ||
        subtag.length > 8 ||
        ALPHANUMERIC.test(subtag) === false,
    )
  )
    return null;

  if (subtags[0]!.toLowerCase() === "x")
    return subtags.length > 1 ? { display: value, comparisonKey } : null;

  let index = 0;
  const language = subtags[index++]!;
  if (ALPHA.test(language) === false || language.length < 2) return null;
  if (language.length <= 3) {
    for (
      let extlangCount = 0;
      extlangCount < 3 &&
      index < subtags.length &&
      subtags[index]!.length === 3 &&
      ALPHA.test(subtags[index]!);
      extlangCount += 1
    )
      index += 1;
  }

  if (
    index < subtags.length &&
    subtags[index]!.length === 4 &&
    ALPHA.test(subtags[index]!)
  )
    index += 1;
  if (
    index < subtags.length &&
    ((subtags[index]!.length === 2 && ALPHA.test(subtags[index]!)) ||
      (subtags[index]!.length === 3 && DIGIT.test(subtags[index]!)))
  )
    index += 1;

  const variants = new Set<string>();
  while (index < subtags.length && isVariant(subtags[index]!)) {
    const variant = subtags[index]!.toLowerCase();
    if (variants.has(variant)) return null;
    variants.add(variant);
    index += 1;
  }

  const singletons = new Set<string>();
  while (index < subtags.length && isExtensionSingleton(subtags[index]!)) {
    const singleton = subtags[index]!.toLowerCase();
    if (singletons.has(singleton)) return null;
    singletons.add(singleton);
    index += 1;
    const firstExtensionSubtag = index;
    while (
      index < subtags.length &&
      subtags[index]!.length >= 2 &&
      subtags[index]!.length <= 8
    )
      index += 1;
    if (index === firstExtensionSubtag) return null;
  }

  if (index < subtags.length && subtags[index]!.toLowerCase() === "x") {
    index += 1;
    if (index === subtags.length) return null;
    index = subtags.length;
  }

  return index === subtags.length ? { display: value, comparisonKey } : null;
};

/** Return the case-insensitive identity of a well-formed language tag. */
export const autoMovieCaptionLanguageComparisonKey = (
  value: string,
): string | null => parseAutoMovieCaptionLanguage(value)?.comparisonKey ?? null;

const isVariant = (value: string): boolean =>
  (value.length >= 5 && value.length <= 8) ||
  (value.length === 4 && DIGIT.test(value[0]!));

const isExtensionSingleton = (value: string): boolean =>
  value.length === 1 && /^[0-9A-WY-Za-wy-z]$/u.test(value);
