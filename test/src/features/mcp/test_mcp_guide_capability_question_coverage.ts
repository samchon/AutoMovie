import {
  AUTOMOVIE_PRODUCTION_GUIDE_NAMES,
  AUTOMOVIE_SANDBOX_CAPABILITY_INDEX,
  AutoMovieApplication,
  compareCodeUnits,
} from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/**
 * Every capability the sandbox publishes is findable in the guide corpus.
 *
 * `#1919` proved the guide-to-surface direction: a name a guide writes in call
 * form must be reachable. This is the direction it left open, and the direction
 * that costs frames. Several reachable names were mentioned by no guide at all,
 * so an authoring agent could only reach them by already knowing they existed —
 * and `builtEnvironmentSpaceNodes` shows that even a named,
 * documented, read capability goes uncalled when nothing connects it to the
 * question in front of the author. A published capability no corpus sentence
 * names is a capability the product does not really have.
 *
 * Scenarios:
 *
 * 1. Every name in the reachable surface appears in some served guide's code
 *    span, so no capability is reachable-but-unmentioned.
 * 2. Every question family has a guide that names its whole family in one place,
 *    so an author arriving with the question finds the family rather than one
 *    member of it. That is what a bare inventory never gave them.
 */
export const test_mcp_guide_capability_question_coverage = (): void => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "automovie-question-"));
  fs.writeFileSync(
    path.join(root, "automovie.config.ts"),
    "export default {};\n",
  );
  try {
    inspectQuestionCoverage(new AutoMovieApplication({ projectRoot: root }));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
};

const CODE_SPAN = /`([^`\n]+)`/gu;

/** Whether one guide's code spans name this capability on an identifier boundary. */
const namesCapability = (spans: readonly string[], name: string): boolean => {
  const literal = name.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  return spans.some((span) =>
    new RegExp(`(^|[^\\w$.])${literal}([^\\w$]|$)`, "u").test(span),
  );
};

const inspectQuestionCoverage = (application: AutoMovieApplication): void => {
  const capabilityIndex = AUTOMOVIE_SANDBOX_CAPABILITY_INDEX;
  const guides = AUTOMOVIE_PRODUCTION_GUIDE_NAMES.map((name) => ({
    name,
    spans: [
      ...application.getGuideDocument({ name }).content.matchAll(CODE_SPAN),
    ].map((span) => span[1]!),
  }));

  TestValidator.equals(
    "every reachable capability is named by some guide",
    capabilityIndex
      .flatMap(({ names }) => [...names])
      .filter(
        (name) =>
          guides.some((guide) => namesCapability(guide.spans, name)) === false,
      )
      .sort(compareCodeUnits),
    [],
  );

  TestValidator.equals(
    "every question family is presented whole by one guide",
    capabilityIndex
      .filter(
        ({ names }) =>
          guides.some((guide) =>
            names.every((name) => namesCapability(guide.spans, name)),
          ) === false,
      )
      .map(({ question }) => question),
    [],
  );
};
