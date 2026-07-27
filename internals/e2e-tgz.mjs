// One-command tgz e2e: pack the published @automovie chain, install the
// tarballs into a fresh npm project, and drive the PACKAGED automovie-mcp bin
// over stdio as a real MCP client. This exercises the packaging surface the
// in-repo gate never sees: `files` selection, `bin` wiring, publishConfig
// paths, and registry resolution of third-party dependencies.
//
// Run: pnpm run e2e:tgz
//
// Deliberately OUTSIDE the c8 coverage gate: it is slow (six prepack
// builds plus an npm install) and needs registry network for third-party
// dependencies such as @modelcontextprotocol/sdk.
import { spawnSync } from "node:child_process";
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "..");

// Interface first, CLI last: each runtime dependency packs before its consumer.
const PACKAGES = ["interface", "engine", "render", "viewer", "mcp", "cli"];
let tracePath = null;

const fail = (message) => {
  console.error(`\n✗ e2e:tgz FAILED: ${message}`);
  process.exit(1);
};

const run = (label, command, cwd, timeout = 300_000) => {
  console.log(`> ${label}`);
  if (tracePath !== null)
    appendFileSync(tracePath, `${new Date().toISOString()} START ${label}\n`);
  const result = spawnSync(command, {
    cwd,
    shell: true,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
    timeout,
  });
  if (result.status !== 0) {
    process.stderr.write(result.stdout ?? "");
    process.stderr.write(result.stderr ?? "");
    fail(`${label} exited with ${result.status ?? "signal"}`);
  }
  if (tracePath !== null)
    appendFileSync(tracePath, `${new Date().toISOString()} PASS ${label}\n`);
  console.log(`✓ ${label}`);
};

