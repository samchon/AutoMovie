import type {
  IAutoMovieDiagnostic,
  IAutoMovieScreenplayIndex,
  IAutoMovieScreenplayScene,
} from "@automovie/interface";

/**
 * Lifecycle phase at which a scene's disposition is read: the authored
 * screenplay, the compiled production, or the edit.
 */
export type AutoMovieScreenplayDispositionPhase =
  | "screenplay"
  | "production"
  | "edit";

/**
 * Whether one scene belongs to a phase-local coverage denominator.
 *
 * An `OMITTED` record is a permanent tombstone and belongs to no denominator.
 * An active disposition excludes only its named phase. This function owns that
 * distinction so prose, compilation and edit do not each invent a different
 * meaning for the same public record.
 */
export const screenplaySceneIncludedAtPhase = (
  scene: IAutoMovieScreenplayScene,
  phase: AutoMovieScreenplayDispositionPhase,
): boolean => scene.status === "active" && scene.disposition?.phase !== phase;

/**
 * Validate scene disposition against every phase-local downstream claim.
 *
 * The input sets are normalized compiler facts. Their construction remains
 * with the compiler and edit owners; this helper owns only the state model and
 * therefore never guesses whether a path, citation or frame means inclusion.
 */
export const screenplayDispositionDiagnostics = (props: {
  screenplay: IAutoMovieScreenplayIndex | null;
  scope: "design" | "source" | "review" | "final";
  prose: ReadonlySet<string>;
  realized: ReadonlySet<string>;
  observed: ReadonlySet<string>;
  edited: ReadonlySet<string>;
}): IAutoMovieDiagnostic[] => {
  const screenplay = props.screenplay;
  if (screenplay === null) return [];
  const diagnostics: IAutoMovieDiagnostic[] = [];
  const claim = (
    phase: AutoMovieScreenplayDispositionPhase,
  ): ReadonlySet<string> =>
    phase === "screenplay"
      ? props.prose
      : phase === "production"
        ? props.realized
        : props.edited;
  for (const scene of screenplay.screenplay.scenes) {
    const downstream =
      props.prose.has(scene.id) ||
      props.realized.has(scene.id) ||
      props.observed.has(scene.id) ||
      props.edited.has(scene.id);
    if (scene.status === "OMITTED") {
      if (scene.disposition !== null)
        diagnostics.push({
          code: "screenplay-disposition-invalid",
          category: "error",
          phase: "compile",
          target: "screenplay",
          path: null,
          message: `OMITTED scene "${scene.id}" also declares a ${scene.disposition.phase}-phase disposition. A tombstone already excludes every phase, so the second omission state is contradictory. Remove the disposition or reactivate the scene, then compile again.`,
        });
      if (downstream)
        diagnostics.push({
          code: "screenplay-tombstone-realized",
          category: "error",
          phase: "compile",
          target: "screenplay",
          path: null,
          message: `Scene "${scene.id}" is an OMITTED tombstone, yet prose, realization, required observation or edit still includes it. Remove every downstream claim or reactivate the scene, then compile again.`,
        });
      continue;
    }
    const disposition = scene.disposition;
    if (disposition !== null) {
      if (disposition.reason.trim().length === 0)
        diagnostics.push({
          code: "screenplay-disposition-reason-blank",
          category: "error",
          phase: "compile",
          target: "screenplay",
          path: null,
          message: `Active scene "${scene.id}" has a ${disposition.phase}-phase disposition with no auditable reason. State why that exact phase excludes the scene or remove the disposition, then compile again.`,
        });
      if (claim(disposition.phase).has(scene.id))
        diagnostics.push({
          code: "screenplay-disposition-realized",
          category: "error",
          phase: "compile",
          target: "screenplay",
          path: null,
          message: `Scene "${scene.id}" is excluded from ${disposition.phase} coverage, yet that phase includes it. Phase-local omission and phase-local work cannot both be current. Remove the disposition or the ${disposition.phase} claim, then compile again.`,
        });
    }
    if (
      screenplaySceneIncludedAtPhase(scene, "production") &&
      props.realized.has(scene.id) === false
    )
      diagnostics.push({
        code: "screenplay-scene-unrealized",
        category: props.scope === "source" ? "warning" : "error",
        phase: "compile",
        target: "screenplay",
        path: null,
        message: `Active scene "${scene.id}" belongs to the production denominator and has no passing compiled realization. Build a citing shot or record a production disposition with a nonblank reason, then compile again.`,
      });
    if (
      (props.scope === "review" || props.scope === "final") &&
      screenplaySceneIncludedAtPhase(scene, "production") &&
      props.observed.has(scene.id) === false
    )
      diagnostics.push({
        code: "screenplay-scene-unobserved",
        category: "error",
        phase: "compile",
        target: "screenplay",
        path: null,
        message: `Active scene "${scene.id}" belongs to reviewed production coverage and has no required current observation. Author the required acceptance evidence or record the applicable production disposition, then compile again.`,
      });
    if (
      props.scope === "final" &&
      screenplaySceneIncludedAtPhase(scene, "edit") &&
      props.edited.has(scene.id) === false
    )
      diagnostics.push({
        code: "screenplay-scene-unedited",
        category: "error",
        phase: "compile",
        target: "screenplay",
        path: null,
        message: `Active scene "${scene.id}" belongs to final edit coverage and no edit interval includes it. Include its realizing material or record an edit disposition with a nonblank reason, then compile again.`,
      });
  }
  return diagnostics;
};
