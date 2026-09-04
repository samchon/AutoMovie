import type {
  IAutoMovieProductionEvidence,
  IAutoMovieProductionEvidenceDesignOwner,
} from "@automovie/evidence";
import type {
  AutoMovieContentDigest,
  AutoMovieGuidePass,
  IAutoMovieBuiltEnvironment,
  IAutoMovieDiagnostic,
  IAutoMovieEnvironmentContext,
  IAutoMovieLibraryReviewOwnerIdentity,
  IAutoMovieLibraryReviewPlanFile,
  IAutoMovieLibraryReviewPopulation,
  IAutoMovieLibraryReviewProjectReader,
  IAutoMovieLibraryReviewResolvedReceipt,
  IAutoMovieLibraryReviewUnitPlan,
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
import {
  autoMovieLibraryObservationRequirements,
  libraryObservationClosureDiagnostics,
  libraryObservationReceiptDiagnostics,
} from "./libraryObservationRequirements";
import { libraryReviewEvidenceDiagnostics } from "./libraryReviewEvidenceDiagnostics";
import { assetReviewEvidenceDiagnostics } from "./reviewEvidenceDiagnostics";

type CompileScope = "design" | "source" | "review" | "final";

interface ILibraryReviewResolverProps {
  authoring: IAutoMovieProductionEvidence;
  project: IAutoMovieLibraryReviewProjectReader;
  compileFingerprint: AutoMovieContentDigest;
  /**
   * Building topology one exact design owner materialized, if any.
   *
   * Optional because a caller holding no materialized artifact has none to
   * hand over, not because the derived population is optional. A caller that
   * does hold one must supply it: the required observations of an owner whose
   * environments are withheld are the empty set, and an empty set is exactly
   * what a shrunk plan looks like from here.
   */
  environments?: (props: {
    branch: string;
    owner: string;
    anchor: string;
  }) => readonly IAutoMovieBuiltEnvironment[];
  /**
   * The adopted worlds one owner published, resolved the same way.
   *
   * Separate from {@link environments} because they are separate publications:
   * a map owner contributes a context and no environment, a space owner the
   * reverse, and an owner that publishes neither is charged by neither. Absent
   * for the same reason the environments resolver is -- withheld, the map
   * population is the empty set, which is exactly what a shrunk plan looks like
   * from here.
   */
  contexts?: (props: {
    branch: string;
    owner: string;
    anchor: string;
  }) => readonly IAutoMovieEnvironmentContext[];
}

interface ILibraryReviewConsumerProps extends ILibraryReviewResolverProps {
  scope: CompileScope;
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

/** Describe an unknown failure without allowing hostile coercion to escape. */
const describeFailure = (failure: unknown): string => {
  try {
    const message = (failure as { message?: unknown }).message;
    return typeof message === "string" ? message : String(failure);
  } catch {
    return "unprintable thrown value";
  }
};

/** Read one strict plan without letting malformed review records crash lint. */
const readPlan = (props: {
  project: IAutoMovieLibraryReviewProjectReader;
  owner: IAutoMovieProductionEvidenceDesignOwner;
}):
  | { success: true; data: IAutoMovieLibraryReviewPlanFile }
  | { success: false; diagnostic: IAutoMovieDiagnostic } => {
  const relative = planPath(props.owner);
  let source: string | null;
  try {
    source = props.project.readProseDocument(relative);
  } catch (error) {
    return {
      success: false,
      diagnostic: missing({
        target: `library:${props.owner.branch}:${props.owner.path}`,
        path: relative,
        message: `Library observation plan "${relative}" cannot be read (${describeFailure(error)}). Restore the tracked plan before review.`,
      }),
    };
  }
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
    return {
      success: true,
      data: parseAutoMovieLibraryReviewPlan(source),
    };
  } catch (error) {
    if (error instanceof TypeError)
      return {
        success: false,
        diagnostic: missing({
          target: `library:${props.owner.branch}:${props.owner.path}`,
          path: relative,
          message: `Library observation plan "${relative}" does not match its exact version-1 schema (${error.message}). Correct the plan instead of letting an ambiguous receipt enter review.`,
        }),
      };
    return {
      success: false,
      diagnostic: missing({
        target: `library:${props.owner.branch}:${props.owner.path}`,
        path: relative,
        message: `Library observation plan "${relative}" is not readable JSON (${describeFailure(error)}). Correct the tracked plan before review.`,
      }),
    };
  }
};

/**
 * Parse one tracked library observation plan against the exact closed schema.
 *
 * The shipped authoring command and compiler consumer share this boundary so
 * preserving receipts can never admit properties the review gate would reject.
 *
 * @evidence requirements/review/subject-inspection.md#review-library-delivery-coverage Refuses malformed plans before either authoring mutation or review aggregation.
 * @evidence specifications/review-and-acceptance/subject-surface-and-inspection.md#review-system-library-delivery-coverage Applies one exact versioned schema at the producer and consumer boundaries.
 * @author Samchon
 */
export const parseAutoMovieLibraryReviewPlan = (
  source: string,
): IAutoMovieLibraryReviewPlanFile => {
  const validation = typia.validateEquals<IAutoMovieLibraryReviewPlanFile>(
    JSON.parse(source) as unknown,
  );
  if (validation.success === true) return validation.data;
  throw new TypeError(
    validation.errors
      .slice(0, 3)
      .map((error) => `${error.path}: expected ${error.expected}`)
      .join("; "),
  );
};

/** Derive one unit identity from its exact H2, source subset, and plan. */
const identityOf = (props: {
  compileFingerprint: AutoMovieContentDigest;
  diagnostics: IAutoMovieDiagnostic[];
  owner: IAutoMovieProductionEvidenceDesignOwner;
  project: IAutoMovieLibraryReviewProjectReader;
  unit: IAutoMovieProductionEvidenceDesignOwner["units"][number];
  plan: IAutoMovieLibraryReviewUnitPlan;
}): IAutoMovieLibraryReviewOwnerIdentity => {
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
  }> = [
    {
      role: "library-review-source-binding",
      kind: props.owner.sourceBinding?.branch ?? "missing",
      payload: canonicalAutoMovieJsonBytes(
        props.owner.sourceBinding === null
          ? null
          : {
              branch: props.owner.sourceBinding.branch,
              stage: props.owner.sourceBinding.stage,
              enforced: props.owner.sourceBinding.enforced,
              root: props.owner.sourceBinding.root,
              files: props.owner.sourceBinding.files,
              symbols: props.owner.sourceBinding.symbols,
            },
      ),
    },
  ];
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
          message: `Library design owner "${ownerAddress(props.owner, props.unit.anchor)}" cannot reopen source "${source}" (${describeFailure(error)}). Restore the exact tracked source before review.`,
        }),
      );
    }
  }
  const waivers = [...(props.plan.waivers ?? [])].sort((left, right) =>
    compareCodeUnits(
      JSON.stringify([left.observation, left.ground, left.disclosedBy]),
      JSON.stringify([right.observation, right.ground, right.disclosedBy]),
    ),
  );
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
        waivers,
      }),
    ),
  };
};

