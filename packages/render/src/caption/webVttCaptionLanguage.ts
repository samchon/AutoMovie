import { parseAutoMovieCaptionLanguage } from "./parseAutoMovieCaptionLanguage";
import { serializeAutoMovieWebVttSingleLineText } from "./serializeAutoMovieWebVttSingleLineText";

/**
 * Serialize one caption language tag for a WebVTT `lang` span, or refuse it.
 *
 * A tag that is not well-formed RFC 5646 fails here rather than reaching the
 * sidecar, so a player never receives a language span it cannot interpret.
 */
export const webVttCaptionLanguage = (value: string): string => {
  const identity = parseAutoMovieCaptionLanguage(value);
  if (identity === null)
    throw new Error(
      `Caption language "${value}" is not a well-formed RFC 5646 tag.`,
    );
  return serializeAutoMovieWebVttSingleLineText(identity.display);
};
