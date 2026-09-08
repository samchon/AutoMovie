import { TestValidator } from "@nestia/e2e";

import {
  portraitEyeShape,
  portraitEyeSockets,
} from "../../subjects/generated-korean-girl-01/configuration";
import { referenceControlNet } from "../../subjects/generated-korean-girl-01/controlNet";
import { createPortraitEyeComponent } from "../../subjects/generated-korean-girl-01/eyes";
import { buildPortraitHead } from "../../subjects/generated-korean-girl-01/head";
import { createPortraitIrisMaterials } from "../../subjects/generated-korean-girl-01/irisPigment";
import { nclose, throwsError } from "../internal/predicates";

/**
 * Pigment is an independently owned eye input, with a linear color oracle and
 * no change to the fitted anatomical attachments.
 * Scenarios:
 * 1. Eight bands interpolate known endpoints, including zero and negative
 *    variation; invalid identity, vector shape and color domains refuse.
 * 2. One eye owns its palette immediately, while another may retain the shared
 *    palette. Mutating caller colors cannot change the constructed material.
 */
export const test_subject_iris_pigment = (): void => {
  const base: [number, number, number] = [0.2, 0.4, 0.6];
  const palette = createPortraitIrisMaterials("left-iris", {
    base,
    variation: [0.7, -0.35, 0],
  });
  TestValidator.equals(
    "eight stable independently named bands",
    palette.map((p) => p.id),
    Array.from({ length: 8 }, (_, i) => `left-iris-${i}`),
  );
  for (let i = 0; i < 8; i++) {
    const c = palette[i].baseColor!;
    TestValidator.predicate(
      "linear pigment has a hand-known color",
      nclose(c.r, 0.2 + 0.1 * i) &&
        nclose(c.g, 0.4 - 0.05 * i) &&
        nclose(c.b, 0.6),
    );
  }
  const plain = createPortraitIrisMaterials("uniform", {
    base: [0, 1, 0],
    variation: [0, 0, 0],
  });
  TestValidator.predicate(
    "zero variation has uniform neutral pigment",
    plain.every((p) => p.baseColor!.r === 0 && p.baseColor!.g === 1),
  );
  base[0] = 0.9;
  TestValidator.predicate(
    "palette does not retain mutable color arrays",
    nclose(palette[0].baseColor!.r, 0.2),
  );
  const color: [number, number, number] = [0.1, 0.2, 0.3];
  const eye = createPortraitEyeComponent(portraitEyeSockets[0], {
    ...portraitEyeShape,
    irisPigment: { base: color, variation: [0, 0, 0] },
  });
  color[0] = 0.8;
  TestValidator.predicate(
    "eye captures pigment at construction",
    nclose(
      eye.materials!.find((m) => m.id === "right-iris-0")!.baseColor!.r,
      0.1,
    ),
  );
  const legacy = createPortraitEyeComponent(portraitEyeSockets[1], {
    ...portraitEyeShape,
    irisPigment: undefined,
  });
  TestValidator.equals(
    "omitted pigment leaves only the owned optical shell",
    legacy.materials!.map((m) => m.id),
    ["left-cornea"],
  );
  const host = {
    positions: referenceControlNet.positions,
    indices: referenceControlNet.indices,
    viewRay: referenceControlNet.viewRay,
  };
  const small = {
    ...portraitEyeShape,
    browFibres: 0,
    upperLashes: 1,
    sampling: { eyeColumns: 4, eyeRows: 2, irisColumns: 8, irisRows: 2 },
  };
  const original = buildPortraitHead(
    host,
    [
      createPortraitEyeComponent(portraitEyeSockets[0], {
        ...small,
        irisPigment: undefined,
      }),
    ],
    0,
  );
  const colored = buildPortraitHead(
    host,
    [
      createPortraitEyeComponent(portraitEyeSockets[0], {
        ...small,
        irisPigment: { base: [0.1, 0.2, 0.3], variation: [0, 0, 0] },
      }),
    ],
    0,
  );
  TestValidator.equals(
    "pigment leaves every anatomical buffer unchanged",
    colored.parts.map((p) => p.geometry),
    original.parts.map((p) => p.geometry),
  );
  const colors = colored.parts.filter((p) => p.id.startsWith("right-iris-"));
  TestValidator.predicate(
    "actual iris parts bind their owned palette",
    colors.length === 8 && colors.every((p) => p.material === p.id),
  );
  TestValidator.predicate(
    "omission retains the shared material path",
    original.parts
      .filter((p) => p.id.startsWith("right-iris-"))
      .every((p) => p.material === p.id.slice(6)),
  );
  const valid = { base: [0, 0, 0], variation: [1, 1, 1] } as const;
  for (const prefix of ["", " x "])
    TestValidator.predicate(
      "ambiguous prefix refuses",
      throwsError(
        () => createPortraitIrisMaterials(prefix, valid),
        "material prefix",
      ),
    );
  for (const pigment of [
    { base: [0, 0], variation: [0, 0, 0] },
    { base: [0, 0, 0], variation: [0] },
    { base: [NaN, 0, 0], variation: [0, 0, 0] },
    { base: [0, 0, 0], variation: [Infinity, 0, 0] },
    { base: [-0.1, 0, 0], variation: [0, 0, 0] },
    { base: [1.1, 0, 0], variation: [0, 0, 0] },
    { base: [0, 0, 0], variation: [-0.1, 0, 0] },
    { base: [1, 0, 0], variation: [0.1, 0, 0] },
  ])
    TestValidator.predicate(
      "invalid pigment domain refuses",
      throwsError(
        () => createPortraitIrisMaterials("test", pigment),
        "unit-range RGB",
      ),
    );
};
