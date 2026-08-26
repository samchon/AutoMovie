import { installPackageOwnedChromium } from "./capture-browser";

const receipt = await installPackageOwnedChromium(process.cwd());
process.stdout.write(`${JSON.stringify(receipt, null, 2)}\n`);
