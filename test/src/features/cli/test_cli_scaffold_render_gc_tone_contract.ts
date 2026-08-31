import { renderScaffold, writeFiles } from "@automovie/template";
import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { preserveCliHarnessCleanup } from "./CliHarnessCleanup";
import { linkGeneratedWorkspacePackage } from "./GeneratedWorkspaceLink";

interface IRenderGcTargetSnapshot {
  bytes: number;
  target: string;
}

interface IReadOnlyRuntimeModules {
  captureRenderGcTarget(
    stateRoot: string,
    target: string,
  ): IRenderGcTargetSnapshot;
  checkProductionDeliveryTone(props: {
    compareCodeUnits(left: string, right: string): number;
    frames: Array<{ receipt: { bundle: string } | null }>;
    project: {
      renderRoot(): string;
      verifiedRenderManifest(file: string): null | {
        renderSpec: { toneMapping: string };
      };
    };
  }): {
    bundle: string | null;
    recorded: string | null;
    reason: string | null;
    requested: string;
    status: "checked" | "not-run";
  };
  createProductionRenderGarbageRuntime(props: Record<string, unknown>): {
    collect(apply: boolean): unknown;
  };
  removeCapturedRenderGcTarget(props: {
    isolated: string;
    quarantine: string;
    snapshot: IRenderGcTargetSnapshot;
  }): void;
}

const linkWorkspacePackage = (project: string, name: string): void =>
  linkGeneratedWorkspacePackage({
    name,
    project,
    subject: "Read-only runtime package root",
  });

const runtimeModules = (scripts: string): IReadOnlyRuntimeModules =>
  ({
    ...(require(path.join(scripts, "renderGcRuntime.ts")) as object),
    ...(require(path.join(scripts, "renderGcSnapshot.ts")) as object),
    ...(require(path.join(scripts, "renderPlanningRuntime.ts")) as object),
  }) as IReadOnlyRuntimeModules;

const census = (root: string, directory = root): string[] =>
  fs
    .readdirSync(directory, { withFileTypes: true })
    .sort((left, right) => left.name.localeCompare(right.name))
    .flatMap((entry) => {
      const target = path.join(directory, entry.name);
      const relative = path.relative(root, target).split(path.sep).join("/");
      if (entry.isDirectory()) return [`${relative}/`, ...census(root, target)];
      return [relative];
    });

const message = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

/**
 * Dry garbage collection and delivery-tone scans inspect their bounded state
 * without repairing or hiding it. Status and verify reads are owned by #2143.
 *
 * Scenarios:
 *
 * 1. Dry GC against a missing production returns its primary refusal while an
 *    exact before/after census proves it creates no state, lock, quarantine,
 *    current pointer, lease, or incarnation path.
 * 2. Two verified captured bundles with the requested delivery curve return the
 *    first sorted bundle only as the representative checked result.
 * 3. Changing only the second bundle's sealed curve refuses it even though the
 *    first bundle matches, guarding the former matching-first early return.
 */
export const test_cli_scaffold_render_gc_tone_contract = (): void => {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), "automovie-render-read-only-"),
  );
  let failure: { error: unknown } | undefined;
  try {
    writeFiles(root, renderScaffold({ name: "read-only-film" }));
    for (const name of [
      "@automovie/archetypes",
      "@automovie/engine",
      "@automovie/interface",
      "@automovie/production",
      "@automovie/render",
      "@automovie/viewer",
      "@types/node",
      "@types/pngjs",
      "@types/three",
      "h264-mp4-encoder",
      "mp4box",
      "playwright",
      "pngjs",
      "three",
      "vite",
    ])
      linkWorkspacePackage(root, name);
    const modules = runtimeModules(path.join(root, "scripts"));

    const missingRoot = path.join(root, "missing-production");
    fs.mkdirSync(missingRoot);
    const before = census(missingRoot);
    const stateRoot = path.join(missingRoot, "render-job/proxy");
    const host = {
      filesystem: fs,
      now: () => 1_725_000_000_000,
      pid: 41_414,
      processAlive: () => false,
      randomUuid: () => {
        throw new Error("Dry garbage collection must not allocate an id.");
      },
    };
    const gc = modules.createProductionRenderGarbageRuntime({
      captureTarget: modules.captureRenderGcTarget,
      compareCodeUnits: (left: string, right: string) =>
        left < right ? -1 : left > right ? 1 : 0,
      finalTier: { kind: "final", resolutionScale: 1, frameStep: 1 },
      host,
      productionId: "missing-production",
      productionStateRoot: path.join(
        missingRoot,
        "automovie/productions/missing-production",
      ),
      proxyTier: { kind: "proxy", resolutionScale: 0.5, frameStep: 2 },
      readRendererJson: () => {
        throw new Error("Missing-state dry GC has no renderer manifest.");
      },
      removeTarget: modules.removeCapturedRenderGcTarget,
      renderJobRoot: path.join(missingRoot, "render-job"),
      renderLivenessScope: "missing-production-scope",
      renderPublicationFingerprint: () => `sha256:${"2".repeat(64)}`,
      renderTier: { kind: "proxy", resolutionScale: 0.5, frameStep: 2 },
      root: missingRoot,
      sourceFingerprint: () => `sha256:${"3".repeat(64)}`,
      stateRoot,
    });
    let dryFailure: unknown;
    try {
      gc.collect(false);
    } catch (error) {
      dryFailure = error;
    }
    TestValidator.equals(
      "dry missing-state GC preserves an exact empty census",
      {
        before,
        after: census(missingRoot),
        refused: dryFailure !== undefined,
        namedMissingState: /production|incarnation|registry|manifest/iu.test(
          message(dryFailure),
        ),
      },
      { before: [], after: [], refused: true, namedMissingState: true },
    );

    const toneByBundle = new Map<string, string>([
      ["deliverables/a", "none"],
      ["deliverables/b", "none"],
    ]);
    const project = {
      renderRoot: () => root,
      verifiedRenderManifest: (file: string) => {
        const relative = path
          .relative(root, path.dirname(file))
          .split(path.sep)
          .join("/");
        const toneMapping = toneByBundle.get(relative);
        return toneMapping === undefined
          ? null
          : { renderSpec: { toneMapping } };
      },
    };
    const frames = [
      { receipt: { bundle: "deliverables/b" } },
      { receipt: { bundle: "deliverables/a" } },
    ];
    const accepted = modules.checkProductionDeliveryTone({
      compareCodeUnits: (left, right) =>
        left < right ? -1 : left > right ? 1 : 0,
      frames,
      project,
    });
    toneByBundle.set("deliverables/b", "aces");
    let toneFailure: unknown;
    try {
      modules.checkProductionDeliveryTone({
        compareCodeUnits: (left, right) =>
          left < right ? -1 : left > right ? 1 : 0,
        frames,
        project,
      });
    } catch (error) {
      toneFailure = error;
    }
    TestValidator.equals(
      "every verified bundle is checked after the representative match",
      {
        accepted,
        mismatchRefused: message(toneFailure).includes("deliverables/b"),
        mismatchNamedCurve: message(toneFailure).includes("aces"),
      },
      {
        accepted: {
          bundle: "deliverables/a",
          recorded: "none",
          reason: null,
          requested: "none",
          status: "checked",
        },
        mismatchRefused: true,
        mismatchNamedCurve: true,
      },
    );
  } catch (error) {
    failure = { error };
    throw error;
  } finally {
    preserveCliHarnessCleanup(failure, [
      {
        resource: "render read-only fixture",
        cleanup: () => fs.rmSync(root, { force: true, recursive: true }),
      },
    ]);
  }
};
