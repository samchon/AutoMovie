import type {
  AutoMovieContentDigest,
  AutoMovieDerivedArtifactEncoding,
  IAutoMovieDerivedArtifactDependency,
  IAutoMovieDerivedArtifactManifest,
  IAutoMovieDerivedArtifactRecord,
  IAutoMovieDerivedArtifactSource,
} from "@automovie/interface";
import { randomUUID } from "node:crypto";
import type { Stats } from "node:fs";
import path from "node:path";

import { acquireCommitLock, releaseCommitLock } from "../project/commitLock";
import { autoMovieFileSystem as fileSystem } from "../project/fileSystem";
import {
  type IAutoMovieFingerprintField,
  compareCodeUnits,
  digestAutoMovieBytes,
  fingerprintAutoMovieFields,
  normalizeAutoMovieSource,
} from "./contentIdentity";

/**
 * Tracked ledger selected by a production that uses deterministic precompute.
 *
 * @author Samchon
 */
export const AUTOMOVIE_DERIVED_ARTIFACT_MANIFEST_PATH =
  "automovie/derived-artifacts.json" as const;

/**
 * Domain separator for generator and declared-input basis identities.
 *
 * @author Samchon
 */
export const AUTOMOVIE_DERIVED_ARTIFACT_BASIS_PROTOCOL =
  "automovie.derived-artifact.basis.v1";

type AutoMovieDerivedArtifactGenerationErrorCode =
  | "basis-changed"
  | "generator-failed"
  | "input-missing"
  | "manifest-malformed"
  | "nondeterministic-output"
  | "output-malformed"
  | "path-unsafe"
  | "publication-failed";

/**
 * Structured refusal from one explicit precomputation attempt.
 *
 * @author Samchon
 */
export class AutoMovieDerivedArtifactGenerationError extends Error {
  public constructor(
    /**
     * Stable generation refusal classification.
     */
    public readonly code: AutoMovieDerivedArtifactGenerationErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
  }
}

type AutoMovieDerivedArtifactProblemCode =
  | "derived-artifact-basis-missing"
  | "derived-artifact-basis-stale"
  | "derived-artifact-external-collision"
  | "derived-artifact-manifest-malformed"
  | "derived-artifact-manifest-missing"
  | "derived-artifact-output-malformed"
  | "derived-artifact-output-missing"
  | "derived-artifact-output-stale"
  | "derived-artifact-path-unsafe";

interface IAutoMovieDerivedArtifactProblem {
  code: AutoMovieDerivedArtifactProblemCode;
  target: string;
  path: string | null;
  message: string;
}

interface IAutoMovieDerivedArtifactInspection {
  manifest: IAutoMovieDerivedArtifactManifest | null;
  artifacts: Readonly<Record<string, IAutoMovieDerivedArtifactSource>>;
  problems: IAutoMovieDerivedArtifactProblem[];
  fingerprintFields: IAutoMovieFingerprintField[];
}

interface IGenerateAutoMovieDerivedArtifactProps {
  root: string;
  generator: string;
  inputs: readonly string[];
  output: string;
  encoding: AutoMovieDerivedArtifactEncoding;
  generate: (inputs: Readonly<Record<string, Uint8Array>>) => Uint8Array;
}

interface IGenerateAutoMovieDerivedArtifactOutput {
  changed: boolean;
  manifest: IAutoMovieDerivedArtifactManifest;
  record: IAutoMovieDerivedArtifactRecord;
}

interface IProjectFileRead {
  bytes: Uint8Array | null;
  problem: IAutoMovieDerivedArtifactProblem | null;
}

const DERIVED_ROOT = "automovie/derived/";
const LOCK_PATH = "automovie/derived-artifacts.lock";
const SHA256 = /^sha256:[0-9a-f]{64}$/u;
const WINDOWS_DRIVE = /^[A-Za-z]:/u;
const WINDOWS_DEVICE =
  /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9]|conin\$|conout\$)(?:\.|$)/iu;

/**
 * Generate and atomically publish one deterministic project artifact.
 *
 * The callback runs twice against independent copies of the declared inputs.
 * Publication begins only when both exact outputs agree and the live basis is
 * still the one the attempt read. This function runs in an ordinary Node
 * script, never inside the compile sandbox.
 *
 * @author Samchon
 */
