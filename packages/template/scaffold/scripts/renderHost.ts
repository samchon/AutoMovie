import * as HME from "h264-mp4-encoder";
import { createFile } from "mp4box";
import { randomUUID } from "node:crypto";
import fs from "node:fs";

import {
  type IProductionFrameCaptureRuntime,
  createProductionFrameCaptureRuntime,
} from "./capture";

export interface IProductionRenderHost {
  arch: string;
  capture: IProductionFrameCaptureRuntime["capture"];
  captureMetrics: IProductionFrameCaptureRuntime["metrics"];
  closeCapture: IProductionFrameCaptureRuntime["close"];
  installDialogue: IProductionFrameCaptureRuntime["installDialogue"];
  h264Module: typeof HME & {
    default?: Pick<typeof HME, "createH264MP4Encoder">;
  };
  createMp4File: typeof createFile;
  filesystem: typeof fs;
  now: () => number;
  pid: number;
  platform: NodeJS.Platform;
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
  h264Module: IProductionRenderHost["h264Module"];
  createMp4File: typeof createFile;
  filesystem: typeof fs;
  kill: (pid: number, signal: 0) => true;
  now: () => number;
  pid: number;
  platform: NodeJS.Platform;
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
  capture: system.capture,
  captureMetrics: system.captureMetrics,
  closeCapture: system.closeCapture,
  installDialogue: system.installDialogue,
  h264Module: system.h264Module,
  createMp4File: system.createMp4File,
  filesystem: system.filesystem,
  now: system.now,
  pid: system.pid,
  platform: system.platform,
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

const createNodeProductionRenderHostWithCapture = (
  captureRuntime: IProductionFrameCaptureRuntime,
): IProductionRenderHost =>
  createProductionRenderHost({
    arch: process.arch,
    capture: captureRuntime.capture,
    captureMetrics: captureRuntime.metrics,
    closeCapture: captureRuntime.close,
    installDialogue: captureRuntime.installDialogue,
    h264Module: HME,
    createMp4File: createFile,
    filesystem: fs,
    kill: (pid, signal) => process.kill(pid, signal),
    now: Date.now,
    pid: process.pid,
    platform: process.platform,
    randomUuid: randomUUID,
    root: process.cwd(),
    setExitCode: (value) => {
      process.exitCode = value;
    },
    stderr: (value) => process.stderr.write(value),
    stdout: (value) => process.stdout.write(value),
  });