// The stdio client written into the fresh project. Kept as a template string
// so the whole harness stays one file; assertions print the failing name so
// a red run states exactly which packaging guarantee broke.
const CLIENT_SOURCE = `
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { existsSync } from "node:fs";
import path from "node:path";

const assert = (name, condition, detail) => {
  if (!condition) {
    console.error(\`✗ \${name}: \${detail}\`);
    process.exit(1);
  }
  console.log(\`✓ \${name}\`);
};

const bin = path.resolve("node_modules/@automovie/mcp/lib/bin.js");
const granularBin = path.resolve(
  "node_modules/@automovie/mcp/lib/bin-granular.js",
);
const productionBin = path.resolve(
  "node_modules/@automovie/mcp/lib/bin-production.js",
);
const projectRoot = path.resolve("automovie-project");
const transport = new StdioClientTransport({
  command: process.execPath,
  args: [bin],
  stderr: "pipe",
});
const client = new Client({ name: "automovie-tgz-e2e", version: "0.0.0" });
try {
  // A files-selection regression ships bin.js (npm force-includes bin
  // targets) without the rest of lib/, so the server dies on import and the
  // failure surfaces here, not at the bin-target existence check.
  await client.connect(transport);
} catch (error) {
  assert("connect", false, \`packaged server failed to start: \${error}\`);
}
try {
  const server = client.getServerVersion();
  assert(
    "handshake",
    server?.name === "automovie" &&
      server?.version === process.env.E2E_EXPECTED_VERSION,
    \`expected automovie@\${process.env.E2E_EXPECTED_VERSION}, got \${server?.name}@\${server?.version}\`,
  );

  const { tools } = await client.listTools();
  assert(
    "tool-count",
    tools.length === 4,
    \`expected 4 compact tools, got \${tools.length}\`,
  );
  for (const name of ["execute", "getGuideDocument", "openProject", "nextSteps"])
    assert(
      \`tool-present:\${name}\`,
      tools.some((tool) => tool.name === name),
      "tool missing from tools/list",
    );
  const overflowing = tools.filter(
    (tool) => (tool.description ?? "").length > 1023,
  );
  assert(
    "description-length",
    overflowing.length === 0,
    \`descriptions over 1023 chars: \${overflowing.map((tool) => tool.name).join(", ")}\`,
  );

  const guide = await client.callTool({
    name: "getGuideDocument",
    arguments: { name: "AUTOMOVIE_OVERALL" },
  });
  const guideText = guide.content?.[0]?.text ?? "";
  assert(
    "guide-corpus",
    guide.isError !== true && guideText.length >= 1000,
    \`isError=\${guide.isError} length=\${guideText.length} (guide corpus missing from the pack?)\`,
  );

  const open = await client.callTool({
    name: "openProject",
    arguments: { root: projectRoot },
  });
  assert(
    "open-project",
    open.isError !== true,
    (open.content?.[0]?.text ?? "").slice(0, 300),
  );
  for (const entry of [
    "automovie.json",
    "assets",
    "beatEnds",
    "models",
    "props",
    "renders",
    "scenes",
    "shots",
  ])
    assert(
      \`resident-structure:\${entry}\`,
      existsSync(path.join(projectRoot, entry)),
      "openProject did not create the resident project entry",
    );

  const next = await client.callTool({ name: "nextSteps", arguments: {} });
  const nextText = next.content?.[0]?.text ?? "";
  assert(
    "next-steps",
    next.isError !== true && nextText.length > 0,
    nextText.slice(0, 300),
  );

  const slate = await client.callTool({
    name: "execute",
    arguments: { call: { operation: "getSlate", input: {} } },
  });
  const slateResult = slate.structuredContent?.result;
  assert(
    "execute-operation",
    slate.isError !== true &&
      slateResult?.operation === "getSlate" &&
      slateResult.output?.slate !== undefined,
    (slate.content?.[0]?.text ?? "").slice(0, 300),
  );
} finally {
  await client.close();
}

assert(
  "granular-bin-target",
  existsSync(granularBin),
  "the compatibility binary is missing",
);
const granularTransport = new StdioClientTransport({
  command: process.execPath,
  args: [granularBin],
  stderr: "pipe",
});
const granular = new Client({
  name: "automovie-tgz-e2e-granular",
  version: "0.0.0",
});
await granular.connect(granularTransport);
try {
  const { tools } = await granular.listTools();
  // Derived from the packed package rather than compared with a number kept
  // here by hand. The granular surface is one tool per application method, so
  // that is the property to assert; a literal only records what the count was
  // on the day someone last remembered to change it (#1393, #1402). The trade
  // is deliberate: a literal would also have caught a packaging step that lost
  // methods from the built library, which this cannot, since both sides would
  // shrink together. That case is covered in-repo by test_mcp_stdio_roundtrip,
  // which pins the whole granular name inventory, and by assertBuild.
  const { AutoMovieApplication } = await import("@automovie/mcp");
  const operations = Object.getOwnPropertyNames(
    AutoMovieApplication.prototype,
  ).filter((name) => name !== "constructor");
  assert(
    "granular-tool-count",
    tools.length === operations.length,
    \`expected one granular tool per application method (\${operations.length}), got \${tools.length}\`,
  );
  for (const name of ["stage", "perform", "cut"])
    assert(
      \`granular-tool-present:\${name}\`,
      tools.some((tool) => tool.name === name),
      "tool missing from compatibility tools/list",
    );
} finally {
  await granular.close();
}

assert(
  "production-bin-target",
  existsSync(productionBin),
  "the coding-agent production binary is missing",
);
const productionTransport = new StdioClientTransport({
  command: process.execPath,
  args: [productionBin],
  stderr: "pipe",
});
const production = new Client({
  name: "automovie-tgz-e2e-production",
  version: "0.0.0",
});
await production.connect(productionTransport);
try {
  const { tools } = await production.listTools();
  assert(
    "production-tool-count",
    tools.length === 15,
    \`expected 15 production tools, got \${tools.length}\`,
  );
  for (const name of [
    "getGuideDocument",
    "openProject",
    "compileProject",
    "queryGeometry",
    "previewFrame",
    "submitReview",
  ])
    assert(
      \`production-tool-present:\${name}\`,
      tools.some((tool) => tool.name === name),
      "tool missing from production tools/list",
    );
  const guide = await production.callTool({
    name: "getGuideDocument",
    arguments: { name: "AUTOMOVIE_OVERALL" },
  });
  assert(
    "production-guide",
    guide.isError !== true,
    (guide.content?.[0]?.text ?? "").slice(0, 300),
  );
  const opened = await production.callTool({
    name: "openProject",
    arguments: { root: path.resolve("production-project") },
  });
  assert(
    "production-open-project",
    opened.isError !== true &&
      existsSync(path.resolve("production-project/.automovie/manifest.json")),
    (opened.content?.[0]?.text ?? "").slice(0, 300),
  );
} finally {
  await production.close();
}
`;

