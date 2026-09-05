import type {
  AutoMovieContentDigest,
  IAutoMovieDesignMutationOutput,
  IAutoMovieDesignTarget,
} from "@automovie/interface";

import {
  canonicalAutoMovieJsonBytes,
  compareCodeUnits,
  digestAutoMovieBytes,
  normalizeAutoMovieSource,
} from "./contentIdentity";
import { parseAutoMovieStructuredJson } from "./duplicateAwareJson";
import { linkProductionSource } from "./linkProductionSource";

/** Current film/brief design-derivation protocol. */
export const AUTOMOVIE_DESIGN_DERIVATION_PROTOCOL =
  "automovie.design-derivation.v1" as const;

/**
 * One project-relative input in a design producer closure.
 *
 * @author Samchon
 */
export interface IAutoMovieDesignDerivationDependency {
  /** Canonical project-relative POSIX input path. */
  path: string;
  /** SHA-256 identity of the exact input bytes. */
  digest: AutoMovieContentDigest;
}

/**
 * Exact producer closure of one emitted design record.
 *
 * @author Samchon
 */
export interface IAutoMovieDesignDerivationBasis {
  /** Derivation protocol that gives this identity its meaning. */
  protocol: typeof AUTOMOVIE_DESIGN_DERIVATION_PROTOCOL;
  /** Production that owns the derived target. */
  production: string;
  /** Stable logical target identity. */
  target: string;
  /** Canonical path where the derived record is published. */
  recordPath: string;
  /** Command emitter participating in the producer closure. */
  emitter: IAutoMovieDesignDerivationDependency;
  /** Selected source module export and optional member selector. */
  source: {
    /** Canonical project-relative POSIX module path. */
    path: string;
    /** Named top-level module export. */
    export: string;
    /** Optional member inside the named export. */
    selector: string | null;
  };
  /** Target-local transitive source inputs. */
  dependencies: readonly IAutoMovieDesignDerivationDependency[];
  /** Toolchain versions participating in derivation. */
  tool: {
    /** Production package version. */
    production: string;
    /** TypeScript compiler version. */
    typescript: string;
    /** Node.js runtime version. */
    node: string;
  };
}

/**
 * Manifest entry connecting one resident design record to its producer basis.
 *
 * @author Samchon
 */
export interface IAutoMovieDesignDerivationRecord {
  /** Stable logical target identity. */
  target: string;
  /** Canonical path of the derived output. */
  recordPath: string;
  /** Complete producer basis recorded with the output. */
  basis: IAutoMovieDesignDerivationBasis;
  /** Canonical digest of `basis`. */
  basisDigest: AutoMovieContentDigest;
  /** SHA-256 digest of the canonical output bytes. */
  outputDigest: AutoMovieContentDigest;
}

/**
 * Complete target inventory published by one design generation transaction.
 *
 * @author Samchon
 */
export interface IAutoMovieDesignDerivationManifest {
  /** Manifest schema version. */
  version: 1;
  /** Derivation protocol that gives the records their meaning. */
  protocol: typeof AUTOMOVIE_DESIGN_DERIVATION_PROTOCOL;
  /** Complete canonical target inventory. */
  records: readonly IAutoMovieDesignDerivationRecord[];
}

/**
 * Stable design derivation refusal categories.
 *
 * @author Samchon
 */
export type AutoMovieDesignDerivationFailureCode =
  | "design-derivation-basis-changed"
  | "design-derivation-manifest-malformed"
  | "design-derivation-nondeterministic"
  | "design-derivation-orphan-record"
  | "design-derivation-output-malformed"
  | "design-derivation-output-stale"
  | "design-derivation-publication-failed"
  | "design-derivation-stale";

/**
 * One currentness problem on a resident design record or manifest.
 *
 * @author Samchon
 */
export interface IAutoMovieDesignDerivationProblem {
  /** Stable machine-readable refusal category. */
  code: AutoMovieDesignDerivationFailureCode;
  /** Logical target affected by the problem. */
  target: string;
  /** Affected project-relative path, when one exists. */
  path: string | null;
  /** Actionable refusal explanation. */
  message: string;
}

