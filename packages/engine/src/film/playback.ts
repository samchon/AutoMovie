import { IautomovieSequence, IautomovieShot } from "@automovie/interface";

/**
 * One entry's placement on the output timeline: where it starts globally, how
 * long it plays (its trim, else the whole shot), and the shot-local second its
 * playback begins at.
 *
 * @author Samchon
 */
export interface IautomoviePlaybackEntry {
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
export interface IautomoviePlaybackTimeline {
  entries: IautomoviePlaybackEntry[];

  /** Total output seconds (transition overlaps subtracted). */
  runtime: number;
}

/**
 * What plays at one output instant: the live entry's shot at its local time,
 * plus ??inside an incoming transition ??the outgoing entry's tail and the
 * incoming shot's weight ramping 0 ??1 across the transition.
 */
export interface IautomoviePlaybackSample {
  /** Live (incoming) shot id. */
  shot: string;

  /** Shot-local seconds into the live shot. */
  time: number;

  /** The outgoing tail being dissolved from, or null on a hard cut. */
  blend: { shot: string; time: number; alpha: number } | null;
}

/**
 * Lay the cut onto the output clock ??the playback mirror of `cutSequence`'s
 * runtime arithmetic: each entry plays its trimmed span, and a transition pulls
 * its entry forward to overlap the previous tail by the transition's duration.
 * Precondition: the sequence already passed `cutSequence` (every entry
 * references a shot, every trim fits), so this resolver is total.
 */
export const sequenceTimeline = (
  sequence: IautomovieSequence,
  shots: IautomovieShot[],
): IautomoviePlaybackTimeline => {
  const byId = new Map(shots.map((s) => [s.id, s]));
  const entries: IautomoviePlaybackEntry[] = [];
  let cursor = 0;
  sequence.shots.forEach((entry, i) => {
    const shot = byId.get(entry.shot)!;
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
 * Resolve one output second to what is on screen: the last entry whose span
 * contains the instant is live; while the instant still sits inside that
 * entry's incoming transition, the previous entry's tail rides along as the
 * `blend` with the incoming weight `alpha = elapsed / transition`. Returns null
 * outside `[0, runtime)` ??there is no frame there to draw.
 */
export const resolveSequencePlayback = (
  sequence: IautomovieSequence,
  shots: IautomovieShot[],
  seconds: number,
): IautomoviePlaybackSample | null => {
  const timeline = sequenceTimeline(sequence, shots);
  if (seconds < 0 || seconds >= timeline.runtime) return null;

  let live = timeline.entries[0]!;
  for (const entry of timeline.entries)
    if (entry.start <= seconds && seconds < entry.start + entry.played)
      live = entry;

  const transition = sequence.shots[live.entry]!.transition;
  const elapsed = seconds - live.start;
  let blend: IautomoviePlaybackSample["blend"] = null;
  if (transition !== null && elapsed < transition.duration) {
    const outgoing = timeline.entries[live.entry - 1]!;
    blend = {
      shot: outgoing.shot,
      time: outgoing.offset + (seconds - outgoing.start),
      alpha: elapsed / transition.duration,
    };
  }
  return { shot: live.shot, time: live.offset + elapsed, blend };
};

/**
 * The whole film as frame sample points: `runtime 횞 fps` output frames (the
 * same `round` policy as the render plan's `frameTimes`), each resolved to its
 * on-screen sample. This is the deterministic seam a render host drives its
 * per-frame capture from ??pose the live shot's scene at `time`, blend the
 * outgoing tail when a dissolve is in flight, write the frame.
 */
export const playbackFrameSamples = (
  sequence: IautomovieSequence,
  shots: IautomovieShot[],
): IautomoviePlaybackSample[] => {
  const { runtime } = sequenceTimeline(sequence, shots);
  const count = Math.round(runtime * sequence.fps);
  return Array.from(
    { length: count },
    (_, i) => resolveSequencePlayback(sequence, shots, i / sequence.fps)!,
  );
};
