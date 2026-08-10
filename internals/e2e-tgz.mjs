// One-command tgz e2e: pack the published @automovie chain, install the
// tarballs into a fresh npm project, and drive the PACKAGED automovie-mcp bin
// over stdio as a real MCP client. This exercises the packaging surface the
// in-repo gate never sees: `files` selection, `bin` wiring, publishConfig
// paths, and registry resolution of third-party dependencies.
//
// Run: pnpm run e2e:tgz
//
// Deliberately OUTSIDE the c8 coverage gate: it is slow (eleven prepack
// builds plus an npm install) and needs registry network for third-party
// dependencies such as @modelcontextprotocol/sdk.
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

import packagedE2eCleanup from "./preservePackagedE2eCleanup.cjs";

const { preservePackagedE2eCleanup } = packagedE2eCleanup;

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "..");
const KEEP_STAGE = process.env.AUTOMOVIE_E2E_KEEP_STAGE === "1";

// Interface first, CLI last: each runtime dependency packs before its consumer.
const PACKAGES = [
  "interface",
  "engine",
  "archetypes",
  "render",
  "viewer",
  "ingest",
  "mcp",
  "cli",
  "create-automovie",
];
const publishedPackageName = (name) =>
  name === "create-automovie" ? name : `@automovie/${name}`;
const tarballPrefix = (name) =>
  name === "create-automovie" ? `${name}-` : `automovie-${name}-`;
let tracePath = null;

const fail = (message) => {
  console.error(`\n✗ e2e:tgz FAILED: ${message}`);
  throw new Error(message);
};

const capturePackagedRenderPlanGeneration = (renderStateRoot) => {
  const generationRoot = join(renderStateRoot, "plan.json.generations");
  const generations = readdirSync(generationRoot, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => {
      const path = join(generationRoot, entry.name);
      const text = readFileSync(path, "utf8");
      const record = JSON.parse(text);
      if (
        typeof record !== "object" ||
        record === null ||
        typeof record.generation !== "string" ||
        (record.predecessor !== null &&
          typeof record.predecessor !== "string") ||
        typeof record.plan !== "object" ||
        record.plan === null
      )
        fail("packaged final render published an invalid plan generation");
      return { path, record, text };
    });
  const predecessors = new Set(
    generations
      .map(({ record }) => record.predecessor)
      .filter((predecessor) => predecessor !== null),
  );
  const heads = generations.filter(
    ({ record }) => predecessors.has(record.generation) === false,
  );
  if (heads.length !== 1)
    fail(
      `packaged final render published ${heads.length} current plan generations`,
    );
  return heads[0];
};

const capturePackagedRenderChunkPublication = (starterDir, tier, chunk) => {
  if (/^sha256:[0-9a-f]{64}$/u.test(chunk.id) === false)
    fail("packaged final render published an invalid chunk identity");
  const suffix = `.${tier}.${chunk.id.slice(7)}.publication.json`;
  const pointers = readdirSync(starterDir, { withFileTypes: true }).filter(
    (entry) =>
      entry.isFile() &&
      entry.name.startsWith(".automovie-chunk-") &&
      entry.name.endsWith(suffix),
  );
  if (pointers.length !== 1)
    fail(
      `packaged final render published ${pointers.length} current pointers for chunk ${chunk.id}`,
    );
  const path = join(starterDir, pointers[0].name);
  const text = readFileSync(path, "utf8");
  const receipt = JSON.parse(text);
  if (
    receipt.chunk !== chunk.id ||
    typeof receipt.publication !== "object" ||
    receipt.publication === null ||
    receipt.publication.version !== 1 ||
    receipt.publication.tier !== tier ||
    typeof receipt.publication.scope !== "string" ||
    /^[0-9a-f]{64}$/u.test(receipt.publication.scope) === false ||
    typeof receipt.publication.tree !== "string" ||
    typeof receipt.publication.treeIdentity !== "string"
  )
    fail("packaged final render published an invalid chunk pointer");
  const segments = receipt.publication.tree.split("/");
  if (
    segments.some(
      (segment) => segment === "" || segment === "." || segment === "..",
    )
  )
    fail("packaged final render published a non-relative chunk tree");
  const directory = resolve(starterDir, ...segments);
  const owned = relative(starterDir, directory);
  if (
    owned === "" ||
    owned === ".." ||
    owned.startsWith(`..${sep}`) ||
    isAbsolute(owned)
  )
    fail("packaged final render published an outside-root chunk tree");
  return { directory, path, receipt, text };
};

const writeCommandOutput = (result) => {
  process.stderr.write(result.stdout ?? "");
  process.stderr.write(result.stderr ?? "");
};

const commandTermination = (result, timeout) => {
  const errorCode = result.error?.code ?? "none";
  const reason =
    errorCode === "ETIMEDOUT"
      ? `timed out after ${timeout} ms`
      : result.error !== undefined
        ? "failed to spawn"
        : result.signal !== null
          ? "terminated by signal"
          : typeof result.status !== "number"
            ? "terminated without status"
            : `exited with status ${result.status}`;
  return [
    reason,
    `timeout=${timeout} ms`,
    `status=${typeof result.status === "number" ? result.status : "none"}`,
    `signal=${result.signal ?? "none"}`,
    `error=${errorCode}`,
    `message=${
      result.error === undefined ? "none" : JSON.stringify(result.error.message)
    }`,
  ].join("; ");
};

const commandSucceeded = (result) =>
  result.error === undefined && result.signal === null && result.status === 0;

const failCommand = (label, result, timeout, detail = null) => {
  writeCommandOutput(result);
  fail(
    `${label} ${commandTermination(result, timeout)}${
      detail === null ? "" : `; ${detail}`
    }`,
  );
};

const run = (label, command, cwd, timeout = 300_000, env = process.env) => {
  console.log(`> ${label}`);
  if (tracePath !== null)
    appendFileSync(tracePath, `${new Date().toISOString()} START ${label}\n`);
  const result = spawnSync(command, {
    cwd,
    shell: true,
    encoding: "utf8",
    env,
    maxBuffer: 64 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
    timeout,
  });
  if (commandSucceeded(result) === false) failCommand(label, result, timeout);
  if (tracePath !== null)
    appendFileSync(tracePath, `${new Date().toISOString()} PASS ${label}\n`);
  console.log(`✓ ${label}`);
};

const runExpectedFailure = (
  label,
  command,
  cwd,
  expectedOutput,
  timeout = 300_000,
  env = process.env,
) => {
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
    env,
  });
  const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
  if (
    result.error !== undefined ||
    result.signal !== null ||
    typeof result.status !== "number" ||
    result.status === 0 ||
    output.includes(expectedOutput) === false
  ) {
    failCommand(
      label,
      result,
      timeout,
      `expected a normal non-zero exit containing ${JSON.stringify(
        expectedOutput,
      )}`,
    );
  }
  if (tracePath !== null)
    appendFileSync(tracePath, `${new Date().toISOString()} PASS ${label}\n`);
  console.log(`✓ ${label}`);
};

// The stdio client written into the fresh project. Kept as a template string
// so the whole harness stays one file; assertions print the failing name so
// a red run states exactly which packaging guarantee broke.
const runJson = (label, executable, args, cwd) => {
  console.log(`> ${label}`);
  if (tracePath !== null)
    appendFileSync(tracePath, `${new Date().toISOString()} START ${label}\n`);
  const timeout = 300_000;
  const result = spawnSync(executable, args, {
    cwd,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
    timeout,
  });
  if (commandSucceeded(result) === false) failCommand(label, result, timeout);
  let output;
  try {
    output = JSON.parse(result.stdout);
  } catch (error) {
    process.stderr.write(result.stdout ?? "");
    process.stderr.write(result.stderr ?? "");
    fail(`${label} did not print one complete JSON document: ${error}`);
  }
  if (tracePath !== null)
    appendFileSync(tracePath, `${new Date().toISOString()} PASS ${label}\n`);
  console.log(`PASS ${label}`);
  return output;
};

/**
 * Run a command and require its output to contain an exact phrase.
 *
 * A command that succeeds is not the same as a command that did the thing: `npm
 * run design` exits zero whether it wrote a record or left one alone, and only
 * the second answers whether the typed source still derives what ships.
 */