/**
 * Typed refusal raised before any design candidate may be published.
 *
 * @author Samchon
 */
export class AutoMovieDesignDerivationError extends Error {
  public constructor(
    /** Stable machine-readable refusal category. */
    public readonly code: AutoMovieDesignDerivationFailureCode,
    message: string,
  ) {
    super(message);
    this.name = "AutoMovieDesignDerivationError";
  }
}

/**
 * Canonical identity of one target-local producer closure.
 *
 * @evidence requirements/agent-authoring/deterministic-precomputation.md#agent-precomputed-closed-basis Reduces one closed generation basis to a single comparable digest.
 * @evidence specifications/authoring-and-authority/prototype-determinism-and-fidelity.md#spec-authoring-deterministic-input-identity Domain-separates and canonically orders every basis field before hashing.
 */
export const autoMovieDesignDerivationBasisDigest = (
  basis: IAutoMovieDesignDerivationBasis,
): AutoMovieContentDigest =>
  digestAutoMovieBytes(canonicalAutoMovieJsonBytes(canonicalBasis(basis)));

/**
 * Stable comparable identity of one project-owned design record.
 *
 * The production and world records are singletons, so their kind is their
 * whole address; every other record is addressed by kind and id. The emitter,
 * the derivation manifest and the compiler's inspection all name a target
 * through this one spelling, so a record can never be derived under one
 * address and inspected under another.
 *
 * @evidence requirements/evidence-and-provenance/generation-transformation-and-derivation.md#provenance-generated-output-record Gives every recorded design output one stable target identity.
 * @evidence specifications/authoring-and-authority/source-authority-and-derivation.md#spec-authoring-derivation-output-lineage Addresses each derived record identically in the manifest and in the resident design tree.
 */
export const autoMovieDesignTargetAddress = (
  target: IAutoMovieDesignTarget,
): string =>
  target.kind === "production" || target.kind === "world"
    ? target.kind
    : `${target.kind} "${target.id}"`;

/**
 * Acquire one target-local producer basis from the source graph it executes.
 *
 * Relative runtime imports are followed through the production linker, while
 * type-only imports remain outside the runtime closure. Every included module
 * is normalized before hashing so the basis has the same source-byte semantics
 * as production compilation.
 *
 * @evidence requirements/agent-authoring/deterministic-precomputation.md#agent-precomputed-closed-basis Captures the exact emitter, export, transitive runtime source and tool identity that produce one record.
 * @evidence specifications/authoring-and-authority/source-authority-and-derivation.md#spec-authoring-source-change-impact-invariant Follows the runtime import closure so a shared helper revision reaches only the targets that import it.
 */
export const captureAutoMovieDesignDerivationBasis = (props: {
  production: string;
  target: string;
  recordPath: string;
  emitter: { path: string; bytes: Uint8Array };
  source: {
    path: string;
    export: string;
    selector: string | null;
  };
  readSource: (path: string) => Uint8Array;
  tool: IAutoMovieDesignDerivationBasis["tool"];
}): IAutoMovieDesignDerivationBasis => {
  assertRelativePath(props.emitter.path);
  assertRelativePath(props.source.path);
  const entryBytes = normalizeAutoMovieSource(
    props.readSource(props.source.path),
  );
  const textOf = (bytes: Uint8Array): string =>
    Buffer.from(bytes).toString("utf8");
  const linked = linkProductionSource({
    entryPath: props.source.path,
    entrySource: textOf(entryBytes),
    read: (sourcePath) =>
      textOf(normalizeAutoMovieSource(props.readSource(sourcePath))),
  });
  if (linked.failures.length !== 0)
    throw new AutoMovieDesignDerivationError(
      "design-derivation-basis-changed",
      `Design target "${props.target}" has an unreadable runtime source closure: ${linked.failures
        .map((failure) => `${failure.path}: ${failure.reason}`)
        .join(" ")}`,
    );
  const dependencies = linked.modules.map((module) => ({
    path: module.path,
    digest: digestAutoMovieBytes(Buffer.from(module.source, "utf8")),
  }));
  return canonicalBasis({
    protocol: AUTOMOVIE_DESIGN_DERIVATION_PROTOCOL,
    production: props.production,
    target: props.target,
    recordPath: props.recordPath,
    emitter: {
      path: props.emitter.path,
      digest: digestAutoMovieBytes(
        normalizeAutoMovieSource(props.emitter.bytes),
      ),
    },
    source: { ...props.source },
    dependencies,
    tool: { ...props.tool },
  });
};

