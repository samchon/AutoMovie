import {
  type IAutoMovieProductionRenderChunk,
  type IAutoMovieProductionRenderTier,
  encodeAutoMoviePathSegment,
} from "@automovie/production";
import { renderScaffold, writeFiles } from "@automovie/template";
import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { PNG } from "pngjs";

import { preserveCliHarnessCleanup } from "./CliHarnessCleanup";
import { linkGeneratedWorkspacePackage } from "./GeneratedWorkspaceLink";

interface IRenderChunkLockOwner {
  chunk: string;
  pid: number;
  token?: string;
}

interface IRenderGcTargetSnapshot {
  bytes: number;
  contentFingerprint: string;
  namespaceFingerprint: string;
  target: string;
  targetIdentity: string;
}

type RemoveTarget = (props: {
  isolated: string;
  quarantine: string;
  snapshot: IRenderGcTargetSnapshot;
}) => void;

type CaptureTarget = (
  stateRoot: string,
  target: string,
) => IRenderGcTargetSnapshot;

interface ILeaseRuntime {
  acquire(chunk: IAutoMovieProductionRenderChunk): Promise<boolean>;
  release(chunk: IAutoMovieProductionRenderChunk): Promise<void>;
}

interface IRuntimeModules {
  captureRenderGcTarget(
    stateRoot: string,
    target: string,
  ): IRenderGcTargetSnapshot;
  createProductionRenderChunkLeaseRuntime(
    props: Record<string, unknown>,
  ): ILeaseRuntime;
  createProductionRenderGarbageRuntime(props: Record<string, unknown>): {
    removeOwnedChunkClaim(
      snapshot: IRenderGcTargetSnapshot,
    ): "lost" | "removed";
  };
  createRenderGcFileSnapshot(
    stateRoot: string,
    target: string,
    bytes: Uint8Array,
  ): IRenderGcTargetSnapshot;
  readCapturedRenderGcFile(
    snapshot: IRenderGcTargetSnapshot,
    maximumBytes: number,
  ): Uint8Array;
  removeCapturedRenderGcTarget: RemoveTarget;
  compositeProductionCaptureLayers(
    layers: Array<{ image: PNG; weight: number }>,
    width: number,
    height: number,
  ): Uint8Array;
  hasProductionVisiblePixelVariance(image: PNG): boolean;
}

const runtimeModules = (scripts: string): IRuntimeModules =>
  ({
    ...(require(path.join(scripts, "renderChunkRuntime.ts")) as object),
    ...(require(path.join(scripts, "renderGcRuntime.ts")) as object),
    ...(require(path.join(scripts, "renderGcSnapshot.ts")) as object),
  }) as IRuntimeModules;

const linkWorkspacePackage = (project: string, name: string): void =>
  linkGeneratedWorkspacePackage({
    name,
    project,
    subject: "Claim-cleanup package root",
  });

const PROXY_TIER: IAutoMovieProductionRenderTier = {
  kind: "proxy",
  resolutionScale: 0.5,
  frameStep: 2,
};

const FINAL_TIER: IAutoMovieProductionRenderTier = {
  kind: "final",
  resolutionScale: 1,
  frameStep: 1,
};

const CHUNK = {
  id: `sha256:${"1".repeat(64)}`,
  slot: "feature:beauty:00000000-00000001",
} as IAutoMovieProductionRenderChunk;