const runExpectedOutput = (
  label,
  command,
  cwd,
  expected,
  timeout = 300_000,
  forbidden = null,
) => {
  console.log(`> ${label}`);
  const result = spawnSync(command, {
    cwd,
    shell: true,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
    timeout,
  });
  if (commandSucceeded(result) === false) failCommand(label, result, timeout);
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  if (forbidden !== null)
    for (const line of output.split(/\r?\n/u))
      // npm prints its own banner for the script it runs, so only the
      // command's own lines are held to the shape.
      if (
        line.trim().length !== 0 &&
        line.startsWith(">") === false &&
        forbidden.test(line) === false
      )
        throw new Error(
          `${label}: every line had to match ${forbidden}, and this one did not: ${JSON.stringify(line)}.
${output}`,
        );
  for (const phrase of expected)
    if (output.includes(phrase) === false)
      throw new Error(
        `${label}: expected output to contain ${JSON.stringify(phrase)}.
${output}`,
      );
  console.log(`✓ ${label}`);
};

const CLIENT_SOURCE = `
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import {
  StdioClientTransport,
  getDefaultEnvironment,
} from "@modelcontextprotocol/sdk/client/stdio.js";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const assert = (name, condition, detail) => {
  if (!condition) throw new Error(\`✗ \${name}: \${detail}\`);
  console.log(\`✓ \${name}\`);
};

const preserveCleanupFailure = async (failure, cleanup) => {
  try {
    await cleanup();
  } catch (cleanupError) {
    if (failure === undefined) throw cleanupError;
    throw new AggregateError(
      [failure.error, cleanupError],
      "Packaged MCP client cleanup failed after the probe failed.",
    );
  }
};

const bin = path.resolve("node_modules/@automovie/mcp/lib/bin.js");
const projectRoot = path.resolve("mcp-host");
mkdirSync(projectRoot, { recursive: true });
writeFileSync(
  path.join(projectRoot, "automovie.config.ts"),
  "export default {};",
);
const transport = new StdioClientTransport({
  command: process.execPath,
  args: [bin],
  env: { ...getDefaultEnvironment(), AUTOMOVIE_PROJECT_ROOT: projectRoot },
  stderr: "pipe",
});
const client = new Client({ name: "automovie-tgz-e2e", version: "0.0.0" });
let clientFailure;
try {
  try {
    // A files-selection regression ships bin.js (npm force-includes bin
    // targets) without the rest of lib/, so the server dies on import and the
    // failure surfaces here, not at the bin-target existence check.
    await client.connect(transport);
  } catch (error) {
    assert("connect", false, \`packaged server failed to start: \${error}\`);
  }
  const server = client.getServerVersion();
  assert(
    "handshake",
    server?.name === "automovie" &&
      server?.version === process.env.E2E_EXPECTED_VERSION,
    \`expected automovie@\${process.env.E2E_EXPECTED_VERSION}, got \${server?.name}@\${server?.version}\`,
  );

  const { tools } = await client.listTools();
  const toolNames = tools.map((tool) => tool.name).sort();
  const expectedTools = [
    "captureFrame",
    "getGuideDocument",
    "prepareReview",
    "repaintShot",
    "submitReview",
  ];
  assert(
    "five-tool-surface",
    JSON.stringify(toolNames) === JSON.stringify(expectedTools),
    \`expected \${expectedTools.join(", ")}, got \${toolNames.join(", ")}\`,
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
} catch (error) {
  clientFailure = { error };
  throw error;
} finally {
  await preserveCleanupFailure(clientFailure, () => client.close());
}

`;

