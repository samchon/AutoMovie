import type {
  IAutoMovieProductionEvidence,
  IAutoMovieProductionEvidenceDesignOwner,
} from "@automovie/evidence";
import type {
  AutoMovieContentDigest,
  AutoMovieGuidePass,
  IAutoMovieDiagnostic,
  IAutoMovieRenderBundleManifest,
} from "@automovie/interface";
import typia from "typia";

import { autoMovieAssetReviewViews } from "./assetReviewViews";
import {
  canonicalAutoMovieJsonBytes,
  compareCodeUnits,
  digestAutoMovieBytes,
  fingerprintAutoMovieFields,
  normalizeAutoMovieSource,
} from "./contentIdentity";
import { libraryReviewEvidenceDiagnostics } from "./libraryReviewEvidenceDiagnostics";
import { assetReviewEvidenceDiagnostics } from "./reviewEvidenceDiagnostics";

type CompileScope = "design" | "source" | "review" | "final";
type EvidenceKind = "artifact" | "facts" | "turntable";

interface ILibraryReviewOwnerIdentity {
  design: AutoMovieContentDigest;
  source: AutoMovieContentDigest;
  generated: AutoMovieContentDigest | null;
  plan: AutoMovieContentDigest;
}

interface ILibraryReviewArtifactEvidence {
  kind: "artifact";
  root: "project" | "render";
  path: string;
  digest: AutoMovieContentDigest;
}

interface ILibraryReviewFactsEvidence {
  kind: "facts";
  facts: unknown;
  digest: AutoMovieContentDigest;
}

interface ILibraryReviewTurntableEvidence {
  kind: "turntable";
  model: string;
}

type LibraryReviewEvidence =
  | ILibraryReviewArtifactEvidence
  | ILibraryReviewFactsEvidence
  | ILibraryReviewTurntableEvidence;

interface ILibraryReviewObservationPlan {
  id: string;
  evidence: EvidenceKind;
  model?: string;
}

interface ILibraryReviewObservationReceipt {
  observation: string;
  evidence: LibraryReviewEvidence;
  identity: ILibraryReviewOwnerIdentity;
  runtimeIdentity: string;
  verdict: "failed" | "not-run" | "passed" | "unsupported";
}

interface ILibraryReviewUnitPlan {
  anchor: string;
  sources: string[];
  observations: ILibraryReviewObservationPlan[];
  receipts: ILibraryReviewObservationReceipt[];
}

interface ILibraryReviewPlanFile {
  version: 1;
  units: ILibraryReviewUnitPlan[];
}

interface ILibraryReviewProjectReader {
  root: string;
  readProseDocument(path: string): string | null;
  readRenderFile(path: string): Uint8Array;
  readSource(path: string): Uint8Array;
}

interface IResolvedLibraryReviewOwner {
  branch: string;
  owner: string;
  identity: ILibraryReviewOwnerIdentity;
  observations: Array<{ id: string; evidence: EvidenceKind }>;
}

interface IResolvedLibraryReviewReceipt extends ILibraryReviewObservationReceipt {
  branch: string;
  owner: string;
}

interface IResolvedLibraryReviewPopulation {
  branches: string[];
  diagnostics: IAutoMovieDiagnostic[];
  owners: IResolvedLibraryReviewOwner[];
  receipts: IResolvedLibraryReviewReceipt[];
  turntables: Array<{
    branch: string;
    owner: string;
    observation: string;
    model: string;
  }>;
}

interface ILibraryReviewConsumerProps {
  authoring: IAutoMovieProductionEvidence;
  project: ILibraryReviewProjectReader;
  scope: CompileScope;
  compileFingerprint: AutoMovieContentDigest;
  modelExists: (model: string) => boolean;
  rigged: (model: string) => boolean;
  fingerprint: (
    target: IAutoMovieRenderBundleManifest["target"],
  ) => AutoMovieContentDigest | null;
  captured: (
    target: IAutoMovieRenderBundleManifest["target"],
    fingerprint: AutoMovieContentDigest,
  ) => ReadonlyArray<{ time: number; pass: AutoMovieGuidePass }>;
}

interface ILibraryReviewResolverProps {
  authoring: IAutoMovieProductionEvidence;
  project: ILibraryReviewProjectReader;
  compileFingerprint: AutoMovieContentDigest;
}

