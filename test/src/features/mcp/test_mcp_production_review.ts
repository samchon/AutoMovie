import {
  IAutoMoviePrepareReviewOutput,
  IAutoMovieReviewCheck,
  IAutoMovieReviewEvidence,
  IAutoMovieReviewTarget,
  IAutoMovieSubmitReviewInput,
} from "@automovie/interface";
import {
  AutoMovieProductionCompiler,
  AutoMovieProductionOracleService,
  AutoMovieProductionProject,
  AutoMovieProductionReviewService,
} from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";

import {
  acceptanceScenarios,
  productionDesign,
  productionFixture,
  shotContract,
  testCaptureRuntimeIdentity,
} from "./productionFixtures";

const evidenceOf = (
  project: AutoMovieProductionProject,
  prepared: IAutoMoviePrepareReviewOutput,
  selectorIndex = 0,
): IAutoMovieReviewEvidence => {
  const target = prepared.target;
  if (target.kind === "design") {
    const selectors = prepared.quotable.filter(
      (item) => item.kind === "design",
    );
    const selector = selectors[selectorIndex % selectors.length];
    if (selector?.kind !== "design")
      throw new Error("design fixture has no quotable pointer");
    const resolved = resolveReviewPointer(
      project.design(target.design),
      selector.pointer,
    );
    return {
      ...selector,
      exactValue: resolved,
    };
  }
  if (target.kind === "source") {
    const selectors = prepared.quotable.filter(
      (item) => item.kind === "source",
    );
    const selector = selectors[selectorIndex % selectors.length];
    if (selector?.kind !== "source")
      throw new Error("source fixture has no quotable line");
    const exactText = fs
      .readFileSync(path.join(project.root, selector.path), "utf8")
      .replace(/\r\n?/g, "\n")
      .split("\n")[selector.line - 1]!;
    return { ...selector, exactText };
  }
  const frame = prepared.frames[0];
  if (frame === undefined) throw new Error("visual fixture has no frame");
  return frameEvidenceOf(frame);
};

const resolveReviewPointer = (root: unknown, pointer: string): unknown => {
  if (pointer === "") return root;
  let current = root;
  for (const encoded of pointer.slice(1).split("/")) {
    const key = encoded.replace(/~1/g, "/").replace(/~0/g, "~");
    current = (current as Record<string, unknown>)[key];
  }
  return current;
};

const frameEvidenceOf = (
  frame: IAutoMoviePrepareReviewOutput["frames"][number],
): IAutoMovieReviewEvidence => {
  return {
    kind: "frame",
    shot: frame.shot,
    reviewFrame: frame.reviewFrame,
    bundle: frame.bundle,
    frame: frame.frame,
    time: frame.time,
    pass: frame.pass,
    digest: frame.digest,
  };
};

const worksheet = (
  project: AutoMovieProductionProject,
  prepared: IAutoMoviePrepareReviewOutput,
  complete = true,
): IAutoMovieSubmitReviewInput => {
  const graph = project.graph();
  const visualTarget =
    prepared.target.kind === "shot" || prepared.target.kind === "film"
      ? prepared.target
      : null;
  const requiredAcceptance =
    visualTarget !== null
      ? [...graph.acceptance.values()]
          .filter(
            (scenario) =>
              scenario.required &&
              (visualTarget.kind === "film" ||
                (scenario.target.kind === "shot" &&
                  scenario.target.id === visualTarget.id) ||
                ((scenario.criterion.kind === "frame" ||
                  scenario.criterion.kind === "event") &&
                  scenario.criterion.shot === visualTarget.id)),
          )
          .sort((left, right) => left.id.localeCompare(right.id))
      : [];
  const checks: IAutoMovieReviewCheck[] = prepared.requiredCriteria.map(
    (criterion, index) => {
      const acceptanceEvidence =
        criterion === "acceptance-scenarios"
          ? requiredAcceptance.flatMap((scenario) => {
              const scenarioCriterion = scenario.criterion;
              const contractEvidence: IAutoMovieReviewEvidence = {
                kind: "acceptance",
                scenario: scenario.id,
                exactValue: scenario,
              };
              if (scenarioCriterion.kind !== "frame") {
                const outcome = prepared.outcomes.find(
                  (item) => item.scenario === scenario.id,
                );
                return outcome === undefined
                  ? [contractEvidence]
                  : [
                      contractEvidence,
                      {
                        kind: "outcome" as const,
                        scenario: scenario.id,
                        exactValue: outcome,
                      },
                    ];
              }
              const shot =
                scenarioCriterion.shot ??
                (scenario.target.kind === "shot"
                  ? scenario.target.id
                  : undefined);
              const frame = prepared.frames.find(
                (item) =>
                  item.shot === shot &&
                  item.reviewFrame === scenarioCriterion.frame &&
                  item.pass === scenarioCriterion.pass,
              );
              return frame === undefined
                ? [contractEvidence]
                : [frameEvidenceOf(frame), contractEvidence];
            })
          : [evidenceOf(project, prepared, index)];
      return {
        criterion,
        verdict: complete || index !== 0 ? "pass" : "revise",
        observation: `${criterion} current evidence observation ${index}`,
        evidence: acceptanceEvidence,
        ...(criterion === "acceptance-scenarios"
          ? {
              acceptanceScenarios: requiredAcceptance.map(
                (scenario) => scenario.id,
              ),
            }
          : {}),
      };
    },
  );
  return {
    target: prepared.target,
    preparedFingerprint: prepared.fingerprint,
    observations: "The current target was inspected against exact evidence.",
    checks,
    corrections: complete
      ? []
      : [
          {
            owner: "source",
            target: "src/shots/opening.ts",
            problem: "A deliberate review-round marker remains.",
            expected: "The marker is removed and evidence is prepared again.",
          },
        ],
    completionBasis: prepared.requiredCriteria.join(", "),
    complete,
  };
};