const STARTER_VERIFY_SOURCE = `
import {
  AUTOMOVIE_REVIEW_GUIDES,
  AutoMovieApplication,
  digestAutoMovieBytes,
  inspectAutoMovieProduction,
  openAutoMovieProduction,
  parseAutoMovieCaptureRuntimeIdentity,
} from "@automovie/mcp";
import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";

import {
  captureProductionFrame,
  closeProductionFrameCapture,
} from "./scripts/capture.ts";

const assert = (name, condition, detail) => {
  if (!condition) throw new Error(\`✗ \${name}: \${detail}\`);
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
const readJson = (file) => JSON.parse(fs.readFileSync(file, "utf8"));
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
const frameEvidence = (frame) => ({
  kind: "frame",
  target: frame.target,
  reviewFrame: frame.reviewFrame,
  bundle: frame.bundle,
  frame: frame.frame,
  time: frame.time,
  pass: frame.pass,
  digest: frame.digest,
});
const targetKey = (target) =>
  target.kind === "design"
    ? \`design:\${target.design.kind}:\${target.design.id ?? ""}\`
    : target.kind === "source"
      ? \`source:\${target.path}\`
      : \`\${target.kind}:\${target.id}\`;
const pointerValue = (root, pointer) => {
  if (pointer === "") return root;
  let current = root;
  for (const encoded of pointer.slice(1).split("/")) {
    const key = encoded.replace(/~1/g, "/").replace(/~0/g, "~");
    current = current[key];
  }
  return current;
};
const exactEvidence = (project, prepared, selectorIndex) => {
  if (prepared.target.kind === "design") {
    const selectors = prepared.quotable.filter((item) => item.kind === "design");
    const selector = selectors[selectorIndex % selectors.length];
    if (selector === undefined)
      throw new Error("Current design review has no quotable value.");
    return {
      ...selector,
      exactValue: pointerValue(
        project.design(prepared.target.design),
        selector.pointer,
      ),
    };
  }
  if (prepared.target.kind === "source") {
    const selectors = prepared.quotable.filter((item) => item.kind === "source");
    const selector = selectors[selectorIndex % selectors.length];
    if (selector === undefined)
      throw new Error("Current source review has no quotable line.");
    const exactText = fs
      .readFileSync(path.join(project.root, selector.path), "utf8")
      .replace(/\\r\\n?/g, "\\n")
      .split("\\n")[selector.line - 1];
    return { ...selector, exactText };
  }
  if (prepared.frames.length === 0)
    throw new Error("Current visual review has no frame evidence.");
  return frameEvidence(prepared.frames[0]);
};
const acceptanceAddressesShot = (scenario, shot) =>
  (scenario.target.kind === "shot" && scenario.target.id === shot) ||
  ((scenario.criterion.kind === "frame" ||
    scenario.criterion.kind === "event") &&
    scenario.criterion.shot === shot);
const requiredAcceptance = (graph, target, frames = []) => {
  const sequenceShots =
    target.kind === "sequence"
      ? new Set(
          frames.flatMap((frame) =>
            frame.target.kind === "shot" ? [frame.target.id] : [],
          ),
        )
      : undefined;
  return [...graph.acceptance.values()]
    .filter(
      (scenario) =>
        scenario.required &&
        (target.kind === "film" ||
          (target.kind === "sequence" &&
            [...(sequenceShots ?? [])].some((shot) =>
              acceptanceAddressesShot(scenario, shot),
            )) ||
          (target.kind === "shot" &&
            acceptanceAddressesShot(scenario, target.id))),
    )
    .sort((left, right) => left.id.localeCompare(right.id));
};
const worksheet = (project, prepared) => {
  const graph = project.graph();
  const acceptance = requiredAcceptance(
    graph,
    prepared.target,
    prepared.frames,
  );
  return {
    target: prepared.target,
    preparedFingerprint: prepared.fingerprint,
    observations:
      "The packaged starter target was inspected against current exact evidence.",
    checks: prepared.requiredCriteria.map((criterion, index) => {
      const evidence =
        criterion === "acceptance-scenarios"
          ? acceptance.flatMap((scenario) => {
              const contract = {
                kind: "acceptance",
                scenario: scenario.id,
                exactValue: scenario,
              };
              if (scenario.criterion.kind !== "frame") return [contract];
              const shot =
                scenario.criterion.shot ??
                (scenario.target.kind === "shot"
                  ? scenario.target.id
                  : undefined);
              const frame = prepared.frames.find(
                (item) =>
                  item.target.kind === "shot" &&
                  item.target.id === shot &&
                  item.reviewFrame === scenario.criterion.frame &&
                  item.pass === scenario.criterion.pass,
              );
              return frame === undefined
                ? [contract]
                : [frameEvidence(frame), contract];
            })
          : prepared.target.kind === "asset" && index === 0
            ? prepared.frames.map(frameEvidence)
            : [exactEvidence(project, prepared, index)];
      return {
        criterion,
        verdict: "pass",
        observation: \`\${criterion} is backed by current packaged evidence \${index}.\`,
        evidence,
        ...(criterion === "acceptance-scenarios"
          ? { acceptanceScenarios: acceptance.map((item) => item.id) }
          : {}),
      };
    }),
    corrections: [],
    completionBasis: prepared.requiredCriteria.join(", "),
    complete: true,
  };
};

const root = process.cwd();
const services = openAutoMovieProduction({ projectRoot: root });
const project = services.project;
const generated = project.generatedManifest();
if (generated === null)
  throw new Error("Packaged verifier requires current generated output.");
const compiled = readJson(
  path.join(project.generatedRoot(), "manifests", "compile.json"),
);
const manifests = namedFiles(project.renderRoot(), "manifest.json");
const renderManifests = manifests
  .map((file) => ({ file, value: readJson(file) }))
  .filter((entry) => Array.isArray(entry.value.frames));
for (const entry of renderManifests) {
  const runtime = parseAutoMovieCaptureRuntimeIdentity(
    entry.value.rendererIdentity,
  );
  assert(
    \`starter-render-runtime:\${path.basename(path.dirname(entry.file))}\`,
    entry.value.version === 3 &&
      runtime.browser.source === "package-owned" &&
      runtime.browser.revision !== null &&
      runtime.browser.executableDigest?.startsWith("sha256:") === true &&
      runtime.graphics.vendor.trim().length > 0 &&
      runtime.graphics.renderer.trim().length > 0,
    JSON.stringify(entry.value),
  );
}
const canonicalCompiledShots = [
  { id: "answer", path: "shots/answer.json" },
  { id: "opening", path: "shots/opening.json" },
];
assert(
  "starter-compiled-shot-order",
  JSON.stringify(compiled.shots) === JSON.stringify(canonicalCompiledShots),
  \`expected both canonical compiled shots, got \${JSON.stringify(compiled.shots)}\`,
);
const currentShotRenderManifests = renderManifests.filter(
  (entry) =>
    entry.value.target.kind === "shot" &&
    entry.value.compileFingerprint === generated.inputFingerprint,
);
assert(
  "starter-render-bundle-shot-coverage",
  JSON.stringify(
    [...new Set(currentShotRenderManifests.map((entry) => entry.value.target.id))].sort(),
  ) === JSON.stringify(canonicalCompiledShots.map((shot) => shot.id).sort()),
  \`current shot bundles do not cover the canonical compiled shots: \${JSON.stringify(currentShotRenderManifests.map((entry) => entry.value.target))}\`,
);
const currentShotFrames = new Map();
for (const entry of currentShotRenderManifests)
  for (const frame of entry.value.frames) {
    const current = {
      ...frame,
      shot: entry.value.target.id,
      manifest: entry.value,
      directory: path.dirname(entry.file),
    };
    const identity = JSON.stringify([
      current.shot,
      current.index,
      current.time,
      current.pass,
      current.digest,
    ]);
    if (currentShotFrames.has(identity) === false)
      currentShotFrames.set(identity, current);
  }
const frames = [...currentShotFrames.values()];
assert(
  "starter-render-frame-inventory",
  frames.length === 6 &&
    ["answer", "opening"].every((shot) =>
      ["beauty", "mask", "pose"].every((pass) =>
        frames.some(
          (frame) => frame.shot === shot && frame.pass === pass,
        ),
      ),
    ),
  \`expected beauty, mask and pose for both shots, got \${JSON.stringify(frames)}\`,
);
const digests = new Set();
for (const frame of frames) {
  assert(
    \`starter-render-current:\${frame.shot}:\${frame.pass}\`,
    frame.manifest.compileFingerprint === generated.inputFingerprint,
    "render bundle is not bound to the current compiler input",
  );
  const bytes = fs.readFileSync(path.join(frame.directory, frame.path));
  const png = PNG.sync.read(bytes);
  assert(
    \`starter-png-size:\${frame.shot}:\${frame.pass}\`,
    png.width === 160 && png.height === 90,
    \`expected 160x90 packaged-short raster, got \${png.width}x\${png.height}\`,
  );
  assert(
    \`starter-png-visible-variance:\${frame.shot}:\${frame.pass}\`,
    visibleVariance(png),
    "frame has no visible pixel variance",
  );
  digests.add(frame.digest);
}
assert(
  "starter-guide-pass-difference",
  digests.size >= 3,
  "the six captures do not distinguish all guide-pass families",
);

const app = new AutoMovieApplication({
  projectRoot: root,
  capture: captureProductionFrame,
});
app.getGuideDocument({ name: "AUTOMOVIE_OVERALL" });
for (const name of new Set([
  ...Object.values(AUTOMOVIE_REVIEW_GUIDES),
  "CAPTURE_FRAME",
]))
  app.getGuideDocument({ name });
const graph = project.graph();
const formationSummary = services.oracle.query({
  request: {
    query: "formation",
    formation: "chorus",
    shot: "opening",
    time: 2,
  },
});
assert(
  "starter-formation-hero-and-anonymous-frame",
  formationSummary.result?.kind === "measurement" &&
    formationSummary.result.values.heroVisible === 2 &&
    formationSummary.result.values.farVisible > 0 &&
    formationSummary.result.values.nearVisible +
      formationSummary.result.values.farVisible +
      formationSummary.result.values.culled ===
      formationSummary.result.values.anonymousCount &&
    frames.some(
      (frame) =>
        frame.shot === "opening" &&
        frame.pass === "beauty" &&
        frame.time === 2,
    ),
  JSON.stringify(formationSummary),
);
const effectSummary = services.oracle.query({
  request: {
    query: "effect",
    zone: "plaza-haze",
    shot: "opening",
    time: 2,
    subjects: ["soloist"],
  },
});
const effectAcceptance = graph.acceptance.get("opening-effect-mask");
// Read from the shot rather than written down. A review frame is named by
// the production, and a literal here strands the whole packaged run on the
// day a name changes -- which is exactly what it did.
// A review frame declares the passes it is rendered in, plural: one frame
// carries beauty, mask and pose at the same instant. Reading a singular pass
// off it found nothing and left this comparison against undefined, which no
// acceptance criterion can equal.
const openingReviewFrame = graph.shots
  .get("opening")
  ?.reviewFrames.find((frame) => frame.passes.includes("mask"))?.id;
assert(
  "starter-effect-beauty-mask-frame",
  effectSummary.result?.kind === "measurement" &&
    effectSummary.result.values.active === true &&
    effectSummary.result.values.particleCount > 0 &&
    effectSummary.result.values.particleCount <=
      effectSummary.result.values.particleCap &&
    ["beauty", "mask"].every((pass) =>
      frames.some(
        (frame) =>
          frame.shot === "opening" &&
          frame.pass === pass &&
          frame.time === 2,
      ),
    ) &&
    effectAcceptance?.required === true &&
    effectAcceptance.criterion.kind === "frame" &&
    effectAcceptance.criterion.frame === openingReviewFrame &&
    effectAcceptance.criterion.pass === "mask",
  JSON.stringify(effectSummary),
);
const phase = process.argv[2];
if (phase === "review") {
  const before = inspectAutoMovieProduction(services);
  assert(
    "starter-review-gate-is-enforced",
    before.reviews.entries.some((entry) => entry.state !== "complete"),
    JSON.stringify(before.reviews),
  );
  const packagedAssetReviewViews = (model) => [
    {
      id: "turntable-front",
      angleDeg: 0,
      elevationDeg: 15,
      pose: "rest",
      pass: "beauty",
    },
    {
      id: "turntable-right",
      angleDeg: 90,
      elevationDeg: 15,
      pose: "rest",
      pass: "beauty",
    },
    {
      id: "turntable-back",
      angleDeg: 180,
      elevationDeg: 15,
      pose: "rest",
      pass: "beauty",
    },
    {
      id: "turntable-left",
      angleDeg: 270,
      elevationDeg: 15,
      pose: "rest",
      pass: "beauty",
    },
    {
      id: "top-outline",
      angleDeg: 0,
      elevationDeg: 65,
      pose: "rest",
      pass: "outline",
    },
    ...(model.skeleton === null
      ? []
      : [
          {
            id: "rig-rom-extremes",
            angleDeg: 0,
            elevationDeg: 15,
            pose: "rom-extremes",
            pass: "beauty",
          },
        ]),
  ];
  const compiledModels = new Map(
    compiled.assets.map((entry) => [
      entry.id,
      JSON.parse(
        Buffer.from(project.readGeneratedFile(entry.path)).toString("utf8"),
      ),
    ]),
  );
  let reviewFailure;
  try {
    for (const entry of before.reviews.entries) {
      if (entry.target.kind === "shot")
        for (const scenario of requiredAcceptance(graph, entry.target)) {
          if (scenario.criterion.kind !== "frame") continue;
          const reviewFrame = graph.shots
            .get(entry.target.id)
            ?.reviewFrames.find(
              (candidate) => candidate.id === scenario.criterion.frame,
            );
          assert(
            \`starter-acceptance-frame-current:\${scenario.id}\`,
            reviewFrame !== undefined &&
              reviewFrame.passes.includes(scenario.criterion.pass),
            \`required frame \${scenario.criterion.frame} pass \${scenario.criterion.pass} is absent from shot \${entry.target.id}\`,
          );
          if (reviewFrame === undefined) continue;
          const captured = await app.captureFrame({
            target: {
              kind: "shot",
              id: entry.target.id,
              time: reviewFrame.time,
              pass: scenario.criterion.pass,
            },
          });
          assert(
            \`starter-acceptance-frame-captured:\${scenario.id}\`,
            captured.captured &&
              captured.reviewTarget?.kind === "shot" &&
              captured.reviewTarget.id === entry.target.id &&
              captured.receipt !== null &&
              captured.frame?.width === 160 &&
              captured.frame.height === 90 &&
              captured.diagnostics.every((item) => item.category !== "error"),
            JSON.stringify(captured.diagnostics),
          );
        }
      if (entry.target.kind !== "asset") continue;
      const model = compiledModels.get(entry.target.id);
      assert(
        \`starter-asset-model-current:\${entry.target.id}\`,
        model !== undefined,
        "review queue asset is absent from the current model graph",
      );
      for (const view of packagedAssetReviewViews(model)) {
        const captured = await app.captureFrame({
          target: {
            kind: "asset",
            id: entry.target.id,
            angleDeg: view.angleDeg,
            elevationDeg: view.elevationDeg,
            pose: view.pose,
            pass: view.pass,
          },
        });
        assert(
          \`starter-asset-view-captured:\${entry.target.id}:\${view.id}\`,
          captured.captured &&
            captured.reviewTarget?.kind === "asset" &&
            captured.reviewTarget.id === entry.target.id &&
            captured.receipt !== null &&
            captured.frame?.width === 160 &&
            captured.frame.height === 90 &&
            captured.diagnostics.every((item) => item.category !== "error"),
          JSON.stringify(captured.diagnostics),
        );
      }
    }
  } catch (error) {
    reviewFailure = { error };
    throw error;
  } finally {
    await closeProductionFrameCapture(reviewFailure);
  }
  for (const entry of before.reviews.entries) {
    const prepared = app.prepareReview({ target: entry.target });
    assert(
      \`starter-review-prepared:\${targetKey(entry.target)}\`,
      prepared.diagnostics.every((item) => item.category !== "error"),
      JSON.stringify(prepared.diagnostics),
    );
    if (entry.target.kind === "film")
      assert(
        "starter-film-review-sees-every-shot",
        prepared.frames.length === 6 &&
          new Set(
            prepared.frames.flatMap((frame) =>
              frame.target.kind === "shot" ? [frame.target.id] : [],
            ),
          ).size === 2,
        JSON.stringify(prepared.frames),
      );
    const submitted = app.submitReview(worksheet(project, prepared));
    assert(
      \`starter-review-complete:\${targetKey(entry.target)}\`,
      submitted.accepted && submitted.state === "complete",
      JSON.stringify(submitted.diagnostics),
    );
  }
  const reviewed = services.compiler.compile({ scope: "review" });
  assert(
    "starter-review-compile-gate",
    reviewed.success &&
      reviewed.reviews.entries.every((entry) => entry.state === "complete"),
    JSON.stringify(reviewed.diagnostics),
  );
} else if (phase === "final") {
  const aggregatePath = project.trackedStatePath("render-manifest.json");
  const aggregateBytes = fs.readFileSync(aggregatePath);
  const aggregate = JSON.parse(aggregateBytes.toString("utf8"));
  const receipt = readJson(
    project.trackedStatePath("render-manifest-receipt.json"),
  );
  const ownedFiles = (aggregate.deliverables ?? []).flatMap((deliverable) =>
    (deliverable.files ?? []).map((file) => ({
      deliverable: deliverable.id,
      ...file,
    })),
  );
  const ownedFilesByPath = new Map(ownedFiles.map((file) => [file.path, file]));
  assert(
    "starter-aggregate-receipt",
    receipt.version === 2 &&
      receipt.manifestDigest === digestAutoMovieBytes(aggregateBytes) &&
      Array.isArray(receipt.files) &&
      ownedFilesByPath.size === ownedFiles.length &&
      receipt.files.length === ownedFiles.length &&
      receipt.files.every((file) => {
        const owned = ownedFilesByPath.get(file.path);
        return (
          owned !== undefined &&
          owned.deliverable === file.deliverable &&
          owned.digest === file.digest &&
          owned.bytes === file.bytes &&
          owned.mediaType === file.mediaType
        );
      }),
    JSON.stringify(receipt),
  );
  const receiptFilesByDeliverable = new Map();
  for (const file of receipt.files) {
    const owned = receiptFilesByDeliverable.get(file.deliverable);
    if (owned === undefined)
      receiptFilesByDeliverable.set(file.deliverable, [file]);
    else owned.push(file);
  }
  const deliverableFile = (deliverable, name) => {
    const matched = (receiptFilesByDeliverable.get(deliverable) ?? []).filter(
      (file) => file.path.endsWith(\`/\${name}\`),
    );
    return matched.length === 1 ? matched[0] : undefined;
  };
  const previewImage = deliverableFile("starter-preview", "preview.png");
  const featureVideo = deliverableFile("starter-feature", "feature.mp4");
  const guideVideo = deliverableFile("starter-pose-guide", "pose.mp4");
  const guideFrames = Array.from(
    {
      length:
        guideVideo?.probe?.kind === "video" ? guideVideo.probe.frameCount : 0,
    },
    (_unused, index) =>
      deliverableFile(
        "starter-pose-guide",
        \`frames/pose/frame_\${String(index).padStart(8, "0")}.png\`,
      ),
  );
  const captionsTrack = deliverableFile("starter-captions", "captions.vtt");
  const audioMix = deliverableFile("starter-audio", "audio.mp4");
  const audioWaveform = deliverableFile("starter-audio", "waveform.png");
  const audioSpectrogram = deliverableFile("starter-audio", "spectrogram.png");
  const audioEvidence = deliverableFile("starter-audio", "evidence.json");
  const requiredDeliverableFiles = [
    ["starter-preview", [previewImage]],
    ["starter-feature", [featureVideo]],
    ["starter-pose-guide", [guideVideo, ...guideFrames]],
    ["starter-captions", [captionsTrack]],
    [
      "starter-audio",
      [audioMix, audioWaveform, audioSpectrogram, audioEvidence],
    ],
  ];
  assert(
    "starter-required-deliverables-parser-complete",
    aggregate.compileFingerprint === generated.inputFingerprint &&
      aggregate.deliverables.length === requiredDeliverableFiles.length &&
      requiredDeliverableFiles.every(
        ([id, expected]) =>
          expected.every((file) => file !== undefined) &&
          (receiptFilesByDeliverable.get(id) ?? []).length ===
            expected.length &&
          aggregate.deliverables.some(
            (deliverable) =>
              deliverable.id === id &&
              deliverable.files.length === expected.length,
          ),
      ) &&
      guideFrames.every(
        (frame) =>
          frame?.probe?.kind === "png" &&
          frame?.probe?.width === 160 &&
          frame?.probe?.height === 90,
      ) &&
      previewImage?.probe?.kind === "png" &&
      previewImage?.probe?.width === 160 &&
      previewImage?.probe?.height === 90 &&
      featureVideo?.probe?.kind === "video" &&
      featureVideo?.probe?.frameCount === 23 &&
      featureVideo?.probe?.width === 160 &&
      featureVideo?.probe?.height === 90 &&
      guideVideo?.probe?.kind === "video" &&
      guideVideo?.probe?.frameCount === 23 &&
      guideVideo?.probe?.width === 160 &&
      guideVideo?.probe?.height === 90 &&
      captionsTrack?.probe?.kind === "webvtt" &&
      captionsTrack?.probe?.cueCount === 1 &&
      aggregate.deliverables.find(
        (deliverable) => deliverable.id === "starter-captions",
      )?.runtimeSeconds === 11.5 &&
      audioMix?.probe?.kind === "audio" &&
      audioMix?.probe?.runtimeSeconds === 11.5 &&
      audioWaveform?.probe?.kind === "png" &&
      audioSpectrogram?.probe?.kind === "png" &&
      audioEvidence?.probe?.kind === "sound-evidence",
    JSON.stringify(aggregate),
  );
  const final = services.compiler.compile({ scope: "final" });
  assert(
    "starter-final-compile",
    final.success &&
      final.reviews.entries.every((entry) => entry.state === "complete"),
    JSON.stringify(final.diagnostics),
  );

  const first = aggregate.deliverables[0].files[0];
  const deliverablePath = path.join(project.renderRoot(), first.path);
  const original = fs.readFileSync(deliverablePath);
  const tampered = Buffer.from(original);
  tampered[0] ^= 0xff;
  fs.writeFileSync(deliverablePath, tampered);
  const rejected = services.compiler.compile({ scope: "final" });
  assert(
    "starter-final-ledger-tamper-gate",
    rejected.success === false &&
      rejected.diagnostics.some(
        (item) => item.code === "render-deliverable-stale",
      ),
    JSON.stringify(rejected.diagnostics),
  );
  fs.writeFileSync(deliverablePath, original);
  const restored = services.compiler.compile({ scope: "final" });
  assert(
    "starter-final-ledger-restored",
    restored.success,
    JSON.stringify(restored.diagnostics),
  );
} else {
  throw new Error('Expected verifier phase "review" or "final".');
}
`;

