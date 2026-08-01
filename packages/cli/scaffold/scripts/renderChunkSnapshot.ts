import { digestAutoMovieBytes } from "@automovie/mcp";
import fs from "node:fs";
import path from "node:path";

import {
  type IRenderGcTargetSnapshot,
  assertCapturedRenderGcFileEntry,
  assertCapturedRenderTarget,
  captureRenderGcTarget,
  createRenderGcFileSnapshot,
  ensureRenderPhysicalDirectory,
  readCapturedRenderGcFile,
} from "./renderGcSnapshot";

const PUBLICATION_RECEIPT = "receipt.json";
const CONTENT_DIGEST_PATTERN = /^sha256:[0-9a-f]{64}$/u;

interface IRenderChunkPublicationMarker {
  publication: {
    contentFingerprint: `sha256:${string}`;
    version: 1;
  };
}

export interface IRenderChunkPublicationSnapshot {
  contentFingerprint: `sha256:${string}`;
  receiptBytes: Uint8Array;
  snapshot: IRenderGcTargetSnapshot;
}

export interface IPublishedRenderChunkSnapshot {
  destination: IRenderChunkPublicationSnapshot;
  source: IRenderGcTargetSnapshot;
}

/** Fingerprint physical-tree content without binding it to inode identities. */
export const renderChunkContentFingerprint = (
  snapshot: IRenderGcTargetSnapshot,
): `sha256:${string}` => {
  if (snapshot.kind !== "directory")
    throw new Error(`Render chunk "${snapshot.target}" is not a directory.`);
  return digestAutoMovieBytes(
    Buffer.from(
      JSON.stringify(
        snapshot.entries
          .filter((entry) => entry.path !== PUBLICATION_RECEIPT)
          .map((entry) =>
            entry.kind === "directory"
              ? { kind: entry.kind, path: entry.path }
              : {
                  bytes: entry.bytes,
                  digest: entry.digest,
                  kind: entry.kind,
                  path: entry.path,
                },
          ),
      ),
    ),
  );
};

/** Capture one completed chunk tree and authenticate it through its receipt. */
export const captureRenderChunkPublication = (
  base: string,
  directory: string,
): IRenderChunkPublicationSnapshot => {
  const snapshot = captureRenderGcTarget(base, directory);
  if (snapshot.kind !== "directory")
    throw new Error(`Render chunk "${directory}" is not a directory.`);
  const receipt = captureRenderGcTarget(
    snapshot.base.path,
    path.join(snapshot.target, PUBLICATION_RECEIPT),
  );
  assertCapturedRenderGcFileEntry({
    directory: snapshot,
    file: receipt,
    relative: PUBLICATION_RECEIPT,
  });
  const receiptBytes = readCapturedRenderGcFile(receipt, receipt.bytes);
  const marker = parsePublicationMarker(receiptBytes);
  const contentFingerprint = renderChunkContentFingerprint(snapshot);
  if (marker.publication.contentFingerprint !== contentFingerprint)
    throw new Error(
      `Render chunk "${directory}" does not match its publication receipt.`,
    );
  assertCapturedRenderTarget(snapshot);
  return { contentFingerprint, receiptBytes, snapshot };
};

/** Read one exact file that belongs to a previously captured chunk tree. */
export const readRenderChunkPublicationFile = (
  publication: IRenderChunkPublicationSnapshot,
  relative: string,
): Uint8Array => {
  const entry = publication.snapshot.entries.find(
    (candidate) => candidate.path === relative,
  );
  if (entry?.kind !== "file" || entry.bytes === undefined)
    throw new Error(
      `Render chunk file "${relative}" is absent from its publication.`,
    );
  const file = captureRenderGcTarget(
    publication.snapshot.base.path,
    renderChunkTarget(publication.snapshot.target, relative),
  );
  assertCapturedRenderGcFileEntry({
    directory: publication.snapshot,
    file,
    relative,
  });
  return readCapturedRenderGcFile(file, entry.bytes);
};

/** Revalidate the exact completed tree after every consumer read succeeds. */
export const assertRenderChunkPublication = (
  publication: IRenderChunkPublicationSnapshot,
): void => assertCapturedRenderTarget(publication.snapshot);

