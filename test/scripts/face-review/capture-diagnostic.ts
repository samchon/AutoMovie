import fs from "node:fs/promises";
import path from "node:path";

import { referenceControlNet } from "../../src/subjects/generated-korean-girl-01/controlNet";
import {
  IPortraitCaptureBytes,
  inspectPortraitCapture,
  runPortraitCaptureDiagnostic,
} from "../../src/subjects/portraitCaptureDiagnostic";

/**
 * The publisher and diagnostic writers share one exclusive-create lease. Node's
 * wx and .NET's CreateNew both refuse an existing file, including a lease left
 * by an interrupted diagnostic. Inspect its owner before manually removing a
 * stale lease; silently stealing one would reopen the publication race.
 */
export async function withPortraitCapture<T>(props: {
  observe: (capture: ReturnType<typeof inspectPortraitCapture>) => Promise<T>;
  publish: (result: T, generation: string) => Promise<void>;
}): Promise<T> {
  const root = path.resolve(__dirname, "../../.."),
    captureRoot = path.join(root, ".shots/face-experiment"),
    preview = path.join(captureRoot, "preview"),
    lock = path.join(captureRoot, "preview.lock");
  return runPortraitCaptureDiagnostic({
    expected: {
      input: referenceControlNet.inputSha256,
      measurement: referenceControlNet.captureBasis,
    },
    acquire: async () => {
      const handle = await fs.open(lock, "wx");
      return async () => {
        await handle.close();
        await fs.unlink(lock);
      };
    },
    read: async () => {
      const entries = await Promise.all(
        Object.entries({
          receipt: path.join(preview, "capture.json"),
          profile: path.join(preview, "capture-profile.json"),
          model: path.join(preview, "model.json"),
          configuration: path.join(preview, "configuration.json"),
          gltf: path.join(preview, "portrait.glb"),
          reference: path.join(preview, "reference.png"),
          input: path.join(
            root,
            ".shots/input/east-asian/generated-korean-girl-01/generated-korean-girl-age-16.png",
          ),
        }).map(async ([name, file]) => [name, await fs.readFile(file)]),
      );
      return Object.fromEntries(entries) as IPortraitCaptureBytes;
    },
    observe: props.observe,
    publish: props.publish,
  });
}
