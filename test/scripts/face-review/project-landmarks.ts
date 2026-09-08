import { NodeIO } from "@gltf-transform/core";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

import { portraitAssembly } from "../../src/subjects/generated-korean-girl-01/configuration";
import { referenceControlNet } from "../../src/subjects/generated-korean-girl-01/controlNet";
import { buildPortraitHead } from "../../src/subjects/generated-korean-girl-01/head";
import { buildReferencePortrait } from "../../src/subjects/generated-korean-girl-01/model";
import {
  portraitDocument,
  portraitGltfExtensions,
} from "../../src/subjects/portraitDocument";
import { withPortraitCapture } from "./capture-diagnostic";

// This is a labelled projection diagnostic over existing images, not another
// beauty render or an automatic likeness verdict. It leaves the source PNGs
// unchanged and refuses a model that differs from the currently captured GLB.
async function main(): Promise<void> {
  const root = path.resolve(__dirname, "../../..");
  const preview = path.join(root, ".shots/face-experiment/preview");
  await withPortraitCapture({
    observe: async ({ receipt, profile, bytes: captured }) => {
      const bytes = await new NodeIO()
        .registerExtensions(portraitGltfExtensions)
        .writeBinary(
          portraitDocument(buildReferencePortrait(portraitAssembly)),
        );
      if (
        createHash("sha256").update(bytes).digest("hex") !==
        receipt.artifact.gltf
      )
        throw new Error(
          "Projection diagnostic needs the captured construction revision.",
        );
      const head = buildPortraitHead(
        referenceControlNet,
        portraitAssembly.components,
        portraitAssembly.subdivisionRounds,
        portraitAssembly.surfaceLayers,
      );
      const {
        rotation: r,
        origin,
        millimetersPerPixel: s,
      } = referenceControlNet.captureBasis;
      const project = (point: number[]) => {
        const q = point.map((value, axis) => value - [0, 28, 60][axis]);
        return [
          (r[0] * q[0] + r[1] * q[1] + r[2] * q[2]) / s + origin[0],
          -(r[3] * q[0] + r[4] * q[1] + r[5] * q[2]) / s - origin[1],
        ];
      };
      const records = [
        1, 4, 5, 6, 168, 98, 327, 13, 14, 152, 61, 291, 92, 322, 186, 410, 57,
        287,
      ].map((id) => ({
        id,
        reference: project(referenceControlNet.positions[id]),
        current: project(head.refined.positions[id]),
      }));
      const source = captured.input;
      const render = captured.reference;
      const image = (bytes: Uint8Array) =>
        "data:image/png;base64," + Buffer.from(bytes).toString("base64");
      const crop = profile.reference.crop,
        size = 860,
        scale = size / crop.size;
      const marks = (key: "reference" | "current") =>
        records
          .map((record) => {
            const [x, y] = record[key];
            return `<i style="left:${(x - crop.x) * scale}px;top:${(y - crop.y) * scale}px"><b>${record.id}</b></i>`;
          })
          .join("");
      const browser = await chromium.launch({
        channel: "chromium",
        headless: true,
      });
      try {
        const page = await browser.newPage({
          viewport: { width: 1720, height: 860 },
          deviceScaleFactor: 1,
        });
        await page.setContent(
          `<style>body{margin:0}main{display:flex}figure{position:relative;overflow:hidden;width:860px;height:860px;margin:0}img{position:absolute}i{position:absolute;width:8px;height:8px;border:2px solid cyan;border-radius:50%;transform:translate(-50%,-50%)}b{position:absolute;left:10px;top:-8px;background:#111c;color:cyan;font:14px sans-serif}figcaption{position:absolute;top:8px;left:8px;color:white;background:#111c;padding:5px;font:18px sans-serif}</style><main><figure><img style="width:${profile.reference.width * scale}px;left:${-crop.x * scale}px;top:${-crop.y * scale}px" src="${image(source)}">${marks("reference")}<figcaption>Source landmarks</figcaption></figure><figure><img style="width:860px;height:860px" src="${image(render)}">${marks("current")}<figcaption>Projected mesh witnesses / ${receipt.artifact.gltf.slice(0, 8)}</figcaption></figure></main>`,
        );
        await page.evaluate(() =>
          Promise.all([...document.images].map((image) => image.decode())),
        );
        const png = await page.locator("main").screenshot();
        return { png, records, gltfSha256: receipt.artifact.gltf };
      } finally {
        await browser.close();
      }
    },
    publish: async ({ png, records, gltfSha256 }, generation) => {
      // Write the receipt last and bind it to the PNG. A process failure can leave
      // an incomplete diagnostic pair, which must fail its byte-identity check.
      await fs.writeFile(path.join(preview, "landmarks.png"), png);
      await fs.writeFile(
        path.join(preview, "landmarks.json"),
        JSON.stringify(
          {
            gltfSha256,
            captureSha256: generation,
            pngSha256: createHash("sha256").update(png).digest("hex"),
            records,
            review: "not automatically supplied",
          },
          null,
          2,
        ),
      );
    },
  });
}
void main();
