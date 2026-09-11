import { createHash } from "node:crypto";

/** Exact bytes consumed by a source-pose diagnostic, read under its lease. */
export interface IPortraitCaptureBytes {
  receipt: Uint8Array;
  profile: Uint8Array;
  model: Uint8Array;
  configuration: Uint8Array;
  gltf: Uint8Array;
  reference: Uint8Array;
  input: Uint8Array;
}

/** The capture receipt binds geometry, configuration, source and rendered pixels. */
export interface IPortraitCaptureReceipt {
  artifact: Record<
    "input" | "model" | "configuration" | "gltf" | "profile",
    string
  >;
  captures: { name: string; file: string; sha256: string }[];
}

/** Only the profile fields consumed by these diagnostics are interpreted here. */
export interface IPortraitDiagnosticProfile {
  reference: {
    width: number;
    height: number;
    crop: { x: number; y: number; size: number };
  };
  views: { name: string }[];
  measurement: unknown;
}

/** Hash the bytes, including receipt fields this diagnostic does not interpret. */
export const portraitCaptureDigest = (bytes: Uint8Array): string =>
  createHash("sha256").update(bytes).digest("hex");

/**
 * Validate every consumed byte population against its declared capture. The raw
 * receipt digest preserves renderer, view and generation changes even when the
 * GLB and profile are unchanged. Other view images are not consumed or certified
 * here; the complete preview publisher verifies those separately.
 *
 * Source coordinates are pixels in the recorded measurement frame. Its identity
 * must match the control net used by the diagnostic; crop dimensions are finite
 * source pixels, and must remain inside the full image.
 */
export function inspectPortraitCapture(
  bytes: IPortraitCaptureBytes,
  expected: { input: string; measurement: unknown },
) {
  const receipt: IPortraitCaptureReceipt = JSON.parse(
    Buffer.from(bytes.receipt).toString("utf8"),
  );
  for (const key of [
    "input",
    "model",
    "configuration",
    "gltf",
    "profile",
  ] as const)
    if (portraitCaptureDigest(bytes[key]) !== receipt.artifact[key])
      throw new Error("Captured " + key + " bytes differ from their receipt.");
  if (receipt.artifact.input !== expected.input)
    throw new Error("The capture belongs to a different source observation.");
  const profile: IPortraitDiagnosticProfile = JSON.parse(
    Buffer.from(bytes.profile).toString("utf8"),
  );
  if (
    JSON.stringify(profile.measurement) !== JSON.stringify(expected.measurement)
  )
    throw new Error(
      "The captured measurement frame differs from the control net.",
    );
  const { width, height, crop } = profile.reference;
  if (
    ![width, height, crop.x, crop.y, crop.size].every(Number.isFinite) ||
    width <= 0 ||
    height <= 0 ||
    crop.x < 0 ||
    crop.y < 0 ||
    crop.size <= 0 ||
    crop.x + crop.size > width ||
    crop.y + crop.size > height
  )
    throw new Error(
      "The source crop must be finite and inside the source image.",
    );
  const names = [
    "calibration",
    ...profile.views.map((view) => view.name),
    "reference",
    "reference-clay",
    "clay",
    "clay-oblique",
  ];
  if (
    new Set(names).size !== names.length ||
    receipt.captures.length !== names.length ||
    names.some(
      (name) =>
        receipt.captures.filter((frame) => frame.name === name).length !== 1,
    ) ||
    receipt.captures.some((frame) => frame.file !== frame.name + ".png")
  )
    throw new Error("The capture view inventory is incomplete or duplicated.");
  // The inventory check establishes this lookup; no guessed first duplicate is
  // allowed to supply the source-pose image identity.
  const reference = receipt.captures.find(
    (frame) => frame.name === "reference",
  )!;
  if (portraitCaptureDigest(bytes.reference) !== reference.sha256)
    throw new Error("The reference image differs from its captured pixels.");
  return {
    receipt,
    profile,
    generation: portraitCaptureDigest(bytes.receipt),
    bytes,
  };
}

/**
 * Serialize capture reads, inference and publication with the preview publisher.
 * The adapter must acquire the same exclusive-create lease used by preview.ps1,
 * and keep it until every output write finishes. Revalidation detects input
 * edits by processes that do not participate in that lease; it is not a claim
 * of protection against arbitrary concurrent filesystem writes or crash-atomic
 * multi-file publication. A failed acquisition never releases another owner.
 */
export async function runPortraitCaptureDiagnostic<T>(props: {
  expected: { input: string; measurement: unknown };
  acquire: () => Promise<() => Promise<void>>;
  read: () => Promise<IPortraitCaptureBytes>;
  observe: (capture: ReturnType<typeof inspectPortraitCapture>) => Promise<T>;
  publish: (result: T, generation: string) => Promise<void>;
}): Promise<T> {
  const release = await props.acquire();
  try {
    const capture = inspectPortraitCapture(await props.read(), props.expected);
    const result = await props.observe(capture);
    const current = inspectPortraitCapture(await props.read(), props.expected);
    if (current.generation !== capture.generation)
      throw new Error("The preview generation changed during observation.");
    await props.publish(result, capture.generation);
    return result;
  } finally {
    await release();
  }
}