export const generateAutoMovieDerivedArtifact = (
  props: IGenerateAutoMovieDerivedArtifactProps,
): IGenerateAutoMovieDerivedArtifactOutput => {
  const root = physicalProjectRoot(props.root, "path-unsafe");
  assertGenerationPath(props.generator, "generator");
  assertGenerationPath(props.output, "output");
  if (props.output.startsWith(DERIVED_ROOT) === false)
    generationFailure(
      "path-unsafe",
      `Derived output "${props.output}" must live below "${DERIVED_ROOT}".`,
    );
  const inputs = canonicalInputPaths(props.inputs);
  const occupied = new Set([
    props.generator.toLowerCase(),
    AUTOMOVIE_DERIVED_ARTIFACT_MANIFEST_PATH.toLowerCase(),
    props.output.toLowerCase(),
  ]);
  for (const input of inputs)
    if (occupied.has(input.toLowerCase()))
      generationFailure(
        "path-unsafe",
        `Derived input "${input}" collides with its generator, output, or manifest. Keep the dependency graph acyclic.`,
      );
    else occupied.add(input.toLowerCase());

  const lockFile = resolveCanonical(root, LOCK_PATH);
  let token: string | null = null;
  try {
    ensurePhysicalDirectory(root, path.join(root, "automovie"));
    token = acquireCommitLock(lockFile);
    const manifest = readGenerationManifest(root);
    const generatorBytes = readGenerationFile(root, props.generator, true);
    const generator: IAutoMovieDerivedArtifactDependency = {
      path: props.generator,
      digest: digestAutoMovieBytes(normalizeAutoMovieSource(generatorBytes)),
    };
    const inputBytes = Object.fromEntries(
      inputs.map((input) => [input, readGenerationFile(root, input, false)]),
    );
    const dependencies = inputs.map(
      (input): IAutoMovieDerivedArtifactDependency => ({
        path: input,
        digest: digestAutoMovieBytes(inputBytes[input]!),
      }),
    );
    const first = invokeGenerator(props.generate, inputBytes);
    const second = invokeGenerator(props.generate, inputBytes);
    if (Buffer.from(first).equals(Buffer.from(second)) === false)
      generationFailure(
        "nondeterministic-output",
        `Generator "${props.generator}" returned different bytes for the same declared inputs. No artifact was published.`,
      );
    assertEncoding(first, props.encoding, "output-malformed");
    const liveGenerator = digestAutoMovieBytes(
      normalizeAutoMovieSource(readGenerationFile(root, props.generator, true)),
    );
    const liveInputs = dependencies.map((input) => ({
      path: input.path,
      digest: digestAutoMovieBytes(readGenerationFile(root, input.path, false)),
    }));
    if (
      liveGenerator !== generator.digest ||
      JSON.stringify(liveInputs) !== JSON.stringify(dependencies)
    )
      generationFailure(
        "basis-changed",
        "Generator or declared input bytes changed during generation. Run the explicit generation command again against one stable snapshot.",
      );
    const record: IAutoMovieDerivedArtifactRecord = {
      path: props.output,
      encoding: props.encoding,
      generator,
      inputs: dependencies,
      basisDigest: basisDigest(generator, dependencies),
      outputDigest: digestAutoMovieBytes(first),
    };
    const artifacts = manifest.artifacts
      .filter((artifact) => artifact.path !== props.output)
      .concat(record)
      .sort((left, right) => compareCodeUnits(left.path, right.path));
    const next: IAutoMovieDerivedArtifactManifest = {
      version: 1,
      artifacts,
    };
    const artifactPath = resolveCanonical(root, props.output);
    const manifestPath = resolveCanonical(
      root,
      AUTOMOVIE_DERIVED_ARTIFACT_MANIFEST_PATH,
    );
    const artifactChanged =
      sameResidentBytes(root, artifactPath, first) === false;
    const manifestBytes = Buffer.from(`${JSON.stringify(next, null, 2)}\n`);
    const manifestChanged =
      sameResidentBytes(root, manifestPath, manifestBytes) === false;
    if (artifactChanged) writePhysicalFileAtomic(root, artifactPath, first);
    if (manifestChanged)
      writePhysicalFileAtomic(root, manifestPath, manifestBytes);
    return {
      changed: artifactChanged || manifestChanged,
      manifest: next,
      record,
    };
  } catch (error) {
    if (error instanceof AutoMovieDerivedArtifactGenerationError) throw error;
    throw new AutoMovieDerivedArtifactGenerationError(
      "publication-failed",
      `Derived artifact publication failed: ${errorMessage(error)}`,
      { cause: error },
    );
  } finally {
    if (token !== null) releaseCommitLock(lockFile, token);
  }
};

/**
 * Inspect every declared derived artifact without executing a generator.
 *
 * Only records whose manifest, live basis, output digest, encoding, namespace,
 * and external-asset separation all pass enter `artifacts`. Fingerprint fields
 * retain present, absent, stale, and malformed bytes so guarded compilation can
 * detect a race over the same closure.
 *
 * @author Samchon
 */
