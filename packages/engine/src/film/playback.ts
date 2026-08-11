import {
  IAutoMovieInteractionEvent,
  IAutoMovieSequence,
  IAutoMovieShot,
} from "@automovie/interface";

import { compareCodeUnits } from "../text/compareCodeUnits";

/**
 * One entry's placement on the output timeline: where it starts globally, how
 * long it plays (its trim, else the whole shot), and the shot-local second its
 * playback begins at.
 *
 * @evidence requirements/editorial/tracks-stacks-and-composition.md#editorial-sequential-tracks IAutoMoviePlaybackEntry supports ordered output-track composition: One entry's placement on the output timeline: where it starts globally, how long it plays (its trim, else the whole shot), and the shot-local second its playback begins at.
 * @evidence specifications/editorial-render-and-delivery/rational-timeline-and-composition.md#spec-editorial-track-composition IAutoMoviePlaybackEntry realizes ordered output-track composition: One entry's placement on the output timeline: where it starts globally, how long it plays (its trim, else the whole shot), and the shot-local second its playback begins at.
 *
 * @author Samchon
 */
export interface IAutoMoviePlaybackEntry {
  /**
   * Index into `sequence.shots`.
   *
   * @evidence requirements/editorial/tracks-stacks-and-composition.md#editorial-sequential-tracks Identifies which ordered sequence entry owns this playback placement on the composed output track.
   * @evidence specifications/editorial-render-and-delivery/rational-timeline-and-composition.md#spec-editorial-track-composition IAutoMoviePlaybackEntry.entry binds a timeline placement to its ordered sequence entry.
   */
  entry: number;

  /**
   * Shot id played here.
   *
   * @evidence requirements/editorial/tracks-stacks-and-composition.md#editorial-sequential-tracks IAutoMoviePlaybackEntry.shot supports ordered output-track composition: Shot id played here.
   * @evidence specifications/editorial-render-and-delivery/rational-timeline-and-composition.md#spec-editorial-track-composition IAutoMoviePlaybackEntry.shot realizes ordered output-track composition: Shot id played here.
   */
  shot: string;

  /**
   * Global output second this entry starts at.
   *
   * @evidence requirements/editorial/rational-time-and-ranges.md#editorial-canonical-time IAutoMoviePlaybackEntry.start anchors canonical film-clock computation: Global output second this entry starts at.
   * @evidence specifications/editorial-render-and-delivery/rational-timeline-and-composition.md#spec-editorial-rational-timeline IAutoMoviePlaybackEntry.start realizes rational global-timeline evaluation: Global output second this entry starts at.
   */
  start: number;

  /**
   * Seconds of the shot this entry plays.
   *
   * @evidence requirements/editorial/rational-time-and-ranges.md#editorial-canonical-time IAutoMoviePlaybackEntry.played anchors canonical film-clock computation: Seconds of the shot this entry plays.
   * @evidence specifications/editorial-render-and-delivery/rational-timeline-and-composition.md#spec-editorial-rational-timeline IAutoMoviePlaybackEntry.played realizes rational global-timeline evaluation: Seconds of the shot this entry plays.
   */
  played: number;

  /**
   * Shot-local second playback begins at (the trim's start, else 0).
   *
   * @evidence requirements/editorial/rational-time-and-ranges.md#editorial-canonical-time IAutoMoviePlaybackEntry.offset anchors canonical film-clock computation: Shot-local second playback begins at (the trim's start, else 0).
   * @evidence specifications/editorial-render-and-delivery/rational-timeline-and-composition.md#spec-editorial-rational-timeline IAutoMoviePlaybackEntry.offset realizes rational global-timeline evaluation: Shot-local second playback begins at (the trim's start, else 0).
   */
  offset: number;
}

/**
 * The resolved output timeline: entry placements and the total runtime.
 *
 * @evidence requirements/editorial/rational-time-and-ranges.md#editorial-canonical-time IAutoMoviePlaybackTimeline anchors canonical film-clock computation: The resolved output timeline: entry placements and the total runtime.
 * @evidence specifications/editorial-render-and-delivery/rational-timeline-and-composition.md#spec-editorial-rational-timeline IAutoMoviePlaybackTimeline realizes rational global-timeline evaluation: The resolved output timeline: entry placements and the total runtime.
 */