/** Copy one exact completed temp tree into an exclusively reserved destination. */
export const publishRenderChunkSnapshot = (props: {
  base: string;
  destination: string;
  source: string;
}): IPublishedRenderChunkSnapshot => {
  const source = captureRenderChunkPublication(props.base, props.source);
  const base = source.snapshot.base.path;
  const destination = path.resolve(props.destination);
  const destinationRelative = ownedRelative(base, destination);
  if (destinationRelative.length === 0)
    throw new Error(
      "Render chunk destination cannot replace its ownership root.",
    );
  if (
    destination === source.snapshot.target ||
    destination.startsWith(`${source.snapshot.target}${path.sep}`) ||
    source.snapshot.target.startsWith(`${destination}${path.sep}`)
  )
    throw new Error("Render chunk source and destination cannot overlap.");
  const parentRelative = ownedRelative(base, path.dirname(destination));
  if (parentRelative.length !== 0)
    ensureRenderPhysicalDirectory(base, parentRelative.replaceAll("\\", "/"));
  fs.mkdirSync(destination);
  const reserved = captureRenderGcTarget(base, destination);
  assertReservedDestination(source.snapshot, reserved);
  if (
    reserved.entries.length !== 1 ||
    reserved.entries[0]?.kind !== "directory" ||
    reserved.entries[0]?.path !== ""
  )
    throw new Error(
      `Render chunk destination "${destination}" changed while reserved.`,
    );

  for (const entry of source.snapshot.entries) {
    if (entry.kind !== "directory" || entry.path.length === 0) continue;
    assertReservedDestination(
      source.snapshot,
      captureRenderGcTarget(base, destination),
      reserved.targetIdentity,
    );
    fs.mkdirSync(renderChunkTarget(destination, entry.path));
    assertReservedDestination(
      source.snapshot,
      captureRenderGcTarget(base, destination),
      reserved.targetIdentity,
    );
  }
  for (const entry of source.snapshot.entries) {
    if (entry.kind !== "file" || entry.path === PUBLICATION_RECEIPT) continue;
    const bytes = readRenderChunkPublicationFile(source, entry.path);
    assertReservedDestination(
      source.snapshot,
      captureRenderGcTarget(base, destination),
      reserved.targetIdentity,
    );
    createRenderGcFileSnapshot(
      base,
      renderChunkTarget(destination, entry.path),
      bytes,
    );
    assertReservedDestination(
      source.snapshot,
      captureRenderGcTarget(base, destination),
      reserved.targetIdentity,
    );
  }

  const payload = captureRenderGcTarget(base, destination);
  assertReservedDestination(source.snapshot, payload, reserved.targetIdentity);
  if (renderChunkContentFingerprint(payload) !== source.contentFingerprint)
    throw new Error(
      `Render chunk destination "${destination}" differs before publication.`,
    );
  assertCapturedRenderTarget(source.snapshot);
  createRenderGcFileSnapshot(
    base,
    path.join(destination, PUBLICATION_RECEIPT),
    source.receiptBytes,
  );
  const published = captureRenderChunkPublication(base, destination);
  assertReservedDestination(
    source.snapshot,
    published.snapshot,
    reserved.targetIdentity,
  );
  assertCapturedRenderTarget(source.snapshot);
  return { destination: published, source: source.snapshot };
};

const parsePublicationMarker = (
  bytes: Uint8Array,
): IRenderChunkPublicationMarker => {
  const value = JSON.parse(Buffer.from(bytes).toString("utf8")) as unknown;
  if (
    typeof value !== "object" ||
    value === null ||
    typeof (value as { publication?: unknown }).publication !== "object" ||
    (value as { publication: unknown }).publication === null
  )
    throw new Error("Render chunk receipt has no publication marker.");
  const publication = (value as IRenderChunkPublicationMarker).publication;
  if (
    publication.version !== 1 ||
    typeof publication.contentFingerprint !== "string" ||
    CONTENT_DIGEST_PATTERN.test(publication.contentFingerprint) === false
  )
    throw new Error("Render chunk receipt has an invalid publication marker.");
  return value as IRenderChunkPublicationMarker;
};

const assertReservedDestination = (
  source: IRenderGcTargetSnapshot,
  destination: IRenderGcTargetSnapshot,
  identity: string = destination.targetIdentity,
): void => {
  if (
    destination.kind !== "directory" ||
    destination.targetIdentity !== identity ||
    destination.base.identity !== source.base.identity ||
    destination.base.real !== source.base.real
  )
    throw new Error(
      `Render chunk destination "${destination.target}" changed physical identity.`,
    );
};

const renderChunkTarget = (root: string, relative: string): string => {
  const segments = relative.split("/");
  if (
    segments.length === 0 ||
    segments.some(
      (segment) =>
        segment.length === 0 ||
        segment === "." ||
        segment === ".." ||
        segment.includes("\\") ||
        segment.includes("\0"),
    )
  )
    throw new Error(`Render chunk path "${relative}" is invalid.`);
  return path.join(root, ...segments);
};

const ownedRelative = (base: string, target: string): string => {
  const relative = path.relative(path.resolve(base), path.resolve(target));
  if (
    relative === ".." ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative)
  )
    throw new Error(
      `Render chunk path "${target}" escapes its ownership root.`,
    );
  return relative;
};
