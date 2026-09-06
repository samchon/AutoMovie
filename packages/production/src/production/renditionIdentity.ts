import {
  AutoMovieContentDigest,
  AutoMovieRepaintReferenceRole,
  IAutoMovieRenderBundleManifest,
  IAutoMovieRepaintExecutionPolicy,
  IAutoMovieRepaintGeneratorAdoption,
  IAutoMovieRepaintGeneratorProvenance,
  IAutoMovieRepaintParameters,
  IAutoMovieRepaintReceipt,
  IAutoMovieRepaintRequestEvidence,
  IAutoMovieRepaintRuntimeIdentity,
} from "@automovie/interface";
import path from "node:path";

import {
  autoMovieExternalLocatorRefusal,
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

/** Validate and canonicalize reviewed repaint-generator provenance.
 * @evidence requirements/external-inputs/credentials-rights-and-provenance.md#external-provenance-acquisition-activity Records the provider, model and terms review of a generated rendition without claiming that a seed reproduces it.
 * @evidence requirements/repaint/identity-and-provenance.md#repaint-nondeterminism-record Canonicalizes the provider and model facts of a rendition as provenance, not as a promise that the same seed reproduces it.
 * @evidence specifications/interchange-and-adoption/provenance-rights-and-secrets.md#interchange-generated-acquisition-snapshot Records the provider, exact model and terms review of a generated rendition as canonical provenance without inferring reproducibility.
 */
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
    autoMovieExternalLocatorRefusal(provenance.source) !== null ||
    autoMovieExternalLocatorRefusal(provenance.license) !== null ||
    canonicalAutoMovieExternalGeneratorTermsDate(provenance.termsCheckedAt) !==
      provenance.termsCheckedAt ||
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

/**
 * Canonicalize one real external-generator terms review calendar date.
 *
 * This content-identity operation deliberately has no wall-clock dependency.
 * Execution and adoption boundaries compare the result with their captured
 * UTC instant through `assertAutoMovieExternalGeneratorTermsAt`.
 *
 * @evidence requirements/repaint/providers-models-and-credentials.md#repaint-provider-terms Keeps a real reviewed terms date in generator provenance without making content identity depend on the current clock.
 * @evidence specifications/asset-and-representation/generated-assets-and-repaint-handoff.md#asset-spec-repaint-output-provenance Separates canonical generator identity from runtime-fact validation.
 * @evidence requirements/sound/sources-and-external-assets.md#sound-source-provenance Requires a generator's terms review to be a real UTC calendar date that is not after the recorded execution instant.
 */
export const canonicalAutoMovieExternalGeneratorTermsDate = (
  value: unknown,
): string => {
  if (
    isNonBlank(value) === false ||
    /^\d{4}-\d{2}-\d{2}$/u.test(value) === false
  )
    throw new Error(
      "External generator termsCheckedAt must be a real YYYY-MM-DD date.",
    );
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== value
  )
    throw new Error(
      "External generator termsCheckedAt must be a real YYYY-MM-DD date.",
    );
  return value;
};

/**
 * Refuse a terms review that lies after one captured execution/adoption time.
 *
 * The caller supplies the instant so preflight, persisted-receipt validation,
 * UTC-midnight tests, and resumed work all use the same explicit fact instead
 * of consulting ambient time inside a content-identity helper.
 *
 * @evidence requirements/repaint/providers-models-and-credentials.md#repaint-provider-terms Prevents a repaint execution from claiming terms were reviewed on a later UTC calendar day.
 * @evidence specifications/asset-and-representation/generated-assets-and-repaint-handoff.md#asset-spec-repaint-output-provenance Binds reviewed generator terms to the immutable execution or adoption instant retained by the receipt.
 */