/** One review-phase refusal at the exact library authoring address. */
const missing = (props: {
  target: string;
  path?: string | null;
  message: string;
}): IAutoMovieDiagnostic => ({
  code: "review-evidence-missing",
  category: "error",
  phase: "review",
  target: props.target,
  path: props.path ?? null,
  message: props.message,
});

/** Adjacent tracked plan and receipt file for one design document. */
const planPath = (owner: IAutoMovieProductionEvidenceDesignOwner): string =>
  owner.path.replace(/\.md$/u, ".review.json");

/** Stable design-owner unit address used by plans, receipts, and diagnostics. */
const ownerAddress = (
  owner: IAutoMovieProductionEvidenceDesignOwner,
  anchor: string,
): string => `${owner.path}#${anchor}`;

/** Stable observation address inside one resolved design owner. */
const observationAddress = (
  branch: string,
  owner: string,
  observation: string,
): string => JSON.stringify([branch, owner, observation]);

/** Read one strict plan without letting malformed review records crash lint. */
const readPlan = (props: {
  project: ILibraryReviewProjectReader;
  owner: IAutoMovieProductionEvidenceDesignOwner;
}):
  | { success: true; data: ILibraryReviewPlanFile }
  | { success: false; diagnostic: IAutoMovieDiagnostic } => {
  const relative = planPath(props.owner);
  const source = props.project.readProseDocument(relative);
  if (source === null)
    return {
      success: false,
      diagnostic: missing({
        target: `library:${props.owner.branch}:${props.owner.path}`,
        path: relative,
        message: `Library design document "${props.owner.path}" has no adjacent finite observation plan at "${relative}". Declare each H2 owner's source files, bounded observations, and current receipts before review; a reviewed Markdown file alone proves no observation occurred.`,
      }),
    };
  try {
    const validation = typia.validateEquals<ILibraryReviewPlanFile>(
      JSON.parse(source) as unknown,
    );
    if (validation.success === true) return validation;
    return {
      success: false,
      diagnostic: missing({
        target: `library:${props.owner.branch}:${props.owner.path}`,
        path: relative,
        message: `Library observation plan "${relative}" does not match its exact version-1 schema (${validation.errors
          .slice(0, 3)
          .map((error) => `${error.path}: expected ${error.expected}`)
          .join(
            "; ",
          )}). Correct the plan instead of letting an ambiguous receipt enter review.`,
      }),
    };
  } catch (error) {
    return {
      success: false,
      diagnostic: missing({
        target: `library:${props.owner.branch}:${props.owner.path}`,
        path: relative,
        message: `Library observation plan "${relative}" is not readable JSON (${error instanceof Error ? error.message : String(error)}). Correct the tracked plan before review.`,
      }),
    };
  }
};

