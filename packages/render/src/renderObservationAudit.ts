import type {
  AutoMovieRenderMetric,
  IAutoMovieRenderObservation,
  IAutoMovieRenderObservationBreach,
  IAutoMovieRenderReport,
} from "@automovie/interface";

/**
 * Check what one capture actually drew against the report that cleared it.
 *
 * Report measurements are exact or conservative preflight bounds. Drawing less
 * is expected after culling and level-of-detail selection, while drawing more
 * proves that the report describes a different render inventory. A metric for
 * which the report produced no number remains `unchecked`; absence of a breach
 * never turns an analysis that did not run into agreement.
 *
 * @author Samchon
 * @evidence requirements/rendering/budgets.md#rendering-runtime-budget-enforcement Distinguishes the report's exact or conservative preflight estimate from the measured scene-graph actual and refuses agreement when a runtime measurement is absent.
 * @evidence specifications/editorial-render-and-delivery/render-budget-identity-and-recovery.md#spec-render-budget-preflight Compares the actual draw inventory with the preflight bound without changing the requested tier.
 */
export function auditAutoMovieRenderObservation(props: {
  /** The report that cleared the artifact. */
  report: IAutoMovieRenderReport;
  /** What the captured scene actually submits. */
  observed: IAutoMovieRenderObservation;
}): {
  /** Whether every observable metric was measured and stayed inside its bound. */
  agrees: boolean;
  /** Every observed value above its report bound, in metric order. */
  breaches: IAutoMovieRenderObservationBreach[];
  /** Observable metrics for which the report produced no number. */
  unchecked: AutoMovieRenderMetric[];
} {
  const observable: ReadonlyArray<
    [AutoMovieRenderMetric, keyof IAutoMovieRenderObservation]
  > = [
    ["triangles", "triangles"],
    ["drawCalls", "drawCalls"],
    ["materials", "materials"],
    ["textures", "textures"],
    ["lights", "lights"],
    ["shadowMaps", "shadowMaps"],
    ["instanceSlots", "instanceSlots"],
  ];
  const measured = new Map(
    props.report.findings.map((finding) => [finding.metric, finding.measured]),
  );
  const breaches: IAutoMovieRenderObservationBreach[] = [];
  const unchecked: AutoMovieRenderMetric[] = [];
  for (const [metric, field] of observable) {
    const bound = measured.get(metric) ?? null;
    if (bound === null) {
      unchecked.push(metric);
      continue;
    }
    const observed = props.observed[field];
    if (observed > bound) breaches.push({ metric, bound, observed });
  }
  return {
    agrees: breaches.length === 0 && unchecked.length === 0,
    breaches,
    unchecked,
  };
}
