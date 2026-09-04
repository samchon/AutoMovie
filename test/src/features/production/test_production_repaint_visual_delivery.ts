import {
  normalizeAutoMovieVisualDeliveryLanes,
  planAutoMovieVisualDelivery,
} from "@automovie/production";
import { TestValidator } from "@nestia/e2e";

const digest = (character: string) => `sha256:${character.repeat(64)}` as const;
const timeline = [
  { occurrence: "occurrence-1", shot: "a" },
  { occurrence: "occurrence-2", shot: "b" },
  { occurrence: "occurrence-3", shot: "b" },
];

/**
 * Final delivery consumes one explicit visual source per timeline occurrence.
 *
 * Scenarios:
 *
 * 1. A deterministic/repainted/repainted film resolves with exactly one
 *    reviewed crossing, preserving repeated shot occurrence identity.
 * 2. Missing, reordered, duplicate, fallback-shaped and unreviewed lanes are
 *    refused while all-one-lane normalization remains explicit.
 */
export const test_production_repaint_visual_delivery = (): void => {
  const deterministic = {
    path: "render/a.mp4",
    digest: digest("1"),
  };
  const repaint = {
    path: "renditions/b.mp4",
    digest: digest("2"),
    receiptDigest: digest("3"),
    selectionDigest: digest("4"),
  };
  const lanes = [
    {
      ...timeline[0]!,
      lane: "deterministic" as const,
      deterministic,
      repaint: null,
    },
    {
      ...timeline[1]!,
      lane: "repainted" as const,
      deterministic: null,
      repaint,
    },
    {
      ...timeline[2]!,
      lane: "repainted" as const,
      deterministic: null,
      repaint,
    },
  ];
  const policy = {
    version: 1 as const,
    observationDigest: digest("5"),
    transitions: [
      {
        fromOccurrence: "occurrence-1",
        toOccurrence: "occurrence-2",
        reviewDigest: digest("6"),
      },
    ],
  };
  const missing = planAutoMovieVisualDelivery({
    timeline,
    lanes: lanes.slice(1),
    policy,
  });
  const reordered = planAutoMovieVisualDelivery({
    timeline,
    lanes: [lanes[1]!, lanes[0]!, lanes[2]!],
    policy,
  });
  const fallback = structuredClone(lanes);
  fallback[0] = {
    ...fallback[0]!,
    repaint,
  } as (typeof lanes)[number];
  TestValidator.equals(
    "explicit occurrence lanes and crossings are exact",
    {
      mixed: planAutoMovieVisualDelivery({ timeline, lanes, policy }),
      missing: missing.diagnostics,
      reordered: reordered.diagnostics,
      fallback: planAutoMovieVisualDelivery({
        timeline,
        lanes: fallback,
        policy,
      }).diagnostics,
      noPolicy: planAutoMovieVisualDelivery({
        timeline,
        lanes,
        policy: null,
      }).diagnostics,
      allDeterministic: planAutoMovieVisualDelivery({
        timeline,
        lanes: normalizeAutoMovieVisualDeliveryLanes({
          timeline,
          visualDelivery: "deterministic",
          deterministic: () => deterministic,
          repaint: () => repaint,
        }),
        policy: null,
      }).diagnostics,
      allRepainted: planAutoMovieVisualDelivery({
        timeline,
        lanes: normalizeAutoMovieVisualDeliveryLanes({
          timeline,
          visualDelivery: "repainted",
          deterministic: () => deterministic,
          repaint: () => repaint,
        }),
        policy: null,
      }).diagnostics,
    },
    {
      mixed: { segments: lanes, diagnostics: [] },
      missing: ["visual-lane-population-invalid"],
      reordered: ["visual-lane-population-invalid"],
      fallback: ["visual-lane-source-invalid"],
      noPolicy: ["visual-lane-policy-missing"],
      allDeterministic: [],
      allRepainted: [],
    },
  );
};
