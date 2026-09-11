import {
  deriveProductionSoundPlan,
  equalProductionFrameRates,
  productionFrameBoundaryToGridTick,
  resolveProductionFrameRate,
} from "@automovie/engine";
import {
  AutoMovieContentDigest,
  AutoMovieDiagnosticCode,
  IAutoMovieCompiledShotSource,
  IAutoMovieDiagnostic,
  IAutoMovieFilmTimeline,
  IAutoMovieProductionMediaProbe,
  IAutoMovieProductionRenderManifest,
  IAutoMovieProductionRenderReceipt,
  IAutoMovieShotContract,
} from "@automovie/interface";
import {
  assertProductionOpusProfile,
  assertProductionPngPicture,
  assertProductionVideoProfile,
  productionVisualDeliveryOccurrence,
  resolveProductionPngProfile,
  resolveProductionVideoProfile,
} from "@automovie/render";
import { assertProductionFeatureUsesRenditionClips } from "@automovie/render/node";
import path from "node:path";

import { AUTOMOVIE_SEMANTIC_MASK_MEDIA_TYPE } from "./AUTOMOVIE_SEMANTIC_MASK_MEDIA_TYPE";
import { AutoMovieProductionProject } from "./AutoMovieProductionProject";
import { assertProductionRenderedDeliverableFacts } from "./assertProductionRenderedDeliverableFacts";
import {
  canonicalAutoMovieJsonBytes,
  digestAutoMovieBytes,
  encodeAutoMoviePathSegment,
} from "./contentIdentity";
import { readAutoMovieFilmTimeline } from "./filmTimeline";
import { probeProductionMedia } from "./probeProductionMedia";
import { errorMessage, normalizeSlash } from "./productionBuildDiagnostics";
import {
  type IAutoMovieProductionRenderJobPlan,
  canonicalProductionWebVtt,
} from "./productionRenderJob";
import {
  AutoMovieProductionRenderLedgerSchemaError,
  parseProductionRenderManifestBytes,
  parseProductionRenderReceiptBytes,
} from "./productionRenderLedgerRecords";
import {
  assertProductionRenderPublicationCurrent,
  isPortableProductionPublicationPath,
  parseProductionRenderPublicationIdentity,
} from "./productionRenderPublicationIdentity";
import {
  planAutoMovieVisualDelivery,
  productionDeterministicVisualSourceDigest,
} from "./repaintDeliveryLane";
import {
  autoMovieRepaintSequenceObservationDiagnostics,
  digestAutoMovieRepaintObservationMembers,
} from "./repaintSequenceObservation";
import { classifyAutoMovieProductionDeliverableSemanticMask } from "./semanticMaskEvidence";
import { verifyProductionNonVideoDeliverables } from "./verifyProductionNonVideoDeliverables";

