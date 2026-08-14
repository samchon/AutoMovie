import {
  IAutoMovieAcceptanceScenario,
  IAutoMovieAssetManifest,
  IAutoMovieFrameEvidenceReference,
  IAutoMovieProductionDesign,
  IAutoMovieReviewCheck,
  IAutoMovieReviewEvidence,
} from "@automovie/interface";
import {
  AutoMovieApplication,
  AutoMovieProductionCompiler,
  AutoMovieProductionOracleService,
  AutoMovieProductionProject,
  digestAutoMovieBytes,
} from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import path from "node:path";

import { namedFacts } from "../internal/predicates";
import {
  productionCompileSucceeded,
  productionFixture,
  testCaptureRuntimeIdentity,
} from "./productionFixtures";
import { productionH264Mp4, productionPng } from "./productionMediaFixtures";

const PRODUCTION_ID = "fixture-film";
const SHOT = "opening";
const FRAME_COUNT = 144;
const FRAME_RATE = 24;
const FRAME_WIDTH = 16;
const FRAME_HEIGHT = 16;

const REPAINT_INPUT = (referencePath: string) => ({
  productionId: PRODUCTION_ID,
  shot: SHOT,
  references: [{ role: "style" as const, path: referencePath }],
  parameters: {
    prompt: "Preserve the blocking while applying the fixed fixture style.",
    negativePrompt: "Do not change staging, timing, or subject count.",
    seed: 17,
    strength: 0.5,
    controls: { pose: 1 },
  },
});

/**
 * `repaintShot` crosses the whole host boundary without pretending a media
 * fixture is an external diffusion judgment.
 *
 * The tool had no call site in the suite. A shallow adapter mock is not enough:
 * the public application admits it only after current compile, completed source
 * review, full-rate beauty/control pixels, a manifest-owned reference, parsed
 * H.264 media facts, and an atomic rendition receipt all agree. This case builds
 * those prerequisites through package APIs and uses actual PNG and MP4 bytes.
 * The local adapter proves orchestration and provenance only; it makes no claim
 * about diffusion quality or a remote provider.
 *
 * Scenarios:
 *
 * 1. Arrangement declares repaint delivery and one exact rendition-reference
 *    use, compiles current source, and accumulates all 144 beauty plus 144 pose
 *    frames in one verified render bundle. Missing fixture anchors throw before
 *    any assertion can run.
 * 2. A complete deterministic shot review cites the current acceptance
 *    contracts and their exact review frames, satisfying the prerequisite the
 *    repaint service reopens rather than planting a review record directly.
 * 3. With every other input held current, an application without a host repaint
 *    adapter refuses `repaint-host-unavailable` and commits no rendition.
 * 4. A host-selected local adapter receives the full current frame grid and
 *    reference bytes, returns real exact-contract H.264 bytes, and the public
 *    application accepts them with one immutable receipt and parsed media facts.
 */
