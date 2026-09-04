import {
  type AutoMovieLocalProcessOwnerObservation,
  type IAutoMovieLocalProcessOwner,
  currentAutoMovieLocalProcessOwner,
  isAutoMovieLocalProcessOwner,
  observeAutoMovieLocalProcessOwner,
} from "@automovie/production";
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
  owner: IAutoMovieLocalProcessOwner;
  pid: number;
  platform: NodeJS.Platform;
  observeProcessOwner: (
    owner: unknown,
  ) => AutoMovieLocalProcessOwnerObservation;
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
  owner: IAutoMovieLocalProcessOwner;
  platform: NodeJS.Platform;
  randomUuid: () => string;
  root: string;
  setExitCode: (value: number) => void;
  stderr: (value: string) => void;
  stdout: (value: string) => void;
}

/** Resolve one render owner without treating PID occupancy as generation proof. */
export const productionRenderProcessOwnerObservation = (
  owner: unknown,
  current: IAutoMovieLocalProcessOwner,
  kill: IProductionRenderHostSystem["kill"],
): AutoMovieLocalProcessOwnerObservation =>
  observeAutoMovieLocalProcessOwner({ owner, current, query: kill });

/** Bind an explicit host system to one production-render invocation. */
export const createProductionRenderHost = (
  system: IProductionRenderHostSystem,
): IProductionRenderHost => {
  if (isAutoMovieLocalProcessOwner(system.owner) === false)
    throw new Error("Production render host process owner is invalid.");
  return {
    arch: system.arch,
    capture: system.capture,
    captureMetrics: system.captureMetrics,
    closeCapture: system.closeCapture,
    installDialogue: system.installDialogue,
    h264Module: system.h264Module,
    createMp4File: system.createMp4File,
    filesystem: system.filesystem,
    now: system.now,
    owner: system.owner,
    pid: system.owner.pid,
    platform: system.platform,
    observeProcessOwner: (owner) =>
      productionRenderProcessOwnerObservation(owner, system.owner, system.kill),
    randomUuid: system.randomUuid,
    root: system.root,
    setExitCode: system.setExitCode,
    stderr: system.stderr,
    stdout: system.stdout,
  };
};

/** Bind the real Node, capture, encoder, and filesystem for one invocation. */
export const createNodeProductionRenderHost = (): IProductionRenderHost =>
  createNodeProductionRenderHostWithCapture(
    createProductionFrameCaptureRuntime(),
  );

/** Bind the real Node host to one caller-owned capture runtime. */
export const createNodeProductionRenderHostWithCapture = (
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
    owner: currentAutoMovieLocalProcessOwner(),
    platform: process.platform,
    randomUuid: randomUUID,
    root: process.cwd(),
    setExitCode: (value) => {
      process.exitCode = value;
    },
    stderr: (value) => process.stderr.write(value),
    stdout: (value) => process.stdout.write(value),
  });
