import {
  IAutoMovieAcceptanceScenario,
  IAutoMovieBuildProjectInput,
  IAutoMovieCompiledContractRealization,
  IAutoMovieDiagnostic,
  IAutoMovieScreenplayIndex,
  IAutoMovieShotContract,
} from "@automovie/interface";

/**
 * Every active scene must be realized by a shot that actually compiled.
 *
 * The screenplay is the only join the builder did not own, so a scene could
 * sit in the index forever with nothing built against it and every gate stayed
 * green. Intent is not realization: a shot contract that cites a scene proves
 * the author meant to cover it, and only a passing compiled realization proves
 * the film does.
 *
 * Scope decides severity, on the precedent `film-runtime-mismatch` sets. A film
 * being built sequence by sequence has uncovered scenes by construction, so
 * `source` reports the gap and lets the work continue; `review` and `final`
 * refuse, because a film presented for review is claiming to be whole.
 *
 * `OMITTED` tombstones are skipped. They exist precisely to record a scene the
 * production dropped without renumbering the ones around it.
 */
export const screenplayCoverageDiagnostics = (props: {
  acceptance: ReadonlyMap<string, IAutoMovieAcceptanceScenario>;
  contracts: ReadonlyMap<string, IAutoMovieShotContract>;
  realizations: ReadonlyMap<string, IAutoMovieCompiledContractRealization>;
  scope: IAutoMovieBuildProjectInput["scope"];
  screenplay: IAutoMovieScreenplayIndex | null;
}): IAutoMovieDiagnostic[] => {
  if (props.screenplay === null) return [];
  const realized = new Set<string>();
  for (const [id, contract] of props.contracts) {
    if (props.realizations.get(id) === undefined) continue;
    for (const evidence of contract.evidence ?? [])
      realized.add(evidence.scene);
  }
  // A `production`-phase disposition is the index's own way of exempting a
  // scene from shot realization with an auditable reason, so honouring it is
  // the difference between a coverage gate and a demand that every scene be
  // shot. Tombstones need no exemption; they are not active.
  // A required acceptance scenario citing a scene is what claims that scene was
  // observed. The claim is a declaration in the ledger and this set is coverage
  // over declarations, not over pixels: whether the frames behind it exist is
  // asked by `review-evidence-missing`, and whether anyone looked at them is
  // stated in the evidence citation on the source that realizes the shot.
  const observed = new Set<string>();
  for (const scenario of props.acceptance.values()) {
    if (scenario.required !== true) continue;
    for (const evidence of scenario.evidence ?? [])
      observed.add(evidence.scene);
  }
  const diagnostics: IAutoMovieDiagnostic[] = [];
  // A ledger asserting both absence and realization contradicts itself, and
  // the contradiction is not a scope-dependent "not yet": it is wrong the
  // moment both records exist.
  for (const scene of props.screenplay.screenplay.scenes) {
    const claimed = realized.has(scene.id) || observed.has(scene.id);
    if (claimed === false) continue;
    if (scene.status === "OMITTED")
      diagnostics.push({
        code: "screenplay-tombstone-realized",
        category: "error",
        phase: "compile",
        target: "screenplay",
        path: null,
        message: `Scene "${scene.id}" is an OMITTED tombstone, yet a compiled realization or a required acceptance scenario cites it. The ledger asserts both absence and realized work. Remove the downstream claim or reactivate the scene, then compile again.`,
      });
    else if (scene.disposition !== null)
      diagnostics.push({
        code: "screenplay-disposition-realized",
        category: "error",
        phase: "compile",
        target: "screenplay",
        path: null,
        message: `Scene "${scene.id}" is exempted at the ${scene.disposition.phase} phase, yet a compiled realization or a required acceptance scenario cites it. Intentional omission and realized work contradict each other. Remove the disposition or the downstream claim, then compile again.`,
      });
  }
  const active = props.screenplay.screenplay.scenes.filter(
    (scene) =>
      scene.status === "active" && scene.disposition?.phase !== "production",
  );
  // Observation is the review scopes' bar, not authoring's. A film being built
  // has scenes nobody has looked at yet by construction; a film presented for
  // review is claiming somebody did.
  const unobserved =
    props.scope === "review" || props.scope === "final"
      ? active.filter((scene) => observed.has(scene.id) === false)
      : [];
  if (unobserved.length !== 0)
    diagnostics.push({
      code: "screenplay-scene-unobserved",
      category: "error",
      phase: "compile",
      target: "screenplay",
      path: null,
      message: `Active ${unobserved.length === 1 ? "scene" : "scenes"} ${unobserved
        .map((scene) => `"${scene.id}"`)
        .join(
          ", ",
        )} ${unobserved.length === 1 ? "has" : "have"} no required acceptance scenario citing them. A compiled realization is not an observation, so nothing here was ever looked at. Author a required acceptance scenario citing the scene, or record a phase-local disposition, then compile again.`,
    });
  const uncovered = active.filter((scene) => realized.has(scene.id) === false);
  if (uncovered.length === 0) return diagnostics;
  return [
    ...diagnostics,
    {
      code: "screenplay-scene-unrealized",
      category: props.scope === "source" ? "warning" : "error",
      phase: "compile",
      target: "screenplay",
      path: null,
      message: `Active ${uncovered.length === 1 ? "scene" : "scenes"} ${uncovered
        .map((scene) => `"${scene.id}"`)
        .join(
          ", ",
        )} ${uncovered.length === 1 ? "has" : "have"} no shot with a passing compiled realization.${
        props.scope === "source"
          ? " The film does not cover its screenplay yet; it must before review."
          : " Build and compile a citing shot, or record the scene as OMITTED."
      }`,
    },
  ];
};

/**
 * A resident shot contract requires a resident screenplay index.
 *
 * Shot ids join to scene ids, so a shot written before the ledger exists is
 * citing numbering nothing has fixed yet. This is residency only: the index is
 * never decoded here, so a structurally valid but empty ledger still counts as
 * present and its content is judged by the checks that own it.
 *
 * A project with no shot contracts is silent, which is what keeps a fresh
 * scaffold and a design-only session from being told to author a screenplay
 * before there is anything to join it to.
 */
export const screenplayResidencyDiagnostics = (props: {
  contracts: ReadonlyMap<string, IAutoMovieShotContract>;
  screenplay: IAutoMovieScreenplayIndex | null;
}): IAutoMovieDiagnostic[] =>
  props.screenplay !== null || props.contracts.size === 0
    ? []
    : [
        {
          code: "screenplay-index-missing",
          category: "error",
          phase: "compile",
          target: "screenplay",
          path: null,
          message: `${props.contracts.size} shot contract(s) are resident with no screenplay index. Their scene citations join to numbering that does not exist, so nothing downstream can be traced to authored work. Author the screenplay index, then compile again.`,
        },
      ];
