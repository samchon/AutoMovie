import { IAutoMovieScript } from "@automovie/interface";
import { AutoMovieProject, IAutoMovieMcpWritableSlate } from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { throwsError } from "../internal/predicates";

const scriptOf = (logline: string): IAutoMovieScript => ({
  logline,
  theme: "durability",
  cast: [],
  beats: [
    { id: "beat-1", name: "the beat", summary: "one beat", durationHint: 1 },
  ],
});

const slateOf = (logline: string): IAutoMovieMcpWritableSlate => ({
  script: scriptOf(logline),
  scenes: [],
  shots: [],
  beatEnds: [],
  notes: [],
  film: null,
});

/**
 * Resident-project mutations are transactional cycles with cross-session
 * optimistic concurrency (#1133). Two failure shapes used to corrupt the one
 * durable memory: a save that threw mid-sequence persisted a torn subset
 * (script rewritten, shots not yet reconciled), and two live sessions on one
 * directory interleaved at file granularity with the last writer silently
 * winning per file. Saves now stage every serialized slice in memory before the
 * first byte lands, and flush under a commit lock against a monotonic revision
 * counter.
 *
 * Scenarios:
 *
 * 1. A save cycle that throws during staging (a slate carrying an unserializable
 *    value) persists NOTHING: the previously committed script survives
 *    byte-identical and the revision does not move.
 * 2. Two stores on one directory: after session B commits, session A's stale-based
 *    save is REFUSED with the re-read prompt and writes nothing; after A
 *    re-reads, the same save commits (negative twin).
 * 3. Single-session cycles are unaffected: read → save → read round-trips, bumping
 *    the revision once per mutation.
 * 4. A whole actor registry saves as ONE cycle (#1257): two actors bump the
 *    revision once (not once per actor) and both land together.
 * 5. A staging throw on any actor in the registry persists NOTHING and does not
 *    bump: the all-or-nothing guarantee the per-actor loop lacked.
 * 6. Two live asset registrars preserve both manifest entries through direct stale
 *    refusal/retry as well as explicit read synchronization.
 * 7. A missing manifest cannot advance the optimistic revision base and let a
 *    stale slate overwrite a concurrent winner after the manifest returns.
 * 8. The mutation-defense matrix proves partial final evidence, absent and
 *    replacement competitor preservation, retained exact removal evidence,
 *    source-successor refusal, removal-time root replacement, lock-token clone
 *    preservation, and write-time root replacement without stale cleanup.
 * 9. Retargeting a POSIX symlink or Windows junction ancestor during a write
 *    cannot redirect a live handle away from its canonical physical root.
 */
