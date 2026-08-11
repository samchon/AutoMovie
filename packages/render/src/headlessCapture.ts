import { AutoMovieGuidePass } from "@automovie/interface";

import { guidePassFrameName } from "./guidePasses";
import { IAutoMovieRenderAdapters } from "./renderVideo";

/**
 * Error category raised by the headless capture adapter.
 *
 * @evidence requirements/rendering/headless-and-platform-determinism.md#rendering-runtime-identity `AutoMovieHeadlessCaptureErrorCode` exposes the fixed headless runtime boundary needed for repeatable capture.
 * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-headless-platform `AutoMovieHeadlessCaptureErrorCode` exposes that responsibility through the package-independent system contract.
 * @author Samchon
 */
export type AutoMovieHeadlessCaptureErrorCode =
  | "route"
  | "seek-hook"
  | "pass-hook"
  | "capture"
  | "empty-frame";

/**
 * Navigation milestones accepted by Playwright's page contract.
 *
 * @evidence requirements/rendering/headless-and-platform-determinism.md#rendering-runtime-identity `AutoMovieHeadlessWaitUntil` exposes the fixed headless runtime boundary needed for repeatable capture.
 * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-headless-platform `AutoMovieHeadlessWaitUntil` exposes that responsibility through the package-independent system contract.
 * @author Samchon
 */
export type AutoMovieHeadlessWaitUntil =
  | "commit"
  | "domcontentloaded"
  | "load"
  | "networkidle";

/**
 * Structured capture failure. The code tells an agent whether it missed a page
 * route, a deterministic seek hook, the screenshot call, or an empty frame.
 *
 * @evidence requirements/rendering/headless-and-platform-determinism.md#rendering-runtime-identity `AutoMovieHeadlessCaptureError` exposes the fixed headless runtime boundary needed for repeatable capture.
 * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-headless-platform `AutoMovieHeadlessCaptureError` exposes that responsibility through the package-independent system contract.
 * @author Samchon
 */
export class AutoMovieHeadlessCaptureError extends Error {
  /**
   * Machine-readable failure category.
   *
   * @evidence requirements/rendering/headless-and-platform-determinism.md#rendering-runtime-identity `AutoMovieHeadlessCaptureError.code` exposes the fixed headless runtime boundary needed for repeatable capture.
   * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-headless-platform `AutoMovieHeadlessCaptureError.code` exposes that responsibility through the package-independent system contract.
   * @author Samchon
   */
  public readonly code: AutoMovieHeadlessCaptureErrorCode;

  /**
   * Original host error, when one exists.
   *
   * @evidence requirements/rendering/headless-and-platform-determinism.md#rendering-runtime-identity `AutoMovieHeadlessCaptureError.source` exposes the fixed headless runtime boundary needed for repeatable capture.
   * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-headless-platform `AutoMovieHeadlessCaptureError.source` exposes that responsibility through the package-independent system contract.
   * @author Samchon
   */
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
 * @evidence requirements/rendering/headless-and-platform-determinism.md#rendering-runtime-identity `IAutoMovieHeadlessPage` exposes the fixed headless runtime boundary needed for repeatable capture.
 * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-headless-platform `IAutoMovieHeadlessPage` exposes that responsibility through the package-independent system contract.
 * @author Samchon
 */
export interface IAutoMovieHeadlessPage {
  /**
   * Navigate to the viewer route.
   *
   * @evidence requirements/rendering/headless-and-platform-determinism.md#rendering-runtime-identity `IAutoMovieHeadlessPage.goto` exposes the fixed headless runtime boundary needed for repeatable capture.
   * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-headless-platform `IAutoMovieHeadlessPage.goto` exposes that responsibility through the package-independent system contract.
   * @author Samchon
   */
  goto(
    url: string,
    options: { waitUntil: AutoMovieHeadlessWaitUntil },
  ): Promise<unknown>;

