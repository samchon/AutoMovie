import type {
  AutoMovieRenderMetric,
  IAutoMovieRenderObservation,
  IAutoMovieRenderReport,
} from "@automovie/interface";
import { auditAutoMovieRenderObservation } from "@automovie/render";
import { TestValidator } from "@nestia/e2e";

const METRICS: readonly AutoMovieRenderMetric[] = [
  "triangles",
  "vertices",
  "drawCalls",
  "materials",
  "textures",
  "textureBytes",
  "geometryBytes",
  "lights",
  "shadowMaps",
  "nodes",
  "instanceSets",
  "instanceSlots",
  "instanceChunks",
  "fluidCells",
  "fluidParticles",
];

const report = (
  measured: Partial<Record<AutoMovieRenderMetric, number | null>> = {},
): IAutoMovieRenderReport => ({
  version: 1,
  protocol: "automovie.render-report.v1",
  tier: "evidence",
  status: Object.values(measured).some((value) => value === null)
    ? "incomplete"
    : "within",
  findings: METRICS.map((metric) => ({
    metric,
    status: measured[metric] === null ? "not-run" : "unbudgeted",
    measured: measured[metric] === undefined ? 10 : measured[metric],
    limit: null,
    excess: 0,
    contributors: [],
    omittedContributors: 0,
    omittedCost: 0,
    recovery:
      measured[metric] === null ? `measure ${metric} before capture` : null,
  })),
  mask: "sha256:mask",
  target: {
    protocol: "automovie.render-target.v1",
    renderer: { api: "webgl2", vendor: "fixture", device: "fixture" },
    settings: {
      width: 640,
      height: 360,
      pixelRatio: 1,
      shadows: true,
      shadowType: "pcf",
      toneMapping: "none",
      exposure: 1,
    },
    assets: [],
    digest: "sha256:target",
  },
  digest: "sha256:report",
});

const observation = (
  override: Partial<IAutoMovieRenderObservation> = {},
): IAutoMovieRenderObservation => ({
  meshes: 3,
  drawCalls: 3,
  triangles: 9,
  materials: 2,
  textures: 1,
  lights: 1,
  shadowMaps: 1,
  instanceSlots: 4,
  ...override,
});

/**
 * Actual scene-graph counts never inherit a preflight verdict they did not
 * earn.
 *
 * Scenarios:
 *
 * 1. Every observed metric at or below its preflight report bound agrees.
 * 2. Values above two bounds return both breaches in canonical metric order.
 * 3. A report finding with no measurement is `unchecked` and refuses agreement
 *    instead of inventing a bound.
 * 4. Metrics the live scene observation does not expose do not masquerade as
 *    runtime checks.
 * 5. Duplicate, non-finite, and negative report or renderer values stay
 *    unchecked instead of passing or manufacturing a breach.
 */
export const test_render_observation_audit = (): void => {
  TestValidator.equals(
    "actual counts within every measured preflight bound agree",
    auditAutoMovieRenderObservation({
      report: report(),
      observed: observation({ triangles: 10, instanceSlots: 10 }),
    }),
    { agrees: true, breaches: [], unchecked: [] },
  );

  TestValidator.equals(
    "every exceeded bound is named in canonical metric order",
    auditAutoMovieRenderObservation({
      report: report({ triangles: 8, materials: 1 }),
      observed: observation(),
    }),
    {
      agrees: false,
      breaches: [
        { metric: "triangles", bound: 8, observed: 9 },
        { metric: "materials", bound: 1, observed: 2 },
      ],
      unchecked: [],
    },
  );

  TestValidator.equals(
    "an absent report measurement stays unchecked",
    auditAutoMovieRenderObservation({
      report: report({ triangles: null }),
      observed: observation({ triangles: 1_000 }),
    }),
    { agrees: false, breaches: [], unchecked: ["triangles"] },
  );

  TestValidator.equals(
    "preflight-only metrics are not claimed as live observations",
    auditAutoMovieRenderObservation({
      report: report({ vertices: null, textureBytes: null }),
      observed: observation(),
    }).unchecked,
    [],
  );

  const base = report();
  TestValidator.equals(
    "duplicate report metrics are ambiguous",
    auditAutoMovieRenderObservation({
      report: {
        ...base,
        findings: [...base.findings, base.findings[0]!],
      },
      observed: observation(),
    }).unchecked,
    ["triangles"],
  );

  for (const [title, bound] of [
    ["non-finite report bounds", Number.NaN],
    ["negative report bounds", -1],
  ] as const)
    TestValidator.equals(
      title,
      auditAutoMovieRenderObservation({
        report: report({ triangles: bound }),
        observed: observation(),
      }).unchecked,
      ["triangles"],
    );

  for (const [title, triangles] of [
    ["null renderer observations", null],
    ["non-finite renderer observations", Number.NaN],
    ["negative renderer observations", -1],
  ] as const)
    TestValidator.equals(
      title,
      auditAutoMovieRenderObservation({
        report: report(),
        observed: observation({ triangles }),
      }).unchecked,
      ["triangles"],
    );
};
