import {
  AutoMovieRenderMetric,
  IAutoMovieRenderBudget,
  IAutoMovieRenderContributor,
  IAutoMovieRenderFinding,
  IAutoMovieRenderInventory,
  IAutoMovieRenderReport,
  IAutoMovieRenderTarget,
  IAutoMovieSemanticMask,
} from "@automovie/interface";

import {
  autoMovieRenderDigest,
  compareAutoMovieRenderIds,
} from "./renderDigest";
import { AUTOMOVIE_RENDER_METRICS } from "./renderInventory";

/**
 * How many dominant owners one finding may list.
 *
 * This is the whole of what bounds the report. A finding names the few owners
 * worth editing and counts the rest, so a report over a fifty-thousand-slot
 * production is the same size as one over a single room. An unbounded list
 * would be a second copy of the inventory wearing a verdict, and the one
 * artifact that has to be read at a glance would become the one nobody reads.
 *
 * @evidence requirements/rendering/budgets.md#rendering-expansion-bounds Caps the owner expansion of every finding while retaining the omitted total.
 * @evidence specifications/editorial-render-and-delivery/render-budget-identity-and-recovery.md#spec-render-budget-preflight Implements the bounded dominant-owner report instead of copying the full inventory.
 */
export const AUTOMOVIE_RENDER_REPORT_MAX_CONTRIBUTORS = 8;

/**
 * Check one inventory against one declared budget and produce the bounded
 * report.
 *
 * The report answers for every metric, always, with one of five outcomes. Four
 * of them are not "pass":
 *
 * - `within`: measured, budgeted, at or below the limit;
 * - `over`: measured, budgeted, above the limit, with the dominant owners and the
 *   exact way back;
 * - `unbudgeted`: measured, but the production declared no limit, so nobody
 *   agreed what large means;
 * - `unsupported`: no analysis exists for what the design declares;
 * - `not-run`: the analysis exists but its input was not supplied.
 *
 * The last two make the whole report `incomplete`. That is the point of them:
 * an artifact whose fluid cost was never computed has not been cleared for
 * fluid cost, and a report that said `within` would be the exact false
 * capability claim this evidence exists to prevent.
 *
 * A budget limit that is negative, fractional or non-finite is an authoring
 * mistake and throws, rather than becoming a budget that can never be met.
 *
 * An `over` finding names somewhere the author can actually go. The limit is
 * compared against the inventory's own total, frame passes and all, but the
 * dominant-owner ranking is over the owners that hold their own cost; the
 * passes are counted among the owners the report does not name and stated in
 * the recovery as passes. A ranking that let them compete would put the same
 * name first in every production that lights nothing, and that name is a guide
 * pass no production declares.
 *
 * @evidence requirements/rendering/budgets.md#rendering-budget-decision Produces the per-metric within, over, unbudgeted, unsupported, and not-run decisions required for an actionable render budget.
 * @evidence requirements/rendering/budgets.md#rendering-budget-tiers Evaluates the exact limits supplied by the caller's declared tier without treating a cheaper profile as equivalent clearance.
 * @evidence requirements/rendering/budgets.md#rendering-budget-refusal Returns over and incomplete preflight results before rendering when a declared limit is exceeded or a required metric is unavailable.
 * @evidence requirements/lighting/budgets-and-representation.md#lighting-budget-refusal Reports an over or incomplete lighting metric with its declared limit, dominant owner, and explicit recovery instead of silently dropping a source or shadow.
 * @evidence requirements/production-design/budgets-and-feasibility.md#production-design-budget-refusal Refuses an over-limit or unmeasured render metric with its dominant semantic owner before runtime degradation can hide the excess.
 * @evidence requirements/operations-and-recovery/resource-budgets-and-backpressure.md#operations-budget-admission-estimate Compares the pre-render resource estimate with declared limits and distinguishes ready, over-limit, and incomplete admission outcomes.
 * @evidence specifications/editorial-render-and-delivery/render-budget-identity-and-recovery.md#spec-render-budget-preflight Compares the complete worst-case inventory with declared limits and reports bounded dominant owners and recovery.
 * @evidence specifications/camera-light-and-visibility/light-transport-color-and-budget.md#clv-light-budget-report-refusal Applies the pre-render refusal report to light and shadow-map metrics without mutating the requested render profile.
 * @evidence specifications/narrative-and-intent/budgets-continuity-and-deliverables.md#narrative-intent-budget-feasibility-verdict Implements the render-preflight subset of feasibility by withholding a ready verdict from over, unsupported, or not-run required metrics.
 * @evidence specifications/execution-and-recovery/resource-budgets-and-backpressure.md#execution-budget-admission-estimate Converts exact or conservative render metrics and unknown gaps into the bounded preflight decision without scheduling the work.
 * @evidence specifications/execution-and-recovery/resource-budgets-and-backpressure.md#execution-domain-budget-refusal Returns the render-domain over-limit or incomplete verdict unchanged instead of selecting a cheaper quality profile or starting degraded work.
 * @evidence requirements/map/scale-and-populations.md#map-population-budget-refusal `evaluateAutoMovieRenderBudget` returns an over or incomplete population verdict with the measured count, declared limit, dominant owner, and recovery before rendering.
 * @evidence specifications/world-and-site/partition-lod-streaming-and-seams.md#world-site-population-budget-refusal The preflight report refuses an over-limit or unmeasured realized population without silently reducing the declared world population.
 * @author Samchon
 */
