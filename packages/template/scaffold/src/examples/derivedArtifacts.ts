/**
 * Precomputing a deterministic result once, without freezing it into source.
 *
 * ## The one rule this example exists to teach
 *
 * When a deterministic computation is too expensive for the one-second source
 * budget, the result becomes a **derived artifact** published by an explicit
 * script, never a megabyte-scale literal pasted into a `.ts` file. The bytes
 * live under `automovie/derived/`, the ledger `automovie/derived-artifacts.json`
 * records them, and the compiler verifies rather than regenerates them. Read
 * `DERIVED_ARTIFACTS` for the full contract.
 *
 * ## The file that runs is the file that is hashed
 *
 * The subtle way to get this wrong is to declare some helper module as the
 * `generator` while a different script actually decides the inputs, the output
 * and any post-processing. Then editing the script changes the result while the
 * recorded basis stays identical, and a stale artifact passes as current. The
 * basis is only as good as what it covers.
 *
 * So the generation script is self-contained and declares **itself**:
 *
 * ```ts
 * // scripts/deriveMyArtifact.ts
 * generateAutoMovieDerivedArtifact({
 *   root: findAutoMovieProjectRoot(process.cwd()),
 *   generator: "scripts/deriveMyArtifact.ts",
 *   inputs: ["src/examples/buildings.ts"],
 *   output: "automovie/derived/buildings-line-index.json",
 *   encoding: "utf8",
 *   generate: (inputs) =>
 *     deriveUtf8LineIndex(inputs["src/examples/buildings.ts"]!),
 * });
 * ```
 *
 * `scripts/deriveExampleArtifact.ts` is that script, kept whole so it still runs
 * after you delete this file. Copy both shapes, not one of them.
 *
 * ## What a generator may depend on
 *
 * Only its declared `inputs` and its own source-local constants. No clock, no
 * environment variable, no random source, no undeclared file. The helper runs
 * the callback twice against independent copies and refuses to publish when the
 * two results differ, but that check catches accidents; the declared inputs are
 * what make the dependency reviewable.
 *
 * The function below is deliberately trivial so the shape stays visible. A real
 * one earns the ledger entry; a masonry course table, a packed lookup, a
 * tessellation nobody wants to recompute per build.
 */
export const deriveUtf8LineIndex = (input: Uint8Array): Uint8Array => {
  new TextDecoder("utf-8", { fatal: true }).decode(input);
  const starts = [0];
  for (let index = 0; index < input.length; ++index)
    if (input[index] === 0x0a && index + 1 < input.length)
      starts.push(index + 1);
  return new TextEncoder().encode(
    `${JSON.stringify({ byteLength: input.length, lineStarts: starts })}\n`,
  );
};
