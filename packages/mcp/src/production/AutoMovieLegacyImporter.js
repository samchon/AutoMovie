import { randomUUID } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import typia from "typia";
import { AutoMovieProject, checkAssetPath } from "../project/AutoMovieProject";
import { acquireCommitLock, releaseCommitLock } from "../project/commitLock";
import { canonicalAutoMovieJsonBytes, compareCodeUnits, digestAutoMovieBytes, encodeAutoMoviePathSegment, } from "./contentIdentity";
import { readAutoMovieProductionOwnedFile } from "./productionRenderJob";
import { acquireProductionRootNamespace, assertProductionRootNamespaceLease, releaseProductionRootNamespace, } from "./rootNamespaceLock";
const LEGACY_IMPORT_PROTOCOL = "automovie.legacy-import.v1";
const IMPORT_PLAN_PATH = "imports/legacy-v1/plan.json";
const IMPORT_STATE_PATH = "imports/legacy-v1/state.json";
const PROJECT_FILES = [
    "automovie.json",
    "script.json",
    "scene.json",
    "notes.json",
    "film.json",
];
const PROJECT_DIRECTORIES = [
    "scenes",
    "shots",
    "beatEnds",
    "props",
    "actors",
];
const PRODUCTION_STATE_DIRECTORIES = [
    "design/models",
    "design/formations",
    "design/shots",
    "design/acceptance",
    "reviews/design/models",
    "reviews/design/formations",
    "reviews/design/shots",
    "reviews/design/acceptances",
    "reviews/source",
    "reviews/shots",
    "reviews/film",
    "render-receipts",
    "imports/legacy-v1",
];
class LegacyImportCleanupError extends AggregateError {
}
/** Remove one temporary import directory without losing earlier failures. */
const removeLegacyImportTemporary = (temporary, failure, resource) => {
    try {
        fs.rmSync(temporary, { force: true, recursive: true });
    }
    catch (cleanupFailure) {
        if (failure === undefined)
            throw cleanupFailure;
        throw new LegacyImportCleanupError([failure.error, cleanupFailure], `Legacy import cleanup failed after the operation failed: ${resource}.`);
    }
};
/**
 * Non-destructive bridge from the resident v1 project into production v2.
 *
 * Planning copies the captured legacy bytes to an operating-system temporary
 * directory before opening the v1 store, so validation cannot initialize or
 * normalize the user's tree. Applying adds one atomic `.automovie` state root
 * containing provenance and drafts; every pre-existing legacy byte remains
 * untouched. Rollback is allowed only while that imported state is exact and
 * any production-owned directories created by a later open remain empty.
 */
