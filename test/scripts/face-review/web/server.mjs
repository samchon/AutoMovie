import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { verifyPortraitWebBasis } from "./logic.mjs";
import { startPortraitWatch } from "./watch.mjs";

const directory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(directory, "../../../..");
const captureRoot = await fs.realpath(
  path.join(root, ".shots/face-experiment"),
);
const source = await fs.realpath(
  path.resolve(root, process.argv[3] ?? ".shots/face-experiment"),
);
const relativeSource = path.relative(captureRoot, source);
if (relativeSource.startsWith("..") || path.isAbsolute(relativeSource))
  throw new Error("Source must be inside .shots/face-experiment.");
const reference = path.join(
  root,
  ".shots/input/east-asian/generated-korean-girl-01/generated-korean-girl-age-16.png",
);
const three = path.join(root, "packages/viewer/node_modules/three");
const logic = await fs.readFile(path.join(directory, "logic.mjs"), "utf8");
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
// An exact allowlist avoids exposing repository files, parent paths or node_modules.
const routes = new Map([
  ["/", [path.join(directory, "index.html"), "text/html"]],
  ["/app.mjs", [path.join(directory, "app.mjs"), "text/javascript"]],
  ["/style.css", [path.join(directory, "style.css"), "text/css"]],
  [
    "/three.module.js",
    [path.join(three, "build/three.module.js"), "text/javascript"],
  ],
  [
    "/OrbitControls.js",
    [
      path.join(three, "examples/jsm/controls/OrbitControls.js"),
      "text/javascript",
    ],
  ],
  ["/reference.png", [reference, "image/png"]],
]);
const assets = new Map(
  await Promise.all(
    [...routes].map(async ([address, [file, type]]) => [
      address,
      { bytes: await fs.readFile(file), type },
    ]),
  ),
);
const runtime = Object.fromEntries(
  [...assets]
    .filter(([name]) => name !== "/reference.png")
    .map(([name, asset]) => [name, digest(asset.bytes)]),
);
runtime["/logic.mjs"] = digest(logic);

async function snapshot() {
  const files = {
    model: "model.json",
    gltf: "portrait.glb",
    profile: "capture-profile.json",
    configuration: "configuration.json",
  };
  const basisBytes = await fs.readFile(
    path.join(source, "artifact-basis.json"),
  );
  const artifact = JSON.parse(basisBytes);
  const entries = await Promise.all(
    Object.entries(files).map(async ([key, file]) => [
      key,
      await fs.readFile(path.join(source, file)),
    ]),
  );
  const bytes = Object.fromEntries(entries);
  const actual = Object.fromEntries(
    entries.map(([key, value]) => [key, digest(value)]),
  );
  actual.input = digest(assets.get("/reference.png").bytes);
  verifyPortraitWebBasis(artifact, actual);
  return JSON.stringify({
    model: JSON.parse(bytes.model),
    profile: JSON.parse(bytes.profile),
    artifact,
    basisSha256: digest(basisBytes),
    runtime,
    source: path
      .relative(root, path.join(source, "model.json"))
      .replaceAll(path.sep, "/"),
  });
}

const port = Number(process.argv[2] ?? 8766);
if (!Number.isInteger(port) || port < 1024 || port > 65535)
  throw new Error("Port must be an integer from 1024 to 65535.");
let build = { state: "idle", message: "Reading frozen exports." };
if (process.argv[4] !== undefined && process.argv[4] !== "--no-watch")
  throw new Error("Unknown server option.");
const closeWatcher =
  relativeSource === "" && process.argv[4] !== "--no-watch"
    ? await startPortraitWatch(root, (status) => {
        build = status;
      })
    : () => {};
const server = http
  .createServer(async (request, response) => {
    response.setHeader("Cache-Control", "no-store");
    response.setHeader("X-Content-Type-Options", "nosniff");
    try {
      if (
        request.headers.host !== `127.0.0.1:${port}` &&
        request.headers.host !== `localhost:${port}`
      ) {
        response.writeHead(403).end("Local host required.");
        return;
      }
      if (request.method !== "GET") {
        response.writeHead(405, { Allow: "GET" }).end();
        return;
      }
      const address = new URL(request.url, `http://127.0.0.1:${port}`).pathname;
      if (address === "/snapshot") {
        const body = await snapshot();
        response
          .writeHead(200, { "Content-Type": "application/json" })
          .end(body);
      } else if (address === "/status") {
        const basisSha256 = digest(
          await fs.readFile(path.join(source, "artifact-basis.json")),
        );
        response
          .writeHead(200, { "Content-Type": "application/json" })
          .end(JSON.stringify({ basisSha256, build }));
      } else if (address === "/logic.mjs") {
        response
          .writeHead(200, { "Content-Type": "text/javascript" })
          .end(logic);
      } else if (assets.has(address)) {
        const { bytes, type } = assets.get(address);
        response.writeHead(200, { "Content-Type": type }).end(bytes);
      } else response.writeHead(404).end("Not found.");
    } catch (error) {
      response
        .writeHead(409, { "Content-Type": "text/plain" })
        .end(error.message);
    }
  })
  .listen(port, "127.0.0.1", () =>
    console.log(`Face workbench http://127.0.0.1:${port}`),
  );
server.on("close", closeWatcher);
server.on("error", (error) => {
  closeWatcher();
  console.error(error);
  process.exitCode = 1;
});
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => {
    closeWatcher();
    server.close();
  });
