import type { AutoMovieContentDigest } from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";
import path from "node:path";

import { loadSourceModule } from "../internal/loadSourceModule";
import { throwsError } from "../internal/predicates";
import {
  type IRenderGcCandidateFixture,
  type IRenderGcDirentFixture,
  type IRenderGcObservationFixture,
  type IRenderGcSnapshotFixture,
  renderGcDigest,
  renderGcDirent,
  renderGcHex,
  renderGcReaddir,
  renderGcSnapshot,
} from "../internal/renderGcFixtures";

interface IChunk {
  id: AutoMovieContentDigest;
  slot: string;
}

interface IReceipt {
  chunk: AutoMovieContentDigest;
  slot: string;
  version: number;
}

interface IPublication {
  pointer: IRenderGcSnapshotFixture;
  receipt: IReceipt;
  tree: IRenderGcSnapshotFixture;
}

interface IOwner {
  generation: string;
  host: string;
  pid: number;
}

interface IChunkInventoryModule {
  currentRenderChunkPublicationProtectsTree: (props: {
    candidate: IRenderGcSnapshotFixture;
    candidateName: string;
    capture: (chunk: IChunk) => IPublication | null;
    chunks: ReadonlyMap<AutoMovieContentDigest, IChunk>;
  }) => boolean;
  inventoryRenderChunkGarbage: (props: {
    assertReceipt: (chunk: IChunk, receipt: IReceipt) => void;
    chunks: ReadonlyMap<AutoMovieContentDigest, IChunk>;
    observeProcessOwner: (owner: unknown) => { state: string; owner: unknown };
    renderJobRoot: string;
    root: string;
    scope: string;
    seams: {
      assertCaptured: (snapshot: IRenderGcSnapshotFixture) => void;
      captureTarget: (base: string, target: string) => IRenderGcSnapshotFixture;
      capturePublication: (pointer: IRenderGcSnapshotFixture) => IPublication;
      filesystem: {
        existsSync: (target: string) => boolean;
        lstatSync: (target: string) => { isSymbolicLink: () => boolean };
        readdirSync: ReturnType<typeof renderGcReaddir>;
      };
    };
    tier: "final" | "proxy";
  }) => {
    entries: Array<{
      candidate: IRenderGcCandidateFixture;
      snapshot: IRenderGcSnapshotFixture | null;
    }>;
    retainedChunkPaths: string[];
  };
  renderChunkReceiptObservation: (props: {
    expected: IChunk | null;
    receipt: IReceipt;
    verified: boolean;
  }) => IRenderGcObservationFixture | null;
}

const unit = loadSourceModule<IChunkInventoryModule>(
  path.resolve(
    __dirname,
    "../../../../packages/template/scaffold/scripts/renderChunkSnapshot.ts",
  ),
);

const scope = renderGcHex("5");
const root = path.join("project");
const renderJobRoot = path.join(root, ".automovie", "render");
const temporaryRoot = path.join(renderJobRoot, "proxy", "tmp");
const generation = "00000000-0000-4000-8000-000000000000";
const ownerSuffix = (pid: number): string => `${pid}.${generation}.aG9zdA`;
const pointerName = (fill: string): string =>
  `.automovie-chunk-${scope}.proxy.${renderGcHex(fill)}.publication.json`;
const treeName = (fill: string, pid = 7): string =>
  `${renderGcHex(fill)}.attempt.${ownerSuffix(pid)}`;
const pointerPath = (fill: string): string =>
  `proxy/pointers/${renderGcHex(fill)}`;
const treePath = (fill: string, pid = 7): string =>
  `proxy/tmp/${treeName(fill, pid)}`;
const chunkOf = (fill: string): IChunk => ({
  id: renderGcDigest(fill),
  slot: `slot-${fill}`,
});
const receiptOf = (fill: string): IReceipt => ({
  chunk: renderGcDigest(fill),
  slot: `slot-${fill}`,
  version: 2,
});
const pointerSnapshot = (fill: string): IRenderGcSnapshotFixture =>
  renderGcSnapshot(root, path.join(root, pointerName(fill)), {
    bytes: 2,
    contentFingerprint: renderGcDigest("a"),
  });
