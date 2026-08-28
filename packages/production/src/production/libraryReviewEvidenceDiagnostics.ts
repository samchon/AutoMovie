import type {
  AutoMovieContentDigest,
  IAutoMovieDiagnostic,
} from "@automovie/interface";

import { compareCodeUnits } from "./contentIdentity";

/** One current identity shared by an owner's plan and every receipt for it. */
interface ILibraryReviewOwnerIdentity {
  design: AutoMovieContentDigest;
  source: AutoMovieContentDigest;
  generated: AutoMovieContentDigest | null;
  plan: AutoMovieContentDigest;
}

/** One finite observation selected by a design owner's reviewed plan. */
interface ILibraryReviewObservationRequirement {
  id: string;
  evidence: "artifact" | "facts";
}

/** One design owner delivered by the derived authoring binding. */
interface ILibraryReviewOwner {
  branch: string;
  owner: string;
  identity: ILibraryReviewOwnerIdentity;
  observations: readonly ILibraryReviewObservationRequirement[];
}

/** One persisted observation offered as evidence for a library owner. */
interface ILibraryReviewObservationReceipt {
  branch: string;
  owner: string;
  observation: string;
  evidence:
    | {
        kind: "artifact";
        path: string;
        digest: AutoMovieContentDigest;
      }
    | {
        kind: "facts";
        facts: unknown;
        digest: AutoMovieContentDigest;
      };
  identity: ILibraryReviewOwnerIdentity;
  runtimeIdentity: string;
  verdict: "failed" | "not-run" | "passed" | "unsupported";
}

/** Whether two owner identities describe the same reviewed generation. */
const sameIdentity = (
  left: ILibraryReviewOwnerIdentity,
  right: ILibraryReviewOwnerIdentity,
): boolean =>
  left.design === right.design &&
  left.source === right.source &&
  left.generated === right.generated &&
  left.plan === right.plan;

/** Stable address of one delivered design owner. */
const ownerKey = (branch: string, owner: string): string =>
  JSON.stringify([branch, owner]);

/** Stable address of one observation inside a delivered design owner. */
const observationKey = (
  branch: string,
  owner: string,
  observation: string,
): string => `${ownerKey(branch, owner)}\0${observation}`;

/**
 * Refuse a reviewed library while any selected design owner lacks current,
 * conclusive evidence for its finite observation plan.
 *
 * The active branch and owner populations are inputs rather than another list
 * in this package. The evidence graph and generated project router derive that
 * population from one authoring binding; this gate only closes it against
 * physical receipts. Film and brief keep their consumer-derived review rules,
 * so an unstaged recipe in either shape never becomes review work merely
 * because it exists in inventory.
 *
 * Artifact and structured-fact receipts share the same freshness rule. A
 * caller reopens the exact evidence through `current`; a path, exit code, or
 * receipt assertion cannot declare itself current. Historical receipts remain
 * visible to classify a missing observation as stale without being promoted to
 * the current generation.
 */