export const inspectAutoMovieDerivedArtifacts = (props: {
  root: string;
  manifestPath?: string;
  externalAssetPaths?: readonly string[];
}): IAutoMovieDerivedArtifactInspection => {
  if (props.manifestPath === undefined)
    return {
      manifest: null,
      artifacts: {},
      problems: [],
      fingerprintFields: [],
    };
  const problems: IAutoMovieDerivedArtifactProblem[] = [];
  const fingerprintFields: IAutoMovieFingerprintField[] = [];
  let root: string;
  try {
    root = physicalProjectRoot(props.root, "path-unsafe");
  } catch (error) {
    return {
      manifest: null,
      artifacts: {},
      problems: [
        problem(
          "derived-artifact-path-unsafe",
          "derived-artifact-manifest",
          props.manifestPath,
          `${errorMessage(error)} Restore one physical project root and run generation again.`,
        ),
      ],
      fingerprintFields: [
        fingerprintField("manifest", props.manifestPath, "unsafe", null),
      ],
    };
  }
  if (props.manifestPath !== AUTOMOVIE_DERIVED_ARTIFACT_MANIFEST_PATH) {
    problems.push(
      problem(
        "derived-artifact-path-unsafe",
        "derived-artifact-manifest",
        props.manifestPath,
        `Derived artifact manifest must be "${AUTOMOVIE_DERIVED_ARTIFACT_MANIFEST_PATH}". Correct automovie/manifest.json.`,
      ),
    );
    fingerprintFields.push(
      fingerprintField("manifest", props.manifestPath, "unsafe", null),
    );
    return { manifest: null, artifacts: {}, problems, fingerprintFields };
  }
  const manifestRead = readInspectionFile({
    root,
    relative: props.manifestPath,
    missingCode: "derived-artifact-manifest-missing",
    target: "derived-artifact-manifest",
  });
  fingerprintFields.push(
    fingerprintField(
      "manifest",
      props.manifestPath,
      manifestRead.problem === null ? "file" : "absent-or-unsafe",
      manifestRead.bytes,
    ),
  );
  if (manifestRead.problem !== null) {
    problems.push(manifestRead.problem);
    return { manifest: null, artifacts: {}, problems, fingerprintFields };
  }
  const parsed = parseManifest(manifestRead.bytes!);
  if (parsed.manifest === null) {
    problems.push(
      problem(
        "derived-artifact-manifest-malformed",
        "derived-artifact-manifest",
        props.manifestPath,
        `${parsed.reason} Regenerate the derived artifact manifest instead of editing it.`,
      ),
    );
    return { manifest: null, artifacts: {}, problems, fingerprintFields };
  }
  const manifestReason = manifestInvariantFailure(parsed.manifest);
  if (manifestReason !== null) {
    problems.push(
      problem(
        manifestReason.pathUnsafe
          ? "derived-artifact-path-unsafe"
          : "derived-artifact-manifest-malformed",
        manifestReason.target,
        manifestReason.path,
        `${manifestReason.message} Run the explicit generation command to rebuild the canonical ledger.`,
      ),
    );
    return {
      manifest: parsed.manifest,
      artifacts: {},
      problems,
      fingerprintFields,
    };
  }

  const external = new Set(
    (props.externalAssetPaths ?? []).map((entry) => entry.toLowerCase()),
  );
  const externalCollision = [...external].find(
    (entry) =>
      entry === DERIVED_ROOT.slice(0, -1) || entry.startsWith(DERIVED_ROOT),
  );
  if (externalCollision !== undefined)
    problems.push(
      problem(
        "derived-artifact-external-collision",
        "derived-artifact-manifest",
        externalCollision,
        `Derived namespace "${DERIVED_ROOT}" is also claimed by the external asset ledger. Remove external registration "${externalCollision}"; deterministic project derivation has a separate owner.`,
      ),
    );
  const artifacts: Record<string, IAutoMovieDerivedArtifactSource> = {};
  for (const record of parsed.manifest.artifacts) {
    const problemStart = problems.length;
    const target = `derived-artifact:${record.path}`;
    const generator = readInspectionFile({
      root,
      relative: record.generator.path,
      missingCode: "derived-artifact-basis-missing",
      target,
    });
    fingerprintFields.push(
      fingerprintField(
        `${record.path}:generator`,
        record.generator.path,
        generator.problem === null ? "typescript" : "absent-or-unsafe",
        generator.bytes === null
          ? null
          : normalizeAutoMovieSource(generator.bytes),
      ),
    );
    if (generator.problem !== null) problems.push(generator.problem);
    const inputs = record.inputs.map((input) => {
      const read = readInspectionFile({
        root,
        relative: input.path,
        missingCode: "derived-artifact-basis-missing",
        target,
      });
      fingerprintFields.push(
        fingerprintField(
          `${record.path}:input`,
          input.path,
          read.problem === null ? "file" : "absent-or-unsafe",
          read.bytes,
        ),
      );
      if (read.problem !== null) problems.push(read.problem);
      return { declared: input, read };
    });
    const output = readInspectionFile({
      root,
      relative: record.path,
      missingCode: "derived-artifact-output-missing",
      target,
    });
    fingerprintFields.push(
      fingerprintField(
        `${record.path}:output`,
        record.path,
        output.problem === null ? "file" : "absent-or-unsafe",
        output.bytes,
      ),
    );
    if (output.problem !== null) problems.push(output.problem);
    if (
      generator.bytes !== null &&
      inputs.every((input) => input.read.bytes !== null)
    ) {
      const liveGenerator: IAutoMovieDerivedArtifactDependency = {
        path: record.generator.path,
        digest: digestAutoMovieBytes(normalizeAutoMovieSource(generator.bytes)),
      };
      const liveInputs = inputs.map(
        (input): IAutoMovieDerivedArtifactDependency => ({
          path: input.declared.path,
          digest: digestAutoMovieBytes(input.read.bytes!),
        }),
      );
      if (
        liveGenerator.digest !== record.generator.digest ||
        JSON.stringify(liveInputs) !== JSON.stringify(record.inputs) ||
        basisDigest(liveGenerator, liveInputs) !== record.basisDigest
      )
        problems.push(
          problem(
            "derived-artifact-basis-stale",
            target,
            record.generator.path,
            `Generator or declared input bytes no longer match basis ${record.basisDigest}. Run the explicit generation command before compiling.`,
          ),
        );
    }
    if (
      output.bytes !== null &&
      digestAutoMovieBytes(output.bytes) !== record.outputDigest
    )
      problems.push(
        problem(
          "derived-artifact-output-stale",
          target,
          record.path,
          `Resident output bytes do not match ${record.outputDigest}. Run the explicit generation command; do not edit derived bytes.`,
        ),
      );
    let source: IAutoMovieDerivedArtifactSource | null = null;
    if (output.bytes !== null)
      try {
        source = sourceArtifact(record, output.bytes);
      } catch (error) {
        problems.push(
          problem(
            "derived-artifact-output-malformed",
            target,
            record.path,
            `${errorMessage(error)} Regenerate bytes matching the declared encoding.`,
          ),
        );
      }
    if (
      problems.length === problemStart &&
      externalCollision === undefined &&
      source !== null
    )
      Object.defineProperty(artifacts, record.path, {
        enumerable: true,
        value: source,
      });
  }
  return { manifest: parsed.manifest, artifacts, problems, fingerprintFields };
};

