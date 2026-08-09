import { compareCodeUnits, digestAutoMovieBytes, readAutoMovieProductionOwnedFile, } from "@automovie/mcp";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { assertCaptureExecutable, assertCaptureExecutableBytes, closeCaptureExecutable, createCaptureExecutableSnapshot, openCaptureExecutable, } from "./captureExecutableSnapshot";
import { snapshotRuntimePackage } from "./runtimePackageSnapshot";
const CAPTURE_INSTALL_RECEIPT_MAX_BYTES = 64 * 1024;
const configError = () => new Error('Invalid capture browser config. In automovie.config.ts choose exactly { source: "playwright-chromium" }, { source: "system-channel", channel: "chrome" | "msedge" }, or { source: "configured-executable", product: "chromium" | "chrome" | "msedge", executablePath: "<non-blank project-relative or absolute path>" }.');
const exactKeys = (value, expected) => Object.keys(value).sort(compareCodeUnits).join("\u0000") ===
    [...expected].sort(compareCodeUnits).join("\u0000");
export const parseCaptureBrowserConfig = (value) => {
    if (typeof value !== "object" || value === null)
        throw configError();
    const config = value;
    if (config.source === "playwright-chromium" && exactKeys(config, ["source"]))
        return { source: "playwright-chromium" };
    if (config.source === "system-channel" &&
        (config.channel === "chrome" || config.channel === "msedge") &&
        exactKeys(config, ["source", "channel"]))
        return {
            source: "system-channel",
            channel: config.channel,
        };
    if (config.source === "configured-executable" &&
        (config.product === "chromium" ||
            config.product === "chrome" ||
            config.product === "msedge") &&
        typeof config.executablePath === "string" &&
        config.executablePath.trim().length !== 0 &&
        exactKeys(config, ["source", "product", "executablePath"]))
        return {
            source: "configured-executable",
            product: config.product,
            executablePath: config.executablePath,
        };
    throw configError();
};
const require = createRequire(import.meta.url);
const CAPTURE_PROTOCOL = "automovie.capture-runtime.v1";
const BROWSER_NAME = "chromium";
const REQUESTED_BACKEND = "angle:swiftshader";
const DEVICE_SCALE_FACTOR = 1;
const DESCRIPTOR_BOUND_CLI_LOADER = [
    'const fs = require("node:fs");',
    'const Module = require("node:module");',
    'const path = require("node:path");',
    "const filename = process.argv[1];",
    'const source = fs.readFileSync(3, "utf8");',
    "const entry = new Module(filename, module);",
    "entry.filename = filename;",
    "entry.paths = Module._nodeModulePaths(path.dirname(filename));",
    "entry._compile(source, filename);",
].join("\n");
const browserStoragePath = (projectRoot) => {
    const configured = process.env.PLAYWRIGHT_BROWSERS_PATH?.trim();
    if (configured === undefined || configured.length === 0 || configured === "0")
        return "0";
    return path.resolve(projectRoot, configured);
};
const localBrowserEnvironment = (projectRoot) => ({
    ...process.env,
    PLAYWRIGHT_BROWSERS_PATH: browserStoragePath(projectRoot),
});
const hasEnvironment = (name) => (process.env[name]?.trim().length ?? 0) !== 0;
const loadPlaywright = async (projectRoot) => {
    process.env.PLAYWRIGHT_BROWSERS_PATH = browserStoragePath(projectRoot);
    return import("playwright");
};
const capturePlaywrightMetadataOnce = (props) => {
    const playwright = snapshotRuntimePackage({
        assets: [{ kind: "file", relative: "cli.js" }],
        entry: props?.playwrightEntry ?? require.resolve("playwright"),
        packageName: "playwright",
    });
    const corePackagePath = props?.corePackagePath ??
        require.resolve("playwright-core/package.json", {
            paths: [playwright.root],
        });
    const core = snapshotRuntimePackage({
        assets: [{ kind: "file", relative: "browsers.json" }],
        entry: corePackagePath,
        packageName: "playwright-core",
    });
    const cli = playwright.assets.find((asset) => asset.path === "cli.js");
    const browsersFile = core.assets.find((asset) => asset.path === "browsers.json");
    if (cli === undefined || browsersFile === undefined)
        throw new Error("Installed Playwright package assets are incomplete.");
    const browsersJson = JSON.parse(browsersFile.bytes.toString("utf8"));
    const browser = browsersJson.browsers?.find((candidate) => candidate.name === BROWSER_NAME);
    if (browser === undefined ||
        typeof browser.revision !== "string" ||
        typeof browser.browserVersion !== "string")
        throw new Error("Installed Playwright metadata is incomplete. Reinstall dependencies, then run npm run capture:install.");
    return {
        packageVersion: playwright.version,
        cliDigest: cli.digest,
        cliPath: path.join(playwright.root, cli.path),
        browser,
        fingerprint: `${playwright.fingerprint}\0${core.fingerprint}`,
    };
};
/** Capture Playwright/core metadata only after a complete composite recheck. */
export const capturePlaywrightMetadata = (props) => {
    const first = capturePlaywrightMetadataOnce(props);
    const confirmed = capturePlaywrightMetadataOnce(props);
    if (samePlaywrightMetadata(first, confirmed) === false)
        throw new Error("Installed Playwright metadata changed while captured.");
    return first;
};
const samePlaywrightMetadata = (left, right) => left.fingerprint === right.fingerprint &&
    left.cliDigest === right.cliDigest &&
    left.cliPath === right.cliPath &&
    left.packageVersion === right.packageVersion &&
    left.browser.revision === right.browser.revision &&
    left.browser.browserVersion === right.browser.browserVersion;
