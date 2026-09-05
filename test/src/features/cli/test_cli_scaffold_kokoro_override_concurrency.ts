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

/**
 * Kokoro model loading is a request-local join of typed factories.
 *
 * The former loader pinned a model revision by replacing `globalThis.fetch`
 * and the Transformers cache directory for the duration of the load, and a
 * process-wide queue serialized AutoMovie's own callers around that patch. Any
 * other consumer of the same process saw a rewritten fetch and a foreign cache
 * root while a load was in flight. The loader now passes `revision` and
 * `cache_dir` as request options to the injected model and tokenizer factories
 * and constructs the runtime from the two results, so two loads can overlap
 * with different revisions and cache roots and nothing outside the request is
 * written.
 *
 * The factories are injected, so no model, ONNX session, or worker is created
 * here: the test reads the exact options each factory received and the exact
 * error each failing stage surfaced.
 *
 * Scenarios:
 *
 * 1. Two concurrent loads with different model, revision, cache root, dtype,
 *    device, and progress callback each construct their own runtime from their
 *    own model and tokenizer, and each factory receives exactly its request's
 *    options: revision and cache root on both, dtype and device on the model
 *    only.
 * 2. The parent process's `fetch` identity and global symbol inventory are the
 *    same after both loads as before them, which is the falsifier for the
 *    patch-and-restore design (a restored patch would still have installed a
 *    coordination slot).
 * 3. A load without a progress callback passes no `progress_callback` key to
 *    either factory rather than an `undefined` value.
 * 4. A model, tokenizer, or constructor failure rejects with the original error
 *    object, so no restoration step exists to replace or wrap it.
 */
export const test_cli_scaffold_kokoro_override_concurrency =
  async (): Promise<void> => {
    const originalFetch = globalThis.fetch;
    const originalSymbols = Object.getOwnPropertySymbols(globalThis);
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
        symbols: Object.getOwnPropertySymbols(globalThis),
      },
      { fetch: true, symbols: originalSymbols },
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