const invokeGenerator = (
  generate: IGenerateAutoMovieDerivedArtifactProps["generate"],
  inputs: Readonly<Record<string, Uint8Array>>,
): Uint8Array => {
  const copied = Object.create(null) as Record<string, Uint8Array>;
  for (const [input, bytes] of Object.entries(inputs))
    Object.defineProperty(copied, input, {
      enumerable: true,
      value: new Uint8Array(bytes),
    });
  let output: unknown;
  try {
    output = generate(Object.freeze(copied));
  } catch (error) {
    throw new AutoMovieDerivedArtifactGenerationError(
      "generator-failed",
      `Derived artifact generator failed: ${errorMessage(error)}`,
      { cause: error },
    );
  }
  if (output instanceof Uint8Array === false)
    throw new AutoMovieDerivedArtifactGenerationError(
      "output-malformed",
      "Derived artifact generator must return one synchronous Uint8Array.",
    );
  return new Uint8Array(output);
};

const readGenerationManifest = (
  root: string,
): IAutoMovieDerivedArtifactManifest => {
  const file = resolveCanonical(root, AUTOMOVIE_DERIVED_ARTIFACT_MANIFEST_PATH);
  const linked = lstatOrNull(file);
  if (linked === null) return { version: 1, artifacts: [] };
  const bytes = readPhysicalFile(root, file);
  const parsed = parseManifest(bytes);
  if (parsed.manifest === null)
    throw new AutoMovieDerivedArtifactGenerationError(
      "manifest-malformed",
      parsed.reason,
    );
  const manifest = parsed.manifest;
  const invariant = manifestInvariantFailure(manifest);
  if (invariant !== null)
    generationFailure(
      invariant.pathUnsafe ? "path-unsafe" : "manifest-malformed",
      invariant.message,
    );
  return manifest;
};

