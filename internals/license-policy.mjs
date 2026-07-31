import fs from "node:fs";
import { builtinModules, createRequire } from "node:module";
import path from "node:path";

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
  policy.allowed.some((entry) => typeof entry !== "string") ||
  Array.isArray(policy.allowedExceptions) === false ||
  policy.allowedExceptions.some((entry) => typeof entry !== "string")
)
  throw new Error(
    `${policyPath} must declare string allowed and allowedExceptions arrays.`,
  );
const unexpectedPolicyFields = Object.keys(policy).filter(
  (field) => field !== "allowed" && field !== "allowedExceptions",
);
if (unexpectedPolicyFields.length !== 0)
  throw new Error(
    `${policyPath} has unsupported policy fields: ${unexpectedPolicyFields.join(", ")}.`,
  );

const allowed = new Set(policy.allowed);
const allowedExceptions = new Set(policy.allowedExceptions);
const packageFiles = [
  path.join(root, "package.json"),
  path.join(root, "test", "package.json"),
  path.join(root, "packages", "cli", "scaffold", "package.json"),
];
const packagesRoot = path.join(root, "packages");
if (fs.existsSync(packagesRoot))
  for (const entry of fs.readdirSync(packagesRoot, { withFileTypes: true }))
    if (entry.isDirectory())
      packageFiles.push(path.join(packagesRoot, entry.name, "package.json"));

const existingPackageFiles = packageFiles
  .filter(fs.existsSync)
  .map((file) => fs.realpathSync(file));
const workspacePackageFiles = new Set(existingPackageFiles);
const scaffoldCandidate = path.join(
  root,
  "packages",
  "cli",
  "scaffold",
  "package.json",
);
const scaffoldPackageFile = fs.existsSync(scaffoldCandidate)
  ? fs.realpathSync(scaffoldCandidate)
  : null;
const workspacePackages = new Map(
  existingPackageFiles.map((file) => {
    const manifest = readJson(file);
    return [manifest.name, { file, manifest }];
  }),
);
const nodeBuiltin = Symbol("node-builtin");
const nodeBuiltins = new Set(
  builtinModules.flatMap((module) => [module, module.replace(/^node:/u, "")]),
);

const productionDependenciesOf = (manifest) => ({
  ...manifest.dependencies,
  ...manifest.optionalDependencies,
  ...manifest.peerDependencies,
});

const dependencyIdentityOf = (dependency, requesterFile) => {
  const manifest = readJson(requesterFile);
  const specifier = productionDependenciesOf(manifest)[dependency];
  if (typeof specifier !== "string") return dependency;
  const alias = /^npm:(@[^/]+\/[^@]+|[^@]+)@/u.exec(specifier);
  return alias?.[1] ?? dependency;
};

const packageFileFrom = (dependency, requesterFile) => {
  const identity = dependencyIdentityOf(dependency, requesterFile);
  const requester = createRequire(
    path.join(path.dirname(requesterFile), "__automovie_license_policy__.cjs"),
  );
  for (const modules of requester.resolve.paths(dependency) ?? []) {
    const candidate = path.join(modules, dependency, "package.json");
    if (fs.existsSync(candidate) === false) continue;
    const manifest = readJson(candidate);
    if (manifest.name === identity) return candidate;
  }
  let resolved;
  try {
    resolved = requester.resolve(dependency);
  } catch {
    try {
      resolved = requester.resolve(`${dependency}/package.json`);
    } catch {
      return null;
    }
  }
  if (nodeBuiltins.has(resolved)) return nodeBuiltin;
  let current = fs.statSync(resolved).isDirectory()
    ? resolved
    : path.dirname(resolved);
  for (;;) {
    const candidate = path.join(current, "package.json");
    if (fs.existsSync(candidate)) {
      const manifest = readJson(candidate);
      if (manifest.name === identity) return candidate;
    }
    const parent = path.dirname(current);
    if (parent === current) return null;
    current = parent;
  }
};

