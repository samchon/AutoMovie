import { digestAutoMovieBytes } from "@automovie/mcp";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { assertPublishedProxyBundle } from "./assertProxyBundle";
import {
  type IRenderGcTargetSnapshot,
  RENDER_GC_PRESERVED_PREFIX,
  captureRenderGcTarget,
  ensureRenderPhysicalDirectory,
  removeCapturedRenderGcTarget,
} from "./renderGcSnapshot";

/** Publish one immutable proxy bundle without overwriting a destination. */
export const publishProxyBundle = (props: {
  expected: ReadonlyMap<string, Uint8Array>;
  parent: string;
  renderRoot: string;
  target: string;
}): { reused: boolean } => {
  assertDirectChild(props.parent, props.target, "proxy publication target");
  if (props.expected.has("publication.json") === false)
    throw new Error("Proxy publication requires one root publication receipt.");
  try {
    fs.lstatSync(props.target);
    assertPublishedProxyBundle(props.target, props.expected);
    return { reused: true };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }

  const candidate = path.join(
    props.parent,
    `.${path.basename(props.target)}.${randomUUID()}.candidate`,
  );
  fs.mkdirSync(candidate);
  const candidateReservation = captureRenderGcTarget(
    props.renderRoot,
    candidate,
  );
  try {
    writeExpectedTree(candidate, props.expected);
    const completeCandidate = captureRenderGcTarget(
      props.renderRoot,
      candidate,
    );
    assertExpectedSubset(
      candidateReservation,
      completeCandidate,
      props.expected,
      true,
    );
    assertPublishedProxyBundle(candidate, props.expected);

    try {
      fs.mkdirSync(props.target);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      assertPublishedProxyBundle(props.target, props.expected);
      return { reused: true };
    }
    const targetReservation = captureRenderGcTarget(
      props.renderRoot,
      props.target,
    );
    try {
      linkExpectedTree(candidate, props.target, props.expected);
      const published = captureRenderGcTarget(props.renderRoot, props.target);
      assertExpectedSubset(targetReservation, published, props.expected, true);
      assertPublishedProxyBundle(props.target, props.expected);
      return { reused: false };
    } catch (error) {
      removeOwnedPartial(targetReservation, props.expected);
      throw error;
    }
  } finally {
    removeOwnedPartial(candidateReservation, props.expected);
  }
};

const writeExpectedTree = (
  root: string,
  expected: ReadonlyMap<string, Uint8Array>,
): void => {
  const entries = [...expected].sort(([left], [right]) =>
    left < right ? -1 : left > right ? 1 : 0,
  );
  for (const [relative, bytes] of entries) {
    const destination = resolveBundleFile(root, relative);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(destination, bytes, { flag: "wx" });
  }
};

const linkExpectedTree = (
  source: string,
  target: string,
  expected: ReadonlyMap<string, Uint8Array>,
): void => {
  const entries = [...expected.keys()].sort((left, right) =>
    left === right
      ? 0
      : left === "publication.json"
        ? 1
        : right === "publication.json"
          ? -1
          : left < right
            ? -1
            : left > right
              ? 1
              : 0,
  );
  for (const relative of entries) {
    const sourceFile = resolveBundleFile(source, relative);
    const targetFile = resolveBundleFile(target, relative);
    fs.mkdirSync(path.dirname(targetFile), { recursive: true });
    fs.linkSync(sourceFile, targetFile);
  }
};

const removeOwnedPartial = (
  reservation: IRenderGcTargetSnapshot,
  expected: ReadonlyMap<string, Uint8Array>,
): void => {
  let current: IRenderGcTargetSnapshot;
  try {
    current = captureRenderGcTarget(reservation.base.path, reservation.target);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
    throw error;
  }
  if (expectedSubset(reservation, current, expected, false) === false) return;
  const quarantine = ensureRenderPhysicalDirectory(
    reservation.base.path,
    `${RENDER_GC_PRESERVED_PREFIX}proxy-publication-${randomUUID()}`,
  );
  try {
    removeCapturedRenderGcTarget({
      isolated: path.join(quarantine, randomUUID()),
      quarantine,
      snapshot: current,
    });
  } finally {
    if (fs.readdirSync(quarantine).length === 0) fs.rmdirSync(quarantine);
  }
};

const assertExpectedSubset = (
  reservation: IRenderGcTargetSnapshot,
  current: IRenderGcTargetSnapshot,
  expected: ReadonlyMap<string, Uint8Array>,
  complete: boolean,
): void => {
  if (expectedSubset(reservation, current, expected, complete) === false)
    throw new Error(
      `Proxy publication tree "${reservation.target}" changed ownership or expected bytes.`,
    );
};

const expectedSubset = (
  reservation: IRenderGcTargetSnapshot,
  current: IRenderGcTargetSnapshot,
  expected: ReadonlyMap<string, Uint8Array>,
  complete: boolean,
): boolean => {
  if (
    reservation.kind !== "directory" ||
    current.kind !== "directory" ||
    reservation.target !== current.target ||
    reservation.targetIdentity !== current.targetIdentity
  )
    return false;
  const files = new Map(
    [...expected].map(([relative, bytes]) => [
      canonicalRelative(relative),
      {
        bytes: bytes.length,
        digest: digestAutoMovieBytes(bytes),
      },
    ]),
  );
  const directories = new Set([""]);
  for (const relative of files.keys()) {
    const segments = relative.split("/");
    for (let length = 1; length < segments.length; ++length)
      directories.add(segments.slice(0, length).join("/"));
  }
  const valid = current.entries.every((entry) =>
    entry.kind === "directory"
      ? directories.has(entry.path)
      : files.has(entry.path) &&
        entry.bytes === files.get(entry.path)!.bytes &&
        entry.digest === files.get(entry.path)!.digest,
  );
  if (valid === false) return false;
  return (
    complete === false ||
    (current.entries.length === files.size + directories.size &&
      [...files.keys()].every((relative) =>
        current.entries.some(
          (entry) => entry.kind === "file" && entry.path === relative,
        ),
      ))
  );
};

const resolveBundleFile = (root: string, relative: string): string => {
  const canonical = canonicalRelative(relative);
  const target = path.resolve(root, ...canonical.split("/"));
  if (target.startsWith(`${path.resolve(root)}${path.sep}`) === false)
    throw new Error(`Proxy bundle file "${relative}" escapes its tree.`);
  return target;
};

const canonicalRelative = (relative: string): string => {
  if (
    relative.length === 0 ||
    relative.includes("\\") ||
    relative.startsWith("/") ||
    /^[A-Za-z]:/u.test(relative) ||
    relative
      .split("/")
      .some(
        (segment) =>
          segment.length === 0 || segment === "." || segment === "..",
      )
  )
    throw new Error(
      `Proxy bundle file "${relative}" must be one canonical relative path.`,
    );
  return relative;
};

const assertDirectChild = (
  parent: string,
  target: string,
  label: string,
): void => {
  if (path.dirname(path.resolve(target)) !== path.resolve(parent))
    throw new Error(`${label} must be a direct child of its physical parent.`);
};
