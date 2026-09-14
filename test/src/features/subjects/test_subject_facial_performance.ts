import {
  createPortraitFacePerformanceComponent,
  portraitLipTriangles,
  posePortraitJawPoint,
} from "@automovie/human";
import { TestValidator } from "@nestia/e2e";

import { humanFaceFixture } from "../internal/humanFaceFixture";
import { throwsError, vclose } from "../internal/predicates";

/**
 * Skin performance gives each region one owner and leaves optics and the maxilla stationary.
 *
 * Scenarios:
 * 1. Neutral performance adds no cut, opening or interior; a mandibular hinge is required only for jaw performance.
 * 2. The chin follows the hinge, upper skin stays fixed and the complete vermilion band is excluded from a second jaw transform.
 * 3. Each brow follows its own elevation and retains factory ownership; invalid brow/hinge bindings refuse.
 * 4. When authored attachments overlap, brow displacement adds to the existing skin motion rather than discarding it.
 */
export const test_subject_facial_performance = (): void => {
  const { host, bindings } = humanFaceFixture().basis;
  const neutral = createPortraitFacePerformanceComponent(bindings, {}, {}).fit(
    host,
  );
  TestValidator.equals("neutral constraints", neutral.constraints, []);
  TestValidator.equals("no cut", neutral.cutFaces, []);
  const empty = neutral.attach(
    { ...host, groups: [] },
    host.positions,
    () => 0,
  );
  TestValidator.equals("no extra aperture", empty.openings, []);
  TestValidator.equals(
    "no detached moving skin",
    empty.finish({ ...host, groups: [] }),
    [],
  );
  TestValidator.predicate(
    "missing hinge",
    throwsError(() =>
      createPortraitFacePerformanceComponent(bindings, {}, { jawOpen: 10 }),
    ),
  );
  bindings.jawHinge = { x: 0, y: 0, z: -45 };
  const motion = createPortraitFacePerformanceComponent(
    bindings,
    { jawOpen: 3 },
    { jawOpen: 10, browRaise: { right: 2, left: -1 } },
  );
  const plan = motion.fit(host);
  const lips = new Set(
    [...portraitLipTriangles(host.indices, bindings.mouth)].flatMap((face) =>
      host.indices.slice(face * 3, face * 3 + 3),
    ),
  );
  TestValidator.predicate(
    "no double-posed lip vertices",
    plan.constraints.every((constraint) => !lips.has(constraint.vertex)),
  );
  const chin = plan.constraints.find(
    (constraint) => constraint.vertex === 152,
  )!.target;
  const source = host.positions[152];
  TestValidator.predicate(
    "chin follows hinge",
    vclose(
      { x: chin[0], y: chin[1], z: chin[2] },
      posePortraitJawPoint(
        { x: source[0], y: source[1], z: source[2] },
        bindings.jawHinge,
        7,
        1,
      ),
    ),
  );
  TestValidator.predicate(
    "forehead stays fixed",
    !plan.constraints.some((constraint) => constraint.vertex === 10),
  );
  for (const [side, delta] of [
    ["right", 2],
    ["left", -1],
  ] as const)
    for (const id of bindings.eyes[side].browTop)
      TestValidator.equals(
        "independent brow motion",
        plan.constraints.find((constraint) => constraint.vertex === id)!
          .target[1],
        host.positions[id][1] + delta,
      );
  bindings.jawHinge.z = -99;
  TestValidator.equals(
    "owned attachments",
    motion.fit(host).constraints,
    plan.constraints,
  );
  const malformed = structuredClone(bindings);
  malformed.eyes.right.browTop = [999];
  TestValidator.predicate(
    "missing brow datum",
    throwsError(() =>
      createPortraitFacePerformanceComponent(
        malformed,
        {},
        { browRaise: { right: 1 } },
      ).fit(host),
    ),
  );
  malformed.jawHinge!.z = NaN;
  TestValidator.predicate(
    "nonfinite hinge",
    throwsError(() =>
      createPortraitFacePerformanceComponent(malformed, {}, { jawOpen: 1 }),
    ),
  );
  const overlap = structuredClone(bindings);
  overlap.eyes.right.browTop = [152];
  overlap.eyes.right.browBottom = [152];
  const jawOnly = createPortraitFacePerformanceComponent(
    overlap,
    {},
    { jawOpen: 2 },
  )
    .fit(host)
    .constraints.find((constraint) => constraint.vertex === 152)!.target;
  const combined = createPortraitFacePerformanceComponent(
    overlap,
    {},
    { jawOpen: 2, browRaise: { right: 1 } },
  )
    .fit(host)
    .constraints.find((constraint) => constraint.vertex === 152)!.target;
  TestValidator.equals("overlapping attachment composes", combined, [
    jawOnly[0],
    jawOnly[1] + 1,
    jawOnly[2],
  ]);
};
