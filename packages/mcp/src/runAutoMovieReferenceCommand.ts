import { createAutoMovieReferenceProvider } from "./createAutoMovieReferenceProvider";
import { createAutoMovieReferenceReader } from "./createAutoMovieReferenceReader";
import { ReferenceError } from "./internal/referenceError";
import type { IAutoMovieReferenceReader } from "./structures/IAutoMovieReference";

/**
 * The local command's injected read and output capabilities.
 *
 * @evidence requirements/agent-authoring/reference-navigation.md#agent-reference-transports Keeps JSON output separate from startup diagnostics without launching a child process.
 * @evidence specifications/authoring-and-authority/reference-navigation.md#spec-reference-transports Supplies the same provider with a bound root and result-only stdout.
 * @author Samchon
 */
export interface IAutoMovieReferenceCommandRuntime {
  /** Bind the explicit command-line root before dispatching its one JSON request. */
  reader(root: string): Promise<IAutoMovieReferenceReader>;
  /** Write the single result JSON envelope and its trailing newline. */
  stdout(value: string): void;
  /** Write usage or sanitized startup diagnostics separately from result output. */
  stderr(value: string): void;
}

/**
 * Run one local JSON reference request and return its process exit status.
 *
 * @evidence requirements/agent-authoring/reference-navigation.md#agent-reference-transports Lets a client without MCP consume the installed provider contract directly.
 * @evidence specifications/authoring-and-authority/reference-navigation.md#spec-reference-transports Accepts only an explicit root and JSON request and emits one result envelope to stdout.
 */
export async function runAutoMovieReferenceCommand(
  argv: readonly string[],
  runtime: IAutoMovieReferenceCommandRuntime = {
    reader: createAutoMovieReferenceReader,
    stdout: (value) => {
      process.stdout.write(value);
    },
    stderr: (value) => {
      process.stderr.write(value);
    },
  },
): Promise<number> {
  if (argv.length !== 4 || argv[0] !== "--root" || argv[2] !== "--request") {
    runtime.stderr(
      "usage: automovie-reference --root <absolute-production-root> --request <JSON>\n",
    );
    return 1;
  }
  let input: unknown;
  try {
    input = JSON.parse(argv[3]);
  } catch {
    runtime.stdout(
      `${JSON.stringify({ ok: false, error: { code: "INVALID_JSON", message: "Request must be one JSON object." } })}\n`,
    );
    return 1;
  }
  let reader: IAutoMovieReferenceReader;
  try {
    reader = await runtime.reader(argv[1]);
  } catch (error) {
    runtime.stderr(
      `${error instanceof ReferenceError ? `${error.code}: ${error.message}` : "IO_ERROR: Unable to bind the production root."}\n`,
    );
    return 1;
  }
  const result = await createAutoMovieReferenceProvider(reader)(input);
  runtime.stdout(`${JSON.stringify(result)}\n`);
  return result.ok ? 0 : 1;
}
