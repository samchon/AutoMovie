import {
  createPortraitHairNormalTexture,
  createPortraitHairTexture,
} from "@automovie/human";
import { TestValidator } from "@nestia/e2e";
import { PNG } from "pngjs";

import { nclose } from "../internal/predicates";

/**
 * Curl normals and opacity share one wave, with empty samples left flat.
 * Scenarios:
 * 1. Zero excursion centres one full-coverage fibre at UV 0.5. Two interior
 *    samples agree with independently calculated circular cross-sections.
 * 2. Positive excursion changes opacity and produces both longitudinal normal
 *    signs while retaining a unit hemisphere and exactly empty endpoint rows.
 */
export const test_subject_hair_curl_texture = (): void => {
  const decode = (uri: string) =>
    PNG.sync.read(Buffer.from(uri.slice(22), "base64"));
  const flat = { amplitude: 0, cycles: 3, aspectRatio: 0.5 };
  const straight = decode(createPortraitHairNormalTexture(1, 1, 1, flat));
  TestValidator.equals(
    "curl raster",
    [straight.width, straight.height],
    [512, 512],
  );
  for (const x of [128, 384]) {
    const q = 2 * ((x + 0.5) / 512 - 0.5),
      at = (128 * 512 + x) * 4;
    const expected = [q, 0, Math.sqrt(1 - q * q)];
    TestValidator.predicate(
      "independent circular section",
      expected.every((v, i) =>
        nclose(straight.data[at + i] / 127.5 - 1, v, 1 / 255),
      ),
    );
  }
  const curl = { ...flat, amplitude: 0.25 };
  const normal = decode(createPortraitHairNormalTexture(1, 1, 1, curl));
  const mask = decode(createPortraitHairTexture(1, 1, 1, curl));
  let positive = 0,
    negative = 0,
    occupied = 0,
    unit = true,
    empty = true;
  for (let at = 0; at < normal.data.length; at += 4) {
    if (at < 512 * 4 || at >= 511 * 512 * 4)
      empty &&=
        mask.data[at + 3] === 0 &&
        normal.data[at] === 128 &&
        normal.data[at + 1] === 128 &&
        normal.data[at + 2] === 255;
    if (mask.data[at + 3] === 0) continue;
    const xyz = [0, 1, 2].map((c) => normal.data[at + c] / 127.5 - 1);
    unit &&= xyz[2] > 0 && nclose(Math.hypot(...xyz), 1, 0.007);
    occupied++;
    if (xyz[1] > 0.1) positive++;
    if (xyz[1] < -0.1) negative++;
  }
  TestValidator.predicate("occupied unit hemisphere", occupied > 1000 && unit);
  TestValidator.predicate(
    "wave tangent changes normal Y",
    positive > 100 && negative > 100,
  );
  TestValidator.predicate("empty root and tip remain flat", empty);
};
