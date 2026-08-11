import * as path from "node:path";
import { fileURLToPath } from "node:url";

import { packWorkspace } from "./tgz.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const target = path.join(root, "node_modules", ".cache", "automovie-tgz");
packWorkspace(target);
process.stdout.write(`TGZ packages built under ${path.join(target, ".tarballs")}\n`);
