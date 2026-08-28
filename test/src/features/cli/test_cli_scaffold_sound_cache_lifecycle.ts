import { renderScaffold, writeFiles } from "@automovie/template";
import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";

import { namedFacts, throwsError } from "../internal/predicates";
import { preserveCliRootFixtureCleanup } from "./CliRootFixtureCleanup";

interface IRenderGcTargetSnapshot {
  bytes: number;
  contentFingerprint: `sha256:${string}`;
  entries: readonly { path: string }[];
  target: string;
}

interface IRenderLivenessLease {
  kind: "gc" | "session";
  scope: string;
  snapshot: IRenderGcTargetSnapshot;
}

interface ICacheLifecycleModule {
  acquireRenderGcLease(props: {
    coordinationRoot: string;
    pid: number;
    processAlive(pid: number): boolean;
    scope: string;
  }): IRenderLivenessLease;
  acquireRenderSessionLease(props: {
    coordinationRoot: string;
    pid: number;
    processAlive(pid: number): boolean;
    scope: string;
    tier: "proxy" | "final";
  }): IRenderLivenessLease;
  assertCapturedRenderTarget(snapshot: IRenderGcTargetSnapshot): void;
  ensureRenderPhysicalDirectory(base: string, relative: string): string;
  inventoryProductionSoundCaches(props: {
    captureTarget: ICacheLifecycleModule["captureRenderGcTarget"];
    productionStateRoot: string;
  }): Array<{
    candidate: {
      bytes: number;
      digest: `sha256:${string}` | null;
      kind: "dialogue-cache" | "model-cache";
      path: string;
    };
    snapshot: IRenderGcTargetSnapshot;
  }>;
  captureRenderGcTarget(base: string, target: string): IRenderGcTargetSnapshot;
  preserveRenderLivenessLease(
    failure: { error: unknown } | undefined,
    lease: IRenderLivenessLease,
  ): void;
  releaseRenderLivenessLease(lease: IRenderLivenessLease): boolean;
  runProductionRenderGarbageCollection<Lease, Result>(
    apply: boolean,
    runtime: {
      acquire(): Lease;
      assertNoLiveWorkers(): void;
      collect(apply: boolean): Result;
      release(failure: { error: unknown } | undefined, lease: Lease): void;
    },
  ): Result;
}

const packageRoot = (name: string): string => {
  const manifest = createRequire(__filename)
    .resolve.paths(name)
    ?.map((base) => path.join(base, ...name.split("/"), "package.json"))
    .find((candidate) => fs.existsSync(candidate));
  if (manifest === undefined)
    throw new Error(`Sound cache package root did not resolve: ${name}.`);
  return fs.realpathSync(path.dirname(manifest));
};

const linkWorkspacePackage = (project: string, name: string): void => {
  const target = path.join(project, "node_modules", ...name.split("/"));
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.symlinkSync(
    packageRoot(name),
    target,
    process.platform === "win32" ? "junction" : "dir",
  );
};

const census = (root: string, directory = root): string[] =>
  fs
    .readdirSync(directory, { withFileTypes: true })
    .sort((left, right) =>
      left.name < right.name ? -1 : left.name > right.name ? 1 : 0,
    )
    .flatMap((entry) => {
      const target = path.join(directory, entry.name);
      const relative = path.relative(root, target).replaceAll("\\", "/");
      return entry.isDirectory()
        ? [`${relative}/`, ...census(root, target)]
        : [relative];
    });

const writeGeneration = (
  root: string,
  relative: string,
  files: Readonly<Record<string, string>>,
): string => {
  const target = path.join(root, ...relative.split("/"));
  fs.mkdirSync(target, { recursive: true });
  for (const [file, value] of Object.entries(files)) {
    const output = path.join(target, ...file.split("/"));
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, value, "utf8");
  }
  return target;
};

const capture = (operation: () => unknown): unknown => {
  try {
    operation();
    return undefined;
  } catch (error) {
    return error;
  }
};

/**
 * Generated sound caches have physical creation, census, liveness and sweep
 * boundaries; a read-only census never materializes state.
 *
 * Scenarios:
 *
 * 1. Missing cache roots inventory as empty without changing the byte census;
 *    physical creation then yields exact direct dialogue/model generations.
 * 2. File mutation, inventory addition/removal, a byte-identical successor,
 *    linked root, and an existing linked creation ancestor are refused while
 *    external bytes remain untouched.
 * 3. A live render session refuses GC apply and an active GC guard refuses a
 *    render session, proving synthesis/publication and sweep cannot overlap.
 * 4. Dry collection takes no lease, apply follows acquire/assert/collect/release,
 *    and operation plus lease cleanup failure preserves primary-first order and
 *    cause.
 */
