import {
  parseHumanFaceDocument,
  serializeHumanFaceDocument,
} from "@automovie/human";
import { TestValidator } from "@nestia/e2e";

import { humanFaceFixture } from "../internal/humanFaceFixture";
import { throwsError } from "../internal/predicates";

/**
 * Saved face JSON retains the complete versioned source and authored settings without caches.
 *
 * Scenarios:
 * 1. Source, detailed arrays, asymmetric controls and nullable provenance round-trip independently.
 * 2. Unknown versions/fields, incomplete part fields, nonfinite values and blank identities refuse.
 * 3. The document-size endpoint is accepted and the adjacent oversized text refuses before parsing.
 */
export const test_subject_human_document = (): void => {
  const document = humanFaceFixture();
  document.controls = { eyeHeight: 0.1 };
  document.detail = { eye: { browProfile: { rootBand: [0.1, 0.3] } } };
  document.asymmetry = { left: { eye: { irisRadius: 5 } } };
  document.reference = {
    url: null,
    sha256: null,
    author: null,
    license: null,
    decision: "Authored in-memory unit basis.",
  };
  const text = serializeHumanFaceDocument(document);
  const parsed = parseHumanFaceDocument(text);
  TestValidator.equals("complete round trip", parsed, document);
  parsed.basis.host.positions[0][0] = 99;
  TestValidator.predicate(
    "loaded face owns its source",
    document.basis.host.positions[0][0] !== 99,
  );
  for (const patch of [
    { version: "human-face/2" },
    { unknown: true },
    { id: " " },
    { name: "" },
    { controls: { unknown: 0 } },
    { basis: { ...document.basis, id: "" } },
    {
      basis: {
        ...document.basis,
        recipe: { ...document.basis.recipe, eye: {} },
      },
    },
  ])
    TestValidator.predicate(
      "schema refusal",
      throwsError(() =>
        parseHumanFaceDocument(JSON.stringify({ ...document, ...patch })),
      ),
    );
  const infinite = humanFaceFixture();
  infinite.basis.host.positions[0][0] = Infinity;
  TestValidator.predicate(
    "serialization cannot turn infinity into null",
    throwsError(() => serializeHumanFaceDocument(infinite)),
  );
  TestValidator.predicate(
    "numeric overflow on load",
    throwsError(() =>
      parseHumanFaceDocument(
        text.replace('"eyeHeight": 0.1', '"eyeHeight": 1e999'),
      ),
    ),
  );
  TestValidator.predicate(
    "invalid JSON",
    throwsError(() => parseHumanFaceDocument("{")),
  );
  const aliased = humanFaceFixture();
  aliased.expression = aliased.basis.expression;
  TestValidator.equals(
    "shared acyclic input is valid JSON",
    parseHumanFaceDocument(serializeHumanFaceDocument(aliased)).expression,
    aliased.expression,
  );
  const cyclic = humanFaceFixture();
  cyclic.reference = cyclic as never;
  TestValidator.predicate(
    "cycle refusal without recursive overflow",
    throwsError(() => serializeHumanFaceDocument(cyclic)),
  );
  parseHumanFaceDocument(" ".repeat(16 * 1024 * 1024 - text.length) + text);
  TestValidator.predicate(
    "size guard",
    throwsError(() => parseHumanFaceDocument(" ".repeat(16 * 1024 * 1024 + 1))),
  );
};
