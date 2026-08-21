import type { AutoMovieEvidenceStage } from "../AutoMovieEvidenceStage";
import type { IAutoMovieEvidenceConfigProps } from "../IAutoMovieEvidenceConfigProps";

/** Whether a stage has started enforcing its graph. */
const enabled = (stage: AutoMovieEvidenceStage): boolean =>
  stage !== "disabled";

/** Refuse a downstream layer whose immediate parent is not reviewed. */
const requireReviewedParent = (
  childName: string,
  child: AutoMovieEvidenceStage,
  parentName: string,
  parent: AutoMovieEvidenceStage,
): void => {
  if (enabled(child) && parent !== "review")
    throw new Error(
      `${childName} cannot enter ${child} before ${parentName} is in review.`,
    );
};

/**
 * Refuses mixed production kinds and skipped evidence stages.
 *
 * The validation runs while `lint.config.ts` is evaluated, before an inactive
 * or impossible graph can report a misleading clean build.
 */
export function validateEvidenceStages(
  props: IAutoMovieEvidenceConfigProps,
): void {
  if (props.kind === "film" && props.briefs !== "disabled")
    throw new Error("A film cannot activate the direct-brief layer.");
  if (
    props.kind === "brief" &&
    [props.storylines, props.scenarios, props.script].some(enabled)
  )
    throw new Error(
      "A direct brief cannot activate storylines, scenarios, or script.",
    );
  if (
    props.kind === "library" &&
    [
      props.storylines,
      props.scenarios,
      props.script,
      props.briefs,
      props.shots,
      props.filmSources,
    ].some(enabled)
  )
    throw new Error(
      "A library cannot activate narrative, brief, shot, or film-source layers.",
    );

  if (enabled(props.research))
    for (const [name, stage] of [
      ["settings", props.settings],
      ["models", props.models],
      ["motions", props.motions],
      ["storylines", props.storylines],
      ["scenarios", props.scenarios],
      ["script", props.script],
      ["briefs", props.briefs],
    ] as const)
      requireReviewedParent(name, stage, "research", props.research);

  requireReviewedParent("models", props.models, "settings", props.settings);
  requireReviewedParent("motions", props.motions, "models", props.models);
  requireReviewedParent(
    "storylines",
    props.storylines,
    "settings",
    props.settings,
  );
  requireReviewedParent(
    "scenarios",
    props.scenarios,
    "storylines",
    props.storylines,
  );
  requireReviewedParent("script", props.script, "scenarios", props.scenarios);
  requireReviewedParent("briefs", props.briefs, "settings", props.settings);
  requireReviewedParent(
    "modelSources",
    props.modelSources,
    "models",
    props.models,
  );
  requireReviewedParent(
    "motionSources",
    props.motionSources,
    "motions",
    props.motions,
  );
  requireReviewedParent(
    "productionSources",
    props.productionSources,
    "settings",
    props.settings,
  );

  if (enabled(props.shots)) {
    const parentName = props.kind === "film" ? "script" : "briefs";
    const parent = props.kind === "film" ? props.script : props.briefs;
    requireReviewedParent("shots", props.shots, parentName, parent);
    if (enabled(props.models))
      requireReviewedParent(
        "shots",
        props.shots,
        "modelSources",
        props.modelSources,
      );
    if (enabled(props.motions))
      requireReviewedParent(
        "shots",
        props.shots,
        "motionSources",
        props.motionSources,
      );
  }

  if (enabled(props.filmSources)) {
    requireReviewedParent(
      "filmSources",
      props.filmSources,
      "shots",
      props.shots,
    );
    requireReviewedParent(
      "filmSources",
      props.filmSources,
      "productionSources",
      props.productionSources,
    );
  }
}
