import { sceneFogTransmittance } from "@automovie/engine";
import {
  IAutoMovieFog,
  IAutoMovieMotion,
  IAutoMovieScene,
  IAutoMovieSequence,
  IAutoMovieShot,
  IAutoMovieTransform,
} from "@automovie/interface";
import {
  planPoseKeypointSidecar,
  renderPoseKeypointSidecar,
} from "@automovie/render";
import { buildModel, buildScene } from "@automovie/viewer";
import { TestValidator } from "@nestia/e2e";
import * as THREE from "three";

import {
  createModel,
  createSkeleton,
  keyframe,
  makeMotion,
  makePose,
} from "../internal/fixtures";
import { namedFacts, nclose } from "../internal/predicates";

const IDENTITY_Q = { x: 0, y: 0, z: 0, w: 1 };
const t3 = (x: number, y: number, z: number): IAutoMovieTransform => ({
  translation: { x, y, z },
  rotation: IDENTITY_Q,
  scale: { x: 1, y: 1, z: 1 },
});

const skeleton = createSkeleton();

const FOG: IAutoMovieFog = {
  density: 0.02,
  color: { r: 0.6, g: 0.65, b: 0.7, a: null, hex: null },
};

/** Depths the receding actor is at on the two sampled output frames. */
const NEAR_DEPTH = 5;
const FAR_DEPTH = 25;

/** A 1 s clip whose root recedes from 5 m to 45 m down the camera's −Z. */
const recede = (): IAutoMovieMotion => ({
  ...makeMotion(
    [
      keyframe(0, makePose([], t3(0, 0, -NEAR_DEPTH))),
      keyframe(1, makePose([], t3(0, 0, -45))),
    ],
    1,
  ),
  id: "m1",
});

const sceneOf = (fog: IAutoMovieScene["fog"]): IAutoMovieScene => ({
  id: "scene-1",
  name: null,
  nodes: [
    {
      id: "hero",
      model: "m",
      transform: t3(0, 0, 0),
      motion: null,
      pose: null,
    },
  ],
  cameras: [
    { id: "cam", transform: t3(0, 0, 0), fovY: 60, near: 0.1, far: 200 },
  ],
  lights: [],
  fog,
});

const shot: IAutoMovieShot = {
  id: "shot:b1",
  name: null,
  scene: "scene-1",
  camera: "cam",
  cameraMotion: null,
  performances: [{ node: "hero", motion: "m1", startOffset: 0 }],
  objectMotions: [],
  duration: 1,
};

const sequence: IAutoMovieSequence = {
  id: "seq-1",
  name: null,
  fps: 24,
  shots: [{ shot: "shot:b1", trim: null, transition: null }],
};

/** Two output frames: the actor at 5 m, then the same actor at 25 m. */
const sidecarOf = (fog: IAutoMovieScene["fog"]) =>
  planPoseKeypointSidecar({
    sequence,
    shots: [shot],
    scenes: [sceneOf(fog)],
    motions: [recede()],
    skeletons: [skeleton],
    fps: 2,
  });

const actorOn = (fog: IAutoMovieScene["fog"], frame: number) =>
  sidecarOf(fog).frames[frame]!.actors[0]!;

/**
 * The offline renderer reads the scene's atmosphere from the same declaration
 * the viewer hands the GPU, and derives the same number from it.
 *
 * A pose-conditioned host drives generation from the sidecar's screen
 * coordinates, and screen coordinates cannot say whether the subject standing
 * there is fully visible or a silhouette half-dissolved into haze. So each
 * actor now carries the transmittance at its own depth, through the engine's
 * one fog law rather than a renderer-local copy of it: a review frame and the
 * artifact beside it must not be able to disagree about the film.
 *
 * Scenarios (camera at the origin looking down −Z, one actor receding):
 *
 * 1. A scene declaring no fog omits the field entirely, so its serialized sidecar
 *    is byte-identical to one written before atmospheres existed: the key does
 *    not appear in the JSON at all.
 * 2. A declared fog attenuates the far frame more than the near one, and by the
 *    engine's exact law at each depth — the depth being the actor's live world
 *    root and not its staged placement, since the node sits at the origin for
 *    the whole shot and the clip carries all the travel. A sidecar keyed to the
 *    staged transform would report one atmosphere for both frames, and the
 *    transmittance of depth zero at that.
 * 3. Viewer and renderer agree: the `FogExp2` the viewer builds from this same
 *    scene, evaluated through the shader's own expression at the actor's depth,
 *    is the number the sidecar carries.
 */
export const test_render_scene_fog = (): void => {
  // 1. no declaration, no field, no byte.
  const clear = sidecarOf(undefined);
  TestValidator.equals(
    "a scene without fog writes a sidecar without atmosphere",
    namedFacts([
      [
        "fieldAbsent",
        () => clear.frames.every((f) => !("atmosphere" in f.actors[0]!)),
      ],
      [
        "bytesUnchanged",
        () => renderPoseKeypointSidecar(clear).includes("atmosphere") === false,
      ],
      ["nullIsAbsentToo", () => !("atmosphere" in actorOn(null, 0))],
    ]),
    { fieldAbsent: true, bytesUnchanged: true, nullIsAbsentToo: true },
  );

  // 2. the far frame is the more attenuated one, by the exact law.
  const near = actorOn(FOG, 0).atmosphere;
  const far = actorOn(FOG, 1).atmosphere;
  TestValidator.equals(
    "the distant frame keeps less of the actor than the near one",
    namedFacts([
      ["nearPresent", () => near !== undefined],
      ["farPresent", () => far !== undefined],
      ["farIsDimmer", () => far! < near!],
      // These two depths are the CLIP's, not the node's: the node sits at the
      // origin for the whole shot and the performance carries all the travel,
      // so a sidecar keyed to the staged transform would report the depth-zero
      // transmittance of exactly one on both frames. Saying separately that the
      // two numbers differ would only restate `farIsDimmer`.
      [
        "nearIsExact",
        () => nclose(near!, sceneFogTransmittance(FOG, NEAR_DEPTH), 1e-12),
      ],
      [
        "farIsExact",
        () => nclose(far!, sceneFogTransmittance(FOG, FAR_DEPTH), 1e-12),
      ],
    ]),
    {
      nearPresent: true,
      farPresent: true,
      farIsDimmer: true,
      nearIsExact: true,
      farIsExact: true,
    },
  );

  // 3. the viewer's own fog, evaluated the shader's way, is the same number.
  const viewerFog = buildScene(sceneOf(FOG), () =>
    buildModel({ ...createModel(), id: "m" }),
  ).scene.fog;
  if (!(viewerFog instanceof THREE.FogExp2))
    throw new Error("the viewer must build an exponential fog for this scene");
  const shaderAt = (depth: number): number =>
    1 - (1 - Math.exp(-viewerFog.density * viewerFog.density * depth * depth));
  TestValidator.equals(
    "viewer and renderer derive the same value from the same declaration",
    namedFacts([
      ["sameDensity", () => viewerFog.density === FOG.density],
      ["nearAgrees", () => nclose(near!, shaderAt(NEAR_DEPTH), 1e-12)],
      ["farAgrees", () => nclose(far!, shaderAt(FAR_DEPTH), 1e-12)],
    ]),
    { sameDensity: true, nearAgrees: true, farAgrees: true },
  );
};
