import type {
  AutoMovieContentDigest,
  IAutoMovieDiagnostic,
  IAutoMovieLibraryReviewPopulation,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";
import path from "node:path";

import { loadSourceModule } from "../internal/loadSourceModule";

const { libraryReviewWorklist } = loadSourceModule<{
  libraryReviewWorklist: (props: {
    population: IAutoMovieLibraryReviewPopulation;
    diagnostics: readonly IAutoMovieDiagnostic[];
  }) => {
    declared: number;
    satisfied: number;
    pending: number;
    blocked: number;
    work: { observation: string; status: string }[];
  };
}>(
  path.resolve(
    __dirname,
    "../../../../packages/template/scaffold/scripts/libraryReviewWorklist.ts",
  ),
);

export const test_cli_scaffold_library_review_worklist = (): void => {
  const digest = `sha256:${"0".repeat(64)}` as AutoMovieContentDigest;
  const owner = "docs/models/object.md#object";
  const population: IAutoMovieLibraryReviewPopulation = {
    branches: ["models"],
    diagnostics: [],
    receipts: [],
    required: [],
    turntables: [],
    owners: [
      {
        branch: "models",
        owner,
        identity: {
          design: digest,
          source: digest,
          generated: digest,
          plan: digest,
        },
        observations: [
          { id: "front", evidence: "artifact" },
          { id: "rear", evidence: "artifact" },
        ],
      },
    ],
  };
  const failure = (target: string): IAutoMovieDiagnostic => ({
    code: "review-evidence-missing",
    category: "error",
    phase: "review",
    target,
    path: null,
    message: "Missing current evidence",
  });
  const read = (diagnostics: IAutoMovieDiagnostic[]) =>
    libraryReviewWorklist({ population, diagnostics });
  TestValidator.equals(
    "accepted observations require no new work",
    read([]).work,
    [],
  );
  const missing = read([failure(`library:models:${owner}:rear`)]);
  TestValidator.equals(
    "only the unpaid view is listed",
    missing.work.map((entry) => entry.observation),
    ["rear"],
  );
  TestValidator.equals(
    "the paid sibling remains counted",
    [missing.satisfied, missing.pending, missing.blocked],
    [1, 1, 0],
  );
  TestValidator.equals(
    "owner refusal blocks its observations",
    read([failure(`library:models:${owner}`)]).blocked,
    2,
  );
  TestValidator.equals(
    "branch refusal blocks its observations",
    read([failure("library:models")]).blocked,
    2,
  );
  TestValidator.equals(
    "source failure cannot appear as paid review",
    read([failure("source")]).satisfied,
    0,
  );
  TestValidator.equals(
    "warning alone does not refuse an observation",
    read([{ ...failure("source"), category: "warning" }]).satisfied,
    2,
  );
  population.owners = [];
  TestValidator.equals("empty population stays empty", read([]).declared, 0);
};
