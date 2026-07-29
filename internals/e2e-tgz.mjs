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
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "..");
const KEEP_STAGE = process.env.AUTOMOVIE_E2E_KEEP_STAGE === "1";

// Interface first, CLI last: each runtime dependency packs before its consumer.
const PACKAGES = ["interface", "engine", "render", "viewer", "mcp", "cli"];
let tracePath = null;

const fail = (message) => {
  console.error(`\n✗ e2e:tgz FAILED: ${message}`);
  throw new Error(message);
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

const runExpectedFailure = (
  label,
  command,
  cwd,
  expectedOutput,
  timeout = 300_000,
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
  });
  const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
  if (
    result.error !== undefined ||
    result.signal !== null ||
    typeof result.status !== "number" ||
    result.status === 0 ||
    output.includes(expectedOutput) === false
  ) {
    process.stderr.write(output);
    fail(
      `${label} did not exit normally with a non-zero status and the expected "${expectedOutput}" diagnostic`,
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
  const result = spawnSync(executable, args, {
    cwd,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 300_000,
  });
  if (result.status !== 0) {
    process.stderr.write(result.stdout ?? "");
    process.stderr.write(result.stderr ?? "");
    fail(`${label} exited with ${result.status ?? "signal"}`);
  }
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
  const { AutoMovieLegacyApplication } = await import("@automovie/mcp");
  const operations = Object.getOwnPropertyNames(
    AutoMovieLegacyApplication.prototype,
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
    arguments: { root: path.resolve(".") },
  });
  assert(
    "production-open-project",
    opened.isError !== true &&
      existsSync(path.resolve(".automovie/manifest.json")),
    (opened.content?.[0]?.text ?? "").slice(0, 300),
  );
} finally {
  await production.close();
}
`;

const STARTER_VERIFY_SOURCE = `
import {
  AutoMovieApplication,
  AutoMovieProductionProject,
  digestAutoMovieBytes,
  parseAutoMovieCaptureRuntimeIdentity,
} from "@automovie/mcp";
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
  shot: frame.shot,
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
const requiredAcceptance = (graph, target) =>
  [...graph.acceptance.values()]
    .filter(
      (scenario) =>
        scenario.required &&
        (target.kind === "film" ||
          (target.kind === "shot" &&
            ((scenario.target.kind === "shot" &&
              scenario.target.id === target.id) ||
              ((scenario.criterion.kind === "frame" ||
                scenario.criterion.kind === "event") &&
                scenario.criterion.shot === target.id)))),
    )
    .sort((left, right) => left.id.localeCompare(right.id));
