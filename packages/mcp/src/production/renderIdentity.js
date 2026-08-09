import { canonicalAutoMovieJsonBytes, encodeAutoMoviePathSegment, fingerprintAutoMovieFields, } from "./contentIdentity";
/** Versioned identity protocol for target-local deterministic render inputs. */
export const AUTOMOVIE_RENDER_TARGET_FINGERPRINT_PROTOCOL = "automovie.render.target.v3";
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
 */
export const productionRenderTargetFingerprint = (project, generated, target, contentInputs = project.contentInputs()) => {
    const fields = [
        {
            role: "protocol",
            kind: "render-target",
            payload: Buffer.from(AUTOMOVIE_RENDER_TARGET_FINGERPRINT_PROTOCOL, "utf8"),
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
    const targetPath = target.kind === "shot"
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
//# sourceMappingURL=renderIdentity.js.map