import { renderAutoMovieSemanticMaskSidecar } from "@automovie/engine";
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
  compareCodeUnits,
  conformProductionRenditionVideoMp4,
  createAutoMovieProductionSemanticMaskReceipt,
  digestAutoMovieBytes,
  digestAutoMovieRepaintObservationMembers,
  muxProductionFeatureMp4,
  openAutoMovieProduction,
  planAutoMovieRepaintRawOutput,
  probeProductionMedia,
  productionRenderBundleRelativePath,
  productionRenderTargetFingerprint,
  productionRepaintActiveReceiptPath,
  productionRepaintRawOutputReceiptPath,
  productionRepaintReceiptPath,
  productionVisualDeliveryOccurrence,
} from "@automovie/production";
import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import path from "node:path";

import {
  createTestFileSystem,
  withTestFileSystem,
} from "../internal/testFileSystem";
import { capturedPng, recordingCapture } from "./captureHost";
import {
  REPAINT_REFERENCE_PATH,
  finalPublicationFixture,
  fixtureSemanticMask,
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

const platformError = (code: string): Error =>
  Object.assign(new Error(code), { code });

/** An error whose message and prototype are both hostile to inspection. */
const hostileError = (): unknown =>
  new Proxy(new Error("hostile"), {
    get: (target, property) => {
      if (property === "message") throw new Error("message unavailable");
      return Reflect.get(target, property);
    },
    getPrototypeOf: () => {
      throw new Error("prototype unavailable");
    },
  });

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
 *    output-less receipts as findings beside the verified records. The render
 *    bundle store refuses every non-canonical, drifted, or unclaimed
 *    publication and re-observes payload and ledger after they land; raw
 *    provider bytes and attempt journals are immutable per attempt; a third
 *    candidate whose journal predates raw receipts still verifies; and every
 *    pointer, selection, receipt, and output fault has one classified finding,
 *    including records that move between an inspection and its second read.
 * 4. The repainted feature conforms the selected clip, passes the final gate
 *    with exact rendition provenance, and is refused when the provenance cites
 *    a stale selection chain or an observation artifact the render root no
 *    longer holds.
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
              message?.split(/\.(?=\s|$)/u)[0] ?? null,
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

      // 3b. The render bundle store refuses every non-canonical, drifted, or
      //     unclaimed publication, re-observes its payload and ledger after
      //     they land, and reopens a committed bundle only through complete
      //     semantic evidence. A second bundle with its own render spec keeps
      //     the candidates' source bundle untouched.
      const renderPath = (relative: string): string =>
        path.join(project.renderRoot(), ...relative.split("/"));
      const bundleFiles = new Map(frames.map((frame) => [frame.path, picture]));
      const semanticMask = fixtureSemanticMask();
      const sidecarBytes = Buffer.from(
        renderAutoMovieSemanticMaskSidecar(semanticMask),
        "utf8",
      );
      const maskFrame: IAutoMovieRenderBundleManifest["frames"][number] = {
        index: 0,
        time: 0,
        pass: "mask",
        path: "preview/frame_000000.mask.png",
        digest: pictureDigest,
        width,
        height,
      };
      const sidecarPath = "preview/frame_000000.mask.semantic.json";
      const semanticReceipt = (
        frame: number,
        sidecar: string,
      ): IAutoMovieRenderBundleManifest["semanticMasks"][number] =>
        createAutoMovieProductionSemanticMaskReceipt({
          frame,
          expectedShot: "opening",
          evidence: {
            version: 1,
            shot: "opening",
            mask: semanticMask,
            coverage: { unresolved: [], unaddressed: 0 },
          },
          sidecar: { path: sidecar, bytes: sidecarBytes },
        });
      const semanticBase: IAutoMovieRenderBundleManifest = {
        ...bundleManifest,
        renderSpec: { ...renderSpec, crf: 18 },
        frames: [...frames, maskFrame],
        semanticMasks: [],
      };
      const semanticBundle = productionRenderBundleRelativePath(semanticBase);
      const maskManifest = (
        semanticMasks: IAutoMovieRenderBundleManifest["semanticMasks"],
      ): IAutoMovieRenderBundleManifest => ({ ...semanticBase, semanticMasks });
      const commitBundle = (
        relative: string,
        files: ReadonlyMap<string, Uint8Array>,
        manifest: IAutoMovieRenderBundleManifest,
      ): string | null =>
        refusal(() => project.commitRenderBundle(relative, files, manifest));
      const withMask = new Map([...bundleFiles, [maskFrame.path, picture]]);
      const withSidecar = new Map([...withMask, [sidecarPath, sidecarBytes]]);
      const completeSemantic = maskManifest([semanticReceipt(0, sidecarPath)]);
      let semanticManifestLanded = false;
      const payloadRace = createTestFileSystem({
        renameSync: ((...args: unknown[]) => {
          const result = Reflect.apply(fs.renameSync, fs, args);
          if (
            semanticManifestLanded === false &&
            String(args[1]).endsWith(`${path.sep}manifest.json`)
          ) {
            semanticManifestLanded = true;
            fs.writeFileSync(
              renderPath(`${semanticBundle}/${frames[0]!.path}`),
              Buffer.from("changed frame"),
            );
          }
          return result;
        }) as typeof fs.renameSync,
      });
      let semanticReceiptLanded = false;
      const ledgerRace = createTestFileSystem({
        renameSync: ((...args: unknown[]) => {
          const result = Reflect.apply(fs.renameSync, fs, args);
          if (
            semanticReceiptLanded === false &&
            String(args[1]).includes(`${path.sep}render-receipts${path.sep}`)
          ) {
            semanticReceiptLanded = true;
            fs.writeFileSync(
              renderPath(`${semanticBundle}/manifest.json`),
              "{}",
            );
          }
          return result;
        }) as typeof fs.renameSync,
      });
      const bundleRefusals = {
        foreignPath: commitBundle(
          "bundles/elsewhere",
          bundleFiles,
          bundleManifest,
        ),
        nonCanonicalEntry: commitBundle(
          bundle,
          new Map([["./preview/frame_000000.png", picture]]),
          bundleManifest,
        ),
        repeatedPortable: commitBundle(
          bundle,
          new Map([...bundleFiles, ["PREVIEW/frame_000000.png", picture]]),
          bundleManifest,
        ),
        repeatedFrame: commitBundle(bundle, bundleFiles, {
          ...bundleManifest,
          frames: [...frames, frames[0]!],
        }),
        driftedFrame: commitBundle(
          bundle,
          new Map([[frames[0]!.path, Buffer.from("other")]]),
          bundleManifest,
        ),
        retainedRecommit: commitBundle(bundle, new Map(), bundleManifest),
        semanticWithoutMaskFrame: commitBundle(bundle, bundleFiles, {
          ...bundleManifest,
          semanticMasks: [semanticReceipt(0, sidecarPath)],
        }),
        unclaimedPayload: commitBundle(
          bundle,
          new Map([
            ...bundleFiles,
            ["preview/stray.bin", Buffer.from("stray")],
          ]),
          bundleManifest,
        ),
        sidecarOnFramePath: commitBundle(
          semanticBundle,
          withMask,
          maskManifest([semanticReceipt(0, maskFrame.path)]),
        ),
        maskWithoutSemantic: commitBundle(
          semanticBundle,
          withMask,
          semanticBase,
        ),
        tamperedSidecar: commitBundle(
          semanticBundle,
          new Map([...withMask, [sidecarPath, Buffer.from("{}\n")]]),
          completeSemantic,
        ),
        semanticCommitted: commitBundle(
          semanticBundle,
          withSidecar,
          completeSemantic,
        ),
        retainedSidecar: commitBundle(
          semanticBundle,
          new Map(),
          completeSemantic,
        ),
        payloadRace: withTestFileSystem(payloadRace.fileSystem, () =>
          commitBundle(semanticBundle, withSidecar, completeSemantic),
        ),
        ledgerRace: withTestFileSystem(ledgerRace.fileSystem, () =>
          commitBundle(semanticBundle, withSidecar, completeSemantic),
        ),
      };
      const semanticManifestFile = renderPath(
        `${semanticBundle}/manifest.json`,
      );
      const semanticReceiptFile = project.trackedStatePath(
        `render-receipts/${digestAutoMovieBytes(
          Buffer.from(semanticBundle, "utf8"),
        ).slice("sha256:".length)}.json`,
      );
      const committedSemanticManifest = fs.readFileSync(semanticManifestFile);
      const committedSemanticReceipt = fs.readFileSync(semanticReceiptFile);
      const verifiedWith = (manifest: unknown): boolean => {
        const bytes = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`);
        fs.writeFileSync(semanticManifestFile, bytes);
        fs.writeFileSync(
          semanticReceiptFile,
          JSON.stringify({
            version: 1,
            bundle: semanticBundle,
            manifestDigest: digestAutoMovieBytes(bytes),
          }),
        );
        try {
          return project.verifiedRenderManifest(semanticManifestFile) !== null;
        } finally {
          fs.writeFileSync(semanticManifestFile, committedSemanticManifest);
          fs.writeFileSync(semanticReceiptFile, committedSemanticReceipt);
        }
      };
      const reopened = {
        exact: verifiedWith(completeSemantic),
        duplicateSemantic: verifiedWith(
          maskManifest([
            semanticReceipt(0, sidecarPath),
            semanticReceipt(0, sidecarPath),
          ]),
        ),
        foreignSemantic: verifiedWith(
          maskManifest([
            { ...semanticReceipt(0, sidecarPath), shot: "closing" },
          ]),
        ),
        maskWithoutSemantic: verifiedWith(semanticBase),
      };
      TestValidator.equals(
        "the render bundle store refuses, re-observes, and reopens exactly",
        {
          ...bundleRefusals,
          tamperedSidecar: bundleRefusals.tamperedSidecar?.includes("semantic"),
          reopened,
        },
        {
          foreignPath: `Render bundle "bundles/elsewhere" is not the content-addressed path "${bundle}". Use the current target-local fingerprint and render spec.`,
          nonCanonicalEntry:
            'Render bundle path "./preview/frame_000000.png" is not one canonical bundle-relative identity.',
          repeatedPortable:
            'Render bundle repeats portable path "PREVIEW/frame_000000.png".',
          repeatedFrame: `Render bundle repeats frame path "${frames[0]!.path}".`,
          driftedFrame: `Supplied render frame "${frames[0]!.path}" differs from its manifest digest.`,
          retainedRecommit: null,
          semanticWithoutMaskFrame:
            "Render bundle semantic receipt for frame 0 is duplicate, foreign, or has no mask frame.",
          unclaimedPayload:
            "Render bundle supplied a payload that its manifest does not claim.",
          sidecarOnFramePath: `Render bundle repeats semantic sidecar path "${maskFrame.path}".`,
          maskWithoutSemantic:
            "Render bundle mask frames require one current semantic sidecar each.",
          tamperedSidecar: true,
          semanticCommitted: null,
          retainedSidecar: null,
          payloadRace:
            "Render bundle payload changed while its manifest and receipt were committed.",
          ledgerRace:
            "Render bundle manifest or receipt changed before revision commit.",
          reopened: {
            exact: true,
            duplicateSemantic: false,
            foreignSemantic: false,
            maskWithoutSemantic: false,
          },
        },
      );

      // 3c. Raw provider bytes and attempt records are immutable per attempt,
      //     and every read of them names the exact cause of a refusal.
      const NEW_REQUEST = "50000000-0000-4000-8000-000000000001";
      const NEW_ATTEMPT = "60000000-0000-4000-8000-000000000001";
      const rawPublication = (
        productionId: string,
        requestId: string,
        attemptId: string,
      ) =>
        planAutoMovieRepaintRawOutput({
          productionId,
          shot: "opening",
          requestId,
          attemptId,
          bytes: clip,
          mediaType: "video/mp4",
          disposition: "candidate-source",
          retainedAt: "2026-08-28T12:05:00.000Z",
          maximumBytes: clip.length,
        });
      const rawRefusals = {
        absent: refusal(() =>
          project.repaintRawOutput(firstReceipt.requestId!, NEW_ATTEMPT),
        ),
        foreignProduction: refusal(() =>
          project.commitRepaintRawOutput(
            rawPublication("another-production", NEW_REQUEST, NEW_ATTEMPT),
          ),
        ),
        alreadyResident: refusal(() =>
          project.commitRepaintRawOutput(
            rawPublication(
              "fixture-film",
              firstReceipt.requestId!,
              firstReceipt.attemptId,
            ),
          ),
        ),
        staleInputs: refusal(() =>
          project.commitRepaintRawOutput(
            rawPublication("fixture-film", NEW_REQUEST, NEW_ATTEMPT),
            () => false,
          ),
        ),
      };
      project.commitRepaintRawOutput(
        rawPublication("fixture-film", NEW_REQUEST, NEW_ATTEMPT),
      );
      const firstAttempt = project.repaintRequestAttempts(
        firstReceipt.requestId!,
      )[0]!;
      const rawMismatch = refusal(() =>
        project.commitRepaintAttempt({
          ...firstAttempt,
          requestId: NEW_REQUEST,
          attemptId: NEW_ATTEMPT,
          availableOutput: {
            digest: `sha256:${"f".repeat(64)}`,
            bytes: clip.length,
            receipt: productionRepaintRawOutputReceiptPath(
              NEW_REQUEST,
              NEW_ATTEMPT,
            ),
          },
        }),
      );
      const newRawReceiptFile = project.trackedStatePath(
        productionRepaintRawOutputReceiptPath(NEW_REQUEST, NEW_ATTEMPT),
      );
      const newRawReceiptBytes = fs.readFileSync(newRawReceiptFile);
      fs.writeFileSync(newRawReceiptFile, "{}");
      const malformedRaw = refusal(() =>
        project.repaintRawOutput(NEW_REQUEST, NEW_ATTEMPT),
      );
      fs.writeFileSync(newRawReceiptFile, newRawReceiptBytes);
      TestValidator.equals(
        "raw output revisions and attempt journals are immutable per attempt",
        {
          ...Object.fromEntries(
            Object.entries(rawRefusals).map(([name, message]) => [
              name,
              message?.split(/\.(?=\s|$)/u)[0] ?? null,
            ]),
          ),
          rawMismatch: rawMismatch?.split(/\.(?=\s|$)/u)[0] ?? null,
          malformedRaw: malformedRaw?.split(/\.(?=\s|$)/u)[0] ?? null,
        },
        {
          absent: `Repaint raw output receipt "${productionRepaintRawOutputReceiptPath(firstReceipt.requestId!, NEW_ATTEMPT)}" is absent`,
          foreignProduction: "Repaint raw output belongs to another production",
          alreadyResident: `Repaint raw output receipt "${productionRepaintRawOutputReceiptPath(firstReceipt.requestId!, firstReceipt.attemptId)}" already exists; raw revisions are immutable`,
          staleInputs:
            "Production inputs changed before the guarded commit began",
          rawMismatch: `Repaint attempt "${NEW_ATTEMPT}" does not cite its exact resident raw output revision`,
          malformedRaw: `Repaint raw output receipt "${productionRepaintRawOutputReceiptPath(NEW_REQUEST, NEW_ATTEMPT)}" is malformed`,
        },
      );

      // 3d. A third candidate completed at the same instant as the second,
      //     whose journal predates raw-output receipts, still verifies; the
      //     inspection then names every way a stored record can stop being
      //     readable, well formed, canonical, current, or intact.
      const third = await new AutoMovieProductionRepaintService(
        adapter,
        adoption(),
        {
          policy,
          evidence: requestEvidence(),
          now: () => new Date(secondReceipt.completedAt!),
        },
      ).repaint(services, request(19));
      if (third.repainted === false)
        throw new Error(
          `The third repaint was refused: ${JSON.stringify(third.diagnostics)}`,
        );
      const thirdReceipt = third.receipt!;
      const attemptFile = (receipt: IAutoMovieRepaintReceipt): string =>
        project.trackedStatePath(
          `renditions/attempts/${receipt.requestId}/${receipt.attemptId}.json`,
        );
      const thirdAttempt = JSON.parse(
        fs.readFileSync(attemptFile(thirdReceipt), "utf8"),
      ) as { availableOutput: { receipt?: string } };
      delete thirdAttempt.availableOutput.receipt;
      fs.writeFileSync(
        attemptFile(thirdReceipt),
        `${JSON.stringify(thirdAttempt, null, 2)}\n`,
      );
      const candidateFindings = (
        inspection = project.inspectVerifiedRepaintCandidates(["opening"]),
      ): { records: string[]; findings: string[] } => ({
        records: inspection.records.map((record) => record.value.attemptId),
        findings: inspection.findings.map(
          (finding) =>
            `${finding.target.shot}:${finding.target.recordId}:${finding.stage}:${finding.failure}`,
        ),
      });
      const allRecords = [
        firstReceipt.attemptId,
        ...[secondReceipt.attemptId, thirdReceipt.attemptId].sort(
          compareCodeUnits,
        ),
      ];
      const recordIdOf = (receipt: IAutoMovieRepaintReceipt): string =>
        productionRepaintReceiptPath(receipt.output.path).slice(
          "renditions/".length,
          -".json".length,
        );
      const secondRecord = recordIdOf(secondReceipt);
      const secondReceiptFile = project.trackedStatePath(
        productionRepaintReceiptPath(secondReceipt.output.path),
      );
      const secondReceiptBytes = fs.readFileSync(secondReceiptFile);
      const secondOutput = renderPath(secondReceipt.output.path);
      const secondOutputBytes = fs.readFileSync(secondOutput);
      const parked = `${renditionsRoot}.parked`;
      const openFault = (
        file: string,
        error: () => unknown,
      ): ReturnType<typeof createTestFileSystem> =>
        createTestFileSystem({
          openSync: ((...args: unknown[]) => {
            if (String(args[0]) === file) throw error();
            return Reflect.apply(fs.openSync, fs, args);
          }) as typeof fs.openSync,
        });
      const readdirFault = createTestFileSystem({
        readdirSync: ((...args: unknown[]) => {
          if (String(args[0]) === renditionsRoot) throw platformError("EIO");
          return Reflect.apply(fs.readdirSync, fs, args);
        }) as typeof fs.readdirSync,
      });
      const vanishFault = createTestFileSystem({
        lstatSync: ((...args: unknown[]) => {
          if (String(args[0]).endsWith(`${path.sep}vanish.json`))
            throw platformError("ENOENT");
          return Reflect.apply(fs.lstatSync, fs, args);
        }) as typeof fs.lstatSync,
      });
      const candidateInspections: Record<
        string,
        ReturnType<typeof candidateFindings>
      > = {};
      candidateInspections.complete = candidateFindings();
      candidateInspections.otherShot = candidateFindings(
        project.inspectVerifiedRepaintCandidates(["closing"]),
      );
      fs.renameSync(renditionsRoot, parked);
      candidateInspections.absentDirectory = candidateFindings();
      fs.symlinkSync(parked, renditionsRoot, "junction");
      candidateInspections.linkedDirectory = candidateFindings();
      fs.rmSync(renditionsRoot, { force: true });
      fs.renameSync(parked, renditionsRoot);
      candidateInspections.unreadableDirectory = withTestFileSystem(
        readdirFault.fileSystem,
        () => candidateFindings(),
      );
      fs.mkdirSync(path.join(renditionsRoot, "directory.json"));
      candidateInspections.directoryEntry = candidateFindings();
      fs.rmdirSync(path.join(renditionsRoot, "directory.json"));
      fs.writeFileSync(path.join(renditionsRoot, "vanish.json"), "{}");
      candidateInspections.vanishedEntry = withTestFileSystem(
        vanishFault.fileSystem,
        () => candidateFindings(),
      );
      fs.rmSync(path.join(renditionsRoot, "vanish.json"));
      candidateInspections.unreadableReceipt = withTestFileSystem(
        openFault(secondReceiptFile, () => platformError("EIO")).fileSystem,
        () => candidateFindings(),
      );
      fs.rmSync(secondOutput);
      candidateInspections.outputMissing = candidateFindings();
      fs.mkdirSync(secondOutput);
      candidateInspections.outputDirectory = candidateFindings();
      fs.rmdirSync(secondOutput);
      fs.writeFileSync(
        secondOutput,
        Buffer.concat([secondOutputBytes, Buffer.from([0])]),
      );
      candidateInspections.outputCorrupt = candidateFindings();
      fs.writeFileSync(secondOutput, secondOutputBytes);
      candidateInspections.hostileOutput = withTestFileSystem(
        openFault(secondOutput, hostileError).fileSystem,
        () => candidateFindings(),
      );
      fs.writeFileSync(
        secondReceiptFile,
        JSON.stringify({
          ...(JSON.parse(
            secondReceiptBytes.toString("utf8"),
          ) as IAutoMovieRepaintReceipt),
          compileFingerprint: `sha256:${"9".repeat(64)}`,
        }),
      );
      candidateInspections.staleReceipt = candidateFindings();
      fs.writeFileSync(secondReceiptFile, secondReceiptBytes);
      candidateInspections.unreadableAttempt = withTestFileSystem(
        openFault(attemptFile(secondReceipt), () => platformError("EIO"))
          .fileSystem,
        () => candidateFindings(),
      );
      const withoutSecond = allRecords.filter(
        (attemptId) => attemptId !== secondReceipt.attemptId,
      );
      TestValidator.equals(
        "candidate inspection names every unreadable, malformed, stale, or corrupt record",
        candidateInspections,
        {
          complete: { records: allRecords, findings: [] },
          otherShot: { records: [], findings: [] },
          absentDirectory: { records: [], findings: [] },
          linkedDirectory: {
            records: [],
            findings: ["unresolved:renditions:enumeration:unsafe-locator"],
          },
          unreadableDirectory: {
            records: [],
            findings: ["unresolved:renditions:enumeration:unavailable"],
          },
          directoryEntry: {
            records: allRecords,
            findings: ["unresolved:directory:receipt:unsafe-locator"],
          },
          vanishedEntry: {
            records: allRecords,
            findings: ["unresolved:vanish:receipt:absent"],
          },
          unreadableReceipt: {
            records: withoutSecond,
            findings: [`unresolved:${secondRecord}:receipt:unavailable`],
          },
          outputMissing: {
            records: withoutSecond,
            findings: [`opening:${secondRecord}:output:unavailable`],
          },
          outputDirectory: {
            records: withoutSecond,
            findings: [`opening:${secondRecord}:output:unsafe-locator`],
          },
          outputCorrupt: {
            records: withoutSecond,
            findings: [`opening:${secondRecord}:receipt:identity-invalid`],
          },
          hostileOutput: {
            records: withoutSecond,
            findings: [`opening:${secondRecord}:output:unavailable`],
          },
          staleReceipt: {
            records: withoutSecond,
            findings: [`opening:${secondRecord}:currentness:stale`],
          },
          unreadableAttempt: {
            records: withoutSecond,
            findings: [`opening:${secondRecord}:output:render-corrupt`],
          },
        },
      );

      // 3e. The active pointer and its selection chain are re-read through the
      //     same classification, and the selection reader refuses every record
      //     that moves between its inspection and its second read.
      const activePath = project.trackedStatePath(
        productionRepaintActiveReceiptPath("opening"),
      );
      const activeBytes = fs.readFileSync(activePath);
      const pointer = JSON.parse(activeBytes.toString("utf8")) as {
        version: 2;
        shot: string;
        selection: string;
        receipt: string;
        output: string;
      };
      const selectionFile = project.trackedStatePath(pointer.selection);
      const selectionBytes = fs.readFileSync(selectionFile);
      const selectionRecord = JSON.parse(
        selectionBytes.toString("utf8"),
      ) as Record<string, unknown>;
      const firstReceiptFile = project.trackedStatePath(
        productionRepaintReceiptPath(firstReceipt.output.path),
      );
      const firstReceiptBytes = fs.readFileSync(firstReceiptFile);
      const firstOutput = renderPath(firstReceipt.output.path);
      const firstOutputBytes = fs.readFileSync(firstOutput);
      const renditionFindings = (): {
        records: string[];
        findings: string[];
      } => {
        const inspection = project.inspectVerifiedRepaintRenditions([
          "opening",
        ]);
        return {
          records: inspection.records.map((record) => record.value.attemptId),
          findings: inspection.findings.map(
            (finding) => `${finding.stage}:${finding.failure}`,
          ),
        };
      };
      const writeRecord = (file: string, value: unknown): void => {
        fs.writeFileSync(
          file,
          typeof value === "string" ? value : JSON.stringify(value),
        );
      };
      const withPointer = <T>(
        value: unknown,
        task: () => T = renditionFindings as () => T,
      ): T => {
        writeRecord(activePath, value);
        try {
          return task();
        } finally {
          fs.writeFileSync(activePath, activeBytes);
        }
      };
      const SELECTION_ID = "70000000-0000-4000-8000-000000000001";
      const craftedSelectionPath = `renditions/selections/opening/${SELECTION_ID}.json`;
      const craftedSelectionFile =
        project.trackedStatePath(craftedSelectionPath);
      const crafted = (
        overrides: Record<string, unknown>,
      ): Record<string, unknown> => ({
        ...selectionRecord,
        selectionId: SELECTION_ID,
        kind: "selection",
        previousSelection: null,
        ...overrides,
      });
      const withSelection = <T>(
        record: unknown,
        task: () => T = renditionFindings as () => T,
      ): T => {
        writeRecord(craftedSelectionFile, record);
        try {
          return withPointer(
            { ...pointer, selection: craftedSelectionPath },
            task,
          );
        } finally {
          fs.rmSync(craftedSelectionFile, { force: true });
        }
      };
      const withEntry = <T>(
        file: string,
        create: () => void,
        remove: () => void,
        task: () => T,
      ): T => {
        create();
        try {
          return task();
        } finally {
          remove();
          void file;
        }
      };
      const receiptRecord = (name: string, value: unknown) =>
        withEntry(
          name,
          () => writeRecord(project.trackedStatePath(name), value),
          () => fs.rmSync(project.trackedStatePath(name), { force: true }),
          () => withSelection(crafted({ candidateReceipt: name })),
        );
      const renditionInspections = {
        control: withSelection(crafted({})),
        pointerNotJson: withPointer("{bad"),
        pointerSchema: withPointer({}),
        pointerIdentity: withPointer({
          ...pointer,
          output: "renditions/other.mp4",
        }),
        pointerDirectory: withEntry(
          activePath,
          () => {
            fs.rmSync(activePath);
            fs.mkdirSync(activePath);
          },
          () => {
            fs.rmdirSync(activePath);
            fs.writeFileSync(activePath, activeBytes);
          },
          renditionFindings,
        ),
        pointerLinked: withEntry(
          activePath,
          () => {
            fs.rmSync(activePath);
            fs.symlinkSync(renditionsRoot, activePath, "junction");
          },
          () => {
            fs.rmSync(activePath, { force: true });
            fs.writeFileSync(activePath, activeBytes);
          },
          renditionFindings,
        ),
        selectionAbsent: withPointer({
          ...pointer,
          selection: craftedSelectionPath,
        }),
        selectionNotJson: withSelection("{bad"),
        selectionSchema: withSelection({}),
        selectionInvalidIdentifier: withSelection(
          crafted({ selectionId: "not-a-uuid" }),
        ),
        selectionCycle: withSelection(
          crafted({ previousSelection: craftedSelectionPath }),
        ),
        selectionDirectory: withEntry(
          craftedSelectionFile,
          () => fs.mkdirSync(craftedSelectionFile),
          () => fs.rmdirSync(craftedSelectionFile),
          () => withPointer({ ...pointer, selection: craftedSelectionPath }),
        ),
        selectionLinked: withEntry(
          craftedSelectionFile,
          () =>
            fs.symlinkSync(renditionsRoot, craftedSelectionFile, "junction"),
          () => fs.rmSync(craftedSelectionFile, { force: true }),
          () => withPointer({ ...pointer, selection: craftedSelectionPath }),
        ),
        selectionForeignShot: withSelection(crafted({ shot: "closing" })),
        receiptAbsent: withSelection(
          crafted({ candidateReceipt: "renditions/absent.json" }),
        ),
        receiptDirectory: withEntry(
          "renditions/directory.json",
          () =>
            fs.mkdirSync(project.trackedStatePath("renditions/directory.json")),
          () =>
            fs.rmdirSync(project.trackedStatePath("renditions/directory.json")),
          () =>
            withSelection(
              crafted({ candidateReceipt: "renditions/directory.json" }),
            ),
        ),
        receiptLinked: withEntry(
          "renditions/linked.json",
          () =>
            fs.symlinkSync(
              renditionsRoot,
              project.trackedStatePath("renditions/linked.json"),
              "junction",
            ),
          () =>
            fs.rmSync(project.trackedStatePath("renditions/linked.json"), {
              force: true,
            }),
          () =>
            withSelection(
              crafted({ candidateReceipt: "renditions/linked.json" }),
            ),
        ),
        receiptNotJson: receiptRecord("renditions/bad.json", "{bad"),
        receiptSchema: receiptRecord("renditions/empty.json", {}),
        termsStale: withEntry(
          firstReceiptFile,
          () =>
            writeRecord(firstReceiptFile, {
              ...(JSON.parse(
                firstReceiptBytes.toString("utf8"),
              ) as IAutoMovieRepaintReceipt),
              generatorProvenance: {
                ...firstReceipt.generatorProvenance,
                termsCheckedAt: "2026-08-29",
              },
            }),
          () => fs.writeFileSync(firstReceiptFile, firstReceiptBytes),
          renditionFindings,
        ),
        outputMissing: withEntry(
          firstOutput,
          () => fs.rmSync(firstOutput),
          () => fs.writeFileSync(firstOutput, firstOutputBytes),
          renditionFindings,
        ),
        outputCorrupt: withEntry(
          firstOutput,
          () =>
            fs.writeFileSync(
              firstOutput,
              Buffer.concat([firstOutputBytes, Buffer.from([0])]),
            ),
          () => fs.writeFileSync(firstOutput, firstOutputBytes),
          renditionFindings,
        ),
      };
      const one = (finding: string) => ({ records: [], findings: [finding] });
      TestValidator.equals(
        "rendition inspection classifies every pointer, selection, receipt, and output fault",
        renditionInspections,
        {
          control: { records: [firstReceipt.attemptId], findings: [] },
          pointerNotJson: one("pointer:schema-invalid"),
          pointerSchema: one("pointer:schema-invalid"),
          pointerIdentity: one("pointer:identity-invalid"),
          pointerDirectory: one("pointer:unavailable"),
          pointerLinked: one("pointer:unsafe-locator"),
          selectionAbsent: one("selection:absent"),
          selectionNotJson: one("selection:schema-invalid"),
          selectionSchema: one("selection:schema-invalid"),
          selectionInvalidIdentifier: one("selection:unavailable"),
          selectionCycle: one("selection:identity-invalid"),
          selectionDirectory: one("selection:unavailable"),
          selectionLinked: one("selection:unsafe-locator"),
          selectionForeignShot: one("selection:identity-invalid"),
          receiptAbsent: one("receipt:absent"),
          receiptDirectory: one("receipt:unavailable"),
          receiptLinked: one("receipt:unsafe-locator"),
          receiptNotJson: one("receipt:schema-invalid"),
          receiptSchema: one("receipt:schema-invalid"),
          termsStale: one("currentness:stale"),
          outputMissing: one("output:unavailable"),
          outputCorrupt: one("receipt:identity-invalid"),
        },
      );

      const raceAfterReceiptOpen = (props: {
        vanish?: string;
        rewrite?: { file: string; bytes: Buffer };
      }): ReturnType<typeof createTestFileSystem> => {
        let receiptOpened = false;
        const descriptors = new Map<number, string>();
        return createTestFileSystem({
          openSync: ((...args: unknown[]) => {
            const file = String(args[0]);
            const descriptor = Reflect.apply(fs.openSync, fs, args) as number;
            descriptors.set(descriptor, file);
            if (file === firstReceiptFile) receiptOpened = true;
            return descriptor;
          }) as typeof fs.openSync,
          lstatSync: ((...args: unknown[]) => {
            if (receiptOpened && String(args[0]) === props.vanish)
              throw platformError("ENOENT");
            return Reflect.apply(fs.lstatSync, fs, args);
          }) as typeof fs.lstatSync,
          readFileSync: ((...args: unknown[]) => {
            if (
              receiptOpened &&
              props.rewrite !== undefined &&
              typeof args[0] === "number" &&
              descriptors.get(args[0]) === props.rewrite.file
            )
              return props.rewrite.bytes;
            return Reflect.apply(fs.readFileSync, fs, args);
          }) as typeof fs.readFileSync,
        });
      };
      const selections = (): string | null =>
        refusal(() => project.verifiedRepaintSelections(["opening"]))?.split(
          ".",
        )[0] ?? null;
      const selectionReads = {
        inspectionRefused: withPointer({}, selections),
        pointerVanished: withTestFileSystem(
          raceAfterReceiptOpen({ vanish: activePath }).fileSystem,
          selections,
        ),
        pointerMalformed: withTestFileSystem(
          raceAfterReceiptOpen({
            rewrite: { file: activePath, bytes: Buffer.from("{}") },
          }).fileSystem,
          selections,
        ),
        selectionVanished: withTestFileSystem(
          raceAfterReceiptOpen({ vanish: selectionFile }).fileSystem,
          selections,
        ),
        selectionMismatch: withTestFileSystem(
          raceAfterReceiptOpen({
            rewrite: {
              file: selectionFile,
              bytes: Buffer.from(
                JSON.stringify({ ...selectionRecord, shot: "closing" }),
              ),
            },
          }).fileSystem,
          selections,
        ),
        current: selections(),
      };
      fs.writeFileSync(path.join(renditionsRoot, "garbage.json"), "{not json");
      const selectionRefusalOf = (attemptId: string): string | null =>
        refusal(() =>
          project.selectRepaintCandidate({
            shot: "opening",
            attemptId,
            kind: "selection",
            reason: "The review keeps the authored structure.",
            structuralReview: "The deterministic silhouette remains exact.",
            continuityReview: null,
            selectedAt: "2026-08-28T13:05:00.000Z",
          }),
        )?.split(/\.(?=\s|$)/u)[0] ?? null;
      const candidateInspectionRefused = selectionRefusalOf(
        "00000000-0000-4000-8000-000000000000",
      );
      fs.rmSync(path.join(renditionsRoot, "garbage.json"));
      const activeInspectionRefused = withPointer({}, () =>
        selectionRefusalOf(secondReceipt.attemptId),
      );
      TestValidator.equals(
        "selection reads and selections refuse records that move or fail inspection",
        {
          ...selectionReads,
          candidateInspectionRefused,
          activeInspectionRefused,
        },
        {
          inspectionRefused:
            "Current repaint selection inspection refused: opening:pointer:schema-invalid",
          pointerVanished:
            'Current repaint selection for shot "opening" vanished',
          pointerMalformed:
            'Current repaint pointer for shot "opening" is malformed',
          selectionVanished:
            'Current repaint selection for shot "opening" vanished',
          selectionMismatch:
            'Current repaint selection for shot "opening" does not match its verified candidate',
          current: null,
          candidateInspectionRefused:
            "Repaint candidate inspection refused: garbage:receipt:schema-invalid",
          activeInspectionRefused:
            "Current repaint selection inspection refused: pointer:schema-invalid",
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
        current: IAutoMovieRepaintSequenceObservation = observation,
      ): NonNullable<
        (typeof fixture.manifest)["deliverables"][number]["rendition"]
      > => ({
        version: 2,
        kind: "visual-lanes",
        memberSetDigest: digestAutoMovieRepaintObservationMembers(members),
        observationDigest: digestAutoMovieBytes(
          canonicalAutoMovieJsonBytes(current),
        ),
        observation: current,
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
        current: IAutoMovieRepaintSequenceObservation = observation,
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
        deliverable.rendition = provenance(selectionDigest, current);
        return { files, manifest };
      };
      const gateOf = (): string[] =>
        fixture
          .finalRenderDiagnostics()
          .map(
            (diagnostic) =>
              `${diagnostic.code}: ${diagnostic.message.split(".")[0]}`,
          );
      const exact = publication(selection!.selectionDigest);
      fixture.publish(exact);
      const exactGate = gateOf();
      const stale = publication(
        `sha256:${"e".repeat(64)}` as AutoMovieContentDigest,
      );
      fixture.publish(stale);
      const staleGate = gateOf();
      // The observation names a playback artifact the render root no longer
      // holds, so the aggregate observation cannot be re-verified.
      fixture.publish(
        publication(selection!.selectionDigest, {
          ...observation,
          artifact: {
            ...observation.artifact,
            path: "observations/absent.mp4",
          },
        }),
      );
      const orphanArtifactGate = gateOf();
      TestValidator.equals(
        "the repainted feature passes the final gate only with its exact selection chain",
        { exactGate, staleGate, orphanArtifactGate },
        {
          exactGate: [],
          staleGate: [
            "render-rendition-provenance-invalid: Repaint occurrence 0 does not cite its exact current selection chain",
          ],
          orphanArtifactGate: [
            "render-rendition-provenance-invalid: Feature manifest aggregate sequence observation is stale",
          ],
        },
      );
    } finally {
      fixture.dispose();
    }
  };
