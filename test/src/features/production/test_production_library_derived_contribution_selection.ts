import type {
  AutoMovieContentDigest,
  IAutoMovieDerivedArtifactSource,
} from "@automovie/interface";
import { admitAutoMovieLibraryDerivedContribution } from "@automovie/production";
import { TestValidator } from "@nestia/e2e";
import { createHash } from "node:crypto";

const SOURCE = "src/library/plaza.ts";
const EXPORT = "plaza";
const ARTIFACT = "automovie/derived/plaza.json";
const NOTES = "automovie/derived/notes.txt";

/** SHA-256 of exact bytes in the contract's `sha256:<hex>` spelling. */
const digest = (bytes: Uint8Array): AutoMovieContentDigest =>
  `sha256:${createHash("sha256").update(bytes).digest("hex")}`;

/** Project resident bytes the way a verified build context carries them. */
const current = (bytes: Uint8Array): IAutoMovieDerivedArtifactSource => ({
  digest: digest(bytes),
  encoding: "utf8",
  content: new TextDecoder("utf-8", { fatal: true }).decode(bytes),
});

const utf8 = (text: string): Uint8Array => Buffer.from(text, "utf8");

const CONTRIBUTION = utf8('{"environments":[],"models":[]}');

/** The admitted data tree, or the refusal's location and named selection. */
const outcome = (props: {
  derivedArtifact: string | null;
  build: boolean;
  derivedArtifacts: Readonly<Record<string, IAutoMovieDerivedArtifactSource>>;
}): unknown => {
  const result = admitAutoMovieLibraryDerivedContribution({
    source: SOURCE,
    exportName: EXPORT,
    ...props,
  });
  if (result.success) return { admitted: result.value };
  return {
    code: result.diagnostic.code,
    category: result.diagnostic.category,
    phase: result.diagnostic.phase,
    target: result.diagnostic.target,
    path: result.diagnostic.path,
    namesSelection:
      result.diagnostic.message.includes(`export "${EXPORT}"`) &&
      result.diagnostic.message.includes(
        `Received ${JSON.stringify(props.derivedArtifact)}`,
      ),
  };
};

const selectionRefused = {
  code: "source-export-invalid",
  category: "error",
  phase: "source",
  target: `library-source:${SOURCE}:${EXPORT}`,
  path: SOURCE,
  namesSelection: true,
};

/**
 * A derived library owner selects one current UTF-8 artifact, and JSON is
 * confirmed only for that selection.
 *
 * The declarative owner contract refuses a registration that also declares
 * `build`, a selection that is not an own current artifact entry, and an
 * artifact whose encoding is not UTF-8. The build context carries decoded
 * text beside the verified SHA-256 of the resident bytes, so text that
 * reproduces that digest neither as decoded nor behind the one byte order mark
 * decoding removes is not the current artifact. Every other UTF-8 artifact in
 * the same context stays arbitrary text: admission neither parses nor rewrites
 * it.
 *
 * Scenarios:
 *
 * 1. The current contribution with no `build` is admitted, and the same
 *    selection with `build` declared is refused at the source path naming the
 *    selected path.
 * 2. A non-string selection (null), an absent path, and an inherited object key
 *    (`toString`) are each refused as a selection failure.
 * 3. The same contribution bytes declared as base64 are refused, because the
 *    owner contract admits only UTF-8 text.
 * 4. Bytes carrying the invalid UTF-8 byte 0x80, projected by a replacing
 *    decoder beside the digest of the original bytes, are refused before any
 *    JSON stage, while the twin record holding the valid character `é` is
 *    admitted.
 * 5. Text of a different contribution beside the digest of scenario 1's bytes
 *    is refused as stale, while scenario 1 itself stays admitted.
 * 6. A non-JSON UTF-8 notes artifact beside the contribution leaves admission
 *    unchanged and the whole context untouched, and only an owner that selects
 *    that notes artifact as its contribution meets the syntax refusal at byte
 *    0.
 */
export const test_production_library_derived_contribution_selection =
  (): void => {
    const contexts = { [ARTIFACT]: current(CONTRIBUTION) };
    TestValidator.equals(
      "only one own current UTF-8 selection without build is admitted",
      [
        outcome({
          derivedArtifact: ARTIFACT,
          build: false,
          derivedArtifacts: contexts,
        }),
        outcome({
          derivedArtifact: ARTIFACT,
          build: true,
          derivedArtifacts: contexts,
        }),
        outcome({
          derivedArtifact: null,
          build: false,
          derivedArtifacts: contexts,
        }),
        outcome({
          derivedArtifact: "automovie/derived/absent.json",
          build: false,
          derivedArtifacts: contexts,
        }),
        outcome({
          derivedArtifact: "toString",
          build: false,
          derivedArtifacts: contexts,
        }),
        outcome({
          derivedArtifact: ARTIFACT,
          build: false,
          derivedArtifacts: {
            [ARTIFACT]: {
              digest: digest(CONTRIBUTION),
              encoding: "base64",
              content: Buffer.from(CONTRIBUTION).toString("base64"),
            },
          },
        }),
      ],
      [
        { admitted: { environments: [], models: [] } },
        selectionRefused,
        selectionRefused,
        selectionRefused,
        selectionRefused,
        selectionRefused,
      ],
    );

    const malformed = Buffer.concat([
      utf8('{"environments":[],"models":[],"note":"'),
      Uint8Array.of(0x80),
      utf8('"}'),
    ]);
    const wellFormed = utf8('{"environments":[],"models":[],"note":"é"}');
    TestValidator.equals(
      "text that does not reproduce the verified bytes is not current",
      [
        outcome({
          derivedArtifact: ARTIFACT,
          build: false,
          derivedArtifacts: {
            [ARTIFACT]: {
              digest: digest(malformed),
              encoding: "utf8",
              content: new TextDecoder("utf-8").decode(malformed),
            },
          },
        }),
        outcome({
          derivedArtifact: ARTIFACT,
          build: false,
          derivedArtifacts: { [ARTIFACT]: current(wellFormed) },
        }),
        outcome({
          derivedArtifact: ARTIFACT,
          build: false,
          derivedArtifacts: {
            [ARTIFACT]: {
              digest: digest(CONTRIBUTION),
              encoding: "utf8",
              content: '{"environments":[],"models":[],"contexts":[]}',
            },
          },
        }),
      ],
      [
        selectionRefused,
        { admitted: { environments: [], models: [], note: "é" } },
        selectionRefused,
      ],
    );

    const notes = current(
      utf8('# Plaza notes\n{"models":1,"models":2} is prose here.\n'),
    );
    const shared = { [ARTIFACT]: current(CONTRIBUTION), [NOTES]: notes };
    const before = structuredClone(shared);
    const admitted = outcome({
      derivedArtifact: ARTIFACT,
      build: false,
      derivedArtifacts: shared,
    });
    const notesSelected = admitAutoMovieLibraryDerivedContribution({
      source: SOURCE,
      exportName: EXPORT,
      derivedArtifact: NOTES,
      build: false,
      derivedArtifacts: shared,
    });
    TestValidator.equals(
      "plain UTF-8 artifacts stay text unless an owner selects them",
      {
        admitted,
        untouched: shared,
        notesSelected: notesSelected.success
          ? "admitted"
          : [
              notesSelected.diagnostic.path,
              notesSelected.diagnostic.message.includes(
                `record "${NOTES}" failed syntax admission at byte 0 (/): expected a JSON value`,
              ),
            ],
      },
      {
        admitted: { admitted: { environments: [], models: [] } },
        untouched: before,
        notesSelected: [NOTES, true],
      },
    );
  };