/** Derive one unit identity from its exact H2, source subset, and plan. */
const identityOf = (props: {
  compileFingerprint: AutoMovieContentDigest;
  diagnostics: IAutoMovieDiagnostic[];
  owner: IAutoMovieProductionEvidenceDesignOwner;
  project: ILibraryReviewProjectReader;
  unit: IAutoMovieProductionEvidenceDesignOwner["units"][number];
  plan: ILibraryReviewUnitPlan;
}): ILibraryReviewOwnerIdentity => {
  const target = `library:${props.owner.branch}:${ownerAddress(
    props.owner,
    props.unit.anchor,
  )}`;
  const population = new Set(props.owner.sourceBinding?.paths ?? []);
  const sources = [...props.plan.sources].sort(compareCodeUnits);
  if (sources.length === 0)
    props.diagnostics.push(
      missing({
        target,
        path: planPath(props.owner),
        message: `Library design owner "${ownerAddress(props.owner, props.unit.anchor)}" names no source owner. Bind at least one exact tracked file from its manifest-derived source population; review cannot infer implementation from a design heading.`,
      }),
    );
  const seen = new Set<string>();
  const sourceFields: Array<{
    role: string;
    kind: string;
    payload: Uint8Array;
  }> = [];
  for (const source of sources) {
    if (source.trim() === "" || source.includes("\\") || seen.has(source)) {
      props.diagnostics.push(
        missing({
          target,
          path: planPath(props.owner),
          message: `Library design owner "${ownerAddress(props.owner, props.unit.anchor)}" has an empty, non-POSIX, or duplicate source address ${JSON.stringify(source)}. Keep one exact project-relative source path per owner input.`,
        }),
      );
      continue;
    }
    seen.add(source);
    if (population.has(source) === false) {
      props.diagnostics.push(
        missing({
          target,
          path: planPath(props.owner),
          message: `Library design owner "${ownerAddress(props.owner, props.unit.anchor)}" names source "${source}", which is outside the active manifest-derived ${props.owner.sourceBinding?.branch ?? "missing"} population. Correct the source lineage rather than widening review by hand.`,
        }),
      );
      continue;
    }
    try {
      sourceFields.push({
        role: "library-review-source",
        kind: source,
        payload: normalizeAutoMovieSource(props.project.readSource(source)),
      });
    } catch (error) {
      props.diagnostics.push(
        missing({
          target,
          path: source,
          message: `Library design owner "${ownerAddress(props.owner, props.unit.anchor)}" cannot reopen source "${source}" (${error instanceof Error ? error.message : String(error)}). Restore the exact tracked source before review.`,
        }),
      );
    }
  }
  const observations = [...props.plan.observations].sort((left, right) =>
    compareCodeUnits(
      JSON.stringify([left.id, left.evidence, left.model ?? null]),
      JSON.stringify([right.id, right.evidence, right.model ?? null]),
    ),
  );
  return {
    design: `sha256:${props.unit.digest}` as AutoMovieContentDigest,
    source: fingerprintAutoMovieFields(sourceFields),
    generated: props.compileFingerprint,
    plan: digestAutoMovieBytes(
      canonicalAutoMovieJsonBytes({
        anchor: props.unit.anchor,
        sources: [...seen].sort(compareCodeUnits),
        observations,
      }),
    ),
  };
};

/** Resolve the exact graph-derived library denominator into mechanical plans. */
const resolvePopulation = (
  props: ILibraryReviewResolverProps,
): IResolvedLibraryReviewPopulation => {
  const output: IResolvedLibraryReviewPopulation = {
    branches: [],
    diagnostics: [],
    owners: [],
    receipts: [],
    turntables: [],
  };
  const eligible = new Set<string>();
  for (const branch of props.authoring.designBranches) {
    const target = `library:${branch.branch}`;
    if (branch.designStage !== "review") {
      output.diagnostics.push(
        missing({
          target,
          message: `Library design branch "${branch.branch}" is active at ${JSON.stringify(branch.designStage)} rather than review. Finish and review its exact owner population before asking the production review or final gate to pass.`,
        }),
      );
      continue;
    }
    if (
      branch.sourceBinding === null ||
      branch.sourceBinding.stage !== "review" ||
      branch.sourceBinding.enforced === false
    ) {
      output.diagnostics.push(
        missing({
          target,
          message: `Library design branch "${branch.branch}" has no enforced reviewed source lineage. Review the manifest-derived source branch before recording observations; a design document without current realization is not a delivered library owner.`,
        }),
      );
      continue;
    }
    eligible.add(branch.branch);
    output.branches.push(branch.branch);
  }
  output.branches.sort(compareCodeUnits);

  const cachedPlans = new Map<string, ReturnType<typeof readPlan>>();
  for (const owner of props.authoring.designOwners) {
    if (eligible.has(owner.branch) === false) continue;
    const relative = planPath(owner);
    let loaded = cachedPlans.get(relative);
    if (loaded === undefined) {
      loaded = readPlan({ project: props.project, owner });
      cachedPlans.set(relative, loaded);
      if (loaded.success === false) output.diagnostics.push(loaded.diagnostic);
    }
    for (const unit of owner.units) {
      const address = ownerAddress(owner, unit.anchor);
      const candidates =
        loaded.success === true
          ? loaded.data.units.filter((entry) => entry.anchor === unit.anchor)
          : [];
      if (candidates.length !== 1) {
        if (loaded.success === true)
          output.diagnostics.push(
            missing({
              target: `library:${owner.branch}:${address}`,
              path: relative,
              message: `Library design owner "${address}" has ${candidates.length} matching unit plans in "${relative}". Keep exactly one plan for every exact H2 denominator; a missing or duplicate plan cannot define current review.`,
            }),
          );
        output.owners.push({
          branch: owner.branch,
          owner: address,
          identity: {
            design: `sha256:${unit.digest}` as AutoMovieContentDigest,
            source: fingerprintAutoMovieFields([]),
            generated: props.compileFingerprint,
            plan: digestAutoMovieBytes(canonicalAutoMovieJsonBytes(null)),
          },
          observations: [],
        });
        continue;
      }
      const plan = candidates[0]!;
      const identity = identityOf({
        compileFingerprint: props.compileFingerprint,
        diagnostics: output.diagnostics,
        owner,
        project: props.project,
        unit,
        plan,
      });
      const observations = plan.observations.map((observation) => ({
        id: observation.id,
        evidence: observation.evidence,
      }));
      output.owners.push({
        branch: owner.branch,
        owner: address,
        identity,
        observations,
      });
      for (const observation of plan.observations)
        if (observation.evidence === "turntable") {
          if (
            observation.model === undefined ||
            observation.model.trim() === ""
          )
            output.diagnostics.push(
              missing({
                target: `library:${owner.branch}:${address}:${observation.id}`,
                path: relative,
                message: `Library turntable observation "${observation.id}" on "${address}" names no compiled model. Bind the exact model recipe whose canonical view set this observation pays.`,
              }),
            );
          else
            output.turntables.push({
              branch: owner.branch,
              owner: address,
              observation: observation.id,
              model: observation.model,
            });
        } else if (observation.model !== undefined)
          output.diagnostics.push(
            missing({
              target: `library:${owner.branch}:${address}:${observation.id}`,
              path: relative,
              message: `Library ${observation.evidence} observation "${observation.id}" on "${address}" carries a model field that only a canonical turntable may use. Remove the ambiguous field or select turntable evidence.`,
            }),
          );
      for (const receipt of plan.receipts)
        output.receipts.push({
          branch: owner.branch,
          owner: address,
          ...receipt,
        });
    }
  }
  return output;
};

