import { resolveProductionFrameRate } from "@automovie/engine";
import {
  AutoMovieContentDigest,
  AutoMovieDiagnosticCode,
  AutoMovieProductionShotRepaint,
  AutoMovieRepaintReferenceRole,
  IAutoMovieAssetManifest,
  IAutoMovieDiagnostic,
  IAutoMovieRenderBundleManifest,
  IAutoMovieRepaintExecutionPolicy,
  IAutoMovieRepaintGeneratorAdoption,
  IAutoMovieRepaintReceipt,
  IAutoMovieRepaintRequestEvidence,
  IAutoMovieRepaintShot,
} from "@automovie/interface";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import typia from "typia";

import type {
  AutoMovieProductionContext,
  IAutoMovieProductionServices,
} from "./AutoMovieProductionContext";
import { AutoMovieProductionInputRaceError } from "./AutoMovieProductionProject";
import { assetUrlAdmissionRefusal } from "./assetAcquisition";
import { parseAutoMovieCaptureRuntimeIdentity } from "./captureRuntimeIdentity";
import {
  canonicalAutoMovieJsonBytes,
  canonicalizeAutoMovieJson,
  compareCodeUnits,
  digestAutoMovieBytes,
} from "./contentIdentity";
import { assertProductionRenditionClipDelivery } from "./muxProductionFeatureMp4";
import { probeProductionVideoMp4 } from "./probeProductionMedia";
import { readAutoMovieProductionRegistry } from "./productionRegistry";
import {
  assertAutoMovieExternalGeneratorTermsAt,
  canonicalAutoMovieRepaintGeneratorAdoption,
  canonicalAutoMovieRepaintRuntimeIdentity,
  productionRepaintOutputPath,
  productionRepaintRequestFingerprint,
  productionRepaintStructuralControls,
  productionSourceRenderFingerprint,
} from "./renditionIdentity";
import { IAutoMovieRepaintAttemptClaim } from "./repaintAttemptClaim";
import {
  AutoMovieRepaintAttemptError,
  assertAutoMovieRepaintExecutionPolicy,
  executeAutoMovieRepaintRequest,
} from "./repaintExecution";
import {
  planAutoMovieRepaintRawOutput,
  productionRepaintRawOutputReceiptPath,
} from "./repaintRawOutput";

interface IAutoMovieRepaintSelectionInput {
  productionId: string;
  shot: string;
  attemptId: string;
  kind: "selection" | "reversal";
  reason: string;
  structuralReview: string;
  continuityReview: {
    baseline: string;
    playbackEvidence: string;
    mixedDeliveryPolicy: string | null;
    flicker: "pass";
    identityDrift: "pass";
    geometryWarp: "pass";
    textureCrawl: "pass";
    transitionMismatch: "pass";
  } | null;
}

/**
 * Optional host repaint orchestration and immutable rendition provenance.
 */
export class AutoMovieProductionRepaintService {
  public constructor(
    private readonly adapter?: AutoMovieProductionShotRepaint,
    private readonly generator?: IAutoMovieRepaintGeneratorAdoption,
    private readonly execution?: {
      policy: IAutoMovieRepaintExecutionPolicy;
      evidence: IAutoMovieRepaintRequestEvidence;
      requestId?: string;
      signal?: AbortSignal;
      now?: () => Date;
    },
  ) {}

  /**
   * Serve one repaint request against the session context.
   *
   * The tracked delivery mode is read before the DIFFUSION_ENHANCE gate on
   * purpose.
   *
   * A production that never asked for a rendition is owed the design change it
   * would have to make, not an order to read a guide it will not use.
   */
  public async serve(
    context: AutoMovieProductionContext,
    input: IAutoMovieRepaintShot.IProps,
  ): Promise<IAutoMovieRepaintShot> {
    const requestedProductionId = safeRepaintInputText(input, "productionId");
    const requestedShot = safeRepaintInputText(input, "shot");
    const refusal = (
      code: AutoMovieDiagnosticCode,
      message: string,
    ): IAutoMovieRepaintShot => ({
      repainted: false,
      selected: false,
      requestId: null,
      productionId: requestedProductionId,
      shot: requestedShot,
      receipt: null,
      diagnostics: [diagnostic(code, requestedShot, message, "render")],
    });
    const request = validatedRepaintRequest(input);
    if (request === null)
      return refusal(
        "repaint-input-invalid",
        "Repaint input must match its exact public request schema before project lookup or provider execution; remove missing, mistyped, credential-bearing, or hidden fields.",
      );
    if (
      requestedProductionId.trim().length === 0 ||
      requestedProductionId.trim() !== requestedProductionId
    )
      return refusal(
        "repaint-production-invalid",
        "Repaint productionId must be a trimmed non-empty production namespace.",
      );
    let services: IAutoMovieProductionServices;
    try {
      services = context.forProduction(requestedProductionId);
    } catch (error) {
      return refusal(
        "repaint-production-unregistered",
        safeRepaintDiagnosticMessage(
          error,
          "Repaint production lookup failed without a safe diagnostic.",
        ),
      );
    }
    const delivery = services.project.graph().production;
    if (
      delivery === null ||
      delivery.visualDelivery === "deterministic" ||
      (delivery.visualDelivery === "mixed" &&
        delivery.visualDeliveryLanes?.some(
          (lane) => lane.shot === requestedShot && lane.lane === "repainted",
        ) !== true)
    )
      return refusal(
        "repaint-delivery-disabled",
        "The current production design does not assign this shot to a repainted delivery lane. Change the tracked lane contract, recompile current source, then read DIFFUSION_ENHANCE before requesting a rendition.",
      );
    return this.repaint(services, request);
  }

