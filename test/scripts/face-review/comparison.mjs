import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import { isAbsolute, join, relative, resolve } from "node:path";

import { chromium } from "playwright";

const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
const directory = resolve(process.argv[2] ?? ".shots/face-experiment/preview");
const captureRelative = relative(resolve(".shots/face-experiment"), directory);
if (
  !captureRelative ||
  captureRelative.startsWith("..") ||
  isAbsolute(captureRelative)
)
  throw new Error("Comparison must belong to this capture workspace.");
const record = JSON.parse(
  await fs.readFile(join(directory, "capture.json"), "utf8"),
);
const profileBytes = await fs.readFile(join(directory, "capture-profile.json"));
if (digest(profileBytes) !== record.artifact.profile)
  throw new Error("Preview profile does not match its capture.");
const profile = JSON.parse(profileBytes.toString("utf8"));
if (
  digest(await fs.readFile(join(directory, "configuration.json"))) !==
  record.artifact.configuration
)
  throw new Error("Preview parameters do not match their capture.");
const model = await fs.readFile(join(directory, "portrait.glb"));
if (digest(model) !== record.artifact.gltf)
  throw new Error("Preview model does not match its capture.");
if (digest(await fs.readFile(join(directory, "model.json"))) !== record.artifact.model)
  throw new Error("Preview named model parts do not match their capture.");
for (const frame of record.captures)
  if (digest(await fs.readFile(join(directory, frame.file))) !== frame.sha256)
    throw new Error("Preview frame does not match its capture.");
const expectedNames = [
  "calibration",
  ...profile.views.map((view) => view.name),
  "reference",
  "reference-clay",
  "clay",
  "clay-oblique",
].sort();
if (
  record.captures
    .map((frame) => frame.name)
    .sort()
    .join("/") !== expectedNames.join("/")
)
  throw new Error("Preview capture is incomplete or duplicated.");
const sourcePath = resolve(
  profile.reference.source ??
    ".shots/input/east-asian/generated-korean-girl-01/generated-korean-girl-age-16.png",
);
const sourceRelative = relative(resolve(".shots/input"), sourcePath);
if (
  !sourceRelative ||
  sourceRelative.startsWith("..") ||
  isAbsolute(sourceRelative)
)
  throw new Error(
    "Comparison reference must belong to the supplied input collection.",
  );
const source = await fs.readFile(sourcePath);
if (digest(source) !== record.artifact.input)
  throw new Error("Reference image does not match the capture input.");
const reference = await fs.readFile(join(directory, "reference.png"));
const crop = profile.reference.crop,
  size = 860,
  scale = size / crop.size;
const uri = (bytes) => "data:image/png;base64," + bytes.toString("base64");
const html =
  "<style>body{margin:0;background:#18212b;color:white;font:20px sans-serif}main{display:flex;width:max-content}figure{margin:0;position:relative;width:" +
  size +
  "px;height:" +
  size +
  "px;overflow:hidden}figcaption{position:absolute;z-index:1;top:10px;left:15px;background:#111a;padding:5px}img{display:block}.photo{position:absolute;width:" +
  profile.reference.width * scale +
  "px;left:" +
  -crop.x * scale +
  "px;top:" +
  -crop.y * scale +
  "px}.model{width:" +
  size +
  "px;height:" +
  size +
  'px}</style><main><figure><figcaption>Original reference crop</figcaption><img class="photo" src="' +
  uri(source) +
  '"></figure><figure><figcaption>AutoMovie GLTF ' +
  record.artifact.gltf.slice(0, 8) +
  '</figcaption><img class="model" src="' +
  uri(reference) +
  '"></figure></main>';
const previewBrowser = await chromium.launch({
  channel: "chromium",
  headless: true,
});
try {
  const page = await previewBrowser.newPage({
    viewport: { width: size * 2, height: size },
    deviceScaleFactor: 1,
  });
  await page.setContent(html);
  await page.evaluate(() =>
    Promise.all([...document.images].map((image) => image.decode())),
  );
  await page
    .locator("main")
    .screenshot({ path: join(directory, "comparison.png") });
  for (const [name, views] of [
    ["views", profile.views.map((view) => view.name)],
    ["clay-views", ["reference-clay", "clay", "clay-oblique"]],
  ]) {
    const frames = await Promise.all(
      views.map(
        async (view) =>
          '<figure><img src="' +
          uri(await fs.readFile(join(directory, view + ".png"))) +
          '"><figcaption>' +
          view +
          " / " +
          record.artifact.gltf.slice(0, 8) +
          "</figcaption></figure>",
      ),
    );
    await page.setContent(
      "<style>body{margin:0;background:#101820;color:#eee;font:18px sans-serif}main{display:grid;width:max-content;grid-template-columns:repeat(3,450px)}figure{margin:0;position:relative;width:450px;height:500px}img{display:block;width:450px;height:500px;object-fit:contain}figcaption{position:absolute;top:6px;left:10px;background:#111b;padding:3px 7px}</style><main>" +
        frames.join("") +
        "</main>",
    );
    await page.evaluate(() =>
      Promise.all([...document.images].map((image) => image.decode())),
    );
    await page
      .locator("main")
      .screenshot({ path: join(directory, name + ".png") });
  }
} finally {
  await previewBrowser.close();
}
await fs.writeFile(
  join(directory, "comparison.json"),
  JSON.stringify(
    {
      inputSha256: record.artifact.input,
      gltfSha256: record.artifact.gltf,
      profileSha256: record.artifact.profile,
      referencePngSha256: digest(reference),
      comparisonPngSha256: digest(
        await fs.readFile(join(directory, "comparison.png")),
      ),
      viewsPngSha256: digest(await fs.readFile(join(directory, "views.png"))),
      clayViewsPngSha256: digest(
        await fs.readFile(join(directory, "clay-views.png")),
      ),
      createdAt: new Date().toISOString(),
      review: "not automatically supplied",
    },
    null,
    2,
  ),
);
console.log("Verified comparison for GLTF " + record.artifact.gltf);