/**
 * Read the exact current owner identities and finite observation denominator
 * that a library receipt must pay.
 *
 * An offline observation command uses this result before it writes a receipt;
 * the compiler then derives the same result independently at review and final.
 * The function intentionally returns an empty population for film and brief,
 * whose review denominator continues to come from compiled consumers.
 *
 * @evidence requirements/review/subject-inspection.md#review-subject-evidence Binds each library observation to the current design, source, compile, and plan identities.
 * @evidence requirements/review/subject-inspection.md#review-library-delivery-coverage Exposes the exact graph-derived owner and finite observation populations without promoting inactive residue.
 * @evidence specifications/review-and-acceptance/subject-surface-and-inspection.md#review-system-subject-freshness Derives the current freshness identity before an observation receipt is written.
 * @evidence specifications/review-and-acceptance/subject-surface-and-inspection.md#review-system-library-delivery-coverage Keeps the planned population distinct from received and reopened evidence.
 * @author Samchon
 */
export const readAutoMovieLibraryReviewRequirements = (
  props: ILibraryReviewResolverProps,
): IResolvedLibraryReviewPopulation =>
  props.authoring.manifest.kind === "library"
    ? resolvePopulation(props)
    : {
        branches: [],
        diagnostics: [],
        owners: [],
        receipts: [],
        turntables: [],
      };

/** Whether one exact turntable requirement has its canonical current views. */
const turntableCurrent = (
  props: ILibraryReviewConsumerProps,
  model: string,
): boolean => {
  if (props.modelExists(model) === false) return false;
  for (const view of autoMovieAssetReviewViews({
    rigged: props.rigged(model),
  })) {
    const target = {
      kind: "asset",
      id: model,
      angleDeg: view.angleDeg,
      elevationDeg: view.elevationDeg,
      pose: view.pose,
    } as const;
    const fingerprint = props.fingerprint(target);
    if (
      fingerprint === null ||
      props
        .captured(target, fingerprint)
        .some((entry) => entry.pass === view.pass) === false
    )
      return false;
  }
  return true;
};