  /**
   * Wait until the viewer exposes its deterministic seek hook.
   *
   * @evidence requirements/rendering/headless-and-platform-determinism.md#rendering-runtime-identity `IAutoMovieHeadlessPage.waitForFunction` exposes the fixed headless runtime boundary needed for repeatable capture.
   * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-headless-platform `IAutoMovieHeadlessPage.waitForFunction` exposes that responsibility through the package-independent system contract.
   * @author Samchon
   */
  waitForFunction<T>(predicate: (arg: T) => unknown, arg: T): Promise<unknown>;

  /**
   * Inject a style rule, usually to hide UI chrome before screenshots.
   *
   * @evidence requirements/rendering/headless-and-platform-determinism.md#rendering-runtime-identity `IAutoMovieHeadlessPage.addStyleTag` exposes the fixed headless runtime boundary needed for repeatable capture.
   * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-headless-platform `IAutoMovieHeadlessPage.addStyleTag` exposes that responsibility through the package-independent system contract.
   * @author Samchon
   */
  addStyleTag(options: { content: string }): Promise<unknown>;

  /**
   * Run a browser-side function, used to drive the seek hook.
   *
   * @evidence requirements/rendering/headless-and-platform-determinism.md#rendering-runtime-identity `IAutoMovieHeadlessPage.evaluate` exposes the fixed headless runtime boundary needed for repeatable capture.
   * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-headless-platform `IAutoMovieHeadlessPage.evaluate` exposes that responsibility through the package-independent system contract.
   * @author Samchon
   */
  evaluate<T>(task: (arg: T) => unknown, arg: T): Promise<unknown>;

  /**
   * Find the element whose pixels should be captured.
   *
   * @evidence requirements/rendering/headless-and-platform-determinism.md#rendering-runtime-identity `IAutoMovieHeadlessPage.locator` exposes the fixed headless runtime boundary needed for repeatable capture.
   * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-headless-platform `IAutoMovieHeadlessPage.locator` exposes that responsibility through the package-independent system contract.
   * @author Samchon
   */
  locator(selector: string): IAutoMovieHeadlessLocator;

  /**
   * Close the host page after capture.
   *
   * @evidence requirements/rendering/headless-and-platform-determinism.md#rendering-runtime-identity `IAutoMovieHeadlessPage.close` exposes the fixed headless runtime boundary needed for repeatable capture.
   * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-headless-platform `IAutoMovieHeadlessPage.close` exposes that responsibility through the package-independent system contract.
   * @author Samchon
   */
  close(): Promise<unknown>;
}

/**
 * Minimal Playwright-like locator surface for screenshots.
 *
 * @evidence requirements/rendering/headless-and-platform-determinism.md#rendering-runtime-identity `IAutoMovieHeadlessLocator` exposes the fixed headless runtime boundary needed for repeatable capture.
 * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-headless-platform `IAutoMovieHeadlessLocator` exposes that responsibility through the package-independent system contract.
 * @author Samchon
 */
export interface IAutoMovieHeadlessLocator {
  /**
   * Capture the element as PNG bytes.
   *
   * @evidence requirements/rendering/headless-and-platform-determinism.md#rendering-runtime-identity `IAutoMovieHeadlessLocator.screenshot` exposes the fixed headless runtime boundary needed for repeatable capture.
   * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-headless-platform `IAutoMovieHeadlessLocator.screenshot` exposes that responsibility through the package-independent system contract.
   * @author Samchon
   */
  screenshot(options: { type: "png" }): Promise<Uint8Array>;
}

/**
 * Host filesystem write injected into the adapter.
 *
 * @evidence requirements/rendering/headless-and-platform-determinism.md#rendering-runtime-identity `IAutoMovieHeadlessFrameWriter` exposes the fixed headless runtime boundary needed for repeatable capture.
 * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-headless-platform `IAutoMovieHeadlessFrameWriter` exposes that responsibility through the package-independent system contract.
 * @author Samchon
 */
export type IAutoMovieHeadlessFrameWriter = (
  path: string,
  bytes: Uint8Array,
  metadata: { timeSeconds: number; index: number },
) => Promise<void>;

/**
 * Options for opening one deterministic capture session.
 *
 * @evidence requirements/rendering/headless-and-platform-determinism.md#rendering-runtime-identity `IAutoMovieHeadlessCaptureOptions` exposes the fixed headless runtime boundary needed for repeatable capture.
 * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-headless-platform `IAutoMovieHeadlessCaptureOptions` exposes that responsibility through the package-independent system contract.
 * @author Samchon
 */
export interface IAutoMovieHeadlessCaptureOptions {
  /**
   * Playwright-like page to drive.
   *
   * @evidence requirements/rendering/headless-and-platform-determinism.md#rendering-runtime-identity `IAutoMovieHeadlessCaptureOptions.page` exposes the fixed headless runtime boundary needed for repeatable capture.
   * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-headless-platform `IAutoMovieHeadlessCaptureOptions.page` exposes that responsibility through the package-independent system contract.
   * @author Samchon
   */
  page: IAutoMovieHeadlessPage;

