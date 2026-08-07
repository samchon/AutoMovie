import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.env.CLAUDE_PROJECT_DIR ?? process.cwd());
const manifestPath = path.join(root, ".automovie", "manifest.json");

const block = (message) => {
  process.stderr.write(`AutoMovie ownership guard: ${message}\n`);
  process.exit(2);
};

if (fs.existsSync(manifestPath) === false) process.exit(0);

let manifest;
try {
  manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
} catch {
  block(
    "the existing .automovie/manifest.json is unreadable; repair it before editing generated state.",
  );
}

const canonical = (value) =>
  process.platform === "win32" ? value.toLowerCase() : value;

const physicalPath = (value) => {
  try {
    let current = path.resolve(value);
    const missing = [];
    while (fs.existsSync(current) === false) {
      const parent = path.dirname(current);
      if (parent === current) return path.resolve(value);
      missing.unshift(path.basename(current));
      current = parent;
    }
    return path.join(fs.realpathSync(current), ...missing);
  } catch (error) {
    block(
      `cannot resolve the physical target ${JSON.stringify(value)}: ${
        error instanceof Error ? error.message : String(error)
      }.`,
    );
  }
};

const contains = (parent, child) => {
  const parentKey = canonical(parent);
  const childKey = canonical(child);
  return (
    childKey === parentKey || childKey.startsWith(`${parentKey}${path.sep}`)
  );
};

const ownedRoot = (value, field, owner) => {
  if (
    typeof value !== "string" ||
    value.trim().length === 0 ||
    path.isAbsolute(value)
  )
    block(`${field} must be a non-empty project-relative path.`);
  const absolute = path.resolve(root, value);
  const relative = path.relative(root, absolute);
  if (
    relative === ".." ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative)
  )
    block(`${field} resolves outside the project.`);
  return { absolute, physical: physicalPath(absolute), owner };
};

const owned = [
  ownedRoot(manifest.generatedRoot, "generatedRoot", "npm run compile"),
  ownedRoot(manifest.renderRoot, "renderRoot", "npm run render"),
  ownedRoot(
    ".automovie/productions",
    "production state root",
    "npm run compile or npm run render",
  ),
  ownedRoot(
    ".automovie/capture",
    "capture state root",
    "npm run capture:install or npm run preview",
  ),
];

let request = "";
for await (const chunk of process.stdin) request += chunk;

let payload;
try {
  payload = request.trim().length === 0 ? {} : JSON.parse(request);
} catch {
  block("the hook request is not valid JSON.");
}

const matchingOwner = (requestedPath) => {
  if (typeof requestedPath !== "string" || requestedPath.trim().length === 0)
    return undefined;
  const absolute = path.isAbsolute(requestedPath)
    ? path.resolve(requestedPath)
    : path.resolve(root, requestedPath);
  const physical = physicalPath(absolute);
  return owned.find(
    (entry) =>
      contains(entry.absolute, absolute) || contains(entry.physical, physical),
  );
};

const blockPath = (requestedPath) => {
  const entry = matchingOwner(requestedPath);
  if (entry === undefined) return;
  const absolute = path.isAbsolute(requestedPath)
    ? path.resolve(requestedPath)
    : path.resolve(root, requestedPath);
  block(
    `${path.relative(root, absolute)} is AutoMovie-owned; use ${entry.owner} instead of editing it.`,
  );
};

const pathKeys =
  /(?:^|_)(?:path|file|filename|directory|destination|target|root)$/iu;
const inspectPaths = (value, key = "") => {
  if (typeof value === "string") {
    if (pathKeys.test(key)) blockPath(value);
    return;
  }
  if (Array.isArray(value)) {
    for (const entry of value) inspectPaths(entry, key);
    return;
  }
  if (typeof value !== "object" || value === null) return;
  for (const [childKey, child] of Object.entries(value))
    inspectPaths(child, childKey);
};

const inspectBash = (command) => {
  if (
    typeof command !== "string" ||
    /(?:^|[\s;&|])(?:rm|del|erase|rmdir|mkdir|mv|move|cp|copy|touch|tee|sed|perl|python(?:3)?|node|powershell|pwsh|cmd|set-content|add-content|out-file|new-item|remove-item|move-item|copy-item)\b|(?:^|[^<])>{1,2}/iu.test(
      command,
    ) === false
  )
    return;
  const candidates = [
    ...[...command.matchAll(/["']([^"']+)["']/gu)].map((match) => match[1]),
    ...command.split(/[\s;&|<>]+/u),
  ];
  for (const candidate of candidates) {
    const normalized = candidate
      .replace(/^[([{,]+|[)\]},]+$/gu, "")
      .replace(/^--?[^=]+=/u, "");
    if (normalized.length > 0 && normalized.startsWith("-") === false)
      blockPath(normalized);
  }
  const slashCommand = command.replaceAll("\\", "/");
  for (const entry of owned) {
    const relative = path.relative(root, entry.absolute).replaceAll("\\", "/");
    if (
      slashCommand.includes(`${relative}/`) ||
      slashCommand.includes(`'${relative}'`) ||
      slashCommand.includes(`"${relative}"`)
    )
      blockPath(relative);
  }
};

/**
 * Tools that only observe. AutoMovie owns these paths against *mutation*, and
 * the review contract requires the agent to open the very frames underneath
 * them: a review is complete only once the current bundle frames have actually
 * been looked at. A guard that refuses a read makes the mandated inspection
 * impossible and pushes an agent into copying evidence somewhere unowned to
 * see it, which is worse for provenance than reading it in place.
 *
 * The list is an allowlist rather than a deny-list of writers on purpose: an
 * unrecognized tool stays blocked, so the guard keeps failing closed as the
 * tool surface grows. `Bash` is deliberately absent -- a shell command is not
 * an observation.
 */
const READ_ONLY_TOOLS = new Set([
  "Glob",
  "Grep",
  "NotebookRead",
  "Read",
]);

if (READ_ONLY_TOOLS.has(payload?.tool_name)) process.exit(0);
if (payload?.tool_name === "Bash") inspectBash(payload?.tool_input?.command);
else inspectPaths(payload?.tool_input);