const assertPlaywrightMetadata = (expected) => {
    const current = capturePlaywrightMetadata();
    if (samePlaywrightMetadata(current, expected) === false)
        throw new Error("Installed Playwright metadata changed while it was used.");
};
const legacyReceiptPath = (projectRoot) => path.join(path.resolve(projectRoot), ".automovie", "capture", "install-receipt.json");
const receiptGenerationDirectory = (projectRoot) => path.join(path.resolve(projectRoot), ".automovie", "capture", "install-receipts");
const receiptGenerationKey = (receipt) => digestAutoMovieBytes(Buffer.from(JSON.stringify({
    browser: {
        product: receipt.browser.product,
        revision: receipt.browser.revision,
        version: receipt.browser.version,
    },
    playwright: {
        package: receipt.playwright.package,
        version: receipt.playwright.version,
    },
}), "utf8")).slice(7);
const receiptGenerationPath = (projectRoot, receipt) => path.join(receiptGenerationDirectory(projectRoot), `${receiptGenerationKey(receipt)}.json`);
const ensureCaptureReceiptDirectory = (projectRoot) => {
    const project = physicalDirectory(projectRoot, "capture project root");
    const ancestry = [project];
    let cursor = project.path;
    for (const segment of [".automovie", "capture"]) {
        for (const directory of ancestry)
            assertPhysicalDirectoryIdentity(directory, "capture receipt ancestry");
        cursor = path.join(cursor, segment);
        try {
            fs.mkdirSync(cursor);
        }
        catch (error) {
            if (error.code !== "EEXIST")
                throw error;
        }
        const current = physicalDirectory(cursor, "capture receipt directory");
        if (inside(project.real, current.real) === false)
            throw new Error("Capture receipt directory escapes its project root.");
        ancestry.push(current);
    }
    return captureReceiptDirectory(project.path);
};
const ensureCaptureReceiptGenerationDirectory = (projectRoot) => {
    const parent = ensureCaptureReceiptDirectory(projectRoot);
    assertReceiptDirectory(parent);
    const directory = path.join(parent.path, "install-receipts");
    try {
        fs.mkdirSync(directory);
    }
    catch (error) {
        if (error.code !== "EEXIST")
            throw error;
    }
    const captured = captureReceiptGenerationDirectory(projectRoot);
    assertReceiptDirectoryPrefix(parent, captured);
    return captured;
};
const captureReceiptDirectory = (projectRoot) => {
    const project = physicalDirectory(projectRoot, "capture project root");
    const directories = [project];
    let cursor = project.path;
    for (const segment of [".automovie", "capture"]) {
        cursor = path.join(cursor, segment);
        const current = physicalDirectory(cursor, "capture receipt directory");
        if (inside(project.real, current.real) === false)
            throw new Error("Capture receipt directory escapes its project root.");
        directories.push(current);
    }
    for (const directory of directories)
        assertPhysicalDirectory(directory, "capture receipt ancestry");
    return { directories, path: cursor };
};
const captureReceiptGenerationDirectory = (projectRoot) => {
    const parent = captureReceiptDirectory(projectRoot);
    const current = physicalDirectory(path.join(parent.path, "install-receipts"), "capture receipt generation directory");
    if (inside(parent.directories[0].real, current.real) === false)
        throw new Error("Capture receipt generation directory escapes its root.");
    const captured = {
        directories: [...parent.directories, current],
        path: current.path,
    };
    assertReceiptDirectory(captured);
    return captured;
};
const currentReceiptGeneration = (projectRoot) => {
    let directory;
    try {
        directory = captureReceiptGenerationDirectory(projectRoot);
    }
    catch (error) {
        if (error.code === "ENOENT" ||
            error.code === "ENOTDIR")
            return null;
        throw error;
    }
    const entries = fs.readdirSync(directory.path, { withFileTypes: true });
    if (entries.some((entry) => entry.isFile() === false ||
        /^[0-9a-f]{64}\.json$/u.test(entry.name) === false))
        throw new Error("Capture receipt generation inventory is malformed.");
    const files = entries.map((entry) => entry.name).sort(compareCodeUnits);
    assertReceiptDirectory(directory);
    const metadata = capturePlaywrightMetadata();
    const expected = `${receiptGenerationKey({
        browser: {
            product: "chromium",
            revision: metadata.browser.revision,
            version: metadata.browser.browserVersion,
        },
        playwright: {
            package: "playwright",
            version: metadata.packageVersion,
        },
    })}.json`;
    assertReceiptDirectory(directory);
    return files.includes(expected)
        ? { directory, file: path.join(directory.path, expected) }
        : null;
};
const parseReceipt = (value, file) => {
    const receipt = value;
    if (typeof receipt !== "object" ||
        receipt === null ||
        Array.isArray(receipt) ||
        exactKeys(receipt, [
            "version",
            "playwright",
            "browser",
            "installSource",
        ]) === false ||
        receipt.version !== 1 ||
        typeof receipt.playwright !== "object" ||
        receipt.playwright === null ||
        exactKeys(receipt.playwright, [
            "package",
            "version",
        ]) === false ||
        receipt.playwright?.package !== "playwright" ||
        typeof receipt.playwright.version !== "string" ||
        receipt.playwright.version.trim().length === 0 ||
        typeof receipt.browser !== "object" ||
        receipt.browser === null ||
        exactKeys(receipt.browser, [
            "product",
            "revision",
            "version",
            "executablePath",
            "executableDigest",
        ]) === false ||
        receipt.browser?.product !== "chromium" ||
        typeof receipt.browser.revision !== "string" ||
        receipt.browser.revision.trim().length === 0 ||
        typeof receipt.browser.version !== "string" ||
        receipt.browser.version.trim().length === 0 ||
        typeof receipt.browser.executablePath !== "string" ||
        receipt.browser.executablePath.trim().length === 0 ||
        typeof receipt.browser.executableDigest !== "string" ||
        /^sha256:[0-9a-f]{64}$/.test(receipt.browser.executableDigest) === false ||
        (receipt.installSource !== "playwright-cdn" &&
            receipt.installSource !== "PLAYWRIGHT_DOWNLOAD_HOST" &&
            receipt.installSource !== "PLAYWRIGHT_CHROMIUM_DOWNLOAD_HOST"))
        throw new Error(`Capture install receipt "${file}" is malformed. Run npm run capture:install to replace it.`);
    return receipt;
};
export const readCaptureInstallReceipt = (projectRoot) => {
    const generation = currentReceiptGeneration(projectRoot);
    const file = generation?.file ?? legacyReceiptPath(projectRoot);
    let bytes;
    if (generation !== null)
        bytes = readReceiptGeneration(generation);
    else
        try {
            bytes = readAutoMovieProductionOwnedFile({
                root: path.resolve(projectRoot),
                directory: path.dirname(file),
                relative: path.basename(file),
                optional: true,
            });
        }
        catch (error) {
            if (error.code !== "ENOENT")
                throw error;
            bytes = null;
        }
    if (bytes === null)
        throw new Error(`Package-owned Chromium is not installed for this project. Run npm run capture:install, then npm run capture:doctor.`);
    try {
        const receipt = parseReceipt(JSON.parse(Buffer.from(bytes).toString("utf8")), file);
        if (generation !== null &&
            path.basename(file) !== `${receiptGenerationKey(receipt)}.json`)
            throw new Error(`Capture install receipt "${file}" occupies another generation.`);
        return receipt;
    }
    catch (error) {
        if (error instanceof SyntaxError)
            throw new Error(`Capture install receipt "${file}" is not valid JSON. Run npm run capture:install to replace it.`);
        throw error;
    }
};
const readReceiptGeneration = (generation) => {
    assertReceiptDirectory(generation.directory);
    const opened = openCaptureExecutable(generation.file, CAPTURE_INSTALL_RECEIPT_MAX_BYTES);
    let receiptReadFailure;
    try {
        const selected = generation.directory.directories.at(-1);
        if (selected === undefined ||
            opened.directory.path !== selected.path ||
            opened.directory.real !== selected.real ||
            opened.directory.identity !== selected.identity)
            throw new Error("Capture receipt generation changed physical ancestry before read.");
        assertReceiptDirectory(generation.directory);
        assertCaptureExecutable(opened);
        const status = fs.fstatSync(opened.descriptor, { bigint: true });
        if (status.size > BigInt(CAPTURE_INSTALL_RECEIPT_MAX_BYTES))
            throw new Error(`Capture install receipt "${generation.file}" exceeds its maximum byte length.`);
        const bytes = Buffer.alloc(Number(status.size));
        let position = 0;
        while (position < bytes.length) {
            const length = fs.readSync(opened.descriptor, bytes, position, bytes.length - position, position);
            if (length === 0)
                throw new Error(`Capture install receipt "${generation.file}" ended during read.`);
            position += length;
        }
        assertCaptureExecutableBytes(opened);
        assertCaptureExecutable(opened);
        assertReceiptDirectory(generation.directory);
        return bytes;
    }
    catch (error) {
        receiptReadFailure = { error };
        throw error;
    }
    finally {
        preserveCaptureDescriptorCleanup(receiptReadFailure, "capture receipt generation descriptor", () => closeCaptureExecutable(opened));
    }
};
/** Publish one immutable receipt for a canonical Playwright generation. */
export const publishCaptureInstallReceipt = (projectRoot, receipt, assertCurrent) => {
    const file = receiptGenerationPath(projectRoot, receipt);
    parseReceipt(receipt, file);
    const owned = ensureCaptureReceiptGenerationDirectory(projectRoot);
    if (path.resolve(path.dirname(file)) !== owned.path)
        throw new Error("Capture receipt path escapes its owned directory.");
    const bytes = Buffer.from(`${JSON.stringify(receipt, null, 2)}\n`);
    assertCurrent();
    assertReceiptDirectory(owned);
    let published;
    let receiptPublicationFailure;
    try {
        published = createCaptureExecutableSnapshot(file, bytes);
    }
    catch (error) {
        if (error.code !== "EEXIST")
            throw error;
        try {
            published = openCaptureExecutable(file, CAPTURE_INSTALL_RECEIPT_MAX_BYTES);
        }
        catch (existingError) {
            throw new Error(`An incomplete capture receipt owns this Playwright generation. Manually adjudicate that immutable generation before removing it: ${String(existingError)}`);
        }
    }
    try {
        const current = captureReceiptGenerationDirectory(projectRoot);
        assertReceiptDirectoryPrefix(owned, current);
        if (published.digest !== digestAutoMovieBytes(bytes))
            throw new Error("A different or incomplete capture receipt owns this Playwright generation. Manually adjudicate that immutable generation before removing it.");
        assertCaptureExecutable(published);
        assertCaptureExecutableBytes(published);
        assertReceiptDirectory(current);
    }
    catch (error) {
        receiptPublicationFailure = { error };
        throw error;
    }
    finally {
        preserveCaptureDescriptorCleanup(receiptPublicationFailure, "capture receipt publication descriptor", () => closeCaptureExecutable(published));
    }
};
const assertReceiptDirectory = (expected) => {
    for (const directory of expected.directories)
        assertPhysicalDirectory(directory, "capture receipt ancestry");
};
const assertReceiptDirectoryPrefix = (expected, current) => {
    if (current.directories.length < expected.directories.length ||
        expected.directories.some((directory, index) => {
            const next = current.directories[index];
            return (next === undefined ||
                directory.path !== next.path ||
                directory.real !== next.real ||
                directory.identity !== next.identity);
        }))
        throw new Error("Capture receipt ancestry changed physical identity.");
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
const assertPhysicalDirectoryIdentity = (expected, label) => {
    const current = physicalDirectory(expected.path, label);
    if (current.identity !== expected.identity || current.real !== expected.real)
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
/** Run the exact captured CommonJS CLI bytes through an inherited descriptor. */
export const runDescriptorBoundNodeCli = (props) => {
    const cli = openCaptureExecutable(props.cliPath);
    let descriptorCliFailure;
    try {
        if (cli.digest !== props.cliDigest)
            throw new Error("Playwright CLI bytes differ from captured metadata.");
        assertCaptureExecutable(cli);
        const result = spawnSync(process.execPath, ["--eval", DESCRIPTOR_BOUND_CLI_LOADER, cli.path, ...props.args], {
            cwd: props.cwd,
            env: props.env,
            encoding: "utf8",
            stdio: ["ignore", "pipe", "pipe", cli.descriptor],
        });
        assertCaptureExecutable(cli);
        return {
            error: result.error === undefined
                ? null
                : {
                    code: result.error.code ?? "unknown",
                    message: result.error.message,
                },
            signal: result.signal,
            status: result.status,
            stderr: result.stderr ?? "",
            stdout: result.stdout ?? "",
        };
    }
    catch (error) {
        descriptorCliFailure = { error };
        throw error;
    }
    finally {
        preserveCaptureDescriptorCleanup(descriptorCliFailure, "descriptor-bound Playwright CLI", () => closeCaptureExecutable(cli));
    }
};
const writeCaptureInstallCommandOutput = (result) => {
    process.stdout.write(result.stdout);
    process.stderr.write(result.stderr);
};
const captureInstallCommandSucceeded = (result) => result.error === null && result.signal === null && result.status === 0;
export const captureInstallCommandTermination = (result) => {
    const reason = result.error !== null
        ? "failed to spawn"
        : result.signal !== null
            ? "terminated by signal"
            : typeof result.status !== "number"
                ? "terminated without status"
                : `exited with status ${result.status}`;
    return [
        reason,
        `status=${typeof result.status === "number" ? result.status : "none"}`,
        `signal=${result.signal ?? "none"}`,
        `error=${result.error?.code ?? "none"}`,
        `message=${result.error === null ? "none" : JSON.stringify(result.error.message)}`,
    ].join("; ");
};
class CaptureBrowserCleanupError extends AggregateError {
}
class CaptureDescriptorCleanupError extends AggregateError {
}
/** Close one synchronous descriptor without replacing a prior failure. */
export const preserveCaptureDescriptorCleanup = (failure, resource, cleanup) => {
    try {
        cleanup();
    }
    catch (cleanupFailure) {
        if (failure === undefined)
            throw cleanupFailure;
        throw new CaptureDescriptorCleanupError([failure.error, cleanupFailure], `${resource} cleanup failed after the operation failed.`);
    }
};
/** Attempt every browser-bootstrap cleanup without replacing prior failures. */
export const preserveCaptureBrowserCleanup = async (failure, resources) => {
    const results = await Promise.allSettled(resources.map((resource) => Promise.resolve().then(resource.cleanup)));
    const cleanupFailures = results.flatMap((result, index) => result.status === "fulfilled"
        ? []
        : [{ error: result.reason, resource: resources[index].resource }]);
    if (cleanupFailures.length === 0)
        return;
    if (failure === undefined && cleanupFailures.length === 1)
        throw cleanupFailures[0].error;
    throw new CaptureBrowserCleanupError([
        ...(failure === undefined
            ? []
            : failure.error instanceof CaptureBrowserCleanupError
                ? failure.error.errors
                : [failure.error]),
        ...cleanupFailures.map((entry) => entry.error),
    ], `Capture browser cleanup failed${failure === undefined ? "" : " after the operation failed"}: ${cleanupFailures.map((entry) => entry.resource).join(", ")}.`);
};
/** Revalidate one open executable on both sides of its launch call. */
export const launchWithCaptureExecutableSnapshot = async (props) => {
    assertCaptureExecutable(props.snapshot);
    const output = await props.launch(props.snapshot.path);
    try {
        assertCaptureExecutable(props.snapshot);
        return output;
    }
    catch (error) {
        await preserveCaptureBrowserCleanup({ error }, [
            {
                resource: "launched capture browser",
                cleanup: () => props.close(output),
            },
        ]);
        throw error;
    }
};
/** Release validation-only ownership before transferring one browser session. */
export const handoffCaptureBrowserSession = async (props) => {
    try {
        await Promise.resolve().then(props.closeSnapshot);
    }
    catch (error) {
        await preserveCaptureBrowserCleanup({ error }, [
            {
                resource: "validated capture browser",
                cleanup: props.closeBrowser,
            },
        ]);
        throw error;
    }
    return props.session;
};
export const installPackageOwnedChromium = async (projectRoot) => {
    const metadata = capturePlaywrightMetadata();
    process.stderr.write(`Installing Playwright Chromium revision ${metadata.browser.revision} into the configured browser store...\n`);
    assertPlaywrightMetadata(metadata);
    const installed = runDescriptorBoundNodeCli({
        args: ["install", BROWSER_NAME, "--no-shell"],
        cliDigest: metadata.cliDigest,
        cliPath: metadata.cliPath,
        cwd: projectRoot,
        env: localBrowserEnvironment(projectRoot),
    });
    writeCaptureInstallCommandOutput(installed);
    if (captureInstallCommandSucceeded(installed) === false)
        throw new Error(`Playwright Chromium installation ${captureInstallCommandTermination(installed)}. Check HTTPS_PROXY, PLAYWRIGHT_DOWNLOAD_HOST or PLAYWRIGHT_CHROMIUM_DOWNLOAD_HOST for your network or offline mirror, then retry npm run capture:install.`);
    assertPlaywrightMetadata(metadata);
    const { chromium } = await loadPlaywright(projectRoot);
    assertPlaywrightMetadata(metadata);
    let executable;
    try {
        executable = openCaptureExecutable(chromium.executablePath());
    }
    catch {
        throw new Error(`Playwright reported no physical Chromium executable at "${chromium.executablePath()}". Retry npm run capture:install.`);
    }
    let installFailure;
    try {
        const receipt = {
            version: 1,
            playwright: {
                package: "playwright",
                version: metadata.packageVersion,
            },
            browser: {
                product: "chromium",
                revision: metadata.browser.revision,
                version: metadata.browser.browserVersion,
                executablePath: executable.path,
                executableDigest: executable.digest,
            },
            installSource: hasEnvironment("PLAYWRIGHT_CHROMIUM_DOWNLOAD_HOST")
                ? "PLAYWRIGHT_CHROMIUM_DOWNLOAD_HOST"
                : hasEnvironment("PLAYWRIGHT_DOWNLOAD_HOST")
                    ? "PLAYWRIGHT_DOWNLOAD_HOST"
                    : "playwright-cdn",
        };
        publishCaptureInstallReceipt(projectRoot, receipt, () => {
            assertCaptureExecutable(executable);
            assertPlaywrightMetadata(metadata);
        });
        return receipt;
    }
    catch (error) {
        installFailure = { error };
        throw error;
    }
    finally {
        await preserveCaptureBrowserCleanup(installFailure, [
            {
                resource: "installed capture executable snapshot",
                cleanup: () => closeCaptureExecutable(executable),
            },
        ]);
    }
};
const packageOwnedProvenance = async (projectRoot, metadata, executablePath) => {
    const receipt = readCaptureInstallReceipt(projectRoot);
    const resolvedExecutable = path.resolve(executablePath);
    if (receipt.playwright.version !== metadata.packageVersion ||
        receipt.browser.revision !== metadata.browser.revision ||
        receipt.browser.version !== metadata.browser.browserVersion ||
        path.resolve(receipt.browser.executablePath) !== resolvedExecutable)
        throw new Error("The capture install receipt does not match the current Playwright package and browser revision. Run npm run capture:install, then npm run capture:doctor.");
    let executable;
    try {
        executable = openCaptureExecutable(resolvedExecutable);
    }
    catch {
        throw new Error("The package-owned Chromium executable is missing or differs from its install receipt. Run npm run capture:install, then npm run capture:doctor.");
    }
    if (executable.digest !== receipt.browser.executableDigest) {
        const error = new Error("The package-owned Chromium executable is missing or differs from its install receipt. Run npm run capture:install, then npm run capture:doctor.");
        await preserveCaptureBrowserCleanup({ error }, [
            {
                resource: "rejected package-owned executable snapshot",
                cleanup: () => closeCaptureExecutable(executable),
            },
        ]);
        throw error;
    }
    return { executable, receipt };
};
export const launchCaptureBrowser = async (projectRoot, inputConfig) => {
    const config = parseCaptureBrowserConfig(inputConfig);
    const metadata = capturePlaywrightMetadata();
    const { chromium } = await loadPlaywright(projectRoot);
    let product;
    let source;
    let revision;
    let executableDigest;
    let executable = null;
    let launch;
    if (config.source === "playwright-chromium") {
        const provenance = await packageOwnedProvenance(projectRoot, metadata, chromium.executablePath());
        const receipt = provenance.receipt;
        executable = provenance.executable;
        product = "chromium";
        source = "package-owned";
        revision = receipt.browser.revision;
        executableDigest = receipt.browser.executableDigest;
        launch = { executablePath: executable.path };
    }
    else if (config.source === "system-channel") {
        product = config.channel === "msedge" ? "msedge" : "chrome";
        source = "system-channel";
        revision = null;
        executableDigest = null;
        launch = { channel: config.channel };
    }
    else {
        const executablePath = path.resolve(projectRoot, config.executablePath);
        try {
            executable = openCaptureExecutable(executablePath);
        }
        catch {
            throw new Error(`Configured capture executable "${executablePath}" is not a physical file. Correct automovie.config.ts or install that executable.`);
        }
        product = config.product;
        source = "configured-executable";
        revision = null;
        executableDigest = executable.digest;
        launch = { executablePath: executable.path };
    }
    try {
        assertPlaywrightMetadata(metadata);
        if (executable !== null)
            assertCaptureExecutable(executable);
    }
    catch (error) {
        await preserveCaptureBrowserCleanup({ error }, executable === null
            ? []
            : [
                {
                    resource: "pre-launch executable snapshot",
                    cleanup: () => closeCaptureExecutable(executable),
                },
            ]);
        throw error;
    }
    let browser;
    try {
        const launchBrowser = (executablePath) => chromium.launch({
            ...launch,
            ...(executablePath === undefined ? {} : { executablePath }),
            headless: true,
            args: ["--use-angle=swiftshader"],
        });
        browser =
            executable === null
                ? await launchBrowser()
                : await launchWithCaptureExecutableSnapshot({
                    snapshot: executable,
                    launch: launchBrowser,
                    close: (opened) => opened.close(),
                });
    }
    catch (error) {
        let cause = error;
        try {
            await preserveCaptureBrowserCleanup({ error }, executable === null
                ? []
                : [
                    {
                        resource: "failed-launch executable snapshot",
                        cleanup: () => closeCaptureExecutable(executable),
                    },
                ]);
        }
        catch (cleanupError) {
            cause = cleanupError;
        }
        throw new Error(`Capture browser launch failed: ${error instanceof Error ? error.message : String(error)} Run npm run capture:install and npm run capture:doctor. If Linux reports missing shared libraries, run npx playwright install-deps chromium; otherwise correct the explicit system-channel/configured-executable setting.`, { cause });
    }
    let session;
    try {
        assertPlaywrightMetadata(metadata);
        if (executable !== null)
            assertCaptureExecutable(executable);
        const browserVersion = browser.version();
        if (source === "package-owned" &&
            browserVersion !== metadata.browser.browserVersion)
            throw new Error(`Package-owned Chromium reported version "${browserVersion}", expected "${metadata.browser.browserVersion}". Run npm run capture:install, then npm run capture:doctor.`);
        session = {
            browser,
            runtime: {
                protocolVersion: CAPTURE_PROTOCOL,
                playwright: {
                    package: "playwright",
                    version: metadata.packageVersion,
                },
                browser: {
                    product,
                    version: browserVersion,
                    revision,
                    source,
                    executableDigest,
                },
                platform: {
                    os: process.platform,
                    arch: process.arch,
                },
                mode: {
                    headless: "chromium",
                    deviceScaleFactor: DEVICE_SCALE_FACTOR,
                },
            },
        };
    }
    catch (error) {
        await preserveCaptureBrowserCleanup({ error }, [
            {
                resource: "invalid capture browser",
                cleanup: () => browser.close(),
            },
            ...(executable === null
                ? []
                : [
                    {
                        resource: "invalid executable snapshot",
                        cleanup: () => closeCaptureExecutable(executable),
                    },
                ]),
        ]);
        throw error;
    }
    if (executable === null)
        return session;
    const validatedExecutable = executable;
    return handoffCaptureBrowserSession({
        session,
        closeSnapshot: () => closeCaptureExecutable(validatedExecutable),
        closeBrowser: () => browser.close(),
    });
};
export const inspectCaptureGraphics = async (page, selector = "#view") => {
    const graphics = await page.locator(selector).evaluate((element) => {
        const canvas = element;
        const context = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
        if (context === null)
            return null;
        const debug = context.getExtension("WEBGL_debug_renderer_info");
        return {
            api: typeof WebGL2RenderingContext !== "undefined" &&
                context instanceof WebGL2RenderingContext
                ? "webgl2"
                : "webgl",
            vendor: String(context.getParameter(debug?.UNMASKED_VENDOR_WEBGL ?? context.VENDOR)),
            renderer: String(context.getParameter(debug?.UNMASKED_RENDERER_WEBGL ?? context.RENDERER)),
        };
    });
    if (graphics === null ||
        graphics.vendor.trim().length === 0 ||
        graphics.renderer.trim().length === 0)
        throw new Error("Capture WebGL is unavailable or did not report vendor and renderer. Run npm run capture:doctor and inspect the backend/driver diagnostic.");
    return {
        requestedBackend: REQUESTED_BACKEND,
        ...graphics,
    };
};
//# sourceMappingURL=capture-browser.js.map