import type { IAutoMovieCaptureRuntimeIdentity } from "@automovie/interface";
import { createHash } from "node:crypto";
import {
  createReadStream,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import type { Browser, Page } from "playwright";

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
  installSource: string;
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
}

export interface IAutoMovieCaptureBrowserSession {
  browser: Browser;
  runtime: Omit<IAutoMovieCaptureRuntimeIdentity, "graphics">;
}

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

const loadPlaywright = async (
  projectRoot: string,
): Promise<typeof import("playwright")> => {
  process.env.PLAYWRIGHT_BROWSERS_PATH = browserStoragePath(projectRoot);
  return import("playwright");
};

const playwrightMetadata = (): IPlaywrightMetadata => {
  const packagePath = require.resolve("playwright/package.json");
  const packageRoot = path.dirname(packagePath);
  const corePackagePath = require.resolve("playwright-core/package.json");
  const packageJson = JSON.parse(readFileSync(packagePath, "utf8")) as {
    version?: unknown;
  };
  const browsersJson = JSON.parse(
    readFileSync(
      path.join(path.dirname(corePackagePath), "browsers.json"),
      "utf8",
    ),
  ) as {
    browsers?: IPlaywrightBrowserRecord[];
  };
  const browser = browsersJson.browsers?.find(
    (candidate) => candidate.name === BROWSER_NAME,
  );
  if (
    typeof packageJson.version !== "string" ||
    browser === undefined ||
    typeof browser.revision !== "string" ||
    typeof browser.browserVersion !== "string"
  )
    throw new Error(
      "Installed Playwright metadata is incomplete. Reinstall dependencies, then run pnpm capture:install.",
    );
  return {
    packageVersion: packageJson.version,
    cliPath: path.join(packageRoot, "cli.js"),
    browser,
  };
};

const digestFile = async (file: string): Promise<`sha256:${string}`> => {
  const hash = createHash("sha256");
  await new Promise<void>((resolve, reject) => {
    const stream = createReadStream(file);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("error", reject);
    stream.on("end", resolve);
  });
  return `sha256:${hash.digest("hex")}`;
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
    typeof receipt.installSource !== "string" ||
    receipt.installSource.trim().length === 0
  )
    throw new Error(
      `Capture install receipt "${file}" is malformed. Run pnpm capture:install to replace it.`,
    );
  return receipt as IAutoMovieCaptureInstallReceipt;
};

const readReceipt = (projectRoot: string): IAutoMovieCaptureInstallReceipt => {
  const file = receiptPath(projectRoot);
  if (existsSync(file) === false)
    throw new Error(
      `Package-owned Chromium is not installed for this project. Run pnpm capture:install, then pnpm capture:doctor.`,
    );
  try {
    return parseReceipt(
      JSON.parse(readFileSync(file, "utf8")) as unknown,
      file,
    );
  } catch (error) {
    if (error instanceof SyntaxError)
      throw new Error(
        `Capture install receipt "${file}" is not valid JSON. Run pnpm capture:install to replace it.`,
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
  const installed = spawnSync(
    process.execPath,
    [metadata.cliPath, "install", BROWSER_NAME, "--no-shell"],
    {
      cwd: projectRoot,
      env: localBrowserEnvironment(projectRoot),
      encoding: "utf8",
      stdio: ["ignore", "inherit", "inherit"],
    },
  );
  if (installed.status !== 0)
    throw new Error(
      `Playwright Chromium installation failed with status ${
        installed.status ?? "signal"
      }. Check HTTPS_PROXY, PLAYWRIGHT_DOWNLOAD_HOST or PLAYWRIGHT_CHROMIUM_DOWNLOAD_HOST for your network or offline mirror, then retry pnpm capture:install.`,
    );
  const { chromium } = await loadPlaywright(projectRoot);
  const executablePath = chromium.executablePath();
  if (
    existsSync(executablePath) === false ||
    statSync(executablePath).isFile() === false
  )
    throw new Error(
      `Playwright reported no physical Chromium executable at "${executablePath}". Retry pnpm capture:install.`,
    );
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
      executablePath: path.resolve(executablePath),
      executableDigest: await digestFile(executablePath),
    },
    installSource:
      [
        process.env.PLAYWRIGHT_CHROMIUM_DOWNLOAD_HOST,
        process.env.PLAYWRIGHT_DOWNLOAD_HOST,
      ].find((value) => value !== undefined && value.trim().length !== 0) ??
      "playwright-cdn",
  };
  writeReceipt(projectRoot, receipt);
  return receipt;
};

