import type { AutoMovieContentDigest } from "@automovie/interface";
import type {
  IAutoMovieProductionRenderChunk,
  IAutoMovieProductionRenderChunkReceipt,
} from "@automovie/production";
import { TestValidator } from "@nestia/e2e";
import path from "node:path";

import { loadSourceModule } from "../internal/loadSourceModule";

interface IRenderGcAdjudicationModule {
  currentRenderChunkPublicationProtectsTree: (props: {
    candidate: IRenderGcSnapshot;
    candidateName: string;
    capture: (
      chunk: IAutoMovieProductionRenderChunk,
    ) => IRenderPublication | null;
    chunks: ReadonlyMap<
      AutoMovieContentDigest,
      IAutoMovieProductionRenderChunk
    >;
  }) => boolean;
  renderChunkReceiptObservation: (props: {
    expected: Pick<IAutoMovieProductionRenderChunk, "id" | "slot"> | null;
    receipt: Pick<
      IAutoMovieProductionRenderChunkReceipt,
      "chunk" | "slot" | "version"
    >;
    verified: boolean;
  }) => {
    state: string;
    authority: string;
    stage: string;
    reason: string;
  } | null;
}

interface IRenderGcTransactionModule {
  quarantinedRenderChunkPointerProtection: (props: {
    adjudication: {
      disposition: string;
      kind: string;
      path: string;
      state: string;
      authority: string;
    } | null;
    candidates: Array<{
      kind: string;
      path: string;
      digest: AutoMovieContentDigest | null;
    }>;
    retained: ReadonlySet<string>;
  }) => {
    observation: {
      state: string;
      authority: string;
      stage: string;
      reason: string;
    };
    treePaths: readonly string[];
  } | null;
  runProductionRenderGarbageCollection: <Lease, Result>(
    apply: boolean,
    runtime: {
      acquire: () => Lease;
      assertNoLiveWorkers: () => void;
      collect: (apply: boolean, expected?: Result) => Result;
      release: (failure: { error: unknown } | undefined, lease: Lease) => void;
    },
  ) => Result;
}

interface IRenderSchedulerModule {
  productionRenderSchedulerReceipt: (inspection: {
    current: { receipt: unknown } | null;
    finding: {
      state: "absent" | "current" | "integrity-failed";
      reason: string;
    };
    pointer: null;
  }) => unknown;
}

interface IRenderGcSnapshot {
  target: string;
  targetIdentity: string;
}

interface IRenderPublication {
  receipt: { chunk: AutoMovieContentDigest; slot: string };
  tree: IRenderGcSnapshot;
}

const digest = (fill: string): AutoMovieContentDigest =>
  `sha256:${fill.repeat(64)}`;

