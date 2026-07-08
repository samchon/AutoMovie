import { planCaptionSidecar, sliceCaptionSidecar } from "@automovie/render";
import { TestValidator } from "@nestia/e2e";

import { throwsError } from "../internal/predicates";
import { CAPTION_SEQUENCE, CAPTION_SHOTS } from "./test_render_caption_sidecar";
import { TREE_SCRIPT } from "./test_render_screenplay";

const whole = () =>
  planCaptionSidecar({
    script: TREE_SCRIPT,
    sequence: CAPTION_SEQUENCE,
    shots: CAPTION_SHOTS,
    fps: 4,
  });

/**
 * Chunk-slicing the caption track — the caption mirror of the chunk plan's
 * frame-atomic rule: entries clip to the window and re-base to chunk-local
 * indices, so every chunk render carries its own caption sidecar.
 *
 * Scenarios (whole = 10 frames: duel `[0,2)`, aftermath `[2,10)`):
 *
 * 1. A middle window `[1,5)` clips both spans and re-bases them to `[0,1)` /
 *    `[1,4)` with captions intact — the hand-math oracle.
 * 2. The full window `[0,10)` reproduces the whole sidecar exactly.
 * 3. A window past the end clamps to `frameCount` (frames re-based, count `end -
 *    frameStart`).
 * 4. A window entirely inside one span drops the other (the `start >= stop` skip).
 * 5. Non-integer / negative `frameStart` and `frameEnd <= frameStart` throw.
 */
export const test_render_caption_slice = (): void => {
  const sidecar = whole();

  const middle = sliceCaptionSidecar(sidecar, 1, 5);
  TestValidator.equals("middle window re-bases", middle, {
    target: "seq:duel",
    fps: 4,
    frameCount: 4,
    entries: [
      {
        frameStart: 0,
        frameEnd: 1,
        beat: "duel",
        caption: "two knights clash at dawn",
        slug: "EXT. CASTLE COURTYARD - DAWN",
      },
      {
        frameStart: 1,
        frameEnd: 4,
        beat: "aftermath",
        caption: null,
        slug: "EXT. CASTLE COURTYARD - DAWN",
      },
    ],
  });

  TestValidator.equals(
    "full window equals the whole",
    sliceCaptionSidecar(sidecar, 0, 10),
    sidecar,
  );

  const beyond = sliceCaptionSidecar(sidecar, 8, 99);
  TestValidator.equals("clamps to frameCount", beyond.frameCount, 2);
  TestValidator.equals(
    "clamped entries re-based",
    beyond.entries.map((e) => [e.frameStart, e.frameEnd, e.beat]),
    [[0, 2, "aftermath"]],
  );

  const inside = sliceCaptionSidecar(sidecar, 4, 8);
  TestValidator.equals(
    "window inside one span drops the other",
    inside.entries.map((e) => e.beat),
    ["aftermath"],
  );

  TestValidator.predicate(
    "non-integer frameStart throws",
    throwsError(() => sliceCaptionSidecar(sidecar, 0.5, 5), "frameStart"),
  );
  TestValidator.predicate(
    "negative frameStart throws",
    throwsError(() => sliceCaptionSidecar(sidecar, -1, 5), "frameStart"),
  );
  TestValidator.predicate(
    "inverted window throws",
    throwsError(() => sliceCaptionSidecar(sidecar, 5, 5), "frameEnd"),
  );
  TestValidator.predicate(
    "non-integer frameEnd throws",
    throwsError(() => sliceCaptionSidecar(sidecar, 1, 5.5), "frameEnd"),
  );
};
