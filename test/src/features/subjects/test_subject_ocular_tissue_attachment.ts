import { measureAutoMovieMeshClearance } from "@automovie/engine";
import { TestValidator } from "@nestia/e2e";

import {
  portraitEyeShape,
  portraitEyeSockets,
} from "../../subjects/generated-korean-girl-01/configuration";
import { referenceControlNet } from "../../subjects/generated-korean-girl-01/controlNet";
import { createPortraitEyeComponent } from "../../subjects/generated-korean-girl-01/eyes";

/**
 * Optional ocular tissue is owned by its eye and consumes the same completed
 * boundary without changing skin constraints or existing optical geometry.
 * Scenarios:
 * 1. Both sides enable, omit and independently disable the two surfaces through
 *    the real fit/attach/finish path; all other parts retain their geometry.
 * 2. Editing a nested caller profile after construction cannot alter an eye.
 */
export const test_subject_ocular_tissue_attachment = (): void => {
  const host = {
    positions: referenceControlNet.positions,
    indices: referenceControlNet.indices,
    viewRay: referenceControlNet.viewRay,
  };
  for (const socket of portraitEyeSockets) {
    const profile = { ...portraitEyeShape.tissues! };
    const shape = {
      ...portraitEyeShape,
      tissues: profile,
      browFibres: 0,
      upperLashes: 1,
      sampling: { eyeColumns: 12, eyeRows: 4, irisColumns: 12, irisRows: 2 },
    };
    const eye = createPortraitEyeComponent(socket, shape);
    const complete = (
      component: ReturnType<typeof createPortraitEyeComponent>,
    ) => {
      const plan = component.fit(host);
      const cage = {
        positions: host.positions.map((p) => [...p]),
        indices: [] as number[],
        groups: [] as number[],
      };
      for (const constraint of plan.constraints)
        cage.positions[constraint.vertex] = [...constraint.target];
      return {
        constraints: plan.constraints,
        parts: plan.attach(cage, cage.positions, () => 0).finish(cage),
      };
    };
    const before = complete(eye);
    const cornea = before.parts.find(
      (part) => part.id === socket.name + "-cornea",
    )!;
    const margin = before.parts.find(
      (part) => part.id === socket.name + "-lower-lid-margin",
    )!;
    if (cornea.geometry.type !== "mesh" || margin.geometry.type !== "mesh")
      throw new Error("The ocular contact scenario needs resident surfaces.");
    const clearance = measureAutoMovieMeshClearance(
      margin.geometry.mesh,
      cornea.geometry.mesh,
      "z",
    );
    TestValidator.predicate(
      "wet margin clears the complete optical shell",
      clearance.length > 0 &&
        clearance.every((face) => face.minimum >= 0.00002 - 1e-10),
    );
    profile.cornerLength = 2;
    profile.lowerMarginWidth = 0.1;
    TestValidator.equals("eye owns nested tissue shape", complete(eye), before);
    for (const tissues of [
      undefined,
      { ...profile, cornerLength: 0 },
      { ...profile, lowerMarginWidth: 0 },
    ]) {
      const variant = complete(
        createPortraitEyeComponent(socket, { ...shape, tissues }),
      );
      TestValidator.equals(
        "tissue does not reshape skin seam",
        variant.constraints,
        before.constraints,
      );
      const retained = (parts: typeof before.parts) =>
        parts.filter(
          (part) =>
            part.material !== "ocular-corner" &&
            part.material !== "ocular-margin",
        );
      TestValidator.equals(
        "optics retain their exact geometry",
        retained(variant.parts),
        retained(before.parts),
      );
      TestValidator.equals(
        "corner follows requested state",
        variant.parts.some((p) => p.material === "ocular-corner"),
        tissues !== undefined && tissues.cornerLength > 0,
      );
      TestValidator.equals(
        "lower margin follows requested state",
        variant.parts.some((p) => p.material === "ocular-margin"),
        tissues !== undefined && tissues.lowerMarginWidth > 0,
      );
    }
    TestValidator.equals(
      "both tissues are attached",
      before.parts.filter(
        (p) => p.material === "ocular-corner" || p.material === "ocular-margin",
      ).length,
      2,
    );
  }
};
