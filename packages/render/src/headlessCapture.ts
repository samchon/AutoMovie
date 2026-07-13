import { AutoMovieGuidePass } from "@automovie/interface";

import { guidePassFrameName } from "./guidePasses";
import { IAutoMovieRenderAdapters } from "./renderVideo";

/** Error category raised by the headless capture adapter. */
export type AutoMovieHeadlessCaptureErrorCode =
  | "route"
  | "seek-hook"
  | "pass-hook"
  | "capture"
  | "empty-frame";

/**
 * Structured capture failure. The code tells an agent whether it missed a page
 * route, a deterministic seek hook, the screenshot call, or an empty frame.
 */
export class AutoMovieHeadlessCaptureError extends Error {
  /** Machine-readable failure category. */
  public readonly code: AutoMovieHeadlessCaptureErrorCode;

  /** Original host error, when one exists. */
  public readonly source: unknown;

  public constructor(
    code: AutoMovieHeadlessCaptureErrorCode,
    message: string,
    source?: unknown,
  ) {
    super(message);
    this.name = "AutoMovieHeadlessCaptureError";
    this.code = code;
    this.source = source;
  }
}

/**
 * Minimal Playwright-like page surface the capture adapter needs.
 *
 * @author Samchon
 */
export interface IAutoMovieHeadlessPage {
  /** Navigate to the viewer route. */
  goto(url: string, options: { waitUntil: string }): Promise<unknown>;

  /** Wait until the viewer exposes its deterministic seek hook. */
  waitForFunction<T>(predicate: (arg: T) => unknown, arg: T): Promise<unknown>;

  /** Inject a style rule, usually to hide UI chrome before screenshots. */
  addStyleTag(options: { content: string }): Promise<unknown>;

  /** Run a browser-side function, used to drive the seek hook. */
  evaluate<T>(task: (arg: T) => unknown, arg: T): Promise<unknown>;

  /** Find the element whose pixels should be captured. */
  locator(selector: string): IAutoMovieHeadlessLocator;

  /** Close the host page after capture. */
  close(): Promise<unknown>;
}

/**
 * Minimal Playwright-like locator surface for screenshots.
 *
 * @author Samchon
 */
export interface IAutoMovieHeadlessLocator {
  /** Capture the element as PNG bytes. */
  screenshot(options: { type: "png" }): Promise<Uint8Array>;
}

/** Host filesystem write injected into the adapter. */
export type IAutoMovieHeadlessFrameWriter = (
  path: string,
  bytes: Uint8Array,
  metadata: { timeSeconds: number; index: number },
) => Promise<void>;

/**
 * Options for opening one deterministic capture session.
 *
 * @author Samchon
 */
export interface IAutoMovieHeadlessCaptureOptions {
  /** Playwright-like page to drive. */
  page: IAutoMovieHeadlessPage;

  /** Fully resolved viewer URL, including `cap=1` when the route needs it. */
  url: string;

  /** Element selector to screenshot. Defaults to `#view`. */
  viewSelector?: string;

  /** UI selector to hide before capture. Defaults to `#clips`; null disables. */
  hideSelector?: string | null;

  /** Browser global seek function name. Defaults to `__afSeek`. */
  seekFunction?: string;

  /**
   * Guide passes to capture per frame (#1165). Each frame seeks once, then
   * every listed pass is rendered via the viewer's pass hook and written to its
   * pass-tagged file (`frame_00042.depth.png`; `beauty` keeps the plain name).
   * Omit (or pass exactly `["beauty"]`) for the legacy single-pass capture,
   * which never touches the pass hook and stays byte-identical.
   */
  passes?: readonly AutoMovieGuidePass[];

  /**
   * Browser global pass-switch function name. Defaults to `__afPass`. Only
   * required (and awaited) when `passes` asks for more than plain beauty.
   */
  passFunction?: string;

  /** Navigation wait condition. Defaults to `load`. */
  waitUntil?: string;

  /** Persist one PNG frame and its metadata. */
  writeFrame: IAutoMovieHeadlessFrameWriter;
}

/**
 * Open capture session returned by {@link createHeadlessCaptureAdapter}.
 *
 * @author Samchon
 */
export interface IAutoMovieHeadlessCaptureSession {
  /** Adapter usable as `renderVideo(..., { captureFrame, encode })`. */
  captureFrame: IAutoMovieRenderAdapters["captureFrame"];

  /** Close the underlying page. */
  close(): Promise<void>;
}

