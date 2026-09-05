import type { IAutoMovieProductionRenderGcCandidate } from "@automovie/production";
import path from "node:path";

import {
  type IRenderGcTargetSnapshot,
  isRenderGcPreservedPath,
} from "./renderGcSnapshot";

export interface IProductionSoundCacheCandidate {
  candidate: IAutoMovieProductionRenderGcCandidate;
  snapshot: IRenderGcTargetSnapshot;
}

/** Capture and revalidation seams behind one sound cache inventory. */
export interface IProductionSoundCacheSeams {
  assertCaptured: (snapshot: IRenderGcTargetSnapshot) => void;
  captureTarget: (base: string, target: string) => IRenderGcTargetSnapshot;
}

/**
 * Capture every direct dialogue and model generation from exact physical trees.
 *
 * Each cache root is its own GC ownership root, so a removal applied to one of
 * its generations stages through a preserved directory beside the generations.
 * That directory is GC's, not a cache generation: reading it as one would plan
 * its removal into itself on the next apply.
 */
export const inventoryProductionSoundCaches = (props: {
  productionStateRoot: string;
  seams: IProductionSoundCacheSeams;
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
  kind: "dialogue-cache" | "model-cache";
  logicalRoot: "audio-cache/kokoro" | "model-cache/kokoro";
  productionStateRoot: string;
  seams: IProductionSoundCacheSeams;
}): IProductionSoundCacheCandidate[] => {
  const rootPath = path.join(
    props.productionStateRoot,
    ...props.logicalRoot.split("/"),
  );
  let root: IRenderGcTargetSnapshot;
  try {
    root = props.seams.captureTarget(props.productionStateRoot, rootPath);
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
      (entry) =>
        entry.path.length !== 0 &&
        entry.path.includes("/") === false &&
        isRenderGcPreservedPath(entry.path) === false,
    )
    .map((entry) => {
      const snapshot = props.seams.captureTarget(
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
  props.seams.assertCaptured(root);
  return output;
};