  /**
   * Select or reverse to one reviewed candidate without invoking the adapter.
   */
  public select(
    context: AutoMovieProductionContext,
    input: IAutoMovieRepaintSelectionInput,
  ): IAutoMovieRepaintShot {
    const requestedProductionId = safeRepaintInputText(input, "productionId");
    const requestedShot = safeRepaintInputText(input, "shot");
    const refusal = (
      code: AutoMovieDiagnosticCode,
      message: string,
    ): IAutoMovieRepaintShot => ({
      repainted: false,
      selected: false,
      requestId: null,
      productionId: requestedProductionId,
      shot: requestedShot,
      receipt: null,
      diagnostics: [diagnostic(code, requestedShot, message, "render")],
    });
    const request = validatedRepaintSelection(input);
    if (request === null)
      return refusal(
        "repaint-input-invalid",
        "Repaint selection input must match its exact public request schema before project lookup; remove missing, mistyped, or hidden fields.",
      );
    if (
      request.productionId.trim().length === 0 ||
      request.productionId.trim() !== request.productionId
    )
      return refusal(
        "repaint-production-invalid",
        "Repaint selection productionId must be a trimmed non-empty production namespace.",
      );
    let services: IAutoMovieProductionServices;
    try {
      services = context.forProduction(request.productionId);
    } catch (error) {
      return refusal(
        "repaint-production-unregistered",
        safeRepaintDiagnosticMessage(
          error,
          "Repaint production lookup failed without a safe diagnostic.",
        ),
      );
    }
    try {
      const receipt = services.project.selectRepaintCandidate({
        ...request,
        selectedAt: (this.execution?.now ?? (() => new Date()))().toISOString(),
      });
      return {
        repainted: true,
        selected: true,
        requestId: receipt.requestId ?? null,
        productionId: request.productionId,
        shot: request.shot,
        receipt,
        diagnostics: [],
      };
    } catch (error) {
      return refusal(
        "repaint-commit-refused",
        safeRepaintDiagnosticMessage(
          error,
          "Repaint selection could not be committed safely.",
        ),
      );
    }
  }