export interface IAutoMoviePlaybackTimeline {
  /**
   * Sequence entries placed on the global output clock.
   *
   * @evidence requirements/editorial/rational-time-and-ranges.md#editorial-canonical-time IAutoMoviePlaybackTimeline.entries anchors canonical film-clock computation: Sequence entries placed on the global output clock.
   * @evidence specifications/editorial-render-and-delivery/rational-timeline-and-composition.md#spec-editorial-rational-timeline IAutoMoviePlaybackTimeline.entries realizes rational global-timeline evaluation: Sequence entries placed on the global output clock.
   */
  entries: IAutoMoviePlaybackEntry[];

  /**
   * Total output seconds (transition overlaps subtracted).
   *
   * @evidence requirements/editorial/rational-time-and-ranges.md#editorial-canonical-time IAutoMoviePlaybackTimeline.runtime anchors canonical film-clock computation: Total output seconds (transition overlaps subtracted).
   * @evidence specifications/editorial-render-and-delivery/rational-timeline-and-composition.md#spec-editorial-rational-timeline IAutoMoviePlaybackTimeline.runtime realizes rational global-timeline evaluation: Total output seconds (transition overlaps subtracted).
   */
  runtime: number;
}

/**
 * A shot-local interaction event placed on the sequence output clock.
 *
 * @evidence requirements/editorial/rational-time-and-ranges.md#editorial-canonical-time IAutoMoviePlaybackEvent anchors canonical film-clock computation: A shot-local interaction event placed on the sequence output clock.
 * @evidence specifications/editorial-render-and-delivery/rational-timeline-and-composition.md#spec-editorial-rational-timeline IAutoMoviePlaybackEvent realizes rational global-timeline evaluation: A shot-local interaction event placed on the sequence output clock.
 *
 * @author Samchon
 */
export interface IAutoMoviePlaybackEvent extends IAutoMovieInteractionEvent {
  /**
   * Index into `sequence.shots`.
   *
   * @evidence requirements/editorial/tracks-stacks-and-composition.md#editorial-sequential-tracks Retains the owning sequence-entry index when a shot-local event is projected onto the output track.
   * @evidence specifications/editorial-render-and-delivery/rational-timeline-and-composition.md#spec-editorial-track-composition IAutoMoviePlaybackEvent.entry retains the sequence occurrence that projected the event onto output time.
   */
  entry: number;

  /**
   * Shot id that owns the source event.
   *
   * @evidence requirements/editorial/tracks-stacks-and-composition.md#editorial-sequential-tracks IAutoMoviePlaybackEvent.shot supports ordered output-track composition: Shot id that owns the source event.
   * @evidence specifications/editorial-render-and-delivery/rational-timeline-and-composition.md#spec-editorial-track-composition IAutoMoviePlaybackEvent.shot realizes ordered output-track composition: Shot id that owns the source event.
   */
  shot: string;

  /**
   * Original shot-local event time.
   *
   * @evidence requirements/editorial/rational-time-and-ranges.md#editorial-canonical-time IAutoMoviePlaybackEvent.shotTime anchors canonical film-clock computation: Original shot-local event time.
   * @evidence specifications/editorial-render-and-delivery/rational-timeline-and-composition.md#spec-editorial-rational-timeline IAutoMoviePlaybackEvent.shotTime realizes rational global-timeline evaluation: Original shot-local event time.
   */
  shotTime: number;

