import {
  AutoMovieHeadlessCaptureError,
  IAutoMovieHeadlessCaptureOptions,
  IAutoMovieHeadlessLocator,
  IAutoMovieHeadlessPage,
  createHeadlessCaptureAdapter,
} from "@automovie/render";
import { TestValidator } from "@nestia/e2e";

class FakeLocator implements IAutoMovieHeadlessLocator {
  public async screenshot(): Promise<Uint8Array> {
    return new Uint8Array([1, 2, 3]);
  }
}

class FakePage implements IAutoMovieHeadlessPage {
  public readonly waited: unknown[] = [];

  public async goto(): Promise<void> {}

  public async waitForFunction<T>(
    predicate: (arg: T) => unknown,
    arg: T,
  ): Promise<void> {
    this.waited.push(arg);
    if (!predicate(arg)) throw new Error("predicate false");
  }

  public async addStyleTag(): Promise<void> {}

  public async evaluate<T>(task: (arg: T) => unknown, arg: T): Promise<void> {
    task(arg);
  }

  public locator(): IAutoMovieHeadlessLocator {
    return new FakeLocator();
  }

  public async close(): Promise<void> {}
}

/** Install browser globals for the duration of `task`, then restore. */
const withHooks = async <T>(
  hooks: Record<string, unknown>,
  task: () => Promise<T>,
): Promise<T> => {
  const host = globalThis as unknown as Record<string, unknown>;
  const previous = new Map(
    Object.keys(hooks).map((name) => [name, host[name]]),
  );
  Object.assign(host, hooks);
  try {
    return await task();
  } finally {
    for (const [name, value] of previous)
      if (value === undefined) Reflect.deleteProperty(host, name);
      else host[name] = value;
  }
};

const open = (
  page: FakePage,
  options: Partial<IAutoMovieHeadlessCaptureOptions>,
  writes: string[],
) =>
  createHeadlessCaptureAdapter({
    page,
    url: "http://localhost:5173/stickman.html?cap=1",
    writeFrame: async (path) => {
      writes.push(path);
    },
    ...options,
  });

const codeOf = async (task: () => Promise<unknown>): Promise<string | null> => {
  try {
    await task();
    return null;
  } catch (error) {
    return error instanceof AutoMovieHeadlessCaptureError ? error.code : null;
  }
};

/**
 * Multi-pass guide capture (#1165): the adapter seeks each frame once, then
 * renders every requested pass through the viewer's `__afPass` hook and writes
 * it to its pass-tagged file — so the depth/mask/outline/pose files the render
 * plans promise are actually produced.
 *
 * Scenarios:
 *
 * 1. `passes: ["beauty", "depth", "pose"]` seeks once, switches passes in order,
 *    writes the plain beauty name plus the two pass-tagged names, and returns
 *    the beauty path (the frame renderVideo encodes).
 * 2. A guides-only capture (`["depth"]`) returns its first pass path instead.
 * 3. Legacy: omitting `passes` never waits for nor calls the pass hook — a viewer
 *    predating `__afPass` still captures byte-identically; an explicit
 *    `["beauty"]` behaves the same.
 * 4. Guide passes without a page `__afPass` fail with the `pass-hook` code; a hook
 *    that throws mid-capture also reports `pass-hook`; an empty pass list is
 *    refused at creation.
 */
export const test_render_headless_capture_passes = async (): Promise<void> => {
  // 1. multi-pass: one seek, ordered pass switches, tagged writes.
  {
    const page = new FakePage();
    const writes: string[] = [];
    const seeks: number[] = [];
    const passes: string[] = [];
    await withHooks(
      {
        __afSeek: (t: number) => seeks.push(t),
        __afPass: (pass: string) => passes.push(pass),
      },
      async () => {
        const session = await open(
          page,
          { passes: ["beauty", "depth", "pose"] },
          writes,
        );
        const path = await session.captureFrame(0.5, 2, "out/frames/");
        await session.close();
        TestValidator.equals(
          "the beauty path is the frame's primary",
          path,
          "out/frames/frame_00002.png",
        );
      },
    );
    TestValidator.equals("one seek per frame", seeks, [0.5]);
    TestValidator.equals("passes switch in order", passes, [
      "beauty",
      "depth",
      "pose",
    ]);
    TestValidator.equals("pass-tagged files written", writes, [
      "out/frames/frame_00002.png",
      "out/frames/frame_00002.depth.png",
      "out/frames/frame_00002.pose.png",
    ]);
  }

  // 2. guides-only returns the first pass path.
  {
    const writes: string[] = [];
    await withHooks(
      { __afSeek: () => undefined, __afPass: () => undefined },
      async () => {
        const session = await open(
          new FakePage(),
          { passes: ["depth"] },
          writes,
        );
        TestValidator.equals(
          "a guides-only capture returns its first pass",
          await session.captureFrame(0, 0, "out"),
          "out/frame_00000.depth.png",
        );
      },
    );
  }

  // 3. legacy: no passes option (and explicit beauty) never touch __afPass.
  for (const options of [
    {},
    { passes: ["beauty"] as IAutoMovieHeadlessCaptureOptions["passes"] },
  ]) {
    const writes: string[] = [];
    const passes: string[] = [];
    await withHooks(
      {
        __afSeek: () => undefined,
        __afPass: (pass: string) => passes.push(pass),
      },
      async () => {
        const session = await open(new FakePage(), options, writes);
        TestValidator.equals(
          "legacy beauty path unchanged",
          await session.captureFrame(0, 3, "out"),
          "out/frame_00003.png",
        );
      },
    );
    TestValidator.equals("the pass hook is never called", passes, []);
    TestValidator.equals("only the plain frame is written", writes, [
      "out/frame_00003.png",
    ]);
  }

  // 4. failure shapes.
  TestValidator.equals(
    "guide passes without a page pass hook fail as pass-hook",
    await withHooks({ __afSeek: () => undefined }, () =>
      codeOf(() => open(new FakePage(), { passes: ["depth"] }, [])),
    ),
    "pass-hook",
  );
  TestValidator.equals(
    "a throwing pass hook reports pass-hook",
    await withHooks(
      {
        __afSeek: () => undefined,
        __afPass: () => {
          throw new Error("boom");
        },
      },
      async () => {
        const session = await open(new FakePage(), { passes: ["depth"] }, []);
        return codeOf(() => session.captureFrame(0, 0, "out"));
      },
    ),
    "pass-hook",
  );
  TestValidator.equals(
    "an empty pass list is refused at creation",
    await codeOf(() => open(new FakePage(), { passes: [] }, [])),
    "pass-hook",
  );
};
