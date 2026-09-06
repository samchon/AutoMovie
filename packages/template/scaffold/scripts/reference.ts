import { runAutoMovieReferenceCommand } from "@automovie/mcp";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
process.exitCode = await runAutoMovieReferenceCommand([
  "--root",
  root,
  ...process.argv.slice(2),
]);
