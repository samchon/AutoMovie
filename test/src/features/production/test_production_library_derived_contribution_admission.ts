import type { IAutoMovieDerivedArtifactSource } from "@automovie/interface";
import { admitAutoMovieLibraryDerivedContribution } from "@automovie/production";
import { TestValidator } from "@nestia/e2e";
import { createHash } from "node:crypto";

const SOURCE = "src/library/plaza.ts";
const EXPORT = "plaza";
const ARTIFACT = "automovie/derived/plaza.json";

/** Project resident bytes the way a verified build context carries them. */
const current = (bytes: Uint8Array): IAutoMovieDerivedArtifactSource => ({
  digest: `sha256:${createHash("sha256").update(bytes).digest("hex")}`,
  encoding: "utf8",
  content: new TextDecoder("utf-8", { fatal: true }).decode(bytes),
});

const admit = (bytes: Uint8Array) =>
  admitAutoMovieLibraryDerivedContribution({
    source: SOURCE,
    exportName: EXPORT,
    derivedArtifact: ARTIFACT,
    build: false,
    derivedArtifacts: { [ARTIFACT]: current(bytes) },
  });

const utf8 = (text: string): Uint8Array => Buffer.from(text, "utf8");

/** The admitted data tree, or the refusal reduced to its attribution facts. */
const outcome = (
  bytes: Uint8Array,
  refusal?: { stage: string; offset: number; pointer: string; detail: string },
): unknown => {
  const result = admit(bytes);
  if (result.success) return { admitted: result.value };
  const diagnostic = result.diagnostic;
  const facts =
    refusal === undefined
      ? []
      : [
          `export "${EXPORT}" in ${SOURCE}`,
          `record "${ARTIFACT}" failed ${refusal.stage} admission at byte ${refusal.offset} (${refusal.pointer}): ${refusal.detail}`,
          "No generated artifact was published",
        ];
  return {
    code: diagnostic.code,
    category: diagnostic.category,
    phase: diagnostic.phase,
    target: diagnostic.target,
    path: diagnostic.path,
    missing: facts.filter(
      (fact) => diagnostic.message.includes(fact) === false,
    ),
  };
};

const refused = {
  code: "source-export-invalid",
  category: "error",
  phase: "source",
  target: `library-source:${SOURCE}:${EXPORT}`,
  path: ARTIFACT,
  missing: [],
};

/**
 * A precomputed library contribution enters only through the shared
 * duplicate-aware JSON ingress, attributed to the exact artifact and export.
 *
 * RFC 8259 leaves repeated object member names to the parser, and the host
 * parser keeps the last one. The contract of a declarative library owner is
 * that the artifact's exact bytes are one unambiguous JSON value before the
 * contribution schema sees them, and that a refusal names the source export,
 * the artifact record, the failed stage, the UTF-8 byte offset and the JSON
 * Pointer. Every offset below is counted by hand from the JSON text.
 *
 * Scenarios:
 *
 * 1. `{"environments":[],"models":[]}` and the same record with an optional
 *    empty `contexts` are admitted as exactly those data trees.
 * 2. `{"environments":[],"models":[],"models":[]}` is refused at the duplicate
 *    stage at byte 31 under the root pointer, naming `"models"`, although the
 *    last-wins host value equals scenario 1.
 * 3. The spelling that writes the first letter of `models` as a JSON Unicode
 *    escape decodes to the same member name and is refused at the same byte.
 * 4. A repeated `id` inside the first model is refused at byte 39 under
 *    `/models/0`, while its negative twin, the same `id` once in an
 *    environment and once in a model, is admitted because each object is its
 *    own scope.
 * 5. A trailing comma is refused at the syntax stage at byte 31, the position
 *    where a member name was required.
 * 6. Scenario 1's text behind a UTF-8 byte order mark is refused at the syntax
 *    stage at byte 0: the resident bytes, not the decoded text, reach the
 *    ingress, and the shared ingress does not skip a leading mark.
 */
export const test_production_library_derived_contribution_admission =
  (): void => {
    TestValidator.equals(
      "unambiguous contributions are admitted as their exact data tree",
      [
        outcome(utf8('{"environments":[],"models":[]}')),
        outcome(utf8('{"environments":[],"models":[],"contexts":[]}')),
        outcome(utf8('{"environments":[{"id":"a"}],"models":[{"id":"a"}]}')),
      ],
      [
        { admitted: { environments: [], models: [] } },
        { admitted: { environments: [], models: [], contexts: [] } },
        { admitted: { environments: [{ id: "a" }], models: [{ id: "a" }] } },
      ],
    );
    TestValidator.equals(
      "ambiguous or malformed records are refused at their exact position",
      [
        outcome(utf8('{"environments":[],"models":[],"models":[]}'), {
          stage: "duplicate",
          offset: 31,
          pointer: "/",
          detail: 'duplicate member "models"',
        }),
        outcome(utf8('{"environments":[],"models":[],"\\u006dodels":[]}'), {
          stage: "duplicate",
          offset: 31,
          pointer: "/",
          detail: 'duplicate member "models"',
        }),
        outcome(utf8('{"environments":[],"models":[{"id":"a","id":"b"}]}'), {
          stage: "duplicate",
          offset: 39,
          pointer: "/models/0",
          detail: 'duplicate member "id"',
        }),
        outcome(utf8('{"environments":[],"models":[],}'), {
          stage: "syntax",
          offset: 31,
          pointer: "/",
          detail: "expected an object member name",
        }),
        outcome(
          Buffer.concat([
            Uint8Array.of(0xef, 0xbb, 0xbf),
            utf8('{"environments":[],"models":[]}'),
          ]),
          {
            stage: "syntax",
            offset: 0,
            pointer: "/",
            detail: "expected a JSON value",
          },
        ),
      ],
      [refused, refused, refused, refused, refused],
    );
  };
