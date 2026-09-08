import { createAutoMovieMeshDepthSampler } from "@automovie/engine";
import { TestValidator } from "@nestia/e2e";

import { blendPortraitSkin } from "../../subjects/blendPortraitSkin";
import { portraitEyeShape } from "../../subjects/generated-korean-girl-01/configuration";
import {
  type IPortraitEyeShape,
  appendPortraitEyeMargins,
  createPortraitEyeComponent,
} from "../../subjects/generated-korean-girl-01/eyes";
import { applyPortraitFinalSurfaces } from "../../subjects/portraitFinalSurface";
import { subdivideControlMesh } from "../../subjects/subdivideControlMesh";
import { throwsError } from "../internal/predicates";

/**
 * Corneal contact belongs to the actual shared refined eyelids. Projecting a
 * separate decorative strip would leave the original skin penetrating the lens.
 *
 * Scenarios:
 * 1. A frontal eye on a small supporting annulus clears its resident cornea by
 *    the declared thickness. Independent Z-depth queries verify the actual
 *    triangles, and the untouched twin has measurable penetrating vertices.
 * 2. The cornea itself and a remote support vertex stay unchanged. Omitted contact
 *    exactly matches explicit globe mode; incompatible/unknown modes refuse.
 * 3. Standalone margin attachment without a group retains the base skin region.
 * 4. Default reach adapts neighbouring tissue; zero keeps pointwise contact, an
 *    empty contact population is identity, and invalid reach values refuse.
 * 5. The authored inner boundary already clears the same resident cornea before
 *    subdivision/final projection. The globe-only twin still penetrates there.
 */
export const test_subject_corneal_contact = (): void => {
  // Contact consumes an eye and its shared support, not a cranium, ears or
  // unrelated facial regions. The annulus keeps all positive/negative contact
  // populations while making repeated mode comparisons small pure units.
  const host = {
    positions: [
      [-10, 0, 0],
      [0, 4, 0],
      [10, 0, 0],
      [0, -4, 0],
      [0, 0, 0],
      [-30, -20, 0],
      [30, -20, 0],
      [30, 20, 0],
      [-30, 20, 0],
    ],
    indices: [0, 3, 4, 3, 2, 4, 2, 1, 4, 1, 0, 4],
    viewRay: [0, 0, 1],
  };
  const inner = [0, 3, 2, 1],
    outer = [5, 6, 7, 8];
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    host.indices.push(
      outer[i],
      outer[j],
      inner[i],
      outer[j],
      inner[j],
      inner[i],
    );
  }
  const socket = {
    name: "right" as const,
    top: [0, 1, 2],
    bottom: [0, 3, 2],
    iris: 4,
    browTop: [0, 1, 2],
    browBottom: [0, 3, 2],
  };
  const shape: IPortraitEyeShape = {
    ...portraitEyeShape,
    // Isolate contact from the subject's optional tissue-section replacement.
    lowerLidProfile: undefined,
    cornealBoundary: "limbus",
    lidContact: undefined,
    lidContactReach: undefined,
    browFibres: 0,
    upperLashes: 1,
    sampling: { eyeColumns: 8, eyeRows: 4, irisColumns: 24, irisRows: 4 },
  };
  const cage = {
    positions: host.positions.map((point) => [...point]),
    indices: [] as number[],
    groups: [] as number[],
  };
  appendPortraitEyeMargins(cage, host.positions, socket, shape);
  TestValidator.predicate(
    "standalone margins retain the base skin region",
    cage.groups.length > 0 && cage.groups.every((group) => group === 0),
  );
  const build = (s: IPortraitEyeShape) => {
    const plan = createPortraitEyeComponent(socket, s).fit(host);
    const positions = blendPortraitSkin(
      host.positions,
      host.indices,
      plan.constraints,
    );
    const indices = host.indices.filter(
      (_v, i) => !plan.cutFaces.includes(Math.floor(i / 3)),
    );
    const cage = {
      positions,
      indices,
      groups: new Array(indices.length / 3).fill(0),
    };
    const attached = plan.attach(cage, positions, () => 1);
    const beforeFinal = subdivideControlMesh(cage, 1);
    const refined = applyPortraitFinalSurfaces(
      beforeFinal,
      attached.finalSurface === undefined
        ? []
        : [{ id: "eye", propose: attached.finalSurface }],
    );
    return {
      refined,
      beforeFinal,
      prepared: cage,
      openings: attached.openings,
      parts: attached.finish(refined),
    };
  };
  const before = build(shape),
    after = build({ ...shape, lidContact: "cornea" });
  const pointwise = build({
    ...shape,
    lidContact: "cornea",
    lidContactReach: 0,
  });
  const changedCount = (result: typeof before) =>
    result.refined.positions.filter((point, i) =>
      point.some(
        (value, axis) =>
          Math.abs(value - result.beforeFinal.positions[i][axis]) > 1e-8,
      ),
    ).length;
  TestValidator.predicate(
    "contact adaptation reaches neighbouring tissue",
    changedCount(after) > changedCount(pointwise),
  );
  const tiny = {
    ...shape,
    irisRadius: 0.1,
    pupilRadius: 0.05,
    lidContact: "cornea" as const,
  };
  TestValidator.equals(
    "no intersecting lid samples means no displacement",
    build(tiny).refined.positions,
    build({ ...tiny, lidContact: "globe" }).refined.positions,
  );
  TestValidator.equals(
    "omitted contact preserves globe mode",
    before,
    build({ ...shape, lidContact: "globe" }),
  );
  const optical = after.parts.find((p) => p.id === "right-cornea");
  if (optical?.geometry.type !== "mesh")
    throw new Error(
      "The contacted eye needs resident optical and lid surfaces.",
    );
  TestValidator.equals(
    "contact does not move the optical authority",
    optical,
    before.parts.find((p) => p.id === "right-cornea"),
  );
  TestValidator.equals(
    "remote supporting skin stays unchanged",
    after.refined.positions[5],
    before.refined.positions[5],
  );
  const sample = createAutoMovieMeshDepthSampler(optical.geometry.mesh, "z");
  let preparedContacts = 0,
    unpreparedPenetrations = 0;
  for (const id of after.openings.flat()) {
    const point = after.prepared.positions[id];
    const hit = sample(point[0] / 1000, point[1] / 1000);
    if (hit === null) continue;
    preparedContacts++;
    TestValidator.predicate(
      "inner tissue boundary starts at actual corneal contact",
      point[2] / 1000 >= hit.maximum + shape.lidThickness / 1000 - 1e-10,
    );
    if (before.prepared.positions[id][2] / 1000 < hit.maximum)
      unpreparedPenetrations++;
  }
  TestValidator.predicate(
    "nonempty preconstruction contact and negative twin",
    preparedContacts > 0 && unpreparedPenetrations > 0,
  );
  let covered = 0,
    penetrating = 0;
  const lidVertices = new Set<number>();
  for (let face = 0; face < after.refined.groups.length; face++)
    if (after.refined.groups[face] === 1)
      for (const id of after.refined.indices.slice(face * 3, face * 3 + 3))
        lidVertices.add(id);
  const positions = [...lidVertices].flatMap((id) =>
    after.refined.positions[id].map((v) => v / 1000),
  );
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
          createPortraitEyeComponent(socket, {
            ...shape,
            ...change,
          }),
        "Corneal lid contact",
      ),
    );
  for (const lidContactReach of [-1, NaN])
    TestValidator.predicate(
      "invalid contact reach refuses",
      throwsError(
        () =>
          createPortraitEyeComponent(socket, {
            ...shape,
            lidContactReach,
          }),
        "Lid contact reach",
      ),
    );
};
