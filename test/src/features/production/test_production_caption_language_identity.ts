import type { IAutoMovieCaptionReadabilityProfile } from "@automovie/interface";
import {
  AutoMovieProductionCompiler,
  AutoMovieProductionProject,
  validateAutoMovieProductionGraph,
} from "@automovie/production";
import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import path from "node:path";

import { loadSourceModule } from "../internal/loadSourceModule";
import {
  productionDesign,
  productionFixture,
  rewriteSource,
} from "./productionFixtures";

const language = loadSourceModule<{
  parseAutoMovieCaptionLanguage: (value: string) => {
    display: string;
    comparisonKey: string;
  } | null;
  autoMovieCaptionLanguageComparisonKey: (value: string) => string | null;
}>(
  path.resolve(
    __dirname,
    "../../../../packages/production/src/production/captionLanguage.ts",
  ),
);

const boundary = { value: 10, inclusive: true } as const;
const profile = (
  id: string,
  profileLanguage: string,
): IAutoMovieCaptionReadabilityProfile => ({
  id,
  version: 1,
  language: profileLanguage,
  segmentation: {
    algorithm: "test-grapheme",
    version: "1",
    granularity: "grapheme",
    locale: { kind: "requested-resolved", requested: "en", resolved: "en" },
  },
  maxGraphemesPerSecond: boundary,
  maxLinesPerCue: boundary,
  maxGraphemesPerLine: boundary,
  minDurationFrames: boundary,
  minGapFrames: boundary,
});

const captionDiagnostics = (profiles: IAutoMovieCaptionReadabilityProfile[]) =>
  validateAutoMovieProductionGraph({
    production: productionDesign({ captionReadabilityProfiles: profiles }),
    models: new Map(),
    world: null,
    formations: new Map(),
    shots: new Map(),
    acceptance: new Map(),
  }).filter(
    (diagnostic) =>
      diagnostic.message.includes("Caption readability profile") ||
      diagnostic.message.includes("captionReadabilityProfiles"),
  );

/**
 * Caption language consumers share one RFC 5646 syntax and comparison owner.
 *
 * Scenarios:
 *
 * 1. Ordinary, extended, private-use, grandfathered, and four-to-eight-letter
 *    primary tags retain their authored display spelling.
 * 2. Empty and malformed subtags, numeric pseudo-regions, incomplete private
 *    use or extensions, and repeated variants or singletons are refused.
 * 3. ASCII case alone compares as one identity while malformed inputs never do.
 * 4. Design validation refuses malformed and case-duplicate profile languages.
 * 5. Complete requested-resolved and locale-neutral segmentation identities
 *    pass, while every incomplete discriminant and text branch is addressed.
 * 6. Film compilation refuses a malformed cue language through the same parser
 *    and publishes the correction at the cue diagnostic.
 */