/**
 * Evaluate one frozen design plan twice and return a staged complete candidate.
 *
 * Publication is deliberately outside this pure owner. A caller publishes the
 * returned records and manifest in one project transaction only after the
 * supplied live-basis reacquisition still matches every frozen basis.
 *
 * @evidence requirements/agent-authoring/deterministic-precomputation.md#agent-precomputed-closed-basis Records the exact emitter, export, transitive source and tool identity behind each design target.
 * @evidence requirements/agent-authoring/deterministic-precomputation.md#agent-precomputed-compile-refusal Refuses a changed or same-basis-divergent design candidate before publication.
 * @evidence specifications/authoring-and-authority/prototype-determinism-and-fidelity.md#spec-authoring-deterministic-input-identity Compares exact canonical target bytes under one frozen producer identity.
 * @evidence specifications/authoring-and-authority/source-authority-and-derivation.md#spec-authoring-source-change-impact-invariant Preserves target-local dependency closure so unrelated source revisions do not stale every design record.
 * @author Samchon
 */
export const createAutoMovieDesignDerivationCandidate = (props: {
  bases: readonly IAutoMovieDesignDerivationBasis[];
  evaluate: (bases: readonly IAutoMovieDesignDerivationBasis[]) => readonly {
    target: string;
    recordPath: string;
    bytes: Uint8Array;
  }[];
  currentBases: () => readonly IAutoMovieDesignDerivationBasis[];
}): {
  manifest: IAutoMovieDesignDerivationManifest;
  outputs: ReadonlyMap<string, Uint8Array>;
} => {
  const bases = canonicalBases(props.bases);
  const first = canonicalOutputs(props.evaluate(structuredClone(bases)));
  const second = canonicalOutputs(props.evaluate(structuredClone(bases)));
  const mismatch = outputMismatch(first, second);
  if (mismatch !== null)
    throw new AutoMovieDesignDerivationError(
      "design-derivation-nondeterministic",
      `Design target ${mismatch} produced different canonical bytes from the same frozen basis. No design record was published.`,
    );
  let live: readonly IAutoMovieDesignDerivationBasis[];
  try {
    live = canonicalBases(props.currentBases());
  } catch (error) {
    throw new AutoMovieDesignDerivationError(
      "design-derivation-basis-changed",
      `The live design producer closure became invalid during generation (${errorMessage(error)}). Run the explicit design command again.`,
    );
  }
  if (
    Buffer.from(canonicalAutoMovieJsonBytes(bases)).equals(
      Buffer.from(canonicalAutoMovieJsonBytes(live)),
    ) === false
  )
    throw new AutoMovieDesignDerivationError(
      "design-derivation-basis-changed",
      "Design emitter, target mapping, transitive source, or tool identity changed during generation. Run the explicit design command again.",
    );
  if (bases.length !== first.length)
    throw new AutoMovieDesignDerivationError(
      "design-derivation-nondeterministic",
      "The evaluated design target set does not match the declared producer-basis target set. No design record was published.",
    );
  const basisByTarget = new Map(bases.map((basis) => [basis.target, basis]));
  const records = first.map((output): IAutoMovieDesignDerivationRecord => {
    const basis = basisByTarget.get(output.target);
    if (basis === undefined || basis.recordPath !== output.recordPath)
      throw new AutoMovieDesignDerivationError(
        "design-derivation-nondeterministic",
        `Design target "${output.target}" has no exact declared record-path mapping. No design record was published.`,
      );
    return {
      target: output.target,
      recordPath: output.recordPath,
      basis,
      basisDigest: autoMovieDesignDerivationBasisDigest(basis),
      outputDigest: digestAutoMovieBytes(output.bytes),
    };
  });
  return {
    manifest: {
      version: 1,
      protocol: AUTOMOVIE_DESIGN_DERIVATION_PROTOCOL,
      records,
    },
    outputs: new Map(first.map((output) => [output.recordPath, output.bytes])),
  };
};

