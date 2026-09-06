import type { AutoMovieContentDigest } from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";
import path from "node:path";

import { loadSourceModule } from "../internal/loadSourceModule";
import { throwsError } from "../internal/predicates";
import {
  type IRenderGcSnapshotFixture,
  renderGcDigest,
  renderGcHex,
  renderGcSnapshot,
} from "../internal/renderGcFixtures";

interface IChunk {
  frames: Array<{ globalFrame: number }>;
  id: AutoMovieContentDigest;
  pass: "beauty";
  slot: string;
}

interface IPlan {
  frameFormat: { fps: number; height: number; width: number };
  tier: { kind: "final" | "proxy" };
}

interface IReceipt {
  chunk: AutoMovieContentDigest;
  encoded: { bytes: number; digest: AutoMovieContentDigest; path: string };
  frames: Array<{
    bytes: number;
    digest: AutoMovieContentDigest;
    globalFrame: number;
    height: number;
    path: string;
    width: number;
  }>;
  semanticMasks: never[];
  slot: string;
  version: 2;
}

interface ICurrent {
  encoded: Uint8Array;
  frames: never[];
  receipt: IReceipt;
}

interface IFinding {
  authority: string;
  generation: string | null;
  reason: string;
  stage: string;
  state: string;
  target: string;
}

interface IInspection {
  current: ICurrent | null;
  finding: IFinding;
  pointer: IRenderGcSnapshotFixture | null;
}

interface ILoadCurrentProps {
  assertReceipt: (receipt: IReceipt) => void;
  chunk: IChunk;
  frameFormat: IPlan["frameFormat"];
  pointer: IRenderGcSnapshotFixture;
}

interface IChunkInspectionModule {
  inspectRenderChunkPublication: (props: {
    chunk: IChunk;
    plan: IPlan;
    pointer?: IRenderGcSnapshotFixture | null;
    seams: {
      capturePointer: (chunk: IChunk) => IRenderGcSnapshotFixture | null;
      loadCurrent: (props: ILoadCurrentProps) => ICurrent | null;
      locatorState: (
        chunk: IChunk,
      ) => "absent" | "resident" | "unsafe" | "unavailable";
    };
  }) => IInspection;
  productionRenderSchedulerReceipt: (
    inspection: IInspection,
  ) => IReceipt | null;
}

const unit = loadSourceModule<IChunkInspectionModule>(
  path.resolve(
    __dirname,
    "../../../../packages/template/scaffold/scripts/renderChunkInspection.ts",
  ),
);

const chunk: IChunk = {
  frames: [{ globalFrame: 0 }],
  id: renderGcDigest("a"),
  pass: "beauty",
  slot: "beauty:0000",
};
const plan: IPlan = {
  frameFormat: { fps: 24, height: 9, width: 16 },
  tier: { kind: "proxy" },
};
const target = `proxy/pointers/${renderGcHex("a")}`;
const receipt: IReceipt = {
  chunk: chunk.id,
  encoded: { bytes: 1, digest: renderGcDigest("1"), path: "chunk.mp4" },
  frames: [
    {
      bytes: 1,
      digest: renderGcDigest("2"),
      globalFrame: 0,
      height: 9,
      path: "frames/0.png",
      width: 16,
    },
  ],
  semanticMasks: [],
  slot: chunk.slot,
  version: 2,
};
const current: ICurrent = { encoded: new Uint8Array(1), frames: [], receipt };
const pointer = renderGcSnapshot("project", path.join("project", "pointer"), {
  targetIdentity: "pointer-generation",
});
const finding = (
  state: string,
  authority: string,
  stage: string,
  reason: string,
  generation: string | null = "pointer-generation",
): IFinding => ({ authority, generation, reason, stage, state, target });

