import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import {
  type IRenderGcTargetSnapshot,
  RENDER_GC_REMOVAL_STAGING_DIRECTORY,
  captureRenderGcTarget,
  createRenderGcFileSnapshot,
  ensureRenderPhysicalDirectory,
  readCapturedRenderGcFile,
  removeCapturedRenderGcTarget,
} from "./renderGcSnapshot";

const LEASE_MAX_BYTES = 64 * 1024;
const SCOPE_PATTERN = /^[0-9a-f]{64}$/u;

interface IRenderLivenessOwner {
  kind: "gc" | "session";
  pid: number;
  tier: "proxy" | "final" | null;
  token: string;
}

export interface IRenderLivenessLease {
  kind: "gc" | "session";
  scope: string;
  snapshot: IRenderGcTargetSnapshot;
}

interface IRenderLivenessProps {
  coordinationRoot: string;
  pid: number;
  processAlive: (pid: number) => boolean;
  scope: string;
}

/** Acquire a render session that cannot overlap an explicit GC apply. */
export const acquireRenderSessionLease = (
  props: IRenderLivenessProps & { tier: "proxy" | "final" },
): IRenderLivenessLease => {
  assertProps(props);
  assertNoActiveGcGuard(props);
  const token = randomUUID();
  const target = path.join(
    props.coordinationRoot,
    sessionName(props.scope, props.pid, props.tier, token),
  );
  const lease: IRenderLivenessLease = {
    kind: "session",
    scope: props.scope,
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
  assertProps(props);
  const target = path.join(props.coordinationRoot, gcGuardName(props.scope));
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
    const lease: IRenderLivenessLease = {
      kind: "gc",
      scope: props.scope,
      snapshot,
    };
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
    RENDER_GC_REMOVAL_STAGING_DIRECTORY,
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
  }
};

interface IRenderLivenessLeaseFailure {
  error: unknown;
}

class RenderLivenessLeaseCleanupError extends AggregateError {}

/**
 * Release one lease at the end of a guarded body without discarding either
 * failure.
 *
 * The release removes a captured GC target and rethrows everything that is not
 * `ENOENT`, so a raw call in `finally` replaces the guarded body's own
 * diagnostic with the release error whenever both fail.
 */
export const preserveRenderLivenessLease = (
  failure: IRenderLivenessLeaseFailure | undefined,
  lease: IRenderLivenessLease,
): void => {
  try {
    releaseRenderLivenessLease(lease);
  } catch (releaseFailure) {
    if (failure === undefined) throw releaseFailure;
    throw new RenderLivenessLeaseCleanupError(
      [
        ...(failure.error instanceof RenderLivenessLeaseCleanupError
          ? failure.error.errors
          : [failure.error]),
        releaseFailure,
      ],
      `Render liveness lease release failed after the ${lease.kind} body failed.`,
    );
  }
  if (failure !== undefined) throw failure.error;
};

const assertNoActiveGcGuard = (props: IRenderLivenessProps): void => {
  for (;;) {
    const snapshot = captureExisting(
      props.coordinationRoot,
      path.join(props.coordinationRoot, gcGuardName(props.scope)),
    );
    if (snapshot === null) return;
    const owner = readOwner(snapshot);
    if (
      owner.kind !== "gc" ||
      owner.tier !== null ||
      Number.isSafeInteger(owner.pid) === false ||
      owner.pid <= 0 ||
      typeof owner.token !== "string" ||
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
    if (
      releaseRenderLivenessLease({
        kind: "gc",
        scope: props.scope,
        snapshot,
      }) === false
    )
      continue;
  }
};

const removeStaleGcGuard = (props: IRenderLivenessProps): boolean => {
  const snapshot = captureExisting(
    props.coordinationRoot,
    path.join(props.coordinationRoot, gcGuardName(props.scope)),
  );
  if (snapshot === null) return true;
  const owner = readOwner(snapshot);
  if (
    owner.kind !== "gc" ||
    owner.tier !== null ||
    Number.isSafeInteger(owner.pid) === false ||
    owner.pid <= 0 ||
    typeof owner.token !== "string" ||
    owner.token.length === 0
  )
    throw new Error("Render GC guard has no trustworthy owner identity.");
  if (props.processAlive(owner.pid)) return false;
  if (props.processAlive(owner.pid)) return false;
  releaseRenderLivenessLease({ kind: "gc", scope: props.scope, snapshot });
  return true;
};

const activeRenderSessions = (props: IRenderLivenessProps): string[] => {
  const active: string[] = [];
  const prefix = `.automovie-liveness-${props.scope}.session.`;
  const pattern = sessionPattern(props.scope);
  for (const name of fs.readdirSync(props.coordinationRoot).sort(compare)) {
    if (name.startsWith(prefix) === false || name.endsWith(".lock") === false)
      continue;
    const match = pattern.exec(name);
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
      typeof owner.token !== "string" ||
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
    releaseRenderLivenessLease({
      kind: "session",
      scope: props.scope,
      snapshot,
    });
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

const assertProps = (props: IRenderLivenessProps): void => {
  if (Number.isSafeInteger(props.pid) === false || props.pid <= 0)
    throw new Error(`Render liveness PID "${props.pid}" is invalid.`);
  if (SCOPE_PATTERN.test(props.scope) === false)
    throw new Error(`Render liveness scope "${props.scope}" is invalid.`);
};

const gcGuardName = (scope: string): string =>
  `.automovie-liveness-${scope}.gc-apply.lock`;

const sessionName = (
  scope: string,
  pid: number,
  tier: "proxy" | "final",
  token: string,
): string =>
  `.automovie-liveness-${scope}.session.${pid}.${tier}.${token}.lock`;

const sessionPattern = (scope: string): RegExp =>
  new RegExp(
    `^\\.automovie-liveness-${scope}\\.session\\.(\\d+)\\.(proxy|final)\\.([^.]+)\\.lock$`,
    "u",
  );

const compare = (x: string, y: string): number => (x < y ? -1 : x > y ? 1 : 0);
