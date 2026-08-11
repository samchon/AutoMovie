const fs = require("fs");
const path = require("path");

console.log("Checking build output...");

const fail = (message) => {
  console.log(message);
  process.exit(-1);
};

if (fs.existsSync("lib") === false) fail("Build output is missing lib/.");

if (fs.existsSync("src") === true) {
  const src = fs
    .readdirSync("src")
    .filter((file) => file !== ".DS_Store")
    .map((file) => (file.endsWith(".ts") ? file.replace(".ts", ".js") : file));
  const lib = fs.readdirSync("lib");

  if (src.every((file) => lib.includes(file)) === false) {
    fail("Root folder of build output is not lib.");
  }
}

const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8"));
const publishTargets = new Set();

const collectTargets = (value) => {
  if (typeof value === "string") {
    publishTargets.add(value);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach(collectTargets);
    return;
  }
  if (value && typeof value === "object") {
    Object.values(value).forEach(collectTargets);
  }
};

collectTargets(packageJson.publishConfig?.main);
collectTargets(packageJson.publishConfig?.module);
collectTargets(packageJson.publishConfig?.types);
collectTargets(packageJson.publishConfig?.exports);
collectTargets(packageJson.publishConfig?.bin);

for (const target of publishTargets) {
  if (typeof target !== "string") continue;
  const resolved = path.resolve(
    process.cwd(),
    target.startsWith("./") ? target.slice(2) : target,
  );
  const exists = fs.existsSync(resolved);
  if (exists === false) fail(`publishConfig target does not exist: ${target}`);
}

// Every literal `files` entry must exist on disk (#1254). npm silently drops a
// missing entry, so a package declaring LICENSE/README.md in `files` without the
// file publishes without it: a tarball missing its license, caught here at
// build instead of at publish. Glob entries are left to npm.
const hasGlob = (entry) => /[*?[\]{}]/.test(entry);
for (const entry of packageJson.files ?? []) {
  if (typeof entry !== "string" || hasGlob(entry)) continue;
  const resolved = path.resolve(
    process.cwd(),
    entry.startsWith("./") ? entry.slice(2) : entry,
  );
  if (fs.existsSync(resolved) === false)
    fail(`"files" entry does not exist on disk: ${entry}`);
}
