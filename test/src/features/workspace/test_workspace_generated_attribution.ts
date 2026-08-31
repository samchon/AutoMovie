import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

import {
  attributableScaffoldSources,
  attributeGeneratedRecords,
  attributeRecordUrls,
  digestText,
  generatedScaffoldKey,
  pathToRecordUrl,
  recordUrlToPath,
} from "../../coverage/generatedAttribution";
import { measuredScaffoldAttribution } from "../../coverage/measureCoverage";

/**
 * A generated project's execution is credited only to bytes it actually ran.
 *
 * Twelve scaffold scripts read zero percent while the suite runs all of them,
 * because a rendered copy is what executes and V8 records the copy's path. The
 * credit that fixes it is worth nothing unless it can be watched refusing, so
 * the digest gate is read against a source that differs by one character.
 *
 * Scenarios:
 *
 * 1. A key is taken from the tail of a URL, and only from a script path. A URL
 *    naming something else, or a directory called `scripts` with no file,
 *    yields nothing to credit.
 * 2. A rendered file matching its repository source byte for byte is
 *    creditable; one that differs by a single character is not, and neither is
 *    one whose repository file cannot be read at all.
 * 3. A record's generated URLs are rewritten in place, its source-map entry
 *    travels with the URL it belongs to, a URL already naming the repository is
 *    left alone, and a key with no creditable source is refused by name.
 * 4. The directory pass writes only the records it changed, ignores what does
 *    not parse, and answers a directory that does not exist with nothing.
 */
