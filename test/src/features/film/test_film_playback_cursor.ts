import {
  IAutoMoviePlaybackSample,
  cutSequence,
  playbackCursor,
  resolveFromTimeline,
  sequenceTimeline,
} from "@automovie/engine";
import { IAutoMovieSequence, IAutoMovieShot } from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { nclose } from "../internal/predicates";

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

/** Two playback samples agree on shot, local time, and blend (byte-level). */
const sameSample = (
  a: IAutoMoviePlaybackSample,
  b: IAutoMoviePlaybackSample,
): boolean => {
  if (a.shot !== b.shot) return false;
  if (!nclose(a.time, b.time)) return false;
  if (a.blend === null || b.blend === null) return a.blend === b.blend;
  return (
    a.blend.shot === b.blend.shot &&
    nclose(a.blend.time, b.blend.time) &&
    nclose(a.blend.alpha, b.blend.alpha)
  );
};

/**
 * The forward-only {@link playbackCursor} must land on exactly the live entry
 * the O(entries) {@link resolveFromTimeline} scan would, so a whole-film sweep
 * is byte-identical to the per-instant resolver: the equivalence that lets the
 * render/caption plans drop the per-frame O(frames×entries) cost to
 * O(frames+entries) without changing a single output (#686).
 *
 * The cursor advances only forward (feeding it a non-decreasing clock is its
 * precondition), so both a hand-laid transition sequence and a large-N tiling
 * are swept in monotone frame order and compared against the scan at every
 * instant, including exact entry-start instants and the middle of a
 * cross-dissolve, where the incoming shot must win in both resolvers.
 */
export const test_film_playback_cursor = (): void => {
  // Hand-laid sequence with a trim and a dissolve: entry starts 0 / 3 / 4.5,
  // runtime 7.5 (the transition overlap [4.5, 5) has entry 1 AND entry 2 live).
  const shots = [shot("shot:beat-1", 3), shot("shot:beat-2", 4)];
  const sequence: IAutoMovieSequence = {
    id: "seq",
    name: null,
    fps: 24,
    shots: [
      { shot: "shot:beat-1", trim: null, transition: null },
      {
        shot: "shot:beat-2",
        trim: { start: 0.5, duration: 2 },
        transition: null,
      },
      {
        shot: "shot:beat-1",
        trim: null,
        transition: { kind: "crossDissolve", duration: 0.5 },
      },
    ],
  };
  const timeline = sequenceTimeline(sequence, shots);
  const cursor = playbackCursor(sequence, timeline);

  // Dense monotone sweep at 240 Hz across [0, runtime): the cursor sample must
  // equal the scan sample at every instant, and the sweep must actually cross
  // the transition (a blend is produced) and every entry (all shots seen).
  const rate = 240;
  const count = Math.floor(timeline.runtime * rate);
  let sawBlend = false;
  const seen = new Set<string>();
  for (let i = 0; i < count; ++i) {
    const t = i / rate;
    const scan = resolveFromTimeline(sequence, timeline, t);
    const cur = cursor(t);
    TestValidator.predicate(
      `cursor==scan at t=${t.toFixed(4)}`,
      sameSample(cur, scan),
    );
    if (cur.blend !== null) sawBlend = true;
    seen.add(cur.shot);
  }
  TestValidator.predicate("sweep crossed a transition (blend seen)", sawBlend);
  TestValidator.equals(
    "sweep visited every distinct shot",
    [...seen].sort((a, b) => a.localeCompare(b)),
    ["shot:beat-1", "shot:beat-2"],
  );

  // Exact entry-start instants: at a start the cursor must have advanced onto
  // the new entry (incoming wins), matching the scan.
  for (const start of timeline.entries.map((e) => e.start)) {
    const freshCursor = playbackCursor(sequence, timeline);
    TestValidator.predicate(
      `cursor==scan exactly at entry start ${start}`,
      sameSample(
        freshCursor(start),
        resolveFromTimeline(sequence, timeline, start),
      ),
    );
  }

  // A FULL-overlap dissolve (`transition.duration === previousPlayed`) makes two
  // adjacent entry starts EQUAL: entry starts are non-decreasing, not strictly
  // increasing, and cutSequence allows it (only `> previousPlayed` is rejected).
  // The cursor's `start <= seconds` advance must still land on the highest such
  // index (the incoming shot), matching the scan (#1250-adjacent, the corrected
  // playbackCursor invariant).
  const overlapShots = [shot("shot:a", 1), shot("shot:b", 1)];
  const overlapSequence: IAutoMovieSequence = {
    id: "overlap",
    name: null,
    fps: 24,
    shots: [
      { shot: "shot:a", trim: null, transition: null },
      {
        shot: "shot:b",
        trim: null,
        transition: { kind: "crossDissolve", duration: 1 }, // === a's played span
      },
    ],
  };
  TestValidator.equals(
    "cutSequence accepts a full-overlap dissolve (equal adjacent starts)",
    cutSequence(
      {
        type: "write",
        sequence: { id: "overlap", name: "overlap" },
        fps: 24,
        entries: overlapSequence.shots,
        pacing: "a full cross-dissolve from a into b.",
        continuity: "b opens exactly as a ends.",
      },
      overlapShots,
    ).success,
    true,
  );
  const overlapTimeline = sequenceTimeline(overlapSequence, overlapShots);
  TestValidator.equals(
    "the full overlap makes the two entry starts equal",
    overlapTimeline.entries[0]!.start,
    overlapTimeline.entries[1]!.start,
  );
  const overlapCursor = playbackCursor(overlapSequence, overlapTimeline);
  TestValidator.predicate(
    "at the shared start the cursor lands on the incoming entry, like the scan",
    sameSample(
      overlapCursor(overlapTimeline.entries[1]!.start),
      resolveFromTimeline(
        overlapSequence,
        overlapTimeline,
        overlapTimeline.entries[1]!.start,
      ),
    ),
  );

  // Large-N tiling: 200 back-to-back 1 s shots (no trims/transitions), swept
  // per second: the cursor advances ~200 times across the run while the scan
  // re-walks all entries each call; the samples must still match at every step.
  const bigShots = Array.from({ length: 200 }, (_, i) =>
    shot(`shot:beat-${i}`, 1),
  );
  const bigSequence: IAutoMovieSequence = {
    id: "big",
    name: null,
    fps: 24,
    shots: bigShots.map((s) => ({ shot: s.id, trim: null, transition: null })),
  };
  const bigTimeline = sequenceTimeline(bigSequence, bigShots);
  TestValidator.predicate("large-N runtime", nclose(bigTimeline.runtime, 200));
  const bigCursor = playbackCursor(bigSequence, bigTimeline);
  const bigSeen = new Set<string>();
  for (let i = 0; i < 200 * 4; ++i) {
    const t = i / 4; // 4 Hz sweep, monotone
    const scan = resolveFromTimeline(bigSequence, bigTimeline, t);
    const cur = bigCursor(t);
    TestValidator.predicate(
      `large cursor==scan at t=${t}`,
      sameSample(cur, scan),
    );
    bigSeen.add(cur.shot);
  }
  TestValidator.equals("large-N visited all 200 shots", bigSeen.size, 200);
};
