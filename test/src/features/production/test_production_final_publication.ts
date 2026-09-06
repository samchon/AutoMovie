import type {
  AutoMovieContentDigest,
  IAutoMovieProductionRenderManifest,
} from "@automovie/interface";
import {
  AutoMovieProductionInputRaceError,
  digestAutoMovieBytes,
  productionRenderPublicationIdentity,
} from "@automovie/production";
import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import path from "node:path";

import {
  createTestFileSystem,
  withTestFileSystem,
} from "../internal/testFileSystem";
import { capturedPng } from "./captureHost";
import { finalPublicationFixture } from "./finalPublicationFixtures";

const platformError = (code: string): Error =>
  Object.assign(new Error(code), { code });

const digest = (digit: string): AutoMovieContentDigest =>
  `sha256:${digit.repeat(64)}`;

/**
 * A complete parser-valid terminal publication commits through the project
 * store and passes the final-scope compiler gate; every incomplete or
 * inconsistent publication is refused before any byte is written.
 *
 * Scenarios:
 *
 * 1. Without a publication the final gate reports the missing manifest; after
 *    the publication every deliverable kind passes the gate, and republishing
 *    identical bytes reuses the immutable payload.
 * 2. The commit refuses a manifest outside its schema, a foreign publication
 *    identity, a compile fingerprint that differs from the identity or the
 *    current compile, stale inputs, duplicate byte sources, files claimed
 *    twice, missing or drifted claimed files, semantic sidecars without a
 *    receipt, a receipt bound to a non-sidecar or tampered, a receipt whose
 *    runtime coverage is incomplete, a non-portable byte source path,
 *    unclaimed bytes, and a different payload generation at an immutable path.
 * 3. The guarded commit refuses a publication whose payload changes while the
 *    ledger is written or during the final compiler gate, inputs or a render
 *    plan that move during that gate, an immutable target another writer
 *    occupies between the resident check and the link, and a link failure,
 *    each without leaving a partial ledger behind.
 */