/**
 * One record a production-owned emitter declares it derives.
 *
 * @author Samchon
 */
export interface IAutoMovieDesignProducerEntry {
  /** Stable logical target identity, spelled by `autoMovieDesignTargetAddress`. */
  target: string;
  /** Canonical project-relative path the project store publishes the record at. */
  recordPath: string;
  /** Exact source module export, and member selector, the record comes from. */
  source: IAutoMovieDesignDerivationBasis["source"];
  /** Evaluate the design value from frozen typed inputs, without host access. */
  evaluate: () => unknown;
  /** Store one accepted canonical value through the project's typed setter. */
  store: (value: unknown) => IAutoMovieDesignMutationOutput;
}

/**
 * What one design generation run did to one declared target.
 *
 * @author Samchon
 */
export interface IAutoMovieDesignDerivationOutcome {
  /** Stable logical target identity. */
  target: string;
  /** Canonical project-relative path of the published record. */
  recordPath: string;
  /** Whether the resident record was created, replaced, or already current. */
  state: "created" | "unchanged" | "updated";
}

/**
 * Result of one complete design generation run.
 *
 * @author Samchon
 */
export interface IAutoMovieDesignDerivationRun {
  /** Complete derivation manifest for the published target inventory. */
  manifest: IAutoMovieDesignDerivationManifest;
  /** Per-target publication outcome, in the declared plan order. */
  outcomes: readonly IAutoMovieDesignDerivationOutcome[];
}

/**
 * Run one production-owned design generation from a typed producer plan.
 *
 * The plan is frozen into one basis per target, evaluated twice against that
 * frozen basis, and compared against the live producer closure before any
 * store call. A resident record no entry derives is refused as an orphan for
 * the same reason a stale record is refused: nothing current owns it. Only a
 * complete, deterministic, current candidate reaches the project's typed
 * setters, and those run in the declared plan order so a record measured
 * against another one is stored after the record it depends on.
 *
 * @evidence requirements/agent-authoring/deterministic-precomputation.md#agent-precomputed-explicit-generation Regenerates design records only through this explicit run and never as a side effect of compilation.
 * @evidence requirements/evidence-and-provenance/generation-transformation-and-derivation.md#provenance-nondeterministic-generation Refuses a producer whose two evaluations of one frozen basis disagree instead of sealing one of them as current.
 * @evidence specifications/authoring-and-authority/source-authority-and-derivation.md#spec-authoring-source-derivation-state Publishes each derived record together with the exact source revision it was evaluated from.
 * @evidence specifications/authoring-and-authority/prototype-determinism-and-fidelity.md#spec-authoring-deterministic-input-identity Holds emitter, mapping, transitive source and tool identity fixed across both evaluations of one run.
 * @author Samchon
 */
