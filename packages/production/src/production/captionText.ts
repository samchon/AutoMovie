const PROHIBITED_CAPTION_CONTROLS =
  /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/gu;
const SINGLE_LINE_CONTROLS = /[\u0000-\u001f\u007f]/gu;

/**
 * Normalize one authored caption into the presentation shared by measurement
 * and delivery.
 *
 * CRLF and CR become LF, legal tabs remain intact, and controls prohibited in
 * WebVTT cue text become spaces. Empty authored lines remain empty here so
 * readability counts the exact authored presentation.
 */
export const canonicalizeAutoMovieCaptionText = (value: string): string =>
  value.replace(/\r\n?/gu, "\n").replace(PROHIBITED_CAPTION_CONTROLS, " ");

/** Serialize canonical caption presentation as a WebVTT cue payload. */
export const serializeAutoMovieWebVttCueText = (value: string): string =>
  canonicalizeAutoMovieCaptionText(value)
    .split("\n")
    .map((line) => (line.length === 0 ? "<c></c>" : escapeWebVttText(line)))
    .join("\n");

/**
 * Serialize an identifier or annotation that must remain on one WebVTT line.
 */
export const serializeAutoMovieWebVttSingleLineText = (value: string): string =>
  escapeWebVttText(value.replace(SINGLE_LINE_CONTROLS, " "));

const escapeWebVttText = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