export class AutoMovieLegacyImporter {
    rootDirectory;
    constructor(rootDirectory) {
        this.rootDirectory = rootDirectory;
    }
    /** Inspect and validate a legacy project without mutating its directory. */
    plan() {
        const root = validateLegacyRoot(this.rootDirectory);
        const lease = acquireProductionRootNamespace(root);
        try {
            assertProductionRootNamespaceLease(lease);
            const output = planFromSnapshot(readLegacySnapshot(lease.root));
            assertProductionRootNamespaceLease(lease);
            return output;
        }
        finally {
            releaseProductionRootNamespace(lease);
        }
    }
    /** Persist one immutable import plan and v2 provenance atomically. */
    apply() {
        const root = validateLegacyRoot(this.rootDirectory);
        const lease = acquireProductionRootNamespace(root);
        try {
            assertProductionRootNamespaceLease(lease);
            const lockPath = path.join(lease.root, "revision.lock");
            const token = acquireCommitLock(lockPath);
            try {
                assertProductionRootNamespaceLease(lease);
                const output = this.applyLocked(lease, token);
                assertProductionRootNamespaceLease(lease);
                return output;
            }
            finally {
                releaseResidentLockIfCurrent(lease, lockPath, token);
            }
        }
        finally {
            releaseProductionRootNamespace(lease);
        }
    }
    applyLocked(lease, lockToken) {
        const root = lease.root;
        const stateRoot = path.join(root, ".automovie");
        const existing = lstatOrNull(stateRoot);
        if (existing !== null) {
            if (existing.isSymbolicLink() || existing.isDirectory() === false)
                throw new Error(`Production state root "${stateRoot}" is not a physical directory. Remove the collision before applying the legacy import.`);
            const prior = readJson(stateRoot, IMPORT_PLAN_PATH);
            if (prior !== null && verifyAppliedImport(stateRoot, root, prior)) {
                const snapshot = readLegacySnapshot(root, lockToken);
                snapshot.rollbackBaseline = prior.rollbackBaseline;
                if (planFromSnapshot(snapshot).fingerprint === prior.fingerprint)
                    return { status: "unchanged", plan: prior };
            }
            throw new Error(`Production state root "${stateRoot}" already exists with a different or incomplete import. Preserve it and choose a clean legacy project root.`);
        }
        const plan = planFromSnapshot(readLegacySnapshot(root, lockToken));
        const state = {
            version: 1,
            fingerprint: plan.fingerprint,
            incarnation: randomUUID(),
        };
        const files = appliedImportFiles(root, plan, state);
        assertProductionRootNamespaceLease(lease);
        const staging = fs.mkdtempSync(path.join(root, ".automovie-import-"));
        let stagingFailure;
        try {
            for (const directory of PRODUCTION_STATE_DIRECTORIES)
                fs.mkdirSync(path.join(staging, directory), { recursive: true });
            for (const [relative, bytes] of files) {
                const file = path.join(staging, ...relative.split("/"));
                fs.mkdirSync(path.dirname(file), { recursive: true });
                fs.writeFileSync(file, bytes);
            }
            assertProductionRootNamespaceLease(lease);
            fs.renameSync(staging, stateRoot);
            assertProductionRootNamespaceLease(lease);
        }
        catch (error) {
            stagingFailure = { error };
            throw error;
        }
        finally {
            let leaseCurrent = true;
            try {
                assertProductionRootNamespaceLease(lease);
            }
            catch {
                leaseCurrent = false;
            }
            // A replaced root must not receive cleanup intended for the lease root.
            if (leaseCurrent && fs.existsSync(staging))
                removeLegacyImportTemporary(staging, stagingFailure, "import publication staging directory");
        }
        return { status: "applied", plan };
    }
    /** Remove one still-untouched applied import, preserving all legacy bytes. */
    rollback() {
        const root = validateLegacyRoot(this.rootDirectory);
        const lease = acquireProductionRootNamespace(root);
        try {
            assertProductionRootNamespaceLease(lease);
            const stateRoot = path.join(lease.root, ".automovie");
            const linked = lstatOrNull(stateRoot);
            if (linked === null ||
                linked.isSymbolicLink() ||
                linked.isDirectory() === false)
                throw new Error(`No physical applied legacy import exists at "${stateRoot}". Nothing was rolled back.`);
            const lockPath = path.join(stateRoot, "revision.lock");
            const token = acquireCommitLock(lockPath);
            const output = this.rollbackLocked(lease, stateRoot, lockPath, token);
            assertProductionRootNamespaceLease(lease);
            return output;
        }
        finally {
            releaseProductionRootNamespace(lease);
        }
    }
    rollbackLocked(lease, stateRoot, lockPath, token) {
        const root = lease.root;
        try {
            assertProductionRootNamespaceLease(lease);
            const plan = readJson(stateRoot, IMPORT_PLAN_PATH);
            const appliedState = readAppliedImportState(stateRoot, plan);
            if (plan === null ||
                appliedState === null ||
                verifyAppliedImport(stateRoot, root, plan, appliedState, {
                    path: "revision.lock",
                    bytes: Buffer.from(token, "utf8"),
                }) === false)
                throw changedImportError(stateRoot, IMPORT_PLAN_PATH);
            assertRollbackBaseline(root, plan.rollbackBaseline);
            const quarantine = path.join(root, `.automovie-rollback-${process.pid}-${Date.now()}`);
            const removed = [];
            assertProductionRootNamespaceLease(lease);
            fs.renameSync(stateRoot, quarantine);
            assertProductionRootNamespaceLease(lease);
            try {
                for (const baseline of plan.rollbackBaseline)
                    if (baseline.existed === false) {
                        const directory = path.join(root, baseline.path);
                        if (fs.existsSync(directory)) {
                            assertProductionRootNamespaceLease(lease);
                            fs.rmdirSync(directory);
                            assertProductionRootNamespaceLease(lease);
                            removed.push(directory);
                        }
                    }
                assertProductionRootNamespaceLease(lease);
                fs.rmSync(quarantine, { recursive: true });
                assertProductionRootNamespaceLease(lease);
            }
            catch (error) {
                try {
                    assertProductionRootNamespaceLease(lease);
                }
                catch (identityError) {
                    throw new AggregateError([error, identityError], `Legacy import rollback stopped because project root "${root}" changed physical identity. No restoration was attempted in the replacement root.`);
                }
                const restorationErrors = [];
                if (fs.existsSync(stateRoot) === false) {
                    try {
                        if (fs.existsSync(quarantine) &&
                            verifyAppliedImport(quarantine, root, plan, appliedState, {
                                path: "revision.lock",
                                bytes: Buffer.from(token, "utf8"),
                            }))
                            fs.renameSync(quarantine, stateRoot);
                        else {
                            restoreAppliedImport(stateRoot, root, plan, appliedState, token);
                            try {
                                fs.rmSync(quarantine, { force: true, recursive: true });
                            }
                            catch {
                                // The authoritative applied state is restored at `.automovie`.
                            }
                        }
                    }
                    catch (restorationError) {
                        restorationErrors.push(restorationError);
                    }
                }
                for (const directory of removed)
                    try {
                        fs.mkdirSync(directory);
                    }
                    catch (restorationError) {
                        restorationErrors.push(restorationError);
                    }
                if (restorationErrors.length !== 0)
                    throw new AggregateError([error, ...restorationErrors], `Legacy import rollback failed and restoration was incomplete. Preserve "${quarantine}" and repair the reported paths before retrying.`);
                if (fs.existsSync(stateRoot) === false)
                    throw new Error(`Legacy import rollback failed and the applied state remains preserved at "${quarantine}": ${String(error)}`);
                throw new Error(`Legacy import rollback could not complete and the applied state was restored: ${String(error)}`);
            }
            // The successful rollback removed the resident lock with the quarantined
            // state root. Retire every matching process-local nesting level so an
            // outer holder cannot re-enter a lock whose physical namespace vanished.
            // Never follow the removed path into a concurrently recreated root.
            releaseCommitLock(lockPath, token, { retire: true });
            return { status: "rolled-back", fingerprint: plan.fingerprint };
        }
        catch (error) {
            releaseResidentLockIfCurrent(lease, lockPath, token);
            throw error;
        }
    }
}
const releaseResidentLockIfCurrent = (lease, lockPath, token) => {
    try {
        assertProductionRootNamespaceLease(lease);
    }
    catch {
        // Release only process-local ownership: never follow a stale resident path
        // into a replacement root.
        releaseCommitLock(lockPath, token, { unlink: false });
        return;
    }
    releaseCommitLock(lockPath, token);
};
const planFromSnapshot = (snapshot) => withLegacyProject(snapshot, (legacy) => createPlan(snapshot, {
    slate: legacy.writableSlate(),
    props: legacy.storedProps().length,
    actors: legacy.storedActors().length,
}));
const createPlan = (snapshot, legacy) => {
    const fps = legacy.slate.film?.fps ?? 30;
    const rawRuntime = legacy.slate.shots.reduce((sum, shot) => sum + shot.duration, 0);
    const targetRuntimeSeconds = Math.max(1, Math.round(rawRuntime * fps)) / fps;
    const projectId = projectIdOf(snapshot.root);
    const productionDraft = {
        id: projectId,
        title: projectId,
        logline: legacy.slate.script?.logline.trim() ||
            "Legacy project import awaiting treatment reconstruction.",
        targetRuntimeSeconds,
        visualDelivery: "deterministic",
        frameFormat: {
            width: 1280,
            height: 720,
            fps,
            colorSpace: "srgb",
        },
        artDirection: {
            style: "primitive-3d",
            palette: ["#808080"],
            silhouettePriority: "Draft only: reconstruct silhouette priorities from legacy references.",
            scaleGrammar: "Draft only: reconstruct scale grammar from legacy scenes and assets.",
        },
        deliverables: [{ id: "legacy-preview", kind: "preview", required: false }],
    };
    const shotContractDrafts = legacy.slate.shots.map((shot) => draftShotContract(shot, fps));
    const sourceTodos = shotContractDrafts.map((shot) => ({
        shot: shot.id,
        module: shot.source.module,
        export: shot.source.export,
        reason: "Legacy storage persisted compiled motion references, not the authoring TypeScript that produced them. Write and review this source before compilation.",
    }));
    const diagnostics = [
        importWarning("legacy-frame-format-defaulted", "production", null, "Legacy storage has no authoritative raster or color-space contract. Review the 1280x720 sRGB draft before activating it."),
        importWarning("legacy-art-direction-defaulted", "production", null, "Legacy storage has no structured production art direction. Replace the neutral palette and draft grammar from project evidence."),
        importWarning("legacy-edit-reconstruction-required", "film", "film.json", "Legacy film cuts remain untouched and are not promoted to a production edit contract. Reconstruct and review the edit timeline."),
        importWarning("legacy-design-reconstruction-required", "legacy-project", null, `Legacy scenes, ${legacy.props} props, and ${legacy.actors} actor contexts remain evidence only. Author production world, model, formation, and acceptance designs explicitly.`),
        ...sourceTodos.map((todo) => importWarning("legacy-source-unrecoverable", `shot:${todo.shot}`, todo.module, todo.reason)),
        ...legacy.slate.shots
            .filter((shot) => shot.performances.length === 0)
            .map((shot) => importWarning("legacy-camera-subject-reconstruction-required", `shot:${shot.id}`, `src/shots/${encodeAutoMoviePathSegment(shot.id)}.ts`, `Legacy shot "${shot.id}" names no performing scene node, so its readable camera subject cannot be inferred. Choose at least one compiled scene-node or formation id before submitting the production shot contract.`)),
        ...[...snapshot.files]
            .filter(([, bytes]) => bytes === null)
            .map(([relative]) => importWarning("legacy-asset-missing", "legacy-project", relative, `Registered legacy asset "${relative}" is absent. Restore or unregister it before relying on imported production evidence.`)),
    ];
    const inventory = inventoryEntries(snapshot.files, snapshot.assets);
    const content = {
        version: 1,
        legacyRevision: snapshot.revision,
        inventory,
        rollbackBaseline: snapshot.rollbackBaseline,
        productionDraft,
        shotContractDrafts,
        sourceTodos,
        diagnostics,
    };
    return {
        ...content,
        fingerprint: digestAutoMovieBytes(canonicalAutoMovieJsonBytes({
            protocol: LEGACY_IMPORT_PROTOCOL,
            ...content,
        })),
    };
};
const inventoryEntries = (files, assets) => [...files]
    .map(([relative, bytes]) => ({
    path: relative,
    bytes: bytes?.byteLength ?? 0,
    digest: bytes === null ? null : digestAutoMovieBytes(bytes),
    kind: assets.includes(relative) ? "asset" : "project",
}))
    .sort((left, right) => compareCodeUnits(left.path, right.path));