const readGenerationFile = (
  root: string,
  relative: string,
  generator: boolean,
): Uint8Array => {
  const file = resolveCanonical(root, relative);
  if (lstatOrNull(file) === null)
    generationFailure(
      "input-missing",
      `${generator ? "Generator" : "Declared input"} "${relative}" is missing.`,
    );
  try {
    return readPhysicalFile(root, file);
  } catch (error) {
    return generationFailure(
      "path-unsafe",
      `${generator ? "Generator" : "Declared input"} "${relative}" is unsafe: ${errorMessage(error)}`,
    );
  }
};

const readInspectionFile = (props: {
  root: string;
  relative: string;
  missingCode:
    | "derived-artifact-basis-missing"
    | "derived-artifact-manifest-missing"
    | "derived-artifact-output-missing";
  target: string;
}): IProjectFileRead => {
  try {
    const file = resolveCanonical(props.root, props.relative);
    if (lstatOrNull(file) === null)
      return {
        bytes: null,
        problem: problem(
          props.missingCode,
          props.target,
          props.relative,
          `Required derived-artifact file "${props.relative}" is missing. Run the explicit generation command before compiling.`,
        ),
      };
    return { bytes: readPhysicalFile(props.root, file), problem: null };
  } catch (error) {
    return {
      bytes: null,
      problem: problem(
        "derived-artifact-path-unsafe",
        props.target,
        props.relative,
        `${errorMessage(error)} Replace symlinks or escaped paths with physical project files, then regenerate.`,
      ),
    };
  }
};

