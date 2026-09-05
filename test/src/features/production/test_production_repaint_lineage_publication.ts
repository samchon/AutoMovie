import type {
  AutoMovieContentDigest,
  AutoMovieProductionShotRepaint,
  IAutoMovieRenderBundleManifest,
  IAutoMovieRenderSpec,
  IAutoMovieRepaintExecutionPolicy,
  IAutoMovieRepaintGeneratorAdoption,
  IAutoMovieRepaintReceipt,
  IAutoMovieRepaintRequestEvidence,
  IAutoMovieRepaintSequenceObservation,
  IAutoMovieRepaintShot,
} from "@automovie/interface";
import {
  AutoMovieProductionRepaintService,
  canonicalAutoMovieJsonBytes,
  conformProductionRenditionVideoMp4,
  digestAutoMovieBytes,
  digestAutoMovieRepaintObservationMembers,
  muxProductionFeatureMp4,
  openAutoMovieProduction,
  probeProductionMedia,
  productionRenderBundleRelativePath,
  productionRenderTargetFingerprint,
  productionVisualDeliveryOccurrence,
} from "@automovie/production";
import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import path from "node:path";

import { capturedPng, recordingCapture } from "./captureHost";
import {
  REPAINT_REFERENCE_PATH,
  finalPublicationFixture,
} from "./finalPublicationFixtures";
import { testRendererIdentity } from "./productionFixtures";
import { productionH264Mp4 } from "./productionMediaFixtures";

const adoption = (): IAutoMovieRepaintGeneratorAdoption => ({
  runtimeIdentity: {
    protocolVersion: "automovie.repaint-runtime.v1",
    provider: "reviewed-local-host",
    model: "studio/repaint-model",
    version: "sha256:model-revision",
    execution: "local",
  },
  generatorProvenance: {
    source: "https://models.example/studio/repaint-model",
    license: "license-records/repaint-model.md",
    termsCheckedAt: "2026-08-28",
    cost: "local compute; no per-request provider fee",
    consumer: {
      kind: "repaint",
      reason: "the reviewed final delivery requires appearance rendition",
    },
  },
});

const policy: IAutoMovieRepaintExecutionPolicy = {
  maximumAttempts: 2,
  attemptTimeoutMs: 60_000,
  maximumElapsedMs: 120_000,
  maximumCostUnits: 10,
  backoffMs: [1],
  retryableFailures: ["rate-limit"],
};

const requestEvidence = (): IAutoMovieRepaintRequestEvidence => ({
  prompt: "docs/obligations/repaint-prompt.md#opening",
  continuity: null,
  settings: "docs/settings/production.md#opening",
  design: "docs/designs/opening.md#opening",
  screenplayOrBrief: "docs/screenplays/opening.md#opening",
  shot: "docs/shots/opening.md#opening",
});

const refusal = (task: () => unknown): string | null => {
  try {
    task();
    return null;
  } catch (error) {
    return (error as Error).message;
  }
};

/**
 * A repainted delivery runs end to end on the real project store: the source
 * bundle is committed, the repaint service publishes candidates through the
 * project, selections and reversals form one lineage, and the final
 * publication cites that lineage in its rendition provenance.
 *
 * Scenarios:
 *
 * 1. A full-grid source bundle commits through the render bundle store, and two
 *    repaint requests publish two verified candidates with their attempts and
 *    raw revisions.
 * 2. Selecting the first candidate, selecting the later one, and reversing to
 *    the first form one verified lineage whose active pointer, selections, and
 *    inspection records agree; foreign, older, malformed, and out-of-order
 *    selections are refused by name.
 * 3. Candidate inspection reports unreadable, foreign, misplaced, and
 *    output-less receipts as findings beside the verified records.
 * 4. The repainted feature conforms the selected clip, passes the final gate
 *    with exact rendition provenance, and is refused when the provenance cites
 *    a stale selection chain.
 */