const draftShotContract = (shot, fps) => {
    const durationSeconds = Math.max(1, Math.round(Math.max(shot.duration, 0) * fps)) / fps;
    const actors = [
        ...new Set(shot.performances.map((performance) => performance.node)),
    ];
    return {
        id: shot.id,
        beat: shot.id,
        source: {
            module: `src/shots/${encodeAutoMoviePathSegment(shot.id)}.ts`,
            export: "buildLegacyShot",
        },
        durationSeconds,
        participants: actors.map((id) => ({ kind: "actor", id })),
        opening: [],
        closing: [],
        camera: {
            intent: `Reconstruct legacy camera "${shot.camera}" from scene and shot evidence.`,
            requiredSubjects: actors,
            maxOcclusionRatio: 1,
        },
        events: [],
        reviewFrames: [{ id: "legacy-start", time: 0, passes: ["beauty"] }],
    };
};
const captureRollbackBaseline = (root) => ["src", "generated", "renders"].map((relative) => {
    const absolute = path.join(root, relative);
    const status = lstatOrNull(absolute);
    if (status === null)
        return {
            path: relative,
            existed: false,
            directories: [],
            files: [],
        };
    if (status.isSymbolicLink() || status.isDirectory() === false)
        throw new Error(`Production-owned rollback baseline "${absolute}" must be a physical directory.`);
    const files = new Map();
    const directories = [];
    collectDirectory(root, relative, files, directories);
    directories.sort(compareCodeUnits);
    return {
        path: relative,
        existed: true,
        directories,
        files: inventoryEntries(files, []),
    };
});
const validateLegacyRoot = (rootDirectory) => {
    const root = path.resolve(rootDirectory);
    const status = lstatOrNull(root);
    if (status === null ||
        status.isSymbolicLink() ||
        status.isDirectory() === false ||
        path.parse(root).root === root)
        throw new Error(`Legacy project root "${root}" must be one physical, dedicated project directory.`);
    return fs.realpathSync(root);
};
const readLegacySnapshot = (rootDirectory, lockToken) => {
    const root = validateLegacyRoot(rootDirectory);
    assertLegacyLock(root, lockToken);
    const revisionBefore = readLegacyRevisionSnapshot(root);
    const manifestBytes = readPhysicalFile(root, "automovie.json", true);
    const manifest = validateLegacyManifest(parseJson(manifestBytes, path.join(root, "automovie.json")), path.join(root, "automovie.json"));
    const files = new Map([
        ["automovie.json", manifestBytes],
    ]);
    for (const relative of PROJECT_FILES.slice(1)) {
        const bytes = readPhysicalFile(root, relative, false);
        if (bytes !== null)
            files.set(relative, bytes);
    }
    if (revisionBefore.bytes !== null)
        files.set("revision.json", revisionBefore.bytes);
    for (const relative of PROJECT_DIRECTORIES)
        collectDirectory(root, relative, files);
    const assets = manifest.assets.map((asset) => {
        const checked = checkAssetPath(asset);
        if ("fault" in checked || checked.path !== asset)
            throw new Error(`Legacy manifest asset "${asset}" is not one canonical project-relative path. Correct automovie.json before import.`);
        if (files.has(asset) === false)
            files.set(asset, readPhysicalFile(root, asset, false));
        return asset;
    });
    const folded = new Map();
    for (const relative of files.keys()) {
        const previous = folded.get(relative.toLowerCase());
        if (previous !== undefined && previous !== relative)
            throw new Error(`Legacy paths "${previous}" and "${relative}" collide by case. Rename one before import.`);
        folded.set(relative.toLowerCase(), relative);
    }
    const rollbackBaseline = captureRollbackBaseline(root);
    const revisionAfter = readLegacyRevisionSnapshot(root);
    assertLegacyLock(root, lockToken);
    if (revisionBefore.revision !== revisionAfter.revision ||
        equalOptionalBytes(revisionBefore.bytes, revisionAfter.bytes) === false)
        throw new Error("Legacy project revision changed while the import snapshot was being captured. Retry plan or apply from one stable resident revision.");
    return {
        root,
        revision: revisionBefore.revision,
        assets,
        files,
        rollbackBaseline,
    };
};
const readLegacyRevisionSnapshot = (root) => {
    const file = path.join(root, "revision.json");
    const bytes = readPhysicalFile(root, "revision.json", false);
    return {
        bytes,
        revision: bytes === null ? 0 : validateLegacyRevision(parseJson(bytes, file), file),
    };
};
const assertLegacyLock = (root, lockToken) => {
    const lock = path.join(root, "revision.lock");
    const status = lstatOrNull(lock);
    if (lockToken === undefined) {
        if (status !== null)
            throw new Error(`Legacy project commit lock "${lock}" is active. Retry import planning after the resident commit completes.`);
        return;
    }
    let matches = false;
    if (status !== null && status.isSymbolicLink() === false && status.isFile())
        try {
            const bytes = readPhysicalFile(root, "revision.lock", true);
            matches =
                bytes !== null && Buffer.from(bytes).toString("utf8") === lockToken;
        }
        catch { }
    if (matches === false)
        throw new Error(`Legacy project commit lock "${lock}" changed during import apply. No production state was published.`);
};
const equalOptionalBytes = (left, right) => left === null || right === null
    ? left === right
    : Buffer.from(left).equals(Buffer.from(right));
