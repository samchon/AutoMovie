import { env } from "@huggingface/transformers";
import { TestValidator } from "@nestia/e2e";
import { createRequire } from "node:module";
import path from "node:path";

interface IKokoroLoaderModule {
  loadKokoroRuntime<Model, Tokenizer, Runtime>(props: {
    factories: {
      loadModel: (
        model: string,
        options: Record<string, unknown>,
      ) => Promise<Model>;
      loadTokenizer: (
        model: string,
        options: Record<string, unknown>,
      ) => Promise<Tokenizer>;
      construct: (model: Model, tokenizer: Tokenizer) => Runtime;
    };
    model: string;
    revision: string;
    cacheRoot: string;
    dtype: string;
    device: string | null;
    progressCallback?: (progress: unknown) => void;
  }): Promise<Runtime>;
}

const { loadKokoroRuntime } = createRequire(__filename)(
  path.resolve(
    __dirname,
    "../../../../packages/template/scaffold/scripts/loadKokoroRuntime.ts",
  ),
) as IKokoroLoaderModule;

/** Request-local Kokoro loads overlap without changing parent process globals. */
export const test_cli_scaffold_kokoro_override_concurrency =
  async (): Promise<void> => {
    const originalFetch = globalThis.fetch;
    const originalSymbols = Object.getOwnPropertySymbols(globalThis);
    const originalCacheDir = env.cacheDir;
    const observed: Array<{ kind: string; model: string; options: unknown }> =
      [];
    const progress = {
      A: (_value: unknown): void => undefined,
      B: (_value: unknown): void => undefined,
    };
    const load = (name: "A" | "B") =>
      loadKokoroRuntime({
        factories: {
          loadModel: async (model, options) => {
            observed.push({ kind: `${name}.model`, model, options });
            await Promise.resolve();
            return `${name}.model`;
          },
          loadTokenizer: async (model, options) => {
            observed.push({ kind: `${name}.tokenizer`, model, options });
            await Promise.resolve();
            return `${name}.tokenizer`;
          },
          construct: (model, tokenizer) => ({ model, tokenizer }),
        },
        model: `owner/model-${name}`,
        revision: `revision-${name}`,
        cacheRoot: `state/model-${name}`,
        dtype: name === "A" ? "fp32" : "q8",
        device: name === "A" ? "cpu" : "wasm",
        progressCallback: progress[name],
      });
    TestValidator.equals(
      "concurrent loads preserve request-local model inputs",
      await Promise.all([load("A"), load("B")]),
      [
        { model: "A.model", tokenizer: "A.tokenizer" },
        { model: "B.model", tokenizer: "B.tokenizer" },
      ],
    );
    TestValidator.equals(
      "model and tokenizer receive each load's revision and cache",
      observed,
      [
        {
          kind: "A.model",
          model: "owner/model-A",
          options: {
            revision: "revision-A",
            cache_dir: "state/model-A",
            progress_callback: progress.A,
            dtype: "fp32",
            device: "cpu",
          },
        },
        {
          kind: "A.tokenizer",
          model: "owner/model-A",
          options: {
            revision: "revision-A",
            cache_dir: "state/model-A",
            progress_callback: progress.A,
          },
        },
        {
          kind: "B.model",
          model: "owner/model-B",
          options: {
            revision: "revision-B",
            cache_dir: "state/model-B",
            progress_callback: progress.B,
            dtype: "q8",
            device: "wasm",
          },
        },
        {
          kind: "B.tokenizer",
          model: "owner/model-B",
          options: {
            revision: "revision-B",
            cache_dir: "state/model-B",
            progress_callback: progress.B,
          },
        },
      ],
    );
    TestValidator.equals(
      "parent fetch and global symbol inventory remain unchanged",
      {
        fetch: globalThis.fetch === originalFetch,
        cacheDir: env.cacheDir,
        symbols: Object.getOwnPropertySymbols(globalThis),
      },
      { fetch: true, cacheDir: originalCacheDir, symbols: originalSymbols },
    );
    const withoutProgress: Array<Record<string, unknown>> = [];
    await loadKokoroRuntime({
      factories: {
        loadModel: async (_model, options) => {
          withoutProgress.push(options);
          return "model";
        },
        loadTokenizer: async (_model, options) => {
          withoutProgress.push(options);
          return "tokenizer";
        },
        construct: () => "runtime",
      },
      model: "owner/model",
      revision: "revision",
      cacheRoot: "state/model",
      dtype: "fp32",
      device: "cpu",
    });
    TestValidator.predicate(
      "an omitted progress callback remains absent from both requests",
      withoutProgress.every(
        (options) => Object.hasOwn(options, "progress_callback") === false,
      ),
    );

    for (const stage of ["model", "tokenizer", "constructor"] as const) {
      const expected = new Error(`${stage} failed`);
      let received: unknown;
      try {
        await loadKokoroRuntime({
          factories: {
            loadModel: async () => {
              if (stage === "model") throw expected;
              return "model";
            },
            loadTokenizer: async () => {
              if (stage === "tokenizer") throw expected;
              return "tokenizer";
            },
            construct: () => {
              if (stage === "constructor") throw expected;
              return "runtime";
            },
          },
          model: "owner/model",
          revision: "revision",
          cacheRoot: "state/model",
          dtype: "fp32",
          device: "cpu",
          progressCallback: () => undefined,
        });
      } catch (error) {
        received = error;
      }
      TestValidator.equals(
        `${stage} failure retains identity`,
        received,
        expected,
      );
    }
  };
