import { TestValidator } from "@nestia/e2e";

import { createPortraitLipBandScale } from "../../subjects/generated-korean-girl-01/lipSection";
import { nclose, throwsError } from "../internal/predicates";

/**
 * Optional lip thickness keeps the aperture corners fixed while allowing a
 * central ratio or an owned ordered profile in the curved oral frame.
 *
 * Scenarios:
 * 1. Omission is identity, scalar one is its negative twin, and scalar one-half
 *    has exact central and halfway ratios from the cubic smoothstep polynomial.
 * 2. An asymmetric array interpolates both sides and owns caller data. Tiny and
 *    maximal positive ratios stay within their finite endpoint hull.
 * 3. Invalid ratios, spans, endpoint values, ordering, cardinality and queries
 *    refuse; the exact two/64-knot limits remain valid.
 */
export const test_subject_lip_band_scale = (): void => {
  for (const x of [-1, -0.75, -0.5, 0, 0.5, 1]) {
    TestValidator.equals("omitted profile", createPortraitLipBandScale()(x), 1);
    TestValidator.equals(
      "explicit neutral",
      createPortraitLipBandScale(1)(x),
      1,
    );
  }
  const half = createPortraitLipBandScale(0.5);
  for (const [x, ratio] of [
    [-1, 1],
    [-0.5, 0.75],
    [0, 0.5],
    [0.5, 0.75],
    [1, 1],
  ])
    TestValidator.predicate("scalar polynomial oracle", nclose(half(x), ratio));
  const knots = [
    { at: -1, scale: 1 },
    { at: -0.5, scale: 0.5 },
    { at: 0.5, scale: 1.5 },
    { at: 1, scale: 1 },
  ];
  const profile = createPortraitLipBandScale(knots);
  for (const [x, ratio] of [
    [-0.75, 0.75],
    [-0.5, 0.5],
    [0, 1],
    [0.5, 1.5],
    [0.75, 1.25],
  ])
    TestValidator.predicate(
      "piecewise polynomial oracle",
      nclose(profile(x), ratio),
    );
  knots[1].scale = 99;
  knots.reverse();
  TestValidator.predicate(
    "profile owns its witnesses",
    nclose(profile(-0.5), 0.5),
  );
  for (const scale of [Number.MIN_VALUE, Number.MAX_VALUE]) {
    const limit = createPortraitLipBandScale(scale);
    for (const x of [-1, -0.5, 0, 0.5, 1])
      TestValidator.predicate(
        "positive finite convex hull",
        Number.isFinite(limit(x)) &&
          limit(x) >= Math.min(1, scale) &&
          limit(x) <= Math.max(1, scale),
      );
  }
  const atLimit = Array.from({ length: 64 }, (_, i) => ({
    at: -1 + (2 * i) / 63,
    scale: 1,
  }));
  TestValidator.equals(
    "maximum valid cardinality",
    createPortraitLipBandScale(atLimit)(0),
    1,
  );
  const endpoints = [
    { at: -1, scale: 1 },
    { at: 1, scale: 1 },
  ];
  for (const bad of [
    0,
    -1,
    NaN,
    Infinity,
    [],
    [endpoints[0]],
    [...atLimit.slice(0, 32), { at: 0, scale: 1 }, ...atLimit.slice(32)],
    [{ at: -0.9, scale: 1 }, endpoints[1]],
    [endpoints[0], { at: 0.9, scale: 1 }],
    [{ at: -1, scale: 0.9 }, endpoints[1]],
    [endpoints[0], { at: 1, scale: 0.9 }],
    [endpoints[0], { at: NaN, scale: 1 }, endpoints[1]],
    [endpoints[0], { at: 0, scale: Infinity }, endpoints[1]],
    [endpoints[0], { at: 0, scale: 0 }, endpoints[1]],
    [endpoints[0], { at: 0.1, scale: 1 }, { at: 0.1, scale: 1 }, endpoints[1]],
    [endpoints[0], { at: 0.1, scale: 1 }, { at: -0.1, scale: 1 }, endpoints[1]],
  ])
    TestValidator.predicate(
      "invalid profile refuses",
      throwsError(() => createPortraitLipBandScale(bad), "ordered positive"),
    );
  for (const x of [-1.01, 1.01, NaN, Infinity])
    TestValidator.predicate(
      "invalid query refuses",
      throwsError(() => half(x), "unit oral span"),
    );
};