  /**
   * Fully resolved viewer URL, including `cap=1` when the route needs it.
   *
   * @evidence requirements/rendering/headless-and-platform-determinism.md#rendering-runtime-identity `IAutoMovieHeadlessCaptureOptions.url` exposes the fixed headless runtime boundary needed for repeatable capture.
   * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-headless-platform `IAutoMovieHeadlessCaptureOptions.url` exposes that responsibility through the package-independent system contract.
   * @author Samchon
   */
  url: string;

  /**
   * Element selector to screenshot. Defaults to `#view`.
   *
   * @evidence requirements/rendering/headless-and-platform-determinism.md#rendering-runtime-identity `IAutoMovieHeadlessCaptureOptions.viewSelector` exposes the fixed headless runtime boundary needed for repeatable capture.
   * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-headless-platform `IAutoMovieHeadlessCaptureOptions.viewSelector` exposes that responsibility through the package-independent system contract.
   * @author Samchon
   */
  viewSelector?: string;

  /**
   * UI selector to hide before capture. Defaults to `#clips`; null disables.
   *
   * @evidence requirements/rendering/headless-and-platform-determinism.md#rendering-runtime-identity `IAutoMovieHeadlessCaptureOptions.hideSelector` exposes the fixed headless runtime boundary needed for repeatable capture.
   * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-headless-platform `IAutoMovieHeadlessCaptureOptions.hideSelector` exposes that responsibility through the package-independent system contract.
   * @author Samchon
   */
  hideSelector?: string | null;

  /**
   * Browser global seek function name. Defaults to `__afSeek`.
   *
   * @evidence requirements/rendering/headless-and-platform-determinism.md#rendering-runtime-identity `IAutoMovieHeadlessCaptureOptions.seekFunction` exposes the fixed headless runtime boundary needed for repeatable capture.
   * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-headless-platform `IAutoMovieHeadlessCaptureOptions.seekFunction` exposes that responsibility through the package-independent system contract.
   * @author Samchon
   */
  seekFunction?: string;

  /**
   * Guide passes to capture per frame (#1165). Each frame seeks once, then
   * every listed pass is rendered via the viewer's pass hook and written to its
   * pass-tagged file (`frame_00042.depth.png`; `beauty` keeps the plain name).
   * Omit (or pass exactly `["beauty"]`) for the legacy single-pass capture,
   * which never touches the pass hook and stays byte-identical.
   *
   * Frame size is the HOST's responsibility for guide passes. The `beauty`
   * video is conformed to the render spec by ffmpeg `-s` at encode time
   * (#1251), but a guide pass terminates as a raw PNG sequence with no encoder
   * backstop. Each frame is whatever pixels `viewSelector` screenshots. So the
   * pose-keypoint sidecar's `width/height` aspect (#1231) matches the guide
   * frames the diffusion host consumes ONLY if the capture surface is sized to
   * the render spec. Pin it: the reference viewer honors `w`/`h` capture-URL
   * params for exactly this. A host that captures guide passes at a viewport
   * not equal to the spec silently tears the guide frames away from both the
   * sidecar and the `-s`-conformed beauty video.
   *
   * @evidence requirements/rendering/headless-and-platform-determinism.md#rendering-runtime-identity `IAutoMovieHeadlessCaptureOptions.passes` exposes the fixed headless runtime boundary needed for repeatable capture.
   * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-headless-platform `IAutoMovieHeadlessCaptureOptions.passes` exposes that responsibility through the package-independent system contract.
   * @author Samchon
   */
  passes?: readonly AutoMovieGuidePass[];