  /**
   * Repaint one current shot from verified deterministic controls.
   *
   * An explicit retry resumes after its latest immutable terminal attempt;
   * it cannot begin until the corresponding deterministic backoff elapsed.
   * The original elapsed budget is recalculated at the actual resumed
   * execution start, so either a rollback or a forward scheduling gap fails
   * closed instead of reopening provider work.
   */
  public async repaint(
    services: IAutoMovieProductionServices,
    input: IAutoMovieRepaintShot.IProps,
  ): Promise<IAutoMovieRepaintShot> {
    const requestedShot = safeRepaintInputText(input, "shot");
    let currentRequestId: string | null = null;
    const failure = (
      code: AutoMovieDiagnosticCode,
      message: string,
    ): IAutoMovieRepaintShot => ({
      repainted: false,
      selected: false,
      requestId: currentRequestId,
      productionId: services.project.productionId,
      shot: requestedShot,
      receipt: null,
      diagnostics: [diagnostic(code, requestedShot, message)],
    });
    const validatedInput = validatedRepaintRequest(input);
    if (validatedInput === null)
      return failure(
        "repaint-input-invalid",
        "Repaint input must match its exact public request schema before provider execution; remove missing, mistyped, credential-bearing, or hidden fields.",
      );
    input = validatedInput;
    if (this.adapter === undefined || this.generator === undefined)
      return failure(
        "repaint-host-unavailable",
        "This project supplies no complete repaint host. Pass both an adapter implementing AutoMovieProductionShotRepaint and its reviewed generator adoption, then retry. AutoMovie will not fabricate diffusion output or infer provider provenance.",
      );
    if (input.productionId !== services.project.productionId)
      return failure(
        "repaint-production-invalid",
        `Repaint request productionId "${input.productionId}" does not match project "${services.project.productionId}".`,
      );
    let generator: IAutoMovieRepaintGeneratorAdoption;
    let selectedAdapterIdentity: string;
    try {
      generator = structuredClone(this.generator);
      canonicalAutoMovieRepaintGeneratorAdoption(generator);
      selectedAdapterIdentity = canonicalAutoMovieRepaintRuntimeIdentity(
        generator.runtimeIdentity,
      );
    } catch (error) {
      return failure(
        "repaint-host-unavailable",
        `${safeRepaintDiagnosticMessage(error, "Repaint generator adoption could not be inspected safely.")} Correct the reviewed repaint generator adoption before external execution.`,
      );
    }
    const status = services.compileStatus();
    if (status.success === false)
      return failure(
        "repaint-compile-stale",
        "Repaint requires a current successful source compile. Run the scaffold compile command, resolve its diagnostics, and retry.",
      );
    let registry: ReturnType<typeof readAutoMovieProductionRegistry>;
    try {
      registry = readAutoMovieProductionRegistry(services.project);
    } catch (error) {
      return failure(
        "repaint-registry-unavailable",
        safeRepaintDiagnosticMessage(
          error,
          "Repaint compiler registry could not be read safely.",
        ),
      );
    }
    if (registry.shots.some((shot) => shot.id === requestedShot) === false)
      return failure(
        "repaint-target-missing",
        `Shot "${requestedShot}" is absent from the current compiler registry. Correct the registration or compile the source that defines it.`,
      );
    const graph = services.project.graph();
    const production = graph.production;
    const shot = graph.shots.get(requestedShot);
    if (production === null || shot === undefined)
      return failure(
        "repaint-target-missing",
        `Shot "${requestedShot}" has no current production frame contract. Correct the tracked design and compile before repaint.`,
      );
    const frameRate = resolveProductionFrameRate(production.frameFormat);
    const expectedOutput = {
      width: production.frameFormat.width,
      height: production.frameFormat.height,
      fps: production.frameFormat.fps,
      frameRate,
      frameCount: Math.round(
        (shot.durationSeconds * frameRate.numerator) / frameRate.denominator,
      ),
      runtimeSeconds: shot.durationSeconds,
    };
    if (
      typeof input.parameters.prompt !== "string" ||
      input.parameters.prompt.trim().length === 0 ||
      input.parameters.prompt !== input.parameters.prompt.trim() ||
      (input.parameters.negativePrompt !== undefined &&
        (typeof input.parameters.negativePrompt !== "string" ||
          input.parameters.negativePrompt.trim().length === 0 ||
          input.parameters.negativePrompt !==
            input.parameters.negativePrompt.trim())) ||
      Number.isSafeInteger(input.parameters.seed) === false ||
      Number.isFinite(input.parameters.strength) === false ||
      input.parameters.strength < 0 ||
      input.parameters.strength > 1 ||
      Object.entries(input.parameters.controls ?? {}).some(
        ([key, value]) =>
          key.trim().length === 0 ||
          key !== key.trim() ||
          (typeof value === "string" &&
            (value.trim().length === 0 || value !== value.trim())) ||
          (typeof value === "number" && Number.isFinite(value) === false) ||
          (typeof value !== "string" &&
            typeof value !== "number" &&
            typeof value !== "boolean"),
      ) ||
      (input.parameters.controls !== undefined &&
        Object.getPrototypeOf(input.parameters.controls) !== Object.prototype &&
        Object.getPrototypeOf(input.parameters.controls) !== null) ||
      input.references.length === 0
    )
      return failure(
        "repaint-input-invalid",
        "Repaint requires trimmed non-blank prompts, a safe-integer seed, strength in [0, 1], scalar controls with trimmed identities, and at least one fixed role-specific reference.",
      );
    const request: IAutoMovieRepaintShot.IProps = {
      ...input,
      shot: requestedShot,
      parameters: structuredClone(input.parameters),
      references: structuredClone(input.references),
    };
    const requestId = this.execution?.requestId ?? randomUUID();
    const now = this.execution?.now ?? (() => new Date());
    let preflightAt: Date;
    let executionPolicy: IAutoMovieRepaintExecutionPolicy;
    let evidence: IAutoMovieRepaintRequestEvidence;
    try {
      executionPolicy = structuredClone(
        this.execution?.policy ?? LEGACY_REPAINT_POLICY,
      );
      evidence = structuredClone(
        this.execution?.evidence ?? legacyRepaintEvidence(requestedShot),
      );
      preflightAt = repaintRuntimeInstant(now(), "preflight");
      assertAutoMovieRepaintExecutionPolicy(executionPolicy);
      assertRepaintEvidence(evidence);
      assertAutoMovieExternalGeneratorTermsAt({
        termsCheckedAt: generator.generatorProvenance.termsCheckedAt,
        occurredAt: preflightAt,
        label: "repaint generator provenance",
      });
    } catch (error) {
      return failure(
        "repaint-host-unavailable",
        safeRepaintDiagnosticMessage(
          error,
          "Repaint generator provenance could not be inspected safely.",
        ),
      );
    }
    let resolvedSource: ICurrentShotSource | null;
    try {
      const currentCapture = await services.oracle.preview({
        target: { kind: "shot", id: requestedShot },
        time: 0,
        pass: "beauty",
        width: expectedOutput.width,
        height: expectedOutput.height,
      });
      if (
        currentCapture.captured === false ||
        currentCapture.renderBundle === null
      )
        return failure(
          "repaint-source-evidence-missing",
          `The current dialogue and capture runtime could not produce a verified source frame: ${currentCapture.diagnostics
            .map((diagnostic) => diagnostic.message)
            .join("; ")}`,
        );
      const currentManifest = services.project.verifiedRenderManifest(
        path.join(
          services.project.root,
          currentCapture.renderBundle,
          "manifest.json",
        ),
      );
      if (currentManifest === null)
        return failure(
          "repaint-source-evidence-invalid",
          "The current dialogue and capture runtime produced no verifiable render manifest. Discard that capture and retry before repaint.",
        );
      resolvedSource = currentShotSource(
        services,
        requestedShot,
        registry.inputFingerprint,
        expectedOutput,
        {
          dialogueRuntimeIdentity: currentManifest.dialogueRuntimeIdentity,
          rendererIdentity: currentManifest.rendererIdentity,
        },
      );
    } catch (error) {
      return failure(
        "repaint-source-evidence-invalid",
        safeRepaintDiagnosticMessage(
          error,
          "Repaint source evidence could not be inspected safely.",
        ),
      );
    }
    if (resolvedSource === null)
      return failure(
        "repaint-source-evidence-missing",
        "No current verified shot bundle contains both beauty pixels and a structural control pass. Capture the shot frame grid and its declared depth, pose, outline, mask, or normal controls first.",
      );
    const source = resolvedSource;
    const references = resolveReferences(services, request);
    if ("diagnostic" in references)
      return failure(references.diagnostic.code, references.diagnostic.message);
    const sourceRenderFingerprint = productionSourceRenderFingerprint({
      manifest: source.manifest,
      frames: source.frames,
    });
    const registryIdentity = canonicalizeAutoMovieJson(registry);
    const referenceIdentity = canonicalizeAutoMovieJson(
      references.values.map(({ role, path: referencePath, digest }) => ({
        role,
        path: referencePath,
        digest,
      })),
    );
    const inputCurrent = (): boolean => {
      try {
        const status = services.compileStatus();
        if (
          status.success === false ||
          status.compiler.inputFingerprint !== registry.inputFingerprint
        )
          return false;
        const currentRegistry = readAutoMovieProductionRegistry(
          services.project,
        );
        const current = services.project.verifiedRenderManifest(
          source.manifestPath,
        );
        const currentReferences = resolveReferences(services, request);
        return (
          canonicalizeAutoMovieJson(currentRegistry) === registryIdentity &&
          current !== null &&
          productionSourceRenderFingerprint({
            manifest: current,
            frames: current.frames,
          }) === sourceRenderFingerprint &&
          "values" in currentReferences &&
          canonicalizeAutoMovieJson(
            currentReferences.values.map(
              ({ role, path: referencePath, digest }) => ({
                role,
                path: referencePath,
                digest,
              }),
            ),
          ) === referenceIdentity
        );
      } catch {
        return false;
      }
    };
    const referenceReceipts = references.values.map(
      ({ role, path: referencePath, digest }) => ({
        role,
        path: referencePath,
        digest,
      }),
    );
    const requestFingerprint = productionRepaintRequestFingerprint({
      shot: requestedShot,
      compileFingerprint: registry.inputFingerprint,
      sourceRenderFingerprint,
      adapterIdentity: selectedAdapterIdentity,
      generatorProvenance: generator.generatorProvenance,
      parameters: request.parameters,
      executionPolicy,
      evidence,
      references: referenceReceipts,
    });
    let priorAttempts;
    try {
      priorAttempts = this.execution?.requestId
        ? services.project.repaintRequestAttempts(requestId)
        : [];
    } catch (error) {
      return failure(
        "repaint-input-invalid",
        safeRepaintDiagnosticMessage(
          error,
          "Stored repaint attempt history could not be inspected safely.",
        ),
      );
    }
    if (priorAttempts.length !== 0) currentRequestId = requestId;
    if (
      this.execution?.requestId !== undefined &&
      (priorAttempts.length === 0 ||
        priorAttempts.some(
          (attempt) => attempt.requestFingerprint !== requestFingerprint,
        ))
    )
      return failure(
        "repaint-input-invalid",
        "Explicit retry requires an existing request whose source, generator, controls, references, evidence, and execution policy are still exact.",
      );
    if (this.execution?.requestId !== undefined) {
      const latest = priorAttempts.at(-1)!;
      const latestFailure = latest.failure;
      if (
        latest.status === "succeeded" &&
        latest.availableOutput?.receipt !== undefined
      ) {
        try {
          const raw = services.project.repaintRawOutput(
            latest.requestId,
            latest.attemptId,
          );
          if (
            raw.receipt.disposition !== "candidate-source" ||
            raw.receipt.digest !== latest.availableOutput.digest ||
            raw.receipt.bytes !== latest.availableOutput.bytes
          )
            throw new Error(
              "Succeeded repaint attempt does not cite a candidate-source raw revision.",
            );
          const probe = probeProductionVideoMp4(raw.bytes);
          assertProductionRenditionClipDelivery({
            bytes: raw.bytes,
            shot: requestedShot,
            ...expectedOutput,
          });
          const outputPath = productionRepaintOutputPath({
            shot: requestedShot,
            sourceRenderFingerprint,
            attemptId: latest.attemptId,
            adapterIdentity: latest.adapterIdentity,
            generatorProvenance: generator.generatorProvenance,
            parameters: request.parameters,
            executionPolicy,
            evidence,
            references: referenceReceipts,
            outputDigest: raw.receipt.digest,
          });
          const receipt: IAutoMovieRepaintReceipt = {
            version: 4,
            productionId: services.project.productionId,
            shot: requestedShot,
            compileFingerprint: registry.inputFingerprint,
            sourceRenderFingerprint,
            requestId,
            attemptId: latest.attemptId,
            startedAt: latest.startedAt,
            completedAt: latest.completedAt,
            costUnits: latest.costUnits,
            executionPolicy: structuredClone(executionPolicy),
            sourceBundle: source.bundle,
            controls: productionRepaintStructuralControls(source.manifest),
            references: referenceReceipts,
            adapterIdentity: latest.adapterIdentity,
            generatorProvenance: structuredClone(generator.generatorProvenance),
            structuralAuthority: "deterministic-source-only",
            parameters: structuredClone(request.parameters),
            evidence: structuredClone(evidence),
            output: {
              path: outputPath,
              digest: raw.receipt.digest,
              bytes: raw.receipt.bytes,
              probe,
            },
          };
          services.project.commitRepaintRendition(
            receipt,
            raw.bytes,
            inputCurrent,
          );
          return {
            repainted: true,
            selected: false,
            requestId,
            productionId: services.project.productionId,
            shot: requestedShot,
            receipt,
            diagnostics: [],
          };
        } catch (error) {
          const inputRaceMessage = safeRepaintInputRaceMessage(error);
          if (inputRaceMessage !== null)
            return failure("repaint-input-changed", inputRaceMessage);
          return failure(
            "repaint-commit-refused",
            safeRepaintDiagnosticMessage(
              error,
              "Repaint candidate could not be resumed from its exact raw revision.",
            ),
          );
        }
      }
      if (
        latest.status !== "failed" ||
        latestFailure === null ||
        latestFailure.retryable !== true ||
        executionPolicy.retryableFailures.some(
          (failureClass) => failureClass === latestFailure.class,
        ) === false
      )
        return failure(
          "repaint-input-invalid",
          "Explicit retry requires the latest terminal attempt to be a failed class that the unchanged execution policy marked retryable. A succeeded candidate already met the acceptance stop; use reroll for another candidate.",
        );
    }
    const spent = priorAttempts.reduce(
      (sum, attempt) => sum + attempt.costUnits,
      0,
    );
    let resumeAt: Date;
    try {
      resumeAt = repaintRuntimeInstant(now(), "execution resume");
    } catch (error) {
      return failure(
        "repaint-host-unavailable",
        safeRepaintDiagnosticMessage(
          error,
          "Repaint execution resume clock could not be inspected safely.",
        ),
      );
    }
    if (
      resumeAt.getTime() < preflightAt.getTime() ||
      (priorAttempts.length !== 0 &&
        resumeAt.getTime() <
          new Date(priorAttempts.at(-1)!.completedAt).getTime())
    )
      return failure(
        "repaint-input-invalid",
        "Repaint execution requires a monotonic runtime clock at or after preflight and the latest immutable terminal attempt.",
      );
    let executionStartedAt: Date;
    try {
      executionStartedAt = repaintRuntimeInstant(now(), "execution start");
    } catch (error) {
      return failure(
        "repaint-failed",
        safeRepaintDiagnosticMessage(
          error,
          "Repaint execution start clock could not be inspected safely.",
        ),
      );
    }
    if (executionStartedAt.getTime() < resumeAt.getTime())
      return failure(
        "repaint-failed",
        "Repaint execution clock precedes its post-preflight resume observation.",
      );
    const elapsed =
      priorAttempts.length === 0
        ? 0
        : executionStartedAt.getTime() -
          new Date(priorAttempts[0]!.startedAt).getTime();
    const remainingAttempts =
      executionPolicy.maximumAttempts - priorAttempts.length;
    const remainingElapsed = executionPolicy.maximumElapsedMs - elapsed;
    const remainingCost = executionPolicy.maximumCostUnits - spent;
    if (remainingAttempts <= 0 || remainingElapsed <= 0 || remainingCost <= 0)
      return failure(
        "repaint-failed",
        "The repaint request exhausted its declared attempt, elapsed-time, or cost budget. Reroll only by creating a new request identity.",
      );
    if (priorAttempts.length !== 0) {
      const latest = priorAttempts.at(-1)!;
      const retryBackoff = Math.min(
        ...executionPolicy.backoffMs.slice(
          priorAttempts.length - 1,
          priorAttempts.length,
        ),
      );
      const retryNotBefore =
        new Date(latest.completedAt).getTime() + retryBackoff;
      if (executionStartedAt.getTime() < retryNotBefore)
        return failure(
          "repaint-failed",
          "Explicit retry cannot start before the unchanged execution policy's deterministic backoff has fully elapsed.",
        );
    }
    const remainingPolicy: IAutoMovieRepaintExecutionPolicy = {
      ...executionPolicy,
      maximumAttempts: remainingAttempts,
      maximumElapsedMs: remainingElapsed,
      maximumCostUnits: remainingCost,
      attemptTimeoutMs: Math.min(
        executionPolicy.attemptTimeoutMs,
        remainingElapsed,
      ),
      backoffMs: executionPolicy.backoffMs.slice(
        priorAttempts.length,
        priorAttempts.length + remainingAttempts - 1,
      ),
    };
    let executionClockFloor = executionStartedAt.getTime();
    let firstExecutionObservation = true;
    const executionNow = (): Date => {
      if (firstExecutionObservation) {
        firstExecutionObservation = false;
        return new Date(executionStartedAt.getTime());
      }
      const observed = repaintRuntimeInstant(now(), "execution");
      if (observed.getTime() < executionClockFloor)
        throw new Error(
          "Repaint execution clock precedes its post-preflight resume observation.",
        );
      executionClockFloor = observed.getTime();
      return observed;
    };
    let execution;
    const claims = new Map<string, IAutoMovieRepaintAttemptClaim>();
    try {
      execution = await executeAutoMovieRepaintRequest({
        productionId: services.project.productionId,
        shot: requestedShot,
        requestId,
        ordinalOffset: priorAttempts.length,
        requestFingerprint,
        compileFingerprint: registry.inputFingerprint,
        sourceRenderFingerprint,
        adapterIdentity: selectedAdapterIdentity,
        seed: request.parameters.seed,
        policy: remainingPolicy,
        signal: this.execution?.signal,
        runtime: {
          now: executionNow,
          attemptId: randomUUID,
          wait: waitForRepaintBackoff,
        },
        admitAttempt: (attemptId, ordinal) => {
          const prefix = services.project.repaintRequestAttempts(requestId);
          const claim: IAutoMovieRepaintAttemptClaim = {
            version: 1,
            productionId: services.project.productionId,
            shot: requestedShot,
            requestId,
            requestFingerprint,
            attemptOrdinal: ordinal,
            attemptId,
            prefixDigest: digestAutoMovieBytes(
              canonicalAutoMovieJsonBytes(prefix),
            ),
            generation: ordinal,
            claimedAt: executionNow().toISOString(),
          };
          const admission = services.project.acquireRepaintAttemptClaim(claim);
          if (admission.status === "acquired") claims.set(attemptId, claim);
          return admission.status === "acquired";
        },
        execute: async (signal, attemptId) => {
          let generated: Awaited<ReturnType<AutoMovieProductionShotRepaint>>;
          try {
            generated = await this.adapter!({
              signal,
              projectRoot: services.project.root,
              productionId: services.project.productionId,
              compileFingerprint: registry.inputFingerprint,
              shot: requestedShot,
              source: {
                bundle: source.bundle,
                manifest: structuredClone(source.manifest),
                fingerprint: sourceRenderFingerprint,
                frames: source.frames.map((frame) => ({
                  index: frame.index,
                  time: frame.time,
                  pass: frame.pass,
                  digest: frame.digest,
                  bytes: services.project.readRenderFile(
                    normalizeSlash(path.join(source.bundle, frame.path)),
                  ),
                })),
                captureRuntime: parseAutoMovieCaptureRuntimeIdentity(
                  source.manifest.rendererIdentity,
                ),
              },
              references: structuredClone(references.values),
              parameters: structuredClone(request.parameters),
            });
          } catch (error) {
            if (
              error instanceof AutoMovieRepaintAttemptError &&
              error.rawOutput !== undefined
            ) {
              const publication = planAutoMovieRepaintRawOutput({
                productionId: services.project.productionId,
                shot: requestedShot,
                requestId,
                attemptId,
                bytes: error.rawOutput.bytes,
                mediaType: error.rawOutput.mediaType,
                disposition: signal.aborted ? "cancelled" : "partial",
                retainedAt: repaintRuntimeInstant(
                  now(),
                  "partial raw output retention",
                ).toISOString(),
                maximumBytes: REPAINT_RAW_OUTPUT_MAXIMUM_BYTES,
              });
              services.project.commitRepaintRawOutput(publication);
              throw new AutoMovieRepaintAttemptError(
                error.failureClass,
                error.message,
                error.costUnits,
                {
                  digest: publication.receipt.digest,
                  bytes: publication.receipt.bytes,
                  receipt: productionRepaintRawOutputReceiptPath(
                    requestId,
                    attemptId,
                  ),
                },
              );
            }
            throw error;
          }
          let costUnits = 0;
          let availableOutput: {
            digest: AutoMovieContentDigest;
            bytes: number;
            receipt?: string;
          } | null = null;
          let inputStaleError: AutoMovieRepaintAttemptError | undefined;
          let rawRetained = false;
          try {
            const reportedCostUnits = generated.costUnits;
            if (
              reportedCostUnits !== undefined &&
              (Number.isFinite(reportedCostUnits) === false ||
                reportedCostUnits < 0)
            )
              throw new Error(
                "the adapter returned an invalid metered cost disclosure",
              );
            costUnits = reportedCostUnits ?? 0;
            const reportedBytes = generated.bytes;
            if (reportedBytes instanceof Uint8Array === false)
              throw new Error("the adapter did not return Uint8Array bytes");
            const bytes = new Uint8Array(reportedBytes);
            const outputDigest =
              bytes.length === 0 ? null : digestAutoMovieBytes(bytes);
            availableOutput =
              outputDigest === null
                ? null
                : { digest: outputDigest, bytes: bytes.length };
            const retainRaw = (
              disposition:
                | "candidate-source"
                | "invalid"
                | "cancelled"
                | "budget-exhausted",
            ): void => {
              if (outputDigest === null || rawRetained) return;
              const publication = planAutoMovieRepaintRawOutput({
                productionId: services.project.productionId,
                shot: requestedShot,
                requestId,
                attemptId,
                bytes,
                mediaType:
                  typeof generated.mediaType === "string"
                    ? generated.mediaType
                    : "application/octet-stream",
                disposition,
                retainedAt: repaintRuntimeInstant(
                  now(),
                  "raw output retention",
                ).toISOString(),
                maximumBytes: REPAINT_RAW_OUTPUT_MAXIMUM_BYTES,
              });
              services.project.commitRepaintRawOutput(publication);
              availableOutput = {
                digest: publication.receipt.digest,
                bytes: publication.receipt.bytes,
                receipt: productionRepaintRawOutputReceiptPath(
                  requestId,
                  attemptId,
                ),
              };
              rawRetained = true;
            };
            if (inputCurrent() === false) {
              retainRaw("invalid");
              inputStaleError = new AutoMovieRepaintAttemptError(
                "input-stale",
                "Compiler registry or deterministic source pixels changed while repaint was running.",
                costUnits,
                availableOutput,
              );
              throw inputStaleError;
            }
            if (
              generated.mediaType !== "video/mp4" ||
              bytes.length === 0 ||
              outputDigest === null
            )
              throw new Error(
                "the adapter did not return non-empty video/mp4 bytes",
              );
            const adapterIdentity = canonicalAutoMovieRepaintRuntimeIdentity(
              generated.runtimeIdentity,
            );
            if (adapterIdentity !== selectedAdapterIdentity)
              throw new Error(
                "the adapter reported a provider, model, version, or execution boundary different from the reviewed generator adoption",
              );
            const probe = probeProductionVideoMp4(bytes);
            if (
              probe.kind !== "video" ||
              probe.frameCount !== expectedOutput.frameCount
            )
              throw new Error(
                `the adapter output does not match the exact ${expectedOutput.width}x${expectedOutput.height}, ${expectedOutput.fps}fps, ${expectedOutput.frameCount}-frame shot contract`,
              );
            assertProductionRenditionClipDelivery({
              bytes,
              shot: requestedShot,
              ...expectedOutput,
            });
            retainRaw(
              signal.aborted
                ? "cancelled"
                : costUnits > remainingPolicy.maximumCostUnits
                  ? "budget-exhausted"
                  : "candidate-source",
            );
            return {
              value: {
                bytes,
                adapterIdentity,
                probe,
                outputDigest,
              },
              costUnits,
              availableOutput,
            };
          } catch (error) {
            if (inputStaleError !== undefined && error === inputStaleError)
              throw error;
            if (availableOutput !== null && rawRetained === false) {
              const publication = planAutoMovieRepaintRawOutput({
                productionId: services.project.productionId,
                shot: requestedShot,
                requestId,
                attemptId,
                bytes: new Uint8Array(generated.bytes),
                mediaType:
                  typeof generated.mediaType === "string"
                    ? generated.mediaType
                    : "application/octet-stream",
                disposition: signal.aborted ? "cancelled" : "invalid",
                retainedAt: repaintRuntimeInstant(
                  now(),
                  "raw output retention",
                ).toISOString(),
                maximumBytes: REPAINT_RAW_OUTPUT_MAXIMUM_BYTES,
              });
              services.project.commitRepaintRawOutput(publication);
              availableOutput = {
                digest: publication.receipt.digest,
                bytes: publication.receipt.bytes,
                receipt: productionRepaintRawOutputReceiptPath(
                  requestId,
                  attemptId,
                ),
              };
            }
            throw new AutoMovieRepaintAttemptError(
              "invalid-output",
              safeRepaintDiagnosticMessage(
                error,
                "Repaint adapter output could not be inspected safely.",
              ),
              costUnits,
              availableOutput,
            );
          }
        },
        onAttempt: (attempt, observation) => {
          services.project.commitRepaintAttempt(attempt);
          const claim = claims.get(attempt.attemptId);
          if (claim === undefined)
            throw new Error(
              `Repaint terminal attempt "${attempt.attemptId}" lost its provider-dispatch claim.`,
            );
          services.project.settleRepaintAttemptClaim(
            claim,
            observation.externalOutcome === "unknown"
              ? "unknown-outcome"
              : attempt.status === "succeeded"
                ? "fulfilled"
                : "rejected",
          );
          currentRequestId = requestId;
        },
      });
    } catch (error) {
      return failure(
        "repaint-failed",
        safeRepaintDiagnosticMessage(
          error,
          "Repaint execution failed without a safe diagnostic.",
        ),
      );
    }
    if (execution.stop === "observer-failed")
      return failure(
        "repaint-commit-refused",
        `Repaint terminal attempt "${execution.attempts.at(-1)?.attemptId ?? "unknown"}" could not be committed; no retry or candidate publication was started.`,
      );
    if (execution.accepted === null)
      return failure(
        execution.attempts.at(-1)?.status === "stale"
          ? "repaint-input-changed"
          : execution.attempts.at(-1)?.status === "invalid"
            ? "repaint-output-invalid"
            : "repaint-failed",
        `Repaint request stopped as ${execution.stop}; every terminal attempt was preserved and no candidate was selected.`,
      );
    const { bytes, adapterIdentity, probe, outputDigest } = execution.accepted
      .value as {
      bytes: Uint8Array;
      adapterIdentity: string;
      probe: ReturnType<typeof probeProductionVideoMp4>;
      outputDigest: AutoMovieContentDigest;
    };
    const acceptedAttempt = execution.accepted.attempt;
    const outputPath = productionRepaintOutputPath({
      shot: requestedShot,
      sourceRenderFingerprint,
      attemptId: acceptedAttempt.attemptId,
      adapterIdentity,
      generatorProvenance: generator.generatorProvenance,
      parameters: request.parameters,
      executionPolicy,
      evidence,
      references: referenceReceipts,
      outputDigest,
    });
    const receipt: IAutoMovieRepaintReceipt = {
      version: 4,
      productionId: services.project.productionId,
      shot: requestedShot,
      compileFingerprint: registry.inputFingerprint,
      sourceRenderFingerprint,
      requestId,
      attemptId: acceptedAttempt.attemptId,
      startedAt: acceptedAttempt.startedAt,
      completedAt: acceptedAttempt.completedAt,
      costUnits: acceptedAttempt.costUnits,
      executionPolicy: structuredClone(executionPolicy),
      sourceBundle: source.bundle,
      controls: productionRepaintStructuralControls(source.manifest),
      references: referenceReceipts,
      adapterIdentity,
      generatorProvenance: structuredClone(generator.generatorProvenance),
      structuralAuthority: "deterministic-source-only",
      parameters: structuredClone(request.parameters),
      evidence: structuredClone(evidence),
      output: {
        path: outputPath,
        digest: outputDigest,
        bytes: bytes.length,
        probe,
      },
    };
    try {
      services.project.commitRepaintRendition(receipt, bytes, inputCurrent);
    } catch (error) {
      const inputRaceMessage = safeRepaintInputRaceMessage(error);
      if (inputRaceMessage !== null)
        return failure("repaint-input-changed", inputRaceMessage);
      return failure(
        "repaint-commit-refused",
        safeRepaintDiagnosticMessage(
          error,
          "Repaint candidate could not be committed safely.",
        ),
      );
    }
    return {
      repainted: true,
      selected: false,
      requestId,
      productionId: services.project.productionId,
      shot: requestedShot,
      receipt,
      diagnostics: [],
    };
  }
}

