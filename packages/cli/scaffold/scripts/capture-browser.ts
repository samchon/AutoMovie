import type { IAutoMovieCaptureRuntimeIdentity } from "@automovie/interface";
import { readAutoMovieProductionOwnedFile } from "@automovie/mcp";
import { mkdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import type { Browser, Page } from "playwright";

import {
  type ICaptureExecutableSnapshot,
  assertCaptureExecutable,
  closeCaptureExecutable,
  openCaptureExecutable,
} from "./captureExecutableSnapshot";
import { snapshotRuntimePackage } from "./runtimePackageSnapshot";

export type AutoMovieCaptureBrowserConfig =
  | { source: "playwright-chromium" }
  | { source: "system-channel"; channel: "chrome" | "msedge" }
  | {
      source: "configured-executable";
      product: "chromium" | "chrome" | "msedge";
      executablePath: string;
    };

export interface IAutoMovieCaptureInstallReceipt {
  version: 1;
  playwright: {
    package: "playwright";
    version: string;
  };
  browser: {
    product: "chromium";
    revision: string;
    version: string;
    executablePath: string;
    executableDigest: `sha256:${string}`;
  };
  installSource:
    | "playwright-cdn"
    | "PLAYWRIGHT_DOWNLOAD_HOST"
    | "PLAYWRIGHT_CHROMIUM_DOWNLOAD_HOST";
}

interface IPlaywrightBrowserRecord {
  name: string;
  revision: string;
  browserVersion: string;
}

interface IPlaywrightMetadata {
  packageVersion: string;
  cliPath: string;
  browser: IPlaywrightBrowserRecord;
  fingerprint: string;
}

export interface IAutoMovieCaptureBrowserSession {
  browser: Browser;
  runtime: Omit<IAutoMovieCaptureRuntimeIdentity, "graphics">;
}

const configError = (): Error =>
  new Error(
    'Invalid capture browser config. In automovie.config.ts choose exactly { source: "playwright-chromium" }, { source: "system-channel", channel: "chrome" | "msedge" }, or { source: "configured-executable", product: "chromium" | "chrome" | "msedge", executablePath: "<non-blank project-relative or absolute path>" }.',
  );

const exactKeys = (
  value: Record<string, unknown>,
  expected: readonly string[],
): boolean =>
  Object.keys(value).sort().join("\u0000") ===
  [...expected].sort().join("\u0000");

export const parseCaptureBrowserConfig = (
  value: unknown,
): AutoMovieCaptureBrowserConfig => {
  if (typeof value !== "object" || value === null) throw configError();
  const config = value as Record<string, unknown>;
  if (config.source === "playwright-chromium" && exactKeys(config, ["source"]))
    return { source: "playwright-chromium" };
  if (
    config.source === "system-channel" &&
    (config.channel === "chrome" || config.channel === "msedge") &&
    exactKeys(config, ["source", "channel"])
  )
    return {
      source: "system-channel",
      channel: config.channel,
    };
  if (
    config.source === "configured-executable" &&
    (config.product === "chromium" ||
      config.product === "chrome" ||
      config.product === "msedge") &&
    typeof config.executablePath === "string" &&
    config.executablePath.trim().length !== 0 &&
    exactKeys(config, ["source", "product", "executablePath"])
  )
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

const browserStoragePath = (projectRoot: string): string => {
  const configured = process.env.PLAYWRIGHT_BROWSERS_PATH?.trim();
  if (configured === undefined || configured.length === 0 || configured === "0")
    return "0";
  return path.resolve(projectRoot, configured);
};

const localBrowserEnvironment = (projectRoot: string): NodeJS.ProcessEnv => ({
  ...process.env,
  PLAYWRIGHT_BROWSERS_PATH: browserStoragePath(projectRoot),
});

const hasEnvironment = (name: string): boolean =>
  (process.env[name]?.trim().length ?? 0) !== 0;

const loadPlaywright = async (
  projectRoot: string,
): Promise<typeof import("playwright")> => {
  process.env.PLAYWRIGHT_BROWSERS_PATH = browserStoragePath(projectRoot);
  return import("playwright");
};

const playwrightMetadata = (): IPlaywrightMetadata => {
  const playwright = snapshotRuntimePackage({
    assets: [{ kind: "file", relative: "cli.js" }],
    entry: require.resolve("playwright"),
    packageName: "playwright",
  });
  const corePackagePath = require.resolve("playwright-core/package.json", {
    paths: [playwright.root],
  });
  const core = snapshotRuntimePackage({
    assets: [{ kind: "file", relative: "browsers.json" }],
    entry: corePackagePath,
    packageName: "playwright-core",
  });
  const cli = playwright.assets.find((asset) => asset.path === "cli.js");
  const browsersFile = core.assets.find(
    (asset) => asset.path === "browsers.json",
  );
  if (cli === undefined || browsersFile === undefined)
    throw new Error("Installed Playwright package assets are incomplete.");
  const browsersJson = JSON.parse(browsersFile.bytes.toString("utf8")) as {
    browsers?: IPlaywrightBrowserRecord[];
  };
  const browser = browsersJson.browsers?.find(
    (candidate) => candidate.name === BROWSER_NAME,
  );
  if (
    browser === undefined ||
    typeof browser.revision !== "string" ||
    typeof browser.browserVersion !== "string"
  )
    throw new Error(
      "Installed Playwright metadata is incomplete. Reinstall dependencies, then run npm run capture:install.",
    );
  return {
    packageVersion: playwright.version,
    cliPath: path.join(playwright.root, cli.path),
    browser,
    fingerprint: `${playwright.fingerprint}\0${core.fingerprint}`,
  };
};

const assertPlaywrightMetadata = (expected: IPlaywrightMetadata): void => {
  const current = playwrightMetadata();
  if (
    current.fingerprint !== expected.fingerprint ||
    current.cliPath !== expected.cliPath ||
    current.packageVersion !== expected.packageVersion ||
    current.browser.revision !== expected.browser.revision ||
    current.browser.browserVersion !== expected.browser.browserVersion
  )
    throw new Error("Installed Playwright metadata changed while it was used.");
};

const receiptPath = (projectRoot: string): string =>
  path.join(projectRoot, ".automovie", "capture", "install-receipt.json");

const parseReceipt = (
  value: unknown,
  file: string,
): IAutoMovieCaptureInstallReceipt => {
  const receipt = value as Partial<IAutoMovieCaptureInstallReceipt> | null;
  if (
    typeof receipt !== "object" ||
    receipt === null ||
    receipt.version !== 1 ||
    receipt.playwright?.package !== "playwright" ||
    typeof receipt.playwright.version !== "string" ||
    receipt.playwright.version.trim().length === 0 ||
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
      receipt.installSource !== "PLAYWRIGHT_CHROMIUM_DOWNLOAD_HOST")
  )
    throw new Error(
      `Capture install receipt "${file}" is malformed. Run npm run capture:install to replace it.`,
    );
  return receipt as IAutoMovieCaptureInstallReceipt;
};

export const readCaptureInstallReceipt = (
  projectRoot: string,
): IAutoMovieCaptureInstallReceipt => {
  const file = receiptPath(projectRoot);
  let bytes: Uint8Array | null;
  try {
    bytes = readAutoMovieProductionOwnedFile({
      root: path.resolve(projectRoot),
      directory: path.dirname(file),
      relative: path.basename(file),
      optional: true,
    });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    bytes = null;
  }
  if (bytes === null)
    throw new Error(
      `Package-owned Chromium is not installed for this project. Run npm run capture:install, then npm run capture:doctor.`,
    );
  try {
    return parseReceipt(
      JSON.parse(Buffer.from(bytes).toString("utf8")) as unknown,
      file,
    );
  } catch (error) {
    if (error instanceof SyntaxError)
      throw new Error(
        `Capture install receipt "${file}" is not valid JSON. Run npm run capture:install to replace it.`,
      );
    throw error;
  }
};

const writeReceipt = (
  projectRoot: string,
  receipt: IAutoMovieCaptureInstallReceipt,
): void => {
  const file = receiptPath(projectRoot);
  mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.tmp`;
  try {
    writeFileSync(temporary, `${JSON.stringify(receipt, null, 2)}\n`);
    renameSync(temporary, file);
  } finally {
    rmSync(temporary, { force: true });
  }
};

export const installPackageOwnedChromium = async (
  projectRoot: string,
): Promise<IAutoMovieCaptureInstallReceipt> => {
  const metadata = playwrightMetadata();
  const { spawnSync } = await import("node:child_process");
  process.stderr.write(
    `Installing Playwright Chromium revision ${metadata.browser.revision} into the configured browser store...\n`,
  );
  const installed = spawnSync(
    process.execPath,
    [metadata.cliPath, "install", BROWSER_NAME, "--no-shell"],
    {
      cwd: projectRoot,
      env: localBrowserEnvironment(projectRoot),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  if (installed.status !== 0)
    throw new Error(
      `Playwright Chromium installation failed with status ${
        installed.status ?? "signal"
      }. Check HTTPS_PROXY, PLAYWRIGHT_DOWNLOAD_HOST or PLAYWRIGHT_CHROMIUM_DOWNLOAD_HOST for your network or offline mirror, then retry npm run capture:install.`,
    );
  assertPlaywrightMetadata(metadata);
  const { chromium } = await loadPlaywright(projectRoot);
  assertPlaywrightMetadata(metadata);
  let executable: ICaptureExecutableSnapshot;
  try {
    executable = openCaptureExecutable(chromium.executablePath());
  } catch {
    throw new Error(
      `Playwright reported no physical Chromium executable at "${chromium.executablePath()}". Retry npm run capture:install.`,
    );
  }
  try {
    const receipt: IAutoMovieCaptureInstallReceipt = {
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
    assertCaptureExecutable(executable);
    assertPlaywrightMetadata(metadata);
    writeReceipt(projectRoot, receipt);
    assertCaptureExecutable(executable);
    assertPlaywrightMetadata(metadata);
    return receipt;
  } finally {
    closeCaptureExecutable(executable);
  }
};

const packageOwnedProvenance = (
  projectRoot: string,
  metadata: IPlaywrightMetadata,
  executablePath: string,
): {
  executable: ICaptureExecutableSnapshot;
  receipt: IAutoMovieCaptureInstallReceipt;
} => {
  const receipt = readCaptureInstallReceipt(projectRoot);
  const resolvedExecutable = path.resolve(executablePath);
  if (
    receipt.playwright.version !== metadata.packageVersion ||
    receipt.browser.revision !== metadata.browser.revision ||
    receipt.browser.version !== metadata.browser.browserVersion ||
    path.resolve(receipt.browser.executablePath) !== resolvedExecutable
  )
    throw new Error(
      "The capture install receipt does not match the current Playwright package and browser revision. Run npm run capture:install, then npm run capture:doctor.",
    );
  let executable: ICaptureExecutableSnapshot;
  try {
    executable = openCaptureExecutable(resolvedExecutable);
  } catch {
    throw new Error(
      "The package-owned Chromium executable is missing or differs from its install receipt. Run npm run capture:install, then npm run capture:doctor.",
    );
  }
  if (executable.digest !== receipt.browser.executableDigest) {
    closeCaptureExecutable(executable);
    throw new Error(
      "The package-owned Chromium executable is missing or differs from its install receipt. Run npm run capture:install, then npm run capture:doctor.",
    );
  }
  return { executable, receipt };
};

export const launchCaptureBrowser = async (
  projectRoot: string,
  inputConfig: unknown,
): Promise<IAutoMovieCaptureBrowserSession> => {
  const config = parseCaptureBrowserConfig(inputConfig);
  const metadata = playwrightMetadata();
  const { chromium } = await loadPlaywright(projectRoot);
  let product: IAutoMovieCaptureRuntimeIdentity["browser"]["product"];
  let source: IAutoMovieCaptureRuntimeIdentity["browser"]["source"];
  let revision: string | null;
  let executableDigest: `sha256:${string}` | null;
  let executable: ICaptureExecutableSnapshot | null = null;
  let launch: NonNullable<Parameters<typeof chromium.launch>[0]>;
  if (config.source === "playwright-chromium") {
    const provenance = packageOwnedProvenance(
      projectRoot,
      metadata,
      chromium.executablePath(),
    );
    const receipt = provenance.receipt;
    executable = provenance.executable;
    product = "chromium";
    source = "package-owned";
    revision = receipt.browser.revision;
    executableDigest = receipt.browser.executableDigest;
    launch = { executablePath: executable.path };
  } else if (config.source === "system-channel") {
    product = config.channel === "msedge" ? "msedge" : "chrome";
    source = "system-channel";
    revision = null;
    executableDigest = null;
    launch = { channel: config.channel };
  } else {
    const executablePath = path.resolve(projectRoot, config.executablePath);
    try {
      executable = openCaptureExecutable(executablePath);
    } catch {
      throw new Error(
        `Configured capture executable "${executablePath}" is not a physical file. Correct automovie.config.ts or install that executable.`,
      );
    }
    product = config.product;
    source = "configured-executable";
    revision = null;
    executableDigest = executable.digest;
    launch = { executablePath: executable.path };
  }
  try {
    assertPlaywrightMetadata(metadata);
    if (executable !== null) assertCaptureExecutable(executable);
  } catch (error) {
    if (executable !== null) closeCaptureExecutable(executable);
    throw error;
  }
  let browser: Browser;
  try {
    browser = await chromium.launch({
      ...launch,
      headless: true,
      args: ["--use-angle=swiftshader"],
    });
  } catch (error) {
    if (executable !== null) closeCaptureExecutable(executable);
    throw new Error(
      `Capture browser launch failed: ${
        error instanceof Error ? error.message : String(error)
      } Run npm run capture:install and npm run capture:doctor. If Linux reports missing shared libraries, run npx playwright install-deps chromium; otherwise correct the explicit system-channel/configured-executable setting.`,
    );
  }
  try {
    assertPlaywrightMetadata(metadata);
    if (executable !== null) assertCaptureExecutable(executable);
    const browserVersion = browser.version();
    if (
      source === "package-owned" &&
      browserVersion !== metadata.browser.browserVersion
    )
      throw new Error(
        `Package-owned Chromium reported version "${browserVersion}", expected "${metadata.browser.browserVersion}". Run npm run capture:install, then npm run capture:doctor.`,
      );
    return {
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
  } catch (error) {
    await browser.close();
    throw error;
  } finally {
    if (executable !== null) closeCaptureExecutable(executable);
  }
};

export const inspectCaptureGraphics = async (
  page: Page,
  selector = "#view",
): Promise<IAutoMovieCaptureRuntimeIdentity["graphics"]> => {
  const graphics = await page.locator(selector).evaluate((element) => {
    const canvas = element as HTMLCanvasElement;
    const context = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
    if (context === null) return null;
    const debug = context.getExtension("WEBGL_debug_renderer_info");
    return {
      api:
        typeof WebGL2RenderingContext !== "undefined" &&
        context instanceof WebGL2RenderingContext
          ? ("webgl2" as const)
          : ("webgl" as const),
      vendor: String(
        context.getParameter(debug?.UNMASKED_VENDOR_WEBGL ?? context.VENDOR),
      ),
      renderer: String(
        context.getParameter(
          debug?.UNMASKED_RENDERER_WEBGL ?? context.RENDERER,
        ),
      ),
    };
  });
  if (
    graphics === null ||
    graphics.vendor.trim().length === 0 ||
    graphics.renderer.trim().length === 0
  )
    throw new Error(
      "Capture WebGL is unavailable or did not report vendor and renderer. Run npm run capture:doctor and inspect the backend/driver diagnostic.",
    );
  return {
    requestedBackend: REQUESTED_BACKEND,
    ...graphics,
  };
};
