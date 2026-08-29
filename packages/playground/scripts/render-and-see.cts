/* eslint-disable no-console */
import { AutoMovieGuidePass, IAutoMovieRenderSpec } from "@automovie/interface";
import {
  IAutoMovieRenderAdapters,
  IAutoMovieRenderAndSeeResult,
  createHeadlessCaptureAdapter,
  frameTimes,
  normalizeGuidePasses,
  renderAndSee,
} from "@automovie/render";
import * as HME from "h264-mp4-encoder";
import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright-core";
import { PNG } from "pngjs";

import { DEFAULT_CHROME_EXECUTABLE } from "./chromeExecutable";
import { preserveCleanupFailure } from "./preserveCleanupFailure";

const DEFAULT_BASE = process.env.BASE ?? "http://127.0.0.1:5173";

/**
 * Inputs for capturing one playground route into deterministic frame files and
 * an H.264 preview.
 *
 * @author Samchon
 */
export interface IAutoMoviePlaygroundRenderAndSeeOptions {
  /** Vite page loaded for the capture. */
  page: string;
  /** Page-specific query parameters added before capture controls. */
  query: string;
  /** Base URL of the running playground server. */
  base: string;
  /** Chrome or Chromium executable used for the headless session. */
  chrome: string;
  /** Film interval captured from the page, in seconds. */
  durationSeconds: number;
  /** Frame sampling rate used by capture and encoding. */
  fps: number;
  /** Output frame width in pixels. */
  width: number;
  /** Output frame height in pixels. */
  height: number;
  /** Stable render target identity recorded in the result. */
  target: string;
  /** Destination of the encoded H.264 MP4. */
  outputPath: string;
  /** Directory receiving the source PNG sequence. */
  frameDir: string;
  /** Destination of the machine-readable capture artifact. */
  jsonPath: string;
  /** Guide passes captured per frame (#1165); defaults to plain beauty. */
  passes: AutoMovieGuidePass[];
}

/**
 * Render result augmented with the playground route and local capture facts.
 *
 * @author Samchon
 */
export interface IAutoMoviePlaygroundRenderAndSeeArtifact extends IAutoMovieRenderAndSeeResult {
  /** Fully resolved headless route, including capture query parameters. */
  route: string;
  /** Path where this artifact is serialized. */
  jsonPath: string;
  /** Encoder implementation used to materialize the preview. */
  encoder: "h264-mp4-encoder";
  /** Pixel dimensions applied to both the browser viewport and render spec. */
  viewport: { width: number; height: number };
}

/** Parse the command line, capture the route, and print its artifact summary. */
export const main = async (
  argv: string[] = process.argv.slice(2),
): Promise<void> => {
  const options = parseArgs(argv);
  if (options === null) {
    printHelp();
    return;
  }
  const artifact = await captureRenderAndSee(options);
  console.log(
    JSON.stringify(
      {
        output: artifact.output,
        json: artifact.jsonPath,
        frames: artifact.frameCount,
        route: artifact.route,
      },
      null,
      2,
    ),
  );
};

/**
 * Capture a fixed frame schedule from one playground page and encode its PNG
 * sequence while preserving the original failure across all cleanup steps.
 */
