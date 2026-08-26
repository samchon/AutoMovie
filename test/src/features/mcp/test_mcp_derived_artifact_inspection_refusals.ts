import type { IAutoMovieDerivedArtifactManifest } from "@automovie/interface";
import {
  AUTOMOVIE_DERIVED_ARTIFACT_MANIFEST_PATH,
  digestAutoMovieBytes,
  generateAutoMovieDerivedArtifact,
  inspectAutoMovieDerivedArtifacts,
} from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  readDerivedFixtureManifest,
  withDerivedArtifactFixture,
  writeDerivedFixtureFile,
  writeDerivedFixtureManifest,
} from "../internal/derivedArtifactFixtures";

const codes = (
  inspection: ReturnType<typeof inspectAutoMovieDerivedArtifacts>,
): string[] => inspection.problems.map((entry) => entry.code);

/** Compile inspection refuses every non-current or non-portable twin. */
export const test_mcp_derived_artifact_inspection_refusals = (): void => {
  withDerivedArtifactFixture((fixture) => {
    const secondInput = "inputs/zero.txt";
    writeDerivedFixtureFile(fixture.root, secondInput, "zero\n");
    generateAutoMovieDerivedArtifact({
      root: fixture.root,
      generator: fixture.generator,
      inputs: [fixture.input, secondInput],
      output: fixture.output,
      encoding: "base64",
      generate: () => new Uint8Array([0xff]),
    });
    const secondOutput = "automovie/derived/second.txt";
    generateAutoMovieDerivedArtifact({
      root: fixture.root,
      generator: fixture.generator,
      inputs: [],
      output: secondOutput,
      encoding: "utf8",
      generate: () => new TextEncoder().encode("second\n"),
    });
    const baseline = readDerivedFixtureManifest(fixture.root);
    const manifestFile = path.join(
      fixture.root,
      "automovie",
      "derived-artifacts.json",
    );
    const outputFile = path.join(fixture.root, ...fixture.output.split("/"));
    const generatorFile = path.join(
      fixture.root,
      ...fixture.generator.split("/"),
    );
    const inputFile = path.join(fixture.root, ...fixture.input.split("/"));

    TestValidator.equals(
      "non-canonical selector refuses",
      codes(
        inspectAutoMovieDerivedArtifacts({
          root: fixture.root,
          manifestPath: "derived-artifacts.json",
        }),
      ),
      ["derived-artifact-path-unsafe"],
    );
    fs.rmSync(manifestFile);
    TestValidator.equals(
      "selected missing ledger refuses",
      codes(
        inspectAutoMovieDerivedArtifacts({
          root: fixture.root,
          manifestPath: AUTOMOVIE_DERIVED_ARTIFACT_MANIFEST_PATH,
        }),
      ),
      ["derived-artifact-manifest-missing"],
    );
    writeDerivedFixtureFile(
      fixture.root,
      AUTOMOVIE_DERIVED_ARTIFACT_MANIFEST_PATH,
      new Uint8Array([0xff]),
    );
    TestValidator.equals(
      "non-UTF-8 ledger refuses",
      codes(
        inspectAutoMovieDerivedArtifacts({
          root: fixture.root,
          manifestPath: AUTOMOVIE_DERIVED_ARTIFACT_MANIFEST_PATH,
        }),
      ),
      ["derived-artifact-manifest-malformed"],
    );
    writeDerivedFixtureFile(
      fixture.root,
      AUTOMOVIE_DERIVED_ARTIFACT_MANIFEST_PATH,
      "{",
    );
    TestValidator.equals(
      "invalid JSON ledger refuses",
      codes(
        inspectAutoMovieDerivedArtifacts({
          root: fixture.root,
          manifestPath: AUTOMOVIE_DERIVED_ARTIFACT_MANIFEST_PATH,
        }),
      ),
      ["derived-artifact-manifest-malformed"],
    );
    writeDerivedFixtureManifest(fixture.root, { version: 2, artifacts: [] });
    TestValidator.equals(
      "schema-mismatched ledger refuses",
      codes(
        inspectAutoMovieDerivedArtifacts({
          root: fixture.root,
          manifestPath: AUTOMOVIE_DERIVED_ARTIFACT_MANIFEST_PATH,
        }),
      ),
      ["derived-artifact-manifest-malformed"],
    );
    const validRecord = structuredClone(baseline.artifacts[0]!);
    const malformedShapes: Array<{ name: string; manifest: unknown }> = [
      { name: "scalar root", manifest: "manifest" },
      { name: "null root", manifest: null },
      { name: "array root", manifest: [] },
      { name: "missing root field", manifest: { version: 1 } },
      {
        name: "wrong root field",
        manifest: { version: 1, records: [] },
      },
      { name: "non-array artifacts", manifest: { version: 1, artifacts: {} } },
      { name: "scalar artifact", manifest: { version: 1, artifacts: [1] } },
      {
        name: "artifact with missing field",
        manifest: { version: 1, artifacts: [{ path: fixture.output }] },
      },
      {
        name: "artifact with wrong equal-count field",
        manifest: {
          version: 1,
          artifacts: [
            { ...validRecord, outputDigest: undefined, unknown: "field" },
          ],
        },
      },
      {
        name: "non-string artifact path",
        manifest: {
          version: 1,
          artifacts: [{ ...validRecord, path: 1 }],
        },
      },
      {
        name: "unknown artifact encoding",
        manifest: {
          version: 1,
          artifacts: [{ ...validRecord, encoding: "hex" }],
        },
      },
      {
        name: "scalar generator",
        manifest: {
          version: 1,
          artifacts: [{ ...validRecord, generator: 1 }],
        },
      },
      {
        name: "generator with missing field",
        manifest: {
          version: 1,
          artifacts: [
            { ...validRecord, generator: { path: fixture.generator } },
          ],
        },
      },
      {
        name: "generator with wrong equal-count field",
        manifest: {
          version: 1,
          artifacts: [
            {
              ...validRecord,
              generator: { path: fixture.generator, checksum: "wrong" },
            },
          ],
        },
      },
      {
        name: "non-string generator path",
        manifest: {
          version: 1,
          artifacts: [
            {
              ...validRecord,
              generator: { ...validRecord.generator, path: 1 },
            },
          ],
        },
      },
      {
        name: "non-string generator digest",
        manifest: {
          version: 1,
          artifacts: [
            {
              ...validRecord,
              generator: { ...validRecord.generator, digest: 1 },
            },
          ],
        },
      },
      {
        name: "non-array inputs",
        manifest: {
          version: 1,
          artifacts: [{ ...validRecord, inputs: {} }],
        },
      },
      {
        name: "scalar input",
        manifest: {
          version: 1,
          artifacts: [{ ...validRecord, inputs: [1] }],
        },
      },
      {
        name: "input with missing field",
        manifest: {
          version: 1,
          artifacts: [{ ...validRecord, inputs: [{ path: fixture.input }] }],
        },
      },
      {
        name: "input with wrong equal-count field",
        manifest: {
          version: 1,
          artifacts: [
            {
              ...validRecord,
              inputs: [{ path: fixture.input, checksum: "wrong" }],
            },
          ],
        },
      },
      {
        name: "non-string input path",
        manifest: {
          version: 1,
          artifacts: [
            {
              ...validRecord,
              inputs: [{ ...validRecord.inputs[0]!, path: 1 }],
            },
          ],
        },
      },
      {
        name: "non-string input digest",
        manifest: {
          version: 1,
          artifacts: [
            {
              ...validRecord,
              inputs: [{ ...validRecord.inputs[0]!, digest: 1 }],
            },
          ],
        },
      },
      {
        name: "non-string basis digest",
        manifest: {
          version: 1,
          artifacts: [{ ...validRecord, basisDigest: 1 }],
        },
      },
      {
        name: "non-string output digest",
        manifest: {
          version: 1,
          artifacts: [{ ...validRecord, outputDigest: 1 }],
        },
      },
    ];
    for (const scenario of malformedShapes) {
      writeDerivedFixtureManifest(fixture.root, scenario.manifest);
      TestValidator.equals(
        scenario.name,
        codes(
          inspectAutoMovieDerivedArtifacts({
            root: fixture.root,
            manifestPath: AUTOMOVIE_DERIVED_ARTIFACT_MANIFEST_PATH,
          }),
        ),
        ["derived-artifact-manifest-malformed"],
      );
    }

    const invariantCases: Array<{
      name: string;
      code:
        | "derived-artifact-manifest-malformed"
        | "derived-artifact-path-unsafe";
      mutate: (manifest: IAutoMovieDerivedArtifactManifest) => void;
    }> = [
      {
        name: "unsafe output path",
        code: "derived-artifact-path-unsafe",
        mutate: (manifest) => {
          manifest.artifacts[0]!.path = "../escape.bin";
        },
      },
      {
        name: "unsafe generator path",
        code: "derived-artifact-path-unsafe",
        mutate: (manifest) => {
          manifest.artifacts[0]!.generator.path = "C:/escape.ts";
        },
      },
      {
        name: "unsafe input path",
        code: "derived-artifact-path-unsafe",
        mutate: (manifest) => {
          manifest.artifacts[0]!.inputs[0]!.path = "inputs/../escape.txt";
        },
      },
      {
        name: "output outside derived namespace",
        code: "derived-artifact-path-unsafe",
        mutate: (manifest) => {
          manifest.artifacts[0]!.path = "outputs/result.bin";
        },
      },
      {
        name: "duplicate output",
        code: "derived-artifact-manifest-malformed",
        mutate: (manifest) => {
          manifest.artifacts[1] = structuredClone(manifest.artifacts[0]!);
        },
      },
      {
        name: "out-of-order output",
        code: "derived-artifact-manifest-malformed",
        mutate: (manifest) => {
          manifest.artifacts.reverse();
        },
      },
      {
        name: "duplicate input",
        code: "derived-artifact-manifest-malformed",
        mutate: (manifest) => {
          manifest.artifacts[1]!.inputs = [
            structuredClone(manifest.artifacts[0]!.inputs[0]!),
            structuredClone(manifest.artifacts[0]!.inputs[0]!),
          ];
        },
      },
      {
        name: "out-of-order input",
        code: "derived-artifact-manifest-malformed",
        mutate: (manifest) => {
          manifest.artifacts[1]!.inputs = structuredClone(
            manifest.artifacts[0]!.inputs,
          ).reverse();
        },
      },
      {
        name: "input collides with generator",
        code: "derived-artifact-manifest-malformed",
        mutate: (manifest) => {
          const record = manifest.artifacts[1]!;
          record.inputs = [
            ...structuredClone(manifest.artifacts[0]!.inputs),
            structuredClone(record.generator),
          ].sort((left, right) =>
            left.path < right.path ? -1 : left.path > right.path ? 1 : 0,
          );
        },
      },
      {
        name: "invalid generator digest",
        code: "derived-artifact-manifest-malformed",
        mutate: (manifest) => {
          manifest.artifacts[0]!.generator.digest = "sha256:nope";
        },
      },
      {
        name: "invalid input digest",
        code: "derived-artifact-manifest-malformed",
        mutate: (manifest) => {
          manifest.artifacts[0]!.inputs[0]!.digest = "sha256:nope";
        },
      },
      {
        name: "invalid basis digest",
        code: "derived-artifact-manifest-malformed",
        mutate: (manifest) => {
          manifest.artifacts[0]!.basisDigest = "sha256:nope";
        },
      },
      {
        name: "invalid output digest",
        code: "derived-artifact-manifest-malformed",
        mutate: (manifest) => {
          manifest.artifacts[0]!.outputDigest = "sha256:nope";
        },
      },
      {
        name: "self-inconsistent basis digest",
        code: "derived-artifact-manifest-malformed",
        mutate: (manifest) => {
          manifest.artifacts[0]!.basisDigest = `sha256:${"0".repeat(64)}`;
        },
      },
    ];
    for (const scenario of invariantCases) {
      const manifest = structuredClone(baseline);
      scenario.mutate(manifest);
      writeDerivedFixtureManifest(fixture.root, manifest);
      TestValidator.equals(
        scenario.name,
        codes(
          inspectAutoMovieDerivedArtifacts({
            root: fixture.root,
            manifestPath: AUTOMOVIE_DERIVED_ARTIFACT_MANIFEST_PATH,
          }),
        ),
        [scenario.code],
      );
    }

    writeDerivedFixtureManifest(fixture.root, baseline);
    writeDerivedFixtureFile(
      fixture.root,
      fixture.generator,
      "export const version = 2;\n",
    );
    TestValidator.equals(
      "changed generator makes the basis stale",
      codes(
        inspectAutoMovieDerivedArtifacts({
          root: fixture.root,
          manifestPath: AUTOMOVIE_DERIVED_ARTIFACT_MANIFEST_PATH,
        }),
      ),
      ["derived-artifact-basis-stale", "derived-artifact-basis-stale"],
    );
    writeDerivedFixtureFile(
      fixture.root,
      fixture.generator,
      "export const version = 1;\n",
    );
    writeDerivedFixtureFile(fixture.root, fixture.input, "changed\n");
    TestValidator.equals(
      "changed declared input makes only its consumer stale",
      codes(
        inspectAutoMovieDerivedArtifacts({
          root: fixture.root,
          manifestPath: AUTOMOVIE_DERIVED_ARTIFACT_MANIFEST_PATH,
        }),
      ),
      ["derived-artifact-basis-stale"],
    );
    writeDerivedFixtureFile(fixture.root, fixture.input, "alpha\n");
    fs.rmSync(inputFile);
    TestValidator.equals(
      "missing declared input refuses its artifact",
      codes(
        inspectAutoMovieDerivedArtifacts({
          root: fixture.root,
          manifestPath: AUTOMOVIE_DERIVED_ARTIFACT_MANIFEST_PATH,
        }),
      ),
      ["derived-artifact-basis-missing"],
    );
    writeDerivedFixtureFile(fixture.root, fixture.input, "alpha\n");
    fs.rmSync(generatorFile);
    TestValidator.equals(
      "missing generator refuses every dependent artifact",
      codes(
        inspectAutoMovieDerivedArtifacts({
          root: fixture.root,
          manifestPath: AUTOMOVIE_DERIVED_ARTIFACT_MANIFEST_PATH,
        }),
      ),
      ["derived-artifact-basis-missing", "derived-artifact-basis-missing"],
    );
    writeDerivedFixtureFile(
      fixture.root,
      fixture.generator,
      "export const version = 1;\n",
    );
    fs.rmSync(outputFile);
    TestValidator.equals(
      "missing output refuses its artifact",
      codes(
        inspectAutoMovieDerivedArtifacts({
          root: fixture.root,
          manifestPath: AUTOMOVIE_DERIVED_ARTIFACT_MANIFEST_PATH,
        }),
      ),
      ["derived-artifact-output-missing"],
    );
    writeDerivedFixtureFile(fixture.root, fixture.output, new Uint8Array([1]));
    TestValidator.equals(
      "changed exact output bytes are stale",
      codes(
        inspectAutoMovieDerivedArtifacts({
          root: fixture.root,
          manifestPath: AUTOMOVIE_DERIVED_ARTIFACT_MANIFEST_PATH,
        }),
      ),
      ["derived-artifact-output-stale"],
    );
    writeDerivedFixtureFile(
      fixture.root,
      fixture.output,
      new Uint8Array([0xff]),
    );
    const malformedOutput = structuredClone(baseline);
    malformedOutput.artifacts.find(
      (record) => record.path === fixture.output,
    )!.encoding = "utf8";
    writeDerivedFixtureManifest(fixture.root, malformedOutput);
    TestValidator.equals(
      "UTF-8 declaration refuses undecodable current bytes",
      codes(
        inspectAutoMovieDerivedArtifacts({
          root: fixture.root,
          manifestPath: AUTOMOVIE_DERIVED_ARTIFACT_MANIFEST_PATH,
        }),
      ),
      ["derived-artifact-output-malformed"],
    );

    writeDerivedFixtureManifest(fixture.root, baseline);
    const collision = inspectAutoMovieDerivedArtifacts({
      root: fixture.root,
      manifestPath: AUTOMOVIE_DERIVED_ARTIFACT_MANIFEST_PATH,
      externalAssetPaths: ["automovie/derived/external.bin"],
    });
    TestValidator.equals(
      "external asset namespace collision refuses once",
      codes(collision),
      ["derived-artifact-external-collision"],
    );
    TestValidator.equals(
      "collision projects no derived bytes",
      collision.artifacts,
      {},
    );

    writeDerivedFixtureFile(fixture.root, fixture.output, new Uint8Array([1]));
    const mixed = inspectAutoMovieDerivedArtifacts({
      root: fixture.root,
      manifestPath: AUTOMOVIE_DERIVED_ARTIFACT_MANIFEST_PATH,
      externalAssetPaths: [],
    });
    TestValidator.equals(
      "a stale record does not hide an independent current record",
      Object.keys(mixed.artifacts),
      [secondOutput],
    );

    writeDerivedFixtureFile(
      fixture.root,
      fixture.output,
      new Uint8Array([0xff]),
    );
    const externalRoot = fs.mkdtempSync(
      path.join(os.tmpdir(), "automovie-derived-link-target-"),
    );
    const scriptsDirectory = path.join(fixture.root, "scripts");
    try {
      fs.rmSync(scriptsDirectory, { recursive: true });
      writeDerivedFixtureFile(
        externalRoot,
        "derive.ts",
        "export const version = 1;\n",
      );
      fs.symlinkSync(externalRoot, scriptsDirectory, "junction");
      TestValidator.equals(
        "linked generator ancestor refuses",
        codes(
          inspectAutoMovieDerivedArtifacts({
            root: fixture.root,
            manifestPath: AUTOMOVIE_DERIVED_ARTIFACT_MANIFEST_PATH,
          }),
        ),
        ["derived-artifact-path-unsafe", "derived-artifact-path-unsafe"],
      );
    } finally {
      fs.rmSync(scriptsDirectory, { recursive: true, force: true });
      fs.rmSync(externalRoot, { recursive: true, force: true });
      writeDerivedFixtureFile(
        fixture.root,
        fixture.generator,
        "export const version = 1;\n",
      );
    }
  });

  const realParent = fs.mkdtempSync(
    path.join(os.tmpdir(), "automovie-derived-real-parent-"),
  );
  const aliasParent = `${realParent}-alias`;
  const nestedRoot = path.join(realParent, "project");
  fs.mkdirSync(nestedRoot);
  try {
    fs.symlinkSync(realParent, aliasParent, "junction");
    const throughAlias = path.join(aliasParent, "project");
    const unsafeRoot = inspectAutoMovieDerivedArtifacts({
      root: throughAlias,
      manifestPath: AUTOMOVIE_DERIVED_ARTIFACT_MANIFEST_PATH,
    });
    TestValidator.equals(
      "root reached through a linked ancestor refuses",
      codes(unsafeRoot),
      ["derived-artifact-path-unsafe"],
    );
  } finally {
    fs.rmSync(aliasParent, { recursive: true, force: true });
    fs.rmSync(realParent, { recursive: true, force: true });
  }

  const digest = digestAutoMovieBytes(new Uint8Array());
  TestValidator.predicate(
    "empty digest remains a stable SHA-256 identity",
    /^sha256:[0-9a-f]{64}$/u.test(digest),
  );
};
