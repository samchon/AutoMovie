import type {
  AutoMovieProductionShotRepaint,
  AutoMovieRepaintReferenceRole,
  IAutoMovieAssetManifest,
  IAutoMovieProductionRegistryManifest,
  IAutoMovieRenderBundleManifest,
  IAutoMovieRepaintExecutionPolicy,
  IAutoMovieRepaintGeneratorAdoption,
  IAutoMovieRepaintReceipt,
  IAutoMovieRepaintRequestEvidence,
  IAutoMovieRepaintShot,
} from "@automovie/interface";
import {
  type AutoMovieProductionContext,
  AutoMovieProductionInputRaceError,
  AutoMovieProductionProject,
  AutoMovieProductionRepaintService,
  AutoMovieRepaintAttemptError,
  type IAutoMovieProductionServices,
  type IAutoMovieRepaintAttemptRecord,
  canonicalAutoMovieRepaintRuntimeIdentity,
  digestAutoMovieBytes,
} from "@automovie/production";
import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { completedFilmJson } from "../internal/completedFilmFixture";
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

const referenceRoles = [
  "structure",
  "character",
  "costume",
  "style",
  "material",
  "color",
  "environment",
] as const satisfies readonly AutoMovieRepaintReferenceRole[];

const referencePathForRole = (role: AutoMovieRepaintReferenceRole): string =>
  role === "structure" || role === "character"
    ? "assets/structure-identity-reference.png"
    : `assets/${role}-reference.png`;

const input: IAutoMovieRepaintShot.IProps = {
  productionId: "repaint-adoption-test",
  shot: "opening",
  parameters: {
    prompt: "reviewed prompt",
    seed: 17,
    strength: 0.35,
  },
  references: referenceRoles.map((role) => ({
    role,
    path: referencePathForRole(role),
  })),
};

const executionPolicy = (
  override: Partial<IAutoMovieRepaintExecutionPolicy> = {},
): IAutoMovieRepaintExecutionPolicy => ({
  maximumAttempts: 2,
  attemptTimeoutMs: 1_000,
  maximumElapsedMs: 10_000,
  maximumCostUnits: 10,
  backoffMs: [1],
  retryableFailures: ["rate-limit"],
  ...override,
});

const executionEvidence = (): IAutoMovieRepaintRequestEvidence => ({
  prompt: "docs/obligations/repaint-prompt.md#opening",
  continuity: null,
  settings: "docs/settings/production.md#opening",
  design: "docs/designs/opening.md#opening",
  screenplayOrBrief: "docs/screenplays/opening.md#opening",
  shot: "docs/shots/opening.md#opening",
});

const services = (): IAutoMovieProductionServices =>
  ({
    project: { productionId: input.productionId },
    compileStatus: () => ({ success: false }),
  }) as unknown as IAutoMovieProductionServices;

const codeOf = (result: IAutoMovieRepaintShot): string | undefined =>
  result.diagnostics[0]?.code;

const nonError = (message: string): Error => message as unknown as Error;

interface IRepaintAdoptionFailure {
  error: unknown;
}

class RepaintAdoptionCleanupError extends AggregateError {}

const preserveRepaintAdoptionCleanup = (
  failure: IRepaintAdoptionFailure | undefined,
  cleanups: ReadonlyArray<() => void>,
  resource: string,
): void => {
  const cleanupFailures: unknown[] = [];
  for (const cleanup of cleanups)
    try {
      cleanup();
    } catch (error) {
      cleanupFailures.push(error);
    }
  if (cleanupFailures.length === 0) return;
  if (failure === undefined) {
    if (cleanupFailures.length === 1) throw cleanupFailures[0];
    throw new RepaintAdoptionCleanupError(
      cleanupFailures,
      `${resource} cleanup failed.`,
    );
  }
  throw new RepaintAdoptionCleanupError(
    [failure.error, ...cleanupFailures],
    `${resource} cleanup failed after the behavioral assertion failed.`,
  );
};

const executableServices = (props: {
  root: string;
  commit: (receipt: IAutoMovieRepaintReceipt, bytes: Uint8Array) => void;
  referenceBytes?: (referencePath: string) => Buffer;
  assetManifest?: (manifest: IAutoMovieAssetManifest) => void;
}): IAutoMovieProductionServices => {
  const compileFingerprint = digestAutoMovieBytes(
    Buffer.from("repaint-compile", "utf8"),
  );
  const assetManifest = completedFilmJson<IAutoMovieAssetManifest>(
    "automovie/assets.json",
  );
  const referenceBytesByPath = new Map(
    [...new Set(input.references.map((reference) => reference.path))].map(
      (referencePath) => [
        referencePath,
        props.referenceBytes?.(referencePath) ??
          Buffer.from(`reviewed-reference:${referencePath}`, "utf8"),
      ],
    ),
  );
  assetManifest.assets = [...referenceBytesByPath].map(
    ([referencePath, referenceBytes]) => ({
      ...assetManifest.assets[0]!,
      path: referencePath,
      digest: digestAutoMovieBytes(referenceBytes),
      uses: [
        {
          production: input.productionId,
          consumer: { kind: "rendition-reference" as const, id: input.shot },
          reason: `This reviewed role-specific reference constrains ${input.shot}.`,
        },
      ],
    }),
  );
  props.assetManifest?.(assetManifest);
  const assetManifestBytes = Buffer.from(JSON.stringify(assetManifest), "utf8");
  const registry: IAutoMovieProductionRegistryManifest = {
    version: 2,
    compiler: "repaint-adoption-test",
    productionId: input.productionId,
    inputFingerprint: compileFingerprint,
    assets: [],
    shots: [{ id: input.shot, path: "generated/shots/opening.json" }],
    film: "fixture-film",
  };
  const registryBytes = Buffer.from(JSON.stringify(registry), "utf8");
  const registryDigest = digestAutoMovieBytes(registryBytes);
  const frameCount = 4;
  const frameFormat = { width: 16, height: 16, fps: 24 };
  const frames: IAutoMovieRenderBundleManifest["frames"] = Array.from(
    { length: frameCount },
    (_, index) =>
      (["beauty", "depth"] as const).map((pass) => ({
        index,
        time: index / frameFormat.fps,
        pass,
        path: `${pass}-${index}.png`,
        digest: digestAutoMovieBytes(Buffer.from(`${pass}-${index}`, "utf8")),
        width: frameFormat.width,
        height: frameFormat.height,
      })),
  ).flat();
  const manifest = {
    version: 6,
    target: { kind: "shot", id: input.shot },
    compileFingerprint,
    dialogueRuntimeIdentity: null,
    rendererIdentity: testRendererIdentity(),
    targetFingerprint: digestAutoMovieBytes(
      Buffer.from("opening-target", "utf8"),
    ),
    renderSpec: { frameFormat },
    frames,
    semanticMasks: [],
  } as unknown as IAutoMovieRenderBundleManifest;
  const bundle = path.join(props.root, "bundle");
  fs.mkdirSync(bundle, { recursive: true });
  fs.writeFileSync(path.join(bundle, "manifest.json"), "{}\n", "utf8");
  const repaintAttempts: IAutoMovieRepaintAttemptRecord[] = [];
  const repaintRawOutputs = new Map<
    string,
    { receipt: { requestId: string; attemptId: string }; bytes: Uint8Array }
  >();
  const project = {
    productionId: input.productionId,
    root: props.root,
    productionStateRoot: path.join(props.root, "state"),
    manifest_: { assetManifest: "automovie/assets.json" },
    graph: () => ({
      production: { frameFormat },
      shots: new Map([
        [input.shot, { durationSeconds: frameCount / frameFormat.fps }],
      ]),
    }),
    generatedManifest: () => ({
      inputFingerprint: compileFingerprint,
      files: [{ path: "manifests/compile.json", digest: registryDigest }],
    }),
    readGeneratedFile: () => registryBytes,
    renderRoot: () => props.root,
    verifiedRenderManifest: () => manifest,
    readRenderFile: (file: string) => Buffer.from(file, "utf8"),
    manifest: () => ({ assetManifest: "automovie/assets.json" }),
    contentInputs: () => [
      { path: "automovie/assets.json", bytes: assetManifestBytes },
      ...[...referenceBytesByPath].map(([referencePath, bytes]) => ({
        path: referencePath,
        bytes,
      })),
    ],
    commitRepaintRendition: (
      receipt: IAutoMovieRepaintReceipt,
      bytes: Uint8Array,
    ) => props.commit(receipt, bytes),
    commitRepaintAttempt: (attempt: IAutoMovieRepaintAttemptRecord) => {
      repaintAttempts.push(structuredClone(attempt));
      return repaintAttempts.length;
    },
    repaintRequestAttempts: (requestId: string) =>
      structuredClone(
        repaintAttempts.filter((attempt) => attempt.requestId === requestId),
      ),
    acquireRepaintAttemptClaim: () => ({ status: "acquired" as const }),
    settleRepaintAttemptClaim: () => 1,
    commitRepaintRawOutput: (publication: {
      receipt: { requestId: string; attemptId: string };
      bytes: Uint8Array;
    }) => {
      repaintRawOutputs.set(
        `${publication.receipt.requestId}/${publication.receipt.attemptId}`,
        structuredClone(publication),
      );
      return 1;
    },
    repaintRawOutput: (requestId: string, attemptId: string) => {
      const publication = repaintRawOutputs.get(`${requestId}/${attemptId}`);
      if (publication === undefined) throw new Error("raw output absent");
      return structuredClone(publication);
    },
    commitFiles: () => 1,
  };
  Object.setPrototypeOf(project, AutoMovieProductionProject.prototype);
  return {
    project,
    oracle: {
      preview: () =>
        Promise.resolve({
          captured: true,
          compileFingerprint,
          renderBundle: "bundle",
          frame: null,
          diagnostics: [],
        }),
    },
    compileStatus: () => ({
      success: true,
      compiler: { inputFingerprint: compileFingerprint },
    }),
  } as unknown as IAutoMovieProductionServices;
};