export const test_workspace_generated_attribution = (): void => {
  const generated = (name: string): string =>
    pathToFileURL(
      path.join(os.tmpdir(), "automovie-film", "generated", "scripts", name),
    ).href;

  TestValidator.equals(
    "a key is read from the tail of a script URL and nowhere else",
    {
      script: generatedScaffoldKey(generated("capture-browser.ts")),
      mts: generatedScaffoldKey(generated("repaint.mts")),
      tsx: generatedScaffoldKey(generated("view.tsx")),
      directory: generatedScaffoldKey("file:///tmp/project/scripts"),
      nested: generatedScaffoldKey("file:///tmp/scripts/inner/deep.ts"),
      other: generatedScaffoldKey("file:///tmp/project/docs/plan.md"),
    },
    {
      script: "scripts/capture-browser.ts",
      mts: "scripts/repaint.mts",
      tsx: "scripts/view.tsx",
      directory: undefined,
      nested: undefined,
      other: undefined,
    },
  );

  const root = fs.mkdtempSync(path.join(os.tmpdir(), "automovie-attribute-"));
  try {
    const scaffold = path.join(root, "scaffold");
    fs.mkdirSync(path.join(scaffold, "scripts"), { recursive: true });
    const identical = "export const value = 1;\n";
    fs.writeFileSync(path.join(scaffold, "scripts", "same.ts"), identical);
    fs.writeFileSync(path.join(scaffold, "scripts", "drift.ts"), identical);

    const sources = attributableScaffoldSources({
      rendered: {
        "scripts/same.ts": identical,
        // One character apart. This is the case the credit must lose: the day a
        // script starts substituting a template token, its bytes stop being the
        // repository's and the credit stops being true.
        "scripts/drift.ts": "export const value = 2;\n",
        // Named by the render and absent from the tree.
        "scripts/absent.ts": identical,
        // Not a script, so never a candidate however it reads.
        "package.json": identical,
      },
      scaffoldRoot: scaffold,
    });
    TestValidator.equals(
      "only a rendered file matching its repository source is creditable",
      {
        admitted: [...sources.keys()],
        target: sources.get("scripts/same.ts"),
        // The same comparison reached through the digest itself, so a reader
        // sees the normalization rather than infers it.
        endings: digestText("a\r\nb\n") === digestText("a\nb\n"),
        differing: digestText("a\n") === digestText("b\n"),
      },
      {
        admitted: ["scripts/same.ts"],
        target: path.join(scaffold, "scripts", "same.ts"),
        endings: true,
        differing: false,
      },
    );

    const repository = path.join(scaffold, "scripts", "same.ts");
    const repositoryUrl = pathToRecordUrl(repository);
    TestValidator.equals(
      "a record URL is built and read back with the platform's own encoding",
      recordUrlToPath(repositoryUrl),
      repository,
    );

    const record: {
      result: Array<{ url?: string }>;
      "source-map-cache"?: Record<string, unknown>;
    } = {
      result: [
        { url: generated("same.ts") },
        { url: generated("drift.ts") },
        { url: repositoryUrl },
        { url: "file:///tmp/project/index.js" },
        {},
      ],
      // The shape V8 writes: the entry carries its own url and its own
      // `data.sources`, and c8 resolves a range through those rather than
      // through the record's url. Rewriting only the record's url credited
      // twelve entries and left the report at zero.
      "source-map-cache": {
        [generated("same.ts")]: {
          data: { sources: [generated("same.ts"), "file:///elsewhere.ts"] },
          lineLengths: [24],
          url: generated("same.ts"),
        },
      },
    };
    const outcome = attributeRecordUrls({
      isRepository: (url) => url === repositoryUrl,
      record,
      sources,
    });
    TestValidator.equals(
      "generated URLs are re-addressed and their map entries travel with them",
      {
        outcome,
        urls: record.result.map((entry) => entry.url),
        cache: Object.keys(record["source-map-cache"] ?? {}),
      },
      {
        outcome: { attributed: 1, refused: [generated("drift.ts")] },
        urls: [
          repositoryUrl,
          // Refused, so it keeps the address of the bytes that actually ran.
          generated("drift.ts"),
          repositoryUrl,
          "file:///tmp/project/index.js",
          undefined,
        ],
        cache: [repositoryUrl],
      },
    );

    // What the map now says, which is what decides where the report lands. Its
    // own url follows the record's, its creditable source is re-addressed, and
    // a source naming nothing creditable is left exactly as it was.
    const moved = record["source-map-cache"]?.[repositoryUrl] as {
      data: { sources: string[] };
      url: string;
    };
    TestValidator.equals(
      "the map's own url and creditable sources are re-addressed with it",
      { sources: moved.data.sources, url: moved.url },
      {
        sources: [repositoryUrl, "file:///elsewhere.ts"],
        url: repositoryUrl,
      },
    );

    // And the shapes a map can arrive in that carry nothing to move: no entry
    // at all, a null entry, an entry with no `data`, and one whose `sources` is
    // not a list. Each is an ordinary reading rather than an error.
    const ragged: {
      result: Array<{ url?: string }>;
      "source-map-cache"?: Record<string, unknown>;
    } = {
      result: [
        { url: generated("same.ts") },
        { url: generated("same.ts") },
        { url: generated("same.ts") },
      ],
      "source-map-cache": {
        [generated("same.ts")]: null,
      },
    };
    const first = attributeRecordUrls({
      isRepository: () => false,
      record: ragged,
      sources,
    });
    ragged["source-map-cache"] = {
      [generated("same.ts")]: { data: { sources: "not-a-list" } },
    };
    ragged.result = [{ url: generated("same.ts") }];
    const second = attributeRecordUrls({
      isRepository: () => false,
      record: ragged,
      sources,
    });
    ragged["source-map-cache"] = { [generated("same.ts")]: { url: 7 } };
    ragged.result = [{ url: generated("same.ts") }];
    const third = attributeRecordUrls({
      isRepository: () => false,
      record: ragged,
      sources,
    });
    TestValidator.equals(
      "a map with nothing to move is folded rather than refused",
      {
        first: first.attributed,
        second: second.attributed,
        third: third.attributed,
        // A record with no cache at all takes the same path.
        none: attributeRecordUrls({
          isRepository: () => false,
          record: { result: [{ url: generated("same.ts") }] },
          sources,
        }).attributed,
      },
      { first: 3, second: 1, third: 1, none: 1 },
    );

    const directory = path.join(root, "records");
    fs.mkdirSync(directory);
    fs.writeFileSync(
      path.join(directory, "one.json"),
      JSON.stringify({ result: [{ url: generated("same.ts") }] }),
    );
    fs.writeFileSync(
      path.join(directory, "two.json"),
      JSON.stringify({ result: [{ url: "file:///tmp/other.js" }] }),
    );
    fs.writeFileSync(path.join(directory, "broken.json"), "{not json");
    fs.writeFileSync(path.join(directory, "notes.txt"), "ignored");
    const written: string[] = [];
    const pass = attributeGeneratedRecords({
      directory,
      isRepository: (url) => url === repositoryUrl,
      sources,
      write: (file, text) => {
        written.push(path.basename(file));
        fs.writeFileSync(file, text, "utf8");
      },
    });
    TestValidator.equals(
      "the pass rewrites only what it changed and survives what it cannot read",
      {
        pass,
        written,
        // A record left alone keeps its bytes, which is what stops a freshness
        // check from reading an untouched run as a modified one.
        untouched: JSON.parse(
          fs.readFileSync(path.join(directory, "two.json"), "utf8"),
        ),
        absent: attributeGeneratedRecords({
          directory: path.join(root, "nowhere"),
          isRepository: () => false,
          sources,
        }),
      },
      {
        pass: { attributed: 1, records: 1, refused: [] },
        written: ["one.json"],
        untouched: { result: [{ url: "file:///tmp/other.js" }] },
        absent: { attributed: 0, records: 0, refused: [] },
      },
    );

    // The same directory again with nothing injected, so the reading, listing
    // and writing this actually ships with are the ones that run. `one.json`
    // already names the repository, so the second pass credits nothing and
    // leaves it alone, which is the idempotence the measurement depends on.
    const again = attributeGeneratedRecords({
      directory,
      isRepository: (url) => url === repositoryUrl,
      sources,
    });
    TestValidator.equals(
      "the shipped reader, lister and writer run and a credited record is final",
      {
        again,
        stored: JSON.parse(
          fs.readFileSync(path.join(directory, "one.json"), "utf8"),
        ),
      },
      {
        again: { attributed: 0, records: 0, refused: [] },
        stored: { result: [{ url: repositoryUrl }] },
      },
    );

    // And the wiring itself, against the real scaffold rather than a fixture:
    // `capture-browser.ts` is one of the twelve that read zero percent, and
    // this is the pass that gives it back its address. A name the scaffold does
    // not ship is refused in the same call, so the credit is watched declining.
    const scaffolded = path.join(root, "scaffolded");
    fs.mkdirSync(scaffolded);
    const child = (name: string): string =>
      pathToFileURL(
        path.join(os.tmpdir(), "automovie-film", "generated", "scripts", name),
      ).href;
    fs.writeFileSync(
      path.join(scaffolded, "coverage-0.json"),
      JSON.stringify({
        result: [
          { url: child("capture-browser.ts") },
          { url: child("no-such-scaffold-script.ts") },
        ],
      }),
    );
    const wiring = measuredScaffoldAttribution(scaffolded);
    const credited = JSON.parse(
      fs.readFileSync(path.join(scaffolded, "coverage-0.json"), "utf8"),
    ) as { result: Array<{ url: string }> };
    TestValidator.equals(
      "a real scaffold script is credited to its repository source",
      {
        attributed: wiring.attributed,
        records: wiring.records,
        refused: wiring.refused,
        first: recordUrlToPath(credited.result[0]!.url)
          .replaceAll("\\", "/")
          .endsWith("packages/template/scaffold/scripts/capture-browser.ts"),
        second: credited.result[1]!.url,
      },
      {
        attributed: 1,
        records: 1,
        refused: [child("no-such-scaffold-script.ts")],
        first: true,
        second: child("no-such-scaffold-script.ts"),
      },
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
};
