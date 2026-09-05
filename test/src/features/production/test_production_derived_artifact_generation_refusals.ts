import {
  AutoMovieDerivedArtifactGenerationError,
  generateAutoMovieDerivedArtifact,
} from "@automovie/production";
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
import { isolatedFileSystemTest } from "../internal/testFileSystem";

const generationCode = (task: () => unknown): string | null => {
  try {
    task();
    return null;
  } catch (error) {
    return error instanceof AutoMovieDerivedArtifactGenerationError
      ? error.code
      : `unexpected:${error instanceof Error ? error.message : String(error)}`;
  }
};

/** Explicit generation fails closed before publishing incomplete or unsafe state. */
export const test_production_derived_artifact_generation_refusals =
  isolatedFileSystemTest((fileSystem): void => {
    withDerivedArtifactFixture((fixture) => {
      const valid = () =>
        generateAutoMovieDerivedArtifact({
          root: fixture.root,
          generator: fixture.generator,
          inputs: [fixture.input],
          output: fixture.output,
          encoding: "utf8",
          generate: () => new TextEncoder().encode("stable\n"),
        });

      const invalidGeneratorPaths = [
        "",
        ".",
        "/absolute.ts",
        "C:/drive.ts",
        "scripts\\windows.ts",
        "scripts/../escape.ts",
        "scripts//gap.ts",
        "scripts/dot./file.ts",
        "scripts/trailing ",
        "scripts/a:b.ts",
        "scripts/NUL.ts",
        "scripts/null\0byte.ts",
      ];
      TestValidator.equals(
        "non-canonical generator paths refuse",
        invalidGeneratorPaths.map((generator) =>
          generationCode(() =>
            generateAutoMovieDerivedArtifact({
              root: fixture.root,
              generator,
              inputs: [fixture.input],
              output: fixture.output,
              encoding: "utf8",
              generate: () => new Uint8Array(),
            }),
          ),
        ),
        invalidGeneratorPaths.map(() => "path-unsafe"),
      );
      TestValidator.equals(
        "outputs must use the derived namespace",
        generationCode(() =>
          generateAutoMovieDerivedArtifact({
            root: fixture.root,
            generator: fixture.generator,
            inputs: [fixture.input],
            output: "generated/result.bin",
            encoding: "base64",
            generate: () => new Uint8Array(),
          }),
        ),
        "path-unsafe",
      );
      TestValidator.equals(
        "duplicate portable input identities refuse",
        generationCode(() =>
          generateAutoMovieDerivedArtifact({
            root: fixture.root,
            generator: fixture.generator,
            inputs: [fixture.input, fixture.input.toUpperCase()],
            output: fixture.output,
            encoding: "base64",
            generate: () => new Uint8Array(),
          }),
        ),
        "path-unsafe",
      );
      TestValidator.equals(
        "an input cannot be its generator",
        generationCode(() =>
          generateAutoMovieDerivedArtifact({
            root: fixture.root,
            generator: fixture.generator,
            inputs: [fixture.generator],
            output: fixture.output,
            encoding: "base64",
            generate: () => new Uint8Array(),
          }),
        ),
        "path-unsafe",
      );
      TestValidator.equals(
        "an input cannot be its output",
        generationCode(() =>
          generateAutoMovieDerivedArtifact({
            root: fixture.root,
            generator: fixture.generator,
            inputs: [fixture.output],
            output: fixture.output,
            encoding: "base64",
            generate: () => new Uint8Array(),
          }),
        ),
        "path-unsafe",
      );
      TestValidator.equals(
        "the ledger cannot be an input",
        generationCode(() =>
          generateAutoMovieDerivedArtifact({
            root: fixture.root,
            generator: fixture.generator,
            inputs: ["automovie/derived-artifacts.json"],
            output: fixture.output,
            encoding: "base64",
            generate: () => new Uint8Array(),
          }),
        ),
        "path-unsafe",
      );
      TestValidator.equals(
        "missing declared input refuses",
        generationCode(() =>
          generateAutoMovieDerivedArtifact({
            root: fixture.root,
            generator: fixture.generator,
            inputs: ["inputs/missing.bin"],
            output: fixture.output,
            encoding: "base64",
            generate: () => new Uint8Array(),
          }),
        ),
        "input-missing",
      );
      TestValidator.equals(
        "missing generator refuses",
        generationCode(() =>
          generateAutoMovieDerivedArtifact({
            root: fixture.root,
            generator: "scripts/missing.ts",
            inputs: [fixture.input],
            output: fixture.output,
            encoding: "base64",
            generate: () => new Uint8Array(),
          }),
        ),
        "input-missing",
      );
      fs.mkdirSync(path.join(fixture.root, "scripts", "directory.ts"), {
        recursive: true,
      });
      TestValidator.equals(
        "a resident non-file generator refuses as unsafe",
        generationCode(() =>
          generateAutoMovieDerivedArtifact({
            root: fixture.root,
            generator: "scripts/directory.ts",
            inputs: [fixture.input],
            output: fixture.output,
            encoding: "base64",
            generate: () => new Uint8Array(),
          }),
        ),
        "path-unsafe",
      );
      fs.mkdirSync(path.join(fixture.root, "inputs", "directory.txt"), {
        recursive: true,
      });
      TestValidator.equals(
        "a resident non-file declared input refuses as unsafe",
        generationCode(() =>
          generateAutoMovieDerivedArtifact({
            root: fixture.root,
            generator: fixture.generator,
            inputs: ["inputs/directory.txt"],
            output: fixture.output,
            encoding: "base64",
            generate: () => new Uint8Array(),
          }),
        ),
        "path-unsafe",
      );

      TestValidator.equals(
        "generator exception remains a generation refusal",
        generationCode(() =>
          generateAutoMovieDerivedArtifact({
            root: fixture.root,
            generator: fixture.generator,
            inputs: [fixture.input],
            output: fixture.output,
            encoding: "base64",
            generate: () => {
              throw new Error("intentional generator failure");
            },
          }),
        ),
        "generator-failed",
      );
      TestValidator.equals(
        "non-Error generator exception remains diagnosable",
        generationCode(() =>
          generateAutoMovieDerivedArtifact({
            root: fixture.root,
            generator: fixture.generator,
            inputs: [fixture.input],
            output: fixture.output,
            encoding: "base64",
            generate: () => {
              // eslint-disable-next-line typescript/only-throw-error -- the helper must preserve non-Error host failures too
              throw "string generator failure";
            },
          }),
        ),
        "generator-failed",
      );
      TestValidator.equals(
        "non-byte generator result refuses",
        generationCode(() =>
          generateAutoMovieDerivedArtifact({
            root: fixture.root,
            generator: fixture.generator,
            inputs: [fixture.input],
            output: fixture.output,
            encoding: "base64",
            generate: (() => "not bytes") as unknown as () => Uint8Array,
          }),
        ),
        "output-malformed",
      );
      let attempt = 0;
      TestValidator.equals(
        "different duplicate results refuse without output",
        generationCode(() =>
          generateAutoMovieDerivedArtifact({
            root: fixture.root,
            generator: fixture.generator,
            inputs: [fixture.input],
            output: fixture.output,
            encoding: "base64",
            generate: () => new Uint8Array([++attempt]),
          }),
        ),
        "nondeterministic-output",
      );
      TestValidator.predicate(
        "nondeterministic refusal publishes no artifact",
        fs.existsSync(path.join(fixture.root, ...fixture.output.split("/"))) ===
          false,
      );
      TestValidator.equals(
        "malformed UTF-8 refuses before publication",
        generationCode(() =>
          generateAutoMovieDerivedArtifact({
            root: fixture.root,
            generator: fixture.generator,
            inputs: [fixture.input],
            output: fixture.output,
            encoding: "utf8",
            generate: () => new Uint8Array([0xff]),
          }),
        ),
        "output-malformed",
      );
      TestValidator.equals(
        "binary encoding accepts arbitrary exact bytes",
        generationCode(() =>
          generateAutoMovieDerivedArtifact({
            root: fixture.root,
            generator: fixture.generator,
            inputs: [fixture.input],
            output: fixture.output,
            encoding: "base64",
            generate: () => new Uint8Array([0xff]),
          }),
        ),
        null,
      );

      fs.rmSync(path.join(fixture.root, ...fixture.output.split("/")));
      writeDerivedFixtureFile(fixture.root, fixture.input, "alpha\n");
      const changingBasis = generationCode(() =>
        generateAutoMovieDerivedArtifact({
          root: fixture.root,
          generator: fixture.generator,
          inputs: [fixture.input],
          output: fixture.output,
          encoding: "base64",
          generate: () => {
            writeDerivedFixtureFile(fixture.root, fixture.input, "changed\n");
            return new Uint8Array([1]);
          },
        }),
      );
      TestValidator.equals(
        "basis mutation during the attempt refuses",
        changingBasis,
        "basis-changed",
      );

      writeDerivedFixtureFile(fixture.root, fixture.input, "alpha\n");
      valid();
      const validRecordBefore = structuredClone(
        readDerivedFixtureManifest(fixture.root).artifacts[0]!,
      );
      const manifestBefore = fs.readFileSync(
        path.join(fixture.root, "automovie", "derived-artifacts.json"),
      );
      const outputBefore = fs.readFileSync(
        path.join(fixture.root, ...fixture.output.split("/")),
      );
      const generatorDirectory = path.dirname(
        path.join(fixture.root, ...fixture.generator.split("/")),
      );
      const externalGeneratorDirectory = fs.mkdtempSync(
        path.join(os.tmpdir(), "automovie-derived-generation-link-"),
      );
      try {
        fs.rmSync(generatorDirectory, { recursive: true });
        writeDerivedFixtureFile(
          externalGeneratorDirectory,
          "derive.ts",
          "export const version = 1;\n",
        );
        fs.symlinkSync(
          externalGeneratorDirectory,
          generatorDirectory,
          "junction",
        );
        TestValidator.equals(
          "linked generator ancestor refuses generation",
          generationCode(valid),
          "path-unsafe",
        );
      } finally {
        fs.rmSync(generatorDirectory, { recursive: true, force: true });
        fs.rmSync(externalGeneratorDirectory, {
          recursive: true,
          force: true,
        });
        writeDerivedFixtureFile(
          fixture.root,
          fixture.generator,
          "export const version = 1;\n",
        );
      }
      const originalRename = fs.renameSync;
      fileSystem.renameSync = ((
        source: fs.PathLike,
        destination: fs.PathLike,
      ): void => {
        if (String(destination).endsWith(path.join("derived", "result.bin")))
          throw new Error("injected artifact rename failure");
        originalRename(source, destination);
      }) as typeof fs.renameSync;
      try {
        TestValidator.equals(
          "publication failure is classified",
          generationCode(() =>
            generateAutoMovieDerivedArtifact({
              root: fixture.root,
              generator: fixture.generator,
              inputs: [fixture.input],
              output: fixture.output,
              encoding: "utf8",
              generate: () => new TextEncoder().encode("different\n"),
            }),
          ),
          "publication-failed",
        );
      } finally {
        fileSystem.renameSync = originalRename;
      }
      TestValidator.equals(
        "failed artifact rename preserves old output",
        fs.readFileSync(path.join(fixture.root, ...fixture.output.split("/"))),
        outputBefore,
      );
      TestValidator.equals(
        "failed artifact rename preserves old manifest",
        fs.readFileSync(
          path.join(fixture.root, "automovie", "derived-artifacts.json"),
        ),
        manifestBefore,
      );

      writeDerivedFixtureFile(
        fixture.root,
        "automovie/derived-artifacts.json",
        "not json",
      );
      TestValidator.equals(
        "malformed resident ledger blocks generation",
        generationCode(valid),
        "manifest-malformed",
      );
      writeDerivedFixtureManifest(fixture.root, {
        version: 2,
        artifacts: [],
      });
      TestValidator.equals(
        "wrong resident ledger version blocks generation",
        generationCode(valid),
        "manifest-malformed",
      );
      writeDerivedFixtureManifest(fixture.root, {
        version: 1,
        artifacts: [
          structuredClone(validRecordBefore),
          structuredClone(validRecordBefore),
        ],
      });
      TestValidator.equals(
        "non-canonical resident record order blocks generation",
        generationCode(valid),
        "manifest-malformed",
      );
      const prior = {
        version: 1,
        artifacts: [
          {
            path: "../escape.bin",
            encoding: "base64",
            generator: {
              path: fixture.generator,
              digest: `sha256:${"0".repeat(64)}`,
            },
            inputs: [],
            basisDigest: `sha256:${"0".repeat(64)}`,
            outputDigest: `sha256:${"0".repeat(64)}`,
          },
        ],
      };
      writeDerivedFixtureManifest(fixture.root, prior);
      TestValidator.equals(
        "unsafe resident ledger blocks generation",
        generationCode(valid),
        "path-unsafe",
      );
    });

    const missingRoot = path.join(
      os.tmpdir(),
      `automovie-derived-missing-${Date.now()}`,
    );
    TestValidator.equals(
      "missing physical root refuses",
      generationCode(() =>
        generateAutoMovieDerivedArtifact({
          root: missingRoot,
          generator: "scripts/derive.ts",
          inputs: [],
          output: "automovie/derived/result.bin",
          encoding: "base64",
          generate: () => new Uint8Array(),
        }),
      ),
      "path-unsafe",
    );
    const rootFile = path.join(
      os.tmpdir(),
      `automovie-derived-file-${Date.now()}`,
    );
    fs.writeFileSync(rootFile, "not a directory");
    try {
      TestValidator.equals(
        "non-directory root refuses",
        generationCode(() =>
          generateAutoMovieDerivedArtifact({
            root: rootFile,
            generator: "scripts/derive.ts",
            inputs: [],
            output: "automovie/derived/result.bin",
            encoding: "base64",
            generate: () => new Uint8Array(),
          }),
        ),
        "path-unsafe",
      );
    } finally {
      fs.rmSync(rootFile, { force: true });
    }
  });
