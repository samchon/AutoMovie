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

/**
 * Validate the cost basis, consumer, and supplied descriptive metadata.
 *
 * @evidence requirements/external-inputs/credentials-rights-and-provenance.md#external-provenance-acquisition-activity Canonicalizes generator consumer facts without treating them as a replay guarantee.
 * @evidence requirements/repaint/identity-and-provenance.md#repaint-nondeterminism-record Keeps the selected generator context distinct from a promise to reproduce output bytes.
 * @evidence specifications/interchange-and-adoption/provenance-rights-and-secrets.md#interchange-generated-acquisition-snapshot Canonicalizes the generator context accompanying an execution receipt.
 */
export const canonicalAutoMovieRepaintGeneratorProvenance = (
  provenance: IAutoMovieRepaintGeneratorProvenance,
): string => {
  if (
    hasExactKeys(
      provenance,
      ["cost", "consumer"],
      ["source", "license", "termsCheckedAt"],
    ) === false ||
    ["source", "license", "termsCheckedAt"].some((field) => {
      const value =
        provenance[field as "source" | "license" | "termsCheckedAt"];
      return (
        value !== undefined &&
        (typeof value !== "string" ||
          autoMovieExternalLocatorRefusal(value) === "credential-bearing")
      );
    }) ||
    isNonBlank(provenance.cost) === false ||
    hasExactKeys(provenance.consumer, ["kind", "reason"]) === false ||
    provenance.consumer.kind !== "repaint" ||
    isNonBlank(provenance.consumer.reason) === false
  )
    throw new Error(
      "Repaint generator context requires a cost basis and reasoned repaint consumer; supplied descriptive metadata must be strings without credentials.",
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

const hasExactKeys = (
  value: unknown,
  keys: readonly string[],
  optional: readonly string[] = [],
): boolean => {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    return false;
  const actual = Object.keys(value);
  return (
    keys.every((key) => Object.hasOwn(value, key)) &&
    actual.every((key) => keys.includes(key) || optional.includes(key))
  );
};

const isNonBlank = (value: unknown): value is string =>
  typeof value === "string" &&
  value.trim().length !== 0 &&
  value === value.trim();
