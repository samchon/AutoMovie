import { createPortraitEyeComponent } from "@automovie/human/components/eyes";
import { TestValidator } from "@nestia/e2e";

import { portraitEyeShape } from "../../subjects/generated-korean-girl-01/configuration";
import { nclose, throwsError } from "../internal/predicates";

/**
 * Globe depth is independent of the surrounding skin seam. Its signed metric
 * movement follows the normalized observation ray without changing aperture
 * projection, globe radius, tissue profile or the caller's host.
 *
 * Scenarios:
 * 1. On a planar orbital host, positive and negative depths move every inner
 *    contact by the declared ray displacement while all outer targets stay put.
 * 2. Axial and oblique rays cover globe and corneal contact, with and without
 *    neutral performance. Omission and explicit zero retain identical rows.
 * 3. Nonfinite depth refuses beside valid signed values at component admission.
 */
export const test_subject_eye_globe_depth = (): void => {
  const positions = [
    [-2, 0],
    [0, 1],
    [2, 0],
    [0, -1],
    [0, 0],
    [-20, -20],
    [20, -20],
    [20, 20],
    [-20, 20],
  ].map(([x, y]) => [x, y, 0]);
  const indices = [0, 3, 4, 3, 2, 4, 2, 1, 4, 1, 0, 4];
  const inner = [0, 3, 2, 1],
    outer = [5, 6, 7, 8];
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    indices.push(outer[i], outer[j], inner[i], outer[j], inner[j], inner[i]);
  }
  const socket = {
    name: "left" as const,
    top: [0, 1, 2],
    bottom: [0, 3, 2],
    iris: 4,
    browTop: [1],
    browBottom: [1],
  };
  const base = {
    ...portraitEyeShape,
    skinAttachment: undefined,
    skinBridge: undefined,
    widthScale: 1,
    openingScale: 1,
    socketLift: 0,
    outerCornerLift: 0,
    surfaceRadius: 4,
    cornealRadius: 1.8,
    irisRadius: 0.9,
    pupilRadius: 0.35,
    cornealThickness: 0.08,
    cornealRimLift: 0.16,
    foldWidth: 0.6,
    foldDepth: 0.1,
    upperLidVolume: 0.1,
    lowerLidWidth: 1,
    lowerLidVolume: 0.1,
    lidThickness: 0.05,
    aegyoSal: undefined,
    lowerLidProfile: undefined,
    browFibres: 0,
    upperLashes: 1,
    sampling: { eyeColumns: 8, eyeRows: 4, irisColumns: 8, irisRows: 2 },
  };
  for (const ray of [
    [0, 0, 1],
    [0, 6, 8],
  ])
    for (const mode of ["globe", "cornea", "performance"] as const) {
      const host = { positions, indices, viewRay: ray };
      const before = structuredClone(host);
      const attach = (globeLift?: number) => {
        const shape = {
          ...base,
          globeLift,
          lidContact:
            mode === "globe" ? ("globe" as const) : ("cornea" as const),
        };
        const plan = createPortraitEyeComponent(
          socket,
          shape,
          mode === "performance"
            ? { blink: 0, observedBlink: 0, yaw: 0, pitch: 0 }
            : undefined,
        ).fit(host);
        const targets = new Map(
          plan.constraints.map((c) => [c.vertex, c.target]),
        );
        const cage = {
          positions: positions.map((p, id) => [...(targets.get(id) ?? p)]),
          indices: [] as number[],
          groups: [] as number[],
        };
        const attached = plan.attach(cage, cage.positions, () => 1);
        return {
          outer: plan.constraints.filter((c) => c.vertex !== socket.iris),
          rim: attached.openings[0].map((id) => cage.positions[id]),
          rows: cage.positions,
        };
      };
      const baseline = attach();
      TestValidator.equals(
        "zero retains the original section",
        attach(0),
        baseline,
      );
      for (const depth of [-0.5, 0.5]) {
        const changed = attach(depth);
        TestValidator.equals(
          "outer seam stays on its original support",
          changed.outer,
          baseline.outer,
        );
        const norm = Math.hypot(...ray);
        TestValidator.predicate(
          "all contacts move by the independent metric ray depth",
          changed.rim.every((point, i) =>
            point.every((value, axis) =>
              nclose(
                value - baseline.rim[i][axis],
                (depth * ray[axis]) / norm,
                1e-5,
              ),
            ),
          ),
        );
      }
      TestValidator.equals("caller host remains owned", host, before);
    }
  for (const globeLift of [NaN, Infinity, -Infinity])
    TestValidator.predicate(
      "nonfinite globe depth refuses",
      throwsError(
        () => createPortraitEyeComponent(socket, { ...base, globeLift }),
        "dimensions",
      ),
    );
};
