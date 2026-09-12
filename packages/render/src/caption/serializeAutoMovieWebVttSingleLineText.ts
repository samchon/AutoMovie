import { escapeWebVttText } from "./escapeWebVttText";

const SINGLE_LINE_CONTROLS = /[\u0000-\u001f\u007f]/gu;

/**
 * Serialize an identifier or annotation that must remain on one WebVTT line.
 */
export const serializeAutoMovieWebVttSingleLineText = (value: string): string =>
  escapeWebVttText(value.replace(SINGLE_LINE_CONTROLS, " "));
