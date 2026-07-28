import type {
  IAutoMoviePreviewFrameOutput,
  IAutoMovieProductionRenderManifest,
} from "@automovie/interface";
import {
  AutoMovieApplication,
  AutoMovieProductionProject,
  digestAutoMovieBytes,
  encodeAutoMoviePathSegment,
} from "@automovie/mcp";
import path from "node:path";

import { film } from "../src/film";
import { captureProductionFrame, closeProductionFrameCapture } from "./capture";

const root = process.cwd();
const app = new AutoMovieApplication({
  projectRoot: root,
  capture: captureProductionFrame,
});
app.getGuideDocument({ name: "AUTOMOVIE_OVERALL" });
app.getGuideDocument({ name: "COMPILATION" });
app.getGuideDocument({ name: "PRODUCTION_RENDER" });
app.openProject({ root });

try {
  const compiled = app.compileProject({ scope: "source" });
  if (compiled.success === false) {
    process.stdout.write(`${JSON.stringify({ compiled }, null, 2)}\n`);
    process.exitCode = 1;
  } else {
    const project = AutoMovieProductionProject.open(root);
    const graph = project.graph();
    if (graph.production === null)
      throw new Error(
        "Production design disappeared after source compilation.",
      );

    const ordered: readonly string[] = [...film];
    if (
      new Set(ordered).size !== ordered.length ||
      ordered.some((shot) => graph.shots.has(shot) === false) ||
      [...graph.shots.keys()].some((shot) => ordered.includes(shot) === false)
    )
      throw new Error(
        "src/film.ts must list every current shot contract exactly once in finished-film order.",
      );

    const frames: IAutoMoviePreviewFrameOutput[] = [];
    for (const shotId of ordered) {
      const contract = graph.shots.get(shotId)!;
      const requests =
        contract.reviewFrames.length === 0
          ? [{ id: "opening", time: 0, passes: ["beauty" as const] }]
          : contract.reviewFrames;
      for (const request of requests)
        for (const pass of request.passes)
          frames.push(
            await app.previewFrame({
              target: { kind: "shot", id: shotId },
              time: request.time,
              pass,
            }),
          );
    }

    const failedFrames = frames.filter((frame) => frame.captured === false);
    const captured = frames.filter(
      (
        frame,
      ): frame is IAutoMoviePreviewFrameOutput & {
        frame: NonNullable<IAutoMoviePreviewFrameOutput["frame"]>;
      } => frame.captured && frame.frame !== null,
    );
    const outputProject = AutoMovieProductionProject.open(root);
    const renderManifest: IAutoMovieProductionRenderManifest = {
      version: 1,
      compileFingerprint: compiled.compiler.inputFingerprint,
      deliverables: [],
    };
    const unsupportedRequired: string[] = [];
    for (const deliverable of graph.production.deliverables) {
      if (deliverable.kind !== "preview") {
        if (deliverable.required)
          unsupportedRequired.push(`${deliverable.id}:${deliverable.kind}`);
        continue;
      }
      const files = new Map<string, Uint8Array>();
      for (const output of captured) {
        const sourcePath = path.relative(
          outputProject.renderRoot(),
          path.resolve(root, output.frame.path),
        );
        const relative = [
          encodeAutoMoviePathSegment(output.renderBundle ?? "bundle"),
          path.basename(output.frame.path),
        ].join("/");
        files.set(relative, outputProject.readRenderFile(sourcePath));
      }
      if (files.size === 0) continue;
      const committed = outputProject.commitProductionDeliverableFiles(
        deliverable.id,
        files,
      );
      renderManifest.deliverables.push({
        id: deliverable.id,
        kind: deliverable.kind,
        files: committed.paths.map((file) => {
          const bytes = outputProject.readRenderFile(file);
          return {
            path: file,
            digest: digestAutoMovieBytes(bytes),
            bytes: bytes.length,
            mediaType: "image/png",
          };
        }),
        runtimeSeconds: null,
        frameCount: committed.paths.length,
        codec: null,
      });
    }
    outputProject.commitProductionRenderManifest(renderManifest);

    const finalApp = new AutoMovieApplication({
      projectRoot: root,
      capture: captureProductionFrame,
    });
    finalApp.getGuideDocument({ name: "AUTOMOVIE_OVERALL" });
    finalApp.getGuideDocument({ name: "COMPILATION" });
    finalApp.openProject({ root });
    const final = finalApp.compileProject({ scope: "final" });
    process.stdout.write(
      `${JSON.stringify(
        {
          compiled,
          frames,
          renderManifest,
          unsupportedRequired,
          final,
        },
        null,
        2,
      )}\n`,
    );
    if (
      failedFrames.length !== 0 ||
      unsupportedRequired.length !== 0 ||
      final.success === false
    )
      process.exitCode = 1;
  }
} finally {
  await closeProductionFrameCapture();
}