const findPackageFile = (dependency, requesterFile) => {
  const workspace = workspacePackages.get(dependency);
  if (workspace !== undefined) return workspace.file;
  if (requesterFile === scaffoldPackageFile) {
    for (const { file, manifest } of workspacePackages.values()) {
      if (
        file === requesterFile ||
        Object.hasOwn(productionDependenciesOf(manifest), dependency) === false
      )
        continue;
      const installed = packageFileFrom(dependency, file);
      if (installed !== null) return installed;
    }
  } else {
    const direct = packageFileFrom(dependency, requesterFile);
    if (direct !== null) return direct;
  }
  throw new Error(
    `Cannot resolve production dependency ${dependency} from ${requesterFile}.`,
  );
};

const tokenizeSpdx = (expression) => {
  if (typeof expression !== "string" || expression.trim().length === 0)
    throw new Error("missing license");
  const tokens = [];
  const token = /[A-Za-z0-9][A-Za-z0-9.+-]*|[()]/y;
  let offset = 0;
  while (offset < expression.length) {
    const whitespace = /^\s+/u.exec(expression.slice(offset));
    if (whitespace !== null) {
      offset += whitespace[0].length;
      continue;
    }
    token.lastIndex = offset;
    const match = token.exec(expression);
    if (match === null)
      throw new Error(
        `invalid SPDX token at ${JSON.stringify(expression.slice(offset))}`,
      );
    tokens.push(match[0]);
    offset = token.lastIndex;
  }
  return tokens;
};

const parseSpdx = (expression) => {
  const tokens = tokenizeSpdx(expression);
  const licenses = [];
  const exceptions = [];
  let cursor = 0;
  const peek = () => tokens[cursor];
  const take = () => tokens[cursor++];
  const identifier = (label) => {
    const value = take();
    if (
      value === undefined ||
      value === "(" ||
      value === ")" ||
      value === "AND" ||
      value === "OR" ||
      value === "WITH"
    )
      throw new Error(`expected ${label}`);
    return value;
  };
  const primary = () => {
    let simple = true;
    if (peek() === "(") {
      take();
      expressionRule();
      if (take() !== ")") throw new Error("unbalanced SPDX parentheses");
      simple = false;
    } else licenses.push(identifier("SPDX license identifier"));
    if (peek() === "WITH") {
      if (simple === false)
        throw new Error("WITH cannot qualify a parenthesized SPDX expression");
      take();
      exceptions.push(identifier("SPDX exception identifier"));
    }
  };
  const conjunction = () => {
    primary();
    while (peek() === "AND") {
      take();
      primary();
    }
  };
  const expressionRule = () => {
    conjunction();
    while (peek() === "OR") {
      take();
      conjunction();
    }
  };
  expressionRule();
  if (cursor !== tokens.length)
    throw new Error(`unexpected SPDX token ${JSON.stringify(peek())}`);
  return { licenses, exceptions };
};

const failures = [];
const visited = new Set();
const inspect = (file) => {
  const realFile = fs.realpathSync(file);
  if (visited.has(realFile)) return;
  visited.add(realFile);
  const manifest = readJson(realFile);
  try {
    const expression = parseSpdx(manifest.license);
    if (
      expression.licenses.some((license) => allowed.has(license) === false) ||
      expression.exceptions.some(
        (exception) => allowedExceptions.has(exception) === false,
      )
    )
      throw new Error("contains a disallowed license or exception");
  } catch (error) {
    failures.push(
      `${manifest.name ?? realFile}@${manifest.version ?? "unknown"}: ${
        manifest.license ?? "missing license"
      } (${error instanceof Error ? error.message : String(error)})`,
    );
  }

  const dependencies = productionDependenciesOf(manifest);
  for (const dependency of Object.keys(dependencies).sort()) {
    try {
      const dependencyFile = findPackageFile(dependency, realFile);
      if (dependencyFile !== nodeBuiltin) inspect(dependencyFile);
    } catch (error) {
      const optional =
        Object.hasOwn(manifest.optionalDependencies ?? {}, dependency) ||
        manifest.peerDependenciesMeta?.[dependency]?.optional === true;
      if (optional === false || workspacePackageFiles.has(realFile))
        failures.push(error instanceof Error ? error.message : String(error));
    }
  }
};

for (const file of existingPackageFiles) inspect(file);

if (failures.length > 0) {
  process.stderr.write(
    `Production license policy failed:\n${[...new Set(failures)]
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
