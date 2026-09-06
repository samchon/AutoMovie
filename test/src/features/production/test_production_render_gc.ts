import type { AutoMovieContentDigest } from "@automovie/interface";
import {
  type IAutoMovieProductionRenderGcCandidate,
  type IAutoMovieProductionRenderJobPlan,
  planProductionRenderGc,
  productionRenderMaterializationDecision,
} from "@automovie/production";
import { TestValidator } from "@nestia/e2e";

import { namedFacts, throwsError } from "../internal/predicates";

const digest = (fill: string): AutoMovieContentDigest =>
  `sha256:${fill.repeat(64).slice(0, 64)}`;

const renderPlan = (
  kind: "proxy" | "final",
  ids: readonly AutoMovieContentDigest[],
): IAutoMovieProductionRenderJobPlan =>
  ({
    tier: { kind },
    chunks: ids.map((id) => ({ id })),
  }) as IAutoMovieProductionRenderJobPlan;

const candidate = (
  overrides: Partial<IAutoMovieProductionRenderGcCandidate> = {},
): IAutoMovieProductionRenderGcCandidate => ({
  path: `proxy/chunks/${"a".repeat(64)}`,
  kind: "chunk",
  digest: digest("a"),
  bytes: 1,
  generation: "generation-a",
  fingerprint: digest("f"),
  observation: null,
  ...overrides,
});

const plan = (
  overrides: {
    plans?: readonly IAutoMovieProductionRenderJobPlan[];
    publicationPaths?: readonly string[];
    retainedChunkPaths?: readonly string[];
    retainedCachePaths?: readonly string[];
    candidates?: readonly IAutoMovieProductionRenderGcCandidate[];
  } = {},
) =>
  planProductionRenderGc({
    plans: overrides.plans ?? [renderPlan("proxy", [digest("a")])],
    publicationPaths: overrides.publicationPaths ?? [],
    retainedChunkPaths: overrides.retainedChunkPaths ?? [],
    retainedCachePaths: overrides.retainedCachePaths ?? [],
    candidates: overrides.candidates ?? [],
  });

/**
 * Render GC keeps only authenticated current generations and refuses every
 * ambiguous ownership fact before a host may remove physical bytes.
 *
 * Scenarios:
 *
 * 1. Current chunks, their exact pointer/tree pair, current v5 dialogue/model
 *    generations, and manifest files are kept while stale cache, quarantine,
 *    final-tier chunk, and publication generations are sorted for removal.
 * 2. Absent/current, verified-stale, integrity-failed, unsafe, foreign,
 *    unavailable, and conflicting observations enter exactly one reasoned set.
 * 3. Duplicate, non-canonical, wrong-kind, wrong-digest, malformed finding,
 *    missing retained, unpaired, and inactive facts refuse deterministically.
 * 4. The reclaim sum accepts the largest safe integer and refuses overflow.
 */
