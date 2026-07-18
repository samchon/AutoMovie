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

/**
 * The one REAL (non-faked) headless-capture smoke (#1170). Everything the unit
 * suite fakes, this drives for real: Chrome renders the live playground page,
 * the multi-pass adapter captures beauty/mask/pose, and the frames are judged
 * STRUCTURALLY — not byte-hashed against a golden file (GPU rasterization
 * differs across hosts) but against invariants any correct capture satisfies:
 *
 * - Determinism: two independent capture sessions produce byte-identical frames
 *   per pass (same machine, same bytes — the reproducibility headline).
 * - Mask structure: the exact `maskColor(0)` segment color covers a plausible
 *   subject fraction, and the black background dominates.
 * - Pose structure: white skeleton lines exist in a plausible fraction on black,
 *   with no mask palette bleeding through.
 * - Pass switching: the beauty frame differs from the mask frame.
 *
 * Needs Google Chrome; the Vite dev server is reused when already running at
 * `--base`, else spawned (and killed) automatically. Exits non-zero on any
 * failed check — run it via `pnpm smoke:capture`.
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
        runs[0]!.get(name)!,
        runs[1]!.get(name)!,
      );

    const mask = histogram(runs[0]!.get("frame_00000.mask.png")!);
    const pose = histogram(runs[0]!.get("frame_00000.pose.png")!);
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
      runs[0]!.get("frame_00000.png")!,
      runs[0]!.get("frame_00000.mask.png")!,
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
  if (await answers(base)) return { spawned: false, close: () => {} };
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
    { cwd: playground, stdio: "ignore" },
  );
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (await answers(base))
      return { spawned: true, close: () => child.kill() };
    await new Promise((resolve) => {
      setTimeout(resolve, 500);
    });
  }
  child.kill();
  throw new Error(`dev server did not answer at ${base} within 30s`);
};

const answers = async (base: string): Promise<boolean> => {
  try {
    const response = await fetch(`${base.replace(/\/+$/, "")}/stickman.html`);
    return response.ok;
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
