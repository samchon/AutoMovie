import type {
  AutoMovieContentDigest,
  IAutoMovieRepaintGeneratorAdoption,
  IAutoMovieRepaintGeneratorProvenance,
  IAutoMovieRepaintReceipt,
  IAutoMovieRepaintRuntimeIdentity,
} from "@automovie/interface";
import {
  canonicalAutoMovieRepaintGeneratorAdoption,
  canonicalAutoMovieRepaintGeneratorProvenance,
  canonicalAutoMovieRepaintRuntimeIdentity,
  productionRepaintOutputPath,
} from "@automovie/production";
import { TestValidator } from "@nestia/e2e";

const digest = (value: string): AutoMovieContentDigest => `sha256:${value}`;

const adoption = (): IAutoMovieRepaintGeneratorAdoption => ({
  runtimeIdentity: {
    protocolVersion: "automovie.repaint-runtime.v1",
    provider: "reviewed-local-host",
    model: "studio/repaint-model",
    version: "sha256:model-revision",
    execution: "local",
  },
  generatorProvenance: {
    source: "https://models.example/studio/repaint-model",
    license: "license-records/repaint-model.md",
    termsCheckedAt: "2026-08-28",
    cost: "local compute; no per-request provider fee",
    consumer: {
      kind: "repaint",
      reason: "the reviewed final delivery requires an appearance rendition",
    },
  },
});