const stage = mkdtempSync(join(tmpdir(), "automovie-e2e-tgz-"));
tracePath = join(stage, "trace.log");
writeFileSync(tracePath, `${new Date().toISOString()} START e2e:tgz\n`);
const tarballDir = join(stage, "tarballs");
const projectDir = join(stage, "project");
mkdirSync(tarballDir);
mkdirSync(projectDir);

let packagedE2eFailure;
try {
  // 1. Pack the chain. prepack runs each package's full build.
  for (const name of PACKAGES)
    run(
      `pack ${publishedPackageName(name)}`,
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
  const creatorBinTarget = join(
    projectDir,
    "node_modules",
    "create-automovie",
    "lib",
    "bin.js",
  );
  if (!existsSync(creatorBinTarget))
    fail(
      `packed artifact is missing the creator bin target: ${creatorBinTarget}`,
    );
  console.log("✓ bin-target: lib/bin.js present in the installed package");
  for (const retired of ["bin-granular.js", "bin-production.js"]) {
    const target = join(
      projectDir,
      "node_modules",
      "@automovie",
      "mcp",
      "lib",
      retired,
    );
    if (existsSync(target))
      fail(`packed artifact unexpectedly contains retired bin: ${target}`);
  }
  console.log("✓ retired-bin-targets: compatibility bins are absent");

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
  const clientTimeout = 300_000;
  const client = spawnSync(`node client.mjs`, {
    cwd: projectDir,
    shell: true,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
    timeout: clientTimeout,
    env: { ...process.env, E2E_EXPECTED_VERSION: expectedVersion },
  });
  if (commandSucceeded(client) === false)
    failCommand(
      "stdio client assertions",
      client,
      clientTimeout,
      "client assertions failed",
    );
  process.stdout.write(client.stdout ?? "");

  // 5. Generate and exercise the production repository using only the packed
  // CLI and runtime tarballs. The proxy render creates review evidence and the
  // immutable proxy publication; the following final render must be blocked
  // by missing reviews. An external-agent worksheet then completes every
  // current target, the resumed final render reaches final compile, and a byte
  // tamper proves the delivery ledger is enforced.
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
  const legacyDir = join(projectDir, "legacy-import");
  mkdirSync(legacyDir);
  writeFileSync(
    join(legacyDir, "automovie.json"),
    `${JSON.stringify({ version: 1, assets: [] }, null, 2)}\n`,
  );
  const dryImport = runJson(
    "dry-run packaged legacy import",
    process.execPath,
    [cliBin, "migrate", legacyDir, "--dry-run"],
    projectDir,
  );
  if (
    dryImport.version !== 1 ||
    typeof dryImport.fingerprint !== "string" ||
    existsSync(join(legacyDir, ".automovie"))
  )
    fail("packaged legacy dry-run did not remain read-only");
  const appliedImport = runJson(
    "apply packaged legacy import",
    process.execPath,
    [cliBin, "migrate", legacyDir],
    projectDir,
  );
  if (
    appliedImport.status !== "applied" ||
    !existsSync(join(legacyDir, ".automovie", "manifest.json"))
  )
    fail("packaged legacy import did not publish production provenance");
  const repeatedImport = runJson(
    "repeat packaged legacy import",
    process.execPath,
    [cliBin, "migrate", legacyDir],
    projectDir,
  );
  if (repeatedImport.status !== "unchanged")
    fail("packaged legacy import was not idempotent");
  const rolledBackImport = runJson(
    "rollback packaged legacy import",
    process.execPath,
    [cliBin, "migrate", legacyDir, "--rollback"],
    projectDir,
  );
  if (
    rolledBackImport.status !== "rolled-back" ||
    existsSync(join(legacyDir, ".automovie"))
  )
    fail("packaged legacy rollback did not restore the legacy-only tree");
  // Keep the packaged-starter probe outside the fixture project.
  // Otherwise Node can climb to projectDir/node_modules and hide a missing
  // production dependency from the separately installed scaffold.
  const starterDir = join(stage, "production-starter");
  run(
    "scaffold packaged production starter",
    `node "${creatorBinTarget}" "${starterDir}"`,
    projectDir,
  );
  if (
    readFileSync(join(starterDir, ".npmrc"), "utf8") !==
    "onnxruntime-node-install-cuda=skip\n"
  )
    fail("packaged starter does not disable the unused ONNX Runtime CUDA EP");
  const starterProductionPath = join(
    starterDir,
    ".automovie",
    "design",
    "production.json",
  );
  const starterProduction = JSON.parse(
    readFileSync(starterProductionPath, "utf8"),
  );
  starterProduction.frameFormat = {
    ...starterProduction.frameFormat,
    width: 160,
    height: 90,
    fps: 2,
  };
  writeFileSync(
    starterProductionPath,
    `${JSON.stringify(starterProduction, null, 2)}\n`,
  );
  // The same shrink, in the typed source the record is derived FROM. A design
  // record edited behind its subject is exactly what the authoring ladder
  // forbids, and the step below proves it: `npm run design` re-derives every
  // record and reports this one rewritten, which stales the compile and
  // refuses every reader of generated state three steps later. Cheap frames
  // are this harness's business; disagreeing with the source is not.
  const starterProductionSourcePath = join(starterDir, "src", "production.ts");
  const starterProductionSource = readFileSync(
    starterProductionSourcePath,
    "utf8",
  );
  const shippedFrameFormat = [
    "  frameFormat: {",
    "    width: 1280,",
    "    height: 720,",
    "    fps: 24,",
  ].join("\n");
  const shrunkFrameFormat = [
    "  frameFormat: {",
    "    width: 160,",
    "    height: 90,",
    "    fps: 2,",
  ].join("\n");
  if (starterProductionSource.split(shippedFrameFormat).length !== 2)
    fail(
      "packaged starter frame-format fixture no longer has exactly one shipped raster in src/production.ts",
    );
  writeFileSync(
    starterProductionSourcePath,
    starterProductionSource.replace(shippedFrameFormat, shrunkFrameFormat),
  );
  const starterConfigPath = join(starterDir, "automovie.config.ts");
  const starterConfig = readFileSync(starterConfigPath, "utf8");
  const defaultProxyFrameStep = "      frameStep: 2,";
  const e2eProxyFrameStep = "      frameStep: 1,";
  if (starterConfig.split(defaultProxyFrameStep).length !== 2)
    fail(
      "packaged starter proxy frameStep fixture no longer has exactly one default",
    );
  writeFileSync(
    starterConfigPath,
    starterConfig.replace(defaultProxyFrameStep, e2eProxyFrameStep),
  );
  // Pin every published AutoMovie package to its sibling tarball. Direct
  // entries make npm satisfy the packed packages' transitive semver ranges
  // without reaching for unpublished workspace versions in the registry.
  const starterManifestPath = join(starterDir, "package.json");
  const starterManifest = JSON.parse(readFileSync(starterManifestPath, "utf8"));
  for (const name of PACKAGES.filter((entry) => entry !== "create-automovie")) {
    const file = tarballs.find((entry) =>
      entry.startsWith(tarballPrefix(name)),
    );
    if (file === undefined)
      fail(`missing tarball for ${publishedPackageName(name)}`);
    const packageName = publishedPackageName(name);
    const specifier = `file:${join(tarballDir, file).replaceAll("\\", "/")}`;
    if (Object.hasOwn(starterManifest.devDependencies ?? {}, packageName))
      starterManifest.devDependencies[packageName] = specifier;
    else starterManifest.dependencies[packageName] = specifier;
  }
  writeFileSync(
    starterManifestPath,
    `${JSON.stringify(starterManifest, null, 2)}\n`,
  );
  run(
    "install packaged starter dependencies with npm",
    "npm install --prefer-offline --no-audit --no-fund",
    starterDir,
  );
  run(
    "invoke the packaged starter-local automovie binary",
    "npm exec --offline -- automovie --help",
    starterDir,
  );
  if (process.env.CI === "true" && process.platform === "linux")
    run(
      "install packaged Chromium system dependencies",
      "npx playwright install-deps chromium",
      starterDir,
      900_000,
    );
  run(
    "install packaged starter Chromium",
    "npm run capture:install",
    starterDir,
    900_000,
  );
  const captureReceiptDirectory = join(
    starterDir,
    ".automovie",
    "capture",
    "install-receipts",
  );
  const captureReceiptGenerations = (() => {
    try {
      return readdirSync(captureReceiptDirectory, { withFileTypes: true });
    } catch (error) {
      fail(`packaged capture install has no generation inventory: ${error}`);
    }
  })();
  if (
    captureReceiptGenerations.length !== 1 ||
    captureReceiptGenerations[0].isFile() === false ||
    /^[0-9a-f]{64}\.json$/u.test(captureReceiptGenerations[0].name) === false
  )
    fail(
      `packaged capture install published an invalid generation inventory: ${captureReceiptGenerations.map((entry) => entry.name).join(", ")}`,
    );
  const captureReceiptPath = join(
    captureReceiptDirectory,
    captureReceiptGenerations[0].name,
  );
  const captureReceiptText = readFileSync(captureReceiptPath, "utf8");
  const captureReceipt = JSON.parse(captureReceiptText);
  const captureReceiptGeneration = createHash("sha256")
    .update(
      JSON.stringify({
        browser: {
          product: captureReceipt.browser.product,
          revision: captureReceipt.browser.revision,
          version: captureReceipt.browser.version,
        },
        playwright: {
          package: captureReceipt.playwright.package,
          version: captureReceipt.playwright.version,
        },
      }),
      "utf8",
    )
    .digest("hex");
  if (captureReceiptGenerations[0].name !== `${captureReceiptGeneration}.json`)
    fail("packaged capture receipt does not occupy its canonical generation");
  let captureReceiptFailure;
  try {
    writeFileSync(captureReceiptPath, "{bad");
    runExpectedFailure(
      "reject malformed packaged capture receipt",
      "npm run capture:doctor",
      starterDir,
      "not valid JSON",
    );
    writeFileSync(
      captureReceiptPath,
      `${JSON.stringify(
        {
          ...captureReceipt,
          playwright: {
            ...captureReceipt.playwright,
            version: "0.0.0-stale",
          },
        },
        null,
        2,
      )}\n`,
    );
    runExpectedFailure(
      "reject mis-keyed packaged capture receipt",
      "npm run capture:doctor",
      starterDir,
      "occupies another generation",
    );
  } catch (error) {
    captureReceiptFailure = { error };
    throw error;
  } finally {
    preservePackagedE2eCleanup(
      captureReceiptFailure,
      "packaged capture receipt",
      () => writeFileSync(captureReceiptPath, captureReceiptText),
    );
  }
  const parkedCaptureExecutable = `${captureReceipt.browser.executablePath}.automovie-missing`;
  renameSync(captureReceipt.browser.executablePath, parkedCaptureExecutable);
  let captureExecutableFailure;
  try {
    runExpectedFailure(
      "diagnose missing packaged capture executable",
      "npm run capture:doctor",
      starterDir,
      "is missing or differs",
    );
  } catch (error) {
    captureExecutableFailure = { error };
    throw error;
  } finally {
    preservePackagedE2eCleanup(
      captureExecutableFailure,
      "packaged capture executable",
      () =>
        renameSync(
          parkedCaptureExecutable,
          captureReceipt.browser.executablePath,
        ),
    );
  }
  run(
    "doctor packaged starter capture runtime",
    "npm run capture:doctor",
    starterDir,
  );
  const captureConfigPath = join(starterDir, "automovie.config.ts");
  const captureConfigText = readFileSync(captureConfigPath, "utf8");
  writeFileSync(
    captureConfigPath,
    captureConfigText.replace(
      'source: "playwright-chromium"',
      'source: "system-channel", channel: "firefox"',
    ),
  );
  let captureConfigFailure;
  try {
    runExpectedFailure(
      "reject invalid packaged capture config",
      "npm run capture:doctor",
      starterDir,
      "Invalid capture browser config",
    );
  } catch (error) {
    captureConfigFailure = { error };
    throw error;
  } finally {
    preservePackagedE2eCleanup(
      captureConfigFailure,
      "packaged capture config",
      () => writeFileSync(captureConfigPath, captureConfigText),
    );
  }
  run("compile packaged starter", "npm run compile", starterDir);
  const stateReaderTypeProbePath = join(
    starterDir,
    "verify-packaged-state-reader.ts",
  );
  writeFileSync(
    stateReaderTypeProbePath,
    `import { loadAutoMovieProjectState, requireCurrentAutoMovieProjectState } from "@automovie/cli";
import { Vector3 } from "@automovie/engine";

const state = requireCurrentAutoMovieProjectState(
  loadAutoMovieProjectState({ root: process.cwd() }),
);
const distance: number = Vector3.length({ x: 3, y: 4, z: 0 });
if (state.generated.registry.productionId.length === 0 || distance !== 5)
  throw new Error("packaged state reader or engine query failed");
`,
  );
  run(
    "typecheck packaged CLI state-reader export",
    "npm exec -- tsc --ignoreConfig --noEmit --target ES2022 --module NodeNext --moduleResolution NodeNext --types node --skipLibCheck verify-packaged-state-reader.ts",
    starterDir,
  );
  const stateReaderRuntimeProbePath = join(
    starterDir,
    "verify-packaged-state-reader.mjs",
  );
  writeFileSync(
    stateReaderRuntimeProbePath,
    `import { loadAutoMovieProjectState, requireCurrentAutoMovieProjectState } from "@automovie/cli";
import { Vector3 } from "@automovie/engine";

const state = requireCurrentAutoMovieProjectState(
  loadAutoMovieProjectState({ root: process.cwd() }),
);
if (
  state.generated.registry.productionId !== state.productionId ||
  state.generated.shots.size === 0 ||
  Vector3.length({ x: 3, y: 4, z: 0 }) !== 5
)
  throw new Error("packaged state reader or engine query failed");
`,
  );
  run(
    "execute packaged CLI state-reader and engine query",
    "node verify-packaged-state-reader.mjs",
    starterDir,
  );
  // A fresh @ttsc/lint install builds its source plugin with Go once per
  // cache key. Cold Windows and CI caches can legitimately exceed the ordinary
  // five-minute command fence before TypeScript linting itself begins.
  //
  // `npm run lint` runs the compiler at review scope, so this is the compiler's
  // own refusal rather than a project rule's. The starter authors required
  // acceptance scenarios for both scenes, so what it lacks is the reviews that
  // discharge them; `screenplay-scene-unobserved` covers the other half, a
  // scene no required scenario cites at all.
  runExpectedFailure(
    "enforce packaged starter review-scope gate",
    "npm run lint",
    starterDir,
    "Review state is missing",
    900_000,
  );
  // Every design record as the compiler left it, read immediately before the
  // emitter runs. A record the emitter rewrites is reported by name below, and
  // the name alone does not say WHAT it disagreed about -- these bytes do, and
  // they cannot be recovered afterwards because the emit has already replaced
  // them.
  const designRoot = join(starterDir, ".automovie", "design");
  const beforeEmit = new Map();
  const readDesignTree = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const full = join(directory, entry.name);
      if (entry.isDirectory()) readDesignTree(full);
      else if (entry.name.endsWith(".json"))
        beforeEmit.set(full, readFileSync(full, "utf8"));
    }
  };
  if (existsSync(designRoot)) readDesignTree(designRoot);

  // The design records are derived from the typed subjects rather than
  // transcribed beside them, and nothing else checks that the derivation
  // settles. The compile above already migrated the shipped records into the
  // trees the compiler reads, so the first run here must report every record
  // unchanged: the subjects derive exactly what the compiler just consumed
  // rather than something new each time.
  try {
    runExpectedOutput(
      "packaged starter design records derive from their subjects",
      "npm run design",
      starterDir,
      [
        "unchanged models/soloist.json",
        "unchanged models/chorus-hero.json",
        "unchanged formations/chorus.json",
        "unchanged world.json",
      ],
      300_000,
      // Every line, not the four named above. A record the emitter
      // rewrites is a design mutation, and a design mutation between the
      // compile and the reader below is exactly what leaves the packaged
      // state stale -- reported here, by name, instead of as a stale state
      // three steps later.
      /^unchanged /u,
    );
  } finally {
    // In `finally`, because the line check above throws on the record it names
    // and the bytes are what a reader actually needs: reported whichever check
    // fired, and reported when neither did, since a record rewritten to
    // identical bytes would pass both and still not settle.
    for (const [file, before] of beforeEmit) {
      const after = existsSync(file) ? readFileSync(file, "utf8") : "(removed)";
      if (after === before) continue;
      console.error(
        `design record ${relative(starterDir, file)} moved across the emit:
--- as the compiler left it
${before}
--- as the emitter wrote it
${after}`,
      );
    }
  }
  // The field must contain the unit standing on it, which is the relation its
  // own specification states and which two independently authored numbers got
  // wrong. The ground that decides the picture is the one a shot stages: the
  // scene keeps it verbatim and the viewer builds its meshes from it, so this
  // reads the compiled shot rather than the world record beside it.
  //
  // Every number comes from compiler output and the containment question goes
  // to the engine that owns it. Recomputing the layout here would put a second
  // answer beside the compiler's, which is the shape of the defect this gate
  // exists to catch.
  //
  // The compiler owns the whole relation and refuses it during `npm run
  // compile` above, including the interior of every cue that moves a unit. This
  // reads it back where the unit stands and at each end of its cues, which is
  // what a packaged consumer can ask without the compiler's own sampling
  // policy. What it uniquely proves is that the shipped artifacts carry a
  // staged space and a staged unit at all, so the gate had something to
  // measure, and that the engine's placement and containment answers are
  // reachable from an install.
  const fieldProbePath = join(starterDir, "verify-packaged-field.mjs");
  writeFileSync(
    fieldProbePath,
    `import {
  loadAutoMovieProjectState,
  requireCurrentAutoMovieProjectState,
} from "@automovie/cli";
import {
  formationSlotPosition,
  isWalkable,
  placeFormationSlot,
  sampleFormationMotion,
  sampleFormationSlotMotion,
} from "@automovie/engine";

const loaded = loadAutoMovieProjectState({ root: process.cwd() });
// Named before it is refused. "stale" alone sends a reader back through every
// step that ran since the compile; the two fingerprints and the stored
// diagnostics say which input moved and why the compile was not accepted.
if (loaded.freshness?.status !== "current")
  console.error(
    "freshness",
    JSON.stringify(
      {
        revision: loaded.revision,
        freshness: loaded.freshness,
      },
      null,
      2,
    ),
  );
const state = requireCurrentAutoMovieProjectState(loaded);
let checked = 0;
for (const [id, shot] of state.generated.shots) {
  const space = shot.scene.space;
  if (space === undefined || space === null) continue;
  const cues = shot.formationMotions ?? [];
  const slotCues = shot.formationSlotMotions ?? [];
  for (const formation of shot.formations) {
    const own = cues.filter((cue) => cue.formation === formation.id);
    const ownSlots = slotCues.filter((cue) => cue.formation === formation.id);
    const times = [
      ...new Set(
        [...own, ...ownSlots].flatMap((cue) => [cue.start, cue.end]),
      ),
    ];
    // Members, the same thing the compiler judges. The box around a formation
    // has corners no member stands on, so reading those would report a place
    // the unit is not. Every slot is asked here because a shipped starter is
    // small enough to ask all of them.
    const members = Array.from({ length: formation.count }, (_, slot) => ({
      slot,
      point: formationSlotPosition(formation, slot),
    }));
    const resting = times.length === 0 || Math.min(...times) > 0;
    for (const time of [...(resting ? [null] : []), ...times]) {
      // One sampled unit state per time, not one per member: every member of a
      // unit is read at the same instant, and asking the engine once per member
      // for that one instant would be as many chances to read it differently.
      const motion =
        time === null ? null : sampleFormationMotion(own, formation.id, time);
      for (const member of members) {
        // A member the shot removed stands nowhere, so no surface has to carry
        // it, and a member with a cue of its own is read where that cue puts it.
        const placed =
          motion === null
            ? { present: true, position: member.point }
            : placeFormationSlot({
                position: member.point,
                facingDeg: formation.facingDeg,
                anchor: formation.anchor,
                baseFacingDeg: formation.facingDeg,
                unit: motion,
                member: sampleFormationSlotMotion(
                  ownSlots,
                  formation.id,
                  member.slot,
                  time,
                ),
              });
        if (placed.present === false) continue;
        if (isWalkable(space, placed.position.x, placed.position.z) === false)
          throw new Error(
            \`shot "\${id}" puts a member of formation "\${formation.id}" at (\${placed.position.x}, \${placed.position.z})\` +
              \` \${time === null ? "where it stands" : \`at \${time}s\`}, which the ground it staged does not carry.\`,
          );
      }
      checked++;
    }
  }
}
if (checked === 0)
  throw new Error(
    "no staged formation was measured against its ground, so this proved nothing.",
  );
`,
  );
  run(
    "packaged starter reads its staged unit back onto its staged ground",
    "node verify-packaged-field.mjs",
    starterDir,
  );
  run("test packaged starter", "npm test", starterDir);
  // First publication acquires the pinned Kokoro model, runs CPU ONNX
  // synthesis, encodes Opus and muxes the proxy on an otherwise cold runner.
  run(
    "publish packaged starter proxy review evidence",
    "npm run render -- all --tier proxy",
    starterDir,
    900_000,
  );
  runExpectedFailure(
    "enforce packaged starter final review gate",
    "npm run render -- all --tier final",
    starterDir,
    "Final publication is review-blocked by",
  );
  writeFileSync(
    join(starterDir, "verify-packaged-starter.mjs"),
    STARTER_VERIFY_SOURCE,
  );
  run(
    "complete packaged starter evidence reviews",
    "npm exec -- tsx verify-packaged-starter.mjs review",
    starterDir,
  );
  run("lint reviewed packaged starter", "npm run lint", starterDir, 900_000);
  const encoderFailureHookPath = join(starterDir, "fail-packaged-encoder.cjs");
  writeFileSync(
    encoderFailureHookPath,
    `
const { PNG } = require("pngjs");
const originalRead = PNG.sync.read;
PNG.sync.read = function (input) {
  const caller = new Error().stack?.split("\\n")[2] ?? "";
  if (/[\\\\/]scripts[\\\\/]render\\.ts:\\d+:\\d+/.test(caller))
    throw new Error("automovie-encoder-consumer-sentinel");
  return originalRead.apply(this, arguments);
};
`,
  );
  // Finalize used to decode every frame and re-encode the whole film, so this
  // hook fired and the step proved the decoder's own error reached the
  // operator. Finalize now sample-copies the chunk MP4s it already encoded, so
  // the hook fires on nothing -- and that is worth asserting rather than
  // repairing: a finalize that decodes no frame is the property the chunked
  // assembly was built for, and the hook is exactly the instrument that proves
  // it. The diagnostic-preservation claim itself moved with the decoding, to
  // the chunk render, and the last step of this harness makes the same hook
  // fire there.
  run(
    "finalize the packaged starter without decoding a frame",
    "npm run render -- finalize",
    starterDir,
    300_000,
    {
      ...process.env,
      NODE_OPTIONS: [
        process.env.NODE_OPTIONS,
        "--require=./fail-packaged-encoder.cjs",
      ]
        .filter(Boolean)
        .join(" "),
    },
  );
  const renderStateRoot = join(
    starterDir,
    ".automovie",
    "productions",
    String(starterProduction.id),
    "render-job",
    "final",
  );
  const renderPlanGeneration =
    capturePackagedRenderPlanGeneration(renderStateRoot);
  const renderPlanPath = renderPlanGeneration.path;
  const renderPlanText = renderPlanGeneration.text;
  const onnxNativeBindingPath = join(
    starterDir,
    "node_modules",
    "onnxruntime-node",
    "bin",
    "napi-v3",
    process.platform,
    process.arch,
    "onnxruntime_binding.node",
  );
  const onnxNativeBinding = readFileSync(onnxNativeBindingPath);
  writeFileSync(
    onnxNativeBindingPath,
    Buffer.concat([onnxNativeBinding, Buffer.from([0])]),
  );
  let onnxNativeBindingFailure;
  try {
    runExpectedFailure(
      "reject changed packaged ONNX Runtime native backend",
      "npm run render -- verify",
      starterDir,
      "render runtime identity changed",
    );
  } catch (error) {
    onnxNativeBindingFailure = { error };
    throw error;
  } finally {
    preservePackagedE2eCleanup(
      onnxNativeBindingFailure,
      "packaged ONNX Runtime binding",
      () => writeFileSync(onnxNativeBindingPath, onnxNativeBinding),
    );
  }
  const tamperedRenderPlan = JSON.parse(renderPlanText);
  tamperedRenderPlan.plan.tracks.captions += "\nNOTE tampered\n";
  writeFileSync(
    renderPlanPath,
    `${JSON.stringify(tamperedRenderPlan, null, 2)}\n`,
  );
  let tamperedRenderPlanFailure;
  try {
    runExpectedFailure(
      "reject tampered packaged render plan",
      "npm run render -- verify",
      starterDir,
      "Stored render plan differs",
    );
  } catch (error) {
    tamperedRenderPlanFailure = { error };
    throw error;
  } finally {
    preservePackagedE2eCleanup(
      tamperedRenderPlanFailure,
      "packaged render plan tamper",
      () => writeFileSync(renderPlanPath, renderPlanText),
    );
  }
  const renderPlanRecord = JSON.parse(renderPlanText);
  const renderPlan = renderPlanRecord.plan;
  renderPlan.runtimeIdentity.encoder.version = "0.0.0-stale";
  writeFileSync(
    renderPlanPath,
    `${JSON.stringify(renderPlanRecord, null, 2)}\n`,
  );
  let staleRenderRuntimeFailure;
  try {
    runExpectedFailure(
      "reject stale packaged render runtime identity",
      "npm run render -- verify",
      starterDir,
      "render runtime identity changed",
    );
  } catch (error) {
    staleRenderRuntimeFailure = { error };
    throw error;
  } finally {
    preservePackagedE2eCleanup(
      staleRenderRuntimeFailure,
      "packaged render runtime identity",
      () => writeFileSync(renderPlanPath, renderPlanText),
    );
  }
  const damagedChunk = renderPlan.chunks[0];
  const retainedChunk = renderPlan.chunks[1];
  if (damagedChunk === undefined || retainedChunk === undefined)
    fail("packaged render did not produce multiple resumable chunks");
  const damagedPublication = capturePackagedRenderChunkPublication(
    starterDir,
    "final",
    damagedChunk,
  );
  const damagedReceipt = damagedPublication.receipt;
  writeFileSync(
    join(damagedPublication.directory, damagedReceipt.frames[0].path),
    Buffer.alloc(0),
  );
  const retainedPublication = capturePackagedRenderChunkPublication(
    starterDir,
    "final",
    retainedChunk,
  );
  const abandonedPid = 2_147_483_647;
  const abandonedTemporary = join(
    renderStateRoot,
    "tmp",
    `interrupted.${abandonedPid}`,
  );
  mkdirSync(abandonedTemporary, { recursive: true });
  writeFileSync(join(abandonedTemporary, "partial.png"), Buffer.alloc(0));
  const slotSegment = encodeURIComponent(damagedChunk.slot);
  const abandonedAttemptToken = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  mkdirSync(join(renderStateRoot, "locks"), { recursive: true });
  mkdirSync(join(renderStateRoot, "locks", slotSegment), { recursive: true });
  writeFileSync(
    join(
      renderStateRoot,
      "locks",
      slotSegment,
      `claim.${abandonedPid}.interrupted.lock.candidate`,
    ),
    Buffer.alloc(0),
  );
  writeFileSync(
    join(renderStateRoot, "locks", `${slotSegment}.lock`),
    `${JSON.stringify({
      chunk: damagedChunk.id,
      pid: abandonedPid,
      token: abandonedAttemptToken,
    })}\n`,
  );
  mkdirSync(join(renderStateRoot, "attempts"), { recursive: true });
  writeFileSync(
    join(renderStateRoot, "attempts", `${slotSegment}.json`),
    `${JSON.stringify({
      version: 1,
      slot: damagedChunk.slot,
      chunk: damagedChunk.id,
      state: "running",
      correction: "",
      pid: abandonedPid,
      token: abandonedAttemptToken,
    })}\n`,
  );
  run(
    "resume interrupted packaged render through final compile",
    "npm run render",
    starterDir,
  );
  const quarantine = readdirSync(join(renderStateRoot, "quarantine"));
  const damagedCurrent = capturePackagedRenderChunkPublication(
    starterDir,
    "final",
    damagedChunk,
  );
  const retainedCurrent = capturePackagedRenderChunkPublication(
    starterDir,
    "final",
    retainedChunk,
  );
  if (
    damagedCurrent.path !== damagedPublication.path ||
    damagedCurrent.directory === damagedPublication.directory ||
    damagedCurrent.text === damagedPublication.text ||
    existsSync(damagedPublication.directory) ||
    existsSync(damagedCurrent.directory) === false ||
    retainedCurrent.path !== retainedPublication.path ||
    retainedCurrent.directory !== retainedPublication.directory ||
    retainedCurrent.text !== retainedPublication.text ||
    existsSync(retainedCurrent.directory) === false ||
    existsSync(join(renderStateRoot, "attempts", `${slotSegment}.json`)) ||
    quarantine.some((entry) => entry.includes("abandoned-partial")) === false ||
    quarantine.some((entry) => entry.includes("abandoned-lock-candidate")) ===
      false ||
    quarantine.some((entry) => entry.includes("abandoned-lock")) === false
  )
    fail(
      "packaged render did not reuse the current chunk and recover interrupted/corrupt state selectively",
    );
  run(
    "verify packaged starter pixels, final ledger and tamper gate",
    "npm exec -- tsx verify-packaged-starter.mjs final",
    starterDir,
  );
  run(
    "run the packaged read-only final verifier",
    "npm run verify",
    starterDir,
  );

  // The chunk render is the only place the renderer still decodes a PNG, so it
  // owns the claim the finalize step used to carry: an error raised inside the
  // decoder reaches the operator as its own message. It reaches them through a
  // catch now -- the job turns a failed chunk into a `correction` it prints and
  // exits non-zero on -- which is exactly the shape in which a message gets
  // swallowed or replaced by a generic one, and nothing else in this harness
  // would notice if it were. It also proves the hook above is a live
  // instrument: the finalize step passes by nothing happening, so a `--require`
  // that silently failed to load would look identical there.
  //
  // The packaged harness, not test/src/features/cli: scripts/render.ts awaits
  // main() at module scope, reads ../automovie.config, and keeps renderChunk
  // module-local, so reaching that decoder needs a scaffolded project, a real
  // browser capture and the packaged encoder -- this stage, in other words. The
  // cli suite reads render.ts as source, and no source assertion can say what
  // the operator ends up seeing. Nothing already here can carry it either: the
  // proxy and resume renders have to succeed, and a decoder that throws on
  // sight is only provable by a run that fails.
  //
  // Cheap, and last. Emptying one frame of one published chunk makes exactly
  // that chunk non-current, so `render run` re-renders one chunk and dies on
  // its first capture, decoding nothing else and re-encoding no film. Running
  // it after every verifier has read the render state keeps the debris it
  // leaves -- an emptied frame, a failed attempt, an abandoned temporary tree
  // that the next run would quarantine as `abandoned-partial` -- from
  // pre-satisfying the damaged/retained comparison and the quarantine
  // assertions above, which would subtract evidence rather than add it.
  const decoderSentinelChunk = capturePackagedRenderChunkPublication(
    starterDir,
    "final",
    retainedChunk,
  );
  writeFileSync(
    join(
      decoderSentinelChunk.directory,
      decoderSentinelChunk.receipt.frames[0].path,
    ),
    Buffer.alloc(0),
  );
  runExpectedFailure(
    "preserve packaged chunk render decoder diagnostics",
    "npm run render -- run",
    starterDir,
    "automovie-encoder-consumer-sentinel",
    300_000,
    {
      ...process.env,
      NODE_OPTIONS: [
        process.env.NODE_OPTIONS,
        "--require=./fail-packaged-encoder.cjs",
      ]
        .filter(Boolean)
        .join(" "),
    },
  );

  console.log(
    "\n✓ e2e:tgz PASSED: packaged MCP surfaces and two-shot production scaffold verified",
  );
} catch (error) {
  packagedE2eFailure = { error };
  throw error;
} finally {
  preservePackagedE2eCleanup(packagedE2eFailure, "packaged E2E stage", () => {
    if (KEEP_STAGE) console.log(`\nverification stage retained at ${stage}`);
    else rmSync(stage, { recursive: true, force: true, maxRetries: 5 });
  });
}