interface ICurrentShotSource {
  manifestPath: string;
  bundle: string;
  manifest: IAutoMovieRenderBundleManifest;
  frames: IAutoMovieRenderBundleManifest["frames"];
}

const currentShotSource = (
  services: IAutoMovieProductionServices,
  shot: string,
  compileFingerprint: AutoMovieContentDigest,
  expected: {
    width: number;
    height: number;
    fps: number;
    frameCount: number;
  },
  runtime: Pick<
    IAutoMovieRenderBundleManifest,
    "dialogueRuntimeIdentity" | "rendererIdentity"
  >,
): ICurrentShotSource | null => {
  const candidates = physicalFiles(services.project.renderRoot())
    .filter((file) => path.basename(file) === "manifest.json")
    .flatMap((manifestPath): ICurrentShotSource[] => {
      const manifest = services.project.verifiedRenderManifest(manifestPath);
      const frames =
        manifest?.frames.filter(
          (frame) => frame.index >= 0 && frame.index < expected.frameCount,
        ) ?? [];
      const structuralPasses = [
        "depth",
        "mask",
        "normal",
        "outline",
        "pose",
      ] as const;
      if (
        manifest === null ||
        manifest.compileFingerprint !== compileFingerprint ||
        manifest.dialogueRuntimeIdentity !== runtime.dialogueRuntimeIdentity ||
        manifest.rendererIdentity !== runtime.rendererIdentity ||
        manifest.target.kind !== "shot" ||
        manifest.target.id !== shot ||
        manifest.renderSpec.frameFormat.width !== expected.width ||
        manifest.renderSpec.frameFormat.height !== expected.height ||
        manifest.renderSpec.frameFormat.fps !== expected.fps ||
        Array.from({ length: expected.frameCount }, (_, index) => index).some(
          (index) =>
            frames.some(
              (frame) => frame.index === index && frame.pass === "beauty",
            ) === false,
        ) ||
        structuralPasses.some((pass) =>
          Array.from(
            { length: expected.frameCount },
            (_, index) => index,
          ).every((index) =>
            frames.some(
              (frame) => frame.index === index && frame.pass === pass,
            ),
          ),
        ) === false
      )
        return [];
      return [
        {
          manifestPath,
          bundle: normalizeSlash(
            path.relative(
              services.project.renderRoot(),
              path.dirname(manifestPath),
            ),
          ),
          manifest,
          frames,
        },
      ];
    })
    .sort(
      (left, right) =>
        right.frames.length - left.frames.length ||
        compareCodeUnits(left.bundle, right.bundle),
    );
  return candidates[0] ?? null;
};