export const test_production_repaint_lineage_publication =
  async (): Promise<void> => {
    const fixture = await finalPublicationFixture({
      film: "one-shot",
      visualDelivery: "repainted",
    });
    try {
      const { project, plan, timeline, inputFingerprint } = fixture;
      const { width, height, fps } = plan.frameFormat;
      const frameCount = plan.totalFrames;
      const host = recordingCapture();
      const services = openAutoMovieProduction({
        projectRoot: fixture.root,
        productionId: "fixture-film",
        capture: host.adapter,
        authoringEvidence: fixture.evidence,
        currentAuthoringEvidence: () => fixture.evidence,
      });

      // 1. One verified source bundle with beauty pixels and a depth control on
      //    every frame, named the way the oracle names its own frames.
      const target = { kind: "shot" as const, id: "opening" };
      const renderSpec: IAutoMovieRenderSpec = {
        target: "opening",
        frameFormat: { width, height, fps },
        toneMapping: "none",
        codec: "h264",
        pixelFormat: "yuv420p",
        crf: 17,
      };
      const picture = capturedPng(width, height);
      const pictureDigest = digestAutoMovieBytes(picture);
      const frames: IAutoMovieRenderBundleManifest["frames"] = Array.from(
        { length: frameCount },
        (_, index) =>
          (["beauty", "depth"] as const).map((pass) => ({
            index,
            time: index / fps,
            pass,
            path: `preview/frame_${String(index).padStart(6, "0")}${
              pass === "beauty" ? "" : `.${pass}`
            }.png`,
            digest: pictureDigest,
            width,
            height,
          })),
      ).flat();
      const bundleManifest: IAutoMovieRenderBundleManifest = {
        version: 6,
        target,
        compileFingerprint: inputFingerprint,
        dialogueRuntimeIdentity: null,
        rendererIdentity: testRendererIdentity(),
        targetFingerprint: productionRenderTargetFingerprint(
          project,
          project.generatedManifest()!,
          target,
        ),
        renderSpec,
        frames,
        semanticMasks: [],
      };
      const bundle = productionRenderBundleRelativePath(bundleManifest);
      project.commitRenderBundle(
        bundle,
        new Map(frames.map((frame) => [frame.path, picture])),
        bundleManifest,
      );
      const clip = await productionH264Mp4({ width, height, fps, frameCount });
      const adapter: AutoMovieProductionShotRepaint = async () => ({
        mediaType: "video/mp4",
        bytes: clip,
        runtimeIdentity: adoption().runtimeIdentity,
      });
      let clock = Date.parse("2026-08-28T12:00:00.000Z");
      const now = (): Date => new Date((clock += 1_000));
      const request = (seed: number): IAutoMovieRepaintShot.IProps => ({
        productionId: "fixture-film",
        shot: "opening",
        parameters: { prompt: "reviewed prompt", seed, strength: 0.35 },
        references: [{ role: "structure", path: REPAINT_REFERENCE_PATH }],
      });
      const repaint = (seed: number): Promise<IAutoMovieRepaintShot> =>
        new AutoMovieProductionRepaintService(adapter, adoption(), {
          policy,
          evidence: requestEvidence(),
          now,
        }).repaint(services, request(seed));
      const first = await repaint(17);
      if (first.repainted === false)
        throw new Error(
          `The first repaint was refused: ${JSON.stringify(first.diagnostics)} attempts: ${JSON.stringify(
            first.requestId === null
              ? null
              : project
                  .repaintRequestAttempts(first.requestId)
                  .map((attempt) => attempt.failure),
          )}`,
        );
      const second = await repaint(18);
      const receipts = [first, second].map((result) => result.receipt!);
      TestValidator.equals(
        "two repaint requests publish two verified candidates on the project",
        {
          repainted: [first.repainted, second.repainted],
          diagnostics: [first.diagnostics, second.diagnostics],
          candidates: project
            .verifiedRepaintCandidates(["opening"])
            .map((receipt) => receipt.attemptId),
          attempts: receipts.map(
            (receipt) =>
              project.repaintRequestAttempts(receipt.requestId!).length,
          ),
          rawDisposition: receipts.map(
            (receipt) =>
              project.repaintRawOutput(receipt.requestId!, receipt.attemptId)
                .receipt.disposition,
          ),
        },
        {
          repainted: [true, true],
          diagnostics: [[], []],
          candidates: receipts.map((receipt) => receipt.attemptId),
          attempts: [1, 1],
          rawDisposition: ["candidate-source", "candidate-source"],
        },
      );

      // 2. Selection lineage.
      const select = (
        attemptId: string,
        kind: "selection" | "reversal",
        selectedAt: string,
      ): IAutoMovieRepaintReceipt =>
        project.selectRepaintCandidate({
          shot: "opening",
          attemptId,
          kind,
          reason: `The ${kind} keeps the authored structure.`,
          structuralReview: "The deterministic silhouette remains exact.",
          continuityReview: null,
          selectedAt,
        });
      const [firstReceipt, secondReceipt] = receipts as [
        IAutoMovieRepaintReceipt,
        IAutoMovieRepaintReceipt,
      ];
      const selectedFirst = select(
        firstReceipt.attemptId,
        "selection",
        "2026-08-28T13:00:00.000Z",
      );
      const afterFirst = project.verifiedRepaintSelections(["opening"]);
      const selectedSecond = select(
        secondReceipt.attemptId,
        "selection",
        "2026-08-28T13:01:00.000Z",
      );
      const afterSecond = project.verifiedRepaintSelections(["opening"]);
      const reversed = select(
        firstReceipt.attemptId,
        "reversal",
        "2026-08-28T13:02:00.000Z",
      );
      const afterReversal = project.verifiedRepaintSelections(["opening"]);
      const rendition = project.inspectVerifiedRepaintRenditions(["opening"]);
      const selectionRefusals = {
        absentCandidate: refusal(() =>
          select(
            "00000000-0000-4000-8000-000000000000",
            "selection",
            "2026-08-28T13:03:00.000Z",
          ),
        ),
        inexactInstant: refusal(() =>
          select(secondReceipt.attemptId, "selection", "2026-08-28T13:03:00Z"),
        ),
        beforeCompletion: refusal(() =>
          select(
            secondReceipt.attemptId,
            "selection",
            "2026-08-28T11:00:00.000Z",
          ),
        ),
        olderAsSelection: refusal(() =>
          select(
            firstReceipt.attemptId,
            "selection",
            "2026-08-28T13:03:00.000Z",
          ),
        ),
        newerAsReversal: refusal(() =>
          select(
            secondReceipt.attemptId,
            "reversal",
            "2026-08-28T13:03:00.000Z",
          ),
        ),
        blankReason: refusal(() =>
          project.selectRepaintCandidate({
            shot: "opening",
            attemptId: secondReceipt.attemptId,
            kind: "selection",
            reason: " ",
            structuralReview: "exact",
            continuityReview: null,
            selectedAt: "2026-08-28T13:03:00.000Z",
          }),
        ),
        continuityWithoutEvidence: refusal(() =>
          project.selectRepaintCandidate({
            shot: "opening",
            attemptId: secondReceipt.attemptId,
            kind: "selection",
            reason: "reviewed",
            structuralReview: "exact",
            continuityReview: {
              baseline: "docs/continuity.md#baseline",
              playbackEvidence: "reviewed playback",
              mixedDeliveryPolicy: null,
              flicker: "pass",
              identityDrift: "pass",
              geometryWarp: "pass",
              textureCrawl: "pass",
              transitionMismatch: "pass",
            },
            selectedAt: "2026-08-28T13:03:00.000Z",
          }),
        ),
      };
      TestValidator.equals(
        "selection and reversal form one verified lineage",
        {
          selected: [
            selectedFirst.attemptId,
            selectedSecond.attemptId,
            reversed.attemptId,
          ],
          active: [afterFirst, afterSecond, afterReversal].map((selections) =>
            selections.map((selection) => selection.receipt.attemptId),
          ),
          distinctSelections:
            new Set(
              [...afterFirst, ...afterSecond, ...afterReversal].map(
                (selection) => selection.selectionId,
              ),
            ).size === 3,
          rendition: {
            records: rendition.records.map((record) => record.value.attemptId),
            findings: rendition.findings,
          },
          refusals: Object.fromEntries(
            Object.entries(selectionRefusals).map(([name, message]) => [
              name,
              message?.split(".")[0] ?? null,
            ]),
          ),
        },
        {
          selected: [
            firstReceipt.attemptId,
            secondReceipt.attemptId,
            firstReceipt.attemptId,
          ],
          active: [
            [firstReceipt.attemptId],
            [secondReceipt.attemptId],
            [firstReceipt.attemptId],
          ],
          distinctSelections: true,
          rendition: { records: [firstReceipt.attemptId], findings: [] },
          refusals: {
            absentCandidate:
              'Repaint candidate "00000000-0000-4000-8000-000000000000" is absent, invalid, or stale for shot "opening"',
            inexactInstant: "Repaint selection requires an exact UTC instant",
            beforeCompletion:
              "Repaint selection cannot precede the candidate completion instant",
            olderAsSelection:
              "Repaint selection requires a candidate completed after the current active candidate; use reversal for an older candidate",
            newerAsReversal:
              "Repaint reversal requires a candidate completed before the current active candidate",
            blankReason:
              "Repaint selection reason must be trimmed and non-empty",
            continuityWithoutEvidence:
              "Repaint continuity selection must match the candidate continuity evidence exactly",
          },
        },
      );

      // 3. Candidate inspection findings beside the verified records.
      const renditionsRoot = path.join(project.trackedStatePath("renditions"));
      fs.writeFileSync(path.join(renditionsRoot, "garbage.json"), "{not json");
      fs.writeFileSync(
        path.join(renditionsRoot, "foreign.json"),
        JSON.stringify({ version: 4, shot: "opening" }),
      );
      const misplaced = structuredClone(secondReceipt);
      fs.writeFileSync(
        path.join(renditionsRoot, "misplaced.json"),
        canonicalAutoMovieJsonBytes(misplaced),
      );
      const inspection = project.inspectVerifiedRepaintCandidates(["opening"]);
      for (const name of ["garbage.json", "foreign.json", "misplaced.json"])
        fs.rmSync(path.join(renditionsRoot, name));
      TestValidator.equals(
        "candidate inspection names unreadable, foreign, and misplaced receipts",
        {
          records: inspection.records.map((record) => record.value.attemptId),
          findings: inspection.findings.map(
            (finding) =>
              `${finding.target.recordId}:${finding.stage}:${finding.failure}`,
          ),
        },
        {
          records: receipts.map((receipt) => receipt.attemptId),
          findings: [
            "foreign:receipt:schema-invalid",
            "garbage:receipt:schema-invalid",
            "misplaced:receipt:identity-invalid",
          ],
        },
      );

      // 4. Final publication with repainted lane provenance.
      const [selection] = afterReversal;
      const activeReceipt = selection!.receipt;
      const renditionBytes = project.readRenderFile(activeReceipt.output.path);
      const featureVideo = conformProductionRenditionVideoMp4({
        timeline,
        clips: new Map([["opening", renditionBytes]]),
      });
      const feature = muxProductionFeatureMp4({
        video: featureVideo,
        audio: fixture.media.audio,
      });
      const featureProbe = probeProductionMedia({
        kind: "feature",
        mediaType: "video/mp4",
        bytes: feature,
      });
      const occurrence = productionVisualDeliveryOccurrence(
        timeline.segments[0]!,
        0,
      );
      const members = [
        {
          occurrence,
          shot: "opening",
          lane: "repainted" as const,
          requestId: activeReceipt.requestId!,
          attemptId: activeReceipt.attemptId,
          outputDigest: activeReceipt.output.digest,
          candidateReceiptDigest: digestAutoMovieBytes(
            canonicalAutoMovieJsonBytes(activeReceipt),
          ),
          selectionId: selection!.selectionId,
          selectionDigest: selection!.selectionDigest,
        },
      ];
      const artifactPath = "observations/opening-sequence.mp4";
      fs.mkdirSync(path.join(project.renderRoot(), "observations"), {
        recursive: true,
      });
      fs.writeFileSync(
        path.join(project.renderRoot(), ...artifactPath.split("/")),
        featureVideo,
      );
      const observation: IAutoMovieRepaintSequenceObservation = {
        version: 1,
        productionId: "fixture-film",
        compileFingerprint: inputFingerprint,
        timelineFingerprint: digestAutoMovieBytes(
          canonicalAutoMovieJsonBytes(timeline),
        ),
        baseline: {
          address: "docs/continuity/opening.md#baseline",
          version: "v1",
          scope: ["opening"],
          intendedDeltas: [],
        },
        members,
        memberSetDigest: digestAutoMovieRepaintObservationMembers(members),
        artifact: {
          path: artifactPath,
          digest: digestAutoMovieBytes(featureVideo),
        },
        playback: { runtime: "viewer 1.0", context: "sequence review" },
        status: "completed",
        verdicts: {
          flicker: "pass",
          identityDrift: "pass",
          geometryWarp: "pass",
          textureCrawl: "pass",
          transitionMismatch: "pass",
        },
      };
      const provenance = (
        selectionDigest: AutoMovieContentDigest,
      ): NonNullable<
        (typeof fixture.manifest)["deliverables"][number]["rendition"]
      > => ({
        version: 2,
        kind: "visual-lanes",
        memberSetDigest: digestAutoMovieRepaintObservationMembers(members),
        observationDigest: digestAutoMovieBytes(
          canonicalAutoMovieJsonBytes(observation),
        ),
        observation,
        shots: [
          {
            occurrence,
            shot: "opening",
            lane: "repainted",
            path: activeReceipt.output.path,
            digest: activeReceipt.output.digest,
            sourceDigest: activeReceipt.output.digest,
            receiptDigest: digestAutoMovieBytes(
              canonicalAutoMovieJsonBytes(activeReceipt),
            ),
            selectionDigest,
            selectionId: selection!.selectionId,
            requestId: activeReceipt.requestId!,
            attemptId: activeReceipt.attemptId,
          },
        ],
      });
      const publication = (
        selectionDigest: AutoMovieContentDigest,
      ): {
        files: Map<string, Uint8Array>;
        manifest: typeof fixture.manifest;
      } => {
        const manifest = structuredClone(fixture.manifest);
        const files = new Map(fixture.files);
        const deliverable = manifest.deliverables.find(
          (candidate) => candidate.kind === "feature",
        )!;
        const file = deliverable.files[0]!;
        files.set(file.path, feature);
        file.digest = digestAutoMovieBytes(feature);
        file.bytes = feature.length;
        if (featureProbe.kind === "feature") {
          deliverable.runtimeSeconds = featureProbe.video.runtimeSeconds;
          deliverable.frameCount = featureProbe.video.frameCount;
          deliverable.codec = featureProbe.video.codec;
        }
        deliverable.rendition = provenance(selectionDigest);
        return { files, manifest };
      };
      const exact = publication(selection!.selectionDigest);
      fixture.publish(exact);
      const exactGate = fixture.finalRenderDiagnostics();
      const stale = publication(
        `sha256:${"e".repeat(64)}` as AutoMovieContentDigest,
      );
      fixture.publish(stale);
      const staleGate = fixture.finalRenderDiagnostics();
      TestValidator.equals(
        "the repainted feature passes the final gate only with its exact selection chain",
        {
          exactGate,
          staleGate: staleGate.map(
            (diagnostic) =>
              `${diagnostic.code}: ${diagnostic.message.split(".")[0]}`,
          ),
        },
        {
          exactGate: [],
          staleGate: [
            "render-rendition-provenance-invalid: Repaint occurrence 0 does not cite its exact current selection chain",
          ],
        },
      );
    } finally {
      fixture.dispose();
    }
  };
