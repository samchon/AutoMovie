import {
  type AutoMovieAuthoredDocumentLayer,
  AutoMovieProductionBinder,
} from "@automovie/production";
import path from "node:path";
import { fileURLToPath } from "node:url";

interface IBookCommand {
  layer: AutoMovieAuthoredDocumentLayer;
  output: string | undefined;
  title: string;
}

/**
 * Bind one authored layer into a deterministic reader-facing Markdown edition.
 *
 * Scenarios:
 *
 * 1. An explicit layer and title produce one file under the ignored artifact
 *    directory, leaving the authored documents unchanged.
 * 2. The default layer is the final screenplay while any binder-supported
 *    non-film authored layer remains selectable.
 * 3. Missing, repeated, unknown, or valueless arguments fail before writing.
 */
export const bindProductionBook = async (
  args: readonly string[],
  root: string = process.cwd(),
): Promise<string> => {
  const command = parseBookCommand(args);
  return new AutoMovieProductionBinder({
    root,
    title: command.title,
    layer: command.layer,
    output: command.output,
  }).bind();
};

/** Parse valued book options without maintaining a second authored-layer list. */
const parseBookCommand = (args: readonly string[]): IBookCommand => {
  const values = new Map<string, string>();
  for (let index = 0; index < args.length; index += 1) {
    const option = args[index]!;
    if (option !== "--layer" && option !== "--output" && option !== "--title")
      throw new Error(`Unknown book option: ${option}`);
    if (values.has(option))
      throw new Error(`Book option ${option} was provided more than once.`);
    const value = args[index + 1];
    if (value === undefined || value.startsWith("--"))
      throw new Error(`Book option ${option} requires a value.`);
    values.set(option, value);
    index += 1;
  }
  const title = values.get("--title");
  if (title === undefined)
    throw new Error("Book binding requires an explicit --title.");
  return {
    title,
    layer: (values.get("--layer") ??
      "screenplays") as AutoMovieAuthoredDocumentLayer,
    output: values.get("--output"),
  };
};

if (
  process.argv[1] !== undefined &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  bindProductionBook(process.argv.slice(2))
    .then((target) => process.stdout.write(`Bound ${target}\n`))
    .catch((error: unknown) => {
      process.stderr.write(
        `automovie book: ${error instanceof Error ? error.message : String(error)}\n`,
      );
      process.exitCode = 1;
    });
