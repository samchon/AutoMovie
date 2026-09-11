import { validateModel } from "@automovie/engine";
import { NodeIO } from "@gltf-transform/core";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";

import { portraitCaptureProfile } from "../../src/subjects/captureProfile";
import { referenceControlNet } from "../../src/subjects/generated-korean-girl-01/controlNet";
import {
  portraitDocument,
  portraitGltfExtensions,
} from "../../src/subjects/portraitDocument";
import basis from "../../src/subjects/reference-anatomy/mesh.json";
import {
  anatomicalStudyShape,
  buildAnatomicalStudy,
} from "../../src/subjects/reference-anatomy/model";

/** Export a separately labelled reference basis without replacing the target preview. */
async function main(): Promise<void> {
  const directory = ".shots/face-experiment/surface-study";
  const model = buildAnatomicalStudy(anatomicalStudyShape);
  const validation = validateModel({ model });
  if (!validation.success) throw new Error(JSON.stringify(validation));
  await fs.mkdir(directory, { recursive: true });
  const io = new NodeIO().registerExtensions(portraitGltfExtensions),
    doc = portraitDocument(model);
  await io.write(directory + "/portrait.glb", doc);
  await io.write(directory + "/portrait.gltf", doc);
  const profile = JSON.stringify(
    {
      ...portraitCaptureProfile,
      measurement: referenceControlNet.captureBasis,
    },
    null,
    2,
  );
  const configuration = JSON.stringify(
    {
      study: "Unfitted anatomical reference, not accepted target likeness",
      shape: anatomicalStudyShape,
      provenance: basis.provenance,
    },
    null,
    2,
  );
  const packed = JSON.stringify(model),
    digest = (bytes: string | Uint8Array) =>
      createHash("sha256").update(bytes).digest("hex");
  await fs.writeFile(directory + "/model.json", packed);
  await fs.writeFile(directory + "/capture-profile.json", profile);
  await fs.writeFile(directory + "/configuration.json", configuration);
  await fs.writeFile(
    directory + "/artifact-basis.json",
    JSON.stringify(
      {
        input: referenceControlNet.inputSha256,
        model: digest(packed),
        gltf: digest(await fs.readFile(directory + "/portrait.glb")),
        profile: digest(profile),
        configuration: digest(configuration),
      },
      null,
      2,
    ),
  );
  console.log(
    "Exported labelled anatomical reference",
    model.parts.length,
    "parts",
  );
}
void main();
