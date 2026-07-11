import {
  AutoMovieHeadlessCaptureError,
  IAutoMovieHeadlessCaptureOptions,
  IAutoMovieHeadlessLocator,
  IAutoMovieHeadlessPage,
  createHeadlessCaptureAdapter,
} from "@automovie/render";
import { TestValidator } from "@nestia/e2e";

type Failure = "goto" | "wait" | "style" | "evaluate" | "screenshot" | null;

class FakeLocator implements IAutoMovieHeadlessLocator {
  public constructor(private readonly page: FakePage) {}

  public async screenshot(): Promise<Uint8Array> {
    if (this.page.fail === "screenshot") throw new Error("screenshot failed");
    return this.page.bytes;
  }
}

class FakePage implements IAutoMovieHeadlessPage {
  public readonly gotos: Array<{ url: string; waitUntil: string }> = [];
  public readonly styles: string[] = [];
  public readonly selectors: string[] = [];
  public readonly closed: number[] = [];
  public bytes = new Uint8Array([1, 2, 3]);
  public fail: Failure = null;

  public async goto(
    url: string,
    options: { waitUntil: string },
  ): Promise<void> {
    if (this.fail === "goto") throw new Error("route failed");
    this.gotos.push({ url, waitUntil: options.waitUntil });
  }

  public async waitForFunction<T>(
    predicate: (arg: T) => unknown,
    arg: T,
  ): Promise<void> {
    if (this.fail === "wait") throw new Error("wait failed");
    if (!predicate(arg)) throw new Error("predicate false");
  }

  public async addStyleTag(options: { content: string }): Promise<void> {
    if (this.fail === "style") throw new Error("style failed");
    this.styles.push(options.content);
  }

  public async evaluate<T>(task: (arg: T) => unknown, arg: T): Promise<void> {
    if (this.fail === "evaluate") throw new Error("evaluate failed");
    task(arg);
  }

  public locator(selector: string): IAutoMovieHeadlessLocator {
    this.selectors.push(selector);
    return new FakeLocator(this);
  }

  public async close(): Promise<void> {
    this.closed.push(1);
  }
}

const withSeek = async <T>(
  name: string,
  seek: (time: number) => void,
  task: () => Promise<T>,
): Promise<T> => {
  const host = globalThis as unknown as Record<string, unknown>;
  const previous = host[name];
  host[name] = seek;
  try {
    return await task();
  } finally {
    if (previous === undefined) Reflect.deleteProperty(host, name);
    else host[name] = previous;
  }
};

const rejectsCapture = async (
  task: () => Promise<unknown>,
): Promise<AutoMovieHeadlessCaptureError["code"] | null> => {
  try {
    await task();
    return null;
  } catch (error) {
    if (error instanceof AutoMovieHeadlessCaptureError) {
      TestValidator.predicate("capture error keeps source", "source" in error);
      return error.code;
    }
    throw error;
  }
};

const open = async (
  page: FakePage,
  options: Partial<IAutoMovieHeadlessCaptureOptions> = {},
) =>
  createHeadlessCaptureAdapter({
    page,
    url: "http://localhost:5173/film.html?cap=1",
    writeFrame: async () => undefined,
    ...options,
  });

/**
 * The reusable headless capture adapter turns a Playwright-like page into the
 * `captureFrame` half of `renderVideo`.
 *
 * Scenarios:
 *
 * 1. The adapter loads a route once, waits for the deterministic seek hook, hides
 *    UI chrome, writes a PNG frame, and returns its path.
 * 2. Custom selectors, seek hook, and wait condition override the defaults.
 * 3. Route, seek-hook, style, screenshot, and empty-frame failures are reported
 *    with structured error codes.
 */
