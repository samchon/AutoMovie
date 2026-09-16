import { createAutoMovieMeshDeformer } from "@automovie/engine";
import { createPortraitSkinLayer } from "@automovie/human/components/skin";
import { TestValidator } from "@nestia/e2e";

import { portraitSkinFixture } from "../internal/portraitSkinFixture";
import { nclose } from "../internal/predicates";

/**
 * Tissue projection and descent sample actual skin rather than anchor depth.
 *
 * Scenarios:
 * 1. At the two lower-orbital centres the z=y/2 plane projects by exactly 1 mm.
 * 2. Malar supports descend 2 mm and deflate 1 mm; jowls descend 3 mm and
 *    project 0.6 mm, all in the same millimetre-to-metre construction frame.
 * 3. Layer admission copies bindings and settings; zero condition emits no
 *    fields without requiring attachments, and all-zero regions remain empty.
 */
export const test_subject_skin_tissue = (): void => {
  const f = portraitSkinFixture(),
    shape = { ...f.zero, underEyeBag: 1 };
  const layer = createPortraitSkinLayer(f.bindings, shape),
    fields = layer.fields(f.host);
  TestValidator.equals("paired pads", fields.length, 2);
  for (const [i, x] of [-0.025, 0.025].entries()) {
    const field = fields[i];
    TestValidator.predicate(
      "actual inclined depth",
      nclose(field.center.x, x) &&
        nclose(field.center.y, -0.001) &&
        nclose(field.center.z, -0.0005),
    );
    const mesh = {
      positions: [x, -0.001, -0.0005],
      indices: [],
      normals: null,
      uvs: null,
      skin: null,
    };
    const actual = createAutoMovieMeshDeformer(fields)(mesh);
    TestValidator.predicate(
      "one millimetre anterior",
      nclose(actual.positions[2], 0.0005, 1e-12),
    );
  }
  shape.underEyeBag = 3;
  f.bindings.mouth.upper = [];
  TestValidator.equals("owned admission", layer.fields(f.host), fields);
  const g = portraitSkinFixture();
  const cheek = createPortraitSkinLayer(g.bindings, {
    ...g.zero,
    cheekSag: 2,
    volumeLoss: 1,
  }).fields(g.host);
  TestValidator.equals("paired malar supports", cheek.length, 2);
  for (const c of cheek)
    TestValidator.predicate(
      "malar centre and movement",
      nclose(Math.abs(c.center.x), 0.03) &&
        nclose(c.center.y, -0.016) &&
        nclose(c.center.z, -0.008) &&
        nclose(c.displacement.y, -0.002) &&
        nclose(c.displacement.z, -0.001),
    );
  const jowls = createPortraitSkinLayer(g.bindings, {
    ...g.zero,
    jowlSag: 3,
  }).fields(g.host);
  TestValidator.equals("paired lower cheeks", jowls.length, 2);
  for (const c of jowls)
    TestValidator.predicate(
      "jowl centre and movement",
      nclose(Math.abs(c.center.x), 0.0326) &&
        nclose(c.center.y, -0.042) &&
        nclose(c.center.z, -0.021) &&
        nclose(c.displacement.y, -0.003) &&
        nclose(c.displacement.z, 0.0006),
    );
  TestValidator.equals(
    "taut needs no attachments",
    createPortraitSkinLayer(f.bindings, {}).fields({
      positions: [],
      indices: [],
      normals: [],
    }),
    [],
  );
  TestValidator.equals(
    "zero selected regions",
    createPortraitSkinLayer(g.bindings, g.zero).fields(g.host),
    [],
  );
};