export function libraryReviewEvidenceDiagnostics(props: {
  /** Production shape selected by the derived authoring binding. */
  kind: "brief" | "film" | "library";
  /** Compile scope; only review and final judge physical evidence. */
  scope: "design" | "source" | "review" | "final";
  /** Active reviewed design branches from the derived authoring binding. */
  branches: readonly string[];
  /** Exact delivered design-owner population selected by that binding. */
  owners: readonly ILibraryReviewOwner[];
  /** Historical and current persisted observation receipts. */
  receipts: readonly ILibraryReviewObservationReceipt[];
  /** Reopen one receipt's exact artifact bytes or structured facts. */
  current: (receipt: ILibraryReviewObservationReceipt) => boolean;
}): IAutoMovieDiagnostic[] {
  if (
    props.kind !== "library" ||
    (props.scope !== "review" && props.scope !== "final")
  )
    return [];

  const diagnostics: IAutoMovieDiagnostic[] = [];
  const branches = [...new Set(props.branches)].sort(compareCodeUnits);
  const active = new Set(branches);
  const owners = props.owners
    .filter((owner) => active.has(owner.branch))
    .slice()
    .sort((left, right) =>
      compareCodeUnits(
        ownerKey(left.branch, left.owner),
        ownerKey(right.branch, right.owner),
      ),
    );

  const ownersByBranch = new Map<string, number>();
  const ownerCounts = new Map<string, number>();
  for (const owner of owners) {
    ownersByBranch.set(
      owner.branch,
      (ownersByBranch.get(owner.branch) ?? 0) + 1,
    );
    const key = ownerKey(owner.branch, owner.owner);
    ownerCounts.set(key, (ownerCounts.get(key) ?? 0) + 1);
  }

  for (const branch of branches)
    if ((ownersByBranch.get(branch) ?? 0) === 0)
      diagnostics.push({
        code: "review-evidence-missing",
        category: "error",
        phase: "review",
        target: `library:${branch}`,
        path: null,
        message: `Library design branch "${branch}" is active at review but its derived delivery scope selects no design owner. Correct the reviewed authoring binding or disable the branch; an empty owner population is not complete library review.`,
      });

  const inspectedOwners = new Set<string>();
  for (const owner of owners) {
    const key = ownerKey(owner.branch, owner.owner);
    if (inspectedOwners.has(key)) continue;
    inspectedOwners.add(key);
    if (ownerCounts.get(key) !== 1) {
      diagnostics.push({
        code: "review-evidence-missing",
        category: "error",
        phase: "review",
        target: `library:${owner.branch}:${owner.owner}`,
        path: null,
        message: `Library design owner "${owner.owner}" is selected more than once in branch "${owner.branch}". Keep one derived owner identity and one finite observation plan; duplicate owners make review coverage ambiguous.`,
      });
      continue;
    }

    const requirements = owner.observations
      .slice()
      .sort((left, right) => compareCodeUnits(left.id, right.id));
    if (requirements.length === 0) {
      diagnostics.push({
        code: "review-evidence-missing",
        category: "error",
        phase: "review",
        target: `library:${owner.branch}:${owner.owner}`,
        path: null,
        message: `Library design owner "${owner.owner}" in branch "${owner.branch}" declares no finite review observation. Declare the bounded views, samples, controls, or measurements that can falsify this delivered owner; a reviewed source with an empty plan was not observed.`,
      });
      continue;
    }

    const requirementCounts = new Map<string, number>();
    for (const requirement of requirements)
      requirementCounts.set(
        requirement.id,
        (requirementCounts.get(requirement.id) ?? 0) + 1,
      );
    const inspectedRequirements = new Set<string>();
    for (const requirement of requirements) {
      if (inspectedRequirements.has(requirement.id)) continue;
      inspectedRequirements.add(requirement.id);
      const target = `library:${owner.branch}:${owner.owner}:${requirement.id}`;
      if (requirementCounts.get(requirement.id) !== 1) {
        diagnostics.push({
          code: "review-evidence-missing",
          category: "error",
          phase: "review",
          target,
          path: null,
          message: `Library review observation "${requirement.id}" is declared more than once by design owner "${owner.owner}" in branch "${owner.branch}". Keep one typed requirement per stable observation id so evidence has one denominator.`,
        });
        continue;
      }

      const candidates = props.receipts.filter(
        (receipt) =>
          observationKey(receipt.branch, receipt.owner, receipt.observation) ===
          observationKey(owner.branch, owner.owner, requirement.id),
      );
      if (candidates.length === 0) {
        diagnostics.push({
          code: "review-evidence-missing",
          category: "error",
          phase: "review",
          target,
          path: null,
          message: `Library design owner "${owner.owner}" in branch "${owner.branch}" has no ${requirement.evidence} receipt for required observation "${requirement.id}". Produce that exact observation from the current owner and plan before review.`,
        });
        continue;
      }

      const currentIdentity = candidates.filter((receipt) =>
        sameIdentity(receipt.identity, owner.identity),
      );
      if (currentIdentity.length === 0) {
        diagnostics.push({
          code: "review-evidence-missing",
          category: "error",
          phase: "review",
          target,
          path: null,
          message: `Library review observation "${requirement.id}" for design owner "${owner.owner}" is stale. Reproduce it after the current design, source, generated output, and observation-plan identities are bound; historical evidence does not complete the current library.`,
        });
        continue;
      }

      const correctlyTyped = currentIdentity.filter(
        (receipt) => receipt.evidence.kind === requirement.evidence,
      );
      if (correctlyTyped.length === 0) {
        diagnostics.push({
          code: "review-evidence-missing",
          category: "error",
          phase: "review",
          target,
          path: null,
          message: `Library review observation "${requirement.id}" for design owner "${owner.owner}" requires ${requirement.evidence} evidence, but its current receipt records another evidence kind. Produce the declared artifact or structured facts; one kind cannot impersonate the other.`,
        });
        continue;
      }

      const reopened = correctlyTyped.filter((receipt) => {
        try {
          return props.current(receipt);
        } catch {
          return false;
        }
      });
      if (reopened.length === 0) {
        diagnostics.push({
          code: "review-evidence-missing",
          category: "error",
          phase: "review",
          target,
          path: null,
          message: `Library review observation "${requirement.id}" for design owner "${owner.owner}" does not reopen as the exact current ${requirement.evidence} evidence named by its receipt. Restore or reproduce the evidence bytes or structured facts; file existence and an exit code are not observations.`,
        });
        continue;
      }

      const conclusive = reopened.filter(
        (receipt) =>
          receipt.runtimeIdentity.trim().length !== 0 &&
          receipt.verdict === "passed",
      );
      if (
        currentIdentity.length !== 1 ||
        correctlyTyped.length !== 1 ||
        reopened.length !== 1 ||
        conclusive.length !== 1
      ) {
        const verdicts = reopened
          .map((receipt) =>
            receipt.runtimeIdentity.trim().length === 0
              ? "runtime-unidentified"
              : receipt.verdict,
          )
          .sort(compareCodeUnits)
          .join(", ");
        diagnostics.push({
          code: "review-evidence-missing",
          category: "error",
          phase: "review",
          target,
          path: null,
          message: `Library review observation "${requirement.id}" for design owner "${owner.owner}" has no single current passed receipt with a named tool/runtime identity (found ${verdicts}). Correct a failed, unsupported, not-run, unidentified, or ambiguous result; its existence cannot complete review.`,
        });
      }
    }
  }
  return diagnostics;
}
