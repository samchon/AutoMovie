import type {
  AutoMovieProductionShotRepaint,
  IAutoMovieAssetManifest,
  IAutoMovieProductionRegistryManifest,
  IAutoMovieRenderBundleManifest,
  IAutoMovieRepaintGeneratorAdoption,
  IAutoMovieRepaintReceipt,
  IAutoMovieRepaintShot,
} from "@automovie/interface";
import {
  AutoMovieProductionProject,
  AutoMovieProductionRepaintService,
  type IAutoMovieProductionServices,
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

const input: IAutoMovieRepaintShot.IProps = {
  productionId: "repaint-adoption-test",
  shot: "opening",
  parameters: {
    prompt: "reviewed prompt",
    seed: 17,
    strength: 0.35,
  },
  references: [{ role: "style", path: "assets/style.png" }],
};

const services = (): IAutoMovieProductionServices =>
  ({
    project: { productionId: input.productionId },
    compileStatus: () => ({ success: false }),
  }) as unknown as IAutoMovieProductionServices;

const codeOf = (result: IAutoMovieRepaintShot): string | undefined =>
  result.diagnostics[0]?.code;

const executableServices = (props: {
  root: string;
  commit: (receipt: IAutoMovieRepaintReceipt) => void;
}): IAutoMovieProductionServices => {
  const compileFingerprint = digestAutoMovieBytes(
    Buffer.from("repaint-compile", "utf8"),
  );
  const referenceBytes = Buffer.from("reviewed-style-reference", "utf8");
  const referenceDigest = digestAutoMovieBytes(referenceBytes);
  const assetManifest = completedFilmJson<IAutoMovieAssetManifest>(
    "automovie/assets.json",
  );
  assetManifest.assets[0] = {
    ...assetManifest.assets[0]!,
    path: input.references[0]!.path,
    digest: referenceDigest,
    uses: [
      {
        production: input.productionId,
        consumer: { kind: "rendition-reference", id: input.shot },
        reason:
          "This reviewed style reference constrains the opening rendition.",
      },
    ],
  };
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
    version: 3,
    target: { kind: "shot", id: input.shot },
    compileFingerprint,
    rendererIdentity: testRendererIdentity(),
    targetFingerprint: digestAutoMovieBytes(
      Buffer.from("opening-target", "utf8"),
    ),
    renderSpec: { frameFormat },
    frames,
  } as IAutoMovieRenderBundleManifest;
  const bundle = path.join(props.root, "bundle");
  fs.mkdirSync(bundle, { recursive: true });
  fs.writeFileSync(path.join(bundle, "manifest.json"), "{}\n", "utf8");
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
      { path: input.references[0]!.path, bytes: referenceBytes },
    ],
    commitRepaintRendition: (receipt: IAutoMovieRepaintReceipt) =>
      props.commit(receipt),
    commitFiles: () => 1,
  };
  Object.setPrototypeOf(project, AutoMovieProductionProject.prototype);
  return {
    project,
    compileStatus: () => ({
      success: true,
      compiler: { inputFingerprint: compileFingerprint },
    }),
  } as unknown as IAutoMovieProductionServices;
};

/**
 * A repaint host is complete only when adapter and reviewed adoption coexist.
 *
 * Scenarios:
 *
 * 1. Missing either half refuses before any provider call.
 * 2. Malformed or credential-bearing adoption refuses before provider call.
 * 3. A valid adoption crosses this gate and reaches the next source preflight,
 *    proving validation is executable rather than receipt-only metadata.
 * 4. The adapter's actual identity must match the selected runtime; a matching
 *    execution commits receipt v3 with reviewed provenance and fixed authority.
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

    const root = fs.mkdtempSync(
      path.join(os.tmpdir(), "automovie-repaint-adoption-"),
    );
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
      const selected = adoption();
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
          parameters: { ...input.parameters, prompt: " padded " },
        },
        {
          ...input,
          parameters: { ...input.parameters, negativePrompt: "" },
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
            controls: new Date("2026-08-28T00:00:00.000Z"),
          },
        },
        {
          ...input,
          references: [
            { ...input.references[0]!, credential: "must-not-reach-provider" },
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
          receiptVersion: 3,
        },
      );
      if (accepted.receipt === null)
        throw new Error("Accepted repaint result lost its receipt.");
      const commitThroughProject = (
        receipt: IAutoMovieRepaintReceipt,
      ): number =>
        AutoMovieProductionProject.prototype.commitRepaintRendition.call(
          runnable.project,
          receipt,
          generatedBytes,
        );
      TestValidator.equals(
        "project revalidation accepts the exact current v3 receipt identity",
        commitThroughProject(accepted.receipt),
        1,
      );
      const projectRefuses = (receipt: IAutoMovieRepaintReceipt): boolean => {
        try {
          commitThroughProject(receipt);
          return false;
        } catch {
          return true;
        }
      };
      TestValidator.predicate(
        "project revalidation rejects provenance-path drift and padded prompts",
        projectRefuses({
          ...accepted.receipt,
          generatorProvenance: {
            ...accepted.receipt.generatorProvenance,
            termsCheckedAt: "2026-08-29",
          },
        }) &&
          projectRefuses({
            ...accepted.receipt,
            parameters: {
              ...accepted.receipt.parameters,
              prompt: ` ${accepted.receipt.parameters.prompt}`,
            },
          }),
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
      const pending = new AutoMovieProductionRepaintService(
        snapshotAdapter,
        selected,
      ).repaint(snapshotServices, mutableInput);
      mutableInput.shot = "caller-mutated-shot";
      mutableInput.parameters.prompt = "caller mutation during generation";
      mutableInput.references[0]!.path = "assets/caller-mutation.png";
      releaseAdapter();
      const snapshotted = await pending;
      TestValidator.equals(
        "provider execution and receipt share one immutable request snapshot",
        {
          repainted: snapshotted.repainted,
          shot: snapshotted.receipt?.shot,
          prompt: snapshotted.receipt?.parameters.prompt,
          reference: snapshotted.receipt?.references[0]?.path,
          commits: snapshotCommits.length,
        },
        {
          repainted: true,
          shot: input.shot,
          prompt: input.parameters.prompt,
          reference: input.references[0]!.path,
          commits: 1,
        },
      );
    } finally {
      fs.rmSync(root, { force: true, recursive: true });
    }
  };