const treeSnapshot = (
  fill: string,
  overrides: Partial<IRenderGcSnapshotFixture> = {},
): IRenderGcSnapshotFixture =>
  renderGcSnapshot(renderJobRoot, path.join(temporaryRoot, treeName(fill)), {
    bytes: 3,
    kind: "directory",
    ...overrides,
  });
const observation = (
  state: string,
  authority: string,
  stage: string,
  reason: string,
): IRenderGcObservationFixture => ({ state, authority, stage, reason });
const stale = observation(
  "verified-stale",
  "exact-remove",
  "currentness",
  "the readable receipt-bound chunk generation is not the current plan generation",
);
const corrupt = observation(
  "integrity-failed",
  "exact-quarantine",
  "inventory",
  "the current chunk receipt contradicts its declared frame, media, or semantic inventory",
);
const summary = (entry: {
  candidate: IRenderGcCandidateFixture;
  snapshot: IRenderGcSnapshotFixture | null;
}) => ({
  path: entry.candidate.path,
  kind: entry.candidate.kind,
  captured: entry.snapshot !== null,
  bytes: entry.candidate.bytes,
  generation: entry.candidate.generation,
  fingerprint: entry.candidate.fingerprint,
  observation: entry.candidate.observation,
});

/**
 * The chunk GC inventory classifies every pointer and temporary tree of one
 * tier into a typed finding, and retains only a pointer/tree pair whose receipt
 * verified against the current plan and whose tree recaptured exactly.
 *
 * Every filesystem read, capture, publication authentication, receipt
 * verification, owner observation, and revalidation enters through a seam, so
 * each finding is produced from a controlled input rather than a real race.
 *
 * Scenarios:
 *
 * 1. A receipt for the expected chunk that fails verification is
 *    `integrity-failed` with quarantine authority; a receipt for another
 *    generation, version, or slot is `verified-stale`; a verified matching
 *    receipt is current (no observation).
 * 2. A dead tree is protected only by an exact current pointer over that same
 *    tree; an absent pointer, a foreign receipt, or another tree releases it,
 *    and a pointer that cannot be resolved protects it until adjudication.
 * 3. Pointer classification: an uncapturable pointer is `unsafe-locator` when it
 *    is a link and `unavailable` otherwise; a pointer whose publication does
 *    not authenticate is `integrity-failed` at the receipt stage; a pointer
 *    naming a tree outside its tier's temporary root, with an unparseable tree
 *    name, or with another digest is `unsafe-locator`; every tree sharing an
 *    unresolved pointer's digest is an observation conflict.
 * 4. Pairing: a current pointer and its exact tree are both retained; a stale
 *    or corrupt pointer passes its finding to its exact tree; a current pointer
 *    whose tree could not be recaptured, recaptured differently, or was absent
 *    from the tree inventory becomes an observation conflict while the tree
 *    carries its own locator, capture, or conflict finding; a non-current
 *    pointer keeps its own finding when its tree fails.
 * 5. Ownership: an unreferenced tree whose owner is proved absent twice is
 *    reclaimable (no observation), one whose owner may still be alive is
 *    `foreign-generation`, and one that changes under the owner fence is
 *    `unavailable` instead of aborting the inventory.
 * 6. A scope that is not a SHA-256 namespace is refused, a tree directory that
 *    does not exist marks every current pointer as absent from the inventory,
 *    and an unparseable tree name is not a candidate.
 */