export const test_mcp_project_transactions = (): void => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "automovie-txn-"));
  try {
    const a = AutoMovieProject.open(root);
    a.writableSlate();
    a.saveSlate(slateOf("the committed truth"));
    const scriptFile = path.join(root, "script.json");
    const committed = fs.readFileSync(scriptFile, "utf8");
    const revisionFile = path.join(root, "revision.json");
    const revisionAfterFirst = fs.readFileSync(revisionFile, "utf8");

    // 1. a staging throw persists nothing
    const cyclic = slateOf("never lands");
    // a self-referential SLICE: serialization (the staging step) throws
    (cyclic.script as unknown as { loop?: unknown }).loop = cyclic.script;
    a.writableSlate();
    TestValidator.predicate(
      "an unserializable slate throws during staging",
      throwsError(() => a.saveSlate(cyclic), "circular"),
    );
    TestValidator.equals(
      "the committed script survives byte-identical",
      fs.readFileSync(scriptFile, "utf8"),
      committed,
    );
    TestValidator.equals(
      "the revision does not move on a failed cycle",
      fs.readFileSync(revisionFile, "utf8"),
      revisionAfterFirst,
    );

    // 2. a concurrent session's commit refuses the stale writer
    const b = AutoMovieProject.open(root);
    a.writableSlate(); // A synchronizes at the current revision
    b.writableSlate();
    b.saveSlate(slateOf("session B got here first"));
    TestValidator.predicate(
      "a stale-based save refuses with the re-read prompt",
      throwsError(
        () => a.saveSlate(slateOf("session A, stale")),
        ["another session committed", "re-read", "nothing was written"],
      ),
    );
    TestValidator.predicate(
      "the refused save writes nothing",
      fs.readFileSync(scriptFile, "utf8").includes("session B got here first"),
    );
    // negative twin: after re-reading, the same save commits
    a.writableSlate();
    a.saveSlate(slateOf("session A, rebased"));
    TestValidator.predicate(
      "a rebased save commits",
      fs.readFileSync(scriptFile, "utf8").includes("session A, rebased"),
    );

    // 3. the single-session round trip bumps the revision once per mutation
    const before = JSON.parse(fs.readFileSync(revisionFile, "utf8")) as {
      revision: number;
    };
    a.saveSlate(slateOf("one more cycle"));
    const after = JSON.parse(fs.readFileSync(revisionFile, "utf8")) as {
      revision: number;
    };
    TestValidator.equals(
      "each committed cycle bumps the revision exactly once",
      after.revision,
      before.revision + 1,
    );
    TestValidator.equals(
      "the round trip reads back the committed truth",
      a.writableSlate().script?.logline,
      "one more cycle",
    );

    // 4. a whole actor registry saves as ONE cycle (#1257): the per-actor loop
    // it replaced bumped the revision once PER actor and could tear the store.
    const actorSpec = (node: string) => ({
      node,
      skeleton: `${node}-sk`,
      gaits: [],
      speed: 1,
      eyeHeight: 1.6,
      restPose: { skeleton: `${node}-sk`, root: null, joints: [] },
    });
    a.writableSlate();
    const revBeforeActors = JSON.parse(
      fs.readFileSync(revisionFile, "utf8"),
    ) as { revision: number };
    a.saveActors([actorSpec("knightA"), actorSpec("knightB")]);
    const revAfterActors = JSON.parse(
      fs.readFileSync(revisionFile, "utf8"),
    ) as { revision: number };
    TestValidator.equals(
      "saving a two-actor registry bumps the revision exactly once",
      revAfterActors.revision,
      revBeforeActors.revision + 1,
    );
    TestValidator.predicate(
      "both actor files landed under the one cycle",
      fs.existsSync(path.join(root, "actors", "knightA.json")) &&
        fs.existsSync(path.join(root, "actors", "knightB.json")),
    );

    // 5. a staging throw on any actor persists NOTHING and does not bump.
    const bad = actorSpec("knightC") as unknown as { loop?: unknown };
    bad.loop = bad; // self-referential → serializeJson throws while staging
    a.writableSlate();
    TestValidator.predicate(
      "an unserializable actor throws during staging",
      throwsError(
        () =>
          a.saveActors([
            actorSpec("knightD"),
            bad as unknown as ReturnType<typeof actorSpec>,
          ]),
        "circular",
      ),
    );
    TestValidator.predicate(
      "neither actor from the failed registry save landed",
      !fs.existsSync(path.join(root, "actors", "knightD.json")) &&
        !fs.existsSync(path.join(root, "actors", "knightC.json")),
    );
    TestValidator.equals(
      "the revision did not move on the failed actor save",
      JSON.parse(fs.readFileSync(revisionFile, "utf8")).revision,
      revAfterActors.revision,
    );

    const assetA = AutoMovieProject.open(root);
    const assetB = AutoMovieProject.open(root);
    assetA.registerAsset("models/asset-a.glb", Buffer.from("asset a"));
    TestValidator.predicate(
      "a stale asset registrar is refused before writing",
      throwsError(
        () =>
          assetB.registerAsset("models/asset-b.glb", Buffer.from("asset b")),
        ["another session committed", "nothing was written"],
      ) && fs.existsSync(path.join(root, "models", "asset-b.glb")) === false,
    );
    assetB.registerAsset("models/asset-b.glb", Buffer.from("asset b"));
    TestValidator.equals(
      "a synchronized second handle preserves the first handle's asset",
      assetB.assets,
      ["models/asset-a.glb", "models/asset-b.glb"],
    );
    TestValidator.equals(
      "summary exposes the current resident asset index",
      assetA.summary().assets,
      ["models/asset-a.glb", "models/asset-b.glb"],
    );

    const manifestRaceA = AutoMovieProject.open(root);
    const manifestRaceB = AutoMovieProject.open(root);
    const staleSlate = manifestRaceB.writableSlate();
    manifestRaceA.saveSlate(slateOf("manifest race winner"));
    const manifestFile = path.join(root, "automovie.json");
    const parkedManifest = `${manifestFile}.parked`;
    fs.renameSync(manifestFile, parkedManifest);
    const missingManifestRejected = throwsError(
      () => manifestRaceB.writableSlate(),
      ["manifest", "disappeared from the resident project"],
    );
    fs.renameSync(parkedManifest, manifestFile);
    const staleAfterManifestFailureRejected = throwsError(
      () => manifestRaceB.saveSlate(staleSlate),
      ["another session committed", "nothing was written"],
    );
    TestValidator.predicate(
      "a failed manifest refresh cannot advance the stale slate base",
      missingManifestRejected &&
        staleAfterManifestFailureRejected &&
        fs
          .readFileSync(path.join(root, "script.json"), "utf8")
          .includes("manifest race winner"),
    );
    a.writableSlate();

    const nativeOpen = fs.openSync;
    const nativeDescriptorWrite = fs.writeSync;
    const failedFinal = path.join(root, "actors", "cleanupFailure.json");
    let failedDescriptor = -1;
    fs.openSync = ((file, flags, ...args: unknown[]): number => {
      const descriptor = Reflect.apply(nativeOpen, fs, [
        file,
        flags,
        ...args,
      ]) as number;
      if (
        typeof file !== "number" &&
        path.resolve(file.toString()) === failedFinal &&
        flags === "wx+"
      )
        failedDescriptor = descriptor;
      return descriptor;
    }) as typeof fs.openSync;
    fs.writeSync = ((...args: unknown[]): number => {
      if (args[0] === failedDescriptor) {
        const [descriptor, buffer, offset, _length, position] = args as [
          number,
          Uint8Array,
          number,
          number,
          number,
        ];
        Reflect.apply(nativeDescriptorWrite, fs, [
          descriptor,
          buffer,
          offset,
          1,
          position,
        ]);
        throw Object.assign(new Error("actor final write failed"), {
          code: "EIO",
        });
      }
      return Reflect.apply(nativeDescriptorWrite, fs, args) as number;
    }) as typeof fs.writeSync;
    let finalWriteRejected = false;
    try {
      finalWriteRejected = throwsError(
        () => a.saveActors([actorSpec("cleanupFailure")]),
        ["actor final write failed"],
      );
    } finally {
      fs.openSync = nativeOpen;
      fs.writeSync = nativeDescriptorWrite;
    }
    TestValidator.predicate(
      "a resident write failure retains its exact partial final evidence",
      finalWriteRejected &&
        failedDescriptor !== -1 &&
        fs.readFileSync(failedFinal).length === 1,
    );

    const absentCompetitor = path.join(root, "actors", "absentCompetitor.json");
    const absentCompetitorBytes = Buffer.from("foreign absent competitor");
    let absentCompetitorInstalled = false;
    fs.openSync = ((file, flags, ...args: unknown[]): number => {
      if (
        absentCompetitorInstalled === false &&
        typeof file !== "number" &&
        path.resolve(file.toString()) === absentCompetitor &&
        flags === "wx+"
      ) {
        fs.writeFileSync(absentCompetitor, absentCompetitorBytes);
        absentCompetitorInstalled = true;
      }
      return Reflect.apply(nativeOpen, fs, [file, flags, ...args]) as number;
    }) as typeof fs.openSync;
    let absentCompetitorRejected = false;
    try {
      absentCompetitorRejected = throwsError(
        () => a.saveActors([actorSpec("absentCompetitor")]),
        ["EEXIST"],
      );
    } finally {
      fs.openSync = nativeOpen;
    }
    TestValidator.predicate(
      "an absent resident publication preserves its final-slot competitor",
      absentCompetitorInstalled &&
        absentCompetitorRejected &&
        fs.readFileSync(absentCompetitor).equals(absentCompetitorBytes),
    );
    fs.rmSync(absentCompetitor, { force: true });

    const nativeRename = fs.renameSync;
    const residentEvidence = path.join(root, ".automovie-resident-evidence");
    const replacementRace = path.join(root, "actors", "replacementRace.json");
    a.saveActors([actorSpec("replacementRace")]);
    const replacementPredecessor = fs.readFileSync(replacementRace);
    const replacementSuccessor = Buffer.from(
      `${JSON.stringify({ ...actorSpec("replacementRace"), speed: 7 }, null, 2)}\n`,
    );
    const evidenceBeforeReplacement = new Set(fs.readdirSync(residentEvidence));
    let replacementSuccessorInstalled = false;
    fs.renameSync = ((oldPath, newPath) => {
      nativeRename(oldPath, newPath);
      if (
        replacementSuccessorInstalled === false &&
        path.resolve(oldPath.toString()) === replacementRace &&
        path.dirname(path.resolve(newPath.toString())) === residentEvidence
      ) {
        fs.writeFileSync(replacementRace, replacementSuccessor);
        replacementSuccessorInstalled = true;
      }
    }) as typeof fs.renameSync;
    let replacementSuccessorRejected = false;
    try {
      replacementSuccessorRejected = throwsError(
        () => a.saveActors([{ ...actorSpec("replacementRace"), speed: 2 }]),
        ["EEXIST"],
      );
    } finally {
      fs.renameSync = nativeRename;
    }
    const replacementEvidence = fs
      .readdirSync(residentEvidence)
      .filter((file) => evidenceBeforeReplacement.has(file) === false)
      .find((file) =>
        fs
          .readFileSync(path.join(residentEvidence, file))
          .equals(replacementPredecessor),
      );
    TestValidator.predicate(
      "resident replacement preserves both a target successor and predecessor evidence",
      replacementSuccessorInstalled &&
        replacementSuccessorRejected &&
        fs.readFileSync(replacementRace).equals(replacementSuccessor) &&
        replacementEvidence !== undefined,
    );

    const linkedAssetOutside = path.join(root, "linked-asset-outside");
    const linkedAssetParent = path.join(root, "assets", "linked-parent");
    fs.mkdirSync(linkedAssetOutside);
    fs.symlinkSync(linkedAssetOutside, linkedAssetParent, "junction");
    let linkedAssetRejected = false;
    try {
      linkedAssetRejected = throwsError(
        () =>
          a.registerAsset(
            "assets/linked-parent/escaped.bin",
            Buffer.from("blocked asset bytes"),
          ),
        ["directory is not ordinary"],
      );
    } finally {
      fs.rmSync(linkedAssetParent, { force: true });
    }
    TestValidator.predicate(
      "a linked resident parent cannot redirect an asset publication",
      linkedAssetRejected &&
        fs.existsSync(path.join(linkedAssetOutside, "escaped.bin")) === false,
    );

    fs.renameSync = ((oldPath, newPath) => {
      if (
        path.resolve(oldPath.toString()) ===
        path.join(root, "actors", "knightA.json")
      )
        throw Object.assign(new Error("actor rename denied"), {
          code: "EACCES",
        });
      nativeRename(oldPath, newPath);
    }) as typeof fs.renameSync;
    let deniedRemoval = false;
    try {
      deniedRemoval = throwsError(
        () => a.removeActor("knightA"),
        ["actor rename denied"],
      );
    } finally {
      fs.renameSync = nativeRename;
    }
    TestValidator.predicate(
      "a non-ENOENT actor quarantine failure preserves the resident slice",
      deniedRemoval && fs.existsSync(path.join(root, "actors", "knightA.json")),
    );

    const knightFile = path.join(root, "actors", "knightA.json");
    const knightBytes = fs.readFileSync(knightFile);
    const evidenceBeforeRemoval = new Set(fs.readdirSync(residentEvidence));
    a.removeActor("knightA");
    const removedEvidence = fs
      .readdirSync(residentEvidence)
      .filter((file) => evidenceBeforeRemoval.has(file) === false)
      .find((file) =>
        fs.readFileSync(path.join(residentEvidence, file)).equals(knightBytes),
      );
    TestValidator.predicate(
      "a normal resident removal retains its exact private predecessor",
      fs.existsSync(knightFile) === false &&
        removedEvidence !== undefined &&
        fs
          .readFileSync(path.join(residentEvidence, removedEvidence))
          .equals(knightBytes),
    );
    a.saveActors([actorSpec("knightA")]);

    const removalSuccessorBytes = fs.readFileSync(knightFile);
    const evidenceBeforeSuccessor = new Set(fs.readdirSync(residentEvidence));
    let removalSuccessorInstalled = false;
    fs.renameSync = ((oldPath, newPath) => {
      nativeRename(oldPath, newPath);
      if (
        removalSuccessorInstalled === false &&
        path.resolve(oldPath.toString()) === knightFile &&
        path.dirname(path.resolve(newPath.toString())) === residentEvidence
      ) {
        fs.writeFileSync(knightFile, removalSuccessorBytes);
        removalSuccessorInstalled = true;
      }
    }) as typeof fs.renameSync;
    let removalSuccessorRejected = false;
    try {
      removalSuccessorRejected = throwsError(
        () => a.removeActor("knightA"),
        ["pathname successor"],
      );
    } finally {
      fs.renameSync = nativeRename;
    }
    const successorEvidence = fs
      .readdirSync(residentEvidence)
      .find((file) => evidenceBeforeSuccessor.has(file) === false);
    TestValidator.predicate(
      "resident removal preserves a source successor and its exact predecessor",
      removalSuccessorInstalled &&
        removalSuccessorRejected &&
        fs.readFileSync(knightFile).equals(removalSuccessorBytes) &&
        successorEvidence !== undefined &&
        fs
          .readFileSync(path.join(residentEvidence, successorEvidence))
          .equals(removalSuccessorBytes),
    );

    const removalParkedRoot = `${root}.removal-parked`;
    const evidenceBeforeRootSwap = new Set(fs.readdirSync(residentEvidence));
    let removalSwapped = false;
    fs.renameSync = ((oldPath, newPath) => {
      nativeRename(oldPath, newPath);
      if (
        removalSwapped === false &&
        path.resolve(oldPath.toString()) ===
          path.join(root, "actors", "knightA.json") &&
        path.dirname(path.resolve(newPath.toString())) === residentEvidence
      ) {
        nativeRename(root, removalParkedRoot);
        fs.mkdirSync(root);
        removalSwapped = true;
      }
    }) as typeof fs.renameSync;
    let removalSwapMessage = "";
    try {
      try {
        a.removeActor("knightA");
      } catch (error) {
        removalSwapMessage = (error as Error).message;
      }
    } finally {
      fs.renameSync = nativeRename;
    }
    const removalReplacementEmpty = fs.readdirSync(root).length === 0;
    const parkedResidentEvidence = path.join(
      removalParkedRoot,
      ".automovie-resident-evidence",
    );
    const quarantinedActor = fs
      .readdirSync(parkedResidentEvidence)
      .find((file) => evidenceBeforeRootSwap.has(file) === false);
    fs.rmSync(root, { recursive: true, force: true });
    fs.renameSync(removalParkedRoot, root);
    fs.rmSync(path.join(root, "revision.lock"), { force: true });
    if (quarantinedActor !== undefined)
      fs.renameSync(
        path.join(root, ".automovie-resident-evidence", quarantinedActor),
        path.join(root, "actors", "knightA.json"),
      );
    TestValidator.predicate(
      "a removal-time root swap preserves the quarantined original and replacement",
      removalSwapped &&
        removalSwapMessage.includes(
          "root identity or namespace fence changed",
        ) &&
        removalReplacementEmpty &&
        quarantinedActor !== undefined &&
        fs.existsSync(path.join(root, "actors", "knightA.json")),
    );
    a.writableSlate();

    const nativeWrite = fs.writeFileSync;
    const lockParkedRoot = `${root}.lock-parked`;
    let lockSwapped = false;
    fs.writeFileSync = ((
      file: fs.PathOrFileDescriptor,
      ...args: unknown[]
    ): unknown => {
      const output = Reflect.apply(nativeWrite, fs, [file, ...args]);
      if (
        lockSwapped === false &&
        typeof file !== "number" &&
        path.resolve(file.toString()) === path.join(root, "revision.lock")
      ) {
        fs.renameSync(root, lockParkedRoot);
        fs.mkdirSync(root);
        Reflect.apply(nativeWrite, fs, [
          path.join(root, "revision.lock"),
          ...args,
        ]);
        lockSwapped = true;
      }
      return output;
    }) as typeof fs.writeFileSync;
    let lockSwapMessage = "";
    try {
      try {
        a.saveActors([actorSpec("lockSwap")]);
      } catch (error) {
        lockSwapMessage = (error as Error).message;
      }
    } finally {
      fs.writeFileSync = nativeWrite;
    }
    const replacementLockPreserved = fs.existsSync(
      path.join(root, "revision.lock"),
    );
    fs.rmSync(root, { recursive: true, force: true });
    fs.renameSync(lockParkedRoot, root);
    fs.rmSync(path.join(root, "revision.lock"), { force: true });
    TestValidator.predicate(
      "a root swap after lock acquisition cannot unlink a copied replacement token",
      lockSwapped &&
        lockSwapMessage.includes("root identity or namespace fence changed") &&
        replacementLockPreserved,
    );

    const operationParkedRoot = `${root}.operation-parked`;
    let operationSwapped = false;
    fs.openSync = ((file, flags, ...args: unknown[]): number => {
      const descriptor = Reflect.apply(nativeOpen, fs, [
        file,
        flags,
        ...args,
      ]) as number;
      if (
        operationSwapped === false &&
        typeof file !== "number" &&
        path.resolve(file.toString()) ===
          path.join(root, "actors", "rootSwap.json") &&
        flags === "wx+"
      ) {
        fs.renameSync(root, operationParkedRoot);
        fs.mkdirSync(root);
        operationSwapped = true;
      }
      return descriptor;
    }) as typeof fs.openSync;
    let operationMessage = "";
    try {
      try {
        a.saveActors([actorSpec("rootSwap")]);
      } catch (error) {
        operationMessage = (error as Error).message;
      }
    } finally {
      fs.openSync = nativeOpen;
    }
    const replacementStayedEmpty = fs.readdirSync(root).length === 0;
    const originalLockPreserved = fs.existsSync(
      path.join(operationParkedRoot, "revision.lock"),
    );
    const originalPartialEvidence =
      fs.readFileSync(path.join(operationParkedRoot, "actors", "rootSwap.json"))
        .length === 0;
    let replacementLeaseReacquired = false;
    try {
      AutoMovieProject.open(root).writableSlate();
      replacementLeaseReacquired = true;
    } catch {
      replacementLeaseReacquired = false;
    }
    fs.rmSync(root, { recursive: true, force: true });
    fs.renameSync(operationParkedRoot, root);
    fs.rmSync(path.join(root, "revision.lock"), { force: true });
    fs.rmSync(path.join(root, "actors", "rootSwap.json"), { force: true });
    TestValidator.predicate(
      "an operation-time root swap cannot publish or release through the replacement",
      operationSwapped &&
        operationMessage.includes("root identity or namespace fence changed") &&
        replacementStayedEmpty &&
        originalLockPreserved &&
        originalPartialEvidence &&
        replacementLeaseReacquired,
    );

    const parkedRoot = `${root}.owner-parked`;
    fs.renameSync(root, parkedRoot);
    fs.mkdirSync(root);
    let replacementUntouched = false;
    let replacedReadRejected = false;
    let replacedMutationRejected = false;
    try {
      replacedReadRejected = throwsError(
        () => a.writableSlate(),
        ["root", "changed physical identity", "Discard this project handle"],
      );
      replacedMutationRejected = throwsError(
        () => a.saveSlate(slateOf("must not enter replacement")),
        ["root", "changed physical identity", "Discard this project handle"],
      );
      replacementUntouched = fs.readdirSync(root).length === 0;
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
      fs.renameSync(parkedRoot, root);
    }
    TestValidator.predicate(
      "a live project handle never follows a replacement root namespace",
      replacedReadRejected && replacedMutationRejected && replacementUntouched,
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }

  const aliasSandbox = fs.mkdtempSync(
    path.join(os.tmpdir(), "automovie-txn-alias-"),
  );
  try {
    const physicalA = path.join(aliasSandbox, "physical-a");
    const physicalB = path.join(aliasSandbox, "physical-b");
    const alias = path.join(aliasSandbox, "project-parent");
    fs.mkdirSync(physicalA);
    fs.mkdirSync(path.join(physicalB, "project"), { recursive: true });
    fs.symlinkSync(
      physicalA,
      alias,
      process.platform === "win32" ? "junction" : "dir",
    );
    const project = AutoMovieProject.open(path.join(alias, "project"));
    const canonicalRoot = path.join(physicalA, "project");
    const nativeAliasOpen = fs.openSync;
    let aliasRetargeted = false;
    fs.openSync = ((file, flags, ...args: unknown[]): number => {
      const descriptor = Reflect.apply(nativeAliasOpen, fs, [
        file,
        flags,
        ...args,
      ]) as number;
      if (
        aliasRetargeted === false &&
        typeof file !== "number" &&
        path.resolve(file.toString()) ===
          path.join(canonicalRoot, "script.json") &&
        flags === "wx+"
      ) {
        fs.unlinkSync(alias);
        fs.symlinkSync(
          physicalB,
          alias,
          process.platform === "win32" ? "junction" : "dir",
        );
        aliasRetargeted = true;
      }
      return descriptor;
    }) as typeof fs.openSync;
    try {
      project.saveSlate(slateOf("canonical physical root"));
    } finally {
      fs.openSync = nativeAliasOpen;
    }
    TestValidator.predicate(
      "an operation-time ancestor alias retarget cannot redirect a live handle",
      aliasRetargeted &&
        fs
          .readFileSync(path.join(canonicalRoot, "script.json"), "utf8")
          .includes("canonical physical root") &&
        fs.readdirSync(path.join(physicalB, "project")).length === 0,
    );
  } finally {
    fs.rmSync(aliasSandbox, { recursive: true, force: true });
  }
};