export const test_mcp_repaint_shot = async (): Promise<void> => {
  const fixture = productionFixture();
  try {
    const png = productionPng(FRAME_WIDTH, FRAME_HEIGHT);
    const referencePath = declareRepaintReference(fixture.root, png);
    const project = AutoMovieProductionProject.open(fixture.root);
    const production = project.design({
      kind: "production",
    }) as IAutoMovieProductionDesign;
    // The shared fixture marks every deliverable optional to stay cheap, and
    // `repainted` delivery refuses a production whose features are all
    // optional: a nominal repaint that ships only previews and guides has
    // nothing to repaint. Requiring the feature is what makes this fixture a
    // repaint production rather than a preview one.
    const delivery = project.setProductionDesign({
      ...production,
      visualDelivery: "repainted",
      deliverables: production.deliverables.map((deliverable) =>
        deliverable.kind === "feature"
          ? { ...deliverable, required: true }
          : deliverable,
      ),
    });
    if (delivery.accepted === false)
      throw new Error(
        `Fixture repaint delivery was refused: ${JSON.stringify(delivery.diagnostics)}`,
      );

    const compiler = new AutoMovieProductionCompiler(project);
    const compiled = compiler.compile({ scope: "source" });
    if (productionCompileSucceeded("repaint fixture", compiled) === false)
      throw new Error("The repaint fixture did not compile current source.");

    const oracle = new AutoMovieProductionOracleService(
      project,
      async () => ({
        bytes: png,
        runtimeIdentity: testCaptureRuntimeIdentity(),
        width: FRAME_WIDTH,
        height: FRAME_HEIGHT,
        observation: {
          status: "not-run",
          reason:
            "This protocol fixture records pixels but performs no viewer measurement.",
        },
        maskSidecar: {
          status: "not-run",
          reason: "The selected pose control does not produce a mask sidecar.",
        },
      }),
      () => compiled,
    );
    for (let index = 0; index < FRAME_COUNT; ++index)
      // `mask` joins the two the repaint grid needs because the starter
      // production carries an effect-mask acceptance scenario, and a shot
      // review refuses to complete while any required review frame has no
      // current verified PNG. Repaint is gated on that completed review, so
      // the pass that no repaint input reads still has to exist.
      for (const pass of ["beauty", "pose", "mask"] as const) {
        const preview = await oracle.preview({
          target: { kind: "shot", id: SHOT },
          time: index / FRAME_RATE,
          pass,
        });
        if (preview.captured === false || preview.frame === null)
          throw new Error(
            `Fixture ${pass} frame ${index} was not captured: ${JSON.stringify(preview.diagnostics)}`,
          );
      }

    const outputBytes = await productionH264Mp4({
      width: FRAME_WIDTH,
      height: FRAME_HEIGHT,
      fps: FRAME_RATE,
      frameCount: FRAME_COUNT,
    });
    let adapterCalls = 0;
    let adapterGrid = { beauty: 0, pose: 0, references: 0 };
    const application = new AutoMovieApplication({
      projectRoot: fixture.root,
      repaint: async (input) => {
        ++adapterCalls;
        adapterGrid = {
          beauty: input.source.frames.filter((frame) => frame.pass === "beauty")
            .length,
          pose: input.source.frames.filter((frame) => frame.pass === "pose")
            .length,
          references: input.references.length,
        };
        return {
          bytes: outputBytes,
          mediaType: "video/mp4",
          runtimeIdentity: {
            protocolVersion: "automovie.repaint-runtime.v1",
            provider: "automovie-test-local-media-adapter",
            model: "protocol-fixture",
            version: "1",
            execution: "local",
          },
        };
      },
    });
    for (const guide of [
      "AUTOMOVIE_OVERALL",
      "REVIEW_SHOT",
      "REPAINT_SHOT",
      "DIFFUSION_ENHANCE",
    ] as const)
      application.getGuideDocument({ name: guide });
    completeShotReview(application, project);

    const unavailable = new AutoMovieApplication({
      projectRoot: fixture.root,
    });
    for (const guide of [
      "AUTOMOVIE_OVERALL",
      "REPAINT_SHOT",
      "DIFFUSION_ENHANCE",
    ] as const)
      unavailable.getGuideDocument({ name: guide });
    const refused = await unavailable.repaintShot(REPAINT_INPUT(referencePath));
    TestValidator.equals(
      "absence of a host-selected provider is an explicit non-success",
      {
        repainted: refused.repainted,
        receipt: refused.receipt,
        codes: refused.diagnostics.map((diagnostic) => diagnostic.code),
        adapterCalls,
      },
      {
        repainted: false,
        receipt: null,
        codes: ["repaint-host-unavailable"],
        adapterCalls: 0,
      },
    );

    const repainted = await application.repaintShot(
      REPAINT_INPUT(referencePath),
    );
    TestValidator.equals(
      "the public application validates and commits one host rendition",
      namedFacts([
        ["repainted", () => repainted.repainted],
        ["oneAdapterCall", () => adapterCalls === 1],
        ["fullBeautyGrid", () => adapterGrid.beauty === FRAME_COUNT],
        ["fullPoseGrid", () => adapterGrid.pose === FRAME_COUNT],
        ["oneReference", () => adapterGrid.references === 1],
        ["receiptPresent", () => repainted.receipt !== null],
        [
          "receiptReopens",
          () =>
            project.verifiedRepaintRenditions([SHOT])[0]?.output.digest ===
            repainted.receipt?.output.digest,
        ],
        [
          "parsedExactMedia",
          () =>
            repainted.receipt?.output.probe.kind === "video" &&
            repainted.receipt.output.probe.width === FRAME_WIDTH &&
            repainted.receipt.output.probe.height === FRAME_HEIGHT &&
            repainted.receipt.output.probe.frameCount === FRAME_COUNT &&
            repainted.receipt.output.probe.fps === FRAME_RATE &&
            repainted.receipt.output.probe.runtimeSeconds ===
              FRAME_COUNT / FRAME_RATE,
        ],
        ["noDiagnostics", () => repainted.diagnostics.length === 0],
      ]),
      {
        repainted: true,
        oneAdapterCall: true,
        fullBeautyGrid: true,
        fullPoseGrid: true,
        oneReference: true,
        receiptPresent: true,
        receiptReopens: true,
        parsedExactMedia: true,
        noDiagnostics: true,
      },
    );
  } finally {
    fixture.dispose();
  }
};