  /**
   * Global output second after trims and transitions.
   *
   * @evidence requirements/editorial/rational-time-and-ranges.md#editorial-canonical-time IAutoMoviePlaybackEvent.globalTime anchors canonical film-clock computation: Global output second after trims and transitions.
   * @evidence specifications/editorial-render-and-delivery/rational-timeline-and-composition.md#spec-editorial-rational-timeline IAutoMoviePlaybackEvent.globalTime realizes rational global-timeline evaluation: Global output second after trims and transitions.
   */
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
 * plus, inside an incoming transition, the outgoing entry's tail and the
 * incoming shot's weight ramping 0 → 1 across the transition.
 *
 * @evidence requirements/editorial/rational-time-and-ranges.md#editorial-canonical-time IAutoMoviePlaybackSample anchors canonical film-clock computation: What plays at one output instant: the live entry's shot at its local time, plus, inside an incoming transition, the outgoing entry's tail and the incoming shot's weight ramping 0 → 1 across the transition.
 * @evidence specifications/editorial-render-and-delivery/rational-timeline-and-composition.md#spec-editorial-rational-timeline IAutoMoviePlaybackSample realizes rational global-timeline evaluation: What plays at one output instant: the live entry's shot at its local time, plus, inside an incoming transition, the outgoing entry's tail and the incoming shot's weight ramping 0 → 1 across the transition.
 */
export interface IAutoMoviePlaybackSample {
  /**
   * Live (incoming) shot id.
   *
   * @evidence requirements/editorial/tracks-stacks-and-composition.md#editorial-sequential-tracks IAutoMoviePlaybackSample.shot supports ordered output-track composition: Live (incoming) shot id.
   * @evidence specifications/editorial-render-and-delivery/rational-timeline-and-composition.md#spec-editorial-track-composition IAutoMoviePlaybackSample.shot realizes ordered output-track composition: Live (incoming) shot id.
   */
  shot: string;

  /**
   * Shot-local seconds into the live shot.
   *
   * @evidence requirements/editorial/rational-time-and-ranges.md#editorial-canonical-time IAutoMoviePlaybackSample.time anchors canonical film-clock computation: Shot-local seconds into the live shot.
   * @evidence specifications/editorial-render-and-delivery/rational-timeline-and-composition.md#spec-editorial-rational-timeline IAutoMoviePlaybackSample.time realizes rational global-timeline evaluation: Shot-local seconds into the live shot.
   */
  time: number;