export const test_cli_scaffold_sound_cache_lifecycle = (): void => {
  const root = fs.realpathSync(
    fs.mkdtempSync(path.join(os.tmpdir(), "automovie-sound-cache-life-")),
  );
  let failure: { error: unknown } | undefined;
  try {
    const project = path.join(root, "generated");
    writeFiles(project, renderScaffold({ name: "sound-cache-life" }));
    for (const name of ["@automovie/interface", "@automovie/production"])
      linkWorkspacePackage(project, name);
    const scripts = path.join(project, "scripts");
    const lifecycle = {
      ...(createRequire(__filename)(
        path.join(scripts, "renderGcRuntime.ts"),
      ) as object),
      ...(createRequire(__filename)(
        path.join(scripts, "renderGcSnapshot.ts"),
      ) as object),
      ...(createRequire(__filename)(
        path.join(scripts, "renderLiveness.ts"),
      ) as object),
      ...(createRequire(__filename)(
        path.join(scripts, "soundCacheSnapshot.ts"),
      ) as object),
    } as ICacheLifecycleModule;

    const missing = path.join(root, "missing-state");
    fs.mkdirSync(missing);
    const before = census(missing);
    const missingInventory = lifecycle.inventoryProductionSoundCaches({
      captureTarget: lifecycle.captureRenderGcTarget,
      productionStateRoot: missing,
    });
    TestValidator.equals(
      "missing cache inventory does not materialize state",
      { before, after: census(missing), inventory: missingInventory },
      { before: [], after: [], inventory: [] },
    );
    const fileRootState = path.join(root, "file-root-state");
    fs.mkdirSync(path.join(fileRootState, "audio-cache"), { recursive: true });
    fs.writeFileSync(
      path.join(fileRootState, "audio-cache", "kokoro"),
      "not a directory",
      "utf8",
    );
    TestValidator.equals(
      "a non-directory cache root is refused",
      throwsError(
        () =>
          lifecycle.inventoryProductionSoundCaches({
            captureTarget: lifecycle.captureRenderGcTarget,
            productionStateRoot: fileRootState,
          }),
        "is not a directory",
      ),
      true,
    );

    const state = path.join(root, "production-state");
    fs.mkdirSync(state);
    const currentDialogue = lifecycle.ensureRenderPhysicalDirectory(
      state,
      `audio-cache/kokoro/${"a".repeat(64)}`,
    );
    fs.writeFileSync(path.join(currentDialogue, "pcm.f32"), "pcm", "utf8");
    fs.writeFileSync(
      path.join(currentDialogue, "receipt.json"),
      '{"version":5}\n',
      "utf8",
    );
    writeGeneration(state, `audio-cache/kokoro/${"b".repeat(64)}`, {
      "receipt.json": '{"version":4}\n',
    });
    writeGeneration(state, "model-cache/kokoro/current-revision", {
      "model.onnx": "model",
      "voices/voice.bin": "voice",
    });
    writeGeneration(state, "model-cache/kokoro/stale-revision", {
      "partial.onnx": "partial",
    });
    const inventory = lifecycle.inventoryProductionSoundCaches({
      captureTarget: lifecycle.captureRenderGcTarget,
      productionStateRoot: state,
    });
    TestValidator.equals(
      "physical cache roots produce exact direct generation candidates",
      {
        paths: inventory.map((entry) => entry.candidate.path),
        kinds: inventory.map((entry) => entry.candidate.kind),
        positiveBytes: inventory.every((entry) => entry.candidate.bytes > 0),
        exactDigests: inventory.every(
          (entry) =>
            entry.candidate.digest === entry.snapshot.contentFingerprint,
        ),
      },
      {
        paths: [
          `audio-cache/kokoro/${"a".repeat(64)}`,
          `audio-cache/kokoro/${"b".repeat(64)}`,
          "model-cache/kokoro/current-revision",
          "model-cache/kokoro/stale-revision",
        ],
        kinds: [
          "dialogue-cache",
          "dialogue-cache",
          "model-cache",
          "model-cache",
        ],
        positiveBytes: true,
        exactDigests: true,
      },
    );

    const mutated = inventory[0]!.snapshot;
    fs.appendFileSync(path.join(mutated.target, "receipt.json"), "changed");
    const added = inventory[1]!.snapshot;
    fs.writeFileSync(path.join(added.target, "late.bin"), "late");
    const removed = inventory[2]!.snapshot;
    fs.rmSync(path.join(removed.target, "voices", "voice.bin"));
    const successor = inventory[3]!.snapshot;
    const successorFile = path.join(successor.target, "partial.onnx");
    const successorBytes = fs.readFileSync(successorFile);
    fs.renameSync(successorFile, `${successorFile}.old`);
    fs.writeFileSync(successorFile, successorBytes);

    const external = path.join(root, "external");
    fs.mkdirSync(external);
    fs.writeFileSync(path.join(external, "sentinel"), "untouched", "utf8");
    const linkedState = path.join(root, "linked-state");
    fs.mkdirSync(path.join(linkedState, "audio-cache"), { recursive: true });
    fs.symlinkSync(
      external,
      path.join(linkedState, "audio-cache", "kokoro"),
      process.platform === "win32" ? "junction" : "dir",
    );
    const linkedCreation = path.join(root, "linked-creation");
    fs.mkdirSync(linkedCreation);
    fs.symlinkSync(
      external,
      path.join(linkedCreation, "model-cache"),
      process.platform === "win32" ? "junction" : "dir",
    );
    TestValidator.equals(
      "cache drift and linked ownership are refused without external writes",
      {
        drift: namedFacts([
          [
            "file mutation",
            () =>
              throwsError(
                () => lifecycle.assertCapturedRenderTarget(mutated),
                "changed",
              ),
          ],
          [
            "inventory addition",
            () =>
              throwsError(
                () => lifecycle.assertCapturedRenderTarget(added),
                "changed",
              ),
          ],
          [
            "inventory removal",
            () =>
              throwsError(
                () => lifecycle.assertCapturedRenderTarget(removed),
                "changed",
              ),
          ],
          [
            "byte-identical successor",
            () =>
              throwsError(
                () => lifecycle.assertCapturedRenderTarget(successor),
                "changed",
              ),
          ],
          [
            "linked cache root",
            () =>
              throwsError(
                () =>
                  lifecycle.inventoryProductionSoundCaches({
                    captureTarget: lifecycle.captureRenderGcTarget,
                    productionStateRoot: linkedState,
                  }),
                "linked",
              ),
          ],
          [
            "linked creation ancestor",
            () =>
              throwsError(
                () =>
                  lifecycle.ensureRenderPhysicalDirectory(
                    linkedCreation,
                    "model-cache/kokoro/current-revision",
                  ),
                "not physical",
              ),
          ],
        ]),
        external: census(external),
      },
      {
        drift: {
          "file mutation": true,
          "inventory addition": true,
          "inventory removal": true,
          "byte-identical successor": true,
          "linked cache root": true,
          "linked creation ancestor": true,
        },
        external: ["sentinel"],
      },
    );

    const coordination = path.join(root, "coordination");
    fs.mkdirSync(coordination);
    const scope = "c".repeat(64);
    const session = lifecycle.acquireRenderSessionLease({
      coordinationRoot: coordination,
      pid: 101,
      processAlive: (pid) => pid === 101,
      scope,
      tier: "proxy",
    });
    const gcDuringSession = throwsError(
      () =>
        lifecycle.acquireRenderGcLease({
          coordinationRoot: coordination,
          pid: 202,
          processAlive: (pid) => pid === 101,
          scope,
        }),
      "active render session",
    );
    lifecycle.releaseRenderLivenessLease(session);
    const gc = lifecycle.acquireRenderGcLease({
      coordinationRoot: coordination,
      pid: 202,
      processAlive: () => false,
      scope,
    });
    const sessionDuringGc = throwsError(
      () =>
        lifecycle.acquireRenderSessionLease({
          coordinationRoot: coordination,
          pid: 303,
          processAlive: (pid) => pid === 202,
          scope,
          tier: "final",
        }),
      "GC apply",
    );
    lifecycle.releaseRenderLivenessLease(gc);
    TestValidator.equals(
      "sound generation and GC apply leases exclude one another",
      { gcDuringSession, sessionDuringGc },
      { gcDuringSession: true, sessionDuringGc: true },
    );

    const guardName = `.automovie-liveness-${scope}.gc-apply.lock`;
    const activeGuard = lifecycle.acquireRenderGcLease({
      coordinationRoot: coordination,
      pid: 501,
      processAlive: () => false,
      scope,
    });
    const duplicateGuard = throwsError(
      () =>
        lifecycle.acquireRenderGcLease({
          coordinationRoot: coordination,
          pid: 502,
          processAlive: (pid) => pid === 501,
          scope,
        }),
      "already active",
    );
    lifecycle.releaseRenderLivenessLease(activeGuard);
    const staleGuard = lifecycle.acquireRenderGcLease({
      coordinationRoot: coordination,
      pid: 503,
      processAlive: () => false,
      scope,
    });
    const recoveredGuard = lifecycle.acquireRenderGcLease({
      coordinationRoot: coordination,
      pid: 504,
      processAlive: () => false,
      scope,
    });
    const staleOwnerRefused = throwsError(
      () => lifecycle.releaseRenderLivenessLease(staleGuard),
      "changed",
    );
    lifecycle.releaseRenderLivenessLease(recoveredGuard);
    const changingGuard = lifecycle.acquireRenderGcLease({
      coordinationRoot: coordination,
      pid: 505,
      processAlive: () => false,
      scope,
    });
    let inspected = 0;
    const becameActive = throwsError(
      () =>
        lifecycle.acquireRenderSessionLease({
          coordinationRoot: coordination,
          pid: 506,
          processAlive: (pid) => pid === 505 && ++inspected === 2,
          scope,
          tier: "proxy",
        }),
      "became active while inspected",
    );
    lifecycle.releaseRenderLivenessLease(changingGuard);
    fs.writeFileSync(
      path.join(coordination, guardName),
      `${JSON.stringify({ kind: "session", pid: 1, tier: null, token: "x" })}\n`,
      "utf8",
    );
    const invalidGuard = throwsError(
      () =>
        lifecycle.acquireRenderSessionLease({
          coordinationRoot: coordination,
          pid: 507,
          processAlive: () => false,
          scope,
          tier: "proxy",
        }),
      "no trustworthy owner identity",
    );
    fs.rmSync(path.join(coordination, guardName));
    const vanished = lifecycle.acquireRenderGcLease({
      coordinationRoot: coordination,
      pid: 508,
      processAlive: () => false,
      scope,
    });
    fs.rmSync(vanished.snapshot.target);
    const vanishedRelease =
      lifecycle.releaseRenderLivenessLease(vanished) === false;
    const firstSession = lifecycle.acquireRenderSessionLease({
      coordinationRoot: coordination,
      pid: 509,
      processAlive: () => false,
      scope,
      tier: "proxy",
    });
    const secondSession = lifecycle.acquireRenderSessionLease({
      coordinationRoot: coordination,
      pid: 510,
      processAlive: () => false,
      scope,
      tier: "final",
    });
    const pluralSessions = throwsError(
      () =>
        lifecycle.acquireRenderGcLease({
          coordinationRoot: coordination,
          pid: 511,
          processAlive: (pid) => pid === 509 || pid === 510,
          scope,
        }),
      "active render sessions",
    );
    lifecycle.releaseRenderLivenessLease(firstSession);
    lifecycle.releaseRenderLivenessLease(secondSession);
    const staleSession = lifecycle.acquireRenderSessionLease({
      coordinationRoot: coordination,
      pid: 512,
      processAlive: () => false,
      scope,
      tier: "proxy",
    });
    const gcAfterStaleSession = lifecycle.acquireRenderGcLease({
      coordinationRoot: coordination,
      pid: 513,
      processAlive: () => false,
      scope,
    });
    const staleSessionReleased =
      lifecycle.releaseRenderLivenessLease(staleSession) === false;
    lifecycle.releaseRenderLivenessLease(gcAfterStaleSession);
    const invalidClaim = `.automovie-liveness-${scope}.session.invalid.lock`;
    fs.writeFileSync(path.join(coordination, invalidClaim), "invalid", "utf8");
    const invalidSessionClaim = throwsError(
      () =>
        lifecycle.acquireRenderGcLease({
          coordinationRoot: coordination,
          pid: 514,
          processAlive: () => false,
          scope,
        }),
      "claim",
    );
    fs.rmSync(path.join(coordination, invalidClaim));
    TestValidator.equals(
      "stale, duplicate, changing, invalid and vanished leases stay fail-closed",
      {
        duplicateGuard,
        staleOwnerRefused,
        becameActive,
        invalidGuard,
        vanishedRelease,
        pluralSessions,
        staleSessionReleased,
        invalidSessionClaim,
        invalidPid: throwsError(
          () =>
            lifecycle.acquireRenderGcLease({
              coordinationRoot: coordination,
              pid: 0,
              processAlive: () => false,
              scope,
            }),
          "PID",
        ),
        invalidScope: throwsError(
          () =>
            lifecycle.acquireRenderGcLease({
              coordinationRoot: coordination,
              pid: 515,
              processAlive: () => false,
              scope: "not-a-digest",
            }),
          "scope",
        ),
        missingCoordination: throwsError(() =>
          lifecycle.acquireRenderGcLease({
            coordinationRoot: path.join(root, "absent-coordination"),
            pid: 516,
            processAlive: () => false,
            scope,
          }),
        ),
      },
      {
        duplicateGuard: true,
        staleOwnerRefused: true,
        becameActive: true,
        invalidGuard: true,
        vanishedRelease: true,
        pluralSessions: true,
        staleSessionReleased: true,
        invalidSessionClaim: true,
        invalidPid: true,
        invalidScope: true,
        missingCoordination: true,
      },
    );

    const events: string[] = [];
    const dry = lifecycle.runProductionRenderGarbageCollection(false, {
      acquire: () => {
        throw new Error("Dry GC must not acquire a lease.");
      },
      assertNoLiveWorkers: () => {
        throw new Error("Dry GC must not scan live workers.");
      },
      collect: (apply) => {
        events.push(`collect:${apply}`);
        return "dry";
      },
      release: () => {
        throw new Error("Dry GC must not release a lease.");
      },
    });
    const applied = lifecycle.runProductionRenderGarbageCollection(true, {
      acquire: () => {
        events.push("acquire");
        return "lease";
      },
      assertNoLiveWorkers: () => events.push("assert"),
      collect: (apply) => {
        events.push(`collect:${apply}`);
        return "applied";
      },
      release: (captured, lease) => {
        events.push(`release:${lease}:${captured === undefined}`);
      },
    });

    const exactLease = lifecycle.acquireRenderGcLease({
      coordinationRoot: coordination,
      pid: 404,
      processAlive: () => false,
      scope,
    });
    const primary = new Error("cache sweep failed");
    fs.renameSync(
      exactLease.snapshot.target,
      `${exactLease.snapshot.target}.previous`,
    );
    fs.writeFileSync(exactLease.snapshot.target, "foreign", "utf8");
    const combined = capture(() =>
      lifecycle.preserveRenderLivenessLease({ error: primary }, exactLease),
    );
    fs.rmSync(exactLease.snapshot.target);
    const cleanupOnlyLease = lifecycle.acquireRenderGcLease({
      coordinationRoot: coordination,
      pid: 517,
      processAlive: () => false,
      scope,
    });
    fs.renameSync(
      cleanupOnlyLease.snapshot.target,
      `${cleanupOnlyLease.snapshot.target}.previous`,
    );
    fs.writeFileSync(cleanupOnlyLease.snapshot.target, "foreign", "utf8");
    const cleanupOnly = capture(() =>
      lifecycle.preserveRenderLivenessLease(undefined, cleanupOnlyLease),
    );
    fs.rmSync(cleanupOnlyLease.snapshot.target);
    const primaryOnlyLease = lifecycle.acquireRenderGcLease({
      coordinationRoot: coordination,
      pid: 518,
      processAlive: () => false,
      scope,
    });
    const primaryOnly = capture(() =>
      lifecycle.preserveRenderLivenessLease(
        { error: primary },
        primaryOnlyLease,
      ),
    );
    TestValidator.equals(
      "dry/apply ordering and primary-first cleanup are exact",
      {
        dry,
        applied,
        events,
        aggregate: combined instanceof AggregateError,
        cause: combined instanceof AggregateError ? combined.cause : undefined,
        errors: combined instanceof AggregateError ? [...combined.errors] : [],
        cleanupOnly: cleanupOnly instanceof Error,
        primaryOnly: primaryOnly === primary,
      },
      {
        dry: "dry",
        applied: "applied",
        events: [
          "collect:false",
          "acquire",
          "assert",
          "collect:true",
          "release:lease:true",
        ],
        aggregate: true,
        cause: primary,
        errors: [primary, (combined as AggregateError).errors[1]],
        cleanupOnly: true,
        primaryOnly: true,
      },
    );
  } catch (error) {
    failure = { error };
    throw error;
  } finally {
    preserveCliRootFixtureCleanup(
      failure,
      () => fs.rmSync(root, { force: true, recursive: true }),
      "sound cache lifecycle fixture",
    );
  }
};