export const runAutoMovieDesignDerivation = (props: {
  /** Production that owns every declared target. */
  production: string;
  /** Project-relative path and exact bytes of the running emitter. */
  emitter: { path: string; bytes: Uint8Array };
  /** Toolchain identity the run executes under. */
  tool: IAutoMovieDesignDerivationBasis["tool"];
  /** Owned project source reader used for every transitive module. */
  readSource: (path: string) => Uint8Array;
  /** Every design record resident before the run, with its stored value. */
  resident: readonly { target: string; recordPath: string; value: unknown }[];
  /** The complete declared producer plan, in publication order. */
  entries: readonly IAutoMovieDesignProducerEntry[];
}): IAutoMovieDesignDerivationRun => {
  const captureBases = (): IAutoMovieDesignDerivationBasis[] =>
    props.entries.map((entry) =>
      captureAutoMovieDesignDerivationBasis({
        production: props.production,
        target: entry.target,
        recordPath: entry.recordPath,
        emitter: props.emitter,
        source: entry.source,
        readSource: props.readSource,
        tool: props.tool,
      }),
    );
  const candidate = createAutoMovieDesignDerivationCandidate({
    bases: captureBases(),
    evaluate: () =>
      props.entries.map((entry) => ({
        target: entry.target,
        recordPath: entry.recordPath,
        bytes: canonicalDesignBytes(entry.target, entry.evaluate()),
      })),
    currentBases: captureBases,
  });
  const derived = new Set(props.entries.map((entry) => entry.target));
  const orphans = props.resident
    .filter((record) => derived.has(record.target) === false)
    .map((record) => `  ${record.recordPath}  (${record.target})`)
    .sort(compareCodeUnits);
  if (orphans.length !== 0)
    throw new AutoMovieDesignDerivationError(
      "design-derivation-orphan-record",
      [
        `${orphans.length} resident design record(s) are derived by no producer entry:`,
        ...orphans,
        "",
        "Derive each record from its current owner or delete the named file. No design record was published.",
      ].join("\n"),
    );
  const residentByTarget = new Map(
    props.resident.map((record) => [record.target, record]),
  );
  const outcomes = props.entries.map(
    (entry): IAutoMovieDesignDerivationOutcome => {
      const bytes = Buffer.from(candidate.outputs.get(entry.recordPath)!);
      const current = residentByTarget.get(entry.target);
      if (
        current !== undefined &&
        Buffer.from(canonicalDesignBytes(entry.target, current.value)).equals(
          bytes,
        )
      )
        return {
          target: entry.target,
          recordPath: entry.recordPath,
          state: "unchanged",
        };
      const output = entry.store(
        parseAutoMovieStructuredJson({ record: "design-record", bytes }),
      );
      if (output.accepted === false)
        throw new AutoMovieDesignDerivationError(
          "design-derivation-publication-failed",
          `Design target "${entry.target}" was refused by the project store: ${output.diagnostics
            .map((diagnostic) => diagnostic.message)
            .join(" ")}`,
        );
      return {
        target: entry.target,
        recordPath: entry.recordPath,
        state: current === undefined ? "created" : "updated",
      };
    },
  );
  return { manifest: candidate.manifest, outcomes };
};

/**
 * Inspect recorded design lineage against live target-local producer closure.
 *
 * A resident record path the manifest does not own is reported as stale for
 * the same reason a missing manifest entry is: no current producer answers
 * for it, so nothing may treat its bytes as derived from current source.
 *
 * @evidence requirements/agent-authoring/deterministic-precomputation.md#agent-precomputed-compile-refusal Refuses a stale, missing, tampered, or unowned design record at compile time instead of regenerating it.
 * @evidence requirements/evidence-and-provenance/generation-transformation-and-derivation.md#provenance-derivation-impact Names the exact target whose recorded producer basis no longer matches the live closure.
 * @evidence specifications/authoring-and-authority/source-authority-and-derivation.md#spec-authoring-source-change-impact-invariant Marks exactly the records whose recorded closure differs from the live one.
 * @evidence specifications/authoring-and-authority/source-authority-and-derivation.md#spec-authoring-source-ownership-failure Distinguishes a malformed manifest, a stale basis, a stale output, and an unowned resident record as separate failures.
 * @evidence specifications/authoring-and-authority/source-authority-and-derivation.md#spec-authoring-change-impact-report Names exactly the design records a source change invalidated and leaves the ones whose recorded basis still matches untouched.
 * @evidence specifications/evidence-and-provenance/completeness-freshness-and-refusal.md#evp-reapproval-after-change Marks stale exactly the derived records whose recorded basis differs from the live closure and preserves the rest with their proof relation.
 */
