import { TestValidator } from "@nestia/e2e";

import { blendPortraitSkin } from "../../subjects/blendPortraitSkin";
import { portraitEyeShape } from "../../subjects/generated-korean-girl-01/configuration";
import { createPortraitEyeComponent } from "../../subjects/generated-korean-girl-01/eyes";
import { assertPortraitSkinTopology } from "../../subjects/portraitSkinTopology";
import { createPortraitReservationHost } from "../internal/portraitReservation";
import { throwsError } from "../internal/predicates";

/**
 * The actual eye consumer installs its rows inside reserved skin and shares a
 * bridge with unchanged surrounding coordinates. Optical dimensions remain a
 * separate input; changing attachment mode is not an eye-size correction.
 *
 * Scenarios:
 * 1. Two aperture widths on nested planar rings preserve outside controls and
 *    close every shared edge around exactly one declared ocular opening.
 * 2. Mutating the caller's mode after construction does not change the fitted
 *    eye. An unrelated adaptation that invalidates nesting refuses before any
 *    cage mutation. An unknown attachment mode refuses at construction.
 */
export const test_subject_eye_skin_reservation = (): void => {
  const host = createPortraitReservationHost();
  host.positions = host.positions.map((point) =>
    point.map((value) => value * 4),
  );
  const socket = {
    name: "left" as const,
    top: [3, 2, 1],
    bottom: [3, 4, 1],
    iris: 0,
    browTop: [2],
    browBottom: [2],
  };
  for (const widthScale of [1, 1.4]) {
    const shape = {
      ...portraitEyeShape,
      widthScale,
      openingScale: 1,
      browFibres: 0,
    };
    const component = createPortraitEyeComponent(socket, shape);
    shape.skinAttachment = undefined;
    const plan = component.fit(host);
    TestValidator.predicate(
      "reserved mode owns its input without spreading the seam",
      plan.constraints.length === 5 &&
        plan.constraints.every((c) => c.reach === 0),
    );
    const seam = plan.constraints.find(
      (constraint) => constraint.vertex === 3,
    )!;
    TestValidator.predicate(
      "another component cannot contradict the internal seam",
      throwsError(
        () =>
          blendPortraitSkin(host.positions, host.indices, [
            ...plan.constraints,
            {
              ...seam,
              target: seam.target.map(
                (value, axis) => value + (axis === 2 ? 1 : 0),
              ),
            },
          ]),
        "different positions",
      ),
    );
    const source = blendPortraitSkin(
      host.positions,
      host.indices,
      plan.constraints,
    );
    const cut = new Set(plan.cutFaces);
    const indices = host.indices.filter(
      (_id, i) => !cut.has(Math.floor(i / 3)),
    );
    const cage = {
      positions: source.map((p) => [...p]),
      indices,
      groups: new Array(indices.length / 3).fill(0),
    };
    const attached = plan.attach(cage, source, () => 1);
    assertPortraitSkinTopology(cage, attached.openings);
    TestValidator.equals("one optical opening", attached.openings.length, 1);
    TestValidator.equals(
      "host boundary stays in place",
      cage.positions.slice(5, host.positions.length),
      host.positions.slice(5),
    );
    const invalid = {
      positions: source.map((p, id) =>
        id >= 5 ? [p[0] + 100, p[1], p[2]] : [...p],
      ),
      indices: [...indices],
      groups: new Array(indices.length / 3).fill(0),
    };
    const before = structuredClone(invalid);
    TestValidator.predicate(
      "adapted join refuses invalid nesting",
      throwsError(() => plan.attach(invalid, source, () => 1)),
    );
    TestValidator.equals("join admission precedes mutation", invalid, before);
  }
  const invalidShape = { ...portraitEyeShape };
  Reflect.set(invalidShape, "skinAttachment", "unknown");
  TestValidator.predicate(
    "unknown attachment mode",
    throwsError(
      () => createPortraitEyeComponent(socket, invalidShape),
      "reserve or omitted",
    ),
  );
};