/**
 * One chunk's project-root pointer becomes a typed artifact finding that
 * status, resume, render, and finalize all read the same way, and the scheduler
 * admits only proven absence or one verified current receipt.
 *
 * Scenarios:
 *
 * 1. The scheduler returns `null` (materialize) only for `absent`, returns the
 *    verified receipt for `current`, refuses every other state with the
 *    finding's own reason, and refuses a `current` finding that carries no
 *    verified receipt.
 * 2. A pointer that cannot be captured is `unsafe-locator` when its locator is
 *    a link and `unavailable` for every other locator state.
 * 3. No pointer is `absent`; a pointer whose publication does not load is
 *    `integrity-failed` at the receipt stage.
 * 4. A receipt for another slot is `verified-stale` with exact-remove
 *    authority; a receipt for the expected chunk that fails verification is
 *    `integrity-failed` with quarantine authority, and either receipt finding
 *    takes precedence over what the media gate returned.
 * 5. A verified receipt whose bytes fail the media gate is `integrity-failed`
 *    at the media stage; a verified receipt with verified media is `current`
 *    and exposes the loaded publication.
 */
export const test_cli_scaffold_render_gc_chunk_inspection = (): void => {
  const inspection = (state: string, withCurrent: boolean): IInspection => ({
    current: withCurrent ? current : null,
    finding: finding(state, "none", "absence", `${state} reason`),
    pointer: null,
  });
  TestValidator.equals(
    "the scheduler materializes only absence and reuses only verified current evidence",
    {
      absent: unit.productionRenderSchedulerReceipt(
        inspection("absent", false),
      ),
      current: unit.productionRenderSchedulerReceipt(
        inspection("current", true),
      ),
      unverified: throwsError(
        () =>
          unit.productionRenderSchedulerReceipt(inspection("current", false)),
        `Chunk inspection of "${target}" reported a current publication without its verified receipt.`,
      ),
      refused: [
        "verified-stale",
        "integrity-failed",
        "unsafe-locator",
        "foreign-generation",
        "unavailable",
        "observation-conflict",
      ].map((state) =>
        throwsError(
          () => unit.productionRenderSchedulerReceipt(inspection(state, false)),
          `${state} reason`,
        ),
      ),
    },
    {
      absent: null,
      current: receipt,
      unverified: true,
      refused: [true, true, true, true, true, true],
    },
  );

  const inspect = (props: {
    capturePointer?: () => IRenderGcSnapshotFixture | null;
    loadCurrent?: (props: ILoadCurrentProps) => ICurrent | null;
    locatorState?: "absent" | "resident" | "unsafe" | "unavailable";
    pointer?: IRenderGcSnapshotFixture | null;
  }): IInspection =>
    unit.inspectRenderChunkPublication({
      chunk,
      plan,
      ...(props.pointer === undefined ? {} : { pointer: props.pointer }),
      seams: {
        capturePointer:
          props.capturePointer ??
          (() => {
            throw new Error("pointer changed while captured");
          }),
        loadCurrent:
          props.loadCurrent ??
          (() => {
            throw new Error("publication did not load");
          }),
        locatorState: () => props.locatorState ?? "resident",
      },
    });
  TestValidator.equals(
    "an uncapturable pointer is classified by its locator",
    {
      linked: inspect({ locatorState: "unsafe" }),
      resident: inspect({ locatorState: "resident" }),
      gone: inspect({ locatorState: "absent" }),
      unqueried: inspect({ locatorState: "unavailable" }),
    },
    {
      linked: {
        current: null,
        pointer: null,
        finding: finding(
          "unsafe-locator",
          "none",
          "locator",
          `Chunk "${chunk.slot}" pointer locator is unsafe. Preserve it and manually adjudicate the locator before retrying.`,
          null,
        ),
      },
      resident: {
        current: null,
        pointer: null,
        finding: finding(
          "unavailable",
          "none",
          "capture",
          `Chunk "${chunk.slot}" pointer could not be inspected. Preserve it and manually adjudicate availability before retrying.`,
          null,
        ),
      },
      gone: {
        current: null,
        pointer: null,
        finding: finding(
          "unavailable",
          "none",
          "capture",
          `Chunk "${chunk.slot}" pointer could not be inspected. Preserve it and manually adjudicate availability before retrying.`,
          null,
        ),
      },
      unqueried: {
        current: null,
        pointer: null,
        finding: finding(
          "unavailable",
          "none",
          "capture",
          `Chunk "${chunk.slot}" pointer could not be inspected. Preserve it and manually adjudicate availability before retrying.`,
          null,
        ),
      },
    },
  );

  TestValidator.equals(
    "absence may render and an unloadable publication is preserved",
    {
      capturedAbsent: inspect({ capturePointer: () => null }),
      givenAbsent: inspect({ pointer: null }),
      unloadable: inspect({ pointer }),
    },
    {
      capturedAbsent: {
        current: null,
        pointer: null,
        finding: finding(
          "absent",
          "none",
          "absence",
          `Chunk "${chunk.slot}" has no publication pointer and may be rendered.`,
          null,
        ),
      },
      givenAbsent: {
        current: null,
        pointer: null,
        finding: finding(
          "absent",
          "none",
          "absence",
          `Chunk "${chunk.slot}" has no publication pointer and may be rendered.`,
          null,
        ),
      },
      unloadable: {
        current: null,
        pointer,
        finding: finding(
          "integrity-failed",
          "none",
          "receipt",
          `Chunk "${chunk.slot}" publication did not authenticate a readable receipt-bound generation. Preserve it for manual adjudication.`,
        ),
      },
    },
  );

  const loading =
    (loaded: IReceipt, result: ICurrent | null) =>
    (props: ILoadCurrentProps): ICurrent | null => {
      props.assertReceipt(loaded);
      return result;
    };
  TestValidator.equals(
    "the receipt gate outranks the media gate and separates stale from corrupt",
    {
      stale: inspect({
        capturePointer: () => pointer,
        loadCurrent: loading({ ...receipt, slot: "beauty:old" }, current),
      }),
      corrupt: inspect({
        capturePointer: () => pointer,
        loadCurrent: loading({ ...receipt, frames: [] }, null),
      }),
      media: inspect({
        capturePointer: () => pointer,
        loadCurrent: loading(receipt, null),
      }),
      current: inspect({
        capturePointer: () => pointer,
        loadCurrent: loading(receipt, current),
      }),
    },
    {
      stale: {
        current: null,
        pointer,
        finding: finding(
          "verified-stale",
          "exact-remove",
          "currentness",
          `Chunk "${chunk.slot}" publication is an exact verified stale generation. Render cleanup may remove only this captured pointer.`,
        ),
      },
      corrupt: {
        current: null,
        pointer,
        finding: finding(
          "integrity-failed",
          "exact-quarantine",
          "inventory",
          `Chunk "${chunk.slot}" current receipt contradicts its declared frame, media, or semantic inventory. Quarantine its exact captured publication before rerendering.`,
        ),
      },
      media: {
        current: null,
        pointer,
        finding: finding(
          "integrity-failed",
          "exact-quarantine",
          "media",
          `Chunk "${chunk.slot}" bytes fail the declared PNG or MP4 media contract. Quarantine only this captured pointer before rerendering.`,
        ),
      },
      current: {
        current,
        pointer,
        finding: finding(
          "current",
          "none",
          "currentness",
          `Chunk "${chunk.slot}" publication is current and must be retained.`,
        ),
      },
    },
  );

  const received: ILoadCurrentProps[] = [];
  inspect({
    capturePointer: () => pointer,
    loadCurrent: (props) => {
      received.push(props);
      return current;
    },
  });
  TestValidator.equals(
    "the media gate receives the exact captured pointer, chunk, and raster",
    received.map((props) => ({
      chunk: props.chunk,
      frameFormat: props.frameFormat,
      pointer: props.pointer,
    })),
    [{ chunk, frameFormat: plan.frameFormat, pointer }],
  );
};
