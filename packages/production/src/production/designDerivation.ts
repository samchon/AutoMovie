import type { AutoMovieContentDigest } from "@automovie/interface";

import {
  canonicalAutoMovieJsonBytes,
  compareCodeUnits,
  digestAutoMovieBytes,
} from "./contentIdentity";

/** Current film/brief design-derivation protocol. */
export const AUTOMOVIE_DESIGN_DERIVATION_PROTOCOL =
  "automovie.design-derivation.v1" as const;

/**
 * One project-relative input in a design producer closure.
 *
 * @author Samchon
 */
export interface IAutoMovieDesignDerivationDependency {
  path: string;
  digest: AutoMovieContentDigest;
}

/**
 * Exact producer closure of one emitted design record.
 *
 * @author Samchon
 */
export interface IAutoMovieDesignDerivationBasis {
  protocol: typeof AUTOMOVIE_DESIGN_DERIVATION_PROTOCOL;
  production: string;
  target: string;
  recordPath: string;
  emitter: IAutoMovieDesignDerivationDependency;
  source: {
    path: string;
    export: string;
    selector: string | null;
  };
  dependencies: readonly IAutoMovieDesignDerivationDependency[];
  tool: {
    production: string;
    typescript: string;
    node: string;
  };
}

/**
 * Manifest entry connecting one resident design record to its producer basis.
 *
 * @author Samchon
 */
export interface IAutoMovieDesignDerivationRecord {
  target: string;
  recordPath: string;
  basis: IAutoMovieDesignDerivationBasis;
  basisDigest: AutoMovieContentDigest;
  outputDigest: AutoMovieContentDigest;
}

/**
 * Complete target inventory published by one design generation transaction.
 *
 * @author Samchon
 */
export interface IAutoMovieDesignDerivationManifest {
  version: 1;
  protocol: typeof AUTOMOVIE_DESIGN_DERIVATION_PROTOCOL;
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
  | "design-derivation-output-stale"
  | "design-derivation-stale";

/**
 * One currentness problem on a resident design record or manifest.
 *
 * @author Samchon
 */
export interface IAutoMovieDesignDerivationProblem {
  code: AutoMovieDesignDerivationFailureCode;
  target: string;
  path: string | null;
  message: string;
}

/**
 * Typed refusal raised before any design candidate may be published.
 *
 * @author Samchon
 */
export class AutoMovieDesignDerivationError extends Error {
  public constructor(
    public readonly code: AutoMovieDesignDerivationFailureCode,
    message: string,
  ) {
    super(message);
    this.name = "AutoMovieDesignDerivationError";
  }
}

/** Canonical identity of one target-local producer closure. */
export const autoMovieDesignDerivationBasisDigest = (
  basis: IAutoMovieDesignDerivationBasis,
): AutoMovieContentDigest =>
  digestAutoMovieBytes(
    canonicalAutoMovieJsonBytes(canonicalBasis(basis, true)),
  );

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

/** Inspect recorded design lineage against live target-local producer closure. */
export const inspectAutoMovieDesignDerivation = (props: {
  manifest: IAutoMovieDesignDerivationManifest | null;
  bases: readonly IAutoMovieDesignDerivationBasis[];
  readOutput: (path: string) => Uint8Array | null;
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
  return problems;
};

const canonicalBasis = (
  basis: IAutoMovieDesignDerivationBasis,
  validate: boolean,
): IAutoMovieDesignDerivationBasis => {
  if (validate) {
    if (basis.protocol !== AUTOMOVIE_DESIGN_DERIVATION_PROTOCOL)
      throw new Error(`Unsupported design basis protocol "${basis.protocol}".`);
    assertRelativePath(basis.recordPath);
    assertRelativePath(basis.emitter.path);
    assertRelativePath(basis.source.path);
  }
  const dependencies = [...basis.dependencies].sort((left, right) =>
    compareCodeUnits(left.path, right.path),
  );
  if (
    new Set(dependencies.map((entry) => entry.path)).size !==
    dependencies.length
  )
    throw new Error(
      `Design target "${basis.target}" repeats a dependency path.`,
    );
  for (const dependency of dependencies) assertRelativePath(dependency.path);
  return { ...basis, dependencies };
};

const canonicalBases = (
  bases: readonly IAutoMovieDesignDerivationBasis[],
): readonly IAutoMovieDesignDerivationBasis[] => {
  const output = bases
    .map((basis) => canonicalBasis(basis, true))
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
  const sorted = [...outputs].sort((left, right) =>
    compareCodeUnits(left.target, right.target),
  );
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
    canonicalBasis(record.basis, true);
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

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);
