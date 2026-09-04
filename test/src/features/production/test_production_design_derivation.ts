import { TestValidator } from "@nestia/e2e";

import {
  AUTOMOVIE_DESIGN_DERIVATION_PROTOCOL,
  AutoMovieDesignDerivationError,
  IAutoMovieDesignDerivationBasis,
  autoMovieDesignDerivationBasisDigest,
  createAutoMovieDesignDerivationCandidate,
  inspectAutoMovieDesignDerivation,
} from "../../../../packages/production/src/production/designDerivation";
import { namedFacts, throwsError } from "../internal/predicates";

const digest = (digit: string) => `sha256:${digit.repeat(64)}` as const;
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
 */
export const test_production_design_derivation = (): void => {
  const initialBasis = basis();
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
      dependencyChangesBasis: true,
      mappingChangesBasis: true,
      toolChangesBasis: true,
      candidateStagesOutput: true,
      sameBasisMismatchRefused: true,
      basisRaceRefused: true,
      targetSetRefused: true,
      duplicateBasisRefused: true,
      unsafePathRefused: true,
      typedFailureCarriesCode: true,
      currentInspectionPasses: true,
      basisStaleDetected: true,
      outputStaleDetected: true,
      missingTargetDetected: true,
      malformedManifestDetected: true,
      duplicateManifestDetected: true,
    },
  );
};
