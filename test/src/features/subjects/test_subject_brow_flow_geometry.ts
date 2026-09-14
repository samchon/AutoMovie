import { type IPortraitEyebrowFlowProfile } from "@automovie/human/components/eyebrowFlow";
import {
  assertPortraitEyebrowProfile,
  buildPortraitEyebrow,
  portraitEyebrowProfile,
} from "@automovie/human/components/eyebrows";
import { TestValidator } from "@nestia/e2e";

import { nclose, throwsError } from "../internal/predicates";

/**
 * The actual fibre builder consumes longitudinal and root-band flow on shared skin.
 *
 * Scenarios:
 * 1. Lower and upper roots converge on y=2 mm over a planar 4 mm brow, with
 *    opposite anatomical lateral sweep. Tube/ribbon costs and root positions stay fixed.
 * 2. A collapsed root band uses the mean direction. Medial and lateral endpoint
 *    fields swap their spatial placement on the right side, not their anatomy.
 * 3. Full root bands are valid with flow; invalid roots/spans and stationary
 *    emitted fibres refuse, without changing the existing no-flow admission.
 */
export const test_subject_brow_flow_geometry = (): void => {
  const skin = {
    positions: [
      [-30, -20, 0],
      [30, -20, 0],
      [30, 20, 0],
      [-30, 20, 0],
      [-10, 0, 0],
      [10, 0, 0],
      [-10, 4, 0],
      [10, 4, 0],
    ],
    indices: [0, 1, 2, 0, 2, 3],
    groups: [0, 0],
  };
  const flow: IPortraitEyebrowFlowProfile = {
    sections: [0, 1].map((at) => ({
      at,
      lower: { tip: 0.5, outwardBend: 2 },
      upper: { tip: 0.5, outwardBend: 4 },
    })),
  };
  for (const side of ["left", "right"] as const)
    for (const representation of [undefined, "ribbon"] as const) {
      const binding = { side, lower: [4, 5], upper: [6, 7] };
      const profile = {
        ...portraitEyebrowProfile,
        representation,
        rootBand: [0.1, 0.9] as const,
        span: 0,
        flow,
        arch: 0,
      };
      const parts = buildPortraitEyebrow(skin, binding, 12, profile);
      const plain = buildPortraitEyebrow(skin, binding, 12, {
        ...profile,
        flow: undefined,
      });
      TestValidator.equals("population unchanged", parts.length, plain.length);
      const centers = (part: (typeof parts)[number]) => {
        if (part.geometry.type !== "mesh")
          throw new Error("Expected fibre mesh");
        const xyz = part.geometry.mesh.positions,
          width = representation === undefined ? 9 : 2;
        const opposite = representation === undefined ? 4 : 1;
        const center = (row: number) =>
          Array.from(
            { length: 3 },
            (_, axis) =>
              (xyz[row * width * 3 + axis] +
                xyz[(row * width + opposite) * 3 + axis]) *
              500,
          );
        return {
          root: center(0),
          tip: center(profile.segments),
          indices: part.geometry.mesh.indices!.length,
        };
      };
      for (const [i, part] of parts.entries()) {
        const result = centers(part),
          original = centers(plain[i]);
        const rootFraction = (i * 0.61803398875) % 1;
        TestValidator.predicate(
          "tip converges at center",
          nclose(result.tip[1], 2),
        );
        TestValidator.predicate(
          "root fixed",
          result.root.every((v, axis) => nclose(v, original.root[axis])),
        );
        TestValidator.predicate(
          "anatomical sweep",
          nclose(
            result.tip[0] - result.root[0],
            (side === "left" ? 1 : -1) * (2 + 2 * rootFraction),
          ),
        );
        TestValidator.equals(
          "tessellation unchanged",
          result.indices,
          original.indices,
        );
      }
      const collapsed = buildPortraitEyebrow(skin, binding, 1, {
        ...profile,
        rootBand: [0.5, 0.5],
      });
      const result = centers(collapsed[0]);
      TestValidator.predicate(
        "collapsed band averages direction",
        nclose(result.tip[0] - result.root[0], side === "left" ? 3 : -3),
      );
      const longitudinal = buildPortraitEyebrow(skin, binding, 2, {
        ...profile,
        flow: {
          sections: [0, 1].map((at) => ({
            at,
            lower: { tip: 0.25 + at * 0.5, outwardBend: 2 },
            upper: { tip: 0.25 + at * 0.5, outwardBend: 2 },
          })),
        },
      });
      const expected = side === "left" ? [1.3125, 2.6875] : [2.6875, 1.3125];
      TestValidator.predicate(
        "longitudinal anatomy mirrors",
        longitudinal.every((part, i) =>
          nclose(centers(part).tip[1], expected[i]),
        ),
      );
    }
  const profile = {
    ...portraitEyebrowProfile,
    flow,
    rootBand: [0, 1] as const,
  };
  assertPortraitEyebrowProfile(profile, 1);
  for (const patch of [
    { rootBand: [0, 1.1] as const },
    { span: 1.1 },
    { span: NaN },
  ])
    TestValidator.predicate(
      "invalid full-band settings refuse",
      throwsError(() =>
        assertPortraitEyebrowProfile({ ...profile, ...patch }, 1),
      ),
    );
  TestValidator.predicate(
    "stationary flow refuses",
    throwsError(
      () =>
        buildPortraitEyebrow(
          skin,
          { side: "left", lower: [4, 5], upper: [6, 7] },
          1,
          {
            ...profile,
            rootBand: [0.5, 0.5],
            flow: {
              sections: [0, 1].map((at) => ({
                at,
                lower: { tip: 0.5, outwardBend: 0 },
                upper: { tip: 0.5, outwardBend: 0 },
              })),
            },
          },
        ),
      "nonzero path",
    ),
  );
};