const parseManifest = (
  bytes: Uint8Array,
): { manifest: IAutoMovieDerivedArtifactManifest | null; reason: string } => {
  let value: unknown;
  try {
    value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch (error) {
    return {
      manifest: null,
      reason: `Derived artifact manifest is not valid UTF-8 JSON: ${errorMessage(error)}.`,
    };
  }
  const shapeFailure = manifestShapeFailure(value);
  if (shapeFailure !== null)
    return {
      manifest: null,
      reason: `Derived artifact manifest does not match version 1: ${shapeFailure}.`,
    };
  return {
    manifest: value as unknown as IAutoMovieDerivedArtifactManifest,
    reason: "",
  };
};

const manifestShapeFailure = (value: unknown): string | null => {
  if (isPlainRecord(value) === false) return "the root must be an object";
  if (hasExactKeys(value, ["artifacts", "version"]) === false)
    return "the root must contain only version and artifacts";
  if (value.version !== 1) return "version must equal 1";
  if (Array.isArray(value.artifacts) === false)
    return "artifacts must be an array";
  for (const artifact of value.artifacts) {
    if (isPlainRecord(artifact) === false)
      return "each artifact must be an object";
    if (
      hasExactKeys(artifact, [
        "basisDigest",
        "encoding",
        "generator",
        "inputs",
        "outputDigest",
        "path",
      ]) === false
    )
      return "each artifact must contain only the version-one record fields";
    if (typeof artifact.path !== "string")
      return "artifact path must be a string";
    if (artifact.encoding !== "utf8" && artifact.encoding !== "base64")
      return "artifact encoding must be utf8 or base64";
    const generatorFailure = dependencyShapeFailure(artifact.generator);
    if (generatorFailure !== null)
      return `artifact generator ${generatorFailure}`;
    if (Array.isArray(artifact.inputs) === false)
      return "artifact inputs must be an array";
    for (const input of artifact.inputs) {
      const inputFailure = dependencyShapeFailure(input);
      if (inputFailure !== null) return `artifact input ${inputFailure}`;
    }
    if (typeof artifact.basisDigest !== "string")
      return "artifact basisDigest must be a string";
    if (typeof artifact.outputDigest !== "string")
      return "artifact outputDigest must be a string";
  }
  return null;
};

const dependencyShapeFailure = (value: unknown): string | null => {
  if (isPlainRecord(value) === false) return "must be an object";
  if (hasExactKeys(value, ["digest", "path"]) === false)
    return "must contain only path and digest";
  if (typeof value.path !== "string") return "path must be a string";
  if (typeof value.digest !== "string") return "digest must be a string";
  return null;
};

const isPlainRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && Array.isArray(value) === false;

const hasExactKeys = (
  value: Record<string, unknown>,
  expected: readonly string[],
): boolean => {
  const keys = Object.keys(value).sort(compareCodeUnits);
  return (
    keys.length === expected.length &&
    keys.every((key, index) => key === expected[index])
  );
};

const manifestInvariantFailure = (
  manifest: IAutoMovieDerivedArtifactManifest,
): {
  message: string;
  path: string;
  pathUnsafe: boolean;
  target: string;
} | null => {
  const outputs = new Set<string>();
  let previous: string | null = null;
  for (const record of manifest.artifacts) {
    const target = `derived-artifact:${record.path}`;
    const unsafe = firstUnsafePath([
      { label: "output", path: record.path },
      { label: "generator", path: record.generator.path },
      ...record.inputs.map((input) => ({ label: "input", path: input.path })),
    ]);
    if (unsafe !== null)
      return {
        message: `${unsafe.label} path "${unsafe.path}" is not one canonical cross-platform project path.`,
        path: unsafe.path,
        pathUnsafe: true,
        target,
      };
    if (record.path.startsWith(DERIVED_ROOT) === false)
      return {
        message: `Output "${record.path}" must live below "${DERIVED_ROOT}".`,
        path: record.path,
        pathUnsafe: true,
        target,
      };
    const foldedOutput = record.path.toLowerCase();
    if (
      outputs.has(foldedOutput) ||
      (previous !== null && compareCodeUnits(previous, record.path) >= 0)
    )
      return {
        message: `Artifact outputs must be unique and sorted by code unit; "${record.path}" is repeated or out of order.`,
        path: record.path,
        pathUnsafe: false,
        target,
      };
    outputs.add(foldedOutput);
    previous = record.path;
    let previousInput: string | null = null;
    const inputSpellings = new Set<string>();
    for (const input of record.inputs) {
      const folded = input.path.toLowerCase();
      if (
        inputSpellings.has(folded) ||
        (previousInput !== null &&
          compareCodeUnits(previousInput, input.path) >= 0)
      )
        return {
          message: `Inputs of "${record.path}" must be unique and sorted by code unit; "${input.path}" is repeated or out of order.`,
          path: input.path,
          pathUnsafe: false,
          target,
        };
      inputSpellings.add(folded);
      previousInput = input.path;
    }
    const occupied = new Set([
      record.path.toLowerCase(),
      record.generator.path.toLowerCase(),
      AUTOMOVIE_DERIVED_ARTIFACT_MANIFEST_PATH.toLowerCase(),
    ]);
    const cyclic = record.inputs.find((input) => {
      const folded = input.path.toLowerCase();
      if (occupied.has(folded)) return true;
      occupied.add(folded);
      return false;
    });
    if (cyclic !== undefined)
      return {
        message: `Input "${cyclic.path}" collides with the generator, output, manifest, or another input.`,
        path: cyclic.path,
        pathUnsafe: false,
        target,
      };
    if (
      SHA256.test(record.generator.digest) === false ||
      record.inputs.some((input) => SHA256.test(input.digest) === false) ||
      SHA256.test(record.basisDigest) === false ||
      SHA256.test(record.outputDigest) === false ||
      basisDigest(record.generator, record.inputs) !== record.basisDigest
    )
      return {
        message: `Artifact "${record.path}" has an invalid or self-inconsistent digest record.`,
        path: record.path,
        pathUnsafe: false,
        target,
      };
  }
  return null;
};

const sourceArtifact = (
  record: IAutoMovieDerivedArtifactRecord,
  bytes: Uint8Array,
): IAutoMovieDerivedArtifactSource => ({
  digest: record.outputDigest,
  encoding: record.encoding,
  content:
    record.encoding === "utf8"
      ? new TextDecoder("utf-8", { fatal: true }).decode(bytes)
      : Buffer.from(bytes).toString("base64"),
});

const assertEncoding = (
  bytes: Uint8Array,
  encoding: AutoMovieDerivedArtifactEncoding,
  code: AutoMovieDerivedArtifactGenerationErrorCode,
): void => {
  if (encoding === "base64") return;
  try {
    new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch (error) {
    throw new AutoMovieDerivedArtifactGenerationError(
      code,
      `UTF-8 derived output is malformed: ${errorMessage(error)}`,
      { cause: error },
    );
  }
};

const basisDigest = (
  generator: IAutoMovieDerivedArtifactDependency,
  inputs: readonly IAutoMovieDerivedArtifactDependency[],
): AutoMovieContentDigest =>
  fingerprintAutoMovieFields([
    {
      role: "protocol",
      kind: "derived-artifact-basis",
      payload: Buffer.from(AUTOMOVIE_DERIVED_ARTIFACT_BASIS_PROTOCOL),
    },
    {
      role: `generator:${generator.path}`,
      kind: "normalized-typescript-digest",
      payload: Buffer.from(generator.digest),
    },
    ...inputs.map((input) => ({
      role: `input:${input.path}`,
      kind: "byte-digest",
      payload: Buffer.from(input.digest),
    })),
  ]);

const canonicalInputPaths = (inputs: readonly string[]): string[] => {
  const output = [...inputs].sort(compareCodeUnits);
  const spellings = new Set<string>();
  for (const input of output) {
    assertGenerationPath(input, "input");
    const folded = input.toLowerCase();
    if (spellings.has(folded))
      generationFailure(
        "path-unsafe",
        `Derived inputs repeat portable path "${input}". Keep each input once with one case spelling.`,
      );
    spellings.add(folded);
  }
  return output;
};

const assertGenerationPath = (value: string, role: string): void => {
  if (isCanonicalProjectPath(value) === false)
    generationFailure(
      "path-unsafe",
      `Derived ${role} path "${value}" is not one canonical cross-platform project path.`,
    );
};

const firstUnsafePath = (
  values: readonly { label: string; path: string }[],
): { label: string; path: string } | null =>
  values.find((entry) => isCanonicalProjectPath(entry.path) === false) ?? null;

const isCanonicalProjectPath = (value: string): boolean =>
  value.length !== 0 &&
  value.includes("\0") === false &&
  value.includes("\\") === false &&
  WINDOWS_DRIVE.test(value) === false &&
  path.posix.isAbsolute(value) === false &&
  value !== "." &&
  path.posix.normalize(value) === value &&
  value
    .split("/")
    .every(
      (segment) =>
        segment.length !== 0 &&
        segment !== "." &&
        segment !== ".." &&
        segment.includes(":") === false &&
        segment.endsWith(".") === false &&
        segment.endsWith(" ") === false &&
        WINDOWS_DEVICE.test(segment) === false,
    );

const physicalProjectRoot = (
  root: string,
  code: AutoMovieDerivedArtifactGenerationErrorCode,
): string => {
  const resolved = path.resolve(root);
  const linked = lstatOrNull(resolved);
  if (
    linked === null ||
    linked.isSymbolicLink() ||
    linked.isDirectory() === false
  )
    throw new AutoMovieDerivedArtifactGenerationError(
      code,
      `Derived artifact root "${root}" must be one existing physical directory.`,
    );
  const real = fileSystem.realpathSync(resolved);
  if (path.relative(real, resolved) !== "")
    throw new AutoMovieDerivedArtifactGenerationError(
      code,
      `Derived artifact root "${root}" resolves through a symlink or junction.`,
    );
  return real;
};

const resolveCanonical = (root: string, relative: string): string => {
  if (isCanonicalProjectPath(relative) === false)
    throw new Error(
      `Path "${relative}" is not canonical and project-relative.`,
    );
  const resolved = path.resolve(root, ...relative.split("/"));
  if (isInside(root, resolved) === false)
    throw new Error(`Path "${relative}" escapes project root "${root}".`);
  return resolved;
};

const readPhysicalFile = (root: string, file: string): Uint8Array => {
  assertPhysicalDirectory(root, path.dirname(file));
  const linked = fileSystem.lstatSync(file);
  if (linked.isSymbolicLink() || linked.isFile() === false)
    throw new Error(`Owned file "${file}" is not a physical regular file.`);
  const real = fileSystem.realpathSync(file);
  if (isInside(root, real) === false)
    throw new Error(`Owned file "${file}" escapes the physical project root.`);
  return fileSystem.readFileSync(real);
};

const sameResidentBytes = (
  root: string,
  file: string,
  bytes: Uint8Array,
): boolean => {
  const linked = lstatOrNull(file);
  if (linked === null) return false;
  return Buffer.from(readPhysicalFile(root, file)).equals(Buffer.from(bytes));
};

const writePhysicalFileAtomic = (
  root: string,
  file: string,
  bytes: Uint8Array,
): void => {
  ensurePhysicalDirectory(root, path.dirname(file));
  assertPhysicalLeaf(root, file);
  const rootIdentity = directoryIdentity(root);
  const ancestry = directoryAncestry(root, path.dirname(file));
  const temporary = path.join(
    path.dirname(file),
    `.automovie-derived-${process.pid}-${randomUUID()}.tmp`,
  );
  let published = false;
  try {
    const descriptor = fileSystem.openSync(temporary, "wx");
    try {
      fileSystem.writeFileSync(descriptor, bytes);
      fileSystem.fsyncSync(descriptor);
    } finally {
      fileSystem.closeSync(descriptor);
    }
    if (directoryIdentity(root) !== rootIdentity)
      throw new Error(
        "Physical project root changed during atomic publication.",
      );
    assertDirectoryAncestry(ancestry);
    assertPhysicalLeaf(root, file);
    fileSystem.renameSync(temporary, file);
    published = true;
    assertDirectoryAncestry(ancestry);
    assertPhysicalLeaf(root, file);
  } finally {
    if (published === false) fileSystem.rmSync(temporary, { force: true });
  }
};

const ensurePhysicalDirectory = (root: string, directory: string): void => {
  const relative = path.relative(root, path.resolve(directory));
  if (
    relative === ".." ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative)
  )
    throw new Error(`Owned directory "${directory}" escapes project root.`);
  let current = root;
  for (const segment of relative.split(path.sep)) {
    current = path.join(current, segment);
    const linked = lstatOrNull(current);
    if (linked === null) fileSystem.mkdirSync(current);
    const resident = fileSystem.lstatSync(current);
    if (resident.isSymbolicLink() || resident.isDirectory() === false)
      throw new Error(
        `Owned directory "${current}" is not a physical directory.`,
      );
    if (isInside(root, fileSystem.realpathSync(current)) === false)
      throw new Error(`Owned directory "${current}" escapes project root.`);
  }
};

const assertPhysicalDirectory = (root: string, directory: string): void => {
  const relative = path.relative(root, path.resolve(directory));
  if (
    relative === ".." ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative)
  )
    throw new Error(`Owned directory "${directory}" escapes project root.`);
  let current = root;
  for (const segment of relative.split(path.sep)) {
    current = path.join(current, segment);
    const linked = lstatOrNull(current);
    if (linked === null) {
      throw new Error(`Owned directory "${current}" is missing.`);
    }
    if (linked.isSymbolicLink() || linked.isDirectory() === false)
      throw new Error(
        `Owned directory "${current}" is not a physical directory.`,
      );
    if (isInside(root, fileSystem.realpathSync(current)) === false)
      throw new Error(`Owned directory "${current}" escapes project root.`);
  }
};