const withLegacyProject = (snapshot, task) => {
    const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "automovie-legacy-import-"));
    let failure;
    try {
        for (const [relative, bytes] of snapshot.files)
            if (bytes !== null) {
                const file = path.join(temporary, ...relative.split("/"));
                fs.mkdirSync(path.dirname(file), { recursive: true });
                fs.writeFileSync(file, bytes);
            }
        return task(AutoMovieProject.open(temporary));
    }
    catch (error) {
        failure = { error };
        throw error;
    }
    finally {
        removeLegacyImportTemporary(temporary, failure, "legacy planning snapshot");
    }
};
const collectDirectory = (root, relative, files, directories) => {
    const absolute = path.join(root, ...relative.split("/"));
    const status = lstatOrNull(absolute);
    if (status === null)
        return;
    if (status.isSymbolicLink() || status.isDirectory() === false)
        throw new Error(`Legacy inventory directory "${absolute}" must be a physical directory.`);
    for (const entry of fs
        .readdirSync(absolute, { withFileTypes: true })
        .sort((left, right) => compareCodeUnits(left.name, right.name))) {
        const child = `${relative}/${entry.name}`;
        if (entry.isSymbolicLink())
            throw new Error(`Legacy inventory path "${child}" is a symlink or junction. Replace it with physical project content before import.`);
        if (entry.isDirectory()) {
            directories?.push(child);
            collectDirectory(root, child, files, directories);
        }
        else if (entry.isFile())
            files.set(child, readPhysicalFile(root, child, true));
        else
            throw new Error(`Legacy inventory path "${child}" is not a regular file or directory.`);
    }
};
const readPhysicalFile = (root, relative, required) => {
    let current = root;
    let finalStatus = null;
    for (const segment of relative.split("/")) {
        current = path.join(current, segment);
        const status = lstatOrNull(current);
        if (status === null) {
            if (required)
                throw new Error(`Required legacy project file "${current}" is absent.`);
            return null;
        }
        if (status.isSymbolicLink())
            throw new Error(`Legacy project path "${current}" is a symlink or junction. Replace it with physical project content before import.`);
        finalStatus = status;
    }
    if (finalStatus?.isFile() !== true)
        throw new Error(`Legacy project path "${current}" is not a regular file.`);
    return readAutoMovieProductionOwnedFile({
        root,
        directory: root,
        relative,
    });
};
const validateLegacyManifest = (value, file) => {
    if (typeof value !== "object" ||
        value === null ||
        Array.isArray(value) ||
        value.version !== 1 ||
        Array.isArray(value.assets) === false ||
        value.assets.some((asset) => typeof asset !== "string"))
        throw new Error(`Legacy manifest "${file}" must contain version 1 and a string asset array.`);
    return value;
};
const validateLegacyRevision = (value, file) => {
    const revision = value?.revision;
    if (typeof revision !== "number" ||
        Number.isSafeInteger(revision) === false ||
        revision < 0)
        throw new Error(`Legacy revision "${file}" must contain one non-negative safe integer.`);
    return revision;
};
const planFingerprint = (plan) => digestAutoMovieBytes(canonicalAutoMovieJsonBytes({
    protocol: LEGACY_IMPORT_PROTOCOL,
    version: plan.version,
    legacyRevision: plan.legacyRevision,
    inventory: plan.inventory,
    rollbackBaseline: plan.rollbackBaseline,
    productionDraft: plan.productionDraft,
    shotContractDrafts: plan.shotContractDrafts,
    sourceTodos: plan.sourceTodos,
    diagnostics: plan.diagnostics,
}));
const isCanonicalBaseline = (baseline, expectedPath) => {
    if (baseline.path !== expectedPath ||
        (baseline.existed === false &&
            (baseline.directories.length !== 0 || baseline.files.length !== 0)))
        return false;
    let previousDirectory = null;
    for (const directory of baseline.directories) {
        if (isCanonicalBaselinePath(directory, expectedPath) === false ||
            (previousDirectory !== null &&
                compareCodeUnits(previousDirectory, directory) >= 0))
            return false;
        previousDirectory = directory;
    }
    let previous = null;
    for (const file of baseline.files) {
        if (file.kind !== "project" ||
            file.digest === null ||
            file.bytes < 0 ||
            Number.isSafeInteger(file.bytes) === false ||
            isCanonicalBaselinePath(file.path, expectedPath) === false ||
            (previous !== null && compareCodeUnits(previous, file.path) >= 0))
            return false;
        previous = file.path;
    }
    return true;
};
const isCanonicalBaselinePath = (value, expectedPath) => value.startsWith(`${expectedPath}/`) &&
    value.includes("\\") === false &&
    value
        .split("/")
        .every((segment) => segment.length !== 0 && segment !== "." && segment !== "..");
