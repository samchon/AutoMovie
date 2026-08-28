import {
  IAutoMovieAcceptanceScenario,
  IAutoMovieGeneratedManifest,
  IAutoMovieProductionDesign,
  IAutoMovieProductionRenderManifest,
} from "@automovie/interface";
import {
  AutoMovieProductionCompiler,
  AutoMovieProductionInputRaceError,
  AutoMovieProductionProject,
  digestAutoMovieBytes,
} from "@automovie/production";
import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import path from "node:path";

import { throwsError } from "../internal/predicates";
import {
  productionCompileSucceeded,
  productionFixture,
} from "./productionFixtures";

interface IPublicationCleanupFailure {
  error: unknown;
}

class PublicationCleanupError extends AggregateError {}

const preservePublicationCleanup = (
  failure: IPublicationCleanupFailure | undefined,
  cleanup: () => void,
): void => {
  try {
    cleanup();
  } catch (cleanupFailure) {
    if (failure === undefined) throw cleanupFailure;
    throw new PublicationCleanupError(
      [failure.error, cleanupFailure],
      "Publication fixture cleanup failed after the behavioral failure.",
    );
  }
};

const captions = Buffer.from(
  "WEBVTT\n\n00:00.000 --> 00:00.250\nA deterministic cue.\n",
  "utf8",
);

const manifestOf = (
  compileFingerprint: `sha256:${string}`,
  filePath = "deliverables/captions/captions.vtt",
  bytes: Uint8Array = captions,
): IAutoMovieProductionRenderManifest => ({
  version: 1,
  compileFingerprint,
  deliverables: [
    {
      id: "captions",
      kind: "captions",
      files: [
        {
          path: filePath,
          digest: digestAutoMovieBytes(bytes),
          bytes: bytes.length,
          mediaType: "text/vtt",
        },
      ],
      runtimeSeconds: 0.25,
      frameCount: null,
      codec: null,
    },
  ],
});

/**
 * Exercise the final renderer-owned transaction with byte-derived oracles.
 * Every refusal is paired with the valid publication it protects, and every
 * guarded failure proves revision and resident bytes rolled back together.
 *
 * Scenarios:
 *
 * 1. Deliverable commits refuse empty/colliding paths and preserve sorted,
 *    owner-rooted byte identity on success.
 * 2. Aggregate manifests reject schema, duplicate ownership, stale bytes, and
 *    invalid media before atomically committing manifest plus receipt.
 * 3. Terminal publication rejects stale compile/revision, duplicate, missing,
 *    mismatched, invalid-media, and unclaimed inputs without state movement.
 * 4. Pre-write, post-write, ledger, and final guards roll back revision,
 *    manifest, receipt, and new terminal paths; the successful twin runs once.
 * 5. Generated no-op, stale-claim healing, pre-commit refusal, rollback
 *    obstruction, and final-verification corruption prove exact revision,
 *    manifest, inventory, byte, cleanup, and mutation-consequence behavior.
 */
