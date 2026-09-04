import assert from "node:assert/strict";

import {
  compareAutoMovieAuthoredText,
  measureAutoMovieAuthoredText,
} from "../src/measureAutoMovieAuthoredText";

const original = [
  "# Work",
  "",
  "<!-- author note -->",
  "",
  "## Opening {#opening}",
  "",
  "<!-- @evidence contracts/local.md#rule Original metadata. -->",
  "",
  "One visible beat.",
].join("\n");
const baseline = measureAutoMovieAuthoredText({
  path: "docs/treatments/001-opening.md",
  revision: "commit-a",
  source: original,
});

/**
 * Authored-text measurement binds observations to an immutable revision.
 *
 * Scenarios:
 *
 * 1. Evidence-only metadata changes preserve body identity and all deltas.
 * 2. Prose, visible H2, and general HTML comment edits change the authored
 *    denominator and report signed byte, word, and section deltas.
 * 3. Stale baseline records, repeated revisions, mixed line endings, blank
 *    revisions, and escaping paths fail before a report is returned.
 */
const metadataOnly = compareAutoMovieAuthoredText({
  baseline,
  baselineSource: original,
  currentRevision: "commit-b",
  currentSource: original.replace("Original metadata.", "Revised metadata."),
});
assert.equal(metadataOnly.current.bodySha256, baseline.bodySha256);
assert.deepEqual(
  {
    bytes: metadataOnly.bytes,
    words: metadataOnly.words,
    sections: metadataOnly.sections,
  },
  { bytes: 0, words: 0, sections: 0 },
);

const expanded = compareAutoMovieAuthoredText({
  baseline,
  baselineSource: original,
  currentRevision: "commit-c",
  currentSource: `${original}\n\n## Closing {#closing}\n\nTwo final words.`,
});
assert.equal(expanded.sections, 1);
assert.equal(expanded.words, 5);
assert(expanded.bytes > 0);

const noteChanged = measureAutoMovieAuthoredText({
  path: baseline.path,
  revision: "commit-d",
  source: original.replace("author note", "changed author note"),
});
assert.notEqual(noteChanged.bodySha256, baseline.bodySha256);

assert.throws(
  () =>
    compareAutoMovieAuthoredText({
      baseline: { ...baseline, words: baseline.words + 1 },
      baselineSource: original,
      currentRevision: "commit-e",
      currentSource: original,
    }),
  /baseline is stale/u,
);
assert.throws(
  () =>
    compareAutoMovieAuthoredText({
      baseline,
      baselineSource: original,
      currentRevision: baseline.revision,
      currentSource: original,
    }),
  /revisions must be distinct/u,
);
assert.throws(
  () =>
    measureAutoMovieAuthoredText({
      path: baseline.path,
      revision: "mixed",
      source: "# Work\r\n\n## Unit {#unit}\r\n",
    }),
  /mixes line-ending conventions/u,
);
assert.throws(
  () =>
    measureAutoMovieAuthoredText({
      path: baseline.path,
      revision: " ",
      source: original,
    }),
  /requires a revision identity/u,
);
assert.throws(
  () =>
    measureAutoMovieAuthoredText({
      path: "../work.md",
      revision: "x",
      source: original,
    }),
  /normalized relative Markdown path/u,
);
assert.throws(
  () =>
    measureAutoMovieAuthoredText({
      path: "docs\\work.md",
      revision: "x",
      source: original,
    }),
  /normalized relative Markdown path/u,
);
const crlf = measureAutoMovieAuthoredText({
  path: baseline.path,
  revision: "crlf",
  source: original.replace(/\n/gu, "\r\n"),
});
assert.equal(crlf.bodySha256, baseline.bodySha256);
assert.notEqual(crlf.sourceSha256, baseline.sourceSha256);

process.stdout.write("authored text measurement passed\n");