/** Verify published deliverables against their current byte and media facts. */
export const finalDeliverableDiagnostics = (
  project: AutoMovieProductionProject,
  production: ReturnType<AutoMovieProductionProject["graph"]>["production"],
  inputFingerprint: AutoMovieContentDigest,
  contracts: ReadonlyMap<string, IAutoMovieShotContract>,
  compiled: ReadonlyMap<string, IAutoMovieCompiledShotSource>,
  currentPlan?: IAutoMovieProductionRenderJobPlan,
): IAutoMovieDiagnostic[] => {
  if (production === null) return [];
  let bytes: Uint8Array | null;
  try {
    bytes = project.readTrackedStateFile("render-manifest.json");
  } catch {
    bytes = Buffer.from("unsafe tracked render manifest");
  }
  if (bytes === null)
    return [
      {
        code: "render-deliverable-missing",
        category: "error",
        phase: "render",
        target: production.id,
        path: `automovie/productions/${encodeAutoMoviePathSegment(project.productionId)}/render-manifest.json`,
        message:
          "Required deliverables have no current render manifest. Run the project render command before final compilation.",
      },
    ];
  // A publication proves only that some plan generation produced it. Whether
  // that generation is the one currently planned is a comparison with the
  // final plan, and a caller that supplies none has asked a question this gate
  // cannot answer; it says so rather than trusting the manifest's own claim.
  if (currentPlan === undefined)
    return [
      renderDeliverableDiagnostic(
        "render-deliverable-stale",
        production.id,
        "Final delivery verification requires the current final render plan to compare the publication against. Run the project verify command, which supplies the current final plan generation.",
      ),
    ];
  const manifestDigest = digestAutoMovieBytes(bytes);
  let receipt: IAutoMovieProductionRenderReceipt | null = null;
  try {
    const receiptBytes = project.readTrackedStateFile(
      "render-manifest-receipt.json",
    );
    if (receiptBytes !== null)
      receipt = parseProductionRenderReceiptBytes(receiptBytes);
  } catch {
    receipt = null;
  }
  if (
    receipt === null ||
    receipt.version !== 4 ||
    receipt.manifestDigest !== manifestDigest
  )
    return [
      renderDeliverableDiagnostic(
        "render-deliverable-unowned",
        production.id,
        "The aggregate render manifest lacks the matching renderer-owned receipt. Recreate it through the production render command instead of editing tracked state directly.",
      ),
    ];
  let manifest: IAutoMovieProductionRenderManifest;
  try {
    manifest = parseProductionRenderManifestBytes(bytes);
  } catch (error) {
    return [
      renderDeliverableDiagnostic(
        "render-deliverable-invalid",
        production.id,
        error instanceof AutoMovieProductionRenderLedgerSchemaError
          ? `The active production render manifest does not satisfy the aggregate render-ledger schema: ${error.violations.join("; ")}. Recreate it through the production render command.`
          : "The aggregate render manifest is not valid JSON. Recreate it through the production render command.",
      ),
    ];
  }
  let publication: ReturnType<typeof parseProductionRenderPublicationIdentity>;
  try {
    publication = assertProductionRenderPublicationCurrent({
      identity: manifest.publication,
      plan: currentPlan,
    });
  } catch (error) {
    return [
      renderDeliverableDiagnostic(
        "render-deliverable-invalid",
        production.id,
        `${errorMessage(error)} Recreate the final publication from the current render plan.`,
      ),
    ];
  }
  if (
    publication.productionId !== production.id ||
    publication.tier.kind !== "final" ||
    publication.compileFingerprint !== manifest.compileFingerprint ||
    receipt.publicationFingerprint !== publication.fingerprint
  )
    return [
      renderDeliverableDiagnostic(
        "render-deliverable-stale",
        production.id,
        "The final manifest and renderer-owned receipt do not carry one matching final-tier render-plan identity. Replan and republish the current production.",
      ),
    ];
  if (manifest.compileFingerprint !== inputFingerprint)
    return [
      renderDeliverableDiagnostic(
        "render-deliverable-stale",
        production.id,
        "Required deliverables are not bound to the current compile fingerprint. Re-render the current production and replace the aggregate render manifest.",
      ),
    ];
  const diagnostics: IAutoMovieDiagnostic[] = [];
  let timeline: IAutoMovieFilmTimeline | null = null;
  try {
    timeline = readAutoMovieFilmTimeline(project, inputFingerprint);
  } catch (error) {
    diagnostics.push(
      renderDeliverableDiagnostic(
        "render-deliverable-stale",
        production.id,
        `${errorMessage(error)} Final delivery cannot be joined to the current compiled film timeline.`,
      ),
    );
  }
  const declared = new Map(
    production.deliverables.map((deliverable) => [deliverable.id, deliverable]),
  );
  const resident = new Map<
    string,
    IAutoMovieProductionRenderManifest["deliverables"][number]
  >();
  const filePaths = new Set<string>();
  const receiptByPath = new Map(
    receipt.files.flatMap((file) =>
      isPortableProductionPublicationPath(file.path)
        ? [[file.path.toLowerCase(), file] as const]
        : [],
    ),
  );
  if (receiptByPath.size !== receipt.files.length)
    diagnostics.push(
      renderDeliverableDiagnostic(
        "render-deliverable-unowned",
        production.id,
        "The renderer-owned receipt repeats a physical file path or spells one outside the canonical portable form. Recreate it through the production render command.",
      ),
    );
  const witnessedReceiptPaths = new Set<string>();
  for (const deliverable of manifest.deliverables) {
    if (resident.has(deliverable.id))
      diagnostics.push(
        renderDeliverableDiagnostic(
          "render-deliverable-invalid",
          deliverable.id,
          `Deliverable "${deliverable.id}" is duplicated in the aggregate render manifest. Keep one byte-exact record.`,
        ),
      );
    else resident.set(deliverable.id, deliverable);
    const contract = declared.get(deliverable.id);
    if (contract === undefined || contract.kind !== deliverable.kind)
      diagnostics.push(
        renderDeliverableDiagnostic(
          "render-deliverable-invalid",
          deliverable.id,
          `Deliverable "${deliverable.id}" kind "${deliverable.kind}" does not match current production design. Remove it or restore the exact declared id and kind.`,
        ),
      );
    if (deliverable.files.length === 0)
      diagnostics.push(
        renderDeliverableDiagnostic(
          "render-deliverable-incomplete",
          deliverable.id,
          `Deliverable "${deliverable.id}" has no output file. Render at least one owned byte artifact and record its digest and size.`,
        ),
      );
    const observed: IAutoMovieObservedDeliverableFile[] = [];
    for (const file of deliverable.files) {
      if (isPortableProductionPublicationPath(file.path) === false) {
        diagnostics.push(
          renderDeliverableDiagnostic(
            "render-deliverable-invalid",
            deliverable.id,
            `Render file "${file.path}" is not one canonical portable relative path. Rebuild the manifest without legacy path aliases.`,
            file.path,
          ),
        );
        continue;
      }
      const portablePath = file.path.toLowerCase();
      if (filePaths.has(portablePath))
        diagnostics.push(
          renderDeliverableDiagnostic(
            "render-deliverable-invalid",
            deliverable.id,
            `Render file "${file.path}" is claimed more than once. Give each owned output one deliverable owner.`,
            file.path,
          ),
        );
      filePaths.add(portablePath);
      witnessedReceiptPaths.add(portablePath);
      if (
        Number.isInteger(file.bytes) === false ||
        file.bytes <= 0 ||
        file.mediaType.trim().length === 0
      ) {
        diagnostics.push(
          renderDeliverableDiagnostic(
            "render-deliverable-invalid",
            deliverable.id,
            `Render file "${file.path}" needs a positive integer byte size and non-empty media type. Rebuild its ledger entry.`,
            file.path,
          ),
        );
        continue;
      }
      try {
        const actual = project.readRenderFile(file.path);
        if (
          actual.length !== file.bytes ||
          digestAutoMovieBytes(actual) !== file.digest
        )
          diagnostics.push(
            renderDeliverableDiagnostic(
              "render-deliverable-stale",
              deliverable.id,
              `Render file "${file.path}" bytes do not match its recorded size and digest. Re-render the current deliverable.`,
              file.path,
            ),
          );
        const receiptFile = receiptByPath.get(portablePath);
        if (
          receiptFile === undefined ||
          receiptFile.deliverable !== deliverable.id ||
          receiptFile.digest !== file.digest ||
          receiptFile.bytes !== file.bytes ||
          receiptFile.mediaType !== file.mediaType ||
          Buffer.from(
            canonicalAutoMovieJsonBytes(receiptFile.semanticMask ?? null),
          ).equals(
            Buffer.from(canonicalAutoMovieJsonBytes(file.semanticMask ?? null)),
          ) === false
        )
          diagnostics.push(
            renderDeliverableDiagnostic(
              "render-deliverable-unowned",
              deliverable.id,
              `Render file "${file.path}" lacks one exact renderer-owned byte and media-probe receipt. Recreate the aggregate manifest through the production render command.`,
              file.path,
            ),
          );
        else {
          let probe: IAutoMovieProductionMediaProbe;
          try {
            probe = probeProductionMedia({
              kind: deliverable.kind,
              mediaType: file.mediaType,
              bytes: actual,
            });
          } catch (error) {
            diagnostics.push(
              renderDeliverableDiagnostic(
                "render-deliverable-invalid",
                deliverable.id,
                `Render file "${file.path}" failed current media probing: ${errorMessage(error)} Re-render a valid declared medium.`,
                file.path,
              ),
            );
            continue;
          }
          if (canonicalizeProbe(probe) !== canonicalizeProbe(receiptFile.probe))
            diagnostics.push(
              renderDeliverableDiagnostic(
                "render-deliverable-unowned",
                deliverable.id,
                `Render file "${file.path}" current media facts differ from its renderer-owned receipt. Recreate the aggregate manifest.`,
                file.path,
              ),
            );
          else {
            // One classifier decides a sidecar's standing for the final gate,
            // the terminal commit, and the proxy preflight alike, so a
            // receipt that records incomplete runtime coverage is refused
            // here exactly as the other two boundaries refuse it.
            const semantic = classifyAutoMovieProductionDeliverableSemanticMask(
              {
                deliverable,
                file,
                probe,
                bytes: actual,
                plan: currentPlan,
              },
            );
            if (
              semantic.status === "media" ||
              semantic.status === "semantic-mask"
            )
              observed.push({ file, bytes: actual, probe });
            else
              diagnostics.push(
                renderDeliverableDiagnostic(
                  semantic.status === "unreceipted"
                    ? "render-deliverable-unowned"
                    : "render-deliverable-stale",
                  deliverable.id,
                  semantic.status === "stale"
                    ? `${semantic.reason} Recreate the semantic sidecar from its current mask frame.`
                    : semantic.reason,
                  file.path,
                ),
              );
          }
        }
      } catch (error) {
        diagnostics.push(
          renderDeliverableDiagnostic(
            "render-deliverable-missing",
            deliverable.id,
            `${errorMessage(error)} Re-render the missing owned output.`,
            file.path,
          ),
        );
      }
    }
    appendDeliverableTimelineDiagnostics(
      diagnostics,
      production,
      inputFingerprint,
      contracts,
      compiled,
      timeline,
      deliverable,
      observed,
    );
    appendRenditionDeliveryDiagnostics(
      diagnostics,
      project,
      production,
      inputFingerprint,
      deliverable,
    );
  }
  for (const file of receipt.files)
    if (witnessedReceiptPaths.has(file.path.toLowerCase()) === false)
      diagnostics.push(
        renderDeliverableDiagnostic(
          "render-deliverable-unowned",
          file.deliverable,
          `Renderer receipt file "${file.path}" is not owned by the current aggregate manifest. Recreate the manifest and receipt together.`,
          file.path,
        ),
      );
  for (const deliverable of production.deliverables)
    if (deliverable.required && resident.has(deliverable.id) === false)
      diagnostics.push(
        renderDeliverableDiagnostic(
          "render-deliverable-missing",
          deliverable.id,
          `Required ${deliverable.kind} deliverable "${deliverable.id}" is absent from the aggregate render manifest. Render and record it before final compilation.`,
        ),
      );
  return diagnostics;
};

