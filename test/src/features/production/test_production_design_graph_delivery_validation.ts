import type { IAutoMovieProductionDesign } from "@automovie/interface";
import { validateAutoMovieProductionGraph } from "@automovie/production";
import { TestValidator } from "@nestia/e2e";

import { productionDesign } from "./productionFixtures";

const digest = (character: string) => `sha256:${character.repeat(64)}` as const;

const lanes = (
  ...members: Array<[string, string, "deterministic" | "repainted"]>
): NonNullable<IAutoMovieProductionDesign["visualDeliveryLanes"]> =>
  members.map(([occurrence, shot, lane]) => ({ occurrence, shot, lane }));

const policy = {
  version: 1 as const,
  observationDigest: digest("1"),
  transitions: [
    {
      fromOccurrence: "occurrence-1",
      toOccurrence: "occurrence-2",
      reviewDigest: digest("2"),
    },
  ],
};

const mixed = (
  overrides: Partial<IAutoMovieProductionDesign> = {},
): IAutoMovieProductionDesign =>
  productionDesign({
    visualDelivery: "mixed",
    visualDeliveryLanes: lanes(
      ["occurrence-1", "opening", "deterministic"],
      ["occurrence-2", "answer", "repainted"],
    ),
    mixedVisualDeliveryPolicy: policy,
    ...overrides,
  });

/** The messages of the named diagnostic codes the validator emits for one design. */
const diagnosticsOf = (
  design: IAutoMovieProductionDesign,
  codes: string[],
): string[] =>
  validateAutoMovieProductionGraph({
    production: design,
    models: new Map(),
    world: null,
    formations: new Map(),
    shots: new Map(),
    acceptance: new Map(),
  })
    .filter((diagnostic) => codes.includes(diagnostic.code))
    .map((diagnostic) =>
      diagnostic.code === "design-enum-invalid"
        ? `${diagnostic.code}: ${diagnostic.message.split(".")[0]}`
        : diagnostic.code,
    );

const deliveryMessages = (design: IAutoMovieProductionDesign): string[] =>
  diagnosticsOf(design, ["design-enum-invalid"]);

/**
 * The production design validator owns the visual-delivery, frame-clock, and
 * repaint-deliverable rules of a tracked production record.
 *
 * Scenarios:
 *
 * 1. The fixture's deterministic design and a complete mixed design with both
 *    lanes, a unique occurrence population, and a versioned policy pass.
 * 2. An unknown visual delivery, an all-one-lane shorthand with explicit lanes,
 *    and every malformed mixed declaration are refused as an enum defect: no
 *    lanes, an empty population, a repeated or blank occurrence, a blank shot,
 *    one lane kind only, a missing policy, a foreign policy version, and a
 *    malformed observation digest.
 * 3. A display fps that does not equal its exact frame-rate identity is a
 *    frame-clock defect, and repainted delivery is refused until one feature
 *    deliverable is required (the fixture marks every deliverable optional).
 */
