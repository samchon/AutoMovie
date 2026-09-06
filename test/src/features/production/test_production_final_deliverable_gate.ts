import type {
  AutoMovieContentDigest,
  IAutoMovieProductionRenderManifest,
  IAutoMovieProductionRenderReceipt,
  IAutoMovieProductionRenditionDelivery,
  IAutoMovieProductionSoundEvidence,
  IAutoMovieRepaintSequenceObservation,
} from "@automovie/interface";
import {
  AutoMovieProductionCompiler,
  AutoMovieProductionProject,
  canonicalAutoMovieJsonBytes,
  digestAutoMovieBytes,
  digestAutoMovieRepaintObservationMembers,
  muxProductionFeatureMp4,
  parseProductionRenderManifestBytes,
  parseProductionRenderReceiptBytes,
  probeProductionMedia,
  productionDeterministicVisualSourceDigest,
  productionRenderPublicationIdentity,
  productionVisualDeliveryOccurrence,
} from "@automovie/production";
import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import path from "node:path";

import { finalPublicationFixture } from "./finalPublicationFixtures";
import {
  productionH264Mp4,
  productionOpusMp4,
  productionWebVtt,
} from "./productionMediaFixtures";

const digest = (digit: string): AutoMovieContentDigest =>
  `sha256:${digit.repeat(64)}`;

type Manifest = IAutoMovieProductionRenderManifest;
type Receipt = IAutoMovieProductionRenderReceipt;
type Deliverable = Manifest["deliverables"][number];
type DeliverableFile = Deliverable["files"][number];

/**
 * The final-scope deliverable gate names every way a published ledger can
 * stop describing the current film, one diagnostic per cause.
 *
 * The committed publication is the reference; each scenario rewrites the
 * tracked manifest and receipt, or one published byte source, into exactly one
 * inconsistency and reads the render diagnostics of a final compile against
 * the current plan.
 *
 * Scenarios:
 *
 * 1. Plan and ledger identity: no current plan, a missing or drifted receipt,
 *    a malformed or foreign-schema manifest, a publication identity of another
 *    plan, a receipt bound to another publication, a stale compile fingerprint,
 *    and a receipt that repeats a path.
 * 2. Deliverable and file records: duplicated or foreign deliverables, empty
 *    populations, escaping or repeated paths, impossible byte facts, drifted
 *    bytes, receipt mismatches, unreadable media, drifted media facts,
 *    semantic sidecars without, unbound, or tampered receipts, missing files,
 *    receipt files nobody owns, and absent required deliverables.
 * 3. Media joins: a feature with two files or the wrong frame count, a guide
 *    without its controls or with reordered controls and sidecars, a preview
 *    that is not a picture, captions with two files or drifted text, an audio
 *    delivery missing a raster, and every sound-evidence currentness rule.
 * 4. Rendition provenance: a non-feature claiming provenance is refused, a
 *    feature with exact deterministic lane provenance passes, and a feature
 *    whose lane count drifted is refused.
 */
