import type * as HME from "h264-mp4-encoder";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import type { PNG } from "pngjs";

import {
  type IProductionFrameCaptureRuntime,
  createProductionFrameCaptureRuntime,
} from "./capture";
import {
  type IRuntimePackageGenerationHandle,
  loadResidentRuntimePackage,
} from "./runtimePackageGeneration";
import type { IRuntimePackageSnapshot } from "./runtimePackageSnapshot";

type H264Module = typeof HME & {
  default?: Pick<typeof HME, "createH264MP4Encoder">;
};
type Mp4Module = typeof import("mp4box");
type PngModule = typeof import("pngjs") & { PNG: typeof PNG };

export interface IProductionRenderHost {
  arch: string;
  assertRuntimePackagesCurrent: () => void;
  capture: IProductionFrameCaptureRuntime["capture"];
  captureMetrics: IProductionFrameCaptureRuntime["metrics"];
  closeCapture: IProductionFrameCaptureRuntime["close"];
  installDialogue: IProductionFrameCaptureRuntime["installDialogue"];
  h264Generation: IRuntimePackageGenerationHandle<
    IRuntimePackageSnapshot,
    H264Module
  >;
  mp4Generation: IRuntimePackageGenerationHandle<
    IRuntimePackageSnapshot,
    Mp4Module
  >;
  filesystem: typeof fs;
  now: () => number;
  pid: number;
  platform: NodeJS.Platform;
  pngGeneration: IRuntimePackageGenerationHandle<
    IRuntimePackageSnapshot,
    PngModule
  >;
  processAlive: (pid: number) => boolean;
  randomUuid: () => string;
  root: string;
  setExitCode: (value: number) => void;
  stderr: (value: string) => void;
  stdout: (value: string) => void;
}

export interface IProductionRenderHostSystem {
  arch: string;
  capture: IProductionFrameCaptureRuntime["capture"];
  captureMetrics: IProductionFrameCaptureRuntime["metrics"];
  closeCapture: IProductionFrameCaptureRuntime["close"];
  installDialogue: IProductionFrameCaptureRuntime["installDialogue"];
  h264Generation: IProductionRenderHost["h264Generation"];
  mp4Generation: IProductionRenderHost["mp4Generation"];
  filesystem: typeof fs;
  kill: (pid: number, signal: 0) => true;
  now: () => number;
  pid: number;
  platform: NodeJS.Platform;
  pngGeneration: IProductionRenderHost["pngGeneration"];
  randomUuid: () => string;
  root: string;
  setExitCode: (value: number) => void;
  stderr: (value: string) => void;
  stdout: (value: string) => void;
}

/** Resolve process liveness without treating an access refusal as death. */
export const productionRenderProcessAlive = (
  pid: number,
  kill: IProductionRenderHostSystem["kill"],
): boolean => {
  try {
    kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "EPERM";
  }
};

/** Bind an explicit host system to one production-render invocation. */
export const createProductionRenderHost = (
  system: IProductionRenderHostSystem,
): IProductionRenderHost => ({
  arch: system.arch,
  assertRuntimePackagesCurrent: () => {
    system.h264Generation.assertCurrent();
    system.mp4Generation.assertCurrent();
    system.pngGeneration.assertCurrent();
  },
  capture: system.capture,
  captureMetrics: system.captureMetrics,
  closeCapture: system.closeCapture,
  installDialogue: system.installDialogue,
  h264Generation: system.h264Generation,
  mp4Generation: system.mp4Generation,
  filesystem: system.filesystem,
  now: system.now,
  pid: system.pid,
  platform: system.platform,
  pngGeneration: system.pngGeneration,
  processAlive: (pid) => productionRenderProcessAlive(pid, system.kill),
  randomUuid: system.randomUuid,
  root: system.root,
  setExitCode: system.setExitCode,
  stderr: system.stderr,
  stdout: system.stdout,
});

/** Bind the real Node, capture, encoder, and filesystem for one invocation. */
export const createNodeProductionRenderHost = (): IProductionRenderHost =>
  createNodeProductionRenderHostWithCapture(
    createProductionFrameCaptureRuntime(),
  );

/** Bind the real Node host to one caller-owned capture runtime. */
export const createNodeProductionRenderHostWithCapture = (
  captureRuntime: IProductionFrameCaptureRuntime,
): IProductionRenderHost => {
  const h264 = loadResidentRuntimePackage<H264Module>({
    packageName: "h264-mp4-encoder",
  });
  const mp4 = loadResidentRuntimePackage<typeof import("mp4box")>({
    packageName: "mp4box",
  });
  const png = loadResidentRuntimePackage<PngModule>({
    packageName: "pngjs",
  });
  return createProductionRenderHost({
    arch: process.arch,
    capture: captureRuntime.capture,
    captureMetrics: captureRuntime.metrics,
    closeCapture: captureRuntime.close,
    installDialogue: captureRuntime.installDialogue,
    h264Generation: h264,
    mp4Generation: mp4,
    filesystem: fs,
    kill: (pid, signal) => process.kill(pid, signal),
    now: Date.now,
    pid: process.pid,
    platform: process.platform,
    pngGeneration: png,
    randomUuid: randomUUID,
    root: process.cwd(),
    setExitCode: (value) => {
      process.exitCode = value;
    },
    stderr: (value) => process.stderr.write(value),
    stdout: (value) => process.stdout.write(value),
  });
};
