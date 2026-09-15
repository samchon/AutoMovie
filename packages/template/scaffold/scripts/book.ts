import {
  AutoMovieProductionBinder,
  parseAutoMovieProductionBookCommand,
} from "@automovie/production";
import path from "node:path";
import { fileURLToPath } from "node:url";

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
  const command = parseAutoMovieProductionBookCommand(args);
  return new AutoMovieProductionBinder({
    root,
    title: command.title,
    layer: command.layer,
    pass: command.pass,
    output: command.output,
  }).bind();
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
