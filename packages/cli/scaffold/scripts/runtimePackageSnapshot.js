import { digestAutoMovieBytes, readAutoMovieProductionOwnedFile, } from "@automovie/mcp";
import fs from "node:fs";
import path from "node:path";
/** Capture one package identity and selected runtime bytes as one snapshot. */
export const snapshotRuntimePackage = (props) => {
    if (props.packageName.trim().length === 0 ||
        props.packageName !== props.packageName.trim())
        throw new Error("Runtime package name is invalid.");
    const located = locatePackage(props.entry, props.packageName);
    const entry = readOwnedFile(located.root, path.resolve(props.entry));
    const files = [located.manifest, entry];
    const trees = [];
    const assets = new Map();
    for (const selection of props.assets ?? []) {
        const selected = ownedPath(located.root, selection.relative);
        if (selection.kind === "file") {
            const file = readOwnedFile(located.root, selected);
            files.push(file);
            addAsset(assets, located.root, file);
            continue;
        }
        const inventory = scanTree(located.root, selected);
        trees.push(inventory);
        for (const observed of inventory.files) {
            const file = readOwnedFile(located.root, observed.path);
            if (file.identity !== observed.identity)
                throw new Error(`Runtime package asset "${observed.relative}" changed after inventory.`);
            files.push(file);
            addAsset(assets, located.root, file);
        }
        assertTree(located.root, inventory);
    }
    for (const file of files)
        assertPhysicalFile(file);
    for (const tree of trees)
        assertTree(located.root, tree);
    assertPhysicalDirectory(located.root, "runtime package root");
    const fingerprint = digestAutoMovieBytes(Buffer.from(JSON.stringify({
        files: files
            .map((file) => ({
            identity: file.identity,
            path: path
                .relative(located.root.real, file.path)
                .replaceAll("\\", "/"),
        }))
            .sort((x, y) => compare(x.path, y.path)),
        root: located.root.identity,
        trees: trees.map(treeFingerprint).sort(compare),
    })));
    return {
        assets: [...assets.values()].sort((x, y) => compare(x.path, y.path)),
        entryDigest: digestAutoMovieBytes(entry.bytes),
        fingerprint,
        package: props.packageName,
        root: located.root.real,
        version: located.version,
    };
};
const locatePackage = (entry, packageName) => {
    let directory = path.dirname(path.resolve(entry));
    for (;;) {
        const root = physicalDirectory(directory, "runtime package ancestor");
        let manifest;
        try {
            manifest = readOwnedFile(root, path.join(root.real, "package.json"));
        }
        catch (error) {
            if (error.code !== "ENOENT")
                throw error;
            assertPhysicalDirectory(root, "runtime package ancestor");
        }
        if (manifest !== undefined) {
            const parsed = JSON.parse(manifest.bytes.toString("utf8"));
            if (parsed.name === packageName) {
                if (typeof parsed.version !== "string" ||
                    parsed.version.trim().length === 0)
                    throw new Error(`Runtime package "${packageName}" has no valid version.`);
                if (inside(root.real, path.resolve(entry)) === false)
                    throw new Error(`Runtime package entry for "${packageName}" escapes its root.`);
                assertPhysicalFile(manifest);
                assertPhysicalDirectory(root, "runtime package root");
                return { manifest, root, version: parsed.version };
            }
        }
        const parent = path.dirname(directory);
        if (parent === directory)
            throw new Error(`Resolved package "${packageName}" has no matching package.json ancestor.`);
        directory = parent;
    }
};
const ownedPath = (root, relative) => {
    const segments = relative.split("/");
    if (segments.length === 0 ||
        segments.some((segment) => segment.length === 0 ||
            segment === "." ||
            segment === ".." ||
            segment.includes("\\") ||
            segment.includes("\0")))
        throw new Error(`Runtime package asset path "${relative}" is invalid.`);
    const absolute = path.resolve(root.real, ...segments);
    if (inside(root.real, absolute) === false)
        throw new Error(`Runtime package asset path "${relative}" escapes.`);
    return absolute;
};
const addAsset = (output, root, file) => {
    const relative = path.relative(root.real, file.path).replaceAll("\\", "/");
    const asset = {
        bytes: file.bytes,
        digest: digestAutoMovieBytes(file.bytes),
        path: relative,
    };
    const prior = output.get(relative);
    if (prior !== undefined && prior.digest !== asset.digest)
        throw new Error(`Runtime package asset "${relative}" is inconsistent.`);
    output.set(relative, asset);
};
const readOwnedFile = (root, file) => {
    assertPhysicalDirectory(root, "runtime package root");
    const absolute = path.resolve(file);
    if (inside(root.real, absolute) === false)
        throw new Error(`Runtime package file "${absolute}" escapes its root.`);
    const owner = path.dirname(absolute);
    const relativeOwner = path.relative(root.real, owner);
    const directories = [root];
    let cursor = root.real;
    for (const segment of relativeOwner.length === 0
        ? []
        : relativeOwner.split(path.sep)) {
        cursor = path.join(cursor, segment);
        const identity = physicalDirectory(cursor, "runtime package ancestry");
        if (inside(root.real, identity.real) === false)
            throw new Error("Runtime package ancestry escapes its physical root.");
        directories.push(identity);
    }
    const linked = fs.lstatSync(absolute, { bigint: true });
    if (linked.isSymbolicLink() || linked.isFile() === false)
        throw new Error(`Runtime package file "${absolute}" is not physical.`);
    const identity = physicalVersion(linked);
    const bytes = Buffer.from(readAutoMovieProductionOwnedFile({
        root: root.real,
        directory: owner,
        relative: path.basename(absolute),
    }));
    const resident = fs.lstatSync(absolute, { bigint: true });
    if (resident.isSymbolicLink() ||
        resident.isFile() === false ||
        physicalVersion(resident) !== identity)
        throw new Error(`Runtime package file "${absolute}" changed while its bytes were read.`);
    for (const directory of directories)
        assertPhysicalDirectory(directory, "runtime package ancestry");
    return { bytes, directories, identity, path: absolute };
};
const scanTree = (packageRoot, directory) => {
    const root = physicalDirectory(directory, "runtime package asset tree");
    if (inside(packageRoot.real, root.real) === false)
        throw new Error("Runtime package asset tree escapes its package.");
    const output = { directories: [], files: [], root };
    const visit = (current) => {
        const identity = physicalDirectory(current, "runtime package asset directory");
        if (inside(root.real, identity.real) === false)
            throw new Error("Runtime package asset directory escapes its tree.");
        output.directories.push({
            identity,
            relative: path.relative(root.real, identity.real).replaceAll("\\", "/"),
        });
        for (const name of fs.readdirSync(identity.real).sort(compare)) {
            const absolute = path.join(identity.real, name);
            const status = fs.lstatSync(absolute, { bigint: true });
            if (status.isSymbolicLink())
                throw new Error(`Runtime package asset "${absolute}" is linked.`);
            if (status.isDirectory())
                visit(absolute);
            else if (status.isFile())
                output.files.push({
                    identity: physicalVersion(status),
                    path: absolute,
                    relative: path.relative(root.real, absolute).replaceAll("\\", "/"),
                });
            else
                throw new Error(`Runtime package asset "${absolute}" is not physical.`);
        }
        assertPhysicalDirectory(identity, "runtime package asset directory");
    };
    visit(root.real);
    assertPhysicalDirectory(packageRoot, "runtime package root");
    return output;
};
const assertTree = (packageRoot, expected) => {
    for (const directory of expected.directories)
        assertPhysicalDirectory(directory.identity, "runtime package asset directory");
    const current = scanTree(packageRoot, expected.root.path);
    if (treeFingerprint(current) !== treeFingerprint(expected))
        throw new Error("Runtime package asset tree changed exact inventory.");
};
const treeFingerprint = (tree) => JSON.stringify({
    directories: tree.directories.map((directory) => ({
        identity: directory.identity.version,
        relative: directory.relative,
    })),
    files: tree.files.map((file) => ({
        identity: file.identity,
        relative: file.relative,
    })),
});
const assertPhysicalFile = (expected) => {
    const current = fs.lstatSync(expected.path, { bigint: true });
    if (current.isSymbolicLink() ||
        current.isFile() === false ||
        physicalVersion(current) !== expected.identity)
        throw new Error(`Runtime package file "${expected.path}" changed physical identity.`);
    for (const directory of expected.directories)
        assertPhysicalDirectory(directory, "runtime package ancestry");
};
const physicalDirectory = (directory, label) => {
    const namespacePath = path.resolve(directory);
    const linked = fs.lstatSync(namespacePath, { bigint: true });
    if (linked.isSymbolicLink() || linked.isDirectory() === false)
        throw new Error(`${label} "${namespacePath}" is not physical.`);
    const real = fs.realpathSync(namespacePath);
    const status = fs.statSync(real, { bigint: true });
    const version = physicalVersion(status);
    if (status.isDirectory() === false ||
        status.dev !== linked.dev ||
        status.ino !== linked.ino ||
        version !== physicalVersion(linked))
        throw new Error(`${label} "${namespacePath}" changed while resolved.`);
    return {
        identity: `${status.dev}\0${status.ino}`,
        path: namespacePath,
        real,
        version,
    };
};
const assertPhysicalDirectory = (expected, label) => {
    const current = physicalDirectory(expected.path, label);
    if (current.identity !== expected.identity ||
        current.real !== expected.real ||
        current.version !== expected.version)
        throw new Error(`${label} "${expected.path}" changed physical identity.`);
};
const physicalVersion = (status) => `${status.dev}\0${status.ino}\0${status.size}\0${status.mtimeNs}\0${status.ctimeNs}`;
const inside = (root, candidate) => {
    const relative = path.relative(root, candidate);
    return (relative === "" ||
        (path.isAbsolute(relative) === false &&
            relative !== ".." &&
            relative.startsWith(`..${path.sep}`) === false));
};
const compare = (x, y) => (x < y ? -1 : x > y ? 1 : 0);
//# sourceMappingURL=runtimePackageSnapshot.js.map