export const test_production_render_gc = (): void => {
  const active = digest("a");
  const pointer = `proxy/pointers/${"a".repeat(64)}`;
  const tree = `proxy/tmp/${"a".repeat(64)}.attempt.7.00000000-0000-4000-8000-000000000000.aG9zdA`;
  const currentDialogue = `audio-cache/kokoro/${"b".repeat(64)}`;
  const currentModel = "model-cache/kokoro/current-revision";
  const candidates: IAutoMovieProductionRenderGcCandidate[] = [
    candidate({
      path: "publication/old.mp4",
      kind: "publication",
      digest: null,
      bytes: 13,
    }),
    candidate({
      path: currentDialogue,
      kind: "dialogue-cache",
      digest: digest("b"),
      bytes: 5,
    }),
    candidate({
      path: pointer,
      kind: "chunk-pointer",
      digest: active,
      bytes: 2,
    }),
    candidate(),
    candidate({
      path: tree,
      kind: "chunk-tree",
      digest: active,
      bytes: 3,
    }),
    candidate({
      path: "publication/current.mp4",
      kind: "publication",
      digest: null,
      bytes: 11,
    }),
    candidate({
      path: currentModel,
      kind: "model-cache",
      digest: digest("c"),
      bytes: 7,
    }),
    candidate({
      path: `audio-cache/kokoro/${"d".repeat(64)}`,
      kind: "dialogue-cache",
      digest: digest("d"),
      bytes: 17,
    }),
    candidate({
      path: "proxy/quarantine/failed-owner",
      kind: "quarantine",
      digest: null,
      bytes: 19,
    }),
    candidate({
      path: `final/chunks/${"e".repeat(64)}`,
      kind: "chunk",
      digest: digest("e"),
      bytes: 23,
    }),
  ];
  const classified = plan({
    plans: [renderPlan("proxy", [active]), renderPlan("final", [])],
    publicationPaths: ["publication/current.mp4"],
    retainedChunkPaths: [tree, pointer],
    retainedCachePaths: [currentModel, currentDialogue],
    candidates,
  });
  TestValidator.equals(
    "the exact current generation is kept and the stale population is payable",
    {
      version: classified.version,
      retain: classified.retain.map((entry) => entry.candidate.path),
      remove: classified.remove.map((entry) => entry.candidate.path),
      quarantine: classified.quarantine.map((entry) => entry.candidate.path),
      manualAdjudication: classified.manualAdjudication.map(
        (entry) => entry.candidate.path,
      ),
      reclaimableBytes: classified.reclaimableBytes,
    },
    {
      version: 4,
      retain: [
        currentDialogue,
        currentModel,
        `proxy/chunks/${"a".repeat(64)}`,
        pointer,
        tree,
        "publication/current.mp4",
      ],
      remove: [
        `audio-cache/kokoro/${"d".repeat(64)}`,
        `final/chunks/${"e".repeat(64)}`,
        "proxy/quarantine/failed-owner",
        "publication/old.mp4",
      ],
      quarantine: [],
      manualAdjudication: [],
      reclaimableBytes: 72,
    },
  );
  const classifiedDecisions = [
    ...classified.retain.map((decision) => ({
      disposition: "retain" as const,
      decision,
    })),
    ...classified.remove.map((decision) => ({
      disposition: "remove" as const,
      decision,
    })),
    ...classified.quarantine.map((decision) => ({
      disposition: "quarantine" as const,
      decision,
    })),
    ...classified.manualAdjudication.map((decision) => ({
      disposition: "manual-adjudication" as const,
      decision,
    })),
  ];
  TestValidator.predicate(
    "every decision receipt is bound to the complete deterministic plan basis",
    /^sha256:[0-9a-f]{64}$/u.test(classified.basis) &&
      classifiedDecisions.every(({ disposition, decision }) => {
        const receipt = decision.receipt;
        return (
          receipt.version === 1 &&
          receipt.basis === classified.basis &&
          receipt.disposition === disposition &&
          receipt.kind === decision.candidate.kind &&
          receipt.path === decision.candidate.path &&
          receipt.generation === decision.candidate.generation &&
          receipt.fingerprint === decision.candidate.fingerprint &&
          receipt.state === decision.state &&
          receipt.authority === decision.authority &&
          receipt.stage === decision.stage &&
          receipt.reason === decision.reason
        );
      }),
  );
  const reordered = plan({
    plans: [renderPlan("final", []), renderPlan("proxy", [active])],
    publicationPaths: ["publication/current.mp4"],
    retainedChunkPaths: [pointer, tree],
    retainedCachePaths: [currentDialogue, currentModel],
    candidates: [...candidates].reverse(),
  });
  TestValidator.equals(
    "equivalent input order retains one dry-run basis",
    reordered.basis,
    classified.basis,
  );

  const observed = (
    path: string,
    state: NonNullable<
      IAutoMovieProductionRenderGcCandidate["observation"]
    >["state"],
    authority: NonNullable<
      IAutoMovieProductionRenderGcCandidate["observation"]
    >["authority"],
    overrides: Partial<IAutoMovieProductionRenderGcCandidate> = {},
    stage: NonNullable<
      IAutoMovieProductionRenderGcCandidate["observation"]
    >["stage"] = "currentness",
  ): IAutoMovieProductionRenderGcCandidate =>
    candidate({
      path,
      kind: "publication",
      digest: null,
      observation: {
        state,
        authority,
        stage,
        reason: `${state} reason`,
      },
      ...overrides,
    });
  const disposition = (
    entry: IAutoMovieProductionRenderGcCandidate,
    publicationPaths: string[] = [],
  ): string => {
    const result = plan({
      plans: [],
      publicationPaths,
      candidates: [entry],
    });
    return (
      [
        ["retain", result.retain],
        ["remove", result.remove],
        ["quarantine", result.quarantine],
        ["manual-adjudication", result.manualAdjudication],
      ] as const
    ).find(([, set]) => set.length === 1)![0];
  };
  TestValidator.equals(
    "every render-artifact state has one fail-closed cleanup disposition",
    {
      current: disposition(observed("publication/current", "current", "none"), [
        "publication/current",
      ]),
      currentWithoutReference: disposition(
        observed("publication/unreferenced-current", "current", "none"),
      ),
      absent: disposition(
        observed("publication/absent", "absent", "none", {
          bytes: null,
          generation: null,
        }),
      ),
      stale: disposition(
        observed("publication/stale", "verified-stale", "exact-remove"),
      ),
      staleWithoutGeneration: disposition(
        observed(
          "publication/stale-unproved",
          "verified-stale",
          "exact-remove",
          { generation: null },
        ),
      ),
      staleWithoutFingerprint: disposition(
        observed(
          "publication/stale-unfingerprinted",
          "verified-stale",
          "exact-remove",
          { fingerprint: null },
        ),
      ),
      staleWithoutAuthority: disposition(
        observed("publication/stale-unowned", "verified-stale", "none"),
      ),
      integrity: disposition(
        observed(
          "publication/integrity",
          "integrity-failed",
          "exact-quarantine",
        ),
      ),
      integrityWithoutGeneration: disposition(
        observed(
          "publication/integrity-unproved",
          "integrity-failed",
          "exact-quarantine",
          { bytes: null },
        ),
      ),
      unsafe: disposition(
        observed("publication/unsafe", "unsafe-locator", "none"),
      ),
      foreign: disposition(
        observed("publication/foreign", "foreign-generation", "none"),
      ),
      unavailable: disposition(
        observed("publication/unavailable", "unavailable", "none", {
          bytes: null,
          generation: null,
        }),
      ),
      conflict: disposition(
        observed("publication/conflict", "observation-conflict", "none"),
      ),
    },
    {
      current: "retain",
      currentWithoutReference: "manual-adjudication",
      absent: "retain",
      stale: "remove",
      staleWithoutGeneration: "manual-adjudication",
      staleWithoutFingerprint: "manual-adjudication",
      staleWithoutAuthority: "manual-adjudication",
      integrity: "quarantine",
      integrityWithoutGeneration: "manual-adjudication",
      unsafe: "manual-adjudication",
      foreign: "manual-adjudication",
      unavailable: "manual-adjudication",
      conflict: "manual-adjudication",
    },
  );
  TestValidator.equals(
    "only absence may materialize and only current evidence may be reused",
    [
      "absent",
      "current",
      "verified-stale",
      "integrity-failed",
      "unsafe-locator",
      "foreign-generation",
      "unavailable",
      "observation-conflict",
    ].map((state) =>
      productionRenderMaterializationDecision(
        state as NonNullable<
          IAutoMovieProductionRenderGcCandidate["observation"]
        >["state"],
      ),
    ),
    [
      "render",
      "reuse",
      "refuse",
      "refuse",
      "refuse",
      "refuse",
      "refuse",
      "refuse",
    ],
  );
  const stages = [
    "absence",
    "locator",
    "capture",
    "receipt",
    "inventory",
    "media",
    "currentness",
    "ownership",
    "reference",
  ] as const;
  TestValidator.equals(
    "every typed failure stage survives one reasoned cleanup decision",
    stages.map((stage) =>
      disposition(
        observed(`publication/stage-${stage}`, "current", "none", {}, stage),
        [`publication/stage-${stage}`],
      ),
    ),
    stages.map(() => "retain"),
  );
  TestValidator.equals(
    "an unknown artifact state is refused before an adapter can run",
    throwsError(
      () => productionRenderMaterializationDecision("unknown" as "absent"),
      "is invalid",
    ),
    true,
  );

  const invalidCandidate = (
    overrides: Partial<IAutoMovieProductionRenderGcCandidate>,
  ): boolean =>
    throwsError(
      () => plan({ candidates: [candidate(overrides)] }),
      "duplicate or invalid ownership facts",
    );
  const pathFailure = (value: string): boolean =>
    throwsError(
      () =>
        plan({
          publicationPaths: [value],
          candidates: [],
        }),
      "canonical relative POSIX path",
    );
  TestValidator.equals(
    "ambiguous candidate ownership and non-canonical paths are all refused",
    namedFacts([
      [
        "duplicate candidate",
        () =>
          throwsError(
            () => plan({ candidates: [candidate(), candidate()] }),
            "duplicate or invalid ownership facts",
          ),
      ],
      ["fractional bytes", () => invalidCandidate({ bytes: 0.5 })],
      ["negative bytes", () => invalidCandidate({ bytes: -1 })],
      ["blank generation", () => invalidCandidate({ generation: " " })],
      ["unsafe generation", () => invalidCandidate({ generation: "a\n" })],
      [
        "malformed fingerprint",
        () => invalidCandidate({ fingerprint: "sha256:x" }),
      ],
      [
        "unknown observation",
        () =>
          invalidCandidate({
            observation: {
              state: "unknown" as "current",
              authority: "none",
              stage: "currentness",
              reason: "unknown",
            },
          }),
      ],
      [
        "unknown authority",
        () =>
          invalidCandidate({
            observation: {
              state: "current",
              authority: "delete" as "none",
              stage: "currentness",
              reason: "bad authority",
            },
          }),
      ],
      [
        "unknown stage",
        () =>
          invalidCandidate({
            observation: {
              state: "current",
              authority: "none",
              stage: "unknown" as "currentness",
              reason: "bad stage",
            },
          }),
      ],
      [
        "empty observation reason",
        () =>
          invalidCandidate({
            observation: {
              state: "current",
              authority: "none",
              stage: "currentness",
              reason: "",
            },
          }),
      ],
      [
        "unsafe observation reason",
        () =>
          invalidCandidate({
            observation: {
              state: "current",
              authority: "none",
              stage: "currentness",
              reason: "unsafe\nreason",
            },
          }),
      ],
      ["chunk null digest", () => invalidCandidate({ digest: null })],
      [
        "chunk malformed digest",
        () => invalidCandidate({ digest: "sha256:x" }),
      ],
      [
        "chunk mismatched digest",
        () => invalidCandidate({ digest: digest("b") }),
      ],
      ["chunk wrong path", () => invalidCandidate({ path: "proxy/chunks/x" })],
      [
        "pointer wrong path",
        () =>
          invalidCandidate({
            path: "proxy/pointers/x",
            kind: "chunk-pointer",
          }),
      ],
      [
        "tree wrong path",
        () =>
          invalidCandidate({
            path: "proxy/tmp/x",
            kind: "chunk-tree",
          }),
      ],
      [
        "quarantine wrong path",
        () =>
          invalidCandidate({
            path: "quarantine/x",
            kind: "quarantine",
            digest: null,
          }),
      ],
      [
        "publication wrong path",
        () =>
          invalidCandidate({
            path: "deliverables/x",
            kind: "publication",
            digest: null,
          }),
      ],
      [
        "dialogue cache wrong path",
        () =>
          invalidCandidate({
            path: "audio-cache/kokoro/a/b",
            kind: "dialogue-cache",
            digest: digest("b"),
          }),
      ],
      [
        "dialogue cache null digest",
        () =>
          invalidCandidate({
            path: "audio-cache/kokoro/a",
            kind: "dialogue-cache",
            digest: null,
          }),
      ],
      [
        "model cache malformed digest",
        () =>
          invalidCandidate({
            path: "model-cache/kokoro/revision",
            kind: "model-cache",
            digest: "sha256:x",
          }),
      ],
      [
        "publication owns no digest",
        () =>
          invalidCandidate({
            path: "publication/x",
            kind: "publication",
            digest: digest("a"),
          }),
      ],
      ["empty path", () => pathFailure("")],
      ["backslash path", () => pathFailure("publication\\x")],
      ["absolute path", () => pathFailure("/publication/x")],
      ["drive path", () => pathFailure("C:/publication/x")],
      ["empty segment", () => pathFailure("publication//x")],
      ["dot segment", () => pathFailure("publication/./x")],
      ["parent segment", () => pathFailure("publication/../x")],
    ]),
    {
      "duplicate candidate": true,
      "fractional bytes": true,
      "negative bytes": true,
      "blank generation": true,
      "unsafe generation": true,
      "malformed fingerprint": true,
      "unknown observation": true,
      "unknown authority": true,
      "unknown stage": true,
      "empty observation reason": true,
      "unsafe observation reason": true,
      "chunk null digest": true,
      "chunk malformed digest": true,
      "chunk mismatched digest": true,
      "chunk wrong path": true,
      "pointer wrong path": true,
      "tree wrong path": true,
      "quarantine wrong path": true,
      "publication wrong path": true,
      "dialogue cache wrong path": true,
      "dialogue cache null digest": true,
      "model cache malformed digest": true,
      "publication owns no digest": true,
      "empty path": true,
      "backslash path": true,
      "absolute path": true,
      "drive path": true,
      "empty segment": true,
      "dot segment": true,
      "parent segment": true,
    },
  );

  const pairCandidates = [
    candidate(),
    candidate({ path: pointer, kind: "chunk-pointer", bytes: 2 }),
    candidate({ path: tree, kind: "chunk-tree", bytes: 3 }),
  ];
  TestValidator.equals(
    "retained facts must resolve to one active exact candidate generation",
    namedFacts([
      [
        "duplicate retained chunk",
        () =>
          throwsError(
            () =>
              plan({
                retainedChunkPaths: [pointer, pointer],
                candidates: pairCandidates,
              }),
            "duplicate",
          ),
      ],
      [
        "duplicate retained cache",
        () =>
          throwsError(
            () =>
              plan({
                retainedCachePaths: [currentDialogue, currentDialogue],
                candidates,
              }),
            "duplicate",
          ),
      ],
      [
        "missing retained chunk",
        () =>
          throwsError(
            () => plan({ retainedChunkPaths: [pointer], candidates: [] }),
            "no exact pointer/tree candidate",
          ),
      ],
      [
        "missing retained cache",
        () =>
          throwsError(
            () =>
              plan({
                retainedCachePaths: [currentDialogue],
                candidates: [],
              }),
            "no exact cache candidate",
          ),
      ],
      [
        "pointer without tree",
        () =>
          throwsError(
            () =>
              plan({
                retainedChunkPaths: [pointer],
                candidates: pairCandidates,
              }),
            "not one exact current pointer/tree pair",
          ),
      ],
      [
        "tree without pointer",
        () =>
          throwsError(
            () =>
              plan({
                retainedChunkPaths: [tree],
                candidates: pairCandidates,
              }),
            "not one exact current pointer/tree pair",
          ),
      ],
      [
        "pair without active chunk",
        () =>
          throwsError(
            () =>
              plan({
                plans: [],
                retainedChunkPaths: [pointer, tree],
                candidates: pairCandidates,
              }),
            "not one exact current pointer/tree pair",
          ),
      ],
    ]),
    {
      "duplicate retained chunk": true,
      "duplicate retained cache": true,
      "missing retained chunk": true,
      "missing retained cache": true,
      "pointer without tree": true,
      "tree without pointer": true,
      "pair without active chunk": true,
    },
  );

  const maximum = plan({
    candidates: [
      candidate({
        path: "publication/max",
        kind: "publication",
        digest: null,
        bytes: Number.MAX_SAFE_INTEGER,
      }),
    ],
  });
  TestValidator.equals(
    "one maximum safe removal total remains exact",
    maximum.reclaimableBytes,
    Number.MAX_SAFE_INTEGER,
  );
  TestValidator.equals(
    "an unsafe aggregate removal total is refused",
    throwsError(
      () =>
        plan({
          candidates: [
            candidate({
              path: "publication/max",
              kind: "publication",
              digest: null,
              bytes: Number.MAX_SAFE_INTEGER,
            }),
            candidate({
              path: "publication/one",
              kind: "publication",
              digest: null,
              bytes: 1,
            }),
          ],
        }),
      "exceeds safe integer range",
    ),
    true,
  );
};
