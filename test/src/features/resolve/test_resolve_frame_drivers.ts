import { resolveFrame } from "@automovie/engine";
import {
  IautomovieCopyDriver,
  IautomovieIKDriver,
  IautomovieNode,
  IautomovieTransform,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { nclose } from "../internal/predicates";

const node = (id: string, x: number): IautomovieNode => ({
  id,
  name: null,
  parent: null,
  kind: "group",
  transform: {
    translation: { x, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0, w: 1 },
    scale: { x: 1, y: 1, z: 1 },
  } as IautomovieTransform,
  mesh: null,
  camera: null,
  light: null,
  skin: null,
});

/**
 * The DRIVE pass wired through {@link resolveFrame}: channel-space drivers run
 * between SAMPLE and COMPOSE so their output reaches the world matrix, while
 * world-space drivers come back in `deferredDrivers`.
 *
 * Scenario: with no clip (rest pose), a full-influence `copy` makes node `a`
 * follow node `b`'s translation; the composed world matrix for `a` shows b's
 * x=5, and an accompanying `ik` driver (not yet handled) is surfaced as
 * deferred.
 */
export const test_resolve_frame_drivers = (): void => {
  const nodes = [node("a", 1), node("b", 5)];
  const copy: IautomovieCopyDriver = {
    type: "copy",
    owner: "a",
    source: "b",
    translation: true,
    rotation: false,
    scale: false,
    influence: 1,
  };
  const ik: IautomovieIKDriver = {
    type: "ik",
    chain: ["a", "b"],
    goal: "b",
    pole: null,
    solver: "twoBone",
    iterations: null,
    influence: 1,
  };

  const out = resolveFrame({
    nodes,
    clip: null,
    limits: [],
    drivers: [copy, ik],
    seconds: 0,
  });

  TestValidator.predicate(
    "copy driver reaches the world matrix",
    nclose(out.world.get("a")![12]!, 5),
  );
  TestValidator.equals("ik driver deferred", out.deferredDrivers.length, 1);
};
