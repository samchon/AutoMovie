import type { IAutoMovieDerivedArtifactManifest } from "@automovie/interface";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export interface IDerivedArtifactFixture {
  root: string;
  generator: string;
  input: string;
  output: string;
}

/** Run one derived-artifact scenario in an isolated physical project root. */
export const withDerivedArtifactFixture = (
  run: (fixture: IDerivedArtifactFixture) => void,
): void => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "automovie-derived-"));
  const fixture: IDerivedArtifactFixture = {
    root,
    generator: "scripts/derive.ts",
    input: "inputs/source.txt",
    output: "automovie/derived/result.bin",
  };
  writeDerivedFixtureFile(
    root,
    fixture.generator,
    "export const version = 1;\n",
  );
  writeDerivedFixtureFile(root, fixture.input, "alpha\n");
  try {
    run(fixture);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
};

/** Write exact fixture bytes while retaining ordinary physical ancestors. */
export const writeDerivedFixtureFile = (
  root: string,
  relative: string,
  content: string | Uint8Array,
): void => {
  const file = path.join(root, ...relative.split("/"));
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
};

/** Read the version-one tracked ledger emitted by a generation attempt. */
export const readDerivedFixtureManifest = (
  root: string,
): IAutoMovieDerivedArtifactManifest =>
  JSON.parse(
    fs.readFileSync(
      path.join(root, "automovie", "derived-artifacts.json"),
      "utf8",
    ),
  ) as IAutoMovieDerivedArtifactManifest;

/** Replace the tracked ledger with one deliberately mutated test value. */
export const writeDerivedFixtureManifest = (
  root: string,
  manifest: unknown,
): void =>
  writeDerivedFixtureFile(
    root,
    "automovie/derived-artifacts.json",
    `${JSON.stringify(manifest, null, 2)}\n`,
  );
