import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import {
  type IRenderGcTargetSnapshot,
  RENDER_GC_PRESERVED_PREFIX,
  captureRenderGcTarget,
  createRenderGcFileSnapshot,
  ensureRenderPhysicalDirectory,
  readCapturedRenderGcFile,
  removeCapturedRenderGcTarget,
} from "./renderGcSnapshot";

const GC_GUARD = "gc-apply.lock";
const LEASE_MAX_BYTES = 64 * 1024;
const SESSION_PATTERN = /^session\.(\d+)\.(proxy|final)\.([^.]+)\.lock$/u;

interface IRenderLivenessOwner {
  kind: "gc" | "session";
  pid: number;
  tier: "proxy" | "final" | null;
  token: string;
}

export interface IRenderLivenessLease {
  kind: "gc" | "session";
  snapshot: IRenderGcTargetSnapshot;
}

interface IRenderLivenessProps {
  coordinationRoot: string;
  pid: number;
  processAlive: (pid: number) => boolean;
}

/** Acquire a render session that cannot overlap an explicit GC apply. */
export const acquireRenderSessionLease = (
  props: IRenderLivenessProps & { tier: "proxy" | "final" },
): IRenderLivenessLease => {
  assertProcessId(props.pid);
  assertNoActiveGcGuard(props);
  const token = randomUUID();
  const target = path.join(
    props.coordinationRoot,
    `session.${props.pid}.${props.tier}.${token}.lock`,
  );
  const lease: IRenderLivenessLease = {
    kind: "session",
    snapshot: createRenderGcFileSnapshot(
      props.coordinationRoot,
      target,
      ownerBytes({
        kind: "session",
        pid: props.pid,
        tier: props.tier,
        token,
      }),
    ),
  };
  try {
    assertNoActiveGcGuard(props);
    return lease;
  } catch (error) {
    releaseRenderLivenessLease(lease);
    throw error;
  }
};

/** Acquire the exclusive guard before scanning or mutating render GC state. */
export const acquireRenderGcLease = (
  props: IRenderLivenessProps,
): IRenderLivenessLease => {
  assertProcessId(props.pid);
  const target = path.join(props.coordinationRoot, GC_GUARD);
  for (;;) {
    const token = randomUUID();
    let snapshot: IRenderGcTargetSnapshot;
    try {
      snapshot = createRenderGcFileSnapshot(
        props.coordinationRoot,
        target,
        ownerBytes({ kind: "gc", pid: props.pid, tier: null, token }),
      );
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      if (removeStaleGcGuard(props) === false)
        throw new Error("Render GC apply is already active.");
      continue;
    }
    const lease: IRenderLivenessLease = { kind: "gc", snapshot };
    try {
      const active = activeRenderSessions(props);
      if (active.length !== 0)
        throw new Error(
          `Render GC --apply refuses active render session${
            active.length === 1 ? "" : "s"
          } ${active.join(", ")}. Wait for the render command to finish.`,
        );
      return lease;
    } catch (error) {
      releaseRenderLivenessLease(lease);
      throw error;
    }
  }
};

/** Release only the exact guard or session file acquired by this process. */
export const releaseRenderLivenessLease = (
  lease: IRenderLivenessLease,
): boolean => {
  const quarantine = ensureRenderPhysicalDirectory(
    lease.snapshot.base.path,
    `${RENDER_GC_PRESERVED_PREFIX}lease-${randomUUID()}`,
  );
  try {
    removeCapturedRenderGcTarget({
      isolated: path.join(quarantine, randomUUID()),
      quarantine,
      snapshot: lease.snapshot,
    });
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  } finally {
    if (fs.readdirSync(quarantine).length === 0) fs.rmdirSync(quarantine);
  }
};

const assertNoActiveGcGuard = (props: IRenderLivenessProps): void => {
  for (;;) {
    const snapshot = captureExisting(
      props.coordinationRoot,
      path.join(props.coordinationRoot, GC_GUARD),
    );
    if (snapshot === null) return;
    const owner = readOwner(snapshot);
    if (
      owner.kind !== "gc" ||
      owner.tier !== null ||
      Number.isSafeInteger(owner.pid) === false ||
      owner.pid <= 0 ||
      owner.token.length === 0
    )
      throw new Error("Render GC guard has no trustworthy owner identity.");
    if (props.processAlive(owner.pid))
      throw new Error(
        `Render GC apply ${owner.pid} is active. Wait for it to finish.`,
      );
    if (props.processAlive(owner.pid))
      throw new Error(
        `Render GC apply ${owner.pid} became active while inspected.`,
      );
    if (releaseRenderLivenessLease({ kind: "gc", snapshot }) === false)
      continue;
  }
};

const removeStaleGcGuard = (props: IRenderLivenessProps): boolean => {
  const snapshot = captureExisting(
    props.coordinationRoot,
    path.join(props.coordinationRoot, GC_GUARD),
  );
  if (snapshot === null) return true;
  const owner = readOwner(snapshot);
  if (
    owner.kind !== "gc" ||
    owner.tier !== null ||
    Number.isSafeInteger(owner.pid) === false ||
    owner.pid <= 0 ||
    owner.token.length === 0
  )
    throw new Error("Render GC guard has no trustworthy owner identity.");
  if (props.processAlive(owner.pid)) return false;
  if (props.processAlive(owner.pid)) return false;
  releaseRenderLivenessLease({ kind: "gc", snapshot });
  return true;
};

const activeRenderSessions = (props: IRenderLivenessProps): string[] => {
  const active: string[] = [];
  for (const name of fs.readdirSync(props.coordinationRoot).sort(compare)) {
    if (
      name.startsWith("session.") === false ||
      name.endsWith(".lock") === false
    )
      continue;
    const match = SESSION_PATTERN.exec(name);
    if (match === null)
      throw new Error(`Render session claim "${name}" is invalid.`);
    const target = path.join(props.coordinationRoot, name);
    const snapshot = captureExisting(props.coordinationRoot, target);
    if (snapshot === null) continue;
    const owner = readOwner(snapshot);
    const pid = Number(match[1]);
    if (
      owner.kind !== "session" ||
      owner.pid !== pid ||
      owner.tier !== match[2] ||
      owner.token !== match[3] ||
      Number.isSafeInteger(pid) === false ||
      pid <= 0
    )
      throw new Error(`Render session claim "${name}" changed owner identity.`);
    if (props.processAlive(pid)) {
      active.push(`${pid}/${owner.tier}`);
      continue;
    }
    if (props.processAlive(pid)) {
      active.push(`${pid}/${owner.tier}`);
      continue;
    }
    releaseRenderLivenessLease({ kind: "session", snapshot });
  }
  return active;
};

const captureExisting = (
  base: string,
  target: string,
): IRenderGcTargetSnapshot | null => {
  try {
    return captureRenderGcTarget(base, target);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
};

const readOwner = (snapshot: IRenderGcTargetSnapshot): IRenderLivenessOwner =>
  JSON.parse(
    Buffer.from(readCapturedRenderGcFile(snapshot, LEASE_MAX_BYTES)).toString(
      "utf8",
    ),
  ) as IRenderLivenessOwner;

const ownerBytes = (owner: IRenderLivenessOwner): Uint8Array =>
  Buffer.from(`${JSON.stringify(owner)}\n`);

const assertProcessId = (pid: number): void => {
  if (Number.isSafeInteger(pid) === false || pid <= 0)
    throw new Error(`Render liveness PID "${pid}" is invalid.`);
};

const compare = (x: string, y: string): number => (x < y ? -1 : x > y ? 1 : 0);
