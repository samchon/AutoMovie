import {
  IAutoMovieInteractionEvent,
  IAutoMovieSequence,
  IAutoMovieShot,
} from "@automovie/interface";

/**
 * One entry's placement on the output timeline: where it starts globally, how
 * long it plays (its trim, else the whole shot), and the shot-local second its
 * playback begins at.
 *
 * @author Samchon
 */
export interface IAutoMoviePlaybackEntry {
  /** Index into `sequence.shots`. */
  entry: number;

  /** Shot id played here. */
  shot: string;

  /** Global output second this entry starts at. */
  start: number;

  /** Seconds of the shot this entry plays. */
  played: number;

  /** Shot-local second playback begins at (the trim's start, else 0). */
  offset: number;
}

/** The resolved output timeline: entry placements and the total runtime. */
export interface IAutoMoviePlaybackTimeline {
  entries: IAutoMoviePlaybackEntry[];

  /** Total output seconds (transition overlaps subtracted). */
  runtime: number;
}

/**
 * A shot-local interaction event placed on the sequence output clock.
 *
 * @author Samchon
 */
export interface IAutoMoviePlaybackEvent extends IAutoMovieInteractionEvent {
  /** Index into `sequence.shots`. */
  entry: number;

  /** Shot id that owns the source event. */
  shot: string;

  /** Original shot-local event time. */
  shotTime: number;

  /** Global output second after trims and transitions. */
  globalTime: number;
}

const indexShots = (
  shots: readonly IAutoMovieShot[],
): Map<string, { shot: IAutoMovieShot; index: number }> => {
  const byId = new Map<string, { shot: IAutoMovieShot; index: number }>();
  shots.forEach((shot, index) => {
    const existing = byId.get(shot.id);
    if (existing !== undefined)
      throw new Error(
        `shot id "${shot.id}" is duplicated at shots[${index}].id; first declared at shots[${existing.index}].id`,
      );
    byId.set(shot.id, { shot, index });
  });
  return byId;
};

/**
 * What plays at one output instant: the live entry's shot at its local time,
 * plus — inside an incoming transition — the outgoing entry's tail and the
 * incoming shot's weight ramping 0 → 1 across the transition.
 */
export interface IAutoMoviePlaybackSample {
  /** Live (incoming) shot id. */
  shot: string;

  /** Shot-local seconds into the live shot. */
  time: number;

  /** The outgoing tail being dissolved from, or null on a hard cut. */
  blend: { shot: string; time: number; alpha: number } | null;
}

/**
 * Lay the cut onto the output clock — the playback mirror of `cutSequence`'s
 * runtime arithmetic: each entry plays its trimmed span, and a transition pulls
 * its entry forward to overlap the previous tail by the transition's duration.
 * Precondition: the sequence already passed `cutSequence` (every entry
 * references a shot, every trim fits), so this resolver is total.
 */
export const sequenceTimeline = (
  sequence: IAutoMovieSequence,
  shots: IAutoMovieShot[],
): IAutoMoviePlaybackTimeline => {
  if (sequence.shots.length === 0)
    throw new Error(`sequence "${sequence.id}" must contain at least one shot`);

  const byId = indexShots(shots);
  const entries: IAutoMoviePlaybackEntry[] = [];
  let cursor = 0;
  sequence.shots.forEach((entry, i) => {
    if (i === 0 && entry.transition !== null)
      throw new Error(
        "sequence.shots[0].transition has nothing to transition from",
      );

    const found = byId.get(entry.shot);
    if (found === undefined)
      throw new Error(
        `sequence shot "${entry.shot}" at sequence.shots[${i}].shot was not provided`,
      );
    const shot = found.shot;
    const played = entry.trim?.duration ?? shot.duration;
    const start = cursor - (entry.transition?.duration ?? 0);
    entries.push({
      entry: i,
      shot: entry.shot,
      start,
      played,
      offset: entry.trim?.start ?? 0,
    });
    cursor = start + played;
  });
  return { entries, runtime: cursor };
};

/**
 * Turn one live entry into the on-screen sample: the live shot at its local
 * time, plus — inside the live entry's incoming transition — the previous
 * entry's tail as the `blend` with the incoming weight `alpha = elapsed /
 * transition`. The single place the shot/time/blend shape is built, so the
 * stateless and cursor resolvers cannot drift.
 */
const sampleAt = (
  sequence: IAutoMovieSequence,
  entries: readonly IAutoMoviePlaybackEntry[],
  live: IAutoMoviePlaybackEntry,
  seconds: number,
): IAutoMoviePlaybackSample => {
  const transition = sequence.shots[live.entry]!.transition;
  const elapsed = seconds - live.start;
  let blend: IAutoMoviePlaybackSample["blend"] = null;
  if (transition !== null && elapsed < transition.duration) {
    const outgoing = entries[live.entry - 1]!;
    blend = {
      shot: outgoing.shot,
      time: outgoing.offset + (seconds - outgoing.start),
      alpha: elapsed / transition.duration,
    };
  }
  return { shot: live.shot, time: live.offset + elapsed, blend };
};

/**
 * Resolve one instant against an already-built {@link sequenceTimeline} — the
 * single-source resolver behind {@link resolveSequencePlayback} and the render
 * plan. The last entry whose span contains the instant is live (the incoming
 * shot wins inside a transition overlap). Precondition: `seconds` lies within
 * `[0, runtime)` — the caller already framed a real output instant (the render
 * plan drives it from `frameTimes`; {@link resolveSequencePlayback} range-checks
 * first). O(entries); for a whole film use {@link playbackCursor}.
 */
