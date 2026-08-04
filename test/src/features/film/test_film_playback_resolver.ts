import {
  resolveSequencePlayback,
  sequenceEventTimeline,
  sequenceTimeline,
} from "@automovie/engine";
import { IAutoMovieSequence, IAutoMovieShot } from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { nclose, throwsError } from "../internal/predicates";

/**
 * Evaluate named facts in order and stop at the first false one, so a failed
 * comparison names the fact instead of collapsing into one boolean. Stopping
 * keeps the short-circuit semantics the original conjunction had, which some
 * facts depend on to guard the ones after them.
 */
const namedFacts = (
  entries: ReadonlyArray<readonly [string, () => boolean]>,
): Record<string, boolean> => {
  const output: Record<string, boolean> = {};
  for (const [name, evaluate] of entries) {
    output[name] = evaluate();
    if (output[name] === false) break;
  }
  return output;
};

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
const SHOTS = [shot("shot:beat-1", 3), shot("shot:beat-2", 4)];
type Event = NonNullable<IAutoMovieShot["events"]>[number];
const event = (
  id: string,
  kind: Event["kind"],
  source: Event["source"],
  time: number,
): Event => ({
  id,
  kind,
  source,
  time,
  actor: null,
  target: null,
  object: null,
  point: null,
  actionIndex: null,
  reaction: null,
});

