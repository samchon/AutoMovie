import { createPortraitEyeComponent } from "@automovie/human";
import type { IAutoMovieMesh } from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { coarseHumanFaceFixture } from "../internal/humanFaceFixture";
import {
  portraitEyelashEyeFixture,
  portraitEyelashFixture,
  portraitEyelashRingCenter,
} from "../internal/portraitEyelashFixture";
import { throwsError, vclose } from "../internal/predicates";

/**
 * A fitted eye consumes optional lash shape without altering its other parts.
 *
 * Scenarios:
 * 1. Omission retains the legacy lash, while an explicit straight eight-mm
 *    profile changes the strand and preserves every non-lash part exactly.
 * 2. Out-of-envelope lash dimensions refuse before component fitting.
 */
export const test_subject_lash_component = (): void => {
  const source = coarseHumanFaceFixture("lash-unit");
  const shape = source.basis.recipe.eye,
    socket = source.basis.bindings.eyes.left;
  const neutral = portraitEyelashEyeFixture(
    createPortraitEyeComponent(socket, shape),
    source.basis.host,
  );
  const profile = portraitEyelashFixture();
  const changed = portraitEyelashEyeFixture(
    createPortraitEyeComponent(socket, { ...shape, upperLashProfile: profile }),
    source.basis.host,
  );
  const lash = (model: typeof changed): IAutoMovieMesh =>
    (
      model.parts.find((p) => p.id === "left-upper-lash-0")!.geometry as {
        type: "mesh";
        mesh: IAutoMovieMesh;
      }
    ).mesh;
  const rest = (model: typeof changed) =>
    model.parts.filter((p) => !p.id.includes("-upper-lash-"));
  TestValidator.equals(
    "non-lash parts unchanged",
    rest(changed),
    rest(neutral),
  );
  TestValidator.equals("attachment skin unchanged", changed.cage, neutral.cage);
  {
    const base = lash(neutral),
      next = lash(changed);
    const root = portraitEyelashRingCenter(next, 0);
    TestValidator.predicate(
      "same current root",
      vclose(root, portraitEyelashRingCenter(base, 0), 1e-10),
    );
    TestValidator.predicate(
      "eight mm in model metres",
      vclose(
        portraitEyelashRingCenter(next, 12),
        { ...root, z: root.z + 0.008 },
        1e-10,
      ),
    );
  }
  profile.length = 21;
  TestValidator.predicate(
    "component rejects invalid profile",
    throwsError(
      () =>
        createPortraitEyeComponent(socket, {
          ...shape,
          upperLashProfile: profile,
        }),
      "length",
    ),
  );
};
