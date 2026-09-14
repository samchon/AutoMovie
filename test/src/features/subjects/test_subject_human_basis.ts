import {
  portraitCranialChinHeight,
  resolveHumanFaceDocument,
} from "@automovie/human";
import { TestValidator } from "@nestia/e2e";

import {
  portraitCheekShape,
  portraitCheekSockets,
  portraitDentalPlacement,
  portraitDentalRow,
  portraitDentalSocket,
} from "../../subjects/generated-korean-girl-01/configuration";
import { humanFaceFixture } from "../internal/humanFaceFixture";
import { throwsError } from "../internal/predicates";

/**
 * Basis admission distinguishes a supported finite facial host from geometry build and likeness acceptance.
 *
 * Scenarios:
 * 1. Unknown versions, malformed host coordinates/triangles/view rays and blank identities refuse.
 * 2. Side mismatches, missing cheek/maxillary attachments and duplicate dental ownership refuse.
 * 3. An observed blink must remain invertible, while current full closure is valid.
 * 4. Cranial defaults use the whole oval's actual lowest height, not only the central chin landmark.
 */
export const test_subject_human_basis = (): void => {
  const base = humanFaceFixture();
  resolveHumanFaceDocument(base);
  const bad = (
    change: (document: ReturnType<typeof humanFaceFixture>) => void,
  ) => {
    const document = structuredClone(base);
    change(document);
    TestValidator.predicate(
      "basis refusal",
      throwsError(() => resolveHumanFaceDocument(document)),
    );
  };
  bad((document) => {
    document.version = "unknown" as typeof document.version;
  });
  bad((document) => {
    document.basis.topology = "unknown" as typeof document.basis.topology;
  });
  for (const key of ["id", "name"] as const)
    bad((document) => {
      document[key] = " ";
    });
  bad((document) => {
    document.basis.id = "";
  });
  bad((document) => {
    document.basis.host.positions.pop();
  });
  bad((document) => {
    document.basis.host.positions[0] = [0, 0];
  });
  bad((document) => {
    document.basis.host.positions[0][0] = NaN;
  });
  bad((document) => {
    document.basis.host.indices = [];
  });
  bad((document) => {
    document.basis.host.indices.pop();
  });
  for (const id of [-1, 468, 0.5])
    bad((document) => {
      document.basis.host.indices[0] = id;
    });
  for (const ray of [
    [0, 0],
    [0, 0, NaN],
    [0, 0, 0],
    [0, 0, 2],
  ])
    bad((document) => {
      document.basis.host.viewRay = ray;
    });
  bad((document) => {
    document.basis.bindings.eyes.right.name = "left";
  });
  bad((document) => {
    document.basis.bindings.eyes.left.name = "right";
  });
  bad((document) => {
    document.basis.recipe.cheek = structuredClone(portraitCheekShape);
  });
  for (const side of ["left", "right"] as const)
    bad((document) => {
      document.basis.bindings.cheeks = structuredClone({
        right: portraitCheekSockets[0],
        left: portraitCheekSockets[1],
      });
      document.basis.bindings.cheeks[side].side =
        side === "right" ? "left" : "right";
    });
  const dental = structuredClone(base);
  dental.basis.recipe.dentition = {
    row: portraitDentalRow,
    placement: portraitDentalPlacement,
  };
  TestValidator.predicate(
    "missing maxillary binding",
    throwsError(() => resolveHumanFaceDocument(dental)),
  );
  dental.basis.bindings.dentition = portraitDentalSocket;
  TestValidator.predicate(
    "competing upper crowns",
    throwsError(() => resolveHumanFaceDocument(dental)),
  );
  dental.basis.recipe.mouth.crowns = [];
  resolveHumanFaceDocument(dental);
  const mandibular = structuredClone(base);
  mandibular.basis.recipe.lowerDentition = {
    row: portraitDentalRow,
    placement: { drop: 5, recess: 6 },
  };
  TestValidator.predicate(
    "missing mandibular hinge",
    throwsError(() => resolveHumanFaceDocument(mandibular)),
  );
  mandibular.basis.bindings.jawHinge = { x: 0, y: 0, z: -50 };
  const lower = resolveHumanFaceDocument(mandibular).recipe.lowerDentition!;
  TestValidator.equals(
    "independent mandibular dimensions",
    lower,
    mandibular.basis.recipe.lowerDentition,
  );
  lower.row.halfWidth = 900;
  TestValidator.predicate(
    "mandibular recipe is owned",
    mandibular.basis.recipe.lowerDentition.row.halfWidth !== 900,
  );
  for (const side of ["right", "left"] as const)
    bad((document) => {
      document.basis.expression.blink = { [side]: 0.951 };
    });
  base.basis.expression.blink = { right: 0.95, left: 0.95 };
  base.expression = { blink: { right: 1, left: 1 } };
  resolveHumanFaceDocument(base);
  base.basis.host.positions[152][1] = -60;
  base.basis.host.positions[377][1] = -100;
  TestValidator.equals(
    "asymmetric lower-oval datum",
    portraitCranialChinHeight(base.basis.host.positions),
    -100,
  );
  TestValidator.equals(
    "same datum reaches default floor",
    resolveHumanFaceDocument(base).recipe.cranium!.stations![0].floor,
    -104.5,
  );
  TestValidator.predicate(
    "missing cranial boundary",
    throwsError(() => portraitCranialChinHeight([])),
  );
};
