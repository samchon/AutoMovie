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
} from "./productionFixtures";

const evidenceOf = (
  project: AutoMovieProductionProject,
  prepared: IAutoMoviePrepareReviewOutput,
): IAutoMovieReviewEvidence => {
  const target = prepared.target;
  if (target.kind === "design")
    return {
      kind: "design",
      target: target.design,
      pointer: "",
      exactValue: project.design(target.design),
    };
  if (target.kind === "source") {
    const selector = prepared.quotable.find((item) => item.kind === "source");
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
  return {
    kind: "frame",
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
  const evidence = evidenceOf(project, prepared);
  const checks: IAutoMovieReviewCheck[] = prepared.requiredCriteria.map(
    (criterion, index) => ({
      criterion,
      verdict: complete || index !== 0 ? "pass" : "revise",
      observation: `${criterion} current evidence observation ${index}`,
      evidence: [evidence],
    }),
  );
  return {
    target: prepared.target,
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

const captureBytes = (): Uint8Array => {
  const png = new PNG({ width: 4, height: 4 });
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
    const compiler = new AutoMovieProductionCompiler(project, () =>
      review.queue(),
    );
    TestValidator.predicate(
      "review fixture compiles",
      compiler.compile({ scope: "source" }).success,
    );
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
    const oracle = new AutoMovieProductionOracleService(project, async () => ({
      bytes: captureBytes(),
      width: 4,
      height: 4,
    }));
    for (const target of [
      { kind: "shot" as const, id: "opening" },
      { kind: "film" as const, id: "fixture-film" },
    ])
      TestValidator.predicate(
        `actual frame for ${target.kind}`,
        (
          await oracle.preview({
            target,
            time: 2,
            width: 4,
            height: 4,
          })
        ).captured,
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
        ),
    );
    const badRegion = worksheet(project, shotPrepared);
    const frame = shotPrepared.frames[0]!;
    badRegion.checks[0]!.evidence = [
      {
        kind: "frame",
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

    project.setProductionDesign({
      ...productionDesign(),
      title: "changed after review",
    });
    TestValidator.predicate(
      "dependent reviews become stale after a mutation",
      review.queue().entries.some((entry) => entry.state === "stale") &&
        compiler
          .compile({ scope: "review" })
          .diagnostics.some((item) => item.code === "review-stale"),
    );
  } finally {
    fixture.dispose();
  }
};
