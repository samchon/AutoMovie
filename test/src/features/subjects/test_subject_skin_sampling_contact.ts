import { refinePortraitSurfaceSampling } from "@automovie/human/geometry/refinePortraitSurfaceSampling";
import { sealPortraitContactSeams } from "@automovie/human/geometry/sealPortraitContactSeams";
import { TestValidator } from "@nestia/e2e";

import { contactSeamFixture } from "../internal/contactSeamFixture";

/**
 * Refining a crease beside closed lips preserves their later exact weld.
 *
 * Scenarios:
 * 1. A support above an already coincident oral rim refines the surrounding
 *    skin without giving the two contacting rim sides different samples.
 * 2. The closed contact still seals and original attachment coordinates remain
 *    available; the same support can refine an ordinary open rim.
 */
export const test_subject_skin_sampling_contact = (): void => {
  const mesh = contactSeamFixture();
  mesh.positions.push([3, 2, 0]);
  mesh.indices.push(2, 12, 3);
  mesh.groups.push(0);
  const before = structuredClone(mesh);
  const fields = [
    {
      center: { x: 0, y: 0.001, z: 0.0005 },
      radius: { x: 0.004, y: 0.0001, z: 0.002 },
      displacement: { x: 0, y: 0, z: -0.00001 },
      stretch: { x: 0, y: 0, z: 0 },
    },
  ];
  // This complete closure is valid before local crease sampling.
  sealPortraitContactSeams(mesh, [6]);
  const refined = refinePortraitSurfaceSampling(mesh, fields, 0.5);
  TestValidator.predicate(
    "surrounding skin refines",
    refined.positions.length > mesh.positions.length,
  );
  sealPortraitContactSeams(refined, [6]);
  TestValidator.equals(
    "original attachment coordinates",
    refined.positions.slice(0, mesh.positions.length),
    mesh.positions,
  );
  TestValidator.equals("caller preserved", mesh, before);
  const open = structuredClone(mesh);
  open.positions[10][1] = -0.3;
  open.positions[11][1] = -0.3;
  TestValidator.predicate(
    "open support still refines",
    refinePortraitSurfaceSampling(open, fields, 0.5).positions.length >
      open.positions.length,
  );
};
