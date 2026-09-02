import type {
  AutoMovieContentDigest,
  AutoMovieLibraryReviewEvidenceKind,
  IAutoMovieLibraryReviewOwner,
  IAutoMovieLibraryReviewOwnerIdentity,
  IAutoMovieLibraryReviewResolvedReceipt,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";
import path from "node:path";

import { loadSourceModule } from "../internal/loadSourceModule";
import { namedFacts } from "../internal/predicates";

const unit = loadSourceModule<{
  libraryReviewEvidenceDiagnostics: (props: {
    kind: "brief" | "film" | "library";
    scope: "design" | "source" | "review" | "final";
    branches: readonly string[];
    owners: readonly IAutoMovieLibraryReviewOwner[];
    receipts: readonly TestReceipt[];
    current: (receipt: TestReceipt) => boolean;
  }) => Array<{
    code: string;
    category: string;
    phase: string;
    target: string;
    message: string;
  }>;
}>(
  path.resolve(
    __dirname,
    "../../../../packages/production/src/production/libraryReviewEvidenceDiagnostics.ts",
  ),
);
const { libraryReviewEvidenceDiagnostics } = unit;

type Digest = AutoMovieContentDigest;
interface TestReceipt extends IAutoMovieLibraryReviewResolvedReceipt {
  resident?: boolean;
  throws?: boolean;
}

const digest = (digit: string): Digest =>
  `sha256:${digit.repeat(64)}` as Digest;
const identity = (
  digit: string = "1",
): IAutoMovieLibraryReviewOwnerIdentity => ({
  design: digest(digit),
  source: digest(digit),
  generated: digest(digit),
  plan: digest(digit),
});
const owner = (
  branch: string,
  id: string,
  evidence: AutoMovieLibraryReviewEvidenceKind = "artifact",
): IAutoMovieLibraryReviewOwner => ({
  branch,
  owner: id,
  identity: identity(),
  observations: [{ id: `${id}-observation`, evidence }],
});
const receipt = (
  subject: IAutoMovieLibraryReviewOwner,
  props: Partial<TestReceipt> = {},
): TestReceipt => ({
  branch: subject.branch,
  owner: subject.owner,
  observation: subject.observations[0]!.id,
  evidence:
    subject.observations[0]!.evidence === "artifact"
      ? {
          kind: "artifact",
          root: "render",
          path: `observations/${subject.owner}.png`,
          digest: digest("3"),
        }
      : subject.observations[0]!.evidence === "facts"
        ? {
            kind: "facts",
            facts: { observed: subject.owner },
            digest: digest("4"),
          }
        : {
            kind: "turntable",
            model: subject.owner,
          },
  identity: subject.identity,
  runtimeIdentity: "tool:runtime:v1",
  // These owners are exterior by construction, so the honest pose is none and
  // the honest measurement set is empty. Both are written rather than omitted:
  // a receipt that cannot say where it stood is a different fact from one that
  // stood nowhere in particular, and this fixture is the second.
  pose: null,
  measurements: {},
  verdict: "passed",
  resident: true,
  ...props,
});
const run = (props: {
  kind?: "brief" | "film" | "library";
  scope?: "design" | "source" | "review" | "final";
  branches: readonly string[];
  owners: readonly IAutoMovieLibraryReviewOwner[];
  receipts?: readonly TestReceipt[];
}): Array<{
  code: string;
  category: string;
  phase: string;
  target: string;
  message: string;
}> =>
  libraryReviewEvidenceDiagnostics({
    kind: props.kind ?? "library",
    scope: props.scope ?? "review",
    branches: props.branches,
    owners: props.owners,
    receipts: props.receipts ?? [],
    current: (entry) => {
      if (entry.throws === true) throw new Error("receipt reopen failed");
      return entry.resident !== false;
    },
  });

/**
 * Library review closes the exact design-owner population selected by the
 * authoring binding without turning unused film or brief inventory into work.
 *
 * Scenarios:
 *
 * 1. Model, space, material, instance, motion, and system owners each require
 *    their finite current observation, with structured evidence accepted for a
 *    nonvisual system instead of a film frame.
 * 2. A missing owner, empty or duplicate plan, missing receipt, stale owner
 *    identity, wrong evidence kind, unreadable evidence, failed verdict,
 *    unidentified runtime, and duplicate current receipt each fail at the
 *    exact branch, owner, or observation address with a correction.
 * 3. Review and final enforce the population while design and source do not.
 * 4. Film and brief remain consumer-driven and ignore the library inventory.
 * 5. An inactive branch and an owner excluded from the derived delivery scope
 *    remain residue and do not enter the review denominator.
 */
export const test_production_library_review_evidence = (): void => {
  const owners = [
    owner("models", "chair"),
    owner("models", "rig", "turntable"),
    owner("spaces", "atrium"),
    owner("materials", "oak"),
    owner("instances", "seat-row", "facts"),
    owner("motions", "door-swing", "facts"),
    owner("systems", "room-acoustics", "facts"),
  ];
  const branches = owners.map((entry) => entry.branch);
  const receipts = owners.map((entry) => receipt(entry));
  const stale = receipt(owners[0]!, { identity: identity("2") });
  const wrongEvidence = receipt(owners[0]!, {
    evidence: {
      kind: "facts",
      facts: { observed: owners[0]!.owner },
      digest: digest("4"),
    },
  });
  const failed = receipt(owners[0]!, { verdict: "failed" });
  const unidentified = receipt(owners[0]!, { runtimeIdentity: "  " });
  const missingBranch = run({
    branches: ["models", "spaces"],
    owners: [owners[0]!],
  });
  const emptyPlan = { ...owners[0]!, observations: [] };
  const duplicatePlan = {
    ...owners[0]!,
    observations: [owners[0]!.observations[0]!, owners[0]!.observations[0]!],
  };
  const residue = owner("materials", "not-delivered");

  TestValidator.equals(
    "a library review closes only its derived delivered owner population",
    namedFacts([
      [
        "allBranchesComplete",
        () =>
          run({ branches, owners, receipts }).length === 0 &&
          run({ branches, owners, receipts, scope: "final" }).length === 0,
      ],
      [
        "nonvisualFactsNeedNoFrame",
        () =>
          receipts
            .filter((entry) =>
              ["instances", "motions", "systems"].includes(entry.branch),
            )
            .every((entry) => entry.evidence.kind === "facts"),
      ],
      [
        "canonicalTurntableUsesItsOwnEvidenceKind",
        () => receipts[1]?.evidence.kind === "turntable",
      ],
      [
        "missingOwnerNamesBranch",
        () =>
          missingBranch[0]?.code === "review-evidence-missing" &&
          missingBranch[0]?.category === "error" &&
          missingBranch[0]?.phase === "review" &&
          missingBranch[0]?.target === "library:spaces" &&
          missingBranch[0]?.message.includes("selects no design owner") ===
            true,
      ],
      [
        "emptyPlanRefused",
        () =>
          run({
            branches: ["models"],
            owners: [emptyPlan],
          })[0]?.message.includes("declares no finite review observation") ===
          true,
      ],
      [
        "duplicateOwnerRefused",
        () =>
          run({
            branches: ["models"],
            owners: [owners[0]!, owners[0]!],
          })[0]?.message.includes("selected more than once") === true,
      ],
      [
        "duplicatePlanRefused",
        () =>
          run({
            branches: ["models"],
            owners: [duplicatePlan],
          })[0]?.message.includes("declared more than once") === true,
      ],
      [
        "missingReceiptRefused",
        () =>
          run({
            branches: ["models"],
            owners: [owners[0]!],
          })[0]?.message.includes("has no artifact receipt") === true,
      ],
      [
        "staleReceiptRefused",
        () =>
          run({
            branches: ["models"],
            owners: [owners[0]!],
            receipts: [stale],
          })[0]?.message.includes("is stale") === true,
      ],
      [
        "wrongEvidenceKindRefused",
        () =>
          run({
            branches: ["models"],
            owners: [owners[0]!],
            receipts: [wrongEvidence],
          })[0]?.message.includes("requires artifact evidence") === true,
      ],
      [
        "unreadableEvidenceRefused",
        () =>
          run({
            branches: ["models"],
            owners: [owners[0]!],
            receipts: [receipt(owners[0]!, { resident: false })],
          })[0]?.message.includes("does not reopen") === true,
      ],
      [
        "evidenceReadFailureRefused",
        () =>
          run({
            branches: ["models"],
            owners: [owners[0]!],
            receipts: [receipt(owners[0]!, { throws: true })],
          })[0]?.message.includes("does not reopen") === true,
      ],
      [
        "failedVerdictRefused",
        () =>
          run({
            branches: ["models"],
            owners: [owners[0]!],
            receipts: [failed],
          })[0]?.message.includes("found failed") === true,
      ],
      [
        "unidentifiedRuntimeRefused",
        () =>
          run({
            branches: ["models"],
            owners: [owners[0]!],
            receipts: [unidentified],
          })[0]?.message.includes("runtime-unidentified") === true,
      ],
      [
        "duplicateCurrentReceiptRefused",
        () =>
          run({
            branches: ["models"],
            owners: [owners[0]!],
            receipts: [receipt(owners[0]!), receipt(owners[0]!)],
          })[0]?.message.includes("found passed, passed") === true,
      ],
      [
        "conflictingEvidenceKindRefused",
        () =>
          run({
            branches: ["models"],
            owners: [owners[0]!],
            receipts: [receipt(owners[0]!), wrongEvidence],
          })[0]?.message.includes("found passed") === true,
      ],
      [
        "designAndSourceDoNotEnforce",
        () =>
          run({ branches, owners, scope: "design" }).length === 0 &&
          run({ branches, owners, scope: "source" }).length === 0,
      ],
      [
        "filmAndBriefKeepConsumerRules",
        () =>
          run({ branches, owners, kind: "film" }).length === 0 &&
          run({ branches, owners, kind: "brief" }).length === 0,
      ],
      [
        "inactiveAndExcludedResidueStayOut",
        () =>
          run({
            branches: ["models"],
            owners: [owners[0]!, residue],
            receipts: [receipt(owners[0]!)],
          }).length === 0,
      ],
    ]),
    {
      allBranchesComplete: true,
      nonvisualFactsNeedNoFrame: true,
      canonicalTurntableUsesItsOwnEvidenceKind: true,
      missingOwnerNamesBranch: true,
      emptyPlanRefused: true,
      duplicateOwnerRefused: true,
      duplicatePlanRefused: true,
      missingReceiptRefused: true,
      staleReceiptRefused: true,
      wrongEvidenceKindRefused: true,
      unreadableEvidenceRefused: true,
      evidenceReadFailureRefused: true,
      failedVerdictRefused: true,
      unidentifiedRuntimeRefused: true,
      duplicateCurrentReceiptRefused: true,
      conflictingEvidenceKindRefused: true,
      designAndSourceDoNotEnforce: true,
      filmAndBriefKeepConsumerRules: true,
      inactiveAndExcludedResidueStayOut: true,
    },
  );
};
