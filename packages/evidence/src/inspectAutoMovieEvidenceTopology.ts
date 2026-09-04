/**
 * One branch participating in a declared authoring foundation topology.
 *
 * @evidence requirements/production-evidence/graph.md#agent-production-evidence-shape-stage Makes branch activity and authoring order explicit topology inputs.
 * @evidence specifications/production-evidence/graph.md#spec-authoring-production-evidence-shape-stage Represents one branch in the selected production state machine.
 * @author Samchon
 */
export interface IAutoMovieEvidenceTopologyBranch {
  /** Stable branch name. */
  name: string;
  /** Whether the branch is part of the selected production. */
  active: boolean;
  /** Explicit authoring order; equal values mean one coordinated stage. */
  order: number;
}

/**
 * One canonical provider-to-consumer relationship.
 *
 * @evidence requirements/production-evidence/graph.md#agent-production-evidence-shared-contract Keeps foundation ownership in the shared topology instead of copied prose.
 * @evidence specifications/production-evidence/graph.md#spec-authoring-production-evidence-shared-contract Defines one expected foundation edge and its coordinated-stage exception.
 * @author Samchon
 */
export interface IAutoMovieEvidenceTopologyEdge {
  /** Foundation branch whose reviewed population is consumed. */
  provider: string;
  /** Branch accountable for that foundation. */
  consumer: string;
  /** Whether both branches may be promoted in one coordinated stage. */
  simultaneous?: boolean;
}

/**
 * One account-owned declaration of a foundation relationship or absence.
 *
 * @evidence requirements/production-evidence/graph.md#agent-production-evidence-shared-contract Makes a population account the visible owner of one foundation decision.
 * @evidence specifications/production-evidence/graph.md#spec-authoring-production-evidence-shared-contract Distinguishes a positive consumer from a reviewed inapplicable edge.
 * @author Samchon
 */
export interface IAutoMovieEvidenceTopologyDeclaration {
  /** Foundation branch named by the account. */
  provider: string;
  /** Consuming branch named by the account. */
  consumer: string;
  /** Positive use or an explicit inapplicable relationship. */
  status: "inapplicable" | "uses";
  /** Concrete semantic reason reviewed by the author. */
  reason: string;
}

/**
 * One deterministic structural defect in a topology account.
 *
 * @evidence requirements/production-evidence/graph.md#agent-production-evidence-deterministic-result Names the exact edge and repair direction for every topology defect.
 * @evidence specifications/production-evidence/graph.md#spec-authoring-production-evidence-deterministic-result Defines the closed diagnostic result emitted before graph publication.
 * @author Samchon
 */
export interface IAutoMovieEvidenceTopologyDiagnostic {
  /** Stable defect identity. */
  code:
    | "disabled-residue"
    | "duplicate-declaration"
    | "extra-provider"
    | "invalid-reason"
    | "missing-consumer"
    | "unknown-branch"
    | "wrong-order";
  /** Consuming branch, when one was addressable. */
  consumer: string;
  /** Provider branch, when one was addressable. */
  provider: string;
  /** Actionable account correction. */
  message: string;
}

/**
 * Inspects an account-owned foundation topology against its canonical matrix.
 *
 * @evidence requirements/production-evidence/graph.md#agent-production-evidence-shape-stage Keeps selected and disabled foundation relationships distinguishable.
 * @evidence requirements/production-evidence/graph.md#agent-production-evidence-deterministic-result Reports every missing, extra, stale, or misordered relationship in stable order.
 * @evidence specifications/production-evidence/graph.md#spec-authoring-production-evidence-shape-stage Validates provider and consumer state against the declared production branches.
 * @evidence specifications/production-evidence/graph.md#spec-authoring-production-evidence-deterministic-result Produces a complete diagnostic set instead of accepting a partial topology.
 * @author Samchon
 */
