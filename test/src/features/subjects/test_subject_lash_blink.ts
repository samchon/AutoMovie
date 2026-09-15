import { createPortraitEyeComponent } from "@automovie/human";
import type { IAutoMovieMesh } from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { coarseHumanFaceFixture } from "../internal/humanFaceFixture";
import {
  portraitEyelashEyeFixture,
  portraitEyelashFixture,
  portraitEyelashRingCenter,
} from "../internal/portraitEyelashFixture";
import { nclose, vclose } from "../internal/predicates";

/**
 * The new strand follows the current closed margin, not the observed open root.
 *
 * Scenarios:
 * 1. Closed legacy and explicit-profile eyes share the same root and non-lash
 *    parts, including the closed lid and full resident optics.
 * 2. The root is below the observed upper margin, while a straight eight-mm
 *    profile keeps its length and turns down with the closing lid.
 */
export const test_subject_lash_blink = (): void => {
  const source = coarseHumanFaceFixture("lash-blink");
  const shape = source.basis.recipe.eye,
    socket = source.basis.bindings.eyes.right;
  const performance = { blink: 1, observedBlink: 0, yaw: 0, pitch: 0 };
  const build = (selected = false) =>
    portraitEyelashEyeFixture(
      createPortraitEyeComponent(
        socket,
        {
          ...shape,
          upperLashProfile: selected ? portraitEyelashFixture() : undefined,
        },
        performance,
      ),
      source.basis.host,
    );
  const legacy = build(),
    changed = build(true);
  const lash = (model: typeof changed): IAutoMovieMesh =>
    (
      model.parts.find((p) => p.id === "right-upper-lash-0")!.geometry as {
        type: "mesh";
        mesh: IAutoMovieMesh;
      }
    ).mesh;
  const rest = (model: typeof changed) =>
    model.parts.filter((p) => !p.id.includes("-upper-lash-"));
  TestValidator.equals(
    "closed non-lash parts unchanged",
    rest(changed),
    rest(legacy),
  );
  TestValidator.equals("closed skin unchanged", changed.cage, legacy.cage);
  const mesh = lash(changed),
    root = portraitEyelashRingCenter(mesh, 0);
  TestValidator.predicate(
    "same closed root",
    vclose(root, portraitEyelashRingCenter(lash(legacy), 0), 1e-10),
  );
  const observedUpper = socket.top.map(
    (i) => source.basis.host.positions[i][1],
  );
  TestValidator.predicate(
    "root moved below observed upper crest",
    root.y < Math.max(...observedUpper) / 1000 - 0.001,
  );
  TestValidator.predicate(
    "closed strand retains length",
    nclose(
      Math.hypot(
        portraitEyelashRingCenter(mesh, 12).x - root.x,
        portraitEyelashRingCenter(mesh, 12).y - root.y,
        portraitEyelashRingCenter(mesh, 12).z - root.z,
      ),
      0.008,
      1e-10,
    ),
  );
  TestValidator.predicate(
    "closed strand turns down with the lid",
    portraitEyelashRingCenter(mesh, 12).y < root.y - 0.0001,
  );
};
