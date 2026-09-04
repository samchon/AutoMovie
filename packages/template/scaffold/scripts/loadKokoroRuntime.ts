/** Request-local factories needed to assemble one Kokoro runtime. */
export interface IKokoroRuntimeFactories<Model, Tokenizer, Runtime> {
  loadModel: (
    model: string,
    options: {
      revision: string;
      cache_dir: string;
      dtype: "fp32" | "fp16" | "q8" | "q4" | "q4f16";
      device: "wasm" | "webgpu" | "cpu";
      progress_callback?: (progress: unknown) => void;
    },
  ) => Promise<Model>;
  loadTokenizer: (
    model: string,
    options: {
      revision: string;
      cache_dir: string;
      progress_callback?: (progress: unknown) => void;
    },
  ) => Promise<Tokenizer>;
  construct: (model: Model, tokenizer: Tokenizer) => Runtime;
}

/** Load model and tokenizer from one pinned request without global mutation. */
export const loadKokoroRuntime = async <Model, Tokenizer, Runtime>(props: {
  factories: IKokoroRuntimeFactories<Model, Tokenizer, Runtime>;
  model: string;
  revision: string;
  cacheRoot: string;
  dtype: "fp32" | "fp16" | "q8" | "q4" | "q4f16";
  device: "wasm" | "webgpu" | "cpu";
  progressCallback?: (progress: unknown) => void;
}): Promise<Runtime> => {
  const shared = {
    revision: props.revision,
    cache_dir: props.cacheRoot,
    ...(props.progressCallback === undefined
      ? {}
      : { progress_callback: props.progressCallback }),
  };
  const [model, tokenizer] = await Promise.all([
    props.factories.loadModel(props.model, {
      ...shared,
      dtype: props.dtype,
      device: props.device,
    }),
    props.factories.loadTokenizer(props.model, shared),
  ]);
  return props.factories.construct(model, tokenizer);
};
