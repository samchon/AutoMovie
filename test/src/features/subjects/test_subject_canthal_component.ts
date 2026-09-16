import type { IPortraitEyePerformance } from "@automovie/human/components/eyePerformance";
import {
  type IPortraitEyeShape,
  createPortraitEyeComponent,
} from "@automovie/human/components/eyes";
import { portraitNormals } from "@automovie/human/geometry/geometry";
import { TestValidator } from "@nestia/e2e";

import { portraitEyeShapeFixture } from "../internal/portraitEyeShapeFixture";
import { portraitEyelashFixture } from "../internal/portraitEyelashFixture";
import { nclose, throwsError } from "../internal/predicates";

/**
 * The canthal choice reaches actual skin fitting, contact and optical drawing.
 * A ten-mm aperture on a planar host is deliberately wider than a radius-three
 * optical body. The old all-rim sphere cannot support it; the fixed anchors can.
 * Dimensions are analytic construction inputs, independent of any photograph.
 *
 * Scenarios:
 * 1. Static, observed, half-closed/gazing and closed eyes retain their fixed
 *    optical and canthal boundary, while the posed skin and lashes move.
 * 2. Shared outer targets do not follow closure. Actual final contact remains
 *    finite, and the complete tissue boundary and optical normals are emitted.
 * 3. Caller mutation cannot alter an admitted component. Unknown support or
 *    incompatible frame/fit modes refuse beside the valid coupled choice.
 */
export const test_subject_canthal_component = (): void => {
  const positions = [
    [-5, 0, 0],
    [0, 1, 0],
    [5, 0, 0],
    [0, -1, 0],
    [0, 0, 0],
    [-20, -20, 0],
    [20, -20, 0],
    [20, 20, 0],
    [-20, 20, 0],
  ];
  const indices = [0, 3, 4, 3, 2, 4, 2, 1, 4, 1, 0, 4];
  const inner = [0, 3, 2, 1],
    outer = [5, 6, 7, 8];
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    indices.push(outer[i], outer[j], inner[i], outer[j], inner[j], inner[i]);
  }
  const host = { positions, indices, viewRay: [0, 0, 1] };
  const socket = {
    name: "left" as const,
    top: [0, 1, 2],
    bottom: [0, 3, 2],
    iris: 4,
    browTop: [1],
    browBottom: [1],
  };
  const shape: IPortraitEyeShape = {
    ...portraitEyeShapeFixture(),
    surfaceRadius: 3,
    cornealRadius: 1.8,
    irisRadius: 0.9,
    pupilRadius: 0.35,
    cornealThickness: 0.08,
    cornealRimLift: 0.16,
    foldWidth: 0.6,
    foldDepth: 0.1,
    upperLidVolume: 0.1,
    lowerLidVolume: 0.1,
    lidThickness: 0.05,
    canthalSupport: "tangent" as const,
    sphereFit: "observation-ray" as const,
    opticalFrame: "radial" as const,
    upperLashProfile: portraitEyelashFixture(),
    tissues: {
      cornerLength: 0.5,
      caruncleProjection: 0.05,
      plicaProjection: 0.03,
      lowerMarginWidth: 0.1,
      lowerMarginLift: 0.03,
    },
  };
  const before = structuredClone({ host, socket, shape });
  const build = (performance?: IPortraitEyePerformance, extension = true) => {
    const component = createPortraitEyeComponent(socket, shape, performance);
    const plan = component.fit(host);
    const targets = new Map(plan.constraints.map((c) => [c.vertex, c.target]));
    const cage = {
      positions: positions.map((p, i) => [...(targets.get(i) ?? p)]),
      indices: [] as number[],
      groups: [] as number[],
    };
    const attached = plan.attach(cage, cage.positions, () => 1);
    const contact = attached.finalSurface!({
      ...cage,
      normals: portraitNormals(cage.positions.flat(), cage.indices),
    });
    TestValidator.predicate(
      "finite actual final targets",
      contact.every((c) => c.target.every(Number.isFinite)),
    );
    for (const c of contact) cage.positions[c.vertex] = [...c.target];
    if (performance === undefined) {
      const unsupported = structuredClone(cage);
      unsupported.positions[attached.openings[0][0]][0] = -6;
      TestValidator.predicate(
        "incompatible refined tissue refuses",
        throwsError(() => attached.finish(unsupported), "canthal support"),
      );
    }
    const parts = attached.finish(cage);
    TestValidator.predicate(
      "finite output",
      parts.every(
        (p) =>
          p.geometry.type === "mesh" &&
          p.geometry.mesh.positions.every(Number.isFinite),
      ),
    );
    const optical = parts.filter(
      (p) => p.id === "left-sclera" || p.id === "left-canthal-conjunctiva",
    );
    TestValidator.equals(
      "only exposed support regions are drawn",
      optical.length,
      extension ? 2 : 1,
    );
    TestValidator.predicate(
      "unit support normals",
      optical.every((p) => {
        if (p.geometry.type !== "mesh") return false;
        const normals = p.geometry.mesh.normals!;
        return Array.from({ length: normals.length / 3 }, (_, i) =>
          Math.hypot(...normals.slice(3 * i, 3 * i + 3)),
        ).every((n) => nclose(n, 1));
      }),
    );
    return {
      outer: plan.constraints,
      optical,
      rim: attached.openings[0].map((id) => cage.positions[id]),
      parts,
    };
  };
  const staticEye = build();
  for (const blink of [0, 0.5, 1]) {
    const eye = build({ blink, observedBlink: 0, yaw: 3, pitch: 2 });
    TestValidator.equals(
      "fixed optical identity",
      eye.optical,
      staticEye.optical,
    );
    TestValidator.equals("fixed host seam", eye.outer, staticEye.outer);
    if (blink !== 0)
      TestValidator.predicate(
        "performed rim moves",
        eye.rim.some((p, i) =>
          p.some((v, j) => Math.abs(v - staticEye.rim[i][j]) > 1e-6),
        ),
      );
    TestValidator.equals(
      "closed wet tissues are hidden",
      eye.parts.some((p) => p.id === "left-medial-conjunctiva"),
      blink !== 1,
    );
  }
  TestValidator.equals(
    "caller owns all inputs",
    { host, socket, shape },
    before,
  );
  const admitted = createPortraitEyeComponent(socket, shape);
  shape.surfaceRadius = 4;
  TestValidator.equals(
    "admitted dimensions copied",
    admitted.fit(host).constraints,
    staticEye.outer,
  );
  shape.surfaceRadius = 3;
  for (const patch of [
    { canthalSupport: "invalid" as "tangent" },
    { sphereFit: "aperture-plane" as const },
    { opticalFrame: "head-plane" as const },
  ])
    TestValidator.predicate(
      "coupled choice admission",
      throwsError(
        () => createPortraitEyeComponent(socket, { ...shape, ...patch }),
        "Tangent canthal",
      ),
    );
  TestValidator.predicate(
    "old support cannot fit this aperture",
    throwsError(() =>
      createPortraitEyeComponent(socket, {
        ...shape,
        canthalSupport: undefined,
      }).fit(host),
    ),
  );
  // A hand-known spherical rim has zero residual everywhere. Its two canthi
  // already lie on the sampled globe, so it needs no additional tissue faces.
  positions[0][0] = -3;
  positions[2][0] = 3;
  positions[1][2] = Math.sqrt(8);
  positions[3][2] = Math.sqrt(8);
  positions[4][2] = 3;
  build(undefined, false);
};