const validatePlan = (value) => {
    const validation = typia.validateEquals(value);
    if (validation.success === false)
        return false;
    const plan = validation.data;
    return (plan.rollbackBaseline.length === 3 &&
        isCanonicalBaseline(plan.rollbackBaseline[0], "src") &&
        isCanonicalBaseline(plan.rollbackBaseline[1], "generated") &&
        isCanonicalBaseline(plan.rollbackBaseline[2], "renders") &&
        plan.fingerprint === planFingerprint(plan));
};
const productionManifestOf = (root, plan) => ({
    formatVersion: 2,
    projectId: projectIdOf(root),
    sourceRoots: ["src"],
    generatedRoot: "generated",
    renderRoot: "renders",
    importedLegacy: {
        revision: plan.legacyRevision,
        sourceRoot: ".",
    },
});
const appliedImportFiles = (root, plan, state) => new Map([
    ["manifest.json", serializeJson(productionManifestOf(root, plan))],
    ["incarnation.json", serializeJson({ version: 1, id: state.incarnation })],
    ["revision.json", serializeJson({ revision: 0 })],
    [IMPORT_PLAN_PATH, serializeJson(plan)],
    [IMPORT_STATE_PATH, serializeJson(state)],
]);
const expectedStateDirectories = () => {
    const output = new Set();
    for (const relative of PRODUCTION_STATE_DIRECTORIES) {
        let current = "";
        for (const segment of relative.split("/")) {
            current = current.length === 0 ? segment : `${current}/${segment}`;
            output.add(current);
        }
    }
    return [...output].sort(compareCodeUnits);
};
const collectStateTree = (root) => {
    const directories = [];
    const files = [];
    const visit = (directory) => {
        for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
            const absolute = path.join(directory, entry.name);
            const relative = path.relative(root, absolute).split(path.sep).join("/");
            if (entry.isSymbolicLink())
                throw changedImportError(root, relative);
            if (entry.isDirectory()) {
                directories.push(relative);
                visit(absolute);
            }
            else if (entry.isFile())
                files.push(relative);
            else
                throw changedImportError(root, relative);
        }
    };
    visit(root);
    return {
        directories: directories.sort(compareCodeUnits),
        files: files.sort(compareCodeUnits),
    };
};
const equalStrings = (left, right) => left.length === right.length &&
    left.every((value, index) => value === right[index]);
