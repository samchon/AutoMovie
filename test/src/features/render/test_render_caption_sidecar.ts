import { IAutoMovieSequence, IAutoMovieShot } from "@automovie/interface";
import { planCaptionSidecar, renderCaptionSidecar } from "@automovie/render";
import { TestValidator } from "@nestia/e2e";

import { throwsError } from "../internal/predicates";
import {
  TREE_SCRIPT,
  screenplayBeat,
  screenplayNode,
} from "./test_render_screenplay";

const shot = (id: string, duration: number): IAutoMovieShot => ({
  id,
  name: null,
  scene: "scene-duel",
  camera: "cam-main",
  cameraMotion: null,
  performances: [],
  objectMotions: [],
  duration,
});

/** Shot:duel trimmed to 1s, then shot:aftermath over a 0.5s dissolve. */
export const CAPTION_SHOTS = [shot("shot:duel", 2), shot("shot:aftermath", 3)];
export const CAPTION_SEQUENCE: IAutoMovieSequence = {
  id: "seq:duel",
  name: "duel",
  fps: 24,
  shots: [
    { shot: "shot:duel", trim: { start: 0.5, duration: 1 }, transition: null },
    {
      shot: "shot:aftermath",
      trim: { start: 1, duration: 2 },
      transition: { kind: "crossDissolve", duration: 0.5 },
    },
  ],
};

/**
 * The caption sidecar: the cut lands on the frame-atomic output clock, each
 * span joins its beat node's caption and enclosing scene slug, and the
 * serialization is deterministic pretty JSON.
 *
 * Scenarios (fps 4, runtime 2.5 s → 10 frames; the dissolve hands frames to the
 * incoming shot exactly as playback does — hand math):
 *
 * 1. Two spans: `[0,2)` beat "duel", `[2,10)` beat "aftermath" — the incoming shot
 *    is live from its span start (`0.5 s` → frame 2).
 * 2. The duel span carries its authored caption and the EXT slug; the aftermath
 *    beat authored no caption → `caption: null` with the slug still present
 *    (the caption-less twin).
 * 3. A treeless script (tree: null), a legacy absent-tree script, and an EMPTY
 *    tree (no root to walk) all yield spans with caption and slug `null`.
 * 4. An unprefixed shot id passes through as the beat id.
 * 5. A beat parented straight under the intent has no enclosing scene → slug null
 *    while its caption survives.
 * 6. `renderCaptionSidecar` is deterministic bytes and round-trips via JSON.parse.
 * 7. Non-finite / zero fps throw.
 */
export const test_render_caption_sidecar = (): void => {
  const sidecar = planCaptionSidecar({
    script: TREE_SCRIPT,
    sequence: CAPTION_SEQUENCE,
    shots: CAPTION_SHOTS,
    fps: 4,
  });
  TestValidator.equals("frame count 10", sidecar.frameCount, 10);
  TestValidator.equals("two spans", sidecar.entries.length, 2);
  TestValidator.equals("span 1", sidecar.entries[0], {
    frameStart: 0,
    frameEnd: 2,
    beat: "duel",
    caption: "two knights clash at dawn",
    slug: "EXT. CASTLE COURTYARD - DAWN",
  });
  TestValidator.equals("span 2 caption-less twin", sidecar.entries[1], {
    frameStart: 2,
    frameEnd: 10,
    beat: "aftermath",
    caption: null,
    slug: "EXT. CASTLE COURTYARD - DAWN",
  });

  const treeless = planCaptionSidecar({
    script: { ...TREE_SCRIPT, tree: null },
    sequence: CAPTION_SEQUENCE,
    shots: CAPTION_SHOTS,
    fps: 4,
  });
  TestValidator.equals(
    "treeless spans null caption and slug",
    treeless.entries.map((e) => [e.beat, e.caption, e.slug]),
    [
      ["duel", null, null],
      ["aftermath", null, null],
    ],
  );

  const { tree: _omitted, ...absentTree } = TREE_SCRIPT;
  void _omitted;
  const absent = planCaptionSidecar({
    script: absentTree,
    sequence: CAPTION_SEQUENCE,
    shots: CAPTION_SHOTS,
    fps: 4,
  });
  const emptyTree = planCaptionSidecar({
    script: { ...TREE_SCRIPT, tree: [] },
    sequence: CAPTION_SEQUENCE,
    shots: CAPTION_SHOTS,
    fps: 4,
  });
  TestValidator.equals(
    "an empty tree (no root to walk) captions null",
    emptyTree.entries.map((e) => [e.caption, e.slug]),
    [
      [null, null],
      [null, null],
    ],
  );

  TestValidator.equals(
    "absent tree (legacy shape) behaves as treeless",
    absent.entries.map((e) => [e.caption, e.slug]),
    [
      [null, null],
      [null, null],
    ],
  );

  const bare = planCaptionSidecar({
    script: { ...TREE_SCRIPT, tree: null },
    sequence: {
      ...CAPTION_SEQUENCE,
      shots: [{ shot: "raw-id", trim: null, transition: null }],
    },
    shots: [shot("raw-id", 1)],
    fps: 4,
  });
  TestValidator.equals(
    "unprefixed shot id is the beat id",
    bare.entries[0]!.beat,
    "raw-id",
  );

  const orphan = planCaptionSidecar({
    script: {
      ...TREE_SCRIPT,
      beats: [screenplayBeat("duel", "The duel")],
      tree: [
        screenplayNode({
          id: "root",
          parent: null,
          kind: "intent",
          payload: { logline: "l", theme: "t" },
        }),
        screenplayNode({
          id: "b1",
          parent: "root",
          kind: "beat",
          payload: {
            beat: "duel",
            direction: "d",
            dialogue: [],
            caption: "cap",
          },
        }),
      ],
    },
    sequence: {
      ...CAPTION_SEQUENCE,
      shots: [{ shot: "shot:duel", trim: null, transition: null }],
    },
    shots: [shot("shot:duel", 1)],
    fps: 4,
  });
  TestValidator.equals("no enclosing scene → slug null", orphan.entries[0], {
    frameStart: 0,
    frameEnd: 4,
    beat: "duel",
    caption: "cap",
    slug: null,
  });

  const text = renderCaptionSidecar(sidecar);
  TestValidator.equals(
    "serialization deterministic",
    renderCaptionSidecar(sidecar),
    text,
  );
  TestValidator.equals("serialization round-trips", JSON.parse(text), sidecar);

  TestValidator.predicate(
    "zero fps throws",
    throwsError(
      () =>
        planCaptionSidecar({
          script: TREE_SCRIPT,
          sequence: CAPTION_SEQUENCE,
          shots: CAPTION_SHOTS,
          fps: 0,
        }),
      "fps",
    ),
  );
  TestValidator.predicate(
    "non-finite fps throws",
    throwsError(
      () =>
        planCaptionSidecar({
          script: TREE_SCRIPT,
          sequence: CAPTION_SEQUENCE,
          shots: CAPTION_SHOTS,
          fps: Number.NaN,
        }),
      "fps",
    ),
  );
};