export function inspectAutoMovieEvidenceTopology(props: {
  branches: readonly IAutoMovieEvidenceTopologyBranch[];
  expected: readonly IAutoMovieEvidenceTopologyEdge[];
  declarations: readonly IAutoMovieEvidenceTopologyDeclaration[];
}): readonly IAutoMovieEvidenceTopologyDiagnostic[] {
  const diagnostics: IAutoMovieEvidenceTopologyDiagnostic[] = [];
  const branches = new Map(
    props.branches.map((branch) => [branch.name, branch]),
  );
  const expected = new Map(
    props.expected.map((edge) => [
      identity(edge.provider, edge.consumer),
      edge,
    ]),
  );
  const declarations = new Map<string, IAutoMovieEvidenceTopologyDeclaration>();
  for (const declaration of props.declarations) {
    const key = identity(declaration.provider, declaration.consumer);
    const previous = declarations.get(key);
    if (previous !== undefined) {
      diagnostics.push(
        diagnostic(
          "duplicate-declaration",
          declaration,
          `${key} is declared more than once.`,
        ),
      );
      continue;
    }
    declarations.set(key, declaration);
    const provider = branches.get(declaration.provider);
    const consumer = branches.get(declaration.consumer);
    if (provider === undefined || consumer === undefined) {
      diagnostics.push(
        diagnostic(
          "unknown-branch",
          declaration,
          `${key} names a branch outside the selected topology.`,
        ),
      );
      continue;
    }
    if (declaration.reason.trim() === "")
      diagnostics.push(
        diagnostic(
          "invalid-reason",
          declaration,
          `${key} requires a non-empty semantic reason.`,
        ),
      );
    const edge = expected.get(key);
    if (edge === undefined)
      diagnostics.push(
        diagnostic(
          "extra-provider",
          declaration,
          `${declaration.provider} is not a foundation of ${declaration.consumer}.`,
        ),
      );
    if ((!provider.active || !consumer.active) && declaration.status === "uses")
      diagnostics.push(
        diagnostic(
          "disabled-residue",
          declaration,
          `${key} remains positive while one of its branches is disabled.`,
        ),
      );
    if (
      declaration.status === "uses" &&
      provider.active &&
      consumer.active &&
      provider.order >= consumer.order &&
      !(edge?.simultaneous === true && provider.order === consumer.order)
    )
      diagnostics.push(
        diagnostic(
          "wrong-order",
          declaration,
          `${declaration.provider} must be reviewed before ${declaration.consumer}.`,
        ),
      );
  }
  for (const edge of props.expected) {
    const provider = branches.get(edge.provider);
    const consumer = branches.get(edge.consumer);
    if (provider === undefined || consumer === undefined) continue;
    const declaration = declarations.get(
      identity(edge.provider, edge.consumer),
    );
    if (
      declaration === undefined ||
      (provider.active && consumer.active && declaration.status !== "uses")
    )
      diagnostics.push(
        diagnostic(
          "missing-consumer",
          edge,
          declaration === undefined
            ? `${edge.consumer} does not declare foundation ${edge.provider} as used or inapplicable.`
            : `${edge.consumer} does not account for active foundation ${edge.provider}.`,
        ),
      );
  }
  return diagnostics.sort((left, right) =>
    compare(
      `${left.consumer}\0${left.provider}\0${left.code}`,
      `${right.consumer}\0${right.provider}\0${right.code}`,
    ),
  );
}

const identity = (provider: string, consumer: string): string =>
  `${provider}->${consumer}`;
const diagnostic = (
  code: IAutoMovieEvidenceTopologyDiagnostic["code"],
  edge: Pick<IAutoMovieEvidenceTopologyEdge, "consumer" | "provider">,
  message: string,
): IAutoMovieEvidenceTopologyDiagnostic => ({
  code,
  consumer: edge.consumer,
  provider: edge.provider,
  message,
});
const compare = (left: string, right: string): number =>
  Number(left > right) - Number(left < right);