const LEGACY_REPAINT_POLICY: IAutoMovieRepaintExecutionPolicy = {
  maximumAttempts: 1,
  attemptTimeoutMs: 3_600_000,
  maximumElapsedMs: 3_600_000,
  maximumCostUnits: Number.MAX_SAFE_INTEGER,
  backoffMs: [],
  retryableFailures: [],
};

const repaintRuntimeInstant = (value: Date, label: string): Date => {
  const observed = new Date(value.getTime());
  if (Number.isNaN(observed.getTime()))
    throw new Error(`Repaint ${label} requires a valid runtime instant.`);
  return observed;
};

const legacyRepaintEvidence = (
  shot: string,
): IAutoMovieRepaintRequestEvidence => ({
  prompt: `legacy:repaint:${shot}:prompt`,
  continuity: null,
  settings: "legacy:repaint:settings",
  design: `legacy:repaint:${shot}:design`,
  screenplayOrBrief: `legacy:repaint:${shot}:screenplay-or-brief`,
  shot: `legacy:repaint:${shot}:shot`,
});

const assertRepaintEvidence = (
  evidence: IAutoMovieRepaintRequestEvidence,
): void => {
  for (const [key, value] of Object.entries(evidence)) {
    if (key === "continuity" && value === null) continue;
    if (
      typeof value !== "string" ||
      value.trim().length === 0 ||
      value !== value.trim()
    )
      throw new Error(
        `Repaint request evidence ${key} must be a trimmed non-empty stable address.`,
      );
  }
};

