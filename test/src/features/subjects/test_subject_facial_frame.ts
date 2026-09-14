import {
  type IPortraitFacialFrameShape,
  createPortraitFacialFrame,
  resolvePortraitFacialFrameShape,
} from "@automovie/human";
import { TestValidator } from "@nestia/e2e";

import { humanFaceFixture } from "../internal/humanFaceFixture";
import { nclose, throwsError } from "../internal/predicates";

/**
 * Craniofacial controls act at named shared supports, not independent overlays.
 *
 * Scenarios:
 * 1. Identity retains exact observations and topology without sharing arrays.
 * 2. Width and length use the hand-calculated nasion-centred affine rule.
 * 3. Each compact support reaches its named centre and vanishes far outside it.
 * 4. Bounds admit both endpoints; adjacent, nonfinite and degenerate inputs refuse.
 * 5. Invalid attachments and numerical overflow cannot emit invalid coordinates.
 */
export const test_subject_facial_frame = (): void => {
  const host = humanFaceFixture().basis.host;
  const original = structuredClone(host);
  const neutral = createPortraitFacialFrame(host);
  TestValidator.equals("exact identity", neutral.host, host);
  neutral.host.positions[0][0] = 999;
  TestValidator.equals("owned host", host, original);
  const scaled = createPortraitFacialFrame(host, {
    widthScale: 1.1,
    lengthScale: 0.9,
  });
  const sample = host.positions[152],
    origin = host.positions[168],
    value = scaled.transform(sample);
  TestValidator.predicate(
    "nasion-centred width",
    nclose(value[0], origin[0] + (sample[0] - origin[0]) * 1.1),
  );
  TestValidator.predicate(
    "nasion-centred length",
    nclose(value[1], origin[1] + (sample[1] - origin[1]) * 0.9),
  );
  TestValidator.equals("depth unscaled", value[2], sample[2]);
  const capturedHost = structuredClone(host);
  const retained = createPortraitFacialFrame(capturedHost, {
    jawWidth: 2,
    widthScale: 1.1,
  });
  const retainedPoint = retained.transform(sample);
  capturedHost.positions[168][0] = 900;
  capturedHost.positions[397][0] = 900;
  retained.host.positions[168][0] = -900;
  TestValidator.equals(
    "transform owns its immutable fitting basis",
    retained.transform(sample),
    retainedPoint,
  );
  for (const [key, id, axis, delta] of [
    ["jawWidth", 397, 0, 2],
    ["jawWidth", 172, 0, -2],
    ["templeWidth", 356, 0, 2],
    ["templeWidth", 127, 0, -2],
    ["chinHeight", 152, 1, -2],
    ["chinProjection", 199, 2, 2],
    ["foreheadProjection", 10, 2, 2],
  ] as const) {
    const frame = createPortraitFacialFrame(host, { [key]: 2 });
    TestValidator.predicate(
      `${key} owns anatomical centre`,
      nclose(
        frame.transform(host.positions[id])[axis],
        host.positions[id][axis] + delta,
      ),
    );
    TestValidator.equals(
      "compact support is absent outside head",
      frame.transform([1000, 1000, 1000]),
      [1000, 1000, 1000],
    );
  }
  const definitions = resolvePortraitFacialFrameShape();
  for (const key of Object.keys(
    definitions,
  ) as (keyof IPortraitFacialFrameShape)[]) {
    const scale = key === "widthScale" || key === "lengthScale",
      minimum = scale ? 0.7 : -8,
      maximum = scale ? 1.3 : 8;
    for (const bound of [minimum, maximum])
      resolvePortraitFacialFrameShape({ [key]: bound });
    for (const invalid of [minimum - 0.001, maximum + 0.001, NaN, Infinity])
      TestValidator.predicate(
        "invalid shape",
        throwsError(() => resolvePortraitFacialFrameShape({ [key]: invalid })),
      );
  }
  for (const kind of [
    "count",
    "dimension",
    "nonfinite",
    "width",
    "length",
    "overflow-width",
    "overflow-length",
  ] as const) {
    const bad = structuredClone(host);
    if (kind === "count") bad.positions.pop();
    if (kind === "dimension") (bad.positions[0] as number[]).pop();
    if (kind === "nonfinite") bad.positions[0][0] = NaN;
    if (kind === "width") bad.positions[454][0] = bad.positions[234][0];
    if (kind === "length") bad.positions[10][1] = bad.positions[152][1];
    if (kind === "overflow-width") {
      bad.positions[454][0] = 1e308;
      bad.positions[234][0] = -1e308;
    }
    if (kind === "overflow-length") {
      bad.positions[10][1] = 1e308;
      bad.positions[152][1] = -1e308;
    }
    TestValidator.predicate(
      kind,
      throwsError(() => createPortraitFacialFrame(bad)),
    );
  }
  TestValidator.predicate(
    "nonfinite attachment",
    throwsError(() => neutral.transform([NaN, 0, 0])),
  );
  TestValidator.predicate(
    "malformed attachment",
    throwsError(() => neutral.transform([0, 0] as never)),
  );
  TestValidator.predicate(
    "overflowing attachment",
    throwsError(() =>
      createPortraitFacialFrame(host, { widthScale: 1.3 }).transform([
        Number.MAX_VALUE,
        0,
        0,
      ]),
    ),
  );
};
