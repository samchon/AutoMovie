import {
  AUTOMOVIE_DERIVED_ARTIFACT_BASIS_PROTOCOL,
  AUTOMOVIE_DERIVED_ARTIFACT_MANIFEST_PATH,
  generateAutoMovieDerivedArtifact,
  inspectAutoMovieDerivedArtifacts,
} from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import path from "node:path";

import {
  readDerivedFixtureManifest,
  withDerivedArtifactFixture,
  writeDerivedFixtureFile,
} from "../internal/derivedArtifactFixtures";

/**
 * Explicit generation publishes deterministic text, binary, empty, and large
 * outputs while an unchanged run leaves resident bytes and mtimes alone.
 */
export const test_mcp_derived_artifact_generation = (): void =>
  withDerivedArtifactFixture((fixture) => {
    TestValidator.equals(
      "a production without the optional ledger has no derived closure",
      inspectAutoMovieDerivedArtifacts({ root: fixture.root }),
      {
        manifest: null,
        artifacts: {},
        problems: [],
        fingerprintFields: [],
      },
    );
    TestValidator.equals(
      "stable protocol and ledger path",
      [
        AUTOMOVIE_DERIVED_ARTIFACT_BASIS_PROTOCOL,
        AUTOMOVIE_DERIVED_ARTIFACT_MANIFEST_PATH,
      ],
      [
        "automovie.derived-artifact.basis.v1",
        ".automovie/derived-artifacts.json",
      ],
    );

    const starts: number[] = [];
    const generated = generateAutoMovieDerivedArtifact({
      root: fixture.root,
      generator: fixture.generator,
      inputs: [fixture.input],
      output: fixture.output,
      encoding: "utf8",
      generate: (inputs) => {
        const source = inputs[fixture.input]!;
        starts.push(source[0]!);
        source[0] = 0;
        return new TextEncoder().encode("derived-alpha\n");
      },
    });
    TestValidator.equals(
      "fresh copies reach both executions",
      starts,
      [97, 97],
    );
    TestValidator.predicate(
      "first publication changes the tree",
      generated.changed,
    );
    TestValidator.equals(
      "exact artifact bytes are resident",
      fs.readFileSync(
        path.join(fixture.root, ...fixture.output.split("/")),
        "utf8",
      ),
      "derived-alpha\n",
    );
    const serializedManifest = fs.readFileSync(
      path.join(fixture.root, ".automovie", "derived-artifacts.json"),
      "utf8",
    );
    TestValidator.predicate(
      "ledger carries no clock, host, process, or temporary metadata",
      ["timestamp", "createdAt", "updatedAt", "process", "temporary"].every(
        (name) => serializedManifest.includes(name) === false,
      ),
    );
    TestValidator.equals(
      "record closes generator, input, basis, and output identities",
      Object.keys(generated.record),
      [
        "path",
        "encoding",
        "generator",
        "inputs",
        "basisDigest",
        "outputDigest",
      ],
    );

    const current = inspectAutoMovieDerivedArtifacts({
      root: fixture.root,
      manifestPath: AUTOMOVIE_DERIVED_ARTIFACT_MANIFEST_PATH,
    });
    TestValidator.equals(
      "current artifact has no refusal",
      current.problems,
      [],
    );
    TestValidator.equals(
      "verified UTF-8 reaches source context",
      current.artifacts[fixture.output],
      {
        digest: generated.record.outputDigest,
        encoding: "utf8",
        content: "derived-alpha\n",
      },
    );
    TestValidator.predicate(
      "manifest, generator, input, and output enter the fingerprint",
      current.fingerprintFields.length === 4 &&
        current.fingerprintFields.every((field) =>
          field.role.startsWith("derived-artifact:"),
        ),
    );

    const artifactFile = path.join(fixture.root, ...fixture.output.split("/"));
    const manifestFile = path.join(
      fixture.root,
      ".automovie",
      "derived-artifacts.json",
    );
    const priorTimes = [
      fs.statSync(artifactFile).mtimeMs,
      fs.statSync(manifestFile).mtimeMs,
    ];
    const unchanged = generateAutoMovieDerivedArtifact({
      root: fixture.root,
      generator: fixture.generator,
      inputs: [fixture.input],
      output: fixture.output,
      encoding: "utf8",
      generate: () => new TextEncoder().encode("derived-alpha\n"),
    });
    TestValidator.equals(
      "unchanged publication is a no-op",
      unchanged.changed,
      false,
    );
    TestValidator.equals(
      "unchanged publication preserves mtimes",
      [fs.statSync(artifactFile).mtimeMs, fs.statSync(manifestFile).mtimeMs],
      priorTimes,
    );

    writeDerivedFixtureFile(
      fixture.root,
      fixture.generator,
      "export const version = 1;\r\n",
    );
    const normalized = generateAutoMovieDerivedArtifact({
      root: fixture.root,
      generator: fixture.generator,
      inputs: [fixture.input],
      output: fixture.output,
      encoding: "utf8",
      generate: () => new TextEncoder().encode("derived-alpha\n"),
    });
    TestValidator.equals(
      "generator line ending normalization preserves basis",
      normalized.changed,
      false,
    );

    const emptyPath = ".automovie/derived/empty.txt";
    generateAutoMovieDerivedArtifact({
      root: fixture.root,
      generator: fixture.generator,
      inputs: [],
      output: emptyPath,
      encoding: "utf8",
      generate: () => new Uint8Array(),
    });
    const secondInput = "inputs/aaa.txt";
    writeDerivedFixtureFile(fixture.root, secondInput, "beta\n");
    const largePath = ".automovie/derived/large.bin";
    const largeBytes = new Uint8Array(2 * 1024 * 1024);
    largeBytes[0] = 255;
    largeBytes[largeBytes.length - 1] = 127;
    generateAutoMovieDerivedArtifact({
      root: fixture.root,
      generator: fixture.generator,
      inputs: [fixture.input, secondInput],
      output: largePath,
      encoding: "base64",
      generate: () => largeBytes,
    });
    const boundary = inspectAutoMovieDerivedArtifacts({
      root: fixture.root,
      manifestPath: AUTOMOVIE_DERIVED_ARTIFACT_MANIFEST_PATH,
    });
    TestValidator.equals(
      "boundary artifacts stay current",
      boundary.problems,
      [],
    );
    TestValidator.equals(
      "empty UTF-8 artifact reaches source",
      boundary.artifacts[emptyPath]?.content,
      "",
    );
    TestValidator.equals(
      "large binary artifact reaches source as exact base64",
      boundary.artifacts[largePath]?.content,
      Buffer.from(largeBytes).toString("base64"),
    );
    const manifest = readDerivedFixtureManifest(fixture.root);
    TestValidator.equals(
      "artifact records use canonical output order",
      manifest.artifacts.map((record) => record.path),
      [emptyPath, largePath, fixture.output],
    );
    TestValidator.equals(
      "declared inputs use canonical code-unit order",
      manifest.artifacts
        .find((record) => record.path === largePath)
        ?.inputs.map((input) => input.path),
      [secondInput, fixture.input],
    );
  });