const messageOf = (operation: () => unknown): string | null => {
  try {
    operation();
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
};

/**
 * Repaint generator adoption is strict identity, not incidental metadata.
 *
 * Scenarios:
 *
 * 1. Runtime, reviewed provenance, and their complete adoption canonicalize
 *    independently and without depending on authored key order.
 * 2. Hidden fields, credentials, malformed identities, padded text, false
 *    dates, and a consumer from another generation lane are all refused.
 * 3. Every generator-provenance change creates a distinct content-addressed
 *    rendition path, while an unchanged request retains the same path.
 * 4. Public repaint receipt v3 requires both reviewed provenance and the
 *    deterministic-source authority boundary.
 */
export const test_production_repaint_generator_identity = (): void => {
  const selected = adoption();
  const reordered = {
    generatorProvenance: {
      consumer: {
        reason: selected.generatorProvenance.consumer.reason,
        kind: "repaint",
      },
      cost: selected.generatorProvenance.cost,
      termsCheckedAt: selected.generatorProvenance.termsCheckedAt,
      license: selected.generatorProvenance.license,
      source: selected.generatorProvenance.source,
    },
    runtimeIdentity: {
      execution: "local",
      version: selected.runtimeIdentity.version,
      model: selected.runtimeIdentity.model,
      provider: selected.runtimeIdentity.provider,
      protocolVersion: "automovie.repaint-runtime.v1",
    },
  } as IAutoMovieRepaintGeneratorAdoption;
  TestValidator.equals(
    "repaint adoption canonicalization is stable across exact key order",
    {
      runtime: canonicalAutoMovieRepaintRuntimeIdentity(
        selected.runtimeIdentity,
      ),
      provenance: canonicalAutoMovieRepaintGeneratorProvenance(
        selected.generatorProvenance,
      ),
      adoption: canonicalAutoMovieRepaintGeneratorAdoption(selected),
    },
    {
      runtime: canonicalAutoMovieRepaintRuntimeIdentity(
        reordered.runtimeIdentity,
      ),
      provenance: canonicalAutoMovieRepaintGeneratorProvenance(
        reordered.generatorProvenance,
      ),
      adoption: canonicalAutoMovieRepaintGeneratorAdoption(reordered),
    },
  );

  const malformedRuntime: unknown[] = [
    null,
    [],
    { ...selected.runtimeIdentity, apiKey: "must-not-enter-identity" },
    { ...selected.runtimeIdentity, protocolVersion: "repaint-v2" },
    { ...selected.runtimeIdentity, provider: "" },
    { ...selected.runtimeIdentity, provider: " padded " },
    { ...selected.runtimeIdentity, model: "" },
    { ...selected.runtimeIdentity, version: "" },
    { ...selected.runtimeIdentity, execution: "cloud" },
  ];
  const provenance = selected.generatorProvenance;
  const malformedProvenance: unknown[] = [
    null,
    [],
    { ...provenance, credential: "must-not-enter-provenance" },
    { ...provenance, source: "" },
    { ...provenance, source: " padded " },
    { ...provenance, license: "" },
    { ...provenance, termsCheckedAt: "today" },
    { ...provenance, termsCheckedAt: "2026-02-30" },
    { ...provenance, cost: "" },
    { ...provenance, consumer: null },
    { ...provenance, consumer: { kind: "dialogue-synthesis", reason: "x" } },
    { ...provenance, consumer: { kind: "repaint", reason: " padded " } },
    {
      ...provenance,
      consumer: { ...provenance.consumer, credential: "forbidden" },
    },
  ];
  const malformedAdoption: unknown[] = [
    null,
    [],
    { ...selected, credential: "forbidden" },
    { runtimeIdentity: selected.runtimeIdentity },
    {
      ...selected,
      runtimeIdentity: { ...selected.runtimeIdentity, provider: "" },
    },
    {
      ...selected,
      generatorProvenance: { ...provenance, termsCheckedAt: "2026-13-01" },
    },
  ];
  TestValidator.predicate(
    "repaint runtime rejects every malformed or hidden identity field",
    malformedRuntime.every(
      (value) =>
        messageOf(() =>
          canonicalAutoMovieRepaintRuntimeIdentity(
            value as IAutoMovieRepaintRuntimeIdentity,
          ),
        ) !== null,
    ),
  );
  TestValidator.predicate(
    "repaint provenance rejects every malformed or hidden adoption field",
    malformedProvenance.every(
      (value) =>
        messageOf(() =>
          canonicalAutoMovieRepaintGeneratorProvenance(
            value as IAutoMovieRepaintGeneratorProvenance,
          ),
        ) !== null,
    ),
  );
  TestValidator.predicate(
    "repaint adoption rejects an incomplete, extended, or invalid pair",
    malformedAdoption.every(
      (value) =>
        messageOf(() =>
          canonicalAutoMovieRepaintGeneratorAdoption(
            value as IAutoMovieRepaintGeneratorAdoption,
          ),
        ) !== null,
    ),
  );

  const outputRequest = {
    shot: "opening",
    sourceRenderFingerprint: digest("source"),
    attemptId: "attempt-1",
    adapterIdentity: canonicalAutoMovieRepaintRuntimeIdentity(
      selected.runtimeIdentity,
    ),
    generatorProvenance: selected.generatorProvenance,
    parameters: {
      prompt: "the reviewed quiet architectural finish",
      negativePrompt: "unowned subject, geometry change",
      seed: 41,
      strength: 0.35,
      controls: { scheduler: "fixed", guidance: 7.5 },
    },
    references: [
      {
        role: "style" as const,
        path: "assets/style.png",
        digest: digest("style"),
      },
    ],
    outputDigest: digest("output"),
  };
  const originalPath = productionRepaintOutputPath(outputRequest);
  const provenanceVariants: IAutoMovieRepaintGeneratorProvenance[] = [
    { ...provenance, source: `${provenance.source}/mirror` },
    { ...provenance, license: `${provenance.license}#amended` },
    { ...provenance, termsCheckedAt: "2026-08-29" },
    { ...provenance, cost: `${provenance.cost}; reserved GPU` },
    {
      ...provenance,
      consumer: { ...provenance.consumer, reason: "another reviewed reason" },
    },
  ];
  TestValidator.equals(
    "unchanged repaint request retains one cache identity",
    productionRepaintOutputPath({ ...outputRequest }),
    originalPath,
  );
  TestValidator.predicate(
    "every generator-provenance field participates in repaint cache identity",
    provenanceVariants.every(
      (generatorProvenance) =>
        productionRepaintOutputPath({
          ...outputRequest,
          generatorProvenance,
        }) !== originalPath,
    ),
  );
  const requestVariants = [
    {
      ...outputRequest,
      adapterIdentity: canonicalAutoMovieRepaintRuntimeIdentity({
        ...selected.runtimeIdentity,
        model: "studio/another-model",
      }),
    },
    {
      ...outputRequest,
      parameters: { ...outputRequest.parameters, prompt: "another prompt" },
    },
    {
      ...outputRequest,
      parameters: {
        ...outputRequest.parameters,
        negativePrompt: "another ban",
      },
    },
    {
      ...outputRequest,
      parameters: { ...outputRequest.parameters, seed: 42 },
    },
    {
      ...outputRequest,
      parameters: { ...outputRequest.parameters, strength: 0.36 },
    },
    {
      ...outputRequest,
      parameters: {
        ...outputRequest.parameters,
        controls: { ...outputRequest.parameters.controls, guidance: 8 },
      },
    },
    {
      ...outputRequest,
      references: [
        {
          ...outputRequest.references[0]!,
          path: "assets/another-style.png",
        },
      ],
    },
    { ...outputRequest, attemptId: "attempt-2" },
    { ...outputRequest, sourceRenderFingerprint: digest("another-source") },
    { ...outputRequest, outputDigest: digest("another-output") },
  ];
  TestValidator.predicate(
    "every reviewed request and output identity field changes the rendition path",
    requestVariants.every(
      (variant) => productionRepaintOutputPath(variant) !== originalPath,
    ),
  );

  const receipt: IAutoMovieRepaintReceipt = {
    version: 3,
    productionId: "identity-test",
    shot: "opening",
    compileFingerprint: digest("compile"),
    sourceRenderFingerprint: digest("source"),
    attemptId: "attempt-1",
    sourceBundle: "renders/opening/source",
    controls: [{ pass: "depth", frameDigests: [digest("depth")] }],
    references: [
      {
        role: "style",
        path: "assets/style.png",
        digest: digest("style"),
      },
    ],
    adapterIdentity: outputRequest.adapterIdentity,
    generatorProvenance: provenance,
    structuralAuthority: "deterministic-source-only",
    parameters: outputRequest.parameters,
    output: {
      path: originalPath,
      digest: digest("output"),
      bytes: 1,
      probe: {
        kind: "video",
        container: "mp4",
        codec: "h264",
        width: 16,
        height: 16,
        runtimeSeconds: 1,
        frameCount: 24,
        fps: 24,
      },
    },
  };
  const { generatorProvenance: omittedProvenance, ...withoutProvenance } =
    receipt;
  const { structuralAuthority: omittedAuthority, ...withoutAuthority } =
    receipt;
  void omittedProvenance;
  void omittedAuthority;
  // @ts-expect-error Receipt v3 requires reviewed generator provenance.
  const missingProvenance: IAutoMovieRepaintReceipt = withoutProvenance;
  // @ts-expect-error Receipt v3 requires the derived-output authority boundary.
  const missingAuthority: IAutoMovieRepaintReceipt = withoutAuthority;
  const staleVersion: IAutoMovieRepaintReceipt = {
    ...receipt,
    // @ts-expect-error Adding generator adoption changed the public schema.
    version: 2,
  };
  void missingProvenance;
  void missingAuthority;
  void staleVersion;
  TestValidator.equals(
    "repaint receipt v3 preserves adoption and authority through JSON",
    JSON.parse(JSON.stringify(receipt)) as IAutoMovieRepaintReceipt,
    receipt,
  );
};
