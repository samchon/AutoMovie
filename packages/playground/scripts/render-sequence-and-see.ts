/* eslint-disable no-console */
import {
  IAutoMovieRenderSpec,
  IAutoMovieSequence,
  IAutoMovieShot,
} from "@automovie/interface";
import {
  IAutoMovieSequenceRenderAdapters,
  IAutoMovieSequenceRenderAndSeeResult,
  IAutoMovieSequenceRenderFrame,
  IAutoMovieSequenceRenderPlan,
  IAutoMovieSequenceRenderTransitionSpan,
  renderSequenceAndSee,
} from "@automovie/render";
import * as HME from "h264-mp4-encoder";
import fs from "node:fs/promises";
import path from "node:path";
import { type Locator, type Page, chromium } from "playwright-core";
import { PNG } from "pngjs";

import { DEFAULT_CHROME_EXECUTABLE } from "./chromeExecutable";

const DEFAULT_BASE = process.env.BASE ?? "http://127.0.0.1:5173";

export interface IAutoMoviePlaygroundSequenceRenderOptions {
  page: string;
  query: string;
  base: string;
  chrome: string;
  fps: number;
  width: number;
  height: number;
  target: string | null;
  outputPath: string;
  frameDir: string;
  jsonPath: string;
}

export interface IAutoMoviePlaygroundSequenceMetadata {
  ready: true;
  duration: number;
  sequence: IAutoMovieSequence;
  shots: IAutoMovieShot[];
  shotIds: string[];
}

export interface IAutoMovieSequenceDissolvePixelCheck {
  transition: Pick<
    IAutoMovieSequenceRenderTransitionSpan,
    "from" | "to" | "start" | "end"
  >;
  frame: number | null;
  alpha: number | null;
  baselineDistance: number;
  actualToIncoming: number;
  actualToOutgoing: number;
  verified: boolean;
  reason: string | null;
}

export interface IAutoMoviePlaygroundSequenceRenderArtifact extends IAutoMovieSequenceRenderAndSeeResult {
  route: string;
  jsonPath: string;
  encoder: "h264-mp4-encoder";
  viewport: { width: number; height: number };
  page: {
    duration: number;
    shots: string[];
  };
  dissolveChecks: IAutoMovieSequenceDissolvePixelCheck[];
}

interface SequenceCaptureSession {
  metadata: IAutoMoviePlaygroundSequenceMetadata;
  view: Locator;
  captureFrame: IAutoMovieSequenceRenderAdapters["captureFrame"];
  captureShot(sample: {
    shot: string;
    shotTimeSeconds: number;
  }): Promise<Uint8Array>;
  close(): Promise<void>;
}

export const main = async (
  argv: string[] = process.argv.slice(2),
): Promise<void> => {
  const options = parseArgs(argv);
  if (options === null) {
    printHelp();
    return;
  }
  const artifact = await captureSequenceRenderAndSee(options);
  console.log(
    JSON.stringify(
      {
        output: artifact.output,
        json: artifact.jsonPath,
        frames: artifact.frameCount,
        route: artifact.route,
        dissolveChecks: artifact.dissolveChecks,
      },
      null,
      2,
    ),
  );
};

