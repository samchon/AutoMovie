import fs from "node:fs";
import path from "node:path";

import {
  type IRenderGcPhysicalDirectory,
  assertRenderPhysicalDirectoryIdentity,
  captureRenderPhysicalDirectory,
  ensureRenderPhysicalDirectory,
} from "./renderGcSnapshot";

export interface IRenderChunkTemporaryTree {
  path: string;
  state: IRenderGcPhysicalDirectory;
  temporaryRoot: IRenderGcPhysicalDirectory;
  tree: IRenderGcPhysicalDirectory;
}

/**
 * Create one UUID render tree while retaining its original ancestor
 * generations.
 */
export const createRenderChunkTemporaryTree = (props: {
  name: string;
  stateRoot: string;
}): IRenderChunkTemporaryTree => {
  if (
    props.name.length === 0 ||
    props.name === "." ||
    props.name === ".." ||
    props.name.includes("/") ||
    props.name.includes("\\") ||
    props.name.includes("\0")
  )
    throw new Error("Render chunk temporary tree name is invalid.");
  const state = captureRenderPhysicalDirectory(
    props.stateRoot,
    "render state root",
  );
  const temporaryRootPath = ensureRenderPhysicalDirectory(
    props.stateRoot,
    "tmp",
  );
  assertRenderPhysicalDirectoryIdentity(state, "render state root");
  const temporaryRoot = captureRenderPhysicalDirectory(
    temporaryRootPath,
    "render temporary root",
  );
  const treePath = path.join(temporaryRoot.path, props.name);
  assertRenderChunkTemporaryAncestry({ state, temporaryRoot });
  fs.mkdirSync(treePath);
  assertRenderChunkTemporaryAncestry({ state, temporaryRoot });
  const tree = captureRenderPhysicalDirectory(
    treePath,
    "render chunk temporary tree",
  );
  const ownership = { path: treePath, state, temporaryRoot, tree };
  assertRenderChunkTemporaryTree(ownership);
  return ownership;
};

/** Revalidate one temporary tree and every ancestor generation that owns it. */
export const assertRenderChunkTemporaryTree = (
  ownership: IRenderChunkTemporaryTree,
): void => {
  assertRenderChunkTemporaryAncestry(ownership);
  assertRenderPhysicalDirectoryIdentity(
    ownership.tree,
    "render chunk temporary tree",
  );
};

const assertRenderChunkTemporaryAncestry = (
  ownership: Pick<IRenderChunkTemporaryTree, "state" | "temporaryRoot">,
): void => {
  assertRenderPhysicalDirectoryIdentity(ownership.state, "render state root");
  assertRenderPhysicalDirectoryIdentity(
    ownership.temporaryRoot,
    "render temporary root",
  );
};
