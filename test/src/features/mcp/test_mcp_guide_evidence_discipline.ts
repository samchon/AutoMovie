import {
  AUTOMOVIE_PRODUCTION_GUIDE_NAMES,
  AutoMovieApplication,
  compareCodeUnits,
} from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/** The tools that produce or record evidence about something visible. */
const EVIDENCE_TOOLS = [
  "captureFrame",
  "captureTurntable",
  "inspectSubject",
  "prepareReview",
  "submitReview",
  "repaintShot",
];

/**
 * Guides that owe no evidence loop, each with the reason it owes none.
 *
 * An exemption is a decision somebody made, so it is written down beside the
 * name rather than left as an absence a later reader has to interpret.
 */
const EXEMPT = new Map([
  [
    "DERIVED_ARTIFACTS",
    "owns an explicit precomputation command; what it generates is looked at through the recipe or shot that consumes it",
  ],
  [
    "EVIDENCE_GRAPH",
    "owns which folder a production document belongs in and what it cites, an obligation over prose rather than over anything drawn",
  ],
  [
    "SCREENPLAY_WRITING",
    "owns prose craft at a stage where no geometry exists to look at",
  ],
  [
    "SOURCE_OWNERSHIP",
    "owns who may write which file, and points at the surfaces that judge the result rather than performing a judgment",
  ],
  [
    "TYPESCRIPT",
    "owns module and registration patterns, not the thing those modules build",
  ],
]);

const CODE_SPAN = /`([^`\n]+)`/gu;

/** Whether one guide's code spans name this tool on an identifier boundary. */
const namesTool = (spans: readonly string[], tool: string): boolean =>
  spans.some((span) =>
    new RegExp(`(^|[^\\w$.])${tool}([^\\w$]|$)`, "u").test(span),
  );

/**
 * Every guide that teaches building or judging something visible names the tool
 * that looks at it.
 *
 * `#1934` is what this guard exists for. An authoring agent built a residence
 * where an oriel window was a single unit box, fourteen polearms were headless
 * shafts, and an armoury held no weapons. Every one of those compiled, linted,
 * passed the suite, and shipped, because the guide the agent was reading while
 * it built them named no way to look at what it had built. Capture, inspection,
 * and review all existed; `WORLD_BUILDING`, `OBJECT_RIGGING`, `MODEL_RECIPE`,
 * `MOTION`, `CINEMATOGRAPHY`, and `GEOMETRY` mentioned none of them.
 *
 * A capability an author is never told to reach for is a capability the product
 * does not really have, which is the same failure `#1904` and
 * `builtEnvironmentSpaceNodes` recorded from the other direction.
 *
 * Scenarios:
 *
 * 1. Every served guide either names an evidence tool in a code span or is
 *    listed as exempt with a stated reason.
 * 2. Every exemption names a guide that is actually served, so a renamed or
 *    retired guide cannot leave a stale excuse behind.
 * 3. No exempt guide quietly grew an evidence loop, which would mean the
 *    exemption is now a false statement about the corpus.
 */
export const test_mcp_guide_evidence_discipline = (): void => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "automovie-evidence-"));
  fs.writeFileSync(
    path.join(root, "automovie.config.ts"),
    "export default {};\n",
  );
  try {
    inspectEvidenceDiscipline(new AutoMovieApplication({ projectRoot: root }));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
};

const inspectEvidenceDiscipline = (application: AutoMovieApplication): void => {
  const guides = AUTOMOVIE_PRODUCTION_GUIDE_NAMES.map((name) => ({
    name,
    spans: [
      ...application.getGuideDocument({ name }).content.matchAll(CODE_SPAN),
    ].map((span) => span[1]!),
  }));
  const drives = (guide: (typeof guides)[number]): boolean =>
    EVIDENCE_TOOLS.some((tool) => namesTool(guide.spans, tool));

  TestValidator.equals(
    "every guide that teaches something visible names the tool that looks at it",
    guides
      .filter(
        (guide) => EXEMPT.has(guide.name) === false && drives(guide) === false,
      )
      .map((guide) => guide.name)
      .sort(compareCodeUnits),
    [],
  );

  TestValidator.equals(
    "every exemption names a served guide",
    [...EXEMPT.keys()]
      .filter((name) => guides.some((guide) => guide.name === name) === false)
      .sort(compareCodeUnits),
    [],
  );

  TestValidator.equals(
    "no exempt guide silently grew an evidence loop",
    guides
      .filter((guide) => EXEMPT.has(guide.name) && drives(guide))
      .map((guide) => guide.name)
      .sort(compareCodeUnits),
    [],
  );
};
