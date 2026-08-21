import type {
  ITtscEvidenceGraphClaim,
  ITtscEvidenceGraphReference,
} from "@ttsc/evidence";

import type { IAutoMovieEvidenceConfigProps } from "../IAutoMovieEvidenceConfigProps";
import {
  oneDesignFile,
  settingsReferences,
  sourcePrinciples,
} from "./createReferences";
import {
  BRIEFS,
  DOCS,
  FILM_SOURCES,
  MODELS,
  MOTIONS,
  MOTION_SOURCES,
  PRODUCTION_SOURCES,
  SCRIPT,
  SHOT_SOURCES,
  SUBJECT_SOURCES,
} from "./graphConstants";
import { requiresEvidence, requiresReview } from "./requiresReview";

/** Creates the TypeScript ownership claims shared by generated productions. */
export const createSourceClaims = (
  props: IAutoMovieEvidenceConfigProps,
): ITtscEvidenceGraphClaim[] => {
  const modelSourceReview = requiresReview(props.modelSources);
  const motionSourceReview = requiresReview(props.motionSources);
  const shotReview = requiresReview(props.shots);
  const productionSourceReview = requiresReview(props.productionSources);
  const filmSourceReview = requiresReview(props.filmSources);
  const off = (stage: typeof props.settings): boolean =>
    !requiresEvidence(stage);
  const designUnits = (
    files: string[],
    requireReview: boolean,
  ): ITtscEvidenceGraphReference => ({
    type: "markdown",
    root: DOCS,
    files,
    symbol: "h2",
    noEvidenceExclude: true,
    requireReview,
  });

  return [
    {
      name: "each model class answers exactly one model design file",
      type: "typescript",
      files: SUBJECT_SOURCES,
      symbol: "type",
      disabled: off(props.modelSources),
      reference: oneDesignFile(MODELS, modelSourceReview),
    },
    {
      name: "model source realizes every model design unit and source principle",
      type: "typescript",
      files: SUBJECT_SOURCES,
      symbol: ["type", "property", "function"],
      disabled: off(props.modelSources),
      reference: [
        sourcePrinciples("model-sources.md", modelSourceReview),
        designUnits(MODELS, modelSourceReview),
      ],
    },
    {
      name: "each motion source answers exactly one motion design file",
      type: "typescript",
      files: MOTION_SOURCES,
      symbol: ["function", "property"],
      disabled: off(props.motionSources),
      reference: oneDesignFile(MOTIONS, motionSourceReview),
    },
    {
      name: "motion source realizes every motion unit and source principle",
      type: "typescript",
      files: MOTION_SOURCES,
      symbol: ["function", "property"],
      disabled: off(props.motionSources),
      reference: [
        sourcePrinciples("motion-sources.md", motionSourceReview),
        designUnits(MOTIONS, motionSourceReview),
      ],
    },
    {
      name: "shots realize exactly one script scene or direct-brief shot",
      type: "typescript",
      files: SHOT_SOURCES,
      symbol: ["function", "property"],
      disabled: off(props.shots),
      reference: {
        type: "markdown",
        root: DOCS,
        files: props.kind === "film" ? SCRIPT : BRIEFS,
        symbol: "h3",
        noEvidenceExclude: true,
        singleEvidencePerSymbol: true,
        requireReview: shotReview,
      },
    },
    {
      name: "shot source realizes every shot principle",
      type: "typescript",
      files: SHOT_SOURCES,
      symbol: ["function", "property"],
      disabled: off(props.shots),
      reference: sourcePrinciples("shots.md", shotReview),
    },
    {
      name: "production source serializes settings and production-source principles",
      type: "typescript",
      files: PRODUCTION_SOURCES,
      symbol: "property",
      disabled: off(props.productionSources),
      reference: [
        sourcePrinciples("production-sources.md", productionSourceReview),
        ...settingsReferences(props.location, productionSourceReview),
      ],
    },
    {
      name: "film source assembles screenplay or brief units and film-source principles",
      type: "typescript",
      files: FILM_SOURCES,
      symbol: "property",
      disabled: off(props.filmSources),
      reference: [
        sourcePrinciples("film-sources.md", filmSourceReview),
        {
          type: "markdown",
          root: DOCS,
          files: props.kind === "film" ? SCRIPT : BRIEFS,
          symbol: "h2",
          noEvidenceExclude: true,
          requireReview: filmSourceReview,
        },
      ],
    },
  ];
};