export const captureRenderAndSee = async (
  options: IAutoMoviePlaygroundRenderAndSeeOptions,
): Promise<IAutoMoviePlaygroundRenderAndSeeArtifact> => {
  const route = routeUrl(
    options.base,
    options.page,
    options.query,
    options.width,
    options.height,
  );
  const browser = await chromium.launch({
    executablePath: options.chrome,
    headless: true,
  });
  let browserFailure: { error: unknown } | undefined;
  try {
    const page = await browser.newPage({
      viewport: { width: options.width, height: options.height },
      deviceScaleFactor: 1,
    });
    const captured = new Map<number, string>();
    let closePage = true;
    let pageFailure: { error: unknown } | undefined;
    try {
      const session = await createHeadlessCaptureAdapter({
        page,
        url: route,
        passes: options.passes,
        writeFrame: async (file, bytes, metadata) => {
          await fs.mkdir(path.dirname(file), { recursive: true });
          await fs.writeFile(file, Buffer.from(bytes));
          captured.set(metadata.index, file);
        },
      });
      closePage = false;
      let sessionFailure: { error: unknown } | undefined;
      try {
        const spec: IAutoMovieRenderSpec = {
          target: options.target,
          frameFormat: {
            fps: options.fps,
            width: options.width,
            height: options.height,
          },
          toneMapping: "none",
          codec: "h264",
          pixelFormat: "yuv420p",
          crf: 20,
        };
        const result = await renderAndSee({
          spec,
          durationSeconds: options.durationSeconds,
          frameDir: options.frameDir,
          outputPath: options.outputPath,
          adapters: {
            captureFrame: session.captureFrame,
            encode: createH264Encoder({
              captured,
              durationSeconds: options.durationSeconds,
              spec,
            }),
          },
        });
        const artifact: IAutoMoviePlaygroundRenderAndSeeArtifact = {
          ...result,
          route,
          jsonPath: options.jsonPath,
          encoder: "h264-mp4-encoder",
          viewport: { width: options.width, height: options.height },
        };
        await fs.mkdir(path.dirname(options.jsonPath), { recursive: true });
        await fs.writeFile(options.jsonPath, JSON.stringify(artifact, null, 2));
        return artifact;
      } catch (error) {
        sessionFailure = { error };
        throw error;
      } finally {
        await preserveCleanupFailure(
          sessionFailure,
          "render capture session",
          () => session.close(),
        );
      }
    } catch (error) {
      pageFailure = { error };
      throw error;
    } finally {
      await preserveCleanupFailure(pageFailure, "render capture page", () =>
        closePage ? page.close() : undefined,
      );
    }
  } catch (error) {
    browserFailure = { error };
    throw error;
  } finally {
    await preserveCleanupFailure(browserFailure, "render capture browser", () =>
      browser.close(),
    );
  }
};

const createH264Encoder =
  (options: {
    captured: Map<number, string>;
    durationSeconds: number;
    spec: IAutoMovieRenderSpec;
  }): IAutoMovieRenderAdapters["encode"] =>
  async (_args, outputPath) => {
    const times = frameTimes(
      options.spec.frameFormat.fps,
      options.durationSeconds,
    );
    const encoder = await HME.createH264MP4Encoder();
    let encoderFailure: { error: unknown } | undefined;
    try {
      encoder.width = options.spec.frameFormat.width;
      encoder.height = options.spec.frameFormat.height;
      encoder.frameRate = options.spec.frameFormat.fps;
      encoder.quantizationParameter = options.spec.crf;
      encoder.initialize();
      for (let i = 0; i < times.length; ++i) {
        const file = options.captured.get(i);
        if (file === undefined)
          throw new Error(`missing captured frame ${i} before encode`);
        const png = PNG.sync.read(await fs.readFile(file));
        encoder.addFrameRgba(new Uint8Array(png.data));
      }
      encoder.finalize();
      await fs.mkdir(path.dirname(outputPath), { recursive: true });
      await fs.writeFile(
        outputPath,
        Buffer.from(encoder.FS.readFile(encoder.outputFilename)),
      );
      return outputPath;
    } catch (error) {
      encoderFailure = { error };
      throw error;
    } finally {
      await preserveCleanupFailure(encoderFailure, "render H.264 encoder", () =>
        encoder.delete(),
      );
    }
  };