export const evaluateAutoMovieRenderBudget = (props: {
  /** Measured cost of the artifact. */
  inventory: IAutoMovieRenderInventory;
  /** Declared limits, or `null` for a production that declares none. */
  budget: IAutoMovieRenderBudget | null;
  /** Semantic palette the owners in this report are addressable in. */
  mask: IAutoMovieSemanticMask;
  /** Renderer, settings and assets the measurement is bound to. */
  target: IAutoMovieRenderTarget;
  /** Dominant-owner bound; defaults to the exported maximum. */
  maxContributors?: number;
}): IAutoMovieRenderReport => {
  const { inventory, budget, mask, target } = props;
  const limit =
    props.maxContributors ?? AUTOMOVIE_RENDER_REPORT_MAX_CONTRIBUTORS;
  if (!Number.isSafeInteger(limit) || limit < 1)
    throw new Error(
      `render report contributor bound must be a positive safe integer, but was ${limit}`,
    );
  for (const [metric, value] of Object.entries(budget?.limits ?? {}))
    if (!Number.isSafeInteger(value) || value < 0)
      throw new Error(
        `render budget limit for "${metric}" must be a safe integer at or above zero, but was ${value}`,
      );

  const gaps = new Map(inventory.gaps.map((gap) => [gap.metric, gap]));
  const findings = AUTOMOVIE_RENDER_METRICS.map((metric) =>
    evaluate({ metric, inventory, budget, gap: gaps.get(metric), limit }),
  );
  const status = findings.some((finding) => finding.status === "over")
    ? "over"
    : findings.some(
          (finding) =>
            finding.status === "unsupported" || finding.status === "not-run",
        )
      ? "incomplete"
      : "within";
  return {
    version: 1,
    protocol: "automovie.render-report.v1",
    tier: budget === null ? "unbudgeted" : budget.tier,
    status,
    findings,
    mask: mask.digest,
    target,
    digest: autoMovieRenderDigest(
      [
        "automovie.render-report.v1",
        budget === null ? "unbudgeted" : budget.tier,
        status,
        ...findings.map((finding) =>
          [
            finding.metric,
            finding.status,
            String(finding.measured),
            String(finding.limit),
            String(finding.excess),
            ...finding.contributors.map(
              (contributor) => `${contributor.owner}=${contributor.cost}`,
            ),
            String(finding.omittedContributors),
            String(finding.omittedCost),
          ].join("|"),
        ),
        mask.digest,
        target.digest,
      ].join("\n"),
    ),
  };
};

