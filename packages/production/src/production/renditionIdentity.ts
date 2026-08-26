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
 */
export const productionRepaintReceiptPath = (outputPath: string): string =>
  path.posix.join(
    "renditions",
    `${digestAutoMovieBytes(Buffer.from(outputPath, "utf8")).slice(7)}.json`,
  );

/**
 * Tracked pointer selecting one current rendition receipt for a shot.
 */
export const productionRepaintActiveReceiptPath = (shot: string): string =>
  path.posix.join(
    "renditions",
    "active",
    `${encodeAutoMoviePathSegment(shot)}.json`,
  );
