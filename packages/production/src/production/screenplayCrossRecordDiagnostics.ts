import type {
  AutoMovieDiagnosticCode,
  IAutoMovieAcceptanceScenario,
  IAutoMovieCompiledContractRealization,
  IAutoMovieDiagnostic,
  IAutoMovieScreenplayCatalogEntry,
  IAutoMovieScreenplayIndex,
  IAutoMovieShotContract,
} from "@automovie/interface";

import type { IAutoMovieProductionDesignGraph } from "./validateProductionDesign";

type CatalogKind = "character" | "faction" | "location";
type BindingKind = "model" | "formation" | "world-landmark";

const expectedBindingKind = (kind: CatalogKind): BindingKind =>
  kind === "character"
    ? "model"
    : kind === "faction"
      ? "formation"
      : "world-landmark";

const geometryProofPassed = (props: {
  claim: string;
  contracts: ReadonlyMap<string, IAutoMovieShotContract>;
  realizations: ReadonlyMap<string, IAutoMovieCompiledContractRealization>;
  proof: Extract<
    IAutoMovieScreenplayIndex["continuity"][number]["proof"],
    { owner: "geometry" }
  >;
}): "absent" | "failed" | "passed" => {
  const contract = props.contracts.get(props.proof.shot);
  const realization = props.realizations.get(props.proof.shot);
  if (
    contract === undefined ||
    realization === undefined ||
    realization.shot !== props.proof.shot ||
    contract.evidence?.some((evidence) => evidence.claim === props.claim) !==
      true
  )
    return "absent";
  const outcome =
    props.proof.outcome.kind === "opening"
      ? realization.opening.find((entry) => entry.id === props.proof.outcome.id)
      : props.proof.outcome.kind === "closing"
        ? realization.closing.find(
            (entry) => entry.id === props.proof.outcome.id,
          )
        : props.proof.outcome.kind === "event"
          ? realization.events.find(
              (entry) => entry.id === props.proof.outcome.id,
            )
          : realization.formations.find(
              (entry) => entry.id === props.proof.outcome.id,
            );
  return outcome === undefined
    ? "absent"
    : outcome.passed
      ? "passed"
      : "failed";
};

/**
 * Whether one acceptance scenario is the exact proof a claim selected.
 *
 * The scenario must be required, cite the claim, address a current target,
 * and carry the proof family the claim declared. A frame-review proof also
 * needs the criterion frame to exist in the owning shot's contract; a film-level
 * frame or event criterion names that shot itself, and a shot-level one may
 * repeat the target shot but never contradict it. The criterion is read once
 * into a local so each discriminated narrowing survives into the callbacks.
 */
const acceptanceProofMatches = (props: {
  claim: string;
  owner: "frame-review" | "acceptance";
  expectedProduction: string;
  scenario: IAutoMovieAcceptanceScenario;
  contracts: ReadonlyMap<string, IAutoMovieShotContract>;
  realizations: ReadonlyMap<string, IAutoMovieCompiledContractRealization>;
}): boolean => {
  const scenario = props.scenario;
  if (
    scenario.required !== true ||
    scenario.evidence?.some((evidence) => evidence.claim === props.claim) !==
      true
  )
    return false;
  const criterion = scenario.criterion;
  const criterionShot =
    criterion.kind === "frame" || criterion.kind === "event"
      ? criterion.shot
      : undefined;
  if (
    (criterion.kind === "frame" || criterion.kind === "event") &&
    (scenario.target.kind === "shot"
      ? criterionShot !== undefined && criterionShot !== scenario.target.id
      : criterionShot === undefined)
  )
    return false;
  if (
    scenario.target.kind === "film" &&
    scenario.target.id !== props.expectedProduction
  )
    return false;
  const shot =
    scenario.target.kind === "shot" ? scenario.target.id : criterionShot;
  if (shot !== undefined && props.realizations.get(shot)?.shot !== shot)
    return false;
  if (props.owner === "acceptance") return true;
  return (
    criterion.kind === "frame" &&
    shot !== undefined &&
    props.contracts
      .get(shot)
      ?.reviewFrames.some((frame) => frame.id === criterion.frame) === true
  );
};

/**
 * Validate screenplay identity, casting and proof against current production.
 *
 * The ledger's internal validator cannot settle these joins because their
 * truth lives in design, compiled realization and current review evidence.
 * This validator receives those exact facts and never performs subjective
 * frame judgement itself.
 */
