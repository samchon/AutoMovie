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

const node = (id: string, parent: string | null = null): IAutoMovieNode => ({
  id,
  name: null,
  parent,
  kind: "group",
  transform:
    id === "hinge"
      ? { ...IDENTITY, translation: { x: 0, y: 1, z: 0 } }
      : IDENTITY,
  mesh: null,
  camera: null,
  light: null,
  skin: null,
});

const DOOR_NODES = [node("door"), node("hinge", "door"), node("handleMirror")];

/** Quat for a rotation of `deg` about +Y. */
const yQuat = (deg: number): [number, number, number, number] => {
  const half = (deg * Math.PI) / 360;
  return [0, Math.sin(half), 0, Math.cos(half)];
};

const doorClip = (deg: number): IAutoMovieClip => ({
  id: "swing",
  name: null,
  duration: 1,
  loop: false,
  tracks: [
    {
      channel: { kind: "node", node: "hinge", path: "rotation" },
      times: [0],
      values: [...yQuat(deg)],
      interpolation: "linear",
    },
  ],
});

const SIN55 = Math.sin((55 * Math.PI) / 180);
const COS55 = Math.cos((55 * Math.PI) / 180);

/**
 * The door profile a prop author (#603 forgeProp) would ship: a one-DOF +Y
 * hinge capped at 110°, expressed as per-component quaternion bounds (x/z
 * pinned to 0, `y ∈ [0, sin55°]`, `w ∈ [cos55°, 1]`, so the clamped corner is
 * exactly the 110° unit quaternion), plus a copy driver mirroring the hinge
 * onto a dependent node.
 */
const DOOR_PROFILE: IAutoMovieProfile = {
  id: "door-profile",
  name: "hinge",
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
  limits: [
    {
      channel: { kind: "node", node: "pivot", path: "rotation" },
      min: [0, 0, 0, COS55],
      max: [0, SIN55, 0, 1],
    },
  ],
};

const DOOR_BINDING: IAutoMovieProfileBinding = {
  profile: "door-profile",
  root: "door",
  instanceName: null,
  boneMap: { pivot: "hinge", mirror: "handleMirror" },
};

const basisX = (m: number[]): [number, number, number] => [m[0]!, m[1]!, m[2]!];

/**
 * The #603 gate proof: a skeleton-less prop declares its own constraint and
 * dependency purely as profile DATA (a hinge limited to 0..110° and a copy
 * driver), and resolveFrame enforces both. This is exactly what forgeProp will
 * author; "profiles are data, not code" as an executable fact.
 *
 * Scenarios:
 *
 * 1. An in-range 90° swing passes: no violations, the hinge's world X basis lands
 *    at `(0, 0, -1)` under its parent door.
 * 2. The profile's copy driver mirrors the hinge onto the dependent node in the
 *    same frame (same X basis): the declared dependency drives.
 * 3. An over-limit 150° swing clamps to exactly the 110° unit quaternion (the
 *    per-component corner): world X basis `(cos110°, 0, -sin110°)`, with the
 *    y-max and w-min breaches reported as violations tagged `profile:
 *    "door-profile"` on the hinge's rotation channel.
 */
export const test_resolve_profile_door = (): void => {
  const open = resolveFrame({
    nodes: DOOR_NODES,
    clip: doorClip(90),
    limits: [],
    profiles: [{ profile: DOOR_PROFILE, binding: DOOR_BINDING }],
    seconds: 0,
  });
  TestValidator.equals("90° swing passes", open.violations.length, 0);
  const openX = basisX(open.world.get("hinge")!);
  TestValidator.predicate(
    "hinge world rotated 90°",
    nclose(openX[0], 0) && nclose(openX[1], 0) && nclose(openX[2], -1),
  );
  const mirrorX = basisX(open.world.get("handleMirror")!);
  TestValidator.predicate(
    "profile driver mirrors the hinge",
    nclose(mirrorX[0], 0) && nclose(mirrorX[2], -1),
  );

  const slammed = resolveFrame({
    nodes: DOOR_NODES,
    clip: doorClip(150),
    limits: [],
    profiles: [{ profile: DOOR_PROFILE, binding: DOOR_BINDING }],
    seconds: 0,
  });
  TestValidator.equals(
    "150° swing breaches y-max and w-min",
    slammed.violations.length,
    2,
  );
  for (const violation of slammed.violations) {
    TestValidator.equals(
      "violation tagged with the door profile",
      violation.profile,
      "door-profile",
    );
    TestValidator.equals(
      "violation on the hinge rotation channel",
      violation.channel,
      "node:hinge:rotation",
    );
  }
  const cos110 = Math.cos((110 * Math.PI) / 180);
  const sin110 = Math.sin((110 * Math.PI) / 180);
  const slammedX = basisX(slammed.world.get("hinge")!);
  TestValidator.predicate(
    "over-swing clamps to exactly 110°",
    nclose(slammedX[0], cos110) &&
      nclose(slammedX[1], 0) &&
      nclose(slammedX[2], -sin110),
  );
};
