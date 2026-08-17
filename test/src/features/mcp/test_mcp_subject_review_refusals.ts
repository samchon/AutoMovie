import {
  IAutoMovieReviewCheck,
  IAutoMovieSubjectReviewTarget,
  IAutoMovieSubmitReviewInput,
} from "@automovie/interface";
import {
  AutoMovieApplication,
  AutoMovieProductionCompiler,
  AutoMovieProductionProject,
  compareCodeUnits,
} from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import path from "node:path";

import {
  productionCompileSucceeded,
  productionFixture,
} from "./productionFixtures";

const SUBJECT = "prototype:automovie:model:soloist";

const TARGET: { kind: "subject" } & IAutoMovieSubjectReviewTarget = {
  kind: "subject",
  shot: "opening",
  subject: SUBJECT,
};

const CRITERIA = [
  "identity-and-composition",
  "placement-and-bounds",
  "viewpoint-coverage",
  "subject-frame-separation",
] as const;

const diagnosticCodes = (
  diagnostics: ReadonlyArray<{ code: string }>,
): string[] =>
  [...new Set(diagnostics.map((diagnostic) => diagnostic.code))].sort(
    compareCodeUnits,
  );

/**
 * Every subject a review cannot actually resolve is refused instead of being
 * reviewed against something else.
 *
 * A subject target names compiled truth by identity, so each way that identity
 * can fail to resolve has to end in a refusal rather than in an empty unit that
 * a worksheet could still be submitted against. The same holds one level down:
 * subject evidence that no prepared worksheet backs must be refused rather than
 * accepted because it merely has the right shape.
 *
 * Scenarios:
 *
 * 1. A subject target prepared before any compile has no compiled artifact to
 *    read, so it reports `review-target-missing` beside the standing viewpoint
 *    warning and carries no resolved unit and no quotable selector.
 * 2. After a real compile, a subject id that no compiled artifact contains is
 *    refused the same way rather than resolving to the shot that was named.
 * 3. A compiled shot artifact overwritten with intact JSON that is not a
 *    compiled shot is refused rather than described, so damaged compiler output
 *    never becomes a reviewable subject.
 * 4. Subject evidence on a target that prepared no subject, evidence naming
 *    another subject, an unresolvable pointer, and a pointer whose current value
 *    moved are each refused with their own diagnostic.
 */