const verifyAppliedImport = (stateRoot, root, planValue, appliedState, toleratedFile) => {
    try {
        const currentState = appliedState === undefined
            ? readAppliedImportState(stateRoot, planValue)
            : appliedState;
        if (validatePlan(planValue) === false || currentState === null)
            return false;
        const expected = appliedImportFiles(root, planValue, currentState);
        const expectedFiles = [...expected.keys()];
        if (toleratedFile !== undefined)
            expectedFiles.push(toleratedFile.path);
        expectedFiles.sort(compareCodeUnits);
        const tree = collectStateTree(stateRoot);
        if (equalStrings(tree.directories, expectedStateDirectories()) === false ||
            equalStrings(tree.files, expectedFiles) === false)
            return false;
        for (const [relative, bytes] of expected) {
            const actual = readPhysicalFile(stateRoot, relative, true);
            if (actual === null ||
                Buffer.from(actual).equals(Buffer.from(bytes)) === false)
                return false;
        }
        if (toleratedFile !== undefined) {
            const actual = readPhysicalFile(stateRoot, toleratedFile.path, true);
            if (actual === null ||
                Buffer.from(actual).equals(Buffer.from(toleratedFile.bytes)) === false)
                return false;
        }
        return true;
    }
    catch (error) {
        const code = error.code;
        if (code !== undefined && code !== "ENOENT" && code !== "ENOTDIR")
            throw error;
        return false;
    }
};
const sameInventory = (left, right) => left.length === right.length &&
    left.every((entry, index) => {
        const other = right[index];
        return (other !== undefined &&
            entry.path === other.path &&
            entry.bytes === other.bytes &&
            entry.digest === other.digest &&
            entry.kind === other.kind);
    });
