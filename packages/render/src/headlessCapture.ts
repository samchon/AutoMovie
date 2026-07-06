import { frameName } from "./plan";
import { IAutoMovieRenderAdapters } from "./renderVideo";

/** Error category raised by the headless capture adapter. */
export type AutoMovieHeadlessCaptureErrorCode =
  | "route"
  | "seek-hook"
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
  const viewSelector = options.viewSelector ?? "#view";
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
      const bytes = await guardCapture(
        "capture",
        `could not capture ${viewSelector} at t=${timeSeconds}`,
        () => view.screenshot({ type: "png" }),
      );
      if (bytes.byteLength === 0)
        throw new AutoMovieHeadlessCaptureError(
          "empty-frame",
          `captured ${viewSelector} at t=${timeSeconds} but received zero bytes`,
        );
      const path = `${dir.replace(/[\\/]+$/, "")}/${frameName(index)}`;
      await options.writeFrame(path, bytes, { timeSeconds, index });
      return path;
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
