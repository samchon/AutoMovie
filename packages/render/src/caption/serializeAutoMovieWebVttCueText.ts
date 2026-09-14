import { canonicalizeAutoMovieCaptionText } from "./canonicalizeAutoMovieCaptionText";
import { escapeWebVttText } from "./escapeWebVttText";

/** Serialize canonical caption presentation as a WebVTT cue payload. */
export const serializeAutoMovieWebVttCueText = (value: string): string =>
  canonicalizeAutoMovieCaptionText(value)
    .split("\n")
    .map((line) => (line.length === 0 ? "<c></c>" : escapeWebVttText(line)))
    .join("\n");
