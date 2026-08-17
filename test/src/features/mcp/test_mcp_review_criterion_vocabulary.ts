import {
  AutoMovieProductionGuideName,
  IAutoMovieReviewTarget,
} from "@automovie/interface";
import { AutoMovieApplication, compareCodeUnits } from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { AUTOMOVIE_REVIEW_CRITERION_VOCABULARY } from "../internal/reviewVocabulary";

/** The design target the numbered-recovery scenario reads its exact wording from. */
const DESIGN_TARGET: IAutoMovieReviewTarget = {
  kind: "design",
  design: { kind: "model", id: "soloist" },
};

/** One target of every review kind; the knowledge gate refuses before reading any of them. */
const TARGETS: readonly IAutoMovieReviewTarget[] = [
  { kind: "asset", id: "soloist" },
  { kind: "subject", shot: "opening", subject: "prototype:soloist" },
  DESIGN_TARGET,
  { kind: "source", path: "src/shots/opening.ts" },
  { kind: "shot", id: "opening" },
  { kind: "rendition", id: "opening" },
  { kind: "sequence", id: "SEQ-001" },
  { kind: "film", id: "fixture-film" },
];

/** The recovery steps a knowledge-gated refusal spells out, in its own order. */
const RECOVERY_STEP = /getGuideDocument\(\{ name: "([A-Z_0-9]+)" \}\)/gu;

const demandedGuides = (
  call: () => unknown,
): AutoMovieProductionGuideName[] => {
  try {
    call();
  } catch (error) {
    if (error instanceof Error)
      return [...error.message.matchAll(RECOVERY_STEP)].map(
        (step) => step[1] as AutoMovieProductionGuideName,
      );
    throw error;
  }
  throw new Error(
    "A review tool answered without any guide credit, so it named no required document.",
  );
};

/**
 * Every criterion the review gate demands is taught by the document it demands.
 *
 * The gate refuses an incomplete checklist by listing the exact criterion ids,
 * and it hands out a topic document per target kind that is supposed to teach
 * those same ids. Nothing held the two together: at the time this case was
 * written, twelve of the thirty-two required ids appeared in no guide at all,
 * so an agent told to review a design, a source module, or a repaint rendition
 * could read everything the tool gave it and still not know what it was being
 * asked. That defect was invisible because no test had ever called a review
 * tool.
 *
 * The closure is read from the refusals themselves rather than from the
 * service's own tables. Which document a target kind requires comes out of the
 * gate's recovery steps, the document's text comes out of `getGuideDocument`,
 * and the criterion ids are transcribed in
 * {@link AUTOMOVIE_REVIEW_CRITERION_VOCABULARY}. So each side is asked
 * independently, and agreement is a fact about the product rather than a
 * constant compared with itself.
 *
 * Scenarios:
 *
 * 1. For all eight target kinds, `prepareReview` and `submitReview` refuse an
 *    uncredited session by naming the same ordered documents: the overall
 *    contract first, then one document for that kind. Two tools disagreeing
 *    would let a reviewer be admitted to submit against a document it was never
 *    required to read before preparing.
 * 2. Each kind's target-specific document names every criterion id the gate
 *    will require for that kind, so the refusal an agent meets is recoverable
 *    from the document it was already told to read.
 * 3. The refusal is stated as knowledge, not as payload: it says so, it counts
 *    the credit the session holds, and it numbers the calls that repair it.
 * 4. Guide credit is per exact document rather than per topic: a session that
 *    has read every review document and not the overall contract is still
 *    refused for every target kind, and owes exactly the document it skipped.
 */
export const test_mcp_review_criterion_vocabulary = (): void => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "automovie-vocabulary-"));
  fs.writeFileSync(
    path.join(root, "automovie.config.ts"),
    "export default {};\n",
  );
  try {
    const uncredited = new AutoMovieApplication({ projectRoot: root });
    const reader = new AutoMovieApplication({ projectRoot: root });
    const demanded = TARGETS.map((target) => ({
      kind: target.kind,
      prepare: demandedGuides(() => uncredited.prepareReview({ target })),
      submit: demandedGuides(() =>
        uncredited.submitReview({
          target,
          preparedFingerprint: `sha256:${"0".repeat(64)}`,
          observations: "",
          checks: [],
          corrections: [],
          completionBasis: "",
          complete: false,
        }),
      ),
    }));

    TestValidator.equals(
      "both review tools require the same documents for the same target kind",
      demanded.map((entry) => ({
        kind: entry.kind,
        agreed: entry.prepare.join(",") === entry.submit.join(","),
        overallFirst: entry.prepare[0] ?? null,
        documents: entry.prepare.length,
      })),
      TARGETS.map((target) => ({
        kind: target.kind,
        agreed: true,
        overallFirst: "AUTOMOVIE_OVERALL" as const,
        documents: 3,
      })),
    );

    TestValidator.equals(
      "the document a review target demands teaches every criterion it will be judged by",
      demanded.flatMap((entry) => {
        const topic = entry.prepare.filter(
          (guide) => guide !== "AUTOMOVIE_OVERALL" && guide !== "REVIEW",
        );
        const content = topic
          .map((guide) => reader.getGuideDocument({ name: guide }).content)
          .join("\n");
        return AUTOMOVIE_REVIEW_CRITERION_VOCABULARY[entry.kind]
          .filter((criterion) => content.includes(criterion) === false)
          .map(
            (criterion) =>
              `${entry.kind}: ${topic.join("+")} omits ${criterion}`,
          )
          .sort(compareCodeUnits);
      }),
      [],
    );

    TestValidator.equals(
      "an uncredited refusal is stated as missing knowledge and numbered recovery",
      (() => {
        const message = (() => {
          try {
            uncredited.prepareReview({ target: DESIGN_TARGET });
          } catch (error) {
            return error instanceof Error ? error.message : String(error);
          }
          return "";
        })();
        return {
          gated: message.includes("prepareReview is knowledge-gated"),
          credit: message.includes("0/3 required guides have session credit"),
          numbered:
            message.includes(
              '1. getGuideDocument({ name: "AUTOMOVIE_OVERALL" })',
            ) &&
            message.includes('2. getGuideDocument({ name: "REVIEW" })') &&
            message.includes(
              '3. getGuideDocument({ name: "REVIEW_DEPENDENCY" })',
            ),
          retry: message.includes("Then retry prepareReview unchanged"),
          notPayload: message.includes(
            "missing-knowledge precondition, not a payload validation error",
          ),
        };
      })(),
      {
        gated: true,
        credit: true,
        numbered: true,
        retry: true,
        notPayload: true,
      },
    );

    const topicsOnly = new AutoMovieApplication({ projectRoot: root });
    for (const guide of [
      "REVIEW_ASSET",
      "REVIEW_SUBJECT",
      "REVIEW_DEPENDENCY",
      "REVIEW_SHOT",
      "REVIEW_SEQUENCE",
      "REVIEW_FILM",
    ] as const)
      topicsOnly.getGuideDocument({ name: guide });
    TestValidator.equals(
      "credit is per exact document, so neither half of the pair admits alone",
      TARGETS.map((target) =>
        demandedGuides(() => topicsOnly.prepareReview({ target })).join(","),
      ),
      TARGETS.map(() => "AUTOMOVIE_OVERALL,REVIEW"),
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
};