export const assertAutoMovieExternalGeneratorTermsAt = (props: {
  termsCheckedAt: unknown;
  occurredAt: Date | string;
  label: string;
}): string => {
  const termsCheckedAt = canonicalAutoMovieExternalGeneratorTermsDate(
    props.termsCheckedAt,
  );
  const occurredAt =
    props.occurredAt instanceof Date
      ? new Date(props.occurredAt.getTime())
      : new Date(props.occurredAt);
  if (Number.isNaN(occurredAt.getTime()))
    throw new Error(`${props.label} requires a valid execution instant.`);
  const executionDate = occurredAt.toISOString().slice(0, 10);
  if (termsCheckedAt > executionDate)
    throw new Error(
      `${props.label}.termsCheckedAt ${termsCheckedAt} is later than execution UTC date ${executionDate}.`,
    );
  return termsCheckedAt;
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
    .filter(
      (pass) =>
        pass !== "mask" ||
        manifest.frames
          .filter((frame) => frame.pass === "mask")
          .every((frame) =>
            manifest.semanticMasks.some(
              (semantic) =>
                semantic.frame === frame.index &&
                semantic.pass === frame.pass &&
                semantic.coverage.unresolved.length === 0 &&
                semantic.coverage.unaddressed === 0,
            ),
          ),
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
 * @evidence requirements/repaint/retries-seeds-and-variation.md#repaint-attempt-failure-provenance Binds a candidate output to the complete immutable attempt request rather than an optional subset of its policy or evidence.
 * @evidence specifications/asset-and-representation/generated-assets-and-repaint-handoff.md#asset-spec-repaint-attempt-selection Keeps candidate identity distinct when any bounded policy or upstream evidence owner changes.
 */
export const productionRepaintOutputPath = (props: {
  shot: string;
  sourceRenderFingerprint: AutoMovieContentDigest;
  attemptId: string;
  adapterIdentity: string;
  generatorProvenance: IAutoMovieRepaintGeneratorProvenance;
  parameters: IAutoMovieRepaintParameters;
  executionPolicy: IAutoMovieRepaintExecutionPolicy;
  evidence: IAutoMovieRepaintRequestEvidence;
  references: readonly {
    role: AutoMovieRepaintReferenceRole;
    path: string;
    digest: AutoMovieContentDigest;
  }[];
  outputDigest: AutoMovieContentDigest;
}): string => {
  const request = digestAutoMovieBytes(
    canonicalAutoMovieJsonBytes({
      protocol: "automovie.repaint-request.v4",
      attemptId: props.attemptId,
      adapterIdentity: props.adapterIdentity,
      generatorProvenance: JSON.parse(
        canonicalAutoMovieRepaintGeneratorProvenance(props.generatorProvenance),
      ),
      parameters: props.parameters,
      executionPolicy: props.executionPolicy,
      evidence: props.evidence,
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

/** Content identity shared by every transport retry of one repaint request.
 * @evidence specifications/authoring-and-authority/prototype-determinism-and-fidelity.md#spec-authoring-downstream-fidelity-output Gives a repaint rendition an identity of its own, derived from but distinct from the deterministic source render.
 */
export const productionRepaintRequestFingerprint = (props: {
  shot: string;
  compileFingerprint: AutoMovieContentDigest;
  sourceRenderFingerprint: AutoMovieContentDigest;
  adapterIdentity: string;
  generatorProvenance: IAutoMovieRepaintGeneratorProvenance;
  parameters: IAutoMovieRepaintParameters;
  executionPolicy: IAutoMovieRepaintExecutionPolicy;
  evidence: IAutoMovieRepaintRequestEvidence;
  references: readonly {
    role: AutoMovieRepaintReferenceRole;
    path: string;
    digest: AutoMovieContentDigest;
  }[];
}): AutoMovieContentDigest =>
  digestAutoMovieBytes(
    canonicalAutoMovieJsonBytes({
      protocol: "automovie.repaint-request.v4",
      shot: props.shot,
      compileFingerprint: props.compileFingerprint,
      sourceRenderFingerprint: props.sourceRenderFingerprint,
      adapterIdentity: props.adapterIdentity,
      generatorProvenance: JSON.parse(
        canonicalAutoMovieRepaintGeneratorProvenance(props.generatorProvenance),
      ),
      parameters: props.parameters,
      executionPolicy: props.executionPolicy,
      evidence: props.evidence,
      references: props.references,
    }),
  );

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