/** Add one real manifest resident as this shot's fixed repaint reference. */
const declareRepaintReference = (root: string, bytes: Uint8Array): string => {
  const file = path.join(root, ".automovie/assets.json");
  const manifest = JSON.parse(
    fs.readFileSync(file, "utf8"),
  ) as IAutoMovieAssetManifest;
  const referencePath = "public/references/repaint-style.png";
  if (
    manifest.assets.some((asset) => asset.path === referencePath) ||
    fs.existsSync(path.join(root, referencePath))
  )
    throw new Error(
      `The production fixture unexpectedly already owns "${referencePath}".`,
    );
  const digest = digestAutoMovieBytes(bytes);
  const prompt = "Create one non-uniform deterministic repaint style raster.";
  manifest.assets.push({
    path: referencePath,
    digest,
    generated: {
      provider: "automovie-test-productionPng",
      model: "deterministic-raster-v1",
      request: null,
      prompt,
      promptDigest: digestAutoMovieBytes(Buffer.from(prompt, "utf8")),
      inputs: [],
      outputDigest: digest,
      reproducible: true,
      // A reproducible generation owes the seed that reproduces it, and the
      // compiler refuses the pair `reproducible: true` with `seed: null` by
      // name. `productionPng` takes no seed, so this records the constant its
      // raster is generated at rather than inventing a replay handle nothing
      // would honour.
      seed: 0,
    },
    license: {
      identifier: "CC0-1.0",
      url: "https://creativecommons.org/publicdomain/zero/1.0/",
      notice: "Generated solely as a disposable test fixture.",
    },
    processing: [],
    uses: [
      {
        production: PRODUCTION_ID,
        consumer: { kind: "rendition-reference", id: SHOT },
        reason:
          "The repaint boundary case fixes these resident image bytes as its style reference.",
      },
    ],
  });
  manifest.assets.sort((left, right) =>
    left.path < right.path ? -1 : left.path > right.path ? 1 : 0,
  );
  const resident = path.join(root, referencePath);
  fs.mkdirSync(path.dirname(resident), { recursive: true });
  fs.writeFileSync(resident, bytes);
  fs.writeFileSync(file, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  return referencePath;
};

/** Submit the exact current deterministic shot evidence required before repaint. */
const completeShotReview = (
  application: AutoMovieApplication,
  project: AutoMovieProductionProject,
): void => {
  const target = { kind: "shot", id: SHOT } as const;
  const prepared = application.prepareReview({ target });
  const errors = prepared.diagnostics.filter(
    (diagnostic) => diagnostic.category === "error",
  );
  if (errors.length !== 0)
    throw new Error(
      `The current repaint source worksheet is blocked: ${JSON.stringify(errors)}`,
    );
  const scenarios = [...project.graph().acceptance.values()].filter(
    (scenario) =>
      scenario.required &&
      scenario.target.kind === "shot" &&
      scenario.target.id === SHOT,
  );
  if (scenarios.length === 0)
    throw new Error(
      "The production fixture has no required opening acceptance contract to review.",
    );
  const frameFor = (
    scenario: IAutoMovieAcceptanceScenario,
  ): IAutoMovieFrameEvidenceReference => {
    if (scenario.criterion.kind !== "frame")
      throw new Error(
        `Fixture acceptance "${scenario.id}" is no longer a frame criterion.`,
      );
    const criterion = scenario.criterion;
    const frame = prepared.frames.find(
      (candidate) =>
        candidate.reviewFrame === criterion.frame &&
        candidate.pass === criterion.pass,
    );
    if (frame === undefined)
      throw new Error(
        `Prepared review has no ${criterion.pass} frame for "${criterion.frame}".`,
      );
    return frame;
  };
  const frameEvidence = (
    frame: IAutoMovieFrameEvidenceReference,
  ): IAutoMovieReviewEvidence => ({
    kind: "frame",
    target: frame.target,
    reviewFrame: frame.reviewFrame,
    bundle: frame.bundle,
    frame: frame.frame,
    time: frame.time,
    pass: frame.pass,
    digest: frame.digest,
  });
  const fallbackFrame = prepared.frames[0];
  if (fallbackFrame === undefined)
    throw new Error(
      "The prepared shot worksheet has no current frame evidence.",
    );
  const checks: IAutoMovieReviewCheck[] = prepared.requiredCriteria.map(
    (criterion, index) => {
      if (criterion !== "acceptance-scenarios")
        return {
          criterion,
          verdict: "pass",
          observation: `Current source evidence independently answers ${criterion} at check ${index + 1}.`,
          evidence: [frameEvidence(prepared.frames[index] ?? fallbackFrame)],
        };
      return {
        criterion,
        verdict: "pass",
        observation:
          "Every required opening acceptance contract is paired with its exact current frame.",
        evidence: scenarios.flatMap((scenario) => [
          {
            kind: "acceptance" as const,
            scenario: scenario.id,
            exactValue: scenario,
          },
          frameEvidence(frameFor(scenario)),
        ]),
        acceptanceScenarios: scenarios.map((scenario) => scenario.id),
      };
    },
  );
  const submitted = application.submitReview({
    target,
    preparedFingerprint: prepared.fingerprint,
    observations:
      "The current deterministic source grid preserves the fixture shot across its declared review frame and control pass.",
    checks,
    corrections: [],
    completionBasis:
      "Reconfirmed beat-fidelity and representability against current source pixels and acceptance contracts.",
    complete: true,
  });
  if (submitted.accepted === false)
    throw new Error(
      `The current deterministic source review was refused: ${JSON.stringify(submitted.diagnostics)}`,
    );
};
