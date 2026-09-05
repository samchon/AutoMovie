import type { IAutoMovieProductionRenderGcCandidate } from "@automovie/production";
import path from "node:path";

import {
  type IRenderGcTargetSnapshot,
  assertCapturedRenderTarget,
  captureRenderGcTarget,
} from "./renderGcSnapshot";

export interface IProductionSoundCacheCandidate {
  candidate: IAutoMovieProductionRenderGcCandidate;
  snapshot: IRenderGcTargetSnapshot;
}

/** Capture every direct dialogue and model generation from exact physical trees. */
export const inventoryProductionSoundCaches = (props: {
  captureTarget: typeof captureRenderGcTarget;
  productionStateRoot: string;
}): IProductionSoundCacheCandidate[] => [
  ...inventoryCacheRoot({
    ...props,
    kind: "dialogue-cache",
    logicalRoot: "audio-cache/kokoro",
  }),
  ...inventoryCacheRoot({
    ...props,
    kind: "model-cache",
    logicalRoot: "model-cache/kokoro",
  }),
];

const inventoryCacheRoot = (props: {
  captureTarget: typeof captureRenderGcTarget;
  kind: "dialogue-cache" | "model-cache";
  logicalRoot: "audio-cache/kokoro" | "model-cache/kokoro";
  productionStateRoot: string;
}): IProductionSoundCacheCandidate[] => {
  const rootPath = path.join(
    props.productionStateRoot,
    ...props.logicalRoot.split("/"),
  );
  let root: IRenderGcTargetSnapshot;
  try {
    root = props.captureTarget(props.productionStateRoot, rootPath);
  } catch (error) {
    if (
      (error as NodeJS.ErrnoException).code === "ENOENT" ||
      (error as NodeJS.ErrnoException).code === "ENOTDIR"
    )
      return [];
    throw error;
  }
  if (root.kind !== "directory")
    throw new Error(
      `Sound cache root "${props.logicalRoot}" is not a directory.`,
    );
  const output = root.entries
    .filter(
      (entry) => entry.path.length !== 0 && entry.path.includes("/") === false,
    )
    .map((entry) => {
      const snapshot = props.captureTarget(
        root.target,
        path.join(root.target, entry.path),
      );
      return {
        candidate: {
          path: `${props.logicalRoot}/${entry.path}`,
          kind: props.kind,
          digest: snapshot.contentFingerprint,
          bytes: snapshot.bytes,
          generation: snapshot.targetIdentity,
          fingerprint: snapshot.contentFingerprint,
          observation: null,
        },
        snapshot,
      } satisfies IProductionSoundCacheCandidate;
    });
  assertCapturedRenderTarget(root);
  return output;
};