const worksheet = (project, prepared) => {
  const graph = project.graph();
  const acceptance = requiredAcceptance(graph, prepared.target);
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
                  item.shot === shot &&
                  item.reviewFrame === scenario.criterion.frame &&
                  item.pass === scenario.criterion.pass,
              );
              return frame === undefined
                ? [contract]
                : [frameEvidence(frame), contract];
            })
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
const generated = readJson(path.join(root, ".automovie/generated-manifest.json"));
const compiled = readJson(path.join(root, "generated/manifests/compile.json"));
const manifests = namedFiles(path.join(root, "renders"), "manifest.json");
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
assert(
  "starter-compiled-shot-order",
  JSON.stringify(compiled.shots) === JSON.stringify(["answer", "opening"]),
  \`expected both canonical compiled shots, got \${JSON.stringify(compiled.shots)}\`,
);
assert(
  "starter-render-bundle-count",
  renderManifests.length === 2,
  \`expected one accumulated content-addressed bundle per shot, got \${renderManifests.length}\`,
);
const frames = renderManifests.flatMap((entry) =>
  entry.value.frames.map((frame) => ({
    ...frame,
    shot: entry.value.target.id,
    manifest: entry.value,
    directory: path.dirname(entry.file),
  })),
);
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
    png.width === 16 && png.height === 16,
    \`expected 16x16 packaged-short raster, got \${png.width}x\${png.height}\`,
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

const app = new AutoMovieApplication({ projectRoot: root });
app.getGuideDocument({ name: "AUTOMOVIE_OVERALL" });
app.getGuideDocument({ name: "COMPILATION" });
app.getGuideDocument({ name: "GEOMETRY" });
app.getGuideDocument({ name: "PRODUCTION_REVIEW" });
app.openProject({ root });
const project = AutoMovieProductionProject.open(root);
const graph = project.graph();
const formationSummary = app.queryGeometry({
  request: {
    query: "formation",
    formation: "army",
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
const effectSummary = app.queryGeometry({
  request: {
    query: "effect",
    zone: "signal-smoke",
    shot: "opening",
    time: 2,
    subjects: ["sentinel"],
  },
});
const effectAcceptance = graph.acceptance.get("opening-effect-mask");
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
    effectAcceptance.criterion.frame === "signal-apex" &&
    effectAcceptance.criterion.pass === "mask",
  JSON.stringify(effectSummary),
);
const phase = process.argv[2];
if (phase === "review") {
  const before = app.inspectProject({});
  assert(
    "starter-review-gate-is-enforced",
    before.reviews.entries.some((entry) => entry.state !== "complete"),
    JSON.stringify(before.reviews),
  );
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
          new Set(prepared.frames.map((frame) => frame.shot)).size === 2,
        JSON.stringify(prepared.frames),
      );
    const submitted = app.submitReview(worksheet(project, prepared));
    assert(
      \`starter-review-complete:\${targetKey(entry.target)}\`,
      submitted.accepted && submitted.state === "complete",
      JSON.stringify(submitted.diagnostics),
    );
  }
  const reviewed = app.compileProject({ scope: "review" });
  assert(
    "starter-review-compile-gate",
    reviewed.success &&
      reviewed.reviews.entries.every((entry) => entry.state === "complete"),
    JSON.stringify(reviewed.diagnostics),
  );
} else if (phase === "final") {
  const aggregatePath = path.join(root, ".automovie/render-manifest.json");
  const aggregateBytes = fs.readFileSync(aggregatePath);
  const aggregate = JSON.parse(aggregateBytes.toString("utf8"));
  const receipt = readJson(
    path.join(root, ".automovie/render-manifest-receipt.json"),
  );
  assert(
    "starter-aggregate-receipt",
    receipt.version === 2 &&
      receipt.manifestDigest === digestAutoMovieBytes(aggregateBytes) &&
      Array.isArray(receipt.files) &&
      receipt.files.length === 5 &&
      receipt.files.every(
        (file) =>
          aggregate.deliverables
            ?.find((deliverable) => deliverable.id === file.deliverable)
            ?.files?.some(
              (owned) =>
                owned.path === file.path &&
                owned.digest === file.digest &&
                owned.bytes === file.bytes &&
                owned.mediaType === file.mediaType,
            ) === true,
      ),
    JSON.stringify(receipt),
  );
  const receiptByDeliverable = new Map(
    receipt.files.map((file) => [file.deliverable, file]),
  );
  assert(
    "starter-required-deliverables-parser-complete",
    aggregate.compileFingerprint === generated.inputFingerprint &&
      aggregate.deliverables.length === 5 &&
      [
        "starter-preview",
        "starter-feature",
        "starter-pose-guide",
        "starter-captions",
        "starter-audio",
      ].every((id) =>
        aggregate.deliverables.some(
          (deliverable) =>
            deliverable.id === id && deliverable.files.length === 1,
        ),
      ) &&
      receiptByDeliverable.get("starter-preview")?.probe?.kind === "png" &&
      receiptByDeliverable.get("starter-preview")?.probe?.width === 16 &&
      receiptByDeliverable.get("starter-feature")?.probe?.kind === "video" &&
      receiptByDeliverable.get("starter-feature")?.probe?.frameCount === 23 &&
      receiptByDeliverable.get("starter-feature")?.probe?.width === 16 &&
      receiptByDeliverable.get("starter-pose-guide")?.probe?.kind ===
        "video" &&
      receiptByDeliverable.get("starter-pose-guide")?.probe?.frameCount ===
        23 &&
      receiptByDeliverable.get("starter-captions")?.probe?.kind ===
        "webvtt" &&
      receiptByDeliverable.get("starter-captions")?.probe?.cueCount === 1 &&
      aggregate.deliverables.find(
        (deliverable) => deliverable.id === "starter-captions",
      )?.runtimeSeconds === 11.5 &&
      receiptByDeliverable.get("starter-audio")?.probe?.kind === "audio" &&
      receiptByDeliverable.get("starter-audio")?.probe?.runtimeSeconds ===
        11.5,
    JSON.stringify(aggregate),
  );
  const final = app.compileProject({ scope: "final" });
  assert(
    "starter-final-compile",
    final.success &&
      final.reviews.entries.every((entry) => entry.state === "complete"),
    JSON.stringify(final.diagnostics),
  );

  const first = aggregate.deliverables[0].files[0];
  const deliverablePath = path.join(root, "renders", first.path);
  const original = fs.readFileSync(deliverablePath);
  const tampered = Buffer.from(original);
  tampered[0] ^= 0xff;
  fs.writeFileSync(deliverablePath, tampered);
  const rejected = app.compileProject({ scope: "final" });
  assert(
    "starter-final-ledger-tamper-gate",
    rejected.success === false &&
      rejected.diagnostics.some(
        (item) => item.code === "render-deliverable-stale",
      ),
    JSON.stringify(rejected.diagnostics),
  );
  fs.writeFileSync(deliverablePath, original);
  const restored = app.compileProject({ scope: "final" });
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
  // CLI and runtime tarballs. The first render must be blocked by missing
  // reviews after it creates evidence. An external-agent worksheet then
  // completes every current target, the second render reaches final compile,
  // and a byte tamper proves the delivery ledger is enforced.
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
  // Keep the strict-layout probe outside the npm-hoisted fixture project.
  // Otherwise Node can climb to projectDir/node_modules and hide a missing
  // production dependency from the pnpm-installed scaffold.
  const starterDir = join(stage, "production-starter");
  run(
    "scaffold packaged production starter",
    `node "${cliBin}" start "${starterDir}"`,
    projectDir,
  );
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
    width: 16,
    height: 16,
    fps: 2,
  };
  writeFileSync(
    starterProductionPath,
    `${JSON.stringify(starterProduction, null, 2)}\n`,
  );
  // Override every published `@automovie/*` range with its own tarball before
  // installing. `pnpm add <tarball>` resolves the manifest it already has
  // first, so the starter's registry ranges 404 outside the workspace before
  // any tarball spec replaces them, and a transitive range (mcp's own
  // dependency on render) is never replaced at all. An override covers direct
  // and transitive alike, which keeps the probe offline and installs exactly
  // the bytes this commit packed.
  const runtimeTarballs = tarballs.filter(
    (file) => file.startsWith("automovie-cli-") === false,
  );
  const starterManifestPath = join(starterDir, "package.json");
  const starterManifest = JSON.parse(readFileSync(starterManifestPath, "utf8"));
  starterManifest.pnpm = {
    ...starterManifest.pnpm,
    overrides: Object.fromEntries(
      runtimeTarballs.map((file) => [
        `@automovie/${PACKAGES.find((name) => file.startsWith(`automovie-${name}-`))}`,
        `file:${join(tarballDir, file).replaceAll("\\", "/")}`,
      ]),
    ),
  };
  writeFileSync(
    starterManifestPath,
    `${JSON.stringify(starterManifest, null, 2)}\n`,
  );
  run(
    "install packaged starter dependencies with strict pnpm layout",
    "pnpm install --ignore-workspace --prefer-offline --config.strict-peer-dependencies=false",
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
    "pnpm capture:install",
    starterDir,
    900_000,
  );
  const captureReceiptPath = join(
    starterDir,
    ".automovie",
    "capture",
    "install-receipt.json",
  );
  const captureReceiptText = readFileSync(captureReceiptPath, "utf8");
  const captureReceipt = JSON.parse(captureReceiptText);
  writeFileSync(captureReceiptPath, "{bad");
  runExpectedFailure(
    "reject malformed packaged capture receipt",
    "pnpm capture:doctor",
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
    "reject stale packaged capture receipt",
    "pnpm capture:doctor",
    starterDir,
    "does not match the current Playwright",
  );
  writeFileSync(captureReceiptPath, captureReceiptText);
  const parkedCaptureExecutable = `${captureReceipt.browser.executablePath}.automovie-missing`;
  renameSync(captureReceipt.browser.executablePath, parkedCaptureExecutable);
  try {
    runExpectedFailure(
      "diagnose missing packaged capture executable",
      "pnpm capture:doctor",
      starterDir,
      "is missing or differs",
    );
  } finally {
    renameSync(parkedCaptureExecutable, captureReceipt.browser.executablePath);
  }
  run(
    "doctor packaged starter capture runtime",
    "pnpm capture:doctor",
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
  try {
    runExpectedFailure(
      "reject invalid packaged capture config",
      "pnpm capture:doctor",
      starterDir,
      "Invalid capture browser config",
    );
  } finally {
    writeFileSync(captureConfigPath, captureConfigText);
  }
  run("compile packaged starter", "pnpm compile", starterDir);
  // A fresh @ttsc/lint install builds its source plugin with Go once per
  // cache key. Cold Windows and CI caches can legitimately exceed the ordinary
  // five-minute command fence before TypeScript linting itself begins.
  runExpectedFailure(
    "enforce packaged starter lint review gate",
    "pnpm lint",
    starterDir,
    "review-",
    900_000,
  );
  run("test packaged starter", "pnpm test", starterDir);
  runExpectedFailure(
    "enforce packaged starter review gate",
    "pnpm render",
    starterDir,
    "review-",
  );
  writeFileSync(
    join(starterDir, "verify-packaged-starter.mjs"),
    STARTER_VERIFY_SOURCE,
  );
  run(
    "complete packaged starter evidence reviews",
    "node verify-packaged-starter.mjs review",
    starterDir,
  );
  run("lint reviewed packaged starter", "pnpm lint", starterDir, 900_000);
  const renderStateRoot = join(starterDir, ".automovie", "render-job");
  const renderPlanPath = join(renderStateRoot, "plan.json");
  const renderPlanText = readFileSync(renderPlanPath, "utf8");
  const renderPlan = JSON.parse(renderPlanText);
  renderPlan.runtimeIdentity.encoder.version = "0.0.0-stale";
  writeFileSync(renderPlanPath, `${JSON.stringify(renderPlan, null, 2)}\n`);
  try {
    runExpectedFailure(
      "reject stale packaged render runtime identity",
      "pnpm render -- verify",
      starterDir,
      "render runtime identity changed",
    );
  } finally {
    writeFileSync(renderPlanPath, renderPlanText);
  }
  const damagedChunk = renderPlan.chunks[0];
  const retainedChunk = renderPlan.chunks[1];
  if (damagedChunk === undefined || retainedChunk === undefined)
    fail("packaged render did not produce multiple resumable chunks");
  const damagedDirectory = join(
    renderStateRoot,
    "chunks",
    damagedChunk.id.slice(7),
  );
  const damagedReceipt = JSON.parse(
    readFileSync(join(damagedDirectory, "receipt.json"), "utf8"),
  );
  writeFileSync(
    join(damagedDirectory, damagedReceipt.frames[0].path),
    Buffer.alloc(0),
  );
  const retainedMarker = join(
    renderStateRoot,
    "chunks",
    retainedChunk.id.slice(7),
    "reuse-proof.marker",
  );
  writeFileSync(retainedMarker, "must survive fresh-process reuse\n");
  const abandonedPid = 2_147_483_647;
  const abandonedTemporary = join(
    renderStateRoot,
    "tmp",
    `interrupted.${abandonedPid}`,
  );
  mkdirSync(abandonedTemporary, { recursive: true });
  writeFileSync(join(abandonedTemporary, "partial.png"), Buffer.alloc(0));
  const slotSegment = encodeURIComponent(damagedChunk.slot);
  mkdirSync(join(renderStateRoot, "locks"), { recursive: true });
  writeFileSync(
    join(
      renderStateRoot,
      "locks",
      `${slotSegment}.lock.${abandonedPid}.interrupted.candidate`,
    ),
    Buffer.alloc(0),
  );
  writeFileSync(
    join(renderStateRoot, "locks", `${slotSegment}.lock`),
    `${JSON.stringify({ chunk: damagedChunk.id, pid: abandonedPid })}\n`,
  );
  mkdirSync(join(renderStateRoot, "attempts"), { recursive: true });
  writeFileSync(
    join(renderStateRoot, "attempts", `${slotSegment}.json`),
    `${JSON.stringify({
      slot: damagedChunk.slot,
      chunk: damagedChunk.id,
      state: "running",
      correction: "",
      pid: abandonedPid,
    })}\n`,
  );
  run(
    "resume interrupted packaged render through final compile",
    "pnpm render",
    starterDir,
  );
  const quarantine = readdirSync(join(renderStateRoot, "quarantine"));
  if (
    existsSync(retainedMarker) === false ||
    existsSync(join(renderStateRoot, "attempts", `${slotSegment}.json`)) ||
    quarantine.some((entry) => entry.includes("abandoned-partial")) === false ||
    quarantine.some((entry) => entry.includes("abandoned-lock-candidate")) ===
      false ||
    quarantine.some((entry) => entry.includes("abandoned-lock")) === false ||
    quarantine.some((entry) => entry.includes("replaced")) === false
  )
    fail(
      "packaged render did not reuse the current chunk and recover interrupted/corrupt state selectively",
    );
  run(
    "verify packaged starter pixels, final ledger and tamper gate",
    "node verify-packaged-starter.mjs final",
    starterDir,
  );

  console.log(
    "\n✓ e2e:tgz PASSED: packaged MCP surfaces and two-shot production scaffold verified",
  );
} finally {
  if (KEEP_STAGE) console.log(`\nverification stage retained at ${stage}`);
  else rmSync(stage, { recursive: true, force: true, maxRetries: 5 });
}