const STARTER_VERIFY_SOURCE = `
import { AutoMovieProductionApplication } from "@automovie/mcp";
import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";

const assert = (name, condition, detail) => {
  if (!condition) {
    console.error(\`✗ \${name}: \${detail}\`);
    process.exit(1);
  }
  console.log(\`✓ \${name}\`);
};
const namedFiles = (root, name) => {
  const output = [];
  const visit = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const child = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(child);
      else if (entry.isFile() && entry.name === name) output.push(child);
    }
  };
  visit(root);
  return output;
};
const visibleVariance = (png) => {
  if (png.data.length < 8) return false;
  const alpha = png.data[3];
  const first = [
    png.data[0] * alpha,
    png.data[1] * alpha,
    png.data[2] * alpha,
    alpha,
  ];
  for (let offset = 4; offset < png.data.length; offset += 4) {
    const currentAlpha = png.data[offset + 3];
    if (
      png.data[offset] * currentAlpha !== first[0] ||
      png.data[offset + 1] * currentAlpha !== first[1] ||
      png.data[offset + 2] * currentAlpha !== first[2] ||
      currentAlpha !== first[3]
    )
      return true;
  }
  return false;
};

const root = process.cwd();
const generated = JSON.parse(
  fs.readFileSync(path.join(root, ".automovie/generated-manifest.json"), "utf8"),
);
const manifests = namedFiles(path.join(root, "renders"), "manifest.json");
assert(
  "starter-render-manifest-count",
  manifests.length === 1,
  \`expected one content-addressed bundle, got \${manifests.length}\`,
);
const manifest = JSON.parse(fs.readFileSync(manifests[0], "utf8"));
assert(
  "starter-render-current",
  manifest.compileFingerprint === generated.inputFingerprint,
  "render bundle is not bound to the current compiler input",
);
assert(
  "starter-render-frame-inventory",
  manifest.frames.length === 2 &&
    manifest.frames.some((frame) => frame.pass === "beauty") &&
    manifest.frames.some((frame) => frame.pass === "pose"),
  \`expected beauty and pose frames, got \${JSON.stringify(manifest.frames)}\`,
);
const digests = new Set();
for (const frame of manifest.frames) {
  const bytes = fs.readFileSync(path.join(path.dirname(manifests[0]), frame.path));
  const png = PNG.sync.read(bytes);
  assert(
    \`starter-png-size:\${frame.pass}\`,
    png.width === 1280 && png.height === 720,
    \`expected 1280x720, got \${png.width}x\${png.height}\`,
  );
  assert(
    \`starter-png-visible-variance:\${frame.pass}\`,
    visibleVariance(png),
    "frame has no visible pixel variance",
  );
  digests.add(frame.digest);
}
assert(
  "starter-guide-pass-difference",
  digests.size === 2,
  "beauty and pose captured identical bytes",
);

const app = new AutoMovieProductionApplication({ projectRoot: root });
app.getGuideDocument({ name: "AUTOMOVIE_OVERALL" });
app.getGuideDocument({ name: "PRODUCTION_REVIEW" });
app.openProject({ root });
const prepared = app.prepareReview({
  target: { kind: "shot", id: "opening" },
});
assert(
  "starter-review-frame-inventory",
  prepared.frames.length === 2 &&
    prepared.diagnostics.every((item) => item.category !== "error"),
  JSON.stringify(prepared.diagnostics),
);
`;

const stage = mkdtempSync(join(tmpdir(), "automovie-e2e-tgz-"));
tracePath = join(stage, "trace.log");
writeFileSync(tracePath, `${new Date().toISOString()} START e2e:tgz\n`);
const tarballDir = join(stage, "tarballs");
const projectDir = join(stage, "project");
mkdirSync(tarballDir);
mkdirSync(projectDir);

