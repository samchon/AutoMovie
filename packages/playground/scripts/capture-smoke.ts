/* eslint-disable no-console */
import { createHeadlessCaptureAdapter } from "@automovie/render";
import { maskColor } from "@automovie/viewer";
import { spawn } from "node:child_process";
import path from "node:path";
import { chromium } from "playwright-core";
import { PNG } from "pngjs";

import { DEFAULT_CHROME_EXECUTABLE } from "./chromeExecutable";

const DEFAULT_BASE = process.env.BASE ?? "http://127.0.0.1:5173";
const WIDTH = 640;
const HEIGHT = 360;
const DEV_SERVER_OUTPUT_MAX_CHARS = 1024 * 1024;
const DEV_SERVER_POLL_INTERVAL_MS = 500;
const DEV_SERVER_PROBE_TIMEOUT_MS = 2_000;
const DEV_SERVER_READY_TIMEOUT_MS = 30_000;
const DEV_SERVER_READY_MARKER = "automovie-stickman-capture-v1";

interface DevServerExit {
  code: number | null;
  signal: NodeJS.Signals | null;
}

const appendDevServerOutput = (current: string, chunk: string): string =>
  `${current}${chunk}`.slice(-DEV_SERVER_OUTPUT_MAX_CHARS);

const devServerFailure = (props: {
  error: Error | null;
  exit: DevServerExit | null;
  stderr: string;
  stdout: string;
}): string | null => {
  const evidence = `stdout=${JSON.stringify(props.stdout)}; stderr=${JSON.stringify(props.stderr)}`;
  if (props.error !== null)
    return `dev server failed to spawn; error=${(props.error as NodeJS.ErrnoException).code ?? "unknown"}; message=${JSON.stringify(props.error.message)}; ${evidence}`;
  if (props.exit !== null)
    return `dev server exited before readiness; status=${props.exit.code ?? "none"}; signal=${props.exit.signal ?? "none"}; ${evidence}`;
  return null;
};

const requireCapturedFrame = (
  runs: ReadonlyArray<ReadonlyMap<string, Uint8Array>>,
  runIndex: number,
  name: string,
): Uint8Array => {
  const run = runs[runIndex];
  const frame = run?.get(name);
  if (frame === undefined)
    throw new Error(
      `capture smoke run ${runIndex + 1} is missing ${JSON.stringify(name)}; captured=${JSON.stringify([...(run?.keys() ?? [])])}`,
    );
  return frame;
};

/**
 * The one REAL (non-faked) headless-capture smoke (#1170). Everything the unit
 * suite fakes, this drives for real: Chrome renders the live playground page,
 * the multi-pass adapter captures beauty/mask/pose, and the frames are judged
 * STRUCTURALLY, not byte-hashed against a golden file (GPU rasterization
 * differs across hosts) but against invariants any correct capture satisfies:
 *
 * - Determinism: two independent capture sessions produce byte-identical frames
 *   per pass (same machine, same bytes: the reproducibility headline).
 * - Mask structure: the exact `maskColor(0)` segment color covers a plausible
 *   subject fraction, and the black background dominates.
 * - Pose structure: white skeleton lines exist in a plausible fraction on black,
 *   with no mask palette bleeding through.
 * - Pass switching: the beauty frame differs from the mask frame.
 *
 * Needs Google Chrome; the Vite dev server is reused when already running at
 * `--base`, else spawned (and killed) automatically. Exits non-zero on any
 * failed check. Run it via `pnpm smoke:capture`.
 */
export const main = async (
  argv: string[] = process.argv.slice(2),
): Promise<void> => {
  const flags = readFlags(argv);
  const base = flags.base ?? DEFAULT_BASE;
  const chrome = flags.chrome ?? DEFAULT_CHROME_EXECUTABLE;
  // Pin the capture canvas to the frame size (#1251) via the w/h URL contract, so
  // the screenshot is WxH regardless of the viewport (the same pin capture-shots
  // and the render-and-see harnesses use).
  const route = `${base.replace(/\/+$/, "")}/stickman.html?char=human&clip=walk&az=80&cap=1&w=${WIDTH}&h=${HEIGHT}`;

  const server = await ensureDevServer(base);
  try {
    const runs: Array<Map<string, Uint8Array>> = [];
    const browser = await chromium.launch({
      executablePath: chrome,
      headless: true,
    });
    try {
      for (let run = 0; run < 2; ++run) {
        const page = await browser.newPage({
          viewport: { width: WIDTH, height: HEIGHT },
          deviceScaleFactor: 1,
        });
        const frames = new Map<string, Uint8Array>();
        const session = await createHeadlessCaptureAdapter({
          page,
          url: route,
          passes: ["beauty", "mask", "pose"],
          writeFrame: async (file, bytes) => {
            frames.set(path.basename(file), bytes);
          },
        });
        await session.captureFrame(0, 0, "smoke");
        await session.close();
        runs.push(frames);
      }
    } finally {
      await browser.close();
    }

    const checks: Record<string, boolean> = {};
    const names = [
      "frame_00000.png",
      "frame_00000.mask.png",
      "frame_00000.pose.png",
    ];
    for (const name of names)
      checks[`deterministic ${name}`] = equalBytes(
        requireCapturedFrame(runs, 0, name),
        requireCapturedFrame(runs, 1, name),
      );

    const mask = histogram(
      requireCapturedFrame(runs, 0, "frame_00000.mask.png"),
    );
    const pose = histogram(
      requireCapturedFrame(runs, 0, "frame_00000.pose.png"),
    );
    const total = WIDTH * HEIGHT;
    const subject = maskColor(0);
    const subjectKey = rgbKey(
      Math.round(subject.r * 255),
      Math.round(subject.g * 255),
      Math.round(subject.b * 255),
    );
    checks["mask subject color covers >= 0.3% of the frame"] =
      (mask.get(subjectKey) ?? 0) >= total * 0.003;
    checks["mask background is dominant black"] =
      (mask.get(rgbKey(0, 0, 0)) ?? 0) >= total * 0.25;
    const white = pose.get(rgbKey(255, 255, 255)) ?? 0;
    checks["pose skeleton draws white lines (0.02%..20%)"] =
      white >= total * 0.0002 && white <= total * 0.2;
    checks["pose carries no mask palette"] = (pose.get(subjectKey) ?? 0) === 0;
    checks["beauty differs from mask (passes actually switch)"] = !equalBytes(
      requireCapturedFrame(runs, 0, "frame_00000.png"),
      requireCapturedFrame(runs, 0, "frame_00000.mask.png"),
    );

    const failed = Object.entries(checks).filter(([, ok]) => !ok);
    console.log(
      JSON.stringify(
        { route, server: server.spawned ? "spawned" : "reused", checks },
        null,
        2,
      ),
    );
    if (failed.length > 0)
      throw new Error(
        `capture smoke failed: ${failed.map(([name]) => name).join("; ")}`,
      );
  } finally {
    server.close();
  }
};