export const test_cli_scaffold_render_gc_chunk_inventory = (): void => {
  const chunk = chunkOf("a");
  TestValidator.equals(
    "receipt classification keeps corruption distinct from staleness",
    {
      current: unit.renderChunkReceiptObservation({
        expected: chunk,
        receipt: receiptOf("a"),
        verified: true,
      }),
      corrupt: unit.renderChunkReceiptObservation({
        expected: chunk,
        receipt: receiptOf("a"),
        verified: false,
      }),
      unexpected: unit.renderChunkReceiptObservation({
        expected: null,
        receipt: receiptOf("a"),
        verified: false,
      }),
      version: unit.renderChunkReceiptObservation({
        expected: chunk,
        receipt: { ...receiptOf("a"), version: 1 },
        verified: false,
      }),
      slot: unit.renderChunkReceiptObservation({
        expected: chunk,
        receipt: { ...receiptOf("a"), slot: "slot-old" },
        verified: false,
      }),
      chunk: unit.renderChunkReceiptObservation({
        expected: chunk,
        receipt: { ...receiptOf("a"), chunk: renderGcDigest("b") },
        verified: false,
      }),
    },
    {
      current: null,
      corrupt,
      unexpected: stale,
      version: stale,
      slot: stale,
      chunk: stale,
    },
  );

  const candidate = treeSnapshot("a");
  const chunks = new Map([[chunk.id, chunk]]);
  const protects = (
    capture: (chunk: IChunk) => IPublication | null,
    candidateName = treeName("a"),
  ): boolean =>
    unit.currentRenderChunkPublicationProtectsTree({
      candidate,
      candidateName,
      capture,
      chunks,
    });
  const publication = (tree: IRenderGcSnapshotFixture): IPublication => ({
    pointer: pointerSnapshot("a"),
    receipt: receiptOf("a"),
    tree,
  });
  TestValidator.equals(
    "only an exact resolvable current pointer protects a dead tree",
    {
      exact: protects(() => publication(candidate)),
      unparseable: protects(() => publication(candidate), "not-a-tree"),
      unplanned: protects(() => publication(candidate), treeName("b")),
      absent: protects(() => null),
      otherChunk: protects(() => ({
        ...publication(candidate),
        receipt: receiptOf("b"),
      })),
      otherSlot: protects(() => ({
        ...publication(candidate),
        receipt: { ...receiptOf("a"), slot: "slot-old" },
      })),
      otherTree: protects(() =>
        publication(treeSnapshot("a", { target: "elsewhere" })),
      ),
      otherIdentity: protects(() =>
        publication(treeSnapshot("a", { targetIdentity: "successor" })),
      ),
      unresolved: protects(() => {
        throw new Error("pointer unavailable");
      }),
    },
    {
      exact: true,
      unparseable: false,
      unplanned: false,
      absent: false,
      otherChunk: false,
      otherSlot: false,
      otherTree: false,
      otherIdentity: false,
      unresolved: true,
    },
  );

  const inventory = (fixture: {
    assertCaptured?: (snapshot: IRenderGcSnapshotFixture) => void;
    chunks?: readonly string[];
    corrupt?: readonly string[];
    lstat?: (target: string) => { isSymbolicLink: () => boolean };
    observe?: (owner: IOwner) => string;
    pointers: Record<
      string,
      | "unavailable"
      | { publication: "unavailable" | ((fill: string) => IPublication) }
    >;
    trees: readonly IRenderGcDirentFixture[] | null;
    treeCapture?: (
      fill: string,
      name: string,
    ) => IRenderGcSnapshotFixture | "unavailable";
  }) => {
    const assertCalls: string[] = [];
    const result = unit.inventoryRenderChunkGarbage({
      assertReceipt: (chunk) => {
        if (
          (fixture.corrupt ?? []).some((fill) => chunkOf(fill).id === chunk.id)
        )
          throw new Error("receipt contradicts inventory");
      },
      chunks: new Map(
        (fixture.chunks ?? []).map((fill) => [chunkOf(fill).id, chunkOf(fill)]),
      ),
      observeProcessOwner: (owner) => ({
        state: fixture.observe?.(owner as IOwner) ?? "absent",
        owner,
      }),
      renderJobRoot,
      root,
      scope,
      seams: {
        assertCaptured: (snapshot) => {
          assertCalls.push(path.basename(snapshot.target));
          fixture.assertCaptured?.(snapshot);
        },
        captureTarget: (base, target) => {
          const name = path.basename(target);
          if (base === root) {
            const fill = name.slice(
              `.automovie-chunk-${scope}.proxy.`.length,
              `.automovie-chunk-${scope}.proxy.`.length + 1,
            );
            if (fixture.pointers[fill] === "unavailable")
              throw new Error(`pointer ${fill} changed while inventoried`);
            return pointerSnapshot(fill);
          }
          const fill = name.slice(0, 1);
          const captured =
            fixture.treeCapture?.(fill, name) ?? treeSnapshot(fill);
          if (captured === "unavailable")
            throw new Error(`tree ${fill} changed while inventoried`);
          return captured;
        },
        capturePublication: (pointer) => {
          const fill = path
            .basename(pointer.target)
            .slice(
              `.automovie-chunk-${scope}.proxy.`.length,
              `.automovie-chunk-${scope}.proxy.`.length + 1,
            );
          const entry = fixture.pointers[fill];
          if (entry === "unavailable" || entry === undefined)
            throw new Error("fixture pointer is not capturable");
          if (entry.publication === "unavailable")
            throw new Error("pointer does not authenticate its tree");
          return entry.publication(fill);
        },
        filesystem: {
          existsSync: (target) =>
            target === temporaryRoot && fixture.trees !== null,
          lstatSync: (target) => {
            if (fixture.lstat === undefined)
              throw new Error(`fixture cannot lstat "${target}"`);
            return fixture.lstat(target);
          },
          readdirSync: renderGcReaddir({
            [root]: Object.keys(fixture.pointers)
              .reverse()
              .map((fill) => renderGcDirent(pointerName(fill), "file")),
            [temporaryRoot]: fixture.trees ?? null,
          }),
        },
      },
      tier: "proxy",
    });
    return {
      assertCalls,
      entries: result.entries.map(summary),
      retained: result.retainedChunkPaths,
    };
  };
  const authentic =
    (treeFill?: string, directory = temporaryRoot) =>
    (fill: string): IPublication => ({
      pointer: pointerSnapshot(fill),
      receipt: receiptOf(fill),
      tree: renderGcSnapshot(
        renderJobRoot,
        path.join(directory, treeName(treeFill ?? fill)),
        { bytes: 3, kind: "directory" },
      ),
    });
  const pointerSummary = (
    fill: string,
    observation: IRenderGcObservationFixture | null,
    captured = true,
  ) => ({
    path: pointerPath(fill),
    kind: "chunk-pointer",
    captured,
    bytes: captured ? 2 : null,
    generation: captured ? `identity:${pointerName(fill)}` : null,
    fingerprint: captured ? renderGcDigest("a") : null,
    observation,
  });
  const treeSummary = (
    fill: string,
    observation: IRenderGcObservationFixture | null,
    overrides: Partial<ReturnType<typeof summary>> = {},
  ) => ({
    path: treePath(fill),
    kind: "chunk-tree",
    captured: true,
    bytes: 3,
    generation: `identity:${treeName(fill)}`,
    fingerprint: renderGcDigest("c"),
    observation,
    ...overrides,
  });
  const uncaptured = (
    fill: string,
    observation: IRenderGcObservationFixture,
    pid = 7,
  ) => ({
    path: treePath(fill, pid),
    kind: "chunk-tree",
    captured: false,
    bytes: null,
    generation: null,
    fingerprint: null,
    observation,
  });
  const unresolvedTree = observation(
    "observation-conflict",
    "none",
    "reference",
    "an unresolved pointer shares this digest, so the tree is not proven stale",
  );

  TestValidator.equals(
    "pointer findings name the boundary that failed",
    inventory({
      pointers: {
        a: "unavailable",
        b: "unavailable",
        c: { publication: "unavailable" },
        d: {
          publication: authentic(
            undefined,
            path.join(renderJobRoot, "proxy", "elsewhere"),
          ),
        },
        e: {
          publication: (fill) => ({
            ...authentic()(fill),
            tree: renderGcSnapshot(
              renderJobRoot,
              path.join(temporaryRoot, `${renderGcHex(fill)}.attempt.bad`),
              { kind: "directory" },
            ),
          }),
        },
        f: { publication: authentic("0") },
      },
      lstat: (target) => {
        if (target.endsWith(pointerName("b"))) throw new Error("lstat failed");
        return { isSymbolicLink: () => target.endsWith(pointerName("a")) };
      },
      trees: [
        renderGcDirent(treeName("c"), "directory"),
        renderGcDirent(treeName("a"), "directory"),
      ],
    }),
    {
      assertCalls: [],
      entries: [
        pointerSummary(
          "a",
          observation(
            "unsafe-locator",
            "none",
            "locator",
            "the chunk pointer locator is a symbolic link and remains outside automatic cleanup authority",
          ),
          false,
        ),
        pointerSummary(
          "b",
          observation(
            "unavailable",
            "none",
            "capture",
            "the chunk pointer generation could not be captured consistently",
          ),
          false,
        ),
        pointerSummary(
          "c",
          observation(
            "integrity-failed",
            "exact-quarantine",
            "receipt",
            "the captured chunk pointer did not authenticate one complete receipt-bound tree",
          ),
        ),
        pointerSummary(
          "d",
          observation(
            "unsafe-locator",
            "none",
            "locator",
            "the captured chunk pointer names a tree outside its exact digest namespace",
          ),
        ),
        pointerSummary(
          "e",
          observation(
            "unsafe-locator",
            "none",
            "locator",
            "the captured chunk pointer names a tree outside its exact digest namespace",
          ),
        ),
        pointerSummary(
          "f",
          observation(
            "unsafe-locator",
            "none",
            "locator",
            "the captured chunk pointer names a tree outside its exact digest namespace",
          ),
        ),
        treeSummary("a", unresolvedTree),
        treeSummary("c", unresolvedTree),
      ],
      retained: [],
    },
  );

  const recaptureConflict = observation(
    "observation-conflict",
    "none",
    "capture",
    "the tree observed through this current pointer could not be recaptured consistently",
  );
  const differsConflict = observation(
    "observation-conflict",
    "none",
    "capture",
    "the tree observed through this current pointer differs from its recaptured generation",
  );
  const recapturedDiffers = observation(
    "observation-conflict",
    "none",
    "capture",
    "the recaptured tree differs from the generation observed through its pointer",
  );
  const unsafeTree = observation(
    "unsafe-locator",
    "none",
    "locator",
    "the chunk tree locator is not one physical directory",
  );
  const unavailableTree = observation(
    "unavailable",
    "none",
    "capture",
    "the chunk tree generation could not be captured consistently",
  );
  TestValidator.equals(
    "a pointer and its tree are retained only as one exact verified pair",
    inventory({
      chunks: ["2", "3", "4", "5", "7", "9"],
      corrupt: ["2"],
      pointers: Object.fromEntries(
        ["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((fill) => [
          fill,
          { publication: authentic() },
        ]),
      ),
      trees: [
        renderGcDirent("garbage", "directory"),
        renderGcDirent(treeName("8"), "directory"),
        renderGcDirent(treeName("7"), "directory"),
        renderGcDirent(treeName("6"), "other"),
        renderGcDirent(treeName("5"), "directory"),
        renderGcDirent(treeName("4"), "symlink"),
        renderGcDirent(treeName("3"), "directory"),
        renderGcDirent(treeName("2"), "directory"),
        renderGcDirent(treeName("1"), "directory"),
      ],
      treeCapture: (fill) =>
        fill === "4" || fill === "5" || fill === "6"
          ? "unavailable"
          : fill === "7" || fill === "8"
            ? treeSnapshot(fill, { contentFingerprint: renderGcDigest("d") })
            : treeSnapshot(fill),
    }),
    {
      assertCalls: [],
      entries: [
        pointerSummary("1", stale),
        pointerSummary("2", corrupt),
        pointerSummary("3", null),
        pointerSummary("4", recaptureConflict),
        pointerSummary("5", recaptureConflict),
        pointerSummary("6", stale),
        pointerSummary("7", differsConflict),
        pointerSummary("8", stale),
        pointerSummary(
          "9",
          observation(
            "observation-conflict",
            "none",
            "capture",
            "the tree observed through this current pointer was absent from the tree inventory",
          ),
        ),
        treeSummary("1", stale),
        treeSummary("2", corrupt),
        treeSummary("3", null),
        uncaptured("4", unsafeTree),
        uncaptured("5", unavailableTree),
        uncaptured("6", unsafeTree),
        treeSummary("7", recapturedDiffers, {
          fingerprint: renderGcDigest("d"),
        }),
        treeSummary("8", recapturedDiffers, {
          fingerprint: renderGcDigest("d"),
        }),
      ],
      retained: [pointerPath("3"), treePath("3")],
    },
  );

  TestValidator.equals(
    "an unreferenced tree is reclaimable only through two absent observations",
    inventory({
      assertCaptured: (snapshot) => {
        if (snapshot.target.endsWith(treeName("c", 9)))
          throw new Error("tree changed while its owner was observed");
      },
      observe: (owner) => (owner.pid === 8 ? "occupied-or-reused" : "absent"),
      pointers: {},
      trees: [
        renderGcDirent(treeName("a", 7), "directory"),
        renderGcDirent(treeName("b", 8), "directory"),
        renderGcDirent(treeName("c", 9), "directory"),
      ],
      treeCapture: (_fill, name) =>
        renderGcSnapshot(renderJobRoot, path.join(temporaryRoot, name), {
          bytes: 3,
          kind: "directory",
        }),
    }),
    {
      assertCalls: [treeName("a", 7), treeName("a", 7), treeName("c", 9)],
      entries: [
        treeSummary("a", null),
        treeSummary(
          "b",
          observation(
            "foreign-generation",
            "none",
            "ownership",
            "the temporary tree owner is not proved reclaimable by this process generation",
          ),
          {
            path: treePath("b", 8),
            generation: `identity:${treeName("b", 8)}`,
          },
        ),
        treeSummary(
          "c",
          observation(
            "unavailable",
            "none",
            "capture",
            "the temporary tree generation changed while its owner was observed",
          ),
          {
            path: treePath("c", 9),
            generation: `identity:${treeName("c", 9)}`,
          },
        ),
      ],
      retained: [],
    },
  );

  TestValidator.equals(
    "a missing tree directory leaves every current pointer unretained",
    inventory({
      chunks: ["d"],
      pointers: { d: { publication: authentic() } },
      trees: null,
    }),
    {
      assertCalls: [],
      entries: [
        pointerSummary(
          "d",
          observation(
            "observation-conflict",
            "none",
            "capture",
            "the tree observed through this current pointer was absent from the tree inventory",
          ),
        ),
      ],
      retained: [],
    },
  );

  TestValidator.equals(
    "a scope that is not a digest namespace is refused",
    throwsError(
      () =>
        unit.inventoryRenderChunkGarbage({
          assertReceipt: () => undefined,
          chunks: new Map(),
          observeProcessOwner: (owner) => ({ state: "absent", owner }),
          renderJobRoot,
          root,
          scope: "not-a-namespace",
          seams: {
            assertCaptured: () => undefined,
            captureTarget: () => {
              throw new Error("unreachable");
            },
            capturePublication: () => {
              throw new Error("unreachable");
            },
            filesystem: {
              existsSync: () => false,
              lstatSync: () => ({ isSymbolicLink: () => false }),
              readdirSync: renderGcReaddir({}),
            },
          },
          tier: "proxy",
        }),
      "not a SHA-256 namespace",
    ),
    true,
  );
};
