import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

import {
  attributableScaffoldSources,
  attributeGeneratedRecords,
  attributeLinkedLibraries,
  attributeLoaderQueries,
  attributeRecordUrls,
  digestText,
  generatedScaffoldKey,
  linkedWorkspaceLibraryPath,
  pathToRecordUrl,
  recordUrlToPath,
  strippedLoaderQuery,
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
      // Given the creditable set, the longest tail that names one wins. A tail
      // alone cannot say where the generated root ends, and the scaffold ships
      // 88 TypeScript assets of which 28 sit outside `scripts/`.
      outside: generatedScaffoldKey(
        "file:///tmp/film/src/examples/buildings.ts",
        new Set(["src/examples/buildings.ts", "examples/buildings.ts"]),
      ),
      root: generatedScaffoldKey(
        "file:///tmp/film/vite.config.ts",
        new Set(["vite.config.ts"]),
      ),
      unknown: generatedScaffoldKey(
        "file:///tmp/film/src/other.ts",
        new Set(["src/examples/buildings.ts"]),
      ),
    },
    {
      script: "scripts/capture-browser.ts",
      mts: "scripts/repaint.mts",
      tsx: "scripts/view.tsx",
      directory: undefined,
      nested: undefined,
      other: undefined,
      outside: "src/examples/buildings.ts",
      root: "vite.config.ts",
      unknown: undefined,
    },
  );

  const root = fs.mkdtempSync(path.join(os.tmpdir(), "automovie-attribute-"));
  try {
    const scaffold = path.join(root, "scaffold");
    fs.mkdirSync(path.join(scaffold, "scripts"), { recursive: true });
    const identical = "export const value = 1;\n";
    fs.writeFileSync(path.join(scaffold, "scripts", "same.ts"), identical);
    fs.writeFileSync(path.join(scaffold, "scripts", "drift.ts"), identical);
    fs.writeFileSync(path.join(scaffold, "vite.config.ts"), identical);

    const sources = attributableScaffoldSources({
      rendered: {
        "scripts/same.ts": identical,
        // One character apart. This is the case the credit must lose: the day a
        // script starts substituting a template token, its bytes stop being the
        // repository's and the credit stops being true.
        "scripts/drift.ts": "export const value = 2;\n",
        // Named by the render and absent from the tree.
        "scripts/absent.ts": identical,
        // Not TypeScript, so never a candidate however it reads.
        "package.json": identical,
        // Outside `scripts/`, which the narrower first rule never admitted.
        "vite.config.ts": identical,
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
        admitted: ["scripts/same.ts", "vite.config.ts"],
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
          // A creditable source, one naming nothing creditable, and one that
          // is not a string at all: V8 writes `null` into `sources` for a
          // section it could not resolve, and a walk that assumed strings
          // would have thrown on it.
          data: {
            sources: [generated("same.ts"), "file:///elsewhere.ts", null],
          },
          lineLengths: [24],
          url: generated("same.ts"),
        },
      },
    };
    const outcome = attributeRecordUrls({
      // Every asset the scaffold ships, creditable or not: `drift.ts` is one
      // whose bytes moved, and it has to be recognised so it can be refused by
      // name rather than skipped as if it were somebody else's file.
      candidates: new Set([
        ...sources.keys(),
        "scripts/drift.ts",
        "scripts/absent.ts",
      ]),
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
      data: { sources: Array<string | null> };
      url: string;
    };
    TestValidator.equals(
      "the map's own url and creditable sources are re-addressed with it",
      { sources: moved.data.sources, url: moved.url },
      {
        sources: [repositoryUrl, "file:///elsewhere.ts", null],
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
        pass: { attributed: 1, linked: 0, queried: 0, records: 1, refused: [] },
        written: ["one.json"],
        untouched: { result: [{ url: "file:///tmp/other.js" }] },
        absent: {
          attributed: 0,
          linked: 0,
          queried: 0,
          records: 0,
          refused: [],
        },
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
        again: {
          attributed: 0,
          linked: 0,
          queried: 0,
          records: 0,
          refused: [],
        },
        stored: { result: [{ url: repositoryUrl }] },
      },
    );

    // And the wiring itself, against the real scaffold rather than a fixture:
    // `capture-browser.ts` is one of the twelve that read zero percent, and
    // this is the pass that gives it back its address.
    //
    // A name the scaffold does not ship travels in the same record and is left
    // exactly as it is. It is not refused, because refusing is a claim about an
    // asset this repository ships whose bytes moved, and this is somebody
    // else's file. The decline is watched on `drift.ts` above, where the asset
    // is ours and the bytes are not.
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
        refused: [],
        first: true,
        second: child("no-such-scaffold-script.ts"),
      },
    );
    // A generated project receives the repository's built packages by copy and
    // the child requires that copy, so V8 records it at the fixture's path.
    // The fixture is deleted on the way out, and c8 must read a script to place
    // its ranges: a script it cannot read loses its whole reading, source map
    // included. Re-addressing it to the repository's own copy of the same build
    // is what makes it readable again.
    //
    // Measured on a real record directory: 144 such URLs across 16 records, and
    // six `packages/evidence/src` files gained coverage once the report could
    // follow their maps -- `createAutoMovieEvidenceConfig.ts` from 1,826
    // covered statements to 3,038.
    // Built from a real absolute path: a hand-written `file:///tmp/...` has no
    // drive letter and cannot be read back on Windows.
    const fixture = (name: string): string =>
      path.join(
        root,
        ".cache/gate-1/node_modules/@automovie/evidence/lib/deep",
        name,
      );
    const fixtureLib = pathToRecordUrl(fixture("one.js"));
    TestValidator.equals(
      "a linked workspace build maps to the repository's copy and nothing else does",
      {
        linked: linkedWorkspaceLibraryPath({ root, url: fixtureLib }),
        // Not a linked build: no `@automovie` scope, or no `lib` segment.
        other: linkedWorkspaceLibraryPath({
          root,
          url: pathToRecordUrl(
            path.join(root, "node_modules/left-pad/lib/x.js"),
          ),
        }),
        source: linkedWorkspaceLibraryPath({
          root,
          url: pathToRecordUrl(
            path.join(root, "node_modules/@automovie/evidence/src/one.ts"),
          ),
        }),
      },
      {
        linked: path.join(root, "packages", "evidence", "lib", "deep/one.js"),
        other: undefined,
        source: undefined,
      },
    );

    const linkedRecord = {
      result: [
        { url: fixtureLib },
        // Still on disk where it stands, so it is readable there and moving it
        // would claim the two are one copy on nothing but the path's shape.
        { url: pathToRecordUrl(fixture("present.js")) },
        // Vanished, and the repository has no counterpart to move it to.
        { url: fixtureLib.replace("/evidence/", "/no-such-package/") },
        { url: pathToRecordUrl(path.join(root, "unrelated.js")) },
      ],
    };
    const slashed = (one: string): string => one.replaceAll("\\", "/");
    const present = new Set(
      [
        fixture("present.js"),
        path.join(root, "packages", "evidence", "lib", "deep/one.js"),
      ].map(slashed),
    );
    TestValidator.equals(
      "only a vanished linked build with a repository counterpart is moved",
      {
        moved: attributeLinkedLibraries({
          exists: (file) =>
            present.has(file) ||
            present.has(pathToFileURL(file).href) ||
            [...present].some((one) =>
              one.endsWith(file.replaceAll("\\", "/")),
            ),
          record: linkedRecord,
          root,
        }),
        first: recordUrlToPath(linkedRecord.result[0]!.url!).replaceAll(
          "\\",
          "/",
        ),
        second: linkedRecord.result[1]!.url,
        third: linkedRecord.result[2]!.url,
        fourth: linkedRecord.result[3]!.url,
      },
      {
        moved: 1,
        first: slashed(
          path.join(root, "packages", "evidence", "lib", "deep/one.js"),
        ),
        second: pathToRecordUrl(fixture("present.js")),
        third: fixtureLib.replace("/evidence/", "/no-such-package/"),
        fourth: pathToRecordUrl(path.join(root, "unrelated.js")),
      },
    );
    // `tsImport` appends `?namespace=<id>` so two loads of one file stay
    // distinct, and V8 records that URL verbatim. Turned back into a path it
    // names a file no filesystem has, so c8 drops the whole reading. The run
    // had been printing these among its `gone from disk at report time` count
    // for its whole life: `build/experimental.ts%3Fnamespace=...`.
    const plain = path.join(root, "plain.ts");
    fs.writeFileSync(plain, "export const value = 1;\n");
    const queried = {
      result: [
        { url: `${pathToRecordUrl(plain)}?namespace=17881` },
        { url: `${pathToRecordUrl(plain)}#fragment` },
        // A suffix whose plain form is a file nobody has: it keeps its own
        // address and stays visible as missing rather than being invented.
        { url: `${pathToRecordUrl(path.join(root, "absent.ts"))}?namespace=1` },
        { url: pathToRecordUrl(plain) },
        { url: "node:fs" },
      ],
    };
    TestValidator.equals(
      "a loader's query is dropped only when the plain file is really there",
      {
        stripped: strippedLoaderQuery("file:///a/b.ts?x=1"),
        fragment: strippedLoaderQuery("file:///a/b.ts#y"),
        none: strippedLoaderQuery("file:///a/b.ts"),
        moved: attributeLoaderQueries({ record: queried }),
        urls: queried.result.map((one) => one.url),
      },
      {
        stripped: "file:///a/b.ts",
        fragment: "file:///a/b.ts",
        none: undefined,
        moved: 2,
        urls: [
          pathToRecordUrl(plain),
          pathToRecordUrl(plain),
          `${pathToRecordUrl(path.join(root, "absent.ts"))}?namespace=1`,
          pathToRecordUrl(plain),
          "node:fs",
        ],
      },
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
};