export const test_render_headless_capture = async (): Promise<void> => {
  const page = new FakePage();
  const writes: Array<{
    path: string;
    bytes: number[];
    timeSeconds: number;
    index: number;
  }> = [];
  const seeks: number[] = [];
  await withSeek(
    "__afSeek",
    (time) => seeks.push(time),
    async () => {
      const session = await open(page, {
        writeFrame: async (path, bytes, metadata) => {
          writes.push({
            path,
            bytes: [...bytes],
            timeSeconds: metadata.timeSeconds,
            index: metadata.index,
          });
        },
      });
      const path = await session.captureFrame(0.5, 2, "out/frames/");
      await session.close();
      TestValidator.equals("captured path", path, "out/frames/frame_00002.png");
    },
  );
  TestValidator.equals("route loaded once", page.gotos, [
    { url: "http://localhost:5173/film.html?cap=1", waitUntil: "load" },
  ]);
  TestValidator.equals("default ui hidden", page.styles, [
    "#clips{display:none!important}",
  ]);
  TestValidator.equals("default selector", page.selectors, ["#view"]);
  TestValidator.equals("seek called", seeks, [0.5]);
  TestValidator.equals("frame written", writes, [
    {
      path: "out/frames/frame_00002.png",
      bytes: [1, 2, 3],
      timeSeconds: 0.5,
      index: 2,
    },
  ]);
  TestValidator.equals("page closed", page.closed.length, 1);

  const custom = new FakePage();
  const customSeeks: number[] = [];
  await withSeek(
    "seekClip",
    (time) => customSeeks.push(time),
    async () => {
      const session = await open(custom, {
        url: "http://localhost:5173/stickman.html?cap=1",
        waitUntil: "domcontentloaded",
        seekFunction: "seekClip",
        viewSelector: "#canvas",
        hideSelector: null,
      });
      await session.captureFrame(0.25, 0, "frames");
    },
  );
  TestValidator.equals("custom route", custom.gotos, [
    {
      url: "http://localhost:5173/stickman.html?cap=1",
      waitUntil: "domcontentloaded",
    },
  ]);
  TestValidator.equals("hide disabled", custom.styles, []);
  TestValidator.equals("custom selector", custom.selectors, ["#canvas"]);
  TestValidator.equals("custom seek", customSeeks, [0.25]);

  const routeFailure = new FakePage();
  routeFailure.fail = "goto";
  TestValidator.equals(
    "route failure code",
    await rejectsCapture(() => open(routeFailure)),
    "route",
  );

  const waitFailure = new FakePage();
  TestValidator.equals(
    "seek-hook wait failure code",
    await rejectsCapture(() => open(waitFailure)),
    "seek-hook",
  );

  const styleFailure = new FakePage();
  styleFailure.fail = "style";
  await withSeek(
    "__afSeek",
    () => undefined,
    async () =>
      TestValidator.equals(
        "style failure code",
        await rejectsCapture(() => open(styleFailure)),
        "capture",
      ),
  );

  const evaluateFailure = new FakePage();
  await withSeek(
    "__afSeek",
    () => undefined,
    async () => {
      const session = await open(evaluateFailure);
      evaluateFailure.fail = "evaluate";
      TestValidator.equals(
        "seek evaluate failure code",
        await rejectsCapture(() => session.captureFrame(0, 0, "frames")),
        "seek-hook",
      );
    },
  );

  const screenshotFailure = new FakePage();
  await withSeek(
    "__afSeek",
    () => undefined,
    async () => {
      const session = await open(screenshotFailure);
      screenshotFailure.fail = "screenshot";
      TestValidator.equals(
        "screenshot failure code",
        await rejectsCapture(() => session.captureFrame(0, 0, "frames")),
        "capture",
      );
    },
  );

  const emptyFrame = new FakePage();
  emptyFrame.bytes = new Uint8Array([]);
  await withSeek(
    "__afSeek",
    () => undefined,
    async () => {
      const session = await open(emptyFrame);
      TestValidator.equals(
        "empty frame failure code",
        await rejectsCapture(() => session.captureFrame(0, 0, "frames")),
        "empty-frame",
      );
    },
  );
};