export const inspectAutoMovieDesignDerivation = (props: {
  manifest: IAutoMovieDesignDerivationManifest | null;
  bases: readonly IAutoMovieDesignDerivationBasis[];
  readOutput: (path: string) => Uint8Array | null;
  /** Every resident design record path, so an unowned record is reported. */
  residentRecordPaths?: readonly string[];
}): IAutoMovieDesignDerivationProblem[] => {
  if (
    props.manifest === null ||
    props.manifest.version !== 1 ||
    props.manifest.protocol !== AUTOMOVIE_DESIGN_DERIVATION_PROTOCOL
  )
    return [
      {
        code: "design-derivation-manifest-malformed",
        target: "design-derivation-manifest",
        path: null,
        message:
          "The design-derivation manifest is missing or unsupported. Run the explicit design command before compiling.",
      },
    ];
  let bases: readonly IAutoMovieDesignDerivationBasis[];
  try {
    bases = canonicalBases(props.bases);
    canonicalRecords(props.manifest.records);
  } catch (error) {
    return [
      {
        code: "design-derivation-manifest-malformed",
        target: "design-derivation-manifest",
        path: null,
        message: `${errorMessage(error)} Regenerate the canonical design-derivation manifest.`,
      },
    ];
  }
  const expected = new Map(bases.map((basis) => [basis.target, basis]));
  const problems: IAutoMovieDesignDerivationProblem[] = [];
  for (const record of canonicalRecords(props.manifest.records)) {
    const basis = expected.get(record.target);
    if (
      basis === undefined ||
      basis.recordPath !== record.recordPath ||
      record.basis.target !== record.target ||
      record.basis.recordPath !== record.recordPath ||
      autoMovieDesignDerivationBasisDigest(record.basis) !==
        record.basisDigest ||
      autoMovieDesignDerivationBasisDigest(basis) !== record.basisDigest
    ) {
      problems.push({
        code: "design-derivation-stale",
        target: record.target,
        path: record.recordPath,
        message: `Design target "${record.target}" was emitted from a different producer basis. Run the explicit design command again.`,
      });
      continue;
    }
    expected.delete(record.target);
    const bytes = props.readOutput(record.recordPath);
    if (bytes === null || digestAutoMovieBytes(bytes) !== record.outputDigest)
      problems.push({
        code: "design-derivation-output-stale",
        target: record.target,
        path: record.recordPath,
        message: `Design record "${record.recordPath}" is missing or differs from its recorded canonical output. Run the explicit design command again.`,
      });
  }
  for (const basis of [...expected.values()].sort((left, right) =>
    compareCodeUnits(left.target, right.target),
  ))
    problems.push({
      code: "design-derivation-stale",
      target: basis.target,
      path: basis.recordPath,
      message: `Design target "${basis.target}" has no current derivation record. Run the explicit design command before compiling.`,
    });
  const owned = new Set(
    props.manifest.records.map((record) => record.recordPath),
  );
  for (const recordPath of [...(props.residentRecordPaths ?? [])].sort(
    compareCodeUnits,
  ))
    if (owned.has(recordPath) === false)
      problems.push({
        code: "design-derivation-stale",
        target: recordPath,
        path: recordPath,
        message: `Design record "${recordPath}" is resident but no current producer derives it. Run the explicit design command or delete the file before compiling.`,
      });
  return problems;
};

const canonicalDesignBytes = (target: string, value: unknown): Uint8Array => {
  try {
    const bytes = canonicalAutoMovieJsonBytes(value);
    if (bytes.length === 0) throw new Error("the value is not a JSON value");
    return bytes;
  } catch (error) {
    throw new AutoMovieDesignDerivationError(
      "design-derivation-output-malformed",
      `Design target "${target}" evaluated to a value that has no canonical JSON form (${errorMessage(error)}). No design record was published.`,
    );
  }
};

const canonicalBasis = (
  basis: IAutoMovieDesignDerivationBasis,
): IAutoMovieDesignDerivationBasis => {
  if (basis.protocol !== AUTOMOVIE_DESIGN_DERIVATION_PROTOCOL)
    throw new Error(`Unsupported design basis protocol "${basis.protocol}".`);
  assertIdentity("production", basis.production);
  assertIdentity("target", basis.target);
  assertRelativePath(basis.recordPath);
  assertRelativePath(basis.emitter.path);
  assertDigest("emitter", basis.emitter.digest);
  assertRelativePath(basis.source.path);
  assertIdentity("source export", basis.source.export);
  if (basis.source.selector !== null)
    assertIdentity("source selector", basis.source.selector);
  assertIdentity("production tool version", basis.tool.production);
  assertIdentity("TypeScript tool version", basis.tool.typescript);
  assertIdentity("Node.js tool version", basis.tool.node);
  const dependencies = [...basis.dependencies]
    .map((dependency) => ({ ...dependency }))
    .sort((left, right) => compareCodeUnits(left.path, right.path));
  if (
    new Set(dependencies.map((entry) => entry.path)).size !==
    dependencies.length
  )
    throw new Error(
      `Design target "${basis.target}" repeats a dependency path.`,
    );
  for (const dependency of dependencies) {
    assertRelativePath(dependency.path);
    assertDigest("dependency", dependency.digest);
  }
  return {
    ...basis,
    emitter: { ...basis.emitter },
    source: { ...basis.source },
    dependencies,
    tool: { ...basis.tool },
  };
};

