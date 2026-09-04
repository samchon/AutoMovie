import type {
  IAutoMovieProductionDesign,
  IAutoMovieRepaintGeneratorAdoption,
  IAutoMovieRepaintReceipt,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";
import path from "node:path";

import { loadSourceModule } from "../internal/loadSourceModule";
import { namedFacts, throwsError } from "../internal/predicates";

interface IRenderTier {
  kind: "proxy" | "final";
  resolutionScale: number;
  frameStep: number;
}

interface IDeliveryModule {
  AUTOMOVIE_SHIPPED_RENDER_TIERS: { proxy: IRenderTier; final: IRenderTier };
  readProductionRenderTiers: (selected: unknown) => {
    proxy: IRenderTier;
    final: IRenderTier;
  };
  productionRepaintInput: (
    repaint: IAutoMovieProductionDesign["repaint"],
    reviews?: Readonly<Record<string, unknown>>,
  ) => unknown;
}

const GENERATOR: IAutoMovieRepaintGeneratorAdoption = {
  runtimeIdentity: {
    protocolVersion: "automovie.repaint-runtime.v1",
    provider: "local-checkpoint",
    model: "example-diffusion",
    version: "1.0.0",
    execution: "local",
  },
  generatorProvenance: {
    source: "https://example.invalid/example-diffusion",
    license: "example-license-1.0",
    termsCheckedAt: "2026-01-02",
    cost: "local compute only",
    consumer: {
      kind: "repaint",
      reason: "The delivery is a repainted rendition of the opening shot.",
    },
  },
};

const EXECUTION_POLICY: NonNullable<
  IAutoMovieRepaintReceipt["executionPolicy"]
> = {
  maximumAttempts: 2,
  attemptTimeoutMs: 60_000,
  maximumElapsedMs: 120_000,
  maximumCostUnits: 4,
  backoffMs: [1_000],
  retryableFailures: ["timeout"],
};

const repaintDesign = (): NonNullable<
  IAutoMovieProductionDesign["repaint"]
> => ({
  generator: GENERATOR,
  executionPolicy: EXECUTION_POLICY,
  requests: [
    {
      shot: "opening",
      parameters: { prompt: "the plaza at dusk", seed: 11, strength: 0.4 },
      references: [{ role: "structure", path: "public/assets/opening.png" }],
      evidence: {
        prompt: "docs/settings/050-art-direction.md#art-palette",
        continuity: null,
        settings: "docs/settings/000-governing-aim.md#delivery-contract",
        design: "docs/models/010-soloist.md#soloist-form",
        screenplayOrBrief: "docs/screenplays/001-cue/001-cue.md#cue",
        shot: "opening",
      },
    },
  ],
});

const REVIEW = {
  candidateAttemptId: "4f1b0d3e-9a2c-4a3e-8b7d-6c5e4f3a2b1c",
  candidateOutputDigest: `sha256:${"a".repeat(64)}`,
  reason: "The rendition keeps the raised cue arm readable against the gate.",
  structuralReview: "Compared the candidate with the deterministic source.",
  continuityReview: null,
};

/**
 * The delivery decisions a production authors on its own design record.
 *
 * Two of them cannot be read straight out of that record. The proxy and final
 * tiers have to survive a project that has declared none, because a blank
 * project has no design record at all and `npm run render` must still be a
 * command rather than a refusal; the shipped pair is that fallback and it is
 * not a declaration standing in for one. The repaint requests have to be joined
 * with the candidate reviews that were written after their bytes existed, and
 * those live outside compiler content on purpose: a request change must stale
 * the compile that consumed it, while recording what you saw in a candidate
 * must not invalidate the render you saw it in.
 *
 * Scenarios:
 *
 * 1. An undeclared tier pair falls back to the shipped review and delivery
 *    tiers, and so does an explicit null.
 * 2. A declared pair is returned exactly, including a decimation that differs
 *    from the shipped one.
 * 3. A tier object missing a key, carrying an extra key, naming the other
 *    tier's kind, or holding a non-finite scale or fractional step is refused
 *    by the field that failed rather than replaced with the default.
 * 4. An undeclared repaint reads as the explicit no-repaint selection.
 * 5. A declared repaint is joined to a null selection review while no candidate
 *    exists, and to the exact reviewed candidate once one does.
 * 6. A review authored for another shot does not reach this shot's request.
 */
export const test_cli_scaffold_delivery_design = async (): Promise<void> => {
  const moduleSource = path.resolve(
    __dirname,
    "../../../../packages/template/scaffold/scripts/productionConfiguration.ts",
  );
  const delivery = loadSourceModule<IDeliveryModule>(moduleSource);

  const shipped = delivery.AUTOMOVIE_SHIPPED_RENDER_TIERS;
  const declared = {
    proxy: { kind: "proxy" as const, resolutionScale: 0.25, frameStep: 4 },
    final: { kind: "final" as const, resolutionScale: 1, frameStep: 1 },
  };

  TestValidator.equals(
    "a production without declared tiers renders at the shipped pair",
    {
      undeclared: delivery.readProductionRenderTiers(undefined),
      explicitNull: delivery.readProductionRenderTiers(null),
      declared: delivery.readProductionRenderTiers(declared),
    },
    {
      undeclared: {
        proxy: { kind: "proxy", resolutionScale: 0.5, frameStep: 2 },
        final: { kind: "final", resolutionScale: 1, frameStep: 1 },
      },
      explicitNull: {
        proxy: { kind: "proxy", resolutionScale: 0.5, frameStep: 2 },
        final: { kind: "final", resolutionScale: 1, frameStep: 1 },
      },
      declared,
    },
  );

  TestValidator.equals(
    "the fallback is a copy, so a caller cannot edit the shipped pair",
    delivery.readProductionRenderTiers(undefined) === shipped,
    false,
  );

  TestValidator.equals(
    "a malformed tier declaration is refused by the field that failed",
    namedFacts([
      [
        "aNonObjectPairIsRefused",
        () =>
          throwsError(
            () => delivery.readProductionRenderTiers("proxy"),
            ["renderTiers must be an object"],
          ),
      ],
      [
        "aMissingTierIsNamed",
        () =>
          throwsError(
            () => delivery.readProductionRenderTiers({ proxy: declared.proxy }),
            ["renderTiers requires proxy, final", "missing: final"],
          ),
      ],
      [
        "anUnknownKeyIsNamed",
        () =>
          throwsError(
            () =>
              delivery.readProductionRenderTiers({
                ...declared,
                review: declared.proxy,
              }),
            ["renderTiers requires proxy, final", "unknown: review"],
          ),
      ],
      [
        "aSwappedKindIsRefused",
        () =>
          throwsError(
            () =>
              delivery.readProductionRenderTiers({
                proxy: declared.final,
                final: declared.final,
              }),
            ['renderTiers.proxy.kind must be "proxy"'],
          ),
      ],
      [
        "aFinalKindIsCheckedToo",
        () =>
          throwsError(
            () =>
              delivery.readProductionRenderTiers({
                proxy: declared.proxy,
                final: declared.proxy,
              }),
            ['renderTiers.final.kind must be "final"'],
          ),
      ],
      [
        "aNonFiniteScaleIsRefused",
        () =>
          throwsError(
            () =>
              delivery.readProductionRenderTiers({
                proxy: { ...declared.proxy, resolutionScale: "half" },
                final: declared.final,
              }),
            ["renderTiers.proxy.resolutionScale must be a finite number"],
          ),
      ],
      [
        "aFractionalStepIsRefused",
        () =>
          throwsError(
            () =>
              delivery.readProductionRenderTiers({
                proxy: { ...declared.proxy, frameStep: 1.5 },
                final: declared.final,
              }),
            ["renderTiers.proxy.frameStep must be a safe integer"],
          ),
      ],
    ]),
    {
      aNonObjectPairIsRefused: true,
      aMissingTierIsNamed: true,
      anUnknownKeyIsNamed: true,
      aSwappedKindIsRefused: true,
      aFinalKindIsCheckedToo: true,
      aNonFiniteScaleIsRefused: true,
      aFractionalStepIsRefused: true,
    },
  );

  const authored = repaintDesign();
  TestValidator.equals(
    "repaint requests are joined to the reviews written for their own candidates",
    {
      undeclared: delivery.productionRepaintInput(undefined),
      noReviewsArgument: delivery.productionRepaintInput(authored),
      beforeACandidateExists: delivery.productionRepaintInput(authored, {}),
      afterOneIsReviewed: delivery.productionRepaintInput(authored, {
        opening: REVIEW,
      }),
      reviewForAnotherShot: delivery.productionRepaintInput(authored, {
        answer: REVIEW,
      }),
    },
    {
      undeclared: null,
      noReviewsArgument: {
        generator: GENERATOR,
        executionPolicy: EXECUTION_POLICY,
        requests: [{ ...authored.requests[0]!, selectionReview: null }],
      },
      beforeACandidateExists: {
        generator: GENERATOR,
        executionPolicy: EXECUTION_POLICY,
        requests: [{ ...authored.requests[0]!, selectionReview: null }],
      },
      afterOneIsReviewed: {
        generator: GENERATOR,
        executionPolicy: EXECUTION_POLICY,
        requests: [{ ...authored.requests[0]!, selectionReview: REVIEW }],
      },
      reviewForAnotherShot: {
        generator: GENERATOR,
        executionPolicy: EXECUTION_POLICY,
        requests: [{ ...authored.requests[0]!, selectionReview: null }],
      },
    },
  );
};
