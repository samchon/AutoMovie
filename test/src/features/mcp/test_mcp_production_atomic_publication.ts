import {
  IAutoMovieProductionRenderManifest,
  IAutoMovieProductionRenderedDeliverable,
} from "@automovie/interface";
import {
  AutoMovieProductionCompiler,
  AutoMovieProductionProject,
  digestAutoMovieBytes,
} from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";

import { productionFixture } from "./productionFixtures";

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
 */
export const test_mcp_production_atomic_publication = (): void => {
  const fixture = productionFixture();
  try {
    const project = AutoMovieProductionProject.open(fixture.root);
    const compiled = new AutoMovieProductionCompiler(project).compile({
      scope: "source",
    });
    TestValidator.predicate(
      "atomic publication fixture compiles source",
      compiled.success,
    );
    const compileFingerprint = compiled.compiler.inputFingerprint;
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
      ".automovie/render-manifest.json",
    );
    const receiptPath = path.join(
      fixture.root,
      ".automovie/render-manifest-receipt.json",
    );
    const outputPath = path.join(project.renderRoot(), relative);
    const manifestBytes = fs.readFileSync(manifestPath);
    const receiptBytes = fs.readFileSync(receiptPath);
    TestValidator.predicate(
      "terminal publication writes exact output and ledgers at one revision",
      revision === before + 1 &&
        finalChecks === 1 &&
        fs.readFileSync(outputPath).equals(first) &&
        JSON.parse(manifestBytes.toString("utf8")).compileFingerprint ===
          compileFingerprint &&
        JSON.parse(receiptBytes.toString("utf8")).files[0]?.probe.kind ===
          "png",
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
    TestValidator.predicate(
      "terminal publication rejects every unowned or unverified inventory",
      throws(() =>
        project.commitProductionPublication({
          files: new Map(),
          manifest: {} as never,
        }),
      ) &&
        throws(() =>
          project.commitProductionPublication({
            files: new Map([[relative, first]]),
            manifest: {
              ...manifest,
              compileFingerprint: `sha256:${"9".repeat(64)}`,
            },
          }),
        ) &&
        throws(() =>
          project.commitProductionPublication({
            files: new Map([["../escape.png", first]]),
            manifest,
          }),
        ) &&
        throws(() =>
          project.commitProductionPublication({
            files: new Map([
              ["Frame.png", first],
              ["frame.png", first],
            ]),
            manifest,
          }),
        ) &&
        throws(() =>
          project.commitProductionPublication({
            files: new Map([[relative, first]]),
            manifest: duplicateClaim,
          }),
        ) &&
        throws(() =>
          project.commitProductionPublication({
            files: new Map(),
            manifest,
          }),
        ) &&
        throws(() =>
          project.commitProductionPublication({
            files: new Map([
              [relative, first],
              ["unclaimed.png", first],
            ]),
            manifest,
          }),
        ) &&
        throws(() =>
          project.commitProductionPublication({
            files: new Map([[relative, first]]),
            manifest: wrongFacts,
          }),
        ) &&
        throws(() =>
          project.commitProductionPublication({
            files: new Map([[relative, invalidMedia]]),
            manifest: invalidMediaManifest,
          }),
        ),
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
    let observations = 0;
    TestValidator.predicate(
      "post-write input race restores prior valid publication",
      throws(
        () =>
          project.commitProductionPublication({
            files: new Map([[relative, second]]),
            manifest: replacement,
            expectedRevision: revision,
            inputCurrent: () => ++observations === 1,
          }),
        "changed while",
      ) &&
        project.revision() === revision &&
        fs.readFileSync(outputPath).equals(first) &&
        fs.readFileSync(manifestPath).equals(manifestBytes) &&
        fs.readFileSync(receiptPath).equals(receiptBytes),
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
  } finally {
    fixture.dispose();
  }
};
