import { resolveFrame } from "@automovie/engine";
import {
  IAutoMovieClip,
  IAutoMovieNode,
  IAutoMovieProfile,
  IAutoMovieProfileBinding,
  IAutoMovieTransform,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { nclose } from "../internal/predicates";

const IDENTITY: IAutoMovieTransform = {
  translation: { x: 0, y: 0, z: 0 },
  rotation: { x: 0, y: 0, z: 0, w: 1 },
  scale: { x: 1, y: 1, z: 1 },
};

const node = (
  id: string,
  translation = { x: 0, y: 0, z: 0 },
): IAutoMovieNode => ({
  id,
  name: null,
  parent: null,
  kind: "group",
  transform: { ...IDENTITY, translation },
  mesh: null,
  camera: null,
  light: null,
  skin: null,
});

/** Rotate the prefixed hinge 90° about +Y (quat `(0, sin45, 0, cos45)`). */
const HINGE_CLIP: IAutoMovieClip = {
  id: "clip",
  name: null,
  duration: 1,
  loop: false,
  tracks: [
    {
      channel: { kind: "node", node: "actor/hinge", path: "rotation" },
      times: [0],
      values: [0, Math.SQRT1_2, 0, Math.SQRT1_2],
      interpolation: "linear",
    },
  ],
};

const COPY_PROFILE: IAutoMovieProfile = {
  id: "mirror-profile",
  name: "mirror",
  controls: [],
  drivers: [
    {
      type: "copy",
      owner: "mirror",
      source: "pivot",
      translation: false,
      rotation: true,
      scale: false,
      influence: 1,
    },
  ],
  limits: [],
};

const COPY_BINDING: IAutoMovieProfileBinding = {
  profile: "mirror-profile",
  root: "actor/hinge",
  instanceName: null,
  boneMap: { pivot: "hinge", mirror: "handle" },
};

const AIM_PROFILE: IAutoMovieProfile = {
  id: "gaze-profile",
  name: "gaze",
  controls: [],
  drivers: [
    {
      type: "aim",
      owner: "eye",
      target: "near",
      aimAxis: { x: 1, y: 0, z: 0 },
      upAxis: { x: 0, y: 1, z: 0 },
      worldUp: { x: 0, y: 1, z: 0 },
      influence: 1,
    },
  ],
  limits: [],
};

const AIM_BINDING: IAutoMovieProfileBinding = {
  profile: "gaze-profile",
  root: "eye",
  instanceName: null,
  boneMap: { eye: "eye", near: "posX" },
};

/** X-basis column of a column-major world matrix. */
const basisX = (m: number[]): [number, number, number] => [m[0]!, m[1]!, m[2]!];

/**
 * Profile-declared drivers actually drive: a bound copy driver moves its
 * dependent channel inside resolveFrame, a prefix-bound profile lands on a
 * bridged actor's prefixed nodes, and profile-bound world drivers apply before
 * directly-passed ones (the caller's word is final).
 *
 * Scenarios:
 *
 * 1. A profile copy driver, bound with `nodePrefix: "actor/"` onto prefixed nodes,
 *    copies the hinge's 90° rotation onto the handle: both world matrices' X
 *    basis lands at `(0, 0, -1)`.
 * 2. Without the profile the handle stays at rest (X basis `(1, 0, 0)`) — the
 *    negative twin proving the profile did it.
 * 3. World-pass precedence: a profile aim driver points the eye's X axis at a +X
 *    target while a direct aim driver on the same owner points it at a −X
 *    target — the direct driver applies after and wins (X basis `(-1, 0, 0)`);
 *    with only the profile aim the X basis stays `(1, 0, 0)` toward +X.
 */
export const test_resolve_frame_profile_drivers = (): void => {
  const nodes = [
    node("actor/hinge", { x: 0, y: 1, z: 0 }),
    node("actor/handle"),
  ];
  const driven = resolveFrame({
    nodes,
    clip: HINGE_CLIP,
    limits: [],
    profiles: [
      { profile: COPY_PROFILE, binding: COPY_BINDING, nodePrefix: "actor/" },
    ],
    seconds: 0,
  });
  const hingeX = basisX(driven.world.get("actor/hinge")!);
  const handleX = basisX(driven.world.get("actor/handle")!);
  TestValidator.predicate(
    "hinge rotated 90° about Y",
    nclose(hingeX[0], 0) && nclose(hingeX[1], 0) && nclose(hingeX[2], -1),
  );
  TestValidator.predicate(
    "profile copy drove the handle",
    nclose(handleX[0], 0) && nclose(handleX[1], 0) && nclose(handleX[2], -1),
  );

  const bare = resolveFrame({
    nodes,
    clip: HINGE_CLIP,
    limits: [],
    seconds: 0,
  });
  const bareHandleX = basisX(bare.world.get("actor/handle")!);
  TestValidator.predicate(
    "without the profile the handle rests",
    nclose(bareHandleX[0], 1) && nclose(bareHandleX[2], 0),
  );

  const gazeNodes = [
    node("eye"),
    node("posX", { x: 1, y: 0, z: 0 }),
    node("negX", { x: -1, y: 0, z: 0 }),
  ];
  const contested = resolveFrame({
    nodes: gazeNodes,
    clip: null,
    limits: [],
    drivers: [
      {
        type: "aim",
        owner: "eye",
        target: "negX",
        aimAxis: { x: 1, y: 0, z: 0 },
        upAxis: { x: 0, y: 1, z: 0 },
        worldUp: { x: 0, y: 1, z: 0 },
        influence: 1,
      },
    ],
    profiles: [{ profile: AIM_PROFILE, binding: AIM_BINDING }],
    seconds: 0,
  });
  const contestedX = basisX(contested.world.get("eye")!);
  TestValidator.predicate(
    "direct aim applies after the profile's and wins",
    nclose(contestedX[0], -1) && nclose(contestedX[2], 0),
  );

  const profileOnly = resolveFrame({
    nodes: gazeNodes,
    clip: null,
    limits: [],
    profiles: [{ profile: AIM_PROFILE, binding: AIM_BINDING }],
    seconds: 0,
  });
  const profileOnlyX = basisX(profileOnly.world.get("eye")!);
  TestValidator.predicate(
    "profile aim alone points at +X",
    nclose(profileOnlyX[0], 1) && nclose(profileOnlyX[2], 0),
  );
};
