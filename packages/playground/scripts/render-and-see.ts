/* eslint-disable no-console */
import { IAutoMovieRenderSpec } from "@automovie/interface";
import {
  IAutoMovieRenderAdapters,
  IAutoMovieRenderAndSeeResult,
  createHeadlessCaptureAdapter,
  frameTimes,
  renderAndSee,
} from "@automovie/render";
import HMEmod from "h264-mp4-encoder";
import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright-core";
import { PNG } from "pngjs";

const HME = HMEmod.default ?? HMEmod;

const DEFAULT_BASE = process.env.BASE ?? "http://127.0.0.1:5173";
const DEFAULT_CHROME =
  process.env.CHROME ??
  {
    win32: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    darwin: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    linux: "google-chrome",
  }[process.platform] ??
  "google-chrome";

export interface IAutoMoviePlaygroundRenderAndSeeOptions {
  page: string;
  query: string;
  base: string;
  chrome: string;
  durationSeconds: number;
  fps: number;
  width: number;
  height: number;
  target: string;
  outputPath: string;
  frameDir: string;
  jsonPath: string;
}

export interface IAutoMoviePlaygroundRenderAndSeeArtifact extends IAutoMovieRenderAndSeeResult {
  route: string;
  jsonPath: string;
  encoder: "h264-mp4-encoder";
  viewport: { width: number; height: number };
}

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

export const captureRenderAndSee = async (
  options: IAutoMoviePlaygroundRenderAndSeeOptions,
): Promise<IAutoMoviePlaygroundRenderAndSeeArtifact> => {
  const route = routeUrl(options.base, options.page, options.query);
  const browser = await chromium.launch({
    executablePath: options.chrome,
    headless: true,
  });
  const page = await browser.newPage({
    viewport: { width: options.width, height: options.height },
    deviceScaleFactor: 1,
  });
  const captured = new Map<number, string>();
  let closePage = true;
  try {
    const session = await createHeadlessCaptureAdapter({
      page,
      url: route,
      writeFrame: async (file, bytes, metadata) => {
        await fs.mkdir(path.dirname(file), { recursive: true });
        await fs.writeFile(file, Buffer.from(bytes));
        captured.set(metadata.index, file);
      },
    });
    closePage = false;
    try {
      const spec: IAutoMovieRenderSpec = {
        target: options.target,
        fps: options.fps,
        width: options.width,
        height: options.height,
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
    } finally {
      await session.close();
    }
  } finally {
    if (closePage) await page.close();
    await browser.close();
  }
};

const createH264Encoder =
  (options: {
    captured: Map<number, string>;
    durationSeconds: number;
    spec: IAutoMovieRenderSpec;
  }): IAutoMovieRenderAdapters["encode"] =>
  async (_args, outputPath) => {
    const times = frameTimes(options.spec.fps, options.durationSeconds);
    const encoder = await HME.createH264MP4Encoder();
    encoder.width = options.spec.width;
    encoder.height = options.spec.height;
    encoder.frameRate = options.spec.fps;
    encoder.quantizationParameter = options.spec.crf;
    encoder.initialize();
    try {
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
    } finally {
      encoder.delete();
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
    chrome: flags.chrome ?? DEFAULT_CHROME,
    durationSeconds: positiveNumber(flags.duration, 1, "--duration"),
    fps: positiveNumber(flags.fps, 12, "--fps"),
    width: even(positiveInteger(flags.width, 640, "--width")),
    height: even(positiveInteger(flags.height, 360, "--height")),
    target: flags.target ?? stem,
    outputPath,
    frameDir,
    jsonPath,
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

const positiveInteger = (
  value: string | undefined,
  fallback: number,
  label: string,
): number => Math.round(positiveNumber(value, fallback, label));

const even = (value: number): number => value - (value % 2);

const repoRoot = (): string => {
  const cwd = process.cwd();
  return path.basename(cwd) === "playground" &&
    path.basename(path.dirname(cwd)) === "packages"
    ? path.resolve(cwd, "../..")
    : cwd;
};

const resolveFromRoot = (root: string, value: string): string =>
  path.isAbsolute(value) ? value : path.resolve(root, value);

const routeUrl = (base: string, page: string, query: string): string => {
  const normalizedBase = `${base.replace(/\/+$/, "")}/`;
  const url = new URL(page.replace(/^\/+/, ""), normalizedBase);
  const trimmed = query.trim().replace(/^\?/, "");
  if (trimmed.length > 0)
    new URLSearchParams(trimmed).forEach((value, key) =>
      url.searchParams.set(key, value),
    );
  url.searchParams.set("cap", "1");
  return url.toString();
};

const printHelp = (): void => {
  console.log(`Usage:
  node scripts/render-and-see.cjs [options]

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
`);
};