export const test_production_caption_language_identity = (): void => {
  const valid = [
    "en",
    "abcd",
    "abcdefgh",
    "zh-cmn-Hans-CN",
    "zh-aaa-bbb-ccc",
    "es-419",
    "de-CH-1901",
    "sl-rozaj-biske-1994",
    "en-u-ca-gregory",
    "en-a-extend1-b-extend2-x-private",
    "x-private",
    "i-klingon",
  ];
  TestValidator.equals(
    "well-formed tags retain display and derive one ASCII-folded key",
    valid.map((value) => language.parseAutoMovieCaptionLanguage(value)),
    valid.map((value) => ({
      display: value,
      comparisonKey: value.toLowerCase(),
    })),
  );

  const invalid = [
    "",
    "e",
    "1234",
    "abcdefghi",
    "en-12",
    "en--US",
    "en_Us",
    "-en",
    "en-",
    "x",
    "en-u",
    "en-a-foo-A-bar",
    "sl-rozaj-ROZAJ",
    "en-x",
    "en-abcdefghi",
  ];
  TestValidator.equals(
    "malformed RFC 5646 shapes are refused without inference",
    invalid.map((value) => language.parseAutoMovieCaptionLanguage(value)),
    invalid.map(() => null),
  );
  TestValidator.equals(
    "comparison is case-insensitive only for well-formed tags",
    {
      key: language.autoMovieCaptionLanguageComparisonKey("EN-us"),
      invalidKey: language.autoMovieCaptionLanguageComparisonKey("en-12"),
      same:
        language.autoMovieCaptionLanguageComparisonKey("EN-us") ===
        language.autoMovieCaptionLanguageComparisonKey("en-US"),
      different:
        language.autoMovieCaptionLanguageComparisonKey("en-US") ===
        language.autoMovieCaptionLanguageComparisonKey("en-GB"),
    },
    {
      key: "en-us",
      invalidKey: null,
      same: true,
      different: false,
    },
  );

  const languageFailures = captionDiagnostics([
    profile("valid", "en-US"),
    profile("case-twin", "EN-us"),
    profile("malformed", "en-12"),
  ]);
  TestValidator.predicate(
    "profile languages refuse malformed syntax and case-only duplicates",
    languageFailures.some(
      (diagnostic) => diagnostic.code === "design-duplicate-id",
    ) &&
      languageFailures.some(
        (diagnostic) => diagnostic.code === "design-reference-invalid",
      ),
  );

  const neutral = profile("neutral", "fr");
  neutral.segmentation.locale = { kind: "locale-neutral" };
  TestValidator.equals(
    "both complete locale forms pass graph validation",
    captionDiagnostics([profile("requested", "en"), neutral]),
    [],
  );

  const malformedSegmentations = [
    null,
    { algorithm: 1, version: "1", granularity: "grapheme", locale: null },
    { algorithm: "test", version: 1, granularity: "word", locale: {} },
    {
      algorithm: "",
      version: "",
      granularity: "grapheme",
      locale: { kind: "requested-resolved", requested: "", resolved: "" },
    },
    {
      algorithm: "test",
      version: "1",
      granularity: "grapheme",
      locale: { kind: "requested-resolved" },
    },
    {
      algorithm: "test",
      version: "1",
      granularity: "grapheme",
      locale: { kind: "unknown" },
    },
  ];
  const malformedProfiles = malformedSegmentations.map(
    (segmentation, index) =>
      ({
        ...profile(`malformed-${index}`, `qaa-x-${index}`),
        segmentation,
      }) as unknown as IAutoMovieCaptionReadabilityProfile,
  );
  TestValidator.predicate(
    "incomplete segmentation identities are addressed without throwing",
    captionDiagnostics(malformedProfiles).length >=
      malformedSegmentations.length,
  );

  const oldShape = {
    ...profile("old-shape", "de"),
    segmentation: { algorithm: "test", version: "1" },
  } as unknown as IAutoMovieCaptionReadabilityProfile;
  TestValidator.predicate(
    "the old two-field segmentation shape is incomplete",
    captionDiagnostics([oldShape]).some(
      (diagnostic) => diagnostic.code === "design-reference-invalid",
    ),
  );

  inspectMalformedFilmCueLanguage();
};

const inspectMalformedFilmCueLanguage = (): void => {
  const fixture = productionFixture();
  try {
    const sourcePath = path.join(fixture.root, "src", "film.ts");
    const source = fs.readFileSync(sourcePath, "utf8");
    fs.writeFileSync(
      sourcePath,
      rewriteSource(
        source,
        "        captions: [],",
        [
          "        captions: [{",
          '          id: "malformed-language",',
          '          text: "Keep this authored caption.",',
          '          language: "en-12",',
          "          start: { frame: 0 },",
          "          end: { frame: 20 },",
          "        }],",
        ].join("\n"),
      ),
      "utf8",
    );
    const output = new AutoMovieProductionCompiler(
      AutoMovieProductionProject.open(fixture.root),
    ).compile({ scope: "source" });
    TestValidator.equals(
      "film cues refuse malformed language tags at the compiler boundary",
      output.diagnostics
        .filter((diagnostic) => diagnostic.code === "film-caption-cue-invalid")
        .map((diagnostic) => diagnostic.message),
      [
        'Caption cue "malformed-language" must be unique, non-overlapping, in range, plain non-blank text, use a well-formed RFC 5646 language tag, and use a non-blank speaker identity.',
      ],
    );
    fs.writeFileSync(
      sourcePath,
      fs
        .readFileSync(sourcePath, "utf8")
        .replace('language: "en-12"', 'language: "en-US"'),
      "utf8",
    );
    const valid = new AutoMovieProductionCompiler(
      AutoMovieProductionProject.open(fixture.root),
    ).compile({ scope: "source" });
    TestValidator.equals(
      "film cues accept a well-formed language tag at the compiler boundary",
      valid.diagnostics.filter(
        (diagnostic) => diagnostic.code === "film-caption-cue-invalid",
      ),
      [],
    );
  } finally {
    fixture.dispose();
  }
};
