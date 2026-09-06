import { installPackageOwnedChromium } from "./capture-browser";
import { assertAutoMovieNoArguments } from "./commandArguments";

assertAutoMovieNoArguments("capture:install", process.argv.slice(2));
const receipt = await installPackageOwnedChromium(process.cwd());
process.stdout.write(`${JSON.stringify(receipt, null, 2)}\n`);
