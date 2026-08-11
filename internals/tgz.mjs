import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PACKAGES = Object.freeze([
  "interface",
  "engine",
  "archetypes",
  "render",
  "ingest",
  "viewer",
  "mcp",
  "cli",
]);
const TARBALL_DIR = ".tarballs";

/** Build the publishable workspace closure as content-addressed tarballs. */
export const packWorkspace = (target) => {
  const directory = path.join(target, TARBALL_DIR);
  fs.rmSync(directory, { recursive: true, force: true });
  fs.mkdirSync(directory, { recursive: true });

  const specifiers = {};
  for (const name of PACKAGES) {
    process.stdout.write(`Packing @automovie/${name}\n`);
    const packed = spawnSync(
      "pnpm",
      ["pack", "--pack-destination", directory],
      {
        cwd: path.join(ROOT, "packages", name),
        stdio: ["ignore", "pipe", "inherit"],
        encoding: "utf8",
        shell: process.platform === "win32",
      },
    );
    if (packed.status !== 0)
      throw new Error(`pnpm pack failed for @automovie/${name}`);
    const produced = fs
      .readdirSync(directory)
      .filter((entry) => entry.startsWith(`automovie-${name}-`));
    if (produced.length !== 1)
      throw new Error(
        `expected one tarball for @automovie/${name}, found ${produced.length}`,
      );
    const original = path.join(directory, produced[0]);
    const digest = createHash("sha256")
      .update(fs.readFileSync(original))
      .digest("hex")
      .slice(0, 12);
    const final = produced[0].replace(/\.tgz$/, `-${digest}.tgz`);
    fs.renameSync(original, path.join(directory, final));
    specifiers[name] = `file:./${TARBALL_DIR}/${final}`;
  }
  return specifiers;
};