const scenarioServices = (
  base: IAutoMovieProductionServices,
  props: {
    project?: Record<string, unknown>;
    services?: Record<string, unknown>;
  } = {},
): IAutoMovieProductionServices =>
  ({
    ...(base as unknown as Record<string, unknown>),
    ...props.services,
    project: {
      ...(base.project as unknown as Record<string, unknown>),
      ...props.project,
    },
  }) as unknown as IAutoMovieProductionServices;

/**
 * A repaint host is complete only when adapter and reviewed adoption coexist.
 *
 * Scenarios:
 *
 * 1. Missing, malformed, or credential-bearing adoption refuses before any
 *    provider call, while the valid twin reaches source preflight.
 * 2. Request shape and production namespace refusals precede execution.
 * 3. Registry, target, source-bundle, and every role-specific reference
 *    preflight reject missing, stale, linked, duplicated, or collapsed inputs.
 * 4. Provider throws, invalid output media, runtime mismatch, and commit races
 *    return stable diagnostics without publishing a receipt.
 * 5. Source candidate ordering is deterministic and all post-provider input
 *    changes are refused against a fresh snapshot.
 * 6. A matching execution commits receipt v4 with reviewed provenance,
 *    deterministic structural authority, and exact resident identities.
 * 7. Caller/provider mutation cannot change the immutable request snapshot
 *    shared by execution and receipt publication.
 * 8. A dispatch claim the project store refuses as held, closed by an unknown
 *    outcome, or moved returns the claim-refused diagnostic that names the
 *    cause, the owning attempt, and the author's next step, with no provider
 *    call.
 */