/** Reopen one receipt's exact physical evidence without trusting its assertion. */
const receiptCurrent = (props: {
  consumer: ILibraryReviewConsumerProps;
  expectedTurntables: ReadonlyMap<string, string>;
  receipt: IResolvedLibraryReviewReceipt;
}): boolean => {
  if (props.receipt.evidence.kind === "turntable")
    return (
      props.expectedTurntables.get(
        observationAddress(
          props.receipt.branch,
          props.receipt.owner,
          props.receipt.observation,
        ),
      ) === props.receipt.evidence.model &&
      turntableCurrent(props.consumer, props.receipt.evidence.model)
    );
  if (props.receipt.evidence.kind === "facts")
    try {
      return (
        digestAutoMovieBytes(
          canonicalAutoMovieJsonBytes(props.receipt.evidence.facts),
        ) === props.receipt.evidence.digest
      );
    } catch {
      return false;
    }
  try {
    const bytes =
      props.receipt.evidence.root === "render"
        ? props.consumer.project.readRenderFile(props.receipt.evidence.path)
        : (() => {
            const text = props.consumer.project.readProseDocument(
              props.receipt.evidence.path,
            );
            if (text === null) throw new Error("project artifact is absent");
            return Buffer.from(text, "utf8");
          })();
    return digestAutoMovieBytes(bytes) === props.receipt.evidence.digest;
  } catch {
    return false;
  }
};

/**
 * Close a generated library's graph-derived design owners against current
 * finite observations while leaving film and brief review populations alone.
 *
 * The branch and H2 denominator comes only from
 * `readAutoMovieProductionEvidence`; this consumer carries no model, space,
 * material, instance, motion, or system table. Each adjacent plan selects its
 * exact source subset and finite observations. Receipt identity binds the H2,
 * source bytes, current compile generation, and observation plan, while the
 * evidence body is reopened independently as canonical facts, exact project or
 * render bytes, or the compiler's fixed whole-model turntable set.
 *
 * @evidence requirements/review/subject-inspection.md#review-observable-judgeable-parity Refuses a delivered library owner whose declared observation cannot be reopened.
 * @evidence requirements/review/subject-inspection.md#review-subject-evidence Invalidates receipts after their design, source, compile, plan, artifact, or runtime basis changes.
 * @evidence requirements/review/subject-inspection.md#review-library-delivery-coverage Charges every exact active library owner while leaving film staging semantics unchanged.
 * @evidence specifications/review-and-acceptance/subject-surface-and-inspection.md#review-system-subject-target-parity Maps every selected design owner to independently checkable observation evidence.
 * @evidence specifications/review-and-acceptance/subject-surface-and-inspection.md#review-system-subject-freshness Reopens evidence against the current multi-part owner identity.
 * @evidence specifications/review-and-acceptance/subject-surface-and-inspection.md#review-system-library-delivery-coverage Computes completeness over the graph-derived plan instead of filesystem residue.
 * @author Samchon
 */
export const libraryReviewEvidenceConsumerDiagnostics = (
  props: ILibraryReviewConsumerProps,
): IAutoMovieDiagnostic[] => {
  if (
    props.authoring.manifest.kind !== "library" ||
    (props.scope !== "review" && props.scope !== "final")
  )
    return [];
  if (props.authoring.root !== props.project.root)
    return [
      missing({
        target: "library:authoring-binding",
        message: `Production authoring evidence belongs to "${props.authoring.root}", not the compiler project "${props.project.root}". Read the tracked productionEvidence declaration from this exact project before review.`,
      }),
    ];
  const population = readAutoMovieLibraryReviewRequirements(props);
  const expectedTurntables = new Map(
    population.turntables.map((entry) => [
      observationAddress(entry.branch, entry.owner, entry.observation),
      entry.model,
    ]),
  );
  const turntableModels = [
    ...new Set(population.turntables.map((entry) => entry.model)),
  ].sort(compareCodeUnits);
  return [
    ...population.diagnostics,
    ...libraryReviewEvidenceDiagnostics({
      kind: "library",
      scope: props.scope,
      branches: population.branches,
      owners: population.owners,
      receipts: population.receipts,
      current: (receipt) =>
        receiptCurrent({
          consumer: props,
          expectedTurntables,
          receipt,
        }),
    }),
    ...assetReviewEvidenceDiagnostics({
      consumed: turntableModels,
      rigged: props.rigged,
      scope: props.scope,
      fingerprint: props.fingerprint,
      captured: props.captured,
    }),
  ];
};