const appendRenditionDeliveryDiagnostics = (
  diagnostics: IAutoMovieDiagnostic[],
  project: AutoMovieProductionProject,
  production: NonNullable<
    ReturnType<AutoMovieProductionProject["graph"]>["production"]
  >,
  inputFingerprint: AutoMovieContentDigest,
  deliverable: IAutoMovieProductionRenderManifest["deliverables"][number],
): void => {
  if (deliverable.kind !== "feature") {
    if (deliverable.rendition !== undefined)
      diagnostics.push(
        renderDeliverableDiagnostic(
          "render-rendition-provenance-invalid",
          deliverable.id,
          "Only feature delivery may claim repaint rendition provenance.",
        ),
      );
    return;
  }
  if (
    production.visualDelivery === "deterministic" &&
    deliverable.rendition === undefined
  )
    return;
  try {
    const timeline = readAutoMovieFilmTimeline(project, inputFingerprint);
    const occurrences = timeline.segments.map((segment, index) => ({
      occurrence: productionVisualDeliveryOccurrence(segment, index),
      shot: segment.shot,
    }));
    const declared =
      production.visualDelivery === "mixed"
        ? // The design validator requires an explicit lane population for a
          // mixed delivery, and a design that fails it never reaches this gate
          // with a current compile fingerprint.
          production.visualDeliveryLanes!
        : occurrences.map((occurrence) => ({
            ...occurrence,
            lane: production.visualDelivery,
          }));
    const repaintShots = [
      ...new Set(
        declared.flatMap((lane) =>
          lane.lane === "repainted" ? [lane.shot] : [],
        ),
      ),
    ];
    const selections = new Map(
      project
        .verifiedRepaintSelections(repaintShots)
        .map((selection) => [selection.receipt.shot, selection] as const),
    );
    if (
      deliverable.rendition === undefined ||
      deliverable.rendition.version !== 2 ||
      deliverable.rendition.kind !== "visual-lanes" ||
      deliverable.rendition.shots.length !== occurrences.length
    )
      throw new Error(
        "Feature manifest does not carry the exact current occurrence-lane protocol.",
      );
    const members = deliverable.rendition.shots.map((segment, index) => {
      const occurrence = occurrences[index];
      const lane = declared[index];
      if (
        occurrence === undefined ||
        lane === undefined ||
        segment.occurrence !== occurrence.occurrence ||
        segment.shot !== occurrence.shot ||
        lane.occurrence !== occurrence.occurrence ||
        lane.shot !== occurrence.shot ||
        segment.lane !== lane.lane
      )
        throw new Error(
          `Visual lane occurrence ${index} is stale or reordered.`,
        );
      if (segment.lane === "deterministic") {
        if (
          segment.receiptDigest !== null ||
          segment.selectionDigest !== null ||
          segment.sourceDigest !== segment.digest ||
          segment.path !==
            `generated/deterministic/${encodeAutoMoviePathSegment(segment.occurrence)}` ||
          segment.digest !==
            productionDeterministicVisualSourceDigest({
              compileFingerprint: inputFingerprint,
              occurrence: segment.occurrence,
            })
        )
          throw new Error(
            `Deterministic occurrence ${index} carries repaint provenance.`,
          );
        return {
          occurrence: segment.occurrence,
          shot: segment.shot,
          lane: "deterministic" as const,
          sourceDigest: segment.sourceDigest,
        };
      }
      const selection = selections.get(segment.shot);
      if (
        selection === undefined ||
        segment.requestId !== selection.receipt.requestId ||
        segment.attemptId !== selection.receipt.attemptId ||
        segment.selectionId !== selection.selectionId ||
        segment.selectionDigest !== selection.selectionDigest ||
        segment.path !== selection.receipt.output.path ||
        segment.digest !== selection.receipt.output.digest ||
        segment.sourceDigest !== selection.receipt.output.digest ||
        segment.receiptDigest !==
          digestAutoMovieBytes(canonicalAutoMovieJsonBytes(selection.receipt))
      )
        throw new Error(
          `Repaint occurrence ${index} does not cite its exact current selection chain.`,
        );
      return {
        occurrence: segment.occurrence,
        shot: segment.shot,
        lane: "repainted" as const,
        requestId: segment.requestId,
        attemptId: segment.attemptId,
        outputDigest: segment.digest,
        candidateReceiptDigest: segment.receiptDigest,
        selectionId: segment.selectionId,
        selectionDigest: segment.selectionDigest,
      };
    });
    if (
      deliverable.rendition.memberSetDigest !==
      digestAutoMovieRepaintObservationMembers(members)
    )
      throw new Error("Feature manifest active visual member set is stale.");
    const observation = deliverable.rendition.observation;
    const observationDigest =
      observation === null
        ? null
        : digestAutoMovieBytes(canonicalAutoMovieJsonBytes(observation));
    if (
      deliverable.rendition.observationDigest !== observationDigest ||
      (repaintShots.length === 0
        ? observation !== null
        : observation === null ||
          autoMovieRepaintSequenceObservationDiagnostics({
            observation,
            productionId: production.id,
            compileFingerprint: inputFingerprint,
            timelineFingerprint: digestAutoMovieBytes(
              canonicalAutoMovieJsonBytes(timeline),
            ),
            baseline: observation.baseline,
            members,
            artifactDigest: (() => {
              try {
                return digestAutoMovieBytes(
                  project.readRenderFile(observation.artifact.path),
                );
              } catch {
                return null;
              }
            })(),
          }).length !== 0)
    )
      throw new Error(
        "Feature manifest aggregate sequence observation is stale.",
      );
    const deliveryPlan = planAutoMovieVisualDelivery({
      timeline: occurrences,
      lanes: deliverable.rendition.shots.map((segment) =>
        segment.lane === "deterministic"
          ? {
              occurrence: segment.occurrence,
              shot: segment.shot,
              lane: "deterministic" as const,
              deterministic: {
                path: segment.path,
                digest: segment.digest,
              },
              repaint: null,
            }
          : {
              occurrence: segment.occurrence,
              shot: segment.shot,
              lane: "repainted" as const,
              deterministic: null,
              repaint: {
                path: segment.path,
                digest: segment.digest,
                receiptDigest: segment.receiptDigest,
                selectionDigest: segment.selectionDigest,
              },
            },
      ),
      policy:
        production.visualDelivery === "mixed"
          ? // Required by the design validator beside the lane population.
            production.mixedVisualDeliveryPolicy!
          : null,
      currentObservationDigest: observationDigest,
    });
    if (deliveryPlan.diagnostics.length !== 0)
      throw new Error(
        `Feature manifest visual delivery plan is invalid: ${deliveryPlan.diagnostics.join(", ")}.`,
      );
    const feature = deliverable.files.find(
      (file) => file.mediaType === "video/mp4",
    );
    if (feature === undefined)
      throw new Error("Feature manifest has no video/mp4 output.");
    if (declared.every((lane) => lane.lane === "repainted"))
      assertProductionFeatureUsesRenditionClips({
        feature: project.readRenderFile(feature.path),
        timeline,
        clips: new Map(
          repaintShots.map((shot) => {
            const selection = selections.get(shot)!;
            return [
              shot,
              project.readRenderFile(selection.receipt.output.path),
            ] as const;
          }),
        ),
      });
  } catch (error) {
    diagnostics.push(
      renderDeliverableDiagnostic(
        "render-rendition-provenance-invalid",
        deliverable.id,
        `${errorMessage(error)} Re-finalize from current reviewed repaint receipts; deterministic fallback is not accepted for repainted delivery.`,
      ),
    );
  }
};

