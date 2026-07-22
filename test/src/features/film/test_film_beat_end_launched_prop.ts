import { resolveBeatEnd } from "@automovie/engine";
import {
  IAutoMovieClip,
  IAutoMovieScene,
  IAutoMovieShot,
  IAutoMovieVector3,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { IDENTITY_TRANSFORM } from "../internal/fixtures";
import { vclose } from "../internal/predicates";

/** Where the stone sits in the thrower's hand, and where it is staged. */
const HAND: IAutoMovieVector3 = { x: -0.71, y: 1.35, z: 0 };

/** Where the flight ends: the stone on the ground, five metres out. */
const LANDED: IAutoMovieVector3 = { x: 0, y: 0, z: 5 };

/** Somewhere else entirely, for the clip whose id follows no convention. */
const SLID: IAutoMovieVector3 = { x: 2, y: 0, z: -1 };

/** The shot's own clock: grab at 0, release at 2.2, contact at 2.83625…. */
const RELEASE = 2.2;
const CONTACT = 2.836250052458314;

const drives = (
  id: string,
  times: number[],
  points: IAutoMovieVector3[],
  rotation = true,
): IAutoMovieClip => ({
  id,
  name: null,
  // The launch pass stretches its clip over the whole shot, so a sample past
  // contact clamps to the landed value rather than falling off the clip.
  duration: 5,
  loop: false,
  tracks: [
    {
      channel: { kind: "node", node: "stone", path: "translation" },
      times,
      values: points.flatMap((point) => [point.x, point.y, point.z]),
      interpolation: "linear",
    },
    ...(rotation
      ? [
          {
            channel: {
              kind: "node" as const,
              node: "stone",
              path: "rotation" as const,
            },
            times,
            values: times.flatMap(() => [0, 0, 0, 1]),
            interpolation: "linear" as const,
          },
        ]
      : []),
  ],
});

/** Held in the hand from the grab to the release: `compileAttach`'s bake. */
const HELD = drives("attach:stone", [0, RELEASE], [HAND, HAND]);

/** The ballistic flight `launch` bakes, released at 2.2 and landing at 2.836. */
const FLIGHT = drives("trajectory:stone", [RELEASE, CONTACT], [HAND, LANDED]);

/** A clip driving the same node under an id no consumer knows to look for. */
const SLIDE = drives("slide:stone", [3, 4], [LANDED, SLID]);

/** Translation-only late authority; rotation remains owned by the flight. */
const PARTIAL = drives("drift:stone", [4, 4.5], [SLID, HAND], false);

/** An authority that begins exactly at the requested beat-end instant. */
const JUST_STARTED = drives("arrival:stone", [5], [LANDED]);

const scene: IAutoMovieScene = {
  id: "scene",
  name: null,
  nodes: [
    {
      id: "thrower",
      model: "hero",
      transform: IDENTITY_TRANSFORM,
      motion: null,
      pose: null,
    },
    {
      id: "stone",
      model: "stone",
      transform: {
        ...IDENTITY_TRANSFORM,
        translation: HAND,
      },
      motion: null,
      pose: null,
    },
  ],
  cameras: [],
  lights: [],
};

const shotOf = (
  duration: number,
  objectMotions: IAutoMovieClip[],
): IAutoMovieShot => ({
  id: "shot:beat-1",
  name: null,
  scene: "scene",
  camera: "cam",
  cameraMotion: null,
  performances: [],
  objectMotions,
  duration,
});

const stoneAt = (
  duration: number,
  objectMotions: IAutoMovieClip[],
): IAutoMovieVector3 =>
  resolveBeatEnd({
    beat: "beat-1",
    scene,
    shot: shotOf(duration, objectMotions),
    motions: [],
  }).actors.find((actor) => actor.node === "stone")!.transform.translation;

/**
 * A beat end reports a driven prop where the shot's own clips leave it.
 *
 * The end transform was resolved through an `attach:<node>` id prefix, so the
 * `trajectory:<node>` clip the SAME `perform` pass bakes for the same node was
 * invisible to it: a thrown stone's beat end read the attach clip that stops at
 * release and reported the stone still in the thrower's hand, contradicting the
 * committed shot it was resolved from (#1361). `commitBeatEnd` persists that,
 * so beat N+1 opens with the prop at its pre-throw position. Selection now
 * follows what a clip CARRIES and which one is in effect at the end instant,
 * not how its producer spelled the id.
 *
 * The geometry is the reproduction's: grab at 0, release at 2.2 from `(-0.71,
 * 1.35, 0)`, contact at 2.836250052458314 at `(0, 0, 5)`.
 *
 * Scenarios:
 *
 * 1. Past the landing, the beat end reports the stone where the flight left it,
 *    `(0, 0, 5)`, not the hand it was released from. The clip's last keyframe
 *    is the oracle, reached by clamping, exactly as the committed shot reads.
 * 2. Both directions of "in effect": BEFORE the release the same pair of clips
 *    resolves to the hand, so the flight does not win by merely existing.
 * 3. The flight alone (no attach bake, a prop thrown from rest) is honoured too,
 *    which is the case the id prefix could never reach.
 * 4. Selection is id-agnostic: a clip called `slide:stone`, matching neither
 *    convention, drives the end state because it drives the node.
 * 5. Negative twin: a shot carrying no clip for the node falls back to its staged
 *    placement, byte-identical to the pre-#674 path.
 * 6. A landed prop's end velocity is zero: the flight clip is clamped past
 *    contact, so nothing reports the stone as still travelling.
 * 7. Authority is per channel: a later translation-only clip supplies position
 *    while the earlier flight keeps supplying rotation.
 * 8. Array order decides nothing: the same two clips listed flight-first resolve
 *    to the flight, so it is the later START that wins, not the later entry.
 * 9. A transform authority that starts exactly at beat end has no preceding sample
 *    window, so its derived velocity is honestly zero.
 */
export const test_film_beat_end_launched_prop = (): void => {
  // 1. the contradiction, resolved: the shot's clip decides.
  TestValidator.predicate(
    "a launched prop ends where its flight landed it",
    vclose(stoneAt(5, [HELD, FLIGHT]), LANDED, 1e-9),
  );

  // 2. before the release the hand still owns it.
  TestValidator.predicate(
    "before the release the attach bake is the authority",
    vclose(stoneAt(1, [HELD, FLIGHT]), HAND, 1e-9),
  );

  // 3. a flight with no attach bake in front of it.
  TestValidator.predicate(
    "a flight alone drives the end state",
    vclose(stoneAt(5, [FLIGHT]), LANDED, 1e-9),
  );

  // 4. the id spelling stopped deciding anything.
  TestValidator.predicate(
    "a clip under an unconventional id still drives the node",
    vclose(stoneAt(5, [HELD, FLIGHT, SLIDE]), SLID, 1e-9),
  );

  // 5. no clip for the node: the staged placement, unchanged.
  TestValidator.predicate(
    "a node no clip drives keeps its staged placement",
    vclose(stoneAt(5, []), HAND, 1e-9),
  );

  // 6. the landed stone is not still flying.
  const landed = resolveBeatEnd({
    beat: "beat-1",
    scene,
    shot: shotOf(5, [HELD, FLIGHT]),
    motions: [],
  }).actors.find((actor) => actor.node === "stone")!;
  TestValidator.predicate(
    "a landed prop reports no residual velocity",
    landed.rootVelocity !== null &&
      vclose(landed.rootVelocity, { x: 0, y: 0, z: 0 }, 1e-9),
  );

  // 7. disjoint channel authorities compose into one transform.
  TestValidator.predicate(
    "a later translation composes with the earlier rotation authority",
    vclose(stoneAt(5, [HELD, FLIGHT, PARTIAL]), HAND, 1e-9),
  );

  // 8. the later START wins, not the later entry.
  TestValidator.predicate(
    "listing the flight first changes nothing",
    vclose(stoneAt(5, [FLIGHT, HELD]), LANDED, 1e-9),
  );

  const justStarted = resolveBeatEnd({
    beat: "beat-1",
    scene,
    shot: shotOf(5, [JUST_STARTED]),
    motions: [],
  }).actors.find((actor) => actor.node === "stone")!;
  TestValidator.predicate(
    "an authority starting at beat end has no prior velocity sample",
    justStarted.rootVelocity !== null &&
      vclose(justStarted.rootVelocity, { x: 0, y: 0, z: 0 }, 1e-9),
  );
};
