import { parseAutoMovieCaptionLanguage } from "./parseAutoMovieCaptionLanguage";

/** Return the case-insensitive identity of a well-formed language tag. */
export const autoMovieCaptionLanguageComparisonKey = (
  value: string,
): string | null => parseAutoMovieCaptionLanguage(value)?.comparisonKey ?? null;
