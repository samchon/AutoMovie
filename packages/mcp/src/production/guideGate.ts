import type {
  AutoMovieProductionGuideName,
  IAutoMovieReviewTarget,
} from "@automovie/interface";

import type { AutoMovieApplication } from "../AutoMovieApplication";
import type { AutoMovieProductionContext } from "./AutoMovieProductionContext";

/**
 * Guides each tool requires before this session may call it.
 *
 * The table is keyed by `keyof AutoMovieApplication`. A tool added to the
 * reflected surface therefore fails to compile until someone decides what it
 * must be read with.
 *
 * That is stricter than a lookup on demand, which would treat an unknown tool
 * as ungated and ship it that way.
 */
export const AUTOMOVIE_TOOL_GUIDES = {
  getGuideDocument: [],
  captureFrame: ["AUTOMOVIE_OVERALL", "CAPTURE_FRAME"],
  captureTurntable: ["AUTOMOVIE_OVERALL", "CAPTURE_FRAME"],
  repaintShot: ["AUTOMOVIE_OVERALL", "REPAINT_SHOT"],
  inspectSubject: ["AUTOMOVIE_OVERALL", "SUBJECT_INSPECTION"],
} as const satisfies Record<
  keyof AutoMovieApplication,
  readonly AutoMovieProductionGuideName[]
>;

/**
 * Additional guide required only by productions declaring repaint delivery.
 *
 * It is demanded after the tracked design is read rather than beside the other
 * repaint guides, so a deterministic production is never told to read diffusion
 * guidance it will never use.
 */
export const AUTOMOVIE_REPAINT_GUIDE =
  "DIFFUSION_ENHANCE" as const satisfies AutoMovieProductionGuideName;

/**
 * Target-specific review contract added to both review tools.
 */
export const AUTOMOVIE_REVIEW_GUIDES = {
  asset: "REVIEW_ASSET",
  subject: "REVIEW_SUBJECT",
  design: "REVIEW_DEPENDENCY",
  source: "REVIEW_DEPENDENCY",
  shot: "REVIEW_SHOT",
  rendition: "REVIEW_SHOT",
  sequence: "REVIEW_SEQUENCE",
  film: "REVIEW_FILM",
} as const satisfies Record<
  IAutoMovieReviewTarget["kind"],
  AutoMovieProductionGuideName
>;

/**
 * Select the review guide one exact target kind is judged under.
 */
export const autoMovieReviewGuide = (
  target: IAutoMovieReviewTarget,
): AutoMovieProductionGuideName => AUTOMOVIE_REVIEW_GUIDES[target.kind];

/**
 * Refuse one tool until every guide it is gated on has session credit.
 *
 * The refusal counts the credited guides and lists each missing read as the
 * exact call that recovers it. A client told only that it failed retries the
 * payload instead of the knowledge.
 *
 * It throws instead of returning diagnostics. A missing read is a precondition
 * of the call, not an outcome of one.
 */
export const requireAutoMovieGuides = (
  context: AutoMovieProductionContext,
  tool: keyof typeof AUTOMOVIE_TOOL_GUIDES,
  targetGuide?: AutoMovieProductionGuideName,
): void => {
  const required: readonly AutoMovieProductionGuideName[] = [
    ...AUTOMOVIE_TOOL_GUIDES[tool],
    ...(targetGuide === undefined ? [] : [targetGuide]),
  ];
  const missing = required.filter((guide) => context.hasGuide(guide) === false);
  if (missing.length === 0) return;
  throw new Error(
    `${tool} is knowledge-gated: ${required.length - missing.length}/${required.length} required guides have session credit. Recover in order:\n${missing
      .map(
        (guide, index) =>
          `${index + 1}. getGuideDocument({ name: "${guide}" })`,
      )
      .join(
        "\n",
      )}\nThen retry ${tool} unchanged. This is a missing-knowledge precondition, not a payload validation error.`,
  );
};
