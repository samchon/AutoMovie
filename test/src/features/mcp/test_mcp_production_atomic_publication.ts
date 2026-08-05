import {
  IAutoMovieProductionRenderManifest,
  IAutoMovieProductionRenderedDeliverable,
  IAutoMovieRenderBundleManifest,
} from "@automovie/interface";
import {
  AutoMovieProductionCompiler,
  AutoMovieProductionProject,
  digestAutoMovieBytes,
  productionPublicationInputFingerprint,
  productionRenderBundleRelativePath,
  productionRenderTargetFingerprint,
} from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";

import { namedFacts } from "../internal/predicates";
import {
  productionCompileSucceeded,
  productionFixture,
  testRendererIdentity,
} from "./productionFixtures";

interface IAtomicPublicationFixtureFailure {
  error: unknown;
}

class AtomicPublicationFixtureCleanupError extends AggregateError {}

/** Dispose the atomic-publication fixture without replacing its failure. */
export const preserveAtomicPublicationFixtureCleanup = (
  failure: IAtomicPublicationFixtureFailure | undefined,
  cleanup: () => unknown,
): void => {
  try {
    cleanup();
  } catch (cleanupFailure) {
    if (failure === undefined) throw cleanupFailure;
    throw new AtomicPublicationFixtureCleanupError(
      [failure.error, cleanupFailure],
      "Atomic-publication fixture teardown failed after the test failed.",
    );
  }
};

const image = (red: number): Uint8Array => {
  const png = new PNG({ width: 16, height: 16 });
  png.data.fill(255);
  png.data[0] = red;
  return PNG.sync.write(png);
};

const throws = (closure: () => unknown, fragment?: string): boolean => {
  try {
    closure();
    return false;
  } catch (error) {
    return (
      fragment === undefined ||
      (error instanceof Error && error.message.includes(fragment))
    );
  }
};

const deliverable = (
  file: string,
  bytes: Uint8Array,
): IAutoMovieProductionRenderedDeliverable => ({
  id: "atomic-preview",
  kind: "preview",
  files: [
    {
      path: file,
      digest: digestAutoMovieBytes(bytes),
      bytes: bytes.length,
      mediaType: "image/png",
    },
  ],
  runtimeSeconds: null,
  frameCount: 1,
  codec: null,
});

/**
 * Terminal publication commits output bytes and both ledgers under one fence.
 *
 * Scenarios:
 *
 * 1. Valid parser-probed bytes, aggregate manifest, and receipt publish at one
 *    revision and remain byte-exact afterward.
 * 2. Invalid schema/input identity, escaping or colliding paths, duplicate claims,
 *    missing/extra bytes, false byte facts, and corrupt media fail before
 *    publication.
 * 3. A stale revision and an input guard failing before writes are rejected.
 * 4. An input guard failing after writes rolls every file and ledger back to the
 *    prior valid publication without advancing revision.
 * 5. A staged read-only final-gate failure has the same rollback guarantee.
 * 6. The canonical terminal snapshot binds direct manifest, design, generated,
 *    live render evidence, and review state; a direct design race after the
 *    staged gate rolls back.
 * 7. Replacing the production state incarnation during the final gate refuses
 *    stale-path rollback into the replacement namespace.
 * 8. A state-root swap during resident lock acquisition removes the exact lock
 *    token this failed attempt created in the replacement namespace.
 * 9. A state-root swap after rollback staging cannot publish previous ledger bytes
 *    into the replacement namespace.
 * 10. An opened state root that disappears before mutation is rejected before
 *     resident lock acquisition.
 */
