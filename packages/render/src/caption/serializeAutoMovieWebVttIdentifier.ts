import { isAutoMovieWebVttIdentifier } from "./isAutoMovieWebVttIdentifier";

/** Preserve one WebVTT header or cue identifier without text escaping. */
export const serializeAutoMovieWebVttIdentifier = (value: string): string => {
  if (isAutoMovieWebVttIdentifier(value) === false)
    throw new Error(
      "WebVTT header and cue identifiers must not contain a line break or -->.",
    );
  return value;
};
