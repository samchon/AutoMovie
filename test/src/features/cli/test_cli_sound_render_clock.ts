import type { IAutoMovieProductionSoundPlan } from "@automovie/interface";
import type { IAutoMovieProductionRenderJobPlan } from "@automovie/production";
import { renderScaffold, writeFiles } from "@automovie/template";
import { TestValidator } from "@nestia/e2e";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { preserveCliHarnessCleanup } from "./CliHarnessCleanup";

interface IProductionRuntimeModule {
  assertProductionSoundRenderClock: (props: {
    plan: Pick<IAutoMovieProductionSoundPlan, "fps" | "totalFrames">;
    render: Pick<
      IAutoMovieProductionRenderJobPlan,
      "sourceFrameFormat" | "tier" | "totalFrames"
    >;
  }) => void;
}

/** One nine-second edit expressed on whichever clock the caller declares. */
const clock = (props: {
  planFps: number;
  planFrames: number;
  sourceFps: number;
  tierFrames: number;
  frameStep: number;
}): Parameters<
  IProductionRuntimeModule["assertProductionSoundRenderClock"]
>[0] => ({
  plan: { fps: props.planFps, totalFrames: props.planFrames },
  render: {
    sourceFrameFormat: {
      width: 1920,
      height: 1080,
      fps: props.sourceFps,
      colorSpace: "srgb",
    },
    tier: {
      kind: props.frameStep === 1 ? "final" : "proxy",
      resolutionScale: props.frameStep === 1 ? 1 : 0.5,
      frameStep: props.frameStep,
    },
    totalFrames: props.tierFrames,
  },
});

const refusal = (
  assert: IProductionRuntimeModule["assertProductionSoundRenderClock"],
  props: Parameters<
    IProductionRuntimeModule["assertProductionSoundRenderClock"]
  >[0],
): boolean => {
  try {
    assert(props);
    return false;
  } catch (error) {
    return (
      error instanceof Error &&
      error.message.includes("do not share the exact film frame clock")
    );
  }
};

const linkWorkspacePackage = (project: string, name: string): void => {
  const packageRoot = path.dirname(
    createRequire(__filename).resolve(`${name}/package.json`),
  );
  const target = path.join(project, "node_modules", ...name.split("/"));
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.symlinkSync(
    packageRoot,
    target,
    process.platform === "win32" ? "junction" : "dir",
  );
  if (!fs.statSync(target).isDirectory())
    throw new Error(`Fixture package link did not resolve: ${name}.`);
};

/**
 * A generated production scores its film once and plays that one mix under every
 * render tier, so the sound gate measures runtime through the tier's decimation
 * rather than demanding equal frame counts.
 *
 * The generated script runs through its declared `tsx` runtime. The surrounding
 * repository suite uses `ttsx`, whose inherited module hook is test-host state
 * and is deliberately not part of a scaffolded project's execution boundary.
 *
 * Scenarios:
 *
 * 1. The exact final tier (step 1) accepts the film-clock plan it always did.
 * 2. The scaffold's default proxy (step 2, half the frames at half the fps)
 *    accepts the same plan, which is the state every generated project inherits
 *    the moment it renders a feature.
 * 3. A 25 fps edit decimated by three still accepts. Its tier clock is
 *    8.333... fps, and `225 * (25 / 3)` evaluates to 1875.0000000000002 while
 *    `75 * 25` is 1875, so a gate that compared runtimes by multiplying out the
 *    decimated fps would refuse this exact proxy. The comparison never divides.
 * 4. A tier one output frame short of the plan is refused, so the correction did
 *    not become a relaxation.
 * 5. A plan resampled onto the tier's own clock is refused: the mix belongs to
 *    the film, and a proxy carrying its own sound would no longer preview the
 *    final.
 */
export const test_cli_sound_render_clock = (): void => {
  if (process.env.AUTOMOVIE_CLI_SOUND_CLOCK_CHILD !== "1") {
    const childEnvironment = { ...process.env };
    delete childEnvironment.NODE_OPTIONS;
    delete childEnvironment.TTSX_RUNTIME_MANIFEST;
    childEnvironment.AUTOMOVIE_CLI_SOUND_CLOCK_CHILD = "1";
    const result = spawnSync(
      process.execPath,
      [
        createRequire(__filename).resolve("tsx/cli"),
        "--eval",
        `import { test_cli_sound_render_clock as run } from ${JSON.stringify(pathToFileURL(__filename).href)}; run();`,
      ],
      {
        encoding: "utf8",
        env: childEnvironment,
      },
    );
    if (result.status !== 0)
      throw new Error(
        `Generated sound-clock fixture failed under its tsx runtime.\n${result.stderr || result.stdout}`,
      );
    return;
  }
  const base = fs.mkdtempSync(
    path.join(os.tmpdir(), "automovie-cli-sound-clock-"),
  );
  let failure: { error: unknown } | undefined;
  try {
    const project = path.join(base, "project");
    writeFiles(project, renderScaffold({ name: "sound-clock-film" }));
    for (const name of ["@automovie/engine", "@automovie/interface"])
      linkWorkspacePackage(project, name);
    const { assertProductionSoundRenderClock: assert } = createRequire(
      __filename,
    )(
      path.join(project, "scripts", "productionRuntime.ts"),
    ) as IProductionRuntimeModule;
    TestValidator.equals(
      "the sound gate measures runtime through the tier decimation",
      {
        final: refusal(
          assert,
          clock({
            planFps: 24,
            planFrames: 216,
            sourceFps: 24,
            tierFrames: 216,
            frameStep: 1,
          }),
        ),
        proxy: refusal(
          assert,
          clock({
            planFps: 24,
            planFrames: 216,
            sourceFps: 24,
            tierFrames: 108,
            frameStep: 2,
          }),
        ),
        inexactProxyFps: refusal(
          assert,
          clock({
            planFps: 25,
            planFrames: 225,
            sourceFps: 25,
            tierFrames: 75,
            frameStep: 3,
          }),
        ),
        shortTier: refusal(
          assert,
          clock({
            planFps: 24,
            planFrames: 216,
            sourceFps: 24,
            tierFrames: 107,
            frameStep: 2,
          }),
        ),
        tierClockPlan: refusal(
          assert,
          clock({
            planFps: 12,
            planFrames: 108,
            sourceFps: 24,
            tierFrames: 108,
            frameStep: 2,
          }),
        ),
      },
      {
        final: false,
        proxy: false,
        inexactProxyFps: false,
        shortTier: true,
        tierClockPlan: true,
      },
    );
  } catch (error) {
    failure = { error };
    throw error;
  } finally {
    preserveCliHarnessCleanup(failure, [
      {
        resource: "sound clock fixture root",
        cleanup: () => fs.rmSync(base, { force: true, recursive: true }),
      },
    ]);
  }
};
