import type * as HME from "h264-mp4-encoder";
import type { createFile } from "mp4box";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import type { PNG } from "pngjs";

import {
  type IProductionFrameCaptureRuntime,
  createProductionFrameCaptureRuntime,
} from "./capture";
import { loadResidentRuntimePackage } from "./runtimePackageGeneration";
import type { IRuntimePackageSnapshot } from "./runtimePackageSnapshot";

export interface IProductionRenderHost {
  arch: string;
  assertRuntimePackagesCurrent: () => void;
  capture: IProductionFrameCaptureRuntime["capture"];
  captureMetrics: IProductionFrameCaptureRuntime["metrics"];
  closeCapture: IProductionFrameCaptureRuntime["close"];
  installDialogue: IProductionFrameCaptureRuntime["installDialogue"];
  h264Module: typeof HME & {
    default?: Pick<typeof HME, "createH264MP4Encoder">;
  };
  h264Snapshot: IRuntimePackageSnapshot;
  createMp4File: typeof createFile;
  filesystem: typeof fs;
  now: () => number;
  pid: number;
  platform: NodeJS.Platform;
  pngModule: typeof import("pngjs") & { PNG: typeof PNG };
  processAlive: (pid: number) => boolean;
  randomUuid: () => string;
  root: string;
  setExitCode: (value: number) => void;
  stderr: (value: string) => void;
  stdout: (value: string) => void;
}

export interface IProductionRenderHostSystem {
  arch: string;
  assertRuntimePackagesCurrent: () => void;
  capture: IProductionFrameCaptureRuntime["capture"];
  captureMetrics: IProductionFrameCaptureRuntime["metrics"];
  closeCapture: IProductionFrameCaptureRuntime["close"];
  installDialogue: IProductionFrameCaptureRuntime["installDialogue"];
  h264Module: IProductionRenderHost["h264Module"];
  h264Snapshot: IRuntimePackageSnapshot;
  createMp4File: typeof createFile;
  filesystem: typeof fs;
  kill: (pid: number, signal: 0) => true;
  now: () => number;
  pid: number;
  platform: NodeJS.Platform;
  pngModule: IProductionRenderHost["pngModule"];
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
  assertRuntimePackagesCurrent: system.assertRuntimePackagesCurrent,
  capture: system.capture,
  captureMetrics: system.captureMetrics,
  closeCapture: system.closeCapture,
  installDialogue: system.installDialogue,
  h264Module: system.h264Module,
  h264Snapshot: system.h264Snapshot,
  createMp4File: system.createMp4File,
  filesystem: system.filesystem,
  now: system.now,
  pid: system.pid,
  platform: system.platform,
  pngModule: system.pngModule,
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
  const h264 = loadResidentRuntimePackage<IProductionRenderHost["h264Module"]>({
    packageName: "h264-mp4-encoder",
  });
  const mp4 = loadResidentRuntimePackage<typeof import("mp4box")>({
    packageName: "mp4box",
  });
  const png = loadResidentRuntimePackage<IProductionRenderHost["pngModule"]>({
    packageName: "pngjs",
  });
  return createProductionRenderHost({
    arch: process.arch,
    assertRuntimePackagesCurrent: () => {
      h264.assertCurrent();
      mp4.assertCurrent();
      png.assertCurrent();
    },
    capture: captureRuntime.capture,
    captureMetrics: captureRuntime.metrics,
    closeCapture: captureRuntime.close,
    installDialogue: captureRuntime.installDialogue,
    h264Module: h264.module,
    h264Snapshot: h264.snapshot,
    createMp4File: mp4.module.createFile,
    filesystem: fs,
    kill: (pid, signal) => process.kill(pid, signal),
    now: Date.now,
    pid: process.pid,
    platform: process.platform,
    pngModule: png.module,
    randomUuid: randomUUID,
    root: process.cwd(),
    setExitCode: (value) => {
      process.exitCode = value;
    },
    stderr: (value) => process.stderr.write(value),
    stdout: (value) => process.stdout.write(value),
  });
};