const assertRollbackBaseline = (root, baselines) => {
    for (const baseline of baselines) {
        const directory = path.join(root, baseline.path);
        const status = lstatOrNull(directory);
        if (baseline.existed === false) {
            if (status !== null &&
                (status.isSymbolicLink() ||
                    status.isDirectory() === false ||
                    fs.readdirSync(directory).length !== 0))
                throw new Error(`Production-owned directory "${directory}" contains work created after import. Preserve it; rollback refused.`);
            continue;
        }
        if (status === null ||
            status.isSymbolicLink() ||
            status.isDirectory() === false)
            throw new Error(`Production-owned directory "${directory}" changed after import. Restore its pre-import contents before rollback.`);
        const files = new Map();
        const directories = [];
        collectDirectory(root, baseline.path, files, directories);
        directories.sort(compareCodeUnits);
        if (equalStrings(baseline.directories, directories) === false ||
            sameInventory(baseline.files, inventoryEntries(files, [])) === false)
            throw new Error(`Production-owned directory "${directory}" changed after import. Preserve current work; rollback refused.`);
    }
};
const restoreAppliedImport = (stateRoot, root, plan, state, lockToken) => {
    const staging = fs.mkdtempSync(path.join(root, ".automovie-restore-"));
    let failure;
    try {
        for (const directory of PRODUCTION_STATE_DIRECTORIES)
            fs.mkdirSync(path.join(staging, directory), { recursive: true });
        for (const [relative, bytes] of appliedImportFiles(root, plan, state)) {
            const file = path.join(staging, ...relative.split("/"));
            fs.mkdirSync(path.dirname(file), { recursive: true });
            fs.writeFileSync(file, bytes);
        }
        fs.writeFileSync(path.join(staging, "revision.lock"), Buffer.from(lockToken, "utf8"));
        fs.renameSync(staging, stateRoot);
    }
    catch (error) {
        failure = { error };
        throw error;
    }
    finally {
        if (fs.existsSync(staging))
            removeLegacyImportTemporary(staging, failure, "rollback restoration staging directory");
    }
};
const readAppliedImportState = (stateRoot, planValue) => {
    try {
        if (validatePlan(planValue) === false)
            return null;
        const value = readJson(stateRoot, IMPORT_STATE_PATH);
        const validation = typia.validateEquals(value);
        if (validation.success === false ||
            validation.data.fingerprint !== planValue.fingerprint ||
            /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u.test(validation.data.incarnation) === false)
            return null;
        return validation.data;
    }
    catch (error) {
        if (error instanceof InvalidLegacyImportJsonError)
            return null;
        throw error;
    }
};
const changedImportError = (stateRoot, relative) => new Error(`Applied legacy import path "${relative}" under "${stateRoot}" changed after import. Preserve current production work; rollback refused.`);
const importWarning = (code, target, pathValue, message) => ({
    code,
    category: "warning",
    phase: "project",
    target,
    path: pathValue,
    message,
});
const projectIdOf = (root) => path.basename(root).trim();
const parseJson = (bytes, file) => {
    try {
        return JSON.parse(Buffer.from(bytes).toString("utf8"));
    }
    catch (error) {
        throw new InvalidLegacyImportJsonError(`Invalid JSON "${file}": ${String(error)}`);
    }
};
class InvalidLegacyImportJsonError extends Error {
}
const readJson = (root, relative) => {
    const file = path.join(root, ...relative.split("/"));
    const status = lstatOrNull(file);
    if (status === null)
        return null;
    if (status.isSymbolicLink() || status.isFile() === false)
        throw new Error(`Import state path "${file}" is not a physical file.`);
    return parseJson(readAutoMovieProductionOwnedFile({
        root,
        directory: root,
        relative,
    }), file);
};
const serializeJson = (value) => Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8");
const lstatOrNull = (file) => {
    try {
        return fs.lstatSync(file);
    }
    catch (error) {
        if (error.code === "ENOENT")
            return null;
        throw error;
    }
};
//# sourceMappingURL=AutoMovieLegacyImporter.js.map