import { resolveHumanFaceDocument } from "@automovie/human";
import { TestValidator } from "@nestia/e2e";

import {
  portraitCheekShape,
  portraitCheekSockets,
} from "../../subjects/generated-korean-girl-01/configuration";
import { humanFaceFixture } from "../internal/humanFaceFixture";

/**
 * One face document resolves identity traits before exact detail and independent side overrides.
 *
 * Scenarios:
 * 1. An exact common width overrides a trait, and a left-only width overrides only that side.
 * 2. Omitted default objects expand before partial nested settings; arrays replace entirely.
 * 3. Output mutation cannot alter the caller's basis, appearance or expression.
 * 4. Cheek omission and explicit paired attachment retain distinct meanings.
 */
export const test_subject_human_resolution = (): void => {
  const document = humanFaceFixture();
  document.controls = { eyeWidth: 0.2 };
  document.detail = {
    eye: { widthScale: 1.1, browProfile: { radius: 0.06 } },
    neck: { upper: { width: 35 } },
    cranium: { capDepth: 0 },
    relief: [],
  };
  document.asymmetry = {
    left: { eye: { widthScale: 1.3 }, ear: { projection: 15 } },
  };
  document.expression = { blink: { right: 0.3 } };
  const original = structuredClone(document);
  const result = resolveHumanFaceDocument(document);
  TestValidator.equals("detail beats trait", result.right.eye.widthScale, 1.1);
  TestValidator.equals(
    "side beats detail independently",
    result.left.eye.widthScale,
    1.3,
  );
  TestValidator.equals(
    "partial default expansion",
    result.recipe.neck!.upper.width,
    35,
  );
  TestValidator.equals(
    "cranial scalar override",
    result.recipe.cranium!.capDepth,
    0,
  );
  TestValidator.equals("array replacement", result.recipe.relief, []);
  TestValidator.equals("one-sided performance", result.expression.blink, {
    right: 0.3,
    left: 0,
  });
  TestValidator.equals(
    "observation kept separately",
    result.observation.blink,
    { right: 0, left: 0 },
  );
  TestValidator.equals(
    "omitted cheek stays absent",
    result.right.cheek,
    undefined,
  );
  TestValidator.equals("pinna side override", result.left.ear.projection, 15);
  result.host.positions[0][0] = 999;
  result.right.eye.widthScale = 999;
  result.materials[0].roughness = 0.999;
  TestValidator.equals("input document unchanged", document, original);
  document.basis.recipe.cheek = structuredClone(portraitCheekShape);
  document.basis.bindings.cheeks = {
    right: portraitCheekSockets[0],
    left: portraitCheekSockets[1],
  };
  document.asymmetry!.right = { cheek: { malar: { projection: 2.5 } } };
  document.appearance = structuredClone(result.materials);
  const explicit = resolveHumanFaceDocument(document);
  TestValidator.equals(
    "cheek nested side override",
    explicit.right.cheek!.malar.projection,
    2.5,
  );
  TestValidator.equals(
    "opposite cheek retained",
    explicit.left.cheek,
    portraitCheekShape,
  );
  TestValidator.equals(
    "explicit palette",
    explicit.materials,
    document.appearance,
  );
  const replay = resolveHumanFaceDocument({
    ...document,
    basis: { ...document.basis, recipe: result.recipe },
  });
  TestValidator.equals(
    "explicit default recipe resolves",
    replay.recipe.neck!.upper.width,
    35,
  );
};