export const test_production_project_runtime_shape_publication = (): void => {
  const fixture = productionFixture();
  let failure: IPublicationCleanupFailure | undefined;
  try {
    const project = AutoMovieProductionProject.open(
      fixture.root,
      "fixture-film",
    );
    const compiled = new AutoMovieProductionCompiler(project).compile({
      scope: "source",
    });
    if (productionCompileSucceeded("project publication", compiled) === false)
      throw new Error("Publication fixture compilation failed.");
    const generated = project.generatedManifest();
    if (generated === null)
      throw new Error("Compilation did not publish its generated manifest.");

    TestValidator.predicate(
      "empty deliverable file set refuses without a revision",
      throwsError(
        () => project.commitProductionDeliverableFiles("captions", new Map()),
        "has no files",
      ),
    );
    TestValidator.predicate(
      "case-colliding deliverable paths refuse before write",
      throwsError(
        () =>
          project.commitProductionDeliverableFiles(
            "captions",
            new Map([
              ["Captions.vtt", captions],
              ["captions.vtt", captions],
            ]),
          ),
        "more than one input",
      ),
    );
    const delivered = project.commitProductionDeliverableFiles(
      "captions",
      new Map([
        ["notes/second.vtt", captions],
        ["captions.vtt", captions],
      ]),
    );
    TestValidator.equals(
      "deliverable files are sorted and rooted under their encoded owner",
      delivered.paths,
      [
        "deliverables/captions/captions.vtt",
        "deliverables/captions/notes/second.vtt",
      ],
    );
    TestValidator.equals(
      "deliverable bytes round-trip through the render boundary",
      Buffer.from(project.readRenderFile(delivered.paths[0]!)).toString("utf8"),
      captions.toString("utf8"),
    );

    const manifest = manifestOf(generated.inputFingerprint);
    const revisionBeforeManifest = project.revision();
    TestValidator.predicate(
      "strict aggregate manifest shape refuses",
      throwsError(
        () =>
          project.commitProductionRenderManifest({
            ...manifest,
            version: 2,
          } as unknown as IAutoMovieProductionRenderManifest),
        "Invalid aggregate render manifest",
      ),
    );
    TestValidator.equals(
      "schema refusal does not advance the revision",
      project.revision(),
      revisionBeforeManifest,
    );
    const wrongFacts = manifestOf(
      generated.inputFingerprint,
      undefined,
      Buffer.from("other", "utf8"),
    );
    TestValidator.predicate(
      "resident render bytes must equal aggregate facts",
      throwsError(
        () => project.commitProductionRenderManifest(wrongFacts),
        "does not match",
      ),
    );
    const captionFile = path.join(
      project.renderRoot(),
      manifest.deliverables[0]!.files[0]!.path,
    );
    const invalidProbeBytes = Buffer.from("not WebVTT", "utf8");
    fs.writeFileSync(captionFile, invalidProbeBytes);
    TestValidator.predicate(
      "aggregate manifest refuses resident bytes that fail their declared media probe",
      throwsError(
        () =>
          project.commitProductionRenderManifest(
            manifestOf(
              generated.inputFingerprint,
              undefined,
              invalidProbeBytes,
            ),
          ),
        "failed media probing",
      ),
    );
    fs.writeFileSync(captionFile, captions);
    const duplicateClaim: IAutoMovieProductionRenderManifest = {
      ...manifest,
      deliverables: [
        manifest.deliverables[0]!,
        {
          ...manifest.deliverables[0]!,
          id: "captions-copy",
        },
      ],
    };
    TestValidator.predicate(
      "one render path cannot have two aggregate owners",
      throwsError(
        () => project.commitProductionRenderManifest(duplicateClaim),
        "claimed more than once",
      ),
    );
    const manifestRevision = project.commitProductionRenderManifest(manifest);
    TestValidator.equals(
      "aggregate manifest and parser-derived receipt commit together",
      [
        project.readTrackedStateFile("render-manifest.json") !== null,
        project.readTrackedStateFile("render-manifest-receipt.json") !== null,
        manifestRevision,
      ],
      [true, true, revisionBeforeManifest + 1],
    );

    const staleManifest = manifestOf(
      `sha256:${"f".repeat(64)}` as `sha256:${string}`,
    );
    TestValidator.predicate(
      "terminal publication independently enforces strict manifest shape",
      throwsError(
        () =>
          project.commitProductionPublication({
            files: new Map(),
            manifest: {
              ...manifest,
              version: 2,
            } as unknown as IAutoMovieProductionRenderManifest,
          }),
        "Invalid aggregate render manifest",
      ),
    );
    TestValidator.predicate(
      "terminal publication refuses a stale compiler fingerprint",
      (() => {
        try {
          project.commitProductionPublication({
            files: new Map([
              [manifest.deliverables[0]!.files[0]!.path, captions],
            ]),
            manifest: staleManifest,
          });
          return false;
        } catch (error) {
          return error instanceof AutoMovieProductionInputRaceError;
        }
      })(),
    );
    TestValidator.predicate(
      "terminal publication refuses duplicate canonical byte paths",
      throwsError(
        () =>
          project.commitProductionPublication({
            files: new Map([
              ["deliverables/captions/CAPTIONS.vtt", captions],
              ["deliverables/captions/captions.vtt", captions],
            ]),
            manifest,
          }),
        "more than one byte source",
      ),
    );
    TestValidator.predicate(
      "terminal publication independently refuses duplicate manifest ownership",
      throwsError(
        () =>
          project.commitProductionPublication({
            files: new Map([
              [manifest.deliverables[0]!.files[0]!.path, captions],
            ]),
            manifest: duplicateClaim,
          }),
        "claimed more than once",
      ),
    );
    TestValidator.predicate(
      "terminal publication refuses a missing claimed file",
      throwsError(
        () =>
          project.commitProductionPublication({ files: new Map(), manifest }),
        "missing claimed file",
      ),
    );
    TestValidator.predicate(
      "terminal publication refuses byte facts that disagree",
      throwsError(
        () =>
          project.commitProductionPublication({
            files: new Map([
              [manifest.deliverables[0]!.files[0]!.path, Buffer.from("wrong")],
            ]),
            manifest,
          }),
        "differs from its manifest byte facts",
      ),
    );
    const invalidCaptions = Buffer.from("not WebVTT", "utf8");
    const invalidMediaManifest = manifestOf(
      generated.inputFingerprint,
      undefined,
      invalidCaptions,
    );
    TestValidator.predicate(
      "terminal publication derives and refuses invalid media facts",
      throwsError(
        () =>
          project.commitProductionPublication({
            files: new Map([
              [
                invalidMediaManifest.deliverables[0]!.files[0]!.path,
                invalidCaptions,
              ],
            ]),
            manifest: invalidMediaManifest,
          }),
        "valid WebVTT header",
      ),
    );
    TestValidator.predicate(
      "terminal publication refuses unclaimed bytes",
      throwsError(
        () =>
          project.commitProductionPublication({
            files: new Map([
              [manifest.deliverables[0]!.files[0]!.path, captions],
              ["deliverables/captions/unclaimed.vtt", captions],
            ]),
            manifest,
          }),
        "unclaimed bytes",
      ),
    );

    const revisionBeforeGuard = project.revision();
    const manifestBytesBefore = Buffer.from(
      project.readTrackedStateFile("render-manifest.json")!,
    );
    TestValidator.predicate(
      "pre-write publication guard rejects current bytes becoming stale",
      (() => {
        try {
          project.commitProductionPublication({
            files: new Map([
              [manifest.deliverables[0]!.files[0]!.path, captions],
            ]),
            manifest,
            inputCurrent: () => false,
          });
          return false;
        } catch (error) {
          return error instanceof AutoMovieProductionInputRaceError;
        }
      })(),
    );
    TestValidator.predicate(
      "explicit stale expected revision refuses publication before write",
      (() => {
        try {
          project.commitProductionPublication({
            files: new Map([
              [manifest.deliverables[0]!.files[0]!.path, captions],
            ]),
            manifest,
            expectedRevision: revisionBeforeGuard - 1,
          });
          return false;
        } catch (error) {
          return error instanceof AutoMovieProductionInputRaceError;
        }
      })(),
    );
    TestValidator.equals(
      "pre-write guard refusal preserves revision and manifest bytes",
      [
        project.revision(),
        Buffer.from(project.readTrackedStateFile("render-manifest.json")!),
      ],
      [revisionBeforeGuard, manifestBytesBefore],
    );

    let postByteCheckCalls = 0;
    TestValidator.predicate(
      "post-publication byte check rejects a file changed after its staged write",
      throwsError(
        () =>
          project.commitProductionPublication({
            files: new Map([
              [manifest.deliverables[0]!.files[0]!.path, captions],
            ]),
            manifest,
            inputCurrent: () => {
              ++postByteCheckCalls;
              if (postByteCheckCalls === 2)
                fs.writeFileSync(captionFile, "changed after staged write");
              return true;
            },
          }),
        "failed its post-publication byte check",
      ),
    );
    TestValidator.equals(
      "post-publication byte refusal restores the prior file and revision",
      [postByteCheckCalls, project.revision(), fs.readFileSync(captionFile)],
      [2, revisionBeforeGuard, captions],
    );

    let postLedgerCheckCalls = 0;
    const residentManifestFile = project.trackedStatePath(
      "render-manifest.json",
    );
    TestValidator.predicate(
      "post-publication ledger check rejects a changed resident manifest",
      throwsError(
        () =>
          project.commitProductionPublication({
            files: new Map([
              [manifest.deliverables[0]!.files[0]!.path, captions],
            ]),
            manifest,
            inputCurrent: () => {
              ++postLedgerCheckCalls;
              if (postLedgerCheckCalls === 2)
                fs.writeFileSync(residentManifestFile, "changed ledger");
              return true;
            },
          }),
        "manifest or receipt changed",
      ),
    );
    TestValidator.equals(
      "post-publication ledger refusal restores manifest bytes and revision",
      [
        postLedgerCheckCalls,
        project.revision(),
        fs.readFileSync(residentManifestFile),
      ],
      [2, revisionBeforeGuard, manifestBytesBefore],
    );

    let finalGuardCalls = 0;
    const guardedPath = "deliverables/captions/guarded.vtt";
    const guardedManifest = manifestOf(generated.inputFingerprint, guardedPath);
    TestValidator.predicate(
      "final publication guard failure rolls staged files back",
      (() => {
        try {
          project.commitProductionPublication({
            files: new Map([[guardedPath, captions]]),
            manifest: guardedManifest,
            inputCurrent: () => ++finalGuardCalls < 3,
          });
          return false;
        } catch (error) {
          return error instanceof AutoMovieProductionInputRaceError;
        }
      })(),
    );
    TestValidator.equals(
      "final guard rollback removes the new terminal file and restores prior state",
      [
        finalGuardCalls,
        project.revision(),
        Buffer.from(project.readTrackedStateFile("render-manifest.json")!),
        fs.existsSync(path.join(project.renderRoot(), guardedPath)),
      ],
      [3, revisionBeforeGuard, manifestBytesBefore, false],
    );

    let publicationGateCalls = 0;
    const publicationRevision = project.commitProductionPublication({
      files: new Map([[manifest.deliverables[0]!.files[0]!.path, captions]]),
      manifest,
      inputCurrent: () => true,
      publicationCurrent: () => {
        ++publicationGateCalls;
      },
    });
    TestValidator.equals(
      "valid publication commits bytes, manifests, receipt, and final gate once",
      [
        publicationRevision,
        publicationGateCalls,
        Buffer.from(
          project.readRenderFile(manifest.deliverables[0]!.files[0]!.path),
        ).toString("utf8"),
        project.readTrackedStateFile("render-manifest-receipt.json") !== null,
      ],
      [revisionBeforeGuard + 1, 1, captions.toString("utf8"), true],
    );

    const residentFiles = new Map(
      generated.files.map((file) => [
        file.path,
        project.readGeneratedFile(file.path),
      ]),
    );
    const revisionBeforeGeneratedNoop = project.revision();
    const generatedNoopRevision = project.commitGenerated(
      residentFiles,
      generated,
    );
    TestValidator.equals(
      "unchanged generated publication returns and preserves the prior revision",
      [generatedNoopRevision, project.revision()],
      [revisionBeforeGeneratedNoop, revisionBeforeGeneratedNoop],
    );
    const missingGeneratedPath = "runtime-shape/missing-stale.ts";
    const staleGeneratedManifest: IAutoMovieGeneratedManifest = {
      ...generated,
      files: [
        ...generated.files,
        {
          path: missingGeneratedPath,
          owner: "compiler",
          digest: digestAutoMovieBytes(Buffer.from("stale generated claim")),
          sourceTargets: ["production:fixture-film"],
        },
      ],
    };
    fs.writeFileSync(
      project.trackedStatePath("generated-manifest.json"),
      `${JSON.stringify(staleGeneratedManifest, null, 2)}\n`,
    );
    const revisionBeforeStaleHealing = project.revision();
    const healedGeneratedRevision = project.commitGenerated(
      residentFiles,
      generated,
    );
    TestValidator.equals(
      "a missing stale generated claim is healed without inventing output bytes",
      [
        healedGeneratedRevision,
        project.revision(),
        project.generatedManifest(),
        fs.existsSync(path.join(project.generatedRoot(), missingGeneratedPath)),
      ],
      [
        revisionBeforeStaleHealing + 1,
        revisionBeforeStaleHealing + 1,
        generated,
        false,
      ],
    );
    const rollbackPath = "runtime-shape/rollback-directory.ts";
    const rollbackBytes = Buffer.from("export const rollback = true;\n");
    const rollbackFiles = new Map([
      ...residentFiles,
      [rollbackPath, rollbackBytes] as const,
    ]);
    const rollbackManifest: IAutoMovieGeneratedManifest = {
      ...generated,
      files: [
        ...generated.files,
        {
          path: rollbackPath,
          owner: "compiler",
          digest: digestAutoMovieBytes(rollbackBytes),
          sourceTargets: ["production:fixture-film"],
        },
      ],
    };
    const rollbackTarget = path.join(project.generatedRoot(), rollbackPath);
    const revisionBeforeRollbackObstruction = project.revision();
    let rollbackGuardCalls = 0;
    let rollbackScenarioFailure: IPublicationCleanupFailure | undefined;
    try {
      TestValidator.predicate(
        "generated rollback reports both the input race and a preserved directory replacement",
        (() => {
          try {
            project.commitGenerated(rollbackFiles, rollbackManifest, () => {
              ++rollbackGuardCalls;
              if (rollbackGuardCalls === 2) {
                fs.rmSync(rollbackTarget);
                fs.mkdirSync(rollbackTarget);
                return false;
              }
              return true;
            });
            return false;
          } catch (error) {
            return (
              error instanceof AggregateError &&
              error.errors.length === 2 &&
              error.errors[0] instanceof AutoMovieProductionInputRaceError &&
              error.errors[0].message.includes(
                "changed while the guarded commit was being applied",
              ) &&
              error.errors[1] instanceof Error &&
              error.message.includes("rollback was incomplete")
            );
          }
        })(),
      );
      TestValidator.equals(
        "rollback obstruction restores prior state and never removes the successor directory",
        [
          rollbackGuardCalls,
          project.revision(),
          project.generatedManifest(),
          fs.statSync(rollbackTarget).isDirectory(),
          ...[...residentFiles].map(([file, bytes]) =>
            Buffer.from(project.readGeneratedFile(file)).equals(
              Buffer.from(bytes),
            ),
          ),
        ],
        [
          2,
          revisionBeforeRollbackObstruction,
          generated,
          true,
          ...[...residentFiles].map(() => true),
        ],
      );
    } catch (error) {
      rollbackScenarioFailure = { error };
      throw error;
    } finally {
      preservePublicationCleanup(rollbackScenarioFailure, () =>
        fs.rmSync(rollbackTarget, { force: true, recursive: true }),
      );
    }
    const guardedRevision = project.revision();
    TestValidator.predicate(
      "generated pre-commit guard negative twin refuses",
      (() => {
        try {
          project.commitGenerated(residentFiles, generated, () => false);
          return false;
        } catch (error) {
          return error instanceof AutoMovieProductionInputRaceError;
        }
      })(),
    );
    TestValidator.equals(
      "generated pre-commit guard preserves revision and every resident byte",
      [
        project.revision(),
        ...[...residentFiles].map(([file, bytes]) =>
          Buffer.from(project.readGeneratedFile(file)).equals(
            Buffer.from(bytes),
          ),
        ),
      ],
      [guardedRevision, ...[...residentFiles].map(() => true)],
    );
    let generatedGuardCalls = 0;
    const replacementBytes = Buffer.from("export const generated = true;\n");
    const replacementManifest: IAutoMovieGeneratedManifest = {
      ...generated,
      files: [
        {
          path: "runtime-shape/generated.ts",
          owner: "compiler",
          digest: digestAutoMovieBytes(replacementBytes),
          sourceTargets: ["production:fixture-film"],
        },
      ],
    };
    let generatedInventoryCalls = 0;
    const unexpectedGeneratedFile = path.join(
      project.generatedRoot(),
      "runtime-shape/unexpected.ts",
    );
    TestValidator.predicate(
      "generated final verification rejects an unexpected resident path",
      (() => {
        try {
          project.commitGenerated(
            new Map([["runtime-shape/generated.ts", replacementBytes]]),
            replacementManifest,
            () => {
              ++generatedInventoryCalls;
              if (generatedInventoryCalls === 2) {
                fs.mkdirSync(path.dirname(unexpectedGeneratedFile), {
                  recursive: true,
                });
                fs.writeFileSync(unexpectedGeneratedFile, "unexpected");
              }
              return true;
            },
          );
          return false;
        } catch (error) {
          return (
            error instanceof AutoMovieProductionInputRaceError &&
            error.message.includes("generated inventory changed")
          );
        }
      })(),
    );
    TestValidator.equals(
      "inventory refusal rolls staged output back and preserves the external mutation",
      [
        generatedInventoryCalls,
        project.revision(),
        project.generatedManifest(),
        fs.existsSync(unexpectedGeneratedFile),
        ...[...residentFiles].map(([file, bytes]) =>
          Buffer.from(project.readGeneratedFile(file)).equals(
            Buffer.from(bytes),
          ),
        ),
      ],
      [
        2,
        guardedRevision,
        generated,
        true,
        ...[...residentFiles].map(() => true),
      ],
    );
    fs.rmSync(unexpectedGeneratedFile);

    let generatedManifestCalls = 0;
    TestValidator.predicate(
      "generated final verification rejects a changed resident manifest",
      (() => {
        try {
          project.commitGenerated(
            new Map([["runtime-shape/generated.ts", replacementBytes]]),
            replacementManifest,
            () => {
              ++generatedManifestCalls;
              if (generatedManifestCalls === 2)
                fs.writeFileSync(
                  project.trackedStatePath("generated-manifest.json"),
                  "changed generated manifest",
                );
              return true;
            },
          );
          return false;
        } catch (error) {
          return (
            error instanceof AutoMovieProductionInputRaceError &&
            error.message.includes("generated manifest changed")
          );
        }
      })(),
    );
    TestValidator.equals(
      "generated-manifest refusal restores manifest, inventory, and revision",
      [
        generatedManifestCalls,
        project.revision(),
        project.generatedManifest(),
        ...[...residentFiles].map(([file, bytes]) =>
          Buffer.from(project.readGeneratedFile(file)).equals(
            Buffer.from(bytes),
          ),
        ),
      ],
      [2, guardedRevision, generated, ...[...residentFiles].map(() => true)],
    );
    TestValidator.predicate(
      "generated output changed during final verification rolls back",
      (() => {
        try {
          project.commitGenerated(
            new Map([["runtime-shape/generated.ts", replacementBytes]]),
            replacementManifest,
            () => {
              ++generatedGuardCalls;
              if (generatedGuardCalls === 2)
                fs.writeFileSync(
                  path.join(
                    project.generatedRoot(),
                    "runtime-shape/generated.ts",
                  ),
                  "changed during verification",
                );
              return true;
            },
          );
          return false;
        } catch (error) {
          return error instanceof AutoMovieProductionInputRaceError;
        }
      })(),
    );
    TestValidator.equals(
      "generated race rollback restores prior inventory, bytes, and revision",
      [
        project.revision(),
        project.generatedManifest(),
        ...[...residentFiles].map(([file, bytes]) =>
          Buffer.from(project.readGeneratedFile(file)).equals(
            Buffer.from(bytes),
          ),
        ),
        fs.existsSync(
          path.join(project.generatedRoot(), "runtime-shape/generated.ts"),
        ),
      ],
      [
        guardedRevision,
        generated,
        ...[...residentFiles].map(() => true),
        false,
      ],
    );

    let generatedUnreadableCalls = 0;
    const [linkedGeneratedPath, linkedGeneratedBytes] = [...residentFiles][0]!;
    const linkedGeneratedFile = path.join(
      project.generatedRoot(),
      linkedGeneratedPath,
    );
    const generatedJunctionTarget = path.join(fixture.root, "src");
    TestValidator.predicate(
      "generated final verification classifies an unreadable resident path",
      (() => {
        try {
          project.commitGenerated(residentFiles, generated, () => {
            ++generatedUnreadableCalls;
            if (generatedUnreadableCalls === 2) {
              fs.rmSync(linkedGeneratedFile);
              fs.symlinkSync(
                generatedJunctionTarget,
                linkedGeneratedFile,
                process.platform === "win32" ? "junction" : "dir",
              );
            }
            return true;
          });
          return false;
        } catch (error) {
          return (
            error instanceof AutoMovieProductionInputRaceError &&
            error.message.includes("generated output became unreadable")
          );
        }
      })(),
    );
    fs.unlinkSync(linkedGeneratedFile);
    fs.writeFileSync(linkedGeneratedFile, linkedGeneratedBytes);
    TestValidator.equals(
      "unreadable generated-path refusal preserves revision and restores fixture bytes",
      [
        generatedUnreadableCalls,
        project.revision(),
        Buffer.from(project.readGeneratedFile(linkedGeneratedPath)),
      ],
      [2, guardedRevision, Buffer.from(linkedGeneratedBytes)],
    );

    const generatedPaths = generated.files
      .map((file) => file.path)
      .sort((left, right) => (left < right ? -1 : left > right ? 1 : 0));
    const currentProduction = project.design({
      kind: "production",
    }) as IAutoMovieProductionDesign;
    const addressMismatch = project.setProductionDesign({
      ...currentProduction,
      id: "another-production",
    });
    const missingErase = project.eraseDesignArtifact({
      kind: "formation",
      id: "missing-after-generation",
    });
    const currentAcceptance = project.design({
      kind: "acceptance",
      id: "opening-beauty",
    }) as IAutoMovieAcceptanceScenario;
    const acceptedRewrite = project.setAcceptanceScenario(currentAcceptance);
    TestValidator.equals(
      "every mutation outcome names the exact generated inventory it invalidates",
      [addressMismatch, missingErase, acceptedRewrite].map((result) => ({
        accepted: result.accepted,
        removedGenerated: result.consequences.removedGenerated,
      })),
      [
        { accepted: false, removedGenerated: generatedPaths },
        { accepted: false, removedGenerated: generatedPaths },
        { accepted: true, removedGenerated: generatedPaths },
      ],
    );
  } catch (error) {
    failure = { error };
    throw error;
  } finally {
    preservePublicationCleanup(failure, fixture.dispose);
  }
};