export const test_production_repaint_generator_adoption =
  async (): Promise<void> => {
    let adapterCalls = 0;
    const adapter: AutoMovieProductionShotRepaint = async () => {
      ++adapterCalls;
      throw new Error(
        "The adoption preflight test must not execute the adapter.",
      );
    };
    const missing = await Promise.all([
      new AutoMovieProductionRepaintService().repaint(services(), input),
      new AutoMovieProductionRepaintService(adapter).repaint(services(), input),
      new AutoMovieProductionRepaintService(undefined, adoption()).repaint(
        services(),
        input,
      ),
    ]);
    TestValidator.equals(
      "adapter and adoption are both required before repaint execution",
      missing.map(codeOf),
      [
        "repaint-host-unavailable",
        "repaint-host-unavailable",
        "repaint-host-unavailable",
      ],
    );

    const malformed = [
      { ...adoption(), credential: "must-not-enter-adoption" },
      {
        ...adoption(),
        runtimeIdentity: {
          ...adoption().runtimeIdentity,
          provider: " padded ",
        },
      },
      {
        ...adoption(),
        generatorProvenance: {
          ...adoption().generatorProvenance,
          termsCheckedAt: "2026-02-30",
        },
      },
    ];
    const thrownAdoption = adoption() as IAutoMovieRepaintGeneratorAdoption;
    Object.defineProperty(thrownAdoption, "runtimeIdentity", {
      enumerable: true,
      get: () => {
        throw nonError("non-error adoption failure");
      },
    });
    malformed.push(thrownAdoption);
    const malformedResults = await Promise.all(
      malformed.map((generator) =>
        new AutoMovieProductionRepaintService(
          adapter,
          generator as IAutoMovieRepaintGeneratorAdoption,
        ).repaint(services(), input),
      ),
    );
    TestValidator.equals(
      "invalid reviewed adoption is refused before external execution",
      malformedResults.map(codeOf),
      [
        "repaint-host-unavailable",
        "repaint-host-unavailable",
        "repaint-host-unavailable",
        "repaint-host-unavailable",
      ],
    );

    const admitted = await new AutoMovieProductionRepaintService(
      adapter,
      adoption(),
    ).repaint(services(), input);
    TestValidator.equals(
      "a valid adoption proceeds to the existing current-source preflight",
      codeOf(admitted),
      "repaint-compile-stale",
    );
    TestValidator.equals(
      "no refused or source-stale request reaches the adapter",
      adapterCalls,
      0,
    );
    let projectLookups = 0;
    const malformedEntryResults = await Promise.all(
      [
        null,
        { ...input, productionId: 42 },
        { ...input, hidden: "must-not-reach-project" },
      ].map((invalid) =>
        new AutoMovieProductionRepaintService(adapter, adoption()).serve(
          {
            forProduction: () => {
              ++projectLookups;
              return services();
            },
          } as unknown as AutoMovieProductionContext,
          invalid as IAutoMovieRepaintShot.IProps,
        ),
      ),
    );
    TestValidator.equals(
      "public repaint entry validates exact input before project lookup",
      {
        codes: malformedEntryResults.map(codeOf),
        projectLookups,
        adapterCalls,
      },
      {
        codes: [
          "repaint-input-invalid",
          "repaint-input-invalid",
          "repaint-input-invalid",
        ],
        projectLookups: 0,
        adapterCalls: 0,
      },
    );
    const deterministicServices = {
      project: {
        productionId: input.productionId,
        graph: () => ({
          production: { visualDelivery: "deterministic" },
        }),
      },
    } as unknown as IAutoMovieProductionServices;
    const serveFailures = await Promise.all([
      new AutoMovieProductionRepaintService(adapter, adoption()).serve(
        {
          forProduction: () => deterministicServices,
        } as unknown as AutoMovieProductionContext,
        { ...input, productionId: "" },
      ),
      new AutoMovieProductionRepaintService(adapter, adoption()).serve(
        {
          forProduction: () => deterministicServices,
        } as unknown as AutoMovieProductionContext,
        { ...input, productionId: " padded " },
      ),
      new AutoMovieProductionRepaintService(adapter, adoption()).serve(
        {
          forProduction: () => {
            throw new Error("missing production");
          },
        } as unknown as AutoMovieProductionContext,
        input,
      ),
      new AutoMovieProductionRepaintService(adapter, adoption()).serve(
        {
          forProduction: () => {
            throw nonError("non-error missing production");
          },
        } as unknown as AutoMovieProductionContext,
        input,
      ),
      new AutoMovieProductionRepaintService(adapter, adoption()).serve(
        {
          forProduction: () => deterministicServices,
        } as unknown as AutoMovieProductionContext,
        input,
      ),
    ]);
    TestValidator.equals(
      "public repaint entry covers namespace, lookup, and delivery refusals",
      serveFailures.map(codeOf),
      [
        "repaint-production-invalid",
        "repaint-production-invalid",
        "repaint-production-unregistered",
        "repaint-production-unregistered",
        "repaint-delivery-disabled",
      ],
    );

    const root = fs.mkdtempSync(
      path.join(os.tmpdir(), "automovie-repaint-adoption-"),
    );
    const externalRoots: string[] = [];
    let rootFailure: IRepaintAdoptionFailure | undefined;
    try {
      const generatedBytes = await productionH264Mp4({
        width: 16,
        height: 16,
        fps: 24,
        frameCount: 4,
      });
      let providerExecutions = 0;
      const actualAdapter =
        (
          runtimeIdentity: IAutoMovieRepaintGeneratorAdoption["runtimeIdentity"],
        ): AutoMovieProductionShotRepaint =>
        async () => {
          ++providerExecutions;
          return {
            mediaType: "video/mp4",
            bytes: generatedBytes,
            runtimeIdentity,
          };
        };
      const committed: IAutoMovieRepaintReceipt[] = [];
      const runnable = executableServices({
        root,
        commit: (receipt) => committed.push(receipt),
      });
      const credentialReferenceServices = [
        {
          secret: "repaint-source-secret",
          services: executableServices({
            root,
            commit: () => undefined,
            assetManifest: (manifest) => {
              const fetched = manifest.assets.find(
                (asset) => asset.original !== undefined,
              );
              if (fetched?.original === undefined)
                throw new Error("Repaint references need one fetched asset.");
              fetched.original.url =
                "https://source-user:repaint-source-secret@assets.example/reference.png";
            },
          }),
        },
        {
          secret: "repaint-license-secret",
          services: executableServices({
            root,
            commit: () => undefined,
            assetManifest: (manifest) => {
              manifest.assets[0]!.license.url =
                "https://license-user:repaint-license-secret@licenses.example/terms";
            },
          }),
        },
      ];
      const digestAliasRoot = path.join(root, "digest-aliases");
      const digestAliasServices = executableServices({
        root: digestAliasRoot,
        commit: () => undefined,
        referenceBytes: () => Buffer.from("one-image-under-many-paths", "utf8"),
      });
      const selected = adoption();
      const validManifest = runnable.project.verifiedRenderManifest(
        path.join(root, "bundle", "manifest.json"),
      );
      const validGenerated = runnable.project.generatedManifest();
      if (validManifest === null || validGenerated === null)
        throw new Error("Executable repaint fixture lost current evidence.");
      const validInputs = runnable.project.contentInputs();
      const validGraph = runnable.project.graph();
      const validRegistry = JSON.parse(
        Buffer.from(
          runnable.project.readGeneratedFile("manifests/compile.json"),
        ).toString("utf8"),
      ) as IAutoMovieProductionRegistryManifest;
      const repaint = (
        services: IAutoMovieProductionServices,
        props: {
          adapter?: AutoMovieProductionShotRepaint;
          generator?: IAutoMovieRepaintGeneratorAdoption;
          request?: IAutoMovieRepaintShot.IProps;
        } = {},
      ): Promise<IAutoMovieRepaintShot> =>
        new AutoMovieProductionRepaintService(
          props.adapter ?? actualAdapter(selected.runtimeIdentity),
          props.generator ?? selected,
        ).repaint(services, props.request ?? input);
      const servicesWithRegistry = (
        registry: IAutoMovieProductionRegistryManifest,
      ): IAutoMovieProductionServices => {
        const bytes = Buffer.from(JSON.stringify(registry), "utf8");
        const registryDigest = digestAutoMovieBytes(bytes);
        return scenarioServices(runnable, {
          project: {
            generatedManifest: () => ({
              ...validGenerated,
              files: [
                { path: "manifests/compile.json", digest: registryDigest },
              ],
            }),
            readGeneratedFile: () => bytes,
          },
        });
      };
      let changingControlReads = 0;
      const changingControls: Record<string, string | number | boolean> = {};
      Object.defineProperty(changingControls, "mutating", {
        enumerable: true,
        get: () =>
          ++changingControlReads === 1 ? true : ({} as unknown as boolean),
      });
      const invalidInputs: unknown[] = [
        null,
        { ...input, hidden: "must-not-reach-provider" },
        {
          ...input,
          parameters: {
            ...input.parameters,
            credential: "must-not-reach-provider",
          },
        },
        {
          ...input,
          parameters: { ...input.parameters, prompt: "" },
        },
        {
          ...input,
          parameters: { ...input.parameters, prompt: " padded " },
        },
        {
          ...input,
          parameters: { ...input.parameters, negativePrompt: "" },
        },
        {
          ...input,
          parameters: { ...input.parameters, negativePrompt: " padded " },
        },
        {
          ...input,
          parameters: {
            ...input.parameters,
            seed: Number.MAX_SAFE_INTEGER + 1,
          },
        },
        {
          ...input,
          parameters: { ...input.parameters, strength: Number.NaN },
        },
        {
          ...input,
          parameters: { ...input.parameters, strength: -0.1 },
        },
        {
          ...input,
          parameters: { ...input.parameters, strength: 1.1 },
        },
        {
          ...input,
          parameters: {
            ...input.parameters,
            controls: { "": true },
          },
        },
        {
          ...input,
          parameters: {
            ...input.parameters,
            controls: { " padded ": true },
          },
        },
        {
          ...input,
          parameters: {
            ...input.parameters,
            controls: { scheduler: " padded " },
          },
        },
        {
          ...input,
          parameters: {
            ...input.parameters,
            controls: { scheduler: "" },
          },
        },
        {
          ...input,
          parameters: {
            ...input.parameters,
            controls: { guidance: Number.POSITIVE_INFINITY },
          },
        },
        {
          ...input,
          parameters: {
            ...input.parameters,
            controls: changingControls,
          },
        },
        {
          ...input,
          parameters: {
            ...input.parameters,
            controls: new Date("2026-08-28T00:00:00.000Z"),
          },
        },
        {
          ...input,
          references: [
            { ...input.references[0]!, credential: "must-not-reach-provider" },
          ],
        },
        { ...input, references: [] },
        {
          ...input,
          references: [
            {
              ...input.references[0]!,
              role: "unknown-role",
            },
          ],
        },
      ];
      const invalidResults = await Promise.all(
        invalidInputs.map((invalid) =>
          new AutoMovieProductionRepaintService(
            actualAdapter(selected.runtimeIdentity),
            selected,
          ).repaint(runnable, invalid as IAutoMovieRepaintShot.IProps),
        ),
      );
      TestValidator.predicate(
        "runtime refuses unnormalized prompts and scalar controls before execution",
        invalidResults.every(
          (result) => codeOf(result) === "repaint-input-invalid",
        ),
      );
      TestValidator.equals(
        "malformed requests are rejected before provider execution",
        providerExecutions,
        0,
      );
      TestValidator.equals(
        "direct service use cannot cross a production namespace",
        codeOf(
          await new AutoMovieProductionRepaintService(
            actualAdapter(selected.runtimeIdentity),
            selected,
          ).repaint(runnable, {
            ...input,
            productionId: "another-production",
          }),
        ),
        "repaint-production-invalid",
      );
      TestValidator.equals(
        "wrong-production refusal also precedes provider execution",
        providerExecutions,
        0,
      );
      const missingRegistry = scenarioServices(runnable, {
        project: { generatedManifest: () => null },
      });
      const throwingRegistry = scenarioServices(runnable, {
        project: {
          generatedManifest: () => {
            throw nonError("non-error registry failure");
          },
        },
      });
      const noProduction = scenarioServices(runnable, {
        project: {
          graph: () => ({ ...validGraph, production: null }),
        },
      });
      const noShotContract = scenarioServices(runnable, {
        project: {
          graph: () => ({ ...validGraph, shots: new Map() }),
        },
      });
      const missingRenderRoot = scenarioServices(runnable, {
        project: { renderRoot: () => path.join(root, "absent-render-root") },
      });
      const missingSourceManifest = scenarioServices(runnable, {
        project: { verifiedRenderManifest: () => null },
      });
      const invalidSourceEvidence = [
        new Error("invalid render evidence"),
        "non-error invalid render evidence",
      ].map((thrown) =>
        scenarioServices(runnable, {
          project: {
            verifiedRenderManifest: () => {
              throw thrown instanceof Error ? thrown : nonError(thrown);
            },
          },
        }),
      );
      const linkedRoot = fs.mkdtempSync(
        path.join(os.tmpdir(), "automovie-repaint-linked-render-"),
      );
      externalRoots.push(linkedRoot);
      fs.symlinkSync(
        path.join(root, "bundle"),
        path.join(linkedRoot, "linked-bundle"),
        "junction",
      );
      const linkedSourceEvidence = scenarioServices(runnable, {
        project: { renderRoot: () => linkedRoot },
      });
      const missingReferenceManifest = scenarioServices(runnable, {
        project: { manifest: () => ({}) },
      });
      const nullReferenceManifest = scenarioServices(runnable, {
        project: {
          contentInputs: () => [{ path: "automovie/assets.json", bytes: null }],
        },
      });
      const referenceManifestBytes = validInputs.find(
        (entry) => entry.path === "automovie/assets.json",
      )?.bytes;
      if (
        referenceManifestBytes === null ||
        referenceManifestBytes === undefined
      )
        throw new Error("Executable repaint fixture lost its asset manifest.");
      const invalidReferenceJson = scenarioServices(runnable, {
        project: {
          contentInputs: () => [
            { path: "automovie/assets.json", bytes: Buffer.from("{") },
          ],
        },
      });
      const malformedReferenceManifest = scenarioServices(runnable, {
        project: {
          contentInputs: () => [
            { path: "automovie/assets.json", bytes: Buffer.from("{}") },
          ],
        },
      });
      const absentReferenceBytes = scenarioServices(runnable, {
        project: {
          contentInputs: () => [
            { path: "automovie/assets.json", bytes: referenceManifestBytes },
          ],
        },
      });
      const nullReferenceBytes = scenarioServices(runnable, {
        project: {
          contentInputs: () => [
            { path: "automovie/assets.json", bytes: referenceManifestBytes },
            { path: input.references[0]!.path, bytes: null },
          ],
        },
      });
      const preAdapterFailures = await Promise.all([
        repaint(missingRegistry),
        repaint(throwingRegistry),
        repaint(
          servicesWithRegistry({
            ...validRegistry,
            shots: [],
          }),
        ),
        repaint(noProduction),
        repaint(noShotContract),
        repaint(missingRenderRoot),
        repaint(missingSourceManifest),
        ...invalidSourceEvidence.map((current) => repaint(current)),
        repaint(linkedSourceEvidence),
        repaint(missingReferenceManifest),
        repaint(nullReferenceManifest),
        repaint(invalidReferenceJson),
        repaint(malformedReferenceManifest),
        repaint(absentReferenceBytes),
        repaint(nullReferenceBytes),
        repaint(runnable, {
          request: {
            ...input,
            references: [
              input.references[0]!,
              structuredClone(input.references[0]!),
            ],
          },
        }),
        repaint(runnable, {
          request: {
            ...input,
            references: [{ role: "style", path: "assets/absent.png" }],
          },
        }),
        repaint(runnable, {
          request: {
            ...input,
            references: referenceRoles.map((role) => ({
              role,
              path: input.references[0]!.path,
            })),
          },
        }),
        repaint(digestAliasServices),
      ]);
      TestValidator.equals(
        "registry, target, source, and reference preflights refuse specifically",
        preAdapterFailures.map(codeOf),
        [
          "repaint-registry-unavailable",
          "repaint-registry-unavailable",
          "repaint-target-missing",
          "repaint-target-missing",
          "repaint-target-missing",
          "repaint-source-evidence-missing",
          "repaint-source-evidence-invalid",
          "repaint-source-evidence-invalid",
          "repaint-source-evidence-invalid",
          "repaint-source-evidence-invalid",
          "repaint-reference-manifest-missing",
          "repaint-reference-manifest-missing",
          "repaint-reference-manifest-invalid",
          "repaint-reference-manifest-invalid",
          "repaint-reference-invalid",
          "repaint-reference-invalid",
          "repaint-reference-invalid",
          "repaint-reference-invalid",
          "repaint-reference-invalid",
          "repaint-reference-invalid",
        ],
      );
      TestValidator.equals(
        "all preflight failures precede provider execution",
        providerExecutions,
        0,
      );
      const credentialReferenceFailures = await Promise.all(
        credentialReferenceServices.map(({ services }) => repaint(services)),
      );
      TestValidator.equals(
        "credential-bearing source and license URLs refuse before provider execution",
        {
          codes: credentialReferenceFailures.map(codeOf),
          providerExecutions,
          leaked: credentialReferenceFailures.some((result) =>
            credentialReferenceServices.some(({ secret }) =>
              result.diagnostics.some((entry) =>
                entry.message.includes(secret),
              ),
            ),
          ),
        },
        {
          codes: [
            "repaint-reference-manifest-invalid",
            "repaint-reference-manifest-invalid",
          ],
          providerExecutions: 0,
          leaked: false,
        },
      );
      const served = await new AutoMovieProductionRepaintService(
        actualAdapter(selected.runtimeIdentity),
        selected,
      ).serve(
        {
          forProduction: () =>
            scenarioServices(runnable, {
              project: {
                graph: () => ({
                  ...validGraph,
                  production: {
                    ...validGraph.production,
                    visualDelivery: "repainted",
                  },
                }),
                commitRepaintRendition: () => 1,
              },
            }),
        } as unknown as AutoMovieProductionContext,
        input,
      );
      TestValidator.equals(
        "public repaint entry delegates one admitted delivery",
        served.repainted,
        true,
      );
      const adapterFailures = await Promise.all(
        [new Error("adapter failed"), "non-error adapter failure"].map(
          (thrown) =>
            repaint(runnable, {
              adapter: async () => {
                throw thrown instanceof Error ? thrown : nonError(thrown);
              },
            }),
        ),
      );
      TestValidator.equals(
        "adapter failures retain one specific refusal across thrown values",
        adapterFailures.map(codeOf),
        ["repaint-failed", "repaint-failed"],
      );
      const partialAttempts: IAutoMovieRepaintAttemptRecord[] = [];
      const partialPublications: Array<{
        receipt: { disposition: string; path: string };
        bytes: Uint8Array;
      }> = [];
      const partial = await repaint(
        scenarioServices(runnable, {
          project: {
            commitRepaintAttempt: (attempt: IAutoMovieRepaintAttemptRecord) => {
              partialAttempts.push(structuredClone(attempt));
              return 1;
            },
            commitRepaintRawOutput: (publication: {
              receipt: { disposition: string; path: string };
              bytes: Uint8Array;
            }) => {
              partialPublications.push(structuredClone(publication));
              return 1;
            },
          },
        }),
        {
          adapter: async () => {
            throw new AutoMovieRepaintAttemptError(
              "transport",
              "provider disclosed a partial output",
              2,
              null,
              { bytes: generatedBytes, mediaType: "video/mp4" },
            );
          },
        },
      );
      TestValidator.equals(
        "adapter-disclosed partial bytes are quarantined before terminal journaling",
        {
          code: codeOf(partial),
          disposition: partialPublications[0]?.receipt.disposition,
          bytes: partialPublications[0]?.bytes.length,
          journalBytes: partialAttempts[0]?.availableOutput?.bytes,
          journalReceiptMatches:
            partialAttempts[0]?.availableOutput?.receipt ===
            `renditions/raw/${partialAttempts[0]?.requestId}/${partialAttempts[0]?.attemptId}/receipt.json`,
        },
        {
          code: "repaint-failed",
          disposition: "partial",
          bytes: generatedBytes.length,
          journalBytes: generatedBytes.length,
          journalReceiptMatches: true,
        },
      );
      const currentCompile = runnable.compileStatus();
      if (currentCompile.success === false)
        throw new Error("Executable repaint fixture compile became stale.");
      const changingCompile = (
        next: () => ReturnType<IAutoMovieProductionServices["compileStatus"]>,
      ): IAutoMovieProductionServices => {
        let calls = 0;
        return scenarioServices(runnable, {
          services: {
            compileStatus: () => (++calls === 1 ? currentCompile : next()),
          },
        });
      };
      const changedRegistry: IAutoMovieProductionRegistryManifest = {
        ...validRegistry,
        compiler: "changed-during-repaint",
      };
      const changedRegistryBytes = Buffer.from(
        JSON.stringify(changedRegistry),
        "utf8",
      );
      let registryReads = 0;
      let currentRegistryBytes = Buffer.from(JSON.stringify(validRegistry));
      const changedRegistryServices = scenarioServices(runnable, {
        project: {
          generatedManifest: () => {
            currentRegistryBytes =
              ++registryReads === 1
                ? Buffer.from(JSON.stringify(validRegistry))
                : changedRegistryBytes;
            return {
              ...validGenerated,
              files: [
                {
                  path: "manifests/compile.json",
                  digest: digestAutoMovieBytes(currentRegistryBytes),
                },
              ],
            };
          },
          readGeneratedFile: () => currentRegistryBytes,
        },
      });
      let manifestReads = 0;
      const vanishedManifest = scenarioServices(runnable, {
        project: {
          verifiedRenderManifest: () =>
            ++manifestReads <= 2 ? validManifest : null,
        },
      });
      let changedManifestReads = 0;
      const changedManifest = structuredClone(validManifest);
      changedManifest.frames[0] = {
        ...changedManifest.frames[0]!,
        digest: digestAutoMovieBytes(Buffer.from("changed-frame")),
      };
      const changedSource = scenarioServices(runnable, {
        project: {
          verifiedRenderManifest: () =>
            ++changedManifestReads <= 2 ? validManifest : changedManifest,
        },
      });
      let missingReferenceReads = 0;
      const vanishedReferences = scenarioServices(runnable, {
        project: {
          contentInputs: () =>
            ++missingReferenceReads === 1 ? validInputs : [],
        },
      });
      const changedReferenceBytes = Buffer.from("changed-style-reference");
      const changedReferenceDigest = digestAutoMovieBytes(
        changedReferenceBytes,
      );
      const changedAssetManifest = JSON.parse(
        Buffer.from(referenceManifestBytes).toString("utf8"),
      ) as IAutoMovieAssetManifest;
      changedAssetManifest.assets[0] = {
        ...changedAssetManifest.assets[0]!,
        digest: changedReferenceDigest,
      };
      const changedAssetManifestBytes = Buffer.from(
        JSON.stringify(changedAssetManifest),
      );
      let referenceReads = 0;
      const changedReferences = scenarioServices(runnable, {
        project: {
          contentInputs: () =>
            ++referenceReads === 1
              ? validInputs
              : validInputs.map((entry) =>
                  entry.path === "automovie/assets.json"
                    ? { ...entry, bytes: changedAssetManifestBytes }
                    : entry.path === input.references[0]!.path
                      ? { ...entry, bytes: changedReferenceBytes }
                      : entry,
                ),
        },
      });
      const racedInputs = await Promise.all([
        repaint(changingCompile(() => ({ ...currentCompile, success: false }))),
        repaint(
          changingCompile(() => ({
            ...currentCompile,
            compiler: {
              ...currentCompile.compiler,
              inputFingerprint: digestAutoMovieBytes(Buffer.from("changed")),
            },
          })),
        ),
        repaint(
          changingCompile(() => {
            throw new Error("compile status failed during repaint");
          }),
        ),
        repaint(changedRegistryServices),
        repaint(vanishedManifest),
        repaint(changedSource),
        repaint(vanishedReferences),
        repaint(changedReferences),
      ]);
      TestValidator.equals(
        "every current-input race is refused after provider execution",
        racedInputs.map(codeOf),
        Array.from(
          { length: racedInputs.length },
          () => "repaint-input-changed",
        ),
      );
      const equalBundle = path.join(root, "bundle-equal");
      const richBundle = path.join(root, "bundle-rich");
      fs.mkdirSync(equalBundle, { recursive: true });
      fs.mkdirSync(richBundle, { recursive: true });
      fs.writeFileSync(path.join(equalBundle, "manifest.json"), "{}\n");
      fs.writeFileSync(path.join(richBundle, "manifest.json"), "{}\n");
      const richManifest = structuredClone(validManifest);
      richManifest.frames.push(
        ...Array.from({ length: 4 }, (_, index) => ({
          ...validManifest.frames.find(
            (frame) => frame.index === index && frame.pass === "depth",
          )!,
          pass: "normal" as const,
          path: `normal-${index}.png`,
          digest: digestAutoMovieBytes(Buffer.from(`normal-${index}`)),
        })),
      );
      let bundleFailure: IRepaintAdoptionFailure | undefined;
      try {
        const sortedSource = await repaint(
          scenarioServices(runnable, {
            project: {
              verifiedRenderManifest: (manifestPath: string) =>
                manifestPath.includes("bundle-rich")
                  ? richManifest
                  : validManifest,
              commitRepaintRendition: () => 1,
            },
          }),
        );
        TestValidator.equals(
          "source discovery deterministically sorts unequal and equal candidates",
          sortedSource.repainted,
          true,
        );
      } catch (error) {
        bundleFailure = { error };
        throw error;
      } finally {
        preserveRepaintAdoptionCleanup(
          bundleFailure,
          [
            () => fs.rmSync(equalBundle, { force: true, recursive: true }),
            () => fs.rmSync(richBundle, { force: true, recursive: true }),
          ],
          "Source-selection bundle roots",
        );
      }
      const mismatch = await new AutoMovieProductionRepaintService(
        actualAdapter({
          ...selected.runtimeIdentity,
          provider: "unreviewed-provider",
        }),
        selected,
      ).repaint(runnable, input);
      TestValidator.equals(
        "actual adapter identity cannot differ from reviewed generator selection",
        { code: codeOf(mismatch), commits: committed.length },
        { code: "repaint-output-invalid", commits: 0 },
      );
      const wrongRasterBytes = await productionH264Mp4({
        width: 8,
        height: 16,
        fps: 24,
        frameCount: 4,
      });
      const outputFailures = await Promise.all([
        repaint(runnable, {
          adapter: async () => ({
            mediaType: "image/png" as never,
            bytes: generatedBytes,
            runtimeIdentity: selected.runtimeIdentity,
          }),
        }),
        repaint(runnable, {
          adapter: async () => ({
            mediaType: "video/mp4",
            bytes: new Uint8Array(),
            runtimeIdentity: selected.runtimeIdentity,
          }),
        }),
        repaint(runnable, {
          adapter: async () => ({
            mediaType: "video/mp4",
            bytes: Buffer.from("not-an-mp4"),
            runtimeIdentity: selected.runtimeIdentity,
          }),
        }),
        repaint(runnable, {
          adapter: async () => ({
            mediaType: "video/mp4",
            bytes: generatedBytes,
            runtimeIdentity: {
              ...selected.runtimeIdentity,
              model: " padded ",
            },
          }),
        }),
        repaint(runnable, {
          adapter: async () => ({
            mediaType: "video/mp4",
            bytes: wrongRasterBytes,
            runtimeIdentity: selected.runtimeIdentity,
          }),
        }),
        repaint(runnable, {
          adapter: async () =>
            ({
              get mediaType(): never {
                throw nonError("non-error output inspection failure");
              },
              bytes: generatedBytes,
              runtimeIdentity: selected.runtimeIdentity,
            }) as never,
        }),
        repaint(runnable, {
          adapter: async () =>
            ({
              mediaType: "video/mp4",
              get bytes(): never {
                throw nonError("non-error bytes inspection failure");
              },
              runtimeIdentity: selected.runtimeIdentity,
            }) as never,
        }),
        repaint(runnable, {
          adapter: async () =>
            ({
              mediaType: "video/mp4",
              bytes: generatedBytes,
              get costUnits(): never {
                throw nonError("non-error cost inspection failure");
              },
              runtimeIdentity: selected.runtimeIdentity,
            }) as never,
        }),
        repaint(runnable, {
          adapter: async () => ({
            mediaType: "video/mp4",
            bytes: generatedBytes,
            costUnits: Number.POSITIVE_INFINITY,
            runtimeIdentity: selected.runtimeIdentity,
          }),
        }),
        repaint(runnable, {
          adapter: async () => ({
            mediaType: "video/mp4",
            bytes: generatedBytes,
            costUnits: -1,
            runtimeIdentity: selected.runtimeIdentity,
          }),
        }),
        repaint(runnable, {
          adapter: async () =>
            ({
              mediaType: "video/mp4",
              bytes: "not-bytes",
              runtimeIdentity: selected.runtimeIdentity,
            }) as never,
        }),
      ]);
      TestValidator.equals(
        "media, bytes, runtime, raster, and thrown output failures are refused",
        outputFailures.map(codeOf),
        Array.from(
          { length: outputFailures.length },
          () => "repaint-output-invalid",
        ),
      );

      const mutableOutputRoot = path.join(root, "mutable-output");
      const mutableCommits: Array<{
        receipt: IAutoMovieRepaintReceipt;
        bytes: Uint8Array;
      }> = [];
      const mutableOutputServices = executableServices({
        root: mutableOutputRoot,
        commit: (receipt, bytes) => {
          mutableCommits.push({
            receipt,
            bytes: new Uint8Array(bytes),
          });
        },
      });
      const providerOwnedBytes = new Uint8Array(generatedBytes);
      const mutableOutput = await repaint(mutableOutputServices, {
        adapter: async () =>
          ({
            mediaType: "video/mp4",
            get bytes(): Uint8Array {
              queueMicrotask(() => providerOwnedBytes.fill(0));
              return providerOwnedBytes;
            },
            runtimeIdentity: selected.runtimeIdentity,
          }) as never,
      });
      await Promise.resolve();
      const committedMutable = mutableCommits[0] ?? null;
      TestValidator.equals(
        "provider mutation after output disclosure cannot change committed bytes",
        {
          repainted: mutableOutput.repainted,
          providerMutated: providerOwnedBytes.every((byte) => byte === 0),
          committedDigest:
            committedMutable === null
              ? null
              : digestAutoMovieBytes(committedMutable.bytes),
          receiptDigest: committedMutable?.receipt.output.digest ?? null,
        },
        {
          repainted: true,
          providerMutated: true,
          committedDigest: digestAutoMovieBytes(generatedBytes),
          receiptDigest: digestAutoMovieBytes(generatedBytes),
        },
      );

      const accepted = await new AutoMovieProductionRepaintService(
        actualAdapter(selected.runtimeIdentity),
        selected,
      ).repaint(runnable, input);
      TestValidator.equals(
        "accepted runtime persists the exact reviewed generator and authority",
        {
          repainted: accepted.repainted,
          commits: committed.length,
          adapterIdentity: accepted.receipt?.adapterIdentity,
          generatorProvenance: accepted.receipt?.generatorProvenance,
          structuralAuthority: accepted.receipt?.structuralAuthority,
          referenceRoles: accepted.receipt?.references.map(
            (reference) => reference.role,
          ),
          referencePaths: accepted.receipt?.references.map(
            (reference) => reference.path,
          ),
          receiptVersion: accepted.receipt?.version,
        },
        {
          repainted: true,
          commits: 1,
          adapterIdentity: canonicalAutoMovieRepaintRuntimeIdentity(
            selected.runtimeIdentity,
          ),
          generatorProvenance: selected.generatorProvenance,
          structuralAuthority: "deterministic-source-only",
          referenceRoles: [...referenceRoles],
          referencePaths: input.references.map((reference) => reference.path),
          receiptVersion: 4,
        },
      );
      if (accepted.receipt === null)
        throw new Error("Accepted repaint result lost its receipt.");

      const selection = {
        productionId: input.productionId,
        shot: input.shot,
        attemptId: accepted.receipt.attemptId,
        kind: "selection" as const,
        reason: "The reviewed candidate preserves the authored structure.",
        structuralReview: "The deterministic silhouette remains exact.",
        continuityReview: null,
      };
      const selectionContext = (
        selectRepaintCandidate: (
          candidate: unknown,
        ) => IAutoMovieRepaintReceipt,
      ): AutoMovieProductionContext =>
        ({
          forProduction: () =>
            scenarioServices(runnable, {
              project: { selectRepaintCandidate },
            }),
        }) as unknown as AutoMovieProductionContext;
      const selectedCandidate = new AutoMovieProductionRepaintService(
        undefined,
        undefined,
        {
          policy: executionPolicy(),
          evidence: executionEvidence(),
          now: () => new Date("2026-08-28T12:00:00.000Z"),
        },
      ).select(
        selectionContext(() => accepted.receipt!),
        selection,
      );
      const selectedWithoutRequest =
        new AutoMovieProductionRepaintService().select(
          selectionContext(() => ({
            ...accepted.receipt!,
            requestId: undefined,
          })),
          selection,
        );
      const refusedSelections = [
        new Error("selection commit failed"),
        nonError("non-error selection commit failed"),
      ].map((thrown) =>
        new AutoMovieProductionRepaintService().select(
          selectionContext(() => {
            throw thrown;
          }),
          selection,
        ),
      );
      TestValidator.equals(
        "selection entry returns reviewed receipts and contains commit refusals",
        {
          selected: selectedCandidate.selected,
          attemptId: selectedCandidate.receipt?.attemptId,
          absentRequestId: selectedWithoutRequest.requestId,
          refused: refusedSelections.map(codeOf),
        },
        {
          selected: true,
          attemptId: accepted.receipt.attemptId,
          absentRequestId: null,
          refused: ["repaint-commit-refused", "repaint-commit-refused"],
        },
      );

      const unavailableCapture = await new AutoMovieProductionRepaintService(
        actualAdapter(selected.runtimeIdentity),
        selected,
      ).repaint(
        scenarioServices(runnable, {
          services: {
            oracle: {
              preview: () =>
                Promise.resolve({
                  captured: false,
                  compileFingerprint: null,
                  renderBundle: null,
                  frame: null,
                  diagnostics: [
                    {
                      code: "repaint-source-evidence-missing",
                      severity: "error",
                      scope: "render",
                      path: input.shot,
                      message: "capture unavailable",
                    },
                  ],
                }),
            },
          },
        }),
        input,
      );
      const invalidEvidence = await new AutoMovieProductionRepaintService(
        actualAdapter(selected.runtimeIdentity),
        selected,
        {
          policy: executionPolicy(),
          evidence: { ...executionEvidence(), prompt: " padded " },
        },
      ).repaint(runnable, input);
      const throwingEvidence = executionEvidence();
      Object.defineProperty(throwingEvidence, "prompt", {
        enumerable: true,
        get: () => {
          throw nonError("non-error evidence failure");
        },
      });
      const thrownEvidence = await new AutoMovieProductionRepaintService(
        actualAdapter(selected.runtimeIdentity),
        selected,
        { policy: executionPolicy(), evidence: throwingEvidence },
      ).repaint(runnable, input);
      let nonErrorExecutionStartReads = 0;
      let nonErrorBoundaryProviderCalls = 0;
      const nonErrorExecutionStart =
        await new AutoMovieProductionRepaintService(
          async (props) => {
            ++nonErrorBoundaryProviderCalls;
            return actualAdapter(selected.runtimeIdentity)(props);
          },
          selected,
          {
            policy: executionPolicy(),
            evidence: executionEvidence(),
            now: () => {
              if (nonErrorExecutionStartReads++ < 2)
                return new Date("2026-08-28T12:00:00.000Z");
              throw nonError("execution start unavailable");
            },
          },
        ).repaint(runnable, input);
      let invalidExecutionStartReads = 0;
      const invalidExecutionStart = await new AutoMovieProductionRepaintService(
        async (props) => {
          ++nonErrorBoundaryProviderCalls;
          return actualAdapter(selected.runtimeIdentity)(props);
        },
        selected,
        {
          policy: executionPolicy(),
          evidence: executionEvidence(),
          now: () =>
            invalidExecutionStartReads++ < 2
              ? new Date("2026-08-28T12:00:00.000Z")
              : new Date(Number.NaN),
        },
      ).repaint(runnable, input);
      const nonErrorSignal = {
        get aborted(): never {
          throw nonError("signal state unavailable");
        },
      } as unknown as AbortSignal;
      const nonErrorExecutorBoundary =
        await new AutoMovieProductionRepaintService(
          async (props) => {
            ++nonErrorBoundaryProviderCalls;
            return actualAdapter(selected.runtimeIdentity)(props);
          },
          selected,
          {
            policy: executionPolicy(),
            evidence: executionEvidence(),
            signal: nonErrorSignal,
            now: () => new Date("2026-08-28T12:00:00.000Z"),
          },
        ).repaint(runnable, input);
      TestValidator.equals(
        "capture, evidence, and non-Error runtime boundary failures remain pre-provider refusals",
        {
          codes: [
            codeOf(unavailableCapture),
            codeOf(invalidEvidence),
            codeOf(thrownEvidence),
            codeOf(nonErrorExecutionStart),
            codeOf(invalidExecutionStart),
            codeOf(nonErrorExecutorBoundary),
          ],
          providerCalls: nonErrorBoundaryProviderCalls,
        },
        {
          codes: [
            "repaint-source-evidence-missing",
            "repaint-host-unavailable",
            "repaint-host-unavailable",
            "repaint-failed",
            "repaint-failed",
            "repaint-failed",
          ],
          providerCalls: 0,
        },
      );

      let claimRefusedProviderCalls = 0;
      const claimRefusals = await Promise.all(
        (
          [
            { status: "already-active", ownerAttemptId: "owner-attempt" },
            { status: "unknown-outcome", ownerAttemptId: "owner-attempt" },
            { status: "prefix-changed" },
          ] as const
        ).map((admission) =>
          new AutoMovieProductionRepaintService(
            async (props) => {
              ++claimRefusedProviderCalls;
              return actualAdapter(selected.runtimeIdentity)(props);
            },
            selected,
            { policy: executionPolicy(), evidence: executionEvidence() },
          ).repaint(
            scenarioServices(runnable, {
              project: { acquireRepaintAttemptClaim: () => admission },
            }),
            input,
          ),
        ),
      );
      const claimRefusalMessages = claimRefusals.map(
        (result) => result.diagnostics[0]?.message ?? "",
      );
      TestValidator.equals(
        "a refused dispatch claim names its cause, its owner, and the author's next step",
        {
          codes: claimRefusals.map(codeOf),
          receipts: claimRefusals.map((result) => result.receipt),
          explained: [
            claimRefusalMessages[0]!.includes(
              'unsettled dispatch claim for attempt "owner-attempt"',
            ) && claimRefusalMessages[0]!.includes("author a new request"),
            claimRefusalMessages[1]!.includes(
              'attempt "owner-attempt" ended with an unknown provider outcome',
            ) && claimRefusalMessages[1]!.includes("new request identity"),
            claimRefusalMessages[2]!.includes(
              "changed between planning and dispatch",
            ) &&
              claimRefusalMessages[2]!.includes("Run the same repaint again"),
          ],
          noProviderCall: claimRefusalMessages.every((message) =>
            message.includes("no provider call was made"),
          ),
          providerCalls: claimRefusedProviderCalls,
        },
        {
          codes: [
            "repaint-claim-refused",
            "repaint-claim-refused",
            "repaint-claim-refused",
          ],
          receipts: [null, null, null],
          explained: [true, true, true],
          noProviderCall: true,
          providerCalls: 0,
        },
      );

      const explicitRequestId = "30000000-0000-4000-8000-000000000001";
      const explicitExecution = {
        policy: executionPolicy(),
        evidence: executionEvidence(),
        requestId: explicitRequestId,
        now: () => new Date("2026-08-28T12:01:00.000Z"),
      };
      const retryLookupFailures = await Promise.all([
        new AutoMovieProductionRepaintService(
          actualAdapter(selected.runtimeIdentity),
          selected,
          explicitExecution,
        ).repaint(
          scenarioServices(runnable, {
            project: {
              repaintRequestAttempts: () => {
                throw new Error("retry history unreadable");
              },
            },
          }),
          input,
        ),
        new AutoMovieProductionRepaintService(
          actualAdapter(selected.runtimeIdentity),
          selected,
          explicitExecution,
        ).repaint(
          scenarioServices(runnable, {
            project: {
              repaintRequestAttempts: () => {
                throw nonError("retry history unreadable");
              },
            },
          }),
          input,
        ),
        new AutoMovieProductionRepaintService(
          actualAdapter(selected.runtimeIdentity),
          selected,
          explicitExecution,
        ).repaint(
          scenarioServices(runnable, {
            project: { repaintRequestAttempts: () => [] },
          }),
          input,
        ),
        new AutoMovieProductionRepaintService(
          actualAdapter(selected.runtimeIdentity),
          selected,
          explicitExecution,
        ).repaint(
          scenarioServices(runnable, {
            project: {
              repaintRequestAttempts: () => [
                {
                  requestFingerprint: digestAutoMovieBytes(
                    Buffer.from("foreign request"),
                  ),
                },
              ],
            },
          }),
          input,
        ),
      ]);
      TestValidator.equals(
        "explicit retry rejects unreadable, absent, and foreign histories",
        retryLookupFailures.map(codeOf),
        [
          "repaint-input-invalid",
          "repaint-input-invalid",
          "repaint-input-invalid",
          "repaint-input-invalid",
        ],
      );

      const exhaustedAttempts: IAutoMovieRepaintAttemptRecord[] = [];
      const oneAttemptPolicy = executionPolicy({
        maximumAttempts: 1,
        backoffMs: [],
      });
      const firstAttempt = await new AutoMovieProductionRepaintService(
        actualAdapter(selected.runtimeIdentity),
        selected,
        {
          policy: oneAttemptPolicy,
          evidence: executionEvidence(),
          now: () => new Date("2026-08-28T12:02:00.000Z"),
        },
      ).repaint(
        scenarioServices(runnable, {
          project: {
            commitRepaintAttempt: (attempt: IAutoMovieRepaintAttemptRecord) => {
              exhaustedAttempts.push(attempt);
              return 1;
            },
            commitRepaintRendition: () => 1,
          },
        }),
        input,
      );
      const exhaustedHistory: IAutoMovieRepaintAttemptRecord[] = [
        {
          ...exhaustedAttempts[0]!,
          status: "failed",
          failure: {
            class: "rate-limit",
            message: "the only permitted attempt requested another retry",
            retryable: true,
          },
          availableOutput: null,
        },
      ];
      const exhaustedRetry = await new AutoMovieProductionRepaintService(
        actualAdapter(selected.runtimeIdentity),
        selected,
        {
          policy: oneAttemptPolicy,
          evidence: executionEvidence(),
          requestId: exhaustedAttempts[0]!.requestId,
          now: () => new Date("2026-08-28T12:02:01.000Z"),
        },
      ).repaint(
        scenarioServices(runnable, {
          project: { repaintRequestAttempts: () => exhaustedHistory },
        }),
        input,
      );
      TestValidator.equals(
        "persisted attempts close an exhausted explicit retry before provider use",
        {
          first: firstAttempt.repainted,
          attempts: exhaustedAttempts.length,
          retry: codeOf(exhaustedRetry),
        },
        { first: true, attempts: 1, retry: "repaint-failed" },
      );

      const retryLegalityAttempts: IAutoMovieRepaintAttemptRecord[] = [];
      const retryLegalityPolicy = executionPolicy();
      await new AutoMovieProductionRepaintService(
        actualAdapter(selected.runtimeIdentity),
        selected,
        {
          policy: retryLegalityPolicy,
          evidence: executionEvidence(),
          now: () => new Date("2026-08-28T12:03:00.000Z"),
        },
      ).repaint(
        scenarioServices(runnable, {
          project: {
            commitRepaintAttempt: (attempt: IAutoMovieRepaintAttemptRecord) => {
              retryLegalityAttempts.push(attempt);
              return 1;
            },
            commitRepaintRendition: () => 1,
          },
        }),
        input,
      );
      const priorSucceeded = retryLegalityAttempts[0]!;
      const priorNonretryable: IAutoMovieRepaintAttemptRecord = {
        ...priorSucceeded,
        status: "failed",
        failure: {
          class: "provider-refusal",
          message: "provider refused without retry permission",
          retryable: false,
        },
        availableOutput: null,
      };
      const priorRetryable: IAutoMovieRepaintAttemptRecord = {
        ...priorSucceeded,
        status: "failed",
        failure: {
          class: "rate-limit",
          message: "provider requested a retry",
          retryable: true,
        },
        availableOutput: null,
      };
      const priorForgedRetryable: IAutoMovieRepaintAttemptRecord = {
        ...priorNonretryable,
        failure: {
          class: "provider-refusal",
          message: "forged retryable bit outside the policy allowlist",
          retryable: true,
        },
      };
      let retryLegalityProviderCalls = 0;
      const explicitRetry = (
        history: IAutoMovieRepaintAttemptRecord[],
        now: () => Date = () => new Date("2026-08-28T12:03:01.000Z"),
      ): Promise<IAutoMovieRepaintShot> =>
        new AutoMovieProductionRepaintService(
          async (props) => {
            ++retryLegalityProviderCalls;
            return actualAdapter(selected.runtimeIdentity)(props);
          },
          selected,
          {
            policy: retryLegalityPolicy,
            evidence: executionEvidence(),
            requestId: priorSucceeded.requestId,
            now,
          },
        ).repaint(
          scenarioServices(runnable, {
            project: {
              repaintRequestAttempts: () => history,
              commitRepaintRendition: () => 1,
            },
          }),
          input,
        );
      const succeededRetry = await explicitRetry([priorSucceeded]);
      const nonretryableRetry = await explicitRetry([priorNonretryable]);
      const forgedRetry = await explicitRetry([priorForgedRetryable]);
      const earlyRetry = await explicitRetry(
        [priorRetryable],
        () => new Date(priorRetryable.completedAt),
      );
      const backwardClockRetry = await explicitRetry(
        [priorRetryable],
        () => new Date("2026-08-28T12:02:59.999Z"),
      );
      let rollbackAfterPreflightReads = 0;
      const rollbackAfterPreflightRetry = await explicitRetry(
        [priorRetryable],
        () =>
          new Date(
            rollbackAfterPreflightReads++ === 0
              ? "2026-08-28T12:03:01.000Z"
              : "2026-08-28T12:02:59.999Z",
          ),
      );
      let exhaustedDuringPreflightReads = 0;
      const exhaustedDuringPreflightRetry = await explicitRetry(
        [priorRetryable],
        () =>
          new Date(
            exhaustedDuringPreflightReads++ === 0
              ? "2026-08-28T12:03:01.000Z"
              : "2026-08-28T12:03:10.000Z",
          ),
      );
      let invalidResumeReads = 0;
      const invalidResumeRetry = await explicitRetry([priorRetryable], () =>
        invalidResumeReads++ === 0
          ? new Date("2026-08-28T12:03:01.000Z")
          : new Date(Number.NaN),
      );
      let thrownResumeReads = 0;
      const thrownResumeRetry = await explicitRetry([priorRetryable], () => {
        if (thrownResumeReads++ === 0)
          return new Date("2026-08-28T12:03:01.000Z");
        throw nonError("resume clock unavailable");
      });
      let executionRollbackReads = 0;
      const executionRollbackRetry = await explicitRetry(
        [priorRetryable],
        () =>
          new Date(
            [
              "2026-08-28T12:03:01.000Z",
              "2026-08-28T12:03:02.000Z",
              "2026-08-28T12:03:01.999Z",
            ][Math.min(executionRollbackReads++, 2)]!,
          ),
      );
      let thrownExecutionReads = 0;
      const thrownExecutionRetry = await explicitRetry([priorRetryable], () => {
        if (thrownExecutionReads++ < 2)
          return new Date("2026-08-28T12:03:01.000Z");
        throw nonError("execution clock unavailable");
      });
      let postStartRollbackReads = 0;
      const postStartRollbackRetry = await explicitRetry(
        [priorRetryable],
        () =>
          new Date(
            [
              "2026-08-28T12:03:01.000Z",
              "2026-08-28T12:03:02.000Z",
              "2026-08-28T12:03:03.000Z",
              "2026-08-28T12:03:02.999Z",
            ][Math.min(postStartRollbackReads++, 3)]!,
          ),
      );
      let exhaustedAtExecutionStartReads = 0;
      const exhaustedAtExecutionStartRetry = await explicitRetry(
        [priorRetryable],
        () =>
          new Date(
            [
              "2026-08-28T12:03:01.000Z",
              "2026-08-28T12:03:02.000Z",
              "2026-08-28T12:03:10.000Z",
            ][Math.min(exhaustedAtExecutionStartReads++, 2)]!,
          ),
      );
      const retryableRetry = await explicitRetry([priorRetryable]);
      TestValidator.equals(
        "explicit retry is legal only after the last retryable failed attempt",
        {
          succeeded: codeOf(succeededRetry),
          nonretryable: codeOf(nonretryableRetry),
          forged: codeOf(forgedRetry),
          early: codeOf(earlyRetry),
          backwardClock: codeOf(backwardClockRetry),
          rollbackAfterPreflight: codeOf(rollbackAfterPreflightRetry),
          exhaustedDuringPreflight: codeOf(exhaustedDuringPreflightRetry),
          invalidResume: codeOf(invalidResumeRetry),
          thrownResume: codeOf(thrownResumeRetry),
          executionRollback: codeOf(executionRollbackRetry),
          thrownExecution: codeOf(thrownExecutionRetry),
          postStartRollback: codeOf(postStartRollbackRetry),
          exhaustedAtExecutionStart: codeOf(exhaustedAtExecutionStartRetry),
          retryable: retryableRetry.repainted,
          providerCalls: retryLegalityProviderCalls,
        },
        {
          succeeded: "repaint-input-invalid",
          nonretryable: "repaint-input-invalid",
          forged: "repaint-input-invalid",
          early: "repaint-failed",
          backwardClock: "repaint-input-invalid",
          rollbackAfterPreflight: "repaint-input-invalid",
          exhaustedDuringPreflight: "repaint-failed",
          invalidResume: "repaint-host-unavailable",
          thrownResume: "repaint-host-unavailable",
          executionRollback: "repaint-failed",
          thrownExecution: "repaint-failed",
          postStartRollback: "repaint-failed",
          exhaustedAtExecutionStart: "repaint-failed",
          retryable: true,
          providerCalls: 1,
        },
      );

      const attemptCommitFailures = await Promise.all(
        [
          new Error("attempt commit failed"),
          nonError("attempt commit failed"),
        ].map((thrown) =>
          new AutoMovieProductionRepaintService(
            actualAdapter(selected.runtimeIdentity),
            selected,
          ).repaint(
            scenarioServices(runnable, {
              project: {
                commitRepaintAttempt: () => {
                  throw thrown;
                },
              },
            }),
            input,
          ),
        ),
      );
      TestValidator.equals(
        "attempt-journal failures refuse publication",
        attemptCommitFailures.map(codeOf),
        ["repaint-commit-refused", "repaint-commit-refused"],
      );

      const retryingAdapter = (
        beforeFailure?: () => void,
      ): AutoMovieProductionShotRepaint => {
        let calls = 0;
        const succeeding = actualAdapter(selected.runtimeIdentity);
        return async (props) => {
          if (++calls === 1) {
            beforeFailure?.();
            throw { status: 429, message: "retry" };
          }
          return succeeding(props);
        };
      };
      const liveSignal = new AbortController();
      const normalBackoff = await new AutoMovieProductionRepaintService(
        retryingAdapter(),
        selected,
        {
          policy: executionPolicy({ backoffMs: [0] }),
          evidence: executionEvidence(),
          signal: liveSignal.signal,
        },
      ).repaint(runnable, input);
      const waitingAbort = new AbortController();
      const cancelledBackoff = await new AutoMovieProductionRepaintService(
        retryingAdapter(() => {
          setTimeout(() => waitingAbort.abort("cancelled"), 1);
        }),
        selected,
        {
          policy: executionPolicy({ backoffMs: [25] }),
          evidence: executionEvidence(),
          signal: waitingAbort.signal,
        },
      ).repaint(runnable, input);
      const preWaitAbort = new AbortController();
      const alreadyCancelledBackoff =
        await new AutoMovieProductionRepaintService(
          async () => {
            throw {
              get status(): number {
                preWaitAbort.abort("cancelled");
                return 429;
              },
              message: "retry",
            };
          },
          selected,
          {
            policy: executionPolicy(),
            evidence: executionEvidence(),
            signal: preWaitAbort.signal,
          },
        ).repaint(runnable, input);
      let backoffRegistrationAborted = false;
      let backoffRegistrationAdds = 0;
      let backoffRegistrationRemoves = 0;
      let backoffRegistrationProviderCalls = 0;
      const backoffRegistrationSignal = {
        get aborted(): boolean {
          return backoffRegistrationAborted;
        },
        reason: "cancelled while registering backoff",
        addEventListener: (
          _type: string,
          listener: EventListenerOrEventListenerObject,
        ): void => {
          if (++backoffRegistrationAdds !== 2) return;
          backoffRegistrationAborted = true;
          if (typeof listener === "function") listener(new Event("abort"));
          else listener.handleEvent(new Event("abort"));
        },
        removeEventListener: (): void => {
          ++backoffRegistrationRemoves;
        },
      } as unknown as AbortSignal;
      const registrationRaceBackoff =
        await new AutoMovieProductionRepaintService(
          async () => {
            ++backoffRegistrationProviderCalls;
            throw { status: 429, message: "retry" };
          },
          selected,
          {
            policy: executionPolicy({ backoffMs: [1_000] }),
            evidence: executionEvidence(),
            signal: backoffRegistrationSignal,
          },
        ).repaint(runnable, input);
      TestValidator.equals(
        "service backoff resolves normally and contains both cancellation times",
        {
          normal: normalBackoff.repainted,
          waiting: codeOf(cancelledBackoff),
          already: codeOf(alreadyCancelledBackoff),
          registrationRace: {
            code: codeOf(registrationRaceBackoff),
            adds: backoffRegistrationAdds,
            removes: backoffRegistrationRemoves,
            providerCalls: backoffRegistrationProviderCalls,
          },
        },
        {
          normal: true,
          waiting: "repaint-failed",
          already: "repaint-failed",
          registrationRace: {
            code: "repaint-failed",
            adds: 2,
            removes: 2,
            providerCalls: 1,
          },
        },
      );

      const blankInputRace = new AutoMovieProductionInputRaceError(
        "placeholder input race",
      );
      blankInputRace.message = "";
      const hostileInputRace = new Proxy(
        new AutoMovieProductionInputRaceError("hostile input race"),
        {
          get: (target, property, receiver) => {
            if (property === "message")
              throw nonError("input race diagnostic getter failed");
            return Reflect.get(target, property, receiver);
          },
        },
      );
      const hostileInstanceCheck = new Proxy(
        {},
        {
          getPrototypeOf: () => {
            throw nonError("input race instance check failed");
          },
          get: () => {
            throw nonError("commit diagnostic coercion failed");
          },
        },
      );
      const commitFailures = await Promise.all([
        repaint(
          scenarioServices(runnable, {
            project: {
              commitRepaintRendition: () => {
                throw new AutoMovieProductionInputRaceError(
                  "input changed at commit",
                );
              },
            },
          }),
        ),
        repaint(
          scenarioServices(runnable, {
            project: {
              commitRepaintRendition: () => {
                throw new Error("commit failed");
              },
            },
          }),
        ),
        repaint(
          scenarioServices(runnable, {
            project: {
              commitRepaintRendition: () => {
                throw nonError("non-error commit failure");
              },
            },
          }),
        ),
        ...[blankInputRace, hostileInputRace, hostileInstanceCheck].map(
          (thrown) =>
            repaint(
              scenarioServices(runnable, {
                project: {
                  commitRepaintRendition: () => {
                    throw thrown;
                  },
                },
              }),
            ),
        ),
      ]);
      TestValidator.equals(
        "commit races and other commit failures retain distinct diagnostics",
        commitFailures.map(codeOf),
        [
          "repaint-input-changed",
          "repaint-commit-refused",
          "repaint-commit-refused",
          "repaint-input-changed",
          "repaint-input-changed",
          "repaint-commit-refused",
        ],
      );
      const hostileAttemptError = new Proxy(
        new Error("attempt commit failed"),
        {
          get: (target, property, receiver) => {
            if (property === "message")
              throw nonError("attempt diagnostic getter failed");
            return Reflect.get(target, property, receiver);
          },
        },
      );
      const hostileAttemptCommit = await repaint(
        scenarioServices(runnable, {
          project: {
            commitRepaintAttempt: () => {
              throw hostileAttemptError;
            },
          },
        }),
      );
      TestValidator.equals(
        "hostile attempt persistence diagnostics fail closed",
        codeOf(hostileAttemptCommit),
        "repaint-commit-refused",
      );
      const commitThroughProject = (
        receipt: IAutoMovieRepaintReceipt,
      ): number =>
        AutoMovieProductionProject.prototype.commitRepaintRendition.call(
          runnable.project,
          receipt,
          generatedBytes,
        );
      TestValidator.equals(
        "project revalidation accepts the exact current v4 receipt and terminal attempt identity",
        commitThroughProject(accepted.receipt),
        1,
      );
      TestValidator.predicate(
        "stored receipt revalidation refuses credential-bearing source and license manifests",
        credentialReferenceServices.every(({ services }) => {
          try {
            AutoMovieProductionProject.prototype.commitRepaintRendition.call(
              services.project,
              accepted.receipt!,
              generatedBytes,
            );
            return false;
          } catch (error) {
            return (
              error instanceof Error &&
              error.message.includes("inadmissible source or license URL") &&
              credentialReferenceServices.every(
                ({ secret }) => error.message.includes(secret) === false,
              )
            );
          }
        }),
      );
      const projectRefuses = (receipt: IAutoMovieRepaintReceipt): boolean => {
        try {
          commitThroughProject(receipt);
          return false;
        } catch {
          return true;
        }
      };
      const invalidProjectReceipts: IAutoMovieRepaintReceipt[] = [
        {
          ...accepted.receipt,
          version: 2,
        } as unknown as IAutoMovieRepaintReceipt,
        {
          ...accepted.receipt,
          generatorProvenance: {
            ...accepted.receipt.generatorProvenance,
            termsCheckedAt: "2026-08-29",
          },
        },
        {
          ...accepted.receipt,
          generatorProvenance: {
            ...accepted.receipt.generatorProvenance,
            source: "https://user:secret@models.example/repaint",
          },
        },
        {
          ...accepted.receipt,
          generatorProvenance: {
            ...accepted.receipt.generatorProvenance,
            license: "https://[invalid",
          },
        },
        {
          ...accepted.receipt,
          parameters: {
            ...accepted.receipt.parameters,
            prompt: ` ${accepted.receipt.parameters.prompt}`,
          },
        },
        ...["", " padded "].map(
          (negativePrompt): IAutoMovieRepaintReceipt => ({
            ...accepted.receipt!,
            parameters: {
              ...accepted.receipt!.parameters,
              negativePrompt,
            },
          }),
        ),
        ...(
          [
            { "": true },
            { " padded ": true },
            { scheduler: "" },
            { scheduler: " padded " },
            { guidance: Number.POSITIVE_INFINITY },
          ] as Array<Record<string, string | number | boolean>>
        ).map(
          (controls): IAutoMovieRepaintReceipt => ({
            ...accepted.receipt!,
            parameters: { ...accepted.receipt!.parameters, controls },
          }),
        ),
        {
          ...accepted.receipt,
          references: referenceRoles.map((role) => ({
            role,
            path: accepted.receipt!.references[0]!.path,
            digest: accepted.receipt!.references[0]!.digest,
          })),
        },
      ];
      TestValidator.predicate(
        "project revalidation rejects schema, provenance, prompt, and control drift",
        invalidProjectReceipts.every(projectRefuses),
      );
      const aliasedReferenceDigest = digestAutoMovieBytes(
        Buffer.from("one-image-under-many-paths", "utf8"),
      );
      TestValidator.predicate(
        "service and stored-receipt validation identify one image by digest across aliased paths",
        (() => {
          try {
            AutoMovieProductionProject.prototype.commitRepaintRendition.call(
              digestAliasServices.project,
              {
                ...accepted.receipt,
                references: input.references.map((reference) => ({
                  ...reference,
                  digest: aliasedReferenceDigest,
                })),
              },
              generatedBytes,
            );
            return false;
          } catch (error) {
            return (
              error instanceof Error &&
              error.message.includes(
                "One repaint reference image cannot stand as canonical guidance for every role.",
              )
            );
          }
        })(),
      );

      const snapshotCommits: IAutoMovieRepaintReceipt[] = [];
      const snapshotServices = executableServices({
        root,
        commit: (receipt) => snapshotCommits.push(receipt),
      });
      let releaseAdapter!: () => void;
      const adapterGate = new Promise<null>((resolve) => {
        releaseAdapter = () => resolve(null);
      });
      const snapshotAdapter: AutoMovieProductionShotRepaint = async (props) => {
        props.parameters.prompt = "adapter mutation";
        props.references[0]!.path = "assets/adapter-mutation.png";
        props.source.manifest.frames = [];
        await adapterGate;
        return {
          mediaType: "video/mp4",
          bytes: generatedBytes,
          runtimeIdentity: selected.runtimeIdentity,
        };
      };
      const mutableInput = structuredClone(input);
      const mutablePolicy = executionPolicy();
      const mutableEvidence = executionEvidence();
      const expectedPolicy = structuredClone(mutablePolicy);
      const expectedEvidence = structuredClone(mutableEvidence);
      const pending = new AutoMovieProductionRepaintService(
        snapshotAdapter,
        selected,
        { policy: mutablePolicy, evidence: mutableEvidence },
      ).repaint(snapshotServices, mutableInput);
      mutableInput.shot = "caller-mutated-shot";
      mutableInput.parameters.prompt = "caller mutation during generation";
      mutableInput.references[0]!.path = "assets/caller-mutation.png";
      mutablePolicy.maximumAttempts = 1;
      mutablePolicy.maximumCostUnits = 0;
      mutablePolicy.backoffMs.length = 0;
      mutableEvidence.prompt = "caller-mutated-evidence";
      releaseAdapter();
      const snapshotted = await pending;
      TestValidator.equals(
        "provider execution and receipt share one immutable request snapshot",
        {
          repainted: snapshotted.repainted,
          shot: snapshotted.receipt?.shot,
          prompt: snapshotted.receipt?.parameters.prompt,
          reference: snapshotted.receipt?.references[0]?.path,
          policy: snapshotted.receipt?.executionPolicy,
          evidence: snapshotted.receipt?.evidence,
          commits: snapshotCommits.length,
        },
        {
          repainted: true,
          shot: input.shot,
          prompt: input.parameters.prompt,
          reference: input.references[0]!.path,
          policy: expectedPolicy,
          evidence: expectedEvidence,
          commits: 1,
        },
      );
    } catch (error) {
      rootFailure = { error };
      throw error;
    } finally {
      preserveRepaintAdoptionCleanup(
        rootFailure,
        [
          ...externalRoots.map(
            (external) => () =>
              fs.rmSync(external, { force: true, recursive: true }),
          ),
          () => fs.rmSync(root, { force: true, recursive: true }),
        ],
        "Repaint-adoption roots",
      );
    }
  };
