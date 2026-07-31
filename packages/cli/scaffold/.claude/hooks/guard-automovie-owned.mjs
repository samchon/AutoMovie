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
  return { absolute, owner };
};

const owned = [
  ownedRoot(manifest.generatedRoot, "generatedRoot", "pnpm compile"),
  ownedRoot(manifest.renderRoot, "renderRoot", "pnpm render"),
  ownedRoot(
    ".automovie/productions",
    "production state root",
    "pnpm compile or pnpm render",
  ),
  ownedRoot(
    ".automovie/capture",
    "capture state root",
    "pnpm capture:install or pnpm preview",
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

const requestedPath =
  payload?.tool_input?.file_path ?? payload?.tool_input?.notebook_path;
if (typeof requestedPath !== "string" || requestedPath.trim().length === 0)
  process.exit(0);

const target = path.resolve(root, requestedPath);
const canonical = (value) =>
  process.platform === "win32" ? value.toLowerCase() : value;
const targetKey = canonical(target);

for (const entry of owned) {
  const rootKey = canonical(entry.absolute);
  if (
    targetKey === rootKey ||
    targetKey.startsWith(`${rootKey}${path.sep}`)
  )
    block(
      `${path.relative(root, target)} is AutoMovie-owned; use ${entry.owner} instead of editing it.`,
    );
}