const evaluate = (props: {
  metric: AutoMovieRenderMetric;
  inventory: IAutoMovieRenderInventory;
  budget: IAutoMovieRenderBudget | null;
  gap: IAutoMovieRenderInventory["gaps"][number] | undefined;
  limit: number;
}): IAutoMovieRenderFinding => {
  const { metric, inventory, budget, gap } = props;
  const measured = inventory.totals[metric];
  const declared = budget?.limits[metric] ?? null;
  const { passes, ...ranked } = rank(inventory, metric, props.limit);

  if (gap !== undefined)
    return {
      metric,
      status: gap.status,
      measured: null,
      limit: declared,
      excess: 0,
      ...ranked,
      recovery: `${gap.reason}; ${gap.remedy}`,
    };
  if (measured === null)
    // An unmeasured metric with no gap beside it would be an evidence hole
    // nobody declared, so it is reported as one rather than assumed to be zero.
    return {
      metric,
      status: "not-run",
      measured: null,
      limit: declared,
      excess: 0,
      ...ranked,
      recovery: `the inventory reported no value for "${metric}" and declared no reason; measure it or record the gap`,
    };
  if (declared === null)
    return {
      metric,
      status: "unbudgeted",
      measured,
      limit: null,
      excess: 0,
      ...ranked,
      recovery: null,
    };
  if (measured <= declared)
    return {
      metric,
      status: "within",
      measured,
      limit: declared,
      excess: 0,
      ...ranked,
      recovery: null,
    };
  const dominant = ranked.contributors[0];
  // What the frame passes add is stated beside the owners rather than among
  // them. Without it the listed costs come up short of the measurement for no
  // reason a reader can see, and the one shadow caster doubling the frame,
  // often the cheapest edit on the page, would go unmentioned once it stopped
  // being ranked as an owner.
  const passed =
    passes === null
      ? ""
      : `; a further ${passes.cost} of that total is frame passes redrawing the opaque owners, the largest "${passes.dominant.owner}" at ${passes.dominant.cost}`;
  return {
    metric,
    status: "over",
    measured,
    limit: declared,
    excess: measured - declared,
    ...ranked,
    recovery:
      dominant === undefined
        ? `"${metric}" measures ${measured} against a limit of ${declared}; the inventory attributed none of it to an editable owner, so raise the limit deliberately or reduce the whole scene${passed}`
        : `"${metric}" measures ${measured} against a limit of ${declared}, ${measured - declared} over; the largest owner is "${dominant.owner}" at ${dominant.cost}, edited at ${dominant.source}${passed}`,
  };
};

/**
 * The dominant owners of one metric, what the report leaves unnamed, and what
 * the frame passes add.
 *
 * Sorted by cost descending, then by owner id ascending. The tie-break on the
 * id is what makes the list a property of the production rather than of the
 * order the inventory happened to visit owners in, so two runs of the same
 * design produce the same eight names.
 *
 * Ranking and accounting are two questions and one list cannot answer both. A
 * frame pass redraws the geometry the drawable owners already paid for, so its
 * cost is their sum and it can never lose a cost-descending ranking: leaving it
 * in makes the first line of the table a constant, and for the outline pass it
 * makes that line a name no production declares and no author can open. So the
 * ranking is over `own` rows alone, while the passes stay in the omitted count
 * and the omitted cost. Nothing is dropped: the contributors plus the omitted
 * cost still add up to everything the inventory attributed, and the totals the
 * report checks against a limit are the inventory's own, untouched.
 *
 * The `instanceSlots` and `fluidCells` rankings never had this problem and do
 * not change: a resident cost is allocated once and reused by every pass, so no
 * pass row exists to outrank the drawable that owns it.
 */
const rank = (
  inventory: IAutoMovieRenderInventory,
  metric: AutoMovieRenderMetric,
  limit: number,
): {
  contributors: IAutoMovieRenderContributor[];
  omittedContributors: number;
  omittedCost: number;
  passes: { cost: number; dominant: IAutoMovieRenderContributor } | null;
} => {
  const totals = new Map<string, IAutoMovieRenderContributor>();
  const passes = new Map<string, IAutoMovieRenderContributor>();
  for (const entry of inventory.owners) {
    if (entry.metric !== metric) continue;
    const into = entry.kind === "pass" ? passes : totals;
    const current = into.get(entry.owner);
    if (current === undefined)
      into.set(entry.owner, {
        owner: entry.owner,
        source: entry.source,
        cost: entry.cost,
      });
    else current.cost += entry.cost;
  }
  const order = (
    left: IAutoMovieRenderContributor,
    right: IAutoMovieRenderContributor,
  ): number =>
    right.cost - left.cost ||
    compareAutoMovieRenderIds(left.owner, right.owner);
  const ordered = [...totals.values()].sort(order);
  const orderedPasses = [...passes.values()].sort(order);
  const passCost = orderedPasses.reduce((sum, entry) => sum + entry.cost, 0);
  const omitted = ordered.slice(limit);
  return {
    contributors: ordered.slice(0, limit),
    omittedContributors: omitted.length + orderedPasses.length,
    omittedCost: omitted.reduce((sum, entry) => sum + entry.cost, 0) + passCost,
    // A pass that costs nothing is a pass over an empty frame, and naming it
    // would answer a question nobody asked.
    passes:
      passCost === 0 ? null : { cost: passCost, dominant: orderedPasses[0]! },
  };
};
