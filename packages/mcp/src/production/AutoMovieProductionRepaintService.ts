import {
  AutoMovieContentDigest,
  AutoMovieDiagnosticCode,
  AutoMovieProductionShotRepaint,
  IAutoMovieAssetManifest,
  IAutoMovieDiagnostic,
  IAutoMovieRenderBundleManifest,
  IAutoMovieRepaintReceipt,
  IAutoMovieRepaintShot,
} from "@automovie/interface";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import typia from "typia";

import type { IAutoMovieProductionServices } from "./AutoMovieProductionContext";
import { AutoMovieProductionInputRaceError } from "./AutoMovieProductionProject";
import { parseAutoMovieCaptureRuntimeIdentity } from "./captureRuntimeIdentity";
import {
  canonicalizeAutoMovieJson,
  compareCodeUnits,
  digestAutoMovieBytes,
} from "./contentIdentity";
import { assertProductionRenditionClipDelivery } from "./muxProductionFeatureMp4";
import { probeProductionVideoMp4 } from "./probeProductionMedia";
import { readAutoMovieProductionRegistry } from "./productionRegistry";
import {
  canonicalAutoMovieRepaintRuntimeIdentity,
  productionRepaintOutputPath,
  productionRepaintStructuralControls,
  productionSourceRenderFingerprint,
} from "./renditionIdentity";

/**
 * Optional host repaint orchestration and immutable rendition provenance.
 *
 * @evidence requirements/repaint/eligibility-and-prerequisites.md#repaint-current-evidence Orchestrates repaint only after current deterministic source evidence and review prerequisites are proved.
 * @evidence specifications/asset-and-representation/generated-assets-and-repaint-handoff.md#asset-spec-repaint-execution-eligibility Enforces the host handoff and immutable rendition-provenance boundary.
 */
export class AutoMovieProductionRepaintService {
  public constructor(
    private readonly adapter?: AutoMovieProductionShotRepaint,
  ) {}

