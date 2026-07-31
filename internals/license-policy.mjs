import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const args = process.argv.slice(2);
let root = process.cwd();
let policyArgument = ".github/license-policy.json";
for (let index = 0; index < args.length; index += 1) {
  const argument = args[index];
  if (argument !== "--root" && argument !== "--policy")
    throw new Error(`Unknown argument: ${argument}`);
  const value = args[index + 1];
  if (value === undefined) throw new Error(`${argument} needs a path.`);
  if (argument === "--root") root = path.resolve(value);
  else policyArgument = value;
  index += 1;
}

const readJson = (file) => JSON.parse(fs.readFileSync(file, "utf8"));
const policyPath = path.resolve(root, policyArgument);
const policy = readJson(policyPath);
if (
  Array.isArray(policy.allowed) === false ||
  policy.allowed.some((entry) => typeof entry !== "string")
)
  throw new Error(`${policyPath} must declare a string allowed array.`);
if (
  policy.subprocessOnly === null ||
  typeof policy.subprocessOnly !== "object" ||
  Array.isArray(policy.subprocessOnly)
)
  throw new Error(`${policyPath} must declare a subprocessOnly object.`);

const allowed = new Set(policy.allowed);
const packageFiles = [path.join(root, "package.json")];
for (const workspaceDirectory of ["packages", "test"]) {
  const parent = path.join(root, workspaceDirectory);
  if (fs.existsSync(parent) === false) continue;
  if (workspaceDirectory === "test")
    packageFiles.push(path.join(parent, "package.json"));
  else
    for (const entry of fs.readdirSync(parent, { withFileTypes: true }))
      if (entry.isDirectory())
        packageFiles.push(path.join(parent, entry.name, "package.json"));
}

const existingPackageFiles = packageFiles.filter(fs.existsSync);
const workspacePackages = new Map(
  existingPackageFiles.map((file) => {
    const manifest = readJson(file);
    return [manifest.name, { file, manifest }];
  }),
);

const findPackageFile = (dependency, requesterFile) => {
  const workspace = workspacePackages.get(dependency);
  if (workspace !== undefined) return workspace.file;
  const requester = createRequire(
    path.join(path.dirname(requesterFile), "__automovie_license_policy__.cjs"),
  );
  try {
    return requester.resolve(`${dependency}/package.json`);
  } catch {
    let current = path.dirname(requester.resolve(dependency));
    for (;;) {
      const candidate = path.join(current, "package.json");
      if (fs.existsSync(candidate)) {
        const manifest = readJson(candidate);
        if (manifest.name === dependency) return candidate;
      }
      const parent = path.dirname(current);
      if (parent === current) break;
      current = parent;
    }
    throw new Error(
      `Cannot resolve production dependency ${dependency} from ${requesterFile}.`,
    );
  }
};

const licenseIdentifiers = (expression) => {
  if (typeof expression !== "string" || expression.trim().length === 0)
    return [];
  const tokens = expression.match(/[A-Za-z0-9][A-Za-z0-9.+-]*/gu) ?? [];
  const identifiers = [];
  let skipException = false;
  for (const token of tokens) {
    const operator = token.toUpperCase();
    if (operator === "AND" || operator === "OR") continue;
    if (operator === "WITH") {
      skipException = true;
      continue;
    }
    if (skipException) {
      skipException = false;
      continue;
    }
    identifiers.push(token);
  }
  return identifiers;
};

const failures = [];
const visited = new Set();
const inspect = (file) => {
  const realFile = fs.realpathSync(file);
  if (visited.has(realFile)) return;
  visited.add(realFile);
  const manifest = readJson(realFile);
  const identifiers = licenseIdentifiers(manifest.license);
  const exception = policy.subprocessOnly[manifest.name];
  const exceptionValid =
    exception !== undefined &&
    typeof exception === "object" &&
    typeof exception.license === "string" &&
    typeof exception.rationale === "string" &&
    exception.rationale.trim().length > 0 &&
    identifiers.length > 0 &&
    identifiers.every((identifier) => identifier === exception.license);
  if (
    exceptionValid === false &&
    (identifiers.length === 0 ||
      identifiers.some((identifier) => allowed.has(identifier) === false))
  )
    failures.push(
      `${manifest.name ?? realFile}@${manifest.version ?? "unknown"}: ${
        manifest.license ?? "missing license"
      }`,
    );

  const dependencies = {
    ...manifest.dependencies,
    ...manifest.optionalDependencies,
    ...manifest.peerDependencies,
  };
  for (const dependency of Object.keys(dependencies).sort()) {
    try {
      inspect(findPackageFile(dependency, realFile));
    } catch (error) {
      const optional =
        Object.hasOwn(manifest.optionalDependencies ?? {}, dependency) ||
        manifest.peerDependenciesMeta?.[dependency]?.optional === true;
      if (optional === false)
        failures.push(
          error instanceof Error ? error.message : String(error),
        );
    }
  }
};

for (const file of existingPackageFiles) inspect(file);

if (failures.length > 0) {
  process.stderr.write(
    `Production license policy failed:\n${[
      ...new Set(failures),
    ]
      .sort()
      .map((failure) => `- ${failure}`)
      .join("\n")}\n`,
  );
  process.exitCode = 1;
} else {
  process.stdout.write(
    `Production license policy passed for ${visited.size} packages.\n`,
  );
}