export const test_production_final_publication = async (): Promise<void> => {
  const fixture = await finalPublicationFixture();
  try {
    const before = fixture.finalRenderDiagnostics();
    const revision = fixture.publish();
    const after = fixture.finalRenderDiagnostics();
    const republished = fixture.publish();
    TestValidator.equals(
      "a complete terminal publication passes the final compiler gate",
      {
        before: before.map((diagnostic) => diagnostic.code),
        after,
        deliverables: fixture.manifest.deliverables.map(
          (deliverable) => `${deliverable.kind}:${deliverable.files.length}`,
        ),
        republished: republished > revision,
      },
      {
        before: ["render-deliverable-missing"],
        after: [],
        deliverables: [
          "preview:1",
          "feature:1",
          `guide-pass:${fixture.plan.totalFrames + 1}`,
          "captions:1",
          "audio-mix:4",
          `guide-pass:${fixture.plan.totalFrames * 2 + 1}`,
        ],
        republished: true,
      },
    );

    const refusal = (
      override: Parameters<typeof fixture.publish>[0],
    ): { message: string; race: boolean } | null => {
      try {
        fixture.publish(override);
        return null;
      } catch (error) {
        return {
          message: (error as Error).message,
          race: error instanceof AutoMovieProductionInputRaceError,
        };
      }
    };
    const manifest = (
      mutate: (copy: IAutoMovieProductionRenderManifest) => void,
    ): IAutoMovieProductionRenderManifest => {
      const copy = structuredClone(fixture.manifest);
      mutate(copy);
      return copy;
    };
    const files = (
      mutate: (copy: Map<string, Uint8Array>) => void,
    ): Map<string, Uint8Array> => {
      const copy = new Map(fixture.files);
      mutate(copy);
      return copy;
    };
    const previewFile = fixture.manifest.deliverables[0]!.files[0]!;
    const poseGuide = fixture.manifest.deliverables[2]!;
    const maskGuide = fixture.manifest.deliverables[5]!;
    const sidecar = maskGuide.files.find(
      (file) => file.semanticMask !== undefined,
    )!;
    const foreignPlan = { ...fixture.plan, compileFingerprint: digest("9") };
    // A different valid picture at the same raster: another payload generation.
    const otherPicture = capturedPng(
      fixture.plan.frameFormat.width,
      fixture.plan.frameFormat.height,
    );
    const refusals = {
      schema: refusal({
        manifest: { ...fixture.manifest, extra: true } as never,
      }),
      foreignIdentity: refusal({
        manifest: manifest((copy) => {
          copy.publication = { ...copy.publication, fingerprint: digest("f") };
        }),
      }),
      foreignPlanIdentity: refusal({
        manifest: manifest((copy) => {
          copy.publication = productionRenderPublicationIdentity({
            ...fixture.plan,
            runtimeIdentity: {
              ...fixture.plan.runtimeIdentity,
              sourceDigest: digest("e"),
            },
          });
        }),
      }),
      identityFingerprint: refusal({
        manifest: manifest((copy) => {
          copy.compileFingerprint = digest("9");
        }),
      }),
      staleInputs: refusal({ inputCurrent: () => false }),
      foreignCompile: refusal({
        plan: foreignPlan,
        manifest: manifest((copy) => {
          copy.compileFingerprint = digest("9");
          copy.publication = productionRenderPublicationIdentity(foreignPlan);
        }),
      }),
      duplicateSource: refusal({
        files: files((copy) => {
          copy.set(previewFile.path.toUpperCase(), fixture.media.picture);
        }),
      }),
      claimedTwice: refusal({
        manifest: manifest((copy) => {
          copy.deliverables[0]!.files.push({ ...previewFile });
        }),
      }),
      missingClaimed: refusal({
        files: files((copy) => {
          copy.delete(previewFile.path);
        }),
      }),
      driftedBytes: refusal({
        manifest: manifest((copy) => {
          copy.deliverables[0]!.files[0]!.bytes += 1;
        }),
      }),
      sidecarWithoutReceipt: refusal({
        manifest: manifest((copy) => {
          const file = copy.deliverables[5]!.files.find(
            (candidate) => candidate.path === sidecar.path,
          )!;
          delete file.semanticMask;
        }),
      }),
      receiptOnPicture: refusal({
        manifest: manifest((copy) => {
          copy.deliverables[2]!.files.find((candidate) =>
            candidate.path.endsWith(".png"),
          )!.semanticMask = sidecar.semanticMask;
        }),
      }),
      tamperedReceipt: refusal({
        manifest: manifest((copy) => {
          const file = copy.deliverables[5]!.files.find(
            (candidate) => candidate.path === sidecar.path,
          )!;
          file.semanticMask = {
            ...file.semanticMask!,
            sidecar: { ...file.semanticMask!.sidecar, digest: digest("d") },
          };
        }),
      }),
      incompleteCoverage: refusal({
        manifest: manifest((copy) => {
          const file = copy.deliverables[5]!.files.find(
            (candidate) => candidate.path === sidecar.path,
          )!;
          file.semanticMask = {
            ...file.semanticMask!,
            coverage: { unresolved: [], unaddressed: 1 },
          };
        }),
      }),
      nonPortablePath: refusal({
        files: files((copy) => {
          copy.set("deliverables/../final/stray.bin", Buffer.from("stray"));
        }),
      }),
      unclaimedBytes: refusal({
        files: files((copy) => {
          copy.set("deliverables/final/stray.bin", Buffer.from("stray"));
        }),
      }),
      otherGeneration: refusal({
        files: files((copy) => {
          copy.set(previewFile.path, otherPicture);
        }),
        manifest: manifest((copy) => {
          copy.deliverables[0]!.files[0]!.digest =
            digestAutoMovieBytes(otherPicture);
          copy.deliverables[0]!.files[0]!.bytes = otherPicture.length;
        }),
      }),
    };
    const expectedFragments: Record<keyof typeof refusals, [string, boolean]> =
      {
        schema: ["Invalid aggregate render manifest", false],
        foreignIdentity: [
          "does not match its canonical structured basis",
          false,
        ],
        foreignPlanIdentity: [
          "does not match the current final render plan",
          false,
        ],
        identityFingerprint: [
          "compile fingerprint differs from its publication identity",
          false,
        ],
        staleInputs: ["changed before terminal publication began", true],
        foreignCompile: ["does not target the current compiler input", true],
        duplicateSource: ["maps more than one byte source", false],
        claimedTwice: ["is claimed more than once", false],
        missingClaimed: ["is missing claimed file", false],
        driftedBytes: ["differs from its manifest byte facts", false],
        sidecarWithoutReceipt: ["has no semantic receipt", false],
        receiptOnPicture: [
          "describes bytes that are not a semantic-mask sidecar",
          false,
        ],
        tamperedReceipt: ["semantic sidecar", false],
        incompleteCoverage: [
          "a delivered mask product requires complete runtime coverage",
          false,
        ],
        nonPortablePath: ["not one canonical portable relative path", false],
        unclaimedBytes: ["Remove unclaimed bytes", false],
        otherGeneration: ["already contains another payload generation", true],
      };
    TestValidator.equals(
      "every incomplete or inconsistent publication is refused before writing",
      Object.fromEntries(
        Object.entries(refusals).map(([name, outcome]) => [
          name,
          outcome === null
            ? null
            : {
                named: outcome.message.includes(
                  expectedFragments[name as keyof typeof refusals][0],
                ),
                race: outcome.race,
              },
        ]),
      ),
      Object.fromEntries(
        Object.entries(expectedFragments).map(([name, [, race]]) => [
          name,
          { named: true, race },
        ]),
      ),
    );

    // 3. Races the guarded commit itself has to catch: the payload, the
    //    inputs, and the immutable targets are all re-observed after the
    //    ledger lands, and an occupied or unlinkable immutable target is
    //    refused without a partial ledger.
    const renderFile = (relative: string): string =>
      path.join(fixture.project.renderRoot(), ...relative.split("/"));
    const previewTarget = renderFile(previewFile.path);
    const previewBytes = fs.readFileSync(previewTarget);
    const raceWith = (
      fileSystem: ReturnType<typeof createTestFileSystem>["fileSystem"],
      override: Parameters<typeof fixture.publish>[0],
    ): { message: string; race: boolean } | null => {
      try {
        return withTestFileSystem(fileSystem, () => refusal(override));
      } finally {
        fs.writeFileSync(previewTarget, previewBytes);
      }
    };
    let ledgerReceiptWritten = false;
    const payloadAfterLedger = createTestFileSystem({
      renameSync: ((...args: unknown[]) => {
        const result = Reflect.apply(fs.renameSync, fs, args);
        if (
          ledgerReceiptWritten === false &&
          String(args[1]).endsWith(`${path.sep}render-manifest-receipt.json`)
        ) {
          ledgerReceiptWritten = true;
          fs.writeFileSync(previewTarget, Buffer.from("payload replaced"));
        }
        return result;
      }) as typeof fs.renameSync,
    });
    let inputChecks = 0;
    let planChecks = 0;
    const relocatedPreview = previewFile.path.replace(
      /preview\.png$/u,
      "preview-relocated.png",
    );
    const relocated = (): Parameters<typeof fixture.publish>[0] => ({
      files: files((copy) => {
        copy.delete(previewFile.path);
        copy.set(relocatedPreview, fixture.media.picture);
      }),
      manifest: manifest((copy) => {
        copy.deliverables[0]!.files[0]!.path = relocatedPreview;
      }),
    });
    const relocatedTarget = renderFile(relocatedPreview);
    const occupiedTarget = createTestFileSystem({
      linkSync: ((...args: unknown[]) => {
        if (String(args[1]) === relocatedTarget)
          fs.writeFileSync(relocatedTarget, Buffer.from("occupied"));
        return Reflect.apply(fs.linkSync, fs, args);
      }) as typeof fs.linkSync,
    });
    const unlinkableTarget = createTestFileSystem({
      linkSync: ((...args: unknown[]) => {
        if (String(args[1]) === relocatedTarget) throw platformError("EIO");
        return Reflect.apply(fs.linkSync, fs, args);
      }) as typeof fs.linkSync,
    });
    const races = {
      payloadAfterLedger: raceWith(payloadAfterLedger.fileSystem, {}),
      payloadDuringGate: raceWith(createTestFileSystem().fileSystem, {
        publicationCurrent: () => {
          fs.writeFileSync(previewTarget, Buffer.from("gate replaced"));
        },
      }),
      inputsDuringGate: refusal({ inputCurrent: () => ++inputChecks !== 4 }),
      planDuringGate: refusal({ planCurrent: () => ++planChecks !== 4 }),
      occupiedTarget: (() => {
        try {
          return raceWith(occupiedTarget.fileSystem, relocated());
        } finally {
          fs.rmSync(relocatedTarget, { force: true });
        }
      })(),
      unlinkableTarget: raceWith(unlinkableTarget.fileSystem, relocated()),
    };
    TestValidator.equals(
      "the guarded commit re-observes payload, inputs, and immutable targets",
      {
        ...Object.fromEntries(
          Object.entries(races).map(([name, outcome]) => [
            name,
            outcome === null
              ? null
              : {
                  message: outcome.message.split(/\.(?=\s|$)/u)[0],
                  race: outcome.race,
                },
          ]),
        ),
        relocatedResidue: fs.existsSync(relocatedTarget),
        checks: { inputChecks, planChecks },
      },
      {
        payloadAfterLedger: {
          message: `Committed terminal file "${previewFile.path}" failed its post-publication byte check`,
          race: true,
        },
        payloadDuringGate: {
          message: `Committed terminal file "${previewFile.path}" changed during the final compiler gate`,
          race: true,
        },
        inputsDuringGate: {
          message:
            "Production inputs or the render-plan generation changed during the staged terminal publication final gate",
          race: true,
        },
        planDuringGate: {
          message:
            "Production inputs or the render-plan generation changed during the staged terminal publication final gate",
          race: true,
        },
        occupiedTarget: {
          message: `Immutable publication target "${relocatedTarget}" already exists`,
          race: true,
        },
        unlinkableTarget: { message: "EIO", race: false },
        relocatedResidue: false,
        checks: { inputChecks: 4, planChecks: 4 },
      },
    );
    TestValidator.equals(
      "refusals leave the committed publication current",
      {
        diagnostics: fixture.finalRenderDiagnostics(),
        poseFrames: poseGuide.files.length,
      },
      { diagnostics: [], poseFrames: fixture.plan.totalFrames + 1 },
    );
  } finally {
    fixture.dispose();
  }
};
