import type { IAutoMovieFilmTimeline } from "@automovie/interface";
import { canonicalProductionWebVtt } from "@automovie/production";
import { TestValidator } from "@nestia/e2e";
import path from "node:path";

import { loadSourceModule } from "../internal/loadSourceModule";

const captionText = loadSourceModule<{
  canonicalizeAutoMovieCaptionText: (value: string) => string;
  serializeAutoMovieWebVttCueText: (value: string) => string;
  serializeAutoMovieWebVttIdentifier: (value: string) => string;
  serializeAutoMovieWebVttSingleLineText: (value: string) => string;
}>(
  path.resolve(
    __dirname,
    "../../../../packages/production/src/production/captionText.ts",
  ),
);

/**
 * Readability and WebVTT consume one canonical caption presentation.
 *
 * Scenarios:
 *
 * 1. CRLF, CR, and LF become the same LF presentation without reflow.
 * 2. Legal tabs survive while every other C0 control and DEL becomes a space.
 * 3. WebVTT reserved characters are escaped without flattening line breaks.
 * 4. Empty authored lines use an empty WebVTT class span, preserving a visible
 *    line without introducing a blank block delimiter or a text grapheme.
 * 5. Annotation text uses a separate single-line sanitizer, while header and
 *    cue identifiers are preserved verbatim: WebVTT defines no entity escape
 *    for them, so escaping would change the identity they carry, and one that
 *    contains a line break or the cue timing arrow is refused instead.
 * 6. Direct WebVTT serialization refuses a malformed language rather than
 *    publishing it as an annotation.
 */
const refusedIdentifier = (value: string): boolean => {
  try {
    captionText.serializeAutoMovieWebVttIdentifier(value);
    return false;
  } catch (error) {
    return (
      error instanceof Error &&
      error.message ===
        "WebVTT header and cue identifiers must not contain a line break or -->."
    );
  }
};

export const test_production_caption_text_presentation = (): void => {
  const authored = "first\r\nsecond\rthird\nfourth\t<&>\u0001\n\nlast\u007f";
  const canonical = "first\nsecond\nthird\nfourth\t<&> \n\nlast ";
  TestValidator.equals(
    "all authored newline forms share one presentation and legal tab survives",
    captionText.canonicalizeAutoMovieCaptionText(authored),
    canonical,
  );
  TestValidator.equals(
    "every prohibited caption control is sanitized without touching tab or LF",
    captionText.canonicalizeAutoMovieCaptionText(
      `${String.fromCharCode(...Array.from({ length: 32 }, (_, index) => index))}\u007f`,
    ),
    `${" ".repeat(9)}\t\n  \n${" ".repeat(19)}`,
  );
  TestValidator.equals(
    "WebVTT payload keeps line boundaries and escapes only text syntax",
    captionText.serializeAutoMovieWebVttCueText(authored),
    "first\nsecond\nthird\nfourth\t&lt;&amp;&gt; \n<c></c>\nlast ",
  );
  TestValidator.equals(
    "single-line fields flatten controls independently from cue payloads",
    captionText.serializeAutoMovieWebVttSingleLineText(
      "id\r\n\t<&>\u0001\u007f",
    ),
    "id   &lt;&amp;&gt;  ",
  );
  TestValidator.equals(
    "identifiers are preserved verbatim or refused, never escaped",
    {
      preserved: captionText.serializeAutoMovieWebVttIdentifier("cue <&> one"),
      lineBreak: refusedIdentifier("cue\none"),
      arrow: refusedIdentifier("cue --> one"),
    },
    { preserved: "cue <&> one", lineBreak: true, arrow: true },
  );

  const timeline: IAutoMovieFilmTimeline = {
    version: 1,
    compiler: "caption-text-fixture",
    inputFingerprint: "sha256:caption-text",
    sourceDigest: "sha256:caption-source",
    id: "film<&>",
    fps: 4,
    totalFrames: 4,
    segments: [],
    omissions: [],
    tracks: {
      audio: [],
      effects: [],
      captions: [
        {
          id: "cue<&>",
          text: "first\r\n\rthird\t<&>\u0001",
          language: "EN-us",
          speaker: "Narrator\nOne",
          startFrame: 0,
          endFrame: 4,
        },
      ],
    },
  };
  const serialized = canonicalProductionWebVtt(timeline);
  TestValidator.equals(
    "canonical WebVTT preserves the exact caption presentation bytes",
    serialized,
    "WEBVTT film<&>\n\ncue<&>\n00:00:00.000 --> 00:00:01.000\n<lang EN-us><v Narrator One>first\n<c></c>\nthird\t&lt;&amp;&gt; </v></lang>\n",
  );
  const payload = serialized
    .split("\n")
    .slice(4, -1)
    .join("\n")
    .replace(/^<lang [^>]+><v [^>]+>/u, "")
    .replace(/<\/v><\/lang>$/u, "")
    .replaceAll("<c></c>", "")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&amp;", "&");
  TestValidator.equals(
    "reparsed WebVTT keeps the canonical authored line presentation",
    payload,
    "first\n\nthird\t<&> ",
  );
  timeline.tracks.captions[0]!.language = "en-12";
  TestValidator.error(
    "malformed caption languages fail closed at serialization",
    () => canonicalProductionWebVtt(timeline),
  );
};
