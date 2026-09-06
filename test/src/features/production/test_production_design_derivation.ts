import type { AutoMovieContentDigest } from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";
import path from "node:path";

import { loadSourceModule } from "../internal/loadSourceModule";
import { namedFacts, throwsError } from "../internal/predicates";

interface IAutoMovieDesignDerivationBasis {
  protocol: string;
  production: string;
  target: string;
  recordPath: string;
  emitter: { path: string; digest: AutoMovieContentDigest };
  source: { path: string; export: string; selector: string | null };
  dependencies: Array<{ path: string; digest: AutoMovieContentDigest }>;
  tool: { production: string; typescript: string; node: string };
}
interface IDerivationCandidate {
  outputs: ReadonlyMap<string, Uint8Array>;
  manifest: {
    records: Array<{
      target: string;
      recordPath: string;
      basis: IAutoMovieDesignDerivationBasis;
    }>;
  };
}
interface IProducerEntry {
  target: string;
  recordPath: string;
  source: IAutoMovieDesignDerivationBasis["source"];
  evaluate: () => unknown;
  store: (value: unknown) => {
    accepted: boolean;
    revision: number;
    diagnostics: Array<{ message: string }>;
  };
}
interface IDerivationRun {
  manifest: IDerivationCandidate["manifest"];
  outcomes: Array<{ target: string; recordPath: string; state: string }>;
}
const {
  AUTOMOVIE_DESIGN_DERIVATION_PROTOCOL,
  AutoMovieDesignDerivationError,
  autoMovieDesignDerivationBasisDigest,
  autoMovieDesignTargetAddress,
  captureAutoMovieDesignDerivationBasis,
  createAutoMovieDesignDerivationCandidate,
  inspectAutoMovieDesignDerivation,
  runAutoMovieDesignDerivation,
} = loadSourceModule<{
  AUTOMOVIE_DESIGN_DERIVATION_PROTOCOL: string;
  AutoMovieDesignDerivationError: new (
    ...args: unknown[]
  ) => Error & { code: string };
  autoMovieDesignDerivationBasisDigest: (
    basis: IAutoMovieDesignDerivationBasis,
  ) => AutoMovieContentDigest;
  autoMovieDesignTargetAddress: (
    target: { kind: "production" | "world" } | { kind: string; id: string },
  ) => string;
  runAutoMovieDesignDerivation: (props: {
    production: string;
    emitter: { path: string; bytes: Uint8Array };
    tool: IAutoMovieDesignDerivationBasis["tool"];
    readSource: (path: string) => Uint8Array;
    resident: readonly { target: string; recordPath: string; value: unknown }[];
    entries: readonly IProducerEntry[];
  }) => IDerivationRun;
  captureAutoMovieDesignDerivationBasis: (props: {
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
  }) => IAutoMovieDesignDerivationBasis;
  createAutoMovieDesignDerivationCandidate: (props: {
    bases: readonly IAutoMovieDesignDerivationBasis[];
    evaluate: () => Array<{
      target: string;
      recordPath: string;
      bytes: Uint8Array;
    }>;
    currentBases: () => readonly IAutoMovieDesignDerivationBasis[];
  }) => IDerivationCandidate;
  inspectAutoMovieDesignDerivation: (props: {
    manifest: IDerivationCandidate["manifest"] | null;
    bases: readonly IAutoMovieDesignDerivationBasis[];
    readOutput: (path: string) => Uint8Array | null;
    residentRecordPaths?: readonly string[];
  }) => Array<{ code: string; path: string | null; message: string }>;
}>(
  path.resolve(
    __dirname,
    "../../../../packages/production/src/production/designDerivation.ts",
  ),
);

const digest = (digit: string): AutoMovieContentDigest =>
  `sha256:${digit.repeat(64)}` as AutoMovieContentDigest;
const basis = (
  overrides: Partial<IAutoMovieDesignDerivationBasis> = {},
): IAutoMovieDesignDerivationBasis => ({
  protocol: AUTOMOVIE_DESIGN_DERIVATION_PROTOCOL,
  production: "film",
  target: "production",
  recordPath: "automovie/design/film/production.json",
  emitter: { path: "scripts/emitDesign.ts", digest: digest("1") },
  source: {
    path: "src/design/production.ts",
    export: "production",
    selector: null,
  },
  dependencies: [
    { path: "src/design/shared.ts", digest: digest("2") },
    { path: "src/design/production.ts", digest: digest("3") },
  ],
  tool: { production: "1.0.0", typescript: "7.0.0", node: "22" },
  ...overrides,
});
const output = (value = 1) => [
  {
    target: "production",
    recordPath: "automovie/design/film/production.json",
    bytes: Buffer.from(JSON.stringify({ value })),
  },
];