export const test_mcp_subject_review_refusals = (): void => {
  const fixture = productionFixture();
  try {
    const project = AutoMovieProductionProject.open(fixture.root);
    const application = new AutoMovieApplication({ projectRoot: fixture.root });
    application.getGuideDocument({ name: "AUTOMOVIE_OVERALL" });
    application.getGuideDocument({ name: "REVIEW" });
    application.getGuideDocument({ name: "REVIEW_SUBJECT" });
    application.getGuideDocument({ name: "REVIEW_DEPENDENCY" });

    const uncompiled = application.prepareReview({ target: TARGET });
    TestValidator.equals(
      "a subject cannot be resolved before its artifact is compiled",
      {
        subjectReview: uncompiled.subjectReview,
        quotable: uncompiled.quotable,
        codes: diagnosticCodes(uncompiled.diagnostics),
      },
      {
        subjectReview: null,
        quotable: [],
        codes: [
          "review-subject-viewpoint-unsupported",
          "review-target-missing",
        ],
      },
    );

    const compiler = new AutoMovieProductionCompiler(project);
    if (
      productionCompileSucceeded(
        "subject refusal fixture",
        compiler.compile({ scope: "source" }),
      ) === false
    )
      throw new Error("The subject-refusal fixture did not compile source.");

    const absent = application.prepareReview({
      target: { kind: "subject", shot: "opening", subject: "space:no/such" },
    });
    TestValidator.equals(
      "a subject id no compiled artifact contains is refused, not approximated",
      {
        subjectReview: absent.subjectReview,
        codes: diagnosticCodes(absent.diagnostics),
      },
      {
        subjectReview: null,
        codes: [
          "review-subject-viewpoint-unsupported",
          "review-target-missing",
        ],
      },
    );

    const prepared = application.prepareReview({ target: TARGET });
    const description = prepared.subjectReview?.unit.description;
    if (description === undefined)
      throw new Error(
        "The compiled subject did not resolve, so the evidence refusals below would assert nothing.",
      );
    const selector = prepared.quotable.find(
      (candidate) =>
        candidate.kind === "subject" && candidate.pointer === "/id",
    );
    if (selector === undefined || selector.kind !== "subject")
      throw new Error("prepareReview returned no subject selector for /id.");

    const checks = (
      evidence: IAutoMovieReviewCheck["evidence"],
    ): IAutoMovieReviewCheck[] =>
      CRITERIA.map((criterion, index) => ({
        criterion,
        verdict: "revise" as const,
        observation: `Criterion ${criterion} is unresolved at index ${index}.`,
        evidence: index === 0 ? evidence : [...evidence],
      }));
    const worksheet = (
      evidence: IAutoMovieReviewCheck["evidence"],
    ): IAutoMovieSubmitReviewInput => ({
      target: TARGET,
      preparedFingerprint: prepared.fingerprint,
      observations: "The subject was inspected but no viewpoint plan ran.",
      checks: checks(evidence),
      corrections: [],
      completionBasis: "Nothing is claimed current.",
      complete: false,
    });

    const foreignTarget = application.submitReview(
      worksheet([
        {
          kind: "subject",
          target: { shot: "opening", subject: "space:no/such" },
          pointer: "/id",
          exactValue: SUBJECT,
        },
      ]),
    );
    const unknownPointer = application.submitReview(
      worksheet([
        {
          kind: "subject",
          target: selector.target,
          pointer: "/no-such-field",
          exactValue: null,
        },
      ]),
    );
    const movedValue = application.submitReview(
      worksheet([
        {
          kind: "subject",
          target: selector.target,
          pointer: "/id",
          exactValue: "prototype:something-else",
        },
      ]),
    );

    const designPrepared = application.prepareReview({
      target: { kind: "design", design: { kind: "model", id: "soloist" } },
    });
    const onDesignTarget = application.submitReview({
      target: { kind: "design", design: { kind: "model", id: "soloist" } },
      preparedFingerprint: designPrepared.fingerprint,
      observations: "Subject evidence is quoted where no subject was prepared.",
      checks: designPrepared.requiredCriteria.map((criterion, index) => ({
        criterion,
        verdict: "revise" as const,
        observation: `Criterion ${criterion} is unresolved at index ${index}.`,
        evidence: [
          {
            kind: "subject" as const,
            target: selector.target,
            pointer: "/id",
            exactValue: SUBJECT,
          },
        ],
      })),
      corrections: [],
      completionBasis: "Nothing is claimed current.",
      complete: false,
    });

    TestValidator.equals(
      "unbound subject evidence is refused on its own terms",
      {
        foreignTarget: {
          accepted: foreignTarget.accepted,
          codes: diagnosticCodes(foreignTarget.diagnostics),
        },
        unknownPointer: {
          accepted: unknownPointer.accepted,
          codes: diagnosticCodes(unknownPointer.diagnostics),
        },
        movedValue: {
          accepted: movedValue.accepted,
          codes: diagnosticCodes(movedValue.diagnostics),
        },
        onDesignTarget: {
          accepted: onDesignTarget.accepted,
          mismatched: onDesignTarget.diagnostics.some(
            (diagnostic) =>
              diagnostic.code === "review-evidence-target-mismatch",
          ),
        },
      },
      {
        foreignTarget: {
          accepted: false,
          codes: ["review-evidence-target-mismatch"],
        },
        unknownPointer: {
          accepted: false,
          codes: ["review-evidence-selector-invalid"],
        },
        movedValue: {
          accepted: false,
          codes: ["review-evidence-stale"],
        },
        onDesignTarget: {
          accepted: false,
          mismatched: true,
        },
      },
    );

    const artifact = path.join(
      project.generatedRoot(),
      "shots",
      "opening.json",
    );
    if (fs.existsSync(artifact) === false)
      throw new Error(
        `The compiled shot artifact ${artifact} is absent, so overwriting it would assert nothing.`,
      );
    fs.writeFileSync(artifact, '{"shot":"opening"}\n', "utf8");
    const damaged = application.prepareReview({ target: TARGET });
    TestValidator.equals(
      "intact JSON that is not a compiled shot cannot become a subject",
      {
        subjectReview: damaged.subjectReview,
        codes: diagnosticCodes(damaged.diagnostics),
      },
      {
        subjectReview: null,
        codes: [
          "review-subject-viewpoint-unsupported",
          "review-target-missing",
        ],
      },
    );
  } finally {
    fixture.dispose();
  }
};
