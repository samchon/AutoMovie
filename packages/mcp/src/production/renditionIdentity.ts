import {
  AutoMovieContentDigest,
  IAutoMovieRenderBundleManifest,
  IAutoMovieRepaintParameters,
  IAutoMovieRepaintReceipt,
  IAutoMovieRepaintRuntimeIdentity,
} from "@automovie/interface";
import path from "node:path";

import {
  canonicalAutoMovieJsonBytes,
  canonicalizeAutoMovieJson,
  compareCodeUnits,
  digestAutoMovieBytes,
  encodeAutoMoviePathSegment,
  fingerprintAutoMovieFields,
} from "./contentIdentity";

/**
 * Validate and canonicalize one host repaint/model identity.
 *
 * @evidence requirements/repaint/identity-and-provenance.md#repaint-provenance-refusal Refuses a runtime identity without its provider, model version, or execution boundary.
 * @evidence specifications/asset-and-representation/generated-assets-and-repaint-handoff.md#asset-spec-repaint-derivation-validation Canonicalizes external execution identity and refuses incomplete provenance fields.
 */
export const canonicalAutoMovieRepaintRuntimeIdentity = (
  identity: IAutoMovieRepaintRuntimeIdentity,
): string => {
  if (
    identity.protocolVersion !== "automovie.repaint-runtime.v1" ||
    identity.provider.trim().length === 0 ||
    identity.model.trim().length === 0 ||
    identity.version.trim().length === 0 ||
    (identity.execution !== "local" &&
      identity.execution !== "api" &&
      identity.execution !== "other")
  )
    throw new Error(
      "Repaint runtime identity requires protocol v1 plus non-blank provider, model, version, and a supported execution boundary.",
    );
  return canonicalizeAutoMovieJson(identity);
};

/**
 * Fingerprint a verified deterministic render manifest and frame digests.
 *
 * @evidence requirements/repaint/eligibility-and-prerequisites.md#repaint-current-evidence Binds the repaint handoff to one current render manifest and its exact frame identities.
 * @evidence specifications/asset-and-representation/generated-assets-and-repaint-handoff.md#asset-spec-repaint-execution-eligibility Makes source manifest and frame digests one immutable execution prerequisite.
 */
export const productionSourceRenderFingerprint = (props: {
  manifest: IAutoMovieRenderBundleManifest;
  frames: readonly {
    path: string;
    digest: AutoMovieContentDigest;
  }[];
}): AutoMovieContentDigest =>
  fingerprintAutoMovieFields([
    {
      role: "protocol",
      kind: "utf8",
      payload: Buffer.from("automovie.repaint-source.v1", "utf8"),
    },
    {
      role: "manifest",
      kind: "canonical-json",
      payload: canonicalAutoMovieJsonBytes(props.manifest),
    },
    ...props.frames.map((frame) => ({
      role: `frame:${frame.path}`,
      kind: "digest",
      payload: Buffer.from(frame.digest, "utf8"),
    })),
  ]);

/**
 * Canonical structural-control inventory for one verified source bundle.
 *
 * @evidence requirements/repaint/source-frames-and-reference-locking.md#repaint-reference-roles Keeps structural passes distinct from beauty and authored references.
 * @evidence specifications/asset-and-representation/generated-assets-and-repaint-handoff.md#asset-spec-repaint-controls-references Preserves each structural control role and its exact frame digests.
 */
export const productionRepaintStructuralControls = (
  manifest: IAutoMovieRenderBundleManifest,
): IAutoMovieRepaintReceipt["controls"] =>
  [...new Set(manifest.frames.map((frame) => frame.pass))]
    .filter(
      (
        pass,
      ): pass is Exclude<
        IAutoMovieRenderBundleManifest["frames"][number]["pass"],
        "beauty"
      > => pass !== "beauty",
    )
    .sort(compareCodeUnits)
    .map((pass) => ({
      pass,
      frameDigests: manifest.frames
        .filter((frame) => frame.pass === pass)
        .map((frame) => frame.digest),
    }));

/**
 * Content-addressed output path for one immutable rendition.
 *
 * @evidence requirements/repaint/identity-and-provenance.md#repaint-derivation-chain Includes attempt, adapter, parameters, references, source, and output digest in the rendition derivation.
 * @evidence specifications/asset-and-representation/generated-assets-and-repaint-handoff.md#asset-spec-repaint-derivation-validation Addresses every immutable rendition by its complete derivation inputs and output bytes.
 */
export const productionRepaintOutputPath = (props: {
  shot: string;
  sourceRenderFingerprint: AutoMovieContentDigest;
  attemptId: string;
  adapterIdentity: string;
  parameters: IAutoMovieRepaintParameters;
  references: readonly {
    role: "style" | "character";
    path: string;
    digest: AutoMovieContentDigest;
  }[];
  outputDigest: AutoMovieContentDigest;
}): string => {
  const request = digestAutoMovieBytes(
    canonicalAutoMovieJsonBytes({
      protocol: "automovie.repaint-request.v2",
      attemptId: props.attemptId,
      adapterIdentity: props.adapterIdentity,
      parameters: props.parameters,
      references: props.references,
    }),
  );
  return [
    "renditions",
    encodeAutoMoviePathSegment(props.shot),
    props.sourceRenderFingerprint.slice(7),
    request.slice(7),
    `${props.outputDigest.slice(7)}.mp4`,
  ].join("/");
};

/**
 * Convert one render-root path to the corresponding tracked receipt path.
 *
 * @evidence requirements/repaint/identity-and-provenance.md#repaint-derivation-chain Keeps the provenance receipt as a distinct tracked record linked to the rendition path.
 * @evidence specifications/asset-and-representation/generated-assets-and-repaint-handoff.md#asset-spec-repaint-derivation-validation Derives a stable provenance-record path from the immutable output identity.
 */
export const productionRepaintReceiptPath = (outputPath: string): string =>
  path.posix.join(
    "renditions",
    `${digestAutoMovieBytes(Buffer.from(outputPath, "utf8")).slice(7)}.json`,
  );

/**
 * Tracked pointer selecting one current rendition receipt for a shot.
 *
 * @evidence requirements/repaint/scope-and-user-choice.md#repaint-independent-artifact Keeps current selection separate from the immutable original and rendition artifacts.
 * @evidence specifications/asset-and-representation/generated-assets-and-repaint-handoff.md#asset-spec-repaint-output-provenance Points to one adopted receipt without merging its provenance into another output.
 */
export const productionRepaintActiveReceiptPath = (shot: string): string =>
  path.posix.join(
    "renditions",
    "active",
    `${encodeAutoMoviePathSegment(shot)}.json`,
  );