const waitForRepaintBackoff = (
  milliseconds: number,
  signal: AbortSignal,
): Promise<void> =>
  new Promise((resolve, reject) => {
    let settled = false;
    const abort = (): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal.removeEventListener("abort", abort);
      reject(new Error("Repaint request was cancelled during backoff."));
    };
    const timer = setTimeout(() => {
      settled = true;
      signal.removeEventListener("abort", abort);
      resolve();
    }, milliseconds);
    signal.addEventListener("abort", abort, { once: true });
    if (signal.aborted) abort();
  });

const resolveReferences = (
  services: IAutoMovieProductionServices,
  input: IAutoMovieRepaintShot.IProps,
):
  | {
      values: Array<{
        role: AutoMovieRepaintReferenceRole;
        path: string;
        digest: AutoMovieContentDigest;
        bytes: Uint8Array;
      }>;
    }
  | { diagnostic: IAutoMovieDiagnostic } => {
  const manifestPath = services.project.manifest().assetManifest;
  const inputs = services.project.contentInputs();
  const manifestInput =
    manifestPath === undefined
      ? undefined
      : inputs.find((candidate) => candidate.path === manifestPath);
  if (manifestInput?.bytes === null || manifestInput === undefined)
    return {
      diagnostic: diagnostic(
        "repaint-reference-manifest-missing",
        input.shot,
        "Repaint references require the compiler-validated asset manifest and current declared bytes.",
      ),
    };
  let decoded: unknown;
  try {
    decoded = JSON.parse(Buffer.from(manifestInput.bytes).toString("utf8"));
  } catch {
    return {
      diagnostic: diagnostic(
        "repaint-reference-manifest-invalid",
        input.shot,
        "The current asset manifest is not valid JSON. Correct it and compile before repaint.",
      ),
    };
  }
  const validation = typia.validateEquals<IAutoMovieAssetManifest>(decoded);
  if (validation.success === false)
    return {
      diagnostic: diagnostic(
        "repaint-reference-manifest-invalid",
        input.shot,
        "The current asset manifest is malformed. Correct it and compile before repaint.",
      ),
    };
  if (
    validation.data.assets.some(
      (asset) => assetUrlAdmissionRefusal(asset) !== null,
    )
  )
    return {
      diagnostic: diagnostic(
        "repaint-reference-manifest-invalid",
        input.shot,
        "The current asset manifest contains an inadmissible source or license URL. Correct it and compile before repaint.",
      ),
    };
  const seen = new Set<string>();
  const rolesByDigest = new Map<
    AutoMovieContentDigest,
    Set<AutoMovieRepaintReferenceRole>
  >();
  const values: Array<{
    role: AutoMovieRepaintReferenceRole;
    path: string;
    digest: AutoMovieContentDigest;
    bytes: Uint8Array;
  }> = [];
  for (const reference of input.references) {
    const key = `${reference.role}\0${reference.path}`;
    const record = validation.data.assets.find(
      (asset) => asset.path === reference.path,
    );
    const resident = inputs.find(
      (candidate) =>
        candidate.path === reference.path && candidate.bytes !== null,
    );
    if (
      seen.has(key) ||
      record === undefined ||
      resident?.bytes === null ||
      resident === undefined ||
      record.uses.some(
        (use) =>
          use.production === services.project.productionId &&
          use.consumer.kind === "rendition-reference" &&
          use.consumer.id === input.shot,
      ) === false ||
      digestAutoMovieBytes(resident.bytes) !== record.digest
    )
      return {
        diagnostic: diagnostic(
          "repaint-reference-invalid",
          input.shot,
          `Reference "${reference.role}:${reference.path}" is duplicate, absent, byte-stale, or not registered as a rendition-reference for shot "${input.shot}". Correct the asset manifest and compile before repaint.`,
        ),
      };
    seen.add(key);
    const roles = rolesByDigest.get(record.digest) ?? new Set();
    roles.add(reference.role);
    rolesByDigest.set(record.digest, roles);
    values.push({
      role: reference.role,
      path: reference.path,
      digest: record.digest,
      bytes: resident.bytes,
    });
  }
  if (
    [...rolesByDigest.values()].some(
      (roles) => roles.size === REPAINT_REFERENCE_ROLE_COUNT,
    )
  )
    return {
      diagnostic: diagnostic(
        "repaint-reference-invalid",
        input.shot,
        "One reference image cannot stand as canonical guidance for every repaint role. Split structure, identity, costume, style, material, color, and environment authority across reviewed assets.",
      ),
    };
  return { values };
};

