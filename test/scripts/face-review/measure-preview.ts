import type { IAutoMovieModel } from "@automovie/interface";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";

import { referenceControlNet } from "../../src/subjects/generated-korean-girl-01/controlNet";
import { withPortraitCapture } from "./capture-diagnostic";

interface Observation {
  width: number;
  height: number;
  result: { faceLandmarks: { x: number; y: number; z: number }[][] };
}

/**
 * Observe the actual captured reference frame with the existing local detector.
 * This writes a separate diagnostic; it never replaces the frozen anatomical
 * fitting input. Pixel widths/heights are detector estimates, not mesh witnesses
 * or a likeness verdict. The synthetic-image domain can bias the observations.
 *
 * Requires the measurement setup recorded in the subject NOTICE: the local
 * measure.html, vision_bundle.mjs and face_landmarker.task. Their exact hashes
 * and the browser version are recorded. Image bytes are frozen before inference;
 * an intervening preview replacement refuses publication of stale observations.
 */
async function main(): Promise<void> {
  const root = process.cwd(),
    preview = path.join(root, ".shots/face-experiment/preview");
  const digest = (bytes: Uint8Array) =>
    createHash("sha256").update(bytes).digest("hex");
  await withPortraitCapture({
    observe: async ({ receipt, profile, bytes: captured }) => {
      const bytes = Buffer.from(captured.reference);
      const provenance: Record<string, string> = {};
      const setup = path.join(root, ".references/face-measurement");
      for (const file of [
        "measure.html",
        "vision_bundle.mjs",
        "face_landmarker.task",
      ])
        provenance[file] = digest(await fs.readFile(path.join(setup, file)));
      const browser = await chromium.launch({
        channel: "chromium",
        headless: true,
        args: ["--allow-file-access-from-files"],
      });
      try {
        const page = await browser.newPage();
        await page.goto(pathToFileURL(path.join(setup, "measure.html")).href);
        await page.waitForFunction(
          () => Boolean((window as unknown as { ready: boolean }).ready),
          null,
          { timeout: 60000 },
        );
        const observation = await page.evaluate(
          (url) =>
            (
              window as unknown as {
                measurePortrait: (url: string) => Promise<Observation>;
              }
            ).measurePortrait(url),
          "data:image/png;base64," + bytes.toString("base64"),
        );
        const points = observation.result.faceLandmarks;
        if (
          points.length !== 1 ||
          points[0].length !== 478 ||
          points[0].some((p) => ![p.x, p.y, p.z].every(Number.isFinite))
        )
          throw new Error(
            "The detector must return one finite 478-point observation.",
          );
        const {
          rotation: r,
          origin,
          millimetersPerPixel: s,
        } = referenceControlNet.captureBasis;
        const project = (p: number[]) => {
          const q = p.map((v, a) => v - [0, 28, 60][a]);
          return [
            (r[0] * q[0] + r[1] * q[1] + r[2] * q[2]) / s + origin[0],
            -(r[3] * q[0] + r[4] * q[1] + r[5] * q[2]) / s - origin[1],
          ];
        };
        const target = referenceControlNet.positions.map(project);
        // The reference render covers the declared source crop, regardless of its
        // output resolution. Work in source-image pixels, not contact-sheet pixels.
        const crop = profile.reference.crop;
        const current = points[0].map((p) => [
          crop.x + p.x * crop.size,
          crop.y + p.y * crop.size,
        ]);
        const modelBytes = Buffer.from(captured.model);
        const model: IAutoMovieModel = JSON.parse(modelBytes.toString());
        // Detector boundaries can follow a skin roll instead of the visible hole.
        // Compare them with the actual named scleral boundary as a second, distinct
        // diagnostic. Its geometric projection does not include optical refraction.
        const meshApertures = [];
        for (const [side, contour] of [
          [
            "right",
            [
              33, 246, 161, 160, 159, 158, 157, 173, 133, 155, 154, 153, 145,
              144, 163, 7,
            ],
          ],
          [
            "left",
            [
              362, 398, 384, 385, 386, 387, 388, 466, 263, 249, 390, 373, 374,
              380, 381, 382,
            ],
          ],
        ] as const) {
          const part = model.parts.find((p) => p.id === side + "-sclera");
          if (
            part?.geometry.type !== "mesh" ||
            part.geometry.mesh.indices === null
          )
            throw new Error(
              "Aperture inspection requires named indexed sclera meshes.",
            );
          const mesh = part.geometry.mesh,
            edges = new Map<string, { a: number; b: number; count: number }>();
          for (let i = 0; i < mesh.indices!.length; i += 3)
            for (let j = 0; j < 3; j++) {
              const a = mesh.indices![i + j],
                b = mesh.indices![i + ((j + 1) % 3)],
                key = Math.min(a, b) + "/" + Math.max(a, b);
              const edge = edges.get(key);
              if (edge === undefined) edges.set(key, { a, b, count: 1 });
              else edge.count++;
            }
          const boundary = [
            ...new Set(
              [...edges.values()]
                .filter((e) => e.count === 1)
                .flatMap((e) => [e.a, e.b]),
            ),
          ];
          if (boundary.length === 0)
            throw new Error("Named sclera must expose an aperture boundary.");
          const projected = boundary.map((id) =>
            project(
              mesh.positions
                .slice(3 * id, 3 * id + 3)
                .map((v) => 1000 * Math.fround(v)),
            ),
          );
          const a = target[contour[0]],
            b = target[contour[8]],
            length = Math.hypot(b[0] - a[0], b[1] - a[1]),
            axis = [(b[0] - a[0]) / length, (b[1] - a[1]) / length];
          const extent = (points: number[][]) => {
            const x = points.map((p) => p[0] * axis[0] + p[1] * axis[1]),
              y = points.map((p) => -p[0] * axis[1] + p[1] * axis[0]);
            return {
              width: Math.max(...x) - Math.min(...x),
              height: Math.max(...y) - Math.min(...y),
            };
          };
          meshApertures.push({
            side,
            target: extent(contour.map((id) => target[id])),
            geometry: extent(projected),
            detector: extent(contour.map((id) => current[id])),
          });
        }
        const measures = (p: number[][]) => {
          const distance = (a: number, b: number) =>
            Math.hypot(p[a][0] - p[b][0], p[a][1] - p[b][1]);
          const opening = (
            a: number,
            b: number,
            top: number,
            bottom: number,
          ) => {
            const x = p[b][0] - p[a][0],
              y = p[b][1] - p[a][1];
            return (
              Math.abs(
                x * (p[top][1] - p[bottom][1]) - y * (p[top][0] - p[bottom][0]),
              ) / Math.hypot(x, y)
            );
          };
          return {
            rightEyeWidth: distance(33, 133),
            leftEyeWidth: distance(362, 263),
            rightEyeOpening: opening(33, 133, 159, 145),
            leftEyeOpening: opening(362, 263, 386, 374),
            rightIrisDiameter: (distance(469, 471) + distance(470, 472)) / 2,
            leftIrisDiameter: (distance(474, 476) + distance(475, 477)) / 2,
            mouthWidth: distance(61, 291),
            mouthOpening: opening(61, 291, 13, 14),
            nasalWidth: distance(98, 327),
            faceWidth: distance(234, 454),
          };
        };
        const expected = measures(target),
          observed = measures(current);
        if (Object.values(observed).some((v) => !Number.isFinite(v) || v <= 0))
          throw new Error("The observed feature dimensions are degenerate.");
        const metrics = Object.entries(expected).map(([name, value]) => ({
          name,
          targetPixels: value,
          observedPixels: observed[name as keyof typeof observed],
          targetToObserved: value / observed[name as keyof typeof observed],
        }));
        console.log(JSON.stringify({ metrics, meshApertures }, null, 2));
        return {
          artifact: receipt.artifact,
          imageSha256: digest(bytes),
          provenance,
          browser: browser.version(),
          width: observation.width,
          height: observation.height,
          metrics,
          meshApertures,
          landmarks: points[0],
          interpretation:
            "Detector estimates on a synthetic frame; manual feature review required.",
          runtimeProvenance:
            "Local setup files and browser version are recorded. The setup also loads remote versioned MediaPipe WASM; its response bytes are not pinned by this diagnostic.",
        };
      } finally {
        await browser.close();
      }
    },
    publish: async (result, generation) => {
      await fs.writeFile(
        path.join(preview, "landmark-observation.json"),
        JSON.stringify({ ...result, captureSha256: generation }, null, 2),
      );
    },
  });
}
void main();
