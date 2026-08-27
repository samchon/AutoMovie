import {
  AutoMovieContentDigest,
  AutoMovieRepaintReferenceRole,
  IAutoMovieRenderBundleManifest,
  IAutoMovieRepaintGeneratorAdoption,
  IAutoMovieRepaintGeneratorProvenance,
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
    hasExactKeys(identity, [
      "protocolVersion",
      "provider",
      "model",
      "version",
      "execution",
    ]) === false ||
    identity.protocolVersion !== "automovie.repaint-runtime.v1" ||
    isNonBlank(identity.provider) === false ||
    isNonBlank(identity.model) === false ||
    isNonBlank(identity.version) === false ||
    (identity.execution !== "local" &&
      identity.execution !== "api" &&
      identity.execution !== "other")
  )
    throw new Error(
      "Repaint runtime identity requires protocol v1 plus non-blank provider, model, version, and a supported execution boundary.",
    );
  return canonicalizeAutoMovieJson(identity);
};

/** Validate and canonicalize reviewed repaint-generator provenance. */
export const canonicalAutoMovieRepaintGeneratorProvenance = (
  provenance: IAutoMovieRepaintGeneratorProvenance,
): string => {
  if (
    hasExactKeys(provenance, [
      "source",
      "license",
      "termsCheckedAt",
      "cost",
      "consumer",
    ]) === false ||
    isNonBlank(provenance.source) === false ||
    isNonBlank(provenance.license) === false ||
    isRealCalendarDate(provenance.termsCheckedAt) === false ||
    isNonBlank(provenance.cost) === false ||
    hasExactKeys(provenance.consumer, ["kind", "reason"]) === false ||
    provenance.consumer.kind !== "repaint" ||
    isNonBlank(provenance.consumer.reason) === false
  )
    throw new Error(
      "Repaint generator provenance requires exact non-blank source, license, real YYYY-MM-DD terms review, cost, and a reasoned repaint consumer, with no credential or hidden field.",
    );
  return canonicalizeAutoMovieJson(provenance);
};

/** Validate and canonicalize one exact repaint generator adoption. */
export const canonicalAutoMovieRepaintGeneratorAdoption = (
  adoption: IAutoMovieRepaintGeneratorAdoption,
): string => {
  if (
    hasExactKeys(adoption, ["runtimeIdentity", "generatorProvenance"]) === false
  )
    throw new Error(
      "Repaint generator adoption must contain exactly runtimeIdentity and generatorProvenance.",
    );
  canonicalAutoMovieRepaintRuntimeIdentity(adoption.runtimeIdentity);
  canonicalAutoMovieRepaintGeneratorProvenance(adoption.generatorProvenance);
  return canonicalizeAutoMovieJson(adoption);
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
  generatorProvenance: IAutoMovieRepaintGeneratorProvenance;
  parameters: IAutoMovieRepaintParameters;
  references: readonly {
    role: AutoMovieRepaintReferenceRole;
    path: string;
    digest: AutoMovieContentDigest;
  }[];
  outputDigest: AutoMovieContentDigest;
}): string => {
  const request = digestAutoMovieBytes(
    canonicalAutoMovieJsonBytes({
      protocol: "automovie.repaint-request.v3",
      attemptId: props.attemptId,
      adapterIdentity: props.adapterIdentity,
      generatorProvenance: JSON.parse(
        canonicalAutoMovieRepaintGeneratorProvenance(props.generatorProvenance),
      ),
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

const hasExactKeys = (value: unknown, keys: readonly string[]): boolean => {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    return false;
  const actual = Object.keys(value).sort(compareCodeUnits);
  const expected = [...keys].sort(compareCodeUnits);
  return (
    actual.length === expected.length &&
    actual.every((key, index) => key === expected[index])
  );
};

const isNonBlank = (value: unknown): value is string =>
  typeof value === "string" &&
  value.trim().length !== 0 &&
  value === value.trim();

const isRealCalendarDate = (value: unknown): value is string => {
  if (
    isNonBlank(value) === false ||
    /^\d{4}-\d{2}-\d{2}$/u.test(value) === false
  )
    return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return (
    Number.isNaN(parsed.getTime()) === false &&
    parsed.toISOString().startsWith(value)
  );
};