const REPAINT_REFERENCE_ROLE_COUNT = 7;
const REPAINT_RAW_OUTPUT_MAXIMUM_BYTES = 512 * 1024 * 1024;

const physicalFiles = (root: string): string[] => {
  if (fs.existsSync(root) === false) return [];
  const output: string[] = [];
  for (const entry of fs
    .readdirSync(root, { withFileTypes: true })
    .sort((left, right) => compareCodeUnits(left.name, right.name))) {
    const file = path.join(root, entry.name);
    if (entry.isSymbolicLink())
      throw new Error(`Repaint evidence refuses linked render path "${file}".`);
    if (entry.isDirectory()) output.push(...physicalFiles(file));
    else if (entry.isFile()) output.push(file);
  }
  return output;
};

const diagnostic = (
  code: AutoMovieDiagnosticCode,
  target: string,
  message: string,
  phase: IAutoMovieDiagnostic["phase"] = "compile",
): IAutoMovieDiagnostic => ({
  code,
  category: "error",
  phase,
  target,
  path: null,
  message,
});

const safeRepaintDiagnosticMessage = (
  error: unknown,
  fallback: string,
): string => {
  try {
    const message: unknown =
      error instanceof Error ? error.message : String(error);
    return typeof message === "string" && message.trim().length !== 0
      ? message.trim()
      : fallback;
  } catch {
    return fallback;
  }
};