/** GC classification remains typed and apply consumes the exact preview basis. */
export const test_cli_scaffold_render_gc_adjudication = (): void => {
  const chunkModule = loadSourceModule<IRenderGcAdjudicationModule>(
    path.resolve(
      __dirname,
      "../../../../packages/template/scaffold/scripts/renderChunkSnapshot.ts",
    ),
  );
  const runtimeModule = loadSourceModule<IRenderGcTransactionModule>(
    path.resolve(
      __dirname,
      "../../../../packages/template/scaffold/scripts/renderGcCollection.ts",
    ),
  );
  const schedulerModule = loadSourceModule<IRenderSchedulerModule>(
    path.resolve(
      __dirname,
      "../../../../packages/template/scaffold/scripts/renderChunkInspection.ts",
    ),
  );
  const chunk = { id: digest("a"), slot: "beauty:0000" };
  const currentReceipt = {
    version: 2 as const,
    chunk: chunk.id,
    slot: chunk.slot,
  };
  TestValidator.equals(
    "current corruption is quarantined while another generation is stale",
    {
      current: chunkModule.renderChunkReceiptObservation({
        expected: chunk,
        receipt: currentReceipt,
        verified: true,
      }),
      corrupt: chunkModule.renderChunkReceiptObservation({
        expected: chunk,
        receipt: currentReceipt,
        verified: false,
      }),
      stale: chunkModule.renderChunkReceiptObservation({
        expected: chunk,
        receipt: { ...currentReceipt, slot: "beauty:old" },
        verified: false,
      }),
    },
    {
      current: null,
      corrupt: {
        state: "integrity-failed",
        authority: "exact-quarantine",
        stage: "inventory",
        reason:
          "the current chunk receipt contradicts its declared frame, media, or semantic inventory",
      },
      stale: {
        state: "verified-stale",
        authority: "exact-remove",
        stage: "currentness",
        reason:
          "the readable receipt-bound chunk generation is not the current plan generation",
      },
    },
  );

  const candidate = {
    target: "tmp/current",
    targetIdentity: "tree-current",
  };
  const chunks = new Map([
    [chunk.id, chunk as IAutoMovieProductionRenderChunk],
  ]);
  const protects = (
    capture: (
      chunk: IAutoMovieProductionRenderChunk,
    ) => IRenderPublication | null,
  ): boolean =>
    chunkModule.currentRenderChunkPublicationProtectsTree({
      candidate,
      candidateName: `${"a".repeat(64)}.attempt.7.00000000-0000-4000-8000-000000000000.aG9zdA`,
      capture,
      chunks,
    });
  TestValidator.equals(
    "an unresolved current pointer protects its tree until explicit adjudication",
    {
      exact: protects(() => ({
        receipt: { chunk: chunk.id, slot: chunk.slot },
        tree: candidate,
      })),
      absent: protects(() => null),
      unresolved: protects(() => {
        throw new Error("pointer unavailable");
      }),
      foreign: protects(() => ({
        receipt: { chunk: chunk.id, slot: chunk.slot },
        tree: { ...candidate, targetIdentity: "tree-successor" },
      })),
    },
    { exact: true, absent: false, unresolved: true, foreign: false },
  );

  const receipt = { id: "current-receipt" };
  let unresolved: string | null = null;
  try {
    schedulerModule.productionRenderSchedulerReceipt({
      current: null,
      finding: {
        state: "integrity-failed",
        reason: "current pointer is unresolved",
      },
      pointer: null,
    });
  } catch (error) {
    unresolved = error instanceof Error ? error.message : String(error);
  }
  TestValidator.equals(
    "scheduler renders only absence and refuses every unresolved resident",
    {
      absent: schedulerModule.productionRenderSchedulerReceipt({
        current: null,
        finding: { state: "absent", reason: "absent" },
        pointer: null,
      }),
      current: schedulerModule.productionRenderSchedulerReceipt({
        current: { receipt },
        finding: { state: "current", reason: "current" },
        pointer: null,
      }),
      unresolved,
    },
    {
      absent: null,
      current: receipt,
      unresolved: "current pointer is unresolved",
    },
  );

  const dryEvents: string[] = [];
  const preview = { applied: false, basis: digest("b") };
  TestValidator.equals(
    "dry-run performs no lease or apply operation",
    runtimeModule.runProductionRenderGarbageCollection(false, {
      acquire: () => {
        dryEvents.push("acquire");
        return "lease";
      },
      assertNoLiveWorkers: () => dryEvents.push("workers"),
      collect: (apply) => {
        dryEvents.push(`collect:${String(apply)}`);
        return preview;
      },
      release: () => dryEvents.push("release"),
    }),
    preview,
  );
  TestValidator.equals("dry-run lifecycle", dryEvents, ["collect:false"]);

  const applyEvents: string[] = [];
  const applied = { applied: true, basis: preview.basis };
  const result = runtimeModule.runProductionRenderGarbageCollection(true, {
    acquire: () => {
      applyEvents.push("acquire");
      return "lease";
    },
    assertNoLiveWorkers: () => applyEvents.push("workers"),
    collect: (apply, expected) => {
      applyEvents.push(
        `collect:${String(apply)}:${expected === preview ? "preview" : "none"}`,
      );
      return apply ? applied : preview;
    },
    release: (failure, lease) =>
      applyEvents.push(
        `release:${lease}:${failure === undefined ? "clean" : "failed"}`,
      ),
  });
  TestValidator.equals(
    "apply is fenced by its exact preview and lease",
    { result, applyEvents },
    {
      result: applied,
      applyEvents: [
        "collect:false:none",
        "acquire",
        "workers",
        "collect:true:preview",
        "release:lease:clean",
      ],
    },
  );

  const quarantinedPointer = {
    disposition: "quarantine",
    kind: "chunk-pointer",
    path: `proxy/pointers/${"a".repeat(64)}`,
    state: "integrity-failed",
    authority: "exact-quarantine",
  };
  TestValidator.equals(
    "quarantined unresolved pointer protects matching live trees on later GC",
    {
      protected: runtimeModule.quarantinedRenderChunkPointerProtection({
        adjudication: quarantinedPointer,
        candidates: [
          {
            kind: "chunk-tree",
            path: `proxy/tmp/${"a".repeat(64)}.attempt-b`,
            digest: digest("a"),
          },
          {
            kind: "chunk-tree",
            path: `proxy/tmp/${"a".repeat(64)}.attempt-a`,
            digest: digest("a"),
          },
          {
            kind: "chunk-tree",
            path: `final/tmp/${"a".repeat(64)}.attempt-c`,
            digest: digest("a"),
          },
        ],
        retained: new Set<string>(),
      }),
      released: runtimeModule.quarantinedRenderChunkPointerProtection({
        adjudication: quarantinedPointer,
        candidates: [],
        retained: new Set<string>(),
      }),
    },
    {
      protected: {
        observation: {
          state: "observation-conflict",
          authority: "none",
          stage: "reference",
          reason:
            "a quarantined unresolved pointer still owns this digest; preserve its marker, evidence, and every matching tree for manual adjudication",
        },
        treePaths: [
          `proxy/tmp/${"a".repeat(64)}.attempt-a`,
          `proxy/tmp/${"a".repeat(64)}.attempt-b`,
        ],
      },
      released: null,
    },
  );
};
