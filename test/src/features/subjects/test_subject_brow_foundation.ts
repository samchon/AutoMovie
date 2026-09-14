import {
  type IPortraitEyeSocket,
  createPortraitFacialFrame,
} from "@automovie/human";
import { TestValidator } from "@nestia/e2e";

import { humanFaceFixture } from "../internal/humanFaceFixture";
import { nclose, throwsError } from "../internal/predicates";

/**
 * Brow depth is a shared foundation edit above both optical apertures. The
 * hand-authored bands give independent smoothstep and support-limit oracles.
 *
 * Scenarios:
 * 1. A 20 mm aperture makes 5 mm shoulders. Depth two reaches each brow crest,
 *    becomes one at all half-height/half-shoulder stations, and vanishes outside.
 * 2. Negative depth reverses the displacement. Zero needs no eye bindings and
 *    remains exact; the retained transform owns the original binding geometry.
 * 3. Overlapping medial bands use their maximum, not summed depth. Unequal eye
 *    heights share the higher floor, keeping both complete apertures unchanged.
 * 4. Missing sides, empty/nonresident guides, collapsed spans, low brows and
 *    overflowing support bounds refuse before a coordinate transform is returned.
 */
export const test_subject_brow_foundation = (): void => {
  const host = humanFaceFixture().basis.host;
  const coordinates = [
    [10, 0, 0],
    [30, 0, 0],
    [20, -4, 0],
    [10, 10.5, 0],
    [30, 10.5, 0],
    [-30, 0, 0],
    [-10, 0, 0],
    [-20, -4, 0],
    [-30, 10.5, 0],
    [-10, 10.5, 0],
  ];
  coordinates.forEach((point, id) => (host.positions[id] = [...point]));
  const sockets: IPortraitEyeSocket[] = [
    {
      name: "left",
      top: [0, 1],
      bottom: [0, 2, 1],
      iris: 2,
      browTop: [3, 4],
      browBottom: [3, 4],
    },
    {
      name: "right",
      top: [5, 6],
      bottom: [5, 7, 6],
      iris: 7,
      browTop: [8, 9],
      browBottom: [8, 9],
    },
  ];
  const make = (amount = 2) =>
    createPortraitFacialFrame(host, { browProjection: amount }, sockets);
  const frame = make();
  for (const x of [-20, 20]) {
    for (const [y, depth] of [
      [0.5, 0],
      [5.5, 1],
      [10.5, 2],
      [20.5, 1],
      [30.5, 0],
      [40, 0],
    ])
      TestValidator.predicate(
        "vertical support oracle",
        nclose(frame.transform([x, y, 0])[2], depth),
      );
    TestValidator.equals(
      "XY preserved",
      frame.transform([x, 10.5, 7]).slice(0, 2),
      [x, 10.5],
    );
  }
  for (const [x, depth] of [
    [5, 0],
    [7.5, 1],
    [10, 2],
    [30, 2],
    [32.5, 1],
    [35, 0],
    [1000, 0],
  ])
    TestValidator.predicate(
      "lateral support oracle",
      nclose(frame.transform([x, 10.5, 0])[2], depth),
    );
  TestValidator.predicate(
    "negative projects posteriorly",
    nclose(make(-2).transform([20, 10.5, 7])[2], 5),
  );
  TestValidator.equals(
    "omission is exact",
    createPortraitFacialFrame(host).host,
    host,
  );
  TestValidator.equals(
    "explicit zero without sockets",
    createPortraitFacialFrame(host, { browProjection: 0 }).host,
    host,
  );
  const before = frame.transform([20, 10.5, 0]);
  const mutatedSockets = structuredClone(sockets),
    captured = structuredClone(host);
  const owned = createPortraitFacialFrame(
    captured,
    { browProjection: 2 },
    mutatedSockets,
  );
  mutatedSockets[0].browBottom.length = 0;
  captured.positions[3][1] = 100;
  owned.host.positions[3][1] = 100;
  TestValidator.equals(
    "owned support geometry",
    owned.transform([20, 10.5, 0]),
    before,
  );
  const overlapping = structuredClone(host);
  for (let i = 5; i < 10; i++) overlapping.positions[i][0] += 40;
  overlapping.positions[5][1] = 2;
  const overlap = createPortraitFacialFrame(
    overlapping,
    { browProjection: 2 },
    sockets,
  );
  TestValidator.predicate(
    "overlap is not additive",
    nclose(overlap.transform([20, 10.5, 0])[2], 2),
  );
  for (const id of [0, 1, 2, 5, 6, 7])
    TestValidator.equals(
      "both complete apertures fixed",
      overlap.host.positions[id],
      overlapping.positions[id],
    );
  for (const eyes of [
    undefined,
    [],
    [sockets[0]],
    [sockets[0], sockets[0]],
    [sockets[1], sockets[1]],
  ])
    TestValidator.predicate(
      "both named sockets required",
      throwsError(() =>
        createPortraitFacialFrame(host, { browProjection: 2 }, eyes),
      ),
    );
  for (const invalid of [
    "empty",
    "short-brow",
    "fractional",
    "negative",
    "nonresident",
  ] as const) {
    const eyes = structuredClone(sockets);
    if (invalid === "empty") {
      eyes[0].top = [];
      eyes[0].bottom = [];
    }
    if (invalid === "short-brow") eyes[0].browBottom = [3];
    if (invalid === "fractional") eyes[0].browBottom[0] = 0.5;
    if (invalid === "negative") eyes[0].top[0] = -1;
    if (invalid === "nonresident") eyes[0].top[0] = host.positions.length;
    TestValidator.predicate(
      invalid,
      throwsError(() =>
        createPortraitFacialFrame(host, { browProjection: 2 }, eyes),
      ),
    );
  }
  for (const invalid of [
    "aperture-width",
    "unit-aperture",
    "brow-width",
    "low-brow",
    "overflow-width",
    "overflow-top",
  ] as const) {
    const bad = structuredClone(host);
    if (invalid === "aperture-width")
      for (const id of [0, 1, 2]) bad.positions[id][0] = 10;
    if (invalid === "unit-aperture") {
      bad.positions[0][0] = 10;
      bad.positions[1][0] = 11;
      bad.positions[2][0] = 10.5;
    }
    if (invalid === "brow-width") bad.positions[4][0] = 10;
    if (invalid === "low-brow")
      for (const id of [3, 4]) bad.positions[id][1] = 1.5;
    if (invalid === "overflow-width") {
      bad.positions[0][0] = -1e308;
      bad.positions[1][0] = 1e308;
    }
    if (invalid === "overflow-top")
      for (const id of [3, 4]) bad.positions[id][1] = 1e308;
    TestValidator.predicate(
      invalid,
      throwsError(() =>
        createPortraitFacialFrame(bad, { browProjection: 2 }, sockets),
      ),
    );
  }
  const boundary = structuredClone(host);
  for (const id of [3, 4]) boundary.positions[id][1] = 1.500001;
  createPortraitFacialFrame(boundary, { browProjection: 2 }, sockets);
  boundary.positions[0][0] = 10;
  boundary.positions[1][0] = 11.000001;
  boundary.positions[2][0] = 10.5;
  createPortraitFacialFrame(boundary, { browProjection: 2 }, sockets);
};