export const test_mcp_production_atomic_publication = (): void => {
  const fixture = productionFixture();
  let atomicPublicationFailure: IAtomicPublicationFixtureFailure | undefined;
  try {
    const project = AutoMovieProductionProject.open(fixture.root);
    TestValidator.predicate(
      "terminal snapshot refuses absent compiler-owned output",
      throws(
        () => productionPublicationInputFingerprint(project),
        "requires current compiler-owned output",
      ),
    );
    const compiled = new AutoMovieProductionCompiler(project).compile({
      scope: "source",
    });
    TestValidator.predicate(
      "atomic publication fixture compiles source",
      productionCompileSucceeded("atomic publication fixture", compiled),
    );
    const compileFingerprint = compiled.compiler.inputFingerprint;
    const publicationSnapshot = productionPublicationInputFingerprint(project);
    const projectManifestPath = path.join(
      fixture.root,
      ".automovie/manifest.json",
    );
    const projectManifestBytes = fs.readFileSync(projectManifestPath);
    const projectManifest = JSON.parse(
      projectManifestBytes.toString("utf8"),
    ) as Record<string, unknown>;
    fs.writeFileSync(
      projectManifestPath,
      `${JSON.stringify(
        { ...projectManifest, renderRoot: "alternate-renders" },
        null,
        2,
      )}\n`,
    );
    const manifestSnapshotChanged =
      productionPublicationInputFingerprint(
        AutoMovieProductionProject.open(fixture.root),
      ) !== publicationSnapshot;
    fs.writeFileSync(projectManifestPath, projectManifestBytes);
    const productionPath = path.join(
      fixture.root,
      ".automovie/design/fixture-film/production.json",
    );
    const productionBytes = fs.readFileSync(productionPath);
    const production = JSON.parse(productionBytes.toString("utf8")) as Record<
      string,
      unknown
    >;
    fs.writeFileSync(
      productionPath,
      `${JSON.stringify(
        { ...production, title: `${String(production.title)} changed` },
        null,
        2,
      )}\n`,
    );
    const designSnapshotChanged =
      productionPublicationInputFingerprint(
        AutoMovieProductionProject.open(fixture.root),
      ) !== publicationSnapshot;
    fs.writeFileSync(productionPath, productionBytes);
    const generated = project.generatedManifest()!;
    const generatedFile = path.join(
      project.generatedRoot(),
      generated.files[0]!.path,
    );
    const generatedBytes = fs.readFileSync(generatedFile);
    const generatedTamper = Buffer.from(generatedBytes);
    generatedTamper[0] ^= 0xff;
    fs.writeFileSync(generatedFile, generatedTamper);
    const generatedSnapshotChanged =
      productionPublicationInputFingerprint(
        AutoMovieProductionProject.open(fixture.root),
      ) !== publicationSnapshot;
    fs.writeFileSync(generatedFile, generatedBytes);
    const reviewTarget = { kind: "shot" as const, id: "opening" };
    const reviewFrame = image(32);
    const reviewManifest: IAutoMovieRenderBundleManifest = {
      version: 3,
      target: reviewTarget,
      compileFingerprint,
      rendererIdentity: testRendererIdentity(),
      targetFingerprint: productionRenderTargetFingerprint(
        project,
        project.generatedManifest()!,
        reviewTarget,
      ),
      renderSpec: {
        target: reviewTarget.id,
        frameFormat: { width: 16, height: 16, fps: 24 },
        toneMapping: "none",
        codec: "h264",
        pixelFormat: "yuv420p",
        crf: 17,
      },
      frames: [
        {
          index: 48,
          time: 2,
          pass: "beauty",
          path: "publication-evidence.png",
          digest: digestAutoMovieBytes(reviewFrame),
          width: 16,
          height: 16,
        },
      ],
    };
    const reviewBundle = productionRenderBundleRelativePath(reviewManifest);
    project.commitRenderBundle(
      reviewBundle,
      new Map([["publication-evidence.png", reviewFrame]]),
      reviewManifest,
    );
    const evidenceSnapshot = productionPublicationInputFingerprint(project);
    const reviewFramePath = path.join(
      project.renderRoot(),
      ...reviewBundle.split("/"),
      "publication-evidence.png",
    );
    fs.writeFileSync(reviewFramePath, image(96));
    const evidenceSnapshotChanged =
      productionPublicationInputFingerprint(
        AutoMovieProductionProject.open(fixture.root),
      ) !== evidenceSnapshot;
    fs.writeFileSync(reviewFramePath, reviewFrame);
    const snapshotBindings = {
      manifest: manifestSnapshotChanged,
      design: designSnapshotChanged,
      generated: generatedSnapshotChanged,
      renderEvidence: evidenceSnapshotChanged,
    };
    TestValidator.predicate(
      `terminal snapshot binds manifest, design, generated bytes, and current render evidence:\n${JSON.stringify(snapshotBindings, null, 2)}`,
      Object.values(snapshotBindings).every((bound) => bound),
    );
    const relative = "deliverables/atomic/preview.png";
    const first = image(0);
    const manifest: IAutoMovieProductionRenderManifest = {
      version: 1,
      compileFingerprint,
      deliverables: [deliverable(relative, first)],
    };
    const before = project.revision();
    let finalChecks = 0;
    const revision = project.commitProductionPublication({
      files: new Map([[relative, first]]),
      manifest,
      expectedRevision: before,
      inputCurrent: () => true,
      publicationCurrent: () => {
        ++finalChecks;
      },
    });
    const manifestPath = path.join(
      fixture.root,
      ".automovie/productions/fixture-film/render-manifest.json",
    );
    const receiptPath = path.join(
      fixture.root,
      ".automovie/productions/fixture-film/render-manifest-receipt.json",
    );
    const outputPath = path.join(project.renderRoot(), relative);
    const manifestBytes = fs.readFileSync(manifestPath);
    const receiptBytes = fs.readFileSync(receiptPath);
    TestValidator.equals(
      "terminal publication writes exact output and ledgers at one revision",
      namedFacts([
        ["revisionBefore", () => revision === before + 1],
        ["finalChecks", () => finalChecks === 1],
        [
          "readFileSyncOutputPathEquals",
          () => fs.readFileSync(outputPath).equals(first),
        ],
        [
          "parseManifestBytesUtf8",
          () =>
            JSON.parse(manifestBytes.toString("utf8")).compileFingerprint ===
            compileFingerprint,
        ],
        [
          "parseReceiptBytesUtf8",
          () =>
            JSON.parse(receiptBytes.toString("utf8")).files[0]?.probe.kind ===
            "png",
        ],
      ]),
      {
        revisionBefore: true,
        finalChecks: true,
        readFileSyncOutputPathEquals: true,
        parseManifestBytesUtf8: true,
        parseReceiptBytesUtf8: true,
      },
    );

    const duplicateClaim: IAutoMovieProductionRenderManifest = {
      ...manifest,
      deliverables: [
        {
          ...manifest.deliverables[0]!,
          files: [
            manifest.deliverables[0]!.files[0]!,
            manifest.deliverables[0]!.files[0]!,
          ],
        },
      ],
    };
    const wrongBytes = image(128);
    const wrongFacts: IAutoMovieProductionRenderManifest = {
      ...manifest,
      deliverables: [deliverable(relative, wrongBytes)],
    };
    const invalidMedia = Buffer.from("not a png");
    const invalidMediaManifest: IAutoMovieProductionRenderManifest = {
      ...manifest,
      deliverables: [deliverable(relative, invalidMedia)],
    };
    TestValidator.equals(
      "terminal publication rejects every unowned or unverified inventory",
      namedFacts([
        [
          "throwsProjectCommitProductionPublication",
          () =>
            throws(() =>
              project.commitProductionPublication({
                files: new Map(),
                manifest: {} as never,
              }),
            ),
        ],
        [
          "throwsProjectCommitProductionPublication2",
          () =>
            throws(() =>
              project.commitProductionPublication({
                files: new Map([[relative, first]]),
                manifest: {
                  ...manifest,
                  compileFingerprint: `sha256:${"9".repeat(64)}`,
                },
              }),
            ),
        ],
        [
          "throwsProjectCommitProductionPublication3",
          () =>
            throws(() =>
              project.commitProductionPublication({
                files: new Map([["../escape.png", first]]),
                manifest,
              }),
            ),
        ],
        [
          "throwsProjectCommitProductionPublication4",
          () =>
            throws(() =>
              project.commitProductionPublication({
                files: new Map([
                  ["Frame.png", first],
                  ["frame.png", first],
                ]),
                manifest,
              }),
            ),
        ],
        [
          "throwsProjectCommitProductionPublication5",
          () =>
            throws(() =>
              project.commitProductionPublication({
                files: new Map([[relative, first]]),
                manifest: duplicateClaim,
              }),
            ),
        ],
        [
          "throwsProjectCommitProductionPublication6",
          () =>
            throws(() =>
              project.commitProductionPublication({
                files: new Map(),
                manifest,
              }),
            ),
        ],
        [
          "throwsProjectCommitProductionPublication7",
          () =>
            throws(() =>
              project.commitProductionPublication({
                files: new Map([
                  [relative, first],
                  ["unclaimed.png", first],
                ]),
                manifest,
              }),
            ),
        ],
        [
          "throwsProjectCommitProductionPublication8",
          () =>
            throws(() =>
              project.commitProductionPublication({
                files: new Map([[relative, first]]),
                manifest: wrongFacts,
              }),
            ),
        ],
        [
          "throwsProjectCommitProductionPublication9",
          () =>
            throws(() =>
              project.commitProductionPublication({
                files: new Map([[relative, invalidMedia]]),
                manifest: invalidMediaManifest,
              }),
            ),
        ],
      ]),
      {
        throwsProjectCommitProductionPublication: true,
        throwsProjectCommitProductionPublication2: true,
        throwsProjectCommitProductionPublication3: true,
        throwsProjectCommitProductionPublication4: true,
        throwsProjectCommitProductionPublication5: true,
        throwsProjectCommitProductionPublication6: true,
        throwsProjectCommitProductionPublication7: true,
        throwsProjectCommitProductionPublication8: true,
        throwsProjectCommitProductionPublication9: true,
      },
    );

    TestValidator.predicate(
      "terminal publication rejects stale revision and pre-write input race",
      throws(() =>
        project.commitProductionPublication({
          files: new Map([[relative, first]]),
          manifest,
          expectedRevision: revision - 1,
        }),
      ) &&
        throws(() =>
          project.commitProductionPublication({
            files: new Map([[relative, first]]),
            manifest,
            inputCurrent: () => false,
          }),
        ),
    );

    const second = image(64);
    const replacement: IAutoMovieProductionRenderManifest = {
      ...manifest,
      deliverables: [deliverable(relative, second)],
    };
    const guardedPublicationSnapshot =
      productionPublicationInputFingerprint(project);
    let directDesignRace = false;
    try {
      directDesignRace = throws(
        () =>
          project.commitProductionPublication({
            files: new Map([[relative, second]]),
            manifest: replacement,
            expectedRevision: revision,
            inputCurrent: () =>
              productionPublicationInputFingerprint(
                AutoMovieProductionProject.open(fixture.root),
              ) === guardedPublicationSnapshot,
            publicationCurrent: () => {
              fs.writeFileSync(
                productionPath,
                `${JSON.stringify(
                  {
                    ...production,
                    title: `${String(production.title)} raced`,
                  },
                  null,
                  2,
                )}\n`,
              );
            },
          }),
        "final gate",
      );
    } finally {
      fs.writeFileSync(productionPath, productionBytes);
    }
    TestValidator.predicate(
      "direct design race after staged final gate restores prior publication",
      directDesignRace &&
        project.revision() === revision &&
        fs.readFileSync(outputPath).equals(first) &&
        fs.readFileSync(manifestPath).equals(manifestBytes) &&
        fs.readFileSync(receiptPath).equals(receiptBytes),
    );
    let observations = 0;
    TestValidator.equals(
      "post-write input race restores prior valid publication",
      namedFacts([
        [
          "throwsProjectCommitProductionPublication",
          () =>
            throws(
              () =>
                project.commitProductionPublication({
                  files: new Map([[relative, second]]),
                  manifest: replacement,
                  expectedRevision: revision,
                  inputCurrent: () => ++observations === 1,
                }),
              "changed while",
            ),
        ],
        ["projectRevisionRevision", () => project.revision() === revision],
        [
          "readFileSyncOutputPathEquals",
          () => fs.readFileSync(outputPath).equals(first),
        ],
        [
          "readFileSyncManifestPathEquals",
          () => fs.readFileSync(manifestPath).equals(manifestBytes),
        ],
        [
          "readFileSyncReceiptPathEquals",
          () => fs.readFileSync(receiptPath).equals(receiptBytes),
        ],
      ]),
      {
        throwsProjectCommitProductionPublication: true,
        projectRevisionRevision: true,
        readFileSyncOutputPathEquals: true,
        readFileSyncManifestPathEquals: true,
        readFileSyncReceiptPathEquals: true,
      },
    );
    TestValidator.predicate(
      "staged final-gate failure also restores prior valid publication",
      throws(
        () =>
          project.commitProductionPublication({
            files: new Map([[relative, second]]),
            manifest: replacement,
            expectedRevision: revision,
            publicationCurrent: () => {
              throw new Error("injected staged final failure");
            },
          }),
        "staged final failure",
      ) &&
        project.revision() === revision &&
        fs.readFileSync(outputPath).equals(first) &&
        fs.readFileSync(manifestPath).equals(manifestBytes) &&
        fs.readFileSync(receiptPath).equals(receiptBytes),
    );
    const readRenderFile = project.readRenderFile;
    project.readRenderFile = ((candidate: string): Uint8Array =>
      candidate === relative
        ? Buffer.from("post-publication byte race")
        : readRenderFile.call(
            project,
            candidate,
          )) as typeof project.readRenderFile;
    const postPublicationByteRace = throws(
      () =>
        project.commitProductionPublication({
          files: new Map([[relative, second]]),
          manifest: replacement,
          expectedRevision: revision,
        }),
      "post-publication byte check",
    );
    project.readRenderFile = readRenderFile;
    const readTrackedStateFile = project.readTrackedStateFile;
    project.readTrackedStateFile = ((candidate: string): Uint8Array | null =>
      candidate === "render-manifest.json"
        ? Buffer.from("{}")
        : readTrackedStateFile.call(
            project,
            candidate,
          )) as typeof project.readTrackedStateFile;
    const postPublicationLedgerRace = throws(
      () =>
        project.commitProductionPublication({
          files: new Map([[relative, second]]),
          manifest: replacement,
          expectedRevision: revision,
        }),
      "manifest or receipt changed",
    );
    project.readTrackedStateFile = readTrackedStateFile;
    TestValidator.predicate(
      "post-publication byte and ledger races restore the prior valid publication",
      postPublicationByteRace &&
        postPublicationLedgerRace &&
        project.revision() === revision &&
        fs.readFileSync(outputPath).equals(first) &&
        fs.readFileSync(manifestPath).equals(manifestBytes) &&
        fs.readFileSync(receiptPath).equals(receiptBytes),
    );
    let terminalObservations = 0;
    TestValidator.predicate(
      "input race after the staged final gate restores prior publication",
      throws(
        () =>
          project.commitProductionPublication({
            files: new Map([[relative, second]]),
            manifest: replacement,
            expectedRevision: revision,
            inputCurrent: () => ++terminalObservations < 3,
            publicationCurrent: () => undefined,
          }),
        "final gate",
      ) &&
        terminalObservations === 3 &&
        project.revision() === revision &&
        fs.readFileSync(outputPath).equals(first) &&
        fs.readFileSync(manifestPath).equals(manifestBytes) &&
        fs.readFileSync(receiptPath).equals(receiptBytes),
    );

    const stateRoot = path.join(fixture.root, ".automovie");
    const productionStateRoot = path.dirname(manifestPath);
    const productionStateRelative = path.relative(
      stateRoot,
      productionStateRoot,
    );
    const parkedStateRoot = path.join(fixture.root, ".automovie-parked");
    const replacementStateRoot = path.join(
      fixture.root,
      ".automovie-replacement",
    );
    const replacementProductionStateRoot = path.join(
      replacementStateRoot,
      productionStateRelative,
    );
    fs.cpSync(stateRoot, replacementStateRoot, { recursive: true });
    fs.writeFileSync(
      path.join(replacementStateRoot, "incarnation.json"),
      `${JSON.stringify({ version: 1, id: randomUUID() }, null, 2)}\n`,
    );
    const replacementManifest = Buffer.from(
      `${JSON.stringify({ replacement: "manifest" }, null, 2)}\n`,
    );
    const replacementReceipt = Buffer.from(
      `${JSON.stringify({ replacement: "receipt" }, null, 2)}\n`,
    );
    fs.writeFileSync(
      path.join(replacementProductionStateRoot, "render-manifest.json"),
      replacementManifest,
    );
    fs.writeFileSync(
      path.join(replacementProductionStateRoot, "render-manifest-receipt.json"),
      replacementReceipt,
    );
    const incarnationSnapshot = productionPublicationInputFingerprint(project);
    let incarnationSwapped = false;
    const incarnationSwapRejected = throws(
      () =>
        project.commitProductionPublication({
          files: new Map([[relative, second]]),
          manifest: replacement,
          expectedRevision: revision,
          inputCurrent: () =>
            productionPublicationInputFingerprint(
              AutoMovieProductionProject.open(fixture.root),
            ) === incarnationSnapshot,
          publicationCurrent: () => {
            fs.renameSync(stateRoot, parkedStateRoot);
            fs.renameSync(replacementStateRoot, stateRoot);
            incarnationSwapped = true;
          },
        }),
      "production state incarnation changed",
    );
    TestValidator.predicate(
      "state incarnation replacement refuses stale ledger rollback",
      incarnationSwapped &&
        incarnationSwapRejected &&
        fs
          .readFileSync(path.join(productionStateRoot, "render-manifest.json"))
          .equals(replacementManifest) &&
        fs
          .readFileSync(
            path.join(productionStateRoot, "render-manifest-receipt.json"),
          )
          .equals(replacementReceipt),
    );

    const lockRaceProject = AutoMovieProductionProject.open(fixture.root);
    const lockRaceParked = path.join(
      fixture.root,
      ".automovie-lock-race-parked",
    );
    const lockRaceReplacement = path.join(
      fixture.root,
      ".automovie-lock-race-replacement",
    );
    fs.cpSync(stateRoot, lockRaceReplacement, { recursive: true });
    fs.writeFileSync(
      path.join(lockRaceReplacement, "incarnation.json"),
      `${JSON.stringify({ version: 1, id: randomUUID() }, null, 2)}\n`,
    );
    const residentWriteFileSync = fs.writeFileSync;
    let lockRootSwapped = false;
    Reflect.set(
      fs,
      "writeFileSync",
      (
        file: fs.PathOrFileDescriptor,
        data: string | NodeJS.ArrayBufferView,
        ...args: unknown[]
      ) => {
        if (
          lockRootSwapped === false &&
          path.resolve(String(file)) ===
            path.resolve(path.join(productionStateRoot, "revision.lock"))
        ) {
          fs.renameSync(stateRoot, lockRaceParked);
          fs.renameSync(lockRaceReplacement, stateRoot);
          lockRootSwapped = true;
        }
        return (
          residentWriteFileSync as (
            target: fs.PathOrFileDescriptor,
            content: string | NodeJS.ArrayBufferView,
            ...options: unknown[]
          ) => void
        )(file, data, ...args);
      },
    );
    let lockRaceRejected = false;
    try {
      lockRaceRejected = throws(
        () =>
          lockRaceProject.commitProductionPublication({
            files: new Map([[relative, second]]),
            manifest: replacement,
            expectedRevision: lockRaceProject.revision(),
          }),
        "state root identity changed",
      );
    } finally {
      Reflect.set(fs, "writeFileSync", residentWriteFileSync);
    }
    TestValidator.predicate(
      "state replacement during lock acquisition does not retain this attempt's lock",
      lockRootSwapped &&
        lockRaceRejected &&
        fs.existsSync(path.join(productionStateRoot, "revision.lock")) ===
          false,
    );

    const missingStateProject = AutoMovieProductionProject.open(fixture.root);
    const missingStateParked = path.join(
      fixture.root,
      ".automovie-missing-race-parked",
    );
    fs.renameSync(stateRoot, missingStateParked);
    const missingStateRejected = throws(
      () =>
        missingStateProject.commitProductionDeliverableFiles(
          "missing-state",
          new Map([["frame.bin", Buffer.from("unpublished")]]),
        ),
      "state root identity changed",
    );
    fs.renameSync(missingStateParked, stateRoot);
    TestValidator.predicate(
      "an absent opened state root is rejected before lock acquisition",
      missingStateRejected &&
        fs.existsSync(path.join(productionStateRoot, "revision.lock")) ===
          false,
    );

    const rollbackRaceProject = AutoMovieProductionProject.open(fixture.root);
    const rollbackRevision = rollbackRaceProject.commitProductionPublication({
      files: new Map([[relative, first]]),
      manifest,
      expectedRevision: rollbackRaceProject.revision(),
    });
    const rollbackRaceParked = path.join(
      fixture.root,
      ".automovie-rollback-race-parked",
    );
    const rollbackRaceReplacement = path.join(
      fixture.root,
      ".automovie-rollback-race-replacement",
    );
    const rollbackProductionStateRoot = path.join(
      rollbackRaceReplacement,
      productionStateRelative,
    );
    fs.cpSync(stateRoot, rollbackRaceReplacement, { recursive: true });
    fs.writeFileSync(
      path.join(rollbackRaceReplacement, "incarnation.json"),
      `${JSON.stringify({ version: 1, id: randomUUID() }, null, 2)}\n`,
    );
    fs.writeFileSync(
      path.join(rollbackProductionStateRoot, "render-manifest.json"),
      replacementManifest,
    );
    fs.writeFileSync(
      path.join(rollbackProductionStateRoot, "render-manifest-receipt.json"),
      replacementReceipt,
    );
    const residentMkdirSync = fs.mkdirSync;
    let rollbackStarted = false;
    let rollbackRootSwapped = false;
    Reflect.set(
      fs,
      "mkdirSync",
      (directory: fs.PathLike, ...args: unknown[]) => {
        const output = (
          residentMkdirSync as (
            target: fs.PathLike,
            ...options: unknown[]
          ) => string | undefined
        )(directory, ...args);
        if (
          rollbackStarted &&
          rollbackRootSwapped === false &&
          path.resolve(String(directory)) === path.resolve(productionStateRoot)
        ) {
          fs.renameSync(stateRoot, rollbackRaceParked);
          fs.renameSync(rollbackRaceReplacement, stateRoot);
          rollbackRootSwapped = true;
        }
        return output;
      },
    );
    let rollbackRaceRejected = false;
    try {
      rollbackRaceRejected = throws(
        () =>
          rollbackRaceProject.commitProductionPublication({
            files: new Map([[relative, second]]),
            manifest: replacement,
            expectedRevision: rollbackRevision,
            publicationCurrent: () => {
              rollbackStarted = true;
              throw new Error("injected rollback staging race");
            },
          }),
        "rollback was incomplete",
      );
    } finally {
      Reflect.set(fs, "mkdirSync", residentMkdirSync);
    }
    TestValidator.predicate(
      "rollback staging cannot publish into a replacement state root",
      rollbackRootSwapped &&
        rollbackRaceRejected &&
        fs
          .readFileSync(path.join(productionStateRoot, "render-manifest.json"))
          .equals(replacementManifest) &&
        fs
          .readFileSync(
            path.join(productionStateRoot, "render-manifest-receipt.json"),
          )
          .equals(replacementReceipt) &&
        fs.existsSync(path.join(productionStateRoot, "revision.lock")) ===
          false,
    );
  } catch (error) {
    atomicPublicationFailure = { error };
    throw error;
  } finally {
    preserveAtomicPublicationFixtureCleanup(atomicPublicationFailure, () =>
      fixture.dispose(),
    );
  }
};
