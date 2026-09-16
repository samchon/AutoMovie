import {
  buildPortraitHead,
  buildPortraitMouth,
  createPortraitMouthComponent,
  portraitMeshBuffers,
} from "@automovie/human";
import { TestValidator } from "@nestia/e2e";

import {
  portraitMouthShape,
  portraitMouthSocket,
} from "../../subjects/generated-korean-girl-01/configuration";
import { referenceControlNet } from "../../subjects/generated-korean-girl-01/controlNet";
import { throwsError } from "../internal/predicates";

/**
 * The real mouth component owns a selected chamber and passes it to the final
 * refined lining; its dimensions cannot move external skin or the lip aperture.
 *
 * Scenarios:
 * 1. A nonzero chamber changes only interior XY, retaining the final rim, depth,
 *    connectivity and all other parts. Mutating its source does not change it.
 * 2. Closed performance omits the cavity but still rejects invalid dimensions.
 * 3. A chamber without an explicit connected wall refuses in both the factory
 *    and direct finisher, including a closed performance request.
 */
export const test_subject_mouth_chamber_component = (): void => {
  const shape = {
    ...portraitMouthShape,
    crowns: [],
    cavityWall: 0.75,
    cavityChamber: {
      horizontalExpansion: 5,
      verticalExpansion: 10,
      transitionDepth: 5,
    },
  };
  const component = createPortraitMouthComponent(portraitMouthSocket, shape);
  shape.cavityChamber.horizontalExpansion = -1;
  const changed = buildPortraitHead(referenceControlNet, [component], 1);
  const baseline = buildPortraitHead(
    referenceControlNet,
    [
      createPortraitMouthComponent(portraitMouthSocket, {
        ...shape,
        cavityChamber: undefined,
      }),
    ],
    1,
  );
  const cavity = changed.parts.find((p) => p.id === "oral-cavity")!,
    old = baseline.parts.find((p) => p.id === "oral-cavity")!;
  if (cavity.geometry.type !== "mesh" || old.geometry.type !== "mesh")
    throw new Error("Expected lining meshes.");
  const mesh = cavity.geometry.mesh,
    before = old.geometry.mesh,
    count = (mesh.positions.length / 3 - 1) / 24;
  TestValidator.equals(
    "actual subdivided rim exact",
    mesh.positions.slice(0, count * 3),
    before.positions.slice(0, count * 3),
  );
  TestValidator.equals(
    "all noncavity parts exact",
    changed.parts.filter((p) => p.id !== "oral-cavity"),
    baseline.parts.filter((p) => p.id !== "oral-cavity"),
  );
  TestValidator.equals(
    "depth exact",
    mesh.positions.filter((_v, i) => i % 3 === 2),
    before.positions.filter((_v, i) => i % 3 === 2),
  );
  TestValidator.predicate(
    "consumer uses chamber",
    mesh.positions.some((v, i) => Math.abs(v - before.positions[i]) > 0.001),
  );
  portraitMeshBuffers(mesh);
  const performance = { lipPart: 0, observedLipPart: 10 };
  const closed = buildPortraitHead(
    referenceControlNet,
    [
      createPortraitMouthComponent(
        portraitMouthSocket,
        {
          ...shape,
          cavityChamber: { ...shape.cavityChamber, horizontalExpansion: 5 },
        },
        performance,
      ),
    ],
    1,
  );
  TestValidator.predicate(
    "closed cavity omitted",
    !closed.parts.some((p) => p.id === "oral-cavity"),
  );
  TestValidator.predicate(
    "closed invalid chamber refuses",
    throwsError(
      () =>
        createPortraitMouthComponent(portraitMouthSocket, shape, performance),
      "Oral chamber",
    ),
  );
  TestValidator.predicate(
    "direct invalid chamber refuses",
    throwsError(
      () =>
        buildPortraitMouth(
          referenceControlNet.positions,
          portraitMouthSocket,
          shape,
          performance,
        ),
      "Oral chamber",
    ),
  );
  const missingWall = {
    ...shape,
    cavityWall: undefined,
    cavityChamber: { ...shape.cavityChamber, horizontalExpansion: 5 },
  };
  TestValidator.predicate(
    "factory requires selected wall",
    throwsError(
      () =>
        createPortraitMouthComponent(
          portraitMouthSocket,
          missingWall,
          performance,
        ),
      "wall fraction",
    ),
  );
  TestValidator.predicate(
    "direct requires selected wall",
    throwsError(
      () =>
        buildPortraitMouth(
          referenceControlNet.positions,
          portraitMouthSocket,
          missingWall,
          performance,
        ),
      "wall fraction",
    ),
  );
};