  /**
   * Browser global pass-switch function name. Defaults to `__afPass`. Only
   * required (and awaited) when `passes` asks for more than plain beauty.
   *
   * @evidence requirements/rendering/headless-and-platform-determinism.md#rendering-runtime-identity `IAutoMovieHeadlessCaptureOptions.passFunction` exposes the fixed headless runtime boundary needed for repeatable capture.
   * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-headless-platform `IAutoMovieHeadlessCaptureOptions.passFunction` exposes that responsibility through the package-independent system contract.
   * @author Samchon
   */
  passFunction?: string;

  /**
   * Navigation wait condition. Defaults to `load`.
   *
   * @evidence requirements/rendering/headless-and-platform-determinism.md#rendering-runtime-identity `IAutoMovieHeadlessCaptureOptions.waitUntil` exposes the fixed headless runtime boundary needed for repeatable capture.
   * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-headless-platform `IAutoMovieHeadlessCaptureOptions.waitUntil` exposes that responsibility through the package-independent system contract.
   * @author Samchon
   */
  waitUntil?: AutoMovieHeadlessWaitUntil;

  /**
   * Persist one PNG frame and its metadata.
   *
   * @evidence requirements/rendering/headless-and-platform-determinism.md#rendering-runtime-identity `IAutoMovieHeadlessCaptureOptions.writeFrame` exposes the fixed headless runtime boundary needed for repeatable capture.
   * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-headless-platform `IAutoMovieHeadlessCaptureOptions.writeFrame` exposes that responsibility through the package-independent system contract.
   * @author Samchon
   */
  writeFrame: IAutoMovieHeadlessFrameWriter;
}

/**
 * Open capture session returned by {@link createHeadlessCaptureAdapter}.
 *
 * @evidence requirements/rendering/headless-and-platform-determinism.md#rendering-runtime-identity `IAutoMovieHeadlessCaptureSession` exposes the fixed headless runtime boundary needed for repeatable capture.
 * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-headless-platform `IAutoMovieHeadlessCaptureSession` exposes that responsibility through the package-independent system contract.
 * @author Samchon
 */
export interface IAutoMovieHeadlessCaptureSession {
  /**
   * Adapter usable as `renderVideo(..., { captureFrame, encode })`.
   *
   * @evidence requirements/rendering/headless-and-platform-determinism.md#rendering-runtime-identity `IAutoMovieHeadlessCaptureSession.captureFrame` exposes the fixed headless runtime boundary needed for repeatable capture.
   * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-headless-platform `IAutoMovieHeadlessCaptureSession.captureFrame` exposes that responsibility through the package-independent system contract.
   * @author Samchon
   */
  captureFrame: IAutoMovieRenderAdapters["captureFrame"];