export const screenplayCrossRecordDiagnostics = (props: {
  expectedProduction: string;
  screenplay: IAutoMovieScreenplayIndex | null;
  graph: IAutoMovieProductionDesignGraph;
  realizations: ReadonlyMap<string, IAutoMovieCompiledContractRealization>;
  /** Whether a scenario has current evidence at its current target identity. */
  currentAcceptanceEvidence: (scenario: string) => boolean;
}): IAutoMovieDiagnostic[] => {
  const screenplay = props.screenplay;
  if (screenplay === null) return [];
  const diagnostics: IAutoMovieDiagnostic[] = [];
  const refuse = (code: AutoMovieDiagnosticCode, message: string): void => {
    diagnostics.push({
      code,
      category: "error",
      phase: "compile",
      target: "screenplay",
      path: null,
      message,
    });
  };
  if (screenplay.production !== props.expectedProduction)
    refuse(
      "screenplay-production-mismatch",
      `The screenplay index belongs to production "${screenplay.production}" while the active compiler owns "${props.expectedProduction}". Production identity compares exactly and cannot be inferred from a path. Open the correct index or repair its owner, then compile again.`,
    );
  if (props.graph.shots.size !== 0 && screenplay.screenplay.lock === null)
    refuse(
      "screenplay-lock-missing",
      "The production has a shot contract while the screenplay lock is null. Contract existence is the first downstream dependency, even before its source realizes successfully. Activate the permanent scene-number ledger, then compile again.",
    );

  const targets: Readonly<Record<BindingKind, ReadonlySet<string>>> = {
    model: new Set(props.graph.models.keys()),
    formation: new Set(props.graph.formations.keys()),
    "world-landmark": new Set(
      props.graph.world?.landmarks.map((landmark) => landmark.id) ?? [],
    ),
  };
  const validBindings: Record<CatalogKind, Map<string, string>> = {
    character: new Map(),
    faction: new Map(),
    location: new Map(),
  };
  const sections: ReadonlyArray<
    readonly [CatalogKind, readonly IAutoMovieScreenplayCatalogEntry[]]
  > = [
    ["character", screenplay.catalog.characters],
    ["faction", screenplay.catalog.factions],
    ["location", screenplay.catalog.locations],
  ];
  for (const [kind, entries] of sections) {
    const expected = expectedBindingKind(kind);
    const downstreamOwners = new Map<string, string>();
    for (const entry of entries) {
      if (entry.bindings.length === 0)
        refuse(
          "screenplay-binding-missing",
          `Required ${kind} "${entry.id}" has no ${expected} binding. Ground the story identity in current design or remove an entry the story no longer requires, then compile again.`,
        );
      for (const binding of entry.bindings) {
        if (binding.kind !== expected) {
          refuse(
            "screenplay-binding-kind-invalid",
            `${kind} "${entry.id}" binds ${binding.kind} "${binding.id}"; this catalog section may bind only ${expected} design. Correct the binding kind and target together, then compile again.`,
          );
          continue;
        }
        if (targets[expected].has(binding.id) === false) {
          refuse(
            "screenplay-binding-target-absent",
            `${kind} "${entry.id}" binds missing ${expected} "${binding.id}". A registry name is not a resident downstream design. Restore the target or correct the binding, then compile again.`,
          );
          continue;
        }
        const prior = downstreamOwners.get(binding.id);
        if (prior !== undefined && prior !== entry.id)
          refuse(
            "screenplay-binding-target-repeated",
            `${kind} identities "${prior}" and "${entry.id}" both bind ${expected} "${binding.id}". One downstream identity cannot silently cast two story identities. Split or correct the binding, then compile again.`,
          );
        else {
          downstreamOwners.set(binding.id, entry.id);
          validBindings[kind].set(binding.id, entry.id);
        }
      }
    }
  }
  for (const [shot, contract] of props.graph.shots)
    for (const participant of contract.participants) {
      const kind: CatalogKind =
        participant.kind === "actor" ? "character" : "faction";
      if (validBindings[kind].has(participant.id) === false)
        refuse(
          "screenplay-binding-missing",
          `Shot "${shot}" stages ${participant.kind} "${participant.id}" without a valid ${kind} catalog binding. Trace the participant back to one story identity before compiling it.`,
        );
    }

  for (const claim of screenplay.continuity) {
    if (claim.proof.owner === "geometry") {
      const result = geometryProofPassed({
        claim: claim.id,
        contracts: props.graph.shots,
        realizations: props.realizations,
        proof: claim.proof,
      });
      if (result !== "passed")
        refuse(
          result === "absent"
            ? "screenplay-continuity-proof-absent"
            : "screenplay-continuity-proof-failed",
          `Continuity claim "${claim.id}" selects ${claim.proof.outcome.kind} outcome "${claim.proof.outcome.id}" in shot "${claim.proof.shot}", but the exact cited compiled outcome is ${result}. Restore the exact claim citation and passing realization rather than borrowing an equal id from another shot.`,
        );
      continue;
    }
    const scenario = props.graph.acceptance.get(claim.proof.scenario);
    if (
      scenario === undefined ||
      acceptanceProofMatches({
        claim: claim.id,
        owner: claim.proof.owner,
        expectedProduction: props.expectedProduction,
        scenario,
        contracts: props.graph.shots,
        realizations: props.realizations,
      }) === false
    ) {
      refuse(
        "screenplay-continuity-proof-absent",
        `Continuity claim "${claim.id}" selects ${claim.proof.owner} scenario "${claim.proof.scenario}", but no matching scenario both cites the claim and carries that proof family. Correct the scenario, criterion and citation, then compile again.`,
      );
      continue;
    }
    if (props.currentAcceptanceEvidence(scenario.id) === false)
      refuse(
        "screenplay-continuity-proof-not-current",
        `Continuity claim "${claim.id}" selects scenario "${scenario.id}" without current evidence at that scenario's current target identity. Historical frames remain history and cannot prove current continuity. Capture and review the current target, then compile again.`,
      );
  }
  return diagnostics;
};