export const test_production_final_deliverable_gate =
  async (): Promise<void> => {
    const fixture = await finalPublicationFixture();
    try {
      fixture.publish();
      const project = fixture.project;
      const manifestPath = project.trackedStatePath("render-manifest.json");
      const receiptPath = project.trackedStatePath(
        "render-manifest-receipt.json",
      );
      const committedManifest = parseProductionRenderManifestBytes(
        fs.readFileSync(manifestPath),
      );
      const committedReceipt = parseProductionRenderReceiptBytes(
        fs.readFileSync(receiptPath),
      );
      const renderFile = (relative: string): string =>
        path.join(project.renderRoot(), ...relative.split("/"));
      const receiptFor = (
        manifestBytes: Uint8Array,
        files = committedReceipt.files,
        publicationFingerprint = committedReceipt.publicationFingerprint,
      ): Receipt => ({
        version: 4,
        manifestDigest: digestAutoMovieBytes(manifestBytes),
        publicationFingerprint,
        files: structuredClone(files),
      });
      const write = (
        manifestBytes: Uint8Array,
        receipt: Receipt | null,
      ): void => {
        fs.writeFileSync(manifestPath, manifestBytes);
        if (receipt === null) fs.rmSync(receiptPath, { force: true });
        else
          fs.writeFileSync(receiptPath, canonicalAutoMovieJsonBytes(receipt));
      };
      /** Published bytes of every replaced file, restored before each run. */
      const originals = new Map<string, Uint8Array>();
      /** Rewrite the ledger through `mutate` and read the render diagnostics. */
      const run = (props: {
        manifest?: (manifest: Manifest) => void;
        receipt?: (receipt: Receipt, manifest: Manifest) => void;
        plan?: Parameters<typeof fixture.finalRenderDiagnostics>[0];
      }): string[] => {
        for (const [relative, bytes] of originals)
          fs.writeFileSync(renderFile(relative), bytes);
        const manifest = structuredClone(committedManifest);
        props.manifest?.(manifest);
        const receipt = receiptFor(new Uint8Array());
        props.receipt?.(receipt, manifest);
        // The receipt callback may replace byte sources, so the manifest is
        // serialized after it and the receipt digest follows those bytes.
        const bytes = canonicalAutoMovieJsonBytes(manifest);
        receipt.manifestDigest = digestAutoMovieBytes(bytes);
        write(bytes, receipt);
        return fixture
          .finalRenderDiagnostics(props.plan)
          .map((diagnostic) => `${diagnostic.code}: ${diagnostic.message}`);
      };
      const deliverable = (manifest: Manifest, id: string): Deliverable =>
        manifest.deliverables.find((candidate) => candidate.id === id)!;
      const fileOf = (
        manifest: Manifest,
        id: string,
        suffix: string,
      ): DeliverableFile =>
        deliverable(manifest, id).files.find((file) =>
          file.path.endsWith(suffix),
        )!;
      const receiptEntry = (
        receipt: Receipt,
        file: string,
      ): Receipt["files"][number] =>
        receipt.files.find((entry) => entry.path === file)!;
      /** Replace one published byte source and its manifest and receipt facts. */
      const replaceBytes = (
        manifest: Manifest,
        receipt: Receipt,
        id: string,
        suffix: string,
        bytes: Uint8Array,
        facts?: Partial<
          Pick<Deliverable, "runtimeSeconds" | "frameCount" | "codec">
        >,
      ): void => {
        const file = fileOf(manifest, id, suffix);
        if (originals.has(file.path) === false)
          originals.set(file.path, fs.readFileSync(renderFile(file.path)));
        fs.writeFileSync(renderFile(file.path), bytes);
        file.digest = digestAutoMovieBytes(bytes);
        file.bytes = bytes.length;
        const entry = receiptEntry(receipt, file.path);
        entry.digest = file.digest;
        entry.bytes = file.bytes;
        entry.probe = probeProductionMedia({
          kind: deliverable(manifest, id).kind,
          mediaType: file.mediaType,
          bytes,
        });
        Object.assign(deliverable(manifest, id), facts);
      };
      /** Copy one published file to a sibling path and claim it in `id`. */
      const addCopy = (
        manifest: Manifest,
        receipt: Receipt,
        id: string,
        source: DeliverableFile,
        name: string,
        mediaType = source.mediaType,
      ): void => {
        const target = `${source.path.slice(0, source.path.lastIndexOf("/"))}/${name}`;
        fs.copyFileSync(renderFile(source.path), renderFile(target));
        const file: DeliverableFile = { ...source, path: target, mediaType };
        deliverable(manifest, id).files.push(file);
        receipt.files.push({
          ...file,
          deliverable: id,
          probe: probeProductionMedia({
            kind: deliverable(manifest, id).kind,
            mediaType,
            bytes: fs.readFileSync(renderFile(target)),
          }),
        });
      };
      const publishedEvidence = JSON.parse(
        fs.readFileSync(
          renderFile(
            fileOf(committedManifest, "starter-audio", "evidence.json").path,
          ),
          "utf8",
        ),
      ) as IAutoMovieProductionSoundEvidence;
      const evidenceOf = (): IAutoMovieProductionSoundEvidence =>
        structuredClone(publishedEvidence);
      const withEvidence = (
        mutate: (evidence: IAutoMovieProductionSoundEvidence) => void,
      ): string[] =>
        run({
          receipt: (receipt, manifest) => {
            const evidence = evidenceOf();
            mutate(evidence);
            replaceBytes(
              manifest,
              receipt,
              "starter-audio",
              "evidence.json",
              Buffer.from(`${JSON.stringify(evidence, null, 2)}\n`, "utf8"),
            );
          },
        });
      const foreignPlan = {
        ...fixture.plan,
        compileFingerprint: digest("9"),
      };
      const otherPlanIdentity = productionRenderPublicationIdentity({
        ...fixture.plan,
        runtimeIdentity: {
          ...fixture.plan.runtimeIdentity,
          sourceDigest: digest("e"),
        },
      });

      const ledger = {
        noPlan: run({ plan: null }),
        receiptMissing: (() => {
          write(canonicalAutoMovieJsonBytes(committedManifest), null);
          return fixture
            .finalRenderDiagnostics()
            .map((diagnostic) => `${diagnostic.code}: ${diagnostic.message}`);
        })(),
        receiptDrifted: (() => {
          write(
            canonicalAutoMovieJsonBytes(committedManifest),
            receiptFor(Buffer.from("other bytes")),
          );
          return fixture
            .finalRenderDiagnostics()
            .map((diagnostic) => `${diagnostic.code}: ${diagnostic.message}`);
        })(),
        malformed: (() => {
          const bytes = Buffer.from('{"version":2,"version":2}');
          write(bytes, receiptFor(bytes));
          return fixture
            .finalRenderDiagnostics()
            .map((diagnostic) => `${diagnostic.code}: ${diagnostic.message}`);
        })(),
        foreignSchema: run({
          manifest: (manifest) => {
            (manifest as { version: number }).version = 3;
          },
        }),
        otherPlan: run({
          manifest: (manifest) => {
            manifest.publication = otherPlanIdentity;
          },
          receipt: (receipt) => {
            receipt.publicationFingerprint = otherPlanIdentity.fingerprint;
          },
        }),
        foreignReceiptPublication: run({
          receipt: (receipt) => {
            receipt.publicationFingerprint = digest("f");
          },
        }),
        staleCompile: run({
          plan: foreignPlan,
          manifest: (manifest) => {
            manifest.compileFingerprint = digest("9");
            manifest.publication =
              productionRenderPublicationIdentity(foreignPlan);
          },
          receipt: (receipt) => {
            receipt.publicationFingerprint =
              productionRenderPublicationIdentity(foreignPlan).fingerprint;
          },
        }),
        receiptRepeatsPath: run({
          receipt: (receipt) => {
            receipt.files.push(structuredClone(receipt.files[0]!));
          },
        }),
      };
      // A receipt entry outside the portable path grammar owns nothing, and
      // the ledger says so beside whatever else that entry left unowned.
      const receiptEscapesPath = run({
        receipt: (receipt) => {
          receipt.files.push({
            ...structuredClone(receipt.files[0]!),
            path: "../escape.png",
          });
        },
      });
      const ledgerExpectations: Record<keyof typeof ledger, string> = {
        noPlan:
          "render-deliverable-stale: Final delivery verification requires the current final render plan",
        receiptMissing:
          "render-deliverable-unowned: The aggregate render manifest lacks the matching renderer-owned receipt",
        receiptDrifted:
          "render-deliverable-unowned: The aggregate render manifest lacks the matching renderer-owned receipt",
        malformed:
          "render-deliverable-invalid: The aggregate render manifest is not valid JSON",
        foreignSchema:
          "render-deliverable-invalid: The active production render manifest does not satisfy the aggregate render-ledger schema",
        otherPlan:
          "render-deliverable-invalid: Stored final publication identity does not match the current final render plan",
        foreignReceiptPublication:
          "render-deliverable-stale: The final manifest and renderer-owned receipt do not carry one matching final-tier render-plan identity",
        staleCompile:
          "render-deliverable-stale: Required deliverables are not bound to the current compile fingerprint",
        receiptRepeatsPath:
          "render-deliverable-unowned: The renderer-owned receipt repeats a physical file path",
      };
      TestValidator.predicate(
        "a receipt entry outside the portable path grammar owns nothing",
        receiptEscapesPath.some((diagnostic) =>
          diagnostic.startsWith(
            "render-deliverable-unowned: The renderer-owned receipt repeats a physical file path or spells one outside the canonical portable form",
          ),
        ),
      );
      TestValidator.equals(
        "ledger identity refusals return one diagnostic each",
        Object.fromEntries(
          Object.entries(ledger).map(([name, diagnostics]) => [
            name,
            {
              count: diagnostics.length,
              named: diagnostics[0]?.startsWith(
                ledgerExpectations[name as keyof typeof ledger],
              ),
            },
          ]),
        ),
        Object.fromEntries(
          Object.keys(ledger).map((name) => [name, { count: 1, named: true }]),
        ),
      );

      const previewPath = fileOf(
        committedManifest,
        "starter-preview",
        "preview.png",
      ).path;
      const records = run({
        manifest: (manifest) => {
          manifest.deliverables.push(
            structuredClone(deliverable(manifest, "starter-preview")),
          );
          deliverable(manifest, "starter-captions").kind = "audio-mix";
          deliverable(manifest, "starter-pose-guide").files = [];
          deliverable(manifest, "starter-preview").files = [];
          deliverable(manifest, "starter-preview").rendition = {
            version: 2,
            kind: "visual-lanes",
            memberSetDigest: digest("a"),
            observationDigest: null,
            observation: null,
            shots: [],
          };
        },
      });
      const files = run({
        manifest: (manifest) => {
          fileOf(manifest, "starter-preview", "preview.png").path =
            "../escape.png";
          const feature = deliverable(manifest, "starter-feature");
          feature.files.push(structuredClone(feature.files[0]!));
          fileOf(manifest, "starter-audio", "evidence.json").bytes = 0;
          delete fileOf(
            manifest,
            "starter-mask-guide",
            "frame_00000000.semantic.json",
          ).semanticMask;
        },
        receipt: (receipt, manifest) => {
          delete receiptEntry(
            receipt,
            fileOf(
              manifest,
              "starter-mask-guide",
              "frame_00000000.semantic.json",
            ).path,
          ).semanticMask;
        },
      });
      const missingPath = `${previewPath.slice(0, previewPath.lastIndexOf("/"))}/absent.png`;
      const drift = run({
        manifest: (manifest) => {
          fileOf(manifest, "starter-preview", "preview.png").bytes += 1;
          const waveform = fileOf(manifest, "starter-audio", "waveform.png");
          waveform.path = `${waveform.path.slice(0, waveform.path.lastIndexOf("/"))}/absent.png`;
          const bound = fileOf(
            manifest,
            "starter-mask-guide",
            "frame_00000001.semantic.json",
          );
          bound.semanticMask = {
            ...bound.semanticMask!,
            sidecar: { ...bound.semanticMask!.sidecar, path: missingPath },
          };
          const tampered = fileOf(
            manifest,
            "starter-mask-guide",
            "frame_00000002.semantic.json",
          );
          tampered.semanticMask = {
            ...tampered.semanticMask!,
            sidecar: { ...tampered.semanticMask!.sidecar, digest: digest("d") },
          };
          const incomplete = fileOf(
            manifest,
            "starter-mask-guide",
            "frame_00000003.semantic.json",
          );
          incomplete.semanticMask = {
            ...incomplete.semanticMask!,
            coverage: { unresolved: [], unaddressed: 1 },
          };
        },
        receipt: (receipt, manifest) => {
          receiptEntry(
            receipt,
            fileOf(manifest, "starter-captions", "captions.vtt").path,
          ).digest = digest("c");
          const control = receiptEntry(
            receipt,
            fileOf(manifest, "starter-pose-guide", "frame_00000000.png").path,
          );
          if (control.probe.kind === "png") control.probe.width += 1;
          const waveform = receipt.files.find((entry) =>
            entry.path.endsWith("waveform.png"),
          )!;
          waveform.path = fileOf(manifest, "starter-audio", "absent.png").path;
          receipt.files.push({
            ...structuredClone(receipt.files[0]!),
            path: `${previewPath.slice(0, previewPath.lastIndexOf("/"))}/orphan.png`,
          });
          for (const suffix of [
            "frame_00000001.semantic.json",
            "frame_00000002.semantic.json",
            "frame_00000003.semantic.json",
          ]) {
            const file = fileOf(manifest, "starter-mask-guide", suffix);
            receiptEntry(receipt, file.path).semanticMask = file.semanticMask;
          }
        },
      });
      const absent = run({
        manifest: (manifest) => {
          manifest.deliverables = manifest.deliverables.filter(
            (candidate) => candidate.id !== "starter-captions",
          );
          fileOf(manifest, "starter-preview", "preview.png").mediaType =
            "text/vtt";
        },
        receipt: (receipt, manifest) => {
          receipt.files = receipt.files.filter(
            (entry) => entry.deliverable !== "starter-captions",
          );
          receiptEntry(
            receipt,
            fileOf(manifest, "starter-preview", "preview.png").path,
          ).mediaType = "text/vtt";
        },
      });
      const includes = (diagnostics: string[], fragment: string): boolean =>
        diagnostics.some((diagnostic) => diagnostic.includes(fragment));
      TestValidator.equals(
        "deliverable and file record refusals name their cause",
        {
          duplicated: includes(
            records,
            "is duplicated in the aggregate render manifest",
          ),
          foreignKind: includes(
            records,
            "does not match current production design",
          ),
          empty: includes(records, "has no output file"),
          nonFeatureRendition: includes(
            records,
            "Only feature delivery may claim repaint rendition provenance",
          ),
          escaping: includes(
            files,
            "is not one canonical portable relative path",
          ),
          claimedTwice: includes(files, "is claimed more than once"),
          impossibleBytes: includes(
            files,
            "needs a positive integer byte size",
          ),
          sidecarWithoutReceipt: includes(
            files,
            "has no semantic receipt in its deliverable ledger",
          ),
          driftedBytes: includes(
            drift,
            "bytes do not match its recorded size and digest",
          ),
          receiptMismatch: includes(
            drift,
            "lacks one exact renderer-owned byte and media-probe receipt",
          ),
          driftedFacts: includes(
            drift,
            "current media facts differ from its renderer-owned receipt",
          ),
          missingFile: includes(drift, "Re-render the missing owned output"),
          orphanReceipt: includes(
            drift,
            "is not owned by the current aggregate manifest",
          ),
          unboundSidecar: includes(drift, "names sidecar path"),
          tamperedSidecar: includes(
            drift,
            "Recreate the semantic sidecar from its current mask frame",
          ),
          incompleteSidecar: includes(
            drift,
            "a delivered mask product requires complete runtime coverage",
          ),
          requiredAbsent: includes(
            absent,
            "is absent from the aggregate render manifest",
          ),
          unreadableMedia: includes(absent, "failed current media probing"),
        },
        {
          duplicated: true,
          foreignKind: true,
          empty: true,
          nonFeatureRendition: true,
          escaping: true,
          claimedTwice: true,
          impossibleBytes: true,
          sidecarWithoutReceipt: true,
          driftedBytes: true,
          receiptMismatch: true,
          driftedFacts: true,
          missingFile: true,
          orphanReceipt: true,
          unboundSidecar: true,
          tamperedSidecar: true,
          incompleteSidecar: true,
          requiredAbsent: true,
          unreadableMedia: true,
        },
      );

      const shortVideo = await productionH264Mp4({
        width: fixture.plan.frameFormat.width,
        height: fixture.plan.frameFormat.height,
        fps: fixture.plan.frameFormat.fps,
        frameCount: 4,
      });
      const shortFeature = muxProductionFeatureMp4({
        video: shortVideo,
        audio: productionOpusMp4(8_000),
      });
      const population = run({
        receipt: (receipt, manifest) => {
          addCopy(
            manifest,
            receipt,
            "starter-feature",
            fileOf(manifest, "starter-feature", "feature.mp4"),
            "second.mp4",
          );
          const pose = deliverable(manifest, "starter-pose-guide");
          const dropped = pose.files.find((file) =>
            file.path.endsWith("frame_00000003.png"),
          )!;
          pose.files = pose.files.filter((file) => file !== dropped);
          receipt.files = receipt.files.filter(
            (entry) => entry.path !== dropped.path,
          );
          addCopy(
            manifest,
            receipt,
            "starter-captions",
            fileOf(manifest, "starter-captions", "captions.vtt"),
            "second.vtt",
          );
          const audio = deliverable(manifest, "starter-audio");
          const waveform = fileOf(manifest, "starter-audio", "waveform.png");
          audio.files = audio.files.filter((file) => file !== waveform);
          receipt.files = receipt.files.filter(
            (entry) => entry.path !== waveform.path,
          );
          const mask = deliverable(manifest, "starter-mask-guide");
          const [firstSidecar, secondSidecar] = mask.files.filter((file) =>
            file.path.endsWith(".semantic.json"),
          );
          const firstIndex = mask.files.indexOf(firstSidecar!);
          const secondIndex = mask.files.indexOf(secondSidecar!);
          mask.files[firstIndex] = secondSidecar!;
          mask.files[secondIndex] = firstSidecar!;
          const [firstControl, secondControl] = mask.files.filter((file) =>
            file.path.endsWith(".png"),
          );
          const controlA = mask.files.indexOf(firstControl!);
          const controlB = mask.files.indexOf(secondControl!);
          mask.files[controlA] = secondControl!;
          mask.files[controlB] = firstControl!;
        },
      });
      const facts = run({
        receipt: (receipt, manifest) => {
          replaceBytes(
            manifest,
            receipt,
            "starter-feature",
            "feature.mp4",
            shortFeature,
          );
          replaceBytes(
            manifest,
            receipt,
            "starter-captions",
            "captions.vtt",
            productionWebVtt(),
          );
          const evidence = evidenceOf();
          evidence.plan.inputFingerprint = digest("9");
          replaceBytes(
            manifest,
            receipt,
            "starter-audio",
            "evidence.json",
            Buffer.from(`${JSON.stringify(evidence, null, 2)}\n`, "utf8"),
          );
          const guideProbe = probeProductionMedia({
            kind: "guide-pass",
            mediaType: "video/mp4",
            bytes: shortVideo,
          });
          replaceBytes(
            manifest,
            receipt,
            "starter-pose-guide",
            "pose.mp4",
            shortVideo,
            {
              runtimeSeconds:
                guideProbe.kind === "video" ? guideProbe.runtimeSeconds : null,
              frameCount:
                guideProbe.kind === "video" ? guideProbe.frameCount : null,
            },
          );
        },
      });
      const featureProbe = probeProductionMedia({
        kind: "feature",
        mediaType: "video/mp4",
        bytes: shortFeature,
      });
      const timelineJoin = run({
        receipt: (receipt, manifest) => {
          replaceBytes(
            manifest,
            receipt,
            "starter-feature",
            "feature.mp4",
            shortFeature,
            {
              runtimeSeconds:
                featureProbe.kind === "feature"
                  ? featureProbe.video.runtimeSeconds
                  : null,
              frameCount:
                featureProbe.kind === "feature"
                  ? featureProbe.video.frameCount
                  : null,
            },
          );
          const evidence = evidenceOf();
          evidence.plan.events = [];
          replaceBytes(
            manifest,
            receipt,
            "starter-audio",
            "evidence.json",
            Buffer.from(`${JSON.stringify(evidence, null, 2)}\n`, "utf8"),
          );
        },
      });
      const sound = {
        undeclaredAcoustics: withEvidence((evidence) => {
          evidence.plan.events[0]!.acousticResponse = {
            status: "not-run",
            path: null,
            reason: "no acoustic profile is declared",
          };
        }),
        pcmBoundary: withEvidence((evidence) => {
          evidence.analysis.sampleFrames += 1;
        }),
        alignmentIdentities: withEvidence((evidence) => {
          evidence.analysis.eventAlignment = [];
        }),
        alignmentGate: withEvidence((evidence) => {
          evidence.analysis.eventAlignment[0]!.passed = false;
        }),
        ttsIdentities: withEvidence((evidence) => {
          evidence.tts = [];
        }),
        siblingAudio: withEvidence((evidence) => {
          evidence.audio.digest = digest("b");
        }),
      };
      const shortAudio = productionOpusMp4(8_000);
      const presentation = run({
        receipt: (receipt, manifest) => {
          const evidence = evidenceOf();
          evidence.audio.digest = digestAutoMovieBytes(shortAudio);
          evidence.audio.bytes = shortAudio.length;
          replaceBytes(
            manifest,
            receipt,
            "starter-audio",
            "audio.mp4",
            shortAudio,
            {
              runtimeSeconds: 8_000 / 48_000,
            },
          );
          replaceBytes(
            manifest,
            receipt,
            "starter-audio",
            "evidence.json",
            Buffer.from(`${JSON.stringify(evidence, null, 2)}\n`, "utf8"),
          );
        },
      });
      TestValidator.equals(
        "media joins are refused by the exact rule that fails",
        {
          featureTwoFiles: includes(
            population,
            "Expected exactly one feature MP4, observed 2",
          ),
          guideControls: includes(population, "Guide delivery requires"),
          previewPictures: includes(
            records,
            "Preview delivery must own one or more PNG pictures only",
          ),
          captionTwoFiles: includes(
            population,
            "Expected exactly one caption WebVTT, observed 2",
          ),
          audioPopulation: includes(
            population,
            "Audio delivery must own audio.mp4, evidence.json, waveform.png, and spectrogram.png only",
          ),
          maskOrder:
            includes(
              population,
              "Guide control 0 must own the continuous path",
            ) ||
            includes(
              population,
              "Mask semantic sidecar 0 must own the continuous path",
            ),
          featureFacts: includes(
            facts,
            "Render manifest feature.runtimeSeconds must equal its parser-derived media fact",
          ),
          captionText: includes(
            facts,
            "Caption bytes differ from the complete current canonical WebVTT plan",
          ),
          evidenceCompile: includes(
            facts,
            "does not share the current compile fingerprint",
          ),
          guideTimeline: includes(
            facts,
            "Video sample count 4 differs from current timeline",
          ),
          featureTimeline: includes(
            timelineJoin,
            "Video sample count 4 differs from current timeline",
          ),
          evidencePlan: includes(
            timelineJoin,
            "does not contain the complete current compiler-derived sound plan",
          ),
          undeclaredAcoustics: includes(
            sound.undeclaredAcoustics,
            "carries an undeclared acoustic response",
          ),
          pcmBoundary: includes(
            sound.pcmBoundary,
            "does not describe the exact current pre-encode PCM boundary",
          ),
          alignmentIdentities: includes(
            sound.alignmentIdentities,
            "Sound analysis event identities or order differ",
          ),
          alignmentGate: includes(
            sound.alignmentGate,
            "does not match its current planned boundary and passing frame gate",
          ),
          ttsIdentities: includes(
            sound.ttsIdentities,
            "Sound TTS receipt identities or order differ",
          ),
          siblingAudio: includes(
            sound.siblingAudio,
            "Sound evidence differs from the complete current plan",
          ),
          presentation: includes(
            presentation,
            "Final Opus presentation does not end at the current pre-encode PCM boundary",
          ),
        },
        {
          featureTwoFiles: true,
          guideControls: true,
          previewPictures: true,
          captionTwoFiles: true,
          audioPopulation: true,
          maskOrder: true,
          featureFacts: true,
          captionText: true,
          evidenceCompile: true,
          guideTimeline: true,
          featureTimeline: true,
          evidencePlan: true,
          undeclaredAcoustics: true,
          pcmBoundary: true,
          alignmentIdentities: true,
          alignmentGate: true,
          ttsIdentities: true,
          siblingAudio: true,
          presentation: true,
        },
      );

      const occurrences = fixture.timeline.segments.map((segment, index) => ({
        occurrence: productionVisualDeliveryOccurrence(segment, index),
        shot: segment.shot,
      }));
      const deterministicShots: IAutoMovieProductionRenditionDelivery["shots"] =
        occurrences.map((occurrence) => {
          const sourceDigest = productionDeterministicVisualSourceDigest({
            compileFingerprint: fixture.inputFingerprint,
            occurrence: occurrence.occurrence,
          });
          return {
            occurrence: occurrence.occurrence,
            shot: occurrence.shot,
            lane: "deterministic",
            path: `generated/deterministic/${encodeURIComponent(occurrence.occurrence)}`,
            digest: sourceDigest,
            sourceDigest,
            receiptDigest: null,
            selectionDigest: null,
          };
        });
      const rendition = (
        shots: IAutoMovieProductionRenditionDelivery["shots"],
      ): IAutoMovieProductionRenditionDelivery => ({
        version: 2,
        kind: "visual-lanes",
        memberSetDigest: digestAutoMovieRepaintObservationMembers(
          shots.map((shot) => ({
            occurrence: shot.occurrence,
            shot: shot.shot,
            lane: "deterministic" as const,
            sourceDigest: shot.sourceDigest,
          })),
        ),
        observationDigest: null,
        observation: null,
        shots,
      });
      const exactLanes = run({
        manifest: (manifest) => {
          deliverable(manifest, "starter-feature").rendition =
            rendition(deterministicShots);
        },
      });
      const driftedLanes = run({
        manifest: (manifest) => {
          deliverable(manifest, "starter-feature").rendition = rendition(
            deterministicShots.slice(0, 1),
          );
        },
      });
      const laneRefusal = (
        mutate: (
          value: IAutoMovieProductionRenditionDelivery,
        ) => IAutoMovieProductionRenditionDelivery,
      ): string[] =>
        run({
          manifest: (manifest) => {
            deliverable(manifest, "starter-feature").rendition = mutate(
              rendition(deterministicShots),
            );
          },
        }).map((diagnostic) => diagnostic.split(".")[0]!);
      const deterministicObservation: IAutoMovieRepaintSequenceObservation = {
        version: 1,
        productionId: "fixture-film",
        compileFingerprint: fixture.inputFingerprint,
        timelineFingerprint: digestAutoMovieBytes(
          canonicalAutoMovieJsonBytes(fixture.timeline),
        ),
        baseline: {
          address: "docs/continuity.md#baseline",
          version: "v1",
          scope: fixture.timeline.segments.map((segment) => segment.shot),
          intendedDeltas: [],
        },
        members: deterministicShots.map((shot) => ({
          occurrence: shot.occurrence,
          shot: shot.shot,
          lane: "deterministic" as const,
          sourceDigest: shot.sourceDigest,
        })),
        memberSetDigest: rendition(deterministicShots).memberSetDigest,
        artifact: { path: "observations/none.mp4", digest: digest("7") },
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
      const laneRefusals = {
        reordered: laneRefusal((value) => ({
          ...value,
          shots: [...value.shots].reverse(),
        })),
        foreignDeterministicSource: laneRefusal((value) => ({
          ...value,
          shots: value.shots.map((shot, index) =>
            index === 0
              ? { ...shot, path: "generated/deterministic/elsewhere" }
              : shot,
          ),
        })),
        staleMembers: laneRefusal((value) => ({
          ...value,
          memberSetDigest: digest("a"),
        })),
        observationWithoutRepaint: laneRefusal((value) => ({
          ...value,
          observation: deterministicObservation,
          observationDigest: digestAutoMovieBytes(
            canonicalAutoMovieJsonBytes(deterministicObservation),
          ),
        })),
      };
      TestValidator.equals(
        "deterministic lane provenance passes exactly and drifts by name",
        {
          exactLanes,
          driftedLanes: driftedLanes.map(
            (diagnostic) => diagnostic.split(".")[0],
          ),
          ...laneRefusals,
        },
        {
          exactLanes: [],
          driftedLanes: [
            "render-rendition-provenance-invalid: Feature manifest does not carry the exact current occurrence-lane protocol",
          ],
          reordered: [
            "render-rendition-provenance-invalid: Visual lane occurrence 0 is stale or reordered",
          ],
          foreignDeterministicSource: [
            "render-rendition-provenance-invalid: Deterministic occurrence 0 carries repaint provenance",
          ],
          staleMembers: [
            "render-rendition-provenance-invalid: Feature manifest active visual member set is stale",
          ],
          observationWithoutRepaint: [
            "render-rendition-provenance-invalid: Feature manifest aggregate sequence observation is stale",
          ],
        },
      );

      // A compiled film whose generated timeline is gone leaves the delivery
      // with nothing current to join to; a read-only final verification says
      // so instead of regenerating the timeline it is asked to judge against.
      const timelineFile = path.join(
        fixture.project.generatedRoot(),
        "film-timeline.json",
      );
      const generatedTimeline = fs.readFileSync(timelineFile);
      fs.rmSync(timelineFile);
      const missingTimeline = new AutoMovieProductionCompiler(
        AutoMovieProductionProject.openReadOnly(fixture.root),
        fixture.evidence,
        () => fixture.evidence,
        fixture.plan,
      )
        .lint({ scope: "final" })
        .diagnostics.map(
          (diagnostic) => `${diagnostic.code}: ${diagnostic.message}`,
        );
      fs.writeFileSync(timelineFile, generatedTimeline);
      TestValidator.predicate(
        "a delivery without a current compiled film timeline cannot be joined",
        includes(
          missingTimeline,
          "Final delivery cannot be joined to the current compiled film timeline",
        ),
      );
    } finally {
      fixture.dispose();
    }
  };