const canonicalBases = (
  bases: readonly IAutoMovieDesignDerivationBasis[],
): readonly IAutoMovieDesignDerivationBasis[] => {
  const output = bases
    .map((basis) => canonicalBasis(basis))
    .sort((left, right) => compareCodeUnits(left.target, right.target));
  if (new Set(output.map((basis) => basis.target)).size !== output.length)
    throw new Error("Design producer basis repeats a target identity.");
  if (new Set(output.map((basis) => basis.recordPath)).size !== output.length)
    throw new Error(
      "Design producer basis maps several targets to one record path.",
    );
  return output;
};

const canonicalOutputs = (
  outputs: readonly { target: string; recordPath: string; bytes: Uint8Array }[],
): readonly { target: string; recordPath: string; bytes: Uint8Array }[] => {
  const sorted = outputs
    .map((output) => ({ ...output, bytes: Buffer.from(output.bytes) }))
    .sort((left, right) => compareCodeUnits(left.target, right.target));
  if (new Set(sorted.map((output) => output.target)).size !== sorted.length)
    throw new AutoMovieDesignDerivationError(
      "design-derivation-nondeterministic",
      "Design evaluation returned a duplicate target identity.",
    );
  for (const output of sorted) assertRelativePath(output.recordPath);
  return sorted;
};

const canonicalRecords = (
  records: readonly IAutoMovieDesignDerivationRecord[],
): readonly IAutoMovieDesignDerivationRecord[] => {
  const sorted = [...records].sort((left, right) =>
    compareCodeUnits(left.target, right.target),
  );
  if (new Set(sorted.map((record) => record.target)).size !== sorted.length)
    throw new Error("Design-derivation manifest repeats a target identity.");
  if (new Set(sorted.map((record) => record.recordPath)).size !== sorted.length)
    throw new Error("Design-derivation manifest repeats a record path.");
  for (const record of sorted) {
    assertRelativePath(record.recordPath);
    canonicalBasis(record.basis);
  }
  return sorted;
};

const outputMismatch = (
  left: readonly { target: string; recordPath: string; bytes: Uint8Array }[],
  right: readonly { target: string; recordPath: string; bytes: Uint8Array }[],
): string | null => {
  if (left.length !== right.length) return "set";
  for (let index = 0; index < left.length; ++index) {
    const first = left[index]!;
    const second = right[index]!;
    if (
      first.target !== second.target ||
      first.recordPath !== second.recordPath ||
      Buffer.from(first.bytes).equals(Buffer.from(second.bytes)) === false
    )
      return `"${first.target}"`;
  }
  return null;
};

const assertRelativePath = (value: string): void => {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.includes("\\") ||
    value.startsWith("/") ||
    /^[A-Za-z]:/u.test(value) ||
    value
      .split("/")
      .some((part) => part === "" || part === "." || part === "..")
  )
    throw new Error(
      `Design derivation path "${value}" is not a canonical project-relative POSIX path.`,
    );
};

const assertIdentity = (label: string, value: string): void => {
  if (typeof value !== "string" || value.trim() === "")
    throw new Error(`Design derivation ${label} is empty or malformed.`);
};

const assertDigest = (label: string, value: AutoMovieContentDigest): void => {
  if (
    typeof value !== "string" ||
    /^sha256:[0-9a-f]{64}$/u.test(value) === false
  )
    throw new Error(`Design derivation ${label} digest is malformed.`);
};

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);
