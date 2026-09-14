/**
 * Escape the three characters WebVTT reads as cue-text syntax.
 *
 * Cue payloads and single-line annotations share this escape, and a caption
 * that escaped one but not the other would publish markup in one field and
 * literal text in the other, so both serializers read it here.
 */
export const escapeWebVttText = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