const assertPhysicalLeaf = (root: string, file: string): void => {
  assertPhysicalDirectory(root, path.dirname(file));
  const linked = lstatOrNull(file);
  if (linked === null) return;
  if (linked.isSymbolicLink() || linked.isFile() === false)
    throw new Error(`Owned output "${file}" is not a physical regular file.`);
  if (isInside(root, fileSystem.realpathSync(file)) === false)
    throw new Error(`Owned output "${file}" escapes project root.`);
};

const directoryAncestry = (
  root: string,
  directory: string,
): Array<{ path: string; identity: string }> => {
  const relative = path.relative(root, directory);
  const directories = [root];
  let current = root;
  for (const segment of relative.split(path.sep)) {
    current = path.join(current, segment);
    directories.push(current);
  }
  return directories.map((entry) => ({
    path: entry,
    identity: directoryIdentity(entry),
  }));
};

const assertDirectoryAncestry = (
  ancestry: readonly { path: string; identity: string }[],
): void => {
  const changed = ancestry.find(
    (entry) => directoryIdentity(entry.path) !== entry.identity,
  );
  if (changed !== undefined)
    throw new Error(
      `Owned directory "${changed.path}" changed physical identity during publication.`,
    );
};

const directoryIdentity = (directory: string): string => {
  const linked = fileSystem.lstatSync(directory);
  if (linked.isSymbolicLink() || linked.isDirectory() === false)
    throw new Error(`Owned directory "${directory}" is not physical.`);
  const status = fileSystem.statSync(directory, { bigint: true });
  return `${status.dev}\0${status.ino}`;
};

const lstatOrNull = (file: string): Stats | null => {
  try {
    return fileSystem.lstatSync(file);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
};

const isInside = (root: string, candidate: string): boolean => {
  const relative = path.relative(root, candidate);
  return (
    relative === "" ||
    (path.isAbsolute(relative) === false &&
      relative !== ".." &&
      relative.startsWith(`..${path.sep}`) === false)
  );
};

const fingerprintField = (
  role: string,
  pathValue: string,
  kind: string,
  bytes: Uint8Array | null,
): IAutoMovieFingerprintField => ({
  role: `derived-artifact:${role}:${pathValue}`,
  kind,
  payload: bytes ?? new Uint8Array(),
});

const problem = (
  code: AutoMovieDerivedArtifactProblemCode,
  target: string,
  pathValue: string | null,
  message: string,
): IAutoMovieDerivedArtifactProblem => ({
  code,
  target,
  path: pathValue,
  message,
});

const generationFailure = (
  code: AutoMovieDerivedArtifactGenerationErrorCode,
  message: string,
): never => {
  throw new AutoMovieDerivedArtifactGenerationError(code, message);
};

const errorMessage = (error: unknown): string =>
  typeof error === "object" && error !== null && "message" in error
    ? String(error.message)
    : String(error);
