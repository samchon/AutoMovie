import { scaffoldAssetDirectory } from "@automovie/cli";
import {
  AutoMovieContentDigest,
  IAutoMovieFilmTimeline,
} from "@automovie/interface";
import {
  IAutoMovieProductionRenderJobPlan,
  planProductionRenderJob,
  verifyProductionRenderJobPlan,
} from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";

import {
  productionDesign,
  testCaptureRuntimeIdentity,
} from "../mcp/productionFixtures";
import { namedFacts } from "../internal/predicates";

/** The byte ceiling `renderPlanSnapshot.ts` refuses a stored generation past. */
const RENDER_PLAN_MAX_BYTES = 16 * 1024 * 1024;

const FPS = 24;
const CHUNK_FRAMES = 48;
const DISSOLVE_FRAMES = 48;

/**
 * Just past the ten-minute wall: a four-video-deliverable production whose
 * per-frame plan record exceeds the stored ceiling, so the range schema is what
 * decides whether this film can describe its own render at all.
 */
const TOTAL_FRAMES = 15_000;
const CUT_FRAME = 5_000;

const digest = (digit: string): AutoMovieContentDigest =>
  `sha256:${digit.repeat(64)}`;

const timeline = (): IAutoMovieFilmTimeline => ({
  version: 1,
  compiler: "automovie.production.compiler.v5",
  inputFingerprint: digest("1"),
  sourceDigest: digest("2"),
  id: "long-film",
  fps: FPS,
  totalFrames: TOTAL_FRAMES,
  segments: [
    {
      shot: "opening",
      sourceInFrame: 0,
      sourceOutFrame: CUT_FRAME,
      startFrame: 0,
      endFrame: CUT_FRAME,
      headHandleFrames: 0,
      tailHandleFrames: DISSOLVE_FRAMES,
      transitionIn: { kind: "cut" },
      transitionOut: { kind: "dissolve", durationFrames: DISSOLVE_FRAMES },
    },
    {
      shot: "answer",
      sourceInFrame: 0,
      sourceOutFrame: TOTAL_FRAMES - CUT_FRAME + DISSOLVE_FRAMES,
      startFrame: CUT_FRAME - DISSOLVE_FRAMES,
      endFrame: TOTAL_FRAMES,
      headHandleFrames: DISSOLVE_FRAMES,
      tailHandleFrames: 0,
      transitionIn: { kind: "dissolve", durationFrames: DISSOLVE_FRAMES },
      transitionOut: { kind: "cut" },
    },
  ],
  omissions: [],
  tracks: {
    audio: [
      {
        id: "bed",
        asset: "public/audio/bed.json",
        sourceDurationFrames: TOTAL_FRAMES,
        sourceOffsetFrame: 0,
        startFrame: 0,
        durationFrames: TOTAL_FRAMES,
        gain: 0,
        fadeInFrames: 0,
        fadeOutFrames: 0,
        bus: "ambience",
      },
    ],
    captions: [],
    effects: [],
  },
});

const planInputs = () => ({
  timeline: timeline(),
  production: {
    ...productionDesign({
      id: "long-film",
      targetRuntimeSeconds: TOTAL_FRAMES / FPS,
      frameFormat: { width: 16, height: 16, fps: FPS, colorSpace: "srgb" },
    }),
    deliverables: [
      { id: "feature", kind: "feature" as const, required: true },
      {
        id: "depth-guide",
        kind: "guide-pass" as const,
        pass: "depth" as const,
        required: true,
      },
      {
        id: "normal-guide",
        kind: "guide-pass" as const,
        pass: "normal" as const,
        required: true,
      },
      {
        id: "outline-guide",
        kind: "guide-pass" as const,
        pass: "outline" as const,
        required: true,
      },
    ],
  },
  runtimeIdentity: {
    protocolVersion: "automovie.production-render-runtime.v1" as const,
    sourceDigest: digest("8"),
    capture: testCaptureRuntimeIdentity(),
    encoder: {
      package: "h264-mp4-encoder",
      version: "1.0.12",
      entryDigest: digest("3"),
      codec: "h264" as const,
      arguments: {
        quantizationParameter: 24,
        speed: 10,
        groupOfPictures: FPS,
      },
    },
  },
  sourceFingerprints: { opening: digest("6"), answer: digest("7") },
  audioAssets: [
    {
      path: "public/audio/bed.json",
      digest: digest("a"),
      durationSeconds: TOTAL_FRAMES / FPS,
      sampleRate: 48_000,
      channels: 2,
    },
  ],
});

