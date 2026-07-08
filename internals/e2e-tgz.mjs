// One-command tgz e2e: pack the published @automovie chain, install the
// tarballs into a fresh npm project, and drive the PACKAGED automovie-mcp bin
// over stdio as a real MCP client. This exercises the packaging surface the
// in-repo gate never sees: `files` selection, `bin` wiring, publishConfig
// paths, and registry resolution of third-party dependencies.
//
// Run: pnpm run e2e:tgz
//
// Deliberately OUTSIDE the c8 coverage gate — it is slow (four prepack
// builds plus an npm install) and needs registry network for third-party
// dependencies such as @modelcontextprotocol/sdk.
import { spawnSync } from "node:child_process";
import {
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

// interface first, mcp last: each tarball's dependents pack after it.
const PACKAGES = ["interface", "engine", "render", "mcp"];

const fail = (message) => {
  console.error(`\n✗ e2e:tgz FAILED — ${message}`);
  process.exit(1);
};

const run = (label, command, cwd) => {
  console.log(`> ${label}`);
  const result = spawnSync(command, {
    cwd,
    shell: true,
    stdio: ["ignore", "inherit", "inherit"],
  });
  if (result.status !== 0)
    fail(`${label} exited with ${result.status ?? "signal"}`);
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
    console.error(\`✗ \${name} — \${detail}\`);
    process.exit(1);
  }
  console.log(\`✓ \${name}\`);
};

const bin = path.resolve("node_modules/@automovie/mcp/lib/bin.js");
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
  // Floor, not an exact pin — test_mcp_stdio_roundtrip pins the full list.
  assert(
    "tool-count",
    tools.length >= 30,
    \`expected at least 30 tools, got \${tools.length}\`,
  );
  for (const name of ["getGuideDocument", "openProject", "nextSteps", "stage", "perform", "cut"])
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
    \`isError=\${guide.isError} length=\${guideText.length} — guide corpus missing from the pack?\`,
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
} finally {
  await client.close();
}
`;

const stage = mkdtempSync(join(tmpdir(), "automovie-e2e-tgz-"));
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
  console.log("✓ bin-target — lib/bin.js present in the installed package");

  // 4. Drive the packaged server as a real MCP client. The client runs with
  //    the fresh project as cwd so @modelcontextprotocol/sdk resolves from
  //    the installed dependency graph, not from this repository.
  const expectedVersion = JSON.parse(
    readFileSync(resolve(REPO_ROOT, "packages", "mcp", "package.json"), "utf8"),
  ).version;
  writeFileSync(join(projectDir, "client.mjs"), CLIENT_SOURCE);
  const client = spawnSync(`node client.mjs`, {
    cwd: projectDir,
    shell: true,
    stdio: ["ignore", "inherit", "inherit"],
    env: { ...process.env, E2E_EXPECTED_VERSION: expectedVersion },
  });
  if (client.status !== 0) fail("stdio client assertions failed (see above)");
  console.log("\n✓ e2e:tgz PASSED — packaged MCP surface verified");
} finally {
  rmSync(stage, { recursive: true, force: true, maxRetries: 5 });
}