const SEQUENCE: IAutoMovieSequence = {
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

/**
 * Pins the playback resolver against the same cut the ASSEMBLE tests use, so
 * the two arithmetics (gate-side runtime, playback-side timeline) can never
 * drift apart silently. Hand-laid timeline: entry 0 spans [0, 3), entry 1 (trim
 * [0.5, 2.5]) spans [3, 5), entry 2 dissolves in 0.5 s early, spanning [4.5,
 * 7.5): runtime 7.5.
 *
 * Scenarios:
 *
 * 1. `sequenceTimeline` lays entries at starts 0 / 3 / 4.5 with runtime 7.5.
 * 2. T = 1 → entry 0 at local 1, hard cut (no blend).
 * 3. T = 3.2 → entry 1 at local 0.5 + 0.2 = 0.7 (the trim offsets local time), no
 *    blend.
 * 4. T = 4.7 → inside the dissolve: live entry 2 at local 0.2, blending from the
 *    outgoing entry 1 tail at local 0.5 + 1.7 = 2.2, incoming weight 0.2 / 0.5
 *    = 0.4.
 * 5. T = 4.99…+0.5 = 5.1 (past the dissolve) → entry 2 alone, no blend.
 * 6. T = −1 and T = 7.5 (the exclusive end) → null; T = 0 → entry 0 at 0.
 * 7. Event windows are half-open at a trim seam: one shot split into contiguous
 *    trims [0,1] + [1,2] emits an event at shot-time 1.0 exactly once (from the
 *    entry that starts there), while a shot-final event at 2.0 is still emitted
 *    because the last trim ends at the shot's own end.
 * 8. Cutting away exactly on a hit keeps the hit (#1061): when NO other entry of
 *    the shot starts at the trim-end instant, the trimmed entry owns the event
 *    instead of it vanishing from every entry.
 * 9. Ownership requires GLOBAL contiguity (#1099): the same shot played as
 *    aftermath [2,4] then flashback [0,2]: the flashback's cut lands exactly on
 *    the hit at shot-time 2, and a shot-LOCAL coincidence with the aftermath's
 *    start must not suppress it (they play at different global times). Both
 *    plays emit the hit at their own global instants (per-play semantics,
 *    #1080), while a genuinely contiguous seam (scenario 7) still emits once.
 */
export const test_film_playback_resolver = (): void => {
  const timeline = sequenceTimeline(SEQUENCE, SHOTS);
  TestValidator.equals(
    "entry starts",
    timeline.entries.map((e) => e.start),
    [0, 3, 4.5],
  );
  TestValidator.predicate("runtime", nclose(timeline.runtime, 7.5));

  const at = (t: number) => resolveSequencePlayback(SEQUENCE, SHOTS, t);

  const t1 = at(1)!;
  TestValidator.equals("T=1 shot", t1.shot, "shot:beat-1");
  TestValidator.predicate("T=1 local", nclose(t1.time, 1));
  TestValidator.equals("T=1 hard cut", t1.blend, null);

  const t32 = at(3.2)!;
  TestValidator.equals("T=3.2 shot", t32.shot, "shot:beat-2");
  TestValidator.predicate("T=3.2 trimmed local", nclose(t32.time, 0.7));
  TestValidator.equals("T=3.2 no blend", t32.blend, null);

  const t47 = at(4.7)!;
  TestValidator.equals("T=4.7 live shot", t47.shot, "shot:beat-1");
  TestValidator.predicate("T=4.7 live local", nclose(t47.time, 0.2));
  TestValidator.equals(
    "T=4.7 outgoing tail",
    namedFacts([
      ["t47Blend", () => t47.blend !== null],
      [
        "t47Blend2",
        () => t47.blend !== null && t47.blend.shot === "shot:beat-2",
      ],
      ["ncloseT47", () => t47.blend !== null && nclose(t47.blend.time, 2.2)],
      ["ncloseT472", () => t47.blend !== null && nclose(t47.blend.alpha, 0.4)],
    ]),
    {
      t47Blend: true,
      t47Blend2: true,
      ncloseT47: true,
      ncloseT472: true,
    },
  );

  TestValidator.equals("T=5.1 past the dissolve", at(5.1)!.blend, null);

  TestValidator.equals("before the film", at(-1), null);
  TestValidator.equals("at the exclusive end", at(7.5), null);
  const t0 = at(0)!;
  TestValidator.predicate(
    "first frame",
    t0.shot === "shot:beat-1" && nclose(t0.time, 0),
  );
  TestValidator.predicate(
    "duplicate playback shots reject ambiguous lookup",
    throwsError(
      () =>
        sequenceTimeline(SEQUENCE, [
          SHOTS[0]!,
          { ...SHOTS[0]!, duration: 9 },
          SHOTS[1]!,
        ]),
      ['shot id "shot:beat-1"', "shots[1].id"],
    ),
  );
  TestValidator.predicate(
    "missing trimmed playback shot rejects bad sequence entry",
    throwsError(
      () =>
        sequenceTimeline(
          {
            ...SEQUENCE,
            shots: [
              {
                shot: "shot:missing",
                trim: { start: 0, duration: 1 },
                transition: null,
              },
            ],
          },
          SHOTS,
        ),
      ['sequence shot "shot:missing"', "sequence.shots[0].shot"],
    ),
  );
  TestValidator.predicate(
    "empty playback sequence rejects before sampling",
    throwsError(
      () => sequenceTimeline({ ...SEQUENCE, shots: [] }, SHOTS),
      ['sequence "seq"', "at least one shot"],
    ),
  );
  TestValidator.predicate(
    "first playback transition rejects missing outgoing entry",
    throwsError(
      () =>
        resolveSequencePlayback(
          {
            ...SEQUENCE,
            shots: [
              {
                shot: "shot:beat-1",
                trim: null,
                transition: { kind: "crossDissolve", duration: 0.5 },
              },
            ],
          },
          SHOTS,
          0,
        ),
      ["sequence.shots[0].transition", "nothing to transition from"],
    ),
  );
  const eventShots: IAutoMovieShot[] = [
    {
      ...shot("shot:beat-1", 3),
      events: [
        event("a-before", "contact", "sampledProximity", 0.5),
        event("a-in", "hit", "impactOutput", 1.25),
        event("a-z", "contact", "sampledProximity", 1.25),
        event("a-after", "fall", "impactOutput", 2.75),
      ],
    },
    {
      ...shot("shot:beat-2", 4),
      events: [
        event("b-in", "attach", "scriptedCue", 1),
        event("b-after", "release", "scriptedCue", 3),
      ],
    },
  ];
  const eventSequence: IAutoMovieSequence = {
    id: "seq-events",
    name: null,
    fps: 24,
    shots: [
      {
        shot: "shot:beat-1",
        trim: { start: 1, duration: 1.5 },
        transition: null,
      },
      {
        shot: "shot:beat-2",
        trim: { start: 0.5, duration: 2 },
        transition: { kind: "crossDissolve", duration: 0.25 },
      },
    ],
  };
  const events = sequenceEventTimeline(eventSequence, eventShots);
  TestValidator.equals(
    "sequence events keep only events inside trims",
    events.map((e) => e.id),
    ["a-in", "a-z", "b-in"],
  );
  TestValidator.equals(
    "shot-local events are placed on the global clock",
    namedFacts([
      ["ncloseEvents", () => nclose(events[0]!.shotTime, 1.25)],
      ["ncloseEvents2", () => nclose(events[0]!.globalTime, 0.25)],
      ["eventsEntry", () => events[0]!.entry === 0],
      ["eventsShot", () => events[0]!.shot === "shot:beat-1"],
      ["ncloseEvents3", () => nclose(events[1]!.shotTime, 1.25)],
      ["ncloseEvents4", () => nclose(events[1]!.globalTime, 0.25)],
      ["eventsEntry2", () => events[1]!.entry === 0],
      ["eventsShot2", () => events[1]!.shot === "shot:beat-1"],
      ["ncloseEvents5", () => nclose(events[2]!.shotTime, 1)],
      ["ncloseEvents6", () => nclose(events[2]!.globalTime, 1.75)],
      ["eventsEntry3", () => events[2]!.entry === 1],
      ["eventsShot3", () => events[2]!.shot === "shot:beat-2"],
    ]),
    {
      ncloseEvents: true,
      ncloseEvents2: true,
      eventsEntry: true,
      eventsShot: true,
      ncloseEvents3: true,
      ncloseEvents4: true,
      eventsEntry2: true,
      eventsShot2: true,
      ncloseEvents5: true,
      ncloseEvents6: true,
      eventsEntry3: true,
      eventsShot3: true,
    },
  );
  TestValidator.equals(
    "shots without interaction metadata produce no sequence events",
    sequenceEventTimeline(SEQUENCE, SHOTS),
    [],
  );

  // 7. a contiguous trim seam emits the seam event once; the shot end survives
  const seamShots: IAutoMovieShot[] = [
    {
      ...shot("shot:beat-1", 2),
      events: [
        event("seam", "contact", "sampledProximity", 1),
        event("final", "release", "scriptedCue", 2),
      ],
    },
  ];
  const seamEvents = sequenceEventTimeline(
    {
      id: "seq-seam",
      name: null,
      fps: 24,
      shots: [
        {
          shot: "shot:beat-1",
          trim: { start: 0, duration: 1 },
          transition: null,
        },
        {
          shot: "shot:beat-1",
          trim: { start: 1, duration: 1 },
          transition: null,
        },
      ],
    },
    seamShots,
  );
  TestValidator.equals(
    "a seam event emits once and the shot-final event survives",
    seamEvents.map((e) => [e.id, e.entry]),
    [
      ["seam", 1],
      ["final", 1],
    ],
  );

  // 8. a hit exactly on a mid-shot cut-away survives at the cut (#1061)
  const cutShots: IAutoMovieShot[] = [
    {
      ...shot("shot:beat-1", 4),
      events: [event("hit", "contact", "sampledProximity", 2)],
    },
    shot("shot:beat-2", 1),
  ];
  const cutEvents = sequenceEventTimeline(
    {
      id: "seq-cut",
      name: null,
      fps: 24,
      shots: [
        {
          shot: "shot:beat-1",
          trim: { start: 0, duration: 2 },
          transition: null,
        },
        { shot: "shot:beat-2", trim: null, transition: null },
      ],
    },
    cutShots,
  );
  TestValidator.equals(
    "a hit exactly on a mid-shot cut-away survives at the cut",
    cutEvents.map((e) => [e.id, e.entry, e.globalTime]),
    [["hit", 0, 2]],
  );

  // 9. a flashback's cut keeps its own hit: shot-local coincidence with a
  // non-contiguous entry owns nothing (#1099)
  const flashbackShots: IAutoMovieShot[] = [
    {
      ...shot("shot:beat-1", 4),
      events: [event("hit", "contact", "sampledProximity", 2)],
    },
  ];
  const flashbackEvents = sequenceEventTimeline(
    {
      id: "seq-flashback",
      name: null,
      fps: 24,
      shots: [
        {
          shot: "shot:beat-1",
          trim: { start: 2, duration: 2 },
          transition: null,
        },
        {
          shot: "shot:beat-1",
          trim: { start: 0, duration: 2 },
          transition: null,
        },
      ],
    },
    flashbackShots,
  );
  TestValidator.equals(
    "a flashback's cut emits the hit at its own global time (per play)",
    flashbackEvents.map((e) => [e.id, e.entry, e.globalTime]),
    [
      ["hit", 0, 0],
      ["hit", 1, 4],
    ],
  );
};