try {
  // 1. Pack the chain. prepack runs each package's full build.
  for (const name of PACKAGES)
    run(
      `pack @automovie/${name}`,
      `pnpm pack --pack-destination "${tarballDir}"`,
      resolve(REPO_ROOT, "packages", name),
    );
  const tarballs = readdirSync(tarballDir).filter((f) => f.endsWith(".tgz"));
  if (tarballs.length !== PACKAGES.length)
    fail(
      `expected ${PACKAGES.length} tarballs, found ${tarballs.length}: ${tarballs.join(", ")}`,
    );

  // 2. Install the tarballs into a fresh npm project. npm resolves the
  //    rewritten workspace ranges against the sibling tarballs; everything
  //    else comes from the registry.
  writeFileSync(
    join(projectDir, "package.json"),
    JSON.stringify(
      { name: "automovie-tgz-e2e", private: true, version: "0.0.0" },
      null,
      2,
    ),
  );
  run(
    "npm install tarballs",
    `npm install --prefer-offline --no-audit --no-fund ${tarballs
      .map((f) => `"${join(tarballDir, f)}"`)
      .join(" ")}`,
    projectDir,
  );

  // 3. The packed artifact must carry the bin target the `bin` field names.
  const binTarget = join(
    projectDir,
    "node_modules",
    "@automovie",
    "mcp",
    "lib",
    "bin.js",
  );
  if (!existsSync(binTarget))
    fail(`packed artifact is missing the bin target: ${binTarget}`);
  console.log("✓ bin-target: lib/bin.js present in the installed package");
  const granularBinTarget = join(
    projectDir,
    "node_modules",
    "@automovie",
    "mcp",
    "lib",
    "bin-granular.js",
  );
  if (!existsSync(granularBinTarget))
    fail(
      `packed artifact is missing the granular bin target: ${granularBinTarget}`,
    );
  console.log(
    "✓ granular-bin-target: lib/bin-granular.js present in the installed package",
  );

  const productionBinTarget = join(
    projectDir,
    "node_modules",
    "@automovie",
    "mcp",
    "lib",
    "bin-production.js",
  );
  if (!existsSync(productionBinTarget))
    fail(
      `packed artifact is missing the production bin target: ${productionBinTarget}`,
    );
  console.log(
    "production-bin-target: lib/bin-production.js present in the installed package",
  );

  // 4. Drive the packaged server as a real MCP client. The client runs with
  //    the fresh project as cwd so @modelcontextprotocol/sdk resolves from
  //    the installed dependency graph, not from this repository.
  const installedManifest = JSON.parse(
    readFileSync(
      join(projectDir, "node_modules", "@automovie", "mcp", "package.json"),
      "utf8",
    ),
  );
  if (
    installedManifest.name !== "@automovie/mcp" ||
    typeof installedManifest.version !== "string"
  )
    fail("installed @automovie/mcp manifest has no valid package identity");
  const expectedVersion = installedManifest.version;
  writeFileSync(join(projectDir, "client.mjs"), CLIENT_SOURCE);
  const client = spawnSync(`node client.mjs`, {
    cwd: projectDir,
    shell: true,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 300_000,
    env: { ...process.env, E2E_EXPECTED_VERSION: expectedVersion },
  });
  if (client.status !== 0) {
    process.stderr.write(client.stdout ?? "");
    process.stderr.write(client.stderr ?? "");
    fail("stdio client assertions failed (see above)");
  }
  process.stdout.write(client.stdout ?? "");

  // 5. Generate and exercise the production repository using only the packed
  // CLI and runtime tarballs. The two guide passes prove the starter reaches
  // actual, non-blank browser pixels and exposes them to review preparation.
  const cliBin = join(
    projectDir,
    "node_modules",
    "@automovie",
    "cli",
    "lib",
    "bin.js",
  );
  if (!existsSync(cliBin))
    fail(`packed artifact is missing the CLI bin target: ${cliBin}`);
  const starterDir = join(projectDir, "production-starter");
  run(
    "scaffold packaged production starter",
    `node "${cliBin}" start "${starterDir}"`,
    projectDir,
  );
  const runtimeTarballs = tarballs.filter(
    (file) => file.startsWith("automovie-cli-") === false,
  );
  run(
    "install packaged starter dependencies",
    `npm install --prefer-offline --no-audit --no-fund ${runtimeTarballs
      .map((file) => `"${join(tarballDir, file)}"`)
      .join(" ")}`,
    starterDir,
  );
  run("compile packaged starter", "npm run compile", starterDir);
  // A fresh @ttsc/lint install builds its source plugin with Go once per
  // cache key. Cold Windows and CI caches can legitimately exceed the ordinary
  // five-minute command fence before TypeScript linting itself begins.
  run("lint packaged starter", "npm run lint", starterDir, 900_000);
  run("test packaged starter", "npm test", starterDir);
  run(
    "capture packaged starter beauty frame",
    "npm run preview -- --shot opening --time 2 --pass beauty",
    starterDir,
  );
  run(
    "capture packaged starter pose frame",
    "npm run preview -- --shot opening --time 2 --pass pose",
    starterDir,
  );
  writeFileSync(
    join(starterDir, "verify-packaged-starter.mjs"),
    STARTER_VERIFY_SOURCE,
  );
  run(
    "verify packaged starter pixels and review inventory",
    "node verify-packaged-starter.mjs",
    starterDir,
  );

  console.log(
    "\n✓ e2e:tgz PASSED: packaged MCP surfaces and production scaffold verified",
  );
} finally {
  rmSync(stage, { recursive: true, force: true, maxRetries: 5 });
}