/**
 * Design derivation is target-local, same-basis deterministic, and fail closed.
 *
 * Scenarios:
 *
 * 1. Dependency order is canonical while target, mapping, dependency, and tool changes alter the basis.
 * 2. Two equal evaluations stage one complete manifest; a changed live basis, output, target set, duplicate, or unsafe path is refused.
 * 3. Inspection distinguishes producer-basis staleness, resident-output staleness, missing targets, and malformed manifests.
 * 4. A complete generation run creates, updates, or leaves each declared record
 *    through the project's typed setter in plan order, and refuses an orphan
 *    resident record, a refused store, or a value without a canonical JSON
 *    form before any record is published.
 * 5. Every basis, output, and manifest shape rule is named: protocol, blank
 *    selector, repeated dependency path, several targets on one record path,
 *    a duplicate evaluated target, a changed evaluated target set, a manifest
 *    that repeats a record path, an unowned resident record, and a live
 *    closure that fails with a non-Error value.
 */
export const test_production_design_derivation = (): void => {
  const initialBasis = basis();
  const sourceFiles = {
    "src/design/production.ts":
      'import type { T } from "./types";\nimport { value } from "./shared";\nexport const production = value;\n',
    "src/design/shared.ts": "export const value = 1;\n",
  };
  const captureBasis = (
    files: Readonly<Record<string, string>> = sourceFiles,
    emitter = "export {};\n",
  ): IAutoMovieDesignDerivationBasis =>
    captureAutoMovieDesignDerivationBasis({
      production: "film",
      target: "production",
      recordPath: "automovie/design/film/production.json",
      emitter: {
        path: "scripts/emitDesign.ts",
        bytes: Buffer.from(emitter),
      },
      source: {
        path: "src/design/production.ts",
        export: "production",
        selector: null,
      },
      readSource: (sourcePath) => {
        const source = files[sourcePath];
        if (source === undefined) throw new Error("missing source");
        return Buffer.from(source);
      },
      tool: { production: "1.0.0", typescript: "7.0.0", node: "22" },
    });
  const linkedBasis = captureBasis();
  const linkedBasisCrlf = captureBasis(
    Object.fromEntries(
      Object.entries(sourceFiles).map(([sourcePath, source]) => [
        sourcePath,
        source.replaceAll("\n", "\r\n"),
      ]),
    ),
    "export {};\r\n",
  );
  const changedTransitiveBasis = captureBasis({
    ...sourceFiles,
    "src/design/shared.ts": "export const value = 2;\n",
  });
  const candidate = createAutoMovieDesignDerivationCandidate({
    bases: [initialBasis],
    evaluate: () => output(),
    currentBases: () => [initialBasis],
  });
  let evaluation = 0;
  const nondeterministic = (): boolean =>
    throwsError(
      () =>
        createAutoMovieDesignDerivationCandidate({
          bases: [initialBasis],
          evaluate: () => output(++evaluation),
          currentBases: () => [initialBasis],
        }),
      "different canonical bytes",
    );
  const sharedBytes = Buffer.from('{"value":1}');
  let sharedEvaluation = 0;
  const mutableBasis = basis();
  const frozenCandidate = createAutoMovieDesignDerivationCandidate({
    bases: [mutableBasis],
    evaluate: () => output(),
    currentBases: () => [mutableBasis],
  });
  mutableBasis.source.export = "mutated-after-candidate";
  TestValidator.equals(
    "design producer closure and candidate transaction are exact",
    namedFacts([
      [
        "dependencyOrderCanonical",
        () =>
          autoMovieDesignDerivationBasisDigest(initialBasis) ===
          autoMovieDesignDerivationBasisDigest(
            basis({ dependencies: [...initialBasis.dependencies].reverse() }),
          ),
      ],
      [
        "runtimeClosureCaptured",
        () =>
          linkedBasis.dependencies
            .map((dependency) => dependency.path)
            .join(",") === "src/design/production.ts,src/design/shared.ts",
      ],
      [
        "typeOnlyDependencyExcluded",
        () =>
          linkedBasis.dependencies.some(
            (dependency) => dependency.path === "src/design/types.ts",
          ) === false,
      ],
      [
        "sourceEolNormalizationStable",
        () =>
          autoMovieDesignDerivationBasisDigest(linkedBasis) ===
          autoMovieDesignDerivationBasisDigest(linkedBasisCrlf),
      ],
      [
        "transitiveSourceChangeStalesBasis",
        () =>
          autoMovieDesignDerivationBasisDigest(linkedBasis) !==
          autoMovieDesignDerivationBasisDigest(changedTransitiveBasis),
      ],
      [
        "missingRuntimeDependencyRefused",
        () =>
          throwsError(
            () =>
              captureBasis({
                "src/design/production.ts":
                  'import { value } from "./missing";\nexport const production = value;\n',
              }),
            "unreadable runtime source closure",
          ),
      ],
      [
        "dependencyChangesBasis",
        () =>
          autoMovieDesignDerivationBasisDigest(initialBasis) !==
          autoMovieDesignDerivationBasisDigest(
            basis({
              dependencies: [
                { path: "src/design/production.ts", digest: digest("4") },
              ],
            }),
          ),
      ],
      [
        "mappingChangesBasis",
        () =>
          autoMovieDesignDerivationBasisDigest(initialBasis) !==
          autoMovieDesignDerivationBasisDigest(
            basis({ source: { ...initialBasis.source, export: "other" } }),
          ),
      ],
      [
        "toolChangesBasis",
        () =>
          autoMovieDesignDerivationBasisDigest(initialBasis) !==
          autoMovieDesignDerivationBasisDigest(
            basis({ tool: { ...initialBasis.tool, node: "24" } }),
          ),
      ],
      [
        "candidateStagesOutput",
        () =>
          candidate.outputs.size === 1 &&
          candidate.manifest.records.length === 1,
      ],
      ["sameBasisMismatchRefused", nondeterministic],
      [
        "sharedOutputBufferCannotHideMismatch",
        () =>
          throwsError(
            () =>
              createAutoMovieDesignDerivationCandidate({
                bases: [initialBasis],
                evaluate: () => {
                  sharedBytes[sharedBytes.length - 2] =
                    ++sharedEvaluation === 1 ? 49 : 50;
                  return [
                    {
                      target: "production",
                      recordPath: "automovie/design/film/production.json",
                      bytes: sharedBytes,
                    },
                  ];
                },
                currentBases: () => [initialBasis],
              }),
            "different canonical bytes",
          ),
      ],
      [
        "candidateBasisIsFrozen",
        () =>
          frozenCandidate.manifest.records[0]?.basis.source.export ===
          "production",
      ],
      [
        "basisRaceRefused",
        () =>
          throwsError(
            () =>
              createAutoMovieDesignDerivationCandidate({
                bases: [initialBasis],
                evaluate: () => output(),
                currentBases: () => [
                  basis({ tool: { ...initialBasis.tool, node: "24" } }),
                ],
              }),
            "changed during generation",
          ),
      ],
      [
        "targetSetRefused",
        () =>
          throwsError(
            () =>
              createAutoMovieDesignDerivationCandidate({
                bases: [initialBasis],
                evaluate: () => [],
                currentBases: () => [initialBasis],
              }),
            "target set",
          ),
      ],
      [
        "wrongTargetMappingRefused",
        () =>
          throwsError(
            () =>
              createAutoMovieDesignDerivationCandidate({
                bases: [initialBasis],
                evaluate: () => [
                  {
                    ...output()[0]!,
                    target: "other",
                  },
                ],
                currentBases: () => [initialBasis],
              }),
            "no exact declared record-path mapping",
          ),
      ],
      [
        "duplicateBasisRefused",
        () =>
          throwsError(
            () =>
              createAutoMovieDesignDerivationCandidate({
                bases: [initialBasis, initialBasis],
                evaluate: () => output(),
                currentBases: () => [initialBasis],
              }),
            "repeats a target",
          ),
      ],
      [
        "unsafePathRefused",
        () =>
          throwsError(
            () =>
              autoMovieDesignDerivationBasisDigest(
                basis({ recordPath: "../outside.json" }),
              ),
            "not a canonical",
          ),
      ],
      [
        "malformedBasisRefused",
        () =>
          throwsError(
            () =>
              autoMovieDesignDerivationBasisDigest(
                basis({
                  emitter: {
                    path: "scripts/emitDesign.ts",
                    digest: digest("Z"),
                  },
                }),
              ),
            "digest is malformed",
          ),
      ],
      [
        "invalidLiveBasisRefusedAsRace",
        () => {
          try {
            createAutoMovieDesignDerivationCandidate({
              bases: [initialBasis],
              evaluate: () => output(),
              currentBases: () => [basis({ target: " " })],
            });
            return false;
          } catch (error) {
            return (
              error instanceof AutoMovieDesignDerivationError &&
              error.code === "design-derivation-basis-changed"
            );
          }
        },
      ],
      [
        "typedFailureCarriesCode",
        () => {
          try {
            let run = 0;
            createAutoMovieDesignDerivationCandidate({
              bases: [initialBasis],
              evaluate: () => output(++run),
              currentBases: () => [initialBasis],
            });
            return false;
          } catch (error) {
            return (
              error instanceof AutoMovieDesignDerivationError &&
              error.code === "design-derivation-nondeterministic"
            );
          }
        },
      ],
      [
        "currentInspectionPasses",
        () =>
          inspectAutoMovieDesignDerivation({
            manifest: candidate.manifest,
            bases: [initialBasis],
            readOutput: () => output()[0]!.bytes,
          }).length === 0,
      ],
      [
        "basisStaleDetected",
        () =>
          inspectAutoMovieDesignDerivation({
            manifest: candidate.manifest,
            bases: [
              basis({ source: { ...initialBasis.source, export: "other" } }),
            ],
            readOutput: () => output()[0]!.bytes,
          })[0]?.code === "design-derivation-stale",
      ],
      [
        "outputStaleDetected",
        () =>
          inspectAutoMovieDesignDerivation({
            manifest: candidate.manifest,
            bases: [initialBasis],
            readOutput: () => Buffer.from("changed"),
          })[0]?.code === "design-derivation-output-stale",
      ],
      [
        "missingOutputDetected",
        () =>
          inspectAutoMovieDesignDerivation({
            manifest: candidate.manifest,
            bases: [initialBasis],
            readOutput: () => null,
          })[0]?.code === "design-derivation-output-stale",
      ],
      [
        "missingTargetDetected",
        () =>
          inspectAutoMovieDesignDerivation({
            manifest: { ...candidate.manifest, records: [] },
            bases: [initialBasis],
            readOutput: () => null,
          })[0]?.code === "design-derivation-stale",
      ],
      [
        "malformedManifestDetected",
        () =>
          inspectAutoMovieDesignDerivation({
            manifest: null,
            bases: [initialBasis],
            readOutput: () => null,
          })[0]?.code === "design-derivation-manifest-malformed",
      ],
      [
        "duplicateManifestDetected",
        () =>
          inspectAutoMovieDesignDerivation({
            manifest: {
              ...candidate.manifest,
              records: [
                candidate.manifest.records[0]!,
                candidate.manifest.records[0]!,
              ],
            },
            bases: [initialBasis],
            readOutput: () => output()[0]!.bytes,
          })[0]?.code === "design-derivation-manifest-malformed",
      ],
    ]),
    {
      dependencyOrderCanonical: true,
      runtimeClosureCaptured: true,
      typeOnlyDependencyExcluded: true,
      sourceEolNormalizationStable: true,
      transitiveSourceChangeStalesBasis: true,
      missingRuntimeDependencyRefused: true,
      dependencyChangesBasis: true,
      mappingChangesBasis: true,
      toolChangesBasis: true,
      candidateStagesOutput: true,
      sameBasisMismatchRefused: true,
      sharedOutputBufferCannotHideMismatch: true,
      candidateBasisIsFrozen: true,
      basisRaceRefused: true,
      targetSetRefused: true,
      wrongTargetMappingRefused: true,
      duplicateBasisRefused: true,
      unsafePathRefused: true,
      malformedBasisRefused: true,
      invalidLiveBasisRefusedAsRace: true,
      typedFailureCarriesCode: true,
      currentInspectionPasses: true,
      basisStaleDetected: true,
      outputStaleDetected: true,
      missingOutputDetected: true,
      missingTargetDetected: true,
      malformedManifestDetected: true,
      duplicateManifestDetected: true,
    },
  );

  const stored: unknown[] = [];
  const entry = (
    overrides: Partial<IProducerEntry> = {},
    value: unknown = { value: 1 },
  ): IProducerEntry => ({
    target: "production",
    recordPath: "automovie/design/film/production.json",
    source: {
      path: "src/design/production.ts",
      export: "production",
      selector: null,
    },
    evaluate: () => value,
    store: (accepted) => {
      stored.push(accepted);
      return { accepted: true, revision: 1, diagnostics: [] };
    },
    ...overrides,
  });
  const run = (
    entries: readonly IProducerEntry[],
    resident: readonly {
      target: string;
      recordPath: string;
      value: unknown;
    }[] = [],
  ): IDerivationRun =>
    runAutoMovieDesignDerivation({
      production: "film",
      emitter: {
        path: "scripts/emitDesign.ts",
        bytes: Buffer.from("export {};\n"),
      },
      tool: { production: "1.0.0", typescript: "7.0.0", node: "22" },
      readSource: (sourcePath) => {
        const source = sourceFiles[sourcePath as keyof typeof sourceFiles];
        if (source === undefined) throw new Error("missing source");
        return Buffer.from(source);
      },
      resident,
      entries,
    });
  const refusal = (task: () => unknown): string => {
    try {
      task();
      return "accepted";
    } catch (error) {
      return error instanceof AutoMovieDesignDerivationError
        ? `${error.code}: ${error.message}`
        : error instanceof Error
          ? `Error: ${error.message}`
          : String(error);
    }
  };
  const states = (result: IDerivationRun): string =>
    result.outcomes.map((outcome) => outcome.state).join(",");
  const created = run([entry()]);
  const unchanged = run(
    [entry()],
    [
      {
        target: "production",
        recordPath: "automovie/design/film/production.json",
        value: { value: 1 },
      },
    ],
  );
  const updated = run(
    [entry()],
    [
      {
        target: "production",
        recordPath: "automovie/design/film/production.json",
        value: { value: 0 },
      },
    ],
  );
  TestValidator.equals(
    "a generation run publishes only a complete current candidate in plan order",
    {
      created: states(created),
      createdManifest: created.manifest.records.length,
      unchanged: states(unchanged),
      updated: states(updated),
      storedValues: stored,
      orphan: refusal(() =>
        run(
          [entry()],
          [
            {
              target: 'model "orphan"',
              recordPath: "automovie/design/film/models/orphan.json",
              value: {},
            },
          ],
        ),
      ),
      refusedStore: refusal(() =>
        run([
          entry({
            store: () => ({
              accepted: false,
              revision: 1,
              diagnostics: [{ message: "The store refused the record." }],
            }),
          }),
        ]),
      ),
      bigintValue: refusal(() => run([entry({}, { value: 1n })])),
      undefinedValue: refusal(() =>
        run([entry({ evaluate: () => undefined })]),
      ),
      addresses: [
        autoMovieDesignTargetAddress({ kind: "production" }),
        autoMovieDesignTargetAddress({ kind: "world" }),
        autoMovieDesignTargetAddress({ kind: "model", id: "hero" }),
      ],
    },
    {
      created: "created",
      createdManifest: 1,
      unchanged: "unchanged",
      updated: "updated",
      storedValues: [{ value: 1 }, { value: 1 }],
      orphan:
        'design-derivation-orphan-record: 1 resident design record(s) are derived by no producer entry:\n  automovie/design/film/models/orphan.json  (model "orphan")\n\nDerive each record from its current owner or delete the named file. No design record was published.',
      refusedStore:
        'design-derivation-publication-failed: Design target "production" was refused by the project store: The store refused the record.',
      bigintValue:
        'design-derivation-output-malformed: Design target "production" evaluated to a value that has no canonical JSON form (AutoMovie canonical JSON refused unsupported-value: bigint has no JSON representation). No design record was published.',
      undefinedValue:
        'design-derivation-output-malformed: Design target "production" evaluated to a value that has no canonical JSON form (AutoMovie canonical JSON refused unsupported-value: the root must have a JSON representation). No design record was published.',
      addresses: ["production", "world", 'model "hero"'],
    },
  );

  let alternating = 0;
  TestValidator.equals(
    "every basis, output, and manifest shape rule is named",
    {
      protocol: refusal(() =>
        createAutoMovieDesignDerivationCandidate({
          bases: [basis({ protocol: "automovie.design-derivation.v0" })],
          evaluate: () => output(),
          currentBases: () => [initialBasis],
        }),
      ),
      blankSelector: refusal(() =>
        createAutoMovieDesignDerivationCandidate({
          bases: [basis({ source: { ...initialBasis.source, selector: " " } })],
          evaluate: () => output(),
          currentBases: () => [initialBasis],
        }),
      ),
      repeatedDependency: refusal(() =>
        createAutoMovieDesignDerivationCandidate({
          bases: [
            basis({
              dependencies: [
                initialBasis.dependencies[0]!,
                initialBasis.dependencies[0]!,
              ],
            }),
          ],
          evaluate: () => output(),
          currentBases: () => [initialBasis],
        }),
      ),
      sharedRecordPath: refusal(() =>
        createAutoMovieDesignDerivationCandidate({
          bases: [initialBasis, basis({ target: "world" })],
          evaluate: () => output(),
          currentBases: () => [initialBasis],
        }),
      ),
      duplicateOutputTarget: refusal(() =>
        createAutoMovieDesignDerivationCandidate({
          bases: [initialBasis],
          evaluate: () => [...output(), ...output()],
          currentBases: () => [initialBasis],
        }),
      ),
      changedOutputSet: refusal(() =>
        createAutoMovieDesignDerivationCandidate({
          bases: [initialBasis],
          evaluate: () =>
            ++alternating === 1
              ? output()
              : [
                  ...output(),
                  {
                    target: "world",
                    recordPath: "automovie/design/shared/world.json",
                    bytes: Buffer.from("{}"),
                  },
                ],
          currentBases: () => [initialBasis],
        }),
      ),
      liveClosureValueFailure: refusal(() =>
        createAutoMovieDesignDerivationCandidate({
          bases: [initialBasis],
          evaluate: () => output(),
          currentBases: () => {
            const failure: unknown = "live closure exploded";
            throw failure;
          },
        }),
      ),
      manifestSharedRecordPath: inspectAutoMovieDesignDerivation({
        manifest: {
          ...candidate.manifest,
          records: [
            candidate.manifest.records[0]!,
            {
              ...candidate.manifest.records[0]!,
              target: "world",
              basis: {
                ...candidate.manifest.records[0]!.basis,
                target: "world",
              },
            },
          ],
        },
        bases: [initialBasis],
        readOutput: () => output()[0]!.bytes,
      }).map((problem) => `${problem.code}: ${problem.message}`),
      unownedResident: inspectAutoMovieDesignDerivation({
        manifest: candidate.manifest,
        bases: [initialBasis],
        readOutput: () => output()[0]!.bytes,
        residentRecordPaths: [
          "automovie/design/film/production.json",
          "automovie/design/film/models/orphan.json",
        ],
      }).map((problem) => `${problem.code}: ${problem.path}`),
    },
    {
      protocol:
        'Error: Unsupported design basis protocol "automovie.design-derivation.v0".',
      blankSelector:
        "Error: Design derivation source selector is empty or malformed.",
      repeatedDependency:
        'Error: Design target "production" repeats a dependency path.',
      sharedRecordPath:
        "Error: Design producer basis maps several targets to one record path.",
      duplicateOutputTarget:
        "design-derivation-nondeterministic: Design evaluation returned a duplicate target identity.",
      changedOutputSet:
        "design-derivation-nondeterministic: Design target set produced different canonical bytes from the same frozen basis. No design record was published.",
      liveClosureValueFailure:
        "design-derivation-basis-changed: The live design producer closure became invalid during generation (live closure exploded). Run the explicit design command again.",
      manifestSharedRecordPath: [
        "design-derivation-manifest-malformed: Design-derivation manifest repeats a record path. Regenerate the canonical design-derivation manifest.",
      ],
      unownedResident: [
        "design-derivation-stale: automovie/design/film/models/orphan.json",
      ],
    },
  );
};