  /**
   * Close the underlying page.
   *
   * @evidence requirements/rendering/headless-and-platform-determinism.md#rendering-runtime-identity `IAutoMovieHeadlessCaptureSession.close` exposes the fixed headless runtime boundary needed for repeatable capture.
   * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-headless-platform `IAutoMovieHeadlessCaptureSession.close` exposes that responsibility through the package-independent system contract.
   * @author Samchon
   */
  close(): Promise<void>;
}

/**
 * Create a reusable `captureFrame` adapter over a Playwright-like page. It
 * loads the viewer route once, waits for the deterministic seek hook, then
 * captures `#view` after each `captureFrame(t, i, dir)` call.
 *
 * @evidence requirements/rendering/headless-and-platform-determinism.md#rendering-runtime-identity `createHeadlessCaptureAdapter` exposes the fixed headless runtime boundary needed for repeatable capture.
 * @evidence requirements/rendering/headless-and-platform-determinism.md#rendering-process-isolation Opens one bounded page session and exposes an explicit close operation.
 * @evidence requirements/rendering/headless-and-platform-determinism.md#rendering-headless-refusal Returns stable error codes for unavailable route, hook, capture, and frame bytes.
 * @evidence requirements/rendering/passes-channels-and-products.md#rendering-pass-dependencies Applies each requested pass only after the deterministic seek for that frame.
 * @evidence requirements/rendering/passes-channels-and-products.md#rendering-pass-refusal Refuses an empty pass set and unavailable pass hooks before claiming capture success.
 * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-headless-platform `createHeadlessCaptureAdapter` exposes that responsibility through the package-independent system contract.
 * @evidence specifications/editorial-render-and-delivery/render-products-visibility-and-color.md#spec-render-pass-products Keeps beauty and structural pass outputs separate under stable pass names.
 *
 * @evidenceExclude requirements/rendering/README.md#rendering-요구사항 The headless adapter invokes one host capture and validates its bytes; full platform proof, arbitrary products, and wider validation remain outside it.
 * @evidenceExclude requirements/rendering/headless-and-platform-determinism.md#rendering-cross-platform-evidence The headless adapter invokes one host capture and validates its bytes; full platform proof, arbitrary products, and wider validation remain outside it.
 * @evidenceExclude requirements/rendering/headless-and-platform-determinism.md#rendering-cross-platform-paths The headless adapter invokes one host capture and validates its bytes; full platform proof, arbitrary products, and wider validation remain outside it.
 * @evidenceExclude requirements/rendering/headless-and-platform-determinism.md#rendering-font-decoder-closure The headless adapter invokes one host capture and validates its bytes; full platform proof, arbitrary products, and wider validation remain outside it.
 * @evidenceExclude requirements/rendering/headless-and-platform-determinism.md#rendering-hardware-variation The headless adapter invokes one host capture and validates its bytes; full platform proof, arbitrary products, and wider validation remain outside it.
 * @evidenceExclude requirements/rendering/headless-and-platform-determinism.md#rendering-locale-time-determinism The headless adapter invokes one host capture and validates its bytes; full platform proof, arbitrary products, and wider validation remain outside it.
 * @evidenceExclude requirements/rendering/passes-channels-and-products.md#rendering-arbitrary-channels The headless adapter invokes one host capture and validates its bytes; full platform proof, arbitrary products, and wider validation remain outside it.
 * @evidenceExclude requirements/rendering/passes-channels-and-products.md#rendering-beauty-structural-distinction The headless adapter invokes one host capture and validates its bytes; full platform proof, arbitrary products, and wider validation remain outside it.
 * @evidenceExclude requirements/rendering/passes-channels-and-products.md#rendering-identity-mask-channels The headless adapter invokes one host capture and validates its bytes; full platform proof, arbitrary products, and wider validation remain outside it.
 * @evidenceExclude requirements/rendering/passes-channels-and-products.md#rendering-multiview-products The headless adapter invokes one host capture and validates its bytes; full platform proof, arbitrary products, and wider validation remain outside it.
 * @evidenceExclude requirements/rendering/passes-channels-and-products.md#rendering-partial-product-set The headless adapter invokes one host capture and validates its bytes; full platform proof, arbitrary products, and wider validation remain outside it.
 * @evidenceExclude specifications/editorial-render-and-delivery/README.md#editorial-render와-delivery-system-specifications The headless adapter executes scheduled pass capture; material-color policy and artifact lifecycle remain separate.
 * @evidenceExclude specifications/editorial-render-and-delivery/render-products-visibility-and-color.md#spec-render-material-color The headless adapter executes scheduled pass capture; material-color policy and artifact lifecycle remain separate.
 * @evidenceExclude specifications/editorial-render-and-delivery/render-products-visibility-and-color.md#spec-render-visibility-culling The headless adapter executes scheduled pass capture; material-color policy and artifact lifecycle remain separate.
 * @evidenceExclude specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-artifact-lifecycle The headless adapter executes scheduled pass capture; material-color policy and artifact lifecycle remain separate.
 * @evidenceExclude specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-frame-schedule The headless adapter executes scheduled pass capture; material-color policy and artifact lifecycle remain separate.
 * @evidenceExclude specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-state-isolation The headless adapter executes scheduled pass capture; material-color policy and artifact lifecycle remain separate.
 * @author Samchon
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
        // renderVideo's contract wants ONE path per frame, the beauty frame
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
