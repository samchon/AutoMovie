import {
  AutoMovieContentDigest,
  IAutoMovieGeneratedManifest,
  IAutoMovieRenderBundleManifest,
} from "@automovie/interface";

import { AutoMovieProductionProject } from "./AutoMovieProductionProject";
import {
  IAutoMovieFingerprintField,
  canonicalAutoMovieJsonBytes,
  encodeAutoMoviePathSegment,
  fingerprintAutoMovieFields,
} from "./contentIdentity";

/**
 * Versioned identity protocol for target-local deterministic render inputs.
 * @evidence specifications/editorial-render-and-delivery/render-budget-identity-and-recovery.md#spec-render-target-fingerprint-protocol Names the fingerprint encoding revision that is folded into every target identity so a serialization change is a new protocol.
 */
export const AUTOMOVIE_RENDER_TARGET_FINGERPRINT_PROTOCOL =
  "automovie.render.target.v3";

/**
 * Fingerprint only the bytes capable of changing one render target.
 *
 * A shot depends on its compiler-owned shot payload plus every explicitly
 * declared render content input (viewer, capture scripts, configuration and
 * assets). A path may be both source and render content; an explicit content
 * declaration wins for this purpose. The shot does not depend on unrelated
 * source. A future film bundle depends on the complete generated file set. The
 * aggregate compile fingerprint remains recorded for provenance, but this
 * identity decides whether verified pixels can survive an unrelated source
 * edit.
 * @evidence requirements/rendering/chunks-resume-and-recovery.md#rendering-retry-identity Keeps a retry under the same target fingerprint while any changed input becomes a new identity rather than a merged receipt.
 * @evidence specifications/editorial-render-and-delivery/render-budget-identity-and-recovery.md#spec-render-frame-identity Folds the production, edit, dependency and content facts of one target into a canonical fingerprint distinct from its byte digest.
 * @evidence specifications/editorial-render-and-delivery/render-budget-identity-and-recovery.md#spec-render-target-dependency-fingerprint Combines the target-owned payload and its named render dependencies by canonical role so an unrelated change leaves the identity intact.
 */
export const productionRenderTargetFingerprint = (
  project: AutoMovieProductionProject,
  generated: IAutoMovieGeneratedManifest,
  target: IAutoMovieRenderBundleManifest["target"],
  contentInputs: ReturnType<
    AutoMovieProductionProject["contentInputs"]
  > = project.contentInputs(),
): AutoMovieContentDigest => {
  const fields: IAutoMovieFingerprintField[] = [
    {
      role: "protocol",
      kind: "render-target",
      payload: Buffer.from(
        AUTOMOVIE_RENDER_TARGET_FINGERPRINT_PROTOCOL,
        "utf8",
      ),
    },
    {
      role: "target",
      kind: target.kind,
      payload: canonicalAutoMovieJsonBytes(target),
    },
    {
      role: "production",
      kind: "namespace",
      payload: Buffer.from(project.productionId, "utf8"),
    },
    {
      role: "compiler",
      kind: "identity",
      payload: canonicalAutoMovieJsonBytes(generated.compiler),
    },
  ];
  const targetPath =
    target.kind === "shot"
      ? `shots/${encodeAutoMoviePathSegment(target.id)}.json`
      : target.kind === "asset"
        ? `models/${encodeAutoMoviePathSegment(target.id)}.json`
        : null;
  for (const file of generated.files)
    if (targetPath === null || file.path === targetPath)
      fields.push({
        role: `generated:${file.path}`,
        kind: "digest",
        payload: Buffer.from(file.digest, "utf8"),
      });
  for (const content of contentInputs)
    if (content.render)
      fields.push({
        role: `content:${content.path}`,
        kind: content.bytes === null ? "absent" : "file",
        payload: content.bytes ?? new Uint8Array(),
      });
  return fingerprintAutoMovieFields(fields);
};
