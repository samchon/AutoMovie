import {
  type IAutoMovieEvidenceConfigProps,
  createAutoMovieProductionObligationClaim,
  createAutoMovieProductionPrincipleClaim,
  createBlankAutoMovieProductionEvidence,
  validateAutoMovieLocalContractClaims,
} from "@automovie/evidence";
import { TestValidator } from "@nestia/e2e";
import type { ITtscEvidenceGraphClaim } from "@ttsc/evidence";
import path from "node:path";

import { loadSourceModule } from "../internal/loadSourceModule";

const { projectAutoMovieNativeClaims } = loadSourceModule<{
  projectAutoMovieNativeClaims: (
    claims: Readonly<NonNullable<IAutoMovieEvidenceConfigProps["claims"]>>,
  ) => ITtscEvidenceGraphClaim[];
}>(
  path.resolve(
    __dirname,
    "../../../../packages/evidence/src/projectAutoMovieNativeClaims.ts",
  ),
);

/**
 * Native evaluation must not erase the declaration a manifest still consumes.
 *
 * Scenarios:
 * 1. Admitted principle and population-account claims lose only binding metadata.
 * 2. Mixed error/warning references retain their exact selectors and policies.
 * 3. Frozen declarations and empty populations remain unchanged by projection.
 */
export const test_evidence_native_claim_projection = (): void => {
  const blank = createBlankAutoMovieProductionEvidence(
    "/production",
    "english",
  );
  const props = {
    name: "local obligation",
    account: "accounts/models/local.md",
    document: "contracts/obligations-models.md",
    layer: "models" as const,
    stage: "review" as const,
    populationScope: blank.populationScope,
  };
  const account = createAutoMovieProductionObligationClaim(props);
  const principle = createAutoMovieProductionPrincipleClaim({
    ...props,
    name: "local principle",
    document: "contracts/principles-models.md",
    files: ["models/**/*.md"],
    symbol: ["h2", "h3", "h4"],
  });
  const structural = {
    type: "markdown" as const,
    root: "docs",
    files: ["models/**/*.md"],
    symbol: "h2" as const,
    severity: "error" as const,
    noEvidenceExclude: true,
    singleEvidencePerSymbol: true,
  };
  const native: ITtscEvidenceGraphClaim = {
    name: "rendered realization",
    type: "typescript",
    files: ["src/**/*.ts", "!src/index.ts"],
    symbol: ["type", "function", "property"],
    reference: [
      structural,
      { ...structural, severity: "warning", requireReview: true },
    ],
  };
  const claims = [account, principle, native];
  validateAutoMovieLocalContractClaims({ ...blank, models: "review", claims });
  const before = JSON.stringify(claims);
  for (const claim of claims) Object.freeze(claim);
  Object.freeze(claims);
  const projected = projectAutoMovieNativeClaims(claims);
  TestValidator.equals(
    "claim order",
    projected.map((claim) => claim.name),
    [props.name, "local principle", "rendered realization"],
  );
  for (const [index, claim] of claims.entries()) {
    const output = projected[index]!;
    TestValidator.equals(
      "native metadata is absent",
      Reflect.has(output, "autoMovieBinding"),
      false,
    );
    TestValidator.predicate("projection owns a new record", output !== claim);
    for (const key of Object.keys(claim).filter(
      (key) => key !== "autoMovieBinding",
    ))
      TestValidator.equals(
        `native field ${key} is retained`,
        Reflect.get(output, key),
        Reflect.get(claim, key),
      );
    TestValidator.equals(
      "no additional fields",
      Object.keys(output).sort(),
      Object.keys(claim)
        .filter((key) => key !== "autoMovieBinding")
        .sort(),
    );
  }
  TestValidator.equals(
    "manifest declaration stays intact",
    JSON.stringify(claims),
    before,
  );
  TestValidator.equals(
    "native references stay intact",
    projected[2]!.reference,
    [structural, { ...structural, severity: "warning", requireReview: true }],
  );
  TestValidator.equals(
    "empty population stays empty",
    projectAutoMovieNativeClaims([]),
    [],
  );
};