export const captureSequenceRenderAndSee = async (
  options: IAutoMoviePlaygroundSequenceRenderOptions,
): Promise<IAutoMoviePlaygroundSequenceRenderArtifact> => {
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
  const page = await browser.newPage({
    viewport: { width: options.width, height: options.height },
    deviceScaleFactor: 1,
  });
  const captured = new Map<number, string>();
  let closePage = true;
  try {
    const session = await openSequenceCaptureSession({
      page,
      url: route,
      writeFrame: async (file, bytes, frame) => {
        await fs.mkdir(path.dirname(file), { recursive: true });
        await fs.writeFile(file, Buffer.from(bytes));
        captured.set(frame.index, file);
      },
    });
    closePage = false;
    try {
      const spec: IAutoMovieRenderSpec = {
        target: options.target ?? session.metadata.sequence.id,
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
      const result = await renderSequenceAndSee({
        sequence: session.metadata.sequence,
        shots: session.metadata.shots,
        spec,
        frameDir: options.frameDir,
        outputPath: options.outputPath,
        adapters: {
          captureFrame: session.captureFrame,
          encode: createH264Encoder({ captured, spec }),
        },
      });
      const dissolveChecks = await verifyDissolvePixels({
        captured,
        frames: result.frames,
        transitions: result.plan.transitionSpans,
        captureShot: session.captureShot,
      });
      const artifact: IAutoMoviePlaygroundSequenceRenderArtifact = {
        ...result,
        route,
        jsonPath: options.jsonPath,
        encoder: "h264-mp4-encoder",
        viewport: { width: options.width, height: options.height },
        page: {
          duration: session.metadata.duration,
          shots: session.metadata.shotIds,
        },
        dissolveChecks,
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

const openSequenceCaptureSession = async (options: {
  page: Page;
  url: string;
  writeFrame: (
    path: string,
    bytes: Uint8Array,
    frame: IAutoMovieSequenceRenderFrame,
  ) => Promise<void>;
}): Promise<SequenceCaptureSession> => {
  await options.page.goto(options.url, { waitUntil: "load" });
  await options.page.waitForFunction(() => {
    const host = globalThis as unknown as Record<string, unknown>;
    const metadata = host.__automovie as { ready?: boolean } | undefined;
    return (
      metadata?.ready === true &&
      typeof host.__afSeekSequenceFrame === "function" &&
      typeof host.__afSeekSequenceShot === "function"
    );
  });
  await options.page.addStyleTag({
    content: "#clips{display:none!important}",
  });
  const view = options.page.locator("#view");
  const metadata = await readSequenceMetadata(options.page);
  return {
    metadata,
    view,
    captureFrame: async (frame) => {
      await options.page.evaluate((sample) => {
        const seek = (
          globalThis as unknown as {
            __afSeekSequenceFrame: (
              frame: Pick<
                IAutoMovieSequenceRenderFrame,
                "shot" | "shotTimeSeconds" | "blend"
              >,
            ) => void;
          }
        ).__afSeekSequenceFrame;
        seek(sample);
      }, toHostFrame(frame));
      const bytes = await view.screenshot({ type: "png" });
      if (bytes.byteLength === 0)
        throw new Error(`captured sequence frame ${frame.index} is empty`);
      await options.writeFrame(frame.path, bytes, frame);
      return frame.path;
    },
    captureShot: async (sample) => {
      await options.page.evaluate((shotSample) => {
        const seek = (
          globalThis as unknown as {
            __afSeekSequenceShot: (sample: {
              shot: string;
              shotTimeSeconds: number;
            }) => void;
          }
        ).__afSeekSequenceShot;
        seek(shotSample);
      }, sample);
      const bytes = await view.screenshot({ type: "png" });
      if (bytes.byteLength === 0)
        throw new Error(`captured sequence probe ${sample.shot} is empty`);
      return bytes;
    },
    close: async () => {
      await options.page.close();
    },
  };
};

const readSequenceMetadata = async (
  page: Page,
): Promise<IAutoMoviePlaygroundSequenceMetadata> => {
  const metadata = await page.evaluate(() => {
    const data = (
      globalThis as unknown as {
        __automovie?: {
          ready?: boolean;
          duration?: number;
          sequence?: IAutoMovieSequence;
          shots?: IAutoMovieShot[];
          shotIds?: string[];
        };
      }
    ).__automovie;
    return JSON.parse(JSON.stringify(data ?? null)) as unknown;
  });
  if (
    metadata === null ||
    typeof metadata !== "object" ||
    (metadata as { ready?: unknown }).ready !== true ||
    typeof (metadata as { duration?: unknown }).duration !== "number" ||
    typeof (metadata as { sequence?: { id?: unknown } }).sequence?.id !==
      "string" ||
    !Array.isArray((metadata as { shots?: unknown }).shots)
  )
    throw new Error(
      "sequence render route must expose __automovie { ready, duration, sequence, shots }",
    );
  const typed = metadata as IAutoMoviePlaygroundSequenceMetadata;
  return {
    ...typed,
    shotIds: Array.isArray(typed.shotIds)
      ? typed.shotIds
      : typed.shots.map((shot) => shot.id),
  };
};

const toHostFrame = (
  frame: IAutoMovieSequenceRenderFrame,
): Pick<
  IAutoMovieSequenceRenderFrame,
  "shot" | "shotTimeSeconds" | "blend"
> => ({
  shot: frame.shot,
  shotTimeSeconds: frame.shotTimeSeconds,
  blend: frame.blend,
});

const createH264Encoder =
  (options: {
    captured: Map<number, string>;
    spec: IAutoMovieRenderSpec;
  }): IAutoMovieSequenceRenderAdapters["encode"] =>
  async (_args, outputPath) => {
    const frameCount = options.captured.size;
    if (frameCount === 0) throw new Error("no captured sequence frames");
    const encoder = await HME.createH264MP4Encoder();
    encoder.width = options.spec.frameFormat.width;
    encoder.height = options.spec.frameFormat.height;
    encoder.frameRate = options.spec.frameFormat.fps;
    encoder.quantizationParameter = options.spec.crf;
    encoder.initialize();
    try {
      for (let i = 0; i < frameCount; ++i) {
        const file = options.captured.get(i);
        if (file === undefined)
          throw new Error(`missing captured sequence frame ${i} before encode`);
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

const verifyDissolvePixels = async (props: {
  captured: Map<number, string>;
  frames: IAutoMovieSequenceRenderFrame[];
  transitions: IAutoMovieSequenceRenderPlan["transitionSpans"];
  captureShot(sample: {
    shot: string;
    shotTimeSeconds: number;
  }): Promise<Uint8Array>;
}): Promise<IAutoMovieSequenceDissolvePixelCheck[]> => {
  const checks: IAutoMovieSequenceDissolvePixelCheck[] = [];
  for (const transition of props.transitions) {
    const candidates = props.frames.filter(
      (frame) =>
        frame.blend !== null &&
        frame.timeSeconds >= transition.start &&
        frame.timeSeconds < transition.end &&
        frame.blend.alpha > 0 &&
        frame.blend.alpha < 1,
    );
    const frame = nearestMidBlend(candidates);
    if (frame === null || frame.blend === null) {
      checks.push(emptyDissolveCheck(transition, "no blended frame sampled"));
      continue;
    }
    const actualPath = props.captured.get(frame.index);
    if (actualPath === undefined) {
      checks.push(emptyDissolveCheck(transition, "captured frame missing"));
      continue;
    }
    const actual = PNG.sync.read(await fs.readFile(actualPath));
    const outgoing = PNG.sync.read(
      Buffer.from(
        await props.captureShot({
          shot: frame.blend.shot,
          shotTimeSeconds: frame.blend.shotTimeSeconds,
        }),
      ),
    );
    const incoming = PNG.sync.read(
      Buffer.from(
        await props.captureShot({
          shot: frame.shot,
          shotTimeSeconds: frame.shotTimeSeconds,
        }),
      ),
    );
    const baseline = rgbDistance(outgoing, incoming);
    const actualToIncoming = rgbDistance(actual, incoming);
    const actualToOutgoing = rgbDistance(actual, outgoing);
    const verified =
      baseline > 0.1 &&
      actualToIncoming > 0.01 &&
      actualToOutgoing > 0.01 &&
      actualToIncoming < baseline &&
      actualToOutgoing < baseline;
    checks.push({
      transition: transitionSlice(transition),
      frame: frame.index,
      alpha: round(frame.blend.alpha),
      baselineDistance: round(baseline),
      actualToIncoming: round(actualToIncoming),
      actualToOutgoing: round(actualToOutgoing),
      verified,
      reason: verified
        ? null
        : "captured dissolve frame did not sit between outgoing and incoming probes",
    });
  }
  return checks;
};

const nearestMidBlend = (
  frames: IAutoMovieSequenceRenderFrame[],
): IAutoMovieSequenceRenderFrame | null => {
  let best: IAutoMovieSequenceRenderFrame | null = null;
  for (const frame of frames)
    if (
      frame.blend !== null &&
      (best === null ||
        Math.abs(frame.blend.alpha - 0.5) < Math.abs(best.blend!.alpha - 0.5))
    )
      best = frame;
  return best;
};

const emptyDissolveCheck = (
  transition: IAutoMovieSequenceRenderTransitionSpan,
  reason: string,
): IAutoMovieSequenceDissolvePixelCheck => ({
  transition: transitionSlice(transition),
  frame: null,
  alpha: null,
  baselineDistance: 0,
  actualToIncoming: 0,
  actualToOutgoing: 0,
  verified: false,
  reason,
});

const transitionSlice = (
  transition: IAutoMovieSequenceRenderTransitionSpan,
): IAutoMovieSequenceDissolvePixelCheck["transition"] => ({
  from: transition.from,
  to: transition.to,
  start: transition.start,
  end: transition.end,
});

const rgbDistance = (a: PNG, b: PNG): number => {
  if (a.width !== b.width || a.height !== b.height)
    throw new Error("cannot compare dissolve probes with different dimensions");
  let sum = 0;
  const pixels = a.width * a.height;
  for (let i = 0; i < a.data.length; i += 4) {
    sum += Math.abs(a.data[i]! - b.data[i]!);
    sum += Math.abs(a.data[i + 1]! - b.data[i + 1]!);
    sum += Math.abs(a.data[i + 2]! - b.data[i + 2]!);
  }
  return sum / (pixels * 3);
};

const round = (value: number): number => Math.round(value * 1_000) / 1_000;

const parseArgs = (
  argv: string[],
): IAutoMoviePlaygroundSequenceRenderOptions | null => {
  if (argv.includes("--help") || argv.includes("-h")) return null;
  const flags = readFlags(argv);
  const root = repoRoot();
  const outputPath = resolveFromRoot(
    root,
    flags.out ?? ".shots/_render-see/film-sequence.mp4",
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
    page: flags.page ?? "film.html",
    query: flags.query ?? "",
    base: flags.base ?? DEFAULT_BASE,
    chrome: flags.chrome ?? DEFAULT_CHROME_EXECUTABLE,
    fps: positiveNumber(flags.fps, 12, "--fps"),
    width: even(positiveInteger(flags.width, 640, "--width")),
    height: even(positiveInteger(flags.height, 360, "--height")),
    target: flags.target ?? null,
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
  // regardless of the viewport: the same URL contract capture-shots.mjs uses.
  url.searchParams.set("w", `${width}`);
  url.searchParams.set("h", `${height}`);
  return url.toString();
};

const printHelp = (): void => {
  console.log(`Usage:
  node scripts/render-sequence-and-see.cjs [options]

Options:
  --page <file>       Playground page, default film.html
  --query <query>     Query string without cap=1
  --fps <number>      Frames per second, default 12
  --width <px>        Viewport width, default 640
  --height <px>       Viewport height, default 360
  --out <path>        MP4 output, default .shots/_render-see/film-sequence.mp4
  --frames <path>     PNG frame directory
  --json <path>       JSON artifact path
  --target <id>       Render target id, default sequence id exposed by the page
  --base <url>        Dev server base, default ${DEFAULT_BASE}
  --chrome <path>     Chrome executable, default from CHROME/env platform
`);
};
