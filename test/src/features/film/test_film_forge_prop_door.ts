import { forgeProp, resolveFrame } from "@automovie/engine";
import { IAutoMovieClip } from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { nclose } from "../internal/predicates";
import { createDoorPropSpec } from "./test_film_forge_prop";

/** Quat values for a rotation of `deg` about +Y. */
const yQuat = (deg: number): number[] => {
  const half = (deg * Math.PI) / 360;
  return [0, Math.sin(half), 0, Math.cos(half)];
};

const swing = (deg: number): IAutoMovieClip => ({
  id: "swing",
  name: null,
  duration: 1,
  loop: false,
  tracks: [
    {
      channel: { kind: "node", node: "hinge", path: "rotation" },
      times: [0],
      values: yQuat(deg),
      interpolation: "linear",
    },
  ],
});

const basisX = (m: number[]): [number, number, number] => [m[0]!, m[1]!, m[2]!];

/**
 * The authored-data-to-executable-constraint round trip: a door forged by
 * forgeProp, not hand-assembled, drives resolveFrame, and the constraint the
 * AUTHOR declared as data clamps and reports while the declared driver drives.
 * This is the #603 promise made whole: an agent ships a spec, the engine
 * enforces it.
 *
 * Scenarios:
 *
 * 1. The forged spec passes the gates, and its articulation feeds resolveFrame
 *    directly: an in-range 90° swing produces no violations and the mirror node
 *    follows the hinge (the declared copy driver drives).
 * 2. An over-limit 150° swing clamps to exactly the 110° unit quaternion, the
 *    hinge's world X basis lands at `(cos110°, 0, −sin110°)`, with the
 *    violations tagged by the FORGED profile's id.
 */
export const test_film_forge_prop_door = (): void => {
  const forged = forgeProp(createDoorPropSpec());
  TestValidator.equals("the door forges", forged.success, true);
  if (forged.success !== true) return;

  const articulation = forged.prop.articulation!;
  const open = resolveFrame({
    nodes: articulation.nodes,
    clip: swing(90),
    limits: [],
    profiles: [
      { profile: articulation.profile, binding: articulation.binding },
    ],
    seconds: 0,
  });
  TestValidator.equals("90° swing passes", open.violations.length, 0);
  const mirrorX = basisX(open.world.get("handleMirror")!);
  TestValidator.predicate(
    "declared driver mirrors the hinge",
    nclose(mirrorX[0], 0) && nclose(mirrorX[2], -1),
  );

  const slammed = resolveFrame({
    nodes: articulation.nodes,
    clip: swing(150),
    limits: [],
    profiles: [
      { profile: articulation.profile, binding: articulation.binding },
    ],
    seconds: 0,
  });
  TestValidator.predicate(
    "over-swing violations tagged by the forged profile",
    slammed.violations.length > 0 &&
      slammed.violations.every((v) => v.profile === "door-profile"),
  );
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