interface IAutoMovieObservedDeliverableFile {
  file: IAutoMovieProductionRenderManifest["deliverables"][number]["files"][number];
  bytes: Uint8Array;
  probe: IAutoMovieProductionMediaProbe;
}

const appendDeliverableTimelineDiagnostics = (
  diagnostics: IAutoMovieDiagnostic[],
  production: NonNullable<
    ReturnType<AutoMovieProductionProject["graph"]>["production"]
  >,
  inputFingerprint: AutoMovieContentDigest,
  contracts: ReadonlyMap<string, IAutoMovieShotContract>,
  compiled: ReadonlyMap<string, IAutoMovieCompiledShotSource>,
  timeline: IAutoMovieFilmTimeline | null,
  deliverable: IAutoMovieProductionRenderManifest["deliverables"][number],
  observed: readonly IAutoMovieObservedDeliverableFile[],
): void => {
  if (timeline === null) return;
  const frameRate = resolveProductionFrameRate(production.frameFormat);
  const profile = resolveProductionVideoProfile({
    width: production.frameFormat.width,
    height: production.frameFormat.height,
    frameRate,
  });
  const contract = production.deliverables.find(
    (candidate) => candidate.id === deliverable.id,
  );
  const byProbeKind = <Kind extends IAutoMovieProductionMediaProbe["kind"]>(
    kind: Kind,
  ): Array<
    IAutoMovieObservedDeliverableFile & {
      probe: Extract<IAutoMovieProductionMediaProbe, { kind: Kind }>;
    }
  > =>
    observed.filter(
      (
        item,
      ): item is IAutoMovieObservedDeliverableFile & {
        probe: Extract<IAutoMovieProductionMediaProbe, { kind: Kind }>;
      } => item.probe.kind === kind,
    );
  const exactlyOne = <Item>(items: readonly Item[], label: string): Item => {
    if (items.length !== 1)
      throw new Error(
        `Expected exactly one ${label}, observed ${items.length}.`,
      );
    return items[0]!;
  };
  try {
    if (observed.length !== deliverable.files.length)
      throw new Error(
        "Not every manifest file passed its exact current receipt and probe comparison.",
      );
    if (deliverable.kind === "feature") {
      // Every observed feature file probed as one video/mp4 feature, so the
      // single-file rule is the exactly-one rule above.
      const feature = exactlyOne(byProbeKind("feature"), "feature MP4");
      assertProductionRenderedDeliverableFacts({
        kind: deliverable.kind,
        runtimeSeconds: deliverable.runtimeSeconds,
        frameCount: deliverable.frameCount,
        codec: deliverable.codec,
        expectedCaptionRuntimeSeconds: null,
        probe: feature.probe,
      });
      assertProductionVideoProfile({
        expected: profile,
        actual: feature.probe.video,
      });
      assertProductionOpusProfile(feature.probe.audio);
      // The feature probe proved positive presentation clocks and exactly
      // equal audio and video runtimes when it admitted the file.
      assertExactVideoTimeline(feature.probe.video, timeline);
      return;
    }
    if (deliverable.kind === "guide-pass") {
      // The probe admits a guide video only under video/mp4.
      const video = exactlyOne(byProbeKind("video"), "guide video/mp4");
      assertProductionRenderedDeliverableFacts({
        kind: deliverable.kind,
        runtimeSeconds: deliverable.runtimeSeconds,
        frameCount: deliverable.frameCount,
        codec: deliverable.codec,
        expectedCaptionRuntimeSeconds: null,
        probe: video.probe,
      });
      assertProductionVideoProfile({ expected: profile, actual: video.probe });
      assertExactVideoTimeline(video.probe, timeline);
      const controls = byProbeKind("png");
      const semantics = byProbeKind("semantic-mask");
      const guidePass =
        contract?.kind === "guide-pass" ? (contract.pass ?? "pose") : "pose";
      const expectedSemantics = guidePass === "mask" ? timeline.totalFrames : 0;
      if (
        controls.length !== timeline.totalFrames ||
        semantics.length !== expectedSemantics ||
        observed.length !== controls.length + semantics.length + 1
      )
        throw new Error(
          `Guide delivery requires ${timeline.totalFrames} PNG controls and ${expectedSemantics} semantic sidecars beside its video.`,
        );
      controls.forEach((control, index) => {
        const suffix = `frames/${guidePass}/frame_${String(index).padStart(8, "0")}.png`;
        const portablePath = control.file.path;
        if (
          control.file.mediaType !== "image/png" ||
          (portablePath !== suffix &&
            portablePath.endsWith(`/${suffix}`) === false)
        )
          throw new Error(
            `Guide control ${index} must own the continuous path "${suffix}".`,
          );
        assertProductionPngPicture({
          profile: resolveProductionPngProfile({
            role: "guide-frame",
            width: production.frameFormat.width,
            height: production.frameFormat.height,
          }),
          actual: control.probe.picture,
        });
      });
      // Each mask picture depends on the sidecar of the same output frame, so
      // the sidecar series must be continuous in the same numbering as the
      // controls and each receipt must name the frame its filename claims.
      semantics.forEach((semantic, index) => {
        const suffix = `frames/mask/frame_${String(index).padStart(8, "0")}.semantic.json`;
        const portablePath = semantic.file.path;
        if (
          semantic.file.mediaType !== AUTOMOVIE_SEMANTIC_MASK_MEDIA_TYPE ||
          semantic.file.semanticMask?.frame !== index ||
          (portablePath !== suffix &&
            portablePath.endsWith(`/${suffix}`) === false)
        )
          throw new Error(
            `Mask semantic sidecar ${index} must own the continuous path "${suffix}" and a semantic receipt for output frame ${index}.`,
          );
      });
      return;
    }
    if (deliverable.kind === "preview") {
      const pictures = byProbeKind("png");
      if (pictures.length === 0 || pictures.length !== observed.length)
        throw new Error(
          "Preview delivery must own one or more PNG pictures only.",
        );
      assertProductionRenderedDeliverableFacts({
        kind: deliverable.kind,
        runtimeSeconds: deliverable.runtimeSeconds,
        frameCount: deliverable.frameCount,
        codec: deliverable.codec,
        expectedCaptionRuntimeSeconds: null,
        probe: pictures[0]!.probe,
      });
      // The probe admits a preview picture only under image/png.
      for (const picture of pictures)
        assertProductionPngPicture({
          profile: resolveProductionPngProfile({
            role: "preview",
            width: production.frameFormat.width,
            height: production.frameFormat.height,
          }),
          actual: picture.probe.picture,
        });
      return;
    }
    if (deliverable.kind === "captions") {
      // The probe admits captions only under text/vtt, and every observed
      // caption file probed as WebVTT, so exactly-one owns the count.
      const caption = exactlyOne(byProbeKind("webvtt"), "caption WebVTT");
      assertProductionRenderedDeliverableFacts({
        kind: deliverable.kind,
        runtimeSeconds: deliverable.runtimeSeconds,
        frameCount: deliverable.frameCount,
        codec: deliverable.codec,
        expectedCaptionRuntimeSeconds: production.targetRuntimeSeconds,
        probe: caption.probe,
      });
      verifyProductionNonVideoDeliverables({
        caption: {
          required: contract?.required ?? true,
          expected: canonicalProductionWebVtt(timeline),
          actual: caption.bytes,
        },
        sound: null,
      });
      return;
    }

    const audio = exactlyOne(byProbeKind("audio"), "audio/mp4 mix");
    const evidence = exactlyOne(
      byProbeKind("sound-evidence"),
      "sound evidence JSON",
    );
    const pictures = byProbeKind("png");
    if (observed.length !== 4 || pictures.length !== 2)
      throw new Error(
        "Audio delivery must own audio.mp4, evidence.json, waveform.png, and spectrogram.png only.",
      );
    // The probe yields an audio track only under audio/mp4 and sound evidence
    // only under application/json, so both media types are already exact.
    assertProductionRenderedDeliverableFacts({
      kind: deliverable.kind,
      runtimeSeconds: deliverable.runtimeSeconds,
      frameCount: deliverable.frameCount,
      codec: deliverable.codec,
      expectedCaptionRuntimeSeconds: null,
      probe: audio.probe,
    });
    assertProductionOpusProfile(audio.probe);
    assertCurrentSoundEvidence({
      inputFingerprint,
      production,
      timeline,
      contracts,
      compiled,
      evidence: evidence.probe.evidence,
      evidenceBytes: evidence.bytes,
      audio,
    });
    for (const picture of pictures) {
      const name = path.posix.basename(normalizeSlash(picture.file.path));
      const role =
        name === "waveform.png"
          ? "waveform"
          : name === "spectrogram.png"
            ? "spectrogram"
            : null;
      if (role === null || picture.file.mediaType !== "image/png")
        throw new Error(
          `Unexpected audio evidence raster "${picture.file.path}".`,
        );
      assertProductionPngPicture({
        profile: resolveProductionPngProfile({ role }),
        actual: picture.probe.picture,
      });
    }
  } catch (error) {
    diagnostics.push(
      renderDeliverableDiagnostic(
        "render-deliverable-media-mismatch",
        deliverable.id,
        `${errorMessage(error)} Re-render the declared deliverable from the current timeline and semantic plan.`,
      ),
    );
  }
};