/** Resolve the exact graph-derived library denominator into mechanical plans. */
const resolvePopulation = (
  props: ILibraryReviewResolverProps,
): IAutoMovieLibraryReviewPopulation => {
  const output: IAutoMovieLibraryReviewPopulation = {
    branches: [],
    diagnostics: [],
    owners: [],
    receipts: [],
    required: [],
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
    if (loaded.success === true) {
      const denominators = new Set(owner.units.map((unit) => unit.anchor));
      for (const unit of loaded.data.units)
        if (denominators.has(unit.anchor) === false)
          output.diagnostics.push(
            missing({
              target: `library:${owner.branch}:${owner.path}#${unit.anchor}`,
              path: relative,
              message: `Library observation plan "${relative}" retains unit "${unit.anchor}", which is not an exact current H2 owner in "${owner.path}". Remove or rebind the orphan plan; historical receipt residue cannot enlarge the graph-derived denominator.`,
            }),
          );
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
      const environments =
        props.environments?.({
          branch: owner.branch,
          owner: address,
          anchor: unit.anchor,
        }) ?? [];
      const contexts =
        props.contexts?.({
          branch: owner.branch,
          owner: address,
          anchor: unit.anchor,
        }) ?? [];
      if (owner.branch === "maps" && contexts.length === 0)
        output.diagnostics.push(
          missing({
            target: `library:${owner.branch}:${address}`,
            path: relative,
            message: `Library map owner "${address}" published no environment context, so the compiler cannot derive any map observation from the world this owner adopted. Return the adopted context from this owner's build result before review.`,
          }),
        );
      const required = autoMovieLibraryObservationRequirements(
        environments,
        contexts,
      );
      output.diagnostics.push(
        ...libraryObservationClosureDiagnostics({
          target: `library:${owner.branch}:${address}`,
          path: relative,
          required,
          declared: observations.map((observation) => observation.id),
          waivers: plan.waivers ?? [],
        }),
      );
      // What the plan owes is one question and what came back is another. The
      // closure above judges the first from ids alone; this judges the second
      // from what each receipt says about where it stood and what it read.
      output.diagnostics.push(
        ...libraryObservationReceiptDiagnostics({
          target: `library:${owner.branch}:${address}`,
          path: relative,
          required,
          receipts: plan.receipts,
        }),
      );
      output.required.push(
        ...required.map((entry) => ({
          branch: owner.branch,
          owner: address,
          ...entry,
        })),
      );
      output.owners.push({
        branch: owner.branch,
        owner: address,
        identity,
        observations,
      });
      if (
        owner.branch === "models" &&
        plan.observations.some(
          (observation) => observation.evidence === "turntable",
        ) === false
      )
        output.diagnostics.push(
          missing({
            target: `library:${owner.branch}:${address}`,
            path: relative,
            message: `Library model owner "${address}" declares no canonical whole-model turntable. Add a turntable observation bound to the exact compiled model; an artifact or fact sample cannot replace the fixed model view set.`,
          }),
        );
      for (const observation of plan.observations) {
        if (
          observation.id.trim() === "" ||
          observation.id !== observation.id.trim()
        )
          output.diagnostics.push(
            missing({
              target: `library:${owner.branch}:${address}:${observation.id}`,
              path: relative,
              message: `Library observation id ${JSON.stringify(observation.id)} on "${address}" is blank or not canonically trimmed. Give every finite observation one stable nonblank id before recording evidence.`,
            }),
          );
        if (observation.evidence === "turntable") {
          if (owner.branch !== "models")
            output.diagnostics.push(
              missing({
                target: `library:${owner.branch}:${address}:${observation.id}`,
                path: relative,
                message: `Library ${owner.branch} observation "${observation.id}" cannot use a model turntable as its domain evidence. Declare the finite artifact or structured facts that can falsify this branch instead.`,
              }),
            );
          else if (
            observation.model === undefined ||
            observation.model.trim() === "" ||
            observation.model !== observation.model.trim()
          )
            output.diagnostics.push(
              missing({
                target: `library:${owner.branch}:${address}:${observation.id}`,
                path: relative,
                message: `Library turntable observation "${observation.id}" on "${address}" names no canonical compiled model. Bind the exact trimmed model recipe whose canonical view set this observation pays.`,
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
      }
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
 * `required` carries the half of the denominator nobody authors. Given the
 * building topology an owner materialized, it names every exposed facade, every
 * corner those facades meet at, every roof, underside and opening of the
 * envelope, the unit's own setting view, and the interior stations of each of
 * its rooms, each with the point an eye was proved to stand at. A plan may add
 * observations to that population and may never remove one; an addressed waiver
 * is the only way a derived observation goes unopened.
 *
 * @evidence requirements/review/subject-inspection.md#review-subject-evidence Binds each library observation to the current design, source, compile, and plan identities.
 * @evidence requirements/review/subject-inspection.md#review-library-delivery-coverage Exposes the exact graph-derived owner and finite observation populations without promoting inactive residue.
 * @evidence specifications/review-and-acceptance/subject-surface-and-inspection.md#review-system-subject-freshness Derives the current freshness identity before an observation receipt is written.
 * @evidence specifications/review-and-acceptance/README.md#review-acceptance-system-boundary Reopens compiler-derived library subjects and their exact planned evidence without creating a stored approval or waiver service.
 * @evidenceExclude specifications/review-and-acceptance/README.md#review-acceptance-document-map The documentation index organizes the contract corpus and is not a runtime obligation of this library population reader.
 * @evidence specifications/review-and-acceptance/subject-surface-and-inspection.md#review-system-library-delivery-coverage Keeps the planned population distinct from received and reopened evidence.
 * @author Samchon
 */
export const readAutoMovieLibraryReviewRequirements = (
  props: ILibraryReviewResolverProps,
): IAutoMovieLibraryReviewPopulation =>
  props.authoring.manifest.kind === "library"
    ? resolvePopulation(props)
    : {
        branches: [],
        diagnostics: [],
        owners: [],
        receipts: [],
        required: [],
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
  receipt: IAutoMovieLibraryReviewResolvedReceipt;
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
    return (
      digestAutoMovieBytes(
        canonicalAutoMovieJsonBytes(props.receipt.evidence.facts),
      ) === props.receipt.evidence.digest
    );
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
 * `readAutoMovieProductionEvidence`; this consumer carries no map, model,
 * space, material, instance, motion, or system table. Each adjacent plan selects its
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