export const test_production_design_graph_delivery_validation = (): void => {
  const enumRefusal =
    "design-enum-invalid: Mixed visual delivery requires one unique explicit occurrence-lane population containing both lanes and one versioned aggregate-observation transition policy; all-one-lane shorthand must omit both fields";
  TestValidator.equals(
    "visual delivery declarations are validated as one closed shape",
    {
      deterministic: deliveryMessages(productionDesign()),
      completeMixed: deliveryMessages(mixed()),
      unknownDelivery: deliveryMessages(
        productionDesign({
          visualDelivery:
            "hybrid" as IAutoMovieProductionDesign["visualDelivery"],
        }),
      ),
      shorthandWithLanes: deliveryMessages(
        productionDesign({
          visualDeliveryLanes: lanes([
            "occurrence-1",
            "opening",
            "deterministic",
          ]),
        }),
      ),
      mixedWithoutLanes: deliveryMessages(
        mixed({ visualDeliveryLanes: undefined }),
      ),
      emptyLanes: deliveryMessages(mixed({ visualDeliveryLanes: [] })),
      repeatedOccurrence: deliveryMessages(
        mixed({
          visualDeliveryLanes: lanes(
            ["occurrence-1", "opening", "deterministic"],
            ["occurrence-1", "answer", "repainted"],
          ),
        }),
      ),
      blankOccurrence: deliveryMessages(
        mixed({
          visualDeliveryLanes: lanes(
            [" ", "opening", "deterministic"],
            ["occurrence-2", "answer", "repainted"],
          ),
        }),
      ),
      blankShot: deliveryMessages(
        mixed({
          visualDeliveryLanes: lanes(
            ["occurrence-1", "opening ", "deterministic"],
            ["occurrence-2", "answer", "repainted"],
          ),
        }),
      ),
      oneLaneKind: deliveryMessages(
        mixed({
          visualDeliveryLanes: lanes(
            ["occurrence-1", "opening", "repainted"],
            ["occurrence-2", "answer", "repainted"],
          ),
        }),
      ),
      missingPolicy: deliveryMessages(
        mixed({ mixedVisualDeliveryPolicy: undefined }),
      ),
      foreignPolicyVersion: deliveryMessages(
        mixed({
          mixedVisualDeliveryPolicy: { ...policy, version: 2 as 1 },
        }),
      ),
      malformedObservationDigest: deliveryMessages(
        mixed({
          mixedVisualDeliveryPolicy: {
            ...policy,
            observationDigest: "sha256:short" as `sha256:${string}`,
          },
        }),
      ),
    },
    {
      deterministic: [],
      completeMixed: [],
      unknownDelivery: [
        'design-enum-invalid: visualDelivery must be "deterministic", "repainted", or "mixed"',
      ],
      shorthandWithLanes: [enumRefusal],
      mixedWithoutLanes: [enumRefusal],
      emptyLanes: [enumRefusal],
      repeatedOccurrence: [enumRefusal],
      blankOccurrence: [enumRefusal],
      blankShot: [enumRefusal],
      oneLaneKind: [enumRefusal],
      missingPolicy: [enumRefusal],
      foreignPolicyVersion: [enumRefusal],
      malformedObservationDigest: [enumRefusal],
    },
  );
  const base = productionDesign();
  TestValidator.equals(
    "frame clocks and repaint deliverables are validated against their identities",
    {
      inexactFps: diagnosticsOf(
        productionDesign({
          frameFormat: {
            ...base.frameFormat,
            fps: 24,
            frameRate: { numerator: 24_000, denominator: 1_001 },
          },
          // 24000 frames at 24000/1001 fps: exact on the rational clock.
          targetRuntimeSeconds: 1001,
        }),
        ["design-frame-clock-invalid"],
      ),
      exactRationalFps: diagnosticsOf(
        productionDesign({
          frameFormat: {
            ...base.frameFormat,
            fps: 24_000 / 1_001,
            frameRate: { numerator: 24_000, denominator: 1_001 },
          },
          // 24000 frames at 24000/1001 fps: exact on the rational clock.
          targetRuntimeSeconds: 1001,
        }),
        ["design-frame-clock-invalid"],
      ),
      repaintedWithoutRequiredFeature: diagnosticsOf(
        productionDesign({ visualDelivery: "repainted" }),
        ["design-repaint-feature-required"],
      ),
      repaintedWithRequiredFeature: diagnosticsOf(
        productionDesign({
          visualDelivery: "repainted",
          deliverables: base.deliverables.map((deliverable) =>
            deliverable.kind === "feature"
              ? { ...deliverable, required: true }
              : deliverable,
          ),
        }),
        ["design-repaint-feature-required"],
      ),
    },
    {
      inexactFps: ["design-frame-clock-invalid"],
      exactRationalFps: [],
      repaintedWithoutRequiredFeature: ["design-repaint-feature-required"],
      repaintedWithRequiredFeature: [],
    },
  );
};