const assertExactVideoTimeline = (
  video: Extract<IAutoMovieProductionMediaProbe, { kind: "video" }>,
  timeline: IAutoMovieFilmTimeline,
): void => {
  const frameRate = resolveProductionFrameRate(timeline);
  if (video.frameCount !== timeline.totalFrames)
    throw new Error(
      `Video sample count ${video.frameCount} differs from current timeline ${timeline.totalFrames}.`,
    );
  if (
    BigInt(video.presentation.movieDuration) * BigInt(frameRate.numerator) !==
    BigInt(timeline.totalFrames) *
      BigInt(frameRate.denominator) *
      BigInt(video.presentation.movieTimescale)
  )
    throw new Error(
      "Video presentation duration does not equal the current exact frame boundary.",
    );
};

const assertCurrentSoundEvidence = (props: {
  inputFingerprint: AutoMovieContentDigest;
  production: NonNullable<
    ReturnType<AutoMovieProductionProject["graph"]>["production"]
  >;
  timeline: IAutoMovieFilmTimeline;
  contracts: ReadonlyMap<string, IAutoMovieShotContract>;
  compiled: ReadonlyMap<string, IAutoMovieCompiledShotSource>;
  evidence: Extract<
    IAutoMovieProductionMediaProbe,
    { kind: "sound-evidence" }
  >["evidence"];
  evidenceBytes: Uint8Array;
  audio: IAutoMovieObservedDeliverableFile & {
    probe: Extract<IAutoMovieProductionMediaProbe, { kind: "audio" }>;
  };
}): void => {
  const frameRate = resolveProductionFrameRate(props.timeline);
  const planRate = resolveProductionFrameRate(props.evidence.plan);
  if (
    props.evidence.plan.inputFingerprint !== props.inputFingerprint ||
    props.timeline.inputFingerprint !== props.inputFingerprint ||
    props.evidence.plan.totalFrames !== props.timeline.totalFrames ||
    equalProductionFrameRates(planRate, frameRate) === false
  )
    throw new Error(
      "Sound evidence plan does not share the current compile fingerprint, exact frame rate, and total frame count.",
    );
  const expectedPlan = deriveProductionSoundPlan({
    timeline: props.timeline,
    contracts: props.contracts,
    compiled: props.compiled,
    ...(props.production.sound?.propagation === undefined
      ? {}
      : { propagationProfile: props.production.sound.propagation }),
    ...(props.production.sound?.acousticResponse === undefined
      ? {}
      : { acousticProfile: props.production.sound.acousticResponse }),
  });
  const actualPlanWithoutAcoustics = structuredClone(props.evidence.plan);
  for (const event of actualPlanWithoutAcoustics.events)
    delete event.acousticResponse;
  if (
    Buffer.from(canonicalAutoMovieJsonBytes(actualPlanWithoutAcoustics)).equals(
      Buffer.from(canonicalAutoMovieJsonBytes(expectedPlan)),
    ) === false
  )
    throw new Error(
      "Sound evidence does not contain the complete current builder-derived sound plan.",
    );
  const acousticProfile = props.production.sound?.acousticResponse;
  for (const event of props.evidence.plan.events) {
    const response = event.acousticResponse;
    if (acousticProfile === undefined && response !== undefined)
      throw new Error(
        `Sound event "${event.id}" carries an undeclared acoustic response.`,
      );
    if (acousticProfile !== undefined && response === undefined)
      throw new Error(
        `Sound event "${event.id}" lacks its selected acoustic response outcome.`,
      );
    if (
      response?.status === "available" &&
      (response.profile !== acousticProfile?.id ||
        response.inputRevision !== props.inputFingerprint)
    )
      throw new Error(
        `Sound event "${event.id}" acoustic response is not bound to the current selected profile and compile.`,
      );
  }
  const expectedSampleFrames = productionFrameBoundaryToGridTick({
    frame: props.timeline.totalFrames,
    frameRate,
    ticksPerSecond: props.evidence.plan.sampleRate,
    rounding: "nearest",
  });
  if (
    props.evidence.analysis.sampleRate !== props.evidence.plan.sampleRate ||
    props.evidence.analysis.sampleFrames !== expectedSampleFrames ||
    props.evidence.analysis.runtimeSeconds !==
      expectedSampleFrames / props.evidence.plan.sampleRate ||
    props.evidence.analysis.clippingSamples !== 0 ||
    props.evidence.analysis.samplePeak < 0 ||
    props.evidence.analysis.samplePeak > 1
  )
    throw new Error(
      "Sound analysis does not describe the exact current pre-encode PCM boundary and unclipped domain.",
    );
  const expectedEventIds = props.evidence.plan.events.map((event) => event.id);
  const observedEventIds = props.evidence.analysis.eventAlignment.map(
    (event) => event.id,
  );
  if (JSON.stringify(observedEventIds) !== JSON.stringify(expectedEventIds))
    throw new Error(
      "Sound analysis event identities or order differ from the current plan.",
    );
  props.evidence.analysis.eventAlignment.forEach((alignment, index) => {
    const event = props.evidence.plan.events[index]!;
    const expectedFrame =
      event.propagation?.boundary === "trimmed-at-segment"
        ? event.frame
        : (event.propagation?.arrivalFrame ?? event.frame);
    const expectedSample = productionFrameBoundaryToGridTick({
      frame: expectedFrame,
      frameRate,
      ticksPerSecond: props.evidence.plan.sampleRate,
      rounding: "nearest",
    });
    if (
      alignment.expectedSeconds !==
        expectedSample / props.evidence.plan.sampleRate ||
      alignment.passed === false ||
      alignment.errorFrames < 0 ||
      alignment.errorFrames > 1
    )
      throw new Error(
        `Sound analysis event "${alignment.id}" does not match its current planned boundary and passing frame gate.`,
      );
  });
  const expectedTtsLines = props.evidence.plan.dialogue.map((line) => line.id);
  const observedTtsLines = props.evidence.tts.map((receipt) => receipt.line);
  if (JSON.stringify(observedTtsLines) !== JSON.stringify(expectedTtsLines))
    throw new Error(
      "Sound TTS receipt identities or order differ from current dialogue.",
    );
  const presentationSamples = exactPresentationTicks(
    props.audio.probe.timebase.movieDuration,
    props.audio.probe.timebase.movieTimescale,
    props.audio.probe.timebase.mediaTimescale,
  );
  if (presentationSamples !== expectedSampleFrames)
    throw new Error(
      "Final Opus presentation does not end at the current pre-encode PCM boundary.",
    );
  verifyProductionNonVideoDeliverables({
    caption: null,
    sound: {
      expectedPlan: props.evidence.plan,
      expectedAnalysis: props.evidence.analysis,
      expectedTts: props.evidence.tts,
      expectedAudio: {
        path: path.posix.basename(normalizeSlash(props.audio.file.path)),
        mediaType: "audio/mp4",
        bytes: props.audio.file.bytes,
        digest: props.audio.file.digest,
      },
      evidence: props.evidenceBytes,
    },
  });
};

/**
 * The audio presentation length in media samples.
 *
 * The audio probe's Opus profile assertion already proved the presentation an
 * exact safe-integer sample count over positive safe clocks, so the division
 * is exact without a second verdict.
 */
const exactPresentationTicks = (
  duration: number,
  timescale: number,
  destinationTimescale: number,
): number =>
  Number((BigInt(duration) * BigInt(destinationTimescale)) / BigInt(timescale));

const canonicalizeProbe = (probe: IAutoMovieProductionMediaProbe): string =>
  Buffer.from(canonicalAutoMovieJsonBytes(probe)).toString("utf8");

const renderDeliverableDiagnostic = (
  code: AutoMovieDiagnosticCode,
  target: string,
  message: string,
  renderPath: string | null = null,
): IAutoMovieDiagnostic => ({
  code,
  category: "error",
  phase: "render",
  target,
  path: renderPath,
  message,
});