const captured = (
  modules: IRuntimeModules,
  stateRoot: string,
  target: string,
): IRenderGcTargetSnapshot | null => {
  try {
    return modules.captureRenderGcTarget(stateRoot, target);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
};

const readJson = <Value>(
  modules: IRuntimeModules,
  snapshot: IRenderGcTargetSnapshot,
  maximumBytes: number,
): Value =>
  JSON.parse(
    Buffer.from(
      modules.readCapturedRenderGcFile(snapshot, maximumBytes),
    ).toString("utf8"),
  ) as Value;

const harness = (props: {
  modules: IRuntimeModules;
  root: string;
  stateRoot: string;
  tokens: string[];
  captureTarget?: CaptureTarget;
  removeTarget?: RemoveTarget;
}) => {
  const host = {
    filesystem: fs,
    now: () => 1_725_000_000_000,
    pid: 42_424,
    processAlive: (pid: number) => pid === 42_424,
    randomUuid: () => {
      const token = props.tokens.shift();
      if (token === undefined)
        throw new Error(
          "The claim-cleanup fixture exhausted deterministic ids.",
        );
      return token;
    },
  };
  const gc = props.modules.createProductionRenderGarbageRuntime({
    captureTarget: props.captureTarget ?? props.modules.captureRenderGcTarget,
    compareCodeUnits: (left: string, right: string) =>
      left < right ? -1 : left > right ? 1 : 0,
    finalTier: FINAL_TIER,
    host,
    productionId: "claim-cleanup-film",
    productionStateRoot: path.join(
      props.root,
      "automovie/productions/claim-cleanup-film",
    ),
    proxyTier: PROXY_TIER,
    readRendererJson: () => {
      throw new Error("The claim cleanup experiment does not read a manifest.");
    },
    removeTarget:
      props.removeTarget ?? props.modules.removeCapturedRenderGcTarget,
    renderJobRoot: path.dirname(props.stateRoot),
    renderLivenessScope: "claim-cleanup-scope",
    renderPublicationFingerprint: () => `sha256:${"2".repeat(64)}`,
    renderTier: PROXY_TIER,
    root: props.root,
    sourceFingerprint: () => `sha256:${"3".repeat(64)}`,
    stateRoot: props.stateRoot,
  });
  return {
    gc,
    lease: props.modules.createProductionRenderChunkLeaseRuntime({
      captureExisting: (target: string) =>
        captured(props.modules, props.stateRoot, target),
      host,
      quarantine: () => {
        throw new Error("No abandoned claim belongs in this experiment.");
      },
      readJson: <Value>(
        snapshot: IRenderGcTargetSnapshot,
        maximumBytes: number,
      ) => readJson<Value>(props.modules, snapshot, maximumBytes),
      remove: gc.removeOwnedChunkClaim,
      stateRoot: props.stateRoot,
    }),
  };
};

const claimPath = (stateRoot: string, token: string): string =>
  path.join(
    stateRoot,
    "locks",
    encodeAutoMoviePathSegment(CHUNK.slot),
    `claim.42424.${token}.lock`,
  );

const message = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

/**
 * Chunk claim cleanup preserves ownership and both sides of a failed operation.
 *
 * Scenarios:
 *
 * 1. Releasing an exact chunk/pid/token claim removes its real file once.
 * 2. Replacing that file with foreign bytes before release preserves the
 *    successor identity and bytes instead of deleting another worker's claim.
 * 3. Removing the claim before release is an honest lost-owner no-op.
 * 4. A product-shaped removal that stages the exact owner and then fails keeps
 *    the staged bytes and rejects release with the cleanup error.
 * 5. When acquisition first encounters an invalid foreign owner and exact-own
 *    cleanup also fails, AggregateError preserves primary then cleanup order.
 * 6. If removal and successor inspection both fail before staging, their
 *    AggregateError preserves removal then inspection order and primary cause.
 * 7. Invisible RGB differences under zero alpha remain blank, while capture
 *    composition preserves the original opaque weighted-RGB output bytes.
 */
export const test_cli_scaffold_render_chunk_claim_cleanup =
  async (): Promise<void> => {
    const root = fs.mkdtempSync(
      path.join(os.tmpdir(), "automovie-render-claim-cleanup-"),
    );
    const stateRoot = path.join(root, "render-job/proxy");
    let failure: { error: unknown } | undefined;
    try {
      writeFiles(root, renderScaffold({ name: "claim-cleanup-film" }));
      for (const name of [
        "@automovie/interface",
        "@automovie/production",
        "pngjs",
      ])
        linkWorkspacePackage(root, name);
      const modules = runtimeModules(path.join(root, "scripts"));
      const invisible = new PNG({ width: 2, height: 1 });
      invisible.data.set([255, 0, 0, 0, 0, 255, 0, 0]);
      const visible = new PNG({ width: 2, height: 1 });
      visible.data.set([255, 0, 0, 0, 0, 255, 0, 1]);
      const red = new PNG({ width: 1, height: 1 });
      red.data.set([200, 0, 0, 64]);
      const blue = new PNG({ width: 1, height: 1 });
      blue.data.set([0, 0, 100, 128]);
      const composite = PNG.sync.read(
        Buffer.from(
          modules.compositeProductionCaptureLayers(
            [
              { image: red, weight: 0.5 },
              { image: blue, weight: 0.5 },
            ],
            1,
            1,
          ),
        ),
      );
      TestValidator.equals(
        "capture visibility and composition preserve the pre-split semantics",
        {
          invisible: modules.hasProductionVisiblePixelVariance(invisible),
          visible: modules.hasProductionVisiblePixelVariance(visible),
          rgba: [...composite.data],
        },
        { invisible: false, visible: true, rgba: [100, 0, 50, 255] },
      );
      const exact = harness({
        modules,
        root,
        stateRoot,
        tokens: ["exact", "exact-rm"],
      });
      TestValidator.equals(
        "the exact owner acquires its physical claim",
        await exact.lease.acquire(CHUNK),
        true,
      );
      const exactPath = claimPath(stateRoot, "exact");
      const exactBytes = fs.readFileSync(exactPath, "utf8");
      await exact.lease.release(CHUNK);
      TestValidator.equals(
        "exact release removes only the captured owner bytes",
        {
          existed: exactBytes.includes(CHUNK.id),
          remains: fs.existsSync(exactPath),
        },
        { existed: true, remains: false },
      );

      const successor = harness({
        modules,
        root,
        stateRoot,
        tokens: ["successor", "successor-rm"],
      });
      await successor.lease.acquire(CHUNK);
      const successorPath = claimPath(stateRoot, "successor");
      const foreign: IRenderChunkLockOwner = {
        chunk: `sha256:${"4".repeat(64)}`,
        pid: 52_525,
        token: "foreign",
      };
      const foreignBytes = `${JSON.stringify(foreign)}\n`;
      fs.rmSync(successorPath);
      fs.writeFileSync(successorPath, foreignBytes, "utf8");
      const successorIdentity = modules.captureRenderGcTarget(
        stateRoot,
        successorPath,
      ).targetIdentity;
      await successor.lease.release(CHUNK);
      const preservedSuccessor = modules.captureRenderGcTarget(
        stateRoot,
        successorPath,
      );
      TestValidator.equals(
        "release preserves a foreign successor's identity and bytes",
        {
          bytes: fs.readFileSync(successorPath, "utf8"),
          identity: preservedSuccessor.targetIdentity,
        },
        { bytes: foreignBytes, identity: successorIdentity },
      );
      fs.rmSync(successorPath);

      const absent = harness({
        modules,
        root,
        stateRoot,
        tokens: ["absent", "absent-rm"],
      });
      await absent.lease.acquire(CHUNK);
      const absentPath = claimPath(stateRoot, "absent");
      fs.rmSync(absentPath);
      await absent.lease.release(CHUNK);
      TestValidator.equals(
        "an already absent owned claim remains an honest no-op",
        fs.existsSync(absentPath),
        false,
      );

      const cleanupError = new Error("exact owner staging cleanup failed");
      const stagedTargets: string[] = [];
      const failingRemoval: RemoveTarget = (input) => {
        fs.mkdirSync(input.quarantine, { recursive: true });
        fs.renameSync(input.snapshot.target, input.isolated);
        stagedTargets.push(input.isolated);
        throw cleanupError;
      };
      const failedRelease = harness({
        modules,
        root,
        stateRoot,
        tokens: ["release-failure", "release-stage"],
        removeTarget: failingRemoval,
      });
      await failedRelease.lease.acquire(CHUNK);
      let releaseFailure: unknown;
      try {
        await failedRelease.lease.release(CHUNK);
      } catch (error) {
        releaseFailure = error;
      }
      TestValidator.equals(
        "confirmed exact-owner cleanup failure rejects and preserves staged bytes",
        {
          error: releaseFailure === cleanupError,
          staged: stagedTargets.length,
          stagedBytes: fs
            .readFileSync(stagedTargets[0]!, "utf8")
            .includes(CHUNK.id),
        },
        { error: true, staged: 1, stagedBytes: true },
      );

      const aggregate = harness({
        modules,
        root,
        stateRoot,
        tokens: ["aggregate", "aggregate-stage"],
        removeTarget: failingRemoval,
      });
      const invalidPath = path.join(
        stateRoot,
        "locks",
        encodeAutoMoviePathSegment(CHUNK.slot),
        "a.lock",
      );
      modules.createRenderGcFileSnapshot(
        stateRoot,
        invalidPath,
        Buffer.from(
          `${JSON.stringify({ chunk: CHUNK.id, pid: 0, token: "invalid" })}\n`,
        ),
      );
      let aggregateFailure: unknown;
      try {
        await aggregate.lease.acquire(CHUNK);
      } catch (error) {
        aggregateFailure = error;
      }
      const errors =
        aggregateFailure instanceof AggregateError
          ? [...aggregateFailure.errors]
          : [];
      TestValidator.equals(
        "acquire preserves primary then exact-owner cleanup failure",
        {
          aggregate: aggregateFailure instanceof AggregateError,
          causeIsPrimary:
            aggregateFailure instanceof AggregateError &&
            aggregateFailure.cause === errors[0],
          primary: message(errors[0]).includes("invalid owner process"),
          cleanup: errors[1] === cleanupError,
          stagedExactlyOnce: stagedTargets.length,
        },
        {
          aggregate: true,
          causeIsPrimary: true,
          primary: true,
          cleanup: true,
          stagedExactlyOnce: 2,
        },
      );

      const removalError = new Error("claim removal failed before staging");
      const inspectionError = new Error("successor inspection failed");
      const inspectionTarget = path.join(stateRoot, "inspection.lock");
      const inspectionSnapshot = modules.createRenderGcFileSnapshot(
        stateRoot,
        inspectionTarget,
        Buffer.from("inspection owner bytes", "utf8"),
      );
      const inspection = harness({
        modules,
        root,
        stateRoot,
        tokens: ["inspection-stage"],
        captureTarget: () => {
          throw inspectionError;
        },
        removeTarget: () => {
          throw removalError;
        },
      });
      let inspectionFailure: unknown;
      try {
        inspection.gc.removeOwnedChunkClaim(inspectionSnapshot);
      } catch (error) {
        inspectionFailure = error;
      }
      const inspectionErrors =
        inspectionFailure instanceof AggregateError
          ? [...inspectionFailure.errors]
          : [];
      TestValidator.equals(
        "removal and successor inspection failures preserve primary order",
        {
          aggregate: inspectionFailure instanceof AggregateError,
          cause:
            inspectionFailure instanceof AggregateError
              ? inspectionFailure.cause
              : null,
          errors: inspectionErrors,
          originalBytes: fs.readFileSync(inspectionTarget, "utf8"),
        },
        {
          aggregate: true,
          cause: removalError,
          errors: [removalError, inspectionError],
          originalBytes: "inspection owner bytes",
        },
      );
    } catch (error) {
      failure = { error };
      throw error;
    } finally {
      preserveCliHarnessCleanup(failure, [
        {
          resource: "render claim cleanup fixture",
          cleanup: () => fs.rmSync(root, { force: true, recursive: true }),
        },
      ]);
    }
  };