const captureBytes = (width = 16, height = 16): Uint8Array => {
  const png = new PNG({ width, height });
  png.data.fill(200);
  png.data[0] = 0;
  return PNG.sync.write(png);
};

/** Review records require current exact design, source and actual PNG evidence. */
export const test_mcp_production_review = async (): Promise<void> => {
  const fixture = productionFixture();
  try {
    const project = AutoMovieProductionProject.open(fixture.root);
    const review = new AutoMovieProductionReviewService(project);
    const optionalAcceptance = {
      ...acceptanceScenarios()[0]!,
      id: "optional-opening-note",
      required: false,
    };
    TestValidator.predicate(
      "optional acceptance contracts do not become mandatory review targets",
      project.setAcceptanceScenario(optionalAcceptance).accepted &&
        review
          .queue()
          .entries.every(
            (entry) =>
              !(
                entry.target.kind === "design" &&
                entry.target.design.kind === "acceptance" &&
                entry.target.design.id === optionalAcceptance.id
              ),
          ) &&
        project.eraseDesignArtifact({
          kind: "acceptance",
          id: optionalAcceptance.id,
        }).accepted,
    );
    const eventAcceptance = {
      id: "opening-event",
      target: { kind: "shot" as const, id: "opening" },
      criterion: {
        kind: "event" as const,
        shot: "opening",
        event: "signal-raised",
        expectation: "The signal raise remains present in the compiled event.",
      },
      required: true,
    };
    TestValidator.predicate(
      "required non-frame acceptance remains reviewable without fake pixels",
      project.setAcceptanceScenario(eventAcceptance).accepted,
    );
    const metricAcceptance = {
      id: "opening-runtime",
      target: { kind: "shot" as const, id: "opening" },
      criterion: {
        kind: "metric" as const,
        metric: "runtime-seconds" as const,
        operator: "==" as const,
        value: 6,
      },
      required: true,
    };
    TestValidator.predicate(
      "runtime acceptance is stored as a measured contract",
      project.setAcceptanceScenario(metricAcceptance).accepted,
    );
    const metricMaximumAcceptance = {
      ...metricAcceptance,
      id: "opening-runtime-maximum",
      criterion: {
        ...metricAcceptance.criterion,
        operator: "<=" as const,
      },
    };
    const metricMinimumAcceptance = {
      ...metricAcceptance,
      id: "opening-runtime-minimum",
      criterion: {
        ...metricAcceptance.criterion,
        operator: ">=" as const,
      },
    };
    const filmMetricAcceptance = {
      ...metricAcceptance,
      id: "film-runtime",
      target: { kind: "film" as const, id: "fixture-film" },
    };
    const repeatedEventAcceptance = {
      ...eventAcceptance,
      id: "opening-event-repeated",
    };
    const implicitShotEventAcceptance = {
      id: "opening-event-implicit-shot",
      target: { kind: "shot" as const, id: "opening" },
      criterion: {
        kind: "event" as const,
        event: "signal-raised",
        expectation:
          "A shot-scoped event resolves its owner from the review target.",
      },
      required: true,
    };
    TestValidator.predicate(
      "all metric operators, film sums and repeated event reads are resident contracts",
      [
        metricMaximumAcceptance,
        metricMinimumAcceptance,
        filmMetricAcceptance,
        repeatedEventAcceptance,
        implicitShotEventAcceptance,
      ].every((scenario) => project.setAcceptanceScenario(scenario).accepted),
    );
    const aliasedReviewFrameShot = shotContract();
    aliasedReviewFrameShot.reviewFrames.push({
      id: "signal-apex-alternate-criterion",
      time: 2,
      passes: ["beauty"],
    });
    TestValidator.predicate(
      "one physical frame may witness two distinct semantic review-frame ids",
      project.setShotContract(aliasedReviewFrameShot).accepted,
    );
    const compiler = new AutoMovieProductionCompiler(
      project,
      (status, snapshot) => review.queue(status, snapshot),
    );
    const compiledStatus = compiler.compile({ scope: "source" });
    TestValidator.predicate("review fixture compiles", compiledStatus.success);
    const missingVisual = review.prepare({
      target: { kind: "shot", id: "opening" },
    });
    TestValidator.predicate(
      "visual review preparation requires current PNG evidence",
      missingVisual.diagnostics.some(
        (diagnostic) => diagnostic.code === "review-evidence-missing",
      ),
    );
    const missingFrameDiagnostic = missingVisual.diagnostics.find(
      (item) => item.code === "review-evidence-missing",
    )!;
    review.submit({
      target: { kind: "shot", id: "opening" },
      preparedFingerprint: missingVisual.fingerprint,
      observations: "No current visual evidence exists.",
      checks: missingVisual.requiredCriteria.map((criterion, index) => ({
        criterion,
        verdict: "revise",
        observation: `Missing frame criterion ${index}.`,
        evidence: [
          {
            kind: "diagnostic",
            code: missingFrameDiagnostic.code,
            path: "",
            actual: missingFrameDiagnostic.message,
          },
        ],
      })),
      corrections: [
        {
          owner: "render",
          target: "shot:opening",
          problem: "No current frame is available.",
          expected: "Capture and prepare a current beauty frame.",
        },
      ],
      completionBasis: "Visual evidence is missing.",
      complete: false,
    });
    const oracle = new AutoMovieProductionOracleService(
      project,
      async (input) => {
        const width = input.width ?? 16;
        const height = input.height ?? 16;
        return {
          bytes: captureBytes(width, height),
          runtimeIdentity: testCaptureRuntimeIdentity(),
          width,
          height,
        };
      },
    );
    const thumbnail = await oracle.preview({
      target: { kind: "shot", id: "opening" },
      time: 2,
      pass: "beauty",
      width: 8,
      height: 8,
    });
    TestValidator.predicate(
      "a small diagnostic thumbnail remains capturable without becoming exact review evidence",
      thumbnail.captured,
    );
    for (const pass of ["beauty", "mask", "pose"] as const)
      TestValidator.predicate(
        `actual frame for ${pass}`,
        (
          await oracle.preview({
            target: { kind: "shot", id: "opening" },
            time: 2,
            pass,
            width: 16,
            height: 16,
          })
        ).captured,
      );
    const aliasedFrameEvidence = review.prepare({
      target: { kind: "shot", id: "opening" },
    });
    TestValidator.predicate(
      "coincident review frames retain both semantic identities",
      aliasedFrameEvidence.diagnostics.every(
        (diagnostic) => diagnostic.category !== "error",
      ) &&
        aliasedFrameEvidence.frames.filter((frame) => frame.pass === "beauty")
          .length === 2 &&
        new Set(
          aliasedFrameEvidence.frames
            .filter((frame) => frame.pass === "beauty")
            .map((frame) => frame.reviewFrame),
        ).size === 2,
    );
    TestValidator.predicate(
      "event and runtime outcomes are compiler-derived and currently passing",
      [
        eventAcceptance.id,
        repeatedEventAcceptance.id,
        implicitShotEventAcceptance.id,
        metricAcceptance.id,
        metricMaximumAcceptance.id,
        metricMinimumAcceptance.id,
      ].every((scenario) =>
        aliasedFrameEvidence.outcomes.some(
          (outcome) => outcome.scenario === scenario && outcome.passed,
        ),
      ),
    );
    const staleOutcomeWorksheet = worksheet(project, aliasedFrameEvidence);
    const outcomeEvidence = staleOutcomeWorksheet.checks
      .find((check) => check.criterion === "acceptance-scenarios")!
      .evidence.find((evidence) => evidence.kind === "outcome");
    if (outcomeEvidence?.kind !== "outcome")
      throw new Error("shot worksheet has no compiler-derived outcome");
    outcomeEvidence.exactValue = {
      ...outcomeEvidence.exactValue,
      passed: !outcomeEvidence.exactValue.passed,
    };
    TestValidator.predicate(
      "submitted outcome evidence must still equal current compiler facts",
      review
        .submit(staleOutcomeWorksheet)
        .diagnostics.some((item) => item.code === "review-evidence-stale"),
    );
    const residentReadGenerated = project.readGeneratedFile;
    const reviewWithFixedStatus = new AutoMovieProductionReviewService(
      project,
      () => compiledStatus,
    );
    project.readGeneratedFile = ((relativePath: string) => {
      if (
        relativePath.startsWith("realizations/") &&
        new Error("realization outcome stack").stack?.includes(
          "readRealization",
        )
      )
        return Buffer.from("{}");
      return residentReadGenerated.call(project, relativePath);
    }) as typeof project.readGeneratedFile;
    const missingEventOutcome = reviewWithFixedStatus.prepare({
      target: { kind: "shot", id: "opening" },
    });
    project.readGeneratedFile = ((relativePath: string) => {
      if (
        relativePath.startsWith("realizations/") &&
        new Error("realization outcome stack").stack?.includes(
          "readRealization",
        )
      )
        return Buffer.from("{bad");
      return residentReadGenerated.call(project, relativePath);
    }) as typeof project.readGeneratedFile;
    const malformedEventOutcome = reviewWithFixedStatus.prepare({
      target: { kind: "shot", id: "opening" },
    });
    project.readGeneratedFile = ((relativePath: string) => {
      if (
        relativePath.startsWith("shots/") &&
        new Error("compiled outcome stack").stack?.includes("readCompiled")
      )
        return Buffer.from("{bad");
      return residentReadGenerated.call(project, relativePath);
    }) as typeof project.readGeneratedFile;
    const missingMetricOutcome = reviewWithFixedStatus.prepare({
      target: { kind: "shot", id: "opening" },
    });
    project.readGeneratedFile = ((relativePath: string) => {
      if (
        relativePath.startsWith("shots/") &&
        new Error("compiled outcome stack").stack?.includes("readCompiled")
      )
        return Buffer.from("{}");
      return residentReadGenerated.call(project, relativePath);
    }) as typeof project.readGeneratedFile;
    const invalidMetricOutcome = reviewWithFixedStatus.prepare({
      target: { kind: "shot", id: "opening" },
    });
    project.readGeneratedFile = residentReadGenerated;
    const residentGraph = project.graph;
    const currentGraph = residentGraph.call(project);
    const openingContract = currentGraph.shots.get("opening")!;
    const graphWithMissingFirst = {
      ...currentGraph,
      shots: new Map([
        [
          "review-missing-shot",
          { ...openingContract, id: "review-missing-shot" },
        ],
        ...currentGraph.shots,
      ]),
    };
    project.graph = (() => graphWithMissingFirst) as typeof project.graph;
    const incompleteFilmMetricOutcome = reviewWithFixedStatus.prepare({
      target: { kind: "film", id: "fixture-film" },
    });
    project.graph = residentGraph;
    const ambiguousEventFile = path.join(
      fixture.root,
      ".automovie/design/acceptance/ambiguous-film-event.json",
    );
    fs.writeFileSync(
      ambiguousEventFile,
      JSON.stringify({
        id: "ambiguous-film-event",
        target: { kind: "film", id: "fixture-film" },
        criterion: {
          kind: "event",
          event: "signal-raised",
          expectation: "An owning shot is deliberately absent.",
        },
        required: true,
      }),
    );
    const ambiguousEventOutcome = reviewWithFixedStatus.prepare({
      target: { kind: "film", id: "fixture-film" },
    });
    fs.rmSync(ambiguousEventFile);
    TestValidator.predicate(
      "missing, malformed and unscoped compiler outcomes fail review preparation",
      [
        missingEventOutcome,
        malformedEventOutcome,
        missingMetricOutcome,
        invalidMetricOutcome,
        incompleteFilmMetricOutcome,
        ambiguousEventOutcome,
      ].every((prepared) =>
        prepared.diagnostics.some(
          (diagnostic) => diagnostic.code === "review-outcome-missing",
        ),
      ),
    );
    const contractOnlyWorksheet = worksheet(project, aliasedFrameEvidence);
    const acceptanceCheck = contractOnlyWorksheet.checks.find(
      (check) => check.criterion === "acceptance-scenarios",
    )!;
    acceptanceCheck.evidence = acceptanceCheck.evidence.filter(
      (evidence) => evidence.kind !== "outcome",
    );
    const contractOnlyResult = review.submit(contractOnlyWorksheet);
    TestValidator.predicate(
      "event and metric contracts cannot replace passing measured outcomes",
      contractOnlyResult.accepted === false &&
        contractOnlyResult.diagnostics.filter(
          (diagnostic) =>
            diagnostic.code === "review-acceptance-coverage-incomplete",
        ).length >= 2,
    );
    const acceptanceTarget = {
      kind: "design" as const,
      design: { kind: "acceptance" as const, id: "opening-beauty" },
    };
    const beforeAcceptanceChange = {
      shot: review.prepare({
        target: { kind: "shot", id: "opening" },
      }).fingerprint,
      film: review.prepare({
        target: { kind: "film", id: "fixture-film" },
      }).fingerprint,
      design: review.prepare({ target: acceptanceTarget }).fingerprint,
    };
    const changedAcceptance = acceptanceScenarios()[0]!;
    if (changedAcceptance.criterion.kind !== "frame")
      throw new Error("starter acceptance must remain a frame criterion");
    changedAcceptance.criterion.expectation += " Changed.";
    const acceptanceMutation = project.setAcceptanceScenario(changedAcceptance);
    TestValidator.equals(
      "accepted acceptance bytes become current design truth",
      project.design(acceptanceTarget.design),
      changedAcceptance,
    );
    compiler.compile({ scope: "source" });
    const afterAcceptanceChange = {
      shot: review.prepare({
        target: { kind: "shot", id: "opening" },
      }).fingerprint,
      film: review.prepare({
        target: { kind: "film", id: "fixture-film" },
      }).fingerprint,
      design: review.prepare({ target: acceptanceTarget }).fingerprint,
    };
    TestValidator.predicate(
      "acceptance change is committed",
      acceptanceMutation.accepted,
    );
    TestValidator.notEquals(
      "acceptance change stales its own design review fingerprint",
      beforeAcceptanceChange.design,
      afterAcceptanceChange.design,
    );
    TestValidator.notEquals(
      "acceptance change stales its addressed shot review fingerprint",
      beforeAcceptanceChange.shot,
      afterAcceptanceChange.shot,
    );
    TestValidator.notEquals(
      "acceptance change stales the whole-film review fingerprint",
      beforeAcceptanceChange.film,
      afterAcceptanceChange.film,
    );
    project.setAcceptanceScenario(acceptanceScenarios()[0]!);
    compiler.compile({ scope: "source" });

    const filmSourcePath = path.join(fixture.root, "src/film.ts");
    const filmSourceBytes = fs.readFileSync(filmSourcePath);
    const beforeFilmSourceChange = {
      shot: review.prepare({
        target: { kind: "shot", id: "opening" },
      }).fingerprint,
      film: review.prepare({
        target: { kind: "film", id: "fixture-film" },
      }).fingerprint,
    };
    fs.appendFileSync(
      filmSourcePath,
      "\n// Changed editorial source must retire the whole-film review.\n",
    );
    compiler.compile({ scope: "source" });
    const afterFilmSourceChange = {
      shot: review.prepare({
        target: { kind: "shot", id: "opening" },
      }).fingerprint,
      film: review.prepare({
        target: { kind: "film", id: "fixture-film" },
      }).fingerprint,
    };
    fs.writeFileSync(filmSourcePath, filmSourceBytes);
    compiler.compile({ scope: "source" });
    TestValidator.equals(
      "unrelated editorial source preserves a target-identical shot review",
      beforeFilmSourceChange.shot,
      afterFilmSourceChange.shot,
    );
    TestValidator.notEquals(
      "aggregate editorial source change stales the whole-film review",
      beforeFilmSourceChange.film,
      afterFilmSourceChange.film,
    );

    const sourceTarget = {
      kind: "source" as const,
      path: "src/shots/opening.ts",
    };
    const sourcePrepared = review.prepare({ target: sourceTarget });
    const revise = review.submit(worksheet(project, sourcePrepared, false));
    TestValidator.predicate(
      "an evidenced revise worksheet remains incomplete",
      revise.accepted && revise.state === "revise",
    );
    const incompleteSheet = worksheet(project, sourcePrepared, false);
    incompleteSheet.checks.forEach((check) => {
      check.verdict = "pass";
    });
    const incomplete = review.submit(incompleteSheet);
    TestValidator.predicate(
      "an actionable unfinished worksheet has an incomplete state",
      incomplete.accepted && incomplete.state === "incomplete",
    );
    const contradictory = worksheet(project, sourcePrepared);
    contradictory.checks[0]!.verdict = "revise";
    contradictory.corrections.push({
      owner: "source",
      target: "x",
      problem: "x",
      expected: "x",
    });
    TestValidator.predicate(
      "complete cannot contradict revise or corrections",
      review.submit(contradictory).accepted === false,
    );
    const unaccounted = worksheet(project, sourcePrepared, false);
    unaccounted.checks[0]!.verdict = "pass";
    unaccounted.corrections = [];
    TestValidator.predicate(
      "incomplete requires an actionable reason",
      review
        .submit(unaccounted)
        .diagnostics.some((item) => item.code === "review-self-contradiction"),
    );

    const malformed = worksheet(project, sourcePrepared);
    malformed.observations = " ";
    malformed.completionBasis = " ";
    malformed.checks = [
      {
        criterion: "wrong",
        verdict: "pass",
        observation: " ",
        evidence: [],
        acceptanceScenarios: ["opening-beauty"],
      },
      {
        criterion: "duplicate",
        verdict: "pass",
        observation: "same",
        evidence: [evidenceOf(project, sourcePrepared)],
      },
      {
        criterion: "duplicate-again",
        verdict: "pass",
        observation: "same",
        evidence: [evidenceOf(project, sourcePrepared)],
      },
    ];
    malformed.corrections = [
      { owner: "source", target: "", problem: "", expected: "" },
    ];
    const malformedResult = review.submit(malformed);
    TestValidator.predicate(
      "worksheet schema is enforced as evidence, not prose ritual",
      malformedResult.accepted === false &&
        new Set(malformedResult.diagnostics.map((item) => item.code)).has(
          "review-checklist-incomplete",
        ) &&
        malformedResult.diagnostics.some(
          (item) => item.code === "review-observation-copied",
        ) &&
        malformedResult.diagnostics.some(
          (item) => item.code === "review-correction-empty",
        ) &&
        malformedResult.diagnostics.some(
          (item) => item.code === "review-acceptance-coverage-misplaced",
        ),
    );
    const reusedSourceEvidence = worksheet(project, sourcePrepared);
    reusedSourceEvidence.checks[1]!.evidence =
      reusedSourceEvidence.checks[0]!.evidence;
    TestValidator.predicate(
      "distinct source criteria cannot launder one convenient line",
      review
        .submit(reusedSourceEvidence)
        .diagnostics.some((item) => item.code === "review-evidence-reused"),
    );
    const whitespaceLaunderedSourceEvidence = worksheet(
      project,
      sourcePrepared,
    );
    const firstSourceEvidence =
      whitespaceLaunderedSourceEvidence.checks[0]!.evidence[0]!;
    if (firstSourceEvidence.kind !== "source")
      throw new Error("Expected source evidence for source review fixture.");
    whitespaceLaunderedSourceEvidence.checks[1]!.evidence = [
      {
        ...firstSourceEvidence,
        exactText: ` ${firstSourceEvidence.exactText} `,
      },
    ];
    TestValidator.predicate(
      "cosmetic exactText whitespace cannot manufacture a distinct source selector",
      review
        .submit(whitespaceLaunderedSourceEvidence)
        .diagnostics.some((item) => item.code === "review-evidence-reused"),
    );
    const sourcePath = path.join(fixture.root, sourceTarget.path);
    const sourceBytes = fs.readFileSync(sourcePath);
    fs.writeFileSync(
      sourcePath,
      "export const opening = { deliberately: 'not buildable' };\n",
    );
    const invalidSourcePrepared = review.prepare({ target: sourceTarget });
    const invalidSourceSubmission = review.submit(
      worksheet(project, invalidSourcePrepared),
    );
    fs.writeFileSync(sourcePath, sourceBytes);
    TestValidator.predicate(
      "a compiler-invalid source cannot receive a complete review",
      invalidSourcePrepared.diagnostics.some(
        (item) => item.code === "source-export-missing",
      ) &&
        invalidSourceSubmission.accepted === false &&
        invalidSourceSubmission.diagnostics.some(
          (item) => item.code === "source-export-missing",
        ),
    );
    const productionPath = path.join(
      fixture.root,
      ".automovie/design/production.json",
    );
    const productionBytes = fs.readFileSync(productionPath);
    const oversizedProduction = JSON.parse(productionBytes.toString("utf8"));
    oversizedProduction.frameFormat.width = 16_384;
    oversizedProduction.frameFormat.height = 16_384;
    fs.writeFileSync(productionPath, JSON.stringify(oversizedProduction));
    const compileBlockedSource = review.prepare({ target: sourceTarget });
    fs.writeFileSync(productionPath, productionBytes);
    TestValidator.predicate(
      "upstream design errors block a premature source completion claim",
      compileBlockedSource.diagnostics.some(
        (item) => item.code === "review-source-compile-blocked",
      ),
    );

    const designTarget = {
      kind: "design" as const,
      design: { kind: "production" as const },
    };
    const designPrepared = review.prepare({ target: designTarget });
    const wrongDesign = worksheet(project, designPrepared);
    wrongDesign.checks[0]!.evidence = [
      {
        kind: "design",
        target: { kind: "world" },
        pointer: "/missing",
        exactValue: "stale",
      },
    ];
    TestValidator.predicate(
      "design evidence cannot cross targets",
      review
        .submit(wrongDesign)
        .diagnostics.some(
          (item) => item.code === "review-evidence-target-mismatch",
        ),
    );
    const badPointer = worksheet(project, designPrepared);
    badPointer.checks[0]!.evidence = [
      {
        kind: "design",
        target: { kind: "production" },
        pointer: "/missing",
        exactValue: "stale",
      },
    ];
    const staleValue = worksheet(project, designPrepared);
    staleValue.checks[0]!.evidence = [
      {
        kind: "design",
        target: { kind: "production" },
        pointer: "/title",
        exactValue: "not-current",
      },
    ];
    const malformedPointer = worksheet(project, designPrepared);
    malformedPointer.checks[0]!.evidence = [
      {
        kind: "design",
        target: { kind: "production" },
        pointer: "title",
        exactValue: productionDesign().title,
      },
    ];
    const primitiveTraversal = worksheet(project, designPrepared);
    primitiveTraversal.checks[0]!.evidence = [
      {
        kind: "design",
        target: { kind: "production" },
        pointer: "/title/value",
        exactValue: "absent",
      },
    ];
    TestValidator.predicate(
      "design pointer existence and exact values are rechecked",
      review
        .submit(badPointer)
        .diagnostics.some(
          (item) => item.code === "review-evidence-selector-invalid",
        ) &&
        review
          .submit(staleValue)
          .diagnostics.some((item) => item.code === "review-evidence-stale") &&
        review
          .submit(malformedPointer)
          .diagnostics.some(
            (item) => item.code === "review-evidence-selector-invalid",
          ) &&
        review
          .submit(primitiveTraversal)
          .diagnostics.some(
            (item) => item.code === "review-evidence-selector-invalid",
          ),
    );
    const badSource = worksheet(project, sourcePrepared);
    badSource.checks[0]!.evidence = [
      {
        kind: "source",
        path: sourceTarget.path,
        line: 999_999,
        exactText: "x",
      },
    ];
    const emptySource = worksheet(project, sourcePrepared);
    const selector = sourcePrepared.quotable.find(
      (item) => item.kind === "source",
    )!;
    if (selector.kind !== "source") throw new Error("unreachable selector");
    emptySource.checks[0]!.evidence = [{ ...selector, exactText: " " }];
    const partialSource = worksheet(project, sourcePrepared);
    partialSource.checks[0]!.evidence = [{ ...selector, exactText: "e" }];
    TestValidator.predicate(
      "source evidence is selected, non-blank and an exact current line",
      review
        .submit(badSource)
        .diagnostics.some(
          (item) => item.code === "review-evidence-selector-invalid",
        ) &&
        review
          .submit(emptySource)
          .diagnostics.some((item) => item.code === "review-evidence-empty") &&
        review
          .submit(partialSource)
          .diagnostics.some((item) => item.code === "review-evidence-stale"),
    );
    const residentReadSource = project.readSource;
    project.readSource = ((sourcePath: string) => {
      if (
        new Error("source evidence stack").stack?.includes("currentSourceLine")
      ) {
        const iterator = (function* (): Generator<void> {
          yield;
        })();
        iterator.next();
        return iterator.throw("source vanished during evidence read") as never;
      }
      return residentReadSource.call(project, sourcePath);
    }) as typeof project.readSource;
    const vanishedSource = review.submit(worksheet(project, sourcePrepared));
    project.readSource = residentReadSource;
    TestValidator.predicate(
      "a source read race becomes stale evidence",
      vanishedSource.diagnostics.some(
        (item) => item.code === "review-evidence-stale",
      ),
    );

    const shotTarget = { kind: "shot" as const, id: "opening" };
    const shotPrepared = review.prepare({ target: shotTarget });
    const sourceFile = path.join(project.root, sourceTarget.path);
    const sourceBeforeRace = fs.readFileSync(sourceFile);
    let compileCalls = 0;
    const racingReview = new AutoMovieProductionReviewService(project, () => {
      ++compileCalls;
      if (compileCalls === 3)
        fs.appendFileSync(sourceFile, "\n// concurrent review edit\n");
      return new AutoMovieProductionCompiler(project).lint({ scope: "source" });
    });
    let racedSubmission: ReturnType<AutoMovieProductionReviewService["submit"]>;
    try {
      const racedPrepared = racingReview.prepare({ target: shotTarget });
      racedSubmission = racingReview.submit(worksheet(project, racedPrepared));
    } finally {
      fs.writeFileSync(sourceFile, sourceBeforeRace);
    }
    TestValidator.predicate(
      "a target mutation during worksheet validation is refused",
      racedSubmission.diagnostics.some(
        (item) => item.code === "review-target-raced",
      ),
    );
    const sourceSelector = shotPrepared.quotable.find(
      (item) => item.kind === "source",
    );
    if (sourceSelector?.kind !== "source")
      throw new Error("shot fixture has no source selector");
    const sourceEvidence: IAutoMovieReviewEvidence = {
      ...sourceSelector,
      exactText: fs
        .readFileSync(path.join(project.root, sourceSelector.path), "utf8")
        .replace(/\r\n?/g, "\n")
        .split("\n")[sourceSelector.line - 1]!,
    };
    const noVisualBasis = worksheet(project, shotPrepared);
    noVisualBasis.checks.forEach((check) => {
      check.evidence = [sourceEvidence];
    });
    noVisualBasis.completionBasis = "partial";
    const noVisualResult = review.submit(noVisualBasis);
    const highRiskNotApplicable = worksheet(project, shotPrepared);
    const highRiskCriterion = highRiskNotApplicable.checks.find(
      (check) => check.criterion === "motion-and-grounding",
    )!;
    highRiskCriterion.verdict = "not-applicable";
    const highRiskNotApplicableResult = review.submit(highRiskNotApplicable);
    const acceptanceCoverageMismatch = worksheet(project, shotPrepared);
    const acceptanceCoverageCheck = acceptanceCoverageMismatch.checks.find(
      (check) => check.criterion === "acceptance-scenarios",
    )!;
    acceptanceCoverageCheck.acceptanceScenarios = [];
    const acceptanceCoverageResult = review.submit(acceptanceCoverageMismatch);
    const missingAcceptanceCheck = worksheet(project, shotPrepared);
    missingAcceptanceCheck.checks = missingAcceptanceCheck.checks.filter(
      (check) => check.criterion !== "acceptance-scenarios",
    );
    const missingAcceptanceCheckResult = review.submit(missingAcceptanceCheck);
    const staleAcceptance = worksheet(project, shotPrepared);
    const staleAcceptanceCheck = staleAcceptance.checks.find(
      (check) => check.criterion === "acceptance-scenarios",
    )!;
    const acceptanceEvidence = staleAcceptanceCheck.evidence.find(
      (evidence) => evidence.kind === "acceptance",
    );
    if (acceptanceEvidence?.kind !== "acceptance")
      throw new Error("shot worksheet has no acceptance evidence");
    acceptanceEvidence.exactValue = { stale: true };
    const staleAcceptanceResult = review.submit(staleAcceptance);
    TestValidator.predicate(
      "visual completion needs a frame and explicit passes for every high-risk basis",
      noVisualResult.diagnostics.some(
        (item) => item.code === "review-evidence-missing",
      ) &&
        noVisualResult.diagnostics.some(
          (item) => item.code === "review-completion-basis-incomplete",
        ) &&
        highRiskNotApplicableResult.diagnostics.some(
          (item) => item.code === "review-high-risk-not-passed",
        ) &&
        acceptanceCoverageResult.diagnostics.some(
          (item) => item.code === "review-acceptance-coverage-incomplete",
        ) &&
        missingAcceptanceCheckResult.diagnostics.some(
          (item) => item.code === "review-acceptance-coverage-incomplete",
        ) &&
        staleAcceptanceResult.diagnostics.some(
          (item) => item.code === "review-evidence-stale",
        ),
    );
    const badRegion = worksheet(project, shotPrepared);
    const frame = shotPrepared.frames[0]!;
    badRegion.checks[0]!.evidence = [
      {
        kind: "frame",
        shot: frame.shot,
        reviewFrame: frame.reviewFrame,
        bundle: frame.bundle,
        frame: frame.frame,
        time: frame.time,
        pass: frame.pass,
        digest: frame.digest,
        region: { x: -1, y: 0, width: 99, height: 1 },
      },
    ];
    const staleFrame = worksheet(project, shotPrepared);
    staleFrame.checks[0]!.evidence = [
      {
        kind: "frame",
        shot: frame.shot,
        reviewFrame: frame.reviewFrame,
        bundle: "renders/absent",
        frame: 0,
        time: 0,
        pass: "beauty",
        digest: frame.digest,
      },
    ];
    TestValidator.predicate(
      "visual evidence must be current and in bounds",
      review
        .submit(badRegion)
        .diagnostics.some(
          (item) => item.code === "review-evidence-region-invalid",
        ) &&
        review
          .submit(staleFrame)
          .diagnostics.some((item) => item.code === "review-evidence-stale"),
    );
    const invalidRegions = [
      { x: 0.5, y: 0, width: 1, height: 1 },
      { x: 0, y: 0.5, width: 1, height: 1 },
      { x: 0, y: 0, width: 0.5, height: 1 },
      { x: 0, y: 0, width: 1, height: 0.5 },
      { x: 0, y: -1, width: 1, height: 1 },
      { x: 0, y: 0, width: 0, height: 1 },
      { x: 0, y: 0, width: 1, height: 0 },
      { x: frame.width, y: 0, width: 1, height: 1 },
      { x: 0, y: frame.height, width: 1, height: 1 },
    ];
    TestValidator.predicate(
      "every invalid frame-region axis is independently rejected",
      invalidRegions.every((region) => {
        const sheet = worksheet(project, shotPrepared);
        sheet.checks[0]!.evidence = [
          {
            kind: "frame",
            shot: frame.shot,
            reviewFrame: frame.reviewFrame,
            bundle: frame.bundle,
            frame: frame.frame,
            time: frame.time,
            pass: frame.pass,
            digest: frame.digest,
            region,
          },
        ];
        return review
          .submit(sheet)
          .diagnostics.some(
            (item) => item.code === "review-evidence-region-invalid",
          );
      }),
    );
    TestValidator.predicate(
      "missing source, shot and film targets return prepared diagnostics",
      [
        review.prepare({
          target: { kind: "source", path: "src/shots/absent.ts" },
        }),
        review.prepare({
          target: { kind: "shot", id: "absent" },
        }),
        review.prepare({
          target: { kind: "film", id: "absent" },
        }),
        review.prepare({
          target: {
            kind: "design",
            design: { kind: "acceptance", id: "absent" },
          },
        }),
      ].every((prepared) =>
        prepared.diagnostics.some(
          (item) => item.code === "review-target-missing",
        ),
      ),
    );

    const missingTarget: IAutoMovieReviewTarget = {
      kind: "design",
      design: { kind: "model", id: "absent" },
    };
    const missingPrepared = review.prepare({ target: missingTarget });
    const diagnostic = missingPrepared.diagnostics[0]!;
    const diagnosticSheet: IAutoMovieSubmitReviewInput = {
      target: missingTarget,
      preparedFingerprint: missingPrepared.fingerprint,
      observations: "The requested target is absent.",
      checks: missingPrepared.requiredCriteria.map((criterion, index) => ({
        criterion,
        verdict: "revise",
        observation: `Missing target observation ${index}`,
        evidence: [
          {
            kind: "diagnostic",
            code: diagnostic.code,
            path: diagnostic.path ?? "",
            actual: index === 0 ? "wrong" : diagnostic.message,
          },
        ],
      })),
      corrections: [
        {
          owner: "design",
          target: "model:absent",
          problem: "The target is absent.",
          expected: "Create the target before review.",
        },
      ],
      completionBasis: "The missing diagnostic blocks completion.",
      complete: false,
    };
    TestValidator.predicate(
      "diagnostic evidence exact value is checked",
      review
        .submit(diagnosticSheet)
        .diagnostics.some((item) => item.code === "review-evidence-stale"),
    );
    const absentDiagnosticSheet = structuredClone(diagnosticSheet);
    absentDiagnosticSheet.checks[0]!.evidence = [
      {
        kind: "diagnostic",
        code: "not-prepared",
        path: "",
        actual: "absent",
      },
    ];
    TestValidator.predicate(
      "diagnostic evidence must belong to the prepare snapshot",
      review
        .submit(absentDiagnosticSheet)
        .diagnostics.some((item) => item.code === "review-evidence-stale"),
    );

    const legacyBundleDirectory = path.join(
      fixture.root,
      "renders",
      "retained-v2-history",
    );
    const currentBundleManifest = JSON.parse(
      fs.readFileSync(
        path.join(
          fixture.root,
          aliasedFrameEvidence.frames[0]!.bundle,
          "manifest.json",
        ),
        "utf8",
      ),
    ) as Record<string, unknown>;
    fs.mkdirSync(legacyBundleDirectory, { recursive: true });
    fs.writeFileSync(
      path.join(legacyBundleDirectory, "manifest.json"),
      JSON.stringify({
        ...currentBundleManifest,
        version: 2,
        rendererIdentity: "legacy-capture-runtime",
      }),
    );
    const preparedBesideLegacyV2 = review.prepare({ target: shotTarget });
    TestValidator.predicate(
      "retained v2 history is a warning beside current v3 evidence",
      preparedBesideLegacyV2.frames.length !== 0 &&
        preparedBesideLegacyV2.diagnostics.some(
          (item) =>
            item.code === "render-bundle-legacy" && item.category === "warning",
        ) &&
        preparedBesideLegacyV2.diagnostics.every(
          (item) =>
            item.code !== "render-bundle-invalid" ||
            item.path?.includes("retained-v2-history") === false,
        ),
    );

    for (const entry of review.queue().entries) {
      const prepared = review.prepare({ target: entry.target });
      const result = review.submit(worksheet(project, prepared));
      TestValidator.predicate(
        `complete review ${JSON.stringify(entry.target)}`,
        result.accepted && result.state === "complete",
      );
    }
    TestValidator.predicate(
      "review compile gate passes only after the full queue",
      compiler.compile({ scope: "review" }).success,
    );
    const filmTarget = { kind: "film" as const, id: "fixture-film" };
    const storedShotReview = project.review(shotTarget)!;
    const filmBeforeChildReviewChange = review.prepare({
      target: filmTarget,
    }).fingerprint;
    project.commitReview({
      ...storedShotReview,
      observations: `${storedShotReview.observations} Reconfirmed.`,
    });
    const filmAfterChildReviewChange = review.prepare({
      target: filmTarget,
    }).fingerprint;
    project.commitReview(storedShotReview);
    TestValidator.notEquals(
      "film fingerprint tracks the complete current child-shot review",
      filmBeforeChildReviewChange,
      filmAfterChildReviewChange,
    );
    const storedSourceReview = project.review(sourceTarget)!;
    fs.writeFileSync(
      project.reviewPath(sourceTarget),
      JSON.stringify({
        ...storedSourceReview,
        observations: "",
        checks: [],
        completionBasis: "",
        complete: true,
      }),
    );
    const forgedStoredState = review
      .queue()
      .entries.find(
        (entry) =>
          entry.target.kind === "source" &&
          entry.target.path === sourceTarget.path,
      )?.state;
    project.commitReview(storedSourceReview);
    TestValidator.equals(
      "directly forged complete reviews are revalidated by the queue",
      forgedStoredState,
      "incomplete",
    );
    project.eraseDesignArtifact({
      kind: "acceptance",
      id: filmMetricAcceptance.id,
    });
    fs.rmSync(path.join(fixture.root, ".automovie/design/production.json"));
    const noProductionFrames = review.prepare({ target: shotTarget });
    project.setProductionDesign(productionDesign());
    project.setAcceptanceScenario(filmMetricAcceptance);
    compiler.compile({ scope: "source" });
    TestValidator.predicate(
      "review frame requirements need current production fps",
      noProductionFrames.frames.length === 0,
    );
    const requiredScenarios = [
      ...acceptanceScenarios(),
      eventAcceptance,
      repeatedEventAcceptance,
      implicitShotEventAcceptance,
      metricAcceptance,
      metricMaximumAcceptance,
      metricMinimumAcceptance,
      filmMetricAcceptance,
    ];
    for (const scenario of requiredScenarios)
      project.setAcceptanceScenario({ ...scenario, required: false });
    compiler.compile({ scope: "source" });
    for (const pass of ["beauty", "mask", "pose"] as const)
      await oracle.preview({
        target: { kind: "shot", id: "opening" },
        time: 2,
        pass,
        width: 16,
        height: 16,
      });
    const noRequiredPrepared = review.prepare({ target: shotTarget });
    const noRequiredSheet = worksheet(project, noRequiredPrepared);
    noRequiredSheet.checks.find(
      (check) => check.criterion === "acceptance-scenarios",
    )!.acceptanceScenarios = ["unexpected"];
    const noRequiredResult = review.submit(noRequiredSheet);
    for (const scenario of requiredScenarios)
      project.setAcceptanceScenario(scenario);
    compiler.compile({ scope: "source" });
    TestValidator.predicate(
      `empty required-acceptance sets are still exact: ${noRequiredResult.diagnostics
        .map((diagnostic) => `${diagnostic.code}:${diagnostic.message}`)
        .join(" | ")}`,
      noRequiredResult.diagnostics.some(
        (diagnostic) =>
          diagnostic.code === "review-acceptance-coverage-incomplete" &&
          diagnostic.message.includes("(none)"),
      ),
    );

    project.setProductionDesign({
      ...productionDesign(),
      title: "changed after review",
    });
    const staleWorksheetResult = review.submit(
      worksheet(project, noRequiredPrepared),
    );
    TestValidator.predicate(
      "dependent reviews become stale after a mutation",
      review.queue().entries.some((entry) => entry.state === "stale") &&
        staleWorksheetResult.state === "stale" &&
        staleWorksheetResult.diagnostics.some(
          (item) => item.code === "review-worksheet-stale",
        ) &&
        compiler
          .compile({ scope: "review" })
          .diagnostics.some((item) => item.code === "review-stale"),
    );
  } finally {
    fixture.dispose();
  }
};
