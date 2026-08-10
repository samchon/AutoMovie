import {
  compileDefinedShot,
  defineShot,
  placementChildNode,
  sceneToNodes,
} from "@automovie/engine";
import {
  IAutoMovieClip,
  IAutoMovieDefinedShotContract,
  IAutoMoviePropSpec,
  IAutoMovieShotProgram,
  IAutoMovieStage,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import {
  makeBlockingWrite,
  makePerformanceWrite,
  makeScriptWrite,
  makeStagingWrite,
  validSynthesizer,
} from "../internal/filmFixtures";
import { createSkeleton } from "../internal/fixtures";
import { namedFacts } from "../internal/predicates";
import { createDoorPropSpec } from "./test_film_forge_prop";

/** A rotation of `deg` about +Y, as the value a rotation track carries. */
export const yQuat = (deg: number): number[] => {
  const half = (deg * Math.PI) / 360;
  return [0, Math.sin(half), 0, Math.cos(half)];
};

/** The staged node id of the door prop's hinge. */
export const HINGE = placementChildNode("frontDoor", "hinge");

/** A one-key clip turning `node` by `deg` about +Y. */
export const swingClip = (
  id: string,
  node: string,
  deg: number,
  overrides: Partial<IAutoMovieClip["tracks"][number]> = {},
): IAutoMovieClip => ({
  id,
  name: null,
  duration: 2,
  loop: false,
  tracks: [
    {
      channel: { kind: "node", node, path: "rotation" },
      times: [0],
      values: yQuat(deg),
      interpolation: "linear",
      ...overrides,
    },
  ],
});

/**
 * The duel fixture, plus everything an authored object clip is measured
 * against: a door prop whose hinge is lowered, a wall panel standing on its own
 * as a building element would, and a torch the engine bakes a follow clip for.
 *
 * `extraSet` adds one more staged piece, so a scenario can put a scene node
 * exactly where a prop joint lowers and watch the collision be named.
 */
export const doorProgram = (
  extraSet: IAutoMovieStage["set"] = [],
): IAutoMovieShotProgram => {
  const blocking = makeBlockingWrite();
  const performance = makePerformanceWrite();
  blocking.camera.framing = "full";
  blocking.rationale =
    "full static keeps both required actor roots readable throughout the duel.";
  for (const action of performance.draft)
    if (action.verb === "frame") action.framing = "full";
  performance.draft.push({
    verb: "attachTo",
    actor: "torch",
    parent: "knightA",
    bone: "leftHand",
    start: 0,
    duration: "auto",
  });
  return {
    actors: [
      { node: "knightA", model: "knightA", speed: 1, eyeHeight: 1.6 },
      { node: "knightB", model: "knightB", speed: 1, eyeHeight: 1.6 },
    ],
    script: makeScriptWrite({
      cast: [
        { node: "knightA", character: "the challenger", modelRef: "stickman" },
        { node: "knightB", character: "the champion", modelRef: null },
        { node: "torch", character: "the torch", modelRef: null },
      ],
    }),
    stage: makeStagingWrite({
      actors: [
        { node: "knightA", position: { x: 0, y: 0, z: 0 }, facingDeg: 0 },
        { node: "knightB", position: { x: 0, y: 0, z: 0.7 }, facingDeg: 180 },
        { node: "torch", position: { x: 0.3, y: 1.2, z: 0 }, facingDeg: 0 },
      ],
      set: [
        { node: "frontDoor", model: "door", position: { x: 2, y: 0, z: 0 } },
        { node: "hall/panel", model: "slab", position: { x: 3, y: 0, z: 0 } },
        ...(extraSet ?? []),
      ],
    }),
    blocking,
    performance,
    eventSamples: [],
  };
};

/** The duel contract the door fixture compiles under. */
export const DOOR_CONTRACT: IAutoMovieDefinedShotContract = {
  beat: "beat-1",
  durationSeconds: 2,
  participants: [
    { kind: "actor", id: "knightA" },
    { kind: "actor", id: "knightB" },
  ],
  opening: [],
  closing: [],
  camera: {
    intent: "Keep the duel readable.",
    requiredSubjects: ["knightA", "knightB"],
    maxOcclusionRatio: 0.2,
  },
  events: [],
  reviewFrames: [{ id: "impact", time: 1, passes: ["beauty"] }],
};

/** What one door-fixture compile varies. */
export interface IDoorShotProps {
  /** The clips the source authors, or omitted for a shot that authors none. */
  objectMotions?: readonly IAutoMovieClip[];
  /** One more staged piece, for a scenario about scene-node identity. */
  extraSet?: IAutoMovieStage["set"];
  /** The prop registry, defaulting to the one articulated door. */
  props?: readonly IAutoMoviePropSpec[];
}

/** Compile the door fixture under one variation. */
export const compileDoorShot = (
  props: IDoorShotProps = {},
): ReturnType<typeof compileDefinedShot> =>
  compileDefinedShot({
    shot: defineShot("SB-door", {
      scene: "scene-duel",
      contract: DOOR_CONTRACT,
      build: () => doorProgram(props.extraSet ?? []),
    }),
    context: undefined,
    runtime: {
      // A coupling animates an object, never a rig, so it synthesizes nothing:
      // the torch has to stay off `performances` for the baked follow to be the
      // only authority over it.
      synthesize: (action, actor, previous) =>
        action.verb === "attachTo"
          ? null
          : validSynthesizer(action, actor, previous),
      skeleton: () => createSkeleton(),
      frameFormat: { width: 1920, height: 1080 },
      props: "props" in props ? props.props : [createDoorPropSpec()],
      objectMotions: props.objectMotions,
    },
  });

/**
 * A source can turn a door, and the compiled shot carries the turn.
 *
 * Every entry on a compiled shot's `objectMotions` used to be baked by the
 * engine from a `launch` or an `attachTo`, so the two contracts that promise a
 * door swings on screen — a building opening's panel placements, a prop's
 * declared articulation — were both true of the record and unreachable from a
 * shot. This case is the reachability: the authored clip survives compilation,
 * addresses the joint the scene actually lowers, and the joint id is derivable
 * from the artifact rather than guessed.
 *
 * Scenarios:
 *
 * 1. A shot that authors nothing compiles with exactly the clips the engine baked
 *    for it, here the torch's follow: the field costs a shot that says nothing
 *    about its objects exactly what it cost before.
 * 2. A 90° swing over the prop's lowered hinge compiles, and the compiled shot
 *    carries that clip on `objectMotions` BESIDE the baked follow rather than
 *    instead of it, addressing the same node id `sceneToNodes` lowers the
 *    prop's hinge under.
 * 3. A staged set piece no prop registry mentions is drivable too: this is the
 *    building panel's own path (`<environment>/<element>`), so a swinging leaf
 *    and a swinging panel need one mechanism rather than two.
 */
export const test_film_perform_shot_object_motions = (): void => {
  const silent = compileDoorShot();
  TestValidator.equals(
    "a shot that authors no object motion carries only what the engine baked",
    silent.success === true
      ? silent.source.shot.objectMotions.map((clip) => clip.id)
      : silent.diagnostics.map(
          (diagnostic) => `${diagnostic.path} ${diagnostic.fact}`,
        ),
    ["attach:torch"],
  );

  const swung = compileDoorShot({
    objectMotions: [swingClip("door-swing", HINGE, 90)],
  });
  TestValidator.equals(
    "the authored swing reaches the compiled shot, beside the baked follow",
    swung.success === true
      ? swung.source.shot.objectMotions.map((clip) => [
          clip.id,
          clip.tracks[0]!.channel.kind === "node"
            ? clip.tracks[0]!.channel.node
            : null,
        ])
      : swung.diagnostics.map((diagnostic) => [
          diagnostic.path,
          diagnostic.fact,
        ]),
    [
      ["attach:torch", "torch"],
      ["door-swing", HINGE],
    ],
  );
  TestValidator.equals(
    "the driven node is the one the compiled artifact lowers the hinge under",
    namedFacts([
      ["compiled", () => swung.success === true],
      [
        "lowersTheDrivenNode",
        () =>
          swung.success === true &&
          sceneToNodes({
            scene: swung.source.scene,
            props: { door: createDoorPropSpec() },
            allowPartialModels: true,
          })
            .map((node) => node.id)
            .includes(HINGE),
      ],
    ]),
    { compiled: true, lowersTheDrivenNode: true },
  );

  const panel = compileDoorShot({
    objectMotions: [swingClip("panel-swing", "hall/panel", 30)],
  });
  TestValidator.equals(
    "a staged set piece is drivable on the same channel",
    panel.success === true
      ? panel.source.shot.objectMotions.map((clip) => clip.id)
      : panel.diagnostics.map((diagnostic) => diagnostic.fact),
    ["attach:torch", "panel-swing"],
  );
};
