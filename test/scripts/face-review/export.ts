import { validateModel } from "@automovie/engine";
import { NodeIO } from "@gltf-transform/core";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";

import { portraitCaptureProfile } from "../../src/subjects/captureProfile";
import {
  portraitNasalRelief,
  portraitOrbitalRelief,
  portraitPerioralRelief,
} from "../../src/subjects/generated-korean-girl-01/anatomy";
import {
  portraitAssembly,
  portraitCheekShape,
  portraitCheekSockets,
  portraitDentalPlacement,
  portraitDentalRow,
  portraitDentalSocket,
  portraitEyeShape,
  portraitMouthShape,
  portraitNasalSupportDetail,
  portraitNoseShape,
  portraitNoseSocket,
  portraitOrbitalSupportShapes,
} from "../../src/subjects/generated-korean-girl-01/configuration";
import { referenceControlNet } from "../../src/subjects/generated-korean-girl-01/controlNet";
import { portraitNeckShape } from "../../src/subjects/generated-korean-girl-01/cranium";
import { portraitEarShape } from "../../src/subjects/generated-korean-girl-01/ears";
import { buildReferencePortrait } from "../../src/subjects/generated-korean-girl-01/model";
import {
  portraitDocument,
  portraitGltfExtensions,
} from "../../src/subjects/portraitDocument";

async function main() {
  await fs.mkdir(".shots/face-experiment", { recursive: true });
  const start = performance.now();
  const model = buildReferencePortrait(portraitAssembly);
  const validation = validateModel({ model });
  if (!validation.success) throw new Error(JSON.stringify(validation));
  console.log(
    "build",
    performance.now() - start,
    "ms",
    model.parts.length,
    "parts",
  );
  const doc = portraitDocument(model);
  const io = new NodeIO().registerExtensions(portraitGltfExtensions);
  await io.write(".shots/face-experiment/portrait.glb", doc);
  await io.write(".shots/face-experiment/portrait.gltf", doc);
  await fs.writeFile(
    ".shots/face-experiment/model.json",
    JSON.stringify(model),
  );
  const profile = JSON.stringify(
    {
      ...portraitCaptureProfile,
      measurement: referenceControlNet.captureBasis,
    },
    null,
    2,
  );
  await fs.writeFile(".shots/face-experiment/capture-profile.json", profile);
  const digest = (bytes: string | Uint8Array) =>
    createHash("sha256").update(bytes).digest("hex");
  const configuration = JSON.stringify(
    {
      foundation: "measured",
      rightEye: portraitEyeShape,
      leftEye: portraitEyeShape,
      nose: portraitNoseShape,
      noseSocket: portraitNoseSocket,
      nasalConstruction: "procedural",
      mouth: { ...portraitMouthShape, crowns: [] },
      ears: portraitEarShape,
      nasalDetail: portraitNasalSupportDetail ?? null,
      nasalRelief: portraitNasalRelief,
      orbitalRelief: portraitOrbitalRelief,
      upperOrbitalSupport: portraitOrbitalSupportShapes,
      perioralRelief: portraitPerioralRelief,
      cheeks: {
        right: portraitCheekShape,
        left: portraitCheekShape,
        sockets: portraitCheekSockets,
      },
      hairProxy: true,
      dental: {
        row: portraitDentalRow,
        socket: portraitDentalSocket,
        placement: portraitDentalPlacement,
      },
      neck: portraitNeckShape,
      subdivisionRounds: portraitAssembly.subdivisionRounds,
    },
    null,
    2,
  );
  await fs.writeFile(
    ".shots/face-experiment/configuration.json",
    configuration,
  );
  await fs.writeFile(
    ".shots/face-experiment/artifact-basis.json",
    JSON.stringify(
      {
        input: referenceControlNet.inputSha256,
        model: digest(JSON.stringify(model)),
        gltf: digest(await fs.readFile(".shots/face-experiment/portrait.glb")),
        profile: digest(profile),
        configuration: digest(configuration),
      },
      null,
      2,
    ),
  );
  console.log("exported", doc.getRoot().listMeshes().length, "material groups");
}
void main();