/** Reuse a listening dev server, else spawn Vite and wait for it to answer. */
const ensureDevServer = async (
  base: string,
): Promise<{ spawned: boolean; close: () => void }> => {
  if (await answers(base, DEV_SERVER_PROBE_TIMEOUT_MS))
    return { spawned: false, close: () => {} };
  const port = new URL(base).port || "5173";
  const playground = path.resolve(__dirname, "..");
  // vite's `exports` map hides bin/vite.js from require.resolve; the
  // package.json subpath is exported, so locate the bin from its directory.
  const vite = path.join(
    path.dirname(require.resolve("vite/package.json", { paths: [playground] })),
    "bin/vite.js",
  );
  const child = spawn(
    process.execPath,
    [vite, "--host", "127.0.0.1", "--port", port, "--strictPort"],
    { cwd: playground, stdio: ["ignore", "pipe", "pipe"] },
  );
  let error: Error | null = null;
  let exit: DevServerExit | null = null;
  let stderr = "";
  let stdout = "";
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk: string) => {
    stdout = appendDevServerOutput(stdout, chunk);
  });
  child.stderr.on("data", (chunk: string) => {
    stderr = appendDevServerOutput(stderr, chunk);
  });
  child.once("error", (cause) => {
    error = cause;
  });
  child.once("exit", (code, signal) => {
    exit = { code, signal };
  });
  const closed = new Promise<void>((resolve) => {
    child.once("close", (code, signal) => {
      exit = { code, signal };
      resolve();
    });
  });
  const currentExit = (): DevServerExit | null =>
    exit ??
    (child.exitCode !== null || child.signalCode !== null
      ? { code: child.exitCode, signal: child.signalCode }
      : null);
  const failureAfterClose = async (): Promise<string | null> => {
    if (error === null && currentExit() === null) return null;
    await closed;
    return devServerFailure({
      error,
      exit: currentExit(),
      stderr,
      stdout,
    });
  };
  const deadline = Date.now() + DEV_SERVER_READY_TIMEOUT_MS;
  while (true) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) break;
    const answered = await answers(
      base,
      Math.min(DEV_SERVER_PROBE_TIMEOUT_MS, remaining),
    );
    const failure = await failureAfterClose();
    if (failure !== null) {
      child.kill();
      throw new Error(failure);
    }
    if (answered) return { spawned: true, close: () => child.kill() };
    const delay = Math.min(DEV_SERVER_POLL_INTERVAL_MS, deadline - Date.now());
    if (delay > 0)
      await new Promise((resolve) => {
        setTimeout(resolve, delay);
      });
  }
  const failure = await failureAfterClose();
  if (failure !== null) {
    child.kill();
    throw new Error(failure);
  }
  child.kill();
  throw new Error(
    `dev server remained alive but did not answer at ${base} within 30s; stdout=${JSON.stringify(stdout)}; stderr=${JSON.stringify(stderr)}`,
  );
};

const answers = async (base: string, timeoutMs: number): Promise<boolean> => {
  try {
    const response = await fetch(`${base.replace(/\/+$/, "")}/stickman.html`, {
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) return false;
    return (await response.text()).includes(DEV_SERVER_READY_MARKER);
  } catch {
    return false;
  }
};

/** Exact-color histogram of a PNG: `"r,g,b"` → pixel count. */
const histogram = (bytes: Uint8Array): Map<string, number> => {
  const png = PNG.sync.read(Buffer.from(bytes));
  const counts = new Map<string, number>();
  for (let i = 0; i < png.data.length; i += 4) {
    const key = rgbKey(png.data[i]!, png.data[i + 1]!, png.data[i + 2]!);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
};

const rgbKey = (r: number, g: number, b: number): string => `${r},${g},${b}`;

const equalBytes = (a: Uint8Array, b: Uint8Array): boolean =>
  a.byteLength === b.byteLength &&
  Buffer.compare(Buffer.from(a), Buffer.from(b)) === 0;

const readFlags = (argv: string[]): Record<string, string | undefined> => {
  const flags: Record<string, string | undefined> = {};
  for (let i = 0; i < argv.length; ++i) {
    const arg = argv[i]!;
    if (!arg.startsWith("--")) continue;
    flags[arg.slice(2)] = argv[i + 1];
  }
  return flags;
};
