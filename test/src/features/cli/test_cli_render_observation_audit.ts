import type {
  AutoMovieCaptureObservation,
  AutoMovieContentDigest,
  AutoMovieGuidePass,
  AutoMovieRenderMetric,
  IAutoMovieRenderObservation,
  IAutoMovieRenderReport,
  IAutoMovieSemanticMask,
} from "@automovie/interface";
import { renderScaffold, writeFiles } from "@automovie/template";
import { TestValidator } from "@nestia/e2e";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { preserveCliHarnessCleanup } from "./CliHarnessCleanup";
import { linkGeneratedWorkspacePackage } from "./GeneratedWorkspaceLink";

interface IAuditRecord {
  globalFrame: number;
  pass: AutoMovieGuidePass;
  shot: string;
  status: "checked" | "not-run";
  reason: string | null;
  breaches: unknown[];
  unchecked: AutoMovieRenderMetric[];
}

interface IRenderObservationAuditModule {
  auditProductionRenderCapture: (props: {
    globalFrame: number;
    observation: AutoMovieCaptureObservation<IAutoMovieRenderObservation>;
    pass: AutoMovieGuidePass;
    report: AutoMovieCaptureObservation<IAutoMovieRenderReport>;
    shot: string;
  }) => IAuditRecord;
  publishProductionMaskSidecar: (props: {
    chunk: AutoMovieContentDigest;
    shot: string;
    sidecar: AutoMovieCaptureObservation<IAutoMovieSemanticMask>;
    stateRoot: string;
  }) => AutoMovieCaptureObservation<{
    bytes: number;
    digest: AutoMovieContentDigest;
    path: string;
  }>;
  renderProductionMaskSidecar: (
    sidecar: AutoMovieCaptureObservation<IAutoMovieSemanticMask>,
  ) => AutoMovieCaptureObservation<Uint8Array>;
  summarizeProductionRenderObservations: (audits: readonly IAuditRecord[]) => {
    checked: number;
    notRun: number;
    notRunReasons: string[];
    unchecked: AutoMovieRenderMetric[];
  };
}

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
  tier: "proxy",
  status: "within",
  findings: METRICS.map((metric) => ({
    metric,
    status: measured[metric] === null ? "not-run" : "unbudgeted",
    measured: measured[metric] === undefined ? 10 : measured[metric],
    limit: null,
    excess: 0,
    contributors: [],
    omittedContributors: 0,
    omittedCost: 0,
    recovery: measured[metric] === null ? `measure ${metric}` : null,
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

const mask = (digest: string): IAutoMovieSemanticMask => ({
  version: 1,
  protocol: "automovie.semantic-mask.v1",
  background: "#000000",
  entries: [],
  unaddressed: [],
  digest: digest as AutoMovieContentDigest,
});

const throwsWith = (task: () => unknown, text: string): boolean => {
  try {
    task();
    return false;
  } catch (error) {
    return error instanceof Error && error.message.includes(text);
  }
};

const linkWorkspacePackage = (project: string, name: string): void =>
  linkGeneratedWorkspacePackage({
    name,
    project,
    subject: "Fixture package link",
  });

/**
 * A generated render job compares actual scene counts and publishes semantic
 * mask sidecars without turning missing evidence into a pass.
 *
 * The generated script runs through its declared `tsx` runtime. The surrounding
 * repository suite uses `ttsx`, whose inherited module hook is test-host state
 * and is deliberately not part of a scaffolded project's execution boundary.
 *
 * Scenarios:
 *
 * 1. In-bound observations are checked and absent report/capture evidence keeps
 *    both reasons in a `not-run` record.
 * 2. A drawn count above its admitted report refuses the exact shot and frame.
 * 3. Summaries are stable across completion order and retain unchecked metrics.
 * 4. Sidecar bytes are stable, publish idempotently as `<shot>.mask.json`, and
 *    reject a conflicting resident palette.
 */
export const test_cli_render_observation_audit = (): void => {
  if (process.env.AUTOMOVIE_CLI_OBSERVATION_CHILD !== "1") {
    const childEnvironment = { ...process.env };
    delete childEnvironment.NODE_OPTIONS;
    delete childEnvironment.TTSX_RUNTIME_MANIFEST;
    childEnvironment.AUTOMOVIE_CLI_OBSERVATION_CHILD = "1";
    const result = spawnSync(
      process.execPath,
      [
        createRequire(__filename).resolve("tsx/cli"),
        "--eval",
        `import { test_cli_render_observation_audit as run } from ${JSON.stringify(pathToFileURL(__filename).href)}; run();`,
      ],
      {
        encoding: "utf8",
        env: childEnvironment,
      },
    );
    if (result.status !== 0)
      throw new Error(
        `Generated render-observation fixture failed under its tsx runtime.\n${result.stderr || result.stdout}`,
      );
    return;
  }
  const base = fs.mkdtempSync(
    path.join(os.tmpdir(), "automovie-cli-render-observation-"),
  );
  let failure: { error: unknown } | undefined;
  try {
    const project = path.join(base, "project");
    writeFiles(project, renderScaffold({ name: "observation-film" }));
    for (const name of [
      "@automovie/interface",
      "@automovie/production",
      "@automovie/render",
    ])
      linkWorkspacePackage(project, name);
    const module = createRequire(__filename)(
      path.join(project, "scripts", "renderObservationAudit.ts"),
    ) as IRenderObservationAuditModule;
    const checked = module.auditProductionRenderCapture({
      globalFrame: 11,
      observation: { status: "available", value: observation() },
      pass: "beauty",
      report: { status: "available", value: report() },
      shot: "opening",
    });
    const incomplete = module.auditProductionRenderCapture({
      globalFrame: 12,
      observation: { status: "available", value: observation() },
      pass: "beauty",
      report: { status: "available", value: report({ triangles: null }) },
      shot: "opening",
    });
    const notRun = module.auditProductionRenderCapture({
      globalFrame: 13,
      observation: { status: "not-run", reason: "page has no shot" },
      pass: "mask",
      report: { status: "not-run", reason: "renderer unavailable" },
      shot: "turntable",
    });
    const summary = module.summarizeProductionRenderObservations([
      notRun,
      checked,
      incomplete,
      { ...notRun, reason: "alpha" },
    ]);
    TestValidator.equals(
      "capture observations preserve checked, unchecked, and not-run facts",
      { checked, incomplete, notRun, summary },
      {
        checked: {
          globalFrame: 11,
          pass: "beauty",
          shot: "opening",
          status: "checked",
          reason: null,
          breaches: [],
          unchecked: [],
        },
        incomplete: {
          globalFrame: 12,
          pass: "beauty",
          shot: "opening",
          status: "not-run",
          reason: "render report did not measure observable metrics: triangles",
          breaches: [],
          unchecked: ["triangles"],
        },
        notRun: {
          globalFrame: 13,
          pass: "mask",
          shot: "turntable",
          status: "not-run",
          reason:
            "render report: renderer unavailable; capture observation: page has no shot",
          breaches: [],
          unchecked: [],
        },
        summary: {
          checked: 1,
          notRun: 3,
          notRunReasons: [
            "alpha",
            "render report did not measure observable metrics: triangles",
            "render report: renderer unavailable; capture observation: page has no shot",
          ],
          unchecked: ["triangles"],
        },
      },
    );
    TestValidator.predicate(
      "a report breach refuses the exact shot and frame",
      throwsWith(
        () =>
          module.auditProductionRenderCapture({
            globalFrame: 21,
            observation: {
              status: "available",
              value: observation({ triangles: 11 }),
            },
            pass: "beauty",
            report: { status: "available", value: report() },
            shot: "crowd",
          }),
        'shot "crowd" at frame 21',
      ),
    );

    const sidecar = mask("sha256:palette-a");
    const rendered = module.renderProductionMaskSidecar({
      status: "available",
      value: sidecar,
    });
    const unavailable = module.renderProductionMaskSidecar({
      status: "not-run",
      reason: "asset turntable has no compiled shot",
    });
    if (rendered.status !== "available")
      throw new Error("Fixture sidecar did not serialize.");
    const chunk = `sha256:${"a".repeat(64)}` as AutoMovieContentDigest;
    const first = module.publishProductionMaskSidecar({
      chunk,
      shot: "opening/hero",
      sidecar: { status: "available", value: sidecar },
      stateRoot: project,
    });
    const repeated = module.publishProductionMaskSidecar({
      chunk,
      shot: "opening/hero",
      sidecar: { status: "available", value: sidecar },
      stateRoot: project,
    });
    TestValidator.equals(
      "semantic mask sidecars serialize and publish idempotently",
      {
        rendered: Buffer.from(rendered.value).toString("utf8"),
        unavailable,
        first,
        repeated,
        resident:
          first.status === "available"
            ? fs.readFileSync(first.value.path, "utf8")
            : null,
        named:
          first.status === "available" ? path.basename(first.value.path) : null,
      },
      {
        rendered: `${JSON.stringify(sidecar, null, 2)}\n`,
        unavailable: {
          status: "not-run",
          reason: "asset turntable has no compiled shot",
        },
        first,
        repeated: first,
        resident: `${JSON.stringify(sidecar, null, 2)}\n`,
        named: "opening%2Fhero.mask.json",
      },
    );
    TestValidator.equals(
      "sidecar publication refuses invalid identity and conflicting bytes",
      {
        invalid: throwsWith(
          () =>
            module.publishProductionMaskSidecar({
              chunk: "sha256:short" as AutoMovieContentDigest,
              shot: "opening",
              sidecar: { status: "available", value: sidecar },
              stateRoot: project,
            }),
          "SHA-256",
        ),
        conflict: throwsWith(
          () =>
            module.publishProductionMaskSidecar({
              chunk,
              shot: "opening/hero",
              sidecar: {
                status: "available",
                value: mask("sha256:palette-b"),
              },
              stateRoot: project,
            }),
          "differs from the captured semantic mask",
        ),
      },
      { invalid: true, conflict: true },
    );
  } catch (error) {
    failure = { error };
    throw error;
  } finally {
    preserveCliHarnessCleanup(failure, [
      {
        resource: "render observation fixture root",
        cleanup: () => fs.rmSync(base, { force: true, recursive: true }),
      },
    ]);
  }
};