const parseArgs = (
  argv: string[],
): IAutoMoviePlaygroundRenderAndSeeOptions | null => {
  if (argv.includes("--help") || argv.includes("-h")) return null;
  const flags = readFlags(argv);
  const root = repoRoot();
  const outputPath = resolveFromRoot(
    root,
    flags.out ?? ".shots/_render-see/stickman-walk.mp4",
  );
  const stem = path.basename(outputPath, path.extname(outputPath));
  const frameDir = resolveFromRoot(
    root,
    flags.frames ?? path.join(".shots/_render-see", `${stem}-frames`),
  );
  const jsonPath = resolveFromRoot(
    root,
    flags.json ?? path.join(".shots/_render-see", `${stem}.json`),
  );
  return {
    page: flags.page ?? "stickman.html",
    query: flags.query ?? "char=human&clip=walk&az=80",
    base: flags.base ?? DEFAULT_BASE,
    chrome: flags.chrome ?? DEFAULT_CHROME_EXECUTABLE,
    durationSeconds: positiveNumber(flags.duration, 1, "--duration"),
    fps: positiveNumber(flags.fps, 12, "--fps"),
    width: positiveEvenInteger(flags.width, 640, "--width"),
    height: positiveEvenInteger(flags.height, 360, "--height"),
    target: flags.target ?? stem,
    outputPath,
    frameDir,
    jsonPath,
    // normalizeGuidePasses validates + de-dups and throws on an unknown name.
    passes: normalizeGuidePasses(flags.passes?.split(",") ?? ["beauty"]),
  };
};

const readFlags = (argv: string[]): Record<string, string | undefined> => {
  const flags: Record<string, string | undefined> = {};
  for (let i = 0; i < argv.length; ++i) {
    const arg = argv[i]!;
    if (!arg.startsWith("--")) continue;
    const eq = arg.indexOf("=");
    if (eq >= 0) {
      flags[arg.slice(2, eq)] = arg.slice(eq + 1);
      continue;
    }
    const next = argv[i + 1];
    flags[arg.slice(2)] = next && !next.startsWith("--") ? next : "true";
    if (next && !next.startsWith("--")) ++i;
  }
  return flags;
};

const positiveNumber = (
  value: string | undefined,
  fallback: number,
  label: string,
): number => {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0)
    throw new Error(`${label} must be a positive finite number`);
  return parsed;
};

const positiveEvenInteger = (
  value: string | undefined,
  fallback: number,
  label: string,
): number => {
  const parsed = positiveNumber(value, fallback, label);
  if (!Number.isInteger(parsed) || parsed % 2 !== 0)
    throw new Error(`${label} must be a positive even integer`);
  return parsed;
};

const repoRoot = (): string => {
  const cwd = process.cwd();
  return path.basename(cwd) === "playground" &&
    path.basename(path.dirname(cwd)) === "packages"
    ? path.resolve(cwd, "../..")
    : cwd;
};

const resolveFromRoot = (root: string, value: string): string =>
  path.isAbsolute(value) ? value : path.resolve(root, value);

const routeUrl = (
  base: string,
  page: string,
  query: string,
  width: number,
  height: number,
): string => {
  const normalizedBase = `${base.replace(/\/+$/, "")}/`;
  const url = new URL(page.replace(/^\/+/, ""), normalizedBase);
  const trimmed = query.trim().replace(/^\?/, "");
  if (trimmed.length > 0)
    new URLSearchParams(trimmed).forEach((value, key) =>
      url.searchParams.set(key, value),
    );
  url.searchParams.set("cap", "1");
  // Pin the capture canvas to the frame size (#1251), so the screenshot is WxH
  // regardless of the viewport: the same URL contract capture-shots.ts uses.
  url.searchParams.set("w", `${width}`);
  url.searchParams.set("h", `${height}`);
  return url.toString();
};

const printHelp = (): void => {
  console.log(`Usage:
  pnpm render:see -- [options]

Options:
  --page <file>       Playground page, default stickman.html
  --query <query>     Query string without cap=1, default human walk
  --duration <sec>    Duration in seconds, default 1
  --fps <number>      Frames per second, default 12
  --width <px>        Viewport width, default 640
  --height <px>       Viewport height, default 360
  --out <path>        MP4 output, default .shots/_render-see/stickman-walk.mp4
  --frames <path>     PNG frame directory
  --json <path>       JSON artifact path
  --target <id>       Render target id recorded in the artifact
  --base <url>        Dev server base, default ${DEFAULT_BASE}
  --chrome <path>     Chrome executable, default from CHROME/env platform
  --passes <list>     Comma-separated guide passes (beauty,depth,mask,outline,pose)
                      captured per frame; default beauty only
`);
};

if (path.resolve(process.argv[1] ?? "") === path.resolve(__filename))
  void main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