  /**
   * Repaint one current shot from verified deterministic controls.
   *
   * @evidence requirements/repaint/eligibility-and-prerequisites.md#repaint-eligibility-refusal Refuses the operation until the addressed shot has current complete source evidence and review.
   * @evidence specifications/asset-and-representation/generated-assets-and-repaint-handoff.md#asset-spec-repaint-execution-eligibility Executes the eligible handoff and records the exact host-produced rendition facts.
   */
  public async repaint(
    services: IAutoMovieProductionServices,
    input: IAutoMovieRepaintShot.IProps,
  ): Promise<IAutoMovieRepaintShot> {
    const failure = (
      code: AutoMovieDiagnosticCode,
      message: string,
    ): IAutoMovieRepaintShot => ({
      repainted: false,
      productionId: services.project.productionId,
      shot: input.shot,
      receipt: null,
      diagnostics: [diagnostic(code, input.shot, message)],
    });
    if (this.adapter === undefined)
      return failure(
        "repaint-host-unavailable",
        "This MCP host has no repaint adapter. Configure createAutoMovieMcpServer({ repaint }) with a local model or API adapter that implements AutoMovieProductionShotRepaint, then restart the host and retry. AutoMovie will not fabricate diffusion output.",
      );
    const status = services.compileStatus();
    if (status.success === false)
      return failure(
        "repaint-compile-stale",
        "repaintShot requires a current successful source compile. Run the scaffold compile command, resolve its diagnostics, and retry.",
      );
    let registry: ReturnType<typeof readAutoMovieProductionRegistry>;
    try {
      registry = readAutoMovieProductionRegistry(services.project);
    } catch (error) {
      return failure(
        "repaint-registry-unavailable",
        error instanceof Error ? error.message : String(error),
      );
    }
    if (registry.shots.some((shot) => shot.id === input.shot) === false)
      return failure(
        "repaint-target-missing",
        `Shot "${input.shot}" is absent from the current compiler registry. Correct the registration or compile the source that defines it.`,
      );
    const graph = services.project.graph();
    const production = graph.production;
    const shot = graph.shots.get(input.shot);
    if (production === null || shot === undefined)
      return failure(
        "repaint-target-missing",
        `Shot "${input.shot}" has no current production frame contract. Correct the tracked design and compile before repaint.`,
      );
    const expectedOutput = {
      width: production.frameFormat.width,
      height: production.frameFormat.height,
      fps: production.frameFormat.fps,
      frameCount: Math.round(shot.durationSeconds * production.frameFormat.fps),
      runtimeSeconds: shot.durationSeconds,
    };
    if (
      input.parameters.prompt.trim().length === 0 ||
      Number.isSafeInteger(input.parameters.seed) === false ||
      Number.isFinite(input.parameters.strength) === false ||
      input.parameters.strength < 0 ||
      input.parameters.strength > 1 ||
      Object.values(input.parameters.controls ?? {}).some(
        (value) =>
          typeof value === "number" && Number.isFinite(value) === false,
      ) ||
      input.references.length === 0
    )
      return failure(
        "repaint-input-invalid",
        "repaintShot requires a non-blank prompt, safe-integer seed, strength in [0, 1], and at least one fixed style or character reference.",
      );
    const sourceReviewTarget = { kind: "shot", id: input.shot } as const;
    const preparedSourceReview = services.review.prepare({
      target: sourceReviewTarget,
    });
    const sourceReview = services.project.review(sourceReviewTarget);
    if (
      preparedSourceReview.diagnostics.some(
        (entry) => entry.category === "error",
      ) ||
      sourceReview === null ||
      sourceReview.complete === false ||
      sourceReview.fingerprint !== preparedSourceReview.fingerprint
    )
      return failure(
        "repaint-source-review-incomplete",
        `Shot "${input.shot}" must have a current completed deterministic source review before repaint. Inspect the current source frames, record the delegated review worksheet as complete, then retry.`,
      );
    const sourceReviewFingerprint = sourceReview.fingerprint;
    const attemptId = randomUUID();
    let resolvedSource: ICurrentShotSource | null;
    try {
      resolvedSource = currentShotSource(
        services,
        input.shot,
        registry.inputFingerprint,
        expectedOutput,
      );
    } catch (error) {
      return failure(
        "repaint-source-evidence-invalid",
        error instanceof Error ? error.message : String(error),
      );
    }
    if (resolvedSource === null)
      return failure(
        "repaint-source-evidence-missing",
        "No current verified shot bundle contains both beauty pixels and a structural control pass. Capture the shot frame grid and its declared depth, pose, outline, mask, or normal controls first.",
      );
    const source = resolvedSource;
    const references = resolveReferences(services, input);
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
        const currentReferences = resolveReferences(services, input);
        const currentPreparedSourceReview = services.review.prepare({
          target: sourceReviewTarget,
        });
        const currentSourceReview = services.project.review(sourceReviewTarget);
        return (
          canonicalizeAutoMovieJson(currentRegistry) === registryIdentity &&
          currentPreparedSourceReview.diagnostics.some(
            (entry) => entry.category === "error",
          ) === false &&
          currentSourceReview !== null &&
          currentSourceReview.complete &&
          currentSourceReview.fingerprint === sourceReviewFingerprint &&
          currentPreparedSourceReview.fingerprint === sourceReviewFingerprint &&
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
    let generated: Awaited<ReturnType<AutoMovieProductionShotRepaint>>;
    try {
      generated = await this.adapter({
        projectRoot: services.project.root,
        productionId: services.project.productionId,
        compileFingerprint: registry.inputFingerprint,
        shot: input.shot,
        source: {
          bundle: source.bundle,
          manifest: source.manifest,
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
        references: references.values,
        parameters: structuredClone(input.parameters),
      });
    } catch (error) {
      return failure(
        "repaint-failed",
        `${
          error instanceof Error ? error.message : String(error)
        }. Correct the configured repaint adapter and retry without changing the deterministic source receipt.`,
      );
    }
    if (inputCurrent() === false)
      return failure(
        "repaint-input-changed",
        "Compiler registry or deterministic source pixels changed while repaint was running. Discard the mixed result and retry from current evidence.",
      );
    let adapterIdentity: string;
    let probe: ReturnType<typeof probeProductionVideoMp4>;
    try {
      if (generated.mediaType !== "video/mp4" || generated.bytes.length === 0)
        throw new Error("the adapter did not return non-empty video/mp4 bytes");
      adapterIdentity = canonicalAutoMovieRepaintRuntimeIdentity(
        generated.runtimeIdentity,
      );
      probe = probeProductionVideoMp4(generated.bytes);
      if (
        probe.kind !== "video" ||
        probe.width !== expectedOutput.width ||
        probe.height !== expectedOutput.height ||
        probe.frameCount !== expectedOutput.frameCount ||
        Math.abs(probe.fps - expectedOutput.fps) > 1e-9 ||
        Math.abs(probe.runtimeSeconds - expectedOutput.runtimeSeconds) > 1e-9
      )
        throw new Error(
          `the adapter output does not match the exact ${expectedOutput.width}x${expectedOutput.height}, ${expectedOutput.fps}fps, ${expectedOutput.frameCount}-frame shot contract`,
        );
      assertProductionRenditionClipDelivery({
        bytes: generated.bytes,
        shot: input.shot,
        ...expectedOutput,
      });
    } catch (error) {
      return failure(
        "repaint-output-invalid",
        `${
          error instanceof Error ? error.message : String(error)
        }. Return a parseable H.264 MP4 and complete structured adapter identity.`,
      );
    }
    const outputDigest = digestAutoMovieBytes(generated.bytes);
    const referenceReceipts = references.values.map(
      ({ role, path: referencePath, digest }) => ({
        role,
        path: referencePath,
        digest,
      }),
    );
    const outputPath = productionRepaintOutputPath({
      shot: input.shot,
      sourceRenderFingerprint,
      attemptId,
      adapterIdentity,
      parameters: input.parameters,
      references: referenceReceipts,
      outputDigest,
    });
    const receipt: IAutoMovieRepaintReceipt = {
      version: 2,
      productionId: services.project.productionId,
      shot: input.shot,
      compileFingerprint: registry.inputFingerprint,
      sourceRenderFingerprint,
      sourceReviewFingerprint,
      attemptId,
      sourceBundle: source.bundle,
      controls: productionRepaintStructuralControls(source.manifest),
      references: referenceReceipts,
      adapterIdentity,
      parameters: structuredClone(input.parameters),
      output: {
        path: outputPath,
        digest: outputDigest,
        bytes: generated.bytes.length,
        probe,
      },
    };
    try {
      services.project.commitRepaintRendition(
        receipt,
        generated.bytes,
        inputCurrent,
      );
    } catch (error) {
      if (error instanceof AutoMovieProductionInputRaceError)
        return failure("repaint-input-changed", error.message);
      return failure(
        "repaint-commit-refused",
        error instanceof Error ? error.message : String(error),
      );
    }
    return {
      repainted: true,
      productionId: services.project.productionId,
      shot: input.shot,
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

const resolveReferences = (
  services: IAutoMovieProductionServices,
  input: IAutoMovieRepaintShot.IProps,
):
  | {
      values: Array<{
        role: "style" | "character";
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
  const seen = new Set<string>();
  const values: Array<{
    role: "style" | "character";
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
    values.push({
      role: reference.role,
      path: reference.path,
      digest: record.digest,
      bytes: resident.bytes,
    });
  }
  return { values };
};

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
): IAutoMovieDiagnostic => ({
  code,
  category: "error",
  phase: "compile",
  target,
  path: null,
  message,
});

const normalizeSlash = (value: string): string =>
  value.split(path.sep).join("/");