/** Bytes the abandoned per-frame schema would have written for this plan. */
const perFrameRecordBytes = (
  plan: IAutoMovieProductionRenderJobPlan,
): number =>
  Buffer.byteLength(
    `${JSON.stringify(
      {
        generation: "00000000-0000-4000-8000-000000000000",
        plan,
        predecessor: null,
        version: 1,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );

interface IRenderPlanSnapshotFixture {
  generation: string;
  plan: IAutoMovieProductionRenderJobPlan;
}

/**
 * A render plan describes ranges, so a long film can describe its own render.
 *
 * A plan's per-chunk frames are pure derived data -- the output frame is the
 * chunk's own cursor, the timeline frame is that cursor times the tier's frame
 * step, the film second is that cursor over the frame clock, and a shot's
 * source frame advances one per output frame until the edit changes. Spelling
 * every frame out cost about 300 bytes each, once per video deliverable, so a
 * four-deliverable production ran into the stored-generation ceiling at under
 * fourteen thousand frames: about ten minutes. Storing the ranges instead ties
 * the record to how often the edit cuts, not to how long the film runs.
 *
 * Scenarios:
 *
 * 1. A plan whose per-frame record would exceed the ceiling is published rather
 *    than refused, and the stored bytes are a small fraction of it.
 * 2. The stored generation names ranges, not frames, and reads back as the
 *    exact same plan -- still verifying against the compiler inputs it was
 *    planned from, so nothing downstream can tell the schema changed.
 * 3. A plan whose frames are not that derivation is stored verbatim instead of
 *    approximated, and still reads back exactly.
 */
export const test_cli_scaffold_render_plan_ranges = async (): Promise<void> => {
  const renderPlanModule = createRequire(__filename)(
    path.join(scaffoldAssetDirectory(), "scripts", "renderPlanSnapshot.ts"),
  ) as {
    captureRenderPlan: (
      base: string,
      target: string,
    ) => IRenderPlanSnapshotFixture;
    publishRenderPlan: (props: {
      base: string;
      inputCurrent: () => Promise<void>;
      plan: IAutoMovieProductionRenderJobPlan;
      predecessor: IRenderPlanSnapshotFixture | null;
      target: string;
    }) => Promise<IRenderPlanSnapshotFixture>;
  };
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "automovie-plan-ranges-"));
  try {
    const inputs = planInputs();
    const plan = planProductionRenderJob({
      ...inputs,
      chunkFrames: CHUNK_FRAMES,
    });
    const target = path.join(base, "plan.json");
    const published = await renderPlanModule.publishRenderPlan({
      base,
      inputCurrent: async () => undefined,
      plan,
      predecessor: null,
      target,
    });
    const captured = renderPlanModule.captureRenderPlan(base, target);
    const stored = fs.readFileSync(
      path.join(`${target}.generations`, "genesis.json"),
    );
    const record = JSON.parse(stored.toString("utf8")) as {
      plan: { chunks: Array<Record<string, unknown>> };
      version: number;
    };
    const perFrame = perFrameRecordBytes(plan);
    TestValidator.equals(
      "a plan past the per-frame ceiling is published as ranges and reads back exactly",
      namedFacts([
        [
          "theFilmRunsPastTheOldTenMinuteWall",
          () => TOTAL_FRAMES / FPS / 60 > 10,
        ],
        [
          "aPerFrameRecordWouldExceedTheStoredCeiling",
          () => perFrame > RENDER_PLAN_MAX_BYTES,
        ],
        ["theStoredRecordFitsTheCeiling", () => stored.length < RENDER_PLAN_MAX_BYTES],
        [
          "theStoredRecordIsAFractionOfThePerFrameOne",
          () => stored.length * 10 < perFrame,
        ],
        ["theStoredRecordUsesTheRangeSchema", () => record.version === 2],
        [
          "theStoredChunksNameRuns",
          () => Array.isArray(record.plan.chunks[0]!.runs),
        ],
        [
          "theStoredChunksDoNotNameFrames",
          () => record.plan.chunks[0]!.frames === undefined,
        ],
        [
          "everyChunkStoresFarFewerRunsThanFrames",
          () =>
            record.plan.chunks.every(
              (chunk) => (chunk.runs as unknown[]).length <= CHUNK_FRAMES,
            ),
        ],
        [
          "theDissolveIsStoredFrameByFrame",
          () =>
            record.plan.chunks.some(
              (chunk) => (chunk.runs as unknown[]).length > 1,
            ),
        ],
        ["thePublishedGenerationIsTheHead", () => captured.generation === published.generation],
        [
          "theReadPlanIsTheExactPlannedPlan",
          () => JSON.stringify(captured.plan) === JSON.stringify(plan),
        ],
        [
          "theReadPlanStillVerifiesAgainstItsCompilerInputs",
          () => {
            verifyProductionRenderJobPlan({
              plan: captured.plan,
              ...planInputs(),
            });
            return true;
          },
        ],
      ]),
      {
        theFilmRunsPastTheOldTenMinuteWall: true,
        aPerFrameRecordWouldExceedTheStoredCeiling: true,
        theStoredRecordFitsTheCeiling: true,
        theStoredRecordIsAFractionOfThePerFrameOne: true,
        theStoredRecordUsesTheRangeSchema: true,
        theStoredChunksNameRuns: true,
        theStoredChunksDoNotNameFrames: true,
        everyChunkStoresFarFewerRunsThanFrames: true,
        theDissolveIsStoredFrameByFrame: true,
        thePublishedGenerationIsTheHead: true,
        theReadPlanIsTheExactPlannedPlan: true,
        theReadPlanStillVerifiesAgainstItsCompilerInputs: true,
      },
    );

    const foreign = fs.mkdtempSync(
      path.join(os.tmpdir(), "automovie-plan-verbatim-"),
    );
    try {
      const irregular = JSON.parse(
        JSON.stringify({
          ...plan,
          chunks: plan.chunks.slice(0, 1).map((chunk) => ({
            ...chunk,
            frameEndExclusive: chunk.frameStart + 2,
            frames: chunk.frames.slice(0, 2).map((frame) => ({
              ...frame,
              // A film second that is not this frame's own derivation is not a
              // range this codec can describe, so it must survive verbatim.
              timeSeconds: frame.timeSeconds + 1,
            })),
          })),
        }),
      ) as IAutoMovieProductionRenderJobPlan;
      const foreignTarget = path.join(foreign, "plan.json");
      await renderPlanModule.publishRenderPlan({
        base: foreign,
        inputCurrent: async () => undefined,
        plan: irregular,
        predecessor: null,
        target: foreignTarget,
      });
      const verbatim = JSON.parse(
        fs
          .readFileSync(path.join(`${foreignTarget}.generations`, "genesis.json"))
          .toString("utf8"),
      ) as { plan: { chunks: Array<Record<string, unknown>> }; version: number };
      TestValidator.equals(
        "a plan the range codec cannot describe is stored verbatim, never approximated",
        namedFacts([
          ["theStoredRecordKeepsThePerFrameSchema", () => verbatim.version === 1],
          [
            "theStoredChunksStillNameFrames",
            () => Array.isArray(verbatim.plan.chunks[0]!.frames),
          ],
          [
            "theReadPlanIsTheExactIrregularPlan",
            () =>
              JSON.stringify(
                renderPlanModule.captureRenderPlan(foreign, foreignTarget).plan,
              ) === JSON.stringify(irregular),
          ],
        ]),
        {
          theStoredRecordKeepsThePerFrameSchema: true,
          theStoredChunksStillNameFrames: true,
          theReadPlanIsTheExactIrregularPlan: true,
        },
      );
    } finally {
      fs.rmSync(foreign, { force: true, recursive: true });
    }
  } finally {
    fs.rmSync(base, { force: true, recursive: true });
  }
};
