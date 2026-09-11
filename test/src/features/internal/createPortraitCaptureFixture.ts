import { createHash } from "node:crypto";

import { IPortraitCaptureBytes } from "../../subjects/portraitCaptureDiagnostic";

/** In-memory receipt with distinct byte populations and a source-pixel crop. */
export function createPortraitCaptureFixture() {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value));
  const digest = (bytes: Uint8Array) =>
    createHash("sha256").update(bytes).digest("hex");
  const profile = {
    reference: { width: 40, height: 30, crop: { x: 10, y: 0, size: 30 } },
    views: [{ name: "front" }, { name: "back" }],
    measurement: { origin: [12, -4], millimetersPerPixel: 0.5 },
  };
  const bytes: IPortraitCaptureBytes = {
    receipt: Buffer.alloc(0),
    profile: encode(profile),
    model: encode({ parts: [] }),
    configuration: encode({ width: 1 }),
    gltf: Buffer.from("independent geometry"),
    reference: Buffer.from("captured source-pose pixels"),
    input: Buffer.from("original source pixels"),
  };
  const receipt = {
    artifact: {
      input: digest(bytes.input),
      model: digest(bytes.model),
      configuration: digest(bytes.configuration),
      gltf: digest(bytes.gltf),
      profile: digest(bytes.profile),
    },
    renderer: { version: "one", engine: "inspection" },
    captures: [
      "calibration",
      "front",
      "back",
      "reference",
      "reference-clay",
      "clay",
      "clay-oblique",
    ].map((name) => ({
      name,
      file: name + ".png",
      sha256: digest(bytes.reference),
    })),
  };
  const seal = () => {
    bytes.profile = encode(profile);
    receipt.artifact.profile = digest(bytes.profile);
    bytes.receipt = encode(receipt);
  };
  seal();
  return {
    bytes,
    profile,
    receipt,
    seal,
    expected: {
      input: receipt.artifact.input,
      measurement: structuredClone(profile.measurement),
    },
  };
}