const packageOwnedProvenance = async (
  projectRoot: string,
): Promise<IAutoMovieCaptureInstallReceipt> => {
  const metadata = playwrightMetadata();
  const receipt = readReceipt(projectRoot);
  const { chromium } = await loadPlaywright(projectRoot);
  const executablePath = path.resolve(chromium.executablePath());
  if (
    receipt.playwright.version !== metadata.packageVersion ||
    receipt.browser.revision !== metadata.browser.revision ||
    receipt.browser.version !== metadata.browser.browserVersion ||
    path.resolve(receipt.browser.executablePath) !== executablePath
  )
    throw new Error(
      "The capture install receipt does not match the current Playwright package and browser revision. Run pnpm capture:install, then pnpm capture:doctor.",
    );
  if (
    existsSync(executablePath) === false ||
    statSync(executablePath).isFile() === false ||
    (await digestFile(executablePath)) !== receipt.browser.executableDigest
  )
    throw new Error(
      "The package-owned Chromium executable is missing or differs from its install receipt. Run pnpm capture:install, then pnpm capture:doctor.",
    );
  return receipt;
};

export const launchCaptureBrowser = async (
  projectRoot: string,
  config: AutoMovieCaptureBrowserConfig,
): Promise<IAutoMovieCaptureBrowserSession> => {
  const metadata = playwrightMetadata();
  const { chromium } = await loadPlaywright(projectRoot);
  let product: IAutoMovieCaptureRuntimeIdentity["browser"]["product"];
  let source: IAutoMovieCaptureRuntimeIdentity["browser"]["source"];
  let revision: string | null;
  let executableDigest: `sha256:${string}` | null;
  let launch: NonNullable<Parameters<typeof chromium.launch>[0]>;
  if (config.source === "playwright-chromium") {
    const receipt = await packageOwnedProvenance(projectRoot);
    product = config.product;
    source = "package-owned";
    revision = receipt.browser.revision;
    executableDigest = receipt.browser.executableDigest;
    launch = { executablePath: receipt.browser.executablePath };
  } else if (config.source === "system-channel") {
    product = config.channel === "msedge" ? "msedge" : "chrome";
    source = "system-channel";
    revision = null;
    executableDigest = null;
    launch = { channel: config.channel };
  } else {
    const executablePath = path.resolve(projectRoot, config.executablePath);
    if (
      existsSync(executablePath) === false ||
      statSync(executablePath).isFile() === false
    )
      throw new Error(
        `Configured capture executable "${executablePath}" is not a physical file. Correct automovie.config.ts or install that executable.`,
      );
    product = "chromium";
    source = "configured-executable";
    revision = null;
    executableDigest = await digestFile(executablePath);
    launch = { executablePath };
  }
  let browser: Browser;
  try {
    browser = await chromium.launch({
      ...launch,
      headless: true,
      args: ["--use-angle=swiftshader"],
    });
  } catch (error) {
    throw new Error(
      `Capture browser launch failed: ${
        error instanceof Error ? error.message : String(error)
      } Run pnpm capture:install and pnpm capture:doctor. If Linux reports missing shared libraries, run pnpm exec playwright install-deps chromium; otherwise correct the explicit system-channel/configured-executable setting.`,
    );
  }
  const browserVersion = browser.version();
  if (
    source === "package-owned" &&
    browserVersion !== metadata.browser.browserVersion
  ) {
    await browser.close();
    throw new Error(
      `Package-owned Chromium reported version "${browserVersion}", expected "${metadata.browser.browserVersion}". Run pnpm capture:install, then pnpm capture:doctor.`,
    );
  }
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
      "Capture WebGL is unavailable or did not report vendor and renderer. Run pnpm capture:doctor and inspect the backend/driver diagnostic.",
    );
  return {
    requestedBackend: REQUESTED_BACKEND,
    ...graphics,
  };
};
