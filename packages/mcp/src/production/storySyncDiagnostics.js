import { evaluateAutoMovieStorySync } from "@automovie/engine";
/** The cross-shot half of one acceptance criterion, when it has one. */
export const storySyncCriterionOf = (scenario) => scenario.criterion.kind === "story-sync" ? scenario.criterion : null;
/**
 * Measure one simultaneity claim against the shots' current realizations.
 *
 * Both the compiler gate and the review worksheet route through here, so the
 * verdict a compile refuses on and the outcome a reviewer must cite are the
 * same measurement over the same realized event times, never two readings that
 * can disagree.
 */
export const autoMovieStorySyncOutcome = (props) => evaluateAutoMovieStorySync({
    events: props.criterion.events,
    toleranceSeconds: props.criterion.toleranceSeconds,
    pin: (shot) => props.contracts.get(shot)?.storyTime ?? null,
    realized: (shot, event) => props
        .realization(shot)
        ?.events.find((candidate) => candidate.id === event)?.time ?? null,
});
/**
 * Refuse a production whose cross-shot simultaneity claims are not realized.
 *
 * Design validation already refused claims no realization could satisfy; this
 * is the other half, where the realizations exist and the claim is checked
 * against them rather than against their permitted range. Only required
 * scenarios block: an optional one still surfaces, as a warning, because a
 * missed simultaneity is a fact about the film either way.
 */
export const storySyncDiagnostics = (props) => {
    const diagnostics = [];
    for (const [id, scenario] of props.acceptance) {
        const criterion = storySyncCriterionOf(scenario);
        if (criterion === null)
            continue;
        const outcome = autoMovieStorySyncOutcome({
            criterion,
            contracts: props.contracts,
            realization: (shot) => props.realizations.get(shot) ?? null,
        });
        if (outcome.passed)
            continue;
        diagnostics.push({
            code: "acceptance-story-sync-failed",
            category: scenario.required ? "error" : "warning",
            phase: "compile",
            target: `acceptance:${id}`,
            path: null,
            message: `Acceptance "${id}" claims these events share one story moment, and the compiled realizations say otherwise: ${outcome.summary} Move the realized event times in the owning shot sources, repin a shot's storyTime, or state the tolerance the film actually keeps.`,
        });
    }
    // The design graph reads its acceptance records in canonical filename order,
    // so this list is already deterministic without a second sort.
    return diagnostics;
};
//# sourceMappingURL=storySyncDiagnostics.js.map