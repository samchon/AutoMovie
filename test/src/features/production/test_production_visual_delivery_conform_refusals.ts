import type {
  AutoMovieContentDigest,
  IAutoMovieFilmTimeline,
} from "@automovie/interface";
import {
  assembleProductionChunkVideoMp4,
  conformProductionVisualDeliveryVideoMp4,
  productionVisualDeliveryOccurrence,
} from "@automovie/production";
import { TestValidator } from "@nestia/e2e";

import {
  productionH264Mp4,
  productionInterframeH264Mp4,
} from "./productionMediaFixtures";

const WIDTH = 16;
const HEIGHT = 16;
const FPS = 2;

const digest = (digit: string): AutoMovieContentDigest =>
  `sha256:${digit.repeat(64)}`;

type Lane = { lane: "deterministic" | "repainted"; bytes: Uint8Array };

const timeline = (
  counts: number[],
  totalFrames = counts.reduce((sum, count) => sum + count, 0),
): IAutoMovieFilmTimeline => {
  let startFrame = 0;
  return {
    version: 1,
    compiler: "automovie.production.compiler.v5",
    inputFingerprint: digest("1"),
    sourceDigest: digest("2"),
    id: "conform",
    fps: FPS,
    totalFrames,
    segments: counts.map((count, index) => {
      const segment = {
        shot: `shot-${index}`,
        sourceInFrame: 0,
        sourceOutFrame: count,
        startFrame,
        endFrame: startFrame + count,
        headHandleFrames: 0,
        tailHandleFrames: 0,
        transitionIn: { kind: "cut" as const },
        transitionOut: { kind: "cut" as const },
      };
      startFrame += count;
      return segment;
    }),
    omissions: [],
    tracks: { audio: [], captions: [], effects: [] },
  };
};

/** The refusal message of `task`, or null when it returned. */
const refusal = (task: () => unknown): string | null => {
  try {
    task();
    return null;
  } catch (error) {
    // The conform boundary throws nothing but Error refusals.
    return (error as Error).message;
  }
};

const conform = (film: IAutoMovieFilmTimeline, lanes: Lane[]): Uint8Array =>
  conformProductionVisualDeliveryVideoMp4({
    timeline: film,
    sources: film.segments.map((segment, index) => ({
      occurrence: productionVisualDeliveryOccurrence(segment, index),
      ...lanes[index]!,
    })),
  });

/**
 * Explicit visual-lane conform refuses every source population that is not
 * the exact current film, naming the occurrence it cannot place.
 *
 * Scenarios:
 *
 * 1. A source population that does not join the timeline occurrences one to
 *    one, a non-cut transition, and an empty timeline are refused.
 * 2. Deterministic lanes must cite one identical current feature and may only
 *    begin at a sync sample after a repainted lane; a repainted lane must
 *    supply exactly its full shot on the shared presentation contract.
 * 3. A film whose declared frame count exceeds its occurrences is refused
 *    after every occurrence was placed.
 */
export const test_production_visual_delivery_conform_refusals =
  async (): Promise<void> => {
    const encode = (frameCount: number, width = WIDTH, height = HEIGHT) =>
      productionH264Mp4({ width, height, fps: FPS, frameCount });
    const three = await encode(3);
    const two = await encode(2);
    const narrow = await encode(2, WIDTH - 8, HEIGHT - 8);
    const whole = await encode(5);
    const one = await encode(1);
    // The x264 fixture's second frame is a predicted frame, the only non-sync
    // sample any fixture carries: the resident encoder keys every frame.
    const interframe = productionInterframeH264Mp4();
    const assembled = assembleProductionChunkVideoMp4({
      chunks: [three, two],
      frameFormat: { fps: FPS, width: WIDTH, height: HEIGHT },
      totalFrames: 5,
    });
    const film = timeline([3, 2]);
    const deterministic = (bytes: Uint8Array): Lane => ({
      lane: "deterministic",
      bytes,
    });
    const repainted = (bytes: Uint8Array): Lane => ({
      lane: "repainted",
      bytes,
    });
    const dissolved: IAutoMovieFilmTimeline = {
      ...film,
      segments: film.segments.map(
        (segment, index): IAutoMovieFilmTimeline["segments"][number] =>
          index === 1
            ? {
                ...segment,
                transitionIn: { kind: "dissolve", durationFrames: 1 },
              }
            : segment,
      ),
    };
    TestValidator.equals(
      "every source population that is not the exact current film is refused",
      {
        unjoined: refusal(() =>
          conformProductionVisualDeliveryVideoMp4({
            timeline: film,
            sources: film.segments.slice(1).map((segment, index) => ({
              occurrence: productionVisualDeliveryOccurrence(segment, index),
              ...deterministic(assembled),
            })),
          }),
        ),
        dissolved: refusal(() =>
          conform(dissolved, [
            deterministic(assembled),
            deterministic(assembled),
          ]),
        ),
        empty: refusal(() => conform(timeline([]), [])),
        differingDeterministic: refusal(() =>
          conform(film, [deterministic(assembled), deterministic(whole)]),
        ),
        nonSyncCrossing: refusal(() =>
          conform(timeline([1, 1]), [
            repainted(one),
            deterministic(interframe),
          ]),
        ),
        partialShot: refusal(() =>
          conform(film, [repainted(two), deterministic(assembled)]),
        ),
        changedContract: refusal(() =>
          conform(film, [repainted(three), repainted(narrow)]),
        ),
        uncovered: refusal(() =>
          conform(timeline([3, 2], 6), [repainted(three), repainted(two)]),
        ),
      },
      {
        unjoined:
          "Visual delivery sources must exactly join the current timeline occurrences.",
        dissolved:
          "Mixed visual delivery currently requires cut-only editing at occurrence 1.",
        empty: "Mixed visual delivery requires a non-empty timeline.",
        differingDeterministic:
          "Every deterministic lane must cite the same exact current feature source.",
        nonSyncCrossing:
          "Deterministic occurrence 1 cannot begin losslessly at its declared lane crossing.",
        partialShot:
          "Repaint occurrence 0 must supply the exact full-shot clip.",
        changedContract:
          "Visual delivery occurrence 1 changes the exact video presentation contract.",
        uncovered: "Visual delivery sources do not cover the current film.",
      },
    );
  };