const safeRepaintInputRaceMessage = (error: unknown): string | null => {
  try {
    return error instanceof AutoMovieProductionInputRaceError
      ? safeRepaintDiagnosticMessage(
          error,
          "Repaint input changed without a safe diagnostic.",
        )
      : null;
  } catch {
    return null;
  }
};

const safeRepaintInputText = (
  input: unknown,
  key: "productionId" | "shot",
): string => {
  try {
    if (typeof input !== "object" || input === null) return "";
    const value: unknown = Reflect.get(input, key);
    return typeof value === "string" ? value : "";
  } catch {
    return "";
  }
};

const validatedRepaintRequest = (
  input: unknown,
): IAutoMovieRepaintShot.IProps | null => {
  try {
    const validation =
      typia.validateEquals<IAutoMovieRepaintShot.IProps>(input);
    return validation.success ? structuredClone(validation.data) : null;
  } catch {
    return null;
  }
};

const validatedRepaintSelection = (
  input: unknown,
): IAutoMovieRepaintSelectionInput | null => {
  try {
    const validation =
      typia.validateEquals<IAutoMovieRepaintSelectionInput>(input);
    return validation.success ? structuredClone(validation.data) : null;
  } catch {
    return null;
  }
};

const normalizeSlash = (value: string): string =>
  value.split(path.sep).join("/");