export const resolveFromTimeline = (
  sequence: IAutoMovieSequence,
  timeline: IAutoMoviePlaybackTimeline,
  seconds: number,
): IAutoMoviePlaybackSample => {
  let live = timeline.entries[0]!;
  for (const entry of timeline.entries)
    if (entry.start <= seconds && seconds < entry.start + entry.played)
      live = entry;
  return sampleAt(sequence, timeline.entries, live, seconds);
};

/**
 * A forward-only playback resolver for a **monotonically non-decreasing** query
 * clock — the whole-film seam that turns the per-frame O(entries) scan into one
 * O(frames + entries) sweep (the render/caption plans call it once per frame in
 * output order). Entry starts are strictly increasing and the timeline tiles
 * `[0, runtime)` with no gaps, so the largest entry that has started by
 * `seconds` is exactly the last one containing it — the cursor only ever moves
 * forward and lands on the same live entry {@link resolveFromTimeline}'s scan
 * would, so the samples are byte-identical. Feeding it a time earlier than the
 * previous call breaks that invariant; use {@link resolveFromTimeline} for
 * random access.
 */
export const playbackCursor = (
  sequence: IAutoMovieSequence,
  timeline: IAutoMoviePlaybackTimeline,
): ((seconds: number) => IAutoMoviePlaybackSample) => {
  const entries = timeline.entries;
  let liveIdx = 0;
  return (seconds: number): IAutoMoviePlaybackSample => {
    while (
      liveIdx + 1 < entries.length &&
      entries[liveIdx + 1]!.start <= seconds
    )
      ++liveIdx;
    return sampleAt(sequence, entries, entries[liveIdx]!, seconds);
  };
};

/**
 * Resolve one output second to what is on screen: the last entry whose span
 * contains the instant is live; while the instant still sits inside that
 * entry's incoming transition, the previous entry's tail rides along as the
 * `blend` with the incoming weight `alpha = elapsed / transition`. Returns null
 * outside `[0, runtime)` — there is no frame there to draw. Builds the timeline
 * per call, for random single-instant access (interactive scrubbing); a whole
 * film drives {@link playbackCursor} off one timeline instead.
 */
export const resolveSequencePlayback = (
  sequence: IAutoMovieSequence,
  shots: IAutoMovieShot[],
  seconds: number,
): IAutoMoviePlaybackSample | null => {
  const timeline = sequenceTimeline(sequence, shots);
  if (seconds < 0 || seconds >= timeline.runtime) return null;
  return resolveFromTimeline(sequence, timeline, seconds);
};

/**
 * Place every shot interaction event onto the sequence output clock. Events
 * outside a sequence entry's trimmed source range are omitted. The range is
 * half-open (`[from, to)`) so an event sitting exactly on a contiguous trim
 * seam is emitted once — by the entry that starts there — not once per
 * neighbouring entry (#1009); it closes at `to` only when the trim ends at the
 * shot's own end, so a shot-final event is never lost. Included events keep
 * their shot-local `time` and also expose `shotTime` plus `globalTime`.
 */
export const sequenceEventTimeline = (
  sequence: IAutoMovieSequence,
  shots: IAutoMovieShot[],
): IAutoMoviePlaybackEvent[] => {
  const timeline = sequenceTimeline(sequence, shots);
  const byId = indexShots(shots);
  const events: IAutoMoviePlaybackEvent[] = [];
  for (const entry of timeline.entries) {
    const shot = byId.get(entry.shot)!.shot;
    const from = entry.offset;
    const to = entry.offset + entry.played;
    const atShotEnd = Math.abs(to - shot.duration) <= 1e-9;
    for (const event of shot.events ?? []) {
      if (event.time < from - 1e-9) continue;
      if (atShotEnd ? event.time > to + 1e-9 : event.time >= to - 1e-9)
        continue;
      events.push({
        ...event,
        entry: entry.entry,
        shot: entry.shot,
        shotTime: event.time,
        globalTime: entry.start + (event.time - entry.offset),
      });
    }
  }
  return events.sort(
    (a, b) =>
      a.globalTime - b.globalTime ||
      a.entry - b.entry ||
      a.id.localeCompare(b.id),
  );
};

/**
 * The whole film as frame sample points: `runtime × fps` output frames (the
 * same `round` policy as the render plan's `frameTimes`), each resolved to its
 * on-screen sample. This is the deterministic seam a render host drives its
 * per-frame capture from — pose the live shot's scene at `time`, blend the
 * outgoing tail when a dissolve is in flight, write the frame.
 */
export const playbackFrameSamples = (
  sequence: IAutoMovieSequence,
  shots: IAutoMovieShot[],
): IAutoMoviePlaybackSample[] => {
  if (!Number.isFinite(sequence.fps) || !(sequence.fps > 0))
    throw new Error(
      `sequence fps must be a finite number > 0, but was ${sequence.fps}`,
    );

  const timeline = sequenceTimeline(sequence, shots);
  const count = Math.round(timeline.runtime * sequence.fps);
  const cursor = playbackCursor(sequence, timeline);
  return Array.from({ length: count }, (_, i) => cursor(i / sequence.fps));
};