  /**
   * The outgoing tail being dissolved from, or null on a hard cut.
   *
   * @evidence requirements/editorial/transitions-and-overlaps.md#editorial-overlap-composition IAutoMoviePlaybackSample.blend preserves declared transition overlap: The outgoing tail being dissolved from, or null on a hard cut.
   * @evidence specifications/editorial-render-and-delivery/rational-timeline-and-composition.md#spec-editorial-transition-overlap IAutoMoviePlaybackSample.blend realizes transition-overlap composition: The outgoing tail being dissolved from, or null on a hard cut.
   */
  blend: { shot: string; time: number; alpha: number } | null;
}

/**
 * Lay the cut onto the output clock, the playback mirror of `cutSequence`'s
 * runtime arithmetic: each entry plays its trimmed span, and a transition pulls
 * its entry forward to overlap the previous tail by the transition's duration.
 * Precondition: the sequence already passed `cutSequence` (every entry
 * references a shot, every trim fits), so this resolver is total.
 *
 * @evidence requirements/editorial/rational-time-and-ranges.md#editorial-canonical-time Places every trimmed sequence entry on the output clock and subtracts declared transition overlaps from the accumulated runtime.
 * @evidence requirements/editorial/clips-source-ranges-and-handles.md#editorial-source-film-range Retains each selected source offset and played duration separately from the entry's derived output start.
 * @evidence requirements/editorial/clips-source-ranges-and-handles.md#editorial-clip-boundary-result Exposes the resolved source offset, played span, output start, and transition overlap for every picture entry.
 * @evidence requirements/editorial/scope-and-identity.md#editorial-authored-cut Preserves the declared sequence order, trim choice, and incoming transition on each picture entry without reordering or pacing optimization.
 * @evidence requirements/editorial/scope-and-identity.md#editorial-duration-closure Computes picture-only closure by summing each played trim or full-shot duration and subtracting declared picture-transition overlap.
 * @evidence requirements/editorial/scope-and-identity.md#editorial-missing-refusal Refuses an empty sequence or an entry whose referenced shot is absent from the supplied source set.
 * @evidence requirements/editorial/tracks-stacks-and-composition.md#editorial-composition-refusal Refuses only the sequential picture defects it can prove: an empty sequence, duplicate supplied shot ids, a missing shot reference, or an incoming transition with no predecessor.
 * @evidence requirements/editorial/transitions-and-overlaps.md#editorial-transition-refusal Rejects a transition on the first picture entry because no outgoing source exists for that overlap.
 * @evidence specifications/editorial-render-and-delivery/rational-timeline-and-composition.md#spec-editorial-rational-timeline Resolves declared trims and transition offsets into ordered output-clock picture placements.
 * @evidence specifications/editorial-render-and-delivery/rational-timeline-and-composition.md#spec-editorial-clip-boundaries Materializes the supported picture-lane source and film boundaries as explicit playback entry fields.
 * @evidence specifications/editorial-render-and-delivery/editorial-version-conform-and-validation.md#spec-editorial-film-identity Resolves the authored picture order and transition graph into a finite picture runtime while refusing absent required picture sources.
 * @evidence specifications/editorial-render-and-delivery/rational-timeline-and-composition.md#spec-editorial-track-composition Validates the small sequential-picture subset at this boundary before emitting ordered playback entries.
 * @evidence specifications/editorial-render-and-delivery/rational-timeline-and-composition.md#spec-editorial-transition-overlap Requires an outgoing picture before positioning an incoming overlap on the output clock.
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
 * time, plus, inside the live entry's incoming transition, the previous entry's
 * tail as the `blend` with the incoming weight `alpha = elapsed / transition`.
 * The single place the shot/time/blend shape is built, so the stateless and
 * cursor resolvers cannot drift.
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
 * Resolve one instant against an already-built {@link sequenceTimeline}, the
 * single-source resolver behind {@link resolveSequencePlayback} and the render
 * plan. The last entry whose span contains the instant is live (the incoming
 * shot wins inside a transition overlap). Precondition: `seconds` lies within
 * `[0, runtime)`, the caller already framed a real output instant (the render
 * plan drives it from `frameTimes`; {@link resolveSequencePlayback} range-checks
 * first). O(entries); for a whole film use {@link playbackCursor}.
 *
 * @evidence requirements/editorial/transitions-and-overlaps.md#editorial-overlap-composition Resolves one output instant to the incoming entry and its optional outgoing overlap contribution.
 * @evidence requirements/editorial/transitions-and-overlaps.md#editorial-transition-timing Evaluates the incoming start, outgoing source time, and linear picture weight directly from the requested film instant and declared overlap duration.
 * @evidence requirements/editorial/transitions-and-overlaps.md#editorial-transition-boundary-samples Includes the outgoing picture with zero incoming weight at overlap start and removes the blend at the end-exclusive transition boundary.
 * @evidence specifications/editorial-render-and-delivery/rational-timeline-and-composition.md#spec-editorial-transition-overlap Selects the incoming picture at an overlap instant and derives the outgoing sample and normalized picture weight from the same film time.
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
 * clock, the whole-film seam that turns the per-frame O(entries) scan into one
 * O(frames + entries) sweep (the render/caption plans call it once per frame in
 * output order). Entry starts are **non-decreasing**, a full-overlap dissolve
 * (`transition.duration === previousPlayed`) makes two adjacent starts equal,
 * which `cutSequence` allows, and the timeline tiles `[0, runtime)` with no
 * gaps. The advance test is `start <= seconds`, so among equal-start entries
 * the cursor lands on the **highest** index, which is exactly the last entry
 * whose span contains the instant, the same live entry
 * {@link resolveFromTimeline}'s scan returns, so the samples are byte-identical.
 * (Strict increase is NOT required and is not enforced; the earlier "strictly
 * increasing" note was the one false premise in this argument.) Feeding it a
 * time earlier than the previous call breaks the non-decreasing-clock
 * invariant; use {@link resolveFromTimeline} for random access.
 *
 * @evidence requirements/editorial/rational-time-and-ranges.md#editorial-canonical-time Advances a forward-only cursor across non-decreasing output times while preserving the same entry selection as direct resolution.
 * @evidence specifications/editorial-render-and-delivery/rational-timeline-and-composition.md#spec-editorial-rational-timeline playbackCursor realizes rational global-timeline evaluation: A forward-only playback resolver for a **monotonically non-decreasing** query clock, the whole-film seam that turns the per-frame O(entries) scan into one O(frames + entries) sweep (the render/caption plans call it once per frame in output order). Entry starts are **non-decreasing**, a full-overlap dissolve (`transition.duration === previousPlayed`) makes two adjacent starts equal, which `cutSequence` allows, and the timeline tiles `[0, runtime)` with no gaps. The advance test is `start <= seconds`, so among equal-start entries the cursor lands on the **highest** index, which is exactly the last entry whose span contains the instant, the same live entry {@link resolveFromTimeline}'s scan returns, so the samples are byte-identical. (Strict increase is NOT required and is not enforced; the earlier "strictly increasing" note was the one false premise in this argument.) Feeding it a time earlier than the previous call breaks the non-decreasing-clock invariant; use {@link resolveFromTimeline} for random access.
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
 * outside `[0, runtime)`, there is no frame there to draw. Builds the timeline
 * per call, for random single-instant access (interactive scrubbing); a whole
 * film drives {@link playbackCursor} off one timeline instead.
 *
 * @evidence requirements/editorial/rational-time-and-ranges.md#editorial-time-ranges Treats the output interval as start-inclusive and end-exclusive by returning no frame before zero or at and beyond the computed runtime.
 * @evidence requirements/editorial/transitions-and-overlaps.md#editorial-overlap-composition Returns the live incoming picture and its outgoing contribution only while the requested instant lies inside the declared overlap.
 * @evidence specifications/editorial-render-and-delivery/rational-timeline-and-composition.md#spec-editorial-rational-timeline Applies the playback timeline's half-open film range before resolving the active entry.
 * @evidence specifications/editorial-render-and-delivery/rational-timeline-and-composition.md#spec-editorial-transition-overlap Resolves a valid film instant to the incoming picture plus any active outgoing overlap instead of composing outside the timeline.
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
 * seam is emitted once, by the entry that starts there, not once per
 * neighbouring entry (#1009); it closes at `to` when the trim ends at the
 * shot's own end (a shot-final event is never lost) AND when no other entry of
 * the same shot both starts at that shot-local instant and plays GLOBALLY
 * contiguous with this entry (#1061, #1099), cutting away exactly on a hit
 * hands the hit to the cut, not to silence, and a re-play of the same source
 * span elsewhere on the output clock (a flashback) cannot claim it.
 *
 * Semantics are **per play** (#1080): each entry that shows an instant emits
 * that instant's events at its own global time, one source event re-played by a
 * flashback lands once per play, not once per film. "Emitted once" (#1009)
 * binds a single contiguous seam, where two entries share one on-screen
 * instant. Included events keep their shot-local `time` and also expose
 * `shotTime` plus `globalTime`.
 *
 * @evidence requirements/editorial/rational-time-and-ranges.md#editorial-canonical-time Maps in-range shot events to output time with half-open trim boundaries so a seam event is emitted exactly once.
 * @evidence requirements/editorial/rational-time-and-ranges.md#editorial-time-transforms Applies the supported unity-rate affine mapping `globalTime = entry.start + event.time - entry.offset`, without claiming scale, reverse, or hold support.
 * @evidence requirements/editorial/scope-and-identity.md#editorial-story-film-order Keeps each source event's shot-local instant while assigning a distinct entry and global instant to every presentation replay.
 * @evidence requirements/editorial/scope-and-identity.md#editorial-source-preservation Copies the source event payload unchanged and adds entry, shot-local, and global placement facts instead of rewriting the source shot.
 * @evidence requirements/story/beats-and-causality.md#story-semantic-event-identity Preserves the event's stable source id across trims and repeated presentation placements instead of replacing it with a frame or sequence index.
 * @evidence requirements/story/story-clock-and-state.md#story-presentation-chronology Keeps source `shotTime` separate from the authored sequence's affine `globalTime`; it does not infer chronology, reverse, or causal order.
 * @evidence requirements/staging/events-and-timing.md#staging-fixed-film-clock Converts each included shot-local event through the entry's trim offset and output start into one explicit global film-clock instant.
 * @evidence specifications/editorial-render-and-delivery/rational-timeline-and-composition.md#spec-editorial-rational-timeline Projects trimmed events from shot-local seconds to deterministic output seconds while preserving per-play ownership.
 * @evidence specifications/editorial-render-and-delivery/editorial-version-conform-and-validation.md#spec-editorial-film-identity Preserves the source occurrence and represents each authored presentation placement as separate film-order data.
 * @evidence specifications/narrative-and-intent/events-causality-and-time.md#narrative-intent-semantic-event-occurrence Keeps one semantic event identity while separating every replayed sequence occurrence by its placement data.
 * @evidence specifications/narrative-and-intent/events-causality-and-time.md#narrative-intent-chronology-presentation Exposes the supported unity-rate source-to-presentation placement without rewriting source event time as story chronology.
 * @evidence specifications/performance-motion-and-staging/staging-events-coverage-and-validation.md#performance-staging-event-boundary-sampling-output Maps every admitted occurrence onto the production clock and assigns a contiguous trim-boundary occurrence to exactly one play.
 */
export const sequenceEventTimeline = (
  sequence: IAutoMovieSequence,
  shots: IAutoMovieShot[],
): IAutoMoviePlaybackEvent[] => {
  const timeline = sequenceTimeline(sequence, shots);
  const byId = indexShots(shots);
  const events: IAutoMoviePlaybackEvent[] = [];
  const entriesByShot = new Map<string, IAutoMoviePlaybackEntry[]>();
  for (const entry of timeline.entries) {
    const list = entriesByShot.get(entry.shot) ?? [];
    list.push(entry);
    entriesByShot.set(entry.shot, list);
  }
  for (const entry of timeline.entries) {
    const shot = byId.get(entry.shot)!.shot;
    const from = entry.offset;
    const to = entry.offset + entry.played;
    const globalEnd = entry.start + entry.played;
    const atShotEnd = Math.abs(to - shot.duration) <= 1e-9;
    // An event landing EXACTLY on this entry's trim end belongs to the entry
    // that starts there (#1009), but ONLY when that entry plays globally
    // contiguous with this one, sharing the on-screen instant. A same-shot
    // entry re-playing the source span elsewhere on the output clock (a
    // flashback) owns nothing here: shot-local coincidence alone suppressed
    // the flashback's own cut hit into silence (#1099). And when no entry
    // qualifies at all, this entry keeps the event (#1061).
    const ownedElsewhere = (time: number): boolean =>
      entriesByShot
        .get(entry.shot)!
        .some(
          (other) =>
            Math.abs(other.offset - time) <= 1e-9 &&
            Math.abs(other.start - globalEnd) <= 1e-9,
        );
    for (const event of shot.events ?? []) {
      if (event.time < from - 1e-9) continue;
      if (
        atShotEnd
          ? event.time > to + 1e-9
          : Math.abs(event.time - to) <= 1e-9
            ? ownedElsewhere(event.time)
            : event.time >= to - 1e-9
      )
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
      compareCodeUnits(a.id, b.id),
  );
};

/**
 * The whole film as frame sample points: `runtime × fps` output frames (the
 * same `round` policy as the render plan's `frameTimes`), each resolved to its
 * on-screen sample. This is the deterministic seam a render host drives its
 * per-frame capture from, pose the live shot's scene at `time`, blend the
 * outgoing tail when a dissolve is in flight, write the frame.
 *
 * @evidence requirements/editorial/rational-time-and-ranges.md#editorial-canonical-time Derives every picture sample from its integer index, the declared frame rate, and the one resolved output timeline.
 * @evidence requirements/editorial/rational-time-and-ranges.md#editorial-frame-grid Numbers picture samples from zero and places sample `i` at `i / fps`; it does not decide whether an arbitrary authored time belongs to that grid.
 * @evidence requirements/editorial/rational-time-and-ranges.md#editorial-time-refusal Refuses a non-finite, zero, or negative picture frame rate before deriving a frame count or sample instant.
 * @evidence specifications/editorial-render-and-delivery/rational-timeline-and-composition.md#spec-editorial-rational-timeline Enumerates the finite picture grid in index order and resolves each `i / fps` instant against the same timeline.
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
