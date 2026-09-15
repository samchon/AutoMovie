import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

import { humanFaceStudyDocuments } from "../../../test/studies/human-face/studies";
import { mountHumanFacePanel } from "./human/panel";
import { createHumanViewport } from "./human/viewport";
import { createHumanPreviewWorkerPort } from "./human/workerPort";

const subjects = Object.entries(humanFaceStudyDocuments)
  .map(([id, document]) => ({ id, read: async () => JSON.stringify(document) }))
  .sort((a, b) => a.id.localeCompare(b.id));
let viewport!: ReturnType<typeof createHumanViewport>;
const panel = mountHumanFacePanel(
  document.querySelector<HTMLDivElement>("#app")!,
  {
    subjects,
    initialSubjectId: "generated-korean-girl-01",
    viewport: (canvas) => {
      const loader = new GLTFLoader();
      return (viewport = createHumanViewport({
        canvas,
        pixelRatio: devicePixelRatio,
        renderer: new THREE.WebGLRenderer({
          canvas,
          antialias: true,
          preserveDrawingBuffer: true,
        }),
        orbit: (camera) => new OrbitControls(camera, canvas),
        worker: () =>
          createHumanPreviewWorkerPort(
            new Worker(new URL("./human-worker.ts", import.meta.url), {
              type: "module",
            }),
          ),
        decode: async (bytes) => (await loader.parseAsync(bytes, "")).scene,
        observeResize: (resize) => {
          new ResizeObserver(resize).observe(canvas);
        },
      }));
    },
    download: (filename, bytes, mime) => {
      const url = URL.createObjectURL(new Blob([bytes], { type: mime }));
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    },
  },
);
Object.assign(window, {
  __humanFace: {
    snapshot: panel.snapshot,
    document: () => panel.snapshot()?.document,
    camera: viewport.cameraView,
    finish: viewport.finish,
    renderer: viewport.renderer,
  },
});
void panel.ready;