/**
 * Create a reusable `captureFrame` adapter over a Playwright-like page. It
 * loads the viewer route once, waits for the deterministic seek hook, then
 * captures `#view` after each `captureFrame(t, i, dir)` call.
 */
export const createHeadlessCaptureAdapter = async (
  options: IAutoMovieHeadlessCaptureOptions,
): Promise<IAutoMovieHeadlessCaptureSession> => {
  const seekFunction = options.seekFunction ?? "__afSeek";
  const passFunction = options.passFunction ?? "__afPass";
  const viewSelector = options.viewSelector ?? "#view";
  const passes: readonly AutoMovieGuidePass[] = options.passes ?? ["beauty"];
  if (passes.length === 0)
    throw new AutoMovieHeadlessCaptureError(
      "pass-hook",
      "capture passes must contain at least one guide pass",
    );
  // Legacy single-beauty captures never touch the pass hook, so a viewer
  // predating it (or a plain beauty run) behaves byte-identically.
  const switchesPasses = passes.some((pass) => pass !== "beauty");
  await guardCapture(
    "route",
    `could not load render route "${options.url}"`,
    () =>
      options.page.goto(options.url, {
        waitUntil: options.waitUntil ?? "load",
      }),
  );
  await guardCapture(
    "seek-hook",
    `render route "${options.url}" did not expose ${seekFunction}`,
    () =>
      options.page.waitForFunction(
        (name) =>
          typeof (globalThis as unknown as Record<string, unknown>)[name] ===
          "function",
        seekFunction,
      ),
  );
  if (switchesPasses)
    await guardCapture(
      "pass-hook",
      `render route "${options.url}" did not expose ${passFunction} (required for guide passes ${passes.join(", ")})`,
      () =>
        options.page.waitForFunction(
          (name) =>
            typeof (globalThis as unknown as Record<string, unknown>)[name] ===
            "function",
          passFunction,
        ),
    );
  if (options.hideSelector !== null)
    await guardCapture(
      "capture",
      `could not hide render ui "${options.hideSelector ?? "#clips"}"`,
      () =>
        options.page.addStyleTag({
          content: `${options.hideSelector ?? "#clips"}{display:none!important}`,
        }),
    );
  const view = options.page.locator(viewSelector);
  return {
    captureFrame: async (timeSeconds, index, dir) => {
      await guardCapture(
        "seek-hook",
        `seek hook ${seekFunction} failed at t=${timeSeconds}`,
        () =>
          options.page.evaluate(
            ({ name, t }) => {
              const seek = (
                globalThis as unknown as Record<string, (time: number) => void>
              )[name];
              seek(t);
            },
            { name: seekFunction, t: timeSeconds },
          ),
      );
      const base = dir.replace(/[\\/]+$/, "");
      let primary: string | null = null;
      for (const pass of passes) {
        if (switchesPasses)
          await guardCapture(
            "pass-hook",
            `pass hook ${passFunction} failed for "${pass}" at t=${timeSeconds}`,
            () =>
              options.page.evaluate(
                ({ name, p }) => {
                  const apply = (
                    globalThis as unknown as Record<
                      string,
                      (pass: string) => void
                    >
                  )[name];
                  apply(p);
                },
                { name: passFunction, p: pass },
              ),
          );
        const bytes = await guardCapture(
          "capture",
          `could not capture ${viewSelector} (${pass}) at t=${timeSeconds}`,
          () => view.screenshot({ type: "png" }),
        );
        if (bytes.byteLength === 0)
          throw new AutoMovieHeadlessCaptureError(
            "empty-frame",
            `captured ${viewSelector} (${pass}) at t=${timeSeconds} but received zero bytes`,
          );
        const path = `${base}/${guidePassFrameName(index, pass)}`;
        await options.writeFrame(path, bytes, { timeSeconds, index });
        // renderVideo's contract wants ONE path per frame — the beauty frame
        // it encodes; a guides-only capture returns its first pass instead.
        if (primary === null || pass === "beauty") primary = path;
      }
      // passes is non-empty (gated at creation), so the loop always set it.
      return primary!;
    },
    close: async () => {
      await options.page.close();
    },
  };
};

const guardCapture = async <T>(
  code: AutoMovieHeadlessCaptureErrorCode,
  message: string,
  task: () => Promise<T>,
): Promise<T> => {
  try {
    return await task();
  } catch (error) {
    throw new AutoMovieHeadlessCaptureError(code, message, error);
  }
};
