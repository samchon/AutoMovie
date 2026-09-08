import { createAutoMovieMeshDepthSampler } from "@automovie/engine";
import { TestValidator } from "@nestia/e2e";

import {
  portraitEyeShape,
  portraitEyeSockets,
} from "../../subjects/generated-korean-girl-01/configuration";
import { referenceControlNet } from "../../subjects/generated-korean-girl-01/controlNet";
import {
  type IPortraitEyeShape,
  appendPortraitEyeMargins,
  createPortraitEyeComponent,
} from "../../subjects/generated-korean-girl-01/eyes";
import { buildPortraitHead } from "../../subjects/generated-korean-girl-01/head";
import { throwsError } from "../internal/predicates";

/**
 * Corneal contact belongs to the actual shared refined eyelids. Projecting a
 * separate decorative strip would leave the original skin penetrating the lens.
 *
 * Scenarios:
 * 1. A frontal eye's complete refined lid region clears its resident cornea by
 *    the declared thickness. Independent Z-depth queries verify the actual
 *    triangles, and the untouched twin has measurable penetrating vertices.
 * 2. The cornea itself and a remote chin vertex stay unchanged. Omitted contact
 *    exactly matches explicit globe mode; incompatible/unknown modes refuse.
 * 3. Standalone margin attachment without a group retains the base skin region.
 */
export const test_subject_corneal_contact = (): void => {
  const host = { ...referenceControlNet, viewRay: [0, 0, 1] };
  const shape: IPortraitEyeShape = {
    ...portraitEyeShape,
    cornealBoundary: "limbus",
    lidContact: undefined,
    browFibres: 0,
    upperLashes: 1,
    sampling: { eyeColumns: 8, eyeRows: 4, irisColumns: 24, irisRows: 4 },
  };
  const cage = {
    positions: referenceControlNet.positions.map((point) => [...point]),
    indices: [] as number[],
    groups: [] as number[],
  };
  appendPortraitEyeMargins(
    cage,
    referenceControlNet.positions,
    portraitEyeSockets[0],
    shape,
  );
  TestValidator.predicate(
    "standalone margins retain the base skin region",
    cage.groups.length > 0 && cage.groups.every((group) => group === 0),
  );
  const build = (s: IPortraitEyeShape) =>
    buildPortraitHead(
      host,
      [createPortraitEyeComponent(portraitEyeSockets[0], s)],
      1,
    );
  const before = build(shape),
    after = build({ ...shape, lidContact: "cornea" });
  TestValidator.equals(
    "omitted contact preserves globe mode",
    before,
    build({ ...shape, lidContact: "globe" }),
  );
  const optical = after.parts.find((p) => p.id === "right-cornea"),
    lid = after.parts.find((p) => p.id === "right-eyelids");
  if (optical?.geometry.type !== "mesh" || lid?.geometry.type !== "mesh")
    throw new Error(
      "The contacted eye needs resident optical and lid surfaces.",
    );
  TestValidator.equals(
    "contact does not move the optical authority",
    optical,
    before.parts.find((p) => p.id === "right-cornea"),
  );
  TestValidator.equals(
    "remote face stays unchanged",
    after.refined.positions[152],
    before.refined.positions[152],
  );
  const sample = createAutoMovieMeshDepthSampler(optical.geometry.mesh, "z");
  let covered = 0,
    penetrating = 0;
  const positions = lid.geometry.mesh.positions;
  for (let i = 0; i < positions.length; i += 3) {
    const hit = sample(positions[i], positions[i + 1]);
    if (hit === null) continue;
    covered++;
    TestValidator.predicate(
      "rendered lid samples clear the actual cornea",
      positions[i + 2] >= hit.maximum + shape.lidThickness / 1000 - 1e-10,
    );
  }
  for (let i = 0; i < before.refined.positions.length; i++) {
    const a = before.refined.positions[i],
      b = after.refined.positions[i];
    if (b[2] - a[2] < 1e-6) continue;
    const hit = sample(a[0] / 1000, a[1] / 1000);
    if (hit !== null && a[2] / 1000 < hit.maximum) penetrating++;
  }
  TestValidator.predicate(
    "nonempty contact and penetrating negative twin",
    covered > 0 && penetrating > 0,
  );
  for (const change of [
    { lidContact: "unknown" as never },
    { lidContact: "cornea" as const, cornealBoundary: "aperture" as const },
  ])
    TestValidator.predicate(
      "incoherent contact mode refuses",
      throwsError(
        () =>
          createPortraitEyeComponent(portraitEyeSockets[0], {
            ...shape,
            ...change,
          }),
        "Corneal lid contact",
      ),
    );
};